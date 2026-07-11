"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface AreaSeries {
  key: string;
  name: string;
  color: string;
}

/**
 * Themed multi-series area chart (Tremor/TailAdmin style). `data` rows carry a `name` (x label)
 * plus one numeric field per series key.
 */
export function AreaTrendChart({
  data,
  series,
  height = 260,
  valueFormatter = (v) => String(v),
}: {
  data: Array<Record<string, string | number>>;
  series: AreaSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 24px rgba(15,23,42,.08)",
            fontSize: 13,
          }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color}
            strokeWidth={2.5}
            fill={`url(#grad-${s.key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
