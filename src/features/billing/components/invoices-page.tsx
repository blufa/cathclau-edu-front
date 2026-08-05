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
import { searchStudents } from "@/lib/api/students";
import {
  advanceRecovery,
  applyInvoiceDiscount,
  cancelInvoice,
  createInvoice,
  generateInvoicesBulk,
  getInvoicePdfObjectUrl,
} from "@/lib/api/billing";
import { useFeesQuery, useInvoicesQuery } from "../hooks/use-invoices";
import { FEE_TYPE_LABEL, INVOICE_STATUS_LABEL, RECOVERY_STAGE_LABEL, type Invoice, type InvoiceStatus, type SchoolFee } from "@/lib/types/billing";
import { PayInvoiceForm } from "@/features/billing/components/pay-invoice-form";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Input, Label, Field, MoneyInput } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { ParentReminderButton } from "@/features/students/components/parent-reminder";
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
  const [studentFilter, setStudentFilter] = useState<string>("");
  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(
    () => [...(yearsQuery.data ?? [])].sort((a, b) => (b.label ?? "").localeCompare(a.label ?? "", "fr", { numeric: true })),
    [yearsQuery.data],
  );
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;
  const q = useInvoicesQuery(tenantId, status, studentFilter, yearId);
  const feesQuery = useFeesQuery(tenantId);
  // Résolution des noms d'élèves (la facture ne porte que l'ID).
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const studentName = useMemo(
    () => new Map((studentsQuery.data ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`])),
    [studentsQuery.data],
  );
  const studentOptions: SearchableOption[] = useMemo(
    () => (studentsQuery.data ?? []).map((s) => {
      const label = `${s.firstName} ${s.lastName} (${s.studentNumber})`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
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
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
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
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Factures</h1>
          <p className="text-sm text-gray-500">Facturation des frais scolaires des élèves</p>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBulk(true)}>Générer en masse</Button>
            <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle facture</Button>
          </div>
        )}
      </Reveal>

      <div className="flex flex-wrap items-center gap-3">
        <Select className="max-w-[200px]" value={yearId ?? ""} onChange={(e) => setSelectedYearId(e.target.value ? Number(e.target.value) : null)}>
          {years.length === 0 && <option value="">—</option>}
          {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
        </Select>
        <SearchableSelect
          value={studentFilter}
          options={[{ value: "", trigger: "Tous les élèves", label: "Tous les élèves", searchText: "tous" }, ...studentOptions]}
          onChange={setStudentFilter}
          triggerClassName="min-w-[260px] justify-between px-3"
          noResultsLabel="Aucun élève"
        />
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(INVOICE_STATUS_LABEL) as InvoiceStatus[]).map((s) => (<option key={s} value={s}>{INVOICE_STATUS_LABEL[s]}</option>))}
        </Select>
      </div>

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Objet</TH><TH>Référence</TH><TH>Total</TH><TH>Payé</TH><TH>Reste</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {invoices.length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-gray-400">Aucune facture.</TD></TR>}
            {invoices.map((inv) => (
              <TR key={inv.id}>
                <TD className="text-gray-900">{studentName.get(inv.studentId) ?? `#${inv.studentId}`}</TD>
                <TD className="text-sm text-gray-700">{inv.periodLabel ?? "Inscription / frais"}</TD>
                <TD className="font-mono text-xs text-gray-600">{inv.reference}</TD>
                <TD className="font-medium text-gray-900">{formatGNF(inv.totalAmount)}</TD>
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
                    {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => cancel(inv)}>Annuler</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle facture">
        <InvoiceForm tenantId={tenantId} academicYearId={yearId} fees={feesQuery.data ?? []} onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); notifySuccess("Facture créée"); q.refetch(); }} />
      </Modal>

      <Modal open={bulk} onClose={() => setBulk(false)} title="Générer les factures d'une classe">
        <BulkInvoiceForm tenantId={tenantId} academicYearId={yearId} fees={feesQuery.data ?? []} onCancel={() => setBulk(false)}
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
    <div className="space-y-4">
      <p className="text-sm text-gray-500">Total : <strong>{formatGNF(invoice.totalAmount)}</strong> · Reste actuel : {formatGNF(invoice.remainingBalance ?? invoice.totalAmount)}</p>
      <Field>
        <Label>Montant de la remise</Label>
        <MoneyInput value={amount} onValueChange={setAmount} />
      </Field>
      <Field>
        <Label>Motif</Label>
        <Input placeholder="Bourse, remise Ramadan, réduction fratrie…" value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
      <p className="text-xs text-gray-400">Net dû = total − remise. Le reste à payer et le statut sont recalculés.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Appliquer</Button>
      </div>
    </div>
  );
}

