import type { TypedSupabaseClient, AttendanceRecord } from '@/types/database';
import { AttendanceRepository, type MarkAttendanceInput } from '@/server/repositories/attendance.repository';
import { TimetablesRepository } from '@/server/repositories/timetables.repository';
import { CalendarsRepository } from '@/server/repositories/calendars.repository';
import { ExceptionsRepository } from '@/server/repositories/exceptions.repository';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { SchedulingService } from './scheduling.service';
import { ValidationError } from '@/lib/errors';

export interface SubjectAttendanceSummary {
  subject_name: string;
  subject_code: string | null;
  total_scheduled_semester: number;
  classes_held_to_date: number;
  present: number;
  absent: number;
  excused: number;
  not_marked: number;
  current_percentage: number;
  status: 'safe' | 'warning' | 'critical';
  safe_cuts_remaining: number;
  classes_needed_for_target: number;
}

export interface AttendanceOverview {
  target_percentage: number;
  total_scheduled: number;
  total_held_to_date: number;
  present_count: number;
  absent_count: number;
  excused_count: number;
  not_marked_count: number;
  overall_percentage: number;
  status: 'safe' | 'warning' | 'critical';
  subjects: SubjectAttendanceSummary[];
  recent_records: AttendanceRecord[];
}

export class AttendanceService {
  /**
   * Calculates overall student attendance metrics, subject summaries, and projection margins.
   */
  static async getAttendanceOverview(
    supabase: TypedSupabaseClient,
    userId: string,
    customTarget?: number
  ): Promise<AttendanceOverview> {
    const profilesRepo = new ProfilesRepository(supabase);
    const attendanceRepo = new AttendanceRepository(supabase);
    const timetablesRepo = new TimetablesRepository(supabase);

    const [profile, attendanceRecords, activeTimetable] = await Promise.all([
      profilesRepo.getProfile(userId),
      attendanceRepo.getAttendanceRecords(userId),
      timetablesRepo.getActiveTimetable(userId),
    ]);

    const target = customTarget ?? profile?.attendance_target_percentage ?? 75;

    // Fetch semester analytics for scheduled and held class baselines
    const semesterAnalytics = await SchedulingService.calculateAttendanceAnalytics(
      supabase,
      userId,
      target
    );

    // Map timetable entries by ID for fast lookup
    const entryMap = new Map<string, { subject_name: string; subject_code: string | null }>();
    if (activeTimetable) {
      for (const entry of activeTimetable.entries) {
        entryMap.set(entry.id, {
          subject_name: entry.subject_name.trim(),
          subject_code: entry.subject_code || null,
        });
      }
    }

    let overallPresent = 0;
    let overallAbsent = 0;
    let overallExcused = 0;

    // Track per-subject attendance counts: key = lowercase subject_name
    const subjectStats = new Map<string, {
      subject_name: string;
      subject_code: string | null;
      present: number;
      absent: number;
      excused: number;
    }>();

    // Initialize with subjects from active timetable / semester analytics
    for (const sub of semesterAnalytics.subjects) {
      const key = sub.subject_name.trim().toLowerCase();
      subjectStats.set(key, {
        subject_name: sub.subject_name.trim(),
        subject_code: sub.subject_code || null,
        present: 0,
        absent: 0,
        excused: 0,
      });
    }

    // Process actual recorded attendance records from PostgreSQL
    for (const record of attendanceRecords) {
      if (record.status === 'present') overallPresent++;
      else if (record.status === 'absent') overallAbsent++;
      else if (record.status === 'excused') overallExcused++;

      let subjName = 'Unknown Subject';
      let subjCode: string | null = null;

      if (record.timetable_entry_id && entryMap.has(record.timetable_entry_id)) {
        const info = entryMap.get(record.timetable_entry_id)!;
        subjName = info.subject_name;
        subjCode = info.subject_code;
      } else if (record.notes?.startsWith('Subject: ')) {
        subjName = record.notes.replace('Subject: ', '').split(' • ')[0].trim();
      }

      const key = subjName.toLowerCase();
      let stats = subjectStats.get(key);
      if (!stats) {
        stats = {
          subject_name: subjName,
          subject_code: subjCode,
          present: 0,
          absent: 0,
          excused: 0,
        };
        subjectStats.set(key, stats);
      }

      if (record.status === 'present') stats.present++;
      else if (record.status === 'absent') stats.absent++;
      else if (record.status === 'excused') stats.excused++;
    }

    // Standard formula: present / (present + absent) * 100 (excused omitted from denominator)
    const overallEvaluated = overallPresent + overallAbsent;
    const overallPercentage = overallEvaluated > 0
      ? Math.round((overallPresent / overallEvaluated) * 1000) / 10
      : 100.0;

    const overallStatus = overallPercentage >= target
      ? 'safe'
      : overallPercentage >= target - 10
      ? 'warning'
      : 'critical';

    // Build per-subject summaries
    const subjects: SubjectAttendanceSummary[] = [];

    for (const stats of subjectStats.values()) {
      const semSub = semesterAnalytics.subjects.find(
        (s) => s.subject_name.trim().toLowerCase() === stats.subject_name.toLowerCase()
      );

      const totalScheduled = semSub?.total_scheduled ?? (stats.present + stats.absent + stats.excused);
      const heldToDate = semSub?.classes_held_to_date ?? (stats.present + stats.absent + stats.excused);
      const notMarked = Math.max(0, heldToDate - (stats.present + stats.absent + stats.excused));

      const evaluated = stats.present + stats.absent;
      const subPercentage = evaluated > 0
        ? Math.round((stats.present / evaluated) * 1000) / 10
        : 100.0;

      const subStatus = subPercentage >= target
        ? 'safe'
        : subPercentage >= target - 10
        ? 'warning'
        : 'critical';

      // Safe cuts remaining: How many future sessions can be missed while staying >= target%
      // Condition: present / (evaluated + futureCuts) >= target / 100
      // => futureCuts <= (present * 100 / target) - evaluated
      let safeCutsRemaining = 0;
      let classesNeededForTarget = 0;

      if (target > 0) {
        const maxTotalSessionsAllowed = Math.floor((stats.present * 100) / target);
        safeCutsRemaining = Math.max(0, maxTotalSessionsAllowed - evaluated);

        // If below target: (present + x) / (evaluated + x) >= target / 100
        // => 100*present + 100*x >= target*evaluated + target*x
        // => (100 - target)*x >= target*evaluated - 100*present
        // => x = ceil((target*evaluated - 100*present) / (100 - target))
        if (subPercentage < target && target < 100) {
          const numerator = (target * evaluated) - (100 * stats.present);
          classesNeededForTarget = Math.max(0, Math.ceil(numerator / (100 - target)));
        }
      }

      subjects.push({
        subject_name: stats.subject_name,
        subject_code: stats.subject_code,
        total_scheduled_semester: totalScheduled,
        classes_held_to_date: heldToDate,
        present: stats.present,
        absent: stats.absent,
        excused: stats.excused,
        not_marked: notMarked,
        current_percentage: subPercentage,
        status: subStatus,
        safe_cuts_remaining: safeCutsRemaining,
        classes_needed_for_target: classesNeededForTarget,
      });
    }

    const totalNotMarked = subjects.reduce((sum, s) => sum + s.not_marked, 0);

    return {
      target_percentage: target,
      total_scheduled: semesterAnalytics.total_classes_semester,
      total_held_to_date: semesterAnalytics.classes_held_to_date,
      present_count: overallPresent,
      absent_count: overallAbsent,
      excused_count: overallExcused,
      not_marked_count: totalNotMarked,
      overall_percentage: overallPercentage,
      status: overallStatus,
      subjects,
      recent_records: attendanceRecords.slice(0, 20),
    };
  }

