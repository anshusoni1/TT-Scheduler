'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Menu, X, LayoutDashboard, FilePlus, CalendarDays, Calendar, BarChart2 } from 'lucide-react';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
        aria-label="Toggle menu"
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 bg-background border-b border-slate-300 dark:border-slate-800 p-4 flex flex-col gap-4 shadow-lg z-50">
          <Link
            href="/dashboard"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/documents"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 text-sm font-semibold px-4 py-2 rounded bg-coral-400 text-white hover:bg-coral-500 transition-colors shadow-sm w-fit"
          >
            <FilePlus className="w-4 h-4" />
            Make Schedule
          </Link>
          <Link
            href="/schedule"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <CalendarDays className="w-4 h-4" />
            Schedule
          </Link>
          <Link
            href="/calendar"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <Calendar className="w-4 h-4" />
            Calendar
          </Link>
          <Link
            href="/attendance"
            onClick={() => setIsOpen(false)}
            className="flex items-center gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
          >
            <BarChart2 className="w-4 h-4" />
            Attendance
          </Link>
        </div>
      )}
    </div>
  );
}
