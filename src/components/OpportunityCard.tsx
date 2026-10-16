'use client';

import { formatAppDateTime, formatAppTime } from '@/lib/utils/date';
import { Opportunity, Factor } from '@/types';
import { SelectionLabel, MarketLabel } from '@/lib/utils/labels';

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const evColor = opportunity.expected_value > 0.1 ? 'text-emerald-700' :
                  opportunity.expected_value > 0.05 ? 'text-amber-800' : 'text-[#b3133b]';
  
  const gameTime = formatAppTime(opportunity.game.commence_time);
  const gameDate = formatAppDateTime(opportunity.game.commence_time).split(' ')[0];

  return (
    <article className="card relative overflow-hidden border-[#58A9E3]/50 bg-white shadow-sm transition-all hover:border-[#005A9C]/60 hover:shadow-md hover:shadow-[#005A9C]/10">
      {opportunity.qualified && (
        <div className="absolute top-3 right-3 badge border border-emerald-700/20 bg-emerald-50 text-emerald-800">QUALIFICADA</div>
      )}
      {!opportunity.qualified && (
        <div className="absolute top-3 right-3 badge border border-amber-700/20 bg-amber-50 text-amber-800">NÃO QUALIFICADA</div>
      )}

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-court-textMuted mb-1">
              <span className="font-mono">{gameDate}</span>
              <span className="w-px h-4 bg-court-border" />
              <span className="font-mono font-medium">{gameTime}</span>
            </div>
            <h4 className="font-semibold text-court-text truncate">
              {opportunity.game.away_team.abbreviation} @ {opportunity.game.home_team.abbreviation}
            </h4>
          </div>
          <div className="text-right flex-shrink-0">
            <div className={`text-2xl font-bold font-mono tabular-nums ${evColor}`}>
              {(opportunity.ev_percentage * 100).toFixed(1)}%
            </div>
            <div className="text-xs text-court-textMuted">EV Esperado</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="badge rounded-full border border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C]">{MarketLabel[opportunity.market]}</span>
          <span className="badge rounded-full border border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C]">{SelectionLabel[opportunity.selection]}</span>
          {opportunity.line !== null && opportunity.line !== undefined && (
            <span className="badge rounded-full border border-[#58A9E3]/50 bg-[#EAF5FC] text-[#005A9C]">
              Linha {opportunity.line > 0 ? '+' : ''}{opportunity.line}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-[#58A9E3]/30 bg-[#F4FAFE] p-3">
            <div className="text-lg font-bold font-mono tabular-nums text-court-text">
              {opportunity.odds.toFixed(2)}
            </div>
            <div className="text-xs text-court-textMuted">Odd Coletada</div>
          </div>
          {opportunity.fair_odds && (
            <div className="rounded-lg border border-[#58A9E3]/30 bg-[#F4FAFE] p-3">
              <div className="text-lg font-bold font-mono tabular-nums text-court-accent">
                {opportunity.fair_odds.toFixed(2)}
              </div>
              <div className="text-xs text-court-textMuted">Odd Justa</div>
            </div>
          )}
          {opportunity.estimated_probability && (
            <div className="rounded-lg border border-[#58A9E3]/30 bg-[#F4FAFE] p-3">
              <div className="text-lg font-bold font-mono tabular-nums text-court-success">
                {(opportunity.estimated_probability * 100).toFixed(1)}%
              </div>
              <div className="text-xs text-court-textMuted">Prob. Estimada</div>
            </div>
          )}
        </div>

        <div className="pt-2 border-t border-court-border/50">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-court-textMuted">Casa</span>
            <span className="font-medium text-court-text">{opportunity.bookmaker}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-court-textMuted">Completude</span>
            <span className="font-medium text-court-text">
              {(opportunity.data_completeness * 100).toFixed(0)}%
            </span>
          </div>
        </div>

        {(opportunity.factors?.length || 0) > 0 && (
          <details className="group">
            <summary className="cursor-pointer flex items-center justify-between text-sm text-court-textMuted hover:text-court-text">
              <span>Fatores ({opportunity.factors.length})</span>
              <svg className="w-4 h-4 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="mt-3 space-y-2 pt-3 border-t border-court-border/50">
              {opportunity.factors?.map((factor, i) => (
                <FactorBadge key={i} factor={factor} />
              ))}
            </div>
          </details>
        )}

        {!opportunity.qualified && opportunity.qualification_reason && (
          <div className="p-3 bg-court-danger/10 border border-court-danger/20 rounded-lg text-sm text-court-danger">
            <strong>Não qualificada: </strong>{opportunity.qualification_reason}
          </div>
        )}
      </div>
    </article>
  );
}

function FactorBadge({ factor }: { factor: Factor }) {
  const colors = {
    favorable: 'bg-emerald-50 text-emerald-800 border-emerald-700/20',
    uncertainty: 'bg-amber-50 text-amber-800 border-amber-700/20',
    limitation: 'bg-[#EAF5FC] text-slate-700 border-[#58A9E3]/30',
  };
  
  const icons = {
    favorable: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    uncertainty: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    limitation: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  };

  return (
    <div className={`flex items-start gap-2 p-2 rounded-lg border ${colors[factor.type]}`}>
      <span className="flex-shrink-0 mt-0.5">{icons[factor.type]}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-xs">{factor.label}</div>
        <div className="text-xs opacity-80">{factor.description}</div>
        <div className="text-xs mt-1 opacity-60">Impacto: {factor.impact === 'high' ? 'Alto' : factor.impact === 'medium' ? 'Médio' : 'Baixo'}</div>
      </div>
    </div>
  );
}
