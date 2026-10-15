"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@/hooks/use-query";
import {
  changeTenantStatus, deleteTenant, getTenantDetail, initiateSubscription, listPlans,
  setTenantNotifyStaffOnPayment, updateTenant,
} from "@/lib/api/platform";
import { setImpersonatedTenantId } from "@/lib/auth/impersonation";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { TenantStatusBadge } from "@/components/platform/status-badge";
import { QuotaProgress } from "@/components/platform/quota-progress";
import { TenantModulesPanel } from "@/components/platform/tenant-modules-panel";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";
import { ESTABLISHMENT_TYPE_LABEL, SUBSCRIPTION_STATUS_LABEL } from "@/lib/platform-labels";
import type { BillingPeriod, Tenant, UpdateTenantInput } from "@/lib/types/platform";

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
  const searchParams = useSearchParams();
  const id = Number(searchParams.get("id"));
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
  if (error || !data) return <p className="rounded-md bg-error-50 px-4 py-3 text-sm text-error-700">École introuvable.</p>;

  const t = data.tenant;

  async function toggleNotifyStaffOnPayment(enabled: boolean) {
    try {
      await setTenantNotifyStaffOnPayment(id, enabled);
      notifySuccess(enabled ? "Alerte personnel activée" : "Alerte personnel désactivée");
      refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/platform/tenants" className="text-sm text-brand-600 hover:underline">← Écoles</Link>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{t.schoolName}</h1>
          <div className="mt-1"><TenantStatusBadge status={t.status} /></div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => { setImpersonatedTenantId(t.id); router.push("/subscription/invoices"); }}
          >
            Basculer sur cette école (abonnement)
          </Button>
          <Button variant="secondary" onClick={() => setEditing(true)}>Modifier</Button>
          {t.status === "SUSPENDED" && <Button variant="ghost" onClick={() => doStatus("ACTIVATE", t.schoolName)}>Activer</Button>}
          {(t.status === "ACTIVE" || t.status === "TRIAL") && <Button variant="ghost" onClick={() => doStatus("SUSPEND", t.schoolName)}>Suspendre</Button>}
          {t.status !== "ARCHIVED" && <Button variant="ghost" className="text-error-600" onClick={() => doDelete(t.schoolName)}>Archiver</Button>}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Informations</CardTitle></CardHeader>
          <CardBody>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="Slug" value={t.slug} />
              <Info label="Type" value={t.establishmentTypes?.length ? t.establishmentTypes.map((x) => ESTABLISHMENT_TYPE_LABEL[x]).join(", ") : "—"} />
              <Info label="Email" value={t.email} />
              <Info label="Téléphone" value={t.phone} />
              <Info label="Second téléphone" value={t.phone2} />
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
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Info label="Plan" value={data.planName} />
              <Info label="Statut abonnement" value={data.subscriptionStatus ? SUBSCRIPTION_STATUS_LABEL[data.subscriptionStatus] : "—"} />
            </dl>
            <div>
              <p className="mb-1 text-xs text-gray-500">Quota élèves</p>
              <QuotaProgress consumed={data.consumedStudents} limit={data.studentLimit} />
            </div>
            {!data.subscriptionStatus && (
              <CreateSubscriptionSection
                tenantId={t.id}
                onCreated={() => {
                  refetch();
                  setImpersonatedTenantId(t.id);
                  router.push("/subscription/invoices");
                }}
              />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Notifications</CardTitle></CardHeader>
        <CardBody>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Alerter le personnel à chaque paiement reçu</p>
              <p className="text-xs text-gray-500">
                Le parent reçoit toujours un SMS de confirmation. Activez ceci pour qu&apos;en plus, le
                fondateur/SCHOOL_ADMIN et la personne qui a physiquement encaissé reçoivent aussi un SMS
                à chaque paiement — désactivé par défaut.
              </p>
            </div>
            <Switch
              checked={t.notifyStaffOnPayment}
              onChange={toggleNotifyStaffOnPayment}
              ariaLabel="Alerter le personnel à chaque paiement reçu"
            />
          </div>
        </CardBody>
      </Card>

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

/**
 * Les écoles ne souscrivent pas elles-mêmes pour l'instant (§platform) : c'est l'administrateur de la
 * plateforme qui crée l'école, donc c'est ici, sur sa fiche, qu'il doit pouvoir créer son abonnement —
 * jusque-là `initiateSubscription` existait côté API sans jamais être appelé par aucun écran.
 */
function CreateSubscriptionSection({ tenantId, onCreated }: { tenantId: number; onCreated: () => void }) {
  const plansQuery = useQuery(() => listPlans(), []);
  const [planId, setPlanId] = useState("");
  const [period, setPeriod] = useState<BillingPeriod>("MONTHLY");
  const [submitting, setSubmitting] = useState(false);
  const plans = (plansQuery.data ?? []).filter((p) => !p.archived);

  async function create() {
    if (!planId) return;
    setSubmitting(true);
    try {
      await initiateSubscription({ tenantId, planId: Number(planId), billingPeriod: period, autoRenewal: true });
      notifySuccess("Abonnement créé — facture générée, à payer sur la fiche de l'école.");
      onCreated();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3">
      <p className="mb-2 text-sm font-medium text-slate-700">Aucun abonnement — en créer un</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field>
          <Label>Plan</Label>
          <Select className="min-w-[180px]" value={planId} onChange={(e) => setPlanId(e.target.value)}>
            <option value="">Choisir…</option>
            {plans.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Périodicité</Label>
          <Select className="min-w-[140px]" value={period} onChange={(e) => setPeriod(e.target.value as BillingPeriod)}>
            <option value="MONTHLY">Mensuel</option>
            <option value="ANNUAL">Annuel</option>
          </Select>
        </Field>
        <Button onClick={create} loading={submitting} disabled={!planId}>Créer l&apos;abonnement</Button>
      </div>
    </div>
  );
}

const schema = z.object({
  schoolName: z.string().trim().min(1, "Nom requis"),
  email: z.string(),
  phone: z.string(),
  phone2: z.string(),
  city: z.string(),
  country: z.string(),
  director: z.string(),
  logo: z.string(),
  brandColor: z.string(),
  website: z.string(),
});
type FormValues = z.infer<typeof schema>;

function EditTenantForm({ tenant, onCancel, onSaved }: { tenant: Tenant; onCancel: () => void; onSaved: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      schoolName: tenant.schoolName, email: tenant.email ?? "", phone: tenant.phone ?? "", phone2: tenant.phone2 ?? "",
      city: tenant.city ?? "", country: tenant.country ?? "", director: tenant.director ?? "",
      logo: "", brandColor: "", website: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: FormValues) {
    setSubmitting(true);
    try {
      await updateTenant(tenant.id, values as UpdateTenantInput);
      notifySuccess("École mise à jour");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Nom <span className="text-error-500">*</span></Label>
        <Input value={v.schoolName} onChange={(e) => setValue("schoolName", e.target.value)} aria-invalid={!!errors.schoolName} />
        {errors.schoolName && <p className="text-xs text-error-600">{errors.schoolName.message}</p>}
      </Field>
      <Field>
        <Label>Email</Label>
        <Input value={v.email} onChange={(e) => setValue("email", e.target.value)} />
      </Field>
      <PhoneInput label="Téléphone de l'école" value={v.phone} onChange={(val) => setValue("phone", val)} />
      <PhoneInput label="Second téléphone (optionnel)" value={v.phone2} onChange={(val) => setValue("phone2", val)} />
      <Field>
        <Label>Ville</Label>
        <Input value={v.city} onChange={(e) => setValue("city", e.target.value)} />
      </Field>
      <Field>
        <Label>Pays</Label>
        <Input value={v.country} onChange={(e) => setValue("country", e.target.value)} />
      </Field>
      <Field>
        <Label>Directeur</Label>
        <Input value={v.director} onChange={(e) => setValue("director", e.target.value)} />
      </Field>
      <Field>
        <Label>Logo (URL)</Label>
        <Input value={v.logo} onChange={(e) => setValue("logo", e.target.value)} />
      </Field>
      <Field>
        <Label>Couleur de marque</Label>
        <Input placeholder="#4f46e5" value={v.brandColor} onChange={(e) => setValue("brandColor", e.target.value)} />
      </Field>
      <Field>
        <Label>Site web</Label>
        <Input value={v.website} onChange={(e) => setValue("website", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={submitting}>Enregistrer</Button>
      </div>
    </form>
  );
}
