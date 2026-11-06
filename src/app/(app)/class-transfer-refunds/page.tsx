"use client";

import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listPendingClassTransferRefunds, markClassTransferRefundRefunded } from "@/lib/api/billing";
import type { PendingClassTransferRefund } from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatGNF } from "@/lib/format";

/**
 * Surplus de crédit laissés par un transfert de classe (§retour comptable, analyse de production :
 * 10 élèves, 100 000 GNF jamais régularisés) — un parent avait déjà réglé plus que ce que coûte la
 * nouvelle classe (moins chère). Jamais perdu, jamais effacé : reste tracé ici jusqu'à confirmation
 * du remboursement physique au parent.
 */
export default function ClassTransferRefundsPage() {
  const { user } = useAuth();
  const canManage = hasAnyPermission(user, ["facture:update"]);
  const q = useQuery(() => (canManage ? listPendingClassTransferRefunds() : Promise.resolve([])), [canManage]);

  if (!canManage) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès à cette page.
      </p>
    );
  }

  const refunds = q.data ?? [];
  const total = refunds.reduce((s, r) => s + Number(r.amount), 0);

  function confirmRefund(r: PendingClassTransferRefund) {
    confirmAction({
      title: "Confirmer le remboursement",
      message: `${r.studentName} — ${formatGNF(r.amount)} remis physiquement au parent ? Cette action ne peut pas être annulée depuis cet écran.`,
      confirmLabel: "Confirmer",
      onConfirm: async () => {
        try {
          await markClassTransferRefundRefunded(r.id);
          notifySuccess("Remboursement confirmé.");
          q.refetch();
        } catch (e) { notifyError(e); }
      },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Surplus de transfert de classe</h1>
          <p className="mt-1 text-sm text-gray-500">
            Élèves transférés vers une classe moins chère dont l&apos;ancienne facture, déjà réglée,
            dépassait le nouveau tarif — ce surplus reste dû à la famille jusqu&apos;à confirmation du
            remboursement.
          </p>
        </div>
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : refunds.length === 0 ? (
        <Card><CardBody className="py-10 text-center text-sm text-gray-400">Aucun surplus en attente.</CardBody></Card>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{refunds.length}</span> surplus en attente —
            total <span className="font-semibold text-gray-900">{formatGNF(total)}</span>
          </p>
          <Card>
            <CardBody className="p-0">
              <Table>
                <THead>
                  <TR>
                    <TH>Élève</TH><TH>Matricule</TH><TH>Classe</TH><TH>Montant</TH><TH>Date</TH>
                    <TH className="text-right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {refunds.map((r) => (
                    <TR key={r.id}>
                      <TD className="font-medium text-gray-900">{r.studentName}</TD>
                      <TD className="text-gray-600">{r.studentNumber ?? "—"}</TD>
                      <TD className="text-sm text-gray-600">
                        {r.oldClassName ?? "—"} → {r.newClassName ?? "—"}
                      </TD>
                      <TD className="font-semibold text-gray-900">{formatGNF(r.amount)}</TD>
                      <TD className="text-gray-500">{formatDate(r.createdAt)}</TD>
                      <TD className="text-right">
                        <Button size="sm" onClick={() => confirmRefund(r)}>Marquer remboursé</Button>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
