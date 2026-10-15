"use client";

import { useMemo, useRef, useState } from "react";
import { Printer, Send } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { listPaymentReminderCandidates, printPaymentStatusList, sendCommunication } from "@/lib/api/communication";
import {
  CHANNEL_LABEL,
  PAYMENT_REMINDER_STATUS_LABEL,
  type CommunicationChannel,
  type PaymentReminderCandidate,
  type PaymentReminderStatus,
} from "@/lib/types/communication";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Field, Label, Textarea } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Reveal } from "@/components/public/reveal";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilePreview } from "@/components/ui/file-preview";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF, smsSegmentInfo } from "@/lib/format";

const STATUS_TONE: Record<PaymentReminderStatus, "red" | "amber" | "green"> = {
  OVERDUE: "red", UPCOMING: "amber", UP_TO_DATE: "green",
};

const ALL_CLASSES = "ALL";

/**
 * Pour une classe choisie, tous ses élèves avec leur statut de paiement de la mensualité (à jour/
 * retard/échéance proche) et leur progression en tranches — triables/filtrables pour cibler une
 * relance SMS précise (demande utilisateur), plutôt que l'envoi automatique "tous les retardataires"
 * de l'onglet Messages (diffusion segmentée), qui ne permet pas de choisir au cas par cas.
 */
export default function PaymentRemindersPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (currentYearId ? listClasses(currentYearId) : Promise.resolve([])), [currentYearId]);
  const classOptions: SearchableOption[] = useMemo(
    () => (classesQuery.data ?? []).map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classesQuery.data],
  );

  // ALL_CLASSES ("Toutes les classes") par défaut : plus besoin de choisir une classe avant de voir
  // la liste (§retour comptable — "sur la liste des élèves il veut filtrer par classe" implique
  // pouvoir aussi NE PAS filtrer par classe, pour voir tout le monde d'un coup).
  const [classId, setClassId] = useState(ALL_CLASSES);
  const [statusFilter, setStatusFilter] = useState<PaymentReminderStatus | "ALL">("ALL");
  const [trancheFilter, setTrancheFilter] = useState<"ALL" | number>("ALL");

  const q = useQuery(
    () => listPaymentReminderCandidates(classId === ALL_CLASSES ? null : Number(classId)),
    [classId],
  );
  const [selected, setSelected] = useState<PaymentReminderCandidate[]>([]);
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  const [printing, setPrinting] = useState(false);

  // Nombre réel de tranches payées observé dans les données chargées — un élève peut en avoir payé
  // plus que le nombre de tranches configuré pour SA classe (ex. 6 pour une mensualité annuelle),
  // donc l'éventail d'options proposées s'adapte à ce qui existe vraiment plutôt qu'une borne fixe.
  const maxTranchesPaid = Math.max(0, ...(q.data ?? []).map((r) => r.tranchesPaid));

  const rows = (q.data ?? []).filter((r) => {
    if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
    if (trancheFilter === "ALL") return true;
    return r.tranchesPaid === trancheFilter;
  });

  async function printList() {
    if (selected.length === 0) return;
    setPrinting(true);
    try {
      const url = await printPaymentStatusList(classId === ALL_CLASSES ? null : Number(classId), selected.map((s) => s.studentId));
      setPreview({ url, title: `Suivi des paiements — ${selected.length} élève(s)` });
    } catch (err) {
      notifyError(err);
    } finally {
      setPrinting(false);
    }
  }

  const columns: Column<PaymentReminderCandidate>[] = [
    {
      key: "studentName", header: "Élève", sortable: true, accessor: (r) => r.studentName,
      render: (r) => <span className="font-medium text-gray-900">{r.studentName}</span>,
    },
    {
      key: "className", header: "Classe", sortable: true, accessor: (r) => r.className ?? "",
      render: (r) => <span className="text-gray-600">{r.className ?? "—"}</span>,
    },
    {
      key: "status", header: "Statut", sortable: true, accessor: (r) => r.status,
      render: (r) => <Badge tone={STATUS_TONE[r.status]}>{PAYMENT_REMINDER_STATUS_LABEL[r.status]}</Badge>,
    },
    {
      key: "daysLate", header: "Jours", sortable: true, align: "right", accessor: (r) => r.daysLate,
      render: (r) => {
        if (r.status === "UP_TO_DATE") return <span className="text-gray-400">—</span>;
        return (
          <span className={r.daysLate > 0 ? "font-medium text-error-600" : "text-gray-600"}>
            {r.daysLate > 0 ? `${r.daysLate} j de retard` : `${Math.abs(r.daysLate)} j restant(s)`}
          </span>
        );
      },
    },
    {
      key: "amountDue", header: "Montant dû", sortable: true, align: "right", accessor: (r) => Number(r.amountDue),
      render: (r) => (Number(r.amountDue) > 0 ? formatGNF(r.amountDue) : <span className="text-gray-400">—</span>),
    },
    {
      key: "tranchesPaid", header: "Tranches", sortable: true, align: "right", accessor: (r) => r.tranchesPaid,
      render: (r) => (r.totalTranches > 0 ? `${r.tranchesPaid}/${r.totalTranches}` : <span className="text-gray-400">—</span>),
    },
    {
      key: "parents", header: "Destinataires",
      render: (r) => (
        <span className="text-xs text-gray-500">
          {r.parents.length > 0 ? r.parents.map((p) => `${p.name} (${p.phone})`).join(", ") : "—"}
        </span>
      ),
    },
  ];

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Relances paiement</h1>
        <p className="text-sm text-gray-500">
          Toutes les classes par défaut, ou choisissez-en une — triez/filtrez par statut et tranches
          payées avant d&apos;envoyer un SMS ou d&apos;imprimer la liste.
        </p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <Field>
          <Label>Classe</Label>
          <SearchableSelect value={classId} options={[{ value: ALL_CLASSES, trigger: "Toutes les classes", label: "Toutes les classes", searchText: "toutes" }, ...classOptions]} onChange={setClassId}
            triggerClassName="w-56 justify-between px-3" noResultsLabel="Aucune classe" />
        </Field>
        <Field>
          <Label>Statut</Label>
          <Select className="w-44" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as PaymentReminderStatus | "ALL")}>
            <option value="ALL">Tous</option>
            {(Object.keys(PAYMENT_REMINDER_STATUS_LABEL) as PaymentReminderStatus[]).map((s) => (
              <option key={s} value={s}>{PAYMENT_REMINDER_STATUS_LABEL[s]}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Tranches payées</Label>
          <Select className="w-44" value={trancheFilter} onChange={(e) => setTrancheFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))}>
            <option value="ALL">Toutes</option>
            {Array.from({ length: maxTranchesPaid + 1 }, (_, n) => (
              <option key={n} value={n}>{n === 0 ? "Aucune tranche payée" : `${n} tranche${n > 1 ? "s" : ""} payée${n > 1 ? "s" : ""}`}</option>
            ))}
          </Select>
        </Field>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={q.loading}
        error={!!q.error}
        getRowKey={(r) => r.studentId}
        emptyLabel="Aucun élève ne correspond à ces filtres."
        searchable
        searchPlaceholder="Rechercher un élève..."
        selectable
        onSelectionChange={setSelected}
        toolbar={
          <>
            <Button size="sm" variant="secondary" disabled={selected.length === 0} loading={printing}
              leftSection={<Printer className="h-4 w-4" />} onClick={() => void printList()}>
              Imprimer {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
            <Button size="sm" disabled={selected.length === 0} leftSection={<Send className="h-4 w-4" />} onClick={() => setSending(true)}>
              Relancer {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </>
        }
      />

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} autoPrint />

      <Modal open={sending} onClose={() => setSending(false)} title={`Relance SMS — ${selected.length} élève(s)`}>
        <ReminderSendForm tenantId={tenantId} senderId={user?.userId ?? null} candidates={selected}
          onCancel={() => setSending(false)}
          onSent={() => { setSending(false); notifySuccess("Relance envoyée"); }} />
      </Modal>
    </div>
  );
}

