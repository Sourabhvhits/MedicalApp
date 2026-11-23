'use client';

import { type ReactNode } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { cn, currency, formatDate, number } from '@/lib/utils';
import { Card, CardHeader, EmptyState } from '@/components/ui';

/**
 * Categorical palette: one hue family for continuity with the brand, then
 * clearly separated hues so adjacent series never read as the same colour.
 */
export const CHART_COLORS = ['#0f766e', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#0891b2'];

const AXIS = { stroke: '#94a3b8', fontSize: 11 };
const GRID = { stroke: '#e2e8f0', strokeDasharray: '3 3' } as const;

function ChartFrame({
  title,
  description,
  action,
  hasData,
  children,
  className,
  height = 280,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  hasData: boolean;
  children: ReactNode;
  className?: string;
  height?: number;
}) {
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} action={action} />
      {hasData ? (
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            {children as React.ReactElement}
          </ResponsiveContainer>
        </div>
      ) : (
        <EmptyState title="No data for this period" description="Once activity is recorded it will appear here." />
      )}
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: {
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    fontSize: 12,
    boxShadow: '0 4px 12px rgb(15 23 42 / 0.08)',
  },
};

export function TrendAreaChart({
  title,
  description,
  data,
  valueLabel = 'Value',
  isCurrency = true,
  className,
}: {
  title: string;
  description?: string;
  data: { day?: string; month?: string; value: number }[];
  valueLabel?: string;
  isCurrency?: boolean;
  className?: string;
}) {
  const points = data.map((point) => ({
    label: point.day ? formatDate(point.day, 'dd MMM') : (point.month ?? ''),
    value: point.value,
  }));

  return (
    <ChartFrame title={title} description={description} hasData={points.length > 0} className={className}>
      <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CHART_COLORS[0]} stopOpacity={0.28} />
            <stop offset="100%" stopColor={CHART_COLORS[0]} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={AXIS}
          width={56}
          tickFormatter={(value: number) => (isCurrency ? `₹${number(value)}` : number(value))}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value: number) => [isCurrency ? currency(value) : number(value), valueLabel]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS[0]}
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ChartFrame>
  );
}

export function TrendLineChart({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description?: string;
  data: { day?: string; value: number }[];
  className?: string;
}) {
  const points = data.map((point) => ({
    label: formatDate(point.day, 'dd MMM'),
    value: point.value,
  }));

  return (
    <ChartFrame title={title} description={description} hasData={points.length > 0} className={className}>
      <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID} vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS} />
        <YAxis tickLine={false} axisLine={false} tick={AXIS} width={40} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [number(value), 'Orders']} />
        <Line
          type="monotone"
          dataKey="value"
          stroke={CHART_COLORS[1]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ChartFrame>
  );
}

export function RankedBarChart({
  title,
  description,
  data,
  valueKey = 'revenue',
  isCurrency = true,
  className,
}: {
  title: string;
  description?: string;
  data: { name: string; revenue?: number; quantity?: number; orders?: number; amount?: number }[];
  valueKey?: 'revenue' | 'quantity' | 'orders' | 'amount';
  isCurrency?: boolean;
  className?: string;
}) {
  const points = data.slice(0, 8).map((row) => ({
    // Long medicine names need truncating to keep the axis readable.
    name: row.name.length > 22 ? `${row.name.slice(0, 21)}…` : row.name,
    value: Number(row[valueKey] ?? 0),
  }));

  return (
    <ChartFrame
      title={title}
      description={description}
      hasData={points.length > 0}
      className={className}
      height={Math.max(220, points.length * 34)}
    >
      <BarChart data={points} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid {...GRID} horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={AXIS}
          tickFormatter={(value: number) => (isCurrency ? `₹${number(value)}` : number(value))}
        />
        <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={AXIS} width={140} />
        <Tooltip
          {...tooltipStyle}
          cursor={{ fill: '#f1f5f9' }}
          formatter={(value: number) => [isCurrency ? currency(value) : number(value), title]}
        />
        <Bar dataKey="value" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} barSize={16} />
      </BarChart>
    </ChartFrame>
  );
}

export function StatusDonutChart({
  title,
  description,
  data,
  className,
}: {
  title: string;
  description?: string;
  data: { label: string; value: number }[];
  className?: string;
}) {
  const points = data.filter((point) => point.value > 0);

  return (
    <ChartFrame title={title} description={description} hasData={points.length > 0} className={className}>
      <PieChart>
        <Pie
          data={points}
          dataKey="value"
          nameKey="label"
          innerRadius="55%"
          outerRadius="80%"
          paddingAngle={2}
        >
          {points.map((point, index) => (
            <Cell key={point.label} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 11 }} />
        <Tooltip {...tooltipStyle} formatter={(value: number) => [number(value), 'Orders']} />
      </PieChart>
    </ChartFrame>
  );
}

/** Compact KPI tile used across every dashboard. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-700',
    success: 'bg-success-soft text-green-700',
    warning: 'bg-warning-soft text-amber-700',
    danger: 'bg-danger-soft text-red-700',
    info: 'bg-info-soft text-blue-700',
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {icon ? <span className={cn('rounded-lg p-2', tones[tone])}>{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-ink-500">{hint}</p> : null}
    </>
  );

  const className = cn(
    'rounded-xl border border-ink-200 bg-white p-4 shadow-sm',
    href && 'transition-colors hover:border-brand-300 hover:bg-brand-50/30',
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return <div className={className}>{content}</div>;
}
