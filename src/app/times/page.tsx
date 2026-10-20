"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

export const dynamic = 'force-dynamic';

type TeamSummary = { name: string; slug: string; players: number; predictions: { total: number; settled: number; wins: number; losses: number; hitRate: number | null }; personalTickets: { total: number; settled: number; wins: number; losses: number; hitRate: number | null } };

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch('/api/analysis/nba/teams', { cache: 'no-store' }).then(response => response.json()).then(body => setTeams(body.teams || [])).catch(() => setTeams([])).finally(() => setLoading(false)); }, []);
  return <main className="min-h-screen"><div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
    <div><Link href="/performance" className="text-sm text-court-accent underline">← Desempenho</Link><h1 className="mt-3 text-3xl font-bold text-court-text">Desempenho por time</h1><p className="mt-2 text-sm text-court-textMuted">Acompanhe separadamente os palpites do modelo e seus bilhetes pessoais na temporada regular.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{teams.map(team => <Link key={team.slug} href={`/times/${team.slug}`} className="rounded-xl border border-court-border bg-court-card p-5 transition hover:border-court-accent">
      <h2 className="font-semibold text-court-text">{team.name}</h2><p className="mt-1 text-xs text-court-textMuted">{team.players} jogadores com dados</p>
      <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><p className="text-xs text-court-textMuted">Palpites</p><p className="mt-1 text-court-text">{team.predictions.settled} apurados · {team.predictions.hitRate === null ? '—' : `${(team.predictions.hitRate * 100).toFixed(1)}%`}</p></div><div><p className="text-xs text-court-textMuted">Bilhetes pessoais</p><p className="mt-1 text-court-text">{team.personalTickets.settled} apurados · {team.personalTickets.hitRate === null ? '—' : `${(team.personalTickets.hitRate * 100).toFixed(1)}%`}</p></div></div>
    </Link>)}</div>
    {loading && <p className="rounded-xl border border-court-border p-5 text-sm text-court-textMuted">Carregando times…</p>}{!loading && !teams.length && <p className="rounded-xl border border-court-border p-5 text-sm text-court-textMuted">Não foi possível carregar os times agora. Tente novamente em instantes.</p>}
  </div></main>;
}
