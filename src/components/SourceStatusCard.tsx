'use client';

import { SourceStatus } from '@/types';
import { formatRelativeTime } from '@/lib/utils/date';

interface SourceStatusCardProps {
  sources: SourceStatus[];
  creditUsage: { used: number; remaining: number; limit: number };
  staticMode?: boolean;
}

const statusConfig = {
  ok: { color: 'bg-emerald-400', textColor: 'text-emerald-200', text: 'Operacional', value: 'OK' },
  degraded: { color: 'bg-amber-300', textColor: 'text-amber-100', text: 'Degradado', value: '!' },
  down: { color: 'bg-rose-300', textColor: 'text-rose-100', text: 'Indisponível', value: 'OFF' },
  unconfigured: { color: 'bg-slate-300', textColor: 'text-white/80', text: 'Não configurado', value: '—' },
};

const sourceImages = [
  'https://commons.wikimedia.org/wiki/Special:FilePath/OKC_Thunder_at_Washington_Wizards_(51815871018).jpg?width=160',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Stephen_Curry_shooting.jpg?width=160',
  'https://commons.wikimedia.org/wiki/Special:FilePath/Wembanyama_and_Hart%2C_2026_NBA_Finals.png?width=160',
];

export function SourceStatusCard({ sources, creditUsage, staticMode = false }: SourceStatusCardProps) {
  const creditsPercent = creditUsage.limit > 0 ? Math.min((creditUsage.used / creditUsage.limit) * 100, 100) : 0;
  const creditsColor = creditsPercent > 80 ? 'bg-rose-400' : creditsPercent > 50 ? 'bg-amber-300' : 'bg-emerald-400';

  return (
    <section aria-labelledby="dashboard-config-heading" className="w-full text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="dashboard-config-heading" className="text-2xl font-bold tracking-tight text-white sm:text-4xl">Configuração</h2>
          <p className="mt-1 text-xs text-blue-100/65">
            {staticMode ? 'APIs pausadas para ajustes visuais' : 'Fontes e cota de uso'}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#ff7896]/60 bg-[#c91540]/55 px-4 pb-4 pt-5 shadow-sm sm:px-5 sm:pb-5">
        <span className="font-mono text-3xl font-bold tabular-nums sm:text-5xl">
          {staticMode ? '—' : <>{creditUsage.used}<span className="text-white/60"> / {creditUsage.limit}</span></>}
        </span>
        <p className="mt-2 text-[10px] font-semibold text-white/90 sm:text-xs">Créditos API</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div className={`${creditsColor} h-full rounded-full transition-[width] duration-500`} style={{ width: `${creditsPercent}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] text-white/65">{staticMode ? 'Sem consultas durante o modo visual' : `${creditUsage.remaining} restantes este mês`}</p>
      </div>

      <div className="mt-8 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-2">
        {sources.map((source, index) => {
          const config = statusConfig[source.status];
          return (
            <article
              key={source.name}
              title={source.message || config.text}
              aria-label={`${source.name}: ${config.text}`}
              className="relative min-w-0 rounded-xl border border-[#ff7896]/60 bg-[#c91540]/55 px-1.5 pb-3 pt-9 text-white shadow-sm sm:px-4 sm:pb-5 sm:pt-12"
            >
              <div className="absolute -top-7 h-[52px] w-[52px] overflow-hidden rounded-full border border-[#ff7896]/60 bg-[#c91540]">
                <img
                  src={sourceImages[index % sourceImages.length]}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full rounded-full object-cover"
                />
                <span aria-hidden="true" className={`absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border border-white/80 ${config.color}`} />
              </div>
              <span className="font-mono text-base font-bold tabular-nums sm:text-5xl">
                {config.value}
              </span>
              <p className="mt-2 truncate text-[10px] font-semibold text-white/90 sm:text-xs">
                {source.name}
              </p>
              <p className={`truncate text-[9px] sm:text-[10px] ${config.textColor}`}>
                {config.text} · {formatRelativeTime(source.last_check)}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
