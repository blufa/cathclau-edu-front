"use client";

import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { BadgePercent, CalendarCheck, Users, HeartHandshake } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { EarlyPaymentDiscountRulesPanel } from "@/features/billing/components/early-payment-discount-rules-panel";
import { ExemptionsPanel } from "@/features/billing/components/exemptions-panel";
import { FamilyDiscountRulesPanel } from "@/features/billing/components/family-discount-rules-panel";
import { StaffChildBenefitsPanel } from "@/features/billing/components/staff-child-benefits-panel";

export default function BillingRulesPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "ACCOUNTANT");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Règles de facturation</h1>
        <p className="text-sm text-gray-500">
          Exonérations, remises fratrie, remise année complète et avantages pour les enfants du personnel
        </p>
      </div>

      <Tabs defaultValue="exemptions">
        <TabsList>
          <TabsTrigger value="exemptions" icon={BadgePercent}>Exonérations</TabsTrigger>
          <TabsTrigger value="family" icon={Users}>Remises fratrie</TabsTrigger>
          <TabsTrigger value="early" icon={CalendarCheck}>Remise année complète</TabsTrigger>
          <TabsTrigger value="staff" icon={HeartHandshake}>Enfants du personnel</TabsTrigger>
        </TabsList>

        <TabsPanel value="exemptions"><ExemptionsPanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="family"><FamilyDiscountRulesPanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="early"><EarlyPaymentDiscountRulesPanel canWrite={canWrite} /></TabsPanel>
        <TabsPanel value="staff"><StaffChildBenefitsPanel canWrite={canWrite} /></TabsPanel>
      </Tabs>
    </div>
  );
}
