import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function BudgetLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Budget annuel", href: "/budget", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["budget:manage", "budget:approve"] },
          { label: "Subventions", href: "/budget/grants", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["budget:manage"] },
          { label: "Dépenses", href: "/budget/expenses", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["depense:create", "depense:approve"], module: "EXPENSES" },
        ]}
      />
      {children}
    </div>
  );
}
