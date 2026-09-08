/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Loader2,
  FileText,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';
import type { DocumentWithJob } from '@/server/repositories/documents.repository';
import type { DayOfWeek, ClassType, EventType } from '@/types/database';
import { EVENT_TYPES, EVENT_TYPE_METADATA } from '@/lib/constants/calendar';

interface EditableTimetableSlot {
  id: string;
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  subject_name: string;
  subject_code: string;
  faculty_name: string;
  room: string;
  class_type: ClassType;
  section: string;
  notes: string;
  confidence: number;
  warnings: string[];
}

interface EditableCalendarEvent {
  id: string;
  event_date: string;
  event_type: EventType;
  title: string;
  description: string;
  is_teaching_day: boolean;
  is_holiday: boolean;
  affects_regular_schedule: boolean;
  metadata: Record<string, unknown>;
  confidence: number;
  warnings: string[];
}

export default function DocumentReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { id } = use(params);

  const [document, setDocument] = useState<DocumentWithJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Review state for Timetable
  const [timetableName, setTimetableName] = useState('Extracted Timetable');
  const [timetableEffectiveFrom, setTimetableEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [timetableTimezone, setTimetableTimezone] = useState('Asia/Kolkata');
  const [timetableSlots, setTimetableSlots] = useState<EditableTimetableSlot[]>([]);

  // Review state for Calendar
  const [calendarName, setCalendarName] = useState('Extracted Academic Calendar');
  const [calendarEffectiveFrom, setCalendarEffectiveFrom] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [calendarEffectiveTo, setCalendarEffectiveTo] = useState('');
  const [calendarEvents, setCalendarEvents] = useState<EditableCalendarEvent[]>([]);

  // Detected type
  const [resolvedType, setResolvedType] = useState<'timetable' | 'calendar'>('timetable');

  const fetchDocumentDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/documents/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load document details');
      }
      const data = await res.json();
      const doc: DocumentWithJob = data.data.document;
      setDocument(doc);

      const extraction = (doc.latest_job?.extraction_result as Record<string, unknown>) || {};
      const docType = doc.document_type === 'calendar' ? 'calendar' : 'timetable';
      setResolvedType(docType);

      if (docType === 'timetable') {
        setTimetableName((extraction.timetable_title as string) || `Timetable - ${doc.file_name.replace(/\.[^/.]+$/, '')}`);
        setTimetableTimezone((extraction.timezone as string) || 'Asia/Kolkata');

        const rawEntries = (extraction.entries as Array<Record<string, unknown>>) || [];
        const slots: EditableTimetableSlot[] = rawEntries.map((e, idx) => ({
          id: `slot-${idx + 1}`,
          day_of_week: (e.day_of_week as DayOfWeek) || 'monday',
          start_time: (e.start_time as string) || '09:00',
          end_time: (e.end_time as string) || '10:00',
          subject_name: (e.subject_name as string) || 'Untitled Subject',
          subject_code: (e.subject_code as string) || '',
          faculty_name: (e.faculty_name as string) || '',
          room: (e.room as string) || '',
          class_type: (e.class_type as ClassType) || 'lecture',
          section: (e.section as string) || '',
          notes: (e.notes as string) || '',
          confidence: typeof e.confidence === 'number' ? e.confidence : 0.9,
          warnings: (e.warnings as string[]) || [],
        }));
        setTimetableSlots(slots);
      } else {
        setCalendarName((extraction.calendar_title as string) || `Calendar - ${doc.file_name.replace(/\.[^/.]+$/, '')}`);
        setCalendarEffectiveFrom((extraction.effective_from as string) || new Date().toISOString().slice(0, 10));
        setCalendarEffectiveTo((extraction.effective_to as string) || '');

        const rawEvents = (extraction.events as Array<Record<string, unknown>>) || [];
        const events: EditableCalendarEvent[] = rawEvents.map((ev, idx) => ({
          id: `event-${idx + 1}`,
          event_date: (ev.event_date as string) || new Date().toISOString().slice(0, 10),
          event_type: (ev.event_type as EventType) || 'holiday',
          title: (ev.title as string) || 'Academic Event',
          description: (ev.description as string) || '',
          is_teaching_day: !!ev.is_teaching_day,
          is_holiday: !!ev.is_holiday,
          affects_regular_schedule: ev.affects_regular_schedule !== false,
          metadata: (ev.metadata as Record<string, unknown>) || {},
          confidence: typeof ev.confidence === 'number' ? ev.confidence : 0.9,
          warnings: (ev.warnings as string[]) || [],
        }));
        setCalendarEvents(events);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error fetching document');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDocumentDetails();
  }, [fetchDocumentDetails]);

  // Timetable Handlers
  const handleUpdateSlot = (id: string, field: keyof EditableTimetableSlot, value: unknown) => {
    setTimetableSlots((prev) =>
      prev.map((slot) => (slot.id === id ? { ...slot, [field]: value } : slot))
    );
  };

  const handleAddSlot = () => {
    const newSlot: EditableTimetableSlot = {
      id: `slot-manual-${Date.now()}`,
      day_of_week: 'monday',
      start_time: '09:00',
      end_time: '10:00',
      subject_name: 'New Subject',
      subject_code: '',
      faculty_name: '',
      room: '',
      class_type: 'lecture',
      section: '',
      notes: '',
      confidence: 1.0,
      warnings: [],
    };
    setTimetableSlots((prev) => [...prev, newSlot]);
  };

  const handleDeleteSlot = (id: string) => {
    setTimetableSlots((prev) => prev.filter((s) => s.id !== id));
  };

  // Calendar Handlers
  const handleUpdateEvent = (id: string, field: keyof EditableCalendarEvent, value: unknown) => {
    setCalendarEvents((prev) =>
      prev.map((ev) => (ev.id === id ? { ...ev, [field]: value } : ev))
    );
  };

  const handleAddEvent = () => {
    const newEvent: EditableCalendarEvent = {
      id: `event-manual-${Date.now()}`,
      event_date: new Date().toISOString().slice(0, 10),
      event_type: 'holiday',
      title: 'New Event',
      description: '',
      is_teaching_day: false,
      is_holiday: true,
      affects_regular_schedule: true,
      metadata: {},
      confidence: 1.0,
      warnings: [],
    };
    setCalendarEvents((prev) => [...prev, newEvent]);
  };

  const handleDeleteEvent = (id: string) => {
    setCalendarEvents((prev) => prev.filter((ev) => ev.id !== id));
  };

  // Confirmation & Commit Handlers
  const handleConfirmAndCommit = async () => {
    try {
      setCommitting(true);
      setError(null);
      setSuccess(null);

      let payload: Record<string, unknown> = {};

      if (resolvedType === 'timetable') {
        if (timetableSlots.length === 0) {
          throw new Error('Please add at least one class entry before confirming.');
        }

        // Validate time intervals
        for (const slot of timetableSlots) {
          if (slot.start_time >= slot.end_time) {
            throw new Error(`Invalid slot for "${slot.subject_name}": start time (${slot.start_time}) must be earlier than end time (${slot.end_time}).`);
          }
        }

        payload = {
          document_type: 'timetable',
          data: {
            name: timetableName,
            effective_from: timetableEffectiveFrom,
            timezone: timetableTimezone,
            active: true,
            entries: timetableSlots.map((s) => ({
              day_of_week: s.day_of_week,
              start_time: s.start_time,
              end_time: s.end_time,
              subject_name: s.subject_name,
              subject_code: s.subject_code || null,
              faculty_name: s.faculty_name || null,
              room: s.room || null,
              class_type: s.class_type,
              section: s.section || null,
              notes: s.notes || null,
            })),
          },
        };
      } else {
        if (calendarEvents.length === 0) {
          throw new Error('Please add at least one calendar event before confirming.');
        }

        payload = {
          document_type: 'calendar',
          data: {
            name: calendarName,
            effective_from: calendarEffectiveFrom,
            effective_to: calendarEffectiveTo || null,
            active: true,
            events: calendarEvents.map((ev) => ({
              event_date: ev.event_date,
              event_type: ev.event_type,
              title: ev.title,
              description: ev.description || null,
              is_teaching_day: ev.is_teaching_day,
              is_holiday: ev.is_holiday,
              affects_regular_schedule: ev.affects_regular_schedule,
              metadata: ev.metadata,
            })),
          },
        };
      }

      const res = await fetch(`/api/documents/${id}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error?.message || 'Failed to commit extracted data.');
      }

      setSuccess('Successfully committed verified schedule to database!');
      setTimeout(() => {
        if (resolvedType === 'timetable') {
          router.push('/timetable');
        } else {
          router.push('/calendar');
        }
      }, 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Confirmation failed');
    } finally {
      setCommitting(false);
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.85) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
          <Check className="h-3 w-3" /> Confident ({Math.round(confidence * 100)}%)
        </span>
      );
    }
    if (confidence >= 0.6) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
          <AlertCircle className="h-3 w-3" /> Warning ({Math.round(confidence * 100)}%)
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-300">
        <AlertCircle className="h-3 w-3" /> Needs Review ({Math.round(confidence * 100)}%)
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Loading document preview & extraction...</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Document Not Found</h2>
          <p className="text-sm text-slate-500 mt-1 mb-4">The requested document could not be loaded or you do not have permission.</p>
          <Link href="/documents" className="text-xs font-bold px-4 py-2 rounded-lg bg-indigo-600 text-white">
            Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  const validationResult = (document.latest_job?.validation_result as Record<string, unknown>) || {};
  const validationWarnings = (validationResult.warnings as string[]) || [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white">
                Review & Confirm: {document.file_name}
              </h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                v{document.processing_version}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Inspect and adjust extracted schedule entries before saving to your live calendar
            </p>
          </div>
        </div>

        {/* Action Buttons in Header */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/documents"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Cancel / Reject
          </Link>
          <button
            onClick={handleConfirmAndCommit}
            disabled={committing}
            className="text-xs font-bold px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {committing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            <span>Confirm & Commit to Schedule</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
        {/* Error / Success Notifications */}
        {error && (
          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-sm flex items-start gap-3">
            <AlertCircle className="h-5 w-5 flex-shrink-0 text-rose-600 mt-0.5" />
            <div className="flex-1 font-medium">{error}</div>
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
            <div className="flex-1 font-medium">{success}</div>
          </div>
        )}

        {/* Warnings Banner */}
        {validationWarnings.length > 0 && (
          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs">
            <div className="font-bold flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Extraction Warnings Detected ({validationWarnings.length})</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-800 dark:text-amber-300">
              {validationWarnings.map((w, idx) => (
                <li key={idx}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Two-Column Review Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          {/* Left Column: Document File Preview */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-4 flex flex-col h-[780px]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-indigo-600" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Document Preview
                </h3>
              </div>
              {document.signed_url && (
                <a
                  href={document.signed_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <span>Open Fullscreen</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>

            <div className="flex-1 bg-slate-100 dark:bg-slate-800/60 rounded-xl overflow-hidden flex items-center justify-center p-2 relative">
              {document.signed_url ? (
                document.mime_type === 'application/pdf' ? (
                  <iframe
                    src={`${document.signed_url}#toolbar=0`}
                    className="w-full h-full rounded-lg border-0"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={document.signed_url}
                    alt={document.file_name}
                    className="max-h-full max-w-full object-contain rounded-lg shadow-sm"
                  />
                )
              ) : (
                <div className="text-center text-slate-400 p-6">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-medium">Preview not available directly</p>
                </div>
              )}
            </div>

            <div className="pt-3 text-[11px] text-slate-500 dark:text-slate-400 flex justify-between items-center">
              <span>MIME: {document.mime_type}</span>
              <span>{(document.file_size / 1024).toFixed(0)} KB</span>
            </div>
          </div>

          {/* Right Column: Editable Extraction Data */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm p-5 flex flex-col h-[780px] overflow-hidden">
            {/* Top Config bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Schedule Container Name
                </label>
                <input
                  type="text"
                  value={resolvedType === 'timetable' ? timetableName : calendarName}
                  onChange={(e) =>
                    resolvedType === 'timetable'
                      ? setTimetableName(e.target.value)
                      : setCalendarName(e.target.value)
                  }
                  className="w-full text-sm font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="w-36">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                  Effective From
                </label>
                <input
                  type="date"
                  value={resolvedType === 'timetable' ? timetableEffectiveFrom : calendarEffectiveFrom}
                  onChange={(e) =>
                    resolvedType === 'timetable'
                      ? setTimetableEffectiveFrom(e.target.value)
                      : setCalendarEffectiveFrom(e.target.value)
                  }
                  className="w-full text-xs font-semibold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <div className="text-right">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-1">
                    Document Mode
                  </label>
                  <select
                    value={resolvedType}
                    onChange={(e) => setResolvedType(e.target.value as 'timetable' | 'calendar')}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                  >
                    <option value="timetable">Weekly Timetable</option>
                    <option value="calendar">Academic Calendar</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Editable Content */}
            <div className="flex-1 overflow-y-auto pr-1">
              {resolvedType === 'timetable' ? (
                /* TIMETABLE REVIEW TABLE */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Extracted Class Slots ({timetableSlots.length})
                    </h4>
                    <button
                      onClick={handleAddSlot}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Slot</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {timetableSlots.map((slot) => (
                      <div
                        key={slot.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col gap-2.5 transition-all hover:border-slate-300"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={slot.day_of_week}
                              onChange={(e) => handleUpdateSlot(slot.id, 'day_of_week', e.target.value)}
                              className="text-xs font-bold uppercase px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            >
                              <option value="monday">Monday</option>
                              <option value="tuesday">Tuesday</option>
                              <option value="wednesday">Wednesday</option>
                              <option value="thursday">Thursday</option>
                              <option value="friday">Friday</option>
                              <option value="saturday">Saturday</option>
                              <option value="sunday">Sunday</option>
                            </select>

                            <div className="flex items-center gap-1">
                              <input
                                type="time"
                                value={slot.start_time.slice(0, 5)}
                                onChange={(e) => handleUpdateSlot(slot.id, 'start_time', e.target.value)}
                                className="text-xs font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                              />
                              <span className="text-xs text-slate-400">to</span>
                              <input
                                type="time"
                                value={slot.end_time.slice(0, 5)}
                                onChange={(e) => handleUpdateSlot(slot.id, 'end_time', e.target.value)}
                                className="text-xs font-medium px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(slot.confidence)}
                            <button
                              onClick={() => handleDeleteSlot(slot.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Delete entry"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Subject, Room, Faculty Inputs */}
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                          <div className="sm:col-span-5">
                            <input
                              type="text"
                              value={slot.subject_name}
                              onChange={(e) => handleUpdateSlot(slot.id, 'subject_name', e.target.value)}
                              placeholder="Subject Name"
                              className="w-full text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <input
                              type="text"
                              value={slot.subject_code}
                              onChange={(e) => handleUpdateSlot(slot.id, 'subject_code', e.target.value)}
                              placeholder="Code"
                              className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <input
                              type="text"
                              value={slot.room}
                              onChange={(e) => handleUpdateSlot(slot.id, 'room', e.target.value)}
                              placeholder="Room / Lab"
                              className="w-full text-xs px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <select
                              value={slot.class_type}
                              onChange={(e) => handleUpdateSlot(slot.id, 'class_type', e.target.value as ClassType)}
                              className="w-full text-xs px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            >
                              <option value="lecture">Lecture</option>
                              <option value="lab">Lab</option>
                              <option value="tutorial">Tutorial</option>
                              <option value="seminar">Seminar</option>
                              <option value="other">Other</option>
                            </select>
                          </div>
                        </div>

                        {/* Warnings if any */}
                        {slot.warnings.length > 0 && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                            ⚠️ {slot.warnings.join(' • ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* CALENDAR REVIEW LIST */
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                      Extracted Calendar Events ({calendarEvents.length})
                    </h4>
                    <button
                      onClick={handleAddEvent}
                      className="text-xs font-bold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Event</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {calendarEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 flex flex-col gap-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={ev.event_date}
                              onChange={(e) => handleUpdateEvent(ev.id, 'event_date', e.target.value)}
                              className="text-xs font-bold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            />

                            <select
                              value={ev.event_type}
                              onChange={(e) => handleUpdateEvent(ev.id, 'event_type', e.target.value as EventType)}
                              className="text-xs font-semibold px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                            >
                              {EVENT_TYPES.map((type) => (
                                <option key={type} value={type}>
                                  {EVENT_TYPE_METADATA[type].label}
                                </option>
                              ))}
                            </select>

                            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={ev.is_holiday}
                                onChange={(e) => handleUpdateEvent(ev.id, 'is_holiday', e.target.checked)}
                                className="rounded text-indigo-600"
                              />
                              <span>Holiday</span>
                            </label>

                            <label className="flex items-center gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                              <input
                                type="checkbox"
                                checked={ev.is_teaching_day}
                                onChange={(e) => handleUpdateEvent(ev.id, 'is_teaching_day', e.target.checked)}
                                className="rounded text-indigo-600"
                              />
                              <span>Teaching Day</span>
                            </label>
                          </div>

                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(ev.confidence)}
                            <button
                              onClick={() => handleDeleteEvent(ev.id)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Delete event"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <input
                          type="text"
                          value={ev.title}
                          onChange={(e) => handleUpdateEvent(ev.id, 'title', e.target.value)}
                          placeholder="Event Title"
                          className="w-full text-xs font-bold px-2.5 py-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Commit Bar */}
            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Zero AI auto-commit. All edits are saved directly to PostgreSQL.</span>
              </div>

              <button
                onClick={handleConfirmAndCommit}
                disabled={committing}
                className="text-xs font-bold px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
              >
                {committing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>Confirm & Commit Schedule</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
