'use client';

import { formatAppDateTime, formatAppTime } from '@/lib/utils/date';
import { Opportunity, Factor } from '@/types';
import { SelectionLabel, MarketLabel } from '@/lib/utils/labels';

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  const evColor = opportunity.expected_value > 0.1 ? 'text-court-success' : 
                  opportunity.expected_value > 0.05 ? 'text-court-warning' : 'text-court-danger';
  
  const gameTime = formatAppTime(opportunity.game.commence_time);
  const gameDate = formatAppDateTime(opportunity.game.commence_time).split(' ')[0];

  return (
    <article className="card card-hover relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-court-accent" />
      {opportunity.qualified && (
        <div className="absolute top-3 right-3 badge badge-success">QUALIFICADA</div>
      )}
      {!opportunity.qualified && (
        <div className="absolute top-3 right-3 badge badge-warning">NÃO QUALIFICADA</div>
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
          <span className="badge badge-info">{MarketLabel[opportunity.market]}</span>
          <span className="badge badge-info">{SelectionLabel[opportunity.selection]}</span>
          {opportunity.line !== null && opportunity.line !== undefined && (
            <span className="badge bg-court-border text-court-text">
              Linha {opportunity.line > 0 ? '+' : ''}{opportunity.line}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-court-bg/50 rounded-lg">
            <div className="text-lg font-bold font-mono tabular-nums text-court-text">
              {opportunity.odds.toFixed(2)}
            </div>
            <div className="text-xs text-court-textMuted">Odd Coletada</div>
          </div>
          {opportunity.fair_odds && (
            <div className="p-3 bg-court-bg/50 rounded-lg">
              <div className="text-lg font-bold font-mono tabular-nums text-court-accent">
                {opportunity.fair_odds.toFixed(2)}
              </div>
              <div className="text-xs text-court-textMuted">Odd Justa</div>
            </div>
          )}
          {opportunity.estimated_probability && (
            <div className="p-3 bg-court-bg/50 rounded-lg">
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
    favorable: 'bg-court-success/20 text-court-success border-court-success/30',
    uncertainty: 'bg-court-warning/20 text-court-warning border-court-warning/30',
    limitation: 'bg-court-textMuted/20 text-court-textMuted border-court-textMuted/30',
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