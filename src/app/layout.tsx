import type { Metadata } from 'next';
import './globals.css';
import { AIAssistantFAB } from '@/components/AIAssistantFAB';

export const metadata: Metadata = {
  title: 'ClassFlow | Academic Schedule & Timetable Intelligence',
  description: 'Production-grade academic schedule and calendar management platform for college students.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
        {children}
        <AIAssistantFAB />
      </body>
    </html>
  );
}
