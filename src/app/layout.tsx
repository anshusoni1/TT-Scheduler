import type { Metadata } from 'next';
import './globals.css';
import { AIAssistantFAB } from '@/components/AIAssistantFAB';

export const metadata: Metadata = {
  title: 'NxtBell',
  description: 'Make your college schedule simple. Upload your timetable and academic calendar to organize your classes, holidays and daily schedule.',
  icons: {
    icon: '/favicon.ico',
    apple: '/nxtbell-icon.png',
  }
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
