import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Utilisateurs", href: "/users", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["user:read"] },
          { label: "Rôles & permissions", href: "/users/roles", roles: ["SCHOOL_ADMIN"], permissions: ["role:read"] },
        ]}
      />
      {children}
    </div>
  );
}
