import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function PaymentsLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "PAYMENTS" },
          { label: "Transactions & reçus", href: "/payments/transactions", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "PAYMENTS" },
        ]}
      />
      {children}
    </div>
  );
}
