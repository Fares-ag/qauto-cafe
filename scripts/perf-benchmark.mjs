/**
 * Measure hot API paths — run: node scripts/perf-benchmark.mjs
 * Requires API on localhost:3001 with seeded admin user.
 */
const API = 'http://localhost:3001/api/v1';

async function timed(label, fn) {
  const start = performance.now();
  const result = await fn();
  const ms = Math.round(performance.now() - start);
  console.log(`${label.padEnd(32)} ${String(ms).padStart(5)} ms`);
  return { label, ms, result };
}

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body?.detail ?? body)}`);
  return body;
}

async function main() {
  const login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@qauto.com', password: 'admin123' }),
  });
  const token = login.accessToken;
  const branchId = login.branchId;
  const boot = await req('/public/bootstrap');
  const terminalId = boot.terminals.find((t) => t.type === 'POS')?.id;

  console.log('\nQAuto API performance benchmark\n');

  const results = [];

  results.push(
    await timed('Menu catalog (cold)', () =>
      req(`/menu/catalog?branchId=${branchId}`, { token }),
    ),
  );
  results.push(
    await timed('Menu catalog (cached)', () =>
      req(`/menu/catalog?branchId=${branchId}`, { token }),
    ),
  );
  results.push(
    await timed('Dashboard analytics', () =>
      req(
        `/reports/dashboard?branchId=${branchId}&businessDate=${new Date().toISOString().slice(0, 10)}&trendDays=7`,
        { token },
      ),
    ),
  );
  results.push(
    await timed('Order queue', () => req(`/orders/queue?branchId=${branchId}`, { token })),
  );
  results.push(
    await timed('Unpaid orders report', () =>
      req(`/reports/unpaid-orders?branchId=${branchId}`, { token }),
    ),
  );

  const order = await req('/orders', {
    method: 'POST',
    token,
    body: JSON.stringify({ branchId, terminalId, orderType: 'COUNTER' }),
  });

  const catalog = results[0].result;
  const item =
    catalog.categories.flatMap((c) => c.items).find((i) => i.type === 'SNACK') ??
    catalog.categories[0]?.items[0];

  results.push(
    await timed('Add order line (incremental)', () =>
      req(`/orders/${order.id}/lines`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          menuItemId: item.id,
          quantity: 1,
          modifierIds: [],
          ...(item.sizes?.[0] ? { sizeId: item.sizes[0].id } : {}),
        }),
      }),
    ),
  );

  const lineId = results.at(-1)?.result?.lines?.[0]?.id;
  if (lineId) {
    results.push(
      await timed('Update line quantity', () =>
        req(`/orders/${order.id}/lines/${lineId}`, {
          method: 'PATCH',
          token,
          body: JSON.stringify({ quantity: 2 }),
        }),
      ),
    );
  }

  const paidOrder = results.at(-1)?.result ?? results.at(-2)?.result;
  const payTotal = paidOrder?.total ?? '0.0000';

  results.push(
    await timed('Pay order (cash)', () =>
      req(`/orders/${order.id}/pay`, {
        method: 'POST',
        token,
        body: JSON.stringify({
          payments: [{ method: 'CASH', amount: payTotal }],
          idempotencyKey: crypto.randomUUID(),
        }),
      }),
    ),
  );

  const avg = Math.round(results.reduce((sum, r) => sum + r.ms, 0) / results.length);
  console.log(`\nAverage: ${avg} ms across ${results.length} endpoints`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
