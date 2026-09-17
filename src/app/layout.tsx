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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased min-h-screen flex flex-col bg-background text-foreground transition-colors duration-200">
        {children}
        <AIAssistantFAB />
      </body>
    </html>
  );
}
