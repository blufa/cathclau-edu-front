"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { applyEarlyPaymentDiscount, generateMonthlyInvoices, getInvoicePdfObjectUrl, listFeesByClass, listInstallments, listInvoicesByStudent, removeEarlyPaymentDiscount, subscribeAnnexFee } from "@/lib/api/billing";
import { confirmSchoolPaymentViaDjomy, getPaymentReceiptPdf, getReceiptPdfObjectUrl, listPaymentsByStudent } from "@/lib/api/payment";
import { listRoutes, listStops, listSubscriptions, subscribe } from "@/lib/api/transport";
import { isNetworkError } from "@/lib/api/errors";
import { FEE_TYPE_LABEL, type FeeType, type Installment, type Invoice, type SchoolFee } from "@/lib/types/billing";
import { type PaymentChannel } from "@/lib/types/payment";
import { DIRECTION_LABEL, type TransportDirection } from "@/lib/types/transport";
import { submitGroupPaymentOfflineAware } from "@/lib/offline/submit-group-payment";
import { useSyncQueueStore } from "@/lib/offline/sync-queue-store";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Label, Field, MoneyInput } from "@/components/ui/input";
import { FilePreview } from "@/components/ui/file-preview";
import { formatGNF, monthShortLabel } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { FileText, Plus, Receipt as ReceiptIcon } from "lucide-react";
import { WhatsAppInvoiceButton } from "@/components/billing/whatsapp-invoice-button";

/** Modes d'encaissement : guichet (immédiat) + en ligne via Djomy (une seule transaction). */
const PAYMENT_CHANNELS: { value: PaymentChannel; label: string }[] = [
  { value: "CASH", label: "Espèces (guichet)" },
  { value: "ORANGE_MONEY", label: "Orange Money (guichet)" },
  { value: "BANK_CARD", label: "Virement bancaire (guichet)" },
  { value: "DJOMY", label: "En ligne (Djomy)" },
];

const remainingOf = (inv: Invoice) => Number(inv.remainingBalance ?? inv.totalAmount);

/** Ordre d'affichage naturel du guichet : inscription/réinscription d'abord, puis la scolarité
 * (tranches, triées chronologiquement), puis les frais annexes (transport, cantine, examen…). */
const GROUP_ORDER: Record<FeeType, number> = {
  ENROLLMENT: 0, RE_ENROLLMENT: 0, MONTHLY: 1, TRANSPORT: 2, CANTEEN: 2, EXAM: 2, OTHER: 2,
};

/**
 * Opens the student's invoices so the desk can collect ("encaisser") them in a single unified list —
 * tuition tranches (chronologically ordered) alongside enrolment and annex fees (transport, canteen…)
 * — so the desk can tick everything a family wants to settle at once and record it as ONE grouped
 * payment with a single receipt. Each settled payment exposes its receipt PDF (preview / download / print).
 */
