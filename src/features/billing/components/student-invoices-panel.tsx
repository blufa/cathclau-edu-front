"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { applyEarlyPaymentDiscount, deleteInvoice, generateMonthlyInvoices, generateSelectedInstallments, getInvoicePdfObjectUrl, listFeesByClass, listFeesByRoute, listFeesByTenant, listInstallments, listInvoicesByStudent, removeEarlyPaymentDiscount, subscribeAnnexFee } from "@/lib/api/billing";
import { confirmSchoolPaymentViaDjomy, getPaymentReceiptPdf, getReceiptPdfObjectUrl, listPaymentsByStudent } from "@/lib/api/payment";
import { listRoutes, listStops, listSubscriptions, subscribe } from "@/lib/api/transport";
import { isNetworkError } from "@/lib/api/errors";
import { FEE_TYPE_LABEL, type ExemptedPeriod, type FeeType, type Installment, type Invoice, type SchoolFee } from "@/lib/types/billing";
import { PAYMENT_CHANNEL_LABEL, type PaymentChannel } from "@/lib/types/payment";
import { DIRECTION_LABEL, type TransportDirection } from "@/lib/types/transport";
import { submitGroupPaymentOfflineAware } from "@/lib/offline/submit-group-payment";
import { useSyncQueueStore } from "@/lib/offline/sync-queue-store";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import {
  getPendingOfflinePaymentsForStudent, type PendingOfflinePaymentGroup,
} from "@/lib/offline/desktop-payments";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Label, Field, MoneyInput } from "@/components/ui/input";
import { FilePreview } from "@/components/ui/file-preview";
import { formatGNF, monthShortLabel } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { printHtmlDocument } from "@/lib/print-node";
import { FileText, Plus, Receipt as ReceiptIcon } from "lucide-react";
import { WhatsAppInvoiceButton } from "@/components/billing/whatsapp-invoice-button";

/** Modes d'encaissement au guichet — le paiement en ligne (Djomy) est en attente (standby) côté
 * école, retiré de la liste proposée au comptable tant qu'il n'est pas réactivé. */
const PAYMENT_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces (guichet)" },
  { value: "ORANGE_MONEY", label: "Orange Money (guichet)" },
  { value: "BANK_CARD", label: "Virement bancaire (guichet)" },
];

const remainingOf = (inv: Invoice) => Number(inv.remainingBalance ?? inv.totalAmount);

/** Génération de facture (tranches, frais annexe, transport) : jamais mise en file hors-ligne
 * (montants/remises calculés côté serveur, imprévisibles côté client de façon fiable) — juste un
 * message clair au lieu d'une erreur générique quand la cause est une coupure réseau, pour que le
 * comptable sache qu'il faut réessayer une fois reconnecté plutôt que de penser à une vraie panne. */
function notifyGenerationError(err: unknown) {
  if (isNetworkError(err)) {
    notifyError(err, "Hors ligne : impossible de générer cette facture maintenant — réessayez une fois reconnecté.");
  } else {
    notifyError(err);
  }
}

/** Ordre d'affichage naturel du guichet : inscription/réinscription d'abord, puis la scolarité
 * (tranches, triées chronologiquement), puis les frais annexes (transport, cantine, examen…). */
const GROUP_ORDER: Record<FeeType, number> = {
  ENROLLMENT: 0, RE_ENROLLMENT: 0, MONTHLY: 1, TRANSPORT: 2, CANTEEN: 2, EXAM: 2, OTHER: 2, PLATFORM: 2,
};

/**
 * Situation financière complète d'un élève : liste unifiée des factures à régler (tranches de
 * scolarité, inscription, frais annexes) avec encaissement groupé en un clic, plus l'historique des
 * reçus. Composant autonome — ne monte ses requêtes que lorsqu'il est effectivement affiché (utilisé
 * tel quel dans {@link CollectFeeModal} et dans l'onglet "Factures" de la fiche élève).
 */
