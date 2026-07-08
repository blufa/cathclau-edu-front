"use client";

import { Tabs } from "@mantine/core";
import { Bus, Users } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { Reveal } from "@/components/public/reveal";
import { RoutesTab } from "@/components/transport/routes-tab";
import { SubscriptionsTab } from "@/components/transport/subscriptions-tab";

export default function TransportPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY")) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé à l&apos;administration.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Transport</h1>
        <p className="text-sm text-slate-500">Lignes de bus, arrêts et abonnements des élèves</p>
      </Reveal>
      <Tabs defaultValue="routes" color="teal" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="routes" leftSection={<Bus className="h-4 w-4" />}>Lignes</Tabs.Tab>
          <Tabs.Tab value="subs" leftSection={<Users className="h-4 w-4" />}>Abonnements</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="routes" pt="lg"><RoutesTab /></Tabs.Panel>
        <Tabs.Panel value="subs" pt="lg"><SubscriptionsTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
