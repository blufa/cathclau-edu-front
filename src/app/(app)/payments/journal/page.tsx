"use client";

import { useState } from "react";
import { GraduationCap, Repeat, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getDailyJournal } from "@/lib/api/reporting";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";

function todayValue(): string {
  return new Date().toISOString().slice(0, 10);
}

const ENROLLMENT_TYPE_LABEL: Record<string, string> = { NEW: "Nouvelle inscription", RE_ENROLLMENT: "Réinscription" };
const CHANNEL_LABEL: Record<string, string> = {
  CASH: "Espèces", ORANGE_MONEY: "Orange Money", MTN_MONEY: "MTN Money", WAVE: "Wave",
  BANK_CARD: "Carte bancaire", DJOMY: "Djomy", PAYROLL_DEDUCTION: "Retenue sur salaire",
};

/**
 * Journal d'un jour précis (§retour comptable : "ce jour tu inscris tant d'élèves en classe, voici
 * les factures encaissées, voici l'argent collecté") — pour confronter le comptable sur son activité
 * réelle, jour par jour : inscriptions, encaissements et transferts de classe croisés sur la même
 * date, plutôt que trois écrans séparés.
 */
export default function DailyJournalPage() {
  const { user } = useAuth();
  const canView = hasAnyPermission(user, ["dashboard:admin"]);
  const [date, setDate] = useState(todayValue());
  const q = useQuery(() => (canView ? getDailyJournal(date) : Promise.resolve(null)), [canView, date]);

  if (!canView) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès à cette page.
      </p>
    );
  }

  const journal = q.data;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Journal du jour</h1>
            <p className="mt-1 text-sm text-gray-500">
              Tout ce qui s&apos;est passé un jour précis : élèves inscrits (avec classe), factures
              encaissées, et élèves transférés de classe.
            </p>
          </div>
          <Field>
            <Label className="sr-only">Date</Label>
            <Input type="date" value={date} max={todayValue()} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" />
          </Field>
        </div>
      </Reveal>

      {q.loading && !journal ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !journal ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardBody className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><GraduationCap className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs text-gray-500">Élèves inscrits</p>
                  <p className="text-xl font-bold text-gray-900">{journal.enrollments.length}</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><Wallet className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs text-gray-500">Argent collecté</p>
                  <p className="text-xl font-bold text-gray-900">{formatGNF(journal.totalCollected)}</p>
                  <p className="text-xs text-gray-400">{journal.payments.length} facture(s)</p>
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex items-center gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Repeat className="h-5 w-5" /></span>
                <div>
                  <p className="text-xs text-gray-500">Élèves transférés</p>
                  <p className="text-xl font-bold text-gray-900">{journal.transfers.length}</p>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><GraduationCap className="h-4 w-4 text-indigo-500" /> Élèves inscrits ce jour</CardTitle></CardHeader>
            <CardBody className="p-0">
              {journal.enrollments.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Aucune inscription ce jour-là.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Élève</TH><TH>Matricule</TH><TH>Classe</TH><TH>Type</TH><TH>Statut</TH></TR></THead>
                  <TBody>
                    {journal.enrollments.map((e, i) => (
                      <TR key={i}>
                        <TD className="font-medium text-gray-900">{e.studentName}</TD>
                        <TD className="text-gray-600">{e.studentNumber ?? "—"}</TD>
                        <TD className="text-gray-600">{e.className ?? "—"}</TD>
                        <TD className="text-gray-600">{e.type ? (ENROLLMENT_TYPE_LABEL[e.type] ?? e.type) : "—"}</TD>
                        <TD><Badge tone={e.status === "VALIDATED" ? "green" : e.status === "CANCELLED" ? "red" : "amber"}>{e.status}</Badge></TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4 text-emerald-500" /> Factures encaissées ce jour</CardTitle></CardHeader>
            <CardBody className="p-0">
              {journal.payments.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">Aucun encaissement ce jour-là.</p>
              ) : (
                <Table>
                  <THead><TR><TH>Référence</TH><TH>Élève</TH><TH>Canal</TH><TH className="text-right">Montant</TH></TR></THead>
                  <TBody>
                    {journal.payments.map((p) => (
                      <TR key={p.paymentId}>
                        <TD className="text-gray-600">{p.reference ?? "—"}</TD>
                        <TD className="font-medium text-gray-900">{p.studentName}</TD>
                        <TD className="text-gray-600">{p.channel ? (CHANNEL_LABEL[p.channel] ?? p.channel) : "—"}</TD>
                        <TD className="text-right font-semibold text-gray-900">{formatGNF(p.amount)}</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Repeat className="h-4 w-4 text-amber-500" /> Élèves transférés de classe ce jour</CardTitle></CardHeader>
            <CardBody className="p-0">
              {journal.transfers.length === 0 ? (
                <p className="py-8 text-center text-sm text-gray-400">
                  Aucun transfert ce jour-là (ou transfert antérieur au suivi — seuls les transferts
                  récents sont tracés avec une date).
                </p>
              ) : (
                <Table>
                  <THead><TR><TH>Élève</TH><TH>Ancienne classe</TH><TH>Nouvelle classe</TH></TR></THead>
                  <TBody>
                    {journal.transfers.map((t, i) => (
                      <TR key={i}>
                        <TD className="font-medium text-gray-900">{t.studentName}</TD>
                        <TD className="text-gray-600">{t.oldClassName ?? "—"}</TD>
                        <TD className="text-gray-600">{t.newClassName ?? "—"}</TD>
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
