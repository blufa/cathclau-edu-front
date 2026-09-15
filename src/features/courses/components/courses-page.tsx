"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, ShoppingCart } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { getMyChildren, getMyStudent } from "@/lib/api/portal";
import {
  addCourseResource,
  createCourse,
  deleteCourse,
  deleteCourseResource,
  getCourseContent,
  listAllCoursePurchases,
  listCourseResources,
  listManagedCourses,
  listPublishedCourses,
  myCoursePurchases,
  publishCourse,
  purchaseCourse,
  unpublishCourse,
  updateCourse,
} from "@/lib/api/courses";
import type { Course, CoursePurchase, CourseResource, CourseResourceType } from "@/lib/types/courses";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field, MoneyInput, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";
import { CourseResourceViewer, ResourceIcon } from "@/features/courses/components/course-resource-viewer";
import { CoursePaymentModal } from "@/features/courses/components/course-payment-modal";

export default function CoursesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const canManage = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE", "TEACHER")
    || hasAnyPermission(user, ["cours:manage"]);
  const isParent = hasRole(user, "PARENT");
  const isStudent = hasRole(user, "STUDENT");

  // Élève dont on affiche/achète les cours : résolu automatiquement pour un élève connecté, choisi
  // parmi ses enfants pour un parent connecté (fratrie).
  const childrenQuery = useQuery(() => (isParent ? getMyChildren() : Promise.resolve([])), [isParent]);
  const myselfQuery = useQuery(() => (isStudent ? getMyStudent() : Promise.resolve(null)), [isStudent]);
  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const activeStudentId = isStudent ? (myselfQuery.data?.id ?? null) : (selectedChildId ?? childrenQuery.data?.[0]?.id ?? null);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const currentYear = (yearsQuery.data ?? []).find((y) => y.current) ?? (yearsQuery.data ?? [])[0];
  const classesQuery = useQuery(() => (currentYear ? listClasses(currentYear.id) : Promise.resolve([])), [currentYear?.id]);
  const classLabel = useMemo(() => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])), [classesQuery.data]);

  const [classFilter, setClassFilter] = useState<string>("");
  const canBuy = isParent || isStudent;

  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes de l&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cours en ligne</h1>
          <p className="text-sm text-gray-500">Vidéos et supports PDF par classe et par matière, achetables à l&apos;unité.</p>
        </div>
        {canBuy && isParent && (childrenQuery.data ?? []).length > 1 && (
          <Select className="w-56" value={String(activeStudentId ?? "")} onChange={(e) => setSelectedChildId(Number(e.target.value))}>
            {(childrenQuery.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>{c.firstName} {c.lastName}</option>
            ))}
          </Select>
        )}
      </Reveal>

      <Tabs defaultValue="catalogue">
        <TabsList>
          <TabsTrigger value="catalogue">Catalogue</TabsTrigger>
          {canBuy && <TabsTrigger value="achats">Mes achats</TabsTrigger>}
          {canManage && <TabsTrigger value="gestion">Gestion</TabsTrigger>}
        </TabsList>

        <TabsPanel value="catalogue">
          <div className="mb-4">
            <Select className="w-64" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">Toutes les classes</option>
              {(classesQuery.data ?? []).map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
            </Select>
          </div>
          <CourseCatalog
            classId={classFilter ? Number(classFilter) : null}
            classLabel={classLabel}
            canBuy={canBuy}
            studentId={activeStudentId}
          />
        </TabsPanel>

        {canBuy && (
          <TabsPanel value="achats">
            <MyPurchases studentId={activeStudentId} classLabel={classLabel} />
          </TabsPanel>
        )}

        {canManage && (
          <TabsPanel value="gestion">
            <CourseManagement tenantId={tenantId} classLabel={classLabel} classes={classesQuery.data ?? []} />
          </TabsPanel>
        )}
      </Tabs>
    </div>
  );
}

// ── Catalogue (parcourir + acheter / regarder) ────────────────────────────────

