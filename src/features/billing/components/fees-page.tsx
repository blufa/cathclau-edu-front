"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Regroupement des frais par catégorie pour la liste. */
const FEE_CATEGORIES: { key: string; label: string; types: FeeType[] }[] = [
  { key: "monthly", label: "Mensualité", types: ["MONTHLY"] },
  { key: "enrollment", label: "Inscription", types: ["ENROLLMENT"] },
  { key: "reenrollment", label: "Réinscription", types: ["RE_ENROLLMENT"] },
  { key: "other", label: "Frais annexes", types: ["TRANSPORT", "CANTEEN", "EXAM", "OTHER"] },
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
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Frais scolaires</h1>
          <p className="text-sm text-gray-500">Paramétrage des frais par classe et type</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau frais</Button>}
      </Reveal>

      {feesQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (feesQuery.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">Aucun frais configuré.</p>
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
      <h2 className="mb-2 text-sm font-semibold text-gray-700">
        {title} <span className="font-normal text-gray-400">({fees.length})</span>
      </h2>
      <Table>
        <THead><tr><TH>Libellé</TH><TH>Classe</TH><TH>Montant</TH><TH>Année</TH><TH className="text-right">Actions</TH></tr></THead>
        <TBody>
          {slice.map((f) => (
            <TR key={f.id}>
              <TD className="text-gray-600">{f.label ?? FEE_TYPE_LABEL[f.type]}</TD>
              <TD>{classLabel.get(f.classId) ?? `#${f.classId}`}</TD>
              <TD className="font-medium text-gray-900">{formatGNF(f.amount)}</TD>
              <TD>{f.academicYear ?? "—"}</TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onInstallments(f)}>Échéances</Button>
                  {canWrite && <Button size="sm" variant="ghost" onClick={() => onEdit(f)}>Modifier</Button>}
                  {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => onDelete(f)}>Suppr.</Button>}
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

const feeSchema = z.object({
  classId: z.string(),
  classIds: z.array(z.string()),
  type: z.string(),
  amount: z.number().positive("Montant requis"),
  academicYear: z.string(),
  label: z.string(),
}).superRefine((v, ctx) => {
  if (v.type === "OTHER" && !v.label.trim()) {
    ctx.addIssue({ code: "custom", path: ["label"], message: "Nom du frais requis (ex. Tenue scolaire)" });
  }
});
type FeeFormValues = z.infer<typeof feeSchema>;

function FeeForm({ tenantId, initial, classes, defaultYear, onCancel, onSaved }: {
  tenantId: number; initial: SchoolFee | null; classes: { value: string; label: string }[];
  defaultYear: string; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors }, setError } = useForm<FeeFormValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      classId: initial ? String(initial.classId) : "",
      classIds: initial ? [String(initial.classId)] : [],
      type: initial?.type ?? "MONTHLY",
      amount: initial ? Number(initial.amount) : 0,
      academicYear: initial?.academicYear ?? defaultYear,
      label: initial?.label ?? "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  function toggleClass(id: string) {
    const next = v.classIds.includes(id) ? v.classIds.filter((c) => c !== id) : [...v.classIds, id];
    setValue("classIds", next);
  }

  async function submit(values: FeeFormValues) {
    if (!initial && values.classIds.length === 0) {
      setError("classIds", { message: "Choisissez au moins une classe" });
      return;
    }
    const label = values.type === "OTHER" ? values.label.trim() : null;
    setLoading(true);
    try {
      if (initial) {
        await updateFee(initial.id, { classId: Number(values.classId), type: values.type as FeeType, amount: values.amount, academicYear: values.academicYear, label });
      } else {
        // Un même frais (type + montant) appliqué à plusieurs classes : on crée un frais par classe.
        await Promise.all(values.classIds.map((cid) =>
          createFee({ tenantId, classId: Number(cid), type: values.type as FeeType, amount: values.amount, academicYear: values.academicYear, label })));
      }
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {initial ? (
        <Field>
          <Label>Classe <span className="text-error-500">*</span></Label>
          <Select value={v.classId} onChange={(e) => setValue("classId", e.target.value)}>
            <option value="">— Choisir —</option>
            {classes.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </Select>
        </Field>
      ) : (
        <Field>
          <Label>Classes <span className="text-error-500">*</span></Label>
          <p className="mb-1.5 text-xs text-gray-400">Le même frais sera créé pour chaque classe cochée.</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
            {classes.map((c) => (
              <Checkbox key={c.value} label={c.label} checked={v.classIds.includes(c.value)} onChange={() => toggleClass(c.value)} />
            ))}
          </div>
          {errors.classIds && <p className="text-xs text-error-600">{errors.classIds.message}</p>}
        </Field>
      )}
      <Field>
        <Label>Type</Label>
        <Select value={v.type} onChange={(e) => setValue("type", e.target.value)}>
          {(Object.keys(FEE_TYPE_LABEL) as FeeType[]).map((t) => (<option key={t} value={t}>{FEE_TYPE_LABEL[t]}</option>))}
        </Select>
      </Field>
      {v.type === "OTHER" && (
        <Field>
          <Label>Nom du frais <span className="text-error-500">*</span></Label>
          <p className="mb-1.5 text-xs text-gray-400">Ex. Tenue scolaire, Rames de papier, Bus de transport…</p>
          <Input value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
          {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
        </Field>
      )}
      <Field>
        <Label>Montant (GNF)</Label>
        <Input type="number" min={0} value={v.amount} onChange={(e) => setValue("amount", Number(e.target.value))} />
        {errors.amount && <p className="text-xs text-error-600">{errors.amount.message}</p>}
      </Field>
      <Field>
        <Label>Année scolaire</Label>
        <Input value={v.academicYear} onChange={(e) => setValue("academicYear", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
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

const installmentSchema = z.object({
  label: z.string().trim().min(1, "Requis"),
  amount: z.number(),
  dueDate: z.string(),
});
type InstallmentFormValues = z.infer<typeof installmentSchema>;

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
  const { handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<InstallmentFormValues>({
    resolver: zodResolver(installmentSchema),
    defaultValues: { label: "", amount: 0, dueDate: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function add(values: InstallmentFormValues) {
    try {
      await createInstallment(fee.id, { label: values.label, amount: values.amount, dueDate: values.dueDate || null });
      reset(); setAdding(false); notifySuccess("Échéance ajoutée"); q.refetch();
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
      <p className="text-sm text-gray-500">
        {isMonthly
          ? <>Montant mensuel : <strong>{formatGNF(fee.amount)}</strong> — chaque échéance est un mois (montant complet).</>
          : <>Total du frais : <strong>{formatGNF(fee.amount)}</strong> — la somme des échéances doit l&apos;égaler.</>}
      </p>

      {canWrite && isMonthly && (
        <div className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3 sm:flex-row sm:items-end">
          <Field>
            <Label>Mois de départ</Label>
            <Input type="month" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
          </Field>
          <Field>
            <Label>Nombre de mois</Label>
            <Input type="number" min={1} max={12} className="sm:w-40" value={genCount} onChange={(e) => setGenCount(e.target.value)} />
          </Field>
          <Button onClick={generateYear} loading={generating} disabled={!genMonth}>Générer les mois</Button>
        </div>
      )}

      {canWrite && isMonthly && (
        <div className="rounded-xl border border-warning-200 bg-warning-50/40 p-3">
          <p className="mb-2 text-sm font-semibold text-gray-700">Ou facturation trimestrielle pondérée (40 / 30 / 30)</p>
          <Field>
            <Label>Total annuel (GNF)</Label>
            <Input type="number" min={0} className="sm:w-56" value={genAnnual} onChange={(e) => setGenAnnual(e.target.value)} />
          </Field>
          <div className="mt-2 space-y-2">
            {terms.map((t, i) => (
              <div key={t.label} className="flex flex-wrap items-end gap-2">
                <span className="w-24 text-sm text-gray-600">{t.label}</span>
                <Field>
                  <Label>%</Label>
                  <Input type="number" min={0} max={100} className="w-20" value={t.percentage} onChange={(e) => setTerm(i, { percentage: e.target.value })} />
                </Field>
                <Field>
                  <Label>Échéance</Label>
                  <DatePicker value={t.dueDate} onChange={(val) => setTerm(i, { dueDate: val })} clearable />
                </Field>
                <span className="text-xs text-gray-400">{genAnnual ? formatGNF(Math.round(Number(genAnnual) * (Number(t.percentage) || 0) / 100)) : ""}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-400">Réparti : {terms.reduce((s, t) => s + (Number(t.percentage) || 0), 0)} %</span>
            <Button size="sm" onClick={generateTrimesters} loading={genTerms}>Générer les trimestres</Button>
          </div>
        </div>
      )}
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Montant</TH><TH>Échéance</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucune échéance.</TD></TR>}
            {(q.data ?? []).map((i) => (
              <TR key={i.id}>
                <TD>{i.label}</TD><TD>{formatGNF(i.amount)}</TD><TD>{i.dueDate ?? "—"}</TD>
                <TD className="text-right">{canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(i.id)}>Suppr.</Button>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {canWrite && (adding ? (
        <form onSubmit={handleSubmit(add)} className="space-y-3 rounded-xl border border-gray-200 p-3">
          {fee.type === "MONTHLY" && (
            <Field>
              <Label>Mois (mensualité)</Label>
              <p className="text-xs text-gray-400">Renseigne le libellé et l&apos;échéance au 05 du mois suivant.</p>
              <Input
                type="month"
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const { label, dueDate } = monthToInstallment(val);
                  setValue("label", label);
                  setValue("dueDate", dueDate);
                  if (!v.amount) setValue("amount", Number(fee.amount));
                }}
              />
            </Field>
          )}
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
            {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
          </Field>
          <Field>
            <Label>Montant (GNF)</Label>
            <Input type="number" min={0} value={v.amount} onChange={(e) => setValue("amount", Number(e.target.value))} />
          </Field>
          <Field>
            <Label>Date limite</Label>
            <DatePicker value={v.dueDate} onChange={(val) => setValue("dueDate", val)} clearable />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(false)}>Annuler</Button>
            <Button type="submit" size="sm">Ajouter</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>+ Ajouter une échéance</Button>
      ))}
    </div>
  );
}
