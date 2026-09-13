"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IdCard, Plus, Search, Tags } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getStudent, searchStudents } from "@/lib/api/students";
import { getClass, listAcademicYears } from "@/lib/api/academics";
import {
  createCardTemplate,
  updateCardTemplate,
  declareCardLost,
  deleteCardTemplate,
  issueStudentCard,
  listCardTemplates,
  listCards,
  replaceCard,
  setDefaultCardTemplate,
} from "@/lib/api/student-card";
import {
  CARD_STATUS_LABEL,
  type CardOrientation,
  type CardStatus,
  type CardTemplate,
  type StudentCard,
} from "@/lib/types/student-card";
import type { Student } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { FileUpload } from "@/components/ui/file-upload";
import { StudentCardPreview } from "@/features/students/components/student-card-preview";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<CardStatus, "green" | "gray" | "red" | "amber"> = {
  ACTIVE: "green", EXPIRED: "amber", LOST: "red", REPLACED: "gray",
};

export default function StudentCardsPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cartes scolaires</h1>
        <p className="text-sm text-gray-500">Émission des cartes élèves avec QR code signé</p>
      </Reveal>
      <Tabs defaultValue="cards">
        <TabsList>
          <TabsTrigger value="cards" icon={IdCard}>Cartes</TabsTrigger>
          <TabsTrigger value="templates" icon={Tags}>Modèles</TabsTrigger>
        </TabsList>
        <TabsPanel value="cards"><CardsTab user={user} /></TabsPanel>
        <TabsPanel value="templates"><TemplatesTab user={user} /></TabsPanel>
      </Tabs>
    </div>
  );
}

function CardsTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["carte:manage"]);
  const q = useQuery(() => listCards(), []);
  const templatesQuery = useQuery(() => listCardTemplates(), []);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);
  const studentName = useMemo(() => {
    const m = new Map((studentsQuery.data?.content ?? []).map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
    return (id: number) => m.get(id) ?? `Élève #${id}`;
  }, [studentsQuery.data]);
  const [status, setStatus] = useState<CardStatus | "">("");
  const [issuing, setIssuing] = useState(false);
  const [preview, setPreview] = useState<StudentCard | null>(null);
  const [previewClass, setPreviewClass] = useState<string | null>(null);

  function openPreview(c: StudentCard) {
    setPreview(c);
    setPreviewClass(null);
    if (c.classId) getClass(c.classId).then((cl) => setPreviewClass(cl.label)).catch(() => setPreviewClass(null));
  }

  const rows = (q.data ?? []).filter((c) => !status || c.status === status);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notifySuccess(ok); q.refetch(); } catch (e) { notifyError(e); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as CardStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(CARD_STATUS_LABEL) as CardStatus[]).map((s) => (<option key={s} value={s}>{CARD_STATUS_LABEL[s]}</option>))}
        </Select>
        {canEdit && <Button onClick={() => setIssuing(true)} leftSection={<Plus className="h-4 w-4" />}>Émettre une carte</Button>}
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH className="hidden sm:table-cell">N° carte</TH><TH>Élève</TH><TH className="hidden sm:table-cell">Matricule</TH><TH>Émission</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucune carte.</TD></TR>}
            {rows.map((c) => (
              <TR key={c.id}>
                <TD className="hidden font-mono text-xs text-gray-600 sm:table-cell">{c.cardNumber}</TD>
                <TD>{studentName(c.studentId)}</TD>
                <TD className="hidden sm:table-cell">{c.studentNumber ?? "—"}</TD>
                <TD className="hidden text-gray-500 sm:table-cell">{formatDate(c.issueDate)}</TD>
                <TD><Badge tone={STATUS_TONE[c.status]}>{CARD_STATUS_LABEL[c.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openPreview(c)}>Badge</Button>
                    {canEdit && c.status === "ACTIVE" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => act(() => replaceCard(c.id), "Carte réémise")}>Réémettre</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => confirmAction({ title: "Déclarer perdue", message: `Carte ${c.cardNumber}`, confirmLabel: "Déclarer perdue", danger: true, onConfirm: () => act(() => declareCardLost(c.id), "Carte déclarée perdue") })}>Perdue</Button>
                      </>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={issuing} onClose={() => setIssuing(false)} title="Émettre une carte">
        <IssueForm templates={templatesQuery.data ?? []} onCancel={() => setIssuing(false)} onDone={() => { setIssuing(false); notifySuccess("Carte émise"); q.refetch(); }} />
      </Modal>

      <StudentCardPreview card={preview} studentName={preview ? studentName(preview.studentId) : null}
        className={previewClass} open={!!preview} onClose={() => setPreview(null)} />
    </div>
  );
}

function IssueForm({ templates, onCancel, onDone }: { templates: CardTemplate[]; onCancel: () => void; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const studentsQuery = useQuery(() => (query ? searchStudents({ search: query, size: 10 }).then((p) => p.content) : Promise.resolve([])), [query]);
  const [loading, setLoading] = useState<number | null>(null);
  const defaultTemplate = templates.find((t) => t.isDefault) ?? templates[0];

  // Recherche dynamique : les résultats apparaissent dès la saisie (débounce 300 ms), sans bouton.
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  async function issue(s: Student) {
    setLoading(s.id);
    try {
      // La classe/année sont indispensables pour que le badge affiche la classe de l'élève —
      // résolues depuis son inscription validée sur l'année courante, jamais laissées vides.
      let classId: number | null = null;
      let academicYearId: number | null = null;
      try {
        const [detail, years] = await Promise.all([getStudent(s.id), listAcademicYears()]);
        const currentYear = years.find((y) => y.current) ?? years[0];
        const enrollment = detail.enrollments?.find((e) => e.status === "VALIDATED" && e.academicYearId === currentYear?.id)
          ?? detail.enrollments?.find((e) => e.status === "VALIDATED");
        classId = enrollment?.classId ?? null;
        academicYearId = enrollment?.academicYearId ?? currentYear?.id ?? null;
      } catch { /* pas bloquant : la carte est quand même émise, sans classe affichée */ }
      await issueStudentCard(s.id, {
        studentNumber: s.studentNumber, photoUrl: s.photo, cardTemplateId: defaultTemplate?.id ?? null,
        classId, academicYearId,
      });
      onDone();
    } catch (e) { notifyError(e); } finally { setLoading(null); }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input className="w-full pl-9" placeholder="Rechercher un élève (nom, prénom, matricule)…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
      </div>
      {!defaultTemplate && <p className="text-xs text-warning-600">Aucun modèle de carte — créez-en un dans l&apos;onglet Modèles (le défaut sera utilisé).</p>}
      <div className="space-y-1">
        {(studentsQuery.data ?? []).map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</p>
              <p className="text-xs text-gray-400">{s.studentNumber}{!s.photo && " · sans photo (initiales affichées sur le badge)"}</p>
            </div>
            <Button size="sm" loading={loading === s.id} onClick={() => issue(s)}>Émettre</Button>
          </div>
        ))}
        {query && (studentsQuery.data ?? []).length === 0 && <p className="text-sm text-gray-400">Aucun élève trouvé.</p>}
      </div>
      <div className="flex justify-end"><Button type="button" variant="secondary" onClick={onCancel}>Fermer</Button></div>
    </div>
  );
}

function TemplatesTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["carte:manage"]);
  const q = useQuery(() => listCardTemplates(), []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CardTemplate | null>(null);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notifySuccess(ok); q.refetch(); } catch (e) { notifyError(e); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{canEdit && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau modèle</Button>}</div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Nom</TH><TH>Orientation</TH><TH>Couleurs</TH><TH>Défaut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun modèle.</TD></TR>}
            {(q.data ?? []).map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-gray-900">{t.name}</TD>
                <TD>{t.orientation === "PORTRAIT" ? "Portrait" : "Paysage"}</TD>
                <TD>
                  <div className="flex gap-1">
                    {t.primaryColor && <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: t.primaryColor }} />}
                    {t.secondaryColor && <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: t.secondaryColor }} />}
                  </div>
                </TD>
                <TD>{t.isDefault ? <Badge tone="green">Défaut</Badge> : "—"}</TD>
                <TD className="text-right">
                  {canEdit && (
                    <div className="flex justify-end gap-1">
                      {!t.isDefault && <Button size="sm" variant="ghost" onClick={() => act(() => setDefaultCardTemplate(t.id), "Modèle défini par défaut")}>Définir défaut</Button>}
                      <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Modifier</Button>
                      <Button size="sm" variant="ghost" className="text-error-600" onClick={() => confirmAction({ title: "Supprimer le modèle", message: t.name, confirmLabel: "Supprimer", danger: true, onConfirm: () => act(() => deleteCardTemplate(t.id), "Supprimé") })}>Suppr.</Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le modèle de carte" : "Nouveau modèle de carte"}>
        <TemplateForm initial={editing} onCancel={() => { setCreating(false); setEditing(null); }}
          onCreated={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Modèle mis à jour" : "Modèle créé"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

const templateSchema = z.object({
  name: z.string().trim().min(1, "Requis"),
  orientation: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  logoUrl: z.string(),
});
type TemplateFormValues = z.infer<typeof templateSchema>;

function TemplateForm({ initial, onCancel, onCreated }: { initial?: CardTemplate | null; onCancel: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: initial?.name ?? "",
      orientation: initial?.orientation ?? "LANDSCAPE",
      primaryColor: initial?.primaryColor ?? "#14b8a6",
      secondaryColor: initial?.secondaryColor ?? "#0f766e",
      logoUrl: initial?.logoUrl ?? "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: TemplateFormValues) {
    setLoading(true);
    try {
      const payload = { name: values.name, orientation: values.orientation as CardOrientation, primaryColor: values.primaryColor, secondaryColor: values.secondaryColor, logoUrl: values.logoUrl };
      if (initial) await updateCardTemplate(initial.id, payload);
      else await createCardTemplate(payload);
      onCreated();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Nom du modèle <span className="text-error-500">*</span></Label>
        <Input value={v.name} onChange={(e) => setValue("name", e.target.value)} aria-invalid={!!errors.name} />
        {errors.name && <p className="text-xs text-error-600">{errors.name.message}</p>}
      </Field>
      <Field>
        <Label>Orientation</Label>
        <Select value={v.orientation} onChange={(e) => setValue("orientation", e.target.value)}>
          <option value="LANDSCAPE">Paysage</option>
          <option value="PORTRAIT">Portrait</option>
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field><Label>Couleur primaire</Label><Input type="color" value={v.primaryColor} onChange={(e) => setValue("primaryColor", e.target.value)} /></Field>
        <Field><Label>Couleur secondaire</Label><Input type="color" value={v.secondaryColor} onChange={(e) => setValue("secondaryColor", e.target.value)} /></Field>
      </div>
      <Field>
        <Label>Logo</Label>
        <FileUpload variant="image" folder="cards/logos" value={v.logoUrl} onChange={(url) => setValue("logoUrl", url ?? "")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}