  /**
   * Marks or resets attendance for a class occurrence with domain validation.
   * Validates that the class is not on an institutional holiday and has not been cancelled.
   */
  static async markAttendance(
    supabase: TypedSupabaseClient,
    userId: string,
    input: MarkAttendanceInput
  ): Promise<AttendanceRecord | null> {
    const calendarsRepo = new CalendarsRepository(supabase);
    const exceptionsRepo = new ExceptionsRepository(supabase);
    const attendanceRepo = new AttendanceRepository(supabase);

    // 1. Verify Date is not an institutional holiday
    const activeCalendar = await calendarsRepo.getActiveCalendar(userId);
    if (activeCalendar) {
      const isHoliday = activeCalendar.events.some(
        (e) => e.event_date === input.date && (e.is_holiday || e.event_type === 'holiday' || e.event_type === 'recess')
      );
      if (isHoliday) {
        throw new ValidationError('Cannot mark attendance on an official academic holiday when classes are suspended.');
      }
    }

    // 2. Verify class is not explicitly cancelled
    if (input.timetable_entry_id) {
      const exceptions = await exceptionsRepo.getExceptionsForDate(userId, input.date);
      const isCancelled = exceptions.some(
        (ex) => ex.exception_type === 'cancelled' && ex.original_timetable_entry_id === input.timetable_entry_id
      );
      if (isCancelled) {
        throw new ValidationError('Cannot mark attendance for a class session that has been cancelled.');
      }
    }

    return attendanceRepo.setAttendance(userId, input);
  }
}
