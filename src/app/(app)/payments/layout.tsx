import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          { label: "Encaissements par jour", href: "/payments/daily", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          // §retour comptable : "ce jour tu inscris tant d'élèves en classe, voici les factures
          // encaissées, voici l'argent collecté" — croise inscriptions/encaissements/transferts d'UN
          // jour précis, contrairement à "Encaissements par jour" (paiements seuls, sur un mois).
          { label: "Journal du jour", href: "/payments/journal", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["dashboard:admin"], module: "PAYMENTS" },
          { label: "Reçus", href: "/payments/transactions", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["recu:read"], module: "PAYMENTS" },
        ]}
      />
      {children}
    </div>
  );
}
