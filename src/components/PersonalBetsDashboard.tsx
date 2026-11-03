"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Pencil, Save, Trash2 } from "lucide-react";
import { ManualTicketForm } from "@/app/history/ManualTicketForm";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamLogo } from "@/components/TeamLogo";
import type { PlayerPropMarket } from "@/lib/analysis/player-props";

type TicketOutcome = "pending" | "won" | "lost" | "push/void";
type ManualOutcome = Exclude<TicketOutcome, "pending">;
type TicketLeg = {
  position: number;
  eventId: string;
  player: string;
  playerTeam?: string | null;
  market: PlayerPropMarket;
  line: number;
  selection: "Over" | "Under";
  americanOdds: number | null;
  bookmaker: string;
  commenceTime: string | null;
  result: string;
  actualValue: number | null;
};
type PersonalTicket = {
  id: string;
  kind: string;
  label: string;
  bookmaker: string;
  combinedDecimalOdds: number | null;
  stakeAmount: number;
  potentialReturn: number | null;
  actualReturn: number | null;
  manualOutcome: ManualOutcome | null;
  outcomeSource: "manual" | "boxscore" | "forecast";
  source: "manual" | "generated";
  createdAt: string;
  outcome: TicketOutcome;
  legs: TicketLeg[];
};
type Draft = { stake: string; odds: string; potential: string; actual: string; outcome: string };
type Filter = "all" | TicketOutcome;

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: "Pontos",
  player_rebounds: "Rebotes",
  player_assists: "Assistências",
  player_threes: "Cestas de 3",
  player_points_rebounds_assists: "Pontos + rebotes + assistências",
};

const OUTCOME_LABELS: Record<TicketOutcome, string> = {
  pending: "Pendente",
  won: "Acertou",
  lost: "Errou",
  "push/void": "Devolvido / anulado",
};

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "won", label: "Acertou" },
  { id: "lost", label: "Errou" },
  { id: "push/void", label: "Devolvidos" },
];

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function ticketReturn(ticket: PersonalTicket): number | null {
  if (ticket.outcome === "pending") return null;
  if (ticket.actualReturn !== null) return ticket.actualReturn;
  if (ticket.outcome === "lost") return 0;
  if (ticket.outcome === "push/void") return ticket.stakeAmount;
  if (ticket.potentialReturn !== null) return ticket.potentialReturn;
  return ticket.combinedDecimalOdds === null ? null : ticket.stakeAmount * ticket.combinedDecimalOdds;
}

function draftFromTicket(ticket: PersonalTicket): Draft {
  return {
    stake: ticket.stakeAmount > 0 ? String(ticket.stakeAmount) : "",
    odds: ticket.combinedDecimalOdds === null ? "" : String(ticket.combinedDecimalOdds),
    potential: ticket.potentialReturn === null ? "" : String(ticket.potentialReturn),
    actual: ticket.actualReturn === null ? "" : String(ticket.actualReturn),
    outcome: ticket.manualOutcome || "",
  };
}

