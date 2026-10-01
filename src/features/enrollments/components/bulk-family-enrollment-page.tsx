"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plus, Trash2, UploadCloud, X, XCircle } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import type { Classe } from "@/lib/types/academics";
import { createStudent } from "@/lib/api/students";
import {
  createParent, getParentStaffLink, linkParentToStudent, listParents,
  RELATIONSHIP_LABEL, type ParentStaffLink, type Relationship,
} from "@/lib/api/parents";
import { searchStaff, type StaffSearchResult } from "@/lib/api/staff";
import { searchPreviousClasses, searchSchools } from "@/lib/api/directory";
import { enroll } from "@/lib/api/enrollments";
import { listRoutes, listStops, subscribe } from "@/lib/api/transport";
import { DIRECTION_LABEL, type TransportDirection } from "@/lib/types/transport";
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
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, Input, Label } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";

// "queued" : mis en file locale automatiquement après un échec RÉSEAU (jamais un clic manuel) — sera
// synchronisé tout seul au retour de la connexion (§retour comptable, file 100% automatique).
type ChildStatus = "pending" | "creating" | "done" | "error" | "queued";

interface ChildDraft {
  key: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  // Coordonnées et parcours scolaire antérieur de l'enfant (fiche identité).
  address: string;
  phone: string;
  originSchool: string;
  previousClass: string;
  repeating: boolean;
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
  transportSubscribed?: boolean;
  feesGenerated?: boolean;
  // Inscription ou réinscription (§retour comptable) : détermine quelle facture d'inscription générer
  // — jamais les deux, même si la classe a les deux frais configurés.
  enrollmentType: EnrollmentType;
  // Transport (§retour comptable, refonte inscription) : optionnel, comme à l'inscription classique.
  wantsTransport: boolean;
  routeId: string;
  stopId: string;
  direction: TransportDirection;
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
    firstName: "", lastName: "", gender: "MALE", birthDate: "",
    address: "", phone: "", originSchool: "", previousClass: "", repeating: false,
    classId: "", relationship: "FATHER",
    status: "pending",
    enrollmentType: "NEW",
    wantsTransport: false, routeId: "", stopId: "", direction: "BOTH",
    exemptionRuleId: "", monthlyPaymentOptIn: false,
  };
}

const GENDER_OPTIONS: SearchableOption[] = [
  { value: "MALE", trigger: "Garçon", label: "Garçon", searchText: "garçon" },
  { value: "FEMALE", trigger: "Fille", label: "Fille", searchText: "fille" },
];

