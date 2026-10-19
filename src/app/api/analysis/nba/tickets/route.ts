import { NextRequest, NextResponse } from 'next/server';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/lib/db';
import { playerPropForecasts, playerPropTicketLegs, playerPropTickets } from '@/lib/db/schema';
import { PLAYER_PROP_MODEL_VERSION } from '@/lib/analysis/player-prop-storage';
import { getTicketOutcome } from '@/lib/analysis/ticket-result';

export const dynamic = 'force-dynamic';

const MARKET_VALUES = ['player_points', 'player_rebounds', 'player_assists', 'player_threes', 'player_points_rebounds_assists'] as const;
const legSchema = z.object({
  eventId: z.string().min(1).max(100),
  player: z.string().min(1).max(100),
  market: z.enum(MARKET_VALUES),
  line: z.number().finite(),
  side: z.enum(['Over', 'Under']),
  bookmaker: z.string().min(1).max(100),
  bookmakerKey: z.string().max(100).optional(),
});
const bodySchema = z.object({
  kind: z.enum(['single', 'double', 'exaggerated', 'custom']),
  label: z.string().min(1).max(100),
  bookmaker: z.string().min(1).max(100),
  stakeAmount: z.number().finite().positive().max(1000000),
  potentialReturn: z.number().finite().min(0).max(1000000000).optional(),
  legs: z.array(legSchema).min(1).max(10),
});

