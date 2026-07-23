import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function CommunicationsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Messages", href: "/communications", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], module: "COMMUNICATION" },
          { label: "Annonces", href: "/communications/announcements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"] },
          { label: "Modèles", href: "/communications/templates", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "COMMUNICATION" },
        ]}
      />
      {children}
    </div>
  );
}
