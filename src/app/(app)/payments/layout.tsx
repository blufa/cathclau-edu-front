import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          { label: "Encaissements par jour", href: "/payments/daily", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          { label: "Reçus", href: "/payments/transactions", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["recu:read"], module: "PAYMENTS" },
        ]}
      />
      {children}
    </div>
  );
}
