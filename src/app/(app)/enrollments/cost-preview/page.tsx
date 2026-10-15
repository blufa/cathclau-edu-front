"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { listFeesByClass, listInstallments } from "@/lib/api/billing";
import { listRoutes } from "@/lib/api/transport";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Reveal } from "@/components/public/reveal";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatGNF } from "@/lib/format";

type EnrollmentKind = "ENROLLMENT" | "RE_ENROLLMENT";

/** Une ligne cochable du récapitulatif — tranche de mensualité, frais annexe, transport... */
interface CostLine {
  key: string;
  label: string;
  amount: number;
  defaultChecked: boolean;
}

/**
 * Réponse rapide à "le parent demande la 7ème, il doit payer combien pour commencer ?" (§retour
 * comptable) : le comptable choisit la classe puis coche, parmi les frais réellement configurés pour
 * cette classe (inscription/réinscription, chaque tranche de mensualité, frais annexes, transport),
 * ceux que le parent doit payer maintenant — sans détour par la page Frais scolaires ni commencer une
 * inscription juste pour voir le prix. Lecture seule, aucune facture/élève créé ici.
 */
export default function EnrollmentCostPreviewPage() {
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (currentYearId ? listClasses(currentYearId) : Promise.resolve([])), [currentYearId]);
  const classOptions: SearchableOption[] = useMemo(
    () => (classesQuery.data ?? []).map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classesQuery.data],
  );
  const routesQuery = useCachedQuery("transport-routes", listRoutes, []);
  const routeOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Aucun", label: "Aucun", searchText: "" },
      ...(routesQuery.data ?? []).filter((r) => r.active).map((r) => ({ value: String(r.id), trigger: r.name, label: r.name, searchText: r.name })),
    ],
    [routesQuery.data],
  );

  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<EnrollmentKind | null>(null);
  const [routeId, setRouteId] = useState("");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  function resetSelection() {
    setKind(null);
    setRouteId("");
    setOverrides({});
  }

  const feesQuery = useQuery(() => (classId ? listFeesByClass(Number(classId)) : Promise.resolve([])), [classId]);
  const enrollmentFee = (feesQuery.data ?? []).find((f) => f.type === kind);
  const monthlyFee = (feesQuery.data ?? []).find((f) => f.type === "MONTHLY");
  const annexFees = (feesQuery.data ?? []).filter((f) => f.type === "CANTEEN" || f.type === "EXAM" || f.type === "OTHER");
  const route = (routesQuery.data ?? []).find((r) => String(r.id) === routeId);

  const installmentsQuery = useQuery(
    () => (monthlyFee ? listInstallments(monthlyFee.id) : Promise.resolve([])),
    [monthlyFee?.id],
  );
  const installments = useMemo(
    () => [...(installmentsQuery.data ?? [])].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    [installmentsQuery.data],
  );

  const ready = !!classId && !!kind;
  const loading = feesQuery.loading || (!!monthlyFee && installmentsQuery.loading);

  const lines: CostLine[] = useMemo(() => {
    const result: CostLine[] = [];
    if (enrollmentFee) {
      result.push({
        key: "enrollment",
        label: kind === "ENROLLMENT" ? "Frais d'inscription" : "Frais de réinscription",
        amount: Number(enrollmentFee.amount),
        defaultChecked: true,
      });
    }
    installments.forEach((i, idx) => {
      result.push({
        key: `installment-${i.id}`,
        label: `${i.label}${i.dueDate ? ` (échéance ${formatDate(i.dueDate)})` : ""}`,
        amount: Number(i.amount),
        defaultChecked: idx === 0,
      });
    });
    annexFees.forEach((f) => {
      result.push({
        key: `fee-${f.id}`,
        label: f.label || "Autre (frais annexe)",
        amount: Number(f.amount),
        defaultChecked: false,
      });
    });
    if (route && route.monthlyFee != null) {
      result.push({
        key: "transport",
        label: `Transport — ${route.name}`,
        amount: Number(route.monthlyFee),
        defaultChecked: false,
      });
    }
    return result;
  }, [enrollmentFee, kind, installments, annexFees, route]);

  const total = lines.reduce((sum, l) => sum + ((overrides[l.key] ?? l.defaultChecked) ? l.amount : 0), 0);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Combien pour démarrer ?</h1>
        <p className="text-sm text-gray-500">
          Choisissez une classe, puis cochez les frais que le parent doit payer maintenant — inscription,
          tranche(s) de mensualité, frais annexes, transport...
        </p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <Field>
          <Label>Classe <span className="text-error-500">*</span></Label>
          <SearchableSelect value={classId} options={classOptions} onChange={(v) => { setClassId(v); resetSelection(); }}
            triggerClassName="w-56 justify-between px-3" noResultsLabel="Aucune classe" />
        </Field>
        <Field>
          <Label>Transport (optionnel)</Label>
          <SearchableSelect value={routeId} options={routeOptions} onChange={setRouteId}
            triggerClassName="w-56 justify-between px-3" noResultsLabel="Aucun trajet" />
        </Field>
      </div>

      {classId && (
        <div className="flex flex-col gap-2 sm:flex-row sm:max-w-md">
          {(["ENROLLMENT", "RE_ENROLLMENT"] as EnrollmentKind[]).map((k) => {
            const checked = kind === k;
            return (
              <label key={k} className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors cursor-pointer ${
                checked ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"
              }`}>
                <input type="checkbox" className="h-5 w-5 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600"
                  checked={checked} onChange={(e) => { setKind(e.target.checked ? k : null); setOverrides({}); }} />
                <span className={`text-sm ${checked ? "font-semibold text-brand-900" : "font-medium text-gray-700"}`}>
                  {k === "ENROLLMENT" ? "Inscription (nouvel élève)" : "Réinscription (déjà scolarisé ici)"}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {ready && (
        loading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : (
          <Card>
            <CardBody className="space-y-1">
              {!enrollmentFee && (
                <p className="pb-3 text-sm text-warning-700">
                  Aucun frais {kind === "ENROLLMENT" ? "d'inscription" : "de réinscription"} configuré pour cette classe.
                </p>
              )}
              {monthlyFee && installments.length === 0 && (
                <p className="pb-3 text-sm text-warning-700">Aucune tranche de mensualité configurée pour cette classe.</p>
              )}
              {!monthlyFee && (
                <p className="pb-3 text-sm text-warning-700">Aucune mensualité configurée pour cette classe.</p>
              )}
              {lines.map((l) => {
                const checked = overrides[l.key] ?? l.defaultChecked;
                return (
                  <label key={l.key} className="flex cursor-pointer items-center justify-between gap-3 border-b border-gray-100 py-2.5 last:border-0">
                    <span className="flex items-center gap-3">
                      <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600"
                        checked={checked} onChange={(e) => setOverrides((prev) => ({ ...prev, [l.key]: e.target.checked }))} />
                      <span className="text-sm text-gray-700">{l.label}</span>
                    </span>
                    <span className={`font-semibold ${checked ? "text-gray-900" : "text-gray-400"}`}>{formatGNF(l.amount)}</span>
                  </label>
                );
              })}
              <div className="flex items-center justify-between pt-3">
                <span className="text-base font-semibold text-gray-900">Montant pour commencer</span>
                <span className="text-xl font-bold text-brand-700">{formatGNF(total)}</span>
              </div>
            </CardBody>
          </Card>
        )
      )}
    </div>
  );
}
