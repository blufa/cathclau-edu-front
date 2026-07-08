"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Accordion, Center, SegmentedControl, Table } from "@mantine/core";
import { Check, Minus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listPlans } from "@/lib/api/platform";
import { PlanCard } from "@/components/platform/plan-card";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { formatGNF } from "@/lib/format";
import { planPrice } from "@/lib/platform-utils";
import type { BillingPeriod, Plan } from "@/lib/types/platform";

const PLAN_ORDER = ["STARTER", "STANDARD", "PREMIUM"];

const COMPARISON: { label: string; values: Record<string, string | boolean> }[] = [
  { label: "Élèves", values: { STARTER: "≤ 500", STANDARD: "≤ 2000", PREMIUM: "Illimité" } },
  { label: "Gestion scolarité", values: { STARTER: true, STANDARD: true, PREMIUM: true } },
  { label: "Communication parents", values: { STARTER: true, STANDARD: true, PREMIUM: true } },
  { label: "Facturation des frais", values: { STARTER: false, STANDARD: true, PREMIUM: true } },
  { label: "Paiements en ligne", values: { STARTER: false, STANDARD: true, PREMIUM: true } },
  { label: "Multi-établissements", values: { STARTER: false, STANDARD: false, PREMIUM: true } },
  { label: "Support prioritaire", values: { STARTER: false, STANDARD: false, PREMIUM: true } },
];

const FAQ = [
  { q: "L'essai gratuit nécessite-t-il une carte bancaire ?", a: "Non. Vous bénéficiez de 30 jours d'essai gratuit sans aucune carte bancaire." },
  { q: "Puis-je changer de plan plus tard ?", a: "Oui. Une mise à niveau est immédiate (avec prorata) ; une rétrogradation prend effet au renouvellement." },
  { q: "Quels moyens de paiement acceptez-vous ?", a: "Orange Money, MTN MoMo, Wave et cartes Visa/MasterCard." },
];

function sortPlans(plans: Plan[]): Plan[] {
  return [...plans].sort((a, b) => PLAN_ORDER.indexOf(a.code) - PLAN_ORDER.indexOf(b.code));
}

function ComparisonCell({ value }: { value: string | boolean }) {
  if (typeof value === "boolean") {
    return value ? (
      <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-brand-700">
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    ) : (
      <Minus className="mx-auto h-4 w-4 text-slate-300" />
    );
  }
  return <span className="font-medium text-slate-800">{value}</span>;
}

export default function TarifsPage() {
  const router = useRouter();
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const { data, loading, error } = useQuery(() => listPlans(), []);

  const plans = data ? sortPlans(data.filter((p) => !p.archived)) : [];

  return (
    <>
      {/* Hero */}
      <AuroraBackground className="px-4 py-24 text-center">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
        <Reveal className="relative z-10 mx-auto max-w-3xl">
          <span className="inline-block rounded-full border border-brand-200 bg-white/70 px-4 py-1.5 text-xs font-medium text-brand-700 backdrop-blur">
            Tarifs
          </span>
          <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Des tarifs simples et transparents
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-slate-600">
            Essai gratuit de 30 jours, sans carte bancaire. Annulez à tout moment.
          </p>
          <Center mt="lg">
            <SegmentedControl
              value={period}
              onChange={(v) => setPeriod(v as BillingPeriod)}
              data={[
                { label: "Mensuel", value: "MONTHLY" },
                { label: "Annuel (remisé)", value: "ANNUAL" },
              ]}
            />
          </Center>
        </Reveal>
      </AuroraBackground>

      <div className="mx-auto max-w-6xl px-4 py-16">
        {/* Plans */}
        {error ? (
          <p className="rounded-md bg-red-50 px-4 py-3 text-center text-sm text-red-700">
            Impossible de charger les plans pour le moment.
          </p>
        ) : loading && plans.length === 0 ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan, i) => (
              <Reveal key={plan.id} delay={i * 0.1}>
                <PlanCard
                  plan={plan}
                  period={period}
                  onChoose={(p) => router.push(`/signup?plan=${p.code}`)}
                />
              </Reveal>
            ))}
          </div>
        )}

        {/* Comparison table */}
        <section className="mt-20">
          <Reveal>
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
              Comparatif détaillé
            </h2>
            <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-200">
              <Table striped highlightOnHover withRowBorders verticalSpacing="sm">
                <Table.Thead className="bg-slate-50">
                  <Table.Tr>
                    <Table.Th>Fonctionnalité</Table.Th>
                    {PLAN_ORDER.map((code) => (
                      <Table.Th key={code} style={{ textAlign: "center" }}>{code}</Table.Th>
                    ))}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Prix ({period === "ANNUAL" ? "annuel" : "mensuel"})</Table.Td>
                    {PLAN_ORDER.map((code) => {
                      const plan = plans.find((p) => p.code === code);
                      return (
                        <Table.Td key={code} style={{ textAlign: "center", fontWeight: 600 }}>
                          {plan ? formatGNF(planPrice(plan, period)) : "—"}
                        </Table.Td>
                      );
                    })}
                  </Table.Tr>
                  {COMPARISON.map((row) => (
                    <Table.Tr key={row.label}>
                      <Table.Td>{row.label}</Table.Td>
                      {PLAN_ORDER.map((code) => (
                        <Table.Td key={code} style={{ textAlign: "center" }}>
                          <ComparisonCell value={row.values[code]} />
                        </Table.Td>
                      ))}
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </div>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="mx-auto mt-20 max-w-3xl">
          <Reveal>
            <h2 className="text-center text-2xl font-bold tracking-tight text-slate-900">
              Questions fréquentes
            </h2>
            <Accordion mt="lg" variant="separated" radius="lg">
              {FAQ.map((f) => (
                <Accordion.Item key={f.q} value={f.q}>
                  <Accordion.Control>{f.q}</Accordion.Control>
                  <Accordion.Panel>{f.a}</Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          </Reveal>
        </section>
      </div>
    </>
  );
}
