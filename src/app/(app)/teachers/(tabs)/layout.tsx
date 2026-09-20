import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function TeachersLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Enseignants", href: "/teachers", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["enseignant:read"], module: "STAFF" },
          { label: "Personnel administratif", href: "/teachers/staff", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["personnel:read"], module: "STAFF" },
        ]}
      />
      {children}
    </div>
  );
}
