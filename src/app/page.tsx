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
          <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold">
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">ClassFlow</span>
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
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold mb-6">
          <Cpu className="h-3.5 w-3.5" />
          <span>Real Academic Intelligence • Zero Fake Data</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-6">
          College Schedule Management <br className="hidden sm:inline" />
          <span className="text-indigo-600 dark:text-indigo-400">Powered by Deterministic Architecture</span>
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto mb-10 leading-relaxed">
          Upload your timetable and academic calendar. ClassFlow uses structured multimodal AI extraction and deterministic scheduling logic to compute your real daily schedule, holiday status, and upcoming classes.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/auth/register"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-200 dark:shadow-none transition-colors"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/auth/login"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium transition-colors"
          >
            Sign In to Dashboard
          </Link>
        </div>

        {/* System Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16 text-left">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-4">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">PostgreSQL & RLS</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Every class and calendar event is stored in a normalized relational schema with strict tenant isolation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <Calendar className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Deterministic Scheduling</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Timetable, calendar overrides, and date-specific exceptions merge through strict mathematical priority rules.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="h-10 w-10 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Human Review Pipeline</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              AI extractions are validated against strict Zod schemas and require explicit confirmation before becoming active.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        ClassFlow Academic Intelligence Engine • Built with Next.js, Supabase, and PostgreSQL.
      </footer>
    </div>
  );
}
