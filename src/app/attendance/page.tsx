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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Attendance Intelligence
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Real Occurrence-Linked Attendance & Safe Cuts Tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/schedule"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Weekly Schedule
          </Link>
          <Link
            href="/timetable"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
          >
            Manage Timetable
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-8">
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
            <div className="md:col-span-2 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Overall Attendance
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      overview.status === 'safe'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                        : overview.status === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                        : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    <span>{overview.status.toUpperCase()}</span>
                  </span>
                </div>

                <div className="flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold text-slate-900 dark:text-white">
                    {overview.overall_percentage}%
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Target: {overview.target_percentage}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-3 bg-slate-100 dark:bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      overview.overall_percentage >= overview.target_percentage
                        ? 'bg-emerald-500'
                        : overview.overall_percentage >= overview.target_percentage - 10
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, overview.overall_percentage)}%` }}
                  />
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                Formula: <span className="font-mono font-medium">present / (present + absent)</span> • Excused sessions are excluded from denominator.
              </div>
            </div>

            {/* Counts breakdown card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Logged Sessions
              </span>
              <div className="grid grid-cols-2 gap-3 my-2">
                <div className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/50">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-semibold uppercase">Present</div>
                  <div className="text-2xl font-black text-emerald-800 dark:text-emerald-200 mt-0.5">{overview.present_count}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50">
                  <div className="text-[10px] text-rose-700 dark:text-rose-300 font-semibold uppercase">Absent</div>
                  <div className="text-2xl font-black text-rose-800 dark:text-rose-200 mt-0.5">{overview.absent_count}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-sky-50/60 dark:bg-sky-950/30 border border-sky-100 dark:border-sky-900/50">
                  <div className="text-[10px] text-sky-700 dark:text-sky-300 font-semibold uppercase">Excused</div>
                  <div className="text-2xl font-black text-sky-800 dark:text-sky-200 mt-0.5">{overview.excused_count}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">Not Marked</div>
                  <div className="text-2xl font-black text-slate-700 dark:text-slate-300 mt-0.5">{overview.not_marked_count}</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400">
                Total Semester Scheduled: {overview.total_scheduled}
              </div>
            </div>

            {/* Quick Action Info Card */}
            <div className="p-6 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/60 shadow-sm flex flex-col justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Academic Margin</span>
                </span>
                <p className="text-xs text-indigo-950 dark:text-indigo-200 mt-2 leading-relaxed">
                  Attendance is linked to real schedule occurrences. Marking a class updates safe-cut margins in real-time.
                </p>
              </div>
              <div className="pt-3 border-t border-indigo-200/60 dark:border-indigo-900/60">
                <Link
                  href="/schedule"
                  className="text-xs font-bold text-indigo-700 dark:text-indigo-300 hover:underline"
                >
                  View Full Week Schedule →
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Interactive Class Occurrence Marking Station */}
        <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-indigo-600" />
                <span>Mark Attendance by Scheduled Occurrence</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select any academic date to log your actual class attendance.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedDate(addDaysToDate(selectedDate, -1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Previous Day"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
              <button
                onClick={() => setSelectedDate(addDaysToDate(selectedDate, 1))}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                title="Next Day"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setSelectedDate(todayStr)}
                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300"
              >
                Today
              </button>
            </div>
          </div>

          {/* Date's Class List */}
          {loading ? (
            <div className="py-12 text-center text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
              <span className="text-xs">Resolving scheduled occurrences...</span>
            </div>
          ) : daySchedule?.isHoliday ? (
            <div className="p-8 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-center">
              <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-rose-900 dark:text-rose-200">
                Official Institutional Holiday: {daySchedule.holidayTitle}
              </h3>
              <p className="text-xs text-rose-700 dark:text-rose-400 mt-1 max-w-md mx-auto">
                Regular timetable lectures and labs are suspended on official calendar holidays. Attendance cannot be recorded for this date.
              </p>
            </div>
          ) : !daySchedule || daySchedule.classes.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <CalendarIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No timetable classes scheduled for {selectedDate}.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {daySchedule.classes.map((cls) => {
                const currentStatus = getSlotStatus(cls.id);
                const isPending = markingLoading === cls.id;

                return (
                  <div
                    key={cls.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {cls.subject_name}
                        </span>
                        {cls.subject_code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {cls.subject_code}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {cls.class_type}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="font-mono flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-semibold">
                          <Clock className="h-3.5 w-3.5" />
                          {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                        </span>
                        {cls.room && <span>Room: {cls.room}</span>}
                        {cls.faculty_name && <span>• {cls.faculty_name}</span>}
                      </div>
                    </div>

                    {/* Action Buttons: Present, Absent, Excused, Reset */}
                    <div className="flex items-center gap-1.5 self-start sm:self-center">
                      <button
                        onClick={() => handleMarkAttendance(cls, 'present')}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentStatus === 'present'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 border border-emerald-200 dark:border-emerald-900'
                        }`}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Present</span>
                      </button>

                      <button
                        onClick={() => handleMarkAttendance(cls, 'absent')}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentStatus === 'absent'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/80 border border-rose-200 dark:border-rose-900'
                        }`}
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Absent</span>
                      </button>

                      <button
                        onClick={() => handleMarkAttendance(cls, 'excused')}
                        disabled={isPending}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          currentStatus === 'excused'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/80 border border-sky-200 dark:border-sky-900'
                        }`}
                      >
                        <HelpCircle className="h-3.5 w-3.5" />
                        <span>Excused</span>
                      </button>

                      {currentStatus !== 'not_marked' && (
                        <button
                          onClick={() => handleMarkAttendance(cls, 'not_marked')}
                          disabled={isPending}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Reset status to Unmarked"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
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
          <div className="space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-indigo-600" />
              <span>Subject Attendance Breakdowns & Safe Cuts</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overview.subjects.map((sub: SubjectAttendanceSummary) => {
                return (
                  <div
                    key={sub.subject_name}
                    className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                          {sub.subject_name}
                        </h4>
                        {sub.subject_code && (
                          <span className="font-mono text-xs text-slate-400">
                            {sub.subject_code}
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                          sub.status === 'safe'
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200'
                            : sub.status === 'warning'
                            ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200'
                            : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200'
                        }`}
                      >
                        {sub.current_percentage}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          sub.current_percentage >= overview.target_percentage
                            ? 'bg-emerald-500'
                            : sub.current_percentage >= overview.target_percentage - 10
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, sub.current_percentage)}%` }}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-slate-400 uppercase">Present</div>
                        <div className="font-bold text-slate-900 dark:text-white">{sub.present}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-slate-400 uppercase">Absent</div>
                        <div className="font-bold text-slate-900 dark:text-white">{sub.absent}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-slate-400 uppercase">Unmarked</div>
                        <div className="font-bold text-slate-900 dark:text-white">{sub.not_marked}</div>
                      </div>
                    </div>

                    {/* Safe Cuts vs Classes Needed Banner */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                      {sub.safe_cuts_remaining > 0 ? (
                        <div className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>Safe Cuts Remaining: {sub.safe_cuts_remaining} lectures</span>
                        </div>
                      ) : sub.classes_needed_for_target > 0 ? (
                        <div className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>Must attend next {sub.classes_needed_for_target} consecutive sessions</span>
                        </div>
                      ) : (
                        <div className="text-slate-500 flex items-center gap-1.5">
                          <span>On exact target threshold ({overview.target_percentage}%)</span>
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
