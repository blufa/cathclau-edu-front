import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function SubscriptionLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Vue d'ensemble", href: "/subscription" },
          { label: "Factures d'abonnement", href: "/subscription/invoices" },
        ]}
      />
      {children}
    </div>
  );
}