export function CollectFeeModal({
  studentId, tenantId, classId, open, onClose, onCollected,
}: {
  studentId: number;
  tenantId: number;
  /** Classe de l'élève — permet de générer les mensualités à partir du frais MENSUALITE de la classe. */
  classId?: number;
  open: boolean;
  onClose: () => void;
  onCollected: () => void;
}) {
  const q = useQuery(() => (open ? listInvoicesByStudent(studentId) : Promise.resolve([])), [open, studentId]);
  const payments = useQuery(() => (open ? listPaymentsByStudent(studentId) : Promise.resolve([])), [open, studentId]);
  const fees = useQuery(() => (open && classId ? listFeesByClass(classId) : Promise.resolve([])), [open, classId]);

  const all = q.data ?? [];
  const unpaid = all.filter((inv) => inv.status !== "PAID");
  const receipts = (payments.data ?? []).filter((p) => p.status === "SUCCEEDED");
  const monthlyFee = (fees.data ?? []).find((f) => f.type === "MONTHLY");
  // Encaissements guichet enregistrés hors-ligne pour cet élève, pas encore synchronisés (§payments —
  // mode hors-ligne) : pas de vrai reçu serveur tant qu'ils n'ont pas atteint le backend.
  const queuedPayments = useSyncQueueStore((s) => s.items).filter((i) => i.studentIds.includes(studentId));

  // Frais réglables en tranches (§billing) : la scolarité (MONTHLY) et, comme elle, la cantine
  // (CANTEEN) — le transport (TRANSPORT) reste géré séparément via son propre abonnement par ligne.
  const recurringFees = (fees.data ?? []).filter((f) => f.type === "MONTHLY" || f.type === "CANTEEN");

  // Mois librement choisis par tranche (§billing) : nécessaires pour afficher le détail des mois
  // couverts par chaque tranche (scolarité et cantine), trier les tranches chronologiquement, et
  // permettre un paiement partiel « par mois » à l'encaissement.
  const installments = useQuery(
    () => (open && recurringFees.length > 0
      ? Promise.all(recurringFees.map((f) => listInstallments(f.id))).then((lists) => lists.flat())
      : Promise.resolve([])),
    [open, recurringFees.map((f) => f.id).join(",")],
  );
  const installmentsByFeeId = new Map<number, Installment[]>();
  for (const inst of installments.data ?? []) {
    const list = installmentsByFeeId.get(inst.feeId) ?? [];
    list.push(inst);
    installmentsByFeeId.set(inst.feeId, list);
  }
  const installmentMonths = new Map((installments.data ?? []).map((i) => [i.id, i.months ?? []]));
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
  const ungeneratedRecurringFees = recurringFees.filter((f) =>
    !all.some((inv) => inv.feeId === f.id) && (installmentsByFeeId.get(f.id)?.length ?? 0) > 0);

  // Libellé + ordre d'affichage de chaque facture : les mensualités gardent leur périodLabel (déjà
  // « Tranche N (mois…) ») ; les autres frais (inscription, annexes) affichent leur type de frais.
  const feeById = new Map((fees.data ?? []).map((f) => [f.id, f]));
  function labelFor(inv: Invoice): string {
    if (inv.periodLabel) return inv.periodLabel;
    const fee = inv.feeId != null ? feeById.get(inv.feeId) : undefined;
    if (!fee) return inv.reference;
    return fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type];
  }
  function groupOf(inv: Invoice): number {
    const fee = inv.feeId != null ? feeById.get(inv.feeId) : undefined;
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
  const availableFees = (fees.data ?? []).filter((f) =>
    f.type !== "MONTHLY" && f.type !== "TRANSPORT" && !tranchedCanteenFeeIds.has(f.id) && !all.some((inv) => inv.feeId === f.id));
  const [addingFee, setAddingFee] = useState(false);
  const [selectedFeeId, setSelectedFeeId] = useState("");
  const [creatingInvoice, setCreatingInvoice] = useState(false);

  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);

  // Abonnement transport à la demande (§billing) : un parent peut décider de s'abonner au moment de
  // l'inscription OU plus tard, en payant les frais scolaires — mêmes options que l'inscription.
  const subscriptionsQuery = useQuery(
    () => (open ? listSubscriptions({ studentId }) : Promise.resolve([])),
    [open, studentId],
  );
  const hasActiveTransport = (subscriptionsQuery.data ?? []).some((s) => s.status === "ACTIVE");
  const routesQuery = useQuery(
    () => (open && !hasActiveTransport ? listRoutes() : Promise.resolve([])),
    [open, hasActiveTransport],
  );
  const [wantsTransport, setWantsTransport] = useState(false);
  const [routeId, setRouteId] = useState("");
  const [stopId, setStopId] = useState("");
  const [direction, setDirection] = useState<TransportDirection>("BOTH");
  const [subscribingTransport, setSubscribingTransport] = useState(false);
  const stopsQuery = useQuery(
    () => (routeId ? listStops(Number(routeId)) : Promise.resolve([])),
    [routeId],
  );

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
    } catch (err) { notifyError(err); } finally { setCreatingInvoice(false); }
  }

  async function subscribeTransport() {
    if (!routeId) return;
    setSubscribingTransport(true);
    try {
      await subscribe({ routeId: Number(routeId), stopId: stopId ? Number(stopId) : null, studentId, direction });
      notifySuccess("Élève abonné au transport — les factures se génèrent selon le frais de la ligne");
      setWantsTransport(false);
      setRouteId(""); setStopId("");
      subscriptionsQuery.refetch();
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSubscribingTransport(false); }
  }

  const monthlyUngenerated = ungeneratedRecurringFees.find((f) => f.type === "MONTHLY");

  async function generateMonths(fee: SchoolFee) {
    setGeneratingFeeId(fee.id);
    try {
      const created = await generateMonthlyInvoices(tenantId, studentId, fee.id);
      const label = fee.type === "OTHER" && fee.label ? fee.label : FEE_TYPE_LABEL[fee.type];
      notifySuccess(created.length > 0 ? `${created.length} tranche(s) de « ${label} » générée(s)` : `Tranches de « ${label} » déjà générées`);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setGeneratingFeeId(null); }
  }

  // Auto-génère les tranches de mensualité dès l'ouverture (utile juste après une inscription) : la
  // scolarité s'applique à tout élève inscrit, contrairement à la cantine (optionnelle, qui reste
  // manuelle) — le comptable n'a plus besoin de cliquer « Générer les tranches » pour la voir
  // apparaître. Le bouton manuel reste affiché en repli si l'auto-génération échoue (réseau...).
  const autoGeneratedRef = useRef(false);
  useEffect(() => { if (!open) autoGeneratedRef.current = false; }, [open]);
  useEffect(() => {
    if (!open || autoGeneratedRef.current || !monthlyUngenerated) return;
    if (q.loading || fees.loading || installments.loading) return;
    autoGeneratedRef.current = true;
    // Défère hors du corps synchrone de l'effet (generateMonths appelle setState dès sa première
    // ligne, avant tout await) — évite les rendus en cascade pendant le commit de cet effet.
    queueMicrotask(() => void generateMonths(monthlyUngenerated));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generateMonths is a stable in-scope function declaration
  }, [open, monthlyUngenerated, q.loading, fees.loading, installments.loading]);

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
    const w = window.open("", "_blank", "noopener,noreferrer,width=420,height=560");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>Reçu provisoire</title>
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
    w.document.close();
    w.focus();
    w.print();
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Facture & encaissement">
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
            {payable.length > 0 && (
              <InvoiceCollect
                invoices={payable}
                labelFor={labelFor}
                installmentMonths={installmentMonths}
                monthlyFeeId={monthlyFee?.id ?? null}
                tenantId={tenantId}
                studentId={studentId}
                onShowPdf={(inv) => showPdf(`Facture ${inv.reference}`, () => getInvoicePdfObjectUrl(inv.id))}
                onPaid={(paymentId) => showPdf("Reçu de paiement", () => getReceiptPdfObjectUrl(paymentId))}
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
                généré une première fois pour cet élève. */}
            {ungeneratedRecurringFees.map((fee) => {
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

            {payable.length === 0 && ungeneratedRecurringFees.length === 0 && (
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
          </div>
        )}
      </Modal>

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
  invoices, labelFor, installmentMonths, monthlyFeeId, tenantId, studentId, onShowPdf, onPaid, onDone,
}: {
  invoices: Invoice[];
  labelFor: (inv: Invoice) => string;
  /** Mois "YYYY-MM" couverts par tranche (installmentId → mois), pour le détail et le paiement par mois. */
  installmentMonths: Map<number, string[]>;
  /** Id du frais MENSUALITE (scolarité) — sert à isoler les tranches pour la remise année complète. */
  monthlyFeeId: number | null;
  tenantId: number;
  studentId: number;
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
    const coveredMonths = installmentMonths.get(m.installmentId ?? -1) ?? [];
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
      if (pollTriesRef.current >= 40) {
        clearInterval(t);
        setOnlineWaiting(false);
      }
    }, 4000);
    return () => clearInterval(t);
  }, [onlineWaiting, onDone]);

  async function collect() {
    // paidMonths : sur une tranche multi-mois, précise quels mois sont réglés par cette part — pour
    // que la facture affiche « Tranche 1 — avril, mai réglés » plutôt qu'un simple solde, y compris
    // quand le règlement ne couvre qu'une partie des mois cochés à l'écran.
    const shares = selectedInvoices.map((m) => {
      const coveredMonths = installmentMonths.get(m.installmentId ?? -1) ?? [];
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
      if (attempt.outcome === "queued") {
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
          const coveredMonths = installmentMonths.get(m.installmentId ?? -1) ?? [];
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
                        <span className="ml-1.5 text-xs font-medium text-success-600" title={m.discountReason ?? undefined}>
                          (remise −{formatGNF(m.discountAmount)})
                        </span>
                      )}
                      {m.platformFeeAmount != null && Number(m.platformFeeAmount) > 0 && (
                        <span className="ml-1.5 text-xs text-slate-400">
                          (dont frais plateforme {formatGNF(m.platformFeeAmount)})
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
          <Select className="sm:w-56" value={channel} onChange={(e) => setChannel(e.target.value as PaymentChannel)}>
            {PAYMENT_CHANNELS.map((c) => (<option key={c.value} value={c.value}>{c.label}</option>))}
          </Select>
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
