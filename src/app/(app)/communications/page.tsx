"use client";

import { useMemo, useState } from "react";
import { Send, Users } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listUsers } from "@/lib/api/iam";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import { listParentsWithPlatformAccess } from "@/lib/api/parents";
import { listTeachers } from "@/lib/api/staff";
import {
  deleteCommunication,
  getCommunicationRecipients,
  listCommunicationsByTenant,
  listTemplates,
  markRecipientDelivered,
  markRecipientFailed,
  markRecipientRead,
  sendCommunication,
  sendDiffusion,
} from "@/lib/api/communication";
import {
  BROADCAST_AUDIENCE_LABEL,
  CHANNEL_LABEL,
  DELIVERY_STATUS_LABEL,
  REASON_LABEL,
  RECIPIENT_TYPE_LABEL,
  type BroadcastAudience,
  type Communication,
  type CommunicationChannel,
  type CommunicationReason,
  type DeliveryStatus,
  type RecipientType,
} from "@/lib/types/communication";
import { ApiError } from "@/lib/api/errors";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { smsSegmentInfo } from "@/lib/format";

const DELIVERY_TONE: Record<DeliveryStatus, "amber" | "green" | "red"> = { PENDING: "amber", DELIVERED: "green", FAILED: "red" };

export default function CommunicationsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canSend = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER");

  const [channel, setChannel] = useState<CommunicationChannel | "">("");
  const q = useQuery(() => (tenantId ? listCommunicationsByTenant(tenantId) : Promise.resolve([])), [tenantId]);
  const [composing, setComposing] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [detail, setDetail] = useState<Communication | null>(null);

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  const rows = (q.data ?? []).filter((c) => !channel || c.channel === channel);

  // Statistiques d'envoi SMS — nombre d'envois (pas nécessairement de destinataires individuels : une
  // diffusion groupée compte comme un seul envoi même si elle touche plusieurs dizaines de parents).
  const smsAll = (q.data ?? []).filter((c) => c.channel === "SMS");
  const smsCountByRecipient = (type: RecipientType) => smsAll.filter((c) => c.recipientType === type).length;

  function remove(c: Communication) {
    confirmAction({ title: "Supprimer le message", message: "Supprimer cette communication ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteCommunication(c.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Communication</h1>
          <p className="text-sm text-gray-500">SMS, e-mail et WhatsApp aux familles et au personnel</p>
        </div>
        {canSend && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setBroadcasting(true)} leftSection={<Users className="h-4 w-4" />}>
              Diffusion segmentée
            </Button>
            <Button onClick={() => setComposing(true)} leftSection={<Send className="h-4 w-4" />}>Nouveau message</Button>
          </div>
        )}
      </Reveal>

      {q.loading ? null : (
        <Reveal y={12}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="SMS envoyés (total)" value={smsAll.length} icon={Send} accent="teal" />
            <StatCard title="Aux parents" value={smsCountByRecipient("PARENT")} icon={Users} accent="indigo" />
            <StatCard title="Aux enseignants" value={smsCountByRecipient("TEACHER")} icon={Users} accent="amber" />
            <StatCard title="Au personnel (diffusions groupées)" value={smsCountByRecipient("GROUP")} icon={Users} accent="rose"
              hint="Nombre d'envois, pas de destinataires individuels" />
          </div>
        </Reveal>
      )}

      <Select className="max-w-[180px]" value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel | "")}>
        <option value="">Tous les canaux</option>
        {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
      </Select>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Date</TH><TH className="hidden sm:table-cell">Canal</TH><TH>Motif</TH><TH className="hidden sm:table-cell">Destinataires</TH><TH>Sujet</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucun message.</TD></TR>}
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="text-gray-500">{c.sentAt?.slice(0, 16).replace("T", " ") ?? "—"}</TD>
                <TD className="hidden sm:table-cell"><Badge tone="indigo">{CHANNEL_LABEL[c.channel]}</Badge></TD>
                <TD>{REASON_LABEL[c.reason]}</TD>
                <TD className="hidden sm:table-cell">{RECIPIENT_TYPE_LABEL[c.recipientType]}</TD>
                <TD className="text-gray-700">{c.subject ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>Détail</Button>
                    {canSend && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(c)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={composing} onClose={() => setComposing(false)} title="Nouveau message">
        <ComposeForm tenantId={tenantId} senderId={user?.userId ?? null}
          onCancel={() => setComposing(false)} onSent={() => { setComposing(false); notifySuccess("Message envoyé"); q.refetch(); }} />
      </Modal>

      <Modal open={broadcasting} onClose={() => setBroadcasting(false)} title="Diffusion segmentée">
        <BroadcastForm tenantId={tenantId} senderId={user?.userId ?? null}
          onCancel={() => setBroadcasting(false)} onSent={() => { setBroadcasting(false); q.refetch(); }} />
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} title="Détail de livraison">
        {detail && <DeliveryDetail communication={detail} canManage={canSend} />}
      </Modal>
    </div>
  );
}