function CourseCatalog({ classId, classLabel, canBuy, studentId }: {
  classId: number | null; classLabel: Map<number, string>; canBuy: boolean; studentId: number | null;
}) {
  const coursesQuery = useQuery(() => listPublishedCourses(classId), [classId]);
  const purchasesQuery = useQuery(() => (studentId ? myCoursePurchases(studentId) : Promise.resolve([])), [studentId]);
  const purchaseByCourseId = useMemo(
    () => new Map((purchasesQuery.data ?? []).map((p) => [p.courseId, p])),
    [purchasesQuery.data],
  );
  const [opened, setOpened] = useState<Course | null>(null);

  if (coursesQuery.loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  const courses = coursesQuery.data ?? [];
  if (courses.length === 0) {
    return <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">Aucun cours publié pour l&apos;instant.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((c) => (
          <Card key={c.id} hover className="flex cursor-pointer flex-col" onClick={() => setOpened(c)}>
            <div className="aspect-video w-full bg-gray-100">
              {c.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumbnailUrl} alt={c.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-gray-300"><ShoppingCart className="h-10 w-10" /></div>
              )}
            </div>
            <CardBody className="flex flex-1 flex-col gap-2">
              <div className="flex items-center gap-2">
                {c.subjectLabel && <Badge tone="indigo">{c.subjectLabel}</Badge>}
                <Badge tone="gray">{classLabel.get(c.classId) ?? `#${c.classId}`}</Badge>
              </div>
              <h3 className="font-semibold text-gray-900">{c.title}</h3>
              {c.description && <p className="line-clamp-2 text-sm text-gray-500">{c.description}</p>}
              <div className="mt-auto flex items-center justify-between pt-2">
                <span className="text-base font-bold text-brand-700">{formatGNF(c.price)}</span>
                {canBuy && purchaseByCourseId.get(c.id)?.status === "PAID" && <Badge tone="green">Acheté</Badge>}
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
      {opened && (
        <Modal open={!!opened} onClose={() => setOpened(null)} title={opened.title} className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <CourseDetail course={opened} canBuy={canBuy} studentId={studentId} purchase={purchaseByCourseId.get(opened.id) ?? null}
            onPurchased={() => purchasesQuery.refetch()} />
        </Modal>
      )}
    </>
  );
}

function CourseDetail({ course, canBuy, studentId, purchase, onPurchased }: {
  course: Course; canBuy: boolean; studentId: number | null; purchase: CoursePurchase | null; onPurchased: () => void;
}) {
  const contentQuery = useQuery(
    () => (studentId ? getCourseContent(course.id, studentId) : Promise.resolve([] as CourseResource[])),
    [course.id, studentId],
  );
  const [buying, setBuying] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<CoursePurchase | null>(null);
  const [active, setActive] = useState<CourseResource | null>(null);
  const owned = purchase?.status === "PAID";

  async function startPurchase() {
    if (!studentId) { notifyError("Aucun élève sélectionné."); return; }
    setBuying(true);
    try {
      const p = await purchaseCourse(course.id, studentId);
      setPendingPurchase(p);
    } catch (err) { notifyError(err); } finally { setBuying(false); }
  }

  const resources = contentQuery.data ?? [];
  return (
    <div className="space-y-4">
      {course.description && <p className="text-sm text-gray-600">{course.description}</p>}
      <div className="space-y-1">
        {resources.map((r) => (
          <button
            key={r.id}
            type="button"
            disabled={!r.fileUrl}
            onClick={() => setActive(r)}
            className="flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-left text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-2"><ResourceIcon type={r.type} />{r.title ?? (r.type === "VIDEO" ? "Vidéo" : "Document")}</span>
            {!r.fileUrl && <Badge tone="amber">Verrouillé</Badge>}
          </button>
        ))}
        {resources.length === 0 && <p className="text-sm text-gray-400">Aucun contenu pour l&apos;instant.</p>}
      </div>

      {active && <div className="pt-2"><CourseResourceViewer resource={active} /></div>}

      {canBuy && !owned && (
        <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
          <span className="text-lg font-bold text-gray-900">{formatGNF(course.price)}</span>
          <Button onClick={startPurchase} loading={buying}>Acheter</Button>
        </div>
      )}

      {pendingPurchase && (
        <Modal open onClose={() => setPendingPurchase(null)} title="Paiement du cours">
          <CoursePaymentModal
            course={course} purchase={pendingPurchase} studentId={studentId as number}
            onDone={(paid) => { setPendingPurchase(null); if (paid) { onPurchased(); contentQuery.refetch(); } }}
          />
        </Modal>
      )}
    </div>
  );
}

// ── Mes achats ─────────────────────────────────────────────────────────────

