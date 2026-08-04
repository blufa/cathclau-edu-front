"use client";

import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Layers, DoorOpen, BookOpen } from "lucide-react";
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
        <h1 className="text-2xl font-semibold text-gray-900">Référentiels</h1>
        <p className="text-sm text-gray-500">Niveaux, salles et matières de l&apos;établissement</p>
      </div>

      <Tabs defaultValue="levels">
        <TabsList>
          <TabsTrigger value="levels" icon={Layers}>Niveaux</TabsTrigger>
          <TabsTrigger value="rooms" icon={DoorOpen}>Salles</TabsTrigger>
          <TabsTrigger value="subjects" icon={BookOpen}>Matières</TabsTrigger>
        </TabsList>

        <TabsPanel value="levels">
          <LevelsPanel canWrite={canWrite} />
        </TabsPanel>
        <TabsPanel value="rooms">
          <RoomsPanel canWrite={canWrite} />
        </TabsPanel>
        <TabsPanel value="subjects">
          <SubjectsPanel canWrite={canWrite} />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
