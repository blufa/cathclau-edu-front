"use client";

import { useState } from "react";
import { Select, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import { archivePlan, createPlan, deletePlan, listPlans, setPlanDefaultTrial, updatePlan } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { PlanModulesModal } from "@/components/platform/plan-modules-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
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

interface PlanFormValues {
  name: string;
  code: PlanCode;
  studentLimit: number | "";
  monthlyPrice: number | "";
  annualPrice: number | "";
  description: string;
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
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">Impossible de charger les plans.</p>
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
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p)}>Suppr.</Button>
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

function PlanForm({ initial, onSubmit, onCancel }: {
  initial?: Plan;
  onSubmit: (input: PlanInput) => Promise<void>;
  onCancel: () => void;
}) {
  const form = useForm<PlanFormValues>({
    mode: "controlled",
    initialValues: {
      name: initial?.name ?? "",
      code: initial?.code ?? "STARTER",
      studentLimit: initial?.studentLimit ?? "",
      monthlyPrice: initial?.monthlyPrice ? Number(initial.monthlyPrice) : "",
      annualPrice: initial?.annualPrice ? Number(initial.annualPrice) : "",
      description: initial?.description ?? "",
    },
    validate: { name: (v) => (v.trim() ? null : "Nom requis") },
  });

  async function submit(values: PlanFormValues) {
    try {
      await onSubmit({
        name: values.name,
        code: values.code,
        studentLimit: values.studentLimit === "" ? null : Number(values.studentLimit),
        monthlyPrice: values.monthlyPrice === "" ? null : String(values.monthlyPrice),
        annualPrice: values.annualPrice === "" ? null : String(values.annualPrice),
        description: values.description || null,
      });
    } catch (err) {
      notifyError(err);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Nom" withAsterisk {...form.getInputProps("name")} />
        <Select
          label="Code" disabled={!!initial}
          data={PLAN_CODES.map((c) => ({ value: c, label: c }))}
          {...form.getInputProps("code")}
        />
        <NumberInput label="Limite d'élèves (vide = illimité)" min={0} {...form.getInputProps("studentLimit")} />
        <NumberInput label="Prix mensuel (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("monthlyPrice")} />
        <NumberInput label="Prix annuel (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("annualPrice")} />
        <Textarea label="Description" autosize minRows={2} {...form.getInputProps("description")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit">{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}