/** Une personne sélectionnable dans la liste des destinataires, quelle que soit sa source (parent,
 * enseignant, ou compte utilisateur générique) — {@code destination} est déjà résolue (téléphone pour
 * SMS/WhatsApp, e-mail pour EMAIL) pour que l'envoi parte réellement dès la sélection, au lieu de
 * rester bloqué faute de contact (voir CommunicationService : un destinataire sans destination reste
 * indéfiniment "en attente", jamais transmis au fournisseur SMS/e-mail). */
type RecipientCandidate = { key: string; name: string; sub: string; userId: number | null; destination: string | null };

function ComposeForm({ tenantId, senderId, onCancel, onSent }: {
  tenantId: number; senderId: number | null; onCancel: () => void; onSent: () => void;
}) {
  const templatesQuery = useQuery(() => listTemplates(tenantId), []);
  const [loading, setLoading] = useState(false);

  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [recipientType, setRecipientType] = useState<RecipientType>("PARENT");
  const [reason, setReason] = useState<CommunicationReason>("GENERAL");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [recipientKeys, setRecipientKeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");

  // Selon le type choisi, la liste vient d'une source différente : les parents et enseignants sont
  // des fiches métier (students/staff), pas forcément liées à un compte plateforme, contrairement aux
  // élèves/groupes qui restent sur la liste générique des utilisateurs. Pour « Parent », seuls ceux
  // dont un enfant a accepté l'accès plateforme sont proposés — et présélectionnés automatiquement
  // (voir plus bas) : plus besoin de tous les cocher un par un dans la barre de recherche.
  const parentsQuery = useQuery(() => (recipientType === "PARENT" ? listParentsWithPlatformAccess() : Promise.resolve([])), [recipientType]);
  const teachersQuery = useQuery(() => (recipientType === "TEACHER" ? listTeachers() : Promise.resolve([])), [recipientType]);
  const usersQuery = useQuery(
    () => (recipientType === "STUDENT" || recipientType === "GROUP" ? listUsers(0, 300).then((p) => p.content) : Promise.resolve([])),
    [recipientType],
  );
  const sourceLoading = parentsQuery.loading || teachersQuery.loading || usersQuery.loading;

  const candidates: RecipientCandidate[] = useMemo(() => {
    const destinationFor = (phone: string | null, email: string | null) => (channel === "EMAIL" ? email : phone);
    if (recipientType === "PARENT") {
      return (parentsQuery.data ?? []).map((p) => ({
        key: `p-${p.id}`, name: `${p.firstName} ${p.lastName}`,
        sub: [p.phone, p.email].filter(Boolean).join(" · "),
        userId: null, destination: destinationFor(p.phone, p.email),
      }));
    }
    if (recipientType === "TEACHER") {
      return (teachersQuery.data ?? []).map((t) => ({
        key: `t-${t.id}`, name: `${t.firstName} ${t.lastName}`,
        sub: [t.phone, t.email].filter(Boolean).join(" · "),
        userId: t.userId, destination: destinationFor(t.phone, t.email),
      }));
    }
    return (usersQuery.data ?? []).map((u) => ({
      key: `u-${u.id}`, name: `${u.firstName} ${u.lastName}`,
      sub: [u.phone, u.email].filter(Boolean).join(" · "),
      userId: u.id, destination: destinationFor(u.phone, u.email),
    }));
  }, [recipientType, parentsQuery.data, teachersQuery.data, usersQuery.data, channel]);

  // Dès que « Parent » est choisi et que la liste (avec accès plateforme) est chargée, tous les
  // parents joignables sont présélectionnés — la recherche ci-dessous ne sert plus qu'à retirer
  // quelqu'un si besoin, elle n'est plus une étape obligatoire pour pouvoir envoyer. Ajustement
  // pendant le rendu (pas dans un Effect) : évite un rendu intermédiaire sans sélection avant que
  // l'Effect ne s'exécute — le motif recommandé par React pour « réinitialiser un état quand une
  // valeur change », voir react.dev/learn/you-might-not-need-an-effect.
  const [autoSelectedForParents, setAutoSelectedForParents] = useState(false);
  if (recipientType === "PARENT" && !parentsQuery.loading && !autoSelectedForParents) {
    setAutoSelectedForParents(true);
    setRecipientKeys(candidates.filter((c) => c.destination).map((c) => c.key));
  } else if (recipientType !== "PARENT" && autoSelectedForParents) {
    // Permet de re-déclencher la présélection si l'utilisateur repasse sur « Parent » plus tard.
    setAutoSelectedForParents(false);
  }

  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? candidates.filter((c) => `${c.name} ${c.sub}`.toLowerCase().includes(q)) : candidates;
  }, [candidates, search]);

  function toggleRecipient(key: string) {
    setRecipientKeys((prev) => (prev.includes(key) ? prev.filter((x) => x !== key) : [...prev, key]));
  }

  function applyTemplate(id: string) {
    const t = (templatesQuery.data ?? []).find((x) => String(x.id) === id);
    if (!t) return;
    setChannel(t.channel); setReason(t.reason); setSubject(t.subject ?? ""); setContent(t.body);
  }

  async function submit() {
    if (!content.trim()) { notifyError("Message requis"); return; }
    const selected = candidates.filter((c) => recipientKeys.includes(c.key));
    if (selected.length === 0) { notifyError("Sélectionnez au moins un destinataire"); return; }
    setLoading(true);
    try {
      await sendCommunication({
        tenantId, senderId, channel, recipientType,
        subject: subject || null, content, reason,
        // Toujours envoyer via la destination déjà résolue (téléphone/e-mail) quand elle existe — un
        // recipientUserId seul ne suffit pas à déclencher l'envoi réel (voir commentaire plus haut) ;
        // repli sur l'id utilisateur uniquement pour les rares cas sans contact connu.
        recipientUserIds: selected.filter((c) => !c.destination && c.userId != null).map((c) => c.userId as number),
        recipientDestinations: selected.filter((c) => c.destination).map((c) => c.destination as string),
      });
      onSent();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {(templatesQuery.data ?? []).length > 0 && (
        <Field>
          <Label>Modèle (optionnel)</Label>
          <Select onChange={(e) => applyTemplate(e.target.value)}>
            <option value="">— Aucun —</option>
            {(templatesQuery.data ?? []).map((t) => (<option key={t.id} value={t.id}>{REASON_LABEL[t.reason]} · {CHANNEL_LABEL[t.channel]}</option>))}
          </Select>
        </Field>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field>
          <Label>Canal</Label>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
            {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Type</Label>
          <Select value={recipientType} onChange={(e) => { setRecipientType(e.target.value as RecipientType); setRecipientKeys([]); setSearch(""); }}>
            {(Object.keys(RECIPIENT_TYPE_LABEL) as RecipientType[]).map((c) => (<option key={c} value={c}>{RECIPIENT_TYPE_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Motif</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as CommunicationReason)}>
            {(Object.keys(REASON_LABEL) as CommunicationReason[]).map((c) => (<option key={c} value={c}>{REASON_LABEL[c]}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>
          Destinataires <span className="text-error-500">*</span>
          {recipientKeys.length > 0 && <span className="ml-1.5 font-normal text-gray-400">({recipientKeys.length} sélectionné(s))</span>}
        </Label>
        {recipientType === "PARENT" && (
          <p className="mb-1.5 text-xs text-gray-400">
            Tous les parents joignables ayant accès à la plateforme sont déjà sélectionnés — décochez-en
            au besoin, aucune sélection manuelle n&apos;est requise.
          </p>
        )}
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher par nom ou numéro..." className="mb-2" />
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {sourceLoading ? (
            <p className="px-1 py-2 text-sm text-gray-400">Chargement…</p>
          ) : filteredCandidates.length === 0 ? (
            <p className="px-1 py-2 text-sm text-gray-400">Aucun résultat.</p>
          ) : (
            filteredCandidates.map((c) => (
              <label key={c.key} className={`flex items-center gap-2 text-sm ${c.destination ? "cursor-pointer" : "cursor-not-allowed opacity-50"}`}>
                <input type="checkbox" disabled={!c.destination} checked={recipientKeys.includes(c.key)} onChange={() => toggleRecipient(c.key)}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
                {c.name} {c.sub && <span className="text-gray-400">({c.sub})</span>}
                {!c.destination && <span className="text-xs text-error-500">— {channel === "EMAIL" ? "pas d'e-mail" : "pas de numéro"}</span>}
              </label>
            ))
          )}
        </div>
      </Field>
      <Field><Label>Sujet</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field>
        <Label>Message <span className="text-error-500">*</span></Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      {channel === "SMS" && <SmsCounter text={content} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Envoyer</Button>
      </div>
    </div>
  );
}

/** Compteur de caractères + segments SMS (facturation par segment de 160/70 caractères) — visible sur
 * tout composeur pour que l'école respecte le nombre de caractères avant d'envoyer. */
function SmsCounter({ text }: { text: string }) {
  const info = smsSegmentInfo(text);
  return (
    <p className={`-mt-2 text-xs ${info.segments > 1 ? "text-warning-600" : "text-gray-400"}`}>
      {info.length} caractère{info.length > 1 ? "s" : ""} — {info.unicode ? "avec accents (70/SMS)" : "sans accent (160/SMS)"}
      {info.segments > 1 && ` — sera envoyé en ${info.segments} SMS (facturés séparément)`}
    </p>
  );
}

const CLASS_AUDIENCES: BroadcastAudience[] = ["CLASS_PARENTS", "CLASS_PARENTS_BOYS", "CLASS_PARENTS_GIRLS"];

function BroadcastForm({ tenantId, senderId, onCancel, onSent }: {
  tenantId: number; senderId: number | null; onCancel: () => void; onSent: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (currentYearId ? listClasses(currentYearId) : Promise.resolve([])), [currentYearId]);
  const classOptions: SearchableOption[] = useMemo(
    () => (classesQuery.data ?? []).map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classesQuery.data],
  );

  const studentsQuery = useCachedQuery(`students-all:${tenantId}`, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const studentOptions: SearchableOption[] = useMemo(
    () => (studentsQuery.data ?? []).map((s) => {
      const label = `${s.firstName} ${s.lastName} (${s.studentNumber})`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
    [studentsQuery.data],
  );

  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [audience, setAudience] = useState<BroadcastAudience>("ALL_PARENTS");
  const [reason, setReason] = useState<CommunicationReason>("GENERAL");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");

  const needsClass = CLASS_AUDIENCES.includes(audience);
  const needsStudent = audience === "STUDENT_PARENTS";

  async function submit() {
    if (!content.trim()) { notifyError("Message requis"); return; }
    if (needsClass && !classId) { notifyError("Sélectionnez une classe"); return; }
    if (needsStudent && !studentId) { notifyError("Sélectionnez un élève"); return; }
    setLoading(true);
    try {
      await sendDiffusion({
        tenantId, senderId, channel, audience, reason,
        classId: needsClass ? Number(classId) : null,
        studentId: needsStudent ? Number(studentId) : null,
        subject: subject || null, content,
      });
      notifySuccess("Diffusion envoyée");
      onSent();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        notifyError("Aucun destinataire joignable pour cette audience (numéro/e-mail manquant).");
      } else {
        notifyError(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Canal</Label>
          <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
            {(Object.keys(CHANNEL_LABEL) as CommunicationChannel[]).map((c) => (<option key={c} value={c}>{CHANNEL_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Motif</Label>
          <Select value={reason} onChange={(e) => setReason(e.target.value as CommunicationReason)}>
            {(Object.keys(REASON_LABEL) as CommunicationReason[]).map((c) => (<option key={c} value={c}>{REASON_LABEL[c]}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Audience <span className="text-error-500">*</span></Label>
        <Select value={audience} onChange={(e) => setAudience(e.target.value as BroadcastAudience)}>
          {(Object.keys(BROADCAST_AUDIENCE_LABEL) as BroadcastAudience[]).map((a) => (
            <option key={a} value={a}>{BROADCAST_AUDIENCE_LABEL[a]}</option>
          ))}
        </Select>
      </Field>
      {needsClass && (
        <Field>
          <Label>Classe <span className="text-error-500">*</span></Label>
          <SearchableSelect value={classId} options={classOptions} onChange={setClassId}
            triggerClassName="w-full justify-between px-3" noResultsLabel="Aucune classe" />
        </Field>
      )}
      {needsStudent && (
        <Field>
          <Label>Élève <span className="text-error-500">*</span></Label>
          <SearchableSelect value={studentId} options={studentOptions} onChange={setStudentId}
            triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun élève" />
        </Field>
      )}
      <Field><Label>Sujet</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field>
        <Label>Message <span className="text-error-500">*</span></Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      {channel === "SMS" && <SmsCounter text={content} />}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Diffuser</Button>
      </div>
    </div>
  );
}

function DeliveryDetail({ communication, canManage }: { communication: Communication; canManage: boolean }) {
  const q = useQuery(() => getCommunicationRecipients(communication.id), [communication.id]);
  const [busyId, setBusyId] = useState<number | null>(null);

  async function act(id: number, fn: (id: number) => Promise<unknown>, label: string) {
    setBusyId(id);
    try { await fn(id); notifySuccess(label); q.refetch(); }
    catch (err) { notifyError(err); } finally { setBusyId(null); }
  }

  if (q.loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const recipients = q.data ?? [];
  const delivered = recipients.filter((r) => r.deliveryStatus === "DELIVERED").length;
  const readCount = recipients.filter((r) => r.read).length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">{communication.content}</p>
      {recipients.length > 0 && (
        <p className="text-xs text-gray-400">{recipients.length} destinataire(s) — {delivered} livré(s), {readCount} lu(s)</p>
      )}
      <Table>
        <THead><tr><TH>Destinataire</TH><TH>Statut</TH><TH>Lu</TH>{canManage && <TH className="text-right">Marquer</TH>}</tr></THead>
        <TBody>
          {recipients.length === 0 && <TR><TD colSpan={canManage ? 4 : 3} className="py-6 text-center text-gray-400">Aucun destinataire.</TD></TR>}
          {recipients.map((r) => (
            <TR key={r.id}>
              <TD>{r.destination ?? "—"}</TD>
              <TD><Badge tone={DELIVERY_TONE[r.deliveryStatus]}>{DELIVERY_STATUS_LABEL[r.deliveryStatus]}</Badge></TD>
              <TD>{r.read ? "Oui" : "Non"}</TD>
              {canManage && (
                <TD className="text-right">
                  <div className="inline-flex gap-1">
                    {r.deliveryStatus === "PENDING" && (
                      <>
                        <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => act(r.id, markRecipientDelivered, "Marqué comme livré")}>Livré</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" loading={busyId === r.id} onClick={() => act(r.id, markRecipientFailed, "Marqué en échec")}>Échec</Button>
                      </>
                    )}
                    {!r.read && (
                      <Button size="sm" variant="ghost" loading={busyId === r.id} onClick={() => act(r.id, markRecipientRead, "Marqué comme lu")}>Lu</Button>
                    )}
                  </div>
                </TD>
              )}
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}
