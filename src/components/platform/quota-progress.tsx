"use client";

import { Progress, Text } from "@mantine/core";

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
        <Text size="sm">{consumed} élèves</Text>
        <Text size="xs" c="dimmed">Plan illimité</Text>
      </div>
    );
  }

  const ratio = limit === 0 ? 1 : Math.min(consumed / limit, 1);
  const pct = Math.round(ratio * 100);
  const color = ratio >= 1 ? "red" : ratio >= 0.85 ? "yellow" : "teal";

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <Text size="sm" fw={500}>{consumed} / {limit} élèves</Text>
        <Text size="xs" c="dimmed">{pct}%</Text>
      </div>
      <Progress value={pct} color={color} radius="xl" />
      {ratio >= 1 && (
        <Text size="xs" c="red">Limite atteinte — la création de nouveaux élèves sera bloquée (403).</Text>
      )}
      {ratio >= 0.85 && ratio < 1 && (
        <Text size="xs" c="orange">Vous approchez de la limite de votre plan.</Text>
      )}
    </div>
  );
}
