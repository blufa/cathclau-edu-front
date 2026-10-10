"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IdCard, Plus, Printer, Search, Tags } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getStudent, searchStudents } from "@/lib/api/students";
import { getClass, listAcademicYears, listClasses } from "@/lib/api/academics";
import {
  createCardTemplate,
  updateCardTemplate,
  declareCardLost,
  deleteCardTemplate,
  issueStudentCard,
  listCardTemplates,
  listCards,
  markCardsPrinted,
  replaceCard,
  setDefaultCardTemplate,
} from "@/lib/api/student-card";
import {
  BADGE_KIND_LABEL,
  CARD_STATUS_LABEL,
  type BadgeKind,
  type CardOrientation,
  type CardStatus,
  type CardTemplate,
  type StudentCard,
} from "@/lib/types/student-card";
import type { Student } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { FileUpload } from "@/components/ui/file-upload";
import { StudentCardPreview } from "@/features/students/components/student-card-preview";
import { BadgeSheet } from "@/components/cards/badge-sheet";
import type { IdBadgeProps } from "@/components/cards/id-badge";
import { resolveBadgeColors } from "@/lib/badge-colors";
import { buildIdentityQr } from "@/lib/identity-qr";
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
  const tenantId = user?.tenantId ?? null;
  const q = useQuery(() => listCards(), []);
  const templatesQuery = useQuery(() => listCardTemplates(), []);
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const studentsQuery = useCachedQuery(tenantId ? `students-all-v2:${tenantId}` : null, () => searchStudents({ size: 1000 }).then((p) => p.content), [tenantId]);
  const studentById = useMemo(() => new Map((studentsQuery.data ?? []).map((s) => [s.id, s])), [studentsQuery.data]);
  const studentName = (id: number) => {
    const s = studentById.get(id);
    return s ? `${s.firstName} ${s.lastName}` : `Élève archivé (#${id})`;
  };
  const [status, setStatus] = useState<CardStatus | "">("");
  const [printedFilter, setPrintedFilter] = useState<"" | "YES" | "NO">("");
  // Impression par classe (§retour direction des études) : le directeur filtre par classe, le système
  // récupère tous ses élèves, il coche tout en un clic puis imprime la planche — en une seule fois.
  const [classFilter, setClassFilter] = useState<string>("");
  const currentYear = useMemo(() => {
    const years = yearsQuery.data ?? [];
    return years.find((y) => y.current) ?? years[0] ?? null;
  }, [yearsQuery.data]);
  const classesQuery = useQuery(() => (currentYear ? listClasses(currentYear.id) : Promise.resolve([])), [currentYear?.id]);
  const [issuing, setIssuing] = useState(false);
  const [preview, setPreview] = useState<StudentCard | null>(null);
  const [previewClass, setPreviewClass] = useState<string | null>(null);
  const [selected, setSelected] = useState<StudentCard[]>([]);
  const [sheetBadges, setSheetBadges] = useState<IdBadgeProps[] | null>(null);
  const [sheetCardIds, setSheetCardIds] = useState<number[]>([]);
  const [buildingSheet, setBuildingSheet] = useState(false);

  function openPreview(c: StudentCard) {
    setPreview(c);
    setPreviewClass(null);
    if (c.classId) getClass(c.classId).then((cl) => setPreviewClass(cl.label)).catch(() => setPreviewClass(null));
  }

  const rows = (q.data ?? []).filter((c) => !status || c.status === status)
    .filter((c) => !printedFilter || (printedFilter === "YES" ? !!c.printedAt : !c.printedAt))
    .filter((c) => !classFilter || c.classId === Number(classFilter));

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notifySuccess(ok); q.refetch(); } catch (e) { notifyError(e); }
  }

  /** Construit les données de badge de plusieurs cartes à la fois (planche d'impression) — résout les
   * classes en un seul appel par année scolaire concernée plutôt qu'un appel par carte. */
  async function buildBadgeSheet(cards: StudentCard[]) {
    setBuildingSheet(true);
    try {
      const colors = resolveBadgeColors(templatesQuery.data, "STUDENT");
      const yearIds = [...new Set(cards.map((c) => c.academicYearId).filter((id): id is number => id != null))];
      const classLists = await Promise.all(yearIds.map((id) => listClasses(id)));
      const classLabel = new Map(classLists.flat().map((cl) => [cl.id, cl.label]));
      const years = yearsQuery.data ?? [];
      const badges: IdBadgeProps[] = cards.map((c) => {
        const student = studentById.get(c.studentId);
        const fullName = student ? `${student.firstName} ${student.lastName}` : `Élève ${c.studentNumber ?? ""}`.trim();
        return {
          kind: "Badge élève",
          fullName,
          firstName: student?.firstName,
          lastName: student?.lastName,
          photoUrl: c.photoUrl,
          idNumber: c.studentNumber,
          validUntil: c.expirationDate ? formatDate(c.expirationDate) : null,
          academicYearLabel: years.find((y) => y.id === c.academicYearId)?.label ?? null,
          fields: [
            { label: "Classe", value: c.classId != null ? (classLabel.get(c.classId) ?? "—") : "—" },
            { label: "Né le", value: formatDate(student?.birthDate) },
          ],
          qrData: buildIdentityQr({ type: "STUDENT", fullName, matricule: c.studentNumber }),
          primaryColor: colors.primaryColor,
          secondaryColor: colors.secondaryColor,
          orientation: colors.orientation,
        };
      });
      setSheetBadges(badges);
      setSheetCardIds(cards.map((c) => c.id));
    } catch (e) { notifyError(e); } finally { setBuildingSheet(false); }
  }

  /** Marque les cartes de la planche comme imprimées une fois le dialogue d'impression déclenché —
   * pour qu'elles disparaissent du filtre "Non imprimées" et ne soient jamais réimprimées par erreur. */
  async function onSheetPrinted() {
    try {
      await markCardsPrinted(sheetCardIds);
      q.refetch();
    } catch (e) { notifyError(e); }
  }

  const columns: Column<StudentCard>[] = [
    { key: "cardNumber", header: "N° carte", render: (c) => <span className="font-mono text-xs text-gray-600">{c.cardNumber}</span> },
    { key: "student", header: "Élève", accessor: (c) => studentName(c.studentId), render: (c) => studentName(c.studentId) },
    { key: "studentNumber", header: "Matricule", render: (c) => c.studentNumber ?? "—" },
    { key: "issueDate", header: "Émission", render: (c) => <span className="text-gray-500">{formatDate(c.issueDate)}</span> },
    { key: "status", header: "Statut", render: (c) => <Badge tone={STATUS_TONE[c.status]}>{CARD_STATUS_LABEL[c.status]}</Badge> },
    {
      key: "printed", header: "Imprimé",
      render: (c) => <Badge tone={c.printedAt ? "green" : "gray"}>{c.printedAt ? "OUI" : "NON"}</Badge>,
    },
    {
      key: "actions", header: "Actions", align: "right",
      render: (c) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => openPreview(c)}>Badge</Button>
          {canEdit && c.status === "ACTIVE" && (
            <>
              <Button size="sm" variant="ghost" onClick={() => act(() => replaceCard(c.id), "Carte réémise")}>Réémettre</Button>
              <Button size="sm" variant="ghost" className="text-error-600" onClick={() => confirmAction({ title: "Déclarer perdue", message: `Carte ${c.cardNumber}`, confirmLabel: "Déclarer perdue", danger: true, onConfirm: () => act(() => declareCardLost(c.id), "Carte déclarée perdue") })}>Perdue</Button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as CardStatus | "")}>
            <option value="">Tous les statuts</option>
            {(Object.keys(CARD_STATUS_LABEL) as CardStatus[]).map((s) => (<option key={s} value={s}>{CARD_STATUS_LABEL[s]}</option>))}
          </Select>
          <Select className="max-w-[200px]" value={printedFilter} onChange={(e) => setPrintedFilter(e.target.value as "" | "YES" | "NO")}>
            <option value="">Imprimé : tous</option>
            <option value="NO">Non imprimées</option>
            <option value="YES">Déjà imprimées</option>
          </Select>
          <SearchableSelect
            triggerClassName="max-w-[220px] justify-between px-3"
            value={classFilter}
            onChange={setClassFilter}
            options={[
              { value: "", trigger: "Toutes les classes", label: "Toutes les classes", searchText: "" },
              ...(classesQuery.data ?? []).map((cl): SearchableOption => ({ value: String(cl.id), trigger: cl.label, label: cl.label, searchText: cl.label })),
            ]}
          />
          {classFilter && rows.length > 0 && (
            <Button size="sm" variant="secondary" onClick={() => setSelected(rows)}>
              Sélectionner toute la classe ({rows.length})
            </Button>
          )}
        </div>
        {canEdit && <Button onClick={() => setIssuing(true)} leftSection={<Plus className="h-4 w-4" />}>Émettre une carte</Button>}
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(c) => c.id}
          emptyLabel="Aucune carte."
          selectable
          onSelectionChange={setSelected}
          toolbar={
            <Button size="sm" disabled={selected.length === 0} loading={buildingSheet}
              leftSection={<Printer className="h-4 w-4" />} onClick={() => buildBadgeSheet(selected)}>
              Imprimer planche {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          }
        />
      )}

      <Modal open={issuing} onClose={() => setIssuing(false)} title="Émettre une carte">
        <IssueForm templates={templatesQuery.data ?? []} onCancel={() => setIssuing(false)} onDone={() => { setIssuing(false); notifySuccess("Carte émise"); q.refetch(); }} />
      </Modal>

      <StudentCardPreview card={preview} studentName={preview ? studentName(preview.studentId) : null}
        className={previewClass} open={!!preview} onClose={() => setPreview(null)} templates={templatesQuery.data ?? []} />

      <Modal open={!!sheetBadges} onClose={() => setSheetBadges(null)} title="Planche de badges" className="max-w-4xl">
        {sheetBadges && <BadgeSheet badges={sheetBadges} onPrinted={onSheetPrinted} />}
      </Modal>
    </div>
  );
}

