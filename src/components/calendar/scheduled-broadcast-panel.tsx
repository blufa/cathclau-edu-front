"use client";

import { useMemo, useState } from "react";
import { CalendarClock, Plus, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import { cancelScheduledBroadcast, listScheduledBroadcasts, scheduleBroadcast } from "@/lib/api/communication";
import {
  BROADCAST_AUDIENCE_LABEL,
  CHANNEL_LABEL,
  REASON_LABEL,
  SCHEDULED_BROADCAST_STATUS_LABEL,
  type BroadcastAudience,
  type CommunicationChannel,
  type CommunicationReason,
  type ScheduledBroadcast,
  type ScheduledBroadcastStatus,
} from "@/lib/types/communication";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { smsSegmentInfo } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const CLASS_AUDIENCES: BroadcastAudience[] = ["CLASS_PARENTS", "CLASS_PARENTS_BOYS", "CLASS_PARENTS_GIRLS"];

const STATUS_TONE: Record<ScheduledBroadcastStatus, "amber" | "green" | "gray" | "red"> = {
  PENDING: "amber", SENT: "green", CANCELLED: "gray", FAILED: "red",
};

/** Événement (école ou calendrier académique) pouvant servir à pré-remplir une diffusion programmée
 * — les deux types d'événements ont des tables distinctes côté backend, mais le lien est purement
 * informatif (pas de contrainte FK), donc un identifiant + libellé + date/heure suffit ici. */
export interface LinkableEvent {
  id: number;
  label: string;
  startDate: string;
  startTime?: string | null;
}

/**
 * Diffusion de masse PROGRAMMÉE : au lieu d'envoyer tout de suite, on choisit une date/heure future
 * (typiquement l'heure de début d'un événement école ou calendrier académique) et le SMS/e-mail part
 * automatiquement à ce moment-là, à toute l'école (élèves/parents, enseignants, personnel) ou une
 * audience plus ciblée.
 */
export function ScheduledBroadcastPanel({ events }: { events: LinkableEvent[] }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const q = useQuery(() => (tenantId ? listScheduledBroadcasts(tenantId) : Promise.resolve([])), [tenantId]);
  const [open, setOpen] = useState(false);

  function cancel(b: ScheduledBroadcast) {
    confirmAction({
      title: "Annuler la diffusion programmée",
      message: `Annuler l'envoi programmé du ${new Date(b.sendAt).toLocaleString("fr-FR")} ?`,
      confirmLabel: "Annuler l'envoi", danger: true,
      onConfirm: async () => {
        try { await cancelScheduledBroadcast(b.id); notifySuccess("Diffusion annulée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  if (!tenantId) return null;
  const items = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-end border-b border-gray-100 px-4 py-3">
          <Button onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" /> Programmer une diffusion</Button>
        </div>
        {q.loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Aucune diffusion programmée.</p>
        ) : (
          <Table>
            <THead>
              <TR><TH>Envoi prévu</TH><TH>Audience</TH><TH>Canal</TH><TH>Message</TH><TH>Statut</TH><TH className="text-right">Actions</TH></TR>
            </THead>
            <TBody>
              {items.map((b) => (
                <TR key={b.id}>
                  <TD className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5 text-gray-400" />{new Date(b.sendAt).toLocaleString("fr-FR")}</span>
                  </TD>
                  <TD>{BROADCAST_AUDIENCE_LABEL[b.audience]}</TD>
                  <TD>{CHANNEL_LABEL[b.channel]}</TD>
                  <TD className="max-w-xs truncate text-sm text-gray-600" title={b.content}>{b.content}</TD>
                  <TD>
                    <Badge tone={STATUS_TONE[b.status]}>{SCHEDULED_BROADCAST_STATUS_LABEL[b.status]}</Badge>
                    {b.status === "FAILED" && b.errorMessage && (
                      <span className="mt-0.5 block max-w-[180px] truncate text-xs text-error-500" title={b.errorMessage}>{b.errorMessage}</span>
                    )}
                  </TD>
                  <TD className="text-right">
                    {b.status === "PENDING" && (
                      <button onClick={() => cancel(b)} aria-label="Annuler" className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title="Programmer une diffusion">
        <ScheduleForm
          tenantId={tenantId}
          senderId={user?.userId ?? null}
          events={events}
          onCancel={() => setOpen(false)}
          onScheduled={() => { setOpen(false); notifySuccess("Diffusion programmée."); q.refetch(); }}
        />
      </Modal>
    </div>
  );
}

function ScheduleForm({ tenantId, senderId, events, onCancel, onScheduled }: {
  tenantId: number; senderId: number | null; events: LinkableEvent[]; onCancel: () => void; onScheduled: () => void;
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
  const studentsQuery = useCachedQuery(`students-all-v2:${tenantId}`, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const studentOptions: SearchableOption[] = useMemo(
    () => (studentsQuery.data ?? []).map((s) => {
      const label = `${s.firstName} ${s.lastName} (${s.studentNumber})`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
    [studentsQuery.data],
  );

  const [schoolEventId, setSchoolEventId] = useState("");
  const [channel, setChannel] = useState<CommunicationChannel>("SMS");
  const [audience, setAudience] = useState<BroadcastAudience>("ALL");
  const [reason, setReason] = useState<CommunicationReason>("GENERAL");
  const [classId, setClassId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [sendDate, setSendDate] = useState("");
  const [sendTime, setSendTime] = useState("08:00");

  const needsClass = CLASS_AUDIENCES.includes(audience);
  const needsStudent = audience === "STUDENT_PARENTS";
  const sms = smsSegmentInfo(content);

  function onPickEvent(id: string) {
    setSchoolEventId(id);
    const evt = events.find((e) => String(e.id) === id);
    if (evt) {
      setSubject(evt.label);
      setSendDate(evt.startDate);
      setSendTime(evt.startTime ? evt.startTime.slice(0, 5) : "08:00");
      if (!content.trim()) setContent(`Rappel : ${evt.label} — le ${evt.startDate}${evt.startTime ? ` à ${evt.startTime.slice(0, 5)}` : ""}.`);
    }
  }

  async function submit() {
    if (!content.trim()) { notifyError("Message requis"); return; }
    if (!sendDate) { notifyError("Date d'envoi requise"); return; }
    if (needsClass && !classId) { notifyError("Sélectionnez une classe"); return; }
    if (needsStudent && !studentId) { notifyError("Sélectionnez un élève"); return; }
    setLoading(true);
    try {
      await scheduleBroadcast({
        tenantId, senderId, channel, audience, reason,
        classId: needsClass ? Number(classId) : null,
        studentId: needsStudent ? Number(studentId) : null,
        subject: subject || null, content,
        sendAt: `${sendDate}T${sendTime}:00`,
        schoolEventId: schoolEventId ? Number(schoolEventId) : null,
      });
      onScheduled();
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        notifyError("Date/heure invalide (doit être dans le futur) ou sélection incomplète pour cette audience.");
      } else {
        notifyError(err);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      {events.length > 0 && (
        <Field>
          <Label>Lier à un événement école (optionnel)</Label>
          <Select value={schoolEventId} onChange={(e) => onPickEvent(e.target.value)}>
            <option value="">— Aucun —</option>
            {events.map((e) => (<option key={e.id} value={e.id}>{e.label} ({e.startDate})</option>))}
          </Select>
          <p className="mt-1 text-xs text-gray-400">Pré-remplit le sujet, la date et l&apos;heure d&apos;envoi.</p>
        </Field>
      )}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Date d&apos;envoi <span className="text-error-500">*</span></Label>
          <DatePicker value={sendDate} onChange={setSendDate} />
        </Field>
        <Field>
          <Label>Heure d&apos;envoi <span className="text-error-500">*</span></Label>
          <Input type="time" value={sendTime} onChange={(e) => setSendTime(e.target.value)} />
        </Field>
      </div>
      <Field><Label>Sujet</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} /></Field>
      <Field>
        <Label>Message <span className="text-error-500">*</span></Label>
        <Textarea rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
      </Field>
      {channel === "SMS" && content && (
        <p className="text-xs text-gray-400">{sms.length} caractère(s) · {sms.segments} SMS {sms.unicode ? "(accents/emoji → 70 car./SMS)" : ""}</p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Programmer</Button>
      </div>
    </div>
  );
}
