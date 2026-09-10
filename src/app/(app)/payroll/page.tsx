"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Banknote, Clock, FileSpreadsheet, Megaphone, Plus, Settings as SettingsIcon, HandCoins } from "lucide-react";
import { FeeDeductionPanel } from "@/components/payroll/fee-deduction-panel";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getAssignedClasses, listEmployees, listTeachers, type Employee } from "@/lib/api/staff";
import { getCurrentAcademicYear, listClasses } from "@/lib/api/academics";
import { EMPLOYEE_CATEGORY_LABEL } from "@/components/staff/employee-form";
import { sendDiffusion } from "@/lib/api/communication";
import {
  addRule,
  addPayslipLine,
  removePayslipLine,
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
  listVacationPayMonths,
  addVacationPayMonth,
  removeVacationPayMonth,
  getMonthlyPay,
  getTheoreticalPay,
  generatePayslipFromHours,
  generatePayslipFromTimetable,
  generateCombinedPayslip,
  type PayMode,
  type MonthlyPay,
  type TheoreticalMonthlyPay,
  type TeacherCompensation,
  type TeacherVacationPayMonth,
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
import { Input, Label, Field, MoneyInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const STATUS_TONE: Record<Payslip["status"], "gray" | "indigo" | "green"> = { DRAFT: "gray", VALIDATED: "indigo", PAID: "green" };

export default function PayrollPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") && !hasAnyPermission(user, ["paie:manage"])) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé à l&apos;administration / comptabilité.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paie</h1>
        <p className="text-sm text-gray-500">Fiches de paie des enseignants et structures salariales</p>
      </Reveal>
      <Tabs defaultValue="payslips">
        <TabsList>
          <TabsTrigger value="payslips" icon={Banknote}>Fiches de paie</TabsTrigger>
          <TabsTrigger value="compensation" icon={Clock}>Rémunération & heures</TabsTrigger>
          <TabsTrigger value="structures" icon={SettingsIcon}>Structures salariales</TabsTrigger>
          <TabsTrigger value="deductions" icon={HandCoins}>Déductions scolarité</TabsTrigger>
        </TabsList>
        <TabsPanel value="payslips"><PayslipsTab /></TabsPanel>
        <TabsPanel value="compensation"><CompensationTab /></TabsPanel>
        <TabsPanel value="structures"><StructuresTab /></TabsPanel>
        <TabsPanel value="deductions"><FeeDeductionPanel canWrite={hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["paie:manage"])} /></TabsPanel>
      </Tabs>
    </div>
  );
}