function IssueForm({ templates, onCancel, onDone }: { templates: CardTemplate[]; onCancel: () => void; onDone: () => void }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  // Sans recherche, affiche quand même une liste par défaut (élèves les plus récents) plutôt que rien —
  // sinon un élève qu'on vient d'ajouter semble "absent" tant qu'on n'a pas tapé son nom.
  const studentsQuery = useQuery(
    () => searchStudents({ search: query || undefined, size: 20, sort: "id,desc" }).then((p) => p.content),
    [query],
  );
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
        {!studentsQuery.loading && (studentsQuery.data ?? []).length === 0 && <p className="text-sm text-gray-400">Aucun élève trouvé.</p>}
      </div>
      <div className="flex justify-end"><Button type="button" variant="secondary" onClick={onCancel}>Fermer</Button></div>
    </div>
  );
}

function TemplatesTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["carte:manage"]);
  const q = useQuery(() => listCardTemplates(), []);
  const [kindFilter, setKindFilter] = useState<BadgeKind | "">("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<CardTemplate | null>(null);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notifySuccess(ok); q.refetch(); } catch (e) { notifyError(e); }
  }

  const rows = (q.data ?? []).filter((t) => !kindFilter || t.badgeKind === kindFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select className="max-w-[220px]" value={kindFilter} onChange={(e) => setKindFilter(e.target.value as BadgeKind | "")}>
          <option value="">Tous les types de badge</option>
          {(Object.keys(BADGE_KIND_LABEL) as BadgeKind[]).map((k) => (<option key={k} value={k}>{BADGE_KIND_LABEL[k]}</option>))}
        </Select>
        {canEdit && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau modèle</Button>}
      </div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Nom</TH><TH>Type de badge</TH><TH>Couleurs</TH><TH>Défaut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun modèle.</TD></TR>}
            {rows.map((t) => (
              <TR key={t.id}>
                <TD className="font-medium text-gray-900">{t.name}</TD>
                <TD><Badge tone="indigo">{BADGE_KIND_LABEL[t.badgeKind]}</Badge></TD>
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
        <TemplateForm initial={editing} defaultKind={kindFilter || "STUDENT"} onCancel={() => { setCreating(false); setEditing(null); }}
          onCreated={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Modèle mis à jour" : "Modèle créé"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

const templateSchema = z.object({
  name: z.string().trim().min(1, "Requis"),
  badgeKind: z.string(),
  orientation: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  logoUrl: z.string(),
});
type TemplateFormValues = z.infer<typeof templateSchema>;

function TemplateForm({ initial, defaultKind, onCancel, onCreated }: {
  initial?: CardTemplate | null; defaultKind: BadgeKind; onCancel: () => void; onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { handleSubmit, watch, setValue, formState: { errors } } = useForm<TemplateFormValues>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: initial?.name ?? "",
      badgeKind: initial?.badgeKind ?? defaultKind,
      orientation: initial?.orientation ?? "PORTRAIT",
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
      const payload = {
        name: values.name, badgeKind: values.badgeKind as BadgeKind, orientation: values.orientation as CardOrientation,
        primaryColor: values.primaryColor, secondaryColor: values.secondaryColor, logoUrl: values.logoUrl,
      };
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
        <Label>Type de badge</Label>
        <Select value={v.badgeKind} onChange={(e) => setValue("badgeKind", e.target.value)}>
          {(Object.keys(BADGE_KIND_LABEL) as BadgeKind[]).map((k) => (<option key={k} value={k}>{BADGE_KIND_LABEL[k]}</option>))}
        </Select>
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
