"use client";

import { useMemo, useState } from "react";
import { Stack, Textarea, TextInput } from "@mantine/core";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createAnnouncement,
  deleteAnnouncement,
  listAnnouncements,
  updateAnnouncement,
} from "@/lib/api/announcements";
import { getCurrentAcademicYear, listClasses } from "@/lib/api/academics";
import { searchStudents } from "@/lib/api/students";
import {
  ANNOUNCEMENT_SCOPE_LABEL,
  type Announcement,
  type AnnouncementScope,
} from "@/lib/types/announcement";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatDateTime } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const SCOPE_TONE: Record<AnnouncementScope, "gray" | "amber" | "green"> = {
  GENERAL: "green",
  CLASS: "amber",
  STUDENT: "gray",
};

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER");

  const q = useQuery(listAnnouncements, []);
  const yearQuery = useQuery(getCurrentAcademicYear, []);
  const yearId = yearQuery.data?.id ?? null;
  const classesQuery = useQuery(
    () => (yearId ? listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);

  const classes = classesQuery.data ?? [];
  const students = useMemo(() => studentsQuery.data?.content ?? [], [studentsQuery.data]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [scope, setScope] = useState<AnnouncementScope>("GENERAL");
  const [classId, setClassId] = useState<string>("");
  const [studentId, setStudentId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setContent("");
    setScope("GENERAL");
    setClassId("");
    setStudentId("");
    setModalOpen(true);
  }

  function openEdit(a: Announcement) {
    setEditing(a);
    setTitle(a.title);
    setContent(a.content);
    setScope(a.scope);
    setClassId(a.classId ? String(a.classId) : "");
    setStudentId(a.studentId ? String(a.studentId) : "");
    setModalOpen(true);
  }

  async function handleSubmit() {
    if (!title.trim() || !content.trim()) {
      notifyError(new Error("Le titre et le contenu sont requis."));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateAnnouncement(editing.id, { title: title.trim(), content: content.trim() });
        notifySuccess("Annonce mise à jour.");
      } else {
        await createAnnouncement({
          title: title.trim(),
          content: content.trim(),
          scope,
          classId: scope === "CLASS" && classId ? Number(classId) : null,
          studentId: scope === "STUDENT" && studentId ? Number(studentId) : null,
          authorName: user ? `${user.firstName} ${user.lastName}`.trim() : null,
        });
        notifySuccess("Annonce publiée.");
      }
      setModalOpen(false);
      q.refetch();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  function handleDelete(a: Announcement) {
    confirmAction({
      title: "Supprimer l'annonce",
      message: `Supprimer « ${a.title} » ? Cette action est irréversible.`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteAnnouncement(a.id);
          notifySuccess("Annonce supprimée.");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  function targetLabel(a: Announcement): string {
    if (a.scope === "CLASS" && a.classId) {
      return classes.find((c) => c.id === a.classId)?.label ?? `Classe #${a.classId}`;
    }
    if (a.scope === "STUDENT" && a.studentId) {
      const s = students.find((st) => st.id === a.studentId);
      return s ? `${s.firstName} ${s.lastName}` : `Élève #${a.studentId}`;
    }
    return "Toute l'école";
  }

  const items = q.data ?? [];

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
              <Megaphone className="h-6 w-6 text-brand-600" /> Annonces
            </h1>
            <p className="text-sm text-slate-500">Communiquez avec toute l&apos;école, une classe ou un élève</p>
          </div>
          {canWrite && (
            <Button onClick={openCreate}>
              <Plus className="mr-1.5 h-4 w-4" /> Nouvelle annonce
            </Button>
          )}
        </div>
      </Reveal>

      <div className="rounded-2xl border border-slate-200 bg-white">
        {q.loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <Megaphone className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-slate-700">Aucune annonce</p>
            <p className="text-xs text-slate-400">Publiez votre première annonce.</p>
          </div>
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Titre</TH>
                <TH>Portée</TH>
                <TH>Cible</TH>
                <TH>Auteur</TH>
                <TH>Publiée le</TH>
                {canWrite && <TH className="text-right">Actions</TH>}
              </TR>
            </THead>
            <TBody>
              {items.map((a) => (
                <TR key={a.id}>
                  <TD>
                    <p className="font-medium text-slate-900">{a.title}</p>
                    <p className="max-w-md truncate text-xs text-slate-500">{a.content}</p>
                  </TD>
                  <TD><Badge tone={SCOPE_TONE[a.scope]}>{ANNOUNCEMENT_SCOPE_LABEL[a.scope]}</Badge></TD>
                  <TD className="text-sm text-slate-600">{targetLabel(a)}</TD>
                  <TD className="text-sm text-slate-600">{a.authorName ?? "—"}</TD>
                  <TD className="text-sm text-slate-500">{formatDateTime(a.publishedAt ?? a.createdAt)}</TD>
                  {canWrite && (
                    <TD className="text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          aria-label="Modifier"
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-brand-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          aria-label="Supprimer"
                          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TD>
                  )}
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? "Modifier l'annonce" : "Nouvelle annonce"}>
        <Stack gap="md">
          <TextInput
            label="Titre"
            required
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            placeholder="Ex. Réunion parents-professeurs"
          />
          <Textarea
            label="Contenu"
            required
            minRows={4}
            autosize
            value={content}
            onChange={(e) => setContent(e.currentTarget.value)}
            placeholder="Message de l'annonce…"
          />
          {!editing && (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Portée</label>
                <Select value={scope} onChange={(e) => setScope(e.target.value as AnnouncementScope)}>
                  <option value="GENERAL">{ANNOUNCEMENT_SCOPE_LABEL.GENERAL}</option>
                  <option value="CLASS">{ANNOUNCEMENT_SCOPE_LABEL.CLASS}</option>
                  <option value="STUDENT">{ANNOUNCEMENT_SCOPE_LABEL.STUDENT}</option>
                </Select>
              </div>
              {scope === "CLASS" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Classe</label>
                  <Select value={classId} onChange={(e) => setClassId(e.target.value)}>
                    <option value="">— Choisir une classe —</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </Select>
                </div>
              )}
              {scope === "STUDENT" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Élève</label>
                  <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                    <option value="">— Choisir un élève —</option>
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                    ))}
                  </Select>
                </div>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? "Enregistrement…" : editing ? "Enregistrer" : "Publier"}
            </Button>
          </div>
        </Stack>
      </Modal>
    </div>
  );
}
