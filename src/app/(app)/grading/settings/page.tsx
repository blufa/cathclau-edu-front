"use client";

import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { SlidersHorizontal, Timer, ListChecks, Ban, GitBranch } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { GradingScalePanel } from "@/components/grading/grading-scale-panel";
import { SessionSettingsPanel } from "@/components/grading/session-settings-panel";
import { AssessmentTypesPanel } from "@/components/grading/assessment-types-panel";
import { EliminatoryRulesPanel } from "@/components/grading/eliminatory-rules-panel";
import { DecisionRulesPanel } from "@/components/grading/decision-rules-panel";

export default function GradingSettingsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE") || hasAnyPermission(user, ["parametrage_notes:manage"]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paramètres de notation</h1>
        <p className="text-sm text-gray-500">
          Barème des mentions, types d&apos;évaluation et règles de décision
        </p>
      </div>

      <Tabs defaultValue="scale">
        <TabsList>
          <TabsTrigger value="scale" icon={SlidersHorizontal}>Barème</TabsTrigger>
          <TabsTrigger value="types" icon={ListChecks}>Types d&apos;évaluation</TabsTrigger>
          <TabsTrigger value="sessions" icon={Timer}>Durées de séance</TabsTrigger>
          <TabsTrigger value="eliminatory" icon={Ban}>Notes éliminatoires</TabsTrigger>
          <TabsTrigger value="decision" icon={GitBranch}>Règles de décision</TabsTrigger>
        </TabsList>

        <TabsPanel value="scale"><GradingScalePanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="types"><AssessmentTypesPanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="sessions"><SessionSettingsPanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="eliminatory"><EliminatoryRulesPanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="decision"><DecisionRulesPanel canWrite={canWrite} /></TabsPanel>
      </Tabs>
    </div>
  );
}
