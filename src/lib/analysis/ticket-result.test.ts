import { describe, expect, it } from 'vitest';
import { getTicketOutcome } from './ticket-result';

describe('getTicketOutcome', () => {
  it('marks a multiple lost as soon as any leg loses', () => {
    expect(getTicketOutcome(['won', null, 'lost'])).toBe('lost');
  });

  it('waits while any leg remains pending', () => {
    expect(getTicketOutcome(['won', null])).toBe('pending');
  });

  it('marks the ticket won only when all legs win', () => {
    expect(getTicketOutcome(['won', 'won'])).toBe('won');
  });

  it('flags resolved pushes or voids for sportsbook rule review', () => {
    expect(getTicketOutcome(['won', 'push'])).toBe('push/void');
    expect(getTicketOutcome(['void', 'void'])).toBe('push/void');
  });
});
