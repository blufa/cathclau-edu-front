"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { listRoutes } from "@/lib/api/transport";
import {
  createFee,
  createInstallment,
  deleteFee,
  deleteInstallment,
  listFeesByTenant,
  listInstallments,
  updateFee,
} from "@/lib/api/billing";
import { FEE_TYPE_LABEL, type FeeType, type SchoolFee } from "@/lib/types/billing";
import type { Classe, Niveau } from "@/lib/types/academics";
import type { TransportRoute } from "@/lib/types/transport";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field, MoneyInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

/** Regroupement des frais par catégorie pour la liste. */
const FEE_CATEGORIES: { key: string; label: string; types: FeeType[] }[] = [
  { key: "monthly", label: "Mensualité", types: ["MONTHLY"] },
  { key: "enrollment", label: "Inscription", types: ["ENROLLMENT"] },
  { key: "reenrollment", label: "Réinscription", types: ["RE_ENROLLMENT"] },
  { key: "other", label: "Frais annexes", types: ["TRANSPORT", "CANTEEN", "EXAM", "OTHER", "PLATFORM"] },
];
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

export default function FeesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  // Lecture seule par défaut (ex. comptable) : création/modification/suppression exigent chacune leur
  // propre privilège, accordé explicitement par l'administrateur école — plus de "frais:manage" global.
  const canCreate = hasAnyPermission(user, ["frais_scolaire:create"]);
  const canUpdate = hasAnyPermission(user, ["frais_scolaire:update"]);
  const canDelete = hasAnyPermission(user, ["frais_scolaire:delete"]);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYear = years.find((y) => y.current) ?? years[0];
  const classesQuery = useQuery(
    () => (currentYear ? listClasses(currentYear.id) : Promise.resolve([])),
    [currentYear?.id],
  );
  const classLabel = useMemo(
    () => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])),
    [classesQuery.data],
  );
  const levelsQuery = useCachedQuery(tenantId ? `levels:${tenantId}` : null, listLevels, [tenantId]);
  const routesQuery = useCachedQuery(tenantId ? `routes:${tenantId}` : null, listRoutes, [tenantId]);
  const routeLabel = useMemo(
    () => new Map((routesQuery.data ?? []).map((r) => [r.id, r.name])),
    [routesQuery.data],
  );

  const feesQuery = useCachedQuery(
    tenantId ? `fees:${tenantId}` : null,
    () => listFeesByTenant(tenantId as number),
    [tenantId],
  );

  const [editing, setEditing] = useState<SchoolFee | null>(null);
  const [creating, setCreating] = useState(false);
  const [installmentsFor, setInstallmentsFor] = useState<SchoolFee | null>(null);

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  function handleDelete(f: SchoolFee) {
    confirmAction({
      title: "Supprimer le frais", message: `Supprimer ce frais ${FEE_TYPE_LABEL[f.type]} ?`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteFee(f.id); notifySuccess("Frais supprimé"); feesQuery.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Frais scolaires</h1>
          <p className="text-sm text-gray-500">Paramétrage des frais par classe et type</p>
        </div>
        {canCreate && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau frais</Button>}
      </Reveal>

      {feesQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (feesQuery.data ?? []).length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">Aucun frais configuré.</p>
      ) : (
        <div className="space-y-6">
          {FEE_CATEGORIES.map((cat) => {
            const group = (feesQuery.data ?? []).filter((f) => cat.types.includes(f.type));
            if (group.length === 0) return null;
            return (
              <FeeGroup
                key={cat.key}
                title={cat.label}
                fees={group}
                classLabel={classLabel}
                routeLabel={routeLabel}
                canUpdate={canUpdate}
                canDelete={canDelete}
                onInstallments={setInstallmentsFor}
                onEdit={setEditing}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le frais" : "Nouveau frais"} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <FeeForm
          tenantId={tenantId}
          initial={editing}
          classes={classesQuery.data ?? []}
          levels={levelsQuery.data ?? []}
          routes={routesQuery.data ?? []}
          defaultYear={currentYear?.label ?? ""}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess("Frais enregistré"); feesQuery.refetch(); }}
        />
      </Modal>

      <Modal open={!!installmentsFor} onClose={() => setInstallmentsFor(null)} title="Échéances du frais">
        {installmentsFor && <InstallmentsPanel fee={installmentsFor} canCreate={canCreate} canDelete={canDelete} />}
      </Modal>
    </div>
  );
}

/** Une catégorie de frais : table paginée (10/page) avec les actions par ligne. */
function FeeGroup({ title, fees, classLabel, routeLabel, canUpdate, canDelete, onInstallments, onEdit, onDelete }: {
  title: string;
  fees: SchoolFee[];
  classLabel: Map<number, string>;
  routeLabel: Map<number, string>;
  canUpdate: boolean;
  canDelete: boolean;
  onInstallments: (f: SchoolFee) => void;
  onEdit: (f: SchoolFee) => void;
  onDelete: (f: SchoolFee) => void;
}) {
  const PAGE = 10;
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(fees.length / PAGE);
  const slice = fees.slice(page * PAGE, page * PAGE + PAGE);
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold text-gray-700">
        {title} <span className="font-normal text-gray-400">({fees.length})</span>
      </h2>
      <Table>
        <THead><tr><TH>Libellé</TH><TH>Classe / Ligne</TH><TH>Montant</TH><TH>Année</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
        <TBody>
          {slice.map((f) => (
            <TR key={f.id}>
              <TD className="text-gray-600">{f.label ?? FEE_TYPE_LABEL[f.type]}</TD>
              <TD>
                {f.routeId != null
                  ? `Ligne : ${routeLabel.get(f.routeId) ?? `#${f.routeId}`}`
                  : f.classId != null
                    ? (classLabel.get(f.classId) ?? `#${f.classId}`)
                    : "—"}
              </TD>
              <TD className="font-medium text-gray-900">{formatGNF(f.amount)}</TD>
              <TD>{f.academicYear ?? "—"}</TD>
              <TD>
                {f.mandatory
                  ? <span className="text-xs text-gray-400">Obligatoire</span>
                  : <span className="text-xs font-medium text-amber-600">Facultatif</span>}
              </TD>
              <TD className="text-right">
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onInstallments(f)}>Échéances</Button>
                  {canUpdate && <Button size="sm" variant="ghost" onClick={() => onEdit(f)}>Modifier</Button>}
                  {canDelete && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => onDelete(f)}>Suppr.</Button>}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>
      {totalPages > 1 && (
        <div className="mt-2">
          <Pagination page={page} totalPages={totalPages} totalElements={fees.length} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}

const feeSchema = z.object({
  classId: z.string(),
  classIds: z.array(z.string()),
  routeId: z.string(),
  type: z.string(),
  amount: z.number(),
  academicYear: z.string(),
  label: z.string(),
  mandatory: z.boolean(),
}).superRefine((v, ctx) => {
  if ((v.type === "OTHER" || v.type === "PLATFORM") && !v.label.trim()) {
    ctx.addIssue({ code: "custom", path: ["label"], message: "Nom du frais requis (ex. Tenue scolaire, Frais plateforme)" });
  }
  // Le montant est saisi tranche par tranche pour les frais récurrents créés (voir TrancheBuilder) ;
  // pour les autres cas (frais ponctuel, ou modification), il reste requis ici.
  if (v.type !== "MONTHLY" && v.type !== "TRANSPORT" && v.type !== "CANTEEN" && v.amount <= 0) {
    ctx.addIssue({ code: "custom", path: ["amount"], message: "Montant requis" });
  }
});
type FeeFormValues = z.infer<typeof feeSchema>;

/** Une tranche en cours de saisie : mois librement choisis (pas forcément consécutifs) + son propre
 * montant (fixé librement par l'école — pas nécessairement une division égale d'un prix mensuel unique). */
interface TrancheDraft { monthValues: string[]; amount: number; }

/** Récapitulatif d'une tranche après génération, avec la répartition par mois pour affichage. */
interface TrancheRecap { label: string; amount: number; monthAmounts: { label: string; amount: number }[]; }

function FeeForm({ tenantId, initial, classes, levels, routes, defaultYear, onCancel, onSaved }: {
  tenantId: number; initial: SchoolFee | null; classes: Classe[]; levels: Niveau[]; routes: TransportRoute[];
  defaultYear: string; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors }, setError } = useForm<FeeFormValues>({
    resolver: zodResolver(feeSchema),
    defaultValues: {
      classId: initial?.classId != null ? String(initial.classId) : "",
      classIds: initial?.classId != null ? [String(initial.classId)] : [],
      routeId: initial?.routeId != null ? String(initial.routeId) : "",
      type: initial?.type ?? "MONTHLY",
      amount: initial ? Number(initial.amount) : 0,
      academicYear: initial?.academicYear ?? defaultYear,
      label: initial?.label ?? "",
      mandatory: initial ? initial.mandatory : true,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();
  const isTransport = v.type === "TRANSPORT";
  const isRecurring = v.type === "MONTHLY" || v.type === "TRANSPORT" || v.type === "CANTEEN";
  const showTrancheBuilder = !initial && isRecurring;

  // Un frais se définit par niveau (ex. « 11ème » ou un cycle plus large comme « Secondaire ») : cocher
  // un niveau présélectionne toutes ses classes, mais chacune reste décochable individuellement — un
  // niveau large (ex. « Secondaire » regroupant plusieurs classes/grades) peut ainsi être affiné pour
  // ne cibler que certaines d'entre elles (ex. seulement 7ème et 8ème). Le choix par classes reste
  // disponible pour partir d'une liste vide plutôt que d'un niveau.
  const [scopeMode, setScopeMode] = useState<"level" | "class">("level");
  const [selectedLevelIds, setSelectedLevelIds] = useState<string[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const classesByLevel = useMemo(() => {
    const m = new Map<string, Classe[]>();
    for (const c of classes) {
      if (c.levelId == null) continue;
      const key = String(c.levelId);
      m.set(key, [...(m.get(key) ?? []), c]);
    }
    return m;
  }, [classes]);
  // Affiché entre parenthèses à côté de chaque classe (ex. « A (CP2) ») dans la liste « Par classes
  // précises » : sans le niveau, deux classes de niveaux différents partageant la même lettre de
  // section (ex. « A ») sont impossibles à distinguer dans une longue liste.
  const levelLabelById = useMemo(() => new Map(levels.map((l) => [l.id, l.label])), [levels]);
  function toggleLevel(id: string) {
    const sectionIds = (classesByLevel.get(id) ?? []).map((c) => String(c.id));
    const checked = selectedLevelIds.includes(id);
    setSelectedLevelIds((prev) => (checked ? prev.filter((x) => x !== id) : [...prev, id]));
    setSelectedClassIds((prev) => (checked
      ? prev.filter((cid) => !sectionIds.includes(cid))
      : [...new Set([...prev, ...sectionIds])]));
  }
  function toggleLevelClass(id: string) {
    setSelectedClassIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }
  // Classes effectivement ciblées : la sélection affinée des niveaux cochés (mode niveau), ou la
  // sélection manuelle de classes (mode classe) — c'est cette liste qui alimente la création des frais.
  const effectiveClassIds = scopeMode === "level" ? selectedClassIds : v.classIds;

  // Cible(s) de la création : une ligne de transport pour un frais TRANSPORT (une ligne dessert des
  // élèves de classes différentes, le tarif dépend de la distance, pas du niveau) — une par classe
  // sélectionnée sinon.
  interface FeeTarget { classId: number | null; routeId: number | null; }
  const feeTargets: FeeTarget[] = isTransport
    ? (v.routeId ? [{ classId: null, routeId: Number(v.routeId) }] : [])
    : effectiveClassIds.map((cid) => ({ classId: Number(cid), routeId: null }));

  // Génération par tranches (§billing) : l'école propose ses tranches (1ère, 2ème, 3ème…), choisit
  // librement pour chacune les mois couverts (pas forcément consécutifs, ex. mai+juin+octobre) et
  // son propre montant — le système ne fait que répartir ce montant sur les mois pour l'affichage.
  const [genMonth, setGenMonth] = useState("");
  const [tranches, setTranches] = useState<TrancheDraft[]>([
    { monthValues: [], amount: 0 }, { monthValues: [], amount: 0 }, { monthValues: [], amount: 0 },
  ]);
  const [recap, setRecap] = useState<{ tranches: TrancheRecap[]; total: number } | null>(null);
  // Mode simple : une mensualité fixe par mois plutôt que de composer les tranches à la main.
  const [monthlyAmount, setMonthlyAmount] = useState(0);

  // Les 9 mois de l'année scolaire, calculés depuis le mois de départ — sert de liste de cases à
  // cocher, librement assignables à n'importe quelle tranche (une école peut vouloir répéter un mois
  // sur plusieurs tranches, aucune exclusivité n'est imposée).
  const schoolYearMonths = genMonth ? Array.from({ length: SCHOOL_YEAR_MONTHS }, (_, i) => addMonths(genMonth, i)) : [];

  function toggleClass(id: string) {
    const next = v.classIds.includes(id) ? v.classIds.filter((c) => c !== id) : [...v.classIds, id];
    setValue("classIds", next);
  }
  function setTranche(i: number, patch: Partial<TrancheDraft>) {
    setTranches((prev) => prev.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  }
  function toggleTrancheMonth(i: number, month: string) {
    setTranches((prev) => prev.map((t, idx) => (idx === i
      ? { ...t, monthValues: t.monthValues.includes(month) ? t.monthValues.filter((m) => m !== month) : [...t.monthValues, month] }
      : t)));
  }
  function addTranche() { setTranches((prev) => [...prev, { monthValues: [], amount: 0 }]); }
  function removeTranche(i: number) { setTranches((prev) => prev.filter((_, idx) => idx !== i)); }

  /** Compose automatiquement une tranche par mois de l'année scolaire (mensualités égales), au
   * montant saisi — l'école n'a plus qu'à choisir le mois de départ et le montant mensuel. */
  function proposeEqualMonthlyTranches() {
    if (!genMonth) return;
    setTranches(Array.from({ length: SCHOOL_YEAR_MONTHS }, (_, i) => ({ monthValues: [addMonths(genMonth, i)], amount: monthlyAmount })));
  }

  const coveredMonths = new Set(tranches.flatMap((t) => t.monthValues));
  const totalMonths = coveredMonths.size;
  const totalAmount = tranches.reduce((s, t) => s + (Number(t.amount) || 0), 0);

  /** Détail d'une tranche : son libellé (mois couverts, triés) et la répartition de son montant par mois. */
  function trancheDetail(t: TrancheDraft, index: number): TrancheRecap {
    const months = [...t.monthValues].sort();
    const perMonth = months.length > 0 ? t.amount / months.length : 0;
    const label = months.length === 0
      ? `Tranche ${index + 1}`
      : months.length === 1
        ? monthToInstallment(months[0]).label
        : `Tranche ${index + 1} (${months.map(monthShortLabel).join(", ")})`;
    return {
      label,
      amount: t.amount,
      monthAmounts: months.map((m) => ({ label: monthToInstallment(m).label, amount: perMonth })),
    };
  }

  async function submit(values: FeeFormValues) {
    if (!initial && feeTargets.length === 0) {
      if (isTransport) setError("routeId", { message: "Choisissez la ligne de transport" });
      else setError("classIds", { message: scopeMode === "level" ? "Choisissez au moins un niveau" : "Choisissez au moins une classe" });
      return;
    }
    const label = values.type === "OTHER" || values.type === "PLATFORM" ? values.label.trim() : null;
    setLoading(true);
    try {
      if (initial) {
        if (values.amount <= 0) { setError("amount", { message: "Montant requis" }); return; }
        if (isTransport && !values.routeId) { setError("routeId", { message: "Choisissez la ligne de transport" }); return; }
        await updateFee(initial.id, {
          classId: isTransport ? null : Number(values.classId),
          routeId: isTransport ? Number(values.routeId) : null,
          type: values.type as FeeType, amount: values.amount, academicYear: values.academicYear, label,
          mandatory: values.mandatory,
        });
        onSaved();
        return;
      }
      if (showTrancheBuilder) {
        if (!genMonth) { setError("amount", { message: "Choisissez le mois de départ de l'année scolaire." }); return; }
        if (tranches.some((t) => t.monthValues.length === 0 || !t.amount || t.amount <= 0)) {
          setError("amount", { message: "Chaque tranche doit couvrir au moins un mois et avoir un montant." });
          return;
        }
        // Prix mensuel de référence = moyenne sur les mois couverts (utilisé ailleurs, ex. simulation
        // du montant annuel à l'inscription) ; la facturation réelle reste au niveau de la tranche.
        const avgMonthly = totalMonths > 0 ? totalAmount / totalMonths : 0;
        const fees = await Promise.all(feeTargets.map((t) =>
          createFee({ tenantId, classId: t.classId, routeId: t.routeId, type: values.type as FeeType, amount: avgMonthly, academicYear: values.academicYear, label, mandatory: values.mandatory })));

        const trancheRecaps: TrancheRecap[] = [];
        for (const [i, t] of tranches.entries()) {
          const detail = trancheDetail(t, i);
          const months = [...t.monthValues].sort();
          const { dueDate } = monthToInstallment(months[months.length - 1]);
          await Promise.all(fees.map((fee) => createInstallment(fee.id, { label: detail.label, amount: t.amount, dueDate, months })));
          trancheRecaps.push(detail);
        }
        setRecap({ tranches: trancheRecaps, total: totalAmount });
        return; // La modale reste ouverte : le récapitulatif est affiché avant fermeture.
      }
      // Un même frais (type + montant) appliqué à plusieurs classes, ou à une ligne de transport.
      await Promise.all(feeTargets.map((t) =>
        createFee({ tenantId, classId: t.classId, routeId: t.routeId, type: values.type as FeeType, amount: values.amount, academicYear: values.academicYear, label, mandatory: values.mandatory })));
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  if (recap) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          {isTransport
            ? "Frais créé pour la ligne de transport choisie."
            : `Frais créé pour ${feeTargets.length} classe${feeTargets.length > 1 ? "s" : ""}.`} Voici les tranches générées —
          c&apos;est ce que verront les familles sur l&apos;inscription et le paiement de la scolarité.
        </p>
        <div className="space-y-3">
          {recap.tranches.map((t, i) => (
            <div key={i} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">{t.label}</span>
                <span className="text-sm font-semibold text-brand-700">{formatGNF(t.amount)}</span>
              </div>
              <div className="space-y-0.5">
                {t.monthAmounts.map((m, j) => (
                  <div key={j} className="flex justify-between text-xs text-gray-500">
                    <span className="capitalize">{m.label}</span>
                    <span>{formatGNF(m.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-sm font-semibold text-gray-700">Total annuel</span>
          <span className="text-base font-bold text-gray-900">{formatGNF(recap.total)}</span>
        </div>
        <div className="flex justify-end">
          <Button onClick={onSaved}>Terminé</Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {isTransport ? (
        <Field>
          <Label>Ligne de transport <span className="text-error-500">*</span></Label>
          <p className="mb-1.5 text-xs text-gray-400">
            Un frais transport se rattache à une ligne (le tarif dépend de la distance, pas de la classe) —
            les élèves de classes différentes abonnés à cette ligne paieront ce frais.
          </p>
          <SearchableSelect
            value={v.routeId}
            options={routes.map((r) => ({ value: String(r.id), trigger: r.name, label: r.name, searchText: r.name }))}
            onChange={(val) => setValue("routeId", val)}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucune ligne — créez-en une dans le module Transport"
          />
          {errors.routeId && <p className="text-xs text-error-600">{errors.routeId.message}</p>}
        </Field>
      ) : initial ? (
        <Field>
          <Label>Classe <span className="text-error-500">*</span></Label>
          <SearchableSelect
            value={v.classId}
            options={classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label }))}
            onChange={(val) => setValue("classId", val)}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucune classe"
          />
        </Field>
      ) : (
        <Field>
          <Label>Portée <span className="text-error-500">*</span></Label>
          <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => setScopeMode("level")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${scopeMode === "level" ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              Par niveau
            </button>
            <button type="button" onClick={() => setScopeMode("class")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${scopeMode === "class" ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              Par classes précises
            </button>
          </div>
          {scopeMode === "level" ? (
            <>
              <p className="mb-1.5 text-xs text-gray-400">
                Cocher un niveau présélectionne toutes ses classes ci-dessous — décochez celles à exclure
                (ex. « Secondaire » regroupe collège et lycée : gardez seulement 7ème et 8ème si besoin).
              </p>
              <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {levels.map((l) => {
                  const sections = classesByLevel.get(String(l.id)) ?? [];
                  const levelChecked = selectedLevelIds.includes(String(l.id));
                  return (
                    <div key={l.id}>
                      <Checkbox
                        label={`${l.label} (${sections.length} classe${sections.length > 1 ? "s" : ""})`}
                        checked={levelChecked}
                        disabled={sections.length === 0}
                        onChange={() => toggleLevel(String(l.id))}
                      />
                      {levelChecked && sections.length > 1 && (
                        <div className="ml-6 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {sections.map((c) => (
                            <Checkbox
                              key={c.id}
                              label={c.label}
                              checked={selectedClassIds.includes(String(c.id))}
                              onChange={() => toggleLevelClass(String(c.id))}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="mb-1.5 text-xs text-gray-400">Le même frais sera créé pour chaque classe cochée.</p>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-2">
                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                  {classes.map((c) => {
                    const levelLabel = c.levelId != null ? levelLabelById.get(c.levelId) : null;
                    return (
                      <div key={c.id} className="min-w-0">
                        <Checkbox
                          label={levelLabel ? `${c.label} (${levelLabel})` : c.label}
                          checked={v.classIds.includes(String(c.id))}
                          onChange={() => toggleClass(String(c.id))}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
          {errors.classIds && <p className="text-xs text-error-600">{errors.classIds.message}</p>}
        </Field>
      )}
      <Field>
        <Label>Type</Label>
        <Select value={v.type} onChange={(e) => setValue("type", e.target.value)}>
          {(Object.keys(FEE_TYPE_LABEL) as FeeType[]).map((t) => (<option key={t} value={t}>{FEE_TYPE_LABEL[t]}</option>))}
        </Select>
      </Field>
      {(v.type === "OTHER" || v.type === "PLATFORM") && (
        <Field>
          <Label>Nom du frais <span className="text-error-500">*</span></Label>
          <p className="mb-1.5 text-xs text-gray-400">
            {v.type === "PLATFORM"
              ? "Ex. Frais plateforme, Frais numérique… — le montant que vous choisissez ici sera compté dans votre solde dû à la plateforme."
              : "Ex. Tenue scolaire, Rames de papier, Bus de transport…"}
          </p>
          <Input value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
          {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
        </Field>
      )}

      {showTrancheBuilder ? (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <Field>
            <Label>Mois de départ de l&apos;année scolaire</Label>
            <p className="mb-1.5 text-xs text-gray-400">Sert à lister les {SCHOOL_YEAR_MONTHS} mois de l&apos;année ci-dessous ; chaque tranche choisit librement les siens.</p>
            <Input type="month" className="sm:w-48" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
          </Field>
          <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-2">
            <Field>
              <Label>Montant mensuel (mode simple)</Label>
              <MoneyInput className="w-36" value={monthlyAmount} onValueChange={setMonthlyAmount} />
            </Field>
            <Button type="button" variant="secondary" size="sm" disabled={!genMonth} onClick={proposeEqualMonthlyTranches}>
              Proposer {SCHOOL_YEAR_MONTHS} mensualités égales
            </Button>
            <p className="text-xs text-gray-400">Génère une tranche par mois à ce montant — ajustable ensuite ci-dessous.</p>
          </div>
          <div className="space-y-2">
            {tranches.map((t, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                <span className="w-16 shrink-0 text-sm font-medium text-gray-700">T{i + 1}</span>
                <MoneyInput className="w-36" value={t.amount} onValueChange={(n) => setTranche(i, { amount: n })} />
                <div className="flex flex-1 flex-wrap gap-x-2 gap-y-1">
                  {schoolYearMonths.map((m) => {
                    const usedElsewhere = tranches.some((other, idx) => idx !== i && other.monthValues.includes(m));
                    return (
                      <Checkbox
                        key={m}
                        label={monthShortLabel(m)}
                        checked={t.monthValues.includes(m)}
                        disabled={usedElsewhere}
                        onChange={() => toggleTrancheMonth(i, m)}
                      />
                    );
                  })}
                </div>
                <Button type="button" variant="ghost" className="text-error-600" disabled={tranches.length === 1} onClick={() => removeTranche(i)}>✕</Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" size="sm" onClick={addTranche}>+ Ajouter une tranche</Button>
            <div className="text-right text-xs">
              <p className={totalMonths === SCHOOL_YEAR_MONTHS ? "text-gray-400" : "text-warning-600"}>
                {totalMonths} / {SCHOOL_YEAR_MONTHS} mois couverts
              </p>
              <p className="font-semibold text-gray-700">Total : {formatGNF(totalAmount)}</p>
            </div>
          </div>
          {errors.amount && <p className="text-xs text-error-600">{errors.amount.message}</p>}
        </div>
      ) : (
        <Field>
          <Label>Montant</Label>
          <MoneyInput value={v.amount} onValueChange={(n) => setValue("amount", n)} />
          {errors.amount && <p className="text-xs text-error-600">{errors.amount.message}</p>}
        </Field>
      )}

      <Field>
        <Label>Année scolaire</Label>
        <Input value={v.academicYear} onChange={(e) => setValue("academicYear", e.target.value)} />
      </Field>
      <Field>
        <Checkbox
          label="Obligatoire (facturé automatiquement à l'inscription)"
          checked={v.mandatory}
          onChange={(e) => setValue("mandatory", e.target.checked)}
        />
        {!v.mandatory && (
          <p className="mt-1 text-xs text-gray-400">
            Facultatif : jamais facturé automatiquement — le comptable l&apos;ajoutera explicitement
            sur la fiche de l&apos;élève concerné s&apos;il le souhaite (ex. un paquet de RAM).
          </p>
        )}
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}

const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** À partir d'un mois "YYYY-MM", libellé "mois année" + échéance au 05 du mois suivant. */
function monthToInstallment(monthValue: string): { label: string; dueDate: string } {
  const [y, m] = monthValue.split("-").map(Number);
  const label = `${MONTHS_FR[m - 1]} ${y}`;
  let ny = y, nm = m + 1;
  if (nm > 12) { nm = 1; ny += 1; }
  return { label, dueDate: `${ny}-${String(nm).padStart(2, "0")}-05` };
}
/** Avance un mois "YYYY-MM" de n mois. */
function addMonths(monthValue: string, n: number): string {
  let [y, m] = monthValue.split("-").map(Number);
  m += n;
  while (m > 12) { m -= 12; y += 1; }
  return `${y}-${String(m).padStart(2, "0")}`;
}
function monthShortLabel(monthValue: string): string {
  const [, m] = monthValue.split("-").map(Number);
  return MONTHS_FR[m - 1];
}

const installmentSchema = z.object({
  label: z.string().trim().min(1, "Requis"),
  amount: z.number(),
  dueDate: z.string(),
});
type InstallmentFormValues = z.infer<typeof installmentSchema>;

/** Nombre de mois de l'année scolaire — sert de référence pour vérifier la répartition des tranches. */
const SCHOOL_YEAR_MONTHS = 9;

function InstallmentsPanel({ fee, canCreate, canDelete }: { fee: SchoolFee; canCreate: boolean; canDelete: boolean }) {
  const q = useQuery(() => listInstallments(fee.id), [fee.id]);
  const [adding, setAdding] = useState(false);
  // Mensualité, transport ET cantine sont des frais récurrents sur l'année scolaire (9 mois) : tous
  // profitent du générateur de tranches, pas seulement MONTHLY.
  const isRecurring = fee.type === "MONTHLY" || fee.type === "TRANSPORT" || fee.type === "CANTEEN";
  // Génération par tranches : l'école choisit le nombre de tranches et, pour chacune, les mois
  // qu'elle couvre librement (pas forcément consécutifs, ex. mai + juin + octobre).
  const [genMonth, setGenMonth] = useState("");
  const [tranches, setTranches] = useState<string[][]>([[], [], []]);
  const [generating, setGenerating] = useState(false);
  // Mode simple : une mensualité fixe par mois plutôt que de composer les tranches à la main — le
  // montant par défaut vient du frais (déjà le prix mensuel de référence), modifiable avant génération.
  const [monthlyAmount, setMonthlyAmount] = useState(Number(fee.amount) || 0);
  const { handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<InstallmentFormValues>({
    resolver: zodResolver(installmentSchema),
    defaultValues: { label: "", amount: 0, dueDate: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  const schoolYearMonths = genMonth ? Array.from({ length: SCHOOL_YEAR_MONTHS }, (_, i) => addMonths(genMonth, i)) : [];
  const totalMonths = new Set(tranches.flat()).size;

  function toggleTrancheMonth(i: number, month: string) {
    setTranches((prev) => prev.map((months, idx) => (idx === i
      ? (months.includes(month) ? months.filter((m) => m !== month) : [...months, month])
      : months)));
  }
  function addTranche() { setTranches((prev) => [...prev, []]); }
  function removeTranche(i: number) { setTranches((prev) => prev.filter((_, idx) => idx !== i)); }

  /** Compose automatiquement une tranche par mois de l'année scolaire (mensualités égales) — l'école
   * n'a plus qu'à choisir le mois de départ et le montant mensuel, sans cocher chaque mois à la main. */
  function proposeEqualMonthlyTranches() {
    if (!genMonth) { notifyError("Choisissez le mois de départ."); return; }
    setTranches(Array.from({ length: SCHOOL_YEAR_MONTHS }, (_, i) => [addMonths(genMonth, i)]));
  }

  const [manualMonth, setManualMonth] = useState("");

  async function add(values: InstallmentFormValues) {
    try {
      await createInstallment(fee.id, { label: values.label, amount: values.amount, dueDate: values.dueDate || null, months: manualMonth ? [manualMonth] : undefined });
      reset(); setManualMonth(""); setAdding(false); notifySuccess("Échéance ajoutée"); q.refetch();
    } catch (err) { notifyError(err); }
  }
  async function generateTranches() {
    if (!genMonth) { notifyError("Choisissez le mois de départ."); return; }
    if (tranches.some((months) => months.length === 0)) { notifyError("Chaque tranche doit couvrir au moins un mois."); return; }
    setGenerating(true);
    try {
      for (const [i, raw] of tranches.entries()) {
        const months = [...raw].sort();
        const { dueDate } = monthToInstallment(months[months.length - 1]);
        const label = months.length === 1
          ? monthToInstallment(months[0]).label
          : `Tranche ${i + 1} (${months.map(monthShortLabel).join(", ")})`;
        await createInstallment(fee.id, { label, amount: (Number(monthlyAmount) || 0) * months.length, dueDate, months });
      }
      notifySuccess(`${tranches.length} tranche(s) générée(s)`);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setGenerating(false); }
  }
  async function remove(id: number) {
    try { await deleteInstallment(id); notifySuccess("Échéance supprimée"); q.refetch(); } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        {isRecurring
          ? <>Montant mensuel : <strong>{formatGNF(fee.amount)}</strong> — répartissez l&apos;année scolaire ({SCHOOL_YEAR_MONTHS} mois) en tranches ci-dessous.</>
          : <>Total du frais : <strong>{formatGNF(fee.amount)}</strong> — la somme des échéances doit l&apos;égaler.</>}
      </p>

      {canCreate && isRecurring && (
        <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/40 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <Field>
              <Label>Mois de départ de l&apos;année scolaire</Label>
              <Input type="month" className="sm:w-48" value={genMonth} onChange={(e) => setGenMonth(e.target.value)} />
            </Field>
            <Field>
              <Label>Montant mensuel</Label>
              <MoneyInput className="w-36" value={monthlyAmount} onValueChange={setMonthlyAmount} />
            </Field>
            <Button type="button" variant="secondary" size="sm" disabled={!genMonth} onClick={proposeEqualMonthlyTranches}>
              Proposer {SCHOOL_YEAR_MONTHS} mensualités égales
            </Button>
          </div>
          <p className="text-xs text-gray-400">
            Génère automatiquement une tranche par mois au montant ci-dessus — ajustez ensuite
            librement (fusionner des mois, changer un montant) avant de générer.
          </p>
          <div className="space-y-2">
            {tranches.map((months, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2">
                <span className="w-16 shrink-0 text-sm text-gray-600">T{i + 1}</span>
                <span className="w-28 shrink-0 text-xs text-gray-400">= {formatGNF((Number(monthlyAmount) || 0) * (months.length || 0))}</span>
                <div className="flex flex-1 flex-wrap gap-x-2 gap-y-1">
                  {schoolYearMonths.map((m) => {
                    const usedElsewhere = tranches.some((other, idx) => idx !== i && other.includes(m));
                    return (
                      <Checkbox
                        key={m}
                        label={monthShortLabel(m)}
                        checked={months.includes(m)}
                        disabled={usedElsewhere}
                        onChange={() => toggleTrancheMonth(i, m)}
                      />
                    );
                  })}
                </div>
                <Button type="button" variant="ghost" className="text-error-600" disabled={tranches.length === 1} onClick={() => removeTranche(i)}>✕</Button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" size="sm" onClick={addTranche}>+ Ajouter une tranche</Button>
              <span className={`text-xs ${totalMonths === SCHOOL_YEAR_MONTHS ? "text-gray-400" : "text-warning-600"}`}>
                Total : {totalMonths} / {SCHOOL_YEAR_MONTHS} mois
              </span>
            </div>
            <Button onClick={generateTranches} loading={generating} disabled={!genMonth}>Générer les tranches</Button>
          </div>
        </div>
      )}

      {q.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Montant</TH><TH>Échéance</TH><TH /></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-6 text-center text-gray-400">Aucune échéance.</TD></TR>}
            {(q.data ?? []).map((i) => (
              <TR key={i.id}>
                <TD>{i.label}</TD><TD>{formatGNF(i.amount)}</TD><TD>{i.dueDate ?? "—"}</TD>
                <TD className="text-right">{canDelete && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(i.id)}>Suppr.</Button>}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      {canCreate && (adding ? (
        <form onSubmit={handleSubmit(add)} className="space-y-3 rounded-xl border border-gray-200 p-3">
          {isRecurring && (
            <Field>
              <Label>Mois</Label>
              <p className="text-xs text-gray-400">Renseigne le libellé et l&apos;échéance au 05 du mois suivant.</p>
              <Input
                type="month"
                onChange={(e) => {
                  const val = e.target.value;
                  setManualMonth(val);
                  if (!val) return;
                  const { label, dueDate } = monthToInstallment(val);
                  setValue("label", label);
                  setValue("dueDate", dueDate);
                  if (!v.amount) setValue("amount", Number(fee.amount));
                }}
              />
            </Field>
          )}
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
            {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
          </Field>
          <Field>
            <Label>Montant</Label>
            <MoneyInput value={v.amount} onValueChange={(n) => setValue("amount", n)} />
          </Field>
          <Field>
            <Label>Date limite</Label>
            <DatePicker value={v.dueDate} onChange={(val) => setValue("dueDate", val)} clearable />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setAdding(false)}>Annuler</Button>
            <Button type="submit" size="sm">Ajouter</Button>
          </div>
        </form>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>+ Ajouter une échéance</Button>
      ))}
    </div>
  );
}
