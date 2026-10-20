'use client';

import { useState } from 'react';

type Counts = { total: number; settled: number; wins: number; losses: number; pushes: number; voids: number; pending: number; hitRate: number | null };
type Player = { player: string; predictions: Counts; personalTickets: Counts };

function OutcomeChart({ counts, label }: { counts: Counts; label: string }) {
  const items = [{ name: 'Acertos', value: counts.wins, color: 'bg-court-success' }, { name: 'Erros', value: counts.losses, color: 'bg-court-danger' }, { name: 'Push/anuladas', value: counts.pushes + counts.voids, color: 'bg-court-accent' }, { name: 'Pendentes', value: counts.pending, color: 'bg-court-border' }];
  const total = counts.total || 1;
  return <section className="rounded-xl border border-court-border p-4"><div className="flex justify-between gap-2"><h3 className="font-semibold text-court-text">{label}</h3><span className="text-xs text-court-textMuted">{counts.total} registros</span></div><div className="mt-4 flex h-4 overflow-hidden rounded-full bg-court-border" aria-label={`${label}: ${counts.wins} acertos, ${counts.losses} erros`}>{items.filter(item => item.value > 0).map(item => <div key={item.name} className={item.color} style={{ width: `${item.value / total * 100}%` }} />)}</div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-court-textMuted">{items.map(item => <span key={item.name}>{item.name}: {item.value}</span>)}</div><p className="mt-3 text-sm text-court-text">Aproveitamento: <strong>{counts.hitRate === null ? '—' : `${(counts.hitRate * 100).toFixed(1)}%`}</strong></p></section>;
}

export function TeamDetail({ team, players }: { team: { name: string; predictions: Counts; personalTickets: Counts }; players: Player[] }) {
  const [modelPlayer, setModelPlayer] = useState('all');
  const [ticketPlayer, setTicketPlayer] = useState('all');
  const modelCounts = modelPlayer === 'all' ? team.predictions : players.find(item => item.player === modelPlayer)?.predictions || team.predictions;
  const ticketCounts = ticketPlayer === 'all' ? team.personalTickets : players.find(item => item.player === ticketPlayer)?.personalTickets || team.personalTickets;
  return <><div><h1 className="text-3xl font-bold text-court-text">{team.name}</h1><p className="mt-2 text-sm text-court-textMuted">Resultados da temporada regular, separados por origem e filtráveis por jogador.</p></div><div className="grid gap-6 lg:grid-cols-2"><div className="space-y-3"><label className="block text-xs text-court-textMuted">Palpites do modelo · jogador<select className="input mt-1 py-2 text-sm" value={modelPlayer} onChange={event => setModelPlayer(event.target.value)}><option value="all">Todos os jogadores</option>{players.filter(item => item.predictions.total).map(item => <option key={item.player} value={item.player}>{item.player}</option>)}</select></label><OutcomeChart counts={modelCounts} label="Palpites do modelo" /></div><div className="space-y-3"><label className="block text-xs text-court-textMuted">Bilhetes pessoais · jogador<select className="input mt-1 py-2 text-sm" value={ticketPlayer} onChange={event => setTicketPlayer(event.target.value)}><option value="all">Todos os jogadores</option>{players.filter(item => item.personalTickets.total).map(item => <option key={item.player} value={item.player}>{item.player}</option>)}</select></label><OutcomeChart counts={ticketCounts} label="Meus bilhetes pessoais" /></div></div></>;
}
