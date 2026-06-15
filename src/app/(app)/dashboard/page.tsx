"use client";

import { useAuth } from "@/providers/auth-provider";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">
          Bonjour {user.firstName} 👋
        </h1>
        <p className="text-sm text-gray-500">
          Bienvenue sur votre espace LacaÉducation.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardBody className="space-y-1 text-sm text-gray-700">
            <p>
              <span className="text-gray-500">Nom :</span> {user.firstName} {user.lastName}
            </p>
            <p>
              <span className="text-gray-500">Email :</span> {user.email}
            </p>
            <p>
              <span className="text-gray-500">Tenant :</span> {user.tenantId ?? "—"}
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rôles</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                >
                  {role}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-2xl font-semibold text-gray-900">{user.permissions.length}</p>
            <p className="text-sm text-gray-500">permissions actives</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody className="text-sm text-gray-500">
          Les indicateurs (effectifs, assiduité, recouvrement…) seront branchés sur
          l&apos;endpoint <code className="rounded bg-gray-100 px-1">/api/v1/dashboard</code> à
          l&apos;étape suivante.
        </CardBody>
      </Card>
    </div>
  );
}
