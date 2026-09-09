import { TopNav } from '@/components/TopNav';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <div className="flex-1">
        {children}
      </div>
      <footer className="py-8 px-6 text-center text-sm text-slate-500 font-medium tracking-wide">
        <p className="text-slate-800 dark:text-slate-200 font-semibold mb-1">ClassFlow</p>
        <p>Zergap &middot; Built by Anshu Soni</p>
      </footer>
    </div>
  );
}
