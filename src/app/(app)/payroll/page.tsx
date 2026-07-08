"use client";

import { useEffect, useMemo, useState } from "react";
import { Checkbox, NumberInput, Select, Stack, Tabs, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Banknote, Clock, FileSpreadsheet, Plus, Settings as SettingsIcon, HandCoins } from "lucide-react";
import { FeeDeductionPanel } from "@/components/payroll/fee-deduction-panel";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listTeachers } from "@/lib/api/staff";
import {
  addRule,
  addPayslipLine,
  removePayslipLine,
  generateBatch,
  approvePayslip,
  bankFileUrl,
  createStructure,
  deletePayslip,
  deleteRule,
  deleteStructure,
  generatePayslip,
  getPayslipLines,
  getPayslipPdfObjectUrl,
  getTeacherAttendanceStats,
  listPayslips,
  listRules,
  listStructures,
  payPayslip,
  getCompensation,
  setCompensation,
  getMonthlyPay,
  generatePayslipFromHours,
  type PayMode,
  type MonthlyPay,
  type TeacherCompensation,
} from "@/lib/api/payroll";
import {
  COMPUTATION_LABEL,
  LINE_TYPE_LABEL,
  PAYSLIP_STATUS_LABEL,
  type Payslip,
  type PayslipLineType,
  type RuleComputation,
  type SalaryStructure,
} from "@/lib/types/payroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const STATUS_TONE: Record<Payslip["status"], "gray" | "indigo" | "green"> = { DRAFT: "gray", VALIDATED: "indigo", PAID: "green" };

