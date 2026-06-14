'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

const CHART_COLORS = [
  'hsl(220, 70%, 50%)',
  'hsl(160, 60%, 42%)',
  'hsl(35, 90%, 52%)',
  'hsl(280, 55%, 55%)',
  'hsl(0, 70%, 55%)',
  'hsl(200, 75%, 45%)',
];

function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (v: number) => v.toLocaleString(),
}: {
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; color?: string }>;
  label?: string;
  valueFormatter?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 shadow-soft text-sm">
      {label ? <p className="mb-1 font-medium text-ink">{label}</p> : null}
      {payload.map((entry) => (
        <p key={entry.name} className="text-ink-secondary" style={{ color: entry.color }}>
          {entry.name}: {valueFormatter(entry.value ?? 0)}
        </p>
      ))}
    </div>
  );
}

export function SalesTrendChart({
  data,
  formatValue,
}: {
  data: Array<{ businessDate: string; netSales: string; orderCount: number }>;
  formatValue: (v: string) => string;
}) {
  const chartData = data.map((d) => ({
    date: d.businessDate.slice(5),
    sales: parseFloat(d.netSales),
    orders: d.orderCount,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(220, 70%, 50%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatValue(String(v))} />} />
        <Area
          type="monotone"
          dataKey="sales"
          name="Net sales"
          stroke="hsl(220, 70%, 50%)"
          strokeWidth={2.5}
          fill="url(#salesGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HourlySalesChart({
  data,
  formatValue,
}: {
  data: Array<{ label: string; netSales: string; orderCount: number }>;
  formatValue: (v: string) => string;
}) {
  const chartData = data.map((d) => ({
    hour: d.label,
    sales: parseFloat(d.netSales),
    orders: d.orderCount,
  }));

  if (!chartData.some((d) => d.sales > 0 || d.orders > 0)) {
    return <p className="py-12 text-center text-sm text-ink-muted">No hourly data for this date</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} interval={2} />
        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatValue(String(v))} />} />
        <Bar dataKey="sales" name="Net sales" fill="hsl(160, 60%, 42%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentMixChart({
  data,
  formatValue,
}: {
  data: Array<{ method: string; amount: string }>;
  formatValue: (v: string) => string;
}) {
  const chartData = data.map((d) => ({ name: d.method, value: parseFloat(d.amount) }));
  if (!chartData.length) {
    return <p className="py-12 text-center text-sm text-ink-muted">No payments recorded</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={88}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatValue(String(v))} />} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryMixChart({
  data,
  formatValue,
}: {
  data: Array<{ category: string; amount: string }>;
  formatValue: (v: string) => string;
}) {
  const chartData = data.map((d) => ({ name: d.category, value: parseFloat(d.amount) }));
  if (!chartData.length) {
    return <p className="py-12 text-center text-sm text-ink-muted">No category split yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: 'hsl(var(--ink-secondary))' }} axisLine={false} tickLine={false} width={64} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatValue(String(v))} />} />
        <Bar dataKey="value" name="Sales" fill="hsl(35, 90%, 52%)" radius={[0, 4, 4, 0]} barSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({
  data,
  formatValue,
}: {
  data: Array<{ menuItemName: string; grossSales: string; quantitySold: number }>;
  formatValue: (v: string) => string;
}) {
  const chartData = data.slice(0, 6).map((d) => ({
    name: d.menuItemName.length > 18 ? `${d.menuItemName.slice(0, 16)}…` : d.menuItemName,
    sales: parseFloat(d.grossSales),
    qty: d.quantitySold,
  }));

  if (!chartData.length) {
    return <p className="py-12 text-center text-sm text-ink-muted">No product sales yet</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--ink-secondary))' }} axisLine={false} tickLine={false} width={100} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatValue(String(v))} />} />
        <Bar dataKey="sales" name="Sales" fill="hsl(220, 70%, 50%)" radius={[0, 4, 4, 0]} barSize={22} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function OrderTypeChart({
  data,
  formatValue,
}: {
  data: Array<{ orderType: string; netSales: string; orderCount: number }>;
  formatValue: (v: string) => string;
}) {
  const chartData = data.map((d) => ({
    type: d.orderType.replace('_', ' '),
    sales: parseFloat(d.netSales),
    orders: d.orderCount,
  }));

  if (!chartData.length) {
    return <p className="py-12 text-center text-sm text-ink-muted">No orders by type</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="type" tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--ink-muted))' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={<ChartTooltip valueFormatter={(v) => formatValue(String(v))} />} />
        <Bar dataKey="sales" name="Net sales" fill="hsl(280, 55%, 55%)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MarginGauge({ marginPct, foodCostPct }: { marginPct: string; foodCostPct: string }) {
  const margin = parseFloat(marginPct);
  const foodCost = parseFloat(foodCostPct);
  const marginColor = margin >= 60 ? 'text-success' : margin >= 40 ? 'text-warning' : 'text-danger';

  return (
    <div className="flex items-center justify-center gap-8 py-4">
      <div className="text-center">
        <div className={`text-4xl font-bold tracking-tight ${marginColor}`}>{marginPct}%</div>
        <p className="mt-1 text-sm text-ink-muted">Gross margin</p>
      </div>
      <div className="h-16 w-px bg-border" />
      <div className="text-center">
        <div className="text-4xl font-bold tracking-tight text-ink">{foodCostPct}%</div>
        <p className="mt-1 text-sm text-ink-muted">Food cost</p>
      </div>
    </div>
  );
}
