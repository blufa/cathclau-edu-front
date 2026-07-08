"use client";

import { useMemo, useState } from "react";
import { Select as MantineSelect, NumberInput, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import {
  advanceRecovery,
  applyInvoiceDiscount,
  cancelInvoice,
  createInvoice,
  generateInvoicesBulk,
  getInvoicePdfObjectUrl,
  listFeesByTenant,
  listInvoicesByStatus,
  listInvoicesByStudent,
  listInvoicesByTenant,
} from "@/lib/api/billing";
import { FEE_TYPE_LABEL, INVOICE_STATUS_LABEL, RECOVERY_STAGE_LABEL, type Invoice, type InvoiceStatus, type SchoolFee } from "@/lib/types/billing";
import { PayInvoiceForm } from "@/components/billing/pay-invoice-form";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ParentReminderButton } from "@/components/students/parent-reminder";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FileText } from "lucide-react";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const STATUS_TONE: Record<InvoiceStatus, "red" | "amber" | "green"> = { UNPAID: "red", PARTIAL: "amber", PAID: "green" };

/** Module-scope reference generator (kept out of render to stay pure). */
function genRef(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY");

  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [studentFilter, setStudentFilter] = useState<string | null>(null);
  const q = useQuery(
    () => {
      if (!tenantId) return Promise.resolve([]);
      if (studentFilter) return listInvoicesByStudent(Number(studentFilter));
      return status ? listInvoicesByStatus(tenantId, status) : listInvoicesByTenant(tenantId);
    },
    [tenantId, status, studentFilter],
  );
  const feesQuery = useQuery(() => (tenantId ? listFeesByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  // Résolution des noms d'élèves (la facture ne porte que l'ID).
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const studentOptions = useMemo(
    () => (studentsQuery.data ?? []).map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` })),
    [studentsQuery.data],
  );
  // Quand on filtre par élève, le statut s'applique côté client (l'API par élève renvoie tous statuts).
  const invoices = useMemo(
    () => (studentFilter && status ? (q.data ?? []).filter((i) => i.status === status) : (q.data ?? [])),
    [q.data, studentFilter, status],
  );

  const [creating, setCreating] = useState(false);
  const [bulk, setBulk] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [discountFor, setDiscountFor] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);

  async function showInvoicePdf(inv: Invoice) {
    try {
      const url = await getInvoicePdfObjectUrl(inv.id);
      setPreview({ url, title: `Facture ${inv.reference}` });
    } catch (err) { notifyError(err); }
  }

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  function cancel(inv: Invoice) {
    confirmAction({
      title: "Annuler la facture", message: `Annuler ${inv.reference} ?`, confirmLabel: "Annuler", danger: true,
      onConfirm: async () => { try { await cancelInvoice(inv.id); notifySuccess("Facture annulée"); q.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  function advance(inv: Invoice) {
    const next = inv.recoveryStage === "REMINDER_2" || inv.recoveryStage === "EXCLUDED";
    confirmAction({
      title: next ? "Exclure l'élève (impayé)" : "Avancer le recouvrement",
      message: next
        ? "Passer à l'exclusion de l'élève jusqu'à régularisation du paiement ?"
        : "Enregistrer une relance pour cette facture ?",
      confirmLabel: next ? "Exclure" : "Relancer", danger: next,
      onConfirm: async () => { try { await advanceRecovery(inv.id); notifySuccess("Recouvrement mis à jour"); q.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Factures</h1>
          <p className="text-sm text-slate-500">Facturation des frais scolaires des élèves</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBulk(true)}>Générer en masse</Button>
            <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle facture</Button>
          </div>
        )}
      </Reveal>

      <div className="flex flex-wrap items-center gap-3">
        <MantineSelect
          className="min-w-[260px]"
          placeholder="Filtrer par élève"
          data={studentOptions}
          value={studentFilter}
          onChange={setStudentFilter}
          searchable
          clearable
          nothingFoundMessage="Aucun élève"
        />
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => (<option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>))}
        </Select>
      </div>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Objet</TH><TH>Référence</TH><TH>Total</TH><TH>Payé</TH><TH>Reste</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {invoices.length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-slate-400">Aucune facture.</TD></TR>}
            {invoices.map((inv) => (
              <TR key={inv.id}>
                <TD className="text-slate-900">{studentName.get(inv.studentId) ?? `#${inv.studentId}`}</TD>
                <TD className="text-sm text-slate-700">{inv.periodLabel ?? "Inscription / frais"}</TD>
                <TD className="font-mono text-xs text-slate-600">{inv.reference}</TD>
                <TD className="font-medium text-slate-900">{formatGNF(inv.totalAmount)}</TD>
                <TD>{formatGNF(inv.paidAmount ?? 0)}</TD>
                <TD>{formatGNF(inv.remainingBalance ?? inv.totalAmount)}</TD>
                <TD>
                  <Badge tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                  {inv.recoveryStage && inv.recoveryStage !== "NONE" && (
                    <span className="mt-1 block">
                      <Badge tone={inv.recoveryStage === "EXCLUDED" ? "red" : "amber"}>{RECOVERY_STAGE_LABEL[inv.recoveryStage]}</Badge>
                    </span>
                  )}
                </TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" leftSection={<FileText className="h-4 w-4" />} onClick={() => showInvoicePdf(inv)}>Aperçu</Button>
                    {canWrite && inv.status !== "PAID" && <Button size="sm" onClick={() => setPaying(inv)}>Payer</Button>}
                    {canWrite && inv.status !== "PAID" && inv.recoveryStage !== "EXCLUDED" && <Button size="sm" variant="ghost" onClick={() => advance(inv)}>{inv.recoveryStage === "REMINDER_2" ? "Exclure" : "Relancer"}</Button>}
                    {canWrite && inv.status !== "PAID" && <Button size="sm" variant="ghost" onClick={() => setDiscountFor(inv)}>Remise</Button>}
                    {canWrite && inv.status !== "PAID" && (
                      <ParentReminderButton
                        studentId={inv.studentId}
                        reason="PAYMENT_DUE"
                        subject="Rappel d'échéance"
                        defaultMessage={`Bonjour, nous vous rappelons que la facture ${inv.reference} présente un solde de ${formatGNF(inv.remainingBalance ?? inv.totalAmount)} à régler. Merci de procéder au paiement.`}
                        size="sm"
                        variant="ghost"
                      />
                    )}
                    {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => cancel(inv)}>Annuler</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle facture">
        <InvoiceForm tenantId={tenantId} fees={feesQuery.data ?? []} onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); notifySuccess("Facture créée"); q.refetch(); }} />
      </Modal>

      <Modal open={bulk} onClose={() => setBulk(false)} title="Générer les factures d'une classe">
        <BulkInvoiceForm tenantId={tenantId} fees={feesQuery.data ?? []} onCancel={() => setBulk(false)}
          onDone={(n) => { setBulk(false); notifySuccess(`${n} facture(s) générée(s)`); q.refetch(); }} />
      </Modal>

      <Modal open={!!paying} onClose={() => setPaying(null)} title={`Payer — ${paying?.reference ?? ""}`}>
        {paying && <PayInvoiceForm invoice={paying} tenantId={tenantId} onDone={() => { setPaying(null); q.refetch(); }} />}
      </Modal>

      <Modal open={!!discountFor} onClose={() => setDiscountFor(null)} title={`Remise — ${discountFor?.reference ?? ""}`}>
        {discountFor && <DiscountForm invoice={discountFor} onDone={() => { setDiscountFor(null); notifySuccess("Remise appliquée"); q.refetch(); }} onCancel={() => setDiscountFor(null)} />}
      </Modal>

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}

