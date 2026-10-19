import { z } from 'zod';
import { Odd, Game, MarketOdds, Team, League, MarketType, SelectionType, GameStatus, DataFreshness } from '@/types';
import { marginFreeProbabilities } from '@/lib/utils/math';

const OddsApiEvent = z.object({
  id: z.string(),
  sport_key: z.string(),
  sport_title: z.string(),
  commence_time: z.string(),
  home_team: z.string(),
  away_team: z.string(),
});

const OddsApiResponse = OddsApiEvent.extend({
  bookmakers: z.array(z.object({
    key: z.string(),
    title: z.string(),
    last_update: z.string(),
    markets: z.array(z.object({
      key: z.string(),
      last_update: z.string(),
      outcomes: z.array(z.object({
        name: z.string(),
        price: z.number(),
        point: z.number().optional(),
      })),
    })),
  })),
});

export type OddsApiGame = z.infer<typeof OddsApiResponse>;

const NBA_TEAMS: Record<string, { name: string; abbr: string }> = {
  'Atlanta Hawks': { name: 'Atlanta Hawks', abbr: 'ATL' },
  'Boston Celtics': { name: 'Boston Celtics', abbr: 'BOS' },
  'Brooklyn Nets': { name: 'Brooklyn Nets', abbr: 'BKN' },
  'Charlotte Hornets': { name: 'Charlotte Hornets', abbr: 'CHA' },
  'Chicago Bulls': { name: 'Chicago Bulls', abbr: 'CHI' },
  'Cleveland Cavaliers': { name: 'Cleveland Cavaliers', abbr: 'CLE' },
  'Dallas Mavericks': { name: 'Dallas Mavericks', abbr: 'DAL' },
  'Denver Nuggets': { name: 'Denver Nuggets', abbr: 'DEN' },
  'Detroit Pistons': { name: 'Detroit Pistons', abbr: 'DET' },
  'Golden State Warriors': { name: 'Golden State Warriors', abbr: 'GSW' },
  'Houston Rockets': { name: 'Houston Rockets', abbr: 'HOU' },
  'Indiana Pacers': { name: 'Indiana Pacers', abbr: 'IND' },
  'LA Clippers': { name: 'LA Clippers', abbr: 'LAC' },
  'Los Angeles Lakers': { name: 'Los Angeles Lakers', abbr: 'LAL' },
  'Memphis Grizzlies': { name: 'Memphis Grizzlies', abbr: 'MEM' },
  'Miami Heat': { name: 'Miami Heat', abbr: 'MIA' },
  'Milwaukee Bucks': { name: 'Milwaukee Bucks', abbr: 'MIL' },
  'Minnesota Timberwolves': { name: 'Minnesota Timberwolves', abbr: 'MIN' },
  'New Orleans Pelicans': { name: 'New Orleans Pelicans', abbr: 'NOP' },
  'New York Knicks': { name: 'New York Knicks', abbr: 'NYK' },
  'Oklahoma City Thunder': { name: 'Oklahoma City Thunder', abbr: 'OKC' },
  'Orlando Magic': { name: 'Orlando Magic', abbr: 'ORL' },
  'Philadelphia 76ers': { name: 'Philadelphia 76ers', abbr: 'PHI' },
  'Phoenix Suns': { name: 'Phoenix Suns', abbr: 'PHX' },
  'Portland Trail Blazers': { name: 'Portland Trail Blazers', abbr: 'POR' },
  'Sacramento Kings': { name: 'Sacramento Kings', abbr: 'SAC' },
  'San Antonio Spurs': { name: 'San Antonio Spurs', abbr: 'SAS' },
  'Toronto Raptors': { name: 'Toronto Raptors', abbr: 'TOR' },
  'Utah Jazz': { name: 'Utah Jazz', abbr: 'UTA' },
  'Washington Wizards': { name: 'Washington Wizards', abbr: 'WAS' },
};

