"use client";

import { Banknote, Download } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listMyPayslips, getMyPayslipPdfObjectUrl } from "@/lib/api/payroll";
import type { Payslip } from "@/lib/types/payroll";
import { PAYSLIP_STATUS_LABEL } from "@/lib/types/payroll";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { StatCard } from "@/components/ui/stat-card";
import { formatDate, formatGNF } from "@/lib/format";
import { notifyError } from "@/lib/feedback";

const STATUS_TONE: Record<Payslip["status"], "gray" | "indigo" | "green"> = {
  DRAFT: "gray", VALIDATED: "indigo", PAID: "green",
};

async function openPdf(id: number) {
  try {
    window.open(await getMyPayslipPdfObjectUrl(id), "_blank");
  } catch (e) {
    notifyError(e);
  }
}

export default function MyPayslipsPage() {
  const { user } = useAuth();
  const isTeacher = hasRole(user, "TEACHER");
  const q = useQuery(() => (isTeacher ? listMyPayslips() : Promise.resolve([])), [isTeacher]);

  if (!isTeacher) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Espace réservé aux enseignants.</div>;
  }

  const payslips = [...(q.data ?? [])].sort((a, b) => (b.periodStart ?? "").localeCompare(a.periodStart ?? ""));
  const latest = payslips[0];

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Ma paie</h1>
        <p className="text-sm text-slate-500">Historique de mes fiches de paie et leur statut de règlement.</p>
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : payslips.length === 0 ? (
        <Card><CardBody><p className="text-sm text-slate-400">Aucune fiche de paie pour le moment.</p></CardBody></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard title="Dernière période" value={latest.periodLabel} icon={Banknote} accent="teal" />
            <StatCard title="Net de la dernière fiche" value={formatGNF(latest.netSalary)} icon={Banknote} accent="indigo" />
            <div className="flex items-center rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-xs text-slate-500">Statut</p>
                <Badge tone={STATUS_TONE[latest.status]}>{PAYSLIP_STATUS_LABEL[latest.status]}</Badge>
              </div>
            </div>
          </div>

          <Card>
            <CardBody>
              <Table>
                <THead>
                  <tr><TH>Période</TH><TH className="hidden sm:table-cell">Brut</TH><TH>Net</TH><TH>Statut</TH><TH className="hidden sm:table-cell">Payée le</TH><TH></TH></tr>
                </THead>
                <TBody>
                  {payslips.map((p) => (
                    <TR key={p.id}>
                      <TD className="font-medium text-slate-900">{p.periodLabel}</TD>
                      <TD className="hidden text-slate-500 sm:table-cell">{formatGNF(p.grossSalary)}</TD>
                      <TD className="font-medium text-slate-900">{formatGNF(p.netSalary)}</TD>
                      <TD><Badge tone={STATUS_TONE[p.status]}>{PAYSLIP_STATUS_LABEL[p.status]}</Badge></TD>
                      <TD className="hidden text-slate-500 sm:table-cell">{p.paidAt ? formatDate(p.paidAt) : "—"}</TD>
                      <TD className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openPdf(p.id)} leftSection={<Download className="h-4 w-4" />}>
                          PDF
                        </Button>
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
