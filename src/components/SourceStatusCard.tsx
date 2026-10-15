'use client';

import { SourceStatus } from '@/types';
import { formatRelativeTime } from '@/lib/utils/date';

interface SourceStatusCardProps {
  sources: SourceStatus[];
  creditUsage: { used: number; remaining: number; limit: number };
}

const statusConfig = {
  ok: { color: 'bg-emerald-400', textColor: 'text-emerald-300', text: 'Operacional' },
  degraded: { color: 'bg-amber-300', textColor: 'text-amber-200', text: 'Degradado' },
  down: { color: 'bg-rose-400', textColor: 'text-rose-300', text: 'Indisponível' },
  unconfigured: { color: 'bg-slate-400', textColor: 'text-slate-300', text: 'Não configurado' },
};

export function SourceStatusCard({ sources, creditUsage }: SourceStatusCardProps) {
  const creditsPercent = creditUsage.limit > 0 ? Math.min((creditUsage.used / creditUsage.limit) * 100, 100) : 0;
  const creditsColor = creditsPercent > 80 ? 'bg-rose-400' : creditsPercent > 50 ? 'bg-amber-300' : 'bg-emerald-400';

  return (
    <section aria-labelledby="dashboard-config-heading" className="w-full text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="dashboard-config-heading" className="text-sm font-bold uppercase tracking-[0.14em] text-white">Configuração</h2>
          <p className="mt-1 text-xs text-blue-100/65">Fontes e cota de uso</p>
        </div>
      </div>

      <div className="mt-7">
        <div className="flex items-end justify-between gap-2">
          <span className="text-xs font-medium text-blue-100/75">Créditos API</span>
          <span className="font-mono text-sm font-semibold tabular-nums">{creditUsage.used}<span className="text-blue-100/50"> / {creditUsage.limit}</span></span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className={`${creditsColor} h-full rounded-full transition-[width] duration-500`} style={{ width: `${creditsPercent}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-blue-100/60">{creditUsage.remaining} restantes este mês</p>
      </div>

      <div className="mt-5 border-t border-white/25 pt-2">
        <ul className="divide-y divide-white/10">
          {sources.map(source => {
            const config = statusConfig[source.status];
            return (
              <li key={source.name} className="py-3 first:pt-3 last:pb-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-xs font-medium leading-5 text-white/90">{source.name}</h3>
                    <p className={`mt-1 flex items-center gap-1.5 text-[11px] font-medium ${config.textColor}`}>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${config.color}`} />
                      {config.text}
                    </p>
                  </div>
                  <span className="shrink-0 pt-0.5 text-[10px] text-blue-100/45">{formatRelativeTime(source.last_check)}</span>
                </div>
                {source.message && <p className="mt-1.5 text-[11px] leading-4 text-blue-100/55">{source.message}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
