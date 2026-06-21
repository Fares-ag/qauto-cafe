/**
 * Register flow API smoke test — run: node scripts/qa-register-smoke.mjs
 */
const API = 'http://localhost:3001/api/v1';

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      ...opts.headers,
    },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(`${opts.method ?? 'GET'} ${path} → ${res.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const results = [];

  async function step(name, fn) {
    try {
      await fn();
      results.push({ name, pass: true });
      console.log(`✓ ${name}`);
    } catch (e) {
      results.push({ name, pass: false, error: e.message });
      console.error(`✗ ${name}: ${e.message}`);
    }
  }

  let token;
  let branchId;
  let terminalId;
  let shiftId;
  let catalog;
  let staffWithExt;
  let staffNoExt;
  let departments;

  await step('Health check', async () => {
    const h = await req('/health');
    assert(h.status === 'ok', 'health not ok');
  });

  await step('Manager login', async () => {
    const login = await req('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@qauto.com', password: 'admin123' }),
    });
    token = login.accessToken;
    branchId = login.branchId;
    assert(token && branchId, 'missing token or branchId');
  });

  await step('Bootstrap POS terminal', async () => {
    const boot = await req('/public/bootstrap');
    const terminal = boot.terminals?.find((t) => t.type === 'POS');
    assert(terminal?.id, 'no POS terminal');
    terminalId = terminal.id;
  });

  await step('Open shift', async () => {
    try {
      const shift = await req('/shifts/open', {
        method: 'POST',
        token,
        body: JSON.stringify({ branchId, terminalId, openingFloat: '100.0000' }),
      });
      shiftId = shift.id;
    } catch (e) {
      if (!String(e.message).includes('409')) throw e;
      const current = await req(`/shifts/current?branchId=${branchId}&terminalId=${terminalId}`, { token });
      shiftId = current.id;
    }
    assert(shiftId, 'no shift id');
  });

  await step('Load menu catalog', async () => {
    catalog = await req(`/menu/catalog?branchId=${branchId}`, { token });
    assert(catalog.categories?.length, 'empty catalog');
  });

  await step('Staff directory search (Alnadi)', async () => {
    const dir = await req('/customers/directory?q=Alnadi', { token });
    assert(dir.length > 0, 'no Alnadi in directory');
    staffNoExt = dir.find((e) => !e.phoneExtension) ?? dir[0];
  });

  await step('Register lookup endpoint', async () => {
    const lookup = await req('/customers/register-lookup?q=Alnadi', { token });
    assert(Array.isArray(lookup) && lookup.length > 0, 'register-lookup empty');
  });

  await step('Staff with extension search', async () => {
    const dir = await req('/customers/directory', { token });
    staffWithExt = dir.find((e) => e.phoneExtension);
    assert(staffWithExt, 'no staff with extension');
  });

  await step('List departments', async () => {
    departments = await req('/customers/departments', { token });
    assert(departments.length > 0, 'no departments');
  });

  const firstItem =
    catalog.categories.flatMap((c) => c.items).find((i) => i.type === 'SNACK' && i.isAvailable !== false) ??
    catalog.categories.flatMap((c) => c.items).find((i) => i.isAvailable !== false);
  assert(firstItem, 'no menu item');

  let orderId;

  await step('Create order + add line', async () => {
    const order = await req('/orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ branchId, terminalId, shiftId, orderType: 'COUNTER' }),
    });
    orderId = order.id;
    const line = {
      menuItemId: firstItem.id,
      quantity: 1,
      modifierIds: [],
      ...(firstItem.sizes?.[0] ? { sizeId: firstItem.sizes[0].id } : {}),
    };
    const updated = await req(`/orders/${orderId}/lines`, {
      method: 'POST',
      token,
      body: JSON.stringify(line),
    });
    assert(updated.lines?.length === 1, 'line not added');
  });

  await step('Attach staff customer (no ext)', async () => {
    const cust = await req(`/orders/${orderId}/customer`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        customerId: staffNoExt.id,
        customerName: staffNoExt.name,
        customerDepartment: staffNoExt.department,
        billingParty: 'INDIVIDUAL',
      }),
    });
    assert(cust.customerName, 'customer not set');
  });

  await step('Defer order (pay later)', async () => {
    const deferred = await req(`/orders/${orderId}/defer`, { method: 'POST', token });
    assert(deferred.order.status === 'PENDING_PAYMENT', `expected PENDING_PAYMENT got ${deferred.order.status}`);
    assert(deferred.order.customerName, 'customer missing on deferred order');
  });

  await step('Collect payment on deferred order', async () => {
    const order = await req(`/orders/${orderId}`, { token });
    const paid = await req(`/orders/${orderId}/pay`, {
      method: 'POST',
      token,
      body: JSON.stringify({
        payments: [{ method: 'CASH', amount: order.total }],
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    assert(['PAID', 'IN_PREP'].includes(paid.order.status), `unexpected status ${paid.order.status}`);
  });

  let order2Id;

  await step('Office guest order + department billing', async () => {
    const order = await req('/orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ branchId, terminalId, shiftId, orderType: 'STAFF' }),
    });
    order2Id = order.id;
    const line = {
      menuItemId: firstItem.id,
      quantity: 1,
      modifierIds: [],
      ...(firstItem.sizes?.[0] ? { sizeId: firstItem.sizes[0].id } : {}),
    };
    await req(`/orders/${order2Id}/lines`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ lines: [line] }),
    });
    await req(`/orders/${order2Id}/customer`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        billingParty: 'DEPARTMENT',
        customerDepartment: departments[0],
        guestName: 'QA Visitor',
      }),
    });
    const deferred = await req(`/orders/${order2Id}/defer`, { method: 'POST', token });
    assert(deferred.order.billingParty === 'DEPARTMENT', 'billing party not DEPARTMENT');
    assert(deferred.order.customerDepartment === departments[0], 'department not set');
  });

  await step('Office guest without department should fail', async () => {
    const order = await req('/orders', {
      method: 'POST',
      token,
      body: JSON.stringify({ branchId, terminalId, shiftId }),
    });
    const line = {
      menuItemId: firstItem.id,
      quantity: 1,
      modifierIds: [],
      ...(firstItem.sizes?.[0] ? { sizeId: firstItem.sizes[0].id } : {}),
    };
    await req(`/orders/${order.id}/lines`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ lines: [line] }),
    });
    let failed = false;
    try {
      await req(`/orders/${order.id}/customer`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ billingParty: 'DEPARTMENT', guestName: 'Bad Guest' }),
      });
    } catch {
      failed = true;
    }
    assert(failed, 'expected department validation error');
  });

  await step('Cannot modify lines after defer', async () => {
    let failed = false;
    try {
      await req(`/orders/${order2Id}/lines`, {
        method: 'PATCH',
        token,
        body: JSON.stringify({ lines: [] }),
      });
    } catch {
      failed = true;
    }
    assert(failed, 'expected draft-only error on locked order');
  });

  const failed = results.filter((r) => !r.pass);
  console.log('\n--- Summary ---');
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