function DiscountForm({ invoice, onDone, onCancel }: { invoice: Invoice; onDone: () => void; onCancel: () => void }) {
  const [amount, setAmount] = useState<number | string>(invoice.discountAmount ? Number(invoice.discountAmount) : 0);
  const [reason, setReason] = useState(invoice.discountReason ?? "");
  const [loading, setLoading] = useState(false);
  async function submit() {
    setLoading(true);
    try { await applyInvoiceDiscount(invoice.id, Number(amount) || 0, reason); onDone(); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <Stack gap="md">
      <p className="text-sm text-slate-500">Total : <strong>{formatGNF(invoice.totalAmount)}</strong> · Reste actuel : {formatGNF(invoice.remainingBalance ?? invoice.totalAmount)}</p>
      <NumberInput label="Montant de la remise (GNF)" thousandSeparator=" " min={0} value={amount} onChange={setAmount} />
      <TextInput label="Motif" placeholder="Bourse, remise Ramadan, réduction fratrie…" value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
      <p className="text-xs text-slate-400">Net dû = total − remise. Le reste à payer et le statut sont recalculés.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Appliquer</Button>
      </div>
    </Stack>
  );
}

function InvoiceForm({ tenantId, fees, onCancel, onCreated }: {
  tenantId: number; fees: SchoolFee[]; onCancel: () => void; onCreated: () => void;
}) {
  const [search, setSearch] = useState("");
  const studentsQuery = useQuery(() => searchStudents({ search: search || undefined, size: 20 }).then((p) => p.content), [search]);
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { studentId: "", feeId: "", reference: genRef("INV"), totalAmount: 0 },
    validate: { studentId: (v) => (v ? null : "Requis"), feeId: (v) => (v ? null : "Requis"), totalAmount: (v) => (v > 0 ? null : "Montant requis") },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await createInvoice({ tenantId, studentId: Number(values.studentId), feeId: Number(values.feeId), reference: values.reference, totalAmount: values.totalAmount });
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Rechercher un élève" placeholder="Nom / matricule" value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
        <MantineSelect label="Élève" withAsterisk
          data={[{ value: "", label: "— Choisir —" }, ...(studentsQuery.data ?? []).map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` }))]}
          {...form.getInputProps("studentId")} />
        <MantineSelect label="Frais" withAsterisk
          data={[{ value: "", label: "— Choisir —" }, ...fees.map((f) => ({ value: String(f.id), label: `${FEE_TYPE_LABEL[f.type]} — ${f.amount}` }))]}
          onChange={(value) => { const v = value ?? ""; form.setFieldValue("feeId", v); const f = fees.find((x) => String(x.id) === v); if (f) form.setFieldValue("totalAmount", Number(f.amount)); }}
          value={form.values.feeId} />
        <TextInput label="Référence" withAsterisk {...form.getInputProps("reference")} />
        <NumberInput label="Montant total (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("totalAmount")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Créer</Button>
        </div>
      </Stack>
    </form>
  );
}

function BulkInvoiceForm({ tenantId, fees, onCancel, onDone }: {
  tenantId: number; fees: SchoolFee[]; onCancel: () => void; onDone: (n: number) => void;
}) {
  const yearsQuery = useQuery(listAcademicYears, []);
  const cy = (yearsQuery.data ?? []).find((y) => y.current) ?? (yearsQuery.data ?? [])[0];
  const classesQuery = useQuery(() => (cy ? listClasses(cy.id) : Promise.resolve([])), [cy?.id]);
  const [loading, setLoading] = useState(false);
  const form = useForm({ mode: "controlled", initialValues: { classId: "", feeId: "" }, validate: { classId: (v) => (v ? null : "Requis"), feeId: (v) => (v ? null : "Requis") } });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const res = await generateInvoicesBulk(tenantId, Number(values.classId), Number(values.feeId));
      onDone(res.length);
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <MantineSelect label="Classe" withAsterisk data={[{ value: "", label: "— Choisir —" }, ...(classesQuery.data ?? []).map((c) => ({ value: String(c.id), label: c.label }))]} {...form.getInputProps("classId")} />
        <MantineSelect label="Frais" withAsterisk data={[{ value: "", label: "— Choisir —" }, ...fees.map((f) => ({ value: String(f.id), label: `${FEE_TYPE_LABEL[f.type]} — ${f.amount}` }))]} {...form.getInputProps("feeId")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Générer</Button>
        </div>
      </Stack>
    </form>
  );
}
