"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/api/iam";
import {
  closeCashierSession,
  getCurrentCashierSession,
  listCashierSessions,
  openCashierSession,
} from "@/lib/api/payment";
import { isNetworkError } from "@/lib/api/errors";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import {
  closeOfflineCashierSession, getOfflineRunningTotal, getPendingOfflineOpenSession,
  openOfflineCashierSession, queueOfflineCashierClose, type PendingOfflineSession,
} from "@/lib/offline/desktop-cashier";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatDateTime, formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";

export default function CashierSessionPage() {
  const { user } = useAuth();
  const canOperate = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY") || hasAnyPermission(user, ["paiement:create"]);
  // La direction voit les sessions de tous les comptables (supervision) ; un comptable ne voit que les siennes.
  const canSeeAllHistory = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  // `useCachedQuery` (au lieu du hook maison sans cache) : le comptable doit pouvoir ouvrir/consulter/
  // clôturer sa caisse CHAQUE JOUR, y compris hors ligne (§retour comptable, démo desktop).
  const currentQuery = useCachedQuery(
    canOperate ? "cashier-session:current" : null,
    () => (canOperate ? getCurrentCashierSession() : Promise.resolve(null)),
    [canOperate],
  );
  const historyQuery = useCachedQuery(
    canOperate ? `cashier-sessions:history:${canSeeAllHistory ? "all" : user?.userId}` : null,
    () => listCashierSessions(canSeeAllHistory ? undefined : (user?.userId ?? undefined), "CLOSED"),
    [canSeeAllHistory, user?.userId],
  );
  const usersQuery = useCachedQuery(
    canSeeAllHistory ? "users:first-page" : null,
    () => (canSeeAllHistory ? listUsers(0, 100) : Promise.resolve(null)),
    [canSeeAllHistory],
  );
  const cashierName = useMemo(() => {
    const map = new Map<number, string>();
    (usersQuery.data?.content ?? []).forEach((u) => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return (id: number) => map.get(id) ?? `Utilisateur #${id}`;
  }, [usersQuery.data]);

  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);

  // Session ouverte hors ligne, pas encore confirmée par le serveur (§retour comptable) : sans ça, un
  // comptable qui ouvre sa caisse un matin sans réseau ne la revoyait jamais tant qu'il n'avait pas
  // resynchronisé — impossible de savoir que sa caisse était "déjà ouverte" pour éviter une double
  // ouverture, ni de la clôturer le soir avant d'être reconnecté.
  const [pendingOffline, setPendingOffline] = useState<PendingOfflineSession | null>(null);
  const [pendingTotal, setPendingTotal] = useState(0);

  useEffect(() => {
    if (!isDesktop()) return;
    let active = true;
    void (async () => {
      const pending = await getPendingOfflineOpenSession();
      if (!active) return;
      setPendingOffline(pending);
      setPendingTotal(pending ? await getOfflineRunningTotal(pending.id) : 0);
    })();
    return () => { active = false; };
  }, [currentQuery.data]);

  async function open() {
    setOpening(true);
    try {
      await openCashierSession();
      notifySuccess("Caisse ouverte");
      currentQuery.refetch();
    } catch (err) {
      if (isNetworkError(err) && isDesktop()) {
        await openOfflineCashierSession(user?.tenantId ?? 0);
        notifySuccess("Hors ligne : caisse ouverte localement, sera synchronisée au retour du réseau");
        setPendingOffline(await getPendingOfflineOpenSession());
      } else {
        notifyError(err);
      }
    } finally { setOpening(false); }
  }

  if (!canOperate) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé au personnel de guichet et à la direction.</div>;
  }

  const current = currentQuery.data;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Wallet className="h-6 w-6 text-brand-600" /> Session de caisse
        </h1>
        <p className="text-sm text-gray-500">
          Rapprochement des encaissements en espèces : comparez le comptant physique au total enregistré.
        </p>
      </Reveal>

      {currentQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : current ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Caisse ouverte depuis</p>
                <p className="text-lg font-semibold text-gray-900">{formatDateTime(current.session.openedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total encaissé (espèces)</p>
                <p className="text-lg font-semibold text-gray-900">{formatGNF(current.runningTotal)}</p>
              </div>
              <Button onClick={() => setClosing(true)}>Clôturer ma caisse</Button>
            </div>
          </CardBody>
        </Card>
      ) : pendingOffline ? (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <p className="text-sm text-gray-500">Caisse ouverte depuis</p>
                  <Badge tone="amber">Hors ligne — pas encore synchronisée</Badge>
                </div>
                <p className="text-lg font-semibold text-gray-900">{formatDateTime(pendingOffline.openedAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Total encaissé (estimé, hors ligne)</p>
                <p className="text-lg font-semibold text-gray-900">{formatGNF(pendingTotal)}</p>
              </div>
              <Button onClick={() => setClosing(true)}>Clôturer ma caisse</Button>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">Aucune session de caisse ouverte pour votre compte.</p>
            <Button onClick={open} loading={opening}>Ouvrir ma caisse</Button>
          </CardBody>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-gray-700">Historique des clôtures</h2>
        {historyQuery.loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (historyQuery.data ?? []).length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Aucune session clôturée pour l&apos;instant.</p>
        ) : (
          <Card>
            <CardBody>
              <Table>
                <THead>
                  <tr>
                    {canSeeAllHistory && <TH>Comptable</TH>}
                    <TH>Ouverture</TH>
                    <TH>Clôture</TH>
                    <TH className="text-right">Total système</TH>
                    <TH className="text-right">Comptant</TH>
                    <TH className="text-right">Écart</TH>
                  </tr>
                </THead>
                <TBody>
                  {(historyQuery.data ?? []).map((s) => (
                    <TR key={s.id}>
                      {canSeeAllHistory && <TD className="font-medium text-gray-900">{cashierName(s.cashierId)}</TD>}
                      <TD className="text-gray-500">{formatDateTime(s.openedAt)}</TD>
                      <TD className="text-gray-500">{formatDateTime(s.closedAt)}</TD>
                      <TD className="text-right">{formatGNF(s.systemTotal)}</TD>
                      <TD className="text-right">{formatGNF(s.physicalCount)}</TD>
                      <TD className="text-right">
                        {Number(s.discrepancy) === 0 ? (
                          <Badge tone="green">Juste</Badge>
                        ) : (
                          <span className={Number(s.discrepancy) > 0 ? "font-medium text-success-600" : "font-medium text-error-600"}>
                            {formatGNF(s.discrepancy)}
                          </span>
                        )}
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardBody>
          </Card>
        )}
      </div>

      <Modal open={closing} onClose={() => setClosing(false)} title="Clôturer ma caisse">
        {current ? (
          <CloseSessionForm
            runningTotal={current.runningTotal}
            onCancel={() => setClosing(false)}
            onSubmit={async (physicalCount, notes) => {
              try {
                const closed = await closeCashierSession(current.session.id, physicalCount, notes);
                const gap = Number(closed.discrepancy ?? 0);
                if (gap === 0) notifySuccess("Caisse clôturée : comptant conforme, aucun écart.");
                else notifyError(`Caisse clôturée avec un écart de ${formatGNF(closed.discrepancy)} (${gap > 0 ? "excédent" : "manquant"}).`);
              } catch (err) {
                // Session confirmée en ligne, mais la CLÔTURE échoue faute de réseau en fin de journée
                // (§retour comptable) : mise en file locale, rejouée à la reconnexion — jamais perdue.
                if (isNetworkError(err) && isDesktop()) {
                  await queueOfflineCashierClose(
                    user?.tenantId ?? 0, current.session.id, current.session.openedAt, physicalCount, notes,
                  );
                  notifySuccess("Hors ligne : clôture enregistrée localement, sera synchronisée au retour du réseau");
                } else {
                  throw err;
                }
              }
            }}
            onDone={() => { setClosing(false); currentQuery.refetch(); historyQuery.refetch(); }}
          />
        ) : pendingOffline ? (
          <CloseSessionForm
            runningTotal={pendingTotal}
            onCancel={() => setClosing(false)}
            onSubmit={async (physicalCount, notes) => {
              await closeOfflineCashierSession(pendingOffline.id, physicalCount, notes);
              notifySuccess("Caisse clôturée localement (hors ligne), sera synchronisée au retour du réseau");
            }}
            onDone={() => {
              setClosing(false);
              setPendingOffline(null);
              setPendingTotal(0);
              currentQuery.refetch();
              historyQuery.refetch();
            }}
          />
        ) : null}
      </Modal>
    </div>
  );
}

function CloseSessionForm({ runningTotal, onCancel, onSubmit, onDone }: {
  runningTotal: string | number;
  onCancel: () => void;
  onSubmit: (physicalCount: number, notes?: string) => Promise<void>;
  onDone: () => void;
}) {
  const [physicalCount, setPhysicalCount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (physicalCount === "") { notifyError("Indiquez le comptant physique compté"); return; }
    setLoading(true);
    try {
      await onSubmit(Number(physicalCount), notes || undefined);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600">
        Total encaissé en espèces enregistré par le système depuis l&apos;ouverture :{" "}
        <span className="font-semibold text-gray-900">{formatGNF(runningTotal)}</span>
      </p>
      <Field>
        <Label>Comptant physique compté (GNF) <span className="text-error-500">*</span></Label>
        <Input type="number" min={0} value={physicalCount} onChange={(e) => setPhysicalCount(e.target.value)} />
      </Field>
      <Field>
        <Label>Notes (optionnel)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Clôturer</Button>
      </div>
    </div>
  );
}
