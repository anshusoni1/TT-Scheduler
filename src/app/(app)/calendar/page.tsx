'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  ArrowLeft,
  Trash2,
  Edit2,
  AlertCircle,
  CheckCircle2,
  CalendarCheck,
  CalendarX,
  List,
  Grid,
  Loader2,
  X,
  FileText,
} from 'lucide-react';
import type { CalendarEvent, EventType, ScheduleException, ExceptionType } from '@/types/database';
import type { CalendarWithEvents } from '@/server/repositories/calendars.repository';
import type { TimetableWithEntries } from '@/server/repositories/timetables.repository';
import {
  EVENT_TYPES,
  EVENT_TYPE_METADATA,
  EXCEPTION_TYPES,
  EXCEPTION_TYPE_METADATA,
} from '@/lib/constants/calendar';

export default function CalendarPage() {
  const [loading, setLoading] = useState(true);
  const [activeCalendar, setActiveCalendar] = useState<CalendarWithEvents | null>(null);
  const [calendars, setCalendars] = useState<CalendarWithEvents[]>([]);
  const [activeTimetable, setActiveTimetable] = useState<TimetableWithEntries | null>(null);
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  
  const [viewMode, setViewMode] = useState<'month' | 'list'>('month');
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);

  // Month navigation: current displayed year and month (0-indexed)
  const todayObj = new Date();
  const [currentYear, setCurrentYear] = useState(todayObj.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(todayObj.getMonth()); // 0 = Jan, 11 = Dec
  const [selectedDate, setSelectedDate] = useState<string>(todayObj.toISOString().slice(0, 10));

  // Modals state
  const [showCreateCalendarModal, setShowCreateCalendarModal] = useState(false);
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [showAddExceptionModal, setShowAddExceptionModal] = useState(false);

  // Calendar form
  const [calName, setCalName] = useState('');
  const [calFrom, setCalFrom] = useState(todayObj.toISOString().slice(0, 10));
  const [calTo, setCalTo] = useState('');

  // Event form
  const [evDate, setEvDate] = useState(selectedDate);
  const [evType, setEvType] = useState<EventType>('holiday');
  const [evTitle, setEvTitle] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [evIsHoliday, setEvIsHoliday] = useState(true);
  const [evIsTeachingDay, setEvIsTeachingDay] = useState(false);
  const [evAffectsSchedule, setEvAffectsSchedule] = useState(true);

  // Schedule Exception form
  const [exType, setExType] = useState<ExceptionType>('cancelled');
  const [exSubject, setExSubject] = useState('');
  const [exStart, setExStart] = useState('10:00');
  const [exEnd, setExEnd] = useState('11:00');
  const [exRoom, setExRoom] = useState('');
  const [exReason, setExReason] = useState('');

  // Load all data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner(null);

      const [calRes, ttRes, exRes] = await Promise.all([
        fetch('/api/calendar'),
        fetch('/api/timetable'),
        fetch('/api/exceptions'),
      ]);

      const calData = await calRes.json();
      const ttData = await ttRes.json();
      const exData = await exRes.json();

      if (!calRes.ok || !calData.success) {
        throw new Error(calData.error?.message || 'Failed to load academic calendars');
      }

      setActiveCalendar(calData.data.activeCalendar);
      setCalendars(calData.data.calendars);

      if (ttRes.ok && ttData.success) {
        setActiveTimetable(ttData.data.activeTimetable);
      }

      if (exRes.ok && exData.success) {
        setExceptions(exData.data.exceptions || []);
      }
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Error fetching calendar records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // When event type changes in form, set default flags from domain model
  const handleEventTypeChange = (newType: EventType) => {
    setEvType(newType);
    const meta = EVENT_TYPE_METADATA[newType];
    if (meta) {
      setEvIsHoliday(meta.defaultIsHoliday);
      setEvIsTeachingDay(meta.defaultIsTeachingDay);
      setEvAffectsSchedule(meta.defaultAffectsRegularSchedule);
    }
  };

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleTodayMonth = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setSelectedDate(now.toISOString().slice(0, 10));
  };

  // Create Calendar Submit
  const handleCreateCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calName.trim()) {
      setErrorBanner('Calendar name is required');
      return;
    }
    try {
      setActionPending(true);
      setErrorBanner(null);

      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: calName.trim(),
          effective_from: calFrom,
          effective_to: calTo.trim() || undefined,
          active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create calendar');
      }

      setSuccessBanner(`Created academic calendar "${calName}".`);
      setShowCreateCalendarModal(false);
      setCalName('');
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Creation failed');
    } finally {
      setActionPending(false);
    }
  };

  // Create or Update Event Submit
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCalendar) return;
    if (!evTitle.trim()) {
      setErrorBanner('Event title is required');
      return;
    }

    try {
      setActionPending(true);
      setErrorBanner(null);

      const payload = {
        event_date: evDate,
        event_type: evType,
        title: evTitle.trim(),
        description: evDesc.trim() || undefined,
        is_holiday: evIsHoliday,
        is_teaching_day: evIsTeachingDay,
        affects_regular_schedule: evAffectsSchedule,
      };

      const url = editingEvent
        ? `/api/calendar/${activeCalendar.id}/events/${editingEvent.id}`
        : `/api/calendar/${activeCalendar.id}/events`;
      const method = editingEvent ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to save event');
      }

      setSuccessBanner(editingEvent ? `Updated "${evTitle}".` : `Added "${evTitle}".`);
      setShowAddEventModal(false);
      setEditingEvent(null);
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setActionPending(false);
    }
  };

  // Delete Event
  const handleDeleteEvent = async (eventId: string, title: string) => {
    if (!activeCalendar) return;
    if (!confirm(`Are you sure you want to delete event "${title}"?`)) return;

    try {
      setErrorBanner(null);
      const res = await fetch(`/api/calendar/${activeCalendar.id}/events/${eventId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete event');
      }
      setSuccessBanner(`Deleted event "${title}".`);
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Create Schedule Exception
  const handleSaveException = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setActionPending(true);
      setErrorBanner(null);

      const payload: Record<string, unknown> = {
        date: selectedDate,
        exception_type: exType,
        reason: exReason.trim() || undefined,
      };

      if (exType === 'extra_class' || exType === 'rescheduled') {
        payload.subject_name = exSubject.trim() || undefined;
        payload.start_time = exStart;
        payload.end_time = exEnd;
        payload.room = exRoom.trim() || undefined;
      } else if (exType === 'cancelled') {
        payload.subject_name = exSubject.trim() || undefined;
      } else if (exType === 'room_change') {
        payload.room = exRoom.trim() || undefined;
      }

      const res = await fetch('/api/exceptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to create schedule exception');
      }

      setSuccessBanner(`Schedule override applied for ${selectedDate}.`);
      setShowAddExceptionModal(false);
      setExSubject('');
      setExReason('');
      setExRoom('');
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Exception creation failed');
    } finally {
      setActionPending(false);
    }
  };

  // Delete Schedule Exception
  const handleDeleteException = async (exceptionId: string) => {
    try {
      setErrorBanner(null);
      const res = await fetch(`/api/exceptions/${exceptionId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Failed to delete exception');
      }
      setSuccessBanner('Schedule override removed.');
      await loadData();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : 'Delete failed');
    }
  };

  // Open Edit Event Modal
  const openEditEventModal = (event: CalendarEvent) => {
    setEditingEvent(event);
    setEvDate(event.event_date);
    setEvType(event.event_type);
    setEvTitle(event.title);
    setEvDesc(event.description || '');
    setEvIsHoliday(event.is_holiday);
    setEvIsTeachingDay(event.is_teaching_day);
    setEvAffectsSchedule(event.affects_regular_schedule);
    setShowAddEventModal(true);
  };

  // Calendar Grid Computation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  // In JS, getDay() returns 0 for Sunday, 1 for Monday.
  // We want Monday = 0, ..., Sunday = 6.
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarDays: { dayNumber: number; dateString: string; isCurrentMonth: boolean }[] = [];

  // Pad previous month days
  const prevMonthDaysCount = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const day = prevMonthDaysCount - i;
    const m = currentMonth === 0 ? 12 : currentMonth;
    const y = currentMonth === 0 ? currentYear - 1 : currentYear;
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    calendarDays.push({ dayNumber: day, dateString: ds, isCurrentMonth: false });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const ds = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ dayNumber: i, dateString: ds, isCurrentMonth: true });
  }

  // Pad next month days to complete grid (42 cells total for 6 weeks or 35 for 5)
  const remaining = (7 - (calendarDays.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const m = currentMonth === 11 ? 1 : currentMonth + 2;
    const y = currentMonth === 11 ? currentYear + 1 : currentYear;
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    calendarDays.push({ dayNumber: i, dateString: ds, isCurrentMonth: false });
  }

  // Events & exceptions mapped to selected date
  const eventsForSelectedDate = activeCalendar?.events
    ? activeCalendar.events.filter((e) => e.event_date === selectedDate)
    : [];

  const exceptionsForSelectedDate = exceptions.filter((ex) => ex.date === selectedDate);

  // Weekday and timetable slots for selected date
  const selectedDateObj = new Date(`${selectedDate}T00:00:00Z`);
  const utcDayIndex = selectedDateObj.getUTCDay();
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const selectedDayOfWeek = dayNames[utcDayIndex];

  const recurringClassesForSelectedDate = activeTimetable
    ? activeTimetable.entries
        .filter((e) => e.day_of_week === selectedDayOfWeek)
        .sort((a, b) => a.start_time.localeCompare(b.start_time))
    : [];

  const isSelectedDateHoliday = eventsForSelectedDate.some((e) => e.is_holiday || e.event_type === 'holiday') ||
    exceptionsForSelectedDate.some((ex) => ex.exception_type === 'date_holiday');

  const isSelectedDateTeachingDay = exceptionsForSelectedDate.some((ex) => ex.exception_type === 'date_teaching_day') ||
    (!isSelectedDateHoliday && (
      eventsForSelectedDate.some((e) => e.is_teaching_day || e.event_type === 'teaching_day' || e.event_type === 'working_day') ||
      recurringClassesForSelectedDate.length > 0
    ));

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Header */}
      {/* Main Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        
        {/* Page Actions & View Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white leading-tight">
              Calendar
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Manage institutional events, holidays, and schedule exceptions
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {calendars.length > 1 && activeCalendar && (
              <select
                value={activeCalendar.id}
                onChange={(e) => {
                  const found = calendars.find((c) => c.id === e.target.value);
                  if (found) setActiveCalendar(found);
                }}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium"
              >
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.active ? '(Active)' : ''}
                  </option>
                ))}
              </select>
            )}

            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
              <button
                onClick={() => setViewMode('month')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === 'month'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Grid className="h-3.5 w-3.5" />
                <span>Month</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                  viewMode === 'list'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <List className="h-3.5 w-3.5" />
                <span>Events</span>
              </button>
            </div>

            <button
              onClick={() => setShowCreateCalendarModal(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Calendar</span>
            </button>

            {activeCalendar && (
              <button
                onClick={() => {
                  setEditingEvent(null);
                  setEvDate(selectedDate);
                  handleEventTypeChange('holiday');
                  setEvTitle('');
                  setEvDesc('');
                  setShowAddEventModal(true);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-coral-600 hover:bg-coral-700 text-white text-xs font-medium transition-colors shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Event</span>
              </button>
            )}
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
          <div className="py-24 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-coral-600" />
            <p className="text-sm text-slate-500">Loading academic calendar events from PostgreSQL...</p>
          </div>
        ) : !activeCalendar ? (
          /* Empty State: No Calendar */
          <div className="rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-800 p-8 sm:p-12 text-center bg-white/50 dark:bg-slate-900/50">
            <div className="h-14 w-14 rounded-2xl bg-coral-50 dark:bg-coral-950/60 text-coral-600 dark:text-coral-400 flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-7 w-7" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
              No Academic Calendar Found
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
              Create an academic calendar to track institutional holidays, semester breaks, exam sessions, and schedule exceptions.
            </p>
            <button
              onClick={() => setShowCreateCalendarModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-coral-600 hover:bg-coral-700 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Create Calendar</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Calendar Header Card */}
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-coral-50 dark:bg-coral-950/60 text-coral-700 dark:text-coral-300 text-xs font-semibold mb-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-coral-500"></span>
                  Active Academic Calendar
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {activeCalendar.name}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Effective: {activeCalendar.effective_from}{' '}
                  {activeCalendar.effective_to ? `to ${activeCalendar.effective_to}` : '(ongoing)'} • {activeCalendar.events.length} registered events
                </p>
              </div>

              {/* Month Navigation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTodayMonth}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Today
                </button>
                <button
                  onClick={handlePrevMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-bold text-slate-900 dark:text-white min-w-32 text-center">
                  {monthNames[currentMonth]} {currentYear}
                </span>
                <button
                  onClick={handleNextMonth}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* View Mode: Month Grid */}
            {viewMode === 'month' ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 2-Column Calendar Grid */}
                <div className="lg:col-span-2 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                  {/* Day Headers */}
                  <div className="grid grid-cols-7 gap-1 text-center font-bold text-xs uppercase tracking-wider text-slate-400 mb-2">
                    <span>Mon</span>
                    <span>Tue</span>
                    <span>Wed</span>
                    <span>Thu</span>
                    <span>Fri</span>
                    <span className="text-coral-600 dark:text-coral-400">Sat</span>
                    <span className="text-rose-500">Sun</span>
                  </div>

                  {/* Day Cells */}
                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarDays.map((cell) => {
                      const isSelected = cell.dateString === selectedDate;
                      const dayEvents = activeCalendar.events.filter((e) => e.event_date === cell.dateString);
                      const dayExceptions = exceptions.filter((ex) => ex.date === cell.dateString);
                      const hasHoliday = dayEvents.some((e) => e.is_holiday || e.event_type === 'holiday') ||
                        dayExceptions.some((ex) => ex.exception_type === 'date_holiday');
                      const isTeaching = dayEvents.some((e) => e.is_teaching_day || e.event_type === 'teaching_day' || e.event_type === 'working_day');

                      return (
                        <button
                          key={cell.dateString}
                          onClick={() => setSelectedDate(cell.dateString)}
                          className={`min-h-16 p-2 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                            isSelected
                              ? 'border-coral-600 ring-2 ring-coral-500/20 bg-coral-50/50 dark:bg-coral-950/30'
                              : hasHoliday
                              ? 'border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 hover:bg-rose-50 dark:hover:bg-rose-900/40'
                              : isTeaching
                              ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-900/40'
                              : cell.isCurrentMonth
                              ? 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-850'
                              : 'border-slate-100 dark:border-slate-850 bg-slate-50/50 dark:bg-slate-900/40 text-slate-400 opacity-60'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`text-xs font-bold ${
                                isSelected
                                  ? 'text-coral-600 dark:text-coral-400 font-extrabold'
                                  : hasHoliday
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              {cell.dayNumber}
                            </span>

                            {dayExceptions.length > 0 && (
                              <span
                                className="h-1.5 w-1.5 rounded-full bg-amber-500"
                                title="Has schedule override"
                              />
                            )}
                          </div>

                          {/* Dots / Indicators */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {dayEvents.slice(0, 3).map((e) => {
                              const meta = EVENT_TYPE_METADATA[e.event_type] || EVENT_TYPE_METADATA.other;
                              return (
                                <span
                                  key={e.id}
                                  className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`}
                                  title={e.title}
                                />
                              );
                            })}
                            {dayEvents.length > 3 && (
                              <span className="text-[9px] font-bold text-slate-400">+{dayEvents.length - 3}</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 1-Column Day Detail Panel */}
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 capitalize">
                          {selectedDayOfWeek}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          {selectedDate}
                        </h3>
                      </div>

                      <div>
                        {isSelectedDateHoliday ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold">
                            <CalendarX className="h-3 w-3" />
                            Holiday
                          </span>
                        ) : isSelectedDateTeachingDay ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold">
                            <CalendarCheck className="h-3 w-3" />
                            Teaching Day
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium">
                            Non-Teaching
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Events on this date */}
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                          Academic Events ({eventsForSelectedDate.length})
                        </h4>
                        <button
                          onClick={() => {
                            setEditingEvent(null);
                            setEvDate(selectedDate);
                            handleEventTypeChange('holiday');
                            setEvTitle('');
                            setEvDesc('');
                            setShowAddEventModal(true);
                          }}
                          className="text-xs font-semibold text-coral-600 hover:text-coral-700 inline-flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add</span>
                        </button>
                      </div>

                      {eventsForSelectedDate.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">
                          No institutional events registered for this date.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {eventsForSelectedDate.map((ev) => {
                            const meta = EVENT_TYPE_METADATA[ev.event_type] || EVENT_TYPE_METADATA.other;
                            return (
                              <div
                                key={ev.id}
                                className={`p-3 rounded-xl border flex items-start justify-between gap-2 ${meta.badgeBg}`}
                              >
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs font-bold ${meta.badgeText}`}>
                                      {ev.title}
                                    </span>
                                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/70 dark:bg-black/30 font-semibold">
                                      {meta.label}
                                    </span>
                                  </div>
                                  {ev.description && (
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                      {ev.description}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => openEditEventModal(ev)}
                                    className="p-1 rounded text-slate-500 hover:text-slate-700"
                                    title="Edit event"
                                  >
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteEvent(ev.id, ev.title)}
                                    className="p-1 rounded text-red-500 hover:text-red-700"
                                    title="Delete event"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Schedule Exceptions on this date */}
                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Date Overrides ({exceptionsForSelectedDate.length})
                        </h4>
                        <button
                          onClick={() => {
                            setExType('cancelled');
                            setExSubject('');
                            setExReason('');
                            setExRoom('');
                            setShowAddExceptionModal(true);
                          }}
                          className="text-xs font-semibold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add Override</span>
                        </button>
                      </div>

                      {exceptionsForSelectedDate.length === 0 ? (
                        <p className="text-xs text-slate-400 py-1">
                          No single-day class overrides applied for this date.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {exceptionsForSelectedDate.map((ex) => {
                            const meta = EXCEPTION_TYPE_METADATA[ex.exception_type];
                            return (
                              <div
                                key={ex.id}
                                className="p-2.5 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/30 flex items-start justify-between gap-2"
                              >
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                                      {meta?.label || ex.exception_type}
                                    </span>
                                    {ex.subject_name && (
                                      <span className="text-xs text-slate-700 dark:text-slate-300">
                                        • {ex.subject_name}
                                      </span>
                                    )}
                                  </div>
                                  {ex.reason && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{ex.reason}</p>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleDeleteException(ex.id)}
                                  className="p-1 rounded text-red-500 hover:text-red-700 shrink-0"
                                  title="Remove override"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Effective Classes Scheduled on this date */}
                    <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        Scheduled Classes ({isSelectedDateHoliday ? 0 : recurringClassesForSelectedDate.length})
                      </h4>

                      {isSelectedDateHoliday ? (
                        <div className="p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                          Regular timetable suspended due to official holiday.
                        </div>
                      ) : recurringClassesForSelectedDate.length === 0 ? (
                        <p className="text-xs text-slate-400 py-1">
                          No recurring timetable classes on {selectedDayOfWeek}.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {recurringClassesForSelectedDate.map((c) => (
                            <div
                              key={c.id}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center justify-between"
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {c.subject_name}
                              </span>
                              <span className="text-slate-500 text-[11px] font-mono">
                                {c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* View Mode: Event List View */
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Chronological Academic Events ({activeCalendar.events.length})
                  </h3>
                  <button
                    onClick={() => {
                      setEditingEvent(null);
                      setEvDate(selectedDate);
                      handleEventTypeChange('holiday');
                      setEvTitle('');
                      setEvDesc('');
                      setShowAddEventModal(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-coral-600 hover:bg-coral-700 text-white text-xs font-semibold shadow-sm transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Event</span>
                  </button>
                </div>

                {activeCalendar.events.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm">
                    No academic events added yet. Add holidays, exams, or working Saturdays.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {activeCalendar.events.map((ev) => {
                      const meta = EVENT_TYPE_METADATA[ev.event_type] || EVENT_TYPE_METADATA.other;
                      return (
                        <div key={ev.id} className="py-3.5 flex items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <span className={`h-2.5 w-2.5 rounded-full mt-1.5 ${meta.dotColor}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-slate-900 dark:text-white">
                                  {ev.title}
                                </span>
                                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                                  {meta.label}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                                Date: {ev.event_date}
                                {ev.description ? ` • ${ev.description}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditEventModal(ev)}
                              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                              title="Edit event"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteEvent(ev.id, ev.title)}
                              className="p-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                              title="Delete event"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal 1: Create Calendar */}
      {showCreateCalendarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Create Academic Calendar
              </h3>
              <button
                onClick={() => setShowCreateCalendarModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCalendar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Calendar Name *
                </label>
                <input
                  type="text"
                  required
                  value={calName}
                  onChange={(e) => setCalName(e.target.value)}
                  placeholder="e.g. Academic Year 2026-2027 Calendar"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Effective From *
                  </label>
                  <input
                    type="date"
                    required
                    value={calFrom}
                    onChange={(e) => setCalFrom(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Effective To (Optional)
                  </label>
                  <input
                    type="date"
                    value={calTo}
                    onChange={(e) => setCalTo(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateCalendarModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-4 py-2 rounded-xl bg-coral-600 hover:bg-coral-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  {actionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Calendar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add / Edit Event */}
      {showAddEventModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {editingEvent ? 'Edit Academic Event' : 'Add Academic Event'}
              </h3>
              <button
                onClick={() => {
                  setShowAddEventModal(false);
                  setEditingEvent(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEvent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  value={evTitle}
                  onChange={(e) => setEvTitle(e.target.value)}
                  placeholder="e.g. Independence Day, Mid-Term Exam, TechFest"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Event Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={evDate}
                    onChange={(e) => setEvDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Event Type *
                  </label>
                  <select
                    value={evType}
                    onChange={(e) => handleEventTypeChange(e.target.value as EventType)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm capitalize"
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EVENT_TYPE_METADATA[t].label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Description / Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={evDesc}
                  onChange={(e) => setEvDesc(e.target.value)}
                  placeholder="Additional notes, circular number, or timing instructions"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              {/* Status Flags */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evIsHoliday}
                    onChange={(e) => setEvIsHoliday(e.target.checked)}
                    className="rounded text-coral-600"
                  />
                  <span>Official Non-Working Holiday (Suspends regular timetable)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evIsTeachingDay}
                    onChange={(e) => setEvIsTeachingDay(e.target.checked)}
                    className="rounded text-coral-600"
                  />
                  <span>Teaching Day (Conducts lectures or labs)</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={evAffectsSchedule}
                    onChange={(e) => setEvAffectsSchedule(e.target.checked)}
                    className="rounded text-coral-600"
                  />
                  <span>Affects regular timetable schedule</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddEventModal(false);
                    setEditingEvent(null);
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-4 py-2 rounded-xl bg-coral-600 hover:bg-coral-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  {actionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingEvent ? 'Update Event' : 'Save Event'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Add Schedule Exception */}
      {showAddExceptionModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Date Override for {selectedDate}
              </h3>
              <button
                onClick={() => setShowAddExceptionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveException} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Override Action *
                </label>
                <select
                  value={exType}
                  onChange={(e) => setExType(e.target.value as ExceptionType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm capitalize"
                >
                  {EXCEPTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {EXCEPTION_TYPE_METADATA[t].label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  {EXCEPTION_TYPE_METADATA[exType]?.description}
                </p>
              </div>

              {(exType === 'cancelled' || exType === 'rescheduled' || exType === 'extra_class' || exType === 'substitute') && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Subject Name {exType === 'extra_class' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="text"
                    required={exType === 'extra_class'}
                    value={exSubject}
                    onChange={(e) => setExSubject(e.target.value)}
                    placeholder="e.g. Operating Systems"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              )}

              {(exType === 'extra_class' || exType === 'rescheduled') && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      Start Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={exStart}
                      onChange={(e) => setExStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                      End Time *
                    </label>
                    <input
                      type="time"
                      required
                      value={exEnd}
                      onChange={(e) => setExEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                    />
                  </div>
                </div>
              )}

              {(exType === 'room_change' || exType === 'extra_class') && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                    Room / Laboratory
                  </label>
                  <input
                    type="text"
                    value={exRoom}
                    onChange={(e) => setExRoom(e.target.value)}
                    placeholder="e.g. Auditorium B, Lab 3"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 mb-1">
                  Reason / Notes
                </label>
                <input
                  type="text"
                  value={exReason}
                  onChange={(e) => setExReason(e.target.value)}
                  placeholder="e.g. Faculty on leave, Makeup lecture for missed session"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddExceptionModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPending}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5"
                >
                  {actionPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Apply Override</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