function ReminderSendForm({ tenantId, senderId, candidates, onCancel, onSent }: {
  tenantId: number; senderId: number | null; candidates: PaymentReminderCandidate[];
  onCancel: () => void; onSent: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [content, setContent] = useState(
    "Rappel : des frais de scolarité restent dus. Merci de régulariser dans les meilleurs délais. Contactez l'école pour toute question.",
  );

  // Numéros dédupliqués de tous les parents des élèves sélectionnés (un parent avec plusieurs enfants
  // concernés ne reçoit le SMS qu'une seule fois).
  const destinations = useMemo(() => {
    const phones = new Set<string>();
    candidates.forEach((c) => c.parents.forEach((p) => phones.add(p.phone)));
    return [...phones];
  }, [candidates]);

  async function submit() {
    if (submittingRef.current) return;
    if (!content.trim()) { notifyError("Message requis"); return; }
    if (destinations.length === 0) { notifyError("Aucun contact joignable"); return; }
    submittingRef.current = true;
    setLoading(true);
    try {
      await sendCommunication({
        tenantId, senderId, channel, recipientType: "PARENT",
        subject: null, content, reason: "PAYMENT_DUE",
        recipientUserIds: [], recipientDestinations: destinations,
        idempotencyKey,
      });
      onSent();
    } catch (err) { notifyError(err); } finally { submittingRef.current = false; setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">{destinations.length} contact(s) parent(s) joignable(s) au total.</p>
      <Field>
        <Label>Canal</Label>
        <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
          {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Message <span className="text-error-500">*</span></Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      {channel === "SMS" && (() => {
        const info = smsSegmentInfo(content);
        return (
          <p className={`-mt-2 text-xs ${info.segments > 1 ? "text-warning-600" : "text-gray-400"}`}>
            {info.length} caractère{info.length > 1 ? "s" : ""} — {info.unicode ? "avec accents (70/SMS)" : "sans accent (160/SMS)"}
            {info.segments > 1 && ` — sera envoyé en ${info.segments} SMS (facturés séparément)`}
          </p>
        );
      })()}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={() => confirmAction({
          title: "Envoyer la relance",
          message: `Envoyer ce message à ${destinations.length} contact(s) ?`,
          confirmLabel: "Envoyer",
          onConfirm: submit,
        })} loading={loading}>Envoyer</Button>
      </div>
    </div>
  );
}
