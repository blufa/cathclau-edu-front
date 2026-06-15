"use client";

import { Tabs, Title } from "@mantine/core";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { LevelsPanel } from "@/components/referentials/levels-panel";
import { RoomsPanel } from "@/components/referentials/rooms-panel";
import { SubjectsPanel } from "@/components/referentials/subjects-panel";

export default function ReferentialsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  return (
    <div className="space-y-5">
      <div>
        <Title order={2}>Référentiels</Title>
        <p className="text-sm text-gray-500">Niveaux, salles et matières de l&apos;établissement</p>
      </div>

      <Tabs defaultValue="levels" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="levels">Niveaux</Tabs.Tab>
          <Tabs.Tab value="rooms">Salles</Tabs.Tab>
          <Tabs.Tab value="subjects">Matières</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="levels">
          <LevelsPanel canWrite={canWrite} />
        </Tabs.Panel>
        <Tabs.Panel value="rooms">
          <RoomsPanel canWrite={canWrite} />
        </Tabs.Panel>
        <Tabs.Panel value="subjects">
          <SubjectsPanel canWrite={canWrite} />
        </Tabs.Panel>
      </Tabs>
    </div>
  );
}
