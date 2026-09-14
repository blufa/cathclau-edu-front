"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getDailyCollectionsReport } from "@/lib/api/payment";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatDate, formatGNF } from "@/lib/format";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7); // "YYYY-MM"
}

/** Plage ISO couvrant tout le mois "YYYY-MM" (du 1er 00:00 au dernier jour 23:59:59). */
function monthRange(period: string): { from: string; to: string } {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return {
    from: `${period}-01T00:00:00`,
    to: `${period}-${String(lastDay).padStart(2, "0")}T23:59:59`,
  };
}

export default function DailyCollectionsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const [period, setPeriod] = useState(currentMonth());
  const { from, to } = useMemo(() => monthRange(period), [period]);

  const reportQuery = useCachedQuery(
    tenantId ? `daily-collections:${tenantId}:${period}` : null,
    () => getDailyCollectionsReport(from, to),
    [tenantId, from, to],
  );

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  const days = reportQuery.data?.days ?? [];

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <CalendarDays className="h-6 w-6 text-brand-600" /> Encaissements par jour
        </h1>
        <p className="text-sm text-gray-500">
          Total encaissé chaque jour, tous canaux confondus (espèces, mobile money, carte, virement) — que
          les frais soient réglés par tranche ou en une fois. Utile pour le contrôle mensuel.
        </p>
      </Reveal>

      <div className="max-w-[200px]">
        <Field>
          <Label>Mois</Label>
          <Input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
        </Field>
      </div>

      {reportQuery.loading && !reportQuery.data ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <Card>
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">Total encaissé sur le mois</p>
              <p className="text-xl font-bold text-gray-900">{formatGNF(reportQuery.data?.grandTotal ?? "0")}</p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Table>
                <THead><tr><TH>Date</TH><TH className="text-right">Nb. paiements</TH><TH className="text-right">Total</TH></tr></THead>
                <TBody>
                  {days.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucun encaissement ce mois-ci.</TD></TR>}
                  {days.map((d) => (
                    <TR key={d.date}>
                      <TD className="font-medium text-gray-900">{formatDate(d.date)}</TD>
                      <TD className="text-right text-gray-600">{d.count}</TD>
                      <TD className="text-right font-medium text-gray-900">{formatGNF(d.total)}</TD>
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
