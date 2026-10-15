export type TicketOutcome = 'pending' | 'won' | 'lost' | 'push/void';

/** A multiple loses as soon as one leg loses and wins only when every leg wins. */
export function getTicketOutcome(results: Array<string | null>): TicketOutcome {
  if (results.includes('lost')) return 'lost';
  if (results.includes(null)) return 'pending';
  if (results.length > 0 && results.every(result => result === 'won')) return 'won';
  return 'push/void';
}
