import { AuthService } from '@/server/services/auth.service';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { SchedulingService } from '@/server/services/scheduling.service';
import Link from 'next/link';
import {
  Clock,
  Calendar,
  CalendarCheck,
  CalendarX,
  Radio,
  ArrowRight,
  Plus,
  CalendarDays,
  Download,
} from 'lucide-react';

export default async function DashboardPage() {
  const { user, supabase } = await AuthService.requireUser();

  const profilesRepo = new ProfilesRepository(supabase);

  // Fetch real database records and execute deterministic schedule engine
  const [profile, todaySchedule] = await Promise.all([
    profilesRepo.getProfile(user.id),
    SchedulingService.getTodaySchedule(supabase, user.id),
  ]);

  const studentName = profile?.name || user.user_metadata?.name || 'Student';
  const timezone = profile?.timezone || 'Asia/Kolkata';

  return (
    <div className="flex flex-col">
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12">
        {/* Welcome & Status Banner */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-slate-100">
              Hello, {studentName}
            </h2>
            <div className="flex flex-wrap items-center gap-3 mt-2 text-slate-600 dark:text-slate-300 text-sm">
              <span>
                Today is <strong className="text-slate-950 dark:text-slate-100 font-semibold">{todaySchedule.dayOfWeek}</strong>, {todaySchedule.dateString}
              </span>
              <span className="text-slate-400">•</span>
              <span>{timezone}</span>
              
              {todaySchedule.isHoliday ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-coral-50 border border-coral-200 text-coral-700 text-xs font-semibold">
                  <CalendarX className="h-3.5 w-3.5" />
                  <span>{todaySchedule.holidayTitle || 'Holiday'}</span>
                </span>
              ) : todaySchedule.isTeachingDay ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-slate-200/50 border border-slate-400/30 text-slate-700 dark:text-slate-300 text-xs font-semibold">
                  <CalendarCheck className="h-3.5 w-3.5" />
                  <span>Teaching Day</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-slate-400/30 text-slate-600 text-xs font-medium">
                  <span>Non-Instructional Day</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/api/schedule/export"
              download="classflow-schedule.ics"
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-slate-400/40 hover:bg-slate-200/50 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
              title="Download RFC 5545 iCalendar (.ics)"
            >
              <Download className="h-4 w-4" />
              <span>Export .ICS</span>
            </a>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-2 px-4 py-2 rounded border border-slate-400/40 hover:bg-slate-200/50 text-slate-700 dark:text-slate-300 text-sm font-medium transition-colors"
            >
              <CalendarDays className="h-4 w-4" />
              <span>Academic Calendar</span>
            </Link>
            <Link
              href="/documents"
              className="inline-flex items-center gap-2 px-4 py-2 rounded bg-coral-400 hover:bg-coral-500 text-white text-sm font-medium shadow-sm transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>Make Schedule</span>
            </Link>
          </div>
        </div>

        {/* Holiday Banner if today is an official holiday */}
        {todaySchedule.isHoliday && (
          <div className="mb-8 p-6 rounded-lg bg-coral-50 border border-coral-200 flex items-start gap-4 shadow-sm">
            <div className="p-3 rounded bg-coral-100 text-coral-600">
              <CalendarX className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-coral-900 mb-1">
                {todaySchedule.holidayTitle || 'Holiday'}
              </h3>
              <p className="text-sm text-coral-700">
                {todaySchedule.scheduleNote || 'Regular recurring timetable classes are suspended for today.'}
              </p>
            </div>
          </div>
        )}

        {/* Focus Cards: Current & Next */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Card 1: Current Class */}
          <div className="p-6 rounded-xl border border-slate-400/30 bg-slate-200 shadow-md relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold tracking-widest text-slate-600 uppercase">
                Current Class
              </span>
              {todaySchedule.currentClass ? (
                <span className="inline-flex items-center gap-1.5 text-coral-500 text-sm font-bold">
                  <Radio className="h-4 w-4 animate-pulse" />
                  In Session
                </span>
              ) : (
                <span className="text-xs text-coral-500 font-medium">Off Session</span>
              )}
            </div>

            {todaySchedule.currentClass ? (
              <div>
                <h3 className="text-2xl font-bold text-slate-950 tracking-tight mb-2">
                  {todaySchedule.currentClass.subject_name}
                </h3>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1.5 text-coral-600">
                    <Clock className="h-4 w-4" />
                    {todaySchedule.currentClass.start_time.slice(0, 5)} - {todaySchedule.currentClass.end_time.slice(0, 5)}
                  </span>
                  {todaySchedule.currentClass.room && (
                    <span className="text-slate-800">Room: {todaySchedule.currentClass.room}</span>
                  )}
                  {todaySchedule.currentClass.faculty_name && (
                    <span>Prof: {todaySchedule.currentClass.faculty_name}</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">
                  {todaySchedule.isHoliday
                    ? 'No classes scheduled during holiday.'
                    : 'No class currently in session.'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Enjoy your break or review upcoming lecture material.
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Next Class */}
          <div className="p-6 rounded-xl border border-slate-400/20 bg-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between min-h-[160px]">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold tracking-widest text-slate-500 uppercase">
                Next Up
              </span>
              {todaySchedule.nextClass && (
                <span className="text-xs font-semibold text-coral-500">
                  {todaySchedule.nextClass.isToday ? 'Later Today' : `Next ${todaySchedule.nextClass.targetDay}`}
                </span>
              )}
            </div>

            {todaySchedule.nextClass ? (
              <div>
                <h3 className="text-2xl font-bold text-slate-950 tracking-tight mb-2">
                  {todaySchedule.nextClass.subject_name}
                </h3>
                <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-sm font-medium text-slate-600">
                  <span className="inline-flex items-center gap-1.5 text-slate-800">
                    <Clock className="h-4 w-4" />
                    {todaySchedule.nextClass.start_time.slice(0, 5)} - {todaySchedule.nextClass.end_time.slice(0, 5)}
                  </span>
                  {todaySchedule.nextClass.room && (
                    <span>Room: {todaySchedule.nextClass.room}</span>
                  )}
                  {todaySchedule.nextClass.faculty_name && (
                    <span>Prof: {todaySchedule.nextClass.faculty_name}</span>
                  )}
                  {todaySchedule.nextClass.targetDate && !todaySchedule.nextClass.isToday && (
                    <span className="text-slate-400">({todaySchedule.nextClass.targetDate})</span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <p className="text-lg font-semibold text-slate-600">
                  No further classes scheduled.
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  All weekly classes complete or no timetable entries configured.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Schedule List */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6 border-b border-slate-400/20 pb-4">
            <h3 className="text-xl font-bold text-slate-950 dark:text-slate-100 tracking-tight">
              Today&apos;s Schedule
            </h3>
            <Link
              href="/schedule"
              className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-slate-100 inline-flex items-center gap-1.5 transition-colors"
            >
              <span>Full Schedule</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {!todaySchedule.hasTimetable ? (
            <div className="py-12 text-center">
              <Calendar className="h-10 w-10 text-slate-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-200 mb-2">
                No Active Schedule Configured
              </h4>
              <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-6">
                You haven&apos;t created or activated a schedule yet. Generate your schedule to calculate daily classes.
              </p>
              <Link
                href="/documents"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-coral-400 hover:bg-coral-500 text-white text-sm font-medium transition-colors shadow-sm"
              >
                <Plus className="h-4 w-4" />
                <span>Make Schedule</span>
              </Link>
            </div>
          ) : todaySchedule.todayClasses.length === 0 ? (
            <div className="py-12 text-center text-slate-500">
              <p className="text-lg font-medium">No classes scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {todaySchedule.todayClasses.map((item) => {
                const isCurrent = item.status === 'current';
                const isCompleted = item.status === 'completed';

                return (
                  <div
                    key={item.id}
                    className={`py-4 px-2 border-b border-slate-400/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                      isCurrent ? 'bg-slate-200/50 rounded-lg border-transparent px-4 -mx-2' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 min-w-0">
                      <div className={`text-sm font-semibold tabular-nums ${isCompleted ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                      </div>
                      <div className="min-w-0">
                        <div className={`text-base font-bold truncate ${isCompleted ? 'text-slate-500' : 'text-slate-950 dark:text-slate-100'} ${isCurrent ? 'text-coral-500' : ''}`}>
                          {item.subject_name}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.room && <span>Room {item.room}</span>}
                          {item.faculty_name && <span>{item.faculty_name}</span>}
                          {item.class_type && <span className="uppercase tracking-wider">{item.class_type}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center">
                      {isCompleted ? (
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Done</span>
                      ) : isCurrent ? (
                        <span className="text-xs font-bold text-coral-500 uppercase tracking-widest">Now</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Academic Calendar Events */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-bold text-coral-500 mb-4 tracking-tight uppercase">Upcoming Holidays</h4>
            {todaySchedule.upcomingHolidays.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No upcoming holidays.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {todaySchedule.upcomingHolidays.map(h => (
                  <li key={h.id} className="flex justify-between items-center border-b border-coral-200/50 dark:border-coral-900/50 pb-2 last:border-0 last:pb-0">
                    <span className="font-semibold text-coral-900 dark:text-coral-100">{h.title}</span>
                    <span className="text-coral-700 dark:text-coral-300 text-xs font-medium">{h.event_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="p-6 rounded-lg border border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
            <h4 className="text-sm font-bold text-coral-400 mb-4 tracking-tight uppercase">Academic Events</h4>
            {todaySchedule.upcomingEvents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No academic events registered.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {todaySchedule.upcomingEvents.map(ev => (
                  <li key={ev.id} className="flex justify-between items-center border-b border-slate-400/20 pb-2 last:border-0 last:pb-0">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{ev.title}</span>
                    <span className="text-slate-600 dark:text-slate-400 text-xs font-medium">{ev.event_date}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
