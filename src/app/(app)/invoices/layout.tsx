import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Factures élèves", href: "/invoices", permissions: ["facture:read"], module: "BILLING" },
          { label: "Frais scolaires", href: "/invoices/fees", permissions: ["frais_scolaire:read"], module: "BILLING" },
          { label: "Règles de facturation", href: "/invoices/rules", permissions: ["regle_facturation:read"], module: "BILLING" },
        ]}
      />
      {children}
    </div>
  );
}
