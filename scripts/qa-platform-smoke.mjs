/** Platform API smoke — run: node scripts/qa-platform-smoke.mjs */
const API = 'http://localhost:3001/api/v1';

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(body?.detail ?? body)}`);
  return body;
}

async function main() {
  const results = [];
  const step = async (name, fn) => {
    try {
      await fn();
      results.push({ name, pass: true });
      console.log(`✓ ${name}`);
    } catch (e) {
      results.push({ name, pass: false, error: e.message });
      console.error(`✗ ${name}: ${e.message}`);
    }
  };

  let token;
  let branchId;

  await step('Health', async () => {
    const h = await req('/health');
    if (h.status !== 'ok' || h.services?.database !== 'up') throw new Error('unhealthy');
  });

  await step('Auth login', async () => {
    const login = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@qauto.com', password: 'admin123' }),
    });
    token = login.accessToken;
    branchId = login.branchId;
  });

  await step('Menu catalog', async () => {
    const c = await req(`/menu/catalog?branchId=${branchId}`, { token });
    if (!c.categories?.length) throw new Error('empty catalog');
  });

  await step('Kitchen queue', async () => {
    const q = await req(`/orders/queue?branchId=${branchId}`, { token });
    if (!Array.isArray(q.items)) throw new Error('invalid queue shape');
  });

  await step('Orders list', async () => {
    const o = await req(`/orders?branchId=${branchId}&limit=5`, { token });
    if (!Array.isArray(o.items)) throw new Error('invalid orders list');
  });

  await step('Inventory ingredients', async () => {
    const inv = await req(`/inventory/ingredients?branchId=${branchId}`, { token });
    if (!Array.isArray(inv.items)) throw new Error('invalid inventory');
  });

  await step('Sales summary report', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await req(`/reports/sales-summary?branchId=${branchId}&from=${today}&to=${today}`, { token });
  });

  await step('P&L report', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await req(`/reports/pnl?branchId=${branchId}&from=${today}&to=${today}`, { token });
  });

  await step('Corporate billing report', async () => {
    const today = new Date().toISOString().slice(0, 10);
    await req(`/reports/corporate-billing?branchId=${branchId}&from=${today}&to=${today}`, { token });
  });

  await step('Billing departments', async () => {
    const d = await req('/reports/billing-departments', { token });
    if (!Array.isArray(d)) throw new Error('invalid departments');
  });

  await step('Dashboard metrics', async () => {
    await req(`/dashboard/metrics?branchId=${branchId}`, { token });
  });

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