export function StudentInvoicesPanel({
  studentId, tenantId, classId, onCollected,
}: {
  studentId: number;
  tenantId: number;
  /** Classe de l'élève — permet de générer les mensualités à partir du frais MENSUALITE de la classe. */
  classId?: number;
  onCollected: () => void;
}) {
  const { user } = useAuth();
  const canDeleteInvoice = hasAnyPermission(user, ["facture:delete"]);
  const q = useCachedQuery(`student-invoices:${studentId}`, () => listInvoicesByStudent(studentId), [studentId]);
  const payments = useCachedQuery(`student-payments:${studentId}`, () => listPaymentsByStudent(studentId), [studentId]);
  const fees = useCachedQuery(classId ? `fees-class:${classId}` : null, () => listFeesByClass(classId as number), [classId]);
  // Filet de secours pour labelFor() (§retour comptable : référence opaque "PNM-FRA-2026-xxxxxx"
  // affichée au lieu du nom du frais) — une facture peut référencer un frais d'une AUTRE classe que
  // la classe active actuelle (ex. après un transfert de classe) ; fees ci-dessus, scopé à la seule
  // classe active, ne le contient alors plus. Scope tenant entier, jamais utilisé pour décider quoi
  // proposer de générer/ajouter (ça reste class-scopé), seulement pour retrouver un nom lisible.
  const tenantFees = useCachedQuery(`fees-tenant:${tenantId}`, () => listFeesByTenant(tenantId), [tenantId]);

  const all = q.data ?? [];
  // CANCELLED (ex. ancienne classe après un transfert, §retour comptable) : remainingBalance déjà
  // remis à 0 côté serveur, mais sans ce filtre la facture restait quand même listée ici (fantôme à
  // 0 GNF, jamais réellement "à régler") — à exclure comme PAID, pas juste masquer son montant.
  const unpaid = all.filter((inv) => inv.status !== "PAID" && inv.status !== "CANCELLED");
  const receipts = (payments.data ?? []).filter((p) => p.status === "SUCCEEDED");
  // Le plus récent n'est pas forcément en dernière position dans la liste affichée — déterminé par
  // l'id le plus élevé plutôt que l'ordre d'affichage (§retour comptable : "(Dernier reçu encaissé)").
  const latestReceiptId = receipts.length > 0
    ? receipts.reduce((latest, r) => (r.id > latest.id ? r : latest), receipts[0]).id
    : null;
  const monthlyFee = (fees.data ?? []).find((f) => f.type === "MONTHLY");
  // Encaissements guichet enregistrés hors-ligne pour cet élève, pas encore synchronisés (§payments —
  // mode hors-ligne) : pas de vrai reçu serveur tant qu'ils n'ont pas atteint le backend. Web
  // uniquement (file Dexie) — voir `desktopPendingPayments` juste en dessous pour l'équivalent desktop
  // (SQLite), `useSyncQueueStore` ne reflétant jamais cette file-là.
  const queuedPayments = useSyncQueueStore((s) => s.items).filter((i) => i.studentIds.includes(studentId));

  const [desktopPendingPayments, setDesktopPendingPayments] = useState<PendingOfflinePaymentGroup[]>([]);
  useEffect(() => {
    if (!isDesktop()) return;
    let active = true;
    getPendingOfflinePaymentsForStudent(studentId).then((groups) => { if (active) setDesktopPendingPayments(groups); }).catch(() => {});
    return () => { active = false; };
    // Re-vérifié après chaque rafraîchissement des factures (après un encaissement, une synchro...).
  }, [studentId, q.data]);

  // Frais réglables en tranches (§billing) : la scolarité (MONTHLY) et, comme elle, la cantine
  // (CANTEEN) — le transport (TRANSPORT) reste géré séparément via son propre abonnement par ligne.
  const recurringFees = (fees.data ?? []).filter((f) => f.type === "MONTHLY" || f.type === "CANTEEN");

  // Mois librement choisis par tranche (§billing) : nécessaires pour afficher le détail des mois
  // couverts par chaque tranche (scolarité et cantine), trier les tranches chronologiquement, et
  // permettre un paiement partiel « par mois » à l'encaissement.
  const installments = useQuery(
    () => (recurringFees.length > 0
      ? Promise.all(recurringFees.map((f) => listInstallments(f.id))).then((lists) => lists.flat())
      : Promise.resolve([])),
    [recurringFees.map((f) => f.id).join(",")],
  );
  const installmentsByFeeId = new Map<number, Installment[]>();
  for (const inst of installments.data ?? []) {
    const list = installmentsByFeeId.get(inst.feeId) ?? [];
    list.push(inst);
    installmentsByFeeId.set(inst.feeId, list);
  }
  const installmentMonths = new Map((installments.data ?? []).map((i) => [i.id, i.months ?? []]));
  // Mois couverts PAR CETTE FACTURE précisément (pas par toute la tranche) — indispensable quand le
  // parent a choisi « paiement par mois » (§billing) : plusieurs factures distinctes partagent alors le
  // même installmentId (une par mois), et `installmentMonths.get(installmentId)` renverrait à tort TOUS
  // les mois de la tranche pour chacune, faisant apparaître « octobre, novembre, décembre » sur une
  // facture qui ne couvre en réalité qu'un seul mois. Générées dans le même ordre que les mois de la
  // tranche (voir generateMonthly), les factures triées par id correspondent donc 1 à 1 aux mois dans
  // l'ordre où ils sont stockés.
  const coveredMonthsByInvoiceId = new Map<number, string[]>();
  {
    const byInstallmentId = new Map<number, Invoice[]>();
    for (const inv of all) {
      if (inv.installmentId == null) continue;
      const list = byInstallmentId.get(inv.installmentId) ?? [];
      list.push(inv);
      byInstallmentId.set(inv.installmentId, list);
    }
    for (const [instId, invs] of byInstallmentId) {
      const monthsOfInstallment = installmentMonths.get(instId) ?? [];
      if (invs.length <= 1 || monthsOfInstallment.length <= 1) {
        for (const inv of invs) coveredMonthsByInvoiceId.set(inv.id, monthsOfInstallment);
        continue;
      }
      [...invs].sort((a, b) => a.id - b.id).forEach((inv, idx) => {
        const single = monthsOfInstallment[idx];
        coveredMonthsByInvoiceId.set(inv.id, single != null ? [single] : monthsOfInstallment);
      });
    }
  }
  const installmentSortKey = new Map(
    (installments.data ?? []).map((i) => {
      const months = [...(i.months ?? [])].sort();
      return [i.id, months[0] ?? i.dueDate ?? "9999-12"];
    }),
  );
  // Frais réglables en tranches pas encore facturés du tout à cet élève (aucune facture liée) — chacun
  // propose son propre bouton de génération, indépendamment des autres (ex. la scolarité peut déjà
  // être générée sans que la cantine le soit).
  const [generatingFeeId, setGeneratingFeeId] = useState<number | null>(null);
  // CANCELLED (facture supprimée/annulée, ex. pour corriger un oubli d'exonération, §retour comptable)
  // ne doit jamais bloquer une régénération — sinon le frais reste considéré "déjà facturé" à vie et
  // plus aucun bouton "Générer" ne réapparaît jamais pour cet élève sur ce frais.
  const ungeneratedRecurringFees = recurringFees.filter((f) =>
    !all.some((inv) => inv.feeId === f.id && inv.status !== "CANCELLED") && (installmentsByFeeId.get(f.id)?.length ?? 0) > 0);

  // Libellé + ordre d'affichage de chaque facture : les mensualités gardent leur périodLabel (déjà
  // « Tranche N (mois…) ») ; les autres frais (inscription, annexes) affichent leur type de frais.
  const feeById = new Map((fees.data ?? []).map((f) => [f.id, f]));
  const tenantFeeById = new Map((tenantFees.data ?? []).map((f) => [f.id, f]));
  function labelFor(inv: Invoice): string {
    if (inv.periodLabel) return inv.periodLabel;
    const fee = inv.feeId != null ? (feeById.get(inv.feeId) ?? tenantFeeById.get(inv.feeId)) : undefined;
    if (!fee) return inv.reference;
    return fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type];
  }
  function groupOf(inv: Invoice): number {
    const fee = inv.feeId != null ? (feeById.get(inv.feeId) ?? tenantFeeById.get(inv.feeId)) : undefined;
    return fee ? GROUP_ORDER[fee.type] : 2;
  }
  function sortKeyOf(inv: Invoice): string {
    return inv.periodLabel ? (installmentSortKey.get(inv.installmentId ?? -1) ?? "9999-12") : "";
  }
  const payable = [...unpaid].sort((a, b) => {
    const g = groupOf(a) - groupOf(b);
    if (g !== 0) return g;
    return sortKeyOf(a).localeCompare(sortKeyOf(b));
  });

  // Frais annexes configurés pour la classe (cantine, examen, autre…) que l'élève n'a pas encore — sans
  // ça, ces frais n'ont jamais de facture et n'apparaissent donc jamais à l'encaissement, même quand ils
  // sont bien définis dans « Frais scolaires ». Le transport est géré séparément ci-dessous (abonnement
  // par ligne, pas juste une facture — voir §billing, un frais TRANSPORT est rattaché à une ligne).
  // Une cantine configurée SANS tranches reste un frais annexe simple (montant unique, ajouté à la
  // demande) — seule une cantine configurée EN tranches (comme la scolarité) bascule dans le flux de
  // génération ci-dessous, pour ne jamais rendre invisible une cantine déjà réglée à l'ancienne.
  const tranchedCanteenFeeIds = new Set(
    recurringFees.filter((f) => f.type === "CANTEEN" && (installmentsByFeeId.get(f.id)?.length ?? 0) > 0).map((f) => f.id),
  );
  // Même correctif que ungeneratedRecurringFees ci-dessus : une facture CANCELLED ne doit jamais
  // empêcher de rajouter ce frais annexe (sinon aucune nouvelle facture n'est jamais plus possible
  // pour ce frais, même après suppression/annulation de l'ancienne).
  const availableFees = (fees.data ?? []).filter((f) =>
    f.type !== "MONTHLY" && f.type !== "TRANSPORT" && !tranchedCanteenFeeIds.has(f.id)
    && !all.some((inv) => inv.feeId === f.id && inv.status !== "CANCELLED"));
  const [addingFee, setAddingFee] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);

  // Abonnement transport à la demande (§billing) : un parent peut décider de s'abonner au moment de
  // l'inscription OU plus tard, en payant les frais scolaires — mêmes options que l'inscription.
  const subscriptionsQuery = useQuery(() => listSubscriptions({ studentId }), [studentId]);
  const activeSubscription = (subscriptionsQuery.data ?? []).find((s) => s.status === "ACTIVE");
  const hasActiveTransport = activeSubscription != null;
  const routesQuery = useQuery(() => (!hasActiveTransport ? listRoutes() : Promise.resolve([])), [hasActiveTransport]);
  const [wantsTransport, setWantsTransport] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [stopId, setStopId] = useState("");
  const [direction, setDirection] = useState<TransportDirection>("BOTH");
  const [subscribingTransport, setSubscribingTransport] = useState(false);
  const stopsQuery = useQuery(
    () => (routeId ? listStops(Number(routeId)) : Promise.resolve([])),
    [routeId],
  );

  // Transport facturé au mois, à la demande (§billing, retour comptable) : jamais toute l'année d'un
  // coup à la souscription — le frais de la ligne est résolu ici pour proposer, une fois abonné, les
  // mois pas encore facturés à cocher (le mois en cours coché par défaut ; un parent qui avance
  // plusieurs mois peut en cocher plusieurs à la fois).
  const routeFeeQuery = useQuery(
    () => (activeSubscription ? listFeesByRoute(activeSubscription.routeId) : Promise.resolve([])),
    [activeSubscription?.routeId],
  );
  const transportFee = (routeFeeQuery.data ?? []).find((f) => f.type === "TRANSPORT");
  const transportInstallmentsQuery = useQuery(
    () => (transportFee ? listInstallments(transportFee.id) : Promise.resolve([])),
    [transportFee?.id],
  );
  const billedTransportInstallmentIds = new Set(
    all.filter((inv) => inv.feeId === transportFee?.id && inv.installmentId != null).map((inv) => inv.installmentId as number),
  );
  const unbilledTransportInstallments = (transportInstallmentsQuery.data ?? [])
    .filter((inst) => !billedTransportInstallmentIds.has(inst.id))
    .sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31"));
  const currentMonthKey = new Date().toISOString().slice(0, 7); // "YYYY-MM"
  const defaultTransportSelection = (() => {
    const current = unbilledTransportInstallments.find((inst) => (inst.months ?? []).includes(currentMonthKey))
      ?? unbilledTransportInstallments.find((inst) => (inst.dueDate ?? "").slice(0, 7) === currentMonthKey);
    return current ? [current.id] : [];
  })();
  const [manualTransportSelection, setManualTransportSelection] = useState<number[] | null>(null);
  const selectedTransportInstallmentIds = manualTransportSelection ?? defaultTransportSelection;
  function toggleTransportInstallment(id: number) {
    setManualTransportSelection((prev) => {
      const base = prev ?? defaultTransportSelection;
      return base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    });
  }
  const [generatingTransportMonth, setGeneratingTransportMonth] = useState(false);

  async function generateTransportMonths() {
    if (!transportFee || selectedTransportInstallmentIds.length === 0) return;
    setGeneratingTransportMonth(true);
    try {
      const result = await generateSelectedInstallments(tenantId, studentId, transportFee.id, selectedTransportInstallmentIds, all[0]?.academicYearId ?? null);
      notifySuccess(result.created.length > 0
        ? `${result.created.length} mois de transport facturé(s) — prêt à encaisser`
        : "Rien à facturer (déjà réglé)");
      setManualTransportSelection(null);
      q.refetch();
      transportInstallmentsQuery.refetch();
    } catch (err) { notifyGenerationError(err); } finally { setGeneratingTransportMonth(false); }
  }

  function refetchAll() { q.refetch(); payments.refetch(); onCollected(); }

  async function addFee() {
    const fee = availableFees.find((f) => String(f.id) === selectedFeeId);
    if (!fee) return;
    setCreatingInvoice(true);
    try {
      await subscribeAnnexFee(tenantId, studentId, fee, all[0]?.academicYearId ?? null);
      notifySuccess("Frais ajouté — prêt à encaisser");
      setAddingFee(false);
      setSelectedFeeId("");
      q.refetch();
    } catch (err) { notifyGenerationError(err); } finally { setCreatingInvoice(false); }
  }

  async function subscribeTransport() {
    if (!routeId) return;
    setSubscribingTransport(true);
    try {
      await subscribe({ routeId: Number(routeId), stopId: stopId ? Number(stopId) : null, studentId, direction });
      notifySuccess("Élève abonné au transport — facturez chaque mois utilisé depuis cette fiche, quand le parent vient payer");
      setWantsTransport(false);
      setRouteId(""); setStopId("");
      subscriptionsQuery.refetch();
      q.refetch();
    } catch (err) { notifyGenerationError(err); } finally { setSubscribingTransport(false); }
  }

  const monthlyUngenerated = ungeneratedRecurringFees.find((f) => f.type === "MONTHLY");

  // Échéances entièrement couvertes par une exonération 100% (§billing, retour comptable) : le serveur
  // ne crée alors AUCUNE facture pour elles (voir generateMonthlyInvoices) — réévaluées à chaque appel
  // de generateMonths (donc à chaque montage tant que le frais reste "non généré", voir l'effet
  // ci-dessous), pour qu'une exonération accordée/révoquée en cours d'année soit reflétée sans action
  // manuelle. Gardées par feeId pour ne jamais mélanger scolarité et cantine.
  const [exemptedPeriodsByFeeId, setExemptedPeriodsByFeeId] = useState<Record<number, ExemptedPeriod[]>>({});
  const exemptedPeriods = Object.values(exemptedPeriodsByFeeId).flat();
  // Un frais déjà résolu au moins une fois (clé présente, même si son tableau est vide) qui reste sans
  // aucune facture n'a plus rien à "générer" — voir le commentaire au point d'affichage ci-dessous.
  const pendingUngeneratedFees = ungeneratedRecurringFees.filter((f) => exemptedPeriodsByFeeId[f.id] === undefined);

  async function generateMonths(fee: SchoolFee) {
    setGeneratingFeeId(fee.id);
    try {
      const result = await generateMonthlyInvoices(tenantId, studentId, fee.id);
      setExemptedPeriodsByFeeId((prev) => ({ ...prev, [fee.id]: result.exemptedPeriods }));
      const label = fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type];
      const createdCount = result.created.length;
      const exemptedCount = result.exemptedPeriods.length;
      notifySuccess(
        createdCount > 0
          ? `${createdCount} tranche(s) de « ${label} » générée(s)${exemptedCount > 0 ? ` (+ ${exemptedCount} exonérée(s) 100%)` : ""}`
          : exemptedCount > 0
            ? `« ${label} » entièrement exonérée (${exemptedCount} échéance(s))`
            : `Tranches de « ${label} » déjà générées`,
      );
      q.refetch();
    } catch (err) { notifyGenerationError(err); } finally { setGeneratingFeeId(null); }
  }

  // Auto-génère les tranches de mensualité dès l'affichage (utile juste après une inscription) : la
  // scolarité s'applique à tout élève inscrit, contrairement à la cantine (optionnelle, qui reste
  // manuelle) — le comptable n'a plus besoin de cliquer « Générer les tranches » pour la voir
  // apparaître. Le bouton manuel reste affiché en repli si l'auto-génération échoue (réseau...).
  const autoGeneratedRef = useRef(false);
  useEffect(() => {
    if (autoGeneratedRef.current || !monthlyUngenerated) return;
    if (q.loading || fees.loading || installments.loading) return;
    autoGeneratedRef.current = true;
    // Défère hors du corps synchrone de l'effet (generateMonths appelle setState dès sa première
    // ligne, avant tout await) — évite les rendus en cascade pendant le commit de cet effet.
    queueMicrotask(() => void generateMonths(monthlyUngenerated));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generateMonths is a stable in-scope function declaration
  }, [monthlyUngenerated, q.loading, fees.loading, installments.loading]);

  async function showPdf(title: string, fetchUrl: () => Promise<string>) {
    try {
      setPreview({ url: await fetchUrl(), title });
    } catch (err) {
      notifyError(err);
    }
  }

  /** Reçu provisoire imprimable (pas de PDF serveur tant que le paiement n'est pas synchronisé) — un
   * bloc minimal ouvert dans une fenêtre dédiée, remis au parent séance tenante. */
  function printProvisionalReceipt(entry: (typeof queuedPayments)[number]) {
    const total = entry.input.shares.reduce((s, x) => s + x.amount, 0);
    printHtmlDocument(`<!doctype html><html><head><title>Reçu provisoire</title>
      <style>body{font-family:sans-serif;padding:24px;color:#111}
      h1{font-size:16px}p{margin:6px 0}.tag{color:#b45309;font-weight:600}</style></head>
      <body>
        <h1>Reçu PROVISOIRE</h1>
        <p class="tag">Enregistré hors-ligne — sera remplacé par le reçu officiel après synchronisation.</p>
        <p>Référence locale : OFFLINE-${entry.id.slice(0, 8).toUpperCase()}</p>
        <p>Date : ${new Date(entry.createdAt).toLocaleString("fr-FR")}</p>
        <p>Détail : ${entry.input.coverageLabel}</p>
        <p>Montant : ${formatGNF(total)}</p>
      </body></html>`);
  }

  /** Équivalent desktop de {@link printProvisionalReceipt} — même principe (bloc minimal imprimable,
   * remis au parent tout de suite), lisant la file SQLite locale au lieu de la file Dexie web. */
  function printProvisionalReceiptDesktop(group: PendingOfflinePaymentGroup) {
    const channelLabel = PAYMENT_CHANNEL_LABEL[group.modePaiement as PaymentChannel] ?? group.modePaiement;
    printHtmlDocument(`<!doctype html><html><head><title>Reçu provisoire</title>
      <style>body{font-family:sans-serif;padding:24px;color:#111}
      h1{font-size:16px}p{margin:6px 0}.tag{color:#b45309;font-weight:600}</style></head>
      <body>
        <h1>Reçu PROVISOIRE</h1>
        <p class="tag">Enregistré hors-ligne — sera remplacé par le reçu officiel après synchronisation.</p>
        <p>Date : ${new Date(group.datePaiement).toLocaleString("fr-FR")}</p>
        <p>Mode : ${channelLabel}</p>
        <p>Montant : ${formatGNF(group.total)}</p>
      </body></html>`);
  }

  return (
    <>
      {q.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : all.length === 0 && isNetworkError(q.error) ? (
        <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800">
          Impossible de charger les factures (hors-ligne) — rouvrez cette fiche pendant que vous étiez
          connecté, ou reconnectez-vous pour continuer.
        </p>
      ) : all.length === 0 ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Aucune facture pour cet élève. Vérifiez qu&apos;un frais d&apos;inscription est configuré pour la classe.
        </p>
      ) : (
        <div className="space-y-5">
          {(payable.length > 0 || exemptedPeriods.length > 0) && (
            <InvoiceCollect
              invoices={payable}
              exemptedPeriods={exemptedPeriods}
              labelFor={labelFor}
              coveredMonthsByInvoiceId={coveredMonthsByInvoiceId}
              monthlyFeeId={monthlyFee?.id ?? null}
              tenantId={tenantId}
              studentId={studentId}
              canDeleteInvoice={canDeleteInvoice}
              onShowPdf={(inv) => showPdf(`Facture ${inv.reference}`, () => getInvoicePdfObjectUrl(inv.id))}
              // Retour comptable : ne plus ouvrir l'aperçu automatiquement après un encaissement — le
              // reçu est généré, mais sa consultation/impression reste une action volontaire (liste
              // des reçus ci-dessous, ou "Imprimer tous les reçus" dans l'inscription groupée).
              onPaid={() => {}}
              onDone={refetchAll}
            />
          )}

          {/* Abonnement transport à la demande — un parent peut préférer s'abonner ici plutôt qu'à
              l'inscription. Masqué si l'élève est déjà abonné (voir le module Transport pour gérer
              un abonnement existant). */}
          {!hasActiveTransport && (routesQuery.data ?? []).length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3">
              {!wantsTransport ? (
                <Button size="sm" variant="secondary" leftSection={<Plus className="h-4 w-4" />} onClick={() => setWantsTransport(true)}>
                  Abonner au transport
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => { setWantsTransport(false); setRouteId(""); setStopId(""); }}>Annuler</Button>
                    <Button size="sm" onClick={subscribeTransport} loading={subscribingTransport} disabled={!routeId}>Abonner</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Transport déjà abonné : facturé au mois, à la demande (§billing, retour comptable) — un
              mois non pris n'est jamais une facture impayée, jamais de relance injustifiée. Le mois en
              cours est coché par défaut ; un parent qui avance plusieurs mois peut en cocher d'autres. */}
          {hasActiveTransport && (
            <div className="space-y-2 rounded-xl border border-slate-200 p-3">
              <p className="text-sm text-slate-600">
                Abonné au transport — cochez le(s) mois à facturer quand le parent vient payer.
              </p>
              {unbilledTransportInstallments.length === 0 ? (
                <p className="text-xs text-slate-400">Tout le transport configuré est déjà facturé.</p>
              ) : (
                <div className="space-y-1">
                  {unbilledTransportInstallments.map((inst) => (
                    <Checkbox
                      key={inst.id}
                      checked={selectedTransportInstallmentIds.includes(inst.id)}
                      onChange={() => toggleTransportInstallment(inst.id)}
                      label={<span className="text-sm text-slate-700">{inst.label} — {formatGNF(inst.amount)}</span>}
                    />
                  ))}
                </div>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={generateTransportMonths}
                  loading={generatingTransportMonth}
                  disabled={selectedTransportInstallmentIds.length === 0}
                >
                  Facturer {selectedTransportInstallmentIds.length > 1 ? `${selectedTransportInstallmentIds.length} mois` : "ce mois"}
                </Button>
              </div>
            </div>
          )}

          {/* Frais annexes (cantine, examen, autre…) configurés pour la classe mais pas encore
              facturés à cet élève — ajout à la demande (opt-in : tous les élèves ne prennent pas la
              cantine). */}
          {(availableFees.length > 0 || addingFee) && (
            <div className="rounded-xl border border-slate-200 p-3">
              {!addingFee ? (
                <Button size="sm" variant="secondary" leftSection={<Plus className="h-4 w-4" />} onClick={() => setAddingFee(true)}>
                  Ajouter un frais annexe
                </Button>
              ) : (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <Field>
                      <Label>Frais à ajouter</Label>
                      <SearchableSelect
                        value={selectedFeeId}
                        options={availableFees.map((f): SearchableOption => {
                          const label = `${f.type === "OTHER" && f.label ? f.label : FEE_TYPE_LABEL[f.type]} — ${formatGNF(f.amount)}`;
                          return { value: String(f.id), trigger: label, label, searchText: label };
                        })}
                        onChange={setSelectedFeeId}
                        triggerClassName="w-full justify-between px-3"
                        noResultsLabel="Aucun frais annexe configuré pour cette classe"
                      />
                    </Field>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => { setAddingFee(false); setSelectedFeeId(""); }}>Annuler</Button>
                  <Button size="sm" onClick={addFee} loading={creatingInvoice} disabled={!selectedFeeId}>Ajouter</Button>
                </div>
              )}
            </div>
          )}

          {/* Génère les tranches (scolarité ou cantine) pour pouvoir payer l'inscription + les mois
              choisis — un frais réglable en tranches n'a jamais de facture tant qu'il n'a pas été
              généré une première fois pour cet élève. Exclut un frais déjà résolu (exemptedPeriodsByFeeId
              connu, voir generateMonths) qui reste malgré tout sans aucune facture : c'est qu'il est
              exonéré à 100% (aucune facture à 0 GNF n'est jamais créée, voir InvoiceService) — rien à
              générer ni à montrer ici, l'exonération apparaît déjà listée dans le bloc ci-dessus
              (§retour comptable : "ce n'est pas la peine" de garder ce bouton pour un élève qui ne doit
              rien). */}
          {pendingUngeneratedFees.map((fee) => {
            const label = fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type];
            return (
              <div key={fee.id} className="flex flex-col gap-2 rounded-xl border border-brand-200 bg-brand-50/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                  « {label} » non encore générée pour cet élève.
                </p>
                <Button onClick={() => generateMonths(fee)} loading={generatingFeeId === fee.id}>
                  Générer les tranches ({label.toLowerCase()})
                </Button>
              </div>
            );
          })}

          {payable.length === 0 && exemptedPeriods.length === 0 && pendingUngeneratedFees.length === 0 && (
            <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
              Toutes les factures sont soldées.
            </p>
          )}

          {receipts.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-slate-500">Reçus de paiement</p>
              {receipts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    <span className="font-mono text-xs">{p.reference}</span> · {formatGNF(p.amount)}
                    {/* Retour comptable : identifier d'un coup d'œil le reçu le plus récent dans cette
                        liste (pas forcément en dernière position à l'écran). */}
                    {p.id === latestReceiptId && (
                      <span className="ml-1.5 font-medium text-brand-600">(Dernier reçu encaissé)</span>
                    )}
                  </span>
                  <div className="flex items-center gap-3">
                    <button type="button"
                      onClick={() => showPdf(`Reçu ${p.reference}`, () => getReceiptPdfObjectUrl(p.id))}
                      className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                      <ReceiptIcon className="h-4 w-4" /> Reçu PDF
                    </button>
                    <WhatsAppInvoiceButton
                      studentId={studentId}
                      buildMessage={async () => {
                        const { url } = await getPaymentReceiptPdf(p.id);
                        return `Bonjour, voici le reçu de paiement de ${formatGNF(p.amount)} (réf. ${p.reference}).${url ? ` ${url}` : ""}`;
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {queuedPayments.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-warning-700">
                Reçus provisoires (hors-ligne — en attente de synchronisation)
              </p>
              {queuedPayments.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    <span className="font-mono text-xs">OFFLINE-{entry.id.slice(0, 8).toUpperCase()}</span> ·{" "}
                    {formatGNF(entry.input.shares.reduce((s, x) => s + x.amount, 0))}
                  </span>
                  <button type="button"
                    onClick={() => printProvisionalReceipt(entry)}
                    className="inline-flex items-center gap-1 text-xs text-warning-700 hover:underline">
                    <ReceiptIcon className="h-4 w-4" /> Reçu provisoire
                  </button>
                </div>
              ))}
            </div>
          )}

          {desktopPendingPayments.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-medium text-warning-700">
                Reçus provisoires (hors-ligne — en attente de synchronisation)
              </p>
              {desktopPendingPayments.map((group) => (
                <div key={`${group.datePaiement}:${group.modePaiement}`} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-slate-600">
                    {new Date(group.datePaiement).toLocaleString("fr-FR")} · {formatGNF(group.total)}
                  </span>
                  <button type="button"
                    onClick={() => printProvisionalReceiptDesktop(group)}
                    className="inline-flex items-center gap-1 text-xs text-warning-700 hover:underline">
                    <ReceiptIcon className="h-4 w-4" /> Reçu provisoire
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </>
  );
}

/**
 * Unified collection: tick any mix of tuition tranches, enrolment/re-enrolment and annex fees
 * (transport, canteen…) and settle them at the desk in one click, as a single grouped payment with a
 * single receipt. A parent may come with just the enrolment + a couple of months' advance on a
 * tranche — partial amounts are always accepted, never refused. Online (Djomy) grouped payment is
 * handled from the parent portal.
 */
function InvoiceCollect({
  invoices, exemptedPeriods, labelFor, coveredMonthsByInvoiceId, monthlyFeeId, tenantId, studentId, canDeleteInvoice, onShowPdf, onPaid, onDone,
}: {
  invoices: Invoice[];
  /** Échéances exonérées à 100% (§billing) : jamais cochables/encaissables, affichées dans la même
   * liste que les vraies factures pour que le comptable ne les prenne jamais pour un simple oubli de
   * génération. */
  exemptedPeriods: ExemptedPeriod[];
  labelFor: (inv: Invoice) => string;
  /** Mois "YYYY-MM" couverts par CETTE facture précisément (id de facture → mois) — un seul mois pour
   * une facture éclatée « paiement par mois », tous les mois de la tranche pour une facture groupée. */
  coveredMonthsByInvoiceId: Map<number, string[]>;
  /** Id du frais MENSUALITE (scolarité) — sert à isoler les tranches pour la remise année complète. */
  monthlyFeeId: number | null;
  tenantId: number;
  studentId: number;
  /** Permission facture:delete — affiche "Supprimer" sur une facture encore sans paiement (générée
   * par erreur), directement depuis la fiche élève (pas seulement depuis la liste globale /invoices,
   * qui peut ne pas afficher cette facture tant que l'inscription n'est pas validée). */
  canDeleteInvoice: boolean;
  onShowPdf: (inv: Invoice) => void;
  /** Appelé juste après un encaissement guichet réussi, avec l'id du paiement — ouvre aussitôt le reçu
   * (visualiser/télécharger/imprimer) au lieu de forcer un aller-retour par la fiche élève. */
  onPaid: (paymentId: number) => void;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [channel, setChannel] = useState<PaymentChannel>("CASH");
  const [loading, setLoading] = useState(false);
  const [onlineWaiting, setOnlineWaiting] = useState(false);
  const pollIdRef = useRef<number | null>(null);
  const pollTriesRef = useRef(0);
  // Montant retenu par facture : par défaut le solde restant, mais éditable pour un paiement partiel —
  // un parent peut venir avec moins que le montant de la tranche/du frais, jamais refusé.
  const [customAmounts, setCustomAmounts] = useState<Record<number, number>>({});
  // Mois cochés dans chaque tranche multi-mois, pour aider au calcul (« je paie 2 des 5 mois »).
  const [monthSelections, setMonthSelections] = useState<Record<number, string[]>>({});

  // Retour comptable : supprimer directement depuis la fiche élève une facture générée par erreur
  // (ex. mauvaise classe à l'inscription) — jamais possible tant qu'un paiement y est déjà encaissé
  // (le serveur refuse sinon, voir InvoiceService#delete). Distinct d'"annuler" (conserve l'historique).
  function remove(inv: Invoice) {
    confirmAction({
      title: "Supprimer la facture",
      message: `Supprimer définitivement ${inv.reference} ? Cette action est irréversible.`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try {
          await deleteInvoice(inv.id);
          notifySuccess("Facture supprimée");
          setSelected((prev) => prev.filter((id) => id !== inv.id));
          onDone();
        } catch (err) { notifyError(err); }
      },
    });
  }

  const allIds = invoices.map((inv) => inv.id);
  const monthlyIds = invoices.filter((inv) => inv.feeId === monthlyFeeId).map((inv) => inv.id);
  const wholeYear = monthlyIds.length > 0 && monthlyIds.every((id) => selected.includes(id));

  // Paiement de toutes les tranches restantes en un coup : la remise pour paiement annuel complet
  // (§billing, configurable dans Règles de facturation) s'applique côté serveur — jamais confiée au
  // front. Recalculée dès que toute la scolarité est sélectionnée ; sans effet si aucune règle active.
  const discountQuery = useQuery(
    () => (wholeYear && monthlyFeeId ? applyEarlyPaymentDiscount(studentId, monthlyFeeId) : Promise.resolve(null)),
    [wholeYear, monthlyFeeId, studentId],
  );
  // La remise est appliquée côté serveur (persistée sur les factures) dès que toute la scolarité est
  // cochée — il faut donc explicitement l'annuler dès que ce n'est plus le cas (ex. un mois décoché),
  // sinon elle resterait acquise indéfiniment sur les factures au lieu de revenir au montant initial.
  const wasWholeYear = useRef(false);
  useEffect(() => {
    if (wasWholeYear.current && !wholeYear && monthlyFeeId) {
      removeEarlyPaymentDiscount(studentId, monthlyFeeId).then(() => discountQuery.refetch()).catch(() => {});
    }
    wasWholeYear.current = wholeYear;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne doit réagir qu'à la transition de wholeYear
  }, [wholeYear]);
  // Les factures de scolarité sont remplacées par leur version remisée ; le reste de la liste (inscription,
  // frais annexes) n'est jamais concerné par cette remise et reste inchangé.
  const discounted = discountQuery.data;
  const effectiveInvoices = wholeYear && discounted
    ? invoices.map((inv) => discounted.find((d) => d.id === inv.id) ?? inv)
    : invoices;
  const discountApplied = wholeYear && discounted
    ? monthlyIds.reduce((s, id) => s + remainingOf(invoices.find((i) => i.id === id)!), 0)
      - monthlyIds.reduce((s, id) => s + remainingOf(effectiveInvoices.find((i) => i.id === id)!), 0)
    : 0;

  /** Montant retenu pour cette facture : personnalisé si saisi, sinon le solde restant en entier. */
  function amountFor(m: Invoice): number {
    const custom = customAmounts[m.id];
    return custom != null ? Math.min(Math.max(custom, 0), remainingOf(m)) : remainingOf(m);
  }
  function setAmount(m: Invoice, value: number) {
    setCustomAmounts((prev) => ({ ...prev, [m.id]: Math.min(Math.max(value, 0), remainingOf(m)) }));
  }
  /** Coche/décoche un mois d'une tranche multi-mois : recalcule le montant proportionnellement. */
  function toggleMonth(m: Invoice, allMonths: string[], month: string) {
    const current = monthSelections[m.id] ?? allMonths;
    const next = current.includes(month) ? current.filter((x) => x !== month) : [...current, month];
    setMonthSelections((prev) => ({ ...prev, [m.id]: next }));
    const perMonth = Number(m.totalAmount) / allMonths.length;
    setAmount(m, next.length * perMonth);
  }

  /**
   * Libellé précis pour le reçu : si le parent ne paie qu'une partie des mois d'une tranche (ex. « mai »
   * sur une tranche « mai, juin »), le reçu doit refléter le(s) mois réellement réglé(s) plutôt que le
   * libellé complet de la tranche — sinon le reçu affiche à tort « mai, juin » pour un paiement d'un seul mois.
   */
  function receiptLabelFor(m: Invoice): string {
    const coveredMonths = coveredMonthsByInvoiceId.get(m.id) ?? [];
    if (coveredMonths.length <= 1) return labelFor(m);
    const checked = monthSelections[m.id] ?? coveredMonths;
    if (checked.length === coveredMonths.length) return labelFor(m);
    const monthsLabel = [...checked].sort().map(monthShortLabel).join(", ");
    return monthsLabel ? `${labelFor(m)} — ${monthsLabel} réglé(s)` : labelFor(m);
  }

  const selectedInvoices = effectiveInvoices.filter((m) => selected.includes(m.id));
  const total = selectedInvoices.reduce((s, m) => s + amountFor(m), 0);
  // « Combien lui reste » : factures non cochées en entier + le reliquat des factures payées partiellement.
  const remainingAfter = effectiveInvoices.reduce((s, m) => {
    if (!selected.includes(m.id)) return s + remainingOf(m);
    return s + Math.max(0, remainingOf(m) - amountFor(m));
  }, 0);
  const online = channel === "DJOMY";
  const toggle = (id: number) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleMonthlyFees = () =>
    setSelected((s) => (wholeYear ? s.filter((id) => !monthlyIds.includes(id)) : [...new Set([...s, ...monthlyIds])]));
  const toggleAll = () => setSelected((s) => (s.length === allIds.length ? [] : allIds));

  // Polling Djomy après redirection : confirme/répartit automatiquement dès que le paiement est réussi.
  useEffect(() => {
    if (!onlineWaiting || pollIdRef.current == null) return;
    const t = setInterval(async () => {
      pollTriesRef.current += 1;
      try {
        const p = await confirmSchoolPaymentViaDjomy(pollIdRef.current as number);
        if (p.status === "SUCCEEDED") {
          clearInterval(t);
          setOnlineWaiting(false);
          notifySuccess("Paiement en ligne confirmé — reçu généré.");
          setSelected([]);
          setCustomAmounts({});
          setMonthSelections({});
          onDone();
        }
      } catch { /* on continue de vérifier */ }
      if (pollTriesRef.current >= 20) {
        clearInterval(t);
        setOnlineWaiting(false);
      }
      // Intervalle doublé, tentatives max divisées par deux (§retour comptable, point 18 —
      // consommation de données excessive sur connexion mobile) : même fenêtre d'attente totale
      // (~160s), deux fois moins de requêtes réseau.
    }, 8000);
    return () => clearInterval(t);
  }, [onlineWaiting, onDone]);

  async function collect() {
    // paidMonths : sur une tranche multi-mois, précise quels mois sont réglés par cette part — pour
    // que la facture affiche « Tranche 1 — avril, mai réglés » plutôt qu'un simple solde, y compris
    // quand le règlement ne couvre qu'une partie des mois cochés à l'écran.
    const shares = selectedInvoices.map((m) => {
      const coveredMonths = coveredMonthsByInvoiceId.get(m.id) ?? [];
      const paidMonths = coveredMonths.length > 1 ? (monthSelections[m.id] ?? coveredMonths) : undefined;
      return { invoiceId: m.id, amount: amountFor(m), paidMonths };
    }).filter((s) => s.amount > 0);
    if (shares.length === 0) return;
    setLoading(true);
    try {
      // Un seul paiement groupé → un seul reçu listant tout ce qui a été réglé (inscription, tranches
      // avec leurs mois, frais annexes) et le reste à payer.
      const coverageLabel = wholeYear && selectedInvoices.length === monthlyIds.length
        ? "Scolarité complète"
        : selectedInvoices.map(receiptLabelFor).filter(Boolean).join(", ");
      const attempt = await submitGroupPaymentOfflineAware({
        tenantId, studentId, channel,
        payerNumber: online ? "614324299" : undefined,
        coverageLabel,
        monthsCount: selectedInvoices.length,
        remainingAfter,
        shares,
        academicYearId: selectedInvoices[0]?.academicYearId ?? null,
      });
      if (attempt.outcome === "queued" || attempt.outcome === "queued-desktop") {
        // Réseau indisponible : encaissement guichet enregistré localement, sera rejoué automatiquement
        // au retour de la connexion (voir le bandeau hors-ligne et la section « reçus provisoires »).
        notifySuccess("Encaissement enregistré hors-ligne — sera synchronisé automatiquement.");
        setSelected([]);
        setCustomAmounts({});
        setMonthSelections({});
        return;
      }
      const res = attempt.response;
      if (online) {
        // Une seule transaction Djomy pour le total : on ouvre le portail puis on attend la confirmation.
        pollIdRef.current = res.payment.id;
        pollTriesRef.current = 0;
        setOnlineWaiting(true);
        if (res.redirectUrl) {
          const w = window.open(res.redirectUrl, "_blank", "noopener,noreferrer");
          if (!w) window.location.assign(res.redirectUrl);
        }
      } else {
        notifySuccess(`${selectedInvoices.length} facture(s) encaissée(s) — reçu généré.`);
        setSelected([]);
        setCustomAmounts({});
        setMonthSelections({});
        onPaid(res.payment.id);
        onDone();
      }
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">Factures à régler</p>
        <div className="flex gap-3 text-xs">
          {monthlyIds.length > 0 && (
            <button type="button" onClick={toggleMonthlyFees} className="text-brand-700 hover:underline">
              {wholeYear ? "Décocher la scolarité" : "Toute la scolarité"}
            </button>
          )}
          <button type="button" onClick={toggleAll} className="text-slate-500 hover:underline">
            {selected.length === allIds.length ? "Tout décocher" : "Tout sélectionner"}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {effectiveInvoices.map((m) => {
          const coveredMonths = coveredMonthsByInvoiceId.get(m.id) ?? [];
          const isChecked = selected.includes(m.id);
          const checkedSubMonths = monthSelections[m.id] ?? coveredMonths;
          const partial = isChecked && amountFor(m) < remainingOf(m);
          return (
            <div key={m.id} className="rounded-lg px-2 py-1.5 hover:bg-white">
              <label className="flex cursor-pointer items-center justify-between gap-2">
                <Checkbox
                  checked={isChecked}
                  onChange={() => toggle(m.id)}
                  label={(
                    <span className="text-sm text-slate-700">
                      {labelFor(m)}
                      {m.discountAmount != null && Number(m.discountAmount) > 0 && (
                        <span className="ml-1.5 text-xs font-medium text-success-600">
                          (remise −{formatGNF(m.discountAmount)}{m.discountReason && ` · ${m.discountReason}`})
                        </span>
                      )}
                      {m.creditedAmount != null && Number(m.creditedAmount) > 0 && (
                        <span className="ml-1.5 text-xs font-medium text-brand-600">
                          (crédit +{formatGNF(m.creditedAmount)}{m.creditReason && ` · ${m.creditReason}`})
                        </span>
                      )}
                    </span>
                  )}
                />
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => onShowPdf(m)}
                    className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline">
                    <FileText className="h-3.5 w-3.5" />
                  </button>
                  {canDeleteInvoice && (!m.paidAmount || Number(m.paidAmount) === 0) && (
                    <button type="button" onClick={(e) => { e.preventDefault(); remove(m); }}
                      className="text-xs text-error-600 hover:underline">
                      Supprimer
                    </button>
                  )}
                  {isChecked ? (
                    <MoneyInput
                      className="w-36"
                      value={amountFor(m)}
                      onValueChange={(n) => setAmount(m, n)}
                    />
                  ) : (
                    <span className="text-sm text-slate-600">{formatGNF(remainingOf(m))}</span>
                  )}
                </div>
              </label>
              {isChecked && coveredMonths.length > 1 && (
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 pl-6">
                  {coveredMonths.map((month) => (
                    <Checkbox
                      key={month}
                      checked={checkedSubMonths.includes(month)}
                      onChange={() => toggleMonth(m, coveredMonths, month)}
                      label={<span className="text-xs text-slate-500">{monthShortLabel(month)}</span>}
                    />
                  ))}
                </div>
              )}
              {partial && (
                <p className="pl-6 text-xs text-warning-600">
                  Paiement partiel — reste {formatGNF(remainingOf(m) - amountFor(m))} sur cette facture.
                </p>
              )}
            </div>
          );
        })}
        {exemptedPeriods.map((p) => (
          <div key={`exempted-${p.installmentId}-${p.periodLabel}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 opacity-70">
            <span className="text-sm text-slate-500 line-through decoration-slate-300">{p.periodLabel}</span>
            <span className="rounded-full bg-success-50 px-2 py-0.5 text-xs font-medium text-success-700">
              {p.discountReason ? p.discountReason : "Exonéré 100%"}
            </span>
          </div>
        ))}
      </div>

      {wholeYear && discountQuery.loading && (
        <p className="mt-2 text-xs text-slate-400">Vérification d&apos;une remise pour paiement annuel complet…</p>
      )}
      {wholeYear && discountApplied > 0 && (
        <p className="mt-2 rounded-lg bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-700">
          Remise scolarité complète appliquée : −{formatGNF(discountApplied)}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 border-t border-brand-100 pt-3 sm:flex-row sm:items-end">
        <Field>
          <Label>Mode de paiement</Label>
          <SearchableSelect
            value={channel}
            onChange={(v) => setChannel(v as PaymentChannel)}
            triggerClassName="w-full sm:w-56 justify-between px-3"
            options={PAYMENT_CHANNELS.map((c): SearchableOption => (
              { value: c.value, trigger: c.label, label: c.label, searchText: c.label }
            ))}
          />
        </Field>
        <div className="flex-1" />
        <Button onClick={collect} loading={loading || onlineWaiting} disabled={selected.length === 0}>
          {online ? "Payer en ligne" : "Encaisser"} {selected.length} facture{selected.length > 1 ? "s" : ""} · {formatGNF(total)}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {onlineWaiting
          ? "Portail Djomy ouvert dans un nouvel onglet. Le règlement sera validé automatiquement dès le paiement confirmé."
          : online
            ? "Paiement en ligne : une seule transaction Djomy pour tout ce qui est coché, un reçu unique."
            : "Encaissement au guichet : validé immédiatement, un reçu unique listant tout ce qui est réglé et le reste à payer."}
      </p>
    </div>
  );
}
