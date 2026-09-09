import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthService } from '@/server/services/auth.service';
import { BookOpen, Calendar, ArrowRight, ShieldCheck, Cpu, Database } from 'lucide-react';

export default async function HomePage() {
  const { user } = await AuthService.getOptionalUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex-1 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-950 flex items-center justify-center text-white font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-slate-950 dark:text-white tracking-tight">ClassFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white px-3 py-1.5 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="text-sm font-medium bg-coral-500 hover:bg-coral-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
          Your timetable, organized.
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto mb-10 leading-relaxed">
          ClassFlow effortlessly manages your daily academic schedule, tracks your attendance, and automatically handles holidays so you never miss a class.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-coral-500 hover:bg-coral-600 text-white font-medium shadow-md shadow-coral-500/20 dark:shadow-none transition-colors"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium transition-colors"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* 3 Step Flow */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-20 text-left">
          <div className="flex flex-col">
            <span className="text-coral-500 font-bold mb-2 text-sm">01</span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Upload your timetable</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Drop in an image or PDF of your university timetable and academic calendar. We automatically extract your classes and holidays.
            </p>
          </div>

          <div className="flex flex-col">
            <span className="text-coral-500 font-bold mb-2 text-sm">02</span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Review your schedule</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Verify your classes and save them. We&apos;ll handle the recurring logic, exceptions, and room changes.
            </p>
          </div>

          <div className="flex flex-col">
            <span className="text-coral-500 font-bold mb-2 text-sm">03</span>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Keep your week organized</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Log into your clean, focused dashboard each day to see what&apos;s next, mark attendance, and track progress.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-300 dark:border-slate-800 px-6 py-8 text-center text-sm text-slate-500 font-medium tracking-wide">
        <p className="text-slate-950 dark:text-slate-200 font-semibold mb-1">ClassFlow</p>
        <p>Zergap &middot; Built by Anshu Soni</p>
      </footer>
    </div>
  );
}
