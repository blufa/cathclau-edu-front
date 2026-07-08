"use client";

import { Badge, Card, Group, List, Stack, Text, ThemeIcon, Title } from "@mantine/core";
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
    <Card
      withBorder
      radius="lg"
      padding="lg"
      shadow={popular ? "md" : "xs"}
      style={popular ? { borderColor: "var(--mantine-color-indigo-5)", borderWidth: 2 } : undefined}
    >
      <Stack gap="sm" h="100%">
        <Group justify="space-between" align="center">
          <Title order={3}>{plan.name}</Title>
          {current ? (
            <Badge color="green" variant="light">Plan actuel</Badge>
          ) : popular ? (
            <Badge color="indigo" variant="filled">Populaire</Badge>
          ) : null}
        </Group>

        <Text c="dimmed" size="sm">{studentLimitLabel(plan.studentLimit)}</Text>

        <Group gap={6} align="baseline">
          <Text fw={700} size="28px">{formatGNF(price)}</Text>
          <Text c="dimmed" size="sm">/ {BILLING_PERIOD_LABEL[period].toLowerCase()}</Text>
        </Group>
        {plan.archived && <Badge color="gray" variant="light">Plan archivé</Badge>}

        <List spacing="xs" size="sm" mt="xs" center
          icon={<ThemeIcon color="green" size={18} radius="xl">✓</ThemeIcon>}>
          {(PLAN_FEATURES[plan.code] ?? []).map((f) => (
            <List.Item key={f}>{f}</List.Item>
          ))}
        </List>

        <div style={{ flex: 1 }} />

        {onChoose && (
          <Button
            fullWidth
            variant={popular ? "primary" : "secondary"}
            disabled={disabled || plan.archived || current}
            onClick={() => onChoose(plan)}
          >
            {current ? "Plan actuel" : ctaLabel}
          </Button>
        )}
      </Stack>
    </Card>
  );
}
