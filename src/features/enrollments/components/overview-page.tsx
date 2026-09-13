"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Layers, RefreshCw, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { searchEnrollments } from "@/lib/api/enrollments";
import { listFeesByTenant, listInvoicesByTenant } from "@/lib/api/billing";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";

const GNF = new Intl.NumberFormat("fr-FR");

export default function RentreeDashboardPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const allowed = hasRole(user, "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["inscription:read"]);

  const yearsQuery = useQuery(() => listAcademicYears(), []);
  const years = useMemo(() => [...(yearsQuery.data ?? [])].sort((a, b) => (b.label ?? "").localeCompare(a.label ?? "")), [yearsQuery.data]);
  const current = years.find((y) => y.current) ?? years[0];
  const [yearId, setYearId] = useState<string>("");
  const effectiveYear = yearId || (current ? String(current.id) : "");

  const classesQuery = useQuery(() => (effectiveYear ? listClasses(Number(effectiveYear)) : Promise.resolve([])), [effectiveYear]);
  const levelsQuery = useQuery(() => listLevels(), []);
  const enrollmentsQuery = useQuery(
    () => (effectiveYear ? searchEnrollments({ academicYearId: Number(effectiveYear), status: "VALIDATED" }) : Promise.resolve([])),
    [effectiveYear],
  );
  const feesQuery = useQuery(() => (tenantId ? listFeesByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  const invoicesQuery = useQuery(() => (tenantId ? listInvoicesByTenant(tenantId) : Promise.resolve([])), [tenantId]);

  if (!allowed || !tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé à l&apos;administration de l&apos;établissement.</div>;
  }

  const classes = classesQuery.data ?? [];
  const levelLabel = new Map((levelsQuery.data ?? []).map((l) => [l.id, l.label]));

  const totalSeats = classes.reduce((s, c) => s + (c.maxCapacity ?? 0), 0);
  const enrolled = classes.reduce((s, c) => s + (c.headcount ?? 0), 0);
  const seatsLeft = Math.max(totalSeats - enrolled, 0);
  const fillRate = totalSeats > 0 ? Math.round((enrolled / totalSeats) * 100) : 0;

  const enrollments = enrollmentsQuery.data ?? [];
  const reEnrollments = enrollments.filter((e) => e.type === "RE_ENROLLMENT").length;
  const reRate = enrollments.length > 0 ? Math.round((reEnrollments / enrollments.length) * 100) : 0;

  // Enrollment receipts: invoices linked to ENROLLMENT / RE_ENROLLMENT fees, summed over paid amounts.
  const enrollmentFeeIds = new Set((feesQuery.data ?? []).filter((f) => f.type === "ENROLLMENT" || f.type === "RE_ENROLLMENT").map((f) => f.id));
  const receipts = (invoicesQuery.data ?? [])
    .filter((inv) => inv.feeId != null && enrollmentFeeIds.has(inv.feeId))
    .reduce((s, inv) => s + Number(inv.paidAmount ?? 0), 0);

  const loading = classesQuery.loading || enrollmentsQuery.loading;

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tableau de bord — Rentrée</h1>
          <p className="text-sm text-slate-500">Suivi des inscriptions, places restantes et recettes d&apos;inscription.</p>
        </div>
        <Select className="max-w-[220px]" value={effectiveYear} onChange={(e) => setYearId(e.target.value)}>
          {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>)}
        </Select>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Inscrits (validés)" value={`${enrolled} / ${totalSeats}`} icon={GraduationCap} accent="teal" hint={`${fillRate}% de remplissage`} />
        <StatCard title="Places restantes" value={seatsLeft} icon={Layers} accent="sky" />
        <StatCard title="Taux de réinscription" value={`${reRate}%`} icon={RefreshCw} accent="indigo" hint={`${reEnrollments} réinscription(s)`} />
        <StatCard title="Recettes d'inscription" value={`${GNF.format(receipts)} GNF`} icon={Wallet} accent="amber" hint="Encaissées" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">Remplissage par classe</div>
          <Table>
            <THead><tr><TH>Classe</TH><TH className="hidden sm:table-cell">Niveau</TH><TH>Effectif</TH><TH className="w-1/3">Remplissage</TH><TH className="hidden sm:table-cell">Places restantes</TH></tr></THead>
            <TBody>
              {classes.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-slate-400">Aucune classe pour cette année.</TD></TR>}
              {classes.map((c) => {
                const cap = c.maxCapacity ?? 0;
                const head = c.headcount ?? 0;
                const pct = cap > 0 ? Math.min(Math.round((head / cap) * 100), 100) : 0;
                const left = Math.max(cap - head, 0);
                return (
                  <TR key={c.id}>
                    <TD className="font-medium text-slate-900">{c.label}</TD>
                    <TD className="hidden text-slate-500 sm:table-cell">{c.levelId != null ? (levelLabel.get(c.levelId) ?? "—") : "—"}</TD>
                    <TD className="text-slate-600">{head} / {cap || "—"}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              pct >= 100 ? "bg-error-500" : pct >= 80 ? "bg-warning-500" : "bg-success-500",
                            )}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs text-slate-500">{pct}%</span>
                      </div>
                    </TD>
                    <TD className={cn("hidden sm:table-cell", left === 0 ? "text-red-600" : "text-slate-600")}>{left}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
