import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function InvoicesLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Factures élèves", href: "/invoices", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "BILLING" },
          { label: "Frais scolaires", href: "/invoices/fees", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"], module: "BILLING" },
          { label: "Règles de facturation", href: "/invoices/rules", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"], module: "BILLING" },
        ]}
      />
      {children}
    </div>
  );
}
