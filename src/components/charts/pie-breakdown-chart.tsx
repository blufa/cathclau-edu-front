"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BreakdownItem } from "./bar-breakdown-chart";

/**
 * Répartition en diagramme circulaire (donut), avec le total au centre et une liste claire des
 * valeurs/pourcentages en dessous — pensé pour un public non comptable : gros secteurs colorés
 * faciles à comparer d'un coup d'œil, mais sans jamais laisser deviner un chiffre (chaque part est
 * aussi listée en clair, comme pour {@link import("./bar-breakdown-chart").BarBreakdownChart}).
 */
export function PieBreakdownChart({
  data,
  centerLabel,
  valueFormatter = (v) => String(v),
  height = 240,
}: {
  data: BreakdownItem[];
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
  height?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Aucune donnée à afficher.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="relative" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={data.length > 1 ? 3 : 0}
              stroke="#fff"
              strokeWidth={2}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [valueFormatter(Number(value)), String(name)]}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 8px 24px rgba(15,23,42,.08)",
                fontSize: 13,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {centerLabel && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-xl font-bold text-slate-900">{valueFormatter(total)}</p>
            <p className="text-xs text-slate-400">{centerLabel}</p>
          </div>
        )}
      </div>
      <ul className="space-y-2">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <li key={d.name} className="flex items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 truncate text-slate-700">
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: d.color }} />
                {d.name}
              </span>
              <span className="flex-none font-semibold text-slate-900">
                {valueFormatter(d.value)} <span className="text-xs font-normal text-slate-400">({pct}%)</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
