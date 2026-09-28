"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CircleDot } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { changeTenantStatus, createTenant, listPlatformUsers, searchTenants } from "@/lib/api/platform";
import { Badge } from "@/components/ui/badge";
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
  const [credentials, setCredentials] = useState<{
    school: string;
    slug: string;
    username: string | null;
    email: string | null;
    password: string | null;
  } | null>(null);

  const { data, loading, error, refetch } = useQuery(
    () => searchTenants({ status: status || undefined, city: city || undefined, page, size: PAGE_SIZE }),
    [status, city, page],
  );

  // Écoles ayant au moins un utilisateur actif dans les 5 dernières minutes (« connectée »).
  const usersQuery = useQuery(() => listPlatformUsers(), []);
  const onlineTenantIds = useMemo(
    () => new Set((usersQuery.data ?? []).filter((u) => u.online && u.tenantId != null).map((u) => u.tenantId)),
    [usersQuery.data],
  );

  async function handleCreate(input: CreateTenantInput) {
    try {
      const tenant = await createTenant(input);
      setCreating(false);
      notifySuccess("École créée");
      refetch();
      // Écran de fin : récap des accès (à remettre à l'école) + « par où commencer ».
      setCredentials({
        school: tenant.schoolName,
        slug: tenant.slug,
        username: input.username?.trim() || null,
        email: tenant.email ?? input.email ?? null,
        password: tenant.temporaryPassword ?? null,
      });
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
        <Link href={`/platform/tenants/detail?id=${t.id}`} className="font-medium text-brand-700 hover:underline">
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
    {
      key: "online",
      header: "Connectée",
      accessor: (t) => (onlineTenantIds.has(t.id) ? "En ligne" : "Hors ligne"),
      render: (t) => (
        <Badge tone={onlineTenantIds.has(t.id) ? "green" : "gray"}>
          <CircleDot className="mr-1 inline h-3 w-3" />
          {onlineTenantIds.has(t.id) ? "En ligne" : "Hors ligne"}
        </Badge>
      ),
    },
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

      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="École créée 🎉">
        {credentials && (() => {
          const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
          const rows: [string, string][] = [];
          if (credentials.username) rows.push(["Identifiant de connexion", credentials.username]);
          if (credentials.email) rows.push(["Email", credentials.email]);
          rows.push(["Mot de passe", credentials.password ?? "Celui que vous avez défini"]);
          rows.push(["Lien de connexion", loginUrl]);
          const copyText = [
            `École : ${credentials.school}`,
            credentials.username ? `Identifiant : ${credentials.username}` : "",
            credentials.email ? `Email : ${credentials.email}` : "",
            `Mot de passe : ${credentials.password ?? "(défini par l'administrateur)"}`,
            `Connexion : ${loginUrl}`,
          ].filter(Boolean).join("\n");
          return (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                <strong>{credentials.school}</strong> est prête. Remettez ces accès à l&apos;administrateur — il
                se connecte avec son <strong>identifiant</strong>{credentials.email ? " ou son email" : ""} et son mot de passe.
                {credentials.password && " Le mot de passe temporaire ne sera plus affiché ; notez-le."}
              </p>

              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50 text-sm">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 px-4 py-2.5">
                    <span className="text-slate-500">{label}</span>
                    <span className="truncate font-mono font-medium text-slate-900">{value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-800">Par où commencer ?</p>
                <p className="mt-1 text-slate-600">
                  Dès sa première connexion, un guide <strong>« Premiers pas »</strong> accompagne l&apos;administrateur,
                  étape par étape : créer les classes, ajouter les enseignants et les élèves, définir les frais
                  scolaires… sans avoir à chercher dans les menus.
                </p>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard
                      ?.writeText(copyText)
                      .then(() => notifySuccess("Accès copiés"))
                      .catch((e) => notifyError(e, "Copie impossible"));
                  }}
                >
                  Copier les accès
                </Button>
                <Button onClick={() => setCredentials(null)}>Terminé</Button>
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
