import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function StudentLifeLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Discipline", href: "/student-life/discipline", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], permissions: ["discipline:manage"] },
          { label: "Santé / Infirmerie", href: "/student-life/health", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], permissions: ["sante:read", "sante:manage"] },
        ]}
      />
      {children}
    </div>
  );
}
