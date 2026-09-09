import { AuthService } from '@/server/services/auth.service';
import { ProfilesRepository } from '@/server/repositories/profiles.repository';
import { signOutAction } from '@/app/auth/actions';
import Link from 'next/link';
import {
  LogOut,
  LayoutDashboard,
  FilePlus,
  CalendarDays,
  Calendar,
  BarChart2
} from 'lucide-react';
import { DashboardNavActions } from './DashboardNavActions';
import { ThemeToggle } from './ThemeToggle';
import { MobileNav } from './MobileNav';

export async function TopNav() {
  const { user, supabase } = await AuthService.requireUser();
  const profilesRepo = new ProfilesRepository(supabase);
  const profile = await profilesRepo.getProfile(user.id);

  const studentName = profile?.name || user.user_metadata?.name || 'Student';
  const college = profile?.college || null;
  const timezone = profile?.timezone || 'Asia/Kolkata';

  return (
    <header className="border-b border-slate-300 dark:border-slate-800 bg-background/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-6 py-4 flex items-center justify-between transition-colors relative">
      <div className="flex items-center gap-4">
        <MobileNav />
        <Link href="/dashboard" className="flex items-center gap-2 group">
          <h1 className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">
            ClassFlow
          </h1>
        </Link>
      </div>

      <div className="flex items-center gap-4 sm:gap-8">
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-coral-500 dark:hover:text-coral-400 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/documents"
            className="flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded bg-coral-400 text-white hover:bg-coral-500 transition-colors shadow-sm"
          >
            <FilePlus className="w-4 h-4" />
            Make Schedule
          </Link>
          <Link
            href="/schedule"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-coral-500 dark:hover:text-coral-400 transition-colors"
          >
            <CalendarDays className="w-4 h-4" />
            Schedule
          </Link>
          <Link
            href="/calendar"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-coral-500 dark:hover:text-coral-400 transition-colors"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </Link>
          <Link
            href="/attendance"
            className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:text-coral-500 dark:hover:text-coral-400 transition-colors"
          >
            <BarChart2 className="w-4 h-4" />
            Attendance
          </Link>
        </nav>

        <div className="w-px h-5 bg-slate-300 dark:bg-slate-700 hidden md:block"></div>

        <div className="flex items-center gap-2 sm:gap-5">
          <div className="text-right hidden lg:block">
            <div className="text-sm font-medium text-slate-900 dark:text-white">{studentName}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 tracking-wide mt-0.5">
              {college ? college : timezone}
            </div>
          </div>

          <DashboardNavActions />
          <ThemeToggle />

          <form action={signOutAction}>
            <button
              type="submit"
              title="Sign Out"
              className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
