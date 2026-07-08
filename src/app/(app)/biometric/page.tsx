"use client";

import { Tabs } from "@mantine/core";
import { Camera, Fingerprint, HardDrive, IdCard, ListChecks, UserPlus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { Reveal } from "@/components/public/reveal";
import { DevicesTab } from "@/components/biometric/devices-tab";
import { EnrollTab } from "@/components/biometric/enroll-tab";
import { LogTab } from "@/components/biometric/log-tab";
import { CameraCheckinTab } from "@/components/biometric/camera-checkin-tab";
import { BadgesTab } from "@/components/biometric/badges-tab";

export default function BiometricPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR")) {
    return <p className="rounded-xl bg-red-50 px-4 py-6 text-sm text-red-700">Accès réservé à l&apos;administration.</p>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <Fingerprint className="h-6 w-6 text-brand-600" /> Biométrie
        </h1>
        <p className="text-sm text-slate-500">Appareils, enrôlements, pointages — et pointage par caméra (ordinateur ou téléphone)</p>
      </Reveal>

      <Tabs defaultValue="camera" color="teal" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="camera" leftSection={<Camera className="h-4 w-4" />}>Pointage caméra</Tabs.Tab>
          <Tabs.Tab value="badges" leftSection={<IdCard className="h-4 w-4" />}>Badges</Tabs.Tab>
          <Tabs.Tab value="devices" leftSection={<HardDrive className="h-4 w-4" />}>Appareils</Tabs.Tab>
          <Tabs.Tab value="enroll" leftSection={<UserPlus className="h-4 w-4" />}>Enrôlements</Tabs.Tab>
          <Tabs.Tab value="log" leftSection={<ListChecks className="h-4 w-4" />}>Journal</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="camera" pt="lg"><CameraCheckinTab /></Tabs.Panel>
        <Tabs.Panel value="badges" pt="lg"><BadgesTab /></Tabs.Panel>
        <Tabs.Panel value="devices" pt="lg"><DevicesTab /></Tabs.Panel>
        <Tabs.Panel value="enroll" pt="lg"><EnrollTab /></Tabs.Panel>
        <Tabs.Panel value="log" pt="lg"><LogTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}
