"use client";

import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, CalendarCheck } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { EarlyPaymentDiscountRulesPanel } from "@/features/billing/components/early-payment-discount-rules-panel";
import { ExemptionRulesPanel } from "@/features/billing/components/exemption-rules-panel";
import { ExemptionsPanel } from "@/features/billing/components/exemptions-panel";

export default function BillingRulesPage() {
  const { user } = useAuth();
  // Lecture seule par défaut (ex. comptable) sur le CATALOGUE des types d'exonération/remises :
  // création/modification/suppression exigent un privilège explicite, accordé par l'administrateur
  // école — plus de "frais:manage" global.
  const canWrite = hasAnyPermission(user, ["regle_facturation:create", "regle_facturation:update", "regle_facturation:delete"]);
  // Accorder une exonération à un élève précis est une action courante du comptable/secrétaire à
  // l'inscription ou à l'encaissement — distinct du catalogue ci-dessus, jamais restreint à la
  // lecture seule par défaut. La révoquer reste une correction réservée à l'admin école/direction.
  const canGrantExemption = hasAnyPermission(user, ["exoneration:create"]);
  const canRevokeExemption = hasAnyPermission(user, ["exoneration:delete"]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Règles de facturation</h1>
        <p className="text-sm text-gray-500">
          Exonérations (fratrie, avantage personnel, cas sociaux…) et remise année complète — tout est
          choisi manuellement par le comptable sur chaque élève, aucune détection automatique.
        </p>
      </div>

      <Tabs defaultValue="exemptions">
        <TabsList>
          <TabsTrigger value="exemptions" icon={BadgePercent}>Exonérations</TabsTrigger>
          <TabsTrigger value="early" icon={CalendarCheck}>Remise année complète</TabsTrigger>
        </TabsList>

        <TabsPanel value="exemptions">
          <div className="space-y-6">
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Types d&apos;exonération pré-configurés</h2>
              <ExemptionRulesPanel canWrite={canWrite} />
            </div>
            <div>
              <h2 className="mb-2 text-sm font-semibold text-gray-700">Exonérations accordées (cas par cas)</h2>
              <ExemptionsPanel canCreate={canGrantExemption} canDelete={canRevokeExemption} />
            </div>
          </div>
        </TabsPanel>
        <TabsPanel value="early"><EarlyPaymentDiscountRulesPanel canWrite={canWrite} /></TabsPanel>
      </Tabs>
    </div>
  );
}
