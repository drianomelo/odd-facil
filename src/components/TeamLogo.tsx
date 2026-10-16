const NBA_TEAMS = [
  { id: '1610612737', abbreviation: 'ATL', names: ['Atlanta Hawks'] },
  { id: '1610612738', abbreviation: 'BOS', names: ['Boston Celtics'] },
  { id: '1610612751', abbreviation: 'BKN', names: ['Brooklyn Nets'] },
  { id: '1610612766', abbreviation: 'CHA', names: ['Charlotte Hornets', 'Charlotte Bobcats'] },
  { id: '1610612741', abbreviation: 'CHI', names: ['Chicago Bulls'] },
  { id: '1610612739', abbreviation: 'CLE', names: ['Cleveland Cavaliers'] },
  { id: '1610612742', abbreviation: 'DAL', names: ['Dallas Mavericks'] },
  { id: '1610612743', abbreviation: 'DEN', names: ['Denver Nuggets'] },
  { id: '1610612765', abbreviation: 'DET', names: ['Detroit Pistons'] },
  { id: '1610612744', abbreviation: 'GSW', names: ['Golden State Warriors'] },
  { id: '1610612745', abbreviation: 'HOU', names: ['Houston Rockets'] },
  { id: '1610612754', abbreviation: 'IND', names: ['Indiana Pacers'] },
  { id: '1610612746', abbreviation: 'LAC', names: ['LA Clippers', 'Los Angeles Clippers'] },
  { id: '1610612747', abbreviation: 'LAL', names: ['Los Angeles Lakers'] },
  { id: '1610612763', abbreviation: 'MEM', names: ['Memphis Grizzlies'] },
  { id: '1610612748', abbreviation: 'MIA', names: ['Miami Heat'] },
  { id: '1610612749', abbreviation: 'MIL', names: ['Milwaukee Bucks'] },
  { id: '1610612750', abbreviation: 'MIN', names: ['Minnesota Timberwolves'] },
  { id: '1610612740', abbreviation: 'NOP', names: ['New Orleans Pelicans'] },
  { id: '1610612752', abbreviation: 'NYK', names: ['New York Knicks'] },
  { id: '1610612760', abbreviation: 'OKC', names: ['Oklahoma City Thunder'] },
  { id: '1610612753', abbreviation: 'ORL', names: ['Orlando Magic'] },
  { id: '1610612755', abbreviation: 'PHI', names: ['Philadelphia 76ers', 'Sixers'] },
  { id: '1610612756', abbreviation: 'PHX', names: ['Phoenix Suns'] },
  { id: '1610612757', abbreviation: 'POR', names: ['Portland Trail Blazers'] },
  { id: '1610612758', abbreviation: 'SAC', names: ['Sacramento Kings'] },
  { id: '1610612759', abbreviation: 'SAS', names: ['San Antonio Spurs'] },
  { id: '1610612761', abbreviation: 'TOR', names: ['Toronto Raptors'] },
  { id: '1610612762', abbreviation: 'UTA', names: ['Utah Jazz'] },
  { id: '1610612764', abbreviation: 'WAS', names: ['Washington Wizards'] },
] as const;

function normalizeTeam(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const teamLookup = new Map(
  NBA_TEAMS.flatMap(team => [team.abbreviation, ...team.names].map(name => [normalizeTeam(name), team] as const)),
);

export function getNbaTeamInfo(team: string | undefined) {
  return team ? teamLookup.get(normalizeTeam(team)) : undefined;
}

export function TeamLogo({ team, size = 'sm' }: { team: string | undefined; size?: 'xs' | 'sm' | 'md' }) {
  const info = getNbaTeamInfo(team);
  const sizeClass = size === 'md' ? 'h-8 w-8' : size === 'xs' ? 'h-5 w-5' : 'h-6 w-6';

  if (!info) return null;

  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#58A9E3]/35 bg-white ${sizeClass}`}>
      <img
        src={`https://cdn.nba.com/logos/nba/${info.id}/global/L/logo.svg`}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        className="relative z-10 h-full w-full object-contain p-0.5"
        onError={event => { event.currentTarget.style.display = 'none'; }}
      />
    </span>
  );
}

export function TeamMatchup({ away, home }: { away: string | undefined; home: string | undefined }) {
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
