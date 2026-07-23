"use client";

interface QuotaProgressProps {
  consumed: number;
  /** null = unlimited plan. */
  limit: number | null;
}

/** Student-quota gauge (consommé / limite) with a colour that warns near the limit. */
export function QuotaProgress({ consumed, limit }: QuotaProgressProps) {
  if (limit == null) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-gray-700">{consumed} élèves</p>
        <p className="text-xs text-gray-400">Plan illimité</p>
      </div>
    );
  }

  const ratio = limit === 0 ? 1 : Math.min(consumed / limit, 1);
  const pct = Math.round(ratio * 100);
  const barColor = ratio >= 1 ? "bg-error-500" : ratio >= 0.85 ? "bg-warning-500" : "bg-success-500";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-gray-700">{consumed} / {limit} élèves</p>
        <p className="text-xs text-gray-400">{pct}%</p>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
      {ratio >= 1 && (
        <p className="text-xs text-error-600">Limite atteinte — la création de nouveaux élèves sera bloquée (403).</p>
      )}
      {ratio >= 0.85 && ratio < 1 && (
        <p className="text-xs text-warning-600">Vous approchez de la limite de votre plan.</p>
      )}
    </div>
  );
}
