"use client";

import { usePermissions } from "@/hooks/use-permissions";
import { Card, CardBody } from "@/components/ui/card";

/** Role guard for the blog back-office: SUPER_ADMIN or the restricted REDACTEUR role. */
export function RequireBlogAccess({ children }: { children: React.ReactNode }) {
  const { hasRole } = usePermissions();
  if (!hasRole("SUPER_ADMIN", "REDACTEUR")) {
    return (
      <Card>
        <CardBody className="py-10 text-center text-sm text-gray-500">
          Accès réservé aux administrateurs et rédacteurs du blog.
        </CardBody>
      </Card>
    );
  }
  return <>{children}</>;
}
