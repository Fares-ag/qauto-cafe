/**
 * Idempotency keys are unique per payment row. For split tender, only the first
 * payment carries the client idempotency key so replays are detected without
 * violating the unique constraint on subsequent rows.
 */
export function paymentIdempotencyKey(
  clientKey: string | undefined,
  paymentIndex: number,
): string | undefined {
  if (!clientKey || paymentIndex > 0) {
    return undefined;
  }
  return clientKey;
}
