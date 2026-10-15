import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function EnrollmentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Nouvelle inscription", href: "/enrollments/bulk-family", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:create"], module: "STUDENTS" },
          { label: "Réinscription (rentrée)", href: "/enrollments/re-enrollment", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:create"], module: "STUDENTS" },
          { label: "Mouvements & attente", href: "/enrollments/movements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], module: "STUDENTS" },
          { label: "Tableau de la rentrée", href: "/enrollments/overview", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], module: "STUDENTS" },
          // Mêmes rôles/permission que l'onglet "Relances paiement" sous Communication — ACCOUNTANT
          // ajouté ici volontairement (absent des autres onglets de cette barre), voir la même note
          // dans navigation.ts (§retour comptable, "Inscription et rentrée" plutôt que "Communication").
          { label: "Suivi des paiements", href: "/communications/payment-reminders", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"], permissions: ["communication:send"], module: "STUDENTS" },
        ]}
      />
      {children}
    </div>
  );
}
