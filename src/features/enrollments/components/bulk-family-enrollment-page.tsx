"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Eye, Loader2, Plus, Trash2, UploadCloud, X, XCircle } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import type { Classe } from "@/lib/types/academics";
import { GRADE_LABEL_BY_CODE, gradeProgressionRank } from "@/lib/academics-grades";
import { createStudent } from "@/lib/api/students";
import {
  createParent, getParentStaffLink, linkParentToStudent, listParents,
  RELATIONSHIP_LABEL, type ParentStaffLink, type Relationship,
} from "@/lib/api/parents";
import { searchStaff, type StaffSearchResult } from "@/lib/api/staff";
import { suggestAddresses, suggestFirstNames, suggestLastNames } from "@/lib/api/directory";
import { enroll } from "@/lib/api/enrollments";
import {
  cancelInvoice, deleteInvoice, generateAllForEnrollment,
  grantExemption, listExemptionRules,
} from "@/lib/api/billing";
import {
  EXEMPTION_TYPE_LABEL, FEE_TYPE_LABEL, type ExemptionRule, type GeneratedFeeInvoices,
} from "@/lib/types/billing";
import type { EnrollmentType, Gender } from "@/lib/types/student";
import type { Parent } from "@/lib/types/student";
import { MultiChildInvoicesModal } from "@/features/billing/components/multi-child-invoices-modal";
import { isNetworkError } from "@/lib/api/errors";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import { useNetworkStore } from "@/lib/offline/network-store";
import {
  queueOfflineEnrollment, type QueuedChild, type QueuedParent,
} from "@/lib/offline/desktop-enrollment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Label } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { useCashierSessionGate } from "@/hooks/use-cashier-session-gate";

/** Suggestions texte débouncées (§retour comptable : prénom/nom/adresse/école déjà saisis ailleurs
 * sur la plateforme) — un seul hook partagé par tous les champs "Combobox" de cette page plutôt que
 * de répéter le même triplet state+debounce+catch à chaque champ. */
