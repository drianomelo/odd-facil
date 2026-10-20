'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { TeamDetail } from '../TeamDetail';

export const dynamic = 'force-dynamic';

export default function TeamPage({ params }: { params: { team: string } }) {
  const [data, setData] = useState<{ team: { name: string; predictions: any; personalTickets: any }; players: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { fetch(`/api/analysis/nba/teams?team=${encodeURIComponent(params.team)}`, { cache: 'no-store' }).then(async response => { if (!response.ok) throw new Error('Time não encontrado'); return response.json(); }).then(setData).catch(() => setData(null)).finally(() => setLoading(false)); }, [params.team]);
  return <main className="min-h-screen"><div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><Link href="/times" className="text-sm text-court-accent underline">← Todos os times</Link>{loading ? <p className="rounded-xl border border-court-border p-5 text-sm text-court-textMuted">Carregando análise do time…</p> : data ? <TeamDetail team={data.team} players={data.players} /> : <p className="rounded-xl border border-court-border p-5 text-sm text-court-textMuted">Não foi possível carregar este time.</p>}</div></main>;
}
