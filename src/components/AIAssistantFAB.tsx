'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function AIAssistantFAB() {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <Link
        href="/assistant"
        className="flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-400/30 dark:border-slate-700 shadow-sm hover:bg-slate-300 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-colors"
        title="Ask AI Assistant"
      >
        <Sparkles className="w-5 h-5" />
      </Link>
    </div>
  );
}
