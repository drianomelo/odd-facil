import { Ticket } from 'lucide-react';
import { formatAppDateTime } from '@/lib/utils/date';
import { SeasonPickMarket } from '@/lib/analysis/season-player-picks';
import { SeasonSuggestedTicket } from '@/lib/analysis/season-player-ticket-builder';

const MARKET_LABELS: Record<SeasonPickMarket, string> = {
  player_points: 'Pontos', player_rebounds: 'Rebotes', player_assists: 'Assistências',
  player_threes: 'Cestas de 3', player_points_rebounds_assists: 'Pontos + rebotes + assistências',
};

export function SeasonSuggestedTickets({ tickets }: { tickets: SeasonSuggestedTicket[] }) {
  return (
    <section aria-labelledby="season-ticket-title" className="mt-8 space-y-4">
      <div>
        <h2 id="season-ticket-title" className="text-2xl font-bold text-[#005A9C] sm:text-3xl">Combinações sugeridas</h2>
        <p className="mt-1 text-sm text-slate-600">Montadas apenas com sinais “Mais de” da temporada. Seu histórico por mercado ajusta a ordem das combinações.</p>
      </div>
      {tickets.length ? <div className="grid gap-4 lg:grid-cols-3">{tickets.map(ticket => (
        <article key={ticket.id} className="overflow-hidden rounded-xl border border-[#58A9E3]/50 bg-white">
          <header className="flex items-center justify-between gap-3 border-b border-[#58A9E3]/30 bg-[#EAF5FC] px-4 py-3">
            <h3 className="font-semibold text-[#005A9C]">{ticket.title}</h3>
            <span className="inline-flex items-center gap-1 rounded-md border border-[#58A9E3]/40 bg-white px-2 py-1 text-xs text-[#005A9C]"><Ticket size={14} aria-hidden="true" />{ticket.picks.length}</span>
          </header>
          <ol className="divide-y divide-[#58A9E3]/20 px-4">
            {ticket.picks.map((pick, index) => <li key={`${pick.id}-${index}`} className="py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{pick.player} <span className="font-normal text-slate-500">· {MARKET_LABELS[pick.market]}</span></p><p className="mt-1 text-xs text-slate-600">{pick.side === 'Over' ? 'Mais de' : 'Menos de'} {pick.line} · {pick.team}</p><p className="mt-1 text-[11px] text-slate-500">{pick.game} · {formatAppDateTime(pick.commenceTime)}</p></div>
                <span className="shrink-0 text-right text-xs font-semibold tabular-nums text-[#005A9C]">{pick.hits}/{pick.sampleSize}<span className="block font-normal text-slate-500">jogos</span></span>
              </div>
            </li>)}
          </ol>
        </article>
      ))}</div> : <p className="rounded-xl border border-[#58A9E3]/40 bg-[#F3F9FD] px-4 py-5 text-sm text-slate-600">Ainda não há sinais suficientes para montar combinações.</p>}
      <p className="text-xs leading-5 text-slate-500">O mesmo jogador e mercado não se repetem entre bilhetes, e cada bilhete usa atletas diferentes. A exagerada só aparece com seis atletas. A ordem considera amostra e frequência da temporada; seus resultados manuais têm peso limitado. Seleções da mesma partida podem ser correlacionadas. Não há odds nem chance conjunta: confira as cotações na casa antes de registrar a aposta.</p>
    </section>
  );
}
