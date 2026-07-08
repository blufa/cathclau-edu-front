"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardBody } from "@/components/ui/card";

/** Role guard for the platform-editor area: renders children only for SUPER_ADMIN. */
export function RequireSuperAdmin({ children }: { children: React.ReactNode }) {
  const { isSuperAdmin } = usePermissions();
  if (!isSuperAdmin) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-gray-500">
          Accès réservé à l&apos;administrateur de la plateforme.
        </CardBody>
      </Card>
    );
  }
  return <>{children}</>;
}
