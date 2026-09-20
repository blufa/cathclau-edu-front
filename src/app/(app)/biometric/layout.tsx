import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function BiometricLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Biométrie", href: "/biometric", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["biometrique:manage"] },
          { label: "Webhooks", href: "/biometric/webhooks", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["webhook:manage"], module: "WEBHOOKS" },
        ]}
      />
      {children}
    </div>
  );
}
