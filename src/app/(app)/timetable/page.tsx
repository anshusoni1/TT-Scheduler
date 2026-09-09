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
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top Header */}
      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">
              Timetables
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Manual Timetable Management & Schedule Registry
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {timetables.length > 1 && activeTimetable && (
              <select
                value={activeTimetable.id}
                onChange={(e) => {
                  const found = timetables.find((t) => t.id === e.target.value);
                  if (found) setActiveTimetable(found);
                }}
                className="text-xs px-2.5 py-1.5 rounded-none border-b border-slate-400/30 bg-transparent text-slate-800 font-medium focus:outline-none focus:border-slate-800 transition-colors"
              >
                {timetables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            )}

            <a
              href="/api/schedule/export"
              download="classflow-schedule.ics"
              className="text-xs font-medium px-4 py-2 rounded-none border border-slate-400/30 text-slate-800 hover:bg-slate-200/50 transition-colors flex items-center gap-1.5"
              title="Download iCalendar format (.ics)"
            >
              <Download className="h-3.5 w-3.5 text-slate-500" />
              <span className="hidden sm:inline">Export .ICS</span>
            </a>
            
            <button
              onClick={() => setShowNewTimetableModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-none bg-coral-500 hover:bg-coral-600 text-white text-xs font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>New Timetable</span>
            </button>
          </div>
        </div>



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
            <Loader2 className="h-6 w-6 animate-spin text-coral-500" />
            <p className="text-sm text-slate-500">Loading your academic schedule records...</p>
          </div>
        ) : !activeTimetable ? (
          /* Empty State: No Timetable */
          <div className="rounded-none border border-dashed border-slate-400/50 p-8 sm:p-12 text-center bg-slate-50">
            <div className="h-12 w-12 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <h2 className="text-base font-semibold text-slate-800 mb-2">
              No Active Timetable Found
            </h2>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-6 leading-relaxed">
              Create your first timetable to register classes and calculate daily schedules. All entries are stored securely.
            </p>
            <button
              onClick={() => setShowNewTimetableModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-none bg-coral-500 hover:bg-coral-600 text-white text-sm font-medium transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Timetable</span>
            </button>
          </div>
        ) : (
          /* Timetable Management Workspace */
          <div className="space-y-8">
            {/* Timetable Header Card */}
            <div className="p-6 bg-slate-50 border border-slate-400/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2 py-0.5 border border-slate-400/30 text-slate-600 text-[10px] uppercase tracking-wider font-medium mb-3">
                  <span className="h-1.5 w-1.5 rounded-full bg-coral-500"></span>
                  Active Timetable
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
                  {activeTimetable.name}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Effective: {activeTimetable.effective_from}{' '}
                  {activeTimetable.effective_to ? `to ${activeTimetable.effective_to}` : '(ongoing)'} • Timezone: {activeTimetable.timezone}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex border border-slate-400/30 bg-slate-200/30 p-0.5">
                  <button
                    onClick={() => setViewMode('day')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      viewMode === 'day'
                        ? 'bg-slate-100 text-slate-800 border border-slate-400/30'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
                    }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>Day View</span>
                  </button>
                  <button
                    onClick={() => setViewMode('week')}
                    className={`px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-1.5 ${
                      viewMode === 'week'
                        ? 'bg-slate-100 text-slate-800 border border-slate-400/30'
                        : 'text-slate-500 hover:text-slate-800 border border-transparent'
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Class Slot</span>
                </button>
              </div>
            </div>

            {viewMode === 'day' ? (
              <>
                {/* Weekday Selector Tabs */}
                <div className="flex items-center gap-1 overflow-x-auto pb-4 border-b border-slate-400/20">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayCount = activeTimetable.entries.filter((e) => e.day_of_week === day).length;
                    const isSelected = selectedDay === day;
                    return (
                      <button
                        key={day}
                        onClick={() => setSelectedDay(day)}
                        className={`px-4 py-2 text-xs font-medium capitalize whitespace-nowrap transition-colors flex items-center gap-2 border-b-2 ${
                          isSelected
                            ? 'border-slate-800 text-slate-800'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        <span>{day}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-none border ${
                            isSelected ? 'bg-slate-800 text-white border-slate-800' : 'bg-transparent text-slate-500 border-slate-400/30'
                          }`}
                        >
                          {dayCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Daily Classes List */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-medium uppercase tracking-widest text-slate-500">
                      {selectedDay} Schedule ({entriesForSelectedDay.length} {entriesForSelectedDay.length === 1 ? 'class' : 'classes'})
                    </h3>
                  </div>

                  {entriesForSelectedDay.length === 0 ? (
                    <div className="p-8 border border-dashed border-slate-400/40 text-center bg-slate-50/50">
                      <Clock className="h-5 w-5 text-slate-400 mx-auto mb-3" />
                      <p className="text-sm text-slate-500">
                        No classes registered for {selectedDay}.
                      </p>
                      <button
                        onClick={() => {
                          setEditingEntry(null);
                          setEntryDay(selectedDay);
                          resetEntryForm();
                          setShowAddEntryModal(true);
                        }}
                        className="mt-4 text-xs font-medium text-coral-500 hover:text-coral-600 inline-flex items-center gap-1.5"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add class for {selectedDay}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {entriesForSelectedDay.map((entry) => (
                        <div
                          key={entry.id}
                          className="p-5 border border-slate-400/20 bg-white flex items-start justify-between gap-3 group hover:border-slate-400/40 transition-colors"
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2.5">
                              <span className="font-semibold text-slate-800 text-sm">
                                {entry.subject_name}
                              </span>
                              {entry.subject_code && (
                                <span className="text-[10px] px-1.5 py-0.5 border border-slate-400/30 text-slate-500 font-mono">
                                  {entry.subject_code}
                                </span>
                              )}
                              <span className="text-[10px] uppercase font-medium px-2 py-0.5 border border-slate-400/30 bg-slate-50 text-slate-600">
                                {entry.class_type}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="flex items-center gap-1.5 text-slate-700">
                                <Clock className="h-3.5 w-3.5" />
                                {entry.start_time.slice(0, 5)} - {entry.end_time.slice(0, 5)}
                              </span>
                              {entry.room && <span>Room: {entry.room}</span>}
                              {entry.faculty_name && <span>• {entry.faculty_name}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditModal(entry)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 transition-colors"
                              title="Edit class"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry.id, entry.subject_name)}
                              className="p-1.5 text-slate-400 hover:text-coral-500 transition-colors"
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
                <div className="flex items-center justify-between border-b border-slate-400/20 pb-3">
                  <h3 className="text-xs font-medium uppercase tracking-widest text-slate-500">
                    Weekly Timetable Matrix ({activeTimetable.entries.length} total classes)
                  </h3>
                  <p className="text-xs text-slate-400">Monday – Saturday</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-0 border border-slate-400/20 bg-slate-400/20">
                  {DAYS_OF_WEEK.slice(0, 6).map((day) => {
                    const dayEntries = activeTimetable.entries
                      .filter((e) => e.day_of_week === day)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    return (
                      <div
                        key={day}
                        className="flex flex-col bg-white p-4"
                      >
                        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                          <span className="text-[11px] font-medium uppercase tracking-wider text-slate-800">
                            {day.slice(0, 3)}
                          </span>
                          <span className="text-[10px] font-medium text-slate-400">
                            {dayEntries.length}
                          </span>
                        </div>

                        <div className="space-y-3 flex-1">
                          {dayEntries.length === 0 ? (
                            <div className="text-center py-6 text-slate-300 text-xs italic">
                              No classes
                            </div>
                          ) : (
                            dayEntries.map((entry) => {
                              const isLab = entry.class_type === 'lab';
                              return (
                                <div
                                  key={entry.id}
                                  className={`p-3 border text-left group relative ${
                                    isLab
                                      ? 'border-coral-200 bg-coral-50/30'
                                      : 'border-slate-200 bg-slate-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                                    <span className="font-medium text-slate-700">
                                      {entry.start_time.slice(0, 5)}–{entry.end_time.slice(0, 5)}
                                    </span>
                                    <span
                                      className={`text-[9px] uppercase px-1 border font-medium ${
                                        isLab
                                          ? 'border-coral-200 text-coral-700 bg-white'
                                          : 'border-slate-300 text-slate-500 bg-white'
                                      }`}
                                    >
                                      {entry.class_type}
                                    </span>
                                  </div>

                                  <h5 className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2">
                                    {entry.subject_name}
                                  </h5>

                                  <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                                    <span>{entry.room ? `Rm: ${entry.room}` : ''}</span>
                                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-white px-1.5 py-0.5 border border-slate-200 absolute bottom-2 right-2">
                                      <button
                                        onClick={() => openEditModal(entry)}
                                        className="hover:text-slate-800"
                                        title="Edit"
                                      >
                                        <Edit2 className="h-3 w-3" />
                                      </button>
                                      <div className="w-px h-3 bg-slate-200"></div>
                                      <button
                                        onClick={() => handleDeleteEntry(entry.id, entry.subject_name)}
                                        className="hover:text-coral-500"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-50 border border-slate-200 p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                Create New Timetable
              </h3>
              <button
                onClick={() => setShowNewTimetableModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTimetable} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Timetable Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Monsoon Semester 2026"
                  value={newTtName}
                  onChange={(e) => setNewTtName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={newTtEffectiveFrom}
                    onChange={(e) => setNewTtEffectiveFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={newTtEffectiveTo}
                    onChange={(e) => setNewTtEffectiveTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowNewTimetableModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white transition-colors disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-slate-50 border border-slate-200 p-8 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <h3 className="text-lg font-semibold text-slate-800">
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

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Systems"
                  value={entrySubject}
                  onChange={(e) => setEntrySubject(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Subject Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS501"
                    value={entryCode}
                    onChange={(e) => setEntryCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Class Type
                  </label>
                  <select
                    value={entryType}
                    onChange={(e) => setEntryType(e.target.value as ClassType)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  >
                    <option value="lecture">Lecture</option>
                    <option value="lab">Lab</option>
                    <option value="tutorial">Tutorial</option>
                    <option value="seminar">Seminar</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Day *
                  </label>
                  <select
                    value={entryDay}
                    onChange={(e) => setEntryDay(e.target.value as DayOfWeek)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 capitalize focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d} className="capitalize">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={entryStart}
                    onChange={(e) => setEntryStart(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    End Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={entryEnd}
                    onChange={(e) => setEntryEnd(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Room / Hall
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Room 204"
                    value={entryRoom}
                    onChange={(e) => setEntryRoom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Faculty / Professor
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Ramesh Kumar"
                    value={entryFaculty}
                    onChange={(e) => setEntryFaculty(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 bg-white text-slate-900 focus:outline-none focus:border-slate-800 focus:ring-1 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEntryModal(false);
                    setEditingEntry(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-5 py-2 text-xs font-medium bg-slate-800 hover:bg-slate-900 text-white transition-colors disabled:opacity-50"
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
