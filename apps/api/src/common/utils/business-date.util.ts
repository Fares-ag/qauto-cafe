/**
 * Resolves cafe business date from a timestamp and branch cutover hour (default 4am).
 */
export function resolveBusinessDate(from: Date, cutoverHour = 4): Date {
  const business = new Date(from);
  if (from.getHours() < cutoverHour) {
    business.setDate(business.getDate() - 1);
  }
  business.setHours(0, 0, 0, 0);
  return business;
}

export function parseBusinessDateString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function businessDateRange(businessDate: Date): { start: Date; end: Date } {
  const start = new Date(businessDate);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export function getHourBucket(from: Date, cutoverHour = 4): number {
  const adjusted = new Date(from);
  if (from.getHours() < cutoverHour) {
    adjusted.setDate(adjusted.getDate() - 1);
  }
  return adjusted.getHours();
}