function MyPurchases({ studentId, classLabel }: { studentId: number | null; classLabel: Map<number, string> }) {
  const purchasesQuery = useQuery(() => (studentId ? myCoursePurchases(studentId) : Promise.resolve([])), [studentId]);
  const coursesQuery = useQuery(listPublishedCourses.bind(null, null), []);
  const courseById = useMemo(() => new Map((coursesQuery.data ?? []).map((c) => [c.id, c])), [coursesQuery.data]);

  if (purchasesQuery.loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  const purchases = purchasesQuery.data ?? [];
  if (purchases.length === 0) return <p className="rounded-xl bg-gray-50 px-4 py-10 text-center text-sm text-gray-400">Aucun achat pour l&apos;instant.</p>;

  return (
    <Table>
      <THead><tr><TH>Cours</TH><TH>Classe</TH><TH>Statut</TH></tr></THead>
      <TBody>
        {purchases.map((p) => {
          const course = courseById.get(p.courseId);
          return (
            <TR key={p.id}>
              <TD className="font-medium text-gray-900">{course?.title ?? `#${p.courseId}`}</TD>
              <TD>{course ? (classLabel.get(course.classId) ?? `#${course.classId}`) : "—"}</TD>
              <TD>{p.status === "PAID" ? <Badge tone="green">Payé</Badge> : <Badge tone="amber">En attente de paiement</Badge>}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

// ── Gestion (personnel) ───────────────────────────────────────────────────────

function CourseManagement({ tenantId, classLabel, classes }: {
  tenantId: number; classLabel: Map<number, string>; classes: { id: number; label: string }[];
}) {
  const coursesQuery = useQuery(listManagedCourses.bind(null, null), []);
  const purchasesQuery = useQuery(listAllCoursePurchases, []);
  const paidCountByCourse = useMemo(() => {
    const m = new Map<number, number>();
    for (const p of purchasesQuery.data ?? []) {
      if (p.status === "PAID") m.set(p.courseId, (m.get(p.courseId) ?? 0) + 1);
    }
    return m;
  }, [purchasesQuery.data]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [managingResources, setManagingResources] = useState<Course | null>(null);

  function handleDelete(c: Course) {
    confirmAction({
      title: "Supprimer le cours", message: `Supprimer « ${c.title} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteCourse(c.id); notifySuccess("Cours supprimé"); coursesQuery.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  async function togglePublish(c: Course) {
    try {
      if (c.published) await unpublishCourse(c.id); else await publishCourse(c.id);
      notifySuccess(c.published ? "Cours dépublié" : "Cours publié");
      coursesQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau cours</Button>
      </div>

      {coursesQuery.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Titre</TH><TH className="hidden sm:table-cell">Classe</TH><TH>Prix</TH><TH>Statut</TH><TH className="hidden sm:table-cell">Achats</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(coursesQuery.data ?? []).length === 0 && <TR><TD colSpan={100} className="py-6 text-center text-gray-400">Aucun cours.</TD></TR>}
            {(coursesQuery.data ?? []).map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-gray-900">{c.title}{c.subjectLabel ? ` — ${c.subjectLabel}` : ""}</TD>
                <TD className="hidden sm:table-cell">{classLabel.get(c.classId) ?? `#${c.classId}`}</TD>
                <TD>{formatGNF(c.price)}</TD>
                <TD>{c.published ? <Badge tone="green">Publié</Badge> : <Badge tone="gray">Brouillon</Badge>}</TD>
                <TD className="hidden sm:table-cell">{paidCountByCourse.get(c.id) ?? 0}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setManagingResources(c)}>Contenu</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Modifier</Button>
                    <Button size="sm" variant="ghost" onClick={() => togglePublish(c)}>{c.published ? "Dépublier" : "Publier"}</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(c)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? "Modifier le cours" : "Nouveau cours"} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <CourseForm
          tenantId={tenantId} initial={editing} classes={classes}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess("Cours enregistré"); coursesQuery.refetch(); }}
        />
      </Modal>

      <Modal open={!!managingResources} onClose={() => setManagingResources(null)} title="Contenu du cours" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {managingResources && <ResourceManager course={managingResources} onPublishBlocked={() => coursesQuery.refetch()} />}
      </Modal>
    </div>
  );
}

const courseSchema = z.object({
  classId: z.string().min(1, "Classe requise"),
  subjectLabel: z.string(),
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string(),
  price: z.number().positive("Prix requis"),
  thumbnailUrl: z.string().nullable(),
});
type CourseFormValues = z.infer<typeof courseSchema>;

function CourseForm({ tenantId, initial, classes, onCancel, onSaved }: {
  tenantId: number; initial: Course | null; classes: { id: number; label: string }[];
  onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      classId: initial?.classId != null ? String(initial.classId) : "",
      subjectLabel: initial?.subjectLabel ?? "",
      title: initial?.title ?? "",
      description: initial?.description ?? "",
      price: initial ? Number(initial.price) : 0,
      thumbnailUrl: initial?.thumbnailUrl ?? null,
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form gère sa propre mémoïsation
  const v = watch();

  async function submit(values: CourseFormValues) {
    setLoading(true);
    try {
      const payload = {
        classId: Number(values.classId), subjectLabel: values.subjectLabel || null,
        title: values.title, description: values.description || null,
        price: values.price, thumbnailUrl: values.thumbnailUrl,
      };
      if (initial) await updateCourse(initial.id, payload);
      else await createCourse({ ...payload, classId: Number(values.classId) });
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Classe <span className="text-error-500">*</span></Label>
        <Select value={v.classId} onChange={(e) => setValue("classId", e.target.value)}>
          <option value="">Choisir…</option>
          {classes.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </Select>
        {errors.classId && <p className="text-xs text-error-600">{errors.classId.message}</p>}
      </Field>
      <Field>
        <Label>Matière</Label>
        <Input value={v.subjectLabel} onChange={(e) => setValue("subjectLabel", e.target.value)} placeholder="Ex. Mathématiques, Chimie…" />
      </Field>
      <Field>
        <Label>Titre <span className="text-error-500">*</span></Label>
        <Input value={v.title} onChange={(e) => setValue("title", e.target.value)} aria-invalid={!!errors.title} />
        {errors.title && <p className="text-xs text-error-600">{errors.title.message}</p>}
      </Field>
      <Field>
        <Label>Description</Label>
        <Textarea rows={3} value={v.description} onChange={(e) => setValue("description", e.target.value)} />
      </Field>
      <Field>
        <Label>Prix</Label>
        <MoneyInput value={v.price} onValueChange={(n) => setValue("price", n)} />
        {errors.price && <p className="text-xs text-error-600">{errors.price.message}</p>}
      </Field>
      <FileUpload label="Image de couverture" value={v.thumbnailUrl} onChange={(url) => setValue("thumbnailUrl", url)} folder={`tenant-${tenantId}/courses`} variant="image" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}

function ResourceManager({ course, onPublishBlocked }: { course: Course; onPublishBlocked: () => void }) {
  const resourcesQuery = useQuery(() => listCourseResources(course.id), [course.id]);
  const [type, setType] = useState<CourseResourceType>("VIDEO");
  const [title, setTitle] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function add() {
    if (!fileUrl) { notifyError("Téléversez d'abord le fichier."); return; }
    setAdding(true);
    try {
      await addCourseResource(course.id, { type, title: title || null, fileUrl });
      setTitle(""); setFileUrl(null);
      notifySuccess("Ressource ajoutée");
      resourcesQuery.refetch();
    } catch (err) { notifyError(err); } finally { setAdding(false); }
  }

  async function remove(id: number) {
    try { await deleteCourseResource(id); notifySuccess("Ressource supprimée"); resourcesQuery.refetch(); onPublishBlocked(); }
    catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        {(resourcesQuery.data ?? []).map((r) => (
          <div key={r.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
            <span className="flex items-center gap-2"><ResourceIcon type={r.type} />{r.title ?? (r.type === "VIDEO" ? "Vidéo" : "Document")}</span>
            <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(r.id)}>Suppr.</Button>
          </div>
        ))}
        {(resourcesQuery.data ?? []).length === 0 && <p className="text-sm text-gray-400">Aucune ressource pour l&apos;instant.</p>}
      </div>

      <div className="space-y-3 rounded-xl border border-gray-200 p-3">
        <Field>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as CourseResourceType)}>
            <option value="VIDEO">Vidéo</option>
            <option value="PDF">PDF</option>
          </Select>
        </Field>
        <Field>
          <Label>Titre</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Chapitre 1 — Introduction" />
        </Field>
        <FileUpload
          label={type === "VIDEO" ? "Fichier vidéo" : "Fichier PDF"}
          value={fileUrl}
          onChange={setFileUrl}
          folder={`tenant/courses/${course.id}`}
          variant="document"
          accept={type === "VIDEO" ? "video/*" : "application/pdf"}
        />
        <div className="flex justify-end">
          <Button onClick={add} loading={adding}>Ajouter</Button>
        </div>
      </div>
    </div>
  );
}
