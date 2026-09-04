"use client";

import { Camera, Fingerprint, HardDrive, IdCard, ListChecks, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { Reveal } from "@/components/public/reveal";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { DevicesTab } from "@/components/biometric/devices-tab";
import { EnrollTab } from "@/components/biometric/enroll-tab";
import { LogTab } from "@/components/biometric/log-tab";
import { CameraCheckinTab } from "@/components/biometric/camera-checkin-tab";
import { BadgesTab } from "@/components/biometric/badges-tab";

export default function BiometricPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") && !hasAnyPermission(user, ["biometrique:manage"])) {
    return <p className="rounded-xl bg-error-50 px-4 py-6 text-sm text-error-700">Accès réservé à l&apos;administration.</p>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Fingerprint className="h-6 w-6 text-brand-600" /> Biométrie
        </h1>
        <p className="text-sm text-gray-500">Appareils, enrôlements, pointages — et pointage par caméra (ordinateur ou téléphone)</p>
      </Reveal>

      <Tabs defaultValue="camera">
        <TabsList>
          <TabsTrigger value="camera" icon={Camera}>Pointage caméra</TabsTrigger>
          <TabsTrigger value="badges" icon={IdCard}>Badges</TabsTrigger>
          <TabsTrigger value="devices" icon={HardDrive}>Appareils</TabsTrigger>
          <TabsTrigger value="enroll" icon={UserPlus}>Enrôlements</TabsTrigger>
          <TabsTrigger value="log" icon={ListChecks}>Journal</TabsTrigger>
        </TabsList>
        <TabsPanel value="camera"><CameraCheckinTab /></TabsPanel>
        <TabsPanel value="badges"><BadgesTab /></TabsPanel>
        <TabsPanel value="devices"><DevicesTab /></TabsPanel>
        <TabsPanel value="enroll"><EnrollTab /></TabsPanel>
        <TabsPanel value="log"><LogTab /></TabsPanel>
      </Tabs>
    </div>
  );
}
