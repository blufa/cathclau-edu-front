"use client";

import { useMemo, useState } from "react";
import { Megaphone, Plus, Pencil, Trash2 } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
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
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
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
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER") || hasAnyPermission(user, ["annonce:manage"]);

  const q = useQuery(listAnnouncements, []);
  const yearQuery = useQuery(getCurrentAcademicYear, []);
  const yearId = yearQuery.data?.id ?? null;
  const classesQuery = useQuery(
    () => (yearId ? listClasses(yearId) : Promise.resolve([])),
    [yearId],
  );
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);

  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const students = useMemo(() => studentsQuery.data?.content ?? [], [studentsQuery.data]);
  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );
  const studentOptions: SearchableOption[] = useMemo(
    () => students.map((s) => {
      const label = `${s.firstName} ${s.lastName}`;
      return { value: String(s.id), trigger: label, label, searchText: label };
    }),
    [students],
  );

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
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
              <Megaphone className="h-6 w-6 text-brand-600" /> Annonces
            </h1>
            <p className="text-sm text-gray-500">Communiquez avec toute l&apos;école, une classe ou un élève</p>
          </div>
          {canWrite && (
            <Button onClick={openCreate} leftSection={<Plus className="h-4 w-4" />}>
              Nouvelle annonce
            </Button>
          )}
        </div>
      </Reveal>

      <div className="rounded-2xl border border-gray-200 bg-white">
        {q.loading ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
              <Megaphone className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-gray-700">Aucune annonce</p>
            <p className="text-xs text-gray-400">Publiez votre première annonce.</p>
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
                    <p className="font-medium text-gray-900">{a.title}</p>
                    <p className="max-w-md truncate text-xs text-gray-500">{a.content}</p>
                  </TD>
                  <TD><Badge tone={SCOPE_TONE[a.scope]}>{ANNOUNCEMENT_SCOPE_LABEL[a.scope]}</Badge></TD>
                  <TD className="text-sm text-gray-600">{targetLabel(a)}</TD>
                  <TD className="text-sm text-gray-600">{a.authorName ?? "—"}</TD>
                  <TD className="text-sm text-gray-500">{formatDateTime(a.publishedAt ?? a.createdAt)}</TD>
                  {canWrite && (
                    <TD className="text-right">
                      <div className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(a)}
                          aria-label="Modifier"
                          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-brand-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(a)}
                          aria-label="Supprimer"
                          className="rounded-lg p-1.5 text-gray-500 transition hover:bg-error-50 hover:text-error-600"
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
        <div className="space-y-4">
          <Field>
            <Label>Titre <span className="text-error-500">*</span></Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Réunion parents-professeurs"
            />
          </Field>
          <Field>
            <Label>Contenu <span className="text-error-500">*</span></Label>
            <Textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Message de l'annonce…"
            />
          </Field>
          {!editing && (
            <>
              <Field>
                <Label>Portée</Label>
                <Select value={scope} onChange={(e) => setScope(e.target.value as AnnouncementScope)}>
                  <option value="GENERAL">{ANNOUNCEMENT_SCOPE_LABEL.GENERAL}</option>
                  <option value="CLASS">{ANNOUNCEMENT_SCOPE_LABEL.CLASS}</option>
                  <option value="STUDENT">{ANNOUNCEMENT_SCOPE_LABEL.STUDENT}</option>
                </Select>
              </Field>
              {scope === "CLASS" && (
                <Field>
                  <Label>Classe</Label>
                  <SearchableSelect value={classId} options={classOptions} onChange={setClassId} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucune classe" />
                </Field>
              )}
              {scope === "STUDENT" && (
                <Field>
                  <Label>Élève</Label>
                  <SearchableSelect value={studentId} options={studentOptions} onChange={setStudentId} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun élève" />
                </Field>
              )}
            </>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={handleSubmit} loading={saving}>
              {editing ? "Enregistrer" : "Publier"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
