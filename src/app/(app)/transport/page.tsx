"use client";

import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Bus, Users } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { Reveal } from "@/components/public/reveal";
import { RoutesTab } from "@/components/transport/routes-tab";
import { SubscriptionsTab } from "@/components/transport/subscriptions-tab";

export default function TransportPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY")) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé à l&apos;administration.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Transport</h1>
        <p className="text-sm text-gray-500">Lignes de bus, arrêts et abonnements des élèves</p>
      </Reveal>
      <Tabs defaultValue="routes">
        <TabsList>
          <TabsTrigger value="routes" icon={Bus}>Lignes</TabsTrigger>
          <TabsTrigger value="subs" icon={Users}>Abonnements</TabsTrigger>
        </TabsList>
        <TabsPanel value="routes"><RoutesTab /></TabsPanel>
        <TabsPanel value="subs"><SubscriptionsTab /></TabsPanel>
      </Tabs>
    </div>
  );
}
