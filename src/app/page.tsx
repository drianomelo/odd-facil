import { Suspense } from 'react';
import { DashboardContent } from './DashboardContent';
import { DashboardSkeleton } from './DashboardSkeleton';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dashboardContent = await DashboardContent();
  
  return (
    <main className="min-h-screen">
      <header className="border-b border-court-border bg-court-card/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-court-accent flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-court-text">Odd Fácil</h1>
              <span className="badge badge-info hidden sm:inline-flex">NBA</span>
            </div>
            <nav className="flex items-center gap-3 overflow-x-auto">
              <a href="/" aria-current="page" className="text-sm font-medium text-court-text">NBA</a>
              <a href="/history" className="text-sm text-court-textMuted hover:text-court-text transition-colors">Histórico</a>
              <a href="/performance" className="text-sm text-court-textMuted hover:text-court-text transition-colors">Desempenho</a>
              <a href="/manual" className="text-sm text-court-textMuted hover:text-court-text transition-colors">Manual</a>
            </nav>
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {dashboardContent}
      </div>
    </main>
  );
}
