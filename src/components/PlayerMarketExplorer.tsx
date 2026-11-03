"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Search, TrendingUp } from "lucide-react";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { NBA_TEAMS, TeamLogo, getNbaTeamInfo } from "@/components/TeamLogo";
import type { PlayerPropCandidate, PlayerPropMarket } from "@/lib/analysis/player-props";
import { formatAppDate, formatAppDateTime } from "@/lib/utils/date";

type PlayerLog = {
  eventId: string;
  date: string;
  opponent: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
};

type SeasonPlayer = {
  playerId: string;
  player: string;
  team: string;
  games: number;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  threes: number;
  last5: { games: number; points: number; rebounds: number; assists: number; threes: number };
  logs: PlayerLog[];
};

type Market = { id: PlayerPropMarket; label: string; short: string; stat: (log: PlayerLog) => number; average: (player: SeasonPlayer) => number };

const MARKETS: Market[] = [
  { id: "player_points", label: "Pontos", short: "PTS", stat: log => log.points, average: player => player.points },
  { id: "player_rebounds", label: "Rebotes", short: "REB", stat: log => log.rebounds, average: player => player.rebounds },
  { id: "player_assists", label: "Assistências", short: "AST", stat: log => log.assists, average: player => player.assists },
  { id: "player_threes", label: "Cestas de 3", short: "3PM", stat: log => log.threes, average: player => player.threes },
];

