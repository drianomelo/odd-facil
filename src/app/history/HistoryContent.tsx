"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  CircleCheck,
  CircleDollarSign,
  CircleMinus,
  CircleX,
  ClipboardList,
  Clock,
  Clock3,
  Filter,
  History,
  RotateCcw,
  SlidersHorizontal,
  Ticket,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { formatAppDateTime } from "@/lib/utils/date";
import { PlayerPropMarket } from "@/lib/analysis/player-props";
import { getTicketOutcome } from "@/lib/analysis/ticket-result";
import { getNbaSeasonPhase } from "@/lib/analysis/nba-season";
import { ManualTicketForm } from "./ManualTicketForm";
import { SeasonPickTracking } from "@/components/SeasonPickTracking";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { TeamLogo } from "@/components/TeamLogo";

type ForecastResult = "pending" | "won" | "lost" | "push" | "void";
type SeasonPhase = "preseason" | "regular";
type HistoryFilters = {
  result: string;
  market: string;
  phase: string;
  from: string;
  to: string;
};
type Forecast = {
  id: string;
  eventId: string;
  player: string;
  playerTeam?: string | null;
  market: PlayerPropMarket;
  line: number;
  selection: "Over" | "Under";
  projection: number;
  predictedProbability: number;
  americanOdds: number | null;
  bookmaker: string | null;
  confidence: string;
  sampleSize: number;
  commenceTime: string;
  recordedAt: string;
  actualValue: number | null;
  result: ForecastResult;
  gradedAt: string | null;
  game: string | null;
  seasonPhase: SeasonPhase;
  marketMovement?: {
    status: "closed" | "available" | "unavailable" | "unconfigured";
    sameBookmaker?: boolean;
    currentLine?: number;
    currentAmericanOdds?: number;
    currentBookmaker?: string;
    lineChanged?: boolean;
    oddsChanged?: boolean | null;
  };
};
type SavedTicketLeg = {
  position: number;
  player: string;
  playerTeam?: string | null;
  market: PlayerPropMarket;
  line: number;
  selection: "Over" | "Under";
  americanOdds: number | null;
  bookmaker: string;
  result: ForecastResult;
  actualValue: number | null;
  commenceTime: string | null;
};
type SavedTicket = {
  id: string;
  source: string;
  label: string;
  bookmaker: string;
  combinedDecimalOdds: number | null;
  combinedAmericanOdds: number | null;
  stakeAmount: number;
  potentialReturn: number | null;
  actualReturn: number | null;
  manualOutcome: "won" | "lost" | "push/void" | null;
  outcomeSource: "manual" | "boxscore" | "forecast";
  createdAt: string;
  outcome: "pending" | "won" | "lost" | "push/void";
  legs: SavedTicketLeg[];
};
type HistoryResponse = {
  page: { limit: number; offset: number; total: number };
  summary: {
    total: number;
    pending: number;
    won: number;
    lost: number;
    push: number;
    void: number;
    preseason: number;
    regular: number;
  };
  forecasts: Forecast[];
};

const DEFAULT_FILTERS: HistoryFilters = {
  result: "all",
  market: "all",
  phase: "regular",
  from: "",
  to: "",
};

const MARKET_LABELS: Record<PlayerPropMarket, string> = {
  player_points: "Pontos",
  player_rebounds: "Rebotes",
  player_assists: "Assistências",
  player_threes: "Cestas de 3",
  player_points_rebounds_assists: "Pontos + rebotes + assistências",
};

const RESULT_LABELS: Record<ForecastResult, string> = {
  pending: "Pendente",
  won: "Acertou",
  lost: "Errou",
  push: "Push",
  void: "Anulada",
};

const RESULT_STYLES: Record<ForecastResult, string> = {
  pending: "bg-court-warning/15 text-court-warning",
  won: "bg-court-success/15 text-court-success",
  lost: "bg-court-danger/15 text-court-danger",
  push: "bg-court-accent/15 text-court-accent",
  void: "bg-court-border text-court-textMuted",
};

function HistoryFilterPortal({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setTarget(document.getElementById("history-filter-slot"));
  }, []);
  return target ? createPortal(children, target) : null;
}

function formatOdds(price: number | null): string {
  if (price === null) return "Sem cotação";
  return price > 0 ? `+${price}` : String(price);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
}

function buildQuery(filters: HistoryFilters, offset = 0): string {
  const params = new URLSearchParams({ limit: "30", offset: String(offset) });
  if (filters.result !== "all") params.set("result", filters.result);
  if (filters.market !== "all") params.set("market", filters.market);
  if (filters.phase !== "all") params.set("phase", filters.phase);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params.toString();
}

