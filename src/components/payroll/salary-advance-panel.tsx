"use client";

import { useMemo, useState } from "react";
import { Plus, FileDown, Ban } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import {
  cancelSalaryAdvance,
  getSalaryAdvanceVoucherPdfObjectUrl,
  grantSalaryAdvance,
  listSalaryAdvances,
} from "@/lib/api/payroll";
import { listEmployees, listTeachers } from "@/lib/api/staff";
import { SALARY_ADVANCE_STATUS_LABEL, type PayslipEmployeeType, type SalaryAdvance } from "@/lib/types/payroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field, MoneyInput } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { openPdfInApp } from "@/lib/open-pdf";
import { formatGNF } from "@/lib/format";

const STATUS_TONE: Record<SalaryAdvance["status"], "gray" | "indigo" | "green"> = {
  ACTIVE: "indigo", REPAID: "green", CANCELLED: "gray",
};

/** Valeur d'option combinant type + id (`TEACHER|9`) — enseignants et personnel ont deux séquences
 * d'id distinctes qui peuvent coïncider (même id numérique pour les deux référentiels). */
function optionValue(type: PayslipEmployeeType, id: number): string {
  return `${type}|${id}`;
}
function parseOptionValue(v: string): { type: PayslipEmployeeType; id: number } | null {
  const [type, idStr] = v.split("|");
  const id = Number(idStr);
  if (!type || !Number.isFinite(id)) return null;
  return { type: type as PayslipEmployeeType, id };
}

export function SalaryAdvancePanel() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const employeesQuery = useCachedQuery(tenantId ? `employees-all:${tenantId}` : null, () => listEmployees(), [tenantId]);
  const employees = useMemo(() => employeesQuery.data ?? [], [employeesQuery.data]);

  const nameByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teachers) m.set(optionValue("TEACHER", t.id), `${t.firstName} ${t.lastName}`);
    // EmployeeCategory ("ADMINISTRATIVE"|"DIRECTION"|"SUPPORT") est un sous-ensemble de
    // PayslipEmployeeType — utilisable directement comme employeeType de l'avance.
    for (const e of employees) m.set(optionValue(e.category, e.id), `${e.firstName ?? ""} ${e.lastName ?? ""}`.trim());
    return m;
  }, [teachers, employees]);

  const personOptions: SearchableOption[] = useMemo(() => {
    const opts: SearchableOption[] = teachers.map((t) => {
      const label = `${t.firstName} ${t.lastName} (Enseignant)`;
      return { value: optionValue("TEACHER", t.id), trigger: label, label, searchText: label };
    });
    for (const e of employees) {
      const label = `${e.firstName ?? ""} ${e.lastName ?? ""} (Personnel)`.trim();
      opts.push({ value: optionValue(e.category, e.id), trigger: label, label, searchText: label });
    }
    return opts;
  }, [teachers, employees]);

  const q = useQuery(listSalaryAdvances, []);
  const [open, setOpen] = useState(false);
  const [personKey, setPersonKey] = useState("");
  const [amount, setAmount] = useState(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  function openCreate() { setPersonKey(""); setAmount(0); setReason(""); setOpen(true); }

  async function submit() {
    const parsed = parseOptionValue(personKey);
    if (!parsed) { notifyError(new Error("Sélectionnez un salarié.")); return; }
    if (!amount || amount <= 0) { notifyError(new Error("Montant requis.")); return; }
    setSaving(true);
    try {
      await grantSalaryAdvance({
        employeeType: parsed.type, teacherId: parsed.id,
        teacherName: nameByKey.get(personKey) ?? null,
        amount, reason: reason.trim() || null,
      });
      notifySuccess("Avance accordée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function cancel(a: SalaryAdvance) {
    confirmAction({
      title: "Annuler l'avance", message: `Annuler l'avance de ${formatGNF(a.amount)} accordée à ${a.teacherName ?? "#" + a.teacherId} ?`,
      confirmLabel: "Annuler l'avance", danger: true,
      onConfirm: async () => {
        try { await cancelSalaryAdvance(a.id); notifySuccess("Avance annulée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  async function downloadVoucher(a: SalaryAdvance) {
    try { openPdfInApp(await getSalaryAdvanceVoucherPdfObjectUrl(a.id), "Bon d'avance"); }
    catch (err) { notifyError(err); }
  }

  const items = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">
            Avance déduite automatiquement de la prochaine fiche de paie du salarié, jusqu&apos;à épuisement du solde
          </p>
          <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Accorder une avance</Button>
        </div>
        {q.loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Aucune avance sur salaire.</p>
        ) : (
          <Table>
            <THead>
              <TR><TH>Salarié</TH><TH>Montant</TH><TH>Solde restant</TH><TH>Statut</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {items.map((a) => (
                <TR key={a.id}>
                  <TD className="font-medium text-gray-900">{a.teacherName ?? `#${a.teacherId}`}</TD>
                  <TD>{formatGNF(a.amount)}</TD>
                  <TD>{formatGNF(a.remainingBalance)}</TD>
                  <TD><Badge tone={STATUS_TONE[a.status]}>{SALARY_ADVANCE_STATUS_LABEL[a.status]}</Badge></TD>
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" leftSection={<FileDown className="h-4 w-4" />} onClick={() => downloadVoucher(a)}>Bon (PDF)</Button>
                      {a.status === "ACTIVE" && a.remainingBalance === a.amount && (
                        <Button size="sm" variant="ghost" className="text-error-600" leftSection={<Ban className="h-4 w-4" />} onClick={() => cancel(a)}>Annuler</Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Accorder une avance sur salaire">
        <div className="space-y-4">
          <Field>
            <Label>Salarié <span className="text-error-500">*</span></Label>
            <SearchableSelect value={personKey} options={personOptions} onChange={setPersonKey} triggerClassName="w-full justify-between px-3" />
          </Field>
          <Field>
            <Label>Montant (GNF) <span className="text-error-500">*</span></Label>
            <MoneyInput value={amount} onValueChange={(v) => setAmount(v)} />
            <p className="mt-1 text-xs text-gray-400">
              Plafonné automatiquement au salaire de référence du salarié (dernière fiche de paie, ou salaire de base/fixe à défaut).
            </p>
          </Field>
          <Field>
            <Label>Motif (optionnel)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. Urgence médicale" />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Accorder"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
