"use client";

import { useState } from "react";
import { ShieldAlert, RefreshCw } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { isSuperAdmin } from "@/lib/auth/permissions";
import {
  scanDataIntegrity, fixHeadcount, deleteOrphanedInvoice, deleteOrphanedPayment,
} from "@/lib/api/data-integrity";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

/**
 * Vérification/correction de la cohérence des données de l'école impersonnée (§retour utilisateur —
 * suppressions manuelles en base, sans passer par l'outil de purge intégré, laissant des références
 * orphelines). Chaque écart se corrige INDIVIDUELLEMENT (jamais de bouton "tout corriger") — même
 * prudence que StudentPurgeService côté backend pour les paiements partagés entre élèves.
 */
export default function DataIntegrityPage() {
  const { user } = useAuth();
  const [scanned, setScanned] = useState(false);
  const q = useQuery(() => (scanned ? scanDataIntegrity() : Promise.resolve(null)), [scanned]);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  if (!isSuperAdmin(user)) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès à cette page.
      </p>
    );
  }

  async function run(key: string, action: () => Promise<unknown>, successMessage: string) {
    setBusyKey(key);
    try {
      await action();
      notifySuccess(successMessage);
      q.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setBusyKey(null);
    }
  }

  const result = q.data;
  const totalIssues = result
    ? result.headcountMismatches.length + result.orphanedInvoices.length + result.orphanedPayments.length
    : 0;

  return (
    <div className="space-y-5">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <ShieldAlert className="h-6 w-6 text-brand-600" /> Intégrité des données
        </h1>
        <p className="text-sm text-gray-500">
          Compare les effectifs de classe et les factures/paiements de l&apos;école actuellement
          impersonnée (menu « Plateforme ▾ ») aux élèves réellement présents en base — utile après une
          suppression faite directement en base plutôt que via l&apos;outil de purge intégré.
        </p>
      </Reveal>

      <div className="flex items-center gap-3">
        <Button onClick={() => { setScanned(true); q.refetch(); }} loading={q.loading} leftSection={<RefreshCw className="h-4 w-4" />}>
          Lancer la vérification
        </Button>
        {scanned && !q.loading && (
          <span className="text-sm text-gray-500">
            {totalIssues === 0 ? "Aucun écart détecté." : `${totalIssues} écart(s) détecté(s).`}
          </span>
        )}
      </div>

      {q.loading && (
        <div className="flex justify-center py-10"><Spinner /></div>
      )}

      {result && !q.loading && (
        <>
          <Card>
            <CardHeader><CardTitle>Écarts d&apos;effectif de classe</CardTitle></CardHeader>
            <CardBody>
              {result.headcountMismatches.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Aucun écart.</p>
              ) : (
                <Table>
                  <THead>
                    <TR><TH>Classe</TH><TH>Effectif enregistré</TH><TH>Inscriptions validées réelles</TH><TH className="text-right">Actions</TH></TR>
                  </THead>
                  <TBody>
                    {result.headcountMismatches.map((m) => (
                      <TR key={m.classId}>
                        <TD className="font-medium text-gray-900">{m.className}</TD>
                        <TD>{m.cachedHeadcount}</TD>
                        <TD>{m.actualValidatedEnrollments}</TD>
                        <TD className="text-right">
                          <Button
                            size="sm"
                            loading={busyKey === `headcount-${m.classId}`}
                            onClick={() => confirmAction({
                              title: "Corriger l'effectif",
                              message: `Remplacer l'effectif de « ${m.className} » (${m.cachedHeadcount}) par la valeur réelle (${m.actualValidatedEnrollments}) ?`,
                              confirmLabel: "Corriger",
                              onConfirm: () => run(`headcount-${m.classId}`, () => fixHeadcount(m.classId), "Effectif corrigé."),
                            })}
                          >
                            Corriger
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Factures orphelines (élève supprimé)</CardTitle></CardHeader>
            <CardBody>
              {result.orphanedInvoices.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Aucune facture orpheline.</p>
              ) : (
                <Table>
                  <THead>
                    <TR><TH>Référence</TH><TH>Élève (id, supprimé)</TH><TH>Solde restant</TH><TH className="text-right">Actions</TH></TR>
                  </THead>
                  <TBody>
                    {result.orphanedInvoices.map((inv) => (
                      <TR key={inv.invoiceId}>
                        <TD className="font-medium text-gray-900">{inv.reference}</TD>
                        <TD className="text-gray-500">#{inv.studentId}</TD>
                        <TD>{formatGNF(inv.remainingBalance)}</TD>
                        <TD className="text-right">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busyKey === `invoice-${inv.invoiceId}`}
                            onClick={() => confirmAction({
                              title: "Supprimer la facture orpheline",
                              message: `Supprimer définitivement la facture « ${inv.reference} » (élève #${inv.studentId}, déjà supprimé) et ses paiements/reçus liés ?`,
                              confirmLabel: "Supprimer",
                              danger: true,
                              onConfirm: () => run(`invoice-${inv.invoiceId}`, () => deleteOrphanedInvoice(inv.invoiceId), "Facture orpheline supprimée."),
                            })}
                          >
                            Supprimer
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle>Paiements orphelins (élève supprimé)</CardTitle></CardHeader>
            <CardBody>
              {result.orphanedPayments.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">Aucun paiement orphelin.</p>
              ) : (
                <Table>
                  <THead>
                    <TR><TH>Référence</TH><TH>Élève (id, supprimé)</TH><TH>Montant</TH><TH className="text-right">Actions</TH></TR>
                  </THead>
                  <TBody>
                    {result.orphanedPayments.map((p) => (
                      <TR key={p.paymentId}>
                        <TD className="font-medium text-gray-900">{p.reference}</TD>
                        <TD className="text-gray-500">#{p.studentId}</TD>
                        <TD>{formatGNF(p.amount)}</TD>
                        <TD className="text-right">
                          <Button
                            size="sm"
                            variant="danger"
                            loading={busyKey === `payment-${p.paymentId}`}
                            onClick={() => confirmAction({
                              title: "Supprimer le paiement orphelin",
                              message: `Supprimer définitivement le paiement « ${p.reference} » (élève #${p.studentId}, déjà supprimé) et ses reçus liés ?`,
                              confirmLabel: "Supprimer",
                              danger: true,
                              onConfirm: () => run(`payment-${p.paymentId}`, () => deleteOrphanedPayment(p.paymentId), "Paiement orphelin supprimé."),
                            })}
                          >
                            Supprimer
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
