import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function EnrollmentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Inscriptions", href: "/enrollments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
          { label: "Réinscription (rentrée)", href: "/enrollments/re-enrollment", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
          { label: "Mouvements & attente", href: "/enrollments/movements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
          { label: "Tableau de la rentrée", href: "/enrollments/overview", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
        ]}
      />
      {children}
    </div>
  );
}
