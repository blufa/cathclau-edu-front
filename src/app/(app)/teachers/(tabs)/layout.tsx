import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function TeachersLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Enseignants", href: "/teachers", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "STAFF" },
          { label: "Personnel administratif", href: "/teachers/staff", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "STAFF" },
        ]}
      />
      {children}
    </div>
  );
}
