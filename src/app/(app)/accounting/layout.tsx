import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function AccountingLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Comptabilité générale", href: "/accounting", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "ACCOUNTING" },
          { label: "Rapprochement bancaire", href: "/accounting/reconciliation", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
          { label: "Petite caisse", href: "/accounting/petty-cash", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"] },
          { label: "Session de caisse", href: "/accounting/cashier-session", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"] },
        ]}
      />
      {children}
    </div>
  );
}
