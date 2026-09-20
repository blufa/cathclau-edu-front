"use client";

import { useMemo, useState } from "react";
import { Wallet } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { listUsers } from "@/lib/api/iam";
import {
  closeCashierSession,
  getCurrentCashierSession,
  listCashierSessions,
  openCashierSession,
} from "@/lib/api/payment";
import type { CashierSession } from "@/lib/types/payment";
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
  const canOperate = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY");
  // La direction voit les sessions de tous les comptables (supervision) ; un comptable ne voit que les siennes.
  const canSeeAllHistory = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const currentQuery = useQuery(() => (canOperate ? getCurrentCashierSession() : Promise.resolve(null)), [canOperate]);
  const historyQuery = useQuery(
    () => listCashierSessions(canSeeAllHistory ? undefined : (user?.userId ?? undefined), "CLOSED"),
    [canSeeAllHistory, user?.userId],
  );
  const usersQuery = useQuery(() => (canSeeAllHistory ? listUsers(0, 100) : Promise.resolve(null)), [canSeeAllHistory]);
  const cashierName = useMemo(() => {
    const map = new Map<number, string>();
    (usersQuery.data?.content ?? []).forEach((u) => map.set(u.id, `${u.firstName} ${u.lastName}`));
    return (id: number) => map.get(id) ?? `Utilisateur #${id}`;
  }, [usersQuery.data]);

  const [opening, setOpening] = useState(false);
  const [closing, setClosing] = useState(false);

  async function open() {
    setOpening(true);
    try {
      await openCashierSession();
      notifySuccess("Caisse ouverte");
      currentQuery.refetch();
    } catch (err) { notifyError(err); } finally { setOpening(false); }
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
        {current && (
          <CloseSessionForm
            session={current.session}
            runningTotal={current.runningTotal}
            onCancel={() => setClosing(false)}
            onDone={() => { setClosing(false); currentQuery.refetch(); historyQuery.refetch(); }}
          />
        )}
      </Modal>
    </div>
  );
}

function CloseSessionForm({ session, runningTotal, onCancel, onDone }: {
  session: CashierSession; runningTotal: string; onCancel: () => void; onDone: () => void;
}) {
  const [physicalCount, setPhysicalCount] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (physicalCount === "") { notifyError("Indiquez le comptant physique compté"); return; }
    setLoading(true);
    try {
      const closed = await closeCashierSession(session.id, Number(physicalCount), notes || undefined);
      const gap = Number(closed.discrepancy ?? 0);
      if (gap === 0) notifySuccess("Caisse clôturée : comptant conforme, aucun écart.");
      else notifyError(`Caisse clôturée avec un écart de ${formatGNF(closed.discrepancy)} (${gap > 0 ? "excédent" : "manquant"}).`);
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