function formatOddsApiTime(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export class OddsApiClient {
  private baseUrl: string;
  private apiKey: string;
  private creditsUsed = 0;
  private creditsRemaining = 500;

  constructor() {
    this.baseUrl = process.env.ODDS_API_BASE_URL || 'https://api.the-odds-api.com/v4';
    this.apiKey = process.env.ODDS_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('[OddsApiClient] ODDS_API_KEY not configured');
    }
  }

  async getNbaGames(from?: Date, to?: Date): Promise<{ games: Game[]; creditsUsed: number; creditsRemaining: number }> {
    if (!this.apiKey) {
      throw new Error('ODDS_API_KEY not configured');
    }

    const eventParams = new URLSearchParams({ apiKey: this.apiKey, dateFormat: 'iso' });
    if (from) eventParams.set('commenceTimeFrom', formatOddsApiTime(from));
    if (to) eventParams.set('commenceTimeTo', formatOddsApiTime(to));

    const eventsResponse = await fetch(`${this.baseUrl}/sports/basketball_nba/events?${eventParams}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 0 },
    });
    if (!eventsResponse.ok) {
      throw new Error(`Odds API events error: ${eventsResponse.status} - ${await eventsResponse.text()}`);
    }
    const events = z.array(OddsApiEvent).parse(await eventsResponse.json());

    const params = new URLSearchParams({
      apiKey: this.apiKey,
      regions: 'us,eu',
      markets: 'h2h,spreads,totals',
      oddsFormat: 'decimal',
      dateFormat: 'iso',
    });
    if (from) params.set('commenceTimeFrom', formatOddsApiTime(from));
    if (to) params.set('commenceTimeTo', formatOddsApiTime(to));

    const url = `${this.baseUrl}/sports/basketball_nba/odds?${params}`;
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    });

    this.creditsUsed = parseInt(response.headers.get('x-requests-last') || '0', 10);
    this.creditsRemaining = parseInt(response.headers.get('x-requests-remaining') || '0', 10);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Odds API error: ${response.status} - ${error}`);
    }

    const oddsEvents = z.array(OddsApiResponse).parse(await response.json());
    const oddsByEvent = new Map(oddsEvents.map(event => [event.id, event]));
    const games = events.map(event => this.transformGame({ ...event, bookmakers: oddsByEvent.get(event.id)?.bookmakers || [] }));
    
    return { games, creditsUsed: this.creditsUsed, creditsRemaining: this.creditsRemaining };
  }

  async getNbaSchedule(from: Date, to: Date): Promise<Game[]> {
    if (!this.apiKey) throw new Error('ODDS_API_KEY not configured');

    // Round the start down to the hour so the five-minute response cache can be reused.
    const cachedFrom = new Date(from);
    cachedFrom.setUTCMinutes(0, 0, 0);
    const eventParams = new URLSearchParams({
      apiKey: this.apiKey,
      dateFormat: 'iso',
      commenceTimeFrom: formatOddsApiTime(cachedFrom),
      commenceTimeTo: formatOddsApiTime(to),
    });
    const response = await fetch(`${this.baseUrl}/sports/basketball_nba/events?${eventParams}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });
    if (!response.ok) {
      throw new Error(`Odds API schedule error: ${response.status} - ${await response.text()}`);
    }

    const events = z.array(OddsApiEvent).parse(await response.json());
    return events
      .filter(event => {
        const commence = Date.parse(event.commence_time);
        return commence >= from.getTime() && commence <= to.getTime();
      })
      .map(event => this.transformGame({ ...event, bookmakers: [] } as OddsApiGame));
  }

  private transformGame(apiGame: OddsApiGame): Game {
    const homeTeamInfo = NBA_TEAMS[apiGame.home_team] || { name: apiGame.home_team, abbr: apiGame.home_team.slice(0,3).toUpperCase() };
    const awayTeamInfo = NBA_TEAMS[apiGame.away_team] || { name: apiGame.away_team, abbr: apiGame.away_team.slice(0,3).toUpperCase() };

    const homeTeam: Team = {
      id: `nba-${homeTeamInfo.abbr.toLowerCase()}`,
      name: homeTeamInfo.name,
      abbreviation: homeTeamInfo.abbr,
      league: 'NBA',
    };

    const awayTeam: Team = {
      id: `nba-${awayTeamInfo.abbr.toLowerCase()}`,
      name: awayTeamInfo.name,
      abbreviation: awayTeamInfo.abbr,
      league: 'NBA',
    };

    const buckets = new Map<string, {
      market: MarketType;
      line?: number;
      selections: Record<SelectionType, Odd[]>;
      probabilitySums: Partial<Record<SelectionType, number>>;
      probabilityCounts: Partial<Record<SelectionType, number>>;
    }>();
    const collectedAt = new Date().toISOString();

    for (const bookmaker of apiGame.bookmakers) {
      for (const market of bookmaker.markets) {
        const marketType = this.mapMarketKey(market.key);
        if (!marketType) continue;

        const bookmakerOdds: Record<string, number> = {};
        for (const outcome of market.outcomes) {
          const selection = this.mapSelection(marketType, outcome.name, apiGame.home_team, apiGame.away_team);
          if (!selection) continue;

          bookmakerOdds[selection] = outcome.price;
          const point = outcome.point;
          const canonicalLine = marketType === 'spreads' && selection === 'away_spread' && point != null
            ? -point
            : point;
          const line = marketType === 'spreads' ? canonicalLine : point;
          const key = `${marketType}:${line ?? 'main'}`;
          let bucket = buckets.get(key);
          if (!bucket) {
            bucket = {
              market: marketType,
              line,
              selections: { home: [], away: [], over: [], under: [], home_spread: [], away_spread: [] },
              probabilitySums: {},
              probabilityCounts: {},
            };
            buckets.set(key, bucket);
          }

          const odd: Odd = {
            bookmaker: bookmaker.title,
            bookmaker_key: bookmaker.key,
            market: marketType,
            selection,
            line: point ?? line,
            odds: outcome.price,
            collected_at: collectedAt,
            freshness: 'current',
          };
          bucket.selections[selection].push(odd);
        }

        const bookmakerFairProbabilities = Object.keys(bookmakerOdds).length >= 2
          ? marginFreeProbabilities(bookmakerOdds)
          : {};
        for (const [selection, probability] of Object.entries(bookmakerFairProbabilities)) {
          const outcome = market.outcomes.find(item => this.mapSelection(marketType, item.name, apiGame.home_team, apiGame.away_team) === selection);
          if (!outcome) continue;
          const canonicalLine = marketType === 'spreads' && selection === 'away_spread' && outcome.point != null
            ? -outcome.point
            : outcome.point;
          const key = `${marketType}:${(marketType === 'spreads' ? canonicalLine : outcome.point) ?? 'main'}`;
          const bucket = buckets.get(key);
          if (bucket) {
            const typedSelection = selection as SelectionType;
            bucket.probabilitySums[typedSelection] = (bucket.probabilitySums[typedSelection] || 0) + probability;
            bucket.probabilityCounts[typedSelection] = (bucket.probabilityCounts[typedSelection] || 0) + 1;
          }
        }
      }
    }

    const markets: MarketOdds[] = Array.from(buckets.values()).map(bucket => {
      const bestOdds: Partial<Record<SelectionType, Odd>> = {};
      const fairProbabilities: Partial<Record<SelectionType, number>> = {};
      for (const [selection, selectionOdds] of Object.entries(bucket.selections) as [SelectionType, Odd[]][]) {
        if (selectionOdds.length) {
          bestOdds[selection] = selectionOdds.reduce((best, current) => current.odds > best.odds ? current : best);
        }
        const sum = bucket.probabilitySums[selection];
        const count = bucket.probabilityCounts[selection];
        if (sum !== undefined && count) fairProbabilities[selection] = sum / count;
      }
      return {
        market: bucket.market,
        line: bucket.line,
        selections: bucket.selections,
        best_odds: bestOdds as Record<SelectionType, Odd>,
        fair_probabilities: fairProbabilities,
      };
    });

    const commenceTime = new Date(apiGame.commence_time);
    const status: GameStatus = commenceTime < new Date() ? 'live' : 'scheduled';

    return {
      id: `nba-${apiGame.id}`,
      league: 'NBA',
      home_team: homeTeam,
      away_team: awayTeam,
      commence_time: apiGame.commence_time,
      status,
      markets,
      updated_at: collectedAt,
    };
  }

  private mapMarketKey(key: string): MarketType | null {
    switch (key) {
      case 'h2h': return 'h2h';
      case 'spreads': return 'spreads';
      case 'totals': return 'totals';
      default: return null;
    }
  }

  private mapSelection(market: MarketType, name: string, homeTeam: string, awayTeam: string): SelectionType | null {
    switch (market) {
      case 'h2h':
        return name === homeTeam ? 'home' : name === awayTeam ? 'away' : null;
      case 'spreads':
        return name === homeTeam ? 'home_spread' : name === awayTeam ? 'away_spread' : null;
      case 'totals':
        return name.toLowerCase() === 'over' ? 'over' : name.toLowerCase() === 'under' ? 'under' : null;
      default:
        return null;
    }
  }

  getCreditsInfo() {
    return { used: this.creditsUsed, remaining: this.creditsRemaining };
  }
}

export const oddsApiClient = new OddsApiClient();
