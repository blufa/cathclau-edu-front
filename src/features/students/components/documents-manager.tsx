"use client";

import { useState } from "react";
import { Bell, CheckCircle2, CircleAlert, FileText, Plus } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Textarea, Label, Field } from "@/components/ui/input";
import { useQuery } from "@/hooks/use-query";
import {
  addStudentDocument,
  deleteStudentDocument,
  getStudentDocuments,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/api/students";
import { getStudentParents } from "@/lib/api/parents";
import { sendCommunication } from "@/lib/api/communication";
import { CHANNEL_LABEL, type CommunicationChannel } from "@/lib/types/communication";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { FileUpload } from "@/components/ui/file-upload";
import { FilePreview } from "@/components/ui/file-preview";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

// Required vs recommended pieces for a Guinean private-school dossier.
const REQUIRED_DOCS: DocumentType[] = ["BIRTH_CERTIFICATE", "PHOTO"];
const RECOMMENDED_DOCS: DocumentType[] = ["ACADEMIC_RECORD", "MEDICAL_CERTIFICATE"];

/** A student's administrative documents: upload (Cloudinary) + list + delete. */
export function DocumentsManager({ studentId, canWrite }: { studentId: number; canWrite: boolean }) {
  const q = useQuery(() => getStudentDocuments(studentId), [studentId]);
  const parentsQuery = useQuery(() => getStudentParents(studentId), [studentId]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<DocumentType>("BIRTH_CERTIFICATE");
  const [saving, setSaving] = useState(false);
  const [relancing, setRelancing] = useState(false);
  const [relanceOpen, setRelanceOpen] = useState(false);
  const [channel, setChannel] = useState<CommunicationChannel>("EMAIL");
  const [motif, setMotif] = useState("");
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const provided = new Set((q.data ?? []).map((d) => d.documentType));
  const missingRequired = REQUIRED_DOCS.filter((t) => !provided.has(t));

  function openFor(t: DocumentType) {
    setType(t);
    setOpen(true);
  }

  function openRelance() {
    const missing = missingRequired.map((t) => DOCUMENT_TYPE_LABEL[t]).join(", ");
    setMotif(`Bonjour, merci de fournir les pièces manquantes au dossier de votre enfant : ${missing}.`);
    setChannel("EMAIL");
    setRelanceOpen(true);
  }

  async function sendRelance() {
    const recipientUserIds = (parentsQuery.data ?? []).map((p) => p.userId).filter((u): u is number => u != null);
    if (recipientUserIds.length === 0) {
      notifyError("Aucun parent avec un compte — impossible d'envoyer la relance.");
      return;
    }
    if (!motif.trim()) {
      notifyError("Saisissez le motif de la relance.");
      return;
    }
    setRelancing(true);
    try {
      await sendCommunication({
        channel,
        recipientType: "PARENT",
        reason: "GENERAL",
        subject: "Pièces manquantes au dossier",
        content: motif.trim(),
        recipientUserIds,
      });
      notifySuccess("Relance envoyée au(x) parent(s)");
      setRelanceOpen(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setRelancing(false);
    }
  }

  async function onUploaded(url: string | null) {
    if (!url) return;
    setSaving(true);
    try {
      await addStudentDocument(studentId, type, url);
      notifySuccess("Document ajouté");
      setOpen(false);
      q.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  function remove(id: number) {
    confirmAction({
      title: "Supprimer le document", message: "Confirmer la suppression ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteStudentDocument(studentId, id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <Card>
      <CardBody>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Documents administratifs</h3>
          {canWrite && <Button size="sm" onClick={() => setOpen(true)} leftSection={<Plus className="h-4 w-4" />}>Ajouter un document</Button>}
        </div>

        {/* Checklist: required & recommended pieces, with quick-add and parent reminder. */}
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Checklist du dossier · {REQUIRED_DOCS.filter((t) => provided.has(t)).length}/{REQUIRED_DOCS.length} obligatoires
            </p>
            {canWrite && missingRequired.length > 0 && (
              <Button size="sm" variant="outline" onClick={openRelance} leftSection={<Bell className="h-4 w-4" />}>
                Relancer le parent
              </Button>
            )}
          </div>
          <ul className="space-y-1.5">
            {[...REQUIRED_DOCS, ...RECOMMENDED_DOCS].map((t) => {
              const ok = provided.has(t);
              const required = REQUIRED_DOCS.includes(t);
              return (
                <li key={t} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-slate-700">
                    {ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <CircleAlert className={required ? "h-4 w-4 text-amber-500" : "h-4 w-4 text-slate-300"} />}
                    {DOCUMENT_TYPE_LABEL[t]}
                    {required && <span className="text-[10px] font-medium uppercase text-amber-600">obligatoire</span>}
                  </span>
                  {ok ? (
                    <span className="text-xs font-medium text-green-700">Fourni</span>
                  ) : canWrite ? (
                    <button className="text-xs text-brand-700 hover:underline" onClick={() => openFor(t)}>Ajouter</button>
                  ) : (
                    <span className="text-xs text-slate-400">Manquant</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {q.loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : (q.data ?? []).length === 0 ? (
          <p className="text-sm text-slate-400">Aucun document. Cliquez sur « Ajouter un document ».</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {(q.data ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 py-3 text-sm first:pt-0 last:pb-0">
                <span className="flex items-center gap-2 text-slate-700">
                  <FileText className="h-4 w-4 text-slate-400" />
                  {DOCUMENT_TYPE_LABEL[d.documentType as DocumentType] ?? d.documentType}
                </span>
                <div className="flex items-center gap-3">
                  <button className="text-brand-700 hover:underline" onClick={() => setPreview({ url: d.fileUrl, title: DOCUMENT_TYPE_LABEL[d.documentType as DocumentType] ?? d.documentType })}>Aperçu</button>
                  {canWrite && <button className="text-red-600 hover:underline" onClick={() => remove(d.id)}>Suppr.</button>}
                </div>
              </li>
            ))}
          </ul>
        )}

        <Modal open={open} onClose={() => setOpen(false)} title="Ajouter un document">
          <div className="space-y-4">
            <Field>
              <Label>Type de document</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as DocumentType)}>
                {(Object.keys(DOCUMENT_TYPE_LABEL) as DocumentType[]).map((t) => (
                  <option key={t} value={t}>{DOCUMENT_TYPE_LABEL[t]}</option>
                ))}
              </Select>
            </Field>
            <FileUpload
              label="Fichier"
              variant="document"
              folder={`students/${studentId}/documents`}
              accept="image/*,application/pdf"
              value={null}
              onChange={onUploaded}
            />
            {saving && <p className="text-xs text-slate-400">Enregistrement…</p>}
          </div>
        </Modal>

        <Modal open={relanceOpen} onClose={() => setRelanceOpen(false)} title="Relancer le(s) parent(s)">
          <div className="space-y-4">
            <Field>
              <Label>Canal de notification</Label>
              <p className="text-xs text-gray-400">Email disponible. SMS et WhatsApp nécessitent un fournisseur configuré.</p>
              <Select value={channel} onChange={(e) => setChannel(e.target.value as CommunicationChannel)}>
                {(["EMAIL", "SMS", "WHATSAPP"] as CommunicationChannel[]).map((c) => (
                  <option key={c} value={c}>{c === "EMAIL" ? CHANNEL_LABEL[c] : `${CHANNEL_LABEL[c]} (bientôt)`}</option>
                ))}
              </Select>
            </Field>
            <Field>
              <Label>Motif / message</Label>
              <Textarea rows={3} value={motif} onChange={(e) => setMotif(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRelanceOpen(false)}>Annuler</Button>
              <Button loading={relancing} onClick={sendRelance} leftSection={<Bell className="h-4 w-4" />}>Envoyer la relance</Button>
            </div>
          </div>
        </Modal>

        <FilePreview open={!!preview} onClose={() => setPreview(null)} url={preview?.url ?? null} title={preview?.title} />
      </CardBody>
    </Card>
  );
}
