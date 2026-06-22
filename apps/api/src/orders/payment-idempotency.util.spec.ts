import { paymentIdempotencyKey } from './payment-idempotency.util';

describe('paymentIdempotencyKey', () => {
  it('returns the client key only for the first payment in split tender', () => {
    expect(paymentIdempotencyKey('idem-123', 0)).toBe('idem-123');
    expect(paymentIdempotencyKey('idem-123', 1)).toBeUndefined();
    expect(paymentIdempotencyKey('idem-123', 2)).toBeUndefined();
  });

  it('returns undefined when no client key is provided', () => {
    expect(paymentIdempotencyKey(undefined, 0)).toBeUndefined();
  });
});
