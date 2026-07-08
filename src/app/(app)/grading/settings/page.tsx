"use client";

import { Tabs, Title } from "@mantine/core";
import { SlidersHorizontal, Calculator, Timer, ListChecks, Ban, GitBranch } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { GradingScalePanel } from "@/components/grading/grading-scale-panel";
import { CalculationSettingsPanel } from "@/components/grading/calculation-settings-panel";
import { SessionSettingsPanel } from "@/components/grading/session-settings-panel";
import { AssessmentTypesPanel } from "@/components/grading/assessment-types-panel";
import { EliminatoryRulesPanel } from "@/components/grading/eliminatory-rules-panel";
import { DecisionRulesPanel } from "@/components/grading/decision-rules-panel";

export default function GradingSettingsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE");

  return (
    <div className="space-y-5">
      <div>
        <Title order={2}>Paramètres de notation</Title>
        <p className="text-sm text-gray-500">
          Barème des mentions, moteur de calcul des moyennes, types d&apos;évaluation et règles de décision
        </p>
      </div>

      <Tabs defaultValue="scale" color="teal" variant="pills" radius="md" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="scale" leftSection={<SlidersHorizontal className="h-4 w-4" />}>Barème</Tabs.Tab>
          <Tabs.Tab value="calc" leftSection={<Calculator className="h-4 w-4" />}>Moteur de calcul</Tabs.Tab>
          <Tabs.Tab value="types" leftSection={<ListChecks className="h-4 w-4" />}>Types d&apos;évaluation</Tabs.Tab>
          <Tabs.Tab value="sessions" leftSection={<Timer className="h-4 w-4" />}>Durées de séance</Tabs.Tab>
          <Tabs.Tab value="eliminatory" leftSection={<Ban className="h-4 w-4" />}>Notes éliminatoires</Tabs.Tab>
          <Tabs.Tab value="decision" leftSection={<GitBranch className="h-4 w-4" />}>Règles de décision</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="scale"><GradingScalePanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="calc"><CalculationSettingsPanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="types"><AssessmentTypesPanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="sessions"><SessionSettingsPanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="eliminatory"><EliminatoryRulesPanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="decision"><DecisionRulesPanel canWrite={canWrite} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
