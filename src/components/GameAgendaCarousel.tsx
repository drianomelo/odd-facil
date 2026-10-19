'use client';

import { Game } from '@/types';
import { GameCard } from '@/components/GameCard';

export function GameAgendaCarousel({ games, message }: { games: Game[]; message?: string }) {
  const canLoop = games.length > 1;

  return (
    <section aria-label="Agenda NBA" className="space-y-4">
      {games.length === 0 ? (
        <div className="card border-[#58A9E3]/50 bg-[#F4FAFE] py-8 text-center">
          <p className="text-slate-600">{message || 'Nenhum jogo encontrado nesta janela.'}</p>
        </div>
      ) : (
        <div className="game-marquee-viewport relative left-1/2 w-screen -translate-x-1/2 overflow-hidden" aria-label="Carrossel infinito da agenda NBA">
          <div
            className={`game-marquee-track flex w-max ${canLoop ? 'is-looping' : ''}`}
            style={canLoop ? { animationDuration: `${Math.max(30, games.length * 8)}s` } : undefined}
          >
            <div className="flex shrink-0 gap-4 pr-4">
              {games.map(game => (
                <div className="w-[min(88vw,32rem)] shrink-0" key={game.id}>
                  <GameCard game={game} />
                </div>
              ))}
            </div>
            {canLoop && (
              <div className="flex shrink-0 gap-4 pr-4" aria-hidden="true">
                {games.map(game => (
                  <div className="w-[min(88vw,32rem)] shrink-0" key={`copy-${game.id}`}>
                    <GameCard game={game} />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-white via-white/90 to-transparent sm:w-20 lg:w-32" />
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-white via-white/90 to-transparent sm:w-20 lg:w-32" />
        </div>
      )}
    </section>
  );
}
