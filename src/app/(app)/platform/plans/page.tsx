"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@/hooks/use-query";
import { archivePlan, createPlan, deletePlan, listPlans, setPlanDefaultTrial, updatePlan } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { PlanModulesModal } from "@/components/platform/plan-modules-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";
import { PLAN_CODES, type Plan, type PlanCode, type PlanInput } from "@/lib/types/platform";

export default function PlatformPlansPage() {
  return (
    <RequireSuperAdmin>
      <PlansTable />
    </RequireSuperAdmin>
  );
}

function PlansTable() {
  const { data, loading, error, refetch } = useQuery(() => listPlans(), []);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [modulesPlan, setModulesPlan] = useState<Plan | null>(null);

  function makeDefaultTrial(plan: Plan) {
    confirmAction({
      title: "Plan d'essai par défaut",
      message: `Désigner « ${plan.name} » comme plan d'essai par défaut (les écoles sans plan y seront affectées) ?`,
      confirmLabel: "Confirmer",
      onConfirm: async () => {
        try { await setPlanDefaultTrial(plan.id); notifySuccess("Plan d'essai par défaut défini"); refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  function archive(plan: Plan) {
    confirmAction({
      title: "Archiver le plan",
      message: `Archiver « ${plan.name} » ? Il ne sera plus souscriptible mais restera valable pour les abonnements en cours.`,
      confirmLabel: "Archiver",
      onConfirm: async () => {
        try { await archivePlan(plan.id); notifySuccess("Plan archivé"); refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  function remove(plan: Plan) {
    confirmAction({
      title: "Supprimer le plan",
      message: `Supprimer définitivement « ${plan.name} » ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try { await deletePlan(plan.id); notifySuccess("Plan supprimé"); refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Plans d&apos;abonnement</h1>
          <p className="text-sm text-gray-500">Catalogue des plans proposés aux écoles.</p>
        </div>
        <Button onClick={() => setCreating(true)}>Nouveau plan</Button>
      </div>

      {error ? (
        <p className="rounded-md bg-error-50 px-4 py-3 text-sm text-error-700">Impossible de charger les plans.</p>
      ) : loading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Nom</TH><TH>Code</TH><TH>Limite élèves</TH><TH>Mensuel</TH><TH>Annuel</TH><TH>État</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {data?.length === 0 && (
              <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucun plan.</TD></TR>
            )}
            {data?.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium">{p.name}</TD>
                <TD><Badge tone="indigo">{p.code}</Badge></TD>
                <TD>{p.studentLimit ?? "Illimité"}</TD>
                <TD>{formatGNF(p.monthlyPrice)}</TD>
                <TD>{formatGNF(p.annualPrice)}</TD>
                <TD>{p.archived ? <Badge tone="gray">Archivé</Badge> : <Badge tone="green">Actif</Badge>}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setModulesPlan(p)}>Modules</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => makeDefaultTrial(p)}>Trial déf.</Button>
                    {!p.archived && <Button size="sm" variant="ghost" onClick={() => archive(p)}>Archiver</Button>}
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(p)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <PlanModulesModal
        planId={modulesPlan?.id ?? null}
        planName={modulesPlan?.name ?? ""}
        open={!!modulesPlan}
        onClose={() => setModulesPlan(null)}
      />

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau plan">
        <PlanForm
          onCancel={() => setCreating(false)}
          onSubmit={async (input) => { await createPlan(input); setCreating(false); notifySuccess("Plan créé"); refetch(); }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le plan">
        {editing && (
          <PlanForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (input) => {
              const { code: _code, ...rest } = input;
              void _code;
              await updatePlan(editing.id, rest);
              setEditing(null);
              notifySuccess("Plan mis à jour");
              refetch();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

const schema = z.object({
  name: z.string().trim().min(1, "Nom requis"),
  code: z.string(),
  studentLimit: z.string(),
  monthlyPrice: z.string(),
  annualPrice: z.string(),
  description: z.string(),
});
type FormValues = z.infer<typeof schema>;

function PlanForm({ initial, onSubmit, onCancel }: {
  initial?: Plan;
  onSubmit: (input: PlanInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "STARTER",
      studentLimit: initial?.studentLimit != null ? String(initial.studentLimit) : "",
      monthlyPrice: initial?.monthlyPrice ? String(Number(initial.monthlyPrice)) : "",
      annualPrice: initial?.annualPrice ? String(Number(initial.annualPrice)) : "",
      description: initial?.description ?? "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: FormValues) {
    setSubmitting(true);
    try {
      await onSubmit({
        name: values.name,
        code: values.code as PlanCode,
        studentLimit: values.studentLimit === "" ? null : Number(values.studentLimit),
        monthlyPrice: values.monthlyPrice === "" ? null : values.monthlyPrice,
        annualPrice: values.annualPrice === "" ? null : values.annualPrice,
        description: values.description || null,
      });
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
        <Input value={v.name} onChange={(e) => setValue("name", e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
      </Field>
      <Field>
        <Label>Code</Label>
        <Select disabled={!!initial} value={v.code} onChange={(e) => setValue("code", e.target.value)}>
          {PLAN_CODES.map((c) => (<option key={c} value={c}>{c}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Limite d&apos;élèves (vide = illimité)</Label>
        <Input type="number" min={0} value={v.studentLimit} onChange={(e) => setValue("studentLimit", e.target.value)} />
      </Field>
      <Field>
        <Label>Prix mensuel (GNF)</Label>
        <Input type="number" min={0} value={v.monthlyPrice} onChange={(e) => setValue("monthlyPrice", e.target.value)} />
      </Field>
      <Field>
        <Label>Prix annuel (GNF)</Label>
        <Input type="number" min={0} value={v.annualPrice} onChange={(e) => setValue("annualPrice", e.target.value)} />
      </Field>
      <Field>
        <Label>Description</Label>
        <Textarea rows={2} value={v.description} onChange={(e) => setValue("description", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={submitting}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}
