"use client";

import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatGNF } from "@/lib/format";
import { BILLING_PERIOD_LABEL } from "@/lib/platform-labels";
import { PLAN_FEATURES, planPrice, studentLimitLabel } from "@/lib/platform-utils";
import type { BillingPeriod, Plan } from "@/lib/types/platform";

interface PlanCardProps {
  plan: Plan;
  period: BillingPeriod;
  /** Highlights the card as the current plan (connected view). */
  current?: boolean;
  ctaLabel?: string;
  onChoose?: (plan: Plan) => void;
  disabled?: boolean;
}

export function PlanCard({ plan, period, current, ctaLabel = "Choisir ce plan", onChoose, disabled }: PlanCardProps) {
  const popular = plan.code === "STANDARD";
  const price = planPrice(plan, period);

  return (
    <Card className={popular ? "flex h-full flex-col border-2 border-brand-500 p-6 shadow-md" : "flex h-full flex-col p-6"}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
        {current ? (
          <Badge tone="green">Plan actuel</Badge>
        ) : popular ? (
          <Badge tone="indigo">Populaire</Badge>
        ) : null}
      </div>

      <p className="mt-1 text-sm text-gray-500">{studentLimitLabel(plan.studentLimit)}</p>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold text-gray-900">{formatGNF(price)}</span>
        <span className="text-sm text-gray-500">/ {BILLING_PERIOD_LABEL[period].toLowerCase()}</span>
      </div>
      {plan.archived && <Badge tone="gray" className="mt-2 w-fit">Plan archivé</Badge>}

      <ul className="mt-3 space-y-2 text-sm">
        {(PLAN_FEATURES[plan.code] ?? []).map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-success-100 text-success-700">
              <Check className="h-3 w-3" />
            </span>
            {f}
          </li>
        ))}
      </ul>

      <div className="flex-1" />

      {onChoose && (
        <Button
          fullWidth
          variant={popular ? "primary" : "secondary"}
          disabled={disabled || plan.archived || current}
          onClick={() => onChoose(plan)}
          className="mt-4"
        >
          {current ? "Plan actuel" : ctaLabel}
        </Button>
      )}
    </Card>
  );
}
