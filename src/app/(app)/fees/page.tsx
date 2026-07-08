"use client";

import { useMemo, useState } from "react";
import { MultiSelect, Select, NumberInput, Stack, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import {
  createFee,
  createInstallment,
  generateWeightedTerms,
  deleteFee,
  deleteInstallment,
  listFeesByTenant,
  listInstallments,
  updateFee,
} from "@/lib/api/billing";
import { FEE_TYPE_LABEL, type FeeType, type SchoolFee } from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Regroupement des frais par catégorie pour la liste. */
const FEE_CATEGORIES: { key: string; label: string; types: FeeType[] }[] = [
  { key: "monthly", label: "Mensualité", types: ["MONTHLY"] },
  { key: "enrollment", label: "Inscription", types: ["ENROLLMENT"] },
  { key: "reenrollment", label: "Réinscription", types: ["RE_ENROLLMENT"] },
  { key: "other", label: "Autre", types: ["TRANSPORT", "CANTEEN", "EXAM"] },
];
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

export default function FeesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");

  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYear = years.find((y) => y.current) ?? years[0];
  const classesQuery = useQuery(
    () => (currentYear ? listClasses(currentYear.id) : Promise.resolve([])),
    [currentYear?.id],
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );

  const feesQuery = useQuery(
    () => (tenantId ? listFeesByTenant(tenantId) : Promise.resolve([])),
    [tenantId],
  );

  const [editing, setEditing] = useState<SchoolFee | null>(null);
  const [creating, setCreating] = useState(false);
  const [installmentsFor, setInstallmentsFor] = useState<SchoolFee | null>(null);

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  function handleDelete(f: SchoolFee) {
    confirmAction({
      title: "Supprimer le frais", message: `Supprimer ce frais ${FEE_TYPE_LABEL[f.type]} ?`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteFee(f.id); notifySuccess("Frais supprimé"); feesQuery.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Frais scolaires</h1>
          <p className="text-sm text-slate-500">Paramétrage des frais par classe et type</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau frais</Button>}
      </Reveal>

      {feesQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (feesQuery.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">Aucun frais configuré.</p>
      ) : (
        <div className="space-y-6">
          {FEE_CATEGORIES.map((cat) => {
            const group = (feesQuery.data ?? []).filter((f) => cat.types.includes(f.type));
            if (group.length === 0) return null;
            return (
              <FeeGroup
                key={cat.key}
                title={cat.label}
                fees={group}
                classLabel={classLabel}
                canWrite={canWrite}
                onInstallments={setInstallmentsFor}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le frais" : "Nouveau frais"}>
        <FeeForm
          tenantId={tenantId}
          initial={editing}
          classes={(classesQuery.data ?? []).map((c) => ({ value: String(c.id), label: c.label }))}
          defaultYear={currentYear?.label ?? ""}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess("Frais enregistré"); feesQuery.refetch(); }}
        />
      </Modal>

      <Modal open={!!installmentsFor} onClose={() => setInstallmentsFor(null)} title="Échéances du frais">
        {installmentsFor && <InstallmentsPanel fee={installmentsFor} canWrite={canWrite} />}
      </Modal>
    </div>
  );
}

/** Une catégorie de frais : table paginée (10/page) avec les actions par ligne. */
function FeeGroup({ title, fees, classLabel, canWrite, onInstallments, onEdit, onDelete }: {
  title: string;
  fees: SchoolFee[];
  classLabel: Map<number, string>;
  canWrite: boolean;
  onInstallments: (f: SchoolFee) => void;
  onEdit: (f: SchoolFee) => void;
  onDelete: (f: SchoolFee) => void;
}) {
  const PAGE = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(fees.length / PAGE);
  const slice = fees.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-slate-700">
        {title} <span className="font-normal text-slate-400">({fees.length})</span>
      </h2>
      <Table>
        <THead><tr><TH>Classe</TH><TH>Montant</TH><TH>Année</TH><TH className="text-right">Actions</TH></tr></THead>
        <TBody>
          {slice.map((f) => (
            <TR key={f.id}>
              <TD>{classLabel.get(f.classId) ?? `#${f.classId}`}</TD>
              <TD className="font-medium text-slate-900">{formatGNF(f.amount)}</TD>
              <TD>{f.academicYear ?? "—"}</TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onInstallments(f)}>Échéances</Button>
                  {canWrite && <Button size="sm" variant="ghost" onClick={() => onEdit(f)}>Modifier</Button>}
                  {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(f)}>Suppr.</Button>}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {totalPages > 1 && (
        <div className="mt-2">
          <Pagination page={page} totalPages={totalPages} totalElements={fees.length} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

function FeeForm({ tenantId, initial, classes, defaultYear, onCancel, onSaved }: {
  tenantId: number; initial: SchoolFee | null; classes: { value: string; label: string }[];
  defaultYear: string; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      classId: initial ? String(initial.classId) : "",
      classIds: initial ? [String(initial.classId)] : ([] as string[]),
      type: (initial?.type ?? "MONTHLY") as FeeType,
      amount: initial ? Number(initial.amount) : 0,
      academicYear: initial?.academicYear ?? defaultYear,
    },
    validate: {
      classIds: (v) => (initial || v.length > 0 ? null : "Choisissez au moins une classe"),
      amount: (v) => (v > 0 ? null : "Montant requis"),
    },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      if (initial) {
        await updateFee(initial.id, { classId: Number(values.classId), type: values.type, amount: values.amount, academicYear: values.academicYear });
      } else {
        // Un même frais (type + montant) appliqué à plusieurs classes : on crée un frais par classe.
        await Promise.all(values.classIds.map((cid) =>
          createFee({ tenantId, classId: Number(cid), type: values.type, amount: values.amount, academicYear: values.academicYear })));
      }
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        {initial ? (
          <Select label="Classe" withAsterisk data={[{ value: "", label: "— Choisir —" }, ...classes]} {...form.getInputProps("classId")} />
        ) : (
          <MultiSelect
            label="Classes"
            withAsterisk
            searchable
            placeholder="Une ou plusieurs classes"
            data={classes}
            description="Le même frais sera créé pour chaque classe sélectionnée."
            {...form.getInputProps("classIds")}
          />
        )}
        <Select label="Type" data={(Object.keys(FEE_TYPE_LABEL) as FeeType[]).map((t) => ({ value: t, label: FEE_TYPE_LABEL[t] }))} {...form.getInputProps("type")} />
        <NumberInput label="Montant (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("amount")} />
        <TextInput label="Année scolaire" {...form.getInputProps("academicYear")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** À partir d'un mois "YYYY-MM", libellé "mois année" + échéance au 05 du mois suivant. */
function monthToInstallment(monthValue: string): { label: string; dueDate: string } {
  const [y, m] = monthValue.split("-").map(Number);
  const label = `${MONTHS_FR[m - 1]} ${y}`;
  let ny = y, nm = m + 1;
  if (nm > 12) { nm = 1; ny += 1; }
  return { label, dueDate: `${ny}-${String(nm).padStart(2, "0")}-05` };
}
/** Avance un mois "YYYY-MM" de n mois. */
function addMonths(monthValue: string, n: number): string {
  let [y, m] = monthValue.split("-").map(Number);
  m += n;
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}

function InstallmentsPanel({ fee, canWrite }: { fee: SchoolFee; canWrite: boolean }) {
  const q = useQuery(() => listInstallments(fee.id), [fee.id]);
  const [adding, setAdding] = useState(false);
  const isMonthly = fee.type === "MONTHLY";
  // Génération automatique des mois de l'année (mensualités).
  const [genMonth, setGenMonth] = useState("");
  const [genCount, setGenCount] = useState<number | string>(9);
  const [generating, setGenerating] = useState(false);
  // Génération trimestrielle pondérée (règlement financier : T1 40 % / T2 30 % / T3 30 %).
  const [genAnnual, setGenAnnual] = useState<number | string>(Number(fee.amount) ? Number(fee.amount) * 9 : 0);
  const [terms, setTerms] = useState([
    { label: "Trimestre 1", percentage: 40 as number | string, dueDate: "" },
    { label: "Trimestre 2", percentage: 30 as number | string, dueDate: "" },
    { label: "Trimestre 3", percentage: 30 as number | string, dueDate: "" },
  ]);
  const [genTerms, setGenTerms] = useState(false);
  const form = useForm({ mode: "controlled", initialValues: { label: "", amount: 0, dueDate: "" }, validate: { label: (v) => (v ? null : "Requis") } });

  async function add(values: typeof form.values) {
    try {
      await createInstallment(fee.id, { label: values.label, amount: values.amount, dueDate: values.dueDate || null });
      form.reset(); setAdding(false); notifySuccess("Échéance ajoutée"); q.refetch();
    } catch (err) { notifyError(err); }
  }
  async function generateYear() {
    if (!genMonth) { notifyError("Choisissez le mois de départ."); return; }
    const count = Number(genCount);
    if (!count || count < 1) { notifyError("Nombre de mois invalide."); return; }
    setGenerating(true);
    try {
      for (let k = 0; k < count; k++) {
        const { label, dueDate } = monthToInstallment(addMonths(genMonth, k));
        await createInstallment(fee.id, { label, amount: Number(fee.amount), dueDate });
      }
      notifySuccess(`${count} mois générés`);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setGenerating(false); }
  }
  async function generateTrimesters() {
    if (!genAnnual || Number(genAnnual) <= 0) { notifyError("Total annuel invalide."); return; }
    setGenTerms(true);
    try {
      await generateWeightedTerms(fee.id, Number(genAnnual),
        terms.map((t) => ({ label: t.label, percentage: Number(t.percentage) || 0, dueDate: t.dueDate || null })));
      notifySuccess("Trimestres générés");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setGenTerms(false); }
  }
  function setTerm(i: number, patch: Partial<{ percentage: number | string; dueDate: string }>) {
    setTerms((ts) => ts.map((t, k) => (k === i ? { ...t, ...patch } : t)));
  }
  async function remove(id: number) {
    try { await deleteInstallment(id); notifySuccess("Échéance supprimée"); q.refetch(); } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        {isMonthly
          ? <>Montant mensuel : <strong>{formatGNF(fee.amount)}</strong> — chaque échéance est un mois (montant complet).</>
          : <>Total du frais : <strong>{formatGNF(fee.amount)}</strong> — la somme des échéances doit l&apos;égaler.</>}
      </p>

      {canWrite && isMonthly && (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3 sm:flex-row sm:items-end">
          <TextInput label="Mois de départ" type="month" value={genMonth} onChange={(e) => setGenMonth(e.currentTarget.value)} />
          <NumberInput label="Nombre de mois" min={1} max={12} className="sm:w-40" value={genCount} onChange={setGenCount} />
          <Button onClick={generateYear} loading={generating} disabled={!genMonth}>Générer les mois</Button>
        </div>
      )}

      {canWrite && isMonthly && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Ou facturation trimestrielle pondérée (40 / 30 / 30)</p>
          <NumberInput label="Total annuel (GNF)" thousandSeparator=" " min={0} className="sm:w-56" value={genAnnual} onChange={setGenAnnual} />
          <div className="mt-2 space-y-2">
            {terms.map((t, i) => (
              <div key={t.label} className="flex flex-wrap items-end gap-2">
                <span className="w-24 text-sm text-slate-600">{t.label}</span>
                <NumberInput label="%" min={0} max={100} className="w-20" value={t.percentage} onChange={(v) => setTerm(i, { percentage: v })} />
                <DatePickerInput label="Échéance" valueFormat="DD/MM/YYYY" clearable value={t.dueDate || null} onChange={(v) => setTerm(i, { dueDate: v ?? "" })} />
                <span className="text-xs text-slate-400">{genAnnual ? formatGNF(Math.round(Number(genAnnual) * (Number(t.percentage) || 0) / 100)) : ""}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-slate-400">Réparti : {terms.reduce((s, t) => s + (Number(t.percentage) || 0), 0)} %</span>
            <Button size="sm" onClick={generateTrimesters} loading={genTerms}>Générer les trimestres</Button>
          </div>
        </div>
      )}
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Montant</TH><TH>Échéance</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-slate-400">Aucune échéance.</TD></TR>}
            {(q.data ?? []).map((i) => (
              <TR key={i.id}>
                <TD>{i.label}</TD><TD>{formatGNF(i.amount)}</TD><TD>{i.dueDate ?? "—"}</TD>
                <TD className="text-right">{canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(i.id)}>Suppr.</Button>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {canWrite && (adding ? (
        <form onSubmit={form.onSubmit(add)} className="rounded-xl border border-slate-200 p-3">
          <Stack gap="sm">
            {fee.type === "MONTHLY" && (
              <TextInput
                label="Mois (mensualité)"
                type="month"
                description="Renseigne le libellé et l'échéance au 05 du mois suivant."
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  if (!val) return;
                  const { label, dueDate } = monthToInstallment(val);
                  form.setFieldValue("label", label);
                  form.setFieldValue("dueDate", dueDate);
                  if (!form.getValues().amount) form.setFieldValue("amount", Number(fee.amount));
                }}
              />
            )}
            <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} />
            <NumberInput label="Montant (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("amount")} />
            <DatePickerInput label="Date limite" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("dueDate")} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(false)}>Annuler</Button>
              <Button type="submit" size="sm">Ajouter</Button>
            </div>
          </Stack>
        </form>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>+ Ajouter une échéance</Button>
      ))}
    </div>
  );
}