export default function PayrollPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT")) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé à l&apos;administration / comptabilité.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paie</h1>
        <p className="text-sm text-slate-500">Fiches de paie des enseignants et structures salariales</p>
      </Reveal>
      <Tabs defaultValue="payslips" color="teal" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="payslips" leftSection={<Banknote className="h-4 w-4" />}>Fiches de paie</Tabs.Tab>
          <Tabs.Tab value="compensation" leftSection={<Clock className="h-4 w-4" />}>Rémunération & heures</Tabs.Tab>
          <Tabs.Tab value="structures" leftSection={<SettingsIcon className="h-4 w-4" />}>Structures salariales</Tabs.Tab>
          <Tabs.Tab value="deductions" leftSection={<HandCoins className="h-4 w-4" />}>Déductions scolarité</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="payslips" pt="lg"><PayslipsTab /></Tabs.Panel>
        <Tabs.Panel value="compensation" pt="lg"><CompensationTab /></Tabs.Panel>
        <Tabs.Panel value="structures" pt="lg"><StructuresTab /></Tabs.Panel>
        <Tabs.Panel value="deductions" pt="lg"><FeeDeductionPanel canWrite={hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT")} /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

function PayslipsTab() {
  const teachersQuery = useQuery(listTeachers, []);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const teacherName = useMemo(() => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachers]);
  const structuresQuery = useQuery(listStructures, []);

  const [status, setStatus] = useState<Payslip["status"] | "">("");
  const q = useQuery(() => listPayslips({ status: status || undefined }), [status]);

  const [generating, setGenerating] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [linesFor, setLinesFor] = useState<Payslip | null>(null);

  function act(p: Promise<unknown>) { p.then(() => { notifySuccess("Mis à jour"); q.refetch(); }).catch(notifyError); }
  function remove(p: Payslip) {
    confirmAction({ title: "Supprimer la fiche", message: "Confirmer ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deletePayslip(p.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  async function downloadBankFile() {
    try { window.open(await bankFileUrl(), "_blank"); } catch (e) { notifyError(e); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[200px]" placeholder="Tous les statuts" clearable
          data={(Object.keys(PAYSLIP_STATUS_LABEL) as Payslip["status"][]).map((s) => ({ value: s, label: PAYSLIP_STATUS_LABEL[s] }))}
          value={status || null} onChange={(v) => setStatus((v ?? "") as Payslip["status"] | "")} />
        <div className="flex gap-2">
          <Button variant="secondary" leftSection={<FileSpreadsheet className="h-4 w-4" />} onClick={downloadBankFile}>Fichier bancaire</Button>
          <Button variant="secondary" leftSection={<Banknote className="h-4 w-4" />} onClick={() => setBatchOpen(true)}>Générer en lot</Button>
          <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setGenerating(true)}>Générer une fiche</Button>
        </div>
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Enseignant</TH><TH>Période</TH><TH>Base</TH><TH>Brut</TH><TH>Net</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-slate-400">Aucune fiche.</TD></TR>}
            {(q.data ?? []).map((p) => (
              <TR key={p.id}>
                <TD className="font-medium text-slate-900">{teacherName.get(p.teacherId) ?? `#${p.teacherId}`}</TD>
                <TD>{p.periodLabel}</TD>
                <TD>{formatGNF(p.baseSalary)}</TD>
                <TD>{formatGNF(p.grossSalary)}</TD>
                <TD className="font-semibold text-slate-900">{formatGNF(p.netSalary)}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setLinesFor(p)}>Détails</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { try { window.open(await getPayslipPdfObjectUrl(p.id), "_blank"); } catch (e) { notifyError(e); } }}>PDF</Button>
                    {p.status === "DRAFT" && <Button size="sm" variant="ghost" onClick={() => act(approvePayslip(p.id))}>Valider</Button>}
                    {p.status === "VALIDATED" && <Button size="sm" variant="ghost" onClick={() => act(payPayslip(p.id))}>Payer</Button>}
                    {p.status === "DRAFT" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(p)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={generating} onClose={() => setGenerating(false)} title="Générer une fiche de paie">
        <GenerateForm teachers={teachers} structures={structuresQuery.data ?? []}
          onCancel={() => setGenerating(false)}
          onDone={() => { setGenerating(false); notifySuccess("Fiche générée"); q.refetch(); }} />
      </Modal>

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Générer les fiches de paie en lot">
        <GenerateBatchForm teachers={teachers} structures={structuresQuery.data ?? []}
          onCancel={() => setBatchOpen(false)}
          onDone={(n) => { setBatchOpen(false); notifySuccess(`${n} fiche(s) générée(s)`); q.refetch(); }} />
      </Modal>

      <Modal open={!!linesFor} onClose={() => setLinesFor(null)} title={linesFor ? `Détail — ${teacherName.get(linesFor.teacherId) ?? ""} (${linesFor.periodLabel})` : ""}>
        {linesFor && <LinesPanel payslip={linesFor} onChanged={() => q.refetch()} />}
      </Modal>
    </div>
  );
}

function GenerateForm({ teachers, structures, onCancel, onDone }: {
  teachers: { id: number; firstName: string; lastName: string; remunerationRate?: number | string | null }[];
  structures: SalaryStructure[]; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      teacherId: "", periodLabel: "", structureId: "", baseSalary: 0 as number | string, periodStart: "", periodEnd: "",
      absentDays: 0 as number | string, workingDays: 26 as number | string,
      overtimeHours: 0 as number | string, overtimeRate: 0 as number | string, overtimeMultiplier: "1.5",
    },
    validate: { teacherId: (v) => (v ? null : "Requis"), periodLabel: (v) => (v ? null : "Requis") },
  });

  function onTeacher(value: string | null) {
    form.setFieldValue("teacherId", value ?? "");
    const t = teachers.find((x) => String(x.id) === value);
    if (t?.remunerationRate != null && t.remunerationRate !== "") form.setFieldValue("baseSalary", Number(t.remunerationRate));
  }

  // Auto-remplit les jours d'absence depuis le pointage dès que l'enseignant + la période sont saisis.
  const { teacherId, periodStart, periodEnd } = form.values;
  useEffect(() => {
    if (!teacherId || !periodStart || !periodEnd) return;
    let active = true;
    getTeacherAttendanceStats(Number(teacherId), periodStart, periodEnd)
      .then((s) => { if (active) form.setFieldValue("absentDays", s.absentDays ?? 0); })
      .catch(() => { /* pointage indisponible : saisie manuelle */ });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, periodStart, periodEnd]);

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const t = teachers.find((x) => String(x.id) === values.teacherId);
      await generatePayslip({
        teacherId: Number(values.teacherId),
        teacherName: t ? `${t.firstName} ${t.lastName}` : null,
        periodLabel: values.periodLabel,
        periodStart: values.periodStart || null,
        periodEnd: values.periodEnd || null,
        baseSalary: Number(values.baseSalary) || 0,
        structureId: values.structureId ? Number(values.structureId) : null,
        absentDays: Number(values.absentDays) || 0,
        workingDays: Number(values.workingDays) || 0,
        overtimeHours: Number(values.overtimeHours) || 0,
        overtimeRate: Number(values.overtimeRate) || 0,
        overtimeMultiplier: Number(values.overtimeMultiplier) || 1,
      });
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <Select label="Enseignant" withAsterisk searchable
          data={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
          value={form.values.teacherId || null} onChange={onTeacher} />
        <TextInput label="Période" withAsterisk placeholder="Ex. Juin 2026" {...form.getInputProps("periodLabel")} />
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Du" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("periodStart")} />
          <DatePickerInput label="Au" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("periodEnd")} />
        </div>
        <NumberInput label="Salaire de base (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("baseSalary")} />
        <Select label="Structure salariale" clearable placeholder="Aucune (base seule)"
          data={structures.map((s) => ({ value: String(s.id), label: s.name }))}
          value={form.values.structureId || null} onChange={(v) => form.setFieldValue("structureId", v ?? "")} />

        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Pointage & heures supplémentaires</p>
          <div className="grid grid-cols-2 gap-2">
            <NumberInput label="Jours d'absence" min={0} {...form.getInputProps("absentDays")} />
            <NumberInput label="Jours ouvrés (mois)" min={1} {...form.getInputProps("workingDays")} />
          </div>
          <p className="mt-1 text-xs text-slate-400">Jours d&apos;absence <strong>récupérés automatiquement</strong> du pointage sur la période (modifiable). Retenue = (base ÷ jours ouvrés) × jours d&apos;absence.</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <NumberInput label="Heures sup." min={0} {...form.getInputProps("overtimeHours")} />
            <NumberInput label="Taux horaire (GNF)" min={0} thousandSeparator=" " {...form.getInputProps("overtimeRate")} />
            <Select label="Coefficient" allowDeselect={false}
              data={[{ value: "1", label: "×1" }, { value: "1.5", label: "×1.5 (ordinaire)" }, { value: "2", label: "×2 (week-end)" }, { value: "2.5", label: "×2.5 (férié)" }]}
              {...form.getInputProps("overtimeMultiplier")} />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Calculer & créer</Button>
        </div>
      </Stack>
    </form>
  );
}

function LinesPanel({ payslip, onChanged }: { payslip: Payslip; onChanged: () => void }) {
  const [current, setCurrent] = useState<Payslip>(payslip);
  const linesQuery = useQuery(() => getPayslipLines(payslip.id), [payslip.id, current]);
  const editable = current.status === "DRAFT";

  const [label, setLabel] = useState("");
  const [lineType, setLineType] = useState<PayslipLineType>("EARNING");
  const [amount, setAmount] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!label.trim() || amount === "" || Number(amount) <= 0) { notifyError(new Error("Libellé et montant requis.")); return; }
    setSaving(true);
    try {
      const updated = await addPayslipLine(current.id, { label: label.trim(), lineType, amount: Number(amount) });
      setCurrent(updated); setLabel(""); setAmount(""); onChanged();
      notifySuccess("Ligne ajoutée");
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function remove(lineId: number) {
    try {
      const updated = await removePayslipLine(current.id, lineId);
      setCurrent(updated); onChanged();
      notifySuccess("Ligne retirée");
    } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Base</p><p className="font-semibold">{formatGNF(current.baseSalary)}</p></div>
        <div className="rounded-lg bg-slate-50 p-2"><p className="text-xs text-slate-500">Brut</p><p className="font-semibold">{formatGNF(current.grossSalary)}</p></div>
        <div className="rounded-lg bg-green-50 p-2"><p className="text-xs text-slate-500">Net</p><p className="font-semibold text-green-700">{formatGNF(current.netSalary)}</p></div>
      </div>
      {linesQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Type</TH><TH className="text-right">Montant</TH>{editable && <TH />}</tr></THead>
          <TBody>
            {(linesQuery.data ?? []).length === 0 && <TR><TD colSpan={editable ? 4 : 3} className="py-6 text-center text-slate-400">Aucune ligne (base seule).</TD></TR>}
            {(linesQuery.data ?? []).map((l) => (
              <TR key={l.id}>
                <TD>{l.label}</TD>
                <TD><Badge tone={l.lineType === "EARNING" ? "green" : "amber"}>{LINE_TYPE_LABEL[l.lineType]}</Badge></TD>
                <TD className="text-right">{l.lineType === "DEDUCTION" ? "−" : "+"} {formatGNF(l.amount)}</TD>
                {editable && <TD className="text-right"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(l.id)}>Retirer</Button></TD>}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {editable ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <p className="mb-2 text-sm font-semibold text-slate-700">Ajouter une prime ou une retenue</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <TextInput className="sm:col-span-2" placeholder="Ex. Prime de transport" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
            <Select data={(Object.keys(LINE_TYPE_LABEL) as PayslipLineType[]).map((t) => ({ value: t, label: LINE_TYPE_LABEL[t] }))}
              allowDeselect={false} value={lineType} onChange={(v) => v && setLineType(v as PayslipLineType)} />
            <NumberInput placeholder="Montant" thousandSeparator=" " min={0} value={amount} onChange={(v) => setAmount(typeof v === "number" ? v : "")} />
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={saving} onClick={add} leftSection={<Plus className="h-4 w-4" />}>Ajouter la ligne</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Le brut = base + gains ; le net = brut − retenues. Le détail est figé après validation.</p>
      )}
    </div>
  );
}

function GenerateBatchForm({ teachers, structures, onCancel, onDone }: {
  teachers: { id: number; firstName: string; lastName: string; remunerationRate?: number | string | null }[];
  structures: SalaryStructure[]; onCancel: () => void; onDone: (count: number) => void;
}) {
  const [periodLabel, setPeriodLabel] = useState("");
  const [periodStart, setPeriodStart] = useState<string | null>(null);
  const [periodEnd, setPeriodEnd] = useState<string | null>(null);
  const [structureId, setStructureId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  // Par défaut : tous les enseignants inclus, base pré-remplie depuis leur taux de rémunération.
  const [rows, setRows] = useState(() =>
    teachers.map((t) => ({
      teacherId: t.id, name: `${t.firstName} ${t.lastName}`,
      included: true, baseSalary: (t.remunerationRate != null && !Number.isNaN(Number(t.remunerationRate)) ? Number(t.remunerationRate) : 0) as number | "",
    })),
  );

  function setRow(id: number, patch: Partial<{ included: boolean; baseSalary: number | "" }>) {
    setRows((rs) => rs.map((r) => (r.teacherId === id ? { ...r, ...patch } : r)));
  }

  async function submit() {
    if (!periodLabel.trim()) { notifyError(new Error("Le libellé de période est requis (ex. « Mai 2026 »).")); return; }
    const wages = rows.filter((r) => r.included && r.baseSalary !== "" && Number(r.baseSalary) > 0)
      .map((r) => ({ teacherId: r.teacherId, baseSalary: Number(r.baseSalary) }));
    if (wages.length === 0) { notifyError(new Error("Sélectionnez au moins un enseignant avec un salaire de base.")); return; }
    setLoading(true);
    try {
      const created = await generateBatch({
        periodLabel: periodLabel.trim(), periodStart, periodEnd,
        structureId: structureId ? Number(structureId) : null, wages,
      });
      onDone(created.length);
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  const selectedCount = rows.filter((r) => r.included).length;

  return (
    <Stack gap="md">
      <TextInput label="Période" withAsterisk placeholder="Ex. Mai 2026" value={periodLabel} onChange={(e) => setPeriodLabel(e.currentTarget.value)} />
      <div className="grid grid-cols-2 gap-3">
        <DatePickerInput label="Début (optionnel)" valueFormat="DD/MM/YYYY" clearable value={periodStart} onChange={setPeriodStart} />
        <DatePickerInput label="Fin (optionnel)" valueFormat="DD/MM/YYYY" clearable value={periodEnd} onChange={setPeriodEnd} />
      </div>
      <Select label="Structure salariale (optionnel)" placeholder="Aucune" clearable
        data={structures.map((s) => ({ value: String(s.id), label: s.name }))}
        value={structureId || null} onChange={(v) => setStructureId(v ?? "")} />

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-700">Enseignants ({selectedCount} sélectionné(s))</p>
          <div className="flex gap-2 text-xs">
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, included: true })))}>Tout cocher</button>
            <button type="button" className="text-slate-500 hover:underline" onClick={() => setRows((rs) => rs.map((r) => ({ ...r, included: false })))}>Tout décocher</button>
          </div>
        </div>
        <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
          <Table>
            <THead><tr><TH /><TH>Enseignant</TH><TH className="text-right">Salaire de base (GNF)</TH></tr></THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={3} className="py-6 text-center text-slate-400">Aucun enseignant.</TD></TR>}
              {rows.map((r) => (
                <TR key={r.teacherId}>
                  <TD><Checkbox checked={r.included} onChange={(e) => setRow(r.teacherId, { included: e.currentTarget.checked })} /></TD>
                  <TD className="font-medium text-slate-900">{r.name}</TD>
                  <TD className="text-right">
                    <NumberInput size="xs" thousandSeparator=" " min={0} disabled={!r.included}
                      value={r.baseSalary} onChange={(v) => setRow(r.teacherId, { baseSalary: typeof v === "number" ? v : "" })} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Générer les fiches</Button>
      </div>
    </Stack>
  );
}

function StructuresTab() {
  const q = useQuery(listStructures, []);
  const [creating, setCreating] = useState(false);
  const [rulesFor, setRulesFor] = useState<SalaryStructure | null>(null);

  function remove(s: SalaryStructure) {
    confirmAction({ title: "Supprimer la structure", message: s.name, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteStructure(s.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>Nouvelle structure</Button>
      </div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Nom</TH><TH>Code</TH><TH>Active</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-slate-400">Aucune structure. Créez-en une (ex. « Enseignant permanent »).</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-slate-900">{s.name}</TD>
                <TD>{s.code ?? "—"}</TD>
                <TD>{s.active ? <Badge tone="green">Oui</Badge> : <Badge tone="gray">Non</Badge>}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setRulesFor(s)}>Règles</Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle structure salariale">
        <StructureForm onCancel={() => setCreating(false)} onDone={() => { setCreating(false); notifySuccess("Créée"); q.refetch(); }} />
      </Modal>

      <Modal open={!!rulesFor} onClose={() => setRulesFor(null)} title={rulesFor ? `Règles — ${rulesFor.name}` : ""}>
        {rulesFor && <RulesPanel structure={rulesFor} />}
      </Modal>
    </div>
  );
}

function StructureForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({ mode: "controlled", initialValues: { name: "", code: "" }, validate: { name: (v) => (v ? null : "Requis") } });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try { await createStructure({ name: values.name, code: values.code || null }); onDone(); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Nom" withAsterisk placeholder="Ex. Enseignant permanent" {...form.getInputProps("name")} />
        <TextInput label="Code" placeholder="Ex. PERM" {...form.getInputProps("code")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Créer</Button>
        </div>
      </Stack>
    </form>
  );
}

function RulesPanel({ structure }: { structure: SalaryStructure }) {
  const q = useQuery(() => listRules(structure.id), [structure.id]);
  const form = useForm({
    mode: "controlled",
    initialValues: { label: "", code: "", category: "", lineType: "EARNING" as PayslipLineType, computation: "FIXED" as RuleComputation, value: 0 as number | string, sequence: 10 as number | string },
    validate: { label: (v) => (v ? null : "Requis") },
  });
  const [adding, setAdding] = useState(false);

  async function add(values: typeof form.values) {
    setAdding(true);
    try {
      await addRule(structure.id, {
        label: values.label, code: values.code || null, category: values.category || null,
        lineType: values.lineType, computation: values.computation,
        value: Number(values.value) || 0, sequence: Number(values.sequence) || 10,
      });
      form.reset();
      q.refetch();
    } catch (err) { notifyError(err); } finally { setAdding(false); }
  }

  return (
    <div className="space-y-4">
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Type</TH><TH>Calcul</TH><TH>Valeur</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-6 text-center text-slate-400">Aucune règle.</TD></TR>}
            {(q.data ?? []).map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.label}{r.code ? <span className="ml-1 text-xs text-slate-400">({r.code})</span> : null}</TD>
                <TD><Badge tone={r.lineType === "EARNING" ? "green" : "amber"}>{LINE_TYPE_LABEL[r.lineType]}</Badge></TD>
                <TD className="text-xs text-slate-600">{COMPUTATION_LABEL[r.computation]}</TD>
                <TD>{r.computation === "FIXED" ? formatGNF(r.value) : `${r.value} %`}</TD>
                <TD className="text-right"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => deleteRule(r.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <form onSubmit={form.onSubmit(add)} className="rounded-xl border border-slate-200 p-3">
        <p className="mb-2 text-sm font-semibold text-slate-700">Ajouter une règle</p>
        <Stack gap="sm">
          <div className="grid grid-cols-2 gap-2">
            <TextInput label="Libellé" withAsterisk placeholder="Ex. Prime de logement" {...form.getInputProps("label")} />
            <TextInput label="Code" placeholder="HRA" {...form.getInputProps("code")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select label="Type" allowDeselect={false} data={[{ value: "EARNING", label: "Gain" }, { value: "DEDUCTION", label: "Retenue" }]} {...form.getInputProps("lineType")} />
            <TextInput label="Catégorie" placeholder="Allowance / Deduction" {...form.getInputProps("category")} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Select label="Calcul" allowDeselect={false}
              data={(Object.keys(COMPUTATION_LABEL) as RuleComputation[]).map((c) => ({ value: c, label: COMPUTATION_LABEL[c] }))}
              {...form.getInputProps("computation")} />
            <NumberInput label="Valeur" min={0} {...form.getInputProps("value")} />
            <NumberInput label="Ordre" min={0} {...form.getInputProps("sequence")} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={adding}>Ajouter la règle</Button>
          </div>
        </Stack>
      </form>
    </div>
  );
}

// ── Rémunération (horaire/fixe) & paie mensuelle (heures réalisées − retards) ──────
function CompensationTab() {
  const teachersQuery = useQuery(listTeachers, []);
  const teachers = teachersQuery.data ?? [];
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const tid = teacherId ? Number(teacherId) : null;

  const compQuery = useQuery(() => (tid ? getCompensation(tid) : Promise.resolve(null)), [teacherId]);

  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const payQuery = useQuery(() => (tid ? getMonthlyPay(tid, y, m) : Promise.resolve(null)), [teacherId, period]);

  const fmtH = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  const p: MonthlyPay | null | undefined = payQuery.data;
  const teacherName = teachers.find((t) => t.id === tid);
  const [genLoading, setGenLoading] = useState(false);

  async function genPayslip() {
    if (!tid) return;
    setGenLoading(true);
    try {
      await generatePayslipFromHours(tid, y, m, teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : null);
      notifySuccess("Fiche de paie générée (onglet Fiches de paie)");
    } catch (e) { notifyError(e); } finally { setGenLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <Select label="Enseignant / personnel" placeholder="Choisir" searchable
          data={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
          value={teacherId} onChange={setTeacherId} />
      </div>

      {!tid ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Sélectionnez une personne pour paramétrer sa rémunération.</p>
      ) : (
        <>
          {compQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <CompForm key={teacherId} teacherId={tid} initial={compQuery.data ?? null} teacher={teacherName ?? null}
              onSaved={() => { compQuery.refetch(); payQuery.refetch(); }} />
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-700">Paie du mois</h3>
              <TextInput type="month" label="Mois" value={period} onChange={(e) => setPeriod(e.currentTarget.value)} />
            </div>
            {payQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : p ? (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Heures réalisées", value: fmtH(p.realizedMinutes) },
                  { label: "Retard cumulé", value: fmtH(p.lateMinutes), warn: p.lateMinutes > 0 },
                  { label: "Heures effectives", value: fmtH(p.effectiveMinutes) },
                  { label: "Paie des cours", value: formatGNF(p.teachingPay) },
                  { label: "Salaire fixe", value: p.payMode === "FIXED" ? formatGNF(p.fixedSalary) : "—" },
                  { label: "Net à payer", value: formatGNF(p.grossPay), strong: true },
                ].map((c) => (
                  <div key={c.label} className={`rounded-xl px-3 py-3 ${c.strong ? "bg-brand-50" : "bg-slate-50"}`}>
                    <p className="text-xs text-slate-500">{c.label}</p>
                    <p className={`mt-1 text-base font-bold ${c.warn ? "text-red-600" : "text-slate-900"}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {p && (
              <div className="mt-3 flex justify-end">
                <Button onClick={genPayslip} loading={genLoading}>Générer la fiche de paie</Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function CompForm({ teacherId, initial, teacher, onSaved }: {
  teacherId: number; initial: TeacherCompensation | null;
  teacher?: { remunerationType?: string | null; remunerationRate?: string | number | null } | null;
  onSaved: () => void;
}) {
  // Repli sur la fiche enseignant (type de rémunération + taux saisis à la création) tant qu'aucune
  // compensation de paie n'a été enregistrée → le tarif se pré-remplit automatiquement.
  const fbRate = teacher?.remunerationRate != null && teacher.remunerationRate !== "" ? Number(teacher.remunerationRate) : 0;
  const fbHourly = teacher?.remunerationType === "HORAIRE";
  const prefilled = !initial && fbRate > 0;
  const [payMode, setPayMode] = useState<PayMode>(initial?.payMode ?? (fbHourly ? "HOURLY" : "FIXED"));
  const [hourlyRate, setHourlyRate] = useState<number | string>(initial ? Number(initial.hourlyRate) : (fbHourly ? fbRate : 0));
  const [fixedSalary, setFixedSalary] = useState<number | string>(initial ? Number(initial.fixedSalary) : (fbHourly ? 0 : fbRate));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setCompensation(teacherId, { payMode, hourlyRate: Number(hourlyRate) || 0, fixedSalary: Number(fixedSalary) || 0 });
      notifySuccess("Rémunération enregistrée");
      onSaved();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">Mode de rémunération</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <Select label="Mode" allowDeselect={false} value={payMode}
          data={[{ value: "HOURLY", label: "Horaire (aux heures réalisées)" }, { value: "FIXED", label: "Salaire fixe" }]}
          onChange={(v) => setPayMode((v ?? "HOURLY") as PayMode)} />
        <NumberInput label="Tarif horaire (GNF)" thousandSeparator=" " min={0} value={hourlyRate} onChange={setHourlyRate} />
        <NumberInput label="Salaire fixe (GNF)" thousandSeparator=" " min={0} value={fixedSalary} onChange={setFixedSalary}
          disabled={payMode === "HOURLY"} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        {prefilled
          ? <p className="text-xs text-emerald-600">Pré-rempli depuis la fiche enseignant — enregistrez pour confirmer.</p>
          : <span />}
        <Button onClick={save} loading={saving}>Enregistrer</Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Horaire : paie = heures effectives × tarif. Fixe : salaire fixe + heures de cours effectives × tarif
        (direction qui enseigne aussi). Heures comptées quand la séance est « réalisée », moins les retards.
      </p>
    </div>
  );
}