function normalizedBook(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

const stakeUpdateSchema = z.object({
  id: z.string().uuid(),
  stakeAmount: z.number().finite().positive().max(1000000).optional(),
  combinedDecimalOdds: z.number().finite().positive().max(100000).nullable().optional(),
  potentialReturn: z.number().finite().min(0).max(1000000000).nullable().optional(),
  actualReturn: z.number().finite().min(0).max(1000000000).nullable().optional(),
  manualOutcome: z.enum(['won', 'lost', 'push/void']).nullable().optional(),
}).refine(data => Object.keys(data).some(key => key !== 'id'), 'Informe ao menos um campo para atualizar.');

const deleteSchema = z.object({ id: z.string().uuid() });

function getDetails(value: unknown): Record<string, unknown> {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}

export async function POST(request: NextRequest) {
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Dados do bilhete inválidos.' }, { status: 400 });
    const input = parsed.data;
    const expectedLegs = input.kind === 'single' ? 1 : input.kind === 'double' ? 2 : input.kind === 'exaggerated' ? 6 : null;
    if (expectedLegs !== null && input.legs.length !== expectedLegs) return NextResponse.json({ error: `Este bilhete precisa ter ${expectedLegs} seleção(ões).` }, { status: 400 });
    if (input.kind !== 'custom' && new Set(input.legs.map(leg => leg.player.toLowerCase())).size !== input.legs.length) {
      return NextResponse.json({ error: 'Cada bilhete precisa ter jogadores diferentes.' }, { status: 400 });
    }
    const forecasts = await db.select().from(playerPropForecasts).where(and(
      eq(playerPropForecasts.model_version, PLAYER_PROP_MODEL_VERSION),
      inArray(playerPropForecasts.event_id, Array.from(new Set(input.legs.map(leg => leg.eventId)))),
    ));
    const matched = input.legs.map(leg => {
      const forecast = forecasts.find(row => row.event_id === leg.eventId
        && row.player_name.toLowerCase() === leg.player.toLowerCase()
        && row.market === leg.market
        && Number(row.line) === leg.line);
      if (!forecast || forecast.result || forecast.commence_time.getTime() <= Date.now()) return null;
      if (forecast.selection !== leg.side) return null;
      const quotes = getDetails(forecast.details).quotes;
      if (!Array.isArray(quotes)) return null;
      const quote = quotes.find((item): item is Record<string, unknown> => !!item && typeof item === 'object'
        && item.side === leg.side
        && (leg.bookmakerKey
          ? item.bookmakerKey === leg.bookmakerKey
          : normalizedBook(String(item.bookmaker || '')) === normalizedBook(leg.bookmaker))
        && Number.isFinite(Number(item.price)));
      if (!quote) return null;
      return { leg, forecast, quote };
    });
    if (matched.some(item => item === null)) {
      return NextResponse.json({ error: 'Uma cotação não está mais disponível ou a previsão não pode ser acompanhada. Atualize a análise e tente novamente.' }, { status: 409 });
    }

    const complete = matched as NonNullable<(typeof matched)[number]>[];
    const combinedDecimalOdds = complete.reduce((total, { quote }) => {
      const price = Number(quote.price);
      return total * (price > 0 ? 1 + price / 100 : 1 + 100 / -price);
    }, 1);
    const combinedAmericanOdds = complete.length === 1
      ? Number(complete[0].quote.price)
      : combinedDecimalOdds >= 2
        ? Math.round((combinedDecimalOdds - 1) * 100)
        : -Math.round(100 / (combinedDecimalOdds - 1));
    const availableBooks = new Map(complete.map(({ quote }) => [
      normalizedBook(String(quote.bookmakerKey || quote.bookmaker || '')),
      String(quote.bookmaker || 'Casa não identificada'),
    ]));
    const bookmakerSummary = availableBooks.size === 1
      ? Array.from(availableBooks.values())[0]
      : 'Casas variadas';
    const created = await db.transaction(async (tx) => {
      const [ticket] = await tx.insert(playerPropTickets).values({
        kind: input.kind,
        label: input.label,
        bookmaker: bookmakerSummary,
        combined_decimal_odds: combinedDecimalOdds?.toFixed(4) ?? null,
        combined_american_odds: combinedAmericanOdds,
        stake_amount: input.stakeAmount.toFixed(2),
        potential_return: input.potentialReturn !== undefined
          ? input.potentialReturn.toFixed(2)
          : (input.stakeAmount * combinedDecimalOdds).toFixed(2),
      }).returning({ id: playerPropTickets.id, createdAt: playerPropTickets.created_at });
      await tx.insert(playerPropTicketLegs).values(complete.map(({ leg, forecast, quote }, index) => ({
        ticket_id: ticket.id,
        forecast_id: forecast.id,
        position: index + 1,
        event_id: forecast.event_id,
        player_name: forecast.player_name,
        market: forecast.market,
        line: String(forecast.line),
        selection: leg.side,
        american_odds: Number(quote.price),
        bookmaker: String(quote.bookmaker || leg.bookmaker),
        bookmaker_key: quote.bookmakerKey ? String(quote.bookmakerKey) : leg.bookmakerKey || null,
      })));
      return ticket;
    });
    return NextResponse.json({ id: created.id, createdAt: created.createdAt, message: 'Bilhete salvo para acompanhar no Histórico.' }, { status: 201 });
  } catch (error) {
    console.error('[API/analysis/nba/tickets] Save failed:', error);
    return NextResponse.json({ error: 'Não foi possível salvar o bilhete.' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const tickets = await db.select().from(playerPropTickets)
      .orderBy(desc(playerPropTickets.created_at));
    if (!tickets.length) return NextResponse.json({ tickets: [] });
    const legs = await db.select({
      ticketId: playerPropTicketLegs.ticket_id,
      position: playerPropTicketLegs.position,
      eventId: playerPropTicketLegs.event_id,
      player: playerPropTicketLegs.player_name,
      market: playerPropTicketLegs.market,
      line: playerPropTicketLegs.line,
      selection: playerPropTicketLegs.selection,
      americanOdds: playerPropTicketLegs.american_odds,
      bookmaker: playerPropTicketLegs.bookmaker,
      commenceTime: playerPropForecasts.commence_time,
      result: playerPropForecasts.result,
      actualValue: playerPropForecasts.actual_value,
    }).from(playerPropTicketLegs)
      .leftJoin(playerPropForecasts, eq(playerPropTicketLegs.forecast_id, playerPropForecasts.id))
      .where(inArray(playerPropTicketLegs.ticket_id, tickets.map(ticket => ticket.id)))
      .orderBy(asc(playerPropTicketLegs.position));
    const byTicket = new Map<string, typeof legs>();
    for (const leg of legs) byTicket.set(leg.ticketId, [...(byTicket.get(leg.ticketId) || []), leg]);
    return NextResponse.json({ tickets: tickets.map(ticket => {
      const ticketLegs = byTicket.get(ticket.id) || [];
      const outcome = ticket.manual_outcome || getTicketOutcome(ticketLegs.map(leg => leg.result));
      return {
        id: ticket.id,
        kind: ticket.kind,
        label: ticket.label,
        bookmaker: ticket.bookmaker,
        combinedDecimalOdds: ticket.combined_decimal_odds === null ? null : Number(ticket.combined_decimal_odds),
        combinedAmericanOdds: ticket.combined_american_odds,
        stakeAmount: Number(ticket.stake_amount),
        potentialReturn: ticket.potential_return === null ? null : Number(ticket.potential_return),
        actualReturn: ticket.actual_return === null ? null : Number(ticket.actual_return),
        manualOutcome: ticket.manual_outcome,
        outcomeSource: ticket.manual_outcome ? 'manual' : 'forecast',
        createdAt: ticket.created_at,
        outcome,
        legs: ticketLegs.map(leg => ({ ...leg, line: Number(leg.line), actualValue: leg.actualValue === null ? null : Number(leg.actualValue), result: leg.result || 'pending' })),
      };
    }) });
  } catch (error) {
    console.error('[API/analysis/nba/tickets] Load failed:', error);
    return NextResponse.json({ error: 'Não foi possível carregar os bilhetes salvos.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = stakeUpdateSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Os campos do bilhete são inválidos.' }, { status: 400 });
    const values = parsed.data;
    const update: Partial<typeof playerPropTickets.$inferInsert> = {};
    if (values.stakeAmount !== undefined) update.stake_amount = values.stakeAmount.toFixed(2);
    if (values.combinedDecimalOdds !== undefined) {
      update.combined_decimal_odds = values.combinedDecimalOdds?.toFixed(4) ?? null;
      update.combined_american_odds = values.combinedDecimalOdds === null ? null : values.combinedDecimalOdds >= 2
        ? Math.round((values.combinedDecimalOdds - 1) * 100)
        : -Math.round(100 / (values.combinedDecimalOdds - 1));
    }
    if (values.potentialReturn !== undefined) {
      const stake = values.stakeAmount ?? 0;
      const decimalOdds = values.combinedDecimalOdds;
      update.potential_return = values.potentialReturn !== null
        ? values.potentialReturn.toFixed(2)
        : decimalOdds !== undefined && decimalOdds !== null ? (stake * decimalOdds).toFixed(2) : null;
    }
    if (values.actualReturn !== undefined) update.actual_return = values.actualReturn?.toFixed(2) ?? null;
    if (values.manualOutcome !== undefined) update.manual_outcome = values.manualOutcome;
    const [ticket] = await db.update(playerPropTickets)
      .set(update)
      .where(eq(playerPropTickets.id, values.id))
      .returning({ id: playerPropTickets.id, stakeAmount: playerPropTickets.stake_amount, combinedDecimalOdds: playerPropTickets.combined_decimal_odds, potentialReturn: playerPropTickets.potential_return, actualReturn: playerPropTickets.actual_return, manualOutcome: playerPropTickets.manual_outcome });
    if (!ticket) return NextResponse.json({ error: 'Bilhete não encontrado.' }, { status: 404 });
    return NextResponse.json({ id: ticket.id, stakeAmount: Number(ticket.stakeAmount), combinedDecimalOdds: ticket.combinedDecimalOdds === null ? null : Number(ticket.combinedDecimalOdds), potentialReturn: ticket.potentialReturn === null ? null : Number(ticket.potentialReturn), actualReturn: ticket.actualReturn === null ? null : Number(ticket.actualReturn), manualOutcome: ticket.manualOutcome });
  } catch (error) {
    console.error('[API/analysis/nba/tickets] Stake update failed:', error);
    return NextResponse.json({ error: 'Não foi possível atualizar o valor apostado.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const parsed = deleteSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Bilhete inválido.' }, { status: 400 });
    const deleted = await db.delete(playerPropTickets).where(eq(playerPropTickets.id, parsed.data.id)).returning({ id: playerPropTickets.id });
    if (!deleted.length) return NextResponse.json({ error: 'Bilhete não encontrado.' }, { status: 404 });
    return NextResponse.json({ id: deleted[0].id, message: 'Bilhete excluído do Histórico.' });
  } catch (error) {
    console.error('[API/analysis/nba/tickets] Delete failed:', error);
    return NextResponse.json({ error: 'Não foi possível excluir o bilhete.' }, { status: 500 });
  }
}
