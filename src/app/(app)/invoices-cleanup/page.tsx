"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { searchStudents } from "@/lib/api/students";
import { deleteInvoice, listDanglingExemptedInvoices, listFeesByTenant } from "@/lib/api/billing";
import { FEE_TYPE_LABEL, type Invoice } from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF, formatDate } from "@/lib/format";

/**
 * Nettoyage ponctuel des factures "fantômes" (§retour comptable, fondation) : avant le correctif, un
 * frais ponctuel (inscription, réinscription, annexe) entièrement couvert par une exonération générait
 * quand même une facture à 0 GNF au lieu de n'en créer aucune — contrairement à la mensualité
 * échelonnée, qui a toujours eu cette garde. Jamais de suppression automatique : liste en lecture
 * seule, le comptable valide et supprime lui-même.
 */
export default function InvoicesCleanupPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  // Réservé au SUPER_ADMIN (§retour utilisateur) : suppression définitive de factures, trop sensible
  // pour le personnel d'école.
  const canDelete = isSuperAdmin(user);

  const q = useQuery(() => (canDelete ? listDanglingExemptedInvoices() : Promise.resolve([])), [canDelete]);
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const feesQuery = useQuery(() => (tenantId ? listFeesByTenant(tenantId) : Promise.resolve([])), [tenantId]);

  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const fees = useMemo(() => feesQuery.data ?? [], [feesQuery.data]);
  const studentName = (id: number) => {
    const s = students.find((st) => st.id === id);
    return s ? `${s.firstName} ${s.lastName}` : `Élève #${id}`;
  };
  const feeTypeLabel = (feeId: number | null) => {
    if (feeId == null) return "—";
    const f = fees.find((x) => x.id === feeId);
    return f ? FEE_TYPE_LABEL[f.type] : "—";
  };

  const [selected, setSelected] = useState<Invoice[]>([]);
  const [deleting, setDeleting] = useState(false);

  function removeOne(inv: Invoice) {
    confirmAction({
      title: "Supprimer cette facture",
      message: `${studentName(inv.studentId)} — ${inv.reference} (${formatGNF(inv.totalAmount)}, exonérée à 100%). `
        + `Suppression définitive — cette facture n'aurait jamais dû être créée.`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteInvoice(inv.id);
          notifySuccess("Facture supprimée.");
          q.refetch();
        } catch (e) { notifyError(e); }
      },
    });
  }

  function removeSelection() {
    const targets = [...selected];
    confirmAction({
      title: "Supprimer les factures sélectionnées",
      message: `${targets.length} facture(s) exonérée(s) à 100% — suppression définitive, non réversible.`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        setDeleting(true);
        let ok = 0, failed = 0;
        for (const inv of targets) {
          try { await deleteInvoice(inv.id); ok++; }
          catch { failed++; }
        }
        notifySuccess(failed > 0 ? `${ok} facture(s) supprimée(s), ${failed} échec(s).` : `${ok} facture(s) supprimée(s).`);
        setSelected([]);
        setDeleting(false);
        q.refetch();
      },
    });
  }

  if (!canDelete) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès à cette page.
      </p>
    );
  }

  const invoices = q.data ?? [];

  const columns: Column<Invoice>[] = [
    { key: "student", header: "Élève", render: (i) => <span className="font-medium text-gray-900">{studentName(i.studentId)}</span> },
    { key: "reference", header: "Référence", render: (i) => i.reference },
    { key: "feeType", header: "Type de frais", render: (i) => feeTypeLabel(i.feeId) },
    { key: "totalAmount", header: "Montant", render: (i) => formatGNF(i.totalAmount) },
    { key: "issueDate", header: "Émise le", render: (i) => (i.issueDate ? formatDate(i.issueDate) : "—") },
    { key: "discountReason", header: "Motif d'exonération", render: (i) => i.discountReason ?? "—" },
    {
      key: "actions", header: "", render: (i) => (
        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => removeOne(i)}>
          Supprimer
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Factures fantômes (0 GNF)</h1>
            <p className="mt-1 text-sm text-gray-500">
              Factures créées avant correction pour des élèves exonérés à 100% sur un frais ponctuel
              (inscription, réinscription, annexe) — rien n&apos;est dû, elles n&apos;auraient jamais dû
              exister. Vérifiez puis supprimez.
            </p>
          </div>
          {selected.length > 0 && (
            <Button variant="secondary" className="text-error-600" loading={deleting}
              leftSection={<Trash2 className="h-4 w-4" />} onClick={removeSelection}>
              Supprimer ({selected.length})
            </Button>
          )}
        </div>
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : invoices.length === 0 ? (
        <Card><CardBody className="py-10 text-center text-sm text-gray-400">Aucune facture fantôme détectée.</CardBody></Card>
      ) : (
        <DataTable
          columns={columns}
          rows={invoices}
          getRowKey={(i) => i.id}
          selectable
          onSelectionChange={setSelected}
        />
      )}
    </div>
  );
}