export function PersonalBetsDashboard() {
  const [tickets, setTickets] = useState<PersonalTicket[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/analysis/nba/tickets", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível carregar suas apostas.");
      const personal = body.tickets as PersonalTicket[];
      setTickets(personal);
      setDrafts(Object.fromEntries(personal.map(ticket => [ticket.id, draftFromTicket(ticket)])));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Falha ao carregar suas apostas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load, reloadKey]);

  const counts = useMemo(() => ({
    all: tickets.length,
    pending: tickets.filter(ticket => ticket.outcome === "pending").length,
    won: tickets.filter(ticket => ticket.outcome === "won").length,
    lost: tickets.filter(ticket => ticket.outcome === "lost").length,
    returned: tickets.filter(ticket => ticket.outcome === "push/void").length,
  }), [tickets]);
  const visibleTickets = tickets.filter(ticket => filter === "all" || ticket.outcome === filter);
  const staked = tickets.reduce((sum, ticket) => sum + ticket.stakeAmount, 0);
  const settled = tickets.filter(ticket => ticket.outcome !== "pending" && ticketReturn(ticket) !== null);
  const returned = settled.reduce((sum, ticket) => sum + (ticketReturn(ticket) ?? 0), 0);
  const settledStake = settled.reduce((sum, ticket) => sum + ticket.stakeAmount, 0);
  const profit = returned - settledStake;

  function updateDraft(ticketId: string, field: keyof Draft, value: string) {
    setDrafts(current => ({ ...current, [ticketId]: { ...current[ticketId], [field]: value } }));
  }

  async function saveTicket(ticket: PersonalTicket) {
    const draft = drafts[ticket.id];
    const stakeAmount = Number(draft?.stake);
    if (!(stakeAmount > 0)) {
      setFeedback("Informe um valor apostado maior que zero antes de salvar.");
      return;
    }
    setSavingId(ticket.id);
    setFeedback("");
    try {
      const response = await fetch("/api/analysis/nba/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticket.id,
          stakeAmount,
          combinedDecimalOdds: draft.odds === "" ? null : Number(draft.odds),
          potentialReturn: draft.potential === "" ? null : Number(draft.potential),
          actualReturn: draft.actual === "" ? null : Number(draft.actual),
          manualOutcome: draft.outcome === "" ? null : draft.outcome,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível atualizar a aposta.");
      setFeedback("Dados da aposta atualizados.");
      setReloadKey(key => key + 1);
    } catch (saveError) {
      setFeedback(saveError instanceof Error ? saveError.message : "Falha ao atualizar a aposta.");
    } finally {
      setSavingId(null);
    }
  }

  async function deleteTicket(ticket: PersonalTicket) {
    if (!window.confirm(`Apagar o bilhete “${ticket.label}” do seu controle pessoal?`)) return;
    setDeletingId(ticket.id);
    setFeedback("");
    try {
      const response = await fetch("/api/analysis/nba/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível apagar o bilhete.");
      setTickets(current => current.filter(item => item.id !== ticket.id));
      setFeedback("Bilhete apagado.");
    } catch (deleteError) {
      setFeedback(deleteError instanceof Error ? deleteError.message : "Falha ao apagar o bilhete.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-court-border pb-5">
        <div><h1 className="text-2xl font-bold text-court-text sm:text-3xl">Minhas apostas</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-court-textMuted">Registre bilhetes feitos por você e acompanhe valores, resultados e retorno.</p></div>
        <span className="text-sm text-court-textMuted">{tickets.length} {tickets.length === 1 ? "bilhete pessoal" : "bilhetes pessoais"}</span>
      </div>

      <ManualTicketForm onSaved={() => setReloadKey(key => key + 1)} />

      <dl className="grid grid-cols-2 divide-x divide-y divide-court-border border-y border-court-border sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
        <Metric label="Apostado" value={currency(staked)} />
        <Metric label="Pendentes" value={String(counts.pending)} />
        <Metric label="Acertou / errou" value={`${counts.won} / ${counts.lost}`} />
        <Metric label="Retorno apurado" value={currency(returned)} />
        <Metric label="Lucro / prejuízo" value={settled.length ? currency(profit) : "—"} />
      </dl>

      <div className="flex gap-2 overflow-x-auto border-b border-court-border pb-2" role="tablist" aria-label="Filtrar apostas pessoais">
        {FILTERS.map(item => <button key={item.id} type="button" role="tab" aria-selected={filter === item.id} onClick={() => setFilter(item.id)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition ${filter === item.id ? "bg-[#12334A] text-[#8CCBEE]" : "text-court-textMuted hover:bg-court-surface hover:text-court-text"}`}>{item.label}<span className="ml-2 rounded-full bg-black/25 px-1.5 py-0.5 text-xs tabular-nums">{item.id === "all" ? counts.all : item.id === "push/void" ? counts.returned : counts[item.id]}</span></button>)}
      </div>

      {error && <div role="alert" className="rounded-lg border border-court-danger/30 bg-court-danger/5 p-4 text-sm text-court-danger">{error}<button type="button" onClick={() => setReloadKey(key => key + 1)} className="ml-2 font-semibold underline">Tentar novamente</button></div>}
      {feedback && <p role="status" className="text-sm text-court-textMuted">{feedback}</p>}
      {loading ? <div className="h-36 animate-pulse rounded-xl bg-court-card" aria-label="Carregando apostas pessoais" /> : visibleTickets.length ? <div className="space-y-3">
        {visibleTickets.map(ticket => <article key={ticket.id} className="overflow-hidden rounded-xl border border-court-border bg-court-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-court-border bg-court-card/50 px-4 py-3 sm:px-5">
            <div><h2 className="font-bold text-court-text">{ticket.label}</h2><p className="mt-0.5 text-xs text-court-textMuted">{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", dateStyle: "medium", timeStyle: "short" }).format(new Date(ticket.createdAt))} · {ticket.bookmaker}</p></div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${ticket.outcome === "won" ? "bg-emerald-400/15 text-emerald-300" : ticket.outcome === "lost" ? "bg-rose-400/15 text-rose-300" : ticket.outcome === "pending" ? "bg-amber-300/15 text-amber-200" : "bg-white/10 text-white/70"}`}>{OUTCOME_LABELS[ticket.outcome]}</span>
          </header>
          <div className="divide-y divide-court-border px-4 sm:px-5">
            {ticket.legs.map((leg, index) => <div key={`${ticket.id}-${leg.position}-${index}`} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <PlayerAvatar name={leg.player} size="sm" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-court-text">{leg.player}</p><p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-court-textMuted"><TeamLogo team={leg.playerTeam || undefined} size="xs" />{leg.playerTeam || "Time não informado"}<span>·</span>{MARKET_LABELS[leg.market]}<span>·</span>{leg.selection === "Over" ? "Mais de" : "Menos de"} {leg.line}</p></div>
              <span className="text-xs text-court-textMuted">{leg.actualValue === null ? "Aguardando resultado" : `Real: ${leg.actualValue}`}</span>
            </div>)}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-court-border px-4 py-3 text-xs text-court-textMuted sm:px-5"><span>Odd {ticket.combinedDecimalOdds?.toFixed(2) ?? "—"}</span><span>Apostado {currency(ticket.stakeAmount)}</span><span>Retorno potencial {ticket.potentialReturn === null ? "—" : currency(ticket.potentialReturn)}</span><span>Retorno real {ticketReturn(ticket) === null ? "—" : currency(ticketReturn(ticket)!)}</span></div>
          <details className="group border-t border-court-border px-4 py-3 sm:px-5">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-[#58A9E3]"><Pencil size={15} /> Ajustar valores ou resultado <ChevronDown size={15} className="ml-auto transition group-open:rotate-180" /></summary>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-court-textMuted">Valor apostado (R$)<input type="number" min="0.01" step="0.01" value={drafts[ticket.id]?.stake ?? ""} onChange={event => updateDraft(ticket.id, "stake", event.target.value)} className="input mt-1 py-2 text-sm" /></label>
              <label className="text-xs text-court-textMuted">Odd combinada<input type="number" min="0.01" step="0.01" value={drafts[ticket.id]?.odds ?? ""} onChange={event => updateDraft(ticket.id, "odds", event.target.value)} className="input mt-1 py-2 text-sm" placeholder="Opcional" /></label>
              <label className="text-xs text-court-textMuted">Retorno potencial (R$)<input type="number" min="0" step="0.01" value={drafts[ticket.id]?.potential ?? ""} onChange={event => updateDraft(ticket.id, "potential", event.target.value)} className="input mt-1 py-2 text-sm" placeholder="Opcional" /></label>
              <label className="text-xs text-court-textMuted">Retorno real recebido (R$)<input type="number" min="0" step="0.01" value={drafts[ticket.id]?.actual ?? ""} onChange={event => updateDraft(ticket.id, "actual", event.target.value)} className="input mt-1 py-2 text-sm" placeholder="Opcional" /></label>
              <label className="text-xs text-court-textMuted">Resultado manual<select value={drafts[ticket.id]?.outcome ?? ""} onChange={event => updateDraft(ticket.id, "outcome", event.target.value)} className="input mt-1 py-2 text-sm"><option value="">Usar apuração dos jogos</option><option value="won">Acertou</option><option value="lost">Errou</option><option value="push/void">Devolvido / anulado</option></select></label>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-3"><button type="button" onClick={() => void saveTicket(ticket)} disabled={savingId === ticket.id} className="btn-primary px-4 py-2 text-sm disabled:opacity-60"><Save size={15} className="mr-1.5 inline" />{savingId === ticket.id ? "Salvando…" : "Salvar alterações"}</button><button type="button" onClick={() => void deleteTicket(ticket)} disabled={deletingId === ticket.id} className="btn-ghost px-3 py-2 text-sm text-court-danger disabled:opacity-60"><Trash2 size={15} className="mr-1.5 inline" />{deletingId === ticket.id ? "Apagando…" : "Apagar bilhete"}</button></div>
            </div>
          </details>
        </article>)}
      </div> : <div className="rounded-xl border border-dashed border-court-border bg-court-card/40 px-5 py-10 text-center"><h2 className="font-semibold text-court-text">{tickets.length ? "Nenhuma aposta neste filtro" : "Seus bilhetes pessoais ficam aqui"}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-court-textMuted">{tickets.length ? "Escolha outra situação para ver seus bilhetes." : "Abra “Registrar bilhete feito por fora” acima para cadastrar uma aposta. Depois, atualize o resultado e o retorno por aqui."}</p>{tickets.length > 0 && <button type="button" onClick={() => setFilter("all")} className="mt-3 text-sm font-semibold text-[#8CCBEE] underline">Mostrar todos</button>}</div>}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-3 py-4 first:pl-0 sm:px-4"><dt className="text-xs text-court-textMuted">{label}</dt><dd className="mt-1 text-lg font-semibold tabular-nums text-court-text sm:text-xl">{value}</dd></div>;
}
