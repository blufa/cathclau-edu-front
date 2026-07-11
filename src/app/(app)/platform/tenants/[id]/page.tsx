"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import { changeTenantStatus, deleteTenant, getTenantDetail, updateTenant } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { TenantStatusBadge } from "@/components/platform/status-badge";
import { QuotaProgress } from "@/components/platform/quota-progress";
import { TenantModulesPanel } from "@/components/platform/tenant-modules-panel";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";
import { ESTABLISHMENT_TYPE_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/platform-labels";
import type { Tenant, UpdateTenantInput } from "@/lib/types/platform";

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{value || "—"}</dd>
    </div>
  );
}

export default function TenantDetailPage() {
  return (
    <RequireSuperAdmin>
      <TenantDetail />
    </RequireSuperAdmin>
  );
}

function TenantDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  const { data, loading, error, refetch } = useQuery(() => getTenantDetail(id), [id]);

  function doStatus(action: "ACTIVATE" | "SUSPEND" | "ARCHIVE", name: string) {
    const labels = { ACTIVATE: "Activer", SUSPEND: "Suspendre", ARCHIVE: "Archiver" };
    confirmAction({
      title: `${labels[action]} l'école`,
      message: `${labels[action]} « ${name} » ?`,
      confirmLabel: labels[action],
      danger: action !== "ACTIVATE",
      onConfirm: async () => {
        try {
          await changeTenantStatus(id, action);
          notifySuccess("Statut mis à jour");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  function doDelete(name: string) {
    confirmAction({
      title: "Supprimer l'école",
      message: `Archiver définitivement « ${name} » (suppression logique) ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteTenant(id);
          notifySuccess("École archivée");
          router.push("/platform/tenants");
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  if (loading && !data) return <div className="flex justify-center py-16"><Spinner /></div>;
  if (error || !data) return <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">École introuvable.</p>;

  const t = data.tenant;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/platform/tenants" className="text-sm text-indigo-600 hover:underline">← Écoles</Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{t.schoolName}</h1>
          <div className="mt-1"><TenantStatusBadge status={t.status} /></div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>Modifier</Button>
          {t.status === "SUSPENDED" && <Button variant="ghost" onClick={() => doStatus("ACTIVATE", t.schoolName)}>Activer</Button>}
          {(t.status === "ACTIVE" || t.status === "TRIAL") && <Button variant="ghost" onClick={() => doStatus("SUSPEND", t.schoolName)}>Suspendre</Button>}
          {t.status !== "ARCHIVED" && <Button variant="ghost" className="text-red-600" onClick={() => doDelete(t.schoolName)}>Archiver</Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid grid-cols-2 gap-4">
              <Info label="Slug" value={t.slug} />
              <Info label="Type" value={t.establishmentTypes?.length ? t.establishmentTypes.map((x) => ESTABLISHMENT_TYPE_LABEL[x]).join(", ") : "—"} />
              <Info label="Email" value={t.email} />
              <Info label="Téléphone" value={t.phone} />
              <Info label="Ville" value={t.city} />
              <Info label="Pays" value={t.country} />
              <Info label="Directeur" value={t.director} />
              <Info label="Créée le" value={formatDate(t.createdAt)} />
              <Info label="Fin d'essai" value={formatDate(t.trialEndsAt)} />
              <Info label="Activée le" value={formatDate(t.activatedAt)} />
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><CardTitle>Abonnement & quota</CardTitle></CardHeader>
          <CardBody className="space-y-4">
            <dl className="grid grid-cols-2 gap-4">
              <Info label="Plan" value={data.planName} />
              <Info label="Statut abonnement" value={data.subscriptionStatus ? SUBSCRIPTION_STATUS_LABEL[data.subscriptionStatus] : "—"} />
            </dl>
            <div>
              <p className="mb-1 text-xs text-gray-500">Quota élèves</p>
              <QuotaProgress consumed={data.consumedStudents} limit={data.studentLimit} />
            </div>
          </CardBody>
        </Card>
      </div>

      <TenantModulesPanel tenantId={t.id} />

      <Modal open={editing} onClose={() => setEditing(false)} title="Modifier l'école">
        <EditTenantForm
          tenant={t}
          onCancel={() => setEditing(false)}
          onSaved={() => { setEditing(false); refetch(); }}
        />
      </Modal>
    </div>
  );
}

function EditTenantForm({ tenant, onCancel, onSaved }: { tenant: Tenant; onCancel: () => void; onSaved: () => void }) {
  const form = useForm<UpdateTenantInput>({
    mode: "controlled",
    initialValues: {
      schoolName: tenant.schoolName, email: tenant.email ?? "", phone: tenant.phone ?? "",
      city: tenant.city ?? "", country: tenant.country ?? "", director: tenant.director ?? "",
      logo: "", brandColor: "", website: "",
    },
    validate: { schoolName: (v) => (v.trim() ? null : "Nom requis") },
  });

  async function submit(values: UpdateTenantInput) {
    try {
      await updateTenant(tenant.id, values);
      notifySuccess("École mise à jour");
      onSaved();
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Nom" withAsterisk {...form.getInputProps("schoolName")} />
        <TextInput label="Email" {...form.getInputProps("email")} />
        <PhoneInput label="Téléphone" {...form.getInputProps("phone")} />
        <TextInput label="Ville" {...form.getInputProps("city")} />
        <TextInput label="Pays" {...form.getInputProps("country")} />
        <TextInput label="Directeur" {...form.getInputProps("director")} />
        <TextInput label="Logo (URL)" {...form.getInputProps("logo")} />
        <TextInput label="Couleur de marque" placeholder="#4f46e5" {...form.getInputProps("brandColor")} />
        <TextInput label="Site web" {...form.getInputProps("website")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit">Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}
