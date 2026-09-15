"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getClass, listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { enroll, reenroll, searchEnrollments, updateEnrollment, updateMonthlyPayment, updatePlatformAccess } from "@/lib/api/enrollments";
import { listFeesByClass, subscribeAnnexFee } from "@/lib/api/billing";
import { listRoutes, listStops, subscribe } from "@/lib/api/transport";
import { ApiError } from "@/lib/api/errors";
import type { Enrollment, EnrollmentType } from "@/lib/types/student";
import { DIRECTION_LABEL, type TransportDirection } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Modal } from "@/components/ui/modal";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface EnrollModalProps {
  studentId: number;
  open: boolean;
  onClose: () => void;
  /** Called with the created/updated enrollment so the caller can move on to its invoice. */
  onEnrolled: (enrollment: Enrollment) => void;
  /** When provided, the modal edits this pending enrollment instead of creating a new one. */
  enrollment?: Enrollment | null;
}

export function EnrollModal({ studentId, open, onClose, onEnrolled, enrollment }: EnrollModalProps) {
  const editing = !!enrollment;
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  // Seeded from the edited enrollment; the edit modal is mounted fresh per enrollment (keyed by render),
  // so initializers run with the right values without a setState-in-effect.
  const [selectedYearId, setSelectedYearId] = useState<number | null>(enrollment?.academicYearId ?? null);
  const [classId, setClassId] = useState(enrollment ? String(enrollment.classId) : "");
  const [type, setType] = useState<EnrollmentType>(enrollment?.type ?? "NEW");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // ── Abonnements optionnels (transport/cantine), proposés uniquement à la création. ──
  const [wantsTransport, setWantsTransport] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [stopId, setStopId] = useState("");
  const [direction, setDirection] = useState<TransportDirection>("BOTH");
  const [wantsCanteen, setWantsCanteen] = useState(false);
  // Frais annexe optionnel : accès de l'élève à la plateforme, décidé par le parent à l'inscription
  // (modifiable ensuite). Si non coché, aucun frais plateforme n'est jamais ajouté à ses mensualités.
  const [wantsPlatformAccess, setWantsPlatformAccess] = useState(enrollment?.platformAccessOptIn ?? false);
  const [wantsMonthlyPayment, setWantsMonthlyPayment] = useState(enrollment?.monthlyPaymentOptIn ?? false);
  const routesQuery = useQuery(() => (open && !editing ? listRoutes() : Promise.resolve([])), [open, editing]);
  const stopsQuery = useQuery(
    () => (routeId ? listStops(Number(routeId)) : Promise.resolve([])),
    [routeId],
  );

  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const yearId = selectedYearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (yearId ? listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => {
      const label = c.label + (c.maxCapacity != null ? ` (${c.headcount ?? 0}/${c.maxCapacity})` : "");
      return { value: String(c.id), trigger: label, label, searchText: label };
    }),
    [classes],
  );

  // ── Cascade : récupérer l'inscription précédente de l'élève pour proposer la réinscription. ──
  const historyQuery = useQuery(
    () => (open && !editing ? searchEnrollments({ studentId }) : Promise.resolve([])),
    [studentId, open, editing],
  );
  // La dernière inscription (autre que l'année en cours de saisie), de préférence validée.
  const previous = useMemo(() => {
    const past = (historyQuery.data ?? [])
      .filter((e) => e.academicYearId !== yearId)
      .sort((a, b) => (b.academicYearId - a.academicYearId) || (a.status === "VALIDATED" ? -1 : 1));
    return past[0] ?? null;
  }, [historyQuery.data, yearId]);

  const prevClassQuery = useQuery(
    () => (previous ? getClass(previous.classId) : Promise.resolve(null)),
    [previous?.classId],
  );
  const levelsQuery = useQuery(() => (previous ? listLevels() : Promise.resolve([])), [previous?.id]);

  const prevClass = prevClassQuery.data;
  const prevYearLabel = years.find((y) => y.id === previous?.academicYearId)?.label ?? "";
  const levels = levelsQuery.data ?? [];
  const prevLevel = levels.find((l) => l.id === prevClass?.levelId);
  const nextLevel = prevLevel
    ? levels.filter((l) => l.sortOrder > prevLevel.sortOrder).sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null
    : null;
  const sameLevelClass = prevClass?.levelId != null ? classes.find((c) => c.levelId === prevClass.levelId) : undefined;
  const nextLevelClass = nextLevel ? classes.find((c) => c.levelId === nextLevel.id) : undefined;

  // (5) Classe cible présélectionnée : par défaut le passage au niveau supérieur (redoublant = même
  // niveau via le bouton « Redoubler »). L'utilisateur peut toujours changer dans la liste.
  const autoTargetId = !editing && previous ? (nextLevelClass?.id ?? sameLevelClass?.id ?? null) : null;
  const effectiveClassId = classId || (autoTargetId != null ? String(autoTargetId) : "");
  const effectiveType: EnrollmentType = autoTargetId != null && !classId ? "RE_ENROLLMENT" : type;

  // Frais cantine déjà configuré pour la classe visée (§billing) — condition pour proposer l'abonnement.
  const classFeesQuery = useQuery(
    () => (open && !editing && effectiveClassId ? listFeesByClass(Number(effectiveClassId)) : Promise.resolve([])),
    [open, editing, effectiveClassId],
  );
  const canteenFee = (classFeesQuery.data ?? []).find((f) => f.type === "CANTEEN");

  // (6) Une seule inscription par élève et par année : si elle existe déjà, on grise « Inscrire ».
  const existingForYear = !editing ? (historyQuery.data ?? []).find((e) => e.academicYearId === yearId) : undefined;
  const existingClassLabel = existingForYear ? classes.find((c) => c.id === existingForYear.classId)?.label : undefined;

  /** One-click prefill: pick a class of the given level in the selected year and mark as re-enrollment. */
  function quickFill(classToSet: { id: number } | undefined) {
    if (!classToSet) return;
    setClassId(String(classToSet.id));
    setType("RE_ENROLLMENT");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (existingForYear) {
      setError("Cet élève est déjà inscrit pour cette année.");
      return;
    }
    if (!yearId || !effectiveClassId) {
      setError("Sélectionnez une année et une classe.");
      return;
    }
    if (!editing && wantsTransport && !routeId) {
      setError("Choisissez la ligne de transport, ou décochez l'abonnement.");
      return;
    }
    setSubmitting(true);
    const input = {
      studentId, classId: Number(effectiveClassId), academicYearId: yearId, type: effectiveType,
      platformAccessOptIn: wantsPlatformAccess, monthlyPaymentOptIn: wantsMonthlyPayment,
    };
    try {
      let result = editing
        ? await updateEnrollment(enrollment!.id, input)
        : await (type === "RE_ENROLLMENT" ? reenroll(input) : enroll(input));

      // En édition, le PUT ne modifie pas les choix plateforme/paiement mensuel (voir EnrollCommand
      // côté backend) : on les ajuste séparément si l'utilisateur les a changés.
      if (editing && wantsPlatformAccess !== (enrollment?.platformAccessOptIn ?? false)) {
        result = await updatePlatformAccess(enrollment!.id, wantsPlatformAccess);
      }
      if (editing && wantsMonthlyPayment !== (enrollment?.monthlyPaymentOptIn ?? false)) {
        result = await updateMonthlyPayment(enrollment!.id, wantsMonthlyPayment);
      }

      // Abonnements optionnels : l'inscription est déjà actée, un échec ici ne doit pas la remettre en
      // cause — juste informer l'utilisateur pour qu'il réessaie depuis le module concerné.
      if (!editing && wantsTransport && routeId) {
        try {
          await subscribe({
            routeId: Number(routeId), stopId: stopId ? Number(stopId) : null, studentId, direction,
          });
        } catch (err) { notifyError(err); }
      }
      if (!editing && wantsCanteen && canteenFee) {
        try {
          await subscribeAnnexFee(tenantId, studentId, canteenFee, yearId);
        } catch (err) { notifyError(err); }
      }

      setClassId("");
      notifySuccess(
        editing
          ? "Inscription modifiée"
          : type === "RE_ENROLLMENT"
            ? "Réinscription enregistrée"
            : "Inscription enregistrée",
      );
      onEnrolled(result);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Inscription impossible.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Modifier l'inscription" : "Inscrire l'élève"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {existingForYear && (
          <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Déjà inscrit{existingClassLabel ? ` en ${existingClassLabel}` : ""} pour cette année. Une seule
            inscription par année — modifiez l&apos;inscription existante en cas d&apos;erreur.
          </p>
        )}

        <Field>
          <Label htmlFor="year">Année scolaire</Label>
          <Select
            id="year"
            value={yearId ?? ""}
            onChange={(e) => {
              setSelectedYearId(e.target.value ? Number(e.target.value) : null);
              setClassId("");
            }}
          >
            {years.length === 0 && <option value="">—</option>}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.label}
                {y.current ? " (courante)" : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field>
          <Label htmlFor="class">Classe</Label>
          <SearchableSelect
            value={effectiveClassId}
            options={classOptions}
            onChange={setClassId}
            disabled={!!existingForYear}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucune classe"
          />
        </Field>

        {!editing && previous && prevClass && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-3 py-2 text-sm">
            <p className="text-slate-700">
              Dernière inscription : <span className="font-medium text-slate-900">{prevClass.label}</span>
              {prevYearLabel ? ` (${prevYearLabel})` : ""}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {nextLevelClass && (
                <Button type="button" size="sm" onClick={() => quickFill(nextLevelClass)}>
                  Passer en {nextLevelClass.label}
                </Button>
              )}
              {sameLevelClass && (
                <Button type="button" size="sm" variant="secondary" onClick={() => quickFill(sameLevelClass)}>
                  Redoubler ({sameLevelClass.label})
                </Button>
              )}
              {!nextLevelClass && !sameLevelClass && (
                <span className="text-xs text-slate-400">Aucune classe correspondante dans l&apos;année sélectionnée.</span>
              )}
            </div>
          </div>
        )}

        <Field>
          <Label htmlFor="type">Type</Label>
          <Select id="type" value={effectiveType} onChange={(e) => setType(e.target.value as EnrollmentType)} disabled={!!existingForYear}>
            <option value="NEW">Inscription (nouvel élève, jamais scolarisé ici)</option>
            <option value="RE_ENROLLMENT">Réinscription (déjà scolarisé ici auparavant)</option>
          </Select>
          {!editing && !previous && (
            <p className="mt-1 text-xs text-gray-400">
              
            </p>
          )}
        </Field>

        <div className="rounded-xl border border-gray-200 p-3">
          <Checkbox
            label="Accès de l'élève à la plateforme"
            checked={wantsPlatformAccess}
            onChange={() => setWantsPlatformAccess((v) => !v)}
          />
        </div>

        <div className="rounded-xl border border-gray-200 p-3">
          <Checkbox
            label="Ce parent règle mois par mois"
            checked={wantsMonthlyPayment}
            onChange={() => setWantsMonthlyPayment((v) => !v)}
          />
          {editing && wantsMonthlyPayment !== (enrollment?.monthlyPaymentOptIn ?? false) && (
            <p className="mt-2 text-xs text-amber-600">
              Ce changement ne s&apos;applique qu&apos;aux prochaines factures générées — les factures
              déjà émises restent en tranches. Générez de nouvelles factures de mensualité pour cet
              élève pour voir l&apos;éclatement mois par mois.
            </p>
          )}
        </div>

        {!editing && !existingForYear && (
          <div className="space-y-3 rounded-xl border border-gray-200 p-3">
            <Label>Abonnements (optionnel)</Label>

            <div className="space-y-2">
              <Checkbox
                label="Abonner au transport"
                checked={wantsTransport}
                onChange={() => setWantsTransport((v) => !v)}
                disabled={(routesQuery.data ?? []).length === 0}
              />
              {(routesQuery.data ?? []).length === 0 && (
                <p className="pl-6 text-xs text-gray-400">Aucune ligne de transport configurée.</p>
              )}
              {wantsTransport && (
                <div className="grid grid-cols-1 gap-2 pl-6 sm:grid-cols-3">
                  <Select value={routeId} onChange={(e) => { setRouteId(e.target.value); setStopId(""); }}>
                    <option value="">Ligne…</option>
                    {(routesQuery.data ?? []).map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </Select>
                  <Select value={stopId} onChange={(e) => setStopId(e.target.value)} disabled={!routeId}>
                    <option value="">Arrêt (optionnel)</option>
                    {(stopsQuery.data ?? []).map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </Select>
                  <Select value={direction} onChange={(e) => setDirection(e.target.value as TransportDirection)}>
                    {(Object.keys(DIRECTION_LABEL) as TransportDirection[]).map((d) => (
                      <option key={d} value={d}>{DIRECTION_LABEL[d]}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>

            <div>
              <Checkbox
                label="Abonner à la cantine"
                checked={wantsCanteen}
                onChange={() => setWantsCanteen((v) => !v)}
                disabled={!canteenFee}
              />
              {!canteenFee && effectiveClassId && (
                <p className="pl-6 text-xs text-gray-400">Configurez le frais cantine dans Frais scolaires pour cette classe.</p>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting} disabled={!!existingForYear}>
            {editing ? "Enregistrer" : "Inscrire"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
