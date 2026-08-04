import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function UsersLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Utilisateurs", href: "/users", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
          { label: "Rôles & permissions", href: "/users/roles", roles: ["SCHOOL_ADMIN"] },
        ]}
      />
      {children}
    </div>
  );
}
