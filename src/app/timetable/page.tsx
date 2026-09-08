'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  X,
  FileText,
  Download,
  Grid,
  List,
} from 'lucide-react';
import type { DayOfWeek, ClassType, TimetableEntry } from '@/types/database';
import { DAYS_OF_WEEK } from '@/lib/dates';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';

export default function TimetablePage() {
  const [loading, setLoading] = useState(true);
  const [activeTimetable, setActiveTimetable] = useState<TimetableWithEntries | null>(null);
  const [timetables, setTimetables] = useState<TimetableWithEntries[]>([]);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('monday');
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals state
  const [showNewTimetableModal, setShowNewTimetableModal] = useState(false);
  const [showAddEntryModal, setShowAddEntryModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimetableEntry | null>(null);
  const [actionPending, setActionPending] = useState(false);

  // New timetable form
  const [newTtName, setNewTtName] = useState('');
  const [newTtEffectiveFrom, setNewTtEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [newTtEffectiveTo, setNewTtEffectiveTo] = useState('');

  // Class entry form
  const [entryDay, setEntryDay] = useState<DayOfWeek>('monday');
  const [entryStart, setEntryStart] = useState('10:00');
  const [entryEnd, setEntryEnd] = useState('11:00');
  const [entrySubject, setEntrySubject] = useState('');
  const [entryCode, setEntryCode] = useState('');
  const [entryRoom, setEntryRoom] = useState('');
  const [entryFaculty, setEntryFaculty] = useState('');
  const [entryType, setEntryType] = useState<ClassType>('lecture');

  const fetchTimetables = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);
      const res = await fetch('/api/timetable');
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to load timetables');
      }

      setActiveTimetable(data.data.activeTimetable);
      setTimetables(data.data.timetables);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Error fetching timetables');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimetables();
  }, [fetchTimetables]);

  const handleCreateTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionPending(true);
    setErrorBanner(null);

    try {
      const res = await fetch('/api/timetable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTtName,
          effective_from: newTtEffectiveFrom,
          effective_to: newTtEffectiveTo || null,
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create timetable');
      }

      setShowNewTimetableModal(false);
      setNewTtName('');
      setNewTtEffectiveTo('');
      setSuccessBanner(`Timetable "${data.data.name}" created and set as active.`);
      await fetchTimetables();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTimetable) return;

    setActionPending(true);
    setErrorBanner(null);

    try {
      const payload = {
        day_of_week: entryDay,
        start_time: entryStart,
        end_time: entryEnd,
        subject_name: entrySubject,
        subject_code: entryCode || null,
        room: entryRoom || null,
        faculty_name: entryFaculty || null,
        class_type: entryType,
      };

      const url = editingEntry
        ? `/api/timetable/${activeTimetable.id}/entries/${editingEntry.id}`
        : `/api/timetable/${activeTimetable.id}/entries`;

      const method = editingEntry ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save class slot');
      }

      setShowAddEntryModal(false);
      setEditingEntry(null);
      resetEntryForm();
      setSuccessBanner(
        editingEntry
          ? `Updated class '${payload.subject_name}'.`
          : `Added class '${payload.subject_name}' to ${payload.day_of_week}.`
      );
      await fetchTimetables();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setActionPending(false);
    }
  };

  const handleDeleteEntry = async (entryId: string, subjectName: string) => {
    if (!activeTimetable) return;
    if (!confirm(`Are you sure you want to delete "${subjectName}"?`)) return;

    try {
      setErrorBanner(null);
      const res = await fetch(`/api/timetable/${activeTimetable.id}/entries/${entryId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete class slot');
      }
      setSuccessBanner(`Deleted class slot "${subjectName}".`);
      await fetchTimetables();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  const openEditModal = (entry: TimetableEntry) => {
    setEditingEntry(entry);
    setEntryDay(entry.day_of_week);
    setEntryStart(entry.start_time.slice(0, 5));
    setEntryEnd(entry.end_time.slice(0, 5));
    setEntrySubject(entry.subject_name);
    setEntryCode(entry.subject_code || '');
    setEntryRoom(entry.room || '');
    setEntryFaculty(entry.faculty_name || '');
    setEntryType(entry.class_type);
    setShowAddEntryModal(true);
  };

  const resetEntryForm = () => {
    setEntryStart('10:00');
    setEntryEnd('11:00');
    setEntrySubject('');
    setEntryCode('');
    setEntryRoom('');
    setEntryFaculty('');
    setEntryType('lecture');
  };

  const entriesForSelectedDay = activeTimetable?.entries
    ? activeTimetable.entries
        .filter((e) => e.day_of_week === selectedDay)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              ClassFlow Timetable
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Manual Timetable Management & Schedule Registry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {timetables.length > 1 && activeTimetable && (
            <select
              value={activeTimetable.id}
              onChange={(e) => {
                const found = timetables.find((t) => t.id === e.target.value);
                if (found) setActiveTimetable(found);
              }}
              className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
            >
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} {t.active ? '(Active)' : ''}
                </option>
              ))}
            </select>
          )}
          <Link
            href="/documents"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span>AI Documents</span>
          </Link>
          <Link
            href="/dashboard"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Dashboard
          </Link>
          <a
            href="/api/schedule/export"
            download="classflow-schedule.ics"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
            title="Download iCalendar format (.ics)"
          >
            <Download className="h-3.5 w-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Export .ICS</span>
          </a>
          <button
            onClick={() => setShowNewTimetableModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-colors shadow-sm"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Timetable</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Banner Messages */}
        {errorBanner && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorBanner}</span>
            </div>
            <button onClick={() => setErrorBanner(null)} className="text-red-500 hover:text-red-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successBanner && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex items-start justify-between gap-2 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{successBanner}</span>
            </div>
            <button onClick={() => setSuccessBanner(null)} className="text-emerald-500 hover:text-emerald-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            <p className="text-sm text-slate-500">Loading your academic schedule records...</p>
          </div>
        ) : !activeTimetable ? (
          /* Empty State: No Timetable */
          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center bg-white/50 dark:bg-slate-900/50">
            <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              No Active Timetable Found
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              Create your first timetable to register classes and calculate daily schedules. All entries are stored directly in PostgreSQL.
            </p>
            <button
              onClick={() => setShowNewTimetableModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Timetable</span>
            </button>
          </div>
        ) : (
          /* Timetable Management Workspace */
          <div className="space-y-6">
            {/* Timetable Header Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-semibold mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Active Timetable
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {activeTimetable.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Effective: {activeTimetable.effective_from}{' '}
                  {activeTimetable.effective_to ? `to ${activeTimetable.effective_to}` : '(ongoing)'} • Timezone: {activeTimetable.timezone}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
                  <button
                    onClick={() => setViewMode('day')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                      viewMode === 'day'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>Day View</span>
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                      viewMode === 'week'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Grid className="h-3.5 w-3.5" />
                    <span>Week Grid</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setEditingEntry(null);
                    setEntryDay(selectedDay);
                    resetEntryForm();
                    setShowAddEntryModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Class Slot</span>
                </button>
              </div>
            </div>

            {viewMode === 'day' ? (
              <>
                {/* Weekday Selector Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayCount = activeTimetable.entries.filter((e) => e.day_of_week === day).length;
                    const isSelected = selectedDay === day;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-all flex items-center gap-2 ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800'
                        }`}
                      >
                        <span>{day}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                            isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                          }`}
                        >
                          {dayCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Daily Classes List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      {selectedDay} Schedule ({entriesForSelectedDay.length} {entriesForSelectedDay.length === 1 ? 'class' : 'classes'})
                    </h3>
                  </div>

                  {entriesForSelectedDay.length === 0 ? (
                    <div className="p-8 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center bg-white/50 dark:bg-slate-900/50">
                      <Clock className="h-6 w-6 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        No classes registered for {selectedDay}.
                      </p>
                      <button
                        onClick={() => {
                          setEditingEntry(null);
                          setEntryDay(selectedDay);
                          resetEntryForm();
                          setShowAddEntryModal(true);
                        }}
                        className="mt-3 text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add class for {selectedDay}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {entriesForSelectedDay.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-start justify-between gap-3 group"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 dark:text-white text-sm">
                                {entry.subject_name}
                              </span>
                              {entry.subject_code && (
                                <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                                  {entry.subject_code}
                                </span>
                              )}
                              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                                {entry.class_type}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                              <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                                <Clock className="h-3.5 w-3.5" />
                                {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                              </span>
                              {entry.room && <span>Room: {entry.room}</span>}
                              {entry.faculty_name && <span>• {entry.faculty_name}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(entry)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Edit class"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id, entry.subject_name)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                              title="Delete class"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* Full Weekly Schedule Grid */
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Weekly Timetable Matrix ({activeTimetable.entries.length} total classes)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Monday – Saturday Overview</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  {DAYS_OF_WEEK.slice(0, 6).map((day) => {
                    const dayEntries = activeTimetable.entries
                      .filter((e) => e.day_of_week === day)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <div
                        key={day}
                        className="flex flex-col bg-slate-50/80 dark:bg-slate-900/60 rounded-xl border border-slate-200 dark:border-slate-800 p-3"
                      >
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-slate-200/80 dark:border-slate-800">
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                            {day.slice(0, 3)}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                            {dayEntries.length}
                          </span>
                        </div>

                        <div className="space-y-2 flex-1">
                          {dayEntries.length === 0 ? (
                            <div className="text-center py-6 text-slate-400 dark:text-slate-600 text-xs font-medium">
                              No classes
                            </div>
                          ) : (
                            dayEntries.map((entry) => {
                              const isLab = entry.class_type === 'lab';
                              return (
                                <div
                                  key={entry.id}
                                  className={`p-2.5 rounded-lg border text-left shadow-xs transition-all ${
                                    isLab
                                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30'
                                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                                    <span>
                                      {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                                    </span>
                                    <span
                                      className={`text-[9px] uppercase px-1 rounded font-semibold ${
                                        isLab
                                          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300'
                                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                      }`}
                                    >
                                      {entry.class_type}
                                    </span>
                                  </div>

                                  <h5 className="text-xs font-bold text-slate-900 dark:text-white leading-tight line-clamp-2">
                                    {entry.subject_name}
                                  </h5>

                                  <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                                    <span>{entry.room ? `Rm: ${entry.room}` : ''}</span>
                                    <div className="flex items-center gap-1 opacity-60 hover:opacity-100">
                                      <button
                                        onClick={() => openEditModal(entry)}
                                        className="hover:text-indigo-600"
                                        title="Edit"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEntry(entry.id, entry.subject_name)}
                                        className="hover:text-red-600"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal 1: Create New Timetable */}
      {showNewTimetableModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create New Timetable
              </h3>
              <button
                onClick={() => setShowNewTimetableModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTimetable} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Timetable Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monsoon Semester 2026"
                  value={newTtName}
                  onChange={(e) => setNewTtName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTtEffectiveFrom}
                    onChange={(e) => setNewTtEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={newTtEffectiveTo}
                    onChange={(e) => setNewTtEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowNewTimetableModal(false)}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionPending ? 'Creating...' : 'Save & Set Active'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add/Edit Class Slot */}
      {showAddEntryModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingEntry ? 'Edit Class Slot' : 'Add Class Slot'}
              </h3>
              <button
                onClick={() => {
                  setShowAddEntryModal(false);
                  setEditingEntry(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEntry} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems"
                  value={entrySubject}
                  onChange={(e) => setEntrySubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS501"
                    value={entryCode}
                    onChange={(e) => setEntryCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Class Type
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as ClassType)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="seminar">Seminar</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Day *
                  </label>
                  <select
                    value={entryDay}
                    onChange={(e) => setEntryDay(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white capitalize focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d} className="capitalize">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={entryStart}
                    onChange={(e) => setEntryStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={entryEnd}
                    onChange={(e) => setEntryEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Room / Hall
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204"
                    value={entryRoom}
                    onChange={(e) => setEntryRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Faculty / Professor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={entryFaculty}
                    onChange={(e) => setEntryFaculty(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEntryModal(false);
                    setEditingEntry(null);
                  }}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionPending ? 'Saving...' : editingEntry ? 'Save Changes' : 'Add Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
