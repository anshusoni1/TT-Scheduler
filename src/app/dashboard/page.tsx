import { AuthService } from '@/server/services/auth.service';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { SchedulingService } from '@/server/services/scheduling.service';
import { signOutAction } from '@/app/auth/actions';
import Link from 'next/link';
import {
  Clock,
  BookOpen,
  Calendar,
  LogOut,
  CalendarCheck,
  CalendarX,
  Radio,
  ArrowRight,
  Plus,
  CalendarDays,
  FileText,
  Download,
  BarChart3,
  CheckCircle2,
} from 'lucide-react';
import { DashboardNavActions } from '@/components/DashboardNavActions';

export default async function DashboardPage() {
  const { user, supabase } = await AuthService.requireUser();

  const profilesRepo = new ProfilesRepository(supabase);

  // Fetch real database records and execute deterministic schedule engine
  const [profile, todaySchedule, attendance] = await Promise.all([
    profilesRepo.getProfile(user.id),
    SchedulingService.getTodaySchedule(supabase, user.id),
    SchedulingService.calculateAttendanceAnalytics(supabase, user.id, 75).catch(() => null),
  ]);

  const studentName = profile?.name || user.user_metadata?.name || 'Student';
  const college = profile?.college || null;
  const timezone = profile?.timezone || 'Asia/Kolkata';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-sm">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              ClassFlow
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Deterministic Academic Schedule Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/documents"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600" />
            <span>AI Documents</span>
          </Link>

          <Link
            href="/calendar"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5 text-purple-600" />
            <span>Calendar</span>
          </Link>

          <Link
            href="/schedule"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5 text-emerald-600" />
            <span>Weekly Schedule</span>
          </Link>

          <Link
            href="/attendance"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5 text-amber-600" />
            <span>Attendance</span>
          </Link>

          <Link
            href="/timetable"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5 text-indigo-600" />
            <span>Timetable Slots</span>
          </Link>

          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{studentName}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {college ? college : timezone}
            </div>
          </div>

          <DashboardNavActions />

          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Welcome & Timezone Status Banner */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Hello, {studentName}
            </h2>
            <div className="flex flex-wrap items-center gap-2.5 mt-1.5">
              <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">
                Today is <strong className="text-slate-800 dark:text-slate-200">{todaySchedule.dayOfWeek}</strong>, {todaySchedule.dateString} • {timezone}
              </span>
              
              {todaySchedule.isHoliday ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-xs font-bold border border-rose-200 dark:border-rose-900">
                  <CalendarX className="h-3 w-3" />
                  <span>{todaySchedule.holidayTitle || 'Holiday'}</span>
                </span>
              ) : todaySchedule.isTeachingDay ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold border border-emerald-200 dark:border-emerald-900">
                  <CalendarCheck className="h-3 w-3" />
                  <span>Teaching Day</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
                  <span>Non-Instructional Day</span>
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/api/schedule/export"
              download="classflow-schedule.ics"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs transition-colors"
              title="Download RFC 5545 iCalendar (.ics) for Google/Apple/Outlook Calendar"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .ICS</span>
            </a>
            <Link
              href="/calendar"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold shadow-xs transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Academic Calendar</span>
            </Link>
            <Link
              href="/timetable"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Manage Timetable</span>
            </Link>
          </div>
        </div>

        {/* Holiday Banner if today is an official holiday */}
        {todaySchedule.isHoliday && (
          <div className="mb-6 p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-900/60 text-rose-600 dark:text-rose-300">
                <CalendarX className="h-6 w-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-200/60 dark:bg-rose-900/80 text-rose-800 dark:text-rose-200 text-[10px] font-bold uppercase tracking-wider mb-1">
                  Official Academic Holiday
                </div>
                <h3 className="text-lg font-bold text-rose-900 dark:text-rose-100">
                  {todaySchedule.holidayTitle || 'Holiday'}
                </h3>
                <p className="text-xs text-rose-700 dark:text-rose-300 mt-1">
                  {todaySchedule.scheduleNote || 'Regular recurring timetable classes are suspended for today.'}
                </p>
              </div>
            </div>
            <Link
              href="/calendar"
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors shrink-0"
            >
              View Calendar
            </Link>
          </div>
        )}

        {/* Real Schedule Status Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Card 1: Current Class */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Class
              </span>
              {todaySchedule.currentClass ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                  <Radio className="h-3 w-3 animate-pulse text-emerald-500" />
                  In Session
                </span>
              ) : (
                <span className="text-xs text-slate-400 font-medium">Off Session</span>
              )}
            </div>

            {todaySchedule.currentClass ? (
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {todaySchedule.currentClass.subject_name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <Clock className="h-3.5 w-3.5" />
                    {todaySchedule.currentClass.start_time.slice(0, 5)} - {todaySchedule.currentClass.end_time.slice(0, 5)}
                  </span>
                  {todaySchedule.currentClass.room && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      Room: {todaySchedule.currentClass.room}
                    </span>
                  )}
                  {todaySchedule.currentClass.faculty_name && (
                    <span>Prof: {todaySchedule.currentClass.faculty_name}</span>
                  )}
                  {todaySchedule.currentClass.isOverride && (
                    <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-semibold text-[10px]">
                      Override
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  {todaySchedule.isHoliday
                    ? 'No classes scheduled during holiday.'
                    : 'No class currently in session.'}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {todaySchedule.isHoliday
                    ? 'Enjoy your academic holiday or review course material.'
                    : 'Enjoy your break or review upcoming lecture material.'}
                </p>
              </div>
            )}
          </div>

          {/* Card 2: Next Class */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Next Upcoming Class
              </span>
              {todaySchedule.nextClass && (
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 text-xs font-semibold capitalize">
                  {todaySchedule.nextClass.isToday ? 'Later Today' : `Next ${todaySchedule.nextClass.targetDay}`}
                </span>
              )}
            </div>

            {todaySchedule.nextClass ? (
              <div className="space-y-2">
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  {todaySchedule.nextClass.subject_name}
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-400">
                    <Clock className="h-3.5 w-3.5" />
                    {todaySchedule.nextClass.start_time.slice(0, 5)} - {todaySchedule.nextClass.end_time.slice(0, 5)}
                  </span>
                  {todaySchedule.nextClass.room && (
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                      Room: {todaySchedule.nextClass.room}
                    </span>
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
              <div className="py-3">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  No further classes scheduled.
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  All weekly classes complete or no timetable entries configured.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Today's Chronological Schedule Timeline */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white capitalize">
              Today&apos;s Class Timeline ({todaySchedule.todayClasses.length} {todaySchedule.todayClasses.length === 1 ? 'class' : 'classes'})
            </h3>
            <Link
              href="/timetable"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 inline-flex items-center gap-1"
            >
              <span>View full week</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {!todaySchedule.hasTimetable ? (
            /* Calendar-only or new user: No timetable configured */
            <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 text-center">
              <Calendar className="h-8 w-8 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                No Active Timetable Configured
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-4">
                You haven&apos;t created or activated a timetable yet. Create your schedule to calculate daily classes alongside your academic calendar.
              </p>
              <Link
                href="/timetable"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Timetable</span>
              </Link>
            </div>
          ) : todaySchedule.isHoliday && todaySchedule.todayClasses.length === 0 ? (
            /* Holiday empty state */
            <div className="p-8 rounded-2xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/20 text-center shadow-xs">
              <CalendarX className="h-8 w-8 text-rose-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                Classes Suspended: {todaySchedule.holidayTitle || 'Holiday'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                No classes take place on this official institutional holiday.
                {todaySchedule.nextClass && (
                  <span className="block mt-2 font-medium text-slate-700 dark:text-slate-300 capitalize">
                    Your next class is {todaySchedule.nextClass.subject_name} on {todaySchedule.nextClass.targetDay} at {todaySchedule.nextClass.start_time.slice(0, 5)}.
                  </span>
                )}
              </p>
            </div>
          ) : todaySchedule.todayClasses.length === 0 ? (
            /* Active timetable exists, but zero classes on this specific weekday */
            <div className="p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-center shadow-sm">
              <CalendarCheck className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
                No Classes Scheduled for Today
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Your timetable &ldquo;{todaySchedule.timetableName}&rdquo; has no lectures or labs on {todaySchedule.dayOfWeek}.
                {todaySchedule.nextClass && (
                  <span className="block mt-2 font-medium text-slate-700 dark:text-slate-300 capitalize">
                    Your next class is {todaySchedule.nextClass.subject_name} on {todaySchedule.nextClass.targetDay} at {todaySchedule.nextClass.start_time.slice(0, 5)}.
                  </span>
                )}
              </p>
            </div>
          ) : (
            /* Chronological Class Slots */
            <div className="space-y-3">
              {todaySchedule.todayClasses.map((item) => {
                const isCurrent = item.status === 'current';
                const isCompleted = item.status === 'completed';

                return (
                  <div
                    key={item.id}
                    className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isCurrent
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 shadow-sm'
                        : isCompleted
                        ? 'border-slate-200 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-900/40 opacity-75'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm'
                    }`}
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-2.5 rounded-lg shrink-0 ${
                          isCurrent
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                            : isCompleted
                            ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                        }`}
                      >
                        <Clock className="h-5 w-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-bold text-sm ${
                              isCompleted
                                ? 'text-slate-500 dark:text-slate-400 line-through'
                                : 'text-slate-900 dark:text-white'
                            }`}
                          >
                            {item.subject_name}
                          </span>
                          {item.subject_code && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              {item.subject_code}
                            </span>
                          )}
                          {item.isOverride && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
                              Override
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {item.start_time.slice(0, 5)} - {item.end_time.slice(0, 5)}
                          </span>
                          {item.room && <span>Room: {item.room}</span>}
                          {item.faculty_name && <span>• {item.faculty_name}</span>}
                          {item.notes && <span className="italic text-slate-400">({item.notes})</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {item.class_type}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-500 text-white animate-pulse">
                          Active
                        </span>
                      )}
                      {isCompleted && (
                        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          Done
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Upcoming Holidays & Events Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {/* Upcoming Holidays */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Upcoming Holidays
              </h4>
              <Link href="/calendar" className="text-xs font-semibold text-purple-600 hover:text-purple-700">
                All events
              </Link>
            </div>
            {todaySchedule.upcomingHolidays.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No upcoming holidays registered in calendar.</p>
            ) : (
              <div className="space-y-2">
                {todaySchedule.upcomingHolidays.map((h) => (
                  <div
                    key={h.id}
                    className="p-2.5 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-rose-800 dark:text-rose-200">{h.title}</span>
                    <span className="font-mono text-[11px] text-rose-600 dark:text-rose-400">{h.event_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Academic Events */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Upcoming Academic Events
              </h4>
              <Link href="/calendar" className="text-xs font-semibold text-purple-600 hover:text-purple-700">
                Calendar
              </Link>
            </div>
            {todaySchedule.upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-400 py-2">No academic events registered.</p>
            ) : (
              <div className="space-y-2">
                {todaySchedule.upcomingEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900/60 flex items-center justify-between text-xs"
                  >
                    <span className="font-semibold text-purple-800 dark:text-purple-200">{ev.title}</span>
                    <span className="font-mono text-[11px] text-purple-600 dark:text-purple-400">{ev.event_date}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Semester Attendance Analytics & Safe Cuts Widget */}
        <div className="mt-8 p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Semester Attendance & Safe Cuts Margin
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Target threshold: <span className="font-semibold text-indigo-600 dark:text-indigo-400">75% attendance</span> across synthesized calendar dates
                </p>
              </div>
            </div>

            <a
              href="/api/schedule/export"
              download="classflow-schedule.ics"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors self-start sm:self-center"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export Semester .ICS</span>
            </a>
          </div>

          {attendance && attendance.subjects.length > 0 ? (
            <div className="space-y-6">
              {/* Semester KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Teaching Days</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{attendance.total_teaching_days}</div>
                  <div className="text-[10px] text-slate-400">Institutional days</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Academic Holidays</div>
                  <div className="text-xl font-extrabold text-rose-600 dark:text-rose-400 mt-0.5">{attendance.total_holidays}</div>
                  <div className="text-[10px] text-slate-400">Classes suspended</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Scheduled</div>
                  <div className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5">{attendance.total_classes_semester}</div>
                  <div className="text-[10px] text-slate-400">Lectures & labs</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Held To Date</div>
                  <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5">{attendance.classes_held_to_date}</div>
                  <div className="text-[10px] text-slate-400">Elapsed sessions</div>
                </div>
              </div>

              {/* Subject Breakdown Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-3 text-center">Semester Total</th>
                      <th className="py-3 px-3 text-center">Held to Date</th>
                      <th className="py-3 px-3 text-center">Remaining</th>
                      <th className="py-3 px-3 text-center">Min to Attend (75%)</th>
                      <th className="py-3 px-4 text-right">Safe Cuts Allowed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {attendance.subjects.map((sub) => (
                      <tr key={sub.subject_name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{sub.subject_name}</div>
                          {sub.subject_code && (
                            <span className="font-mono text-[10px] text-slate-400">{sub.subject_code}</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-slate-700 dark:text-slate-300">
                          {sub.total_scheduled}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                          {sub.classes_held_to_date}
                        </td>
                        <td className="py-3 px-3 text-center text-slate-600 dark:text-slate-400">
                          {sub.remaining_classes}
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-indigo-600 dark:text-indigo-400">
                          {sub.minimum_classes_needed}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-xs ${
                              sub.safe_cuts_allowance > 3
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                                : sub.safe_cuts_allowance > 0
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                            }`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{sub.safe_cuts_allowance} cuts</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="p-6 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                To calculate semester attendance and safe cut allowances, ensure you have an active timetable and an academic calendar configured with semester start/end dates.
              </p>
              <div className="flex justify-center gap-3 mt-3">
                <Link
                  href="/timetable"
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-500"
                >
                  Configure Timetable →
                </Link>
                <Link
                  href="/calendar"
                  className="text-xs font-semibold text-purple-600 hover:text-purple-500"
                >
                  Configure Calendar →
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-4 px-6 text-center text-xs text-slate-500 dark:text-slate-400">
        ClassFlow • Next.js 15 App Router • Supabase PostgreSQL • Real Deterministic Schedule Engine
      </footer>
    </div>
  );
}
