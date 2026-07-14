"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface BarSeries {
  key: string;
  name: string;
  color: string;
}

/**
 * Diagramme en bâtonnets (barres), coloré, avec grille et légende — pensé pour être lisible
 * par un public non technique (pas de courbes ni de dégradés à interpréter, une barre = une valeur).
 */
export function BarTrendChart({
  data,
  series,
  height = 260,
  valueFormatter = (v) => String(v),
}: {
  data: Array<Record<string, string | number>>;
  series: BarSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height} minWidth={0}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barGap={6}>
        <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
          cursor={{ fill: "#f8fafc" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 24px rgba(15,23,42,.08)",
            fontSize: 13,
          }}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} iconType="circle" />}
        {series.map((s) => (
          <Bar key={s.key} dataKey={s.key} name={s.name} fill={s.color} radius={[6, 6, 0, 0]} maxBarSize={44} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