function useDebouncedSuggestions(fetchFn: (q: string) => Promise<string[]>, minLength: number) {
  const [options, setOptions] = useState<string[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function query(q: string) {
    clearTimeout(debounceRef.current);
    if (q.trim().length < minLength) { setOptions([]); return; }
    debounceRef.current = setTimeout(() => {
      fetchFn(q).then(setOptions).catch(() => setOptions([]));
    }, 300);
  }
  return [options, query] as const;
}

/** Choix obligatoire entre options mutuellement exclusives, en cartes bien visibles plutôt qu'un menu
 * déroulant avec une valeur par défaut qu'on laisse passer sans vrai choix (demande utilisateur,
 * appliqué à la fois au type Inscription/Réinscription et au sexe) — aucune cochée par défaut (`value`
 * démarre à `null`), responsive : pleine largeur, empilées, le texte passe à la ligne sur mobile au
 * lieu de déborder. */
function RequiredChoiceCards<T extends string>({ value, options, onChange, disabled, horizontal, columns }: {
  value: T | null;
  options: readonly (readonly [T, string])[];
  onChange: (v: T | null) => void;
  disabled?: boolean;
  /** Les 2 options côte à côte sur une seule rangée (ex. Sexe, Type : exactement 2 options courtes)
   * plutôt qu'empilées verticalement. */
  horizontal?: boolean;
  /** Grille à 2 colonnes au lieu d'une liste empilée — pour une liste plus longue (Lien de parenté :
   * 8 options) qu'un simple côte-à-côte ne suffit pas à raccourcir (§retour utilisateur, "je crois
   * il ne sera pas long" : 2 colonnes réduisent 8 lignes à 4). Classe Tailwind écrite en toutes
   * lettres (pas d'interpolation `grid-cols-${n}`) : le JIT de Tailwind ne génère que les classes
   * trouvées littéralement dans le code source. */
  columns?: 2;
}) {
  const layout = columns === 2
    ? "grid grid-cols-2 gap-2 pt-1"
    : horizontal ? "flex flex-col gap-2 pt-1 sm:flex-row" : "flex flex-col gap-2 pt-1";
  return (
    <div className={layout}>
      {options.map(([optValue, text]) => {
        const isChecked = value === optValue;
        return (
          <label
            key={optValue}
            className={`flex items-center gap-3 rounded-xl border-2 px-3 py-2.5 transition-colors ${horizontal && !columns ? "w-full sm:flex-1" : "w-full"} ${
              disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            } ${isChecked ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:border-gray-300"}`}
          >
            <input
              type="checkbox"
              className="h-5 w-5 shrink-0 rounded border-gray-300 text-brand-600 accent-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500/30"
              disabled={disabled}
              checked={isChecked}
              onChange={(e) => onChange(e.target.checked ? optValue : null)}
            />
            <span className={`text-sm break-words ${isChecked ? "font-semibold text-brand-900" : "font-medium text-gray-700"}`}>
              {text}
            </span>
          </label>
        );
      })}
    </div>
  );
}

// "queued" : mis en file locale automatiquement après un échec RÉSEAU (jamais un clic manuel) — sera
// synchronisé tout seul au retour de la connexion (§retour comptable, file 100% automatique).
type ChildStatus = "pending" | "creating" | "done" | "error" | "queued";

interface ChildDraft {
  key: string;
  firstName: string;
  lastName: string;
  // null tant que le comptable n'a coché ni l'une ni l'autre case (même traitement que
  // enrollmentType ci-dessous, demande utilisateur : plus de valeur par défaut qui se laisse passer).
  gender: Gender | null;
  birthDate: string;
  // Coordonnées et parcours scolaire antérieur de l'enfant (fiche identité).
  address: string;
  originSchool: string;
  previousClass: string;
  // Distingue une valeur auto-remplie (nom/adresse du parent, voir l'effet plus bas) d'une saisie
  // manuelle du comptable (§retour comptable — régression réelle : sans ce drapeau, le simple fait
  // que lastName devienne non-vide après la 1ère lettre auto-remplie bloquait tout le reste de la
  // frappe du parent, "D" restant figé alors que le parent continuait de taper "Diallo"). true dès
  // que l'utilisateur tape lui-même dans CE champ ; jamais remis à false ensuite.
  lastNameTouched: boolean;
  addressTouched: boolean;
  classId: string;
  relationship: Relationship;
  status: ChildStatus;
  error?: string;
  studentId?: number;
  // Progression persistée étape par étape (§retour comptable, poste desktop) : sans ça, un échec
  // réseau APRÈS la création de l'élève (ex. sur `enroll`) faisait tout recommencer au clic sur
  // "Réessayer les échecs", y compris `createStudent` — créant un second élève en double à chaque
  // nouvelle tentative. `processChildren` saute désormais les étapes déjà marquées faites ici.
  parentLinked?: boolean;
  enrolled?: boolean;
  exemptionApplied?: boolean;
  feesGenerated?: boolean;
  // Inscription ou réinscription (§retour comptable) : détermine quelle facture d'inscription générer
  // — jamais les deux, même si la classe a les deux frais configurés. null tant que le comptable n'a
  // coché ni l'une ni l'autre case (demande utilisateur : plus de valeur par défaut qui laisserait
  // passer un oubli — validate() bloque tant que ce n'est pas explicitement choisi).
  enrollmentType: EnrollmentType | null;
  // Exonération choisie dans le catalogue pré-configuré (§retour comptable), accordée en direct avant
  // la génération des factures pour qu'elle s'applique dès le départ. "" = aucune.
  exemptionRuleId: string;
  // Facturation mensuelle (§retour comptable) : n'a de sens que pour une exonération "avantage
  // personnel" — la retenue sur salaire du parent employé se fait chaque mois, donc la mensualité de
  // l'enfant doit être découpée en autant de factures que de mois d'école (généralement 9) pour que
  // chaque retenue corresponde à une facture précise, plutôt qu'une ou deux grosses tranches.
  monthlyPaymentOptIn: boolean;
  // Résultats affichés après traitement.
  generatedInvoices?: GeneratedFeeInvoices[];
}

function emptyChild(): ChildDraft {
  return {
    key: Math.random().toString(36).slice(2),
    firstName: "", lastName: "", gender: null, birthDate: "",
    address: "", originSchool: "", previousClass: "",
    lastNameTouched: false, addressTouched: false,
    classId: "", relationship: "FATHER",
    status: "pending",
    enrollmentType: null,
    exemptionRuleId: "", monthlyPaymentOptIn: false,
  };
}

type ParentMode = "new" | "existing" | "staff";

/**
 * Formulaire unifié d'inscription (§retour comptable, refonte inscription) : crée (ou réutilise) un
 * parent — y compris en le liant à une fiche personnel existante pour que la remise personnel se
 * déclenche automatiquement — puis crée + rattache + inscrit un ou plusieurs enfants, avec transport,
 * cantine et exonération directement sur la fiche de chaque enfant, et génère en un seul geste toutes
 * les factures de leur classe. Chaque enfant a son propre statut ; un échec sur l'un n'annule jamais
 * les autres, et seuls les enfants en échec peuvent être relancés.
 */
export default function BulkFamilyEnrollmentPage() {
  const { user } = useAuth();
  // ── Parent ──────────────────────────────────────────────────────────────
  const [parentMode, setParentMode] = useState<ParentMode>("new");
  const [parentSearch, setParentSearch] = useState("");
  const allParentsQuery = useQuery(() => listParents(), []);
  const parentSuggestions = useMemo(() => {
    const q = parentSearch.trim().toLowerCase();
    if (!q) return [];
    return (allParentsQuery.data ?? [])
      .filter((p) => `${p.firstName} ${p.lastName} ${p.phone ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allParentsQuery.data, parentSearch]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [newParent, setNewParent] = useState({ firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "" });
  // Suggestions prénom/nom/adresse déjà saisis pour un autre élève ou parent de l'école (§retour
  // comptable) — même source que pour l'enfant ci-dessous (ChildCard), un nom ou une adresse déjà
  // connue de l'école vaut aussi bien pour le parent que pour l'enfant.
  const [parentFirstNameOptions, fetchParentFirstNames] = useDebouncedSuggestions(suggestFirstNames, 2);
  const [parentLastNameOptions, fetchParentLastNames] = useDebouncedSuggestions(suggestLastNames, 2);
  const [parentAddressOptions, fetchParentAddresses] = useDebouncedSuggestions(suggestAddresses, 2);

  // Lier comme personnel (§5.5) : recherche croisée enseignant/employé, pré-remplit nom/téléphone et
  // mémorise son userId — indispensable pour que la détection automatique de la remise personnel
  // fonctionne ensuite (même userId partagé que la fiche Teacher/Employee).
  const [staffSearch, setStaffSearch] = useState("");
  const [selectedStaff, setSelectedStaff] = useState<StaffSearchResult | null>(null);
  const staffSuggestionsQuery = useQuery(
    () => (staffSearch.trim().length >= 2 ? searchStaff(staffSearch.trim()) : Promise.resolve([])),
    [staffSearch],
  );

  // Une fois le parent résolu (sélectionné ou créé), vérifie s'il est déjà lié au personnel — utile
  // même pour un parent existant choisi par recherche, pas seulement pour le mode "Personnel".
  const staffLinkQuery = useQuery<ParentStaffLink | null>(
    () => (selectedParent ? getParentStaffLink(selectedParent.id) : Promise.resolve(null)),
    [selectedParent?.id],
  );
  // Le système détecte déjà tout seul un parent lié au personnel (mode "Personnel de l'école" OU
  // parent existant retrouvé par recherche, voir staffLinkQuery ci-dessus) — la mensualisation
  // (§retour comptable) doit donc se proposer dans les deux cas, pas seulement quand une exonération
  // "avantage personnel" est en plus explicitement choisie dans la liste déroulante.
  const isStaffParent = parentMode === "staff" ? !!selectedStaff : !!staffLinkQuery.data;

  // Suggestion nom de famille / adresse (§retour comptable) : dans la grande majorité des familles,
  // les enfants portent le même nom et vivent à la même adresse que le parent déjà saisi — on la
  // propose automatiquement sur chaque enfant, mais seulement tant que SON champ est resté vide :
  // une suggestion que le comptable peut toujours écraser (tuteur, enfant d'un autre nom...), jamais
  // une valeur imposée.
  const resolvedParentLastName = (parentMode === "existing" ? selectedParent?.lastName : newParent.lastName)?.trim() || "";
  const resolvedParentAddress = (parentMode === "existing" ? selectedParent?.address : newParent.address)?.trim() || "";

  // ── Année scolaire / classes ────────────────────────────────────────────
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])), [effectiveYearId]);
  // Ordre croissant par niveau (PS, MS, GS, 1ère année, 2ème année...) plutôt que l'ordre de création
  // en base — voir GRADE_PROGRESSION (progression canonique partagée avec la réinscription). Les
  // classes sans grade reconnu (nomenclature maison) sont reléguées en fin de liste, triées par libellé.
  const classes = useMemo(() => {
    const rank = (c: Classe) => {
      const label = c.grade ? GRADE_LABEL_BY_CODE[c.grade] : null;
      const r = label ? gradeProgressionRank(label) : -1;
      return r === -1 ? Number.MAX_SAFE_INTEGER : r;
    };
    return [...(classesQuery.data ?? [])].sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
  }, [classesQuery.data]);

  // Types d'exonération pré-configurés — partagés entre tous les enfants (§retour comptable).
  const exemptionRulesQuery = useQuery(() => listExemptionRules(), []);
  const activeExemptionRules = (exemptionRulesQuery.data ?? []).filter((r) => r.active);

  // ── Enfants ─────────────────────────────────────────────────────────────
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild()]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  // Relecture obligatoire avant soumission (§retour comptable — le comptable se trompe souvent de
  // type Inscription/Réinscription, ou oublie une exonération fratrie/personnel) : le bouton
  // "Inscrire" ouvre d'abord ce récapitulatif, `submit()` n'est déclenché que depuis la modale.
  const [reviewOpen, setReviewOpen] = useState(false);

  // Barrière caisse (§retour comptable) : une nouvelle inscription s'accompagne presque toujours d'un
  // encaissement immédiat des frais au guichet — même garde que pour "Dépenses"/"Encaisser" (voir
  // PayInvoiceForm). Ignorée hors-ligne : sans réseau on ne peut de toute façon pas vérifier l'état de
  // la caisse, et l'inscription part alors dans la file d'attente de synchronisation (queueOfflineEnrollment)
  // plutôt que d'être bloquée.
  const online = useNetworkStore((s) => s.online);
  const { sessionOpen, loading: sessionLoading } = useCashierSessionGate();
  const cashierBlocked = online && !sessionLoading && !sessionOpen;

  // Repart d'un formulaire vierge une fois l'encaissement terminé (popup fermé) — le comptable peut
  // enchaîner une nouvelle famille sans quitter la page ni garder les enfants déjà traités affichés.
  function resetForm() {
    setParentMode("new");
    setParentSearch("");
    setSelectedParent(null);
    setNewParent({ firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "" });
    setStaffSearch("");
    setSelectedStaff(null);
    setChildren([emptyChild()]);
    setRunning(false);
    setFinished(false);
    autoOpenedRef.current = false;
  }

  function updateChild(key: string, patch: Partial<ChildDraft>) {
    setChildren((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function addChild() {
    setChildren((cs) => [...cs, { ...emptyChild(), lastName: resolvedParentLastName, address: resolvedParentAddress }]);
  }
  function removeChild(key: string) {
    setChildren((cs) => (cs.length > 1 ? cs.filter((c) => c.key !== key) : cs));
  }

  // L'enfant présent dès l'arrivée sur la page (avant tout clic sur "Ajouter un enfant") est créé
  // AVANT que le parent ne soit renseigné — sans cet effet, lui seul resterait vide tant qu'on ne le
  // retouche pas, contrairement à tout enfant ajouté ensuite (déjà prérempli par `addChild` ci-dessus).
  // Condition sur `*Touched` (saisie manuelle du comptable), PAS sur le champ vide/non-vide :
  // régression réelle, en testant `!c.lastName.trim()`, une fois la 1ère lettre auto-remplie le
  // champ n'était plus "vide" et l'effet s'arrêtait de suivre la frappe du parent — "D" restait figé
  // alors que le parent continuait de taper "Diallo".
  useEffect(() => {
    if (!resolvedParentLastName && !resolvedParentAddress) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChildren((cs) => cs.map((c) => {
      if (c.status !== "pending") return c;
      const patch: Partial<ChildDraft> = {};
      if (resolvedParentLastName && !c.lastNameTouched) patch.lastName = resolvedParentLastName;
      if (resolvedParentAddress && !c.addressTouched) patch.address = resolvedParentAddress;
      return Object.keys(patch).length > 0 ? { ...c, ...patch } : c;
    }));
  }, [resolvedParentLastName, resolvedParentAddress]);

  function validate(): string | null {
    if (parentMode === "existing" && !selectedParent) return "Sélectionnez un parent existant.";
    if (parentMode === "staff" && !selectedStaff) return "Recherchez et sélectionnez un membre du personnel.";
    if ((parentMode === "new" || parentMode === "staff")
      && (!newParent.firstName.trim() || !newParent.lastName.trim() || !newParent.phone.trim())) {
      return "Prénom, nom et téléphone du parent sont requis.";
    }
    if (!effectiveYearId) return "Sélectionnez une année scolaire.";
    for (const c of children) {
      if (!c.firstName.trim() || !c.lastName.trim() || !c.classId) {
        return "Chaque enfant doit avoir un prénom, un nom et une classe.";
      }
      if (!c.enrollmentType) {
        return "Chaque enfant doit avoir un type (Inscription ou Réinscription).";
      }
      if (!c.gender) {
        return "Chaque enfant doit avoir un sexe (Garçon ou Fille).";
      }
    }
    return null;
  }

  /** Construit l'enfant tel qu'il doit être mis en file (progression déjà accomplie comprise) —
   * utilisé aussi bien pour une mise en file "à froid" (aucune étape tentée) que pour un enfant
   * interrompu en cours de route (voir `processChildren`). */
  function toQueuedChild(child: ChildDraft, progress: Partial<QueuedChild> = {}): QueuedChild {
    const rule = child.exemptionRuleId ? activeExemptionRules.find((r) => String(r.id) === child.exemptionRuleId) : undefined;
    return {
      key: child.key,
      firstName: child.firstName.trim(), lastName: child.lastName.trim(), gender: child.gender!, // non-null : voir validate()
      birthDate: child.birthDate || null, address: child.address.trim() || null,
      originSchool: child.originSchool.trim() || null, previousClass: child.previousClass.trim() || null,
      classId: Number(child.classId), relationship: child.relationship,
      // Non-null : validate() refuse déjà toute soumission tant qu'un enfant n'a pas de type choisi.
      enrollmentType: child.enrollmentType!, monthlyPaymentOptIn: child.monthlyPaymentOptIn,
      exemption: rule ? {
        type: rule.type, percentage: rule.percentage != null ? Number(rule.percentage) : null,
        amount: rule.amount != null ? Number(rule.amount) : null,
        feeTypes: rule.feeTypes && rule.feeTypes.length > 0 ? rule.feeTypes : null,
        reason: rule.label, staffBenefit: rule.staffBenefit,
      } : null,
      studentId: child.studentId ?? null, parentLinked: child.parentLinked ?? false,
      enrolled: child.enrolled ?? false, exemptionApplied: child.exemptionApplied ?? false,
      feesGenerated: child.feesGenerated ?? false,
      done: false,
      ...progress,
    };
  }

  /** Traite les enfants dont le statut n'est pas encore "done" — permet de relancer seulement les
   * enfants en échec après un premier passage partiel, sans jamais recréer un enfant déjà réussi.
   * RÉSUMABLE étape par étape (§retour comptable, poste desktop hors-ligne) : chaque étape persiste
   * son résultat dans `ChildDraft` (via `updateChild`) dès qu'elle réussit, et est sautée si elle l'a
   * déjà été lors d'une tentative précédente. Toute erreur RÉSEAU (jamais une erreur métier) bascule
   * automatiquement l'enfant en file locale (`queueOfflineEnrollment`) — AUCUN clic manuel requis, la
   * synchro du poste desktop la rejouera tout seule dès le retour du réseau (§retour comptable, file
   * "100% automatique" demandée explicitement). */
  async function processChildren(parentId: number, targets: ChildDraft[]) {
    const toQueue: QueuedChild[] = [];
    for (const child of targets) {
      updateChild(child.key, { status: "creating", error: undefined });
      // Progression locale à CETTE tentative (pas la seule React state, qui reste figée sur l'ancienne
      // valeur dans cette même itération) — permet de construire un instantané exact de l'enfant au
      // moment précis où une coupure réseau surviendrait, quelle que soit l'étape en cours.
      let studentId = child.studentId ?? null;
      let parentLinked = child.parentLinked ?? false;
      let enrolled = child.enrolled ?? false;
      let exemptionApplied = child.exemptionApplied ?? false;
      let feesGenerated = child.feesGenerated ?? false;
      let generatedInvoices: GeneratedFeeInvoices[] = child.generatedInvoices ?? [];
      let needsQueue = false;

      try {
        if (studentId == null) {
          const student = await createStudent({
            firstName: child.firstName.trim(), lastName: child.lastName.trim(),
            gender: child.gender!, birthDate: child.birthDate || null, // non-null : voir validate()
            address: child.address.trim() || null,
            originSchool: child.originSchool.trim() || null, previousClass: child.previousClass.trim() || null,
          });
          studentId = student.id;
          updateChild(child.key, { studentId });
        }

        if (!parentLinked) {
          await linkParentToStudent(parentId, studentId, child.relationship);
          parentLinked = true;
          updateChild(child.key, { parentLinked: true });
        }

        if (!enrolled) {
          await enroll({
            studentId, classId: Number(child.classId), academicYearId: effectiveYearId!,
            type: child.enrollmentType!, monthlyPaymentOptIn: child.monthlyPaymentOptIn, // non-null : voir validate()
          });
          enrolled = true;
          updateChild(child.key, { enrolled: true });
        }

        // Exonération accordée AVANT la génération des factures (point 12/23) — pour qu'elle
        // s'applique dès la première facture, jamais après coup. Choisie dans le catalogue
        // pré-configuré (§retour comptable) : rien à ressaisir, juste le type sélectionné.
        if (child.exemptionRuleId && !exemptionApplied) {
          const rule = activeExemptionRules.find((r) => String(r.id) === child.exemptionRuleId);
          if (rule) {
            try {
              await grantExemption({
                studentId,
                type: rule.type,
                percentage: rule.percentage != null ? Number(rule.percentage) : null,
                amount: rule.amount != null ? Number(rule.amount) : null,
                feeTypes: rule.feeTypes && rule.feeTypes.length > 0 ? rule.feeTypes : null,
                reason: rule.label,
                staffBenefit: rule.staffBenefit,
              });
              exemptionApplied = true;
              updateChild(child.key, { exemptionApplied: true });
            } catch (err) {
              if (isNetworkError(err) && isDesktop()) needsQueue = true;
              else notifyError(err);
            }
          }
        }

        // Transport : retiré de l'inscription (§retour comptable) — l'abonnement se fait désormais
        // uniquement après coup, dans le popup d'encaissement (StudentInvoicesPanel), pour éviter le
        // doublon avec cet écran.

        // Génère en un seul appel toutes les factures des frais de la classe (inscription OU
        // réinscription selon le type choisi — jamais les deux —, mensualité, cantine si configurée,
        // examen...) — aucune remise recalculée ici, déjà appliquée côté serveur.
        if (!feesGenerated) {
          try {
            generatedInvoices = await generateAllForEnrollment({
              studentId, classId: Number(child.classId), academicYearId: effectiveYearId!,
              enrollmentType: child.enrollmentType!, wantsTransport: false, transportFeeId: null, // non-null : voir validate()
            });
            feesGenerated = true;
            updateChild(child.key, { feesGenerated: true });
          } catch (err) {
            if (isNetworkError(err) && isDesktop()) needsQueue = true;
            else notifyError(err);
          }
        }

        if (needsQueue) {
          toQueue.push(toQueuedChild(child, {
            studentId, parentLinked, enrolled, exemptionApplied, feesGenerated,
          }));
          updateChild(child.key, { status: "queued", studentId, generatedInvoices });
        } else {
          updateChild(child.key, { status: "done", studentId, generatedInvoices });
        }
      } catch (err) {
        if (isNetworkError(err) && isDesktop()) {
          toQueue.push(toQueuedChild(child, {
            studentId, parentLinked, enrolled, exemptionApplied, feesGenerated,
          }));
          updateChild(child.key, { status: "queued" });
        } else {
          updateChild(child.key, { status: "error", error: err instanceof Error ? err.message : "Échec" });
        }
      }
    }

    if (toQueue.length > 0) {
      await queueOfflineEnrollment(user?.tenantId ?? 0, effectiveYearId ?? 0, { id: parentId }, toQueue);
      notifySuccess(
        toQueue.length === 1
          ? "Hors ligne : 1 enfant mis en attente, sera synchronisé automatiquement au retour du réseau"
          : `Hors ligne : ${toQueue.length} enfants mis en attente, seront synchronisés automatiquement au retour du réseau`,
      );
    }
  }

  async function submit() {
    const validationError = validate();
    if (validationError) { notifyError(validationError); return; }
    setRunning(true);
    setFinished(false);
    try {
      const targets = children.filter((c) => c.status !== "done" && c.status !== "queued");
      const needsParentCreation = (parentMode === "new" || parentMode === "staff") && selectedParent == null;

      // Hors ligne dès le départ (§retour comptable) : jamais de tentative réseau vouée à l'échec —
      // toute la soumission (parent à créer si besoin + tous les enfants) part directement en file,
      // synchronisée automatiquement dès le retour du réseau, sans clic supplémentaire.
      if (isDesktop() && !useNetworkStore.getState().online) {
        const parentPayload: QueuedParent = needsParentCreation
          ? {
              id: null, firstName: newParent.firstName.trim(), lastName: newParent.lastName.trim(),
              phone: newParent.phone.trim() || null, email: newParent.email.trim() || null,
              occupation: newParent.occupation.trim() || null, address: newParent.address.trim() || null,
              staffUserId: parentMode === "staff" ? (selectedStaff?.userId ?? null) : null,
              staffType: parentMode === "staff" && selectedStaff?.userId == null ? (selectedStaff?.staffType ?? null) : null,
              staffId: parentMode === "staff" && selectedStaff?.userId == null ? (selectedStaff?.staffId ?? null) : null,
            }
          : { id: selectedParent?.id ?? null };
        await queueOfflineEnrollment(user?.tenantId ?? 0, effectiveYearId ?? 0, parentPayload, targets.map((c) => toQueuedChild(c)));
        targets.forEach((c) => updateChild(c.key, { status: "queued" }));
        notifySuccess("Hors ligne : inscription mise en attente, sera synchronisée automatiquement au retour du réseau");
        return;
      }

      let parentId = selectedParent?.id ?? null;
      if (needsParentCreation) {
        try {
          // Personnel SANS compte de connexion (ex. pas de smartphone Android) : lien direct
          // staffType/staffId au lieu du userId partagé — la prise en charge/retenue sur salaire
          // continue de fonctionner (voir StaffChildBenefitService#isStaffChild).
          const staffForLink = parentMode === "staff" ? selectedStaff : null;
          const created = await createParent({
            firstName: newParent.firstName.trim(), lastName: newParent.lastName.trim(),
            phone: newParent.phone.trim() || null, email: newParent.email.trim() || null,
            occupation: newParent.occupation.trim() || null, address: newParent.address.trim() || null,
          }, staffForLink?.userId ?? null,
          staffForLink && staffForLink.userId == null ? staffForLink.staffType : null,
          staffForLink && staffForLink.userId == null ? staffForLink.staffId : null);
          parentId = created.id;
          setSelectedParent(created);
          setParentMode("existing");
        } catch (err) {
          if (isNetworkError(err) && isDesktop()) {
            // Le réseau était présumé disponible mais la création du parent échoue quand même (coupure
            // pile à ce moment) : même repli qu'une coupure détectée d'avance, ci-dessus.
            const parentPayload: QueuedParent = {
              id: null, firstName: newParent.firstName.trim(), lastName: newParent.lastName.trim(),
              phone: newParent.phone.trim() || null, email: newParent.email.trim() || null,
              occupation: newParent.occupation.trim() || null, address: newParent.address.trim() || null,
              staffUserId: parentMode === "staff" ? (selectedStaff?.userId ?? null) : null,
              staffType: parentMode === "staff" && selectedStaff?.userId == null ? (selectedStaff?.staffType ?? null) : null,
              staffId: parentMode === "staff" && selectedStaff?.userId == null ? (selectedStaff?.staffId ?? null) : null,
            };
            await queueOfflineEnrollment(user?.tenantId ?? 0, effectiveYearId ?? 0, parentPayload, targets.map((c) => toQueuedChild(c)));
            targets.forEach((c) => updateChild(c.key, { status: "queued" }));
            notifySuccess("Hors ligne : inscription mise en attente, sera synchronisée automatiquement au retour du réseau");
            return;
          }
          throw err;
        }
      }
      if (parentId == null) throw new Error("Parent introuvable");
      await processChildren(parentId, targets);
    } catch (err) {
      notifyError(err);
    } finally {
      setRunning(false);
      setFinished(true);
    }
  }

  async function retryFailed() {
    const parentId = selectedParent?.id;
    if (parentId == null) return;
    setRunning(true);
    try {
      await processChildren(parentId, children.filter((c) => c.status === "error"));
    } finally {
      setRunning(false);
    }
  }

  /** Supprime une facture générée par erreur — suppression physique si aucun paiement n'a encore été
   * effectué dessus, sinon annulation (garde l'historique), voir §retour comptable point ouvert. */
  async function deleteGeneratedInvoice(childKey: string, feeId: number, invoiceId: number, paidAmount: string | null) {
    try {
      if (!paidAmount || Number(paidAmount) === 0) await deleteInvoice(invoiceId);
      else await cancelInvoice(invoiceId);
      setChildren((cs) => cs.map((c) => {
        if (c.key !== childKey || !c.generatedInvoices) return c;
        return {
          ...c,
          generatedInvoices: c.generatedInvoices
            .map((g) => (g.fee.id === feeId ? { ...g, invoices: g.invoices.filter((i) => i.id !== invoiceId) } : g))
            .filter((g) => g.invoices.length > 0),
        };
      }));
      notifySuccess("Facture supprimée");
    } catch (err) { notifyError(err); }
  }

  const doneCount = children.filter((c) => c.status === "done").length;
  const queuedCount = children.filter((c) => c.status === "queued").length;
  const errorCount = children.filter((c) => c.status === "error").length;
  // "queued" compte comme réglé pour l'utilisateur (rien d'autre à faire, la synchro s'en charge
  // automatiquement) — seule une vraie erreur métier ("error") appelle encore un geste manuel.
  const allSettled = children.every((c) => c.status === "done" || c.status === "queued");
  // Enfants réellement inscrits en ligne (status "done", studentId connu) : seuls ceux-là ont des
  // factures immédiatement consultables côté serveur — un enfant "queued" (hors-ligne) n'existe pas
  // encore côté serveur, impossible d'y encaisser quoi que ce soit avant la synchronisation.
  const classLabelById = new Map(classes.map((c) => [c.id, c.label]));
  const collectableStudents = children
    .filter((c): c is ChildDraft & { studentId: number } => c.status === "done" && c.studentId != null)
    .map((c) => {
      const classId = c.classId ? Number(c.classId) : null;
      return { id: c.studentId, name: `${c.firstName} ${c.lastName}`, classId, className: classId ? classLabelById.get(classId) ?? null : null };
    });
  const [showCollect, setShowCollect] = useState(false);
  // Ouvre le popup d'encaissement automatiquement dès que l'inscription se termine — le comptable n'a
  // plus à chercher chaque élève dans la liste pour encaisser. Ref (pas juste la condition) pour ne
  // l'ouvrir qu'UNE fois : sans elle, re-fermer le popup pendant que `finished` reste vrai le rouvrirait
  // aussitôt au prochain rendu.
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (finished && allSettled && collectableStudents.length > 0 && !autoOpenedRef.current) {
      autoOpenedRef.current = true;
      setShowCollect(true);
    }
  }, [finished, allSettled, collectableStudents.length]);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Nouvelle inscription</h1>
        <p className="text-sm text-gray-500">
          Créez le parent une seule fois, puis inscrivez un ou plusieurs enfants d&apos;un coup, même
          dans des classes différentes — factures générées automatiquement.
        </p>
      </Reveal>

      <Card>
        <CardHeader><CardTitle>Parent</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 max-w-md">
            {([
              ["new", "Nouveau parent"], ["existing", "Parent existant"], ["staff", "Personnel de l'école"],
            ] as const).map(([m, label]) => (
              <button
                key={m}
                type="button"
                disabled={running || finished}
                onClick={() => setParentMode(m)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  parentMode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {parentMode === "staff" && (
            <div className="space-y-2">
              {selectedStaff ? (
                <div className="flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50/40 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedStaff.fullName}</p>
                    <p className="text-xs text-gray-400">{selectedStaff.phone ?? "—"} · {selectedStaff.staffType === "TEACHER" ? "Enseignant" : "Personnel"}</p>
                  </div>
                  {!running && !finished && (
                    <Button size="sm" variant="ghost" onClick={() => { setSelectedStaff(null); setNewParent({ firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "" }); }}>
                      Changer
                    </Button>
                  )}
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Rechercher un enseignant/employé par nom…"
                    value={staffSearch}
                    onChange={(e) => setStaffSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-56 space-y-1 overflow-auto">
                    {staffSuggestionsQuery.loading && <div className="flex justify-center py-3"><Spinner /></div>}
                    {(staffSuggestionsQuery.data ?? []).map((s) => (
                      <div key={`${s.staffType}-${s.staffId}`} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                          <p className="text-xs text-gray-400">
                            {s.phone ?? "—"} · {s.staffType === "TEACHER" ? "Enseignant" : "Personnel"}
                            {s.userId == null && <span className="ml-1 text-amber-600">· Sans compte</span>}
                          </p>
                        </div>
                        <Button size="sm" onClick={() => {
                          setSelectedStaff(s);
                          const [firstName, ...rest] = s.fullName.split(" ");
                          setNewParent({ firstName: firstName ?? "", lastName: rest.join(" "), phone: s.phone ?? "", email: "", occupation: "", address: "" });
                        }}>
                          Choisir
                        </Button>
                      </div>
                    ))}
                    {staffSearch.trim().length >= 2 && !staffSuggestionsQuery.loading && (staffSuggestionsQuery.data ?? []).length === 0 && (
                      <p className="text-sm text-gray-400">Aucun résultat.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {(parentMode === "new" || (parentMode === "staff" && selectedStaff)) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field>
                <Label>Prénom <span className="text-error-500">*</span></Label>
                <Combobox
                  disabled={running || finished}
                  value={newParent.firstName}
                  options={parentFirstNameOptions}
                  onChange={(val) => { setNewParent({ ...newParent, firstName: val }); fetchParentFirstNames(val); }}
                />
              </Field>
              <Field>
                <Label>Nom <span className="text-error-500">*</span></Label>
                <Combobox
                  disabled={running || finished}
                  value={newParent.lastName}
                  options={parentLastNameOptions}
                  onChange={(val) => { setNewParent({ ...newParent, lastName: val }); fetchParentLastNames(val); }}
                />
              </Field>
              <PhoneInput label={<>Téléphone <span className="text-error-500">*</span></>} value={newParent.phone} onChange={(v) => setNewParent({ ...newParent, phone: v })} />
              <Field>
                <Label>Profession (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.occupation} onChange={(e) => setNewParent({ ...newParent, occupation: e.target.value })} />
              </Field>
              <Field>
                <Label>Adresse (optionnel)</Label>
                <Combobox
                  disabled={running || finished}
                  value={newParent.address}
                  options={parentAddressOptions}
                  onChange={(val) => { setNewParent({ ...newParent, address: val }); fetchParentAddresses(val); }}
                />
              </Field>
            </div>
          ) : parentMode === "existing" ? (
            <div className="space-y-2">
              {selectedParent ? (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedParent.firstName} {selectedParent.lastName}</p>
                    <p className="text-xs text-gray-400">{selectedParent.phone ?? selectedParent.email ?? "—"}</p>
                  </div>
                  {!running && !finished && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedParent(null)}>Changer</Button>
                  )}
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Rechercher (nom, téléphone, email)…"
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-56 space-y-1 overflow-auto">
                    {allParentsQuery.loading && <div className="flex justify-center py-3"><Spinner /></div>}
                    {parentSuggestions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-gray-400">{p.phone ?? p.email ?? "—"}</p>
                        </div>
                        <Button size="sm" onClick={() => setSelectedParent(p)}>Choisir</Button>
                      </div>
                    ))}
                    {parentSearch.trim() && !allParentsQuery.loading && parentSuggestions.length === 0 && (
                      <p className="text-sm text-gray-400">Aucun parent trouvé.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : null}

          {selectedParent && staffLinkQuery.data && (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
              Ce parent est aussi {staffLinkQuery.data.staffType === "TEACHER" ? "enseignant" : "membre du personnel"} de
              l&apos;école — pensez à choisir une exonération « Avantage personnel » sur chaque enfant
              concerné, ci-dessous, pour appliquer la retenue sur salaire.
            </p>
          )}
        </CardBody>
      </Card>

      {/* overflow-visible (au lieu du overflow-hidden par défaut de Card) : sans ça, la liste déroulante
          "Exonération" (positionnée en `absolute` sous son champ, voir SearchableSelect) est rognée dès
          qu'elle s'ouvre près du bas de cette carte — typique du dernier enfant de la liste, dont les
          derniers champs sont proches du bord inférieur. Rien d'autre dans cette carte ne dépend du
          rognage (pas d'image/couleur qui déborderait des coins arrondis), donc aucun effet de bord. */}
      <Card className="overflow-visible">
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Enfants ({children.length})</CardTitle>
          <div className="w-56">
            <Select disabled={running || finished} value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
              {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
            </Select>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {/* La liste "Exonération" sur chaque enfant ci-dessous reste silencieusement vide dans les
              DEUX cas suivants (indiscernables sans ce bandeau, §retour comptable — "je ne vois pas
              charger les exonérations") : l'appel réseau a échoué, OU aucun type n'a jamais été
              configuré pour cette école (catalogue propre à chaque tenant, voir ExemptionRuleController). */}
          {exemptionRulesQuery.error && (
            <p className="rounded-lg bg-error-50 px-3 py-2 text-xs text-error-700">
              Impossible de charger les types d&apos;exonération (problème réseau). Rechargez la page —
              si le problème persiste, contactez le support.
            </p>
          )}
          {!exemptionRulesQuery.loading && !exemptionRulesQuery.error && activeExemptionRules.length === 0 && (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-800">
              Aucun type d&apos;exonération n&apos;est configuré pour cette école. Si un enfant doit en
              bénéficier, demandez à la direction d&apos;en créer un (Facturation → Règles de
              facturation) avant de continuer l&apos;inscription.
            </p>
          )}
          {children.map((child, i) => (
            <ChildCard
              key={child.key}
              child={child}
              index={i}
              classes={classes}
              exemptionRules={activeExemptionRules}
              canRemove={children.length > 1}
              running={running}
              isStaffParent={isStaffParent}
              onUpdate={(patch) => updateChild(child.key, patch)}
              onRemove={() => removeChild(child.key)}
              onDeleteInvoice={(feeId, invoiceId, paidAmount) => deleteGeneratedInvoice(child.key, feeId, invoiceId, paidAmount)}
            />
          ))}

          {!running && !finished && (
            <Button variant="secondary" onClick={addChild} leftSection={<Plus className="h-4 w-4" />}>
              Ajouter un enfant
            </Button>
          )}
        </CardBody>
      </Card>

      {cashierBlocked && !finished && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Caisse fermée : ouvrez votre caisse (menu « Session de caisse ») avant d&apos;inscrire — les frais se règlent au guichet au moment de l&apos;inscription.
        </p>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {finished && (
            <span>
              {doneCount} / {children.length} enfant(s) inscrit(s) avec succès
              {queuedCount > 0 && (
                <span className="text-amber-600"> — {queuedCount} en attente de synchronisation (automatique)</span>
              )}
              {errorCount > 0 && <span className="text-error-600"> — {errorCount} en échec</span>}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {finished && errorCount > 0 && (
            <Button variant="secondary" onClick={retryFailed} loading={running} disabled={cashierBlocked}>Réessayer les échecs</Button>
          )}
          {allSettled && finished ? (
            <Link href="/students">
              <Button variant="secondary" onClick={() => notifySuccess(
                queuedCount > 0 ? "Inscription(s) mise(s) en attente de synchronisation" : "Inscription(s) effectuée(s) avec succès",
              )}>Voir les élèves</Button>
            </Link>
          ) : (
            <Button
              onClick={() => {
                const validationError = validate();
                if (validationError) { notifyError(validationError); return; }
                setReviewOpen(true);
              }}
              loading={running}
              disabled={(finished && !errorCount) || cashierBlocked}
            >
              {finished ? "Terminé" : `Inscrire ${children.length} enfant(s)`}
            </Button>
          )}
        </div>
      </div>

      {user?.tenantId != null && (
        <MultiChildInvoicesModal
          students={collectableStudents}
          tenantId={user.tenantId}
          open={showCollect}
          onClose={() => { setShowCollect(false); resetForm(); }}
        />
      )}

      <EnrollmentReviewModal
        open={reviewOpen}
        children_={children}
        classLabelById={classLabelById}
        exemptionRules={activeExemptionRules}
        isStaffParent={isStaffParent}
        running={running}
        onClose={() => setReviewOpen(false)}
        onConfirm={() => { setReviewOpen(false); submit(); }}
      />
    </div>
  );
}

/** Dernier coup d'œil avant soumission (§retour comptable — oublis fréquents : mauvais type
 * Inscription/Réinscription, exonération fratrie/personnel non cochée). Ne coche/décoche jamais
 * rien à la place du comptable — purement un récapitulatif + deux rappels non bloquants ; la
 * décision finale lui appartient toujours ("Confirmer et inscrire" reste cliquable même avec un
 * rappel affiché). */
function EnrollmentReviewModal({
  open, children_, classLabelById, exemptionRules, isStaffParent, running, onClose, onConfirm,
}: {
  open: boolean;
  children_: ChildDraft[];
  classLabelById: Map<number, string>;
  exemptionRules: ExemptionRule[];
  isStaffParent: boolean;
  running: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const exemptionLabel = (ruleId: string) => {
    const rule = exemptionRules.find((r) => String(r.id) === ruleId);
    return rule ? rule.label : null;
  };
  const isStaffBenefit = (ruleId: string) => {
    const rule = exemptionRules.find((r) => String(r.id) === ruleId);
    return !!rule?.staffBenefit;
  };

  // Aucune exonération choisie — vaut pour n'importe quel enfant, pas seulement dans une grande
  // famille (demande utilisateur : "même si c'est un enfant inscrit, il faut demander si cet enfant
  // ne doit pas avoir d'exonération" — certaines exonérations sont à 100%, ex. bourse/orphelin, et
  // concernent un seul enfant isolé aussi bien qu'une fratrie nombreuse).
  const noExemptionFor = children_.filter((c) => !c.exemptionRuleId);

  // Parent détecté personnel mais enfant(s) sans exonération "avantage personnel" précisément —
  // même détection que le bandeau déjà affiché plus haut sur le formulaire (staffLinkQuery/
  // isStaffParent), reprise ici enfant par enfant pour nommer ceux concernés.
  const staffBenefitMissingFor = isStaffParent
    ? children_.filter((c) => !isStaffBenefit(c.exemptionRuleId))
    : [];
  const flaggedKeys = new Set([
    ...noExemptionFor.map((c) => c.key),
    ...staffBenefitMissingFor.map((c) => c.key),
  ]);
  const hasExemptionWarning = flaggedKeys.size > 0;

  // Blocage volontaire (demande utilisateur, "tu dois même le rendre obligatoire") : impossible de
  // confirmer sans cocher explicitement avoir vérifié — jamais le système qui décide à sa place
  // d'appliquer ou non une exonération. La fréquence de paiement (mensuel ou standard) doit elle
  // aussi être confirmée à chaque fois, même sans exonération en jeu (demande utilisateur : s'assurer
  // que le parent paiera bien chaque ligne au rythme prévu). Les deux sont remises à zéro à chaque
  // réouverture : une coche restée active d'un passage précédent ne doit jamais débloquer
  // silencieusement un nouvel état (ex. après "Retour" pour corriger, puis réinscription).
  const [acknowledged, setAcknowledged] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) { setAcknowledged(false); setPaymentConfirmed(false); }
  }, [open]);
  const confirmDisabled = running || !acknowledged || !paymentConfirmed;

  return (
    <Modal open={open} onClose={onClose} title="Vérifier avant d'inscrire" className="max-w-2xl">
      <div className="space-y-4">
        {noExemptionFor.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>
                {noExemptionFor.length === 1
                  ? "Aucune exonération n'a été appliquée à cet enfant :"
                  : `Cette famille compte ${children_.length} enfant${children_.length > 1 ? "s" : ""} et aucune exonération n'a été appliquée à ${noExemptionFor.length === children_.length ? "aucun d'entre eux" : `${noExemptionFor.length} d'entre eux`} :`}
              </p>
              <ul className="mt-1 list-inside list-disc">
                {noExemptionFor.map((c) => (
                  <li key={c.key}>{c.firstName} {c.lastName}</li>
                ))}
              </ul>
              <p className="mt-1">
                Vérifiez qu&apos;aucun n&apos;a droit à une remise
                avant de continuer.
              </p>
            </div>
          </div>
        )}
        {staffBenefitMissingFor.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p>Le parent est membre du personnel aucun avantage n&apos;est appliqué pour :</p>
              <ul className="mt-1 list-inside list-disc">
                {staffBenefitMissingFor.map((c) => (
                  <li key={c.key}>{c.firstName} {c.lastName}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Enfant</th>
                <th className="px-3 py-2">Classe</th>
                <th className="px-3 py-2">Type</th>
                <th className="px-3 py-2">Exonération</th>
                <th className="px-3 py-2">Paiement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {children_.map((c) => {
                const classId = c.classId ? Number(c.classId) : null;
                const label = exemptionLabel(c.exemptionRuleId);
                const flagged = flaggedKeys.has(c.key);
                return (
                  <tr key={c.key}>
                    <td className="px-3 py-2 font-medium text-gray-900">{c.firstName} {c.lastName}</td>
                    <td className="px-3 py-2 text-gray-600">{classId ? classLabelById.get(classId) ?? "—" : "—"}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {/* Icône purement visuelle (jamais bloquante) : force l'œil à repasser sur CE
                          choix précis — le système ne peut pas savoir si Inscription/Réinscription
                          est correct (aucun historique la 1ère année d'utilisation du logiciel). */}
                      <span className="inline-flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5 shrink-0 text-brand-400" />
                        {c.enrollmentType === "NEW" ? "Inscription" : "Réinscription"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="inline-flex items-center gap-1.5">
                        {flagged && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
                        <span className={flagged ? "font-medium text-amber-700" : undefined}>{label ?? "Aucune"}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">
                      {c.monthlyPaymentOptIn ? "Mensuel (9 factures)" : "Standard"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2">
          {/* Toujours affichée (plus seulement quand un oubli est détecté) : le libellé reflète l'état
              courant — redevient positif dès qu'un retour en arrière corrige l'oubli (demande
              utilisateur), au lieu de disparaître d'un coup sans confirmation finale. */}
          <Checkbox
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            label={hasExemptionWarning
              ? "Je confirme avoir vérifié qu'aucune exonération ne s'applique."
              : "Je confirme avoir vérifié qu'une exonération est appliquée."}
          />
          {/* Toujours demandée, même sans exonération en jeu (demande utilisateur) : le comptable doit
              confirmer avec le parent la fréquence de paiement de chaque ligne de l'élève avant de
              continuer — colonne "Paiement" ci-dessus pour relire le choix (Mensuel/Standard) par enfant. */}
          <Checkbox
            checked={paymentConfirmed}
            onChange={(e) => setPaymentConfirmed(e.target.checked)}
            label="Je confirme avoir vérifié avec le parent le mode de paiement de chaque enfant."
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Retour</Button>
          <Button type="button" onClick={onConfirm} loading={running} disabled={confirmDisabled}>Confirmer et inscrire</Button>
        </div>
      </div>
    </Modal>
  );
}

function ChildCard({
  child, index, classes, exemptionRules, canRemove, running, isStaffParent, onUpdate, onRemove, onDeleteInvoice,
}: {
  child: ChildDraft;
  index: number;
  classes: Classe[];
  exemptionRules: ExemptionRule[];
  canRemove: boolean;
  running: boolean;
  /** Le parent (nouveau/existant/personnel) est déjà détecté comme lié au personnel — indépendamment
   * de l'exonération choisie ci-dessous, voir isStaffParent dans le composant parent. */
  isStaffParent: boolean;
  onUpdate: (patch: Partial<ChildDraft>) => void;
  onRemove: () => void;
  onDeleteInvoice: (feeId: number, invoiceId: number, paidAmount: string | null) => void;
}) {
  const locked = running || child.status === "done" || child.status === "queued";
  const selectedExemptionRule = exemptionRules.find((r) => String(r.id) === child.exemptionRuleId);

  // Prénom / nom : suggestions depuis les valeurs déjà saisies sur la plateforme (saisie libre
  // toujours possible) — un champ par enfant, débouncé indépendamment. Cherchent aussi bien côté
  // élèves que parents du tenant (une fratrie partage souvent le même nom qu'un élève/parent déjà
  // enregistré).
  const [firstNameOptions, fetchFirstNames] = useDebouncedSuggestions(suggestFirstNames, 2);
  const [lastNameOptions, fetchLastNames] = useDebouncedSuggestions(suggestLastNames, 2);

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">Enfant {index + 1}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={child.status} />
          {!running && child.status !== "done" && child.status !== "queued" && canRemove && (
            <button onClick={onRemove} aria-label="Retirer" className="rounded-lg p-1 text-gray-400 hover:bg-error-50 hover:text-error-600">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field>
          <Label>Prénom <span className="text-error-500">*</span></Label>
          <Combobox
            disabled={locked}
            value={child.firstName}
            options={firstNameOptions}
            onChange={(val) => { onUpdate({ firstName: val }); fetchFirstNames(val); }}
          />
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Combobox
            disabled={locked}
            value={child.lastName}
            options={lastNameOptions}
            onChange={(val) => { onUpdate({ lastName: val, lastNameTouched: true }); fetchLastNames(val); }}
          />
        </Field>
        <Field>
          <Label>Classe <span className="text-error-500">*</span></Label>
          <SearchableSelect
            disabled={locked}
            value={child.classId}
            onChange={(v) => onUpdate({ classId: v })}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucune classe"
            options={classes.map((c): SearchableOption => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label }))}
          />
        </Field>
      </div>

      {/* Sexe, Lien de parenté, Type, Exonération : quatre sections indépendantes pleine largeur,
          chacune sur sa propre rangée (§retour utilisateur — les coupler 2 par 2 en flex "ne colle
          pas" quand l'une a 2 options et l'autre 8 : forcer la même hauteur de rangée entre un champ
          court et un champ long reste bancal à n'importe quelle largeur d'écran, pas seulement sur
          mobile). Sexe/Type restent compacts via `horizontal` (leurs 2 options côte à côte au lieu
          d'empilées) ; Lien de parenté/Exonération gardent une liste verticale, chacun adapté à son
          propre nombre d'options plutôt qu'imposé par son voisin. */}
      <div className="mt-3">
        <Field>
          <Label>Sexe <span className="text-error-500">*</span></Label>
          <RequiredChoiceCards
            horizontal
            disabled={locked}
            value={child.gender}
            onChange={(v) => onUpdate({ gender: v })}
            options={[["MALE", "Garçon"], ["FEMALE", "Fille"]] as const}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field>
          <Label>Lien de parenté</Label>
          <RequiredChoiceCards
            columns={2}
            disabled={locked}
            value={child.relationship}
            onChange={(v) => onUpdate({ relationship: (v ?? "FATHER") as Relationship })}
            options={(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => [r, RELATIONSHIP_LABEL[r]] as const)}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field>
          <Label>Type <span className="text-error-500">*</span></Label>
          <RequiredChoiceCards
            horizontal
            disabled={locked}
            value={child.enrollmentType}
            onChange={(v) => onUpdate({ enrollmentType: v })}
            options={[["NEW", "Inscription (nouvel élève)"], ["RE_ENROLLMENT", "Réinscription (déjà scolarisé ici)"]] as const}
          />
        </Field>
      </div>
      <div className="mt-3">
        {/* Exonération en cases à cocher (comme Sexe/Type) plutôt qu'un menu déroulant (§retour
            comptable — "il ne voit pas charger les exonérations" : un menu qui reste vide/fermé
            passe inaperçu, une liste de cartes vide ou l'avertissement juste au-dessus se voit
            tout de suite). */}
        <Field>
          <Label>Exonération (optionnel)</Label>
          <RequiredChoiceCards
            disabled={locked}
            value={child.exemptionRuleId}
            onChange={(v) => {
              const ruleId = v ?? "";
              const rule = exemptionRules.find((r) => String(r.id) === ruleId);
              // Décoche automatiquement la facturation mensuelle si l'exonération choisie n'est
              // plus "avantage personnel" — évite un flag orphelin invisible une fois la case
              // masquée (elle ne concerne que ce cas précis).
              onUpdate({ exemptionRuleId: ruleId, monthlyPaymentOptIn: rule?.staffBenefit ? child.monthlyPaymentOptIn : false });
            }}
            options={[
              ["", "Aucune"] as const,
              ...exemptionRules.map((r) => {
                const detail = r.percentage != null ? `${r.percentage}%` : r.amount != null ? formatGNF(r.amount) : "";
                const label = `${r.label} — ${EXEMPTION_TYPE_LABEL[r.type]}${detail ? ` (${detail})` : ""}`;
                return [String(r.id), label] as const;
              }),
            ]}
          />
        </Field>
      </div>

      {/* Transport retiré d'ici (§retour comptable) — l'abonnement au bus se fait désormais après
          coup, dans le popup d'encaissement (StudentInvoicesPanel), pour éviter le doublon. */}
      {!locked && (() => {
        // §retour comptable : cette case n'était visible que pour le personnel/enseignant avec une
        // exonération "avantage personnel" — alors que n'importe quel parent peut demander à payer
        // mois par mois (monthlyPaymentOptIn est un champ général de l'inscription, pas réservé au
        // personnel, voir EnrollmentUseCase côté serveur). Le texte reste adapté au cas précis où la
        // retenue se fait sur salaire, car cette mécanique-là est bien spécifique au personnel.
        const staffBenefit = isStaffParent || selectedExemptionRule?.staffBenefit;
        return (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <Field>
              <Checkbox
                label={staffBenefit
                  ? "Facturer en 9 mensualités séparées (retenue sur salaire mensuelle)"
                  : "Ce parent règle mois par mois"}
                checked={child.monthlyPaymentOptIn}
                onChange={(e) => onUpdate({ monthlyPaymentOptIn: e.target.checked })}
              />
              <p className="mt-1 text-xs text-gray-400">
                {staffBenefit
                  ? "La retenue sur salaire du parent se fait chaque mois — cochez pour que la "
                    + "mensualité de l'enfant soit découpée en une facture par mois d'école plutôt "
                    + "qu'en grosses tranches, avec l'exonération appliquée sur chacune."
                  : "Cochez pour que la mensualité de l'enfant soit découpée en une facture par mois "
                    + "d'école plutôt qu'en grosses tranches groupées."}
              </p>
            </Field>
          </div>
        );
      })()}

      {child.status === "error" && (
        <p className="mt-2 text-xs text-error-600">{child.error}</p>
      )}

      {child.status === "done" && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {child.generatedInvoices && child.generatedInvoices.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Factures générées</p>
              {child.generatedInvoices.flatMap((g) => g.invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs">
                  <span className="text-gray-700">
                    {g.fee.type === "OTHER" && g.fee.label ? g.fee.label : FEE_TYPE_LABEL[g.fee.type]} — {formatGNF(inv.totalAmount)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeleteInvoice(g.fee.id, inv.id, inv.paidAmount)}
                    aria-label="Supprimer cette facture"
                    className="rounded p-0.5 text-gray-400 hover:bg-error-50 hover:text-error-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )))}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ChildStatus }) {
  if (status === "creating") return <Badge tone="amber"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> En cours</Badge>;
  if (status === "done") return <Badge tone="green"><CheckCircle2 className="mr-1 h-3 w-3" /> Inscrit</Badge>;
  if (status === "queued") return <Badge tone="amber"><UploadCloud className="mr-1 h-3 w-3" /> En attente (auto)</Badge>;
  if (status === "error") return <Badge tone="red"><XCircle className="mr-1 h-3 w-3" /> Échec</Badge>;
  return null;
}
