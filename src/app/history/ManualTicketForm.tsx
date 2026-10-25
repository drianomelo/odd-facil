'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { PlayerPropMarket } from '@/lib/analysis/player-props';

type GameOption = {
  eventId: string;
  gameDate: string;
  label: string;
  homeTeam: string;
  awayTeam: string;
  isUpcoming?: boolean;
  players: Array<{ id: string; name: string; team: string; played: boolean }>;
};
type OptionsResponse = { season: string; games: GameOption[] };
type LegDraft = { eventId: string; player: string; playerTeam: string; market: PlayerPropMarket; line: string; side: 'Over' | 'Under'; americanOdds: string };

const MARKETS: Array<{ id: PlayerPropMarket; label: string }> = [
  { id: 'player_points', label: 'Pontos' },
  { id: 'player_rebounds', label: 'Rebotes' },
  { id: 'player_assists', label: 'Assistências' },
  { id: 'player_threes', label: 'Cestas de 3' },
];

function emptyLeg(eventId = ''): LegDraft {
  return { eventId, player: '', playerTeam: '', market: 'player_points', line: '', side: 'Over', americanOdds: '' };
}

export function ManualTicketForm({ onSaved }: { onSaved: () => void }) {
  const [options, setOptions] = useState<OptionsResponse | null>(null);
  const [legs, setLegs] = useState<LegDraft[]>([emptyLeg()]);
  const [label, setLabel] = useState('Bilhete externo');
  const [bookmaker, setBookmaker] = useState('');
  const [stake, setStake] = useState('');
  const [combinedOdds, setCombinedOdds] = useState('');
  const [potentialReturn, setPotentialReturn] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/analysis/nba/ticket-input-options', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || 'Não foi possível carregar os jogos.');
        if (active) {
          const loaded = body as OptionsResponse;
          setOptions(loaded);
          const firstGame = loaded.games.find(game => game.isUpcoming) || loaded.games[0];
          if (firstGame) setLegs([emptyLeg(firstGame.eventId)]);
        }
      })
      .catch(loadError => { if (active) setError(loadError instanceof Error ? loadError.message : 'Falha ao carregar jogos.'); })
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, []);

  const combinedLegs = useMemo(() => legs.map(leg => ({
    ...leg,
    game: options?.games.find(game => game.eventId === leg.eventId),
  })), [legs, options]);

  function updateLeg(index: number, patch: Partial<LegDraft>) {
    setLegs(current => current.map((leg, currentIndex) => currentIndex === index
      ? { ...leg, ...patch, ...(patch.eventId !== undefined ? { player: '', playerTeam: '' } : {}) }
      : leg));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    if (!combinedLegs.every(item => item.game && item.player && item.playerTeam && item.line !== '' && Number(item.line) >= 0)) {
      setError('Escolha o jogo, informe jogador e equipe e preencha uma linha válida para cada seleção.');
      return;
    }
    setSaving(true);
    try {
      const response = await fetch('/api/analysis/nba/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual',
          kind: 'custom',
          label: label.trim() || 'Bilhete externo',
          bookmaker: bookmaker.trim() || 'Não informada',
          stakeAmount: stake === '' ? 0 : Number(stake),
          ...(combinedOdds === '' ? {} : { combinedDecimalOdds: Number(combinedOdds) }),
          ...(potentialReturn === '' ? {} : { potentialReturn: Number(potentialReturn) }),
          legs: combinedLegs.map(item => ({
            eventId: item.eventId,
            player: item.player,
            playerTeam: item.playerTeam,
            market: item.market,
            line: Number(item.line),
            side: item.side,
            ...(item.americanOdds === '' ? {} : { americanOdds: Number(item.americanOdds) }),
          })),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Não foi possível salvar o bilhete.');
      setSuccess(body.message || 'Bilhete registrado.');
      const firstGame = options?.games.find(game => game.isUpcoming) || options?.games[0];
      setLegs([emptyLeg(firstGame?.eventId || '')]);
      setLabel('Bilhete externo');
      setBookmaker('');
      setStake('');
      setCombinedOdds('');
      setPotentialReturn('');
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Falha ao salvar bilhete.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="rounded-xl border border-[#58A9E3]/60 bg-[#F3F9FD] p-4 sm:p-5">
      <summary className="cursor-pointer list-none font-semibold text-[#005A9C] marker:hidden">
        Registrar bilhete feito por fora
        <span className="ml-2 text-xs font-normal text-slate-600">Registre antes do jogo; as seleções ficam pendentes até a apuração.</span>
      </summary>
      <form onSubmit={event => void submit(event)} className="mt-4 space-y-4">
        {loadingOptions ? <p className="text-sm text-court-textMuted">Carregando jogos e jogadores…</p> : !options?.games.length ? (
          <p className="rounded-lg border border-court-border bg-white p-3 text-sm text-court-textMuted">Não há jogos disponíveis na agenda para registrar.</p>
        ) : <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-court-textMuted">Nome do bilhete
              <input value={label} onChange={event => setLabel(event.target.value)} maxLength={100} className="input mt-1 py-2 text-sm" placeholder="Ex.: Rodada 20/10" />
            </label>
            <label className="text-xs text-court-textMuted">Casa de aposta · opcional
              <input value={bookmaker} onChange={event => setBookmaker(event.target.value)} maxLength={100} className="input mt-1 py-2 text-sm" placeholder="Ex.: Betano" />
            </label>
            <label className="text-xs text-court-textMuted">Valor apostado (R$) · opcional
              <input type="number" min="0" step="0.01" value={stake} onChange={event => setStake(event.target.value)} className="input mt-1 py-2 text-sm" placeholder="Ex.: 10,00" />
            </label>
            <label className="text-xs text-court-textMuted">Odd combinada decimal · opcional
              <input type="number" min="0.01" step="0.01" value={combinedOdds} onChange={event => setCombinedOdds(event.target.value)} className="input mt-1 py-2 text-sm" placeholder="Ex.: 4,50" />
            </label>
            <label className="text-xs text-court-textMuted sm:col-span-2">Retorno potencial (R$) · opcional
              <input type="number" min="0" step="0.01" value={potentialReturn} onChange={event => setPotentialReturn(event.target.value)} className="input mt-1 py-2 text-sm" placeholder="Ex.: 45,00" />
            </label>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-sm font-semibold text-court-text">Seleções do bilhete</h4>
              <button type="button" onClick={() => setLegs(current => [...current, emptyLeg(options.games.find(game => game.isUpcoming)?.eventId || options.games[0]?.eventId || '')])} className="btn-secondary px-3 py-2 text-xs"><Plus className="mr-1 inline h-4 w-4" /> Adicionar seleção</button>
            </div>
            {combinedLegs.map((item, index) => {
              const players = item.game?.players || [];
              return (
                <fieldset key={index} className="grid gap-3 rounded-lg border border-court-border bg-white p-3 sm:grid-cols-2 lg:grid-cols-3">
                  <legend className="sr-only">Seleção {index + 1}</legend>
                  <label className="text-xs text-court-textMuted">Jogo
                    <select required value={item.eventId} onChange={event => updateLeg(index, { eventId: event.target.value })} className="input mt-1 py-2 text-sm">
                      <option value="">Escolha um jogo</option>
                      {options.games.map(game => <option key={game.eventId} value={game.eventId}>{game.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-court-textMuted">Jogador
                    <input required list={`players-${index}`} value={item.player} onChange={event => {
                      const player = players.find(candidate => candidate.name === event.target.value);
                      updateLeg(index, { player: event.target.value, ...(player ? { playerTeam: player.team } : {}) });
                    }} className="input mt-1 py-2 text-sm" placeholder="Digite ou escolha um jogador" />
                    <datalist id={`players-${index}`}>
                      {players.map(player => <option key={`${player.id}-${player.team}`} value={player.name}>{player.team}</option>)}
                    </datalist>
                  </label>
                  <label className="text-xs text-court-textMuted">Equipe do jogador
                    <select required value={item.playerTeam} onChange={event => updateLeg(index, { playerTeam: event.target.value })} className="input mt-1 py-2 text-sm">
                      <option value="">Escolha a equipe</option>
                      {[item.game?.homeTeam, item.game?.awayTeam].filter((team): team is string => Boolean(team)).map(team => <option key={team} value={team}>{team}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-court-textMuted">Categoria
                    <select value={item.market} onChange={event => updateLeg(index, { market: event.target.value as PlayerPropMarket })} className="input mt-1 py-2 text-sm">
                      {MARKETS.map(market => <option key={market.id} value={market.id}>{market.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-court-textMuted">Linha
                    <input required type="number" min="0" step="0.5" value={item.line} onChange={event => updateLeg(index, { line: event.target.value })} className="input mt-1 py-2 text-sm" placeholder="Ex.: 24,5" />
                  </label>
                  <label className="text-xs text-court-textMuted">Palpite
                    <select value={item.side} onChange={event => updateLeg(index, { side: event.target.value as LegDraft['side'] })} className="input mt-1 py-2 text-sm"><option value="Over">Mais de</option><option value="Under">Menos de</option></select>
                  </label>
                  <div className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 text-xs text-court-textMuted">Odd americana · opcional
                      <input type="number" step="1" value={item.americanOdds} onChange={event => updateLeg(index, { americanOdds: event.target.value })} className="input mt-1 py-2 text-sm" placeholder="Ex.: -110" />
                    </label>
                    {legs.length > 1 && <button type="button" aria-label={`Remover seleção ${index + 1}`} onClick={() => setLegs(current => current.filter((_, currentIndex) => currentIndex !== index))} className="mb-1 rounded-lg p-2 text-court-danger hover:bg-court-danger/10"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </fieldset>
              );
            })}
          </div>
          {error && <p role="alert" className="text-sm text-court-danger">{error}</p>}
          {success && <p role="status" className="text-sm text-court-success">{success}</p>}
          <button type="submit" disabled={saving} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-50"><Save className="mr-2 inline h-4 w-4" />{saving ? 'Salvando…' : 'Registrar bilhete'}</button>
        </>}
      </form>
    </details>
  );
}
