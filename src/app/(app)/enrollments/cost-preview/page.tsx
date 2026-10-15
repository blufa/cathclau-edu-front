"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { listFeesByClass, listFeesByRoute, listInstallments } from "@/lib/api/billing";
import { listRoutes } from "@/lib/api/transport";
import type { TransportRoute } from "@/lib/types/transport";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

interface ChildConfig {
  id: string;
  classId: string;
  kind: EnrollmentKind | null;
  routeId: string;
  overrides: Record<string, boolean>;
}

let nextChildId = 1;
function newChild(): ChildConfig {
  return { id: `child-${nextChildId++}`, classId: "", kind: null, routeId: "", overrides: {} };
}

/**
 * Réponse rapide à "le parent demande la 7ème, il doit payer combien pour commencer ?" (§retour
 * comptable) : le comptable choisit la classe (une ligne par enfant — un parent en a souvent 2 à 4,
 * dans des classes différentes) puis coche, parmi les frais réellement configurés, ceux que le parent
 * doit payer maintenant — sans détour par la page Frais scolaires ni commencer une inscription juste
 * pour voir le prix. Lecture seule, aucune facture/élève créé ici.
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
  const routes = useMemo(() => routesQuery.data ?? [], [routesQuery.data]);
  const routeOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Aucun", label: "Aucun", searchText: "" },
      ...routes.filter((r) => r.active).map((r) => ({ value: String(r.id), trigger: r.name, label: r.name, searchText: r.name })),
    ],
    [routes],
  );

  const [children, setChildren] = useState<ChildConfig[]>([newChild()]);
  const [totals, setTotals] = useState<Record<string, number>>({});

  const updateChild = useCallback((id: string, next: Partial<ChildConfig>) => {
    setChildren((prev) => prev.map((c) => (c.id === id ? { ...c, ...next } : c)));
  }, []);
  const removeChild = useCallback((id: string) => {
    setChildren((prev) => prev.filter((c) => c.id !== id));
    setTotals((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);
  const setChildTotal = useCallback((id: string, total: number) => {
    setTotals((prev) => (prev[id] === total ? prev : { ...prev, [id]: total }));
  }, []);

  const grandTotal = Object.values(totals).reduce((s, t) => s + t, 0);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Combien pour démarrer ?</h1>
      </Reveal>

      <div className="space-y-4">
        {children.map((child, idx) => (
          <ChildCostPreview
            key={child.id}
            child={child}
            index={idx}
            classOptions={classOptions}
            routeOptions={routeOptions}
            routes={routes}
            onChange={(next) => updateChild(child.id, next)}
            onTotalChange={(total) => setChildTotal(child.id, total)}
            onRemove={() => removeChild(child.id)}
            removable={children.length > 1}
          />
        ))}
      </div>

      <Button variant="secondary" onClick={() => setChildren((prev) => [...prev, newChild()])} leftSection={<Plus className="h-4 w-4" />}>
        Ajouter un enfant
      </Button>

      {children.length > 1 && (
        <Card>
          <CardBody className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">Total pour les {children.length} enfants</span>
            <span className="text-xl font-bold text-brand-700">{formatGNF(grandTotal)}</span>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function ChildCostPreview({
  child,
  index,
  classOptions,
  routeOptions,
  routes,
  onChange,
  onTotalChange,
  onRemove,
  removable,
}: {
  child: ChildConfig;
  index: number;
  classOptions: SearchableOption[];
  routeOptions: SearchableOption[];
  routes: TransportRoute[];
  onChange: (next: Partial<ChildConfig>) => void;
  onTotalChange: (total: number) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  const { classId, kind, routeId, overrides } = child;

  const feesQuery = useQuery(() => (classId ? listFeesByClass(Number(classId)) : Promise.resolve([])), [classId]);
  const enrollmentFee = (feesQuery.data ?? []).find((f) => f.type === kind);
  const monthlyFee = (feesQuery.data ?? []).find((f) => f.type === "MONTHLY");
  const annexFees = (feesQuery.data ?? []).filter((f) => f.type === "CANTEEN" || f.type === "EXAM" || f.type === "OTHER");
  const route = routes.find((r) => String(r.id) === routeId);

  const installmentsQuery = useQuery(
    () => (monthlyFee ? listInstallments(monthlyFee.id) : Promise.resolve([])),
    [monthlyFee?.id],
  );
  const installments = useMemo(
    () => [...(installmentsQuery.data ?? [])].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    [installmentsQuery.data],
  );

  // Le tarif réel du transport est un frais (SchoolFee type TRANSPORT, rattaché par routeId) côté
  // facturation — PAS la colonne monthlyFee de TransportRoute (souvent vide/non tenue à jour, voir
  // §retour utilisateur : "il y'a le tarif dessus" alors que route.monthlyFee était null en base).
  const transportFeesQuery = useQuery(
    () => (route ? listFeesByRoute(route.id) : Promise.resolve([])),
    [route?.id],
  );
  const transportFee = (transportFeesQuery.data ?? []).find((f) => f.type === "TRANSPORT");

  // Le frais transport est lui aussi découpé en mensualités (une Installment par mois de l'année
  // scolaire, ex. octobre→juin) — §retour utilisateur : il veut une case par mois, pas un seul
  // montant global, pour pouvoir cocher exactement le nombre de mois que le parent paie maintenant.
  const transportInstallmentsQuery = useQuery(
    () => (transportFee ? listInstallments(transportFee.id) : Promise.resolve([])),
    [transportFee?.id],
  );
  const transportInstallments = useMemo(
    () => [...(transportInstallmentsQuery.data ?? [])].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    [transportInstallmentsQuery.data],
  );

  // Les tranches, frais annexes et le transport ne dépendent pas du type (inscription/réinscription) —
  // seule la ligne de frais d'inscription/réinscription en dépend (voir plus bas, absente si kind est
  // vide). Et le transport ne dépend même pas de la classe (une ligne dessert plusieurs classes) :
  // choisir un trajet seul, sans classe, doit déjà afficher son tarif (§retour utilisateur répété
  // "rien ne se passe" — choisir uniquement classe ou uniquement transport doit afficher quelque chose).
  const ready = !!classId || !!routeId;
  const loading = feesQuery.loading || (!!monthlyFee && installmentsQuery.loading)
    || (!!route && transportFeesQuery.loading) || (!!transportFee && transportInstallmentsQuery.loading);

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
      result.push({ key: `fee-${f.id}`, label: f.label || "Autre (frais annexe)", amount: Number(f.amount), defaultChecked: false });
    });
    if (route) {
      transportInstallments.forEach((i) => {
        result.push({
          key: `transport-${i.id}`,
          label: `Transport — ${route.name} — ${i.label}`,
          amount: Number(i.amount),
          defaultChecked: false,
        });
      });
    }
    return result;
  }, [enrollmentFee, kind, installments, annexFees, route, transportInstallments]);

  const total = useMemo(
    () => (ready ? lines.reduce((sum, l) => sum + ((overrides[l.key] ?? l.defaultChecked) ? l.amount : 0), 0) : 0),
    [ready, lines, overrides],
  );

  // Fait remonter le total de cet enfant au parent (pour le grand total) — le parent recrée
  // onTotalChange à chaque rendu, mais la mise à jour est sans effet si le total n'a pas changé (voir
  // setChildTotal), donc ça converge.
  useEffect(() => {
    onTotalChange(total);
  }, [total, onTotalChange]);

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-500">Enfant {index + 1}</span>
          {removable && (
            <button type="button" onClick={onRemove} className="text-gray-400 hover:text-error-600" aria-label="Retirer cet enfant">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <Field>
            <Label>Classe <span className="text-error-500">*</span></Label>
            <SearchableSelect value={classId} options={classOptions}
              onChange={(v) => onChange({ classId: v, kind: null, routeId: "", overrides: {} })}
              triggerClassName="w-48 justify-between px-3" noResultsLabel="Aucune classe" />
          </Field>
          <Field>
            <Label>Transport (optionnel)</Label>
            <SearchableSelect value={routeId} options={routeOptions} onChange={(v) => onChange({ routeId: v })}
              triggerClassName="w-48 justify-between px-3" noResultsLabel="Aucun trajet" />
          </Field>
          {classId && (
            <div className="flex gap-2">
              {(["ENROLLMENT", "RE_ENROLLMENT"] as EnrollmentKind[]).map((k) => {
                const checked = kind === k;
                return (
                  <label key={k} className={`flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border-2 px-3 text-sm transition-colors cursor-pointer ${
                    checked ? "border-brand-500 bg-brand-50 font-semibold text-brand-900" : "border-gray-200 font-medium text-gray-700 hover:border-gray-300"
                  }`}>
                    <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600"
                      checked={checked} onChange={(e) => onChange({ kind: e.target.checked ? k : null, overrides: {} })} />
                    {k === "ENROLLMENT" ? "Inscription" : "Réinscription"}
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {ready && (
          loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (
            <div className="space-y-2 border-t border-gray-100 pt-3">
              {!classId && routeId && (
                <p className="pb-1 text-sm text-gray-400">Choisissez aussi une classe pour voir l&apos;inscription et la mensualité.</p>
              )}
              {classId && !kind && (
                <p className="pb-1 text-sm text-gray-400">
                  Cochez aussi Inscription ou Réinscription pour inclure ce frais dans le total.
                </p>
              )}
              {classId && kind && !enrollmentFee && (
                <p className="pb-1 text-sm text-warning-700">
                  Aucun frais {kind === "ENROLLMENT" ? "d'inscription" : "de réinscription"} configuré pour cette classe.
                </p>
              )}
              {classId && monthlyFee && installments.length === 0 && (
                <p className="pb-1 text-sm text-warning-700">Aucune tranche de mensualité configurée pour cette classe.</p>
              )}
              {classId && !monthlyFee && (
                <p className="pb-1 text-sm text-warning-700">Aucune mensualité configurée pour cette classe.</p>
              )}
              {routeId && route && !transportFeesQuery.loading && !transportFee && (
                <p className="pb-1 text-sm text-warning-700">Aucun tarif configuré pour ce trajet de transport.</p>
              )}
              {routeId && route && transportFee && !transportInstallmentsQuery.loading && transportInstallments.length === 0 && (
                <p className="pb-1 text-sm text-warning-700">Aucune mensualité de transport configurée pour ce trajet.</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {lines.map((l) => {
                  const checked = overrides[l.key] ?? l.defaultChecked;
                  return (
                    <label key={l.key} className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${
                      checked ? "border-brand-300 bg-brand-50" : "border-gray-200 hover:border-gray-300"
                    }`}>
                      <span className="flex min-w-0 items-center gap-2">
                        <input type="checkbox" className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600"
                          checked={checked} onChange={(e) => onChange({ overrides: { ...overrides, [l.key]: e.target.checked } })} />
                        <span className="truncate text-sm text-gray-700">{l.label}</span>
                      </span>
                      <span className={`shrink-0 text-sm font-semibold ${checked ? "text-gray-900" : "text-gray-400"}`}>{formatGNF(l.amount)}</span>
                    </label>
                  );
                })}
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-base font-semibold text-gray-900">Montant pour cet enfant</span>
                <span className="text-xl font-bold text-brand-700">{formatGNF(total)}</span>
              </div>
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
}
