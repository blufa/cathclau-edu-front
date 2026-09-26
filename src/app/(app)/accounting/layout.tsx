import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function AccountingLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Comptabilité générale", href: "/accounting", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["comptabilite:manage"], module: "ACCOUNTING" },
          { label: "Rapprochement bancaire", href: "/accounting/reconciliation", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["comptabilite:manage"] },
          { label: "Petite caisse", href: "/accounting/petty-cash", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"], permissions: ["petite_caisse:manage", "petite_caisse:enregistrer"] },
          // "Session de caisse" (§retour comptable, point 27) a déménagé sous /payments — c'est là
          // qu'elle est utilisée au quotidien, avec les onglets Paiements ; un lien y menant depuis ce
          // layout-ci faisait perdre ces onglets (layout différent). Voir payments/layout.tsx.
        ]}
      />
      {children}
    </div>
  );
}
