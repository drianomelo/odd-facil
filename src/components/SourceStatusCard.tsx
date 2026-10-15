'use client';

import { SourceStatus } from '@/types';
import { formatRelativeTime } from '@/lib/utils/date';

interface SourceStatusCardProps {
  sources: SourceStatus[];
}

const statusConfig = {
  ok: { color: 'bg-court-success', text: 'Operacional', icon: 'check-circle' },
  degraded: { color: 'bg-court-warning', text: 'Degradado', icon: 'alert-triangle' },
  down: { color: 'bg-court-danger', text: 'Indisponível', icon: 'x-circle' },
  unconfigured: { color: 'bg-court-textMuted', text: 'Não configurado', icon: 'settings' },
};

const statusIcons = {
  'check-circle': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  'alert-triangle': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  'x-circle': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m-2 2l2 2m-2-2l-2 2m2-2l-2-2m0 0l2 2" />
    </svg>
  ),
  'settings': (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

export function SourceStatusCard({ sources }: SourceStatusCardProps) {
  return (
    <section aria-labelledby="sources-heading" className="space-y-3">
      <h3 id="sources-heading" className="text-lg font-semibold text-court-text">Status das Fontes</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sources.map(source => {
          const config = statusConfig[source.status];
          return (
            <article key={source.name} className="card card-hover">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-court-text">{source.name}</h4>
                    <span className={`badge ${config.color.replace('bg-', 'bg-')}/20 text-${config.color.replace('bg-', '')}`}>
                      {config.icon} {config.text}
                    </span>
                  </div>
                  {source.credits_remaining !== undefined && (
                    <div className="flex items-center gap-2 text-sm text-court-textMuted mb-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{source.credits_remaining} créditos restantes</span>
                    </div>
                  )}
                  {source.message && (
                    <p className="text-sm text-court-textMuted">{source.message}</p>
                  )}
                  <div className="text-xs text-court-textMuted mt-2">
                    Verificado: {formatRelativeTime(source.last_check)}
                  </div>
                </div>
                <div className={`w-10 h-10 rounded-lg ${config.color}/20 flex items-center justify-center flex-shrink-0`}>
                  {statusIcons[config.icon as keyof typeof statusIcons]}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}