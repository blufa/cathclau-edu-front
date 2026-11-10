"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Banknote, Clock, Megaphone, Plus, Wallet } from "lucide-react";
import { SalaryAdvancePanel } from "@/components/payroll/salary-advance-panel";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getAssignedClasses, listEmployees, listTeachers, type Employee } from "@/lib/api/staff";
import { getCurrentAcademicYear, listClasses, listLevels } from "@/lib/api/academics";
import { setInvoiceExcludedFromStaffDeduction } from "@/lib/api/billing";
import { EMPLOYEE_CATEGORY_LABEL } from "@/components/staff/employee-form";
import { sendDiffusion } from "@/lib/api/communication";
import {
  addPayslipLine,
  removePayslipLine,
  approvePayslip,
  deletePayslip,
  generatePayslip,
  getPayslipLines,
  getPayslipPdfObjectUrl,
  listPayslips,
  listStructures,
  payPayslip,
  getCompensation,
  listCompensations,
  setCompensation,
  listVacationPayMonths,
  addVacationPayMonth,
  removeVacationPayMonth,
  getMonthlyPay,
  getTheoreticalPay,
  generatePayslipFromHours,
  generatePayslipFromTimetable,
  generatePayslipFromManualHours,
  generateCombinedPayslip,
  getTeacherCycles,
  getStaffBenefitDeductionDetail,
  refreshStaffBenefitDeductionLine,
  setChildStaffDeductionExcluded,
  TEACHER_CYCLE_LABEL,
  type PayMode,
  type MonthlyPay,
  type TheoreticalMonthlyPay,
  type TeacherCompensation,
  type TeacherVacationPayMonth,
} from "@/lib/api/payroll";
import {
  LINE_TYPE_LABEL,
  PAYSLIP_STATUS_LABEL,
  type ChildDeductionDetail,
  type DeductedInvoiceLine,
  type Payslip,
  type PayslipLineType,
  type SalaryStructure,
} from "@/lib/types/payroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field, MoneyInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { openPdfInApp } from "@/lib/open-pdf";
import { formatGNF } from "@/lib/format";

const STATUS_TONE: Record<Payslip["status"], "gray" | "indigo" | "green"> = { DRAFT: "gray", VALIDATED: "indigo", PAID: "green" };

/**
 * Si l'enseignant n'a encore jamais enregistré sa rémunération (via l'onglet dédié), computeMonthlyPay
 * côté serveur renvoie un brut à 0 (aucune TeacherCompensation en base) — la fiche générée nettait
 * alors toujours à 0 GNF, même avec des heures réalisées. On persiste ici automatiquement, avec les
 * mêmes valeurs de repli que le formulaire de rémunération (taux/type saisis à la création de
 * l'enseignant), pour que « Générer » fonctionne dès le premier clic sans étape cachée à confirmer.
 */
async function ensureTeacherCompensation(
  teacherId: number,
  teacher?: { remunerationType?: string | null; remunerationRate?: string | number | null } | null,
): Promise<void> {
  const existing = await getCompensation(teacherId);
  if (existing) return;
  const fbRate = teacher?.remunerationRate != null && teacher.remunerationRate !== "" ? Number(teacher.remunerationRate) : 0;
  if (fbRate <= 0) return;
  const fbHourly = teacher?.remunerationType === "HORAIRE";
  await setCompensation(teacherId, {
    payMode: fbHourly ? "HOURLY" : "FIXED",
    hourlyRateNormal: fbHourly ? fbRate : 0, hourlyRateExam: 0,
    fixedSalary: fbHourly ? 0 : fbRate,
  });
}

export default function PayrollPage() {
  const { user } = useAuth();
  if (!hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") && !hasAnyPermission(user, ["paie:manage"])) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé à l&apos;administration / comptabilité.</div>;
  }
  // Grille des salaires (taux horaire/fixe) : même garde que les endpoints backend
  // (TeacherCompensationController, hasAuthority('paie:manage')) et que l'entrée de menu "Paie" —
  // un comptable avec la permission paie:manage doit voir cet onglet, pas seulement SCHOOL_ADMIN/
  // DIRECTOR (retour utilisateur : "j'ai donné toute la permission finances, il ne voit toujours
  // pas cet onglet" — l'ancienne garde hasRole() seul l'excluait malgré sa permission réelle).
  const canManageCompensation = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["paie:manage"]);
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Paie</h1>
      </Reveal>
      <Tabs defaultValue={canManageCompensation ? "compensation" : "advances"}>
        <TabsList>
          {canManageCompensation && <TabsTrigger value="compensation" icon={Clock}>Rémunération & heures</TabsTrigger>}
          <TabsTrigger value="advances" icon={Wallet}>Avances sur salaire</TabsTrigger>
          <TabsTrigger value="payslips" icon={Banknote}>Fiches de paie</TabsTrigger>
        </TabsList>
        {canManageCompensation && <TabsPanel value="compensation"><CompensationTab /></TabsPanel>}
        <TabsPanel value="advances"><SalaryAdvancePanel /></TabsPanel>
        <TabsPanel value="payslips"><PayslipsTab /></TabsPanel>
      </Tabs>
    </div>
  );
}

function PayslipsTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const teacherName = useMemo(() => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachers]);
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, listEmployees, [tenantId]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);
  const employeeName = useMemo(() => new Map(employees.map((e) => [e.id, `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim()])), [employees]);
  // Enseignants et personnel ont deux séquences d'id distinctes qui peuvent coïncider (même #2 pour un
  // enseignant ET un employé) — il faut donc résoudre le nom dans le bon référentiel selon employeeType,
  // jamais toujours dans celui des enseignants (c'était la cause du repli « #id » pour le personnel).
  function personName(p: Payslip): string {
    const name = p.employeeType === "TEACHER" ? teacherName.get(p.teacherId) : employeeName.get(p.teacherId);
    return name || `#${p.teacherId}`;
  }
  const structuresQuery = useCachedQuery(tenantId ? `payroll-structures:${tenantId}` : null, listStructures, [tenantId]);

  const [status, setStatus] = useState<Payslip["status"] | "">("");
  const q = useQuery(() => listPayslips({ status: status || undefined }), [status]);

  const [batchOpen, setBatchOpen] = useState(false);
  const [linesFor, setLinesFor] = useState<Payslip | null>(null);
  const [notifying, setNotifying] = useState(false);
  const [staffPayslipOpen, setStaffPayslipOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);

  // Mode de paiement choisi EXPLICITEMENT à chaque "Marquer payée" (§retour utilisateur : "il met par
  // défaut la méthode de paiement BANK_TRANSFER alors que j'ai payé par espèce") — plus aucune
  // présomption silencieuse, ni côté front ni côté backend (voir PayrollService#markPaid).
  const [payTargetIds, setPayTargetIds] = useState<number[] | null>(null);
  const [payMethod, setPayMethod] = useState("CASH");
  const [payLoading, setPayLoading] = useState(false);
  function openPayModal(ids: number[]) { setPayMethod("CASH"); setPayTargetIds(ids); }
  async function confirmPay() {
    if (!payTargetIds || payTargetIds.length === 0) return;
    setPayLoading(true);
    try {
      const results = await Promise.allSettled(payTargetIds.map((id) => payPayslip(id, payMethod)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) notifyError(new Error(`${failed} fiche(s) sur ${payTargetIds.length} ont échoué.`));
      else notifySuccess(`${payTargetIds.length} fiche(s) payée(s).`);
      setSelected(new Set());
      setPayTargetIds(null);
      q.refetch();
    } finally {
      setPayLoading(false);
    }
  }

  function act(p: Promise<unknown>) { p.then(() => { notifySuccess("Mis à jour"); q.refetch(); }).catch(notifyError); }
  function remove(p: Payslip) {
    confirmAction({ title: "Supprimer la fiche", message: "Confirmer ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deletePayslip(p.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  const rows = q.data ?? [];
  const selectableDraft = rows.filter((p) => selected.has(p.id) && p.status === "DRAFT").map((p) => p.id);
  const selectableValidated = rows.filter((p) => selected.has(p.id) && p.status === "VALIDATED").map((p) => p.id);

  async function bulkAction(ids: number[], fn: (id: number) => Promise<unknown>, label: string) {
    if (ids.length === 0) return;
    setBulkLoading(true);
    try {
      const results = await Promise.allSettled(ids.map((id) => fn(id)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) notifyError(new Error(`${failed} fiche(s) sur ${ids.length} ont échoué.`));
      else notifySuccess(`${ids.length} fiche(s) ${label}.`);
      setSelected(new Set());
      q.refetch();
    } finally {
      setBulkLoading(false);
    }
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
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" loading={notifying} leftSection={<Megaphone className="h-4 w-4" />} onClick={notifyStaffSalariesAvailable}>
            Notifier salaires disponibles
          </Button>
          <Button variant="secondary" leftSection={<Banknote className="h-4 w-4" />} onClick={() => setBatchOpen(true)}>Générer en lot</Button>
          <Button variant="secondary" onClick={() => setStaffPayslipOpen(true)}>Personnel (direction/admin.)</Button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-brand-50 px-3 py-2">
          <p className="text-sm text-brand-800">{selected.size} fiche(s) sélectionnée(s)</p>
          <Button size="sm" loading={bulkLoading} disabled={selectableDraft.length === 0}
            onClick={() => bulkAction(selectableDraft, (id) => approvePayslip(id), "validée(s)")}>
            Valider la sélection ({selectableDraft.length})
          </Button>
          <Button size="sm" disabled={selectableValidated.length === 0}
            onClick={() => openPayModal(selectableValidated)}>
            Payer la sélection ({selectableValidated.length})
          </Button>
          <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setSelected(new Set())}>Tout décocher</button>
        </div>
      )}

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr>
            <TH>
              <Checkbox
                checked={rows.length > 0 && selected.size === rows.length}
                onChange={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((p) => p.id)))}
              />
            </TH>
            <TH>Enseignant</TH><TH>Période</TH><TH className="hidden sm:table-cell">Base</TH><TH className="hidden sm:table-cell">Brut</TH><TH>Net</TH><TH>Statut</TH><TH className="text-right">Actions</TH>
          </tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucune fiche.</TD></TR>}
            {rows.map((p) => (
              <TR key={p.id}>
                <TD><Checkbox checked={selected.has(p.id)} onChange={() => toggleSelected(p.id)} /></TD>
                <TD className="font-medium text-gray-900">{personName(p)}</TD>
                <TD>{p.periodLabel}</TD>
                <TD className="hidden sm:table-cell">{formatGNF(p.baseSalary)}</TD>
                <TD className="hidden sm:table-cell">{formatGNF(p.grossSalary)}</TD>
                <TD className="font-semibold text-gray-900">{formatGNF(p.netSalary)}</TD>
                <TD><Badge tone={STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setLinesFor(p)}>Détails</Button>
                    <Button size="sm" variant="ghost" onClick={async () => { try { openPdfInApp(await getPayslipPdfObjectUrl(p.id), "Fiche de paie"); } catch (e) { notifyError(e); } }}>PDF</Button>
                    {p.status === "DRAFT" && <Button size="sm" variant="ghost" onClick={() => act(approvePayslip(p.id))}>Valider</Button>}
                    {p.status === "VALIDATED" && <Button size="sm" variant="ghost" onClick={() => openPayModal([p.id])}>Payer</Button>}
                    {p.status === "DRAFT" && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(p)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={batchOpen} onClose={() => setBatchOpen(false)} title="Générer les fiches de paie en lot">
        <GenerateBatchForm teachers={teachers}
          onCancel={() => setBatchOpen(false)}
          onDone={(n) => { setBatchOpen(false); notifySuccess(`${n} fiche(s) générée(s)`); q.refetch(); }} />
      </Modal>

      <Modal open={!!linesFor} onClose={() => setLinesFor(null)} title={linesFor ? `${personName(linesFor)} (${linesFor.periodLabel})` : ""}>
        {linesFor && <LinesPanel payslip={linesFor} onChanged={() => q.refetch()} />}
      </Modal>

      <Modal open={staffPayslipOpen} onClose={() => setStaffPayslipOpen(false)} title="Fiches de paie — personnel direction/administratif" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <StaffPayslipPanel structures={structuresQuery.data ?? []} onGenerated={() => { notifySuccess("Fiche générée"); q.refetch(); }} />
      </Modal>

      <Modal open={!!payTargetIds} onClose={() => setPayTargetIds(null)} title="Marquer comme payée">
        <div className="space-y-4">
          <Field>
            <Label>Mode de paiement réellement utilisé</Label>
            <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              <option value="CASH">Espèces</option>
              <option value="BANK_TRANSFER">Virement bancaire</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
            </Select>
          </Field>
          <p className="text-xs text-gray-500">
            {payTargetIds?.length ?? 0} fiche{(payTargetIds?.length ?? 0) > 1 ? "s" : ""} marquée{(payTargetIds?.length ?? 0) > 1 ? "s" : ""} payée{(payTargetIds?.length ?? 0) > 1 ? "s" : ""} avec ce mode — imprimé sur le PDF de chaque fiche.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayTargetIds(null)}>Annuler</Button>
            <Button loading={payLoading} onClick={confirmPay}>Confirmer le paiement</Button>
          </div>
        </div>
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
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, listEmployees, [tenantId]);
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
      // periodStart/periodEnd : 1er et dernier jour du mois choisi — sans eux la fiche n'a aucune
      // période exploitable (retour utilisateur : "je ne vois pas period_start et period_end", et le
      // modal "Détail de la retenue" ne peut pas déterminer le mois à interroger).
      const periodStart = `${period}-01`;
      const periodEnd = `${period}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
      await generatePayslip({
        employeeType: emp.category, teacherId: emp.id, teacherName: `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim(),
        periodLabel, periodStart, periodEnd, baseSalary: Number(emp.baseSalary ?? 0),
        structureId: structureId ? Number(structureId) : null,
        teacherPhone: emp.phone, bankAccount: emp.bankAccount,
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
        employeePhone: emp.phone, bankAccount: emp.bankAccount,
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

function LinesPanel({ payslip, onChanged }: { payslip: Payslip; onChanged: () => void }) {
  const [current, setCurrent] = useState<Payslip>(payslip);
  const linesQuery = useQuery(() => getPayslipLines(payslip.id), [payslip.id, current]);
  const editable = current.status === "DRAFT";
  const [deductionDetailOpen, setDeductionDetailOpen] = useState(false);

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

      {linesQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Type</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
          <TBody>
            {(linesQuery.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucune ligne (base seule).</TD></TR>}
            {(linesQuery.data ?? []).map((l) => (
              <TR key={l.id}>
                <TD>{l.label}</TD>
                <TD><Badge tone={l.lineType === "EARNING" ? "green" : "amber"}>{LINE_TYPE_LABEL[l.lineType]}</Badge></TD>
                <TD className="text-right">{l.lineType === "DEDUCTION" ? "−" : "+"} {formatGNF(l.amount)}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {l.label.startsWith("Reste avantage personnel") && (
                      <Button size="sm" variant="ghost" onClick={() => setDeductionDetailOpen(true)}>Détails</Button>
                    )}
                    {editable && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(l.id)}>Retirer</Button>}
                  </div>
                </TD>
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

      <Modal open={deductionDetailOpen} onClose={() => setDeductionDetailOpen(false)} title="Détail de la retenue — avantage personnel" className="max-w-2xl">
        <StaffBenefitDeductionDetail payslip={current} onRefreshed={(updated) => { setCurrent(updated); onChanged(); }} />
      </Modal>
    </div>
  );
}

/** Détail enfant par enfant de la retenue "avantage personnel" (§retour comptable : "détailler bien
 * les retenues... afficher pour chaque enfant les factures sur lesquelles tu as retenu, mais aussi
 * afficher les factures annexes facultatives qu'on pourrait retenir dans d'autres mois"). Le réglage
 * "ce parent paie lui-même" se gère depuis la fiche élève (lien ci-dessous), pas ici — évite de
 * dupliquer ce contrôle à deux endroits. */
const PERIOD_LABEL_MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];

/** "Octobre 2026" → { year: 2026, month: 10 } — repli pour les fiches déjà générées AVANT le correctif
 * qui envoyait periodStart/periodEnd (certaines fiches "Personnel (direction/admin.)" n'avaient que ce
 * libellé, periodStart/periodEnd restaient null — retour utilisateur). */
function parsePeriodLabel(label: string | null): { year: number; month: number } | null {
  if (!label) return null;
  const [monthWord, yearWord] = label.trim().split(/\s+/);
  const month = PERIOD_LABEL_MONTHS_FR.indexOf((monthWord ?? "").toLowerCase()) + 1;
  const year = Number(yearWord);
  return month > 0 && Number.isFinite(year) && year > 0 ? { year, month } : null;
}

function StaffBenefitDeductionDetail({ payslip, onRefreshed }: { payslip: Payslip; onRefreshed: (updated: Payslip) => void }) {
  const period = payslip.periodStart ? new Date(payslip.periodStart) : null;
  const fallback = period ? null : parsePeriodLabel(payslip.periodLabel);
  const year = period ? period.getUTCFullYear() : fallback?.year ?? null;
  const month = period ? period.getUTCMonth() + 1 : fallback?.month ?? null;
  const [refreshKey, setRefreshKey] = useState(0);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [togglingChildId, setTogglingChildId] = useState<number | null>(null);
  const detailQuery = useQuery(
    () => (year && month ? getStaffBenefitDeductionDetail(payslip.teacherId, payslip.employeeType, year, month) : Promise.resolve(null)),
    [payslip.teacherId, payslip.employeeType, year, month, refreshKey],
  );

  // Le montant retenu posé sur la fiche (ligne "Reste avantage personnel") ne se met jamais à jour tout
  // seul après une exclusion (facture ou enfant) — tant que la fiche n'est pas déjà PAYÉE, on le
  // recalcule aussitôt pour que le net affiché reste exact (§retour comptable).
  async function refreshIfModifiable() {
    if (payslip.status !== "PAID") {
      try { onRefreshed(await refreshStaffBenefitDeductionLine(payslip.id)); } catch { /* fiche déjà figée entre-temps, ignoré */ }
    }
  }

  async function toggleExcluded(inv: DeductedInvoiceLine) {
    setTogglingId(inv.invoiceId);
    try {
      await setInvoiceExcludedFromStaffDeduction(inv.invoiceId, !inv.excluded);
      setRefreshKey((k) => k + 1);
      await refreshIfModifiable();
    } catch (err) { notifyError(err); } finally { setTogglingId(null); }
  }

  // Par enfant (pas par facture) : permanent d'un mois sur l'autre, contrairement à toggleExcluded —
  // pour le cas où certains enfants du même salarié sont à charge de l'avantage personnel et d'autres
  // payés directement par un parent (§retour comptable : "il y a des enfants qui sont ces enfants et
  // d'autres ces [autres] enfants").
  async function toggleChildExcluded(studentId: number, excluded: boolean) {
    setTogglingChildId(studentId);
    try {
      await setChildStaffDeductionExcluded(payslip.teacherId, payslip.employeeType, studentId, excluded);
      setRefreshKey((k) => k + 1);
      await refreshIfModifiable();
    } catch (err) { notifyError(err); } finally { setTogglingChildId(null); }
  }

  if (!year || !month) {
    return <p className="py-6 text-center text-sm text-gray-400">Période de paie inconnue pour cette fiche.</p>;
  }
  if (detailQuery.loading) {
    return <div className="flex justify-center py-8"><Spinner /></div>;
  }
  const children = detailQuery.data ?? [];
  if (children.length === 0) {
    return <p className="py-6 text-center text-sm text-gray-400">Aucun enfant scolarisé rattaché à ce salarié.</p>;
  }

  return (
    <div className="space-y-4">
      {payslip.status === "PAID" && (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Fiche déjà payée — le montant retenu reste figé tel qu&apos;appliqué, même en retirant/incluant
          une facture ici.
        </p>
      )}
      {children.map((c: ChildDeductionDetail) => (
        <div key={c.studentId} className="rounded-xl border border-gray-200 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link href={`/students/detail?id=${c.studentId}`} className="font-semibold text-gray-900 hover:text-brand-600 hover:underline">
              {c.studentName}
            </Link>
            <div className="flex items-center gap-2">
              {c.optedOut && (
                <Badge tone="gray">Ce parent paie lui-même — aucune retenue pour cet enfant</Badge>
              )}
              <Button size="sm" variant="ghost" loading={togglingChildId === c.studentId}
                className={c.optedOut ? "text-success-600" : "text-error-600"}
                onClick={() => toggleChildExcluded(c.studentId, !c.optedOut)}>
                {c.optedOut ? "Réintégrer cet enfant" : "Retirer cet enfant de la retenue"}
              </Button>
            </div>
          </div>

          {!c.optedOut && (
            <div className="mt-2">
              <p className="text-xs font-medium text-gray-500">Factures retenues ce mois-ci</p>
              {c.deductedInvoices.length === 0 ? (
                <p className="text-xs text-gray-400">Aucune facture en attente de retenue.</p>
              ) : (
                <Table>
                  <THead><tr><TH>Réf.</TH><TH>Frais</TH><TH>Période</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
                  <TBody>
                    {c.deductedInvoices.map((inv) => (
                      <TR key={inv.invoiceId} className={inv.excluded ? "opacity-50" : undefined}>
                        <TD className={inv.excluded ? "line-through" : undefined}>{inv.reference ?? `#${inv.invoiceId}`}</TD>
                        <TD className={inv.excluded ? "line-through" : undefined}>{inv.feeLabel}</TD>
                        <TD className={inv.excluded ? "line-through" : undefined}>{inv.periodLabel ?? "—"}</TD>
                        <TD className={`text-right ${inv.excluded ? "line-through" : ""}`}>{formatGNF(inv.amount)}</TD>
                        <TD className="text-right">
                          <Button size="sm" variant="ghost" loading={togglingId === inv.invoiceId}
                            className={inv.excluded ? "text-success-600" : "text-error-600"}
                            onClick={() => toggleExcluded(inv)}>
                            {inv.excluded ? "Inclure" : "Retirer"}
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </div>
          )}

          {c.optionalFeesNotYetInvoiced.length > 0 && (
            <div className="mt-2 rounded-lg bg-amber-50 p-2">
              <p className="text-xs font-medium text-amber-700">
                Frais facultatifs pas encore facturés (entreront automatiquement en retenue s&apos;ils sont facturés plus tard)
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-amber-800">
                {c.optionalFeesNotYetInvoiced.map((f, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{f.feeLabel}</span>
                    <span>{formatGNF(f.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Génération en lot : le salaire de base n'est plus saisi à la main — dès qu'un enseignant est coché,
 * le système connaît déjà ses heures réalisées du mois et son tarif, donc ce qu'il doit être payé
 * (même calcul que l'onglet Rémunération, un enseignant à la fois — voir generatePayslipFromHours).
 */
function GenerateBatchForm({ teachers, onCancel, onDone }: {
  teachers: { id: number; firstName: string; lastName: string; phone?: string | null; bankAccount?: string | null;
    remunerationType?: string | null; remunerationRate?: string | number | null }[];
  onCancel: () => void; onDone: (count: number) => void;
}) {
  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const [included, setIncluded] = useState<Set<number>>(() => new Set(teachers.map((t) => t.id)));
  const [loading, setLoading] = useState(false);

  const teacherIds = useMemo(() => teachers.map((t) => t.id), [teachers]);
  const payQuery = useQuery(
    () => Promise.all(teacherIds.map((id) => getMonthlyPay(id, y, m).then((p) => [id, p] as const))).then((entries) => new Map(entries)),
    [teacherIds.join(","), period],
  );
  const payByTeacher = payQuery.data ?? new Map<number, MonthlyPay>();
  // Cycle de chaque enseignant — permet de générer les fiches "par niveau" (retour utilisateur :
  // "pouvoir payer les gens par niveau... générer les fiches des enseignants du primaire à part, et
  // ceux du secondaire, parce qu'il n'effectue pas la paie le même jour"), via le filtre "Cycle"
  // ci-dessous (remplace la structure salariale, devenue secondaire pour cet écran).
  const cyclesQuery = useQuery(() => getTeacherCycles(teacherIds), [teacherIds.join(",")]);
  const cycleOf = (id: number) => cyclesQuery.data?.[id] ?? null;
  const [cycleFilter, setCycleFilter] = useState<"" | "MATERNELLE" | "PRIMAIRE" | "SECONDAIRE">("");
  const visibleTeachers = useMemo(
    () => (cycleFilter ? teachers.filter((t) => cycleOf(t.id) === cycleFilter) : teachers),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cycleOf dépend de cyclesQuery.data, pas d'identité stable
    [teachers, cycleFilter, cyclesQuery.data],
  );
  function handleCycleFilterChange(v: string) {
    const cycle = v as "" | "MATERNELLE" | "PRIMAIRE" | "SECONDAIRE";
    setCycleFilter(cycle);
    const matching = cycle ? teachers.filter((t) => cycleOf(t.id) === cycle) : teachers;
    setIncluded(new Set(matching.map((t) => t.id)));
  }

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
      const results = await Promise.all(ids.map(async (id) => {
        const t = teachers.find((x) => x.id === id);
        await ensureTeacherCompensation(id, t);
        return generatePayslipFromHours(id, y, m, t ? `${t.firstName} ${t.lastName}` : null,
          null, t?.phone ?? null, t?.bankAccount ?? null);
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
          <Label>Cycle</Label>
          <SearchableSelect
            triggerClassName="justify-between px-3"
            value={cycleFilter}
            onChange={handleCycleFilterChange}
            options={[
              { value: "", trigger: "Tous les cycles", label: "Tous les cycles", searchText: "" },
              { value: "MATERNELLE", trigger: "Maternelle", label: "Maternelle", searchText: "Maternelle" },
              { value: "PRIMAIRE", trigger: "Primaire", label: "Primaire", searchText: "Primaire" },
              { value: "SECONDAIRE", trigger: "Secondaire", label: "Secondaire", searchText: "Secondaire" },
            ]}
          />
        </Field>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Enseignants ({selectedCount} sélectionné(s))</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setIncluded(new Set(visibleTeachers.map((t) => t.id)))}>Tout cocher</button>
            <button type="button" className="text-gray-500 hover:underline" onClick={() => setIncluded(new Set())}>Tout décocher</button>
          </div>
        </div>
        <div className="max-h-72 overflow-auto rounded-xl border border-gray-200">
          <Table>
            <THead><tr><TH /><TH>Enseignant</TH><TH>Cycle</TH><TH className="text-right">Heures réalisées</TH><TH className="text-right">À payer</TH></tr></THead>
            <TBody>
              {visibleTeachers.length === 0 && <TR><TD colSpan={5} className="py-6 text-center text-gray-400">Aucun enseignant.</TD></TR>}
              {visibleTeachers.map((t) => {
                const p = payByTeacher.get(t.id);
                const cycle = cycleOf(t.id);
                return (
                  <TR key={t.id}>
                    <TD><Checkbox checked={included.has(t.id)} onChange={() => toggle(t.id)} /></TD>
                    <TD className="font-medium text-gray-900">{t.firstName} {t.lastName}</TD>
                    <TD className="text-xs text-gray-500">{cycle ? TEACHER_CYCLE_LABEL[cycle] : "—"}</TD>
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

// ── Rémunération (horaire/fixe) & paie mensuelle (heures réalisées − retards) ──────
type CompPerson = { kind: "TEACHER" | "EMPLOYEE"; id: number };

function CompensationTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, listEmployees, [tenantId]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  // Classes de chaque enseignant — affichées dans le tableau (colonne « Classes ») pour distinguer les
  // homonymes ou les enseignants peu connus avant de cliquer sur leur ligne.
  const currentYearQuery = useQuery(() => getCurrentAcademicYear(), []);
  const classesQuery = useQuery(
    () => (currentYearQuery.data ? listClasses(currentYearQuery.data.id) : Promise.resolve([])),
    [currentYearQuery.data?.id],
  );
  const classLabelById = useMemo(() => new Map(classesQuery.data?.map((c) => [c.id, c.label]) ?? []), [classesQuery.data]);
  const classLevelById = useMemo(() => new Map(classesQuery.data?.map((c) => [c.id, c.levelId]) ?? []), [classesQuery.data]);
  const levelsQuery = useCachedQuery("levels-all", listLevels, []);
  const levels = useMemo(() => (levelsQuery.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder), [levelsQuery.data]);
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
  // Niveaux couverts par chaque enseignant (via ses classes affectées) — pour le filtre « Niveau ».
  const levelIdsByTeacher = useMemo(() => {
    const map = new Map<number, Set<number>>();
    for (const t of teachers) {
      const ids = assignedClassesQuery.data?.get(t.id) ?? [];
      const levelIds = new Set<number>();
      for (const cid of ids) {
        const lvl = classLevelById.get(cid);
        if (lvl != null) levelIds.add(lvl);
      }
      map.set(t.id, levelIds);
    }
    return map;
  }, [teachers, assignedClassesQuery.data, classLevelById]);

  // Salaire de chaque enseignant — colonne « Salaire » (retour utilisateur : "pas la colonne cycle,
  // mais plutôt une colonne salaire, pour qu'on voie directement le salaire de l'enseignant") : montant
  // fixe tel que configuré, ou tarif horaire normal sinon (pas de notion de "salaire" unique et stable
  // pour un enseignant payé à l'heure, qui varie selon les heures réalisées du mois).
  const compensationsQuery = useCachedQuery(tenantId ? `payroll-compensations:${tenantId}` : null, listCompensations, [tenantId]);
  const compensationByTeacher = useMemo(
    () => new Map((compensationsQuery.data ?? []).map((c) => [c.teacherId, c])),
    [compensationsQuery.data],
  );
  const salaryLabel = useMemo(() => (teacherId: number): string => {
    const c = compensationByTeacher.get(teacherId);
    if (!c) return "—";
    return c.payMode === "FIXED" ? formatGNF(c.fixedSalary) : `${formatGNF(c.hourlyRateNormal)}/h`;
  }, [compensationByTeacher]);

  // Montant réellement à payer CE mois (heures réalisées pour un enseignant à l'heure, salaire fixe
  // sinon) — distinct de « Salaire » (tarif/montant configuré, toujours le même) : retour utilisateur,
  // colonne "À payer" qui renvoie le salaire du mois.
  const now = new Date();
  const teacherIds = useMemo(() => teachers.map((t) => t.id), [teachers]);
  const monthlyPayQuery = useQuery(
    () => Promise.all(teacherIds.map((id) => getMonthlyPay(id, now.getFullYear(), now.getMonth() + 1).then((p) => [id, p] as const)))
      .then((entries) => new Map(entries)),
    [teacherIds.join(",")],
  );

  const [selected, setSelected] = useState<CompPerson | null>(null);
  const [levelFilter, setLevelFilter] = useState("");

  type TeacherRow = { id: number; name: string; classesLabel: string; salaryLabel: string; toPayLabel: string };
  const teacherRows: TeacherRow[] = useMemo(() => {
    return teachers
      .map((t) => ({
        id: t.id, name: `${t.firstName} ${t.lastName}`, classesLabel: classesLabelByTeacher.get(t.id) || "—",
        salaryLabel: salaryLabel(t.id),
        toPayLabel: monthlyPayQuery.data?.get(t.id) ? formatGNF(monthlyPayQuery.data.get(t.id)!.grossPay) : "—",
      }))
      .filter((r) => !levelFilter || levelIdsByTeacher.get(r.id)?.has(Number(levelFilter)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [teachers, classesLabelByTeacher, levelFilter, levelIdsByTeacher, salaryLabel, monthlyPayQuery.data]);

  type PersonnelRow = { id: number; name: string; poste: string };
  const personnelRows: PersonnelRow[] = useMemo(() => {
    return employees
      .map((e) => ({
        id: e.id, name: `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim(),
        poste: EMPLOYEE_CATEGORY_LABEL[e.category] + (e.jobTitle ? ` — ${e.jobTitle}` : ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const teacherColumns: Column<TeacherRow>[] = [
    {
      key: "name", header: "Nom", accessor: (r) => r.name, sortable: true,
      render: (r) => (
        <button type="button" onClick={() => setSelected({ kind: "TEACHER", id: r.id })}
          className="text-left font-medium text-brand-600 hover:underline">
          {r.name || "—"}
        </button>
      ),
    },
    { key: "classes", header: "Classe(s)", accessor: (r) => r.classesLabel, sortable: true, render: (r) => r.classesLabel },
    { key: "salary", header: "Salaire", accessor: (r) => r.salaryLabel, sortable: true, render: (r) => <span className="font-medium text-gray-900">{r.salaryLabel}</span> },
    { key: "toPay", header: "À payer", accessor: (r) => r.toPayLabel, sortable: true, render: (r) => <span className="font-semibold text-gray-900">{r.toPayLabel}</span> },
  ];
  const personnelColumns: Column<PersonnelRow>[] = [
    {
      key: "name", header: "Nom", accessor: (r) => r.name, sortable: true,
      render: (r) => (
        <button type="button" onClick={() => setSelected({ kind: "EMPLOYEE", id: r.id })}
          className="text-left font-medium text-brand-600 hover:underline">
          {r.name || "—"}
        </button>
      ),
    },
    { key: "poste", header: "Poste", accessor: (r) => r.poste, sortable: true, render: (r) => r.poste },
  ];

  if (!selected) {
    return (
      <Tabs defaultValue="teachers">
        <TabsList>
          <TabsTrigger value="teachers">Enseignants</TabsTrigger>
          <TabsTrigger value="personnel">Personnel</TabsTrigger>
        </TabsList>
        <TabsPanel value="teachers">
          <DataTable
            columns={teacherColumns}
            rows={teacherRows}
            loading={teachersQuery.loading}
            getRowKey={(r) => r.id}
            searchable
            searchPlaceholder="Rechercher un enseignant…"
            emptyLabel="Aucun enseignant."
            toolbar={
              <SearchableSelect
                value={levelFilter}
                onChange={setLevelFilter}
                triggerClassName="max-w-[200px] justify-between px-3"
                options={[
                  { value: "", trigger: "Tous les niveaux", label: "Tous les niveaux", searchText: "" },
                  ...levels.map((l): SearchableOption => ({ value: String(l.id), trigger: l.label, label: l.label, searchText: l.label })),
                ]}
              />
            }
          />
        </TabsPanel>
        <TabsPanel value="personnel">
          <DataTable
            columns={personnelColumns}
            rows={personnelRows}
            loading={employeesQuery.loading}
            getRowKey={(r) => r.id}
            searchable
            searchPlaceholder="Rechercher un membre du personnel…"
            emptyLabel="Aucun personnel."
          />
        </TabsPanel>
      </Tabs>
    );
  }

  return selected.kind === "TEACHER"
    ? <TeacherCompensationPanel teacherId={selected.id} teachers={teachers} onBack={() => setSelected(null)} />
    : <EmployeeCompensationPanel employeeId={selected.id} employees={employees} onBack={() => setSelected(null)} />;
}

/** Salaire fixe du personnel non-enseignant : pas d'heures de cours, donc pas de config horaire/fixe
 * ici — le montant se règle sur la fiche Personnel, affiché ici en lecture seule pour cohérence avec
 * le tableau ci-dessus. */
function EmployeeCompensationPanel({ employeeId, employees, onBack }: {
  employeeId: number; employees: Employee[]; onBack: () => void;
}) {
  const emp = employees.find((e) => e.id === employeeId);
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour à la liste
      </button>
      <div className="rounded-2xl border border-gray-200 bg-white p-4">
        <h3 className="mb-1 text-sm font-semibold text-gray-700">{emp ? `${emp.firstName ?? ""} ${emp.lastName ?? ""}`.trim() : "Personnel"}</h3>
        <p className="mb-3 text-xs text-gray-500">
          {emp ? `${EMPLOYEE_CATEGORY_LABEL[emp.category]}${emp.jobTitle ? ` — ${emp.jobTitle}` : ""}` : ""}
        </p>
        <div className="rounded-xl bg-gray-50 px-4 py-3">
          <p className="text-xs text-gray-500">Salaire de base (fixe)</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatGNF(emp?.baseSalary ?? 0)}</p>
        </div>
        <div className="mt-3">
          <Link href="/teachers/staff" className="text-sm font-medium text-brand-600 hover:underline">
            Modifier depuis la fiche Personnel →
          </Link>
        </div>
      </div>
    </div>
  );
}

function TeacherCompensationPanel({ teacherId, teachers, onBack }: {
  teacherId: number; teachers: Array<{ id: number; firstName: string; lastName: string; phone: string | null; bankAccount: string | null; remunerationType?: string | null; remunerationRate?: string | number | null }>;
  onBack: () => void;
}) {
  const tid = teacherId;
  const compQuery = useQuery(() => getCompensation(tid), [tid]);

  const now = new Date();
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [y, m] = period.split("-").map(Number);
  const payQuery = useQuery(() => getMonthlyPay(tid, y, m), [tid, period]);
  const theoreticalQuery = useQuery(() => getTheoreticalPay(tid, y, m), [tid, period]);

  const fmtH = (min: number) => `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`;
  const p: MonthlyPay | null | undefined = payQuery.data;
  const tp: TheoreticalMonthlyPay | null | undefined = theoreticalQuery.data;
  const teacherName = teachers.find((t) => t.id === tid);
  const [genLoading, setGenLoading] = useState(false);
  const [genTimetableLoading, setGenTimetableLoading] = useState(false);

  async function genPayslip() {
    setGenLoading(true);
    try {
      await ensureTeacherCompensation(tid, teacherName);
      compQuery.refetch();
      await generatePayslipFromHours(tid, y, m, teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : null,
        null, teacherName?.phone ?? null, teacherName?.bankAccount ?? null);
      notifySuccess("Fiche de paie générée (onglet Fiches de paie)");
    } catch (e) { notifyError(e); } finally { setGenLoading(false); }
  }

  async function genPayslipFromTimetable() {
    setGenTimetableLoading(true);
    try {
      await ensureTeacherCompensation(tid, teacherName);
      compQuery.refetch();
      await generatePayslipFromTimetable(tid, y, m, teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : null,
        teacherName?.phone ?? null, teacherName?.bankAccount ?? null);
      notifySuccess("Estimation générée (onglet Fiches de paie) — à ne pas confondre avec le bulletin réel");
    } catch (e) { notifyError(e); } finally { setGenTimetableLoading(false); }
  }

  // Saisie de secours quand le cahier de textes n'a aucune séance validée ce mois (§retour comptable :
  // "le directeur des études n'a pas créé des séances pour les enseignants du secondaire") — le
  // comptable doit quand même pouvoir générer la fiche pour appliquer les retenues du mois (avances,
  // enfants de personnel), même si la paie des cours calculée automatiquement est à 0 GNF.
  const [manualHoursOpen, setManualHoursOpen] = useState(false);
  const [manualNormalHours, setManualNormalHours] = useState<number | string>(0);
  const [manualExamHours, setManualExamHours] = useState<number | string>(0);
  const [genManualLoading, setGenManualLoading] = useState(false);
  async function genPayslipManual() {
    setGenManualLoading(true);
    try {
      await ensureTeacherCompensation(tid, teacherName);
      compQuery.refetch();
      const normalMinutes = Math.round(Number(manualNormalHours || 0) * 60);
      const examMinutes = Math.round(Number(manualExamHours || 0) * 60);
      await generatePayslipFromManualHours(tid, y, m, normalMinutes, examMinutes,
        teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : null,
        teacherName?.phone ?? null, teacherName?.bankAccount ?? null);
      notifySuccess("Fiche de paie générée avec les heures saisies manuellement (onglet Fiches de paie)");
      setManualHoursOpen(false);
      setManualNormalHours(0);
      setManualExamHours(0);
    } catch (e) { notifyError(e); } finally { setGenManualLoading(false); }
  }

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack} className="flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour à la liste
      </button>
      <h2 className="text-lg font-bold text-gray-900">
        {teacherName ? `${teacherName.firstName} ${teacherName.lastName}` : "Enseignant"}
      </h2>

      <>
          {compQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : (
            <CompForm key={tid} teacherId={tid} initial={compQuery.data ?? null} teacher={teacherName ?? null}
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
                <div className="mt-3 flex justify-end">
                  <Button onClick={genPayslip} loading={genLoading}>Générer la fiche de paie</Button>
                </div>
                <div className="mt-4 border-t border-gray-100 pt-3">
                  {!manualHoursOpen ? (
                    <button type="button" onClick={() => setManualHoursOpen(true)}
                      className="text-xs font-medium text-brand-600 hover:underline">
                      Séances non saisies ce mois ? Renseigner les heures manuellement
                    </button>
                  ) : (
                    <div className="space-y-3 rounded-xl bg-amber-50/40 p-3">
                      <p className="text-xs text-gray-600">
                        À utiliser quand le cahier de textes n&apos;a aucune séance validée ce mois (ex.
                        emploi du temps du secondaire pas encore créé par le directeur des études), pour
                        quand même générer la fiche et appliquer les retenues du mois (avances sur
                        salaire, enfants de personnel). Le tarif reste celui configuré ci-dessus — seules
                        les heures sont saisies ici.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field>
                          <Label>Heures classes normales</Label>
                          <Input type="number" min={0} step={0.25} value={manualNormalHours}
                            onChange={(e) => setManualNormalHours(e.target.value)} />
                        </Field>
                        <Field>
                          <Label>Heures classes d&apos;examen</Label>
                          <Input type="number" min={0} step={0.25} value={manualExamHours}
                            onChange={(e) => setManualExamHours(e.target.value)} />
                        </Field>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setManualHoursOpen(false)}>Annuler</Button>
                        <Button size="sm" onClick={genPayslipManual} loading={genManualLoading}
                          disabled={!Number(manualNormalHours) && !Number(manualExamHours)}>
                          Générer avec ces heures
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
            <h3 className="mb-1 text-sm font-semibold text-gray-700">
              Estimation prévisionnelle (Emploi du temps)
            </h3>
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
          <Label>Tarif horaire | Classe normale</Label>
          <MoneyInput value={hourlyRateNormal} onValueChange={setHourlyRateNormal} />
        </Field>
        <Field>
          <Label>Tarif horaire | Classe d&apos;examen</Label>
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
  // Aucun mois pré-sélectionné par défaut : cet avantage est accordé au cas par cas, jamais par défaut
  // sur le mois courant — mieux vaut forcer un choix explicite que risquer un ajout sur le mauvais mois.
  const [period, setPeriod] = useState("");
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
