'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Calendar, BookOpen, AlertTriangle, Clock, MapPin, User, Loader2 } from 'lucide-react';
import type { TimetableEntry, CalendarEvent, ScheduleException } from '@/types/database';
import type { ApiResponse } from '@/types/api';

interface SearchResultData {
  classes: TimetableEntry[];
  events: (CalendarEvent & { calendarName: string })[];
  exceptions: ScheduleException[];
  query: string;
}

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResultData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults(null);
    }
  }, [isOpen]);

  const searchSchedule = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    try {
      setLoading(true);
      const res = await fetch(`/api/schedule/search?q=${encodeURIComponent(q)}`);
      const json: ApiResponse<SearchResultData> = await res.json();
      if (res.ok && json.success) {
        setResults(json.data);
      }
    } catch {
      // Ignore network errors on search
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      if (query.trim()) {
        searchSchedule(query);
      } else {
        setResults(null);
      }
    }, 250);

    return () => clearTimeout(handler);
  }, [query, searchSchedule]);

  if (!isOpen) return null;

  const totalResults =
    (results?.classes.length || 0) + (results?.events.length || 0) + (results?.exceptions.length || 0);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center p-4 pt-16 sm:pt-24 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Input Bar */}
        <div className="p-4 border-b border-neutral-800 flex items-center gap-3 bg-neutral-950/60">
          <Search className="w-5 h-5 text-neutral-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search classes, rooms, faculty, exams, holidays..."
            className="flex-1 bg-transparent text-sm text-neutral-100 placeholder-neutral-500 focus:outline-none"
          />
          {loading && <Loader2 className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />}
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults(null);
              }}
              className="text-neutral-500 hover:text-neutral-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs text-neutral-400 hover:text-neutral-200 px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700"
          >
            Esc
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-4 space-y-4 flex-1">
          {!query && (
            <div className="text-center py-10 text-neutral-500 text-xs space-y-1">
              <p>Type to search across your academic schedule.</p>
              <p className="text-[11px] text-neutral-600">e.g. &ldquo;DBMS&rdquo;, &ldquo;Room 302&rdquo;, &ldquo;Prof. Sharma&rdquo;, &ldquo;Holiday&rdquo;</p>
            </div>
          )}

          {query && !loading && totalResults === 0 && (
            <div className="text-center py-10 text-neutral-500 text-xs">
              No matching classes, events, or exceptions found for &ldquo;{query}&rdquo;.
            </div>
          )}

          {/* Classes matches */}
          {results && results.classes.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                <span>Timetable Classes ({results.classes.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-neutral-100 flex items-center gap-2">
                        <span>{cls.subject_name}</span>
                        {cls.subject_code && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 font-mono">
                            {cls.subject_code}
                          </span>
                        )}
                        <span className="capitalize text-[10px] px-1.5 py-0.2 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {cls.class_type}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-neutral-400 text-[11px] mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          <span className="capitalize">{cls.day_of_week}</span> {cls.start_time.slice(0, 5)} - {cls.end_time.slice(0, 5)}
                        </span>
                        {cls.room && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-neutral-500" />
                            <span>{cls.room}</span>
                          </span>
                        )}
                        {cls.faculty_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 text-neutral-500" />
                            <span>{cls.faculty_name}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Calendar Events matches */}
          {results && results.events.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Calendar Events & Holidays ({results.events.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.events.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-neutral-100 flex items-center gap-2">
                        <span>{ev.title}</span>
                        <span className="capitalize text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                          {ev.event_type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-neutral-400 text-[11px] mt-0.5">
                        <span>{ev.event_date}</span>
                        {ev.description && <span className="text-neutral-500"> • {ev.description}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Schedule Exceptions matches */}
          {results && results.exceptions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Schedule Exceptions ({results.exceptions.length})</span>
              </div>
              <div className="space-y-1.5">
                {results.exceptions.map((ex) => (
                  <div
                    key={ex.id}
                    className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800/80 text-xs"
                  >
                    <div className="font-semibold text-neutral-100 flex items-center gap-2">
                      <span className="capitalize">{ex.exception_type.replace('_', ' ')}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">{ex.date}</span>
                    </div>
                    {ex.reason && <div className="text-neutral-400 text-[11px] mt-0.5">{ex.reason}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
