'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  CalendarX,
  CalendarCheck,
  Download,
  Grid,
  List,
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
    <div className="flex flex-col">
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-12 space-y-8">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
              Weekly Schedule
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">
              Deterministic Academic Timetable & Calendar Synthesis
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-200/50 dark:bg-slate-800/50 rounded p-1 border border-slate-400/20">
              <button
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>Grid</span>
              </button>
              <button
                onClick={() => setViewMode('cards')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                  viewMode === 'cards'
                    ? 'bg-slate-100 text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
            </div>

            <a
              href={`/api/schedule/export?from=${startOfWeek}&to=${endOfWeek}`}
              download={`classflow-schedule-${startOfWeek}-to-${endOfWeek}.ics`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-slate-400/40 hover:bg-slate-200/50 text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 text-sm font-medium transition-colors"
              title="Download iCalendar for this week"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export Week</span>
            </a>

            <Link
              href="/timetable"
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-coral-400 hover:bg-coral-500 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Edit Slots</span>
            </Link>
          </div>
        </div>

        {/* Navigation Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-slate-100 border border-slate-400/20 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handlePrevWeek}
              className="p-2 rounded border border-slate-400/30 hover:bg-slate-200/50 text-slate-600 transition-colors"
              title="Previous Week"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={handleCurrentWeek}
              className="px-4 py-2 rounded border border-slate-400/30 hover:bg-slate-200/50 text-sm font-bold text-slate-700 transition-colors"
            >
              This Week
            </button>
            <button
              onClick={handleNextWeek}
              className="p-2 rounded border border-slate-400/30 hover:bg-slate-200/50 text-slate-600 transition-colors"
              title="Next Week"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <div className="h-6 w-px bg-slate-400/30 mx-2 hidden sm:block" />

            <div className="text-sm font-bold text-slate-800">
              {startOfWeek} <span className="text-slate-500 font-normal mx-1">to</span> {endOfWeek}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="jump-date" className="text-sm text-slate-600 font-medium whitespace-nowrap">
                Jump to:
              </label>
              <input
                id="jump-date"
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="px-3 py-1.5 text-sm rounded border border-slate-400/40 bg-slate-100 text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-slate-400"
              />
            </div>

            <div className="hidden lg:flex items-center gap-3 text-xs">
              <span className="px-3 py-1 rounded bg-slate-200 text-slate-800 font-semibold border border-slate-400/20">
                {totalClassesThisWeek} Classes
              </span>
              <span className="px-3 py-1 rounded bg-slate-200/50 text-slate-700 font-semibold border border-slate-400/20">
                {teachingDaysThisWeek} Teaching
              </span>
              {holidaysThisWeek > 0 && (
                <span className="px-3 py-1 rounded bg-coral-50 border border-coral-200 text-coral-700 font-semibold">
                  {holidaysThisWeek} {holidaysThisWeek === 1 ? 'Holiday' : 'Holidays'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="p-4 rounded-lg bg-coral-50 border border-coral-200 text-coral-700 text-sm font-medium flex items-center gap-3 shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400 mx-auto mb-4" />
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
              Synthesizing weekly schedule from timetable and academic calendar...
            </p>
          </div>
        ) : days.length === 0 ? (
          <div className="py-16 text-center rounded-xl border border-dashed border-slate-400/40">
            <CalendarIcon className="h-10 w-10 text-slate-400 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Schedule Configured</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mt-2 mb-6">
              Create an active timetable or upload your schedule document to view calculated weekly classes.
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/timetable"
                className="px-5 py-2.5 text-sm font-medium bg-coral-400 hover:bg-coral-500 text-white rounded transition-colors shadow-sm"
              >
                Create Timetable
              </Link>
              <Link
                href="/documents"
                className="px-5 py-2.5 text-sm font-medium border border-slate-400/40 hover:bg-slate-200/50 text-slate-700 dark:text-slate-300 dark:hover:text-slate-100 rounded transition-colors"
              >
                Upload Document
              </Link>
            </div>
          </div>
        ) : viewMode === 'grid' ? (
          /* Matrix Grid Layout */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {days.map((day) => {
              const isSelected = day.dateString === selectedDate;
              const isToday = day.dateString === todayStr;

              return (
                <div
                  key={day.dateString}
                  className={`flex flex-col rounded-xl border transition-all ${
                    isToday
                      ? 'border-coral-400 shadow-md bg-slate-100'
                      : isSelected
                      ? 'border-slate-400/60 bg-slate-100 shadow-sm'
                      : 'border-slate-400/20 bg-slate-100 shadow-sm'
                  }`}
                >
                  {/* Day Header */}
                  <div
                    className={`p-3 border-b flex flex-col gap-1.5 ${
                      isToday
                        ? 'border-coral-200 bg-coral-50 rounded-t-xl'
                        : 'border-slate-400/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm uppercase tracking-wider text-slate-800">
                        {day.dayOfWeek.slice(0, 3)}
                      </span>
                      {isToday && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-coral-500 text-white uppercase tracking-wider">
                          Today
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono text-slate-500">
                      {day.dateString.slice(5)}
                    </div>

                    {/* Day status badge */}
                    {day.isHoliday ? (
                      <div className="mt-1 px-2 py-1 rounded bg-coral-100/50 text-coral-700 text-[10px] font-bold flex items-center gap-1.5 truncate">
                        <CalendarX className="h-3 w-3 shrink-0" />
                        <span className="truncate">{day.holidayTitle || 'Holiday'}</span>
                      </div>
                    ) : day.isTeachingDay ? (
                      <div className="mt-1 px-2 py-1 rounded bg-slate-200/50 text-slate-600 text-[10px] font-bold flex items-center gap-1.5">
                        <CalendarCheck className="h-3 w-3 shrink-0" />
                        <span>Teaching</span>
                      </div>
                    ) : (
                      <div className="mt-1 px-2 py-1 rounded bg-slate-200/30 text-slate-500 text-[10px] font-medium">
                        Non-Instructional
                      </div>
                    )}
                  </div>

                  {/* Day Classes */}
                  <div className="p-3 flex-1 space-y-2.5">
                    {day.isHoliday ? (
                      <div className="py-8 text-center text-coral-500">
                        <CalendarX className="h-6 w-6 mx-auto mb-2 opacity-70" />
                        <div className="text-xs font-bold uppercase tracking-wider">Classes Suspended</div>
                      </div>
                    ) : day.classes.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs font-medium">
                        No classes scheduled
                      </div>
                    ) : (
                      day.classes.map((cls) => {
                        const isLab = cls.class_type === 'lab';
                        return (
                          <div
                            key={cls.id}
                            className={`p-3 rounded-lg border text-xs transition-all space-y-1.5 shadow-xs ${
                              isLab
                                ? 'bg-slate-200 border-slate-400/40'
                                : 'bg-slate-50 border-slate-400/20'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-bold text-slate-800 leading-tight">
                                {cls.subject_name}
                              </span>
                              <span
                                className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded shrink-0 ${
                                  isLab
                                    ? 'bg-slate-400/20 text-slate-700'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {cls.class_type}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-600 font-semibold">
                              <Clock className="h-3 w-3 shrink-0 opacity-70" />
                              <span>
                                {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                              </span>
                            </div>

                            <div className="flex flex-col gap-0.5 text-[10px] text-slate-500 font-medium">
                              {cls.room && (
                                <span className="flex gap-1"><span className="text-slate-400">Room:</span> {cls.room}</span>
                              )}
                              {cls.faculty_name && (
                                <span className="flex gap-1"><span className="text-slate-400">Prof:</span> <span className="truncate">{cls.faculty_name}</span></span>
                              )}
                            </div>

                            {cls.isOverride && (
                              <div className="pt-1">
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-coral-50 border border-coral-200 text-coral-700">
                                  Override
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
          <div className="space-y-6">
            {days.map((day) => (
              <div
                key={day.dateString}
                className="p-6 rounded-xl bg-slate-100 border border-slate-400/20 shadow-sm space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-400/10 gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-base uppercase tracking-widest text-slate-800">
                      {day.dayOfWeek}
                    </span>
                    <span className="font-mono text-sm text-slate-500">({day.dateString})</span>
                    {day.dateString === todayStr && (
                      <span className="px-2.5 py-0.5 rounded bg-coral-500 text-white text-[10px] font-bold uppercase tracking-wider">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {day.isHoliday ? (
                      <span className="px-3 py-1 rounded bg-coral-50 border border-coral-200 text-coral-700 text-xs font-bold flex items-center gap-1.5">
                        <CalendarX className="h-3.5 w-3.5" />
                        <span>{day.holidayTitle || 'Holiday'}</span>
                      </span>
                    ) : day.isTeachingDay ? (
                      <span className="px-3 py-1 rounded bg-slate-200/50 border border-slate-400/30 text-slate-700 text-xs font-semibold flex items-center gap-1.5">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        <span>Teaching Day</span>
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded border border-slate-400/30 text-slate-500 text-xs font-medium">
                        Non-Instructional
                      </span>
                    )}
                    <span className="text-sm font-semibold text-slate-600">
                      {day.classes.length} {day.classes.length === 1 ? 'class' : 'classes'}
                    </span>
                  </div>
                </div>

                {day.isHoliday ? (
                  <div className="p-5 rounded-lg bg-coral-50 border border-coral-200 text-sm text-coral-800 shadow-sm">
                    <div className="font-bold">Official Holiday: {day.holidayTitle}</div>
                    <div className="mt-1.5 text-coral-700">
                      {day.scheduleNote || 'Timetable classes are suspended for today.'}
                    </div>
                  </div>
                ) : day.classes.length === 0 ? (
                  <p className="text-sm font-medium text-slate-500 italic py-4">No lectures or labs scheduled for this day.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {day.classes.map((cls) => (
                      <div
                        key={cls.id}
                        className="p-5 rounded-lg border border-slate-400/20 bg-slate-200/30 space-y-2 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-bold text-slate-800 text-sm leading-tight">
                            {cls.subject_name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-slate-300/50 text-slate-700 shrink-0">
                            {cls.class_type}
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                          <Clock className="h-4 w-4 opacity-60" />
                          <span>
                            {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <div className="flex flex-col gap-1 text-xs font-medium text-slate-600 pt-1">
                          {cls.room && <span className="flex gap-1.5"><span className="text-slate-400">Room:</span> {cls.room}</span>}
                          {cls.faculty_name && <span className="flex gap-1.5"><span className="text-slate-400">Prof:</span> {cls.faculty_name}</span>}
                          {cls.subject_code && <span className="font-mono text-[10px] mt-1 text-slate-500">Code: {cls.subject_code}</span>}
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
