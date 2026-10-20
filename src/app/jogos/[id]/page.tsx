import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { Game } from "@/types";
import { formatAppDate, formatAppDateTime } from "@/lib/utils/date";
import { TeamLogo } from "@/components/TeamLogo";
import { PlayerPropCandidate, PlayerPropMarket } from "@/lib/analysis/player-props";
import { PlayerAnalysisBoard } from "@/components/PlayerAnalysisBoard";

export const dynamic = "force-dynamic";

interface GameDetails {
  game: Game;
  props: PlayerPropCandidate[];
  message?: string;
}

async function getGameDetails(id: string, date: string): Promise<GameDetails | undefined> {
  const requestHeaders = headers();
  const host = requestHeaders.get("host");
  if (!host) return undefined;
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost:") ? "http" : "https");
  const baseUrl = `${protocol}://${host}`;

  const gameResponse = await fetch(
    `${baseUrl}/api/games?date=${encodeURIComponent(date)}`,
    { cache: "no-store" },
  );
  if (!gameResponse.ok) return undefined;
  const gameData = await gameResponse.json();
  const game = (gameData.games as Game[]).find((item) => item.id === id);
  if (!game) return undefined;

  const gameDay = formatAppDate(game.commence_time, "yyyy-MM-dd");
  const analysisResponse = await fetch(
    `${baseUrl}/api/analysis/nba?from=${gameDay}&to=${gameDay}`,
    { cache: "no-store" },
  );
  if (!analysisResponse.ok) return { game, props: [] };
  const analysis = await analysisResponse.json();
  const recommendations = (analysis.recommendations || []) as PlayerPropCandidate[];
  return {
    game,
    props: recommendations.filter((pick) => sameGame(pick, game)),
    message: analysis.message,
  };
}

const marketOrder: PlayerPropMarket[] = [
  "player_points",
  "player_rebounds",
  "player_assists",
  "player_threes",
  "player_points_rebounds_assists",
];

const marketNames: Record<PlayerPropMarket, string> = {
  player_points: "Pontos",
  player_rebounds: "Rebotes",
  player_assists: "Assistências",
  player_threes: "Cestas de 3",
  player_points_rebounds_assists: "Pontos + rebotes + assistências",
};

function rankedUniquePicks(picks: PlayerPropCandidate[]): PlayerPropCandidate[] {
  const expectedValue = (pick: PlayerPropCandidate) => pick.recommendationSide === "Under"
    ? pick.expectedValueUnder ?? -1
    : pick.expectedValue ?? -1;
  const ordered = [...picks].sort((a, b) =>
    Number(b.shortlistEligible) - Number(a.shortlistEligible)
    || expectedValue(b) - expectedValue(a)
    || Math.max(b.edge ?? -1, b.edgeUnder ?? -1) - Math.max(a.edge ?? -1, a.edgeUnder ?? -1),
  );
  const seen = new Set<string>();
  return ordered.filter((pick) => {
    const player = pick.player.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
    if (seen.has(player)) return false;
    seen.add(player);
    return true;
  });
}

function normalizeTeamName(value: string | undefined): string {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function sameGame(pick: PlayerPropCandidate, game: Game): boolean {
  if (pick.gameId === game.id) return true;
  const pickTeams = [normalizeTeamName(pick.homeTeam), normalizeTeamName(pick.awayTeam)].sort();
  const gameTeams = [normalizeTeamName(game.home_team.name), normalizeTeamName(game.away_team.name)].sort();
  if (!pickTeams[0] || pickTeams[0] !== gameTeams[0] || pickTeams[1] !== gameTeams[1]) return false;
  const pickTime = Date.parse(pick.commenceTime);
  const gameTime = Date.parse(game.commence_time);
  return Number.isFinite(pickTime) && Number.isFinite(gameTime) && Math.abs(pickTime - gameTime) < 5 * 60 * 1000;
}
export default async function GamePage({ params, searchParams }: { params: { id: string }; searchParams: { date?: string } }) {
  const fallbackDate = formatAppDate(new Date(), "yyyy-MM-dd");
  const date = searchParams.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date)
    ? searchParams.date
    : fallbackDate;
  const details = await getGameDetails(params.id, date);
  if (!details) notFound();
  const { game } = details;
  const isFinished = game.status === "finished";
  const propsByMarket = marketOrder.map((market) => ({
    market,
    picks: rankedUniquePicks(details.props.filter((pick) => pick.market === market)).slice(0, 4),
  }));

  return (
    <main className="min-h-screen bg-[#F4FAFE]">
      <header className="bg-[#006BB6] px-5 py-5 text-white sm:px-8">
        <div className="mx-auto max-w-5xl">
          <Link href="/" className="text-sm font-semibold text-white/85 hover:text-white">← Voltar para jogos</Link>
          <p className="mt-8 text-xs font-bold uppercase tracking-[0.2em] text-white/70">NBA · props de jogadores</p>
          <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-4 sm:gap-8">
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row">
              <TeamLogo team={game.away_team.abbreviation} size="lg" />
              <div><p className="text-lg font-extrabold sm:text-2xl">{game.away_team.name}</p><p className="text-xs text-white/70">Visitante</p></div>
            </div>
            <div className="text-center"><p className="text-xs font-bold tracking-widest text-white/70">{isFinished ? "FINAL" : "VS"}</p><p className="mt-1 font-mono text-sm">{formatAppDateTime(game.commence_time)}</p>{isFinished && <p className="mt-1 text-lg font-bold">{game.away_score} – {game.home_score}</p>}</div>
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row-reverse">
              <TeamLogo team={game.home_team.abbreviation} size="lg" />
              <div><p className="text-lg font-extrabold sm:text-2xl">{game.home_team.name}</p><p className="text-xs text-white/70">Mandante</p></div>
            </div>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl space-y-5 px-4 py-8 sm:px-8">
        <div><h1 className="text-2xl font-extrabold text-[#12334A]">Melhores odds dos jogadores</h1><p className="mt-1 text-sm text-slate-600">Props de jogadores desta partida. Para cada linha, veja a maior odd Over e Under encontrada entre as casas.</p></div>
        {details.props.length === 0 ? (
          <div className="rounded-2xl border border-[#D5E6F2] bg-white p-8 text-center"><h2 className="font-bold text-[#12334A]">Props ainda não disponíveis para esta partida</h2><p className="mt-2 text-sm text-slate-600">{details.message || "A fonte ainda não retornou cotações de jogadores associadas a este jogo."}</p></div>
        ) : <PlayerAnalysisBoard saveEnabled groups={propsByMarket.map(({ market, picks }) => ({ market, picks, totalCount: picks.length, eligibleCount: picks.filter((pick) => pick.shortlistEligible).length }))} />}
        {details.props.length > 0 && propsByMarket.some(({ picks }) => picks.length === 0) && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {propsByMarket.filter(({ picks }) => picks.length === 0).map(({ market }) => (
              <div key={market} className="rounded-xl border border-dashed border-[#D5E6F2] bg-white px-4 py-3 text-sm text-slate-500">
                <span className="font-semibold text-[#12334A]">{marketNames[market]}</span>
                <span className="block text-xs">Sem props disponíveis nesta partida.</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500">As cotações podem mudar. Confira a linha e a odd diretamente na casa antes de apostar.</p>
      </section>
    </main>
  );
}
