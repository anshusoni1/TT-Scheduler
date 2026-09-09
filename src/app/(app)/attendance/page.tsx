'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Clock,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import type { AttendanceOverview, SubjectAttendanceSummary } from '@/server/services/attendance.service';
import type { SynthesizedDaySchedule, TodayScheduleClass } from '@/server/services/scheduling.service';
import type { AttendanceStatus, AttendanceRecord } from '@/types/database';
import type { ApiResponse } from '@/types/api';
import { addDaysToDate } from '@/lib/dates';

export default function AttendancePage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [overview, setOverview] = useState<AttendanceOverview | null>(null);
  const [daySchedule, setDaySchedule] = useState<SynthesizedDaySchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingLoading, setMarkingLoading] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      const res = await fetch('/api/attendance');
      const json: ApiResponse<{ overview: AttendanceOverview }> = await res.json();
      if (res.ok && json.success) {
        setOverview(json.data.overview);
      }
    } catch {
      // Ignore background refresh errors
    }
  }, []);

  const fetchDaySchedule = useCallback(async (date: string) => {
    try {
      const res = await fetch(`/api/schedule/range?from=${date}&to=${date}`);
      const json: ApiResponse<{ days: SynthesizedDaySchedule[] }> = await res.json();
      if (res.ok && json.success && json.data.days.length > 0) {
        setDaySchedule(json.data.days[0]);
      } else {
        setDaySchedule(null);
      }
    } catch {
      setDaySchedule(null);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorBanner(null);
      await Promise.all([fetchOverview(), fetchDaySchedule(selectedDate)]);
      setLoading(false);
    };
    init();
  }, [selectedDate, fetchOverview, fetchDaySchedule]);

  const handleMarkAttendance = async (
    classItem: TodayScheduleClass,
    status: AttendanceStatus
  ) => {
    try {
      setMarkingLoading(classItem.id);
      setErrorBanner(null);
      setSuccessBanner(null);

      const res = await fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: selectedDate,
          timetable_entry_id: classItem.id,
          occurrence_context: 'regular',
          status,
          notes: `Subject: ${classItem.subject_name}${classItem.room ? ' • Room: ' + classItem.room : ''}`,
        }),
      });

      const json: ApiResponse<{ record: AttendanceRecord | null }> = await res.json();

      if (!res.ok || !json.success) {
        const msg = !json.success ? json.error.message : 'Failed to mark attendance.';
        throw new Error(msg);
      }

      setSuccessBanner(
        `Marked ${classItem.subject_name} as ${status.toUpperCase()} for ${selectedDate}`
      );

      // Refresh overview and local day records
      await Promise.all([fetchOverview(), fetchDaySchedule(selectedDate)]);
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Failed to mark attendance.');
    } finally {
      setMarkingLoading(null);
    }
  };

  // Find attendance status for a class on the currently viewed date
  const getSlotStatus = (classId: string): AttendanceStatus => {
    if (!overview?.recent_records) return 'not_marked';
    const match = overview.recent_records.find(
      (r) => r.date === selectedDate && r.timetable_entry_id === classId
    );
    return match ? match.status : 'not_marked';
  };

  return (
    <div className="flex flex-col">
      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Page Header */}
        <div className="flex flex-col justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight">
              Attendance Intelligence
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-300 mt-1">
              Real Occurrence-Linked Attendance & Safe Cuts Tracking
            </p>
          </div>
        </div>

        {/* Banner Notifications */}
        {errorBanner && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorBanner}</span>
          </div>
        )}

        {successBanner && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successBanner}</span>
          </div>
        )}

        {/* Attendance Summary Overview Cards */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Big Overall Percentage Card */}
            <div className="md:col-span-2 p-6 bg-slate-50 border border-slate-400/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                    Overall Attendance
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium border ${
                      overview.status === 'safe'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : overview.status === 'warning'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-coral-50 text-coral-700 border-coral-200'
                    }`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>{overview.status.toUpperCase()}</span>
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-5xl font-light text-slate-800 tracking-tight">
                    {overview.overall_percentage}%
                  </span>
                  <span className="text-xs text-slate-400">
                    Target: {overview.target_percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-slate-200 mt-4 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      overview.overall_percentage >= overview.target_percentage
                        ? 'bg-emerald-400'
                        : overview.overall_percentage >= overview.target_percentage - 10
                        ? 'bg-amber-400'
                        : 'bg-coral-400'
                    }`}
                    style={{ width: `${Math.min(100, overview.overall_percentage)}%` }}
                  />
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-400/20 text-xs text-slate-500">
                Formula: <span className="font-mono text-slate-600">present / (present + absent)</span> • Excused sessions are excluded from denominator.
              </div>
            </div>

            {/* Counts breakdown card */}
            <div className="p-6 bg-slate-50 border border-slate-400/20 flex flex-col justify-between">
              <span className="text-xs font-medium uppercase tracking-widest text-slate-500">
                Logged Sessions
              </span>
              <div className="grid grid-cols-2 gap-px my-4 bg-slate-400/20 border border-slate-400/20">
                <div className="p-3 bg-white">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Present</div>
                  <div className="text-2xl font-light text-slate-800 mt-1">{overview.present_count}</div>
                </div>
                <div className="p-3 bg-white">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Absent</div>
                  <div className="text-2xl font-light text-slate-800 mt-1">{overview.absent_count}</div>
                </div>
                <div className="p-3 bg-white">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Excused</div>
                  <div className="text-2xl font-light text-slate-800 mt-1">{overview.excused_count}</div>
                </div>
                <div className="p-3 bg-slate-100">
                  <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Unmarked</div>
                  <div className="text-2xl font-light text-slate-500 mt-1">{overview.not_marked_count}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-500">
                Total Semester Scheduled: {overview.total_scheduled}
              </div>
            </div>

            {/* Quick Action Info Card */}
            <div className="p-6 bg-slate-200/50 border border-slate-400/20 flex flex-col justify-between">
              <div>
                <span className="text-xs font-medium uppercase tracking-widest text-slate-600 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Academic Margin</span>
                </span>
                <p className="text-xs text-slate-700 mt-3 leading-relaxed">
                  Attendance is linked to real schedule occurrences. Marking a class updates safe-cut margins in real-time.
                </p>
              </div>
              <div className="pt-4 border-t border-slate-400/20 mt-4">
                <Link
                  href="/schedule"
                  className="text-xs font-medium text-coral-600 hover:text-coral-500 hover:underline transition-colors"
                >
                  View Full Week Schedule →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Class Occurrence Marking Station */}
        <div className="p-6 bg-slate-50 border border-slate-400/20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-400/20 gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-coral-500" />
                <span>Mark Attendance by Scheduled Occurrence</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Select any academic date to log your actual class attendance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(addDaysToDate(selectedDate, -1))}
                className="p-1.5 border border-slate-400/30 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 text-xs border border-slate-400/30 bg-transparent text-slate-800 focus:outline-none focus:border-slate-800"
              />
              <button
                onClick={() => setSelectedDate(addDaysToDate(selectedDate, 1))}
                className="p-1.5 border border-slate-400/30 hover:bg-slate-200 text-slate-600 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="px-3 py-1.5 text-xs font-medium border border-slate-400/30 bg-slate-200/50 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                Today
              </button>
            </div>
          </div>

          {/* Date's Class List */}
          {loading ? (
            <div className="py-12 text-center text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-coral-500" />
              <span className="text-xs">Resolving scheduled occurrences...</span>
            </div>
          ) : daySchedule?.isHoliday ? (
            <div className="p-8 border border-coral-200 bg-coral-50/30 text-center">
              <AlertTriangle className="h-8 w-8 text-coral-500 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-coral-800">
                Official Institutional Holiday: {daySchedule.holidayTitle}
              </h3>
              <p className="text-xs text-coral-700 mt-2 max-w-md mx-auto leading-relaxed">
                Regular timetable lectures and labs are suspended on official calendar holidays. Attendance cannot be recorded for this date.
              </p>
            </div>
          ) : !daySchedule || daySchedule.classes.length === 0 ? (
            <div className="py-12 border border-dashed border-slate-400/30 text-center text-slate-400">
              <CalendarIcon className="h-6 w-6 mx-auto mb-3 opacity-50 text-slate-400" />
              <p className="text-xs">No timetable classes scheduled for {selectedDate}.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {daySchedule.classes.map((cls) => {
                const currentStatus = getSlotStatus(cls.id);
                const isPending = markingLoading === cls.id;

                return (
                  <div
                    key={cls.id}
                    className="p-5 border border-slate-400/20 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-5"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-semibold text-sm text-slate-800">
                          {cls.subject_name}
                        </span>
                        {cls.subject_code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 border border-slate-400/30 text-slate-500">
                            {cls.subject_code}
                          </span>
                        )}
                        <span className="text-[10px] font-medium uppercase px-2 py-0.5 border border-slate-400/30 bg-slate-50 text-slate-600">
                          {cls.class_type}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                          <Clock className="h-3.5 w-3.5" />
                          {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                        </span>
                        {cls.room && <span>Room: {cls.room}</span>}
                        {cls.faculty_name && <span>• {cls.faculty_name}</span>}
                      </div>
                    </div>

                    {/* Action Buttons: Present, Absent, Excused, Reset */}
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <button
                        onClick={() => handleMarkAttendance(cls, 'present')}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border ${
                          currentStatus === 'present'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Present</span>
                      </button>

                      <button
                        onClick={() => handleMarkAttendance(cls, 'absent')}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border ${
                          currentStatus === 'absent'
                            ? 'bg-coral-50 text-coral-700 border-coral-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Absent</span>
                      </button>

                      <button
                        onClick={() => handleMarkAttendance(cls, 'excused')}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium transition-colors border ${
                          currentStatus === 'excused'
                            ? 'bg-amber-50 text-amber-700 border-amber-300'
                            : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Excused</span>
                      </button>

                      {currentStatus !== 'not_marked' && (
                        <button
                          onClick={() => handleMarkAttendance(cls, 'not_marked')}
                          disabled={isPending}
                          className="p-2 text-slate-400 hover:text-slate-700 transition-colors"
                          title="Reset status to Unmarked"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Per-Subject Breakdown Cards */}
        {overview && overview.subjects.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-400/20 dark:border-slate-800 pb-3">
              <BarChart3 className="h-5 w-5 text-coral-500" />
              <span>Subject Attendance Breakdowns & Safe Cuts</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.subjects.map((sub: SubjectAttendanceSummary) => {
                return (
                  <div
                    key={sub.subject_name}
                    className="p-6 bg-white border border-slate-200 shadow-sm space-y-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900">
                          {sub.subject_name}
                        </h4>
                        {sub.subject_code && (
                          <span className="font-mono text-xs text-slate-500 mt-1 block">
                            {sub.subject_code}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-sm ${
                          sub.status === 'safe'
                            ? 'bg-emerald-100 text-emerald-800'
                            : sub.status === 'warning'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {sub.current_percentage}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all rounded-full ${
                          sub.current_percentage >= overview.target_percentage
                            ? 'bg-emerald-500'
                            : sub.current_percentage >= overview.target_percentage - 10
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.current_percentage)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center mt-3">
                      <div className="py-2 px-1 bg-slate-50 border border-slate-100">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Present</div>
                        <div className="font-semibold text-slate-800 text-lg">{sub.present}</div>
                      </div>
                      <div className="py-2 px-1 bg-slate-50 border border-slate-100">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Absent</div>
                        <div className="font-semibold text-slate-800 text-lg">{sub.absent}</div>
                      </div>
                      <div className="py-2 px-1 bg-slate-50 border border-slate-100">
                        <div className="text-[9px] text-slate-500 uppercase tracking-wider font-bold">Unmarked</div>
                        <div className="font-semibold text-slate-500 text-lg">{sub.not_marked}</div>
                      </div>
                    </div>

                    {/* Safe Cuts vs Classes Needed Banner */}
                    <div className="pt-3 border-t border-slate-100 text-xs">
                      {sub.safe_cuts_remaining > 0 ? (
                        <div className="text-emerald-700 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 shrink-0" />
                          <span>Safe Cuts Remaining: {sub.safe_cuts_remaining}</span>
                        </div>
                      ) : sub.classes_needed_for_target > 0 ? (
                        <div className="text-rose-600 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          <span>Must attend next {sub.classes_needed_for_target} sessions</span>
                        </div>
                      ) : (
                        <div className="text-slate-500 flex items-center gap-1.5">
                          <span>Target: {overview.target_percentage}% achieved</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
