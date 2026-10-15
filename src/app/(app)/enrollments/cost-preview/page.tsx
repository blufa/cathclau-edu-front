"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { listFeesByClass, listInstallments } from "@/lib/api/billing";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Reveal } from "@/components/public/reveal";
import { Spinner } from "@/components/ui/spinner";
import { formatGNF } from "@/lib/format";

type EnrollmentKind = "ENROLLMENT" | "RE_ENROLLMENT";

/**
 * Réponse rapide à "le parent demande la 7ème, il doit payer combien pour commencer ?" (§retour
 * comptable) : frais d'inscription/réinscription + 1ère tranche de mensualité pour une classe, sans
 * passer par le détour de la page Frais scolaires (deux frais séparés à recouper) ni commencer une
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

  const [classId, setClassId] = useState("");
  const [kind, setKind] = useState<EnrollmentKind | null>(null);

  const feesQuery = useQuery(() => (classId ? listFeesByClass(Number(classId)) : Promise.resolve([])), [classId]);
  const enrollmentFee = (feesQuery.data ?? []).find((f) => f.type === kind);
  const monthlyFee = (feesQuery.data ?? []).find((f) => f.type === "MONTHLY");

  const installmentsQuery = useQuery(
    () => (monthlyFee ? listInstallments(monthlyFee.id) : Promise.resolve([])),
    [monthlyFee?.id],
  );
  const firstInstallment = useMemo(() => {
    const list = installmentsQuery.data ?? [];
    return [...list].sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))[0] ?? null;
  }, [installmentsQuery.data]);

  const ready = !!classId && !!kind;
  const loading = feesQuery.loading || (!!monthlyFee && installmentsQuery.loading);
  const total = (enrollmentFee ? Number(enrollmentFee.amount) : 0) + (firstInstallment ? Number(firstInstallment.amount) : 0);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Combien pour démarrer ?</h1>
        <p className="text-sm text-gray-500">
          Choisissez une classe pour voir immédiatement le frais d&apos;inscription/réinscription et la
          1ère tranche de mensualité — de quoi répondre tout de suite à un parent, sans commencer
          d&apos;inscription.
        </p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <Field>
          <Label>Classe <span className="text-error-500">*</span></Label>
          <SearchableSelect value={classId} options={classOptions} onChange={(v) => { setClassId(v); setKind(null); }}
            triggerClassName="w-56 justify-between px-3" noResultsLabel="Aucune classe" />
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
                  checked={checked} onChange={(e) => setKind(e.target.checked ? k : null)} />
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
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-600">
                  {kind === "ENROLLMENT" ? "Frais d'inscription" : "Frais de réinscription"}
                </span>
                {enrollmentFee ? (
                  <span className="font-semibold text-gray-900">{formatGNF(enrollmentFee.amount)}</span>
                ) : (
                  <span className="text-sm text-warning-700">
                    Aucun frais {kind === "ENROLLMENT" ? "d'inscription" : "de réinscription"} configuré pour cette classe
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <span className="text-sm text-gray-600">
                  1ère tranche de mensualité{firstInstallment ? ` (${firstInstallment.label})` : ""}
                </span>
                {firstInstallment ? (
                  <span className="font-semibold text-gray-900">{formatGNF(firstInstallment.amount)}</span>
                ) : (
                  <span className="text-sm text-warning-700">Aucune mensualité configurée pour cette classe</span>
                )}
              </div>
              <div className="flex items-center justify-between pt-1">
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