const ENROLLMENT_TYPE_OPTIONS: SearchableOption[] = [
  { value: "NEW", trigger: "Inscription (nouvel élève)", label: "Inscription (nouvel élève)", searchText: "inscription nouvel élève" },
  { value: "RE_ENROLLMENT", trigger: "Réinscription (déjà scolarisé ici)", label: "Réinscription (déjà scolarisé ici)", searchText: "réinscription déjà scolarisé" },
];

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

  // ── Année scolaire / classes ────────────────────────────────────────────
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])), [effectiveYearId]);
  const classes = classesQuery.data ?? [];

  // Lignes de transport du tenant — partagées entre tous les enfants (chacun choisit la sienne).
  const routesQuery = useQuery(() => listRoutes(), []);
  // Types d'exonération pré-configurés — partagés entre tous les enfants (§retour comptable).
  const exemptionRulesQuery = useQuery(() => listExemptionRules(), []);
  const activeExemptionRules = (exemptionRulesQuery.data ?? []).filter((r) => r.active);

  // ── Enfants ─────────────────────────────────────────────────────────────
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild(), emptyChild()]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  // Repart d'un formulaire vierge une fois l'encaissement terminé (popup fermé) — le comptable peut
  // enchaîner une nouvelle famille sans quitter la page ni garder les enfants déjà traités affichés.
  function resetForm() {
    setParentMode("new");
    setParentSearch("");
    setSelectedParent(null);
    setNewParent({ firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "" });
    setStaffSearch("");
    setSelectedStaff(null);
    setChildren([emptyChild(), emptyChild()]);
    setRunning(false);
    setFinished(false);
    autoOpenedRef.current = false;
  }

  function updateChild(key: string, patch: Partial<ChildDraft>) {
    setChildren((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function addChild() {
    setChildren((cs) => [...cs, emptyChild()]);
  }
  function removeChild(key: string) {
    setChildren((cs) => (cs.length > 1 ? cs.filter((c) => c.key !== key) : cs));
  }

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
      if (c.wantsTransport && !c.routeId) {
        return "Choisissez une ligne de transport, ou décochez l'abonnement.";
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
      firstName: child.firstName.trim(), lastName: child.lastName.trim(), gender: child.gender,
      birthDate: child.birthDate || null, address: child.address.trim() || null, phone: child.phone.trim() || null,
      originSchool: child.originSchool.trim() || null, previousClass: child.previousClass.trim() || null,
      repeating: child.repeating, classId: Number(child.classId), relationship: child.relationship,
      enrollmentType: child.enrollmentType, monthlyPaymentOptIn: child.monthlyPaymentOptIn,
      wantsTransport: child.wantsTransport, routeId: child.routeId ? Number(child.routeId) : null,
      stopId: child.stopId ? Number(child.stopId) : null, direction: child.direction,
      exemption: rule ? {
        type: rule.type, percentage: rule.percentage != null ? Number(rule.percentage) : null,
        amount: rule.amount != null ? Number(rule.amount) : null,
        feeTypes: rule.feeTypes && rule.feeTypes.length > 0 ? rule.feeTypes : null,
        reason: rule.label, staffBenefit: rule.staffBenefit,
      } : null,
      studentId: child.studentId ?? null, parentLinked: child.parentLinked ?? false,
      enrolled: child.enrolled ?? false, exemptionApplied: child.exemptionApplied ?? false,
      transportSubscribed: child.transportSubscribed ?? false, feesGenerated: child.feesGenerated ?? false,
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
      let transportSubscribed = child.transportSubscribed ?? false;
      let feesGenerated = child.feesGenerated ?? false;
      let generatedInvoices: GeneratedFeeInvoices[] = child.generatedInvoices ?? [];
      let needsQueue = false;

      try {
        if (studentId == null) {
          const student = await createStudent({
            firstName: child.firstName.trim(), lastName: child.lastName.trim(),
            gender: child.gender, birthDate: child.birthDate || null,
            address: child.address.trim() || null, phone: child.phone.trim() || null,
            originSchool: child.originSchool.trim() || null, previousClass: child.previousClass.trim() || null,
            repeating: child.repeating,
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
            type: child.enrollmentType, monthlyPaymentOptIn: child.monthlyPaymentOptIn,
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

        // Transport (point 1) : l'abonnement déclenche lui-même la génération de ses factures
        // (comme à l'inscription classique) — indépendant de generate-all ci-dessous.
        if (child.wantsTransport && child.routeId && !transportSubscribed) {
          try {
            await subscribe({
              routeId: Number(child.routeId), stopId: child.stopId ? Number(child.stopId) : null,
              studentId, direction: child.direction,
            });
            transportSubscribed = true;
            updateChild(child.key, { transportSubscribed: true });
          } catch (err) {
            if (isNetworkError(err) && isDesktop()) needsQueue = true;
            else notifyError(err);
          }
        }

        // Génère en un seul appel toutes les factures des frais de la classe (inscription OU
        // réinscription selon le type choisi — jamais les deux —, mensualité, cantine si configurée,
        // examen...) — aucune remise recalculée ici, déjà appliquée côté serveur.
        if (!feesGenerated) {
          try {
            generatedInvoices = await generateAllForEnrollment({
              studentId, classId: Number(child.classId), academicYearId: effectiveYearId!,
              enrollmentType: child.enrollmentType, wantsTransport: false, transportFeeId: null,
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
            studentId, parentLinked, enrolled, exemptionApplied, transportSubscribed, feesGenerated,
          }));
          updateChild(child.key, { status: "queued", studentId, generatedInvoices });
        } else {
          updateChild(child.key, { status: "done", studentId, generatedInvoices });
        }
      } catch (err) {
        if (isNetworkError(err) && isDesktop()) {
          toQueue.push(toQueuedChild(child, {
            studentId, parentLinked, enrolled, exemptionApplied, transportSubscribed, feesGenerated,
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
          const created = await createParent({
            firstName: newParent.firstName.trim(), lastName: newParent.lastName.trim(),
            phone: newParent.phone.trim() || null, email: newParent.email.trim() || null,
            occupation: newParent.occupation.trim() || null, address: newParent.address.trim() || null,
          }, parentMode === "staff" ? (selectedStaff?.userId ?? null) : null);
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
  const collectableStudents = children
    .filter((c): c is ChildDraft & { studentId: number } => c.status === "done" && c.studentId != null)
    .map((c) => ({ id: c.studentId, name: `${c.firstName} ${c.lastName}`, classId: c.classId ? Number(c.classId) : null }));
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
                          <p className="text-xs text-gray-400">{s.phone ?? "—"} · {s.staffType === "TEACHER" ? "Enseignant" : "Personnel"}</p>
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
                <Input disabled={running || finished} value={newParent.firstName} onChange={(e) => setNewParent({ ...newParent, firstName: e.target.value })} />
              </Field>
              <Field>
                <Label>Nom <span className="text-error-500">*</span></Label>
                <Input disabled={running || finished} value={newParent.lastName} onChange={(e) => setNewParent({ ...newParent, lastName: e.target.value })} />
              </Field>
              <PhoneInput label={<>Téléphone <span className="text-error-500">*</span></>} value={newParent.phone} onChange={(v) => setNewParent({ ...newParent, phone: v })} />
              <Field>
                <Label>Email (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.email} onChange={(e) => setNewParent({ ...newParent, email: e.target.value })} />
              </Field>
              <Field>
                <Label>Profession (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.occupation} onChange={(e) => setNewParent({ ...newParent, occupation: e.target.value })} />
              </Field>
              <Field>
                <Label>Adresse (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.address} onChange={(e) => setNewParent({ ...newParent, address: e.target.value })} />
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
          {children.map((child, i) => (
            <ChildCard
              key={child.key}
              child={child}
              index={i}
              classes={classes}
              routes={routesQuery.data ?? []}
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
            <Button variant="secondary" onClick={retryFailed} loading={running}>Réessayer les échecs</Button>
          )}
          {allSettled && finished ? (
            <Link href="/students">
              <Button variant="secondary" onClick={() => notifySuccess(
                queuedCount > 0 ? "Inscription(s) mise(s) en attente de synchronisation" : "Inscription(s) effectuée(s) avec succès",
              )}>Voir les élèves</Button>
            </Link>
          ) : (
            <Button onClick={submit} loading={running} disabled={finished && !errorCount}>
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
    </div>
  );
}

function ChildCard({
  child, index, classes, routes, exemptionRules, canRemove, running, isStaffParent, onUpdate, onRemove, onDeleteInvoice,
}: {
  child: ChildDraft;
  index: number;
  classes: Classe[];
  routes: { id: number; name: string }[];
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
  const stopsQuery = useQuery(() => (child.routeId ? listStops(Number(child.routeId)) : Promise.resolve([])), [child.routeId]);
  const selectedExemptionRule = exemptionRules.find((r) => String(r.id) === child.exemptionRuleId);

  // École d'origine / dernière classe : suggestions depuis les valeurs déjà saisies sur la plateforme
  // (saisie libre toujours possible) — un champ par enfant, débouncé indépendamment.
  const [schoolOptions, setSchoolOptions] = useState<string[]>([]);
  const schoolDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function fetchSchools(q: string) {
    clearTimeout(schoolDebounce.current);
    if (q.trim().length < 2) { setSchoolOptions([]); return; }
    schoolDebounce.current = setTimeout(() => {
      searchSchools(q).then(setSchoolOptions).catch(() => setSchoolOptions([]));
    }, 300);
  }
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const classDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function fetchPreviousClasses(q: string) {
    clearTimeout(classDebounce.current);
    if (q.trim().length < 1) { setClassOptions([]); return; }
    classDebounce.current = setTimeout(() => {
      searchPreviousClasses(q).then(setClassOptions).catch(() => setClassOptions([]));
    }, 300);
  }

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
          <Input disabled={locked} value={child.firstName} onChange={(e) => onUpdate({ firstName: e.target.value })} />
        </Field>
        <Field>
          <Label>Nom <span className="text-error-500">*</span></Label>
          <Input disabled={locked} value={child.lastName} onChange={(e) => onUpdate({ lastName: e.target.value })} />
        </Field>
        <Field>
          <Label>Sexe</Label>
          <SearchableSelect
            disabled={locked}
            value={child.gender}
            onChange={(v) => onUpdate({ gender: v as Gender })}
            triggerClassName="w-full justify-between px-3"
            options={GENDER_OPTIONS}
          />
        </Field>
        <Field>
          <Label>Date de naissance</Label>
          <DatePicker value={child.birthDate} onChange={(v) => onUpdate({ birthDate: v })} clearable disabled={locked} />
        </Field>
        <Field>
          <Label>Adresse</Label>
          <Input disabled={locked} value={child.address} onChange={(e) => onUpdate({ address: e.target.value })} />
        </Field>
        <Field>
          <Label>Téléphone</Label>
          <Input disabled={locked} value={child.phone} onChange={(e) => onUpdate({ phone: e.target.value })} />
        </Field>
        <Field>
          <Label>École d&apos;origine</Label>
          <Combobox
            value={child.originSchool}
            options={schoolOptions}
            onChange={(val) => { onUpdate({ originSchool: val }); fetchSchools(val); }}
          />
        </Field>
        <Field>
          <Label>Dernière classe</Label>
          <Combobox
            value={child.previousClass}
            options={classOptions}
            onChange={(val) => { onUpdate({ previousClass: val }); fetchPreviousClasses(val); }}
          />
        </Field>
        <div className="flex items-end pb-2.5">
          <Checkbox label="Redoublant" disabled={locked} checked={child.repeating} onChange={(e) => onUpdate({ repeating: e.target.checked })} />
        </div>
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
        <Field>
          <Label>Lien de parenté</Label>
          <SearchableSelect
            disabled={locked}
            value={child.relationship}
            onChange={(v) => onUpdate({ relationship: v as Relationship })}
            triggerClassName="w-full justify-between px-3"
            options={(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r): SearchableOption => ({
              value: r, trigger: RELATIONSHIP_LABEL[r], label: RELATIONSHIP_LABEL[r], searchText: RELATIONSHIP_LABEL[r],
            }))}
          />
        </Field>
        <Field>
          <Label>Type</Label>
          <SearchableSelect
            disabled={locked}
            value={child.enrollmentType}
            onChange={(v) => onUpdate({ enrollmentType: v as EnrollmentType })}
            triggerClassName="w-full justify-between px-3"
            options={ENROLLMENT_TYPE_OPTIONS}
          />
        </Field>
        <Field>
          <Label>Exonération (optionnel)</Label>
          <SearchableSelect
            disabled={locked}
            value={child.exemptionRuleId}
            onChange={(v) => {
              const rule = exemptionRules.find((r) => String(r.id) === v);
              // Décoche automatiquement la facturation mensuelle si l'exonération choisie n'est
              // plus "avantage personnel" — évite un flag orphelin invisible une fois la case
              // masquée (elle ne concerne que ce cas précis).
              onUpdate({ exemptionRuleId: v, monthlyPaymentOptIn: rule?.staffBenefit ? child.monthlyPaymentOptIn : false });
            }}
            triggerClassName="w-full justify-between px-3"
            noResultsLabel="Aucun type d'exonération configuré"
            options={[
              { value: "", trigger: "Aucune", label: "Aucune", searchText: "aucune" },
              ...exemptionRules.map((r): SearchableOption => {
                const detail = r.percentage != null ? `${r.percentage}%` : r.amount != null ? formatGNF(r.amount) : "";
                const label = `${r.label} — ${EXEMPTION_TYPE_LABEL[r.type]}${detail ? ` (${detail})` : ""}`;
                return { value: String(r.id), trigger: label, label, searchText: label };
              }),
            ]}
          />
        </Field>
      </div>

      {!locked && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          {routes.length > 0 && (
            <Checkbox label="Prend le bus" checked={child.wantsTransport} onChange={(e) => onUpdate({ wantsTransport: e.target.checked, routeId: "", stopId: "" })} />
          )}

          {(isStaffParent || selectedExemptionRule?.staffBenefit) && (
            <Field>
              <Checkbox
                label="Facturer en 9 mensualités séparées (retenue sur salaire mensuelle)"
                checked={child.monthlyPaymentOptIn}
                onChange={(e) => onUpdate({ monthlyPaymentOptIn: e.target.checked })}
              />
              <p className="mt-1 text-xs text-gray-400">
                La retenue sur salaire du parent se fait chaque mois — cochez pour que la mensualité de
                l&apos;enfant soit découpée en une facture par mois d&apos;école plutôt qu&apos;en
                grosses tranches, avec l&apos;exonération appliquée sur chacune.
              </p>
            </Field>
          )}

          {child.wantsTransport && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <SearchableSelect
                value={child.routeId}
                onChange={(v) => onUpdate({ routeId: v, stopId: "" })}
                triggerClassName="w-full justify-between px-3"
                noResultsLabel="Aucune ligne"
                options={[
                  { value: "", trigger: "Ligne…", label: "Ligne…", searchText: "" },
                  ...routes.map((r): SearchableOption => ({ value: String(r.id), trigger: r.name, label: r.name, searchText: r.name })),
                ]}
              />
              <SearchableSelect
                value={child.stopId}
                onChange={(v) => onUpdate({ stopId: v })}
                disabled={!child.routeId}
                triggerClassName="w-full justify-between px-3"
                noResultsLabel="Aucun arrêt"
                options={[
                  { value: "", trigger: "Arrêt (optionnel)", label: "Arrêt (optionnel)", searchText: "" },
                  ...(stopsQuery.data ?? []).map((s): SearchableOption => ({ value: String(s.id), trigger: s.name, label: s.name, searchText: s.name })),
                ]}
              />
              <SearchableSelect
                value={child.direction}
                onChange={(v) => onUpdate({ direction: v as TransportDirection })}
                triggerClassName="w-full justify-between px-3"
                options={(Object.keys(DIRECTION_LABEL) as TransportDirection[]).map((d): SearchableOption => ({
                  value: d, trigger: DIRECTION_LABEL[d], label: DIRECTION_LABEL[d], searchText: DIRECTION_LABEL[d],
                }))}
              />
            </div>
          )}
        </div>
      )}

      {child.status === "error" && (
        <p className="mt-2 text-xs text-error-600">{child.error}</p>
      )}

      {child.status === "done" && (
        <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
          {(child.generatedInvoices && child.generatedInvoices.length > 0) || child.transportSubscribed ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Factures générées</p>
              {child.generatedInvoices?.flatMap((g) => g.invoices.map((inv) => (
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
              {/* L'abonnement transport génère ses factures lui-même, de façon asynchrone côté serveur
                  (voir TransportInvoiceListener) — jamais renvoyées par generateAllForEnrollment, donc
                  jamais dans generatedInvoices ci-dessus. Sans cette ligne, le comptable ne voyait
                  jamais que le transport avait bien été facturé (§retour comptable). */}
              {child.transportSubscribed && (
                <div className="flex items-center justify-between rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs">
                  <span className="text-gray-700">{FEE_TYPE_LABEL.TRANSPORT} — abonnement actif, facturé chaque mois</span>
                </div>
              )}
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
