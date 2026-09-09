import { AuthService } from '@/server/services/auth.service';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { signOutAction } from '@/app/auth/actions';
import Link from 'next/link';
import {
  BookOpen,
  Calendar,
  CalendarDays,
  FileText,
  BarChart3,
  LogOut,
} from 'lucide-react';
import { DashboardNavActions } from './DashboardNavActions';

export async function TopNav() {
  const { user, supabase } = await AuthService.requireUser();
  const profilesRepo = new ProfilesRepository(supabase);
  const profile = await profilesRepo.getProfile(user.id);

  const studentName = profile?.name || user.user_metadata?.name || 'Student';
  const college = profile?.college || null;
  const timezone = profile?.timezone || 'Asia/Kolkata';

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md sticky top-0 z-30 px-6 py-4 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 group">
          <div className="h-10 w-10 rounded-xl bg-slate-900 dark:bg-white flex items-center justify-center text-white dark:text-slate-900 shadow-sm transition-transform group-hover:scale-105">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
              ClassFlow
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-0.5">
              Deterministic Schedule
            </p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-6">
        <nav className="hidden md:flex items-center gap-1">
          <Link
            href="/dashboard"
            className="text-xs font-semibold px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/documents"
            className="text-xs font-semibold px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Make Schedule</span>
          </Link>
          <Link
            href="/schedule"
            className="text-xs font-semibold px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Schedule</span>
          </Link>
          <Link
            href="/calendar"
            className="text-xs font-semibold px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5" />
            <span>Calendar</span>
          </Link>
          <Link
            href="/attendance"
            className="text-xs font-semibold px-4 py-2 rounded-full text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Attendance</span>
          </Link>
        </nav>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-800 hidden md:block"></div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{studentName}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 tracking-wide mt-0.5">
              {college ? college : timezone}
            </div>
          </div>

          <DashboardNavActions />

          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