type CandidateResponse = { recommendations?: PlayerPropCandidate[]; message?: string };
type SeasonResponse = { players?: SeasonPlayer[]; season?: string; error?: string };

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatNumber(value: number) {
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function dateLabel(date: string) {
  return formatAppDate(date, "dd/MM");
}

function candidateForPlayer(candidate: PlayerPropCandidate, player: SeasonPlayer) {
  return normalize(candidate.player) === normalize(player.player);
}

export function PlayerMarketExplorer() {
  const [players, setPlayers] = useState<SeasonPlayer[]>([]);
  const [season, setSeason] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [marketId, setMarketId] = useState<PlayerPropMarket>("player_points");
  const [line, setLine] = useState("");
  const [candidateData, setCandidateData] = useState<CandidateResponse | null>(null);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [candidateId, setCandidateId] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/analysis/nba/season-base", { cache: "no-store" })
      .then(async response => {
        const body = await response.json() as SeasonResponse;
        if (!response.ok) throw new Error(body.error || "Não foi possível carregar os dados da temporada.");
        return body;
      })
      .then(body => {
        if (!active) return;
        setPlayers(body.players || []);
        setSeason(body.season || "");
      })
      .catch(error => { if (active) setLoadError(error instanceof Error ? error.message : "Falha ao carregar os dados."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selectedPlayerId || candidateData) return;
    let active = true;
    setCandidateLoading(true);
    setCandidateError("");
    fetch("/api/analysis/nba", { cache: "no-store" })
      .then(async response => {
        const body = await response.json() as CandidateResponse;
        if (!response.ok) throw new Error(body.message || "As linhas de mercado não estão disponíveis agora.");
        return body;
      })
      .then(body => { if (active) setCandidateData(body); })
      .catch(error => { if (active) setCandidateError(error instanceof Error ? error.message : "Falha ao consultar as linhas."); })
      .finally(() => { if (active) setCandidateLoading(false); });
    return () => { active = false; };
  }, [selectedPlayerId, candidateData]);

  const teamCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const player of players) counts.set(normalize(player.team), (counts.get(normalize(player.team)) || 0) + 1);
    return counts;
  }, [players]);

  const currentTeam = NBA_TEAMS.find(team => team.names.some(name => normalize(name) === normalize(selectedTeam || "")) || normalize(team.abbreviation) === normalize(selectedTeam || ""));
  const teamPlayers = useMemo(() => players
    .filter(player => !selectedTeam || normalize(player.team) === normalize(selectedTeam) || normalize(getNbaTeamInfo(player.team)?.abbreviation || "") === normalize(selectedTeam))
    .filter(player => normalize(player.player).includes(normalize(search)))
    .sort((a, b) => b.minutes - a.minutes || b.points - a.points || a.player.localeCompare(b.player, "pt-BR")), [players, selectedTeam, search]);
  const selectedPlayer = players.find(player => player.playerId === selectedPlayerId) || null;
  const market = MARKETS.find(item => item.id === marketId) || MARKETS[0];
  const playerCandidates = selectedPlayer
    ? (candidateData?.recommendations || []).filter(candidate => candidateForPlayer(candidate, selectedPlayer) && candidate.market === marketId)
      .sort((a, b) => Date.parse(a.commenceTime) - Date.parse(b.commenceTime))
    : [];
  const activeCandidate = playerCandidates.find(candidate => candidate.id === candidateId) || playerCandidates[0];
  const lineNumber = line === "" ? (activeCandidate?.line ?? null) : Number(line);
  const logs = selectedPlayer ? [...selectedPlayer.logs].reverse().slice(-10) : [];
  const recentValues = selectedPlayer ? logs.map(market.stat) : [];
  const maxValue = Math.max(1, lineNumber ?? 0, ...recentValues) * 1.15;
  const hitCount = lineNumber === null ? null : recentValues.filter(value => value > lineNumber).length;
  const hitPercentage = hitCount === null || !recentValues.length ? null : hitCount / recentValues.length * 100;

  function chooseTeam(name: string) {
    setSelectedTeam(name);
    setSelectedPlayerId(null);
    setSearch("");
    setMarketId("player_points");
    setLine("");
    setCandidateId("");
  }

  function choosePlayer(player: SeasonPlayer) {
    setSelectedPlayerId(player.playerId);
    setMarketId("player_points");
    setLine("");
    setCandidateId("");
  }

  function chooseMarket(nextMarket: PlayerPropMarket) {
    setMarketId(nextMarket);
    setLine("");
    setCandidateId("");
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#F7FAFC]">
      <div className="mx-auto max-w-[1440px] px-4 pb-12 pt-8 sm:px-7 lg:px-10">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#10243A] sm:text-4xl">Analise por jogador</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Escolha um time, encontre o atleta e compare os mercados com o desempenho real da temporada.</p>
          </div>
          <div className="rounded-xl border border-[#D6E5F0] bg-white px-4 py-2 text-sm text-slate-600">
            <span className="font-semibold text-[#005A9C]">{season || "Temporada atual"}</span>
            <span className="mx-2 text-slate-300">·</span>{players.length} jogadores com dados
          </div>
        </div>

        <nav aria-label="Etapas da análise" className="mb-6 flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => { setSelectedTeam(null); setSelectedPlayerId(null); }} className={`rounded-full px-3 py-1.5 font-semibold ${!selectedTeam ? "bg-[#006BB6] text-white" : "bg-white text-slate-600 ring-1 ring-[#D6E5F0] hover:text-[#005A9C]"}`}>Times</button>
          <ArrowRight size={15} aria-hidden="true" className="text-slate-400" />
          <button type="button" disabled={!selectedTeam} onClick={() => setSelectedPlayerId(null)} className={`rounded-full px-3 py-1.5 font-semibold disabled:cursor-default ${selectedTeam && !selectedPlayer ? "bg-[#006BB6] text-white" : "bg-white text-slate-600 ring-1 ring-[#D6E5F0] hover:text-[#005A9C] disabled:opacity-60"}`}>{currentTeam?.abbreviation || "Jogadores"}</button>
          <ArrowRight size={15} aria-hidden="true" className="text-slate-400" />
          <span className={`rounded-full px-3 py-1.5 font-semibold ${selectedPlayer ? "bg-[#006BB6] text-white" : "bg-white text-slate-500 ring-1 ring-[#D6E5F0]"}`}>{selectedPlayer?.player || "Mercados"}</span>
        </nav>

        {loading && <div className="rounded-2xl border border-[#D6E5F0] bg-white p-8 text-sm text-slate-600">Carregando times e estatísticas da temporada…</div>}
        {!loading && loadError && !selectedTeam && <div role="alert" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"><p className="text-sm font-semibold text-amber-900">A lista dos jogadores está temporariamente indisponível.</p><p className="mt-1 text-xs text-amber-800">{loadError} Os times continuam visíveis; tente atualizar a página para carregar as estatísticas.</p><button type="button" onClick={() => window.location.reload()} className="mt-2 text-xs font-bold text-amber-900 underline">Tentar novamente</button></div>}

        {!loading && !selectedTeam && (
          <section aria-labelledby="teams-title">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div><h2 id="teams-title" className="text-xl font-bold text-[#10243A]">Escolha um time</h2><p className="mt-1 text-sm text-slate-600">Os números dos jogadores aparecem quando já há jogos da temporada registrados.</p></div>
              <span className="hidden text-xs font-semibold uppercase tracking-wider text-slate-500 sm:block">30 times NBA</span>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {NBA_TEAMS.map(team => {
                const count = teamCounts.get(normalize(team.names[0])) || teamCounts.get(normalize(team.abbreviation)) || 0;
                return <button key={team.abbreviation} type="button" onClick={() => chooseTeam(team.names[0])} className="group flex min-h-[124px] flex-col items-center justify-center rounded-2xl border border-[#DCE7EF] bg-white px-3 py-4 text-center transition hover:-translate-y-0.5 hover:border-[#70B5E1] hover:shadow-[0_8px_22px_rgba(16,36,58,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006BB6]">
                  <TeamLogo team={team.names[0]} size="md" />
                  <span className="mt-2 text-sm font-bold text-[#10243A] group-hover:text-[#005A9C]">{team.abbreviation}</span>
                  <span className="mt-0.5 text-xs text-slate-500">{count ? `${count} jogadores` : "Aguardando jogos"}</span>
                </button>;
              })}
            </div>
          </section>
        )}

        {!loading && selectedTeam && !selectedPlayer && (
          <section aria-labelledby="roster-title">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => chooseTeam("")} aria-label="Voltar aos times" className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#D6E5F0] bg-white text-slate-600 hover:text-[#005A9C]"><ArrowLeft size={18} /></button>
                <TeamLogo team={selectedTeam} size="hero" />
                <div><h2 id="roster-title" className="text-2xl font-bold text-[#10243A]">{currentTeam?.names[0] || selectedTeam}</h2><p className="text-sm text-slate-600">{teamPlayers.length} jogadores com jogos registrados</p></div>
              </div>
              <label className="relative block w-full sm:max-w-xs"><span className="sr-only">Buscar jogador</span><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar jogador" className="h-11 w-full rounded-xl border border-[#D6E5F0] bg-white pl-10 pr-3 text-sm text-[#10243A] outline-none placeholder:text-slate-400 focus:border-[#006BB6] focus:ring-2 focus:ring-[#006BB6]/15" /></label>
            </div>
            {loadError ? <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">{loadError} Atualize a página quando a conexão com a base voltar.</div> : teamPlayers.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {teamPlayers.map(player => <button key={player.playerId} type="button" onClick={() => choosePlayer(player)} className="group flex min-w-0 items-center gap-3 rounded-2xl border border-[#DCE7EF] bg-white p-4 text-left transition hover:border-[#70B5E1] hover:shadow-[0_8px_22px_rgba(16,36,58,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006BB6]">
                <PlayerAvatar name={player.player} size="lg" />
                <span className="min-w-0 flex-1"><span className="block truncate font-bold text-[#10243A] group-hover:text-[#005A9C]">{player.player}</span><span className="mt-0.5 block text-xs text-slate-500">{player.games} jogos · {formatNumber(player.minutes)} min/jogo</span><span className="mt-2 flex gap-2 text-[11px] font-semibold text-slate-600"><span>PTS {formatNumber(player.points)}</span><span>REB {formatNumber(player.rebounds)}</span><span>AST {formatNumber(player.assists)}</span></span></span>
                <ArrowRight size={17} className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-[#006BB6]" />
              </button>)}
            </div> : <div className="rounded-2xl border border-dashed border-[#C8D9E5] bg-white px-6 py-12 text-center"><TeamLogo team={selectedTeam} size="hero" /><h3 className="mt-3 text-lg font-bold text-[#10243A]">Ainda não há jogadores na base deste time</h3><p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-slate-600">Os atletas entram nesta lista quando seus jogos da temporada e estatísticas forem sincronizados.</p></div>}
          </section>
        )}

        {!loading && !loadError && selectedPlayer && (
          <section aria-label={`Análise de ${selectedPlayer.player}`} className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-[#DCE7EF] bg-white p-4">
              <div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><TeamLogo team={selectedTeam || undefined} size="sm" /><h2 className="font-bold text-[#10243A]">Elenco</h2></div><button type="button" onClick={() => { setSelectedPlayerId(null); setLine(""); }} className="text-xs font-semibold text-[#005A9C] hover:underline">Ver time</button></div>
              <label className="relative mt-4 block"><span className="sr-only">Filtrar jogadores</span><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar" className="h-10 w-full rounded-lg border border-[#D6E5F0] bg-white pl-9 pr-3 text-sm outline-none focus:border-[#006BB6]" /></label>
              <div className="mt-3 max-h-[55vh] space-y-1 overflow-y-auto pr-1">
                {teamPlayers.map(player => <button key={player.playerId} type="button" onClick={() => choosePlayer(player)} className={`flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left ${player.playerId === selectedPlayer.playerId ? "bg-[#EAF5FC] text-[#005A9C]" : "text-slate-700 hover:bg-slate-50"}`}><PlayerAvatar name={player.player} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{player.player}</span><span className="text-[10px] text-slate-500">{player.games}J</span></button>)}
              </div>
            </aside>

            <div className="min-w-0 space-y-4">
              <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#DCE7EF] bg-white p-5 sm:p-6">
                <div className="flex min-w-0 items-center gap-4"><PlayerAvatar name={selectedPlayer.player} size="lg" /><div className="min-w-0"><h2 className="truncate text-2xl font-bold text-[#10243A] sm:text-3xl">{selectedPlayer.player}</h2><p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600"><TeamLogo team={selectedTeam || undefined} size="xs" />{currentTeam?.names[0] || selectedTeam} · {selectedPlayer.games} jogos na temporada</p></div></div>
                <button type="button" onClick={() => { setSelectedTeam(null); setSelectedPlayerId(null); }} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[#005A9C] hover:bg-[#EAF5FC]"><ArrowLeft size={16} /> Trocar time</button>
              </header>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[{ label: "Pontos", value: selectedPlayer.points }, { label: "Rebotes", value: selectedPlayer.rebounds }, { label: "Assistências", value: selectedPlayer.assists }, { label: "Cestas de 3", value: selectedPlayer.threes }].map(item => <div key={item.label} className="rounded-xl border border-[#DCE7EF] bg-white px-4 py-3"><p className="text-xs font-medium text-slate-500">Média · {item.label}</p><p className="mt-1 text-xl font-bold tabular-nums text-[#10243A]">{formatNumber(item.value)}</p></div>)}
              </div>

              <div className="overflow-hidden rounded-2xl border border-[#DCE7EF] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E5EDF3] px-4 py-4 sm:px-6">
                  <div><h3 className="text-lg font-bold text-[#10243A]">Mercados e desempenho</h3><p className="mt-0.5 text-xs text-slate-500">Histórico dos últimos {logs.length} jogos registrados</p></div>
                  <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-[#F1F5F8] p-1" role="tablist" aria-label="Mercados de jogador">
                    {MARKETS.map(item => <button key={item.id} type="button" role="tab" aria-selected={marketId === item.id} onClick={() => chooseMarket(item.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition ${marketId === item.id ? "bg-white text-[#005A9C] shadow-sm" : "text-slate-600 hover:text-[#005A9C]"}`}>{item.short}</button>)}
                  </div>
                </div>

                <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h4 className="text-xl font-bold text-[#10243A]">{market.label}</h4><p className="mt-1 text-sm text-slate-600">Média da temporada: <strong className="text-[#10243A]">{formatNumber(market.average(selectedPlayer))}</strong></p></div>
                      <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">Linha Mais de <input aria-label={`Linha Mais de para ${market.label}`} type="number" min="0" step="0.5" value={line === "" ? activeCandidate?.line ?? "" : line} onChange={event => setLine(event.target.value)} placeholder="—" className="h-10 w-20 rounded-lg border border-[#C8D9E5] px-2 text-center font-bold text-[#10243A] outline-none focus:border-[#006BB6] focus:ring-2 focus:ring-[#006BB6]/15" /></label>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-[#EAF5FC] px-3 py-1.5 font-semibold text-[#005A9C]">Últimos 5: {formatNumber(selectedPlayer.last5[market.id === "player_points" ? "points" : market.id === "player_rebounds" ? "rebounds" : market.id === "player_assists" ? "assists" : "threes"])}</span>
                      {hitCount !== null && <span className="rounded-full bg-[#E9F7EF] px-3 py-1.5 font-semibold text-emerald-800">Acima da linha: {hitCount}/{recentValues.length} jogos{hitPercentage !== null ? ` · ${Math.round(hitPercentage)}%` : ""}</span>}
                      {activeCandidate && <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-700">Linha de mercado atual</span>}
                    </div>

                    {logs.length ? <div className="mt-5 rounded-xl bg-[#F7FAFC] px-3 pb-3 pt-4 sm:px-5">
                      <div className="relative h-52 border-b border-l border-[#C8D9E5]">
                        {lineNumber !== null && <div className="absolute left-0 right-0 z-10 border-t border-dashed border-[#E85D3F]" style={{ bottom: `${Math.min(76, Math.max(3, lineNumber / maxValue * 78))}%` }}><span className="absolute -top-6 left-0 rounded bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#B7432D]">Linha {formatNumber(lineNumber)}</span></div>}
                        <div className="absolute inset-0 flex items-end justify-around gap-1 px-1">
                          {logs.map((log, index) => {
                            const value = market.stat(log);
                            const above = lineNumber !== null && value > lineNumber;
                            return <div key={`${log.eventId}-${index}`} className="relative z-[1] flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                              <span className="text-[10px] font-bold tabular-nums text-slate-700">{value}</span>
                              <div title={`${value} ${market.label.toLowerCase()} contra ${log.opponent}`} className={`w-full max-w-10 rounded-t-sm transition-[height] ${lineNumber === null ? "bg-[#006BB6]" : above ? "bg-[#00A86B]" : "bg-[#88A9BF]"}`} style={{ height: `${Math.max(4, value / maxValue * 78)}%` }} />
                              <span className="absolute -bottom-6 text-[9px] font-medium text-slate-500">{dateLabel(log.date)}</span>
                            </div>;
                          })}
                        </div>
                      </div>
                      <div className="mt-8 flex items-center justify-between text-[10px] text-slate-500"><span>Jogo mais antigo</span><span>Jogo mais recente</span></div>
                    </div> : <p className="mt-5 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">Ainda não há partidas para montar o gráfico deste jogador.</p>}
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">A linha pontilhada compara o mercado selecionado com os resultados observados. A taxa acima da linha é descritiva e não garante resultado futuro.</p>
                  </div>

                  <aside className="space-y-3">
                    <div className="rounded-xl border border-[#DCE7EF] p-4">
                      <div className="flex items-center gap-2"><BarChart3 size={17} className="text-[#006BB6]" /><h4 className="font-bold text-[#10243A]">Opção de mercado</h4></div>
                      {candidateLoading ? <p className="mt-3 text-sm text-slate-600">Buscando linhas e cotações atuais…</p> : activeCandidate ? <>
                        {playerCandidates.length > 1 && <label className="mt-3 block text-xs font-semibold text-slate-600">Partida<select value={activeCandidate.id} onChange={event => { setCandidateId(event.target.value); setLine(""); }} className="mt-1 h-10 w-full rounded-lg border border-[#D6E5F0] bg-white px-2 text-sm text-[#10243A]"><option value={activeCandidate.id}>{activeCandidate.game} · {formatAppDateTime(activeCandidate.commenceTime)}</option>{playerCandidates.filter(candidate => candidate.id !== activeCandidate.id).map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.game} · {formatAppDateTime(candidate.commenceTime)}</option>)}</select></label>}
                        <p className="mt-3 text-sm text-slate-600">Mais de <strong className="text-[#10243A]">{activeCandidate.line}</strong> {market.label.toLowerCase()}</p>
                        {activeCandidate.opponent && <p className="mt-1 text-xs text-slate-500">{selectedPlayer.team} vs {activeCandidate.opponent} · {formatAppDateTime(activeCandidate.commenceTime)}</p>}
                        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-[#F2F7FA] p-3"><p className="text-[10px] text-slate-500">Projeção</p><p className="mt-1 font-bold text-[#10243A]">{formatNumber(activeCandidate.projection)}</p></div><div className="rounded-lg bg-[#F2F7FA] p-3"><p className="text-[10px] text-slate-500">Chance estimada</p><p className="mt-1 font-bold text-[#10243A]">{Math.round(activeCandidate.probabilityOver * 100)}%</p></div></div>
                        <div className="mt-2 rounded-lg bg-[#E9F7EF] p-3"><p className="text-[10px] text-emerald-800">Melhor cotação para Mais de</p><p className="mt-1 font-bold text-emerald-900">{activeCandidate.bestOver ? `${activeCandidate.bestOver.price > 0 ? "+" : ""}${activeCandidate.bestOver.price} · ${activeCandidate.bestOver.bookmaker}` : "Não disponível"}</p></div>
                        {!!activeCandidate.contextNotes?.length && <ul className="mt-3 space-y-1.5 text-xs leading-5 text-slate-600">{activeCandidate.contextNotes.slice(0, 3).map(note => <li key={note}>{note}</li>)}</ul>}
                      </> : <div className="mt-3 rounded-lg bg-[#F2F7FA] p-3"><p className="text-sm font-semibold text-[#10243A]">Sem linha atual para este mercado</p><p className="mt-1 text-xs leading-5 text-slate-600">Você pode informar uma linha acima para comparar com os jogos registrados. Não exibiremos uma cotação inventada.</p></div>}
                      {candidateError && <p role="status" className="mt-3 text-xs leading-5 text-amber-800">{candidateError} O gráfico continua disponível com os dados históricos.</p>}
                      {!candidateLoading && !candidateError && candidateData?.message && !activeCandidate && <p className="mt-3 text-xs leading-5 text-slate-600">{candidateData.message}</p>}
                    </div>
                    <div className="rounded-xl bg-[#EAF5FC] p-4"><div className="flex items-center gap-2 font-bold text-[#005A9C]"><TrendingUp size={16} /> Leitura rápida</div><p className="mt-2 text-xs leading-5 text-slate-700">Nos últimos {recentValues.length} jogos, {market.label.toLowerCase()} ficaram acima da linha em {hitCount === null ? "—" : `${hitCount} ocasiões`}. Média da temporada: {formatNumber(market.average(selectedPlayer))}.</p></div>
                  </aside>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
