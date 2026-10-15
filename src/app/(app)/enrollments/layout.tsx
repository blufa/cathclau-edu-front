import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function EnrollmentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Nouvelle inscription", href: "/enrollments/bulk-family", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:create"], module: "STUDENTS" },
          // ACCOUNTANT ajouté ici volontairement (absent des autres onglets de cette barre) — seule
          // porte d'entrée désormais pour "Suivi des paiements" (retiré de la barre Communication, voir
          // communications/layout.tsx : rester dans le même onglet visuel en cliquant depuis
          // "Inscription et rentrée").
          { label: "Combien pour démarrer ?", href: "/enrollments/cost-preview", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"], permissions: ["frais_scolaire:read"], module: "STUDENTS" },
          { label: "Suivi des paiements", href: "/enrollments/payment-status", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"], permissions: ["communication:send"], module: "STUDENTS" },
          { label: "Réinscription (rentrée)", href: "/enrollments/re-enrollment", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:create"], module: "STUDENTS" },
          { label: "Mouvements & attente", href: "/enrollments/movements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], module: "STUDENTS" },
          { label: "Tableau de la rentrée", href: "/enrollments/overview", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], module: "STUDENTS" },
        ]}
      />
      {children}
    </div>
  );
}
