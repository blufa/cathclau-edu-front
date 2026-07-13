export interface BreakdownItem {
  name: string;
  value: number;
  color: string;
}

/**
 * Répartition sous forme de bâtonnets horizontaux colorés (une barre = une catégorie), avec le
 * total, la valeur et le pourcentage affichés en clair — plus explicite qu'un camembert pour un
 * public non technique.
 */
export function BarBreakdownChart({
  data,
  centerLabel,
  valueFormatter = (v) => String(v),
}: {
  data: BreakdownItem[];
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Aucune donnée à afficher.</p>;
  }

  const max = Math.max(...data.map((d) => d.value));

  return (
    <div className="space-y-4">
      {centerLabel && (
        <p className="text-2xl font-bold text-slate-900">
          {valueFormatter(total)} <span className="text-sm font-normal text-slate-400">{centerLabel}</span>
        </p>
      )}
      <ul className="space-y-3">
        {data.map((d) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const width = max > 0 ? Math.max((d.value / max) * 100, 4) : 0;
          return (
            <li key={d.name}>
              <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 truncate text-slate-700">
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: d.color }} />
                  {d.name}
                </span>
                <span className="flex-none font-semibold text-slate-900">
                  {valueFormatter(d.value)} <span className="text-xs font-normal text-slate-400">({pct}%)</span>
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full transition-all" style={{ width: `${width}%`, background: d.color }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
