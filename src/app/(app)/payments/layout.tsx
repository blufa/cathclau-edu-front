import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          { label: "Encaissements par jour", href: "/payments/daily", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          { label: "Transactions & reçus", href: "/payments/transactions", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["transaction:read"], module: "PAYMENTS" },
          { label: "Session de caisse", href: "/payments/cashier-session", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"], permissions: ["paiement:create"], module: "PAYMENTS" },
        ]}
      />
      {children}
    </div>
  );
}