const invoiceSchema = z.object({
  studentId: z.string().min(1, "Requis"),
  feeId: z.string().min(1, "Requis"),
  reference: z.string(),
  totalAmount: z.number().positive("Montant requis"),
});
type InvoiceFormValues = z.infer<typeof invoiceSchema>;

function InvoiceForm({ tenantId, academicYearId, fees, onCancel, onCreated }: {
  tenantId: number; academicYearId: number | null; fees: SchoolFee[]; onCancel: () => void; onCreated: () => void;
}) {
  const [search, setSearch] = useState("");
  const studentsQuery = useQuery(() => searchStudents({ search: search || undefined, size: 20 }).then((p) => p.content), [search]);
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: { studentId: "", feeId: "", reference: genRef("INV"), totalAmount: 0 },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  const studentOptions: SearchableOption[] = useMemo(
    () => (studentsQuery.data ?? []).map((s) => {
      const label = `${s.firstName} ${s.lastName} (${s.studentNumber})`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
    [studentsQuery.data],
  );
  const feeOptions: SearchableOption[] = useMemo(
    () => fees.map((f) => {
      const label = `${FEE_TYPE_LABEL[f.type]} — ${f.amount}`;
      return { value: String(f.id), trigger: label, label, searchText: label };
    }),
    [fees],
  );

  async function submit(values: InvoiceFormValues) {
    setLoading(true);
    try {
      await createInvoice({ tenantId, studentId: Number(values.studentId), feeId: Number(values.feeId), reference: values.reference, totalAmount: values.totalAmount, academicYearId });
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Rechercher un élève</Label>
        <Input placeholder="Nom / matricule" value={search} onChange={(e) => setSearch(e.target.value)} />
      </Field>
      <Field>
        <Label>Élève <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.studentId} options={studentOptions} onChange={(val) => setValue("studentId", val)} triggerClassName="w-full justify-between px-3" />
        {errors.studentId && <p className="text-xs text-error-600">{errors.studentId.message}</p>}
      </Field>
      <Field>
        <Label>Frais <span className="text-error-500">*</span></Label>
        <SearchableSelect
          value={v.feeId}
          options={feeOptions}
          onChange={(val) => {
            setValue("feeId", val);
            const f = fees.find((x) => String(x.id) === val);
            if (f) setValue("totalAmount", Number(f.amount));
          }}
          triggerClassName="w-full justify-between px-3"
        />
        {errors.feeId && <p className="text-xs text-error-600">{errors.feeId.message}</p>}
      </Field>
      <Field>
        <Label>Référence <span className="text-error-500">*</span></Label>
        <Input value={v.reference} onChange={(e) => setValue("reference", e.target.value)} />
      </Field>
      <Field>
        <Label>Montant total</Label>
        <MoneyInput value={v.totalAmount} onValueChange={(n) => setValue("totalAmount", n)} />
        {errors.totalAmount && <p className="text-xs text-error-600">{errors.totalAmount.message}</p>}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Créer</Button>
      </div>
    </form>
  );
}

const bulkSchema = z.object({
  classId: z.string().min(1, "Requis"),
  feeId: z.string().min(1, "Requis"),
});
type BulkFormValues = z.infer<typeof bulkSchema>;

function BulkInvoiceForm({ tenantId, academicYearId, fees, onCancel, onDone }: {
  tenantId: number; academicYearId: number | null; fees: SchoolFee[]; onCancel: () => void; onDone: (n: number) => void;
}) {
  const classesQuery = useQuery(() => (academicYearId ? listClasses(academicYearId) : Promise.resolve([])), [academicYearId]);
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<BulkFormValues>({
    resolver: zodResolver(bulkSchema),
    defaultValues: { classId: "", feeId: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  const classOptions: SearchableOption[] = useMemo(
    () => (classesQuery.data ?? []).map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classesQuery.data],
  );
  const feeOptions: SearchableOption[] = useMemo(
    () => fees.map((f) => {
      const label = `${FEE_TYPE_LABEL[f.type]} — ${f.amount}`;
      return { value: String(f.id), trigger: label, label, searchText: label };
    }),
    [fees],
  );

  async function submit(values: BulkFormValues) {
    setLoading(true);
    try {
      const res = await generateInvoicesBulk(tenantId, Number(values.classId), Number(values.feeId), academicYearId);
      onDone(res.length);
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Classe <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.classId} options={classOptions} onChange={(val) => setValue("classId", val)} triggerClassName="w-full justify-between px-3" />
        {errors.classId && <p className="text-xs text-error-600">{errors.classId.message}</p>}
      </Field>
      <Field>
        <Label>Frais <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.feeId} options={feeOptions} onChange={(val) => setValue("feeId", val)} triggerClassName="w-full justify-between px-3" />
        {errors.feeId && <p className="text-xs text-error-600">{errors.feeId.message}</p>}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>Générer</Button>
      </div>
    </form>
  );
}
