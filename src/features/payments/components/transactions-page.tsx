"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, FileText, RotateCw } from "lucide-react";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getReceiptPdfObjectUrlById } from "@/lib/api/payment";
import { searchStudents } from "@/lib/api/students";
import type { Receipt } from "@/lib/types/payment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FilePreview } from "@/components/ui/file-preview";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF, formatDateTime } from "@/lib/format";
import { useReceiptByReferenceQuery, useReceiptsQuery, useRefreshReceiptStudentNameMutation } from "../hooks/use-receipts";

export default function PaymentTransactionsPage() {
  const { user } = useAuth();
  const canView = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["recu:read"]);

  if (!canView) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé à la comptabilité et à la direction.</div>;
  }

  return (
    <div className="space-y-5">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Reçus</h1>
        <p className="text-sm text-gray-500">Reçus de paiement émis</p>
      </Reveal>

      <ReceiptsTab />
    </div>
  );
}

// ── Reçus ─────────────────────────────────────────────────────────────────────
function ReceiptsTab() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const [studentId, setStudentId] = useState<number | undefined>(undefined);
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const students = useMemo(() => studentsQuery.data ?? [], [studentsQuery.data]);
  const q = useReceiptsQuery(studentId);

  const [reference, setReference] = useState("");
  const [debouncedReference, setDebouncedReference] = useState("");
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);

  // Recherche dynamique du reçu par numéro : suit la frappe (debounce 350 ms), sans bouton ni
  // erreurs pendant la saisie (on efface simplement le résultat tant qu'aucun reçu ne correspond).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedReference(reference), 350);
    return () => clearTimeout(t);
  }, [reference]);
  const foundQuery = useReceiptByReferenceQuery(debouncedReference);
  const found = foundQuery.data ?? null;
  const searching = foundQuery.isFetching;
  const refreshNameMutation = useRefreshReceiptStudentNameMutation();

  async function openPdf(r: Receipt) {
    setOpeningId(r.id);
    try { setPreview({ url: await getReceiptPdfObjectUrlById(r.id), title: `Reçu ${r.reference}` }); }
    catch (err) { notifyError(err); } finally { setOpeningId(null); }
  }

  // §retour comptable : le nom de l'élève est figé au moment de l'émission — s'il a été mal saisi
  // puis corrigé sur la fiche élève, le reçu déjà généré gardait l'ancien nom indéfiniment (PDF
  // Cloudinary mis en cache). Ce bouton recalcule le nom et invalide ce cache.
  async function refreshName(r: Receipt) {
    try {
      await refreshNameMutation.mutateAsync(r.id);
      notifySuccess("Nom de l'élève mis à jour sur le reçu.");
    } catch (err) { notifyError(err); }
  }

  const rows = q.data ?? [];

  const studentOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Tous les élèves", label: "Tous les élèves", searchText: "tous" },
      ...students.map((s) => ({
        value: String(s.id),
        trigger: `${s.firstName} ${s.lastName}`,
        label: `${s.firstName} ${s.lastName}`,
        searchText: `${s.firstName} ${s.lastName}`,
      })),
    ],
    [students],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="mb-1 block text-xs text-gray-500">Filtrer par élève</label>
          <SearchableSelect
            value={studentId ? String(studentId) : ""}
            options={studentOptions}
            onChange={(v) => setStudentId(v ? Number(v) : undefined)}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucun élève"
          />
        </div>
        <div className="ml-auto">
          <label className="mb-1 block text-xs text-gray-500">Retrouver un reçu par son numéro</label>
          <div className="relative flex items-center">
            <Search className={`pointer-events-none absolute left-2.5 h-4 w-4 ${searching ? "animate-pulse text-brand-500" : "text-gray-400"}`} />
            <Input className="max-w-[220px] pl-8" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Numéro du reçu" />
          </div>
        </div>
      </div>

      {found && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-gray-700">
            <FileText className="h-4 w-4 text-brand-600" />
            Reçu <span className="font-mono">{found.reference}</span> — {formatGNF(found.amount)}
          </span>
          <Button size="sm" variant="ghost" loading={openingId === found.id} onClick={() => openPdf(found)}>Ouvrir PDF</Button>
        </div>
      )}

      {q.isLoading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white">
          <Table>
            <THead>
              <TR><TH>Numéro du reçu</TH><TH>Élève</TH><TH>Montant</TH><TH>Émis le</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {rows.length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun reçu.</TD></TR>}
              {rows.map((r) => (
                <TR key={r.id}>
                  <TD className="font-mono text-xs text-gray-600">{r.reference}</TD>
                  <TD className="text-sm text-gray-700">{r.studentName ?? "—"}</TD>
                  <TD className="font-medium text-gray-900">{formatGNF(r.amount)}</TD>
                  <TD className="text-sm text-gray-500">{formatDateTime(r.generatedAt)}</TD>
                  <TD className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" title="Nom de l'élève mal saisi ? Le recalculer depuis sa fiche"
                        loading={refreshNameMutation.isPending && refreshNameMutation.variables === r.id}
                        onClick={() => refreshName(r)}>
                        <RotateCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" loading={openingId === r.id} onClick={() => openPdf(r)}>Ouvrir PDF</Button>
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}
