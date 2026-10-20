import Link from "next/link";
import { Game } from "@/types";
import { formatAppDateTime } from "@/lib/utils/date";
import { TeamLogo } from "@/components/TeamLogo";

export function GameTable({ games }: { games: Game[] }) {
  if (!games.length) return null;

  return (
    <section aria-labelledby="game-table-heading" className="mt-16">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="game-table-heading" className="text-2xl font-bold text-[#12334A] sm:text-3xl">Jogos disponíveis</h2>
          <p className="mt-1 text-sm text-slate-600">Abra uma partida para ver as melhores odds de jogadores.</p>
        </div>
        <span className="text-xs font-semibold text-slate-500">{games.length} {games.length === 1 ? "jogo" : "jogos"}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D5E6F2] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-left">
            <thead className="bg-[#EAF5FC] text-xs font-bold uppercase tracking-wide text-[#31566F]">
              <tr>
                <th scope="col" className="px-4 py-3 sm:px-5">Partida</th>
                <th scope="col" className="px-4 py-3 sm:px-5">Data e horário</th>
                <th scope="col" className="px-4 py-3 text-right sm:px-5">Props</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4EFF6]">
              {games.map((game) => {
                const localDate = formatAppDateTime(game.commence_time).split(" ")[0].split("/").reverse().join("-");
                return (
                  <tr key={game.id} className="transition-colors hover:bg-[#F7FBFE]">
                    <td className="px-4 py-3 sm:px-5">
                      <Link
                        href={`/jogos/${encodeURIComponent(game.id)}?date=${localDate}`}
                        aria-label={`Ver props de ${game.away_team.name} contra ${game.home_team.name}`}
                        className="flex min-w-0 items-center gap-2 font-semibold text-[#12334A] hover:text-[#005A9C] focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005A9C]"
                      >
                        <TeamLogo team={game.away_team.abbreviation} size="sm" />
                        <span className="truncate">{game.away_team.abbreviation}</span>
                        <span className="shrink-0 text-slate-400">@</span>
                        <TeamLogo team={game.home_team.abbreviation} size="sm" />
                        <span className="truncate">{game.home_team.abbreviation}</span>
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm tabular-nums text-slate-600 sm:px-5">{formatAppDateTime(game.commence_time)}</td>
                    <td className="px-4 py-3 text-right sm:px-5">
                      <Link href={`/jogos/${encodeURIComponent(game.id)}?date=${localDate}`} className="inline-flex rounded-full bg-[#EAF5FC] px-3 py-1.5 text-xs font-bold text-[#005A9C] transition-colors hover:bg-[#D9EDF9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#005A9C]">Ver props <span aria-hidden="true" className="ml-1">→</span></Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
