'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarX,
  CalendarCheck,
  Download,
  Grid,
  List,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import {
  getWeekRangeForDate,
  addDaysToDate,
} from '@/lib/dates';
import type { SynthesizedDaySchedule } from '@/server/services/scheduling.service';
import type { ApiResponse } from '@/types/api';

export default function WeeklySchedulePage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [startOfWeek, setStartOfWeek] = useState<string>(
    getWeekRangeForDate(todayStr).startOfWeek
  );
  const [viewMode, setViewMode] = useState<'grid' | 'cards'>('grid');
  const [days, setDays] = useState<SynthesizedDaySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const endOfWeek = addDaysToDate(startOfWeek, 6);

  const fetchWeekSchedule = useCallback(async (start: string, end: string) => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/schedule/range?from=${start}&to=${end}`);
      const json: ApiResponse<{ days: SynthesizedDaySchedule[] }> = await res.json();

      if (!res.ok || !json.success) {
        const errorMsg = !json.success ? json.error.message : 'Failed to load weekly schedule.';
        throw new Error(errorMsg);
      }

      setDays(json.data.days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schedule.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeekSchedule(startOfWeek, endOfWeek);
  }, [startOfWeek, endOfWeek, fetchWeekSchedule]);

  const handlePrevWeek = () => {
    const prev = addDaysToDate(startOfWeek, -7);
    setStartOfWeek(prev);
    setSelectedDate(prev);
  };

  const handleNextWeek = () => {
    const next = addDaysToDate(startOfWeek, 7);
    setStartOfWeek(next);
    setSelectedDate(next);
  };

  const handleCurrentWeek = () => {
    const currentMon = getWeekRangeForDate(todayStr).startOfWeek;
    setStartOfWeek(currentMon);
    setSelectedDate(todayStr);
  };

  const handleDateChange = (dateInput: string) => {
    if (!dateInput) return;
    setSelectedDate(dateInput);
    const mon = getWeekRangeForDate(dateInput).startOfWeek;
    setStartOfWeek(mon);
  };

  const totalClassesThisWeek = days.reduce((sum, d) => sum + d.classes.length, 0);
  const holidaysThisWeek = days.filter((d) => d.isHoliday).length;
  const teachingDaysThisWeek = days.filter((d) => d.isTeachingDay).length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
            title="Return to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              Weekly Schedule
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deterministic Academic Timetable & Calendar Synthesis
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Cards</span>
            </button>
          </div>

          <a
            href={`/api/schedule/export?from=${startOfWeek}&to=${endOfWeek}`}
            download={`classflow-schedule-${startOfWeek}-to-${endOfWeek}.ics`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition-colors"
            title="Download iCalendar for this week"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Export Week</span>
          </a>

          <Link
            href="/timetable"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Edit Slots</span>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Navigation Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 transition-colors"
            >
              This Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1 hidden sm:block" />

            <div className="text-sm font-bold text-slate-900 dark:text-white">
              {startOfWeek} <span className="text-slate-400 font-normal">to</span> {endOfWeek}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="jump-date" className="text-xs text-slate-500 font-medium whitespace-nowrap">
                Jump to:
              </label>
              <input
                id="jump-date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                {totalClassesThisWeek} Classes
              </span>
              <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-medium">
                {teachingDaysThisWeek} Teaching
              </span>
              {holidaysThisWeek > 0 && (
                <span className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-medium">
                  {holidaysThisWeek} {holidaysThisWeek === 1 ? 'Holiday' : 'Holidays'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synthesizing weekly schedule from timetable and academic calendar...
            </p>
          </div>
        ) : days.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
            <CalendarIcon className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">No Schedule Configured</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Create an active timetable or upload your schedule document to view calculated weekly classes.
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <Link
                href="/timetable"
                className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-xl"
              >
                Create Timetable
              </Link>
              <Link
                href="/documents"
                className="px-3.5 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl"
              >
                Upload Document
              </Link>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Matrix Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {days.map((day) => {
              const isSelected = day.dateString === selectedDate;
              const isToday = day.dateString === todayStr;

              return (
                <div
                  key={day.dateString}
                  className={`flex flex-col rounded-2xl border transition-all ${
                    isToday
                      ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 shadow-sm'
                      : isSelected
                      ? 'border-slate-400 dark:border-slate-600 bg-white dark:bg-slate-900'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-3 border-b flex flex-col gap-1 ${
                      isToday
                        ? 'border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/60 rounded-t-2xl'
                        : 'border-slate-100 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase tracking-wider text-slate-900 dark:text-white">
                        {day.dayOfWeek.slice(0, 3)}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-600 text-white">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                      {day.dateString.slice(5)}
                    </div>

                    {/* Day status badge */}
                    {day.isHoliday ? (
                      <div className="mt-1 px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-[10px] font-bold flex items-center gap-1 truncate">
                        <CalendarX className="h-2.5 w-2.5 shrink-0" />
                        <span className="truncate">{day.holidayTitle || 'Holiday'}</span>
                      </div>
                    ) : day.isTeachingDay ? (
                      <div className="mt-1 px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                        <CalendarCheck className="h-2.5 w-2.5 shrink-0" />
                        <span>Teaching</span>
                      </div>
                    ) : (
                      <div className="mt-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-medium">
                        Non-Instructional
                      </div>
                    )}
                  </div>

                  {/* Day Classes */}
                  <div className="p-2.5 flex-1 space-y-2">
                    {day.isHoliday ? (
                      <div className="py-6 text-center text-rose-600 dark:text-rose-400">
                        <CalendarX className="h-6 w-6 mx-auto mb-1 opacity-70" />
                        <div className="text-[11px] font-bold">Classes Suspended</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{day.holidayTitle}</div>
                      </div>
                    ) : day.classes.length === 0 ? (
                      <div className="py-6 text-center text-slate-400 text-[11px]">
                        No classes scheduled
                      </div>
                    ) : (
                      day.classes.map((cls) => {
                        const isLab = cls.class_type === 'lab';
                        return (
                          <div
                            key={cls.id}
                            className={`p-2.5 rounded-xl border text-xs transition-all space-y-1 ${
                              isLab
                                ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-900/60'
                                : 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/80 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 dark:text-white truncate">
                                {cls.subject_name}
                              </span>
                              <span
                                className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded-full ${
                                  isLab
                                    ? 'bg-purple-200/70 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300'
                                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                                }`}
                              >
                                {cls.class_type}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                              <Clock className="h-3 w-3 shrink-0" />
                              <span>
                                {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500">
                              {cls.room && (
                                <span className="px-1 py-0.2 rounded bg-white dark:bg-slate-900 font-medium">
                                  {cls.room}
                                </span>
                              )}
                              {cls.faculty_name && (
                                <span className="truncate">{cls.faculty_name}</span>
                              )}
                            </div>

                            {cls.isOverride && (
                              <div className="pt-0.5">
                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200">
                                  Override / Substituted
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Cards / Detailed Chronological List View */
          <div className="space-y-4">
            {days.map((day) => (
              <div
                key={day.dateString}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-sm uppercase text-slate-900 dark:text-white">
                      {day.dayOfWeek}
                    </span>
                    <span className="font-mono text-xs text-slate-400">({day.dateString})</span>
                    {day.dateString === todayStr && (
                      <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {day.isHoliday ? (
                      <span className="px-2.5 py-1 rounded-full bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-1">
                        <CalendarX className="h-3 w-3" />
                        <span>{day.holidayTitle || 'Holiday'}</span>
                      </span>
                    ) : day.isTeachingDay ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-1">
                        <CalendarCheck className="h-3 w-3" />
                        <span>Teaching Day</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs">
                        Non-Instructional
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {day.classes.length} {day.classes.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>
                </div>

                {day.isHoliday ? (
                  <div className="p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                    <div className="font-bold">Official Holiday: {day.holidayTitle}</div>
                    <div className="mt-1 text-slate-500 dark:text-slate-400">
                      {day.scheduleNote || 'Timetable classes are suspended for today.'}
                    </div>
                  </div>
                ) : day.classes.length === 0 ? (
                  <p className="text-xs text-slate-400 italic py-2">No lectures or labs scheduled for this day.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {day.classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {cls.subject_name}
                          </span>
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {cls.class_type}
                          </span>
                        </div>
                        <div className="text-xs font-mono text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>
                            {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          {cls.room && <span>Room: {cls.room}</span>}
                          {cls.faculty_name && <span>Prof: {cls.faculty_name}</span>}
                          {cls.subject_code && <span className="font-mono">({cls.subject_code})</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