export function HistoryContent({
  initialPhase = "all",
}: {
  initialPhase?: string;
}) {
  const initialFilters = { ...DEFAULT_FILTERS, phase: initialPhase };
  const [draftFilters, setDraftFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [rows, setRows] = useState<Forecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<
    "predictions" | "seasonPicks" | "bets"
  >("predictions");
  const [seasonFilterCount, setSeasonFilterCount] = useState(0);
  const [ticketFilterCount, setTicketFilterCount] = useState(0);
  const [seasonRecordCount, setSeasonRecordCount] = useState<number | null>(null);
  const [ticketRecordCount, setTicketRecordCount] = useState<number | null>(null);

  const load = useCallback(
    async (filters: HistoryFilters, offset: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const response = await fetch(
          `/api/analysis/nba/history?${buildQuery(filters, offset)}`,
          { cache: "no-store" },
        );
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "Não foi possível carregar as previsões.",
          );
        setData(body as HistoryResponse);
        setRows((current) =>
          append
            ? [...current, ...(body.forecasts as Forecast[])]
            : (body.forecasts as Forecast[]),
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Falha ao carregar o histórico.",
        );
        if (!append) setRows([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(appliedFilters, 0, false);
  }, [appliedFilters, load]);

  useEffect(() => {
    let active = true;
    void fetch('/api/analysis/nba/season-picks/history', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Falha ao carregar sinais.');
        if (active) setSeasonRecordCount(Number(body.summary?.total || 0));
      })
      .catch(() => undefined);
    void fetch('/api/analysis/nba/tickets', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Falha ao carregar apostas.');
        const regularTickets = (body.tickets as SavedTicket[]).filter(ticket =>
          ticket.legs.length > 0 && ticket.legs.every(leg => leg.commenceTime && getNbaSeasonPhase(leg.commenceTime) === 'regular'),
        );
        if (active) setTicketRecordCount(regularTickets.length);
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters({ ...draftFilters });
  }

  function clearFilters() {
    setDraftFilters(DEFAULT_FILTERS);
    setAppliedFilters({ ...DEFAULT_FILTERS });
  }

  const summary = data?.summary;
  const predictionFilterCount = [
    appliedFilters.result !== "all",
    appliedFilters.market !== "all",
    Boolean(appliedFilters.from),
    Boolean(appliedFilters.to),
  ].filter(Boolean).length;
  const activeFilterCount =
    activeTab === "predictions"
      ? predictionFilterCount
      : activeTab === "seasonPicks"
        ? seasonFilterCount
        : ticketFilterCount;
  const historySections = [
    {
      id: "predictions" as const,
      label: "Previsões do sistema",
      detail: "Projeções e resultados",
      icon: ClipboardList,
      count: summary?.total ?? null,
    },
    {
      id: "seasonPicks" as const,
      label: "Sinais da temporada",
      detail: "Seus palpites registrados",
      icon: CalendarDays,
      count: seasonRecordCount,
    },
    {
      id: "bets" as const,
      label: "Apostas pessoais",
      detail: "Bilhetes, valores e retorno",
      icon: Ticket,
      count: ticketRecordCount,
    },
  ];
  return (
    <section
      className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start lg:gap-8"
      aria-labelledby="history-title"
    >
      <div className="min-w-0 space-y-4 lg:sticky lg:top-24">
        <aside
          className="min-w-0 rounded-xl border border-court-border bg-court-card p-4 shadow-sm sm:p-5"
          aria-label="Navegação do histórico"
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock aria-hidden="true" className="h-3.5 w-3.5" />
              <h3 className="text-lg font-bold text-court-text">Histórico</h3>
            </div>
            <p className="text-xs leading-5 text-court-textMuted">
              Acesse cada tipo de registro.
            </p>
          </div>

          <nav
            className="flex flex-col gap-1.5"
            role="tablist"
            aria-label="Tipo de histórico"
            aria-orientation="vertical"
          >
            {historySections.map((item) => {
              const Icon = item.icon;
              const selected = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`history-tab-${item.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="history-panel"
                  onClick={() => setActiveTab(item.id)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006BB6] ${selected ? "bg-[#006BB6]/10 text-[#005a9c]" : "text-court-text hover:bg-court-bg"}`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${selected ? "bg-[#006BB6]/10 text-[#005a9c]" : "bg-court-bg text-court-textMuted"}`}
                  >
                    <Icon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {item.label}
                  </span>
                <span
                  aria-hidden="true"
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums ${selected ? "border-[#006BB6] bg-[#006BB6] text-white" : "border-court-border bg-white text-court-textMuted"}`}
                >
                    {item.count ?? '…'}
                  </span>
                </button>
              );
            })}
          </nav>

          <Link
            href="/times"
            className="mt-4 border border-dashed rounded-xl hidden w-full items-center justify-center h-[44px] pt-px text-sm font-semibold transition-all lg:flex hover:bg-blue-50 hover:border-blue-200"
          >
            Desempenho dos times
          </Link>
        </aside>

        <aside
          className="rounded-xl border border-court-border bg-court-card p-4 shadow-sm sm:p-5"
          aria-label={`Filtros: ${historySections.find((item) => item.id === activeTab)?.label}`}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal aria-hidden="true" className="h-3.5 w-3.5" />
              <h3 className="text-lg font-bold text-court-text">Filtros</h3>
            </div>

            <span className="shrink-0 rounded-full bg-court-bg  text-xs font-medium text-court-textMuted">
              {activeFilterCount}{" "}
              {activeFilterCount === 1 ? "aplicado" : "aplicados"}
            </span>
          </div>
          <div id="history-filter-slot" className="space-y-3" />
        </aside>
      </div>

      <div
        id="history-panel"
        className="min-w-0 space-y-6"
        role="tabpanel"
        aria-labelledby={`history-tab-${activeTab}`}
      >
        <div className="flex flex-col gap-3 border-b border-court-border pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="history-title"
              className="text-2xl font-bold text-court-text sm:text-3xl"
            >
              {historySections.find((item) => item.id === activeTab)?.label}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-court-textMuted">
              {activeTab === "predictions"
                ? "Consulte as previsões do sistema, seus filtros e a apuração de cada partida."
                : activeTab === "seasonPicks"
                  ? "Acompanhe os palpites que você registrou e os resultados reais da temporada."
                  : "Controle seus bilhetes salvos, valores apostados e retornos."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className="flex items-center gap-2 text-sm text-court-textMuted"
              aria-live="polite"
            >
              <CalendarDays aria-hidden="true" className="h-4 w-4" />
              {activeTab === "predictions"
                ? summary
                  ? `${summary.total} previsões registradas`
                  : "Carregando previsões"
                : activeTab === "seasonPicks"
                  ? "Temporada atual"
                  : "Apostas pessoais"}
            </span>
            <Link
              href="/times"
              className="btn-secondary px-3 py-2 text-sm lg:hidden"
            >
              Desempenho por time
            </Link>
          </div>
        </div>

        {activeTab === "seasonPicks" ? (
          <SeasonPickTracking
            mode="history"
            filterPortal={HistoryFilterPortal}
            onActiveFilterCountChange={setSeasonFilterCount}
            onRecordCountChange={setSeasonRecordCount}
          />
        ) : null}
        {activeTab === "predictions" ? (
          <>
            {summary && (
              <section
                aria-label="Indicadores do histórico"
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 2xl:grid-cols-6">
                  {[
                    {
                      label: "Previsões",
                      value: summary.total,
                      detail: "no período filtrado",
                      icon: ClipboardList,
                      tone: "text-court-accent",
                      surface: "border-court-accent/25 bg-court-accent/5",
                    },
                    {
                      label: "Pendentes",
                      value: summary.pending,
                      detail: "aguardando resultado",
                      icon: Clock3,
                      tone: "text-court-warning",
                      surface: "border-court-warning/25 bg-court-warning/5",
                    },
                    {
                      label: "Acertos",
                      value: summary.won,
                      detail: "resultado positivo",
                      icon: CircleCheck,
                      tone: "text-court-success",
                      surface: "border-court-success/25 bg-court-success/5",
                    },
                    {
                      label: "Erros",
                      value: summary.lost,
                      detail: "resultado negativo",
                      icon: CircleX,
                      tone: "text-court-danger",
                      surface: "border-court-danger/25 bg-court-danger/5",
                    },
                    {
                      label: "Push / anuladas",
                      value: summary.push + summary.void,
                      detail: `${summary.push} push · ${summary.void} anuladas`,
                      icon: CircleMinus,
                      tone: "text-court-textMuted",
                      surface: "border-court-border bg-court-card",
                    },
                    {
                      label: "Aproveitamento",
                      value:
                        summary.won + summary.lost
                          ? `${((summary.won / (summary.won + summary.lost)) * 100).toFixed(1)}%`
                          : "—",
                      detail: `${summary.won + summary.lost} decisões`,
                      icon: BarChart3,
                      tone: "text-court-accent",
                      surface: "border-court-accent/25 bg-court-accent/5",
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <article
                        key={item.label}
                        className={`min-w-0 rounded-xl border p-3 ${item.surface}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-xs font-medium text-court-textMuted">
                            {item.label}
                          </p>
                          <Icon
                            aria-hidden="true"
                            className={`h-4 w-4 shrink-0 ${item.tone}`}
                          />
                        </div>
                        <p
                          className={`mt-3 font-mono text-2xl font-bold tabular-nums ${item.tone}`}
                        >
                          {item.value}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-court-textMuted">
                          {item.detail}
                        </p>
                      </article>
                    );
                  })}
                </div>
                <p className="text-xs text-court-textMuted">
                  Aproveitamento considera somente previsões acertadas ou
                  erradas. Temporada regular: {summary.regular} · Pré-temporada:{" "}
                  {summary.preseason}.
                </p>
              </section>
            )}

            <HistoryFilterPortal>
              <form onSubmit={applyFilters} className="space-y-4">
                <div className="space-y-3">
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
                    Resultado
                    <select
                      className="input w-full py-2 text-sm"
                      value={draftFilters.result}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          result: event.target.value,
                        }))
                      }
                    >
                      <option value="all">Todos</option>
                      <option value="pending">Pendente</option>
                      <option value="won">Acertou</option>
                      <option value="lost">Errou</option>
                      <option value="push">Push</option>
                      <option value="void">Anulada</option>
                    </select>
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
                    Mercado
                    <select
                      className="input w-full py-2 text-sm"
                      value={draftFilters.market}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          market: event.target.value,
                        }))
                      }
                    >
                      <option value="all">Todos</option>
                      {Object.entries(MARKET_LABELS).map(([market, label]) => (
                        <option key={market} value={market}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="space-y-3 border-t border-court-border pt-4">
                  <h4 className="text-sm font-semibold text-court-text">
                    Período
                  </h4>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
                    De
                    <input
                      className="input w-full py-2 text-sm"
                      type="date"
                      value={draftFilters.from}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          from: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-xs font-medium text-court-textMuted">
                    Até
                    <input
                      className="input w-full py-2 text-sm"
                      type="date"
                      value={draftFilters.to}
                      onChange={(event) =>
                        setDraftFilters((current) => ({
                          ...current,
                          to: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
                {data && (
                  <p className="text-xs text-court-textMuted">
                    {data.page.total}{" "}
                    {data.page.total === 1 ? "resultado" : "resultados"}
                  </p>
                )}
                <div className="space-y-2 border-t border-court-border pt-3">
                  <button
                    type="submit"
                    className="btn-primary w-full justify-center px-3 py-2 text-sm"
                  >
                    <Filter aria-hidden="true" className="h-4 w-4" />
                    Aplicar
                  </button>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="btn-ghost w-full justify-center px-3 py-2 text-sm"
                  >
                    <RotateCcw aria-hidden="true" className="h-4 w-4" />
                    Limpar filtros
                  </button>
                </div>
              </form>
            </HistoryFilterPortal>

            <div
              className="flex items-center justify-between text-sm text-court-textMuted"
              aria-live="polite"
            >
              <span>{data ? `${data.page.total} resultados` : " "}</span>
            </div>

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-court-danger/40 bg-court-danger/10 p-4 text-sm text-court-text"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => void load(appliedFilters, 0, false)}
                  className="mt-2 font-medium text-court-accent underline underline-offset-4"
                >
                  Tentar novamente
                </button>
              </div>
            )}

            {loading ? (
              <div
                className="divide-y divide-court-border border-y border-court-border"
                aria-label="Carregando histórico"
              >
                {[0, 1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="h-24 animate-pulse bg-court-card/50"
                  />
                ))}
              </div>
            ) : rows.length ? (
              <div className="border-y border-court-border">
                <div className="hidden grid-cols-[1.25fr_1.35fr_1fr_0.9fr_0.8fr_0.8fr] gap-5 border-b border-court-border py-2 text-xs font-medium text-court-textMuted sm:grid">
                  <span>Partida e horário</span>
                  <span>Jogador / mercado</span>
                  <span>Palpite / cotação</span>
                  <span>Projeção / real</span>
                  <span>Apuração</span>
                  <span className="text-right">Amostra</span>
                </div>
                <div className="divide-y divide-court-border">
                  {rows.map((forecast) => (
                    <article
                      key={forecast.id}
                      className="grid grid-cols-2 gap-x-4 gap-y-4 py-4 sm:grid-cols-[1.25fr_1.35fr_1fr_0.9fr_0.8fr_0.8fr] sm:items-center sm:gap-5"
                    >
                      <div className="col-span-2 min-w-0 sm:col-span-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-court-text">
                            {forecast.game || `Partida ${forecast.eventId}`}
                          </p>
                          {forecast.seasonPhase === "preseason" && (
                            <span className="rounded bg-court-warning/15 px-2 py-0.5 text-[11px] font-medium text-court-warning">
                              Pré-temporada
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs tabular-nums text-court-textMuted">
                          {formatAppDateTime(forecast.commenceTime)}
                        </p>
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs text-court-textMuted sm:hidden">
                          Jogador / mercado
                        </p>
                        <p className="truncate font-medium text-court-text">
                          {forecast.player}
                        </p>
                        {forecast.playerTeam && (
                          <p className="text-[11px] text-court-textMuted">
                            {forecast.playerTeam}
                          </p>
                        )}
                        <p className="mt-1 truncate text-xs text-court-textMuted">
                          {MARKET_LABELS[forecast.market]}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-court-textMuted sm:hidden">
                          Palpite
                        </p>
                        <p className="font-semibold text-court-text">
                          {forecast.selection === "Over"
                            ? "Mais de"
                            : "Menos de"}{" "}
                          {forecast.line}
                        </p>
                        <p className="mt-1 text-xs text-court-textMuted">
                          {formatOdds(forecast.americanOdds)}
                          {forecast.bookmaker ? ` · ${forecast.bookmaker}` : ""}
                        </p>
                        {forecast.marketMovement?.status === "available" &&
                          forecast.marketMovement.sameBookmaker && (
                            <p className="mt-2 text-xs leading-5 text-court-textMuted">
                              {forecast.marketMovement.lineChanged
                                ? `Linha ${forecast.line} → ${forecast.marketMovement.currentLine}`
                                : "Linha sem alteração"}
                              {" · "}
                              {forecast.marketMovement.oddsChanged
                                ? `odd ${formatOdds(forecast.americanOdds)} → ${formatOdds(forecast.marketMovement.currentAmericanOdds ?? null)}`
                                : "odd sem alteração"}
                            </p>
                          )}
                        {forecast.marketMovement?.status === "available" &&
                          !forecast.marketMovement.sameBookmaker && (
                            <p className="mt-2 text-xs leading-5 text-court-textMuted">
                              Cotação atual: linha{" "}
                              {forecast.marketMovement.currentLine},{" "}
                              {formatOdds(
                                forecast.marketMovement.currentAmericanOdds ??
                                  null,
                              )}{" "}
                              @ {forecast.marketMovement.currentBookmaker}. Casa
                              diferente; comparação de preço não direta.
                            </p>
                          )}
                        {forecast.marketMovement?.status === "unavailable" && (
                          <p className="mt-2 text-xs text-court-textMuted">
                            Cotação atual indisponível na fonte.
                          </p>
                        )}
                        {forecast.marketMovement?.status === "unconfigured" && (
                          <p className="mt-2 text-xs text-court-textMuted">
                            Configure a PropLine para comparar com a cotação
                            atual.
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-court-textMuted sm:hidden">
                          Projeção / real
                        </p>
                        <p className="tabular-nums text-court-text">
                          {forecast.projection.toFixed(1)}{" "}
                          <span className="text-court-textMuted">/</span>{" "}
                          {forecast.actualValue === null
                            ? "—"
                            : forecast.actualValue.toFixed(1)}
                        </p>
                        <p className="mt-1 text-xs text-court-textMuted">
                          {Math.round(forecast.predictedProbability * 100)}%
                          estimada
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-court-textMuted sm:hidden">
                          Status
                        </p>
                        <span
                          className={`inline-flex rounded px-2 py-1 text-xs font-semibold ${RESULT_STYLES[forecast.result]}`}
                        >
                          {RESULT_LABELS[forecast.result]}
                        </span>
                      </div>

                      <div className="text-right text-xs text-court-textMuted">
                        <span className="sm:hidden">Amostra: </span>
                        {forecast.sampleSize} jogos
                        <p className="mt-1">{forecast.confidence} confiança</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ) : !error ? (
              <div className="border-y border-court-border py-12 text-center">
                <h3 className="font-semibold text-court-text">
                  Nenhuma previsão neste filtro
                </h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-court-textMuted">
                  Tente outro resultado, mercado ou período. As previsões do dia
                  aparecem aqui depois de serem registradas.
                </p>
              </div>
            ) : null}

            {data && rows.length < data.page.total && !loading && (
              <div className="flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load(appliedFilters, rows.length, true)}
                  className="btn-secondary px-5 py-2.5 text-sm"
                >
                  {loadingMore ? "Carregando…" : "Carregar mais previsões"}
                </button>
              </div>
            )}
          </>
        ) : activeTab === "bets" ? (
          <SavedTickets
            filterPortal={HistoryFilterPortal}
            onActiveFilterCountChange={setTicketFilterCount}
            onRecordCountChange={setTicketRecordCount}
          />
        ) : null}
      </div>
    </section>
  );
}

function SavedTickets({
  filterPortal: FilterPortal,
  onActiveFilterCountChange,
  onRecordCountChange,
}: {
  filterPortal: ComponentType<{ children: ReactNode }>;
  onActiveFilterCountChange: (count: number) => void;
  onRecordCountChange: (count: number) => void;
}) {
  const [tickets, setTickets] = useState<SavedTicket[]>([]);
  useEffect(() => { onRecordCountChange(tickets.length); }, [onRecordCountChange, tickets]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stakeDrafts, setStakeDrafts] = useState<Record<string, string>>({});
  const [updatingStake, setUpdatingStake] = useState<string | null>(null);
  const [stakeFeedback, setStakeFeedback] = useState<{
    id: string;
    text: string;
    error?: boolean;
  } | null>(null);
  const [period, setPeriod] = useState({ from: "", to: "" });
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | SavedTicket["outcome"]>("all");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    onActiveFilterCountChange(
      [Boolean(period.from), Boolean(period.to)].filter(Boolean).length,
    );
  }, [onActiveFilterCountChange, period]);
  const ticketsInPeriod = tickets.filter((ticket) => {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Bahia",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(ticket.createdAt));
    const inPeriod =
      (!period.from || date >= period.from) &&
      (!period.to || date <= period.to);
    return inPeriod;
  });
  const ticketGroups = [
    {
      outcome: "pending" as const,
      title: "Pendentes",
      note: "Aguardando a apuração dos jogos.",
      style: "text-court-warning",
    },
    {
      outcome: "won" as const,
      title: "Acertados",
      note: "Bilhetes com todas as seleções vencedoras.",
      style: "text-court-success",
    },
    {
      outcome: "lost" as const,
      title: "Errados",
      note: "Bilhetes com pelo menos uma seleção perdida.",
      style: "text-court-danger",
    },
    {
      outcome: "push/void" as const,
      title: "Devolvidos ou anulados",
      note: "Bilhetes devolvidos ou anulados conforme a apuração.",
      style: "text-court-textMuted",
    },
  ].map((group) => ({
    ...group,
    tickets: ticketsInPeriod.filter(
      (ticket) => ticket.outcome === group.outcome,
    ),
  }));
  const visibleTicketGroups = ticketGroups.filter(
    (group) => group.tickets.length > 0,
  );
  const displayedTicketGroups = ticketGroups.filter(
    (group) =>
      group.tickets.length > 0 &&
      (outcomeFilter === "all" || group.outcome === outcomeFilter),
  );
  const totalStaked = ticketsInPeriod.reduce(
    (total, ticket) => total + ticket.stakeAmount,
    0,
  );
  const pendingTickets = ticketsInPeriod.filter((ticket) => ticket.outcome === "pending");
  const pendingStake = pendingTickets.reduce((total, ticket) => total + ticket.stakeAmount, 0);
  const wonTickets = ticketsInPeriod.filter((ticket) => ticket.outcome === "won").length;
  const lostTickets = ticketsInPeriod.filter((ticket) => ticket.outcome === "lost").length;
  const returnedTickets = ticketsInPeriod.filter((ticket) => ticket.outcome === "push/void").length;
  const decidedTickets = wonTickets + lostTickets;
  const ticketHitRate = decidedTickets ? (wonTickets / decidedTickets) * 100 : null;
  const getSettledReturn = (ticket: SavedTicket): number | null => {
    if (ticket.outcome === "pending") return null;
    if (ticket.actualReturn !== null) return ticket.actualReturn;
    if (ticket.outcome === "lost") return 0;
    if (ticket.outcome === "push/void") return ticket.stakeAmount;
    if (ticket.potentialReturn !== null) return ticket.potentialReturn;
    if (ticket.combinedDecimalOdds !== null)
      return ticket.stakeAmount * ticket.combinedDecimalOdds;
    return null;
  };
  const financiallySettled = ticketsInPeriod.filter(
    (ticket) => getSettledReturn(ticket) !== null,
  );
  const settledStake = financiallySettled.reduce(
    (total, ticket) => total + ticket.stakeAmount,
    0,
  );
  const settledReturn = financiallySettled.reduce(
    (total, ticket) => total + (getSettledReturn(ticket) ?? 0),
    0,
  );
  const settledProfit = settledReturn - settledStake;

  useEffect(() => {
    let active = true;
    fetch("/api/analysis/nba/tickets", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "Não foi possível carregar os bilhetes.",
          );
        if (active) {
          const saved = body.tickets as SavedTicket[];
          setTickets(
            saved.filter(
              (ticket) =>
                ticket.legs.length > 0 &&
                ticket.legs.every(
                  (leg) =>
                    leg.commenceTime &&
                    getNbaSeasonPhase(leg.commenceTime) === "regular",
                ),
            ),
          );
          setStakeDrafts(
            Object.fromEntries(
              saved.map((ticket) => [
                ticket.id,
                JSON.stringify({
                  stakeAmount:
                    ticket.stakeAmount > 0 ? String(ticket.stakeAmount) : "",
                  combinedDecimalOdds:
                    ticket.combinedDecimalOdds === null
                      ? ""
                      : String(ticket.combinedDecimalOdds),
                  potentialReturn:
                    ticket.potentialReturn !== null
                      ? String(ticket.potentialReturn)
                      : ticket.stakeAmount > 0 &&
                          ticket.combinedDecimalOdds !== null
                        ? (
                            ticket.stakeAmount * ticket.combinedDecimalOdds
                          ).toFixed(2)
                        : "",
                  actualReturn:
                    ticket.actualReturn === null
                      ? ""
                      : String(ticket.actualReturn),
                  manualOutcome: ticket.manualOutcome ?? "",
                }),
              ]),
            ),
          );
        }
      })
      .catch((loadError) => {
        if (active)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Falha ao carregar bilhetes.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  async function updateStake(ticketId: string) {
    let fields: {
      stakeAmount: string;
      combinedDecimalOdds: string;
      potentialReturn: string;
      actualReturn: string;
      manualOutcome: string;
    };
    try {
      fields = JSON.parse(stakeDrafts[ticketId]);
    } catch {
      return;
    }
    const stakeAmount = Number(fields.stakeAmount);
    if (!(stakeAmount > 0) || updatingStake) return;
    setUpdatingStake(ticketId);
    setStakeFeedback(null);
    try {
      const response = await fetch("/api/analysis/nba/tickets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: ticketId,
          stakeAmount,
          combinedDecimalOdds:
            fields.combinedDecimalOdds === ""
              ? null
              : Number(fields.combinedDecimalOdds),
          potentialReturn:
            fields.potentialReturn === ""
              ? null
              : Number(fields.potentialReturn),
          actualReturn:
            fields.actualReturn === "" ? null : Number(fields.actualReturn),
          manualOutcome:
            fields.manualOutcome === "" ? null : fields.manualOutcome,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Não foi possível atualizar o valor.");
      setTickets((current) =>
        current.map((ticket) => {
          if (ticket.id !== ticketId) return ticket;
          const manualOutcome =
            body.manualOutcome as SavedTicket["manualOutcome"];
          return {
            ...ticket,
            ...body,
            manualOutcome,
            outcome:
              manualOutcome ??
              getTicketOutcome(ticket.legs.map((leg) => leg.result)),
            outcomeSource: manualOutcome ? "manual" : "forecast",
          };
        }),
      );
      setStakeDrafts((current) => ({
        ...current,
        [ticketId]: JSON.stringify({
          stakeAmount: String(body.stakeAmount),
          combinedDecimalOdds:
            body.combinedDecimalOdds === null
              ? ""
              : String(body.combinedDecimalOdds),
          potentialReturn:
            body.potentialReturn === null ? "" : String(body.potentialReturn),
          actualReturn:
            body.actualReturn === null ? "" : String(body.actualReturn),
          manualOutcome: body.manualOutcome ?? "",
        }),
      }));
      setStakeFeedback({ id: ticketId, text: "Dados da aposta atualizados." });
    } catch (updateError) {
      setStakeFeedback({
        id: ticketId,
        text:
          updateError instanceof Error
            ? updateError.message
            : "Falha ao atualizar o valor.",
        error: true,
      });
    } finally {
      setUpdatingStake(null);
    }
  }

  async function deleteTicket(ticket: SavedTicket) {
    if (!window.confirm(`Excluir “${ticket.label}” do seu histórico pessoal?`))
      return;
    setDeleting(ticket.id);
    setDeleteError("");
    try {
      const response = await fetch("/api/analysis/nba/tickets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: ticket.id }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error || "Não foi possível excluir o bilhete.");
      setTickets((current) => current.filter((item) => item.id !== ticket.id));
    } catch (deleteFailure) {
      setDeleteError(
        deleteFailure instanceof Error
          ? deleteFailure.message
          : "Falha ao excluir o bilhete.",
      );
    } finally {
      setDeleting(null);
    }
  }

  if (loading)
    return (
      <p className="text-sm text-court-textMuted">
        Carregando apostas pessoais…
      </p>
    );
  return (
    <section aria-labelledby="saved-tickets-heading" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3
            id="saved-tickets-heading"
            className="text-lg font-semibold text-court-text"
          >
            Bilhetes salvos
          </h3>
          <p className="mt-1 text-sm text-court-textMuted">
            Cada bilhete salvo conta como uma aposta. Ajuste odd, retorno e
            valor recebido conforme o comprovante da casa.
          </p>
        </div>
        {tickets.length > 0 && (
          <span className="text-xs text-court-textMuted">
            {ticketsInPeriod.length} apostas no período
          </span>
        )}
      </div>
      <ManualTicketForm onSaved={() => setReloadKey((key) => key + 1)} />
      {error && (
        <p
          role="alert"
          className="rounded-lg border border-court-danger/40 p-3 text-sm text-court-danger"
        >
          {error}
        </p>
      )}
      {deleteError && (
        <p
          role="alert"
          className="rounded-lg border border-court-danger/40 p-3 text-sm text-court-danger"
        >
          {deleteError}
        </p>
      )}
      <FilterPortal>
        <div className="space-y-3" aria-label="Filtros das apostas pessoais">
          <p className="text-xs leading-5 text-court-textMuted">
            Filtre os bilhetes pela data em que foram salvos.
          </p>
          <div className="space-y-3 border-t border-court-border pt-4">
            <h4 className="text-sm font-semibold text-court-text">
              Data das apostas
            </h4>
            <label className="block text-xs font-medium text-court-textMuted">
              Data inicial
              <input
                type="date"
                value={period.from}
                onChange={(event) =>
                  setPeriod((current) => ({
                    ...current,
                    from: event.target.value,
                  }))
                }
                className="input mt-1.5 w-full py-2 text-sm"
              />
            </label>
            <label className="block text-xs font-medium text-court-textMuted">
              Data final
              <input
                type="date"
                value={period.to}
                onChange={(event) =>
                  setPeriod((current) => ({
                    ...current,
                    to: event.target.value,
                  }))
                }
                className="input mt-1.5 w-full py-2 text-sm"
              />
            </label>
          </div>
          <p className="text-xs text-court-textMuted">
            {ticketsInPeriod.length}{" "}
            {ticketsInPeriod.length === 1 ? "aposta" : "apostas"}
          </p>
          {(period.from || period.to) && (
            <button
              type="button"
              onClick={() => setPeriod({ from: "", to: "" })}
              className="btn-ghost w-full justify-center px-3 py-2 text-sm"
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Limpar período
            </button>
          )}
        </div>
      </FilterPortal>
      {ticketsInPeriod.length > 0 && (
        <section aria-label="Resumo das apostas pessoais" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PersonalBetKpi icon={CircleDollarSign} label="Total apostado" value={formatCurrency(totalStaked)} detail={`${ticketsInPeriod.length} ${ticketsInPeriod.length === 1 ? "bilhete" : "bilhetes"} no período`} tone="blue" />
            <PersonalBetKpi icon={Clock3} label="Valor em aberto" value={formatCurrency(pendingStake)} detail={`${pendingTickets.length} ${pendingTickets.length === 1 ? "bilhete pendente" : "bilhetes pendentes"}`} tone="amber" />
            <PersonalBetKpi icon={Ticket} label="Retorno apurado" value={formatCurrency(settledReturn)} detail={`${financiallySettled.length} resultados com retorno calculável`} tone="neutral" />
            <PersonalBetKpi icon={TrendingUp} label="Lucro / prejuízo" value={financiallySettled.length ? formatCurrency(settledProfit) : "—"} detail={settledStake ? `ROI ${((settledProfit / settledStake) * 100).toFixed(1)}% sobre apostas apuradas` : "Aguardando apurações"} tone={settledProfit >= 0 ? "green" : "red"} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-court-border bg-court-card px-4 py-3 text-sm" aria-label="Resultados dos bilhetes">
            <span className="font-medium text-court-text">Resultados</span>
            <span className="inline-flex items-center gap-1.5 text-court-success"><CircleCheck aria-hidden="true" className="h-4 w-4" />{wonTickets} acertados</span>
            <span className="inline-flex items-center gap-1.5 text-court-danger"><CircleX aria-hidden="true" className="h-4 w-4" />{lostTickets} errados</span>
            <span className="inline-flex items-center gap-1.5 text-court-textMuted"><CircleMinus aria-hidden="true" className="h-4 w-4" />{returnedTickets} devolvidos/anulados</span>
            {ticketHitRate !== null && <span className="ml-auto text-xs text-court-textMuted">Aproveitamento: <strong className="text-court-text">{ticketHitRate.toFixed(1)}%</strong> dos bilhetes decididos</span>}
          </div>
        </section>
      )}
      {ticketsInPeriod.length > 0 && (
        <p className="-mt-2 text-xs text-court-textMuted">
          O retorno apurado usa o valor recebido que você informar; sem esse
          dado, calcula pela odd e pelo retorno potencial. Bilhetes ainda
          pendentes não entram no lucro.
        </p>
      )}
      {ticketsInPeriod.length > 0 && (
        <nav
          aria-label="Filtrar apostas por resultado"
          className="flex flex-wrap gap-2 border-y border-court-border py-3"
        >
          <button
            type="button"
            aria-pressed={outcomeFilter === "all"}
            onClick={() => setOutcomeFilter("all")}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-accent ${outcomeFilter === "all" ? "border-[#005a9c] bg-[#eaf5fc] text-[#005a9c]" : "border-court-border bg-court-card text-court-text hover:border-court-accent/50 hover:bg-court-bg"}`}
          >
            <span>Todos</span>
            <span className={`rounded-full px-2 py-0.5 text-xs ${outcomeFilter === "all" ? "bg-white text-[#005a9c]" : "bg-court-bg text-court-textMuted"}`}>{ticketsInPeriod.length}</span>
          </button>
          {visibleTicketGroups.map((group) => (
            <button
              type="button"
              key={group.outcome}
              aria-pressed={outcomeFilter === group.outcome}
              onClick={() => setOutcomeFilter(group.outcome)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-court-accent ${outcomeFilter === group.outcome ? "border-[#005a9c] bg-[#eaf5fc] text-[#005a9c]" : "border-court-border bg-court-card text-court-text hover:border-court-accent/50 hover:bg-court-bg"}`}
            >
              <span className={group.style}>{group.title}</span>
              <span className={`rounded-full px-2 py-0.5 text-xs ${outcomeFilter === group.outcome ? "bg-white text-[#005a9c]" : "bg-court-bg text-court-textMuted"}`}>
                {group.tickets.length}
              </span>
            </button>
          ))}
        </nav>
      )}
      <div className="space-y-6">
        {displayedTicketGroups.map(
          (group) =>
            group.tickets.length > 0 && (
              <section
                key={group.outcome}
                id={`saved-ticket-group-${group.outcome.replace("/", "-")}`}
                aria-labelledby={`saved-ticket-group-heading-${group.outcome.replace("/", "-")}`}
                className="scroll-mt-24"
              >
                <div className="flex flex-wrap items-end justify-between gap-2 border-b border-court-border pb-2">
                  <div>
                    <h4
                      id={`saved-ticket-group-heading-${group.outcome.replace("/", "-")}`}
                      className={`font-semibold ${group.style}`}
                    >
                      {group.title}
                    </h4>
                    <p className="mt-0.5 text-xs text-court-textMuted">
                      {group.note}
                    </p>
                  </div>
                  <span className="rounded-full bg-court-bg px-2.5 py-1 text-xs text-court-textMuted">
                    {group.tickets.length}
                  </span>
                </div>
                <div className="mt-3 space-y-3">
                  {group.tickets.map((ticket) => {
                    const fields = (() => {
                      try {
                        return JSON.parse(stakeDrafts[ticket.id] || "{}");
                      } catch {
                        return {};
                      }
                    })() as {
                      stakeAmount?: string;
                      combinedDecimalOdds?: string;
                      potentialReturn?: string;
                      actualReturn?: string;
                      manualOutcome?: string;
                    };
                    const updateField = (
                      name: keyof typeof fields,
                      value: string,
                    ) =>
                      setStakeDrafts((current) => {
                        let draft: typeof fields = {};
                        try {
                          draft = JSON.parse(current[ticket.id] || "{}");
                        } catch {
                          /* empty draft */
                        }
                        return {
                          ...current,
                          [ticket.id]: JSON.stringify({
                            ...draft,
                            [name]: value,
                          }),
                        };
                      });
                    return (
                      <article
                        key={ticket.id}
                        className="rounded-xl border border-court-border bg-court-card p-4 sm:p-5"
                      >
                        <div>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf5fc] text-[#005a9c]"><Ticket aria-hidden="true" className="h-5 w-5" /></span>
                              <div className="min-w-0">
                                <h4 className="truncate font-semibold text-court-text">{ticket.label}</h4>
                                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-court-textMuted">
                                  <span className="font-medium text-court-text">{ticket.bookmaker}</span><span aria-hidden="true">·</span>
                                  <span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />{formatAppDateTime(ticket.createdAt)}</span><span aria-hidden="true">·</span>
                                  <span>{ticket.legs.length} {ticket.legs.length === 1 ? "seleção" : "seleções"}</span>
                                </div>
                              </div>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ticket.outcome === "won" ? RESULT_STYLES.won : ticket.outcome === "lost" ? RESULT_STYLES.lost : ticket.outcome === "pending" ? RESULT_STYLES.pending : RESULT_STYLES.push}`}>
                              {ticket.outcome === "won" ? "Bilhete acertou" : ticket.outcome === "lost" ? "Bilhete errou" : ticket.outcome === "pending" ? "Aguardando pernas" : "Push/anulada · conferir regra da casa"}
                            </span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-court-border pt-3 text-xs sm:grid-cols-4">
                            <TicketValue label="Apostado" value={formatCurrency(ticket.stakeAmount)} />
                            <TicketValue label="Odd combinada" value={ticket.combinedDecimalOdds?.toFixed(2) ?? "Não informada"} />
                            <TicketValue label="Retorno potencial" value={ticket.potentialReturn === null ? "—" : formatCurrency(ticket.potentialReturn)} />
                            <TicketValue label="Retorno recebido" value={ticket.actualReturn === null ? "—" : formatCurrency(ticket.actualReturn)} />
                          </div>
                          <p className="mt-2 text-xs text-court-textMuted">Resultado {ticket.outcomeSource === "manual" ? "informado pela casa" : "apurado pelo sistema"}</p>
                          {ticket.stakeAmount === 0 && <p className="mt-1 text-xs text-court-warning">Valor não informado ao salvar. Atualize abaixo para incluir no controle de gastos.</p>}
                        </div>
                        <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-court-border pt-3">
                          <label className="flex-1 text-xs text-court-textMuted">
                            Valor que apostou (R$)
                            <input
                              type="number"
                              min="0.01"
                              max="1000000"
                              step="0.01"
                              inputMode="decimal"
                              placeholder="Ex.: 10,00"
                              value={stakeDrafts[ticket.id] ?? ""}
                              onChange={(event) =>
                                setStakeDrafts((current) => ({
                                  ...current,
                                  [ticket.id]: event.target.value,
                                }))
                              }
                              className="input mt-1 py-2 text-sm"
                            />
                          </label>
                          <button
                            type="button"
                            disabled={
                              updatingStake === ticket.id ||
                              !(Number(stakeDrafts[ticket.id]) > 0) ||
                              Number(stakeDrafts[ticket.id]) ===
                                ticket.stakeAmount
                            }
                            onClick={() => void updateStake(ticket.id)}
                            className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {updatingStake === ticket.id
                              ? "Salvando…"
                              : "Atualizar valor"}
                          </button>
                          {stakeFeedback?.id === ticket.id && (
                            <p
                              role={stakeFeedback.error ? "alert" : "status"}
                              className={`basis-full text-xs ${stakeFeedback.error ? "text-court-danger" : "text-court-success"}`}
                            >
                              {stakeFeedback.text}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 grid gap-3 border-t border-court-border pt-3 sm:grid-cols-2">
                          <label className="text-xs text-court-textMuted">
                            Valor apostado (R$)
                            <input
                              type="number"
                              min="0.01"
                              max="1000000"
                              step="0.01"
                              value={fields.stakeAmount ?? ""}
                              onChange={(event) =>
                                updateField("stakeAmount", event.target.value)
                              }
                              className="input mt-1 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs text-court-textMuted">
                            Odd decimal da casa
                            <input
                              type="number"
                              min="0.01"
                              max="100000"
                              step="0.0001"
                              placeholder="Indisponível para mesma partida"
                              value={fields.combinedDecimalOdds ?? ""}
                              onChange={(event) =>
                                updateField(
                                  "combinedDecimalOdds",
                                  event.target.value,
                                )
                              }
                              className="input mt-1 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs text-court-textMuted">
                            Retorno potencial (R$)
                            <input
                              type="number"
                              min="0"
                              max="1000000000"
                              step="0.01"
                              value={fields.potentialReturn ?? ""}
                              onChange={(event) =>
                                updateField(
                                  "potentialReturn",
                                  event.target.value,
                                )
                              }
                              className="input mt-1 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs text-court-textMuted">
                            Retorno recebido (R$) · inclui bônus
                            <input
                              type="number"
                              min="0"
                              max="1000000000"
                              step="0.01"
                              value={fields.actualReturn ?? ""}
                              onChange={(event) =>
                                updateField("actualReturn", event.target.value)
                              }
                              className="input mt-1 py-2 text-sm"
                            />
                          </label>
                          <label className="text-xs text-court-textMuted">
                            Resultado da casa
                            <select
                              value={fields.manualOutcome ?? ""}
                              onChange={(event) =>
                                updateField("manualOutcome", event.target.value)
                              }
                              className="input mt-1 py-2 text-sm"
                            >
                              <option value="">Usar apuração do sistema</option>
                              <option value="won">Ganhou</option>
                              <option value="lost">Perdeu</option>
                              <option value="push/void">
                                Devolvida / anulada
                              </option>
                            </select>
                          </label>
                          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                            <button
                              type="button"
                              disabled={
                                updatingStake === ticket.id ||
                                !(Number(fields.stakeAmount) > 0)
                              }
                              onClick={() => void updateStake(ticket.id)}
                              className="btn-secondary px-3 py-2 text-xs disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {updatingStake === ticket.id
                                ? "Salvando…"
                                : "Salvar alterações"}
                            </button>
                            <button
                              type="button"
                              disabled={deleting === ticket.id}
                              onClick={() => void deleteTicket(ticket)}
                              className="btn-ghost px-3 py-2 text-xs text-court-danger disabled:opacity-50"
                            >
                              {deleting === ticket.id
                                ? "Excluindo…"
                                : "Excluir bilhete"}
                            </button>
                            {stakeFeedback?.id === ticket.id && (
                              <p
                                role={stakeFeedback.error ? "alert" : "status"}
                                className={`text-xs ${stakeFeedback.error ? "text-court-danger" : "text-court-success"}`}
                              >
                                {stakeFeedback.text}
                              </p>
                            )}
                          </div>
                        </div>
                        <ol className="mt-3 divide-y divide-court-border border-t border-court-border">
                          {ticket.legs.map((leg) => (
                            <li
                              key={`${ticket.id}-${leg.position}`}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#005a9c]/15 bg-white p-3 text-sm"
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#eaf5fc] font-mono text-[11px] font-semibold text-[#005a9c]">
                                  {leg.position}
                                </span>
                                <PlayerAvatar name={leg.player} size="md" />
                                <div className="min-w-0">
                                  <p className="flex items-center gap-1.5 font-semibold text-court-text">
                                    <span className="truncate">{leg.player}</span>
                                    {leg.playerTeam && <TeamLogo team={leg.playerTeam} size="xs" />}
                                  </p>
                                  <p className="mt-0.5 truncate text-xs text-court-textMuted">
                                    {leg.playerTeam ? `${leg.playerTeam} · ` : ""}{MARKET_LABELS[leg.market]}
                                  </p>
                                  <p className="mt-1 text-[11px] text-court-textMuted">
                                    {formatOdds(leg.americanOdds)} @ {leg.bookmaker} · resultado real: {leg.actualValue === null ? "aguardando" : leg.actualValue}
                                  </p>
                                </div>
                              </div>
                              <span className="rounded-lg border border-[#005a9c]/20 bg-[#f4fafe] px-2.5 py-1.5 text-xs font-semibold text-[#005a9c]">
                                {leg.selection === "Over" ? "Mais de" : "Menos de"} {leg.line}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${RESULT_STYLES[leg.result]}`}
                              >
                                {RESULT_LABELS[leg.result]}
                              </span>
                            </li>
                          ))}
                        </ol>
                        {ticket.outcome === "push/void" && (
                          <p className="text-xs leading-5 text-court-textMuted">
                            Todas as pernas foram apuradas, mas pelo menos uma
                            foi push ou anulada. Casas podem remover essa perna
                            e recalcular a odd do bilhete conforme suas regras.
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            ),
        )}
        {!loading && ticketsInPeriod.length > 0 && displayedTicketGroups.length === 0 && (
          <div className="rounded-xl border border-court-border p-6 text-center">
            <p className="text-sm text-court-textMuted">Nenhum bilhete neste status no período.</p>
            <button type="button" onClick={() => setOutcomeFilter("all")} className="mt-3 text-sm font-medium text-court-accent underline-offset-4 hover:underline">Mostrar todos os bilhetes</button>
          </div>
        )}
        {!loading && ticketsInPeriod.length === 0 && (
          <p className="rounded-lg border border-court-border p-6 text-center text-sm text-court-textMuted">
            Nenhuma aposta neste período.
          </p>
        )}
      </div>
    </section>
  );
}

function PersonalBetKpi({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "blue" | "amber" | "neutral" | "green" | "red";
}) {
  const tones = {
    blue: "border-[#005a9c]/20 bg-[#f4fafe] text-[#005a9c]",
    amber: "border-court-warning/25 bg-court-warning/5 text-court-warning",
    neutral: "border-court-border bg-court-card text-court-textMuted",
    green: "border-court-success/25 bg-court-success/5 text-court-success",
    red: "border-court-danger/25 bg-court-danger/5 text-court-danger",
  };
  const [borderTone, backgroundTone, iconTone] = tones[tone].split(" ");

  return (
    <div className={`min-w-0 rounded-xl border ${borderTone} ${backgroundTone} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <dt className="text-xs font-medium text-court-textMuted">{label}</dt>
        <span className={`rounded-lg bg-white/80 p-2 ${iconTone}`}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </span>
      </div>
      <dd className="mt-2 break-words font-mono text-xl font-semibold tabular-nums text-court-text">{value}</dd>
      <p className="mt-1 text-[11px] leading-4 text-court-textMuted">{detail}</p>
    </div>
  );
}

function TicketValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-court-bg px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-court-textMuted">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums text-court-text">{value}</p>
    </div>
  );
}
