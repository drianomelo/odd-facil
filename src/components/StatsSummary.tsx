'use client';

interface StatsSummaryProps {
  opportunities: number;
  games: number;
  creditsUsed: number;
  creditsLimit: number;
}

export function StatsSummary({ opportunities, games, creditsUsed, creditsLimit }: StatsSummaryProps) {
  const creditsPercent = Math.min((creditsUsed / creditsLimit) * 100, 100);
  const creditsColor = creditsPercent > 80 ? 'bg-court-danger' : creditsPercent > 50 ? 'bg-court-warning' : 'bg-court-success';

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-6">
      <div className="stat-card flex-1 sm:flex-none min-w-[140px]">
        <div className="stat-label">Oportunidades</div>
        <div className="stat-value text-court-accent">{opportunities}</div>
        <div className="text-xs text-court-textMuted">qualificadas hoje</div>
      </div>
      <div className="stat-card flex-1 sm:flex-none min-w-[140px]">
        <div className="stat-label">Jogos Agendados</div>
        <div className="stat-value text-court-text">{games}</div>
        <div className="text-xs text-court-textMuted">NBA hoje</div>
      </div>
      <div className="stat-card flex-1 min-w-[160px]">
        <div className="flex items-center justify-between">
          <div className="stat-label">Créditos API</div>
        </div>
        <div className="flex items-end gap-2">
          <div className="stat-value font-mono tabular-nums text-court-text">{creditsUsed} / {creditsLimit}</div>
        </div>
        <div className="w-full h-2 bg-court-bg rounded-full overflow-hidden">
          <div 
            className={`${creditsColor} h-full rounded-full transition-all duration-300`}
            style={{ width: `${creditsPercent}%` }}
          />
        </div>
        <div className="text-xs text-court-textMuted">
          {creditsLimit - creditsUsed} restantes este mês (limite: {creditsLimit})
        </div>
      </div>
    </div>
  );
}