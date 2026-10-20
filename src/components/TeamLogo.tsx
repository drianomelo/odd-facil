"use client";

const NBA_TEAMS = [
  { id: "1610612737", abbreviation: "ATL", color: "#C8102E", names: ["Atlanta Hawks"] },
  { id: "1610612738", abbreviation: "BOS", color: "#007A33", names: ["Boston Celtics"] },
  { id: "1610612751", abbreviation: "BKN", color: "#111111", names: ["Brooklyn Nets"] },
  {
    id: "1610612766",
    abbreviation: "CHA",
    color: "#00788C",
    names: ["Charlotte Hornets", "Charlotte Bobcats"],
  },
  { id: "1610612741", abbreviation: "CHI", color: "#CE1141", names: ["Chicago Bulls"] },
  { id: "1610612739", abbreviation: "CLE", color: "#6F263D", names: ["Cleveland Cavaliers"] },
  { id: "1610612742", abbreviation: "DAL", color: "#00538C", names: ["Dallas Mavericks"] },
  { id: "1610612743", abbreviation: "DEN", color: "#0E2240", names: ["Denver Nuggets"] },
  { id: "1610612765", abbreviation: "DET", color: "#C8102E", names: ["Detroit Pistons"] },
  { id: "1610612744", abbreviation: "GSW", color: "#1D428A", names: ["Golden State Warriors"] },
  { id: "1610612745", abbreviation: "HOU", color: "#CE1141", names: ["Houston Rockets"] },
  { id: "1610612754", abbreviation: "IND", color: "#F7B11A", names: ["Indiana Pacers"] },
  {
    id: "1610612746",
    abbreviation: "LOS",
    color: "#0A213E",
    names: ["LA Clippers", "Los Angeles Clippers"],
  },
  { id: "1610612747", abbreviation: "LAL", color: "#552583", names: ["Los Angeles Lakers"] },
  { id: "1610612763", abbreviation: "MEM", color: "#5D76A9", names: ["Memphis Grizzlies"] },
  { id: "1610612748", abbreviation: "MIA", color: "#98002E", names: ["Miami Heat"] },
  { id: "1610612749", abbreviation: "MIL", color: "#00471B", names: ["Milwaukee Bucks"] },
  { id: "1610612750", abbreviation: "MIN", color: "#0C2340", names: ["Minnesota Timberwolves"] },
  { id: "1610612740", abbreviation: "NOP", color: "#B39258", names: ["New Orleans Pelicans"] },
  { id: "1610612752", abbreviation: "NYK", color: "#EF8028", names: ["New York Knicks"] },
  { id: "1610612760", abbreviation: "OKC", color: "#EF8028", names: ["Oklahoma City Thunder"] },
  { id: "1610612753", abbreviation: "ORL", color: "#0077C0", names: ["Orlando Magic"] },
  {
    id: "1610612755",
    abbreviation: "PHI",
    color: "#006BB6",
    names: ["Philadelphia 76ers", "Sixers"],
  },
  { id: "1610612756", abbreviation: "PHX", color: "#1D1160", names: ["Phoenix Suns"] },
  { id: "1610612757", abbreviation: "POR", color: "#E03A3E", names: ["Portland Trail Blazers"] },
  { id: "1610612758", abbreviation: "SAC", color: "#5A2D81", names: ["Sacramento Kings"] },
  { id: "1610612759", abbreviation: "SAS", color: "#BBC9CE", names: ["San Antonio Spurs"] },
  { id: "1610612761", abbreviation: "TOR", color: "#CE1141", names: ["Toronto Raptors"] },
  { id: "1610612762", abbreviation: "UTA", color: "#4D2B82", names: ["Utah Jazz"] },
  { id: "1610612764", abbreviation: "WAS", color: "#002B5C", names: ["Washington Wizards"] },
] as const;

function normalizeTeam(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

const teamLookup = new Map(
  NBA_TEAMS.flatMap((team) =>
    [team.abbreviation, ...team.names].map(
      (name) => [normalizeTeam(name), team] as const,
    ),
  ),
);

export function getNbaTeamInfo(team: string | undefined) {
  return team ? teamLookup.get(normalizeTeam(team)) : undefined;
}

export function TeamLogo({
  team,
  size = "sm",
}: {
  team: string | undefined;
  size?: "xs" | "sm" | "md" | "lg" | "hero" | "watermark";
}) {
  const info = getNbaTeamInfo(team);
  const sizeClass =
    size === "watermark"
      ? "h-72 w-72 sm:h-96 sm:w-96"
      : size === "hero"
        ? "h-[4.5rem] w-[4.5rem] sm:h-24 sm:w-24"
      : size === "lg"
      ? "h-14 w-14 sm:h-[4.5rem] sm:w-[4.5rem]"
      : size === "md"
        ? "h-20 w-20"
        : size === "xs"
          ? "h-5 w-5"
          : "h-6 w-6";

  if (!info) return null;

  return (
    <img
      src={`https://cdn.nba.com/logos/nba/${info.id}/global/L/logo.svg`}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      className={`relative z-10 shrink-0 object-contain p-0.5 ${sizeClass}`}
      onError={(event) => {
        event.currentTarget.style.display = "none";
      }}
    />
  );
}

export function TeamMatchup({
  away,
  home,
}: {
  away: string | undefined;
  home: string | undefined;
}) {
  const awayInfo = getNbaTeamInfo(away);
  const homeInfo = getNbaTeamInfo(home);

  if (!away || !home) return null;

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <TeamLogo team={away} size="xs" />
      <span>{awayInfo?.abbreviation || away}</span>
      <span className="text-court-textMuted">@</span>
      <TeamLogo team={home} size="xs" />
      <span>{homeInfo?.abbreviation || home}</span>
    </span>
  );
}
