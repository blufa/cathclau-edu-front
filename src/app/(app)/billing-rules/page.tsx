"use client";

import { Tabs, Title } from "@mantine/core";
import { BadgePercent, Users, HeartHandshake } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { ExemptionsPanel } from "@/components/billing/exemptions-panel";
import { FamilyDiscountRulesPanel } from "@/components/billing/family-discount-rules-panel";
import { StaffChildBenefitsPanel } from "@/components/billing/staff-child-benefits-panel";

export default function BillingRulesPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "ACCOUNTANT");

  return (
    <div className="space-y-5">
      <div>
        <Title order={2}>Règles de facturation</Title>
        <p className="text-sm text-gray-500">
          Exonérations, remises fratrie et avantages pour les enfants du personnel
        </p>
      </div>

      <Tabs defaultValue="exemptions" color="brand" variant="pills" radius="md" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="exemptions" leftSection={<BadgePercent className="h-4 w-4" />}>Exonérations</Tabs.Tab>
          <Tabs.Tab value="family" leftSection={<Users className="h-4 w-4" />}>Remises fratrie</Tabs.Tab>
          <Tabs.Tab value="staff" leftSection={<HeartHandshake className="h-4 w-4" />}>Enfants du personnel</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="exemptions"><ExemptionsPanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="family"><FamilyDiscountRulesPanel canWrite={canWrite} /></Tabs.Panel>
        <Tabs.Panel value="staff"><StaffChildBenefitsPanel canWrite={canWrite} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
