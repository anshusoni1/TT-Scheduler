'use client';

import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export function AIAssistantFAB() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link
        href="/assistant"
        className="flex items-center justify-center w-14 h-14 rounded-full bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-lg hover:scale-105 hover:shadow-xl transition-all duration-200"
        title="Ask AI Assistant"
      >
        <Sparkles className="w-6 h-6" />
      </Link>
    </div>
  );
}
