export const MarketLabel: Record<string, string> = {
  h2h: 'Vencedor',
  spreads: 'Handicap',
  totals: 'Total de Pontos',
};

export const SelectionLabel: Record<string, string> = {
  home: 'Mandante',
  away: 'Visitante',
  home_spread: 'Mandante (Handicap)',
  away_spread: 'Visitante (Handicap)',
  over: 'Over',
  under: 'Under',
};

export const StatusLabel: Record<string, string> = {
  scheduled: 'Agendado',
  live: 'Ao Vivo',
  finished: 'Finalizado',
  cancelled: 'Cancelado',
  postponed: 'Adiado',
};

export const FreshnessLabel: Record<string, string> = {
  current: 'Atual',
  stale: 'Desatualizado',
  unavailable: 'Indisponível',
};

export const FreshnessColor: Record<string, string> = {
  current: 'text-court-success',
  stale: 'text-court-warning',
  unavailable: 'text-court-danger',
};