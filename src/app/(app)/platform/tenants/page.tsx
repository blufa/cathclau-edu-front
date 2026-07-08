"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@/hooks/use-query";
import { changeTenantStatus, createTenant, searchTenants } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { TenantForm } from "@/components/platform/tenant-form";
import { TenantStatusBadge } from "@/components/platform/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";
import { ESTABLISHMENT_TYPE_LABEL, TENANT_STATUS_LABEL } from "@/lib/platform-labels";
import { TENANT_STATUSES, type CreateTenantInput, type Tenant } from "@/lib/types/platform";

const PAGE_SIZE = 20;

export default function PlatformTenantsPage() {
  return (
    <RequireSuperAdmin>
      <TenantsTable />
    </RequireSuperAdmin>
  );
}

function TenantsTable() {
  const [status, setStatus] = useState("");
  const [cityInput, setCityInput] = useState("");
  const [city, setCity] = useState("");
  const [page, setPage] = useState(0);
  const [creating, setCreating] = useState(false);
  // Identifiants affichés une seule fois après création avec mot de passe généré.
  const [credentials, setCredentials] = useState<{ school: string; email: string | null; password: string } | null>(null);

  const { data, loading, error, refetch } = useQuery(
    () => searchTenants({ status: status || undefined, city: city || undefined, page, size: PAGE_SIZE }),
    [status, city, page],
  );

  async function handleCreate(input: CreateTenantInput) {
    try {
      const tenant = await createTenant(input);
      setCreating(false);
      notifySuccess("École créée");
      refetch();
      // Mot de passe généré → on l'affiche une seule fois au SUPER_ADMIN (aussi envoyé par email).
      if (tenant.temporaryPassword) {
        setCredentials({ school: tenant.schoolName, email: tenant.email, password: tenant.temporaryPassword });
      }
    } catch (err) {
      notifyError(err);
    }
  }

  function doStatus(t: Tenant, action: "ACTIVATE" | "SUSPEND" | "ARCHIVE") {
    const labels = { ACTIVATE: "Activer", SUSPEND: "Suspendre", ARCHIVE: "Archiver" };
    confirmAction({
      title: `${labels[action]} l'école`,
      message: `${labels[action]} l'école « ${t.schoolName} » ?`,
      confirmLabel: labels[action],
      danger: action !== "ACTIVATE",
      onConfirm: async () => {
        try {
          await changeTenantStatus(t.id, action);
          notifySuccess("Statut mis à jour");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const columns: Column<Tenant>[] = [
    {
      key: "schoolName",
      header: "École",
      accessor: (t) => t.schoolName,
      render: (t) => (
        <Link href={`/platform/tenants/${t.id}`} className="font-medium text-brand-700 hover:underline">
          {t.schoolName}
        </Link>
      ),
    },
    { key: "city", header: "Ville", accessor: (t) => t.city ?? "", render: (t) => t.city ?? "—" },
    {
      key: "type",
      header: "Type",
      accessor: (t) => (t.establishmentTypes?.map((x) => ESTABLISHMENT_TYPE_LABEL[x]).join(", ") ?? ""),
      render: (t) => (t.establishmentTypes?.length ? t.establishmentTypes.map((x) => ESTABLISHMENT_TYPE_LABEL[x]).join(", ") : "—"),
    },
    { key: "status", header: "Statut", accessor: (t) => t.status, render: (t) => <TenantStatusBadge status={t.status} /> },
    { key: "createdAt", header: "Créée le", accessor: (t) => t.createdAt ?? "", render: (t) => formatDate(t.createdAt) },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (t) => (
        <div className="flex justify-end gap-1">
          {t.status === "SUSPENDED" && <Button size="sm" variant="ghost" onClick={() => doStatus(t, "ACTIVATE")}>Activer</Button>}
          {(t.status === "ACTIVE" || t.status === "TRIAL") && <Button size="sm" variant="ghost" onClick={() => doStatus(t, "SUSPEND")}>Suspendre</Button>}
          {t.status !== "ARCHIVED" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => doStatus(t, "ARCHIVE")}>Archiver</Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Écoles</h1>
          <p className="text-sm text-gray-500">Gestion des établissements clients de la plateforme.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Nouvelle école</Button>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); setPage(0); setCity(cityInput.trim()); }}
        className="flex flex-wrap items-center gap-3"
      >
        <Select className="max-w-[220px]" value={status} onChange={(e) => { setPage(0); setStatus(e.target.value); }}>
          <option value="">Tous les statuts</option>
          {TENANT_STATUSES.map((s) => (<option key={s} value={s}>{TENANT_STATUS_LABEL[s]}</option>))}
        </Select>
        <Input className="max-w-xs" placeholder="Ville…" value={cityInput} onChange={(e) => setCityInput(e.target.value)} />
        <Button type="submit" variant="secondary">Filtrer</Button>
      </form>

      <DataTable
        columns={columns}
        page={data}
        loading={loading}
        error={!!error}
        getRowKey={(t) => t.id}
        onPageChange={setPage}
        emptyLabel="Aucune école."
        searchable
        searchPlaceholder="Rechercher une école…"
        columnToggle
        exportable
        exportFilename="ecoles.csv"
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle école">
        <TenantForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Identifiants de l'administrateur">
        {credentials && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Voici le mot de passe temporaire de l&apos;administrateur de{" "}
              <strong>{credentials.school}</strong>. Il a aussi été envoyé par email. Notez-le
              maintenant : il ne sera plus affiché. L&apos;administrateur devra le changer à sa première connexion.
            </p>
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-sm">
              <div className="flex justify-between gap-4 py-1">
                <span className="text-gray-500">Email</span>
                <span className="font-medium">{credentials.email ?? "—"}</span>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <span className="text-gray-500">Mot de passe temporaire</span>
                <span className="font-mono font-semibold">{credentials.password}</span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(`Email : ${credentials.email ?? ""}\nMot de passe : ${credentials.password}`)
                    .then(() => notifySuccess("Identifiants copiés"))
                    .catch((e) => notifyError(e, "Copie impossible"));
                }}
              >
                Copier
              </Button>
              <Button onClick={() => setCredentials(null)}>J&apos;ai noté</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