function PayslipsTab() {
  const { user } = useAuth();
  const teachersQuery = useQuery(listTeachers, []);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const teacherName = useMemo(() => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachers]);
  const structuresQuery = useQuery(listStructures, []);

  const [status, setStatus] = useState<Payslip["status"] | "">("");
  const q = useQuery(() => listPayslips({ status: status || undefined }), [status]);

  const [generating, setGenerating] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [linesFor, setLinesFor] = useState<Payslip | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [staffPayslipOpen, setStaffPayslipOpen] = useState(false);

  function act(p: Promise<unknown>) { p.then(() => { notifySuccess("Mis à jour"); q.refetch(); }).catch(notifyError); }
  function remove(p: Payslip) {
    confirmAction({ title: "Supprimer la fiche", message: "Confirmer ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deletePayslip(p.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  async function downloadBankFile() {
    try { window.open(await bankFileUrl(), "_blank"); } catch (e) { notifyError(e); }
  }
  function notifyStaffSalariesAvailable() {
    confirmAction({
      title: "Notifier tout le personnel",
      message: "Un SMS « Les salaires sont disponibles » sera envoyé à tous les enseignants et à tout le personnel. Confirmer ?",
      confirmLabel: "Envoyer",
      onConfirm: async () => {
        setNotifying(true);
        try {
          await sendDiffusion({
            tenantId: user?.tenantId ?? null,
            senderId: user?.userId ?? null,
            channel: "SMS",
            audience: "ALL_STAFF",
            reason: "GENERAL",
            subject: "Salaires disponibles",
            content: "Les salaires sont disponibles. Merci de vous rapprocher de la comptabilité.",
          });
          notifySuccess("SMS envoyé à tout le personnel");
        } catch (e) {
          notifyError(e);
        } finally {
          setNotifying(false);
        }
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as Payslip["status"] | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(PAYSLIP_STATUS_LABEL) as Payslip["status"][]).map((s) => (<option key={s} value={s}>{PAYSLIP_STATUS_LABEL[s]}</option>))}
        </Select>
        <div className="flex gap-2">
          <Button variant="secondary" loading={notifying} leftSection={<Megaphone className="h-4 w-4" />} onClick={notifyStaffSalariesAvailable}>
            Notifier salaires disponibles
          </Button>
          <Button variant="secondary" leftSection={<FileSpreadsheet className="h-4 w-4" />} onClick={downloadBankFile}>Fichier bancaire</Button>
          <Button variant="secondary" leftSection={<Banknote className="h-4 w-4" />} onClick={() => setBatchOpen(true)}>Générer en lot</Button>
          <Button variant="secondary" onClick={() => setStaffPayslipOpen(true)}>Personnel (direction/admin.)</Button>
          <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => setGenerating(true)}>Générer une fiche</Button>
        </div>
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Enseignant</TH><TH>Période</TH><TH>Base</TH><TH>Brut</TH><TH>Net</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucune fiche.</TD></TR>}
            {(q.data ?? []).map((p) => (
              <TR key={p.id}>
                <TD className="font-medium text-gray-900">{teacherName.get(p.teacherId) ?? `#${p.teacherId}`}</TD>
                <TD>{p.periodLabel}</TD>
                <TD>{formatGNF(p.baseSalary)}</TD>
                <TD>{formatGNF(p.grossSalary)}</TD>
                <TD className="font-semibold text-gray-900">{formatGNF(p.netSalary)}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setLinesFor(p)}>Détails</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { try { window.open(await getPayslipPdfObjectUrl(p.id), "_blank"); } catch (e) { notifyError(e); } }}>PDF</Button>
                    {p.status === "DRAFT" && <Button size="sm" variant="ghost" onClick={() => act(approvePayslip(p.id))}>Valider</Button>}
                    {p.status === "VALIDATED" && <Button size="sm" variant="ghost" onClick={() => act(payPayslip(p.id))}>Payer</Button>}
                    {p.status === "DRAFT" && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(p)}>Suppr.</Button>}
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

      <Modal open={staffPayslipOpen} onClose={() => setStaffPayslipOpen(false)} title="Fiches de paie — personnel direction/administratif" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <StaffPayslipPanel structures={structuresQuery.data ?? []} onGenerated={() => { notifySuccess("Fiche générée"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

/**
 * Génération de fiche de paie pour le personnel non-enseignant (direction/administratif/soutien) —
 * absent du formulaire « Générer une fiche » (réservé aux enseignants, calcul sur heures). Deux
 * options par personne : fiche simple (salaire de base fixe), ou — si un enseignant est lié à sa
 * fiche (§staff, « Enseigne aussi ») — fiche combinée (salaire de base + heures d'enseignement
 * calculées automatiquement, voir generateCombinedPayslip).
 */
function StaffPayslipPanel({ structures, onGenerated }: { structures: SalaryStructure[]; onGenerated: () => void }) {
  const employeesQuery = useQuery(listEmployees, []);
  const employees = employeesQuery.data ?? [];
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [structureId, setStructureId] = useState("");
  const [generatingId, setGeneratingId] = useState<number | null>(null);
  const [y, m] = period.split("-").map(Number);
  const periodLabel = `${["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"][m - 1]} ${y}`;

  async function generateFixed(emp: Employee) {
    setGeneratingId(emp.id);
    try {
      await generatePayslip({
        employeeType: emp.category, teacherId: emp.id, teacherName: `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim(),
        periodLabel, baseSalary: Number(emp.baseSalary ?? 0),
        structureId: structureId ? Number(structureId) : null,
      });
      onGenerated();
    } catch (err) { notifyError(err); } finally { setGeneratingId(null); }
  }

  async function generateCombined(emp: Employee) {
    if (!emp.linkedTeacherId) return;
    setGeneratingId(emp.id);
    try {
      await generateCombinedPayslip({
        year: y, month: m, employeeId: emp.id, employeeName: `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim(),
        employeeType: emp.category, baseSalary: Number(emp.baseSalary ?? 0),
        linkedTeacherId: emp.linkedTeacherId, structureId: structureId ? Number(structureId) : null,
      });
      onGenerated();
    } catch (err) { notifyError(err); } finally { setGeneratingId(null); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Mois</Label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <Field>
          <Label>Structure salariale</Label>
          <Select value={structureId} onChange={(e) => setStructureId(e.target.value)}>
            <option value="">Aucune (base seule)</option>
            {structures.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        </Field>
      </div>
      {employeesQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Personnel</TH><TH>Poste</TH><TH>Salaire de base</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {employees.length === 0 && <TR><TD colSpan={4} className="py-8 text-center text-gray-400">Aucun personnel.</TD></TR>}
            {employees.map((emp) => (
              <TR key={emp.id}>
                <TD className="font-medium text-gray-900">{emp.firstName} {emp.lastName}</TD>
                <TD className="text-gray-600">{EMPLOYEE_CATEGORY_LABEL[emp.category]}{emp.jobTitle ? ` — ${emp.jobTitle}` : ""}</TD>
                <TD>{formatGNF(emp.baseSalary ?? 0)}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" loading={generatingId === emp.id} onClick={() => generateFixed(emp)}>
                      Fiche simple
                    </Button>
                    {emp.linkedTeacherId != null && (
                      <Button size="sm" variant="ghost" loading={generatingId === emp.id} onClick={() => generateCombined(emp)}>
                        Fiche combinée
                      </Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

const generateSchema = z.object({
  teacherId: z.string().min(1, "Requis"),
  periodLabel: z.string().trim().min(1, "Requis"),
  structureId: z.string(),
  baseSalary: z.union([z.number(), z.literal("")]),
  periodStart: z.string(),
  periodEnd: z.string(),
  absentDays: z.union([z.number(), z.literal("")]),
  workingDays: z.union([z.number(), z.literal("")]),
  overtimeHours: z.union([z.number(), z.literal("")]),
  overtimeRate: z.union([z.number(), z.literal("")]),
  overtimeMultiplier: z.string(),
});
type GenerateFormValues = z.infer<typeof generateSchema>;

function GenerateForm({ teachers, structures, onCancel, onDone }: {
  teachers: { id: number; firstName: string; lastName: string; remunerationRate?: number | string | null }[];
  structures: SalaryStructure[]; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      teacherId: "", periodLabel: "", structureId: "", baseSalary: 0, periodStart: "", periodEnd: "",
      absentDays: 0, workingDays: 26,
      overtimeHours: 0, overtimeRate: 0, overtimeMultiplier: "1.5",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  const teacherOptions: SearchableOption[] = useMemo(
    () => teachers.map((t) => {
      const label = `${t.firstName} ${t.lastName}`;
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
    [teachers],
  );

  function onTeacher(value: string) {
    setValue("teacherId", value);
    const t = teachers.find((x) => String(x.id) === value);
    if (t?.remunerationRate != null && t.remunerationRate !== "") setValue("baseSalary", Number(t.remunerationRate));
  }

  // Auto-remplit les jours d'absence depuis le pointage dès que l'enseignant + la période sont saisis.
  const { teacherId, periodStart, periodEnd } = v;
  useEffect(() => {
    if (!teacherId || !periodStart || !periodEnd) return;
    let active = true;
    getTeacherAttendanceStats(Number(teacherId), periodStart, periodEnd)
      .then((s) => { if (active) setValue("absentDays", s.absentDays ?? 0); })
      .catch(() => { /* pointage indisponible : saisie manuelle */ });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, periodStart, periodEnd]);

  async function submit(values: GenerateFormValues) {
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
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Enseignant <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.teacherId} options={teacherOptions} onChange={onTeacher} triggerClassName="w-full justify-between px-3" />
        {errors.teacherId && <p className="text-xs text-error-600">{errors.teacherId.message}</p>}
      </Field>
      <Field>
        <Label>Période <span className="text-error-500">*</span></Label>
        <Input placeholder="Ex. Juin 2026" value={v.periodLabel} onChange={(e) => setValue("periodLabel", e.target.value)} aria-invalid={!!errors.periodLabel} />
        {errors.periodLabel && <p className="text-xs text-error-600">{errors.periodLabel.message}</p>}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Du</Label>
          <DatePicker value={v.periodStart} onChange={(val) => setValue("periodStart", val)} clearable />
        </Field>
        <Field>
          <Label>Au</Label>
          <DatePicker value={v.periodEnd} onChange={(val) => setValue("periodEnd", val)} clearable />
        </Field>
      </div>
      <Field>
        <Label>Salaire de base (GNF)</Label>
        <Input type="number" min={0} value={v.baseSalary} onChange={(e) => setValue("baseSalary", e.target.value === "" ? "" : Number(e.target.value))} />
      </Field>
      <Field>
        <Label>Structure salariale</Label>
        <Select value={v.structureId} onChange={(e) => setValue("structureId", e.target.value)}>
          <option value="">Aucune (base seule)</option>
          {structures.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </Field>

      <div className="rounded-xl border border-gray-200 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-700">Pointage & heures supplémentaires</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field>
            <Label>Jours d&apos;absence</Label>
            <Input type="number" min={0} value={v.absentDays} onChange={(e) => setValue("absentDays", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field>
            <Label>Jours ouvrés (mois)</Label>
            <Input type="number" min={1} value={v.workingDays} onChange={(e) => setValue("workingDays", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
        </div>
        <p className="mt-1 text-xs text-gray-400">Jours d&apos;absence <strong>récupérés automatiquement</strong> du pointage sur la période (modifiable). Retenue = (base ÷ jours ouvrés) × jours d&apos;absence.</p>
        <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Field>
            <Label>Heures sup.</Label>
            <Input type="number" min={0} value={v.overtimeHours} onChange={(e) => setValue("overtimeHours", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field>
            <Label>Taux horaire (GNF)</Label>
            <Input type="number" min={0} value={v.overtimeRate} onChange={(e) => setValue("overtimeRate", e.target.value === "" ? "" : Number(e.target.value))} />
          </Field>
          <Field>
            <Label>Coefficient</Label>
            <Select value={v.overtimeMultiplier} onChange={(e) => setValue("overtimeMultiplier", e.target.value)}>
              <option value="1">×1</option>
              <option value="1.5">×1.5 (ordinaire)</option>
              <option value="2">×2 (week-end)</option>
              <option value="2.5">×2.5 (férié)</option>
            </Select>
          </Field>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Calculer & créer</Button>
      </div>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Base</p><p className="font-semibold">{formatGNF(current.baseSalary)}</p></div>
        <div className="rounded-lg bg-gray-50 p-2"><p className="text-xs text-gray-500">Brut</p><p className="font-semibold">{formatGNF(current.grossSalary)}</p></div>
        <div className="rounded-lg bg-success-50 p-2"><p className="text-xs text-gray-500">Net</p><p className="font-semibold text-success-700">{formatGNF(current.netSalary)}</p></div>
      </div>

      {current.notes && (
        <div className="rounded-lg border border-brand-100 bg-brand-50/50 p-3">
          <p className="text-xs font-semibold text-brand-700">Détail du calcul (heures réalisées, retard, départ anticipé)</p>
          <p className="mt-1 text-sm text-gray-700">{current.notes}</p>
        </div>
      )}
      {linesQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Type</TH><TH className="text-right">Montant</TH>{editable && <TH />}</tr></THead>
          <TBody>
            {(linesQuery.data ?? []).length === 0 && <TR><TD colSpan={editable ? 4 : 3} className="py-6 text-center text-gray-400">Aucune ligne (base seule).</TD></TR>}
            {(linesQuery.data ?? []).map((l) => (
              <TR key={l.id}>
                <TD>{l.label}</TD>
                <TD><Badge tone={l.lineType === "EARNING" ? "green" : "amber"}>{LINE_TYPE_LABEL[l.lineType]}</Badge></TD>
                <TD className="text-right">{l.lineType === "DEDUCTION" ? "−" : "+"} {formatGNF(l.amount)}</TD>
                {editable && <TD className="text-right"><Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(l.id)}>Retirer</Button></TD>}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {editable ? (
        <div className="rounded-xl border border-gray-200 p-3">
          <p className="mb-2 text-sm font-semibold text-gray-700">Ajouter une prime ou une retenue</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
            <Input className="sm:col-span-2" placeholder="Ex. Prime de transport" value={label} onChange={(e) => setLabel(e.target.value)} />
            <Select value={lineType} onChange={(e) => setLineType(e.target.value as PayslipLineType)}>
              {(Object.keys(LINE_TYPE_LABEL) as PayslipLineType[]).map((t) => (<option key={t} value={t}>{LINE_TYPE_LABEL[t]}</option>))}
            </Select>
            <Input type="number" placeholder="Montant" min={0} value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
          </div>
          <div className="mt-2 flex justify-end">
            <Button size="sm" loading={saving} onClick={add} leftSection={<Plus className="h-4 w-4" />}>Ajouter la ligne</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Le brut = base + gains ; le net = brut − retenues. Le détail est figé après validation.</p>
      )}
    </div>
  );
}

/**
 * Génération en lot : le salaire de base n'est plus saisi à la main — dès qu'un enseignant est coché,
 * le système connaît déjà ses heures réalisées du mois et son tarif, donc ce qu'il doit être payé
 * (même calcul que l'onglet Rémunération, un enseignant à la fois — voir generatePayslipFromHours).
 */
function GenerateBatchForm({ teachers, structures, onCancel, onDone }: {
  teachers: { id: number; firstName: string; lastName: string }[];
  structures: SalaryStructure[]; onCancel: () => void; onDone: (count: number) => void;
}) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const [structureId, setStructureId] = useState<string>("");
  const [included, setIncluded] = useState<Set<number>>(() => new Set(teachers.map((t) => t.id)));
  const [loading, setLoading] = useState(false);

  const teacherIds = useMemo(() => teachers.map((t) => t.id), [teachers]);
  const payQuery = useQuery(
    () => Promise.all(teacherIds.map((id) => getMonthlyPay(id, y, m).then((p) => [id, p] as const))).then((entries) => new Map(entries)),
    [teacherIds.join(","), period],
  );
  const payByTeacher = payQuery.data ?? new Map<number, MonthlyPay>();

  function toggle(id: number) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function submit() {
    const ids = teachers.filter((t) => included.has(t.id)).map((t) => t.id);
    if (ids.length === 0) { notifyError(new Error("Sélectionnez au moins un enseignant.")); return; }
    setLoading(true);
    try {
      const results = await Promise.all(ids.map((id) => {
        const t = teachers.find((x) => x.id === id);
        return generatePayslipFromHours(id, y, m, t ? `${t.firstName} ${t.lastName}` : null, structureId ? Number(structureId) : null);
      }));
      onDone(results.length);
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  const selectedCount = included.size;
  const fmtH = (min: number) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Mois <span className="text-error-500">*</span></Label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
        <Field>
          <Label>Structure salariale (optionnel)</Label>
          <Select value={structureId} onChange={(e) => setStructureId(e.target.value)}>
            <option value="">Aucune</option>
            {structures.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </Select>
        </Field>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Enseignants ({selectedCount} sélectionné(s))</p>
          <div className="flex gap-2 text-xs">
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setIncluded(new Set(teacherIds))}>Tout cocher</button>
            <button type="button" className="text-gray-500 hover:underline" onClick={() => setIncluded(new Set())}>Tout décocher</button>
          </div>
        </div>
        <div className="max-h-72 overflow-auto rounded-xl border border-gray-200">
          <Table>
            <THead><tr><TH /><TH>Enseignant</TH><TH className="text-right">Heures réalisées</TH><TH className="text-right">À payer</TH></tr></THead>
            <TBody>
              {teachers.length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucun enseignant.</TD></TR>}
              {teachers.map((t) => {
                const p = payByTeacher.get(t.id);
                return (
                  <TR key={t.id}>
                    <TD><Checkbox checked={included.has(t.id)} onChange={() => toggle(t.id)} /></TD>
                    <TD className="font-medium text-gray-900">{t.firstName} {t.lastName}</TD>
                    <TD className="text-right text-sm text-gray-600">{p ? fmtH(p.realizedMinutes) : "…"}</TD>
                    <TD className="text-right font-semibold text-gray-900">{p ? formatGNF(p.grossPay) : "…"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Générer les fiches</Button>
      </div>
    </div>
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucune structure. Créez-en une (ex. « Enseignant permanent »).</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-gray-900">{s.name}</TD>
                <TD>{s.code ?? "—"}</TD>
                <TD>{s.active ? <Badge tone="green">Oui</Badge> : <Badge tone="gray">Non</Badge>}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setRulesFor(s)}>Règles</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(s)}>Suppr.</Button>
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

const structureSchema = z.object({ name: z.string().trim().min(1, "Requis"), code: z.string() });
type StructureFormValues = z.infer<typeof structureSchema>;

function StructureForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<StructureFormValues>({
    resolver: zodResolver(structureSchema),
    defaultValues: { name: "", code: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();
  async function submit(values: StructureFormValues) {
    setLoading(true);
    try { await createStructure({ name: values.name, code: values.code || null }); onDone(); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Nom <span className="text-error-500">*</span></Label>
        <Input placeholder="Ex. Enseignant permanent" value={v.name} onChange={(e) => setValue("name", e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
      </Field>
      <Field>
        <Label>Code</Label>
        <Input placeholder="Ex. PERM" value={v.code} onChange={(e) => setValue("code", e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Créer</Button>
      </div>
    </form>
  );
}

const ruleSchema = z.object({
  label: z.string().trim().min(1, "Requis"),
  code: z.string(),
  category: z.string(),
  lineType: z.string(),
  computation: z.string(),
  value: z.union([z.number(), z.literal("")]),
  sequence: z.union([z.number(), z.literal("")]),
});
type RuleFormValues = z.infer<typeof ruleSchema>;

function RulesPanel({ structure }: { structure: SalaryStructure }) {
  const q = useQuery(() => listRules(structure.id), [structure.id]);
  const { handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<RuleFormValues>({
    resolver: zodResolver(ruleSchema),
    defaultValues: { label: "", code: "", category: "", lineType: "EARNING", computation: "FIXED", value: 0, sequence: 10 },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();
  const [adding, setAdding] = useState(false);

  async function add(values: RuleFormValues) {
    setAdding(true);
    try {
      await addRule(structure.id, {
        label: values.label, code: values.code || null, category: values.category || null,
        lineType: values.lineType as PayslipLineType, computation: values.computation as RuleComputation,
        value: Number(values.value) || 0, sequence: Number(values.sequence) || 10,
      });
      reset();
      q.refetch();
    } catch (err) { notifyError(err); } finally { setAdding(false); }
  }

  return (
    <div className="space-y-4">
      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Type</TH><TH>Calcul</TH><TH>Valeur</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-6 text-center text-gray-400">Aucune règle.</TD></TR>}
            {(q.data ?? []).map((r) => (
              <TR key={r.id}>
                <TD className="font-medium">{r.label}{r.code ? <span className="ml-1 text-xs text-gray-400">({r.code})</span> : null}</TD>
                <TD><Badge tone={r.lineType === "EARNING" ? "green" : "amber"}>{LINE_TYPE_LABEL[r.lineType]}</Badge></TD>
                <TD className="text-xs text-gray-600">{COMPUTATION_LABEL[r.computation]}</TD>
                <TD>{r.computation === "FIXED" ? formatGNF(r.value) : `${r.value} %`}</TD>
                <TD className="text-right"><Button size="sm" variant="ghost" className="text-error-600" onClick={() => deleteRule(r.id).then(() => q.refetch()).catch(notifyError)}>Suppr.</Button></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <form onSubmit={handleSubmit(add)} className="rounded-xl border border-gray-200 p-3">
        <p className="mb-2 text-sm font-semibold text-gray-700">Ajouter une règle</p>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field>
              <Label>Libellé <span className="text-error-500">*</span></Label>
              <Input placeholder="Ex. Prime de logement" value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
              {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
            </Field>
            <Field>
              <Label>Code</Label>
              <Input placeholder="HRA" value={v.code} onChange={(e) => setValue("code", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field>
              <Label>Type</Label>
              <Select value={v.lineType} onChange={(e) => setValue("lineType", e.target.value)}>
                <option value="EARNING">Gain</option>
                <option value="DEDUCTION">Retenue</option>
              </Select>
            </Field>
            <Field>
              <Label>Catégorie</Label>
              <Input placeholder="Allowance / Deduction" value={v.category} onChange={(e) => setValue("category", e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field>
              <Label>Calcul</Label>
              <Select value={v.computation} onChange={(e) => setValue("computation", e.target.value)}>
                {(Object.keys(COMPUTATION_LABEL) as RuleComputation[]).map((c) => (<option key={c} value={c}>{COMPUTATION_LABEL[c]}</option>))}
              </Select>
            </Field>
            <Field>
              <Label>Valeur</Label>
              <Input type="number" min={0} value={v.value} onChange={(e) => setValue("value", e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
            <Field>
              <Label>Ordre</Label>
              <Input type="number" min={0} value={v.sequence} onChange={(e) => setValue("sequence", e.target.value === "" ? "" : Number(e.target.value))} />
            </Field>
          </div>
          <div className="flex justify-end">
            <Button type="submit" size="sm" loading={adding}>Ajouter la règle</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Rémunération (horaire/fixe) & paie mensuelle (heures réalisées − retards) ──────
function CompensationTab() {
  const teachersQuery = useQuery(listTeachers, []);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const [teacherId, setTeacherId] = useState<string>("");
  const tid = teacherId ? Number(teacherId) : null;

  // Classes de chaque enseignant — pour que le sélecteur affiche « Nom (Classe A, Classe B) » au lieu
  // du seul nom : avec plusieurs enseignants homonymes ou peu connus, impossible de savoir dans quelle
  // classe chacun évolue avant de le sélectionner.
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);
  const classesQuery = useQuery(
    () => (currentYearQuery.data ? listClasses(currentYearQuery.data.id) : Promise.resolve([])),
    [currentYearQuery.data?.id],
  );
  const classLabelById = useMemo(() => new Map(classesQuery.data?.map((c) => [c.id, c.label]) ?? []), [classesQuery.data]);
  const assignedClassesQuery = useQuery(
    () => Promise.all(teachers.map((t) => getAssignedClasses(t.id).then((ids) => [t.id, ids] as const)))
      .then((entries) => new Map(entries)),
    [teachers.map((t) => t.id).join(",")],
  );
  const classesLabelByTeacher = useMemo(() => {
    const map = new Map<number, string>();
    for (const t of teachers) {
      const ids = assignedClassesQuery.data?.get(t.id) ?? [];
      const labels = ids.map((id) => classLabelById.get(id)).filter((l): l is string => !!l);
      map.set(t.id, labels.join(", "));
    }
    return map;
  }, [teachers, assignedClassesQuery.data, classLabelById]);

  const compQuery = useQuery(() => (tid ? getCompensation(tid) : Promise.resolve(null)), [teacherId]);

  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const payQuery = useQuery(() => (tid ? getMonthlyPay(tid, y, m) : Promise.resolve(null)), [teacherId, period]);
  const theoreticalQuery = useQuery(() => (tid ? getTheoreticalPay(tid, y, m) : Promise.resolve(null)), [teacherId, period]);

  const fmtH = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  const p: MonthlyPay | null | undefined = payQuery.data;
  const tp: TheoreticalMonthlyPay | null | undefined = theoreticalQuery.data;
  const teacherName = teachers.find((t) => t.id === tid);
  const [genLoading, setGenLoading] = useState(false);
  const [genTimetableLoading, setGenTimetableLoading] = useState(false);

  const teacherOptions: SearchableOption[] = useMemo(
    () => teachers.map((t) => {
      const classesLabel = classesLabelByTeacher.get(t.id);
      const name = `${t.firstName} ${t.lastName}`;
      const label = classesLabel ? `${name} — ${classesLabel}` : name;
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
    [teachers, classesLabelByTeacher],
  );

  async function genPayslip() {
    if (!tid) return;
    setGenLoading(true);
    try {
      await generatePayslipFromHours(tid, y, m, teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : null);
      notifySuccess("Fiche de paie générée (onglet Fiches de paie)");
    } catch (e) { notifyError(e); } finally { setGenLoading(false); }
  }

  async function genPayslipFromTimetable() {
    if (!tid) return;
    setGenTimetableLoading(true);
    try {
      await generatePayslipFromTimetable(tid, y, m, teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : null);
      notifySuccess("Estimation générée (onglet Fiches de paie) — à ne pas confondre avec le bulletin réel");
    } catch (e) { notifyError(e); } finally { setGenTimetableLoading(false); }
  }

  return (
    <div className="space-y-5">
      <div className="max-w-md">
        <Label>Enseignant / personnel</Label>
        <SearchableSelect value={teacherId} options={teacherOptions} onChange={setTeacherId} triggerClassName="w-full justify-between px-3" />
      </div>

      {!tid ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Sélectionnez une personne pour paramétrer sa rémunération.</p>
      ) : (
        <>
          {compQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <CompForm key={teacherId} teacherId={tid} initial={compQuery.data ?? null} teacher={teacherName ?? null}
              onSaved={() => { compQuery.refetch(); payQuery.refetch(); theoreticalQuery.refetch(); }} />
          )}

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-700">Paie du mois</h3>
              <Field>
                <Label>Mois</Label>
                <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </Field>
            </div>
            {payQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : p ? (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Heures réalisées", value: fmtH(p.realizedMinutes) },
                  { label: "Retard cumulé", value: fmtH(p.lateMinutes), warn: p.lateMinutes > 0 },
                  { label: "Départ anticipé cumulé", value: fmtH(p.earlyMinutes), warn: p.earlyMinutes > 0 },
                  { label: "Heures effectives", value: fmtH(p.effectiveMinutes) },
                  { label: "Dont classes normales", value: fmtH(p.normalEffectiveMinutes) },
                  { label: "Dont classes d'examen", value: fmtH(p.examEffectiveMinutes) },
                  { label: "Paie des cours", value: formatGNF(p.teachingPay) },
                  { label: "Salaire fixe", value: p.payMode === "FIXED" ? formatGNF(p.fixedSalary) : "—" },
                  { label: "Montant brut estimé", value: formatGNF(p.grossPay), strong: true },
                ].map((c) => (
                  <div key={c.label} className={`rounded-xl px-3 py-3 ${c.strong ? "bg-brand-50" : "bg-gray-50"}`}>
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className={`mt-1 text-base font-bold ${c.warn ? "text-error-600" : "text-gray-900"}`}>{c.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {p && (
              <>
                <p className="mt-2 text-xs text-gray-400">
                  Montant brut, avant déductions (CNSS, frais scolarité du personnel…) — le net à payer
                  n&apos;est calculé qu&apos;une fois la fiche de paie générée ci-dessous.
                </p>
                <div className="mt-3 flex justify-end">
                  <Button onClick={genPayslip} loading={genLoading}>Générer la fiche de paie</Button>
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">
              Estimation prévisionnelle (emploi du temps) — par typologie de classe, sans saisie manuelle
            </h3>
            <p className="mb-3 text-xs text-amber-700">
              Cette estimation compte les heures prévues à l&apos;emploi du temps même si la séance n&apos;a pas
              encore eu lieu. Pour un enseignant payé à l&apos;heure, générez le bulletin réel depuis
              « Paie du mois » ci-dessus une fois les séances marquées réalisées — ne l&apos;utilisez pas comme
              bulletin définitif.
            </p>
            {theoreticalQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : tp ? (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "Heures classes normales", value: fmtH(tp.normalMinutes) },
                  { label: "Heures classes d'examen", value: fmtH(tp.examMinutes) },
                  { label: "Tarif normale", value: formatGNF(tp.hourlyRateNormal) },
                  { label: "Tarif examen", value: formatGNF(tp.hourlyRateExam) },
                  { label: "Salaire fixe", value: tp.payMode === "FIXED" ? formatGNF(tp.fixedSalary) : "—" },
                  { label: "Montant brut estimé", value: formatGNF(tp.grossPay), strong: true },
                ].map((c) => (
                  <div key={c.label} className={`rounded-xl px-3 py-3 ${c.strong ? "bg-brand-50" : "bg-gray-50"}`}>
                    <p className="text-xs text-gray-500">{c.label}</p>
                    <p className="mt-1 text-base font-bold text-gray-900">{c.value}</p>
                  </div>
                ))}
              </div>
            ) : null}
            {tp && (
              <div className="mt-3 flex items-center justify-between gap-3">
                {tp.payMode === "HOURLY" && (
                  <span className="text-xs font-medium text-amber-700">
                    Enseignant payé à l&apos;heure : préférez « Paie du mois » pour le bulletin réel.
                  </span>
                )}
                <Button variant="secondary" className="ml-auto" onClick={genPayslipFromTimetable} loading={genTimetableLoading}>
                  Générer une estimation
                </Button>
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
  const [hourlyRateNormal, setHourlyRateNormal] = useState<number | string>(initial ? Number(initial.hourlyRateNormal) : (fbHourly ? fbRate : 0));
  const [hourlyRateExam, setHourlyRateExam] = useState<number | string>(initial ? Number(initial.hourlyRateExam) : 0);
  const [fixedSalary, setFixedSalary] = useState<number | string>(initial ? Number(initial.fixedSalary) : (fbHourly ? 0 : fbRate));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await setCompensation(teacherId, {
        payMode, hourlyRateNormal: Number(hourlyRateNormal) || 0,
        hourlyRateExam: Number(hourlyRateExam) || 0, fixedSalary: Number(fixedSalary) || 0,
      });
      notifySuccess("Rémunération enregistrée");
      onSaved();
    } catch (e) { notifyError(e); } finally { setSaving(false); }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-700">Mode de rémunération</h3>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field>
          <Label>Mode</Label>
          <Select value={payMode} onChange={(e) => setPayMode(e.target.value as PayMode)}>
            <option value="HOURLY">Horaire (aux heures réalisées)</option>
            <option value="FIXED">Salaire fixe</option>
          </Select>
        </Field>
        <Field>
          <Label>Tarif horaire — classe normale</Label>
          <MoneyInput value={hourlyRateNormal} onValueChange={setHourlyRateNormal} />
        </Field>
        <Field>
          <Label>Tarif horaire — classe d&apos;examen</Label>
          <MoneyInput value={hourlyRateExam} onValueChange={setHourlyRateExam} />
        </Field>
        <Field>
          <Label>Salaire fixe</Label>
          <MoneyInput value={fixedSalary} onValueChange={setFixedSalary} disabled={payMode === "HOURLY"} />
        </Field>
      </div>
      <VacationPayMonths teacherId={teacherId} />
      <div className="mt-3 flex items-center justify-between gap-2">
        {prefilled
          ? <p className="text-xs text-success-600">Pré-rempli depuis la fiche enseignant — enregistrez pour confirmer.</p>
          : <span />}
        <Button onClick={save} loading={saving}>Enregistrer</Button>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Horaire : paie = heures effectives × tarif. Fixe : salaire fixe + heures de cours effectives × tarif
        (direction qui enseigne aussi). Deux tarifs distincts selon la typologie de la classe (normale / examen).
      </p>
    </div>
  );
}

/** Mois de vacances payés — choisis au cas par cas (année + mois précis), pas un interrupteur valable
 * toute l'année : la direction accorde cet avantage ponctuellement (ex. juillet 2026 seulement).
 * Le salaire fixe, lui, est de toute façon toujours versé en entier — ceci ne concerne que le calcul
 * des heures de cours théoriques (utile pour un enseignant à l'heure, ou la part « heures de cours »
 * d'un salarié fixe qui enseigne aussi). */
function VacationPayMonths({ teacherId }: { teacherId: number }) {
  const q = useQuery(() => listVacationPayMonths(teacherId), [teacherId]);
  const months = q.data ?? [];
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [adding, setAdding] = useState(false);

  async function add() {
    const [y, m] = period.split("-").map(Number);
    if (!y || !m) return;
    setAdding(true);
    try {
      await addVacationPayMonth(teacherId, y, m);
      notifySuccess("Mois de vacances payé ajouté");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setAdding(false); }
  }
  async function remove(id: number) {
    try {
      await removeVacationPayMonth(teacherId, id);
      notifySuccess("Mois retiré");
      q.refetch();
    } catch (err) { notifyError(err); }
  }

  return (
    <div className="mt-3 rounded-xl border border-gray-200 p-3">
      <p className="text-sm font-medium text-gray-700">Mois payés pendant les vacances</p>
      <p className="mt-1 text-xs text-gray-400">
        Par défaut, les jours fériés et vacances scolaires ne comptent pas dans les heures de cours
        dues du mois. Ajoutez ici les mois précis (avantage accordé au cas par cas par la direction,
        pas toute l&apos;année) où cet enseignant doit quand même être compté comme en poste — le
        salaire fixe, lui, reste de toute façon toujours versé en entier.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {months.length === 0 && !q.loading && <span className="text-xs text-gray-400">Aucun mois ajouté.</span>}
        {months.map((m: TeacherVacationPayMonth) => (
          <Badge key={m.id} tone="brand">
            <span className="mr-1.5">{String(m.month).padStart(2, "0")}/{m.year}</span>
            <button type="button" onClick={() => remove(m.id)} aria-label="Retirer" className="text-brand-700 hover:text-brand-900">✕</button>
          </Badge>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="w-40" />
        <Button size="sm" variant="secondary" onClick={add} loading={adding}>Ajouter</Button>
      </div>
    </div>
  );
}
