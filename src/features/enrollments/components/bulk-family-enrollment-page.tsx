"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Plus, Trash2, XCircle } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { createStudent } from "@/lib/api/students";
import { createParent, linkParentToStudent, listParents, RELATIONSHIP_LABEL, type Relationship } from "@/lib/api/parents";
import { enroll } from "@/lib/api/enrollments";
import type { Gender } from "@/lib/types/student";
import type { Parent } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { PhoneInput } from "@/components/ui/phone-input";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";

type ChildStatus = "pending" | "creating" | "done" | "error";

interface ChildDraft {
  key: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string;
  classId: string;
  relationship: Relationship;
  status: ChildStatus;
  error?: string;
  studentId?: number;
}

function emptyChild(): ChildDraft {
  return {
    key: Math.random().toString(36).slice(2),
    firstName: "", lastName: "", gender: "MALE", birthDate: "", classId: "", relationship: "FATHER",
    status: "pending",
  };
}

/**
 * Inscription groupée d'une fratrie : crée (ou réutilise) un parent, puis crée + rattache + inscrit
 * plusieurs enfants en une seule opération, même dans des classes différentes — au lieu de répéter le
 * parcours enfant par enfant. Chaque enfant a son propre statut ; un échec sur l'un n'annule jamais les
 * autres, et seuls les enfants en échec peuvent être relancés.
 */
export default function BulkFamilyEnrollmentPage() {
  // ── Parent ──────────────────────────────────────────────────────────────
  const [parentMode, setParentMode] = useState<"new" | "existing">("new");
  const [parentSearch, setParentSearch] = useState("");
  const allParentsQuery = useQuery(() => listParents(), []);
  const parentSuggestions = useMemo(() => {
    const q = parentSearch.trim().toLowerCase();
    if (!q) return [];
    return (allParentsQuery.data ?? [])
      .filter((p) => `${p.firstName} ${p.lastName} ${p.phone ?? ""} ${p.email ?? ""}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [allParentsQuery.data, parentSearch]);
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [newParent, setNewParent] = useState({ firstName: "", lastName: "", phone: "", email: "", occupation: "", address: "" });

  // ── Année scolaire / classes ────────────────────────────────────────────
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const classesQuery = useQuery(() => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])), [effectiveYearId]);
  const classes = classesQuery.data ?? [];

  // ── Enfants ─────────────────────────────────────────────────────────────
  const [children, setChildren] = useState<ChildDraft[]>([emptyChild(), emptyChild()]);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);

  function updateChild(key: string, patch: Partial<ChildDraft>) {
    setChildren((cs) => cs.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  }
  function addChild() {
    setChildren((cs) => [...cs, emptyChild()]);
  }
  function removeChild(key: string) {
    setChildren((cs) => (cs.length > 1 ? cs.filter((c) => c.key !== key) : cs));
  }

  function validate(): string | null {
    if (parentMode === "existing" && !selectedParent) return "Sélectionnez un parent existant.";
    if (parentMode === "new" && (!newParent.firstName.trim() || !newParent.lastName.trim() || !newParent.phone.trim())) {
      return "Prénom, nom et téléphone du parent sont requis.";
    }
    if (!effectiveYearId) return "Sélectionnez une année scolaire.";
    for (const c of children) {
      if (!c.firstName.trim() || !c.lastName.trim() || !c.classId) {
        return "Chaque enfant doit avoir un prénom, un nom et une classe.";
      }
    }
    return null;
  }

  /** Traite les enfants dont le statut n'est pas encore "done" — permet de relancer seulement les
   * enfants en échec après un premier passage partiel, sans jamais recréer un enfant déjà réussi. */
  async function processChildren(parentId: number, targets: ChildDraft[]) {
    for (const child of targets) {
      updateChild(child.key, { status: "creating", error: undefined });
      try {
        const student = await createStudent({
          firstName: child.firstName.trim(), lastName: child.lastName.trim(),
          gender: child.gender, birthDate: child.birthDate || null,
        });
        await linkParentToStudent(parentId, student.id, child.relationship);
        await enroll({
          studentId: student.id, classId: Number(child.classId), academicYearId: effectiveYearId!, type: "NEW",
        });
        updateChild(child.key, { status: "done", studentId: student.id });
      } catch (err) {
        updateChild(child.key, { status: "error", error: err instanceof Error ? err.message : "Échec" });
      }
    }
  }

  async function submit() {
    const validationError = validate();
    if (validationError) { notifyError(validationError); return; }
    setRunning(true);
    setFinished(false);
    try {
      let parentId = selectedParent?.id ?? null;
      if (parentMode === "new" && parentId == null) {
        const created = await createParent({
          firstName: newParent.firstName.trim(), lastName: newParent.lastName.trim(),
          phone: newParent.phone.trim() || null, email: newParent.email.trim() || null,
          occupation: newParent.occupation.trim() || null, address: newParent.address.trim() || null,
        });
        parentId = created.id;
        setSelectedParent(created);
        setParentMode("existing");
      }
      if (parentId == null) throw new Error("Parent introuvable");
      await processChildren(parentId, children.filter((c) => c.status !== "done"));
    } catch (err) {
      notifyError(err);
    } finally {
      setRunning(false);
      setFinished(true);
    }
  }

  async function retryFailed() {
    const parentId = selectedParent?.id;
    if (parentId == null) return;
    setRunning(true);
    try {
      await processChildren(parentId, children.filter((c) => c.status === "error"));
    } finally {
      setRunning(false);
    }
  }

  const doneCount = children.filter((c) => c.status === "done").length;
  const errorCount = children.filter((c) => c.status === "error").length;
  const allDone = children.every((c) => c.status === "done");

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Inscription groupée (fratrie)</h1>
        <p className="text-sm text-gray-500">
          Un parent qui vient avec plusieurs enfants : créez le parent une seule fois, puis inscrivez
          tous ses enfants d&apos;un coup, même dans des classes différentes.
        </p>
      </Reveal>

      <Card>
        <CardHeader><CardTitle>Parent</CardTitle></CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1 max-w-xs">
            {(["new", "existing"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={running || finished}
                onClick={() => setParentMode(m)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  parentMode === m ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {m === "new" ? "Nouveau parent" : "Parent existant"}
              </button>
            ))}
          </div>

          {parentMode === "new" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field>
                <Label>Prénom <span className="text-error-500">*</span></Label>
                <Input disabled={running || finished} value={newParent.firstName} onChange={(e) => setNewParent({ ...newParent, firstName: e.target.value })} />
              </Field>
              <Field>
                <Label>Nom <span className="text-error-500">*</span></Label>
                <Input disabled={running || finished} value={newParent.lastName} onChange={(e) => setNewParent({ ...newParent, lastName: e.target.value })} />
              </Field>
              <PhoneInput label={<>Téléphone <span className="text-error-500">*</span></>} value={newParent.phone} onChange={(v) => setNewParent({ ...newParent, phone: v })} />
              <Field>
                <Label>Email (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.email} onChange={(e) => setNewParent({ ...newParent, email: e.target.value })} />
              </Field>
              <Field>
                <Label>Profession (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.occupation} onChange={(e) => setNewParent({ ...newParent, occupation: e.target.value })} />
              </Field>
              <Field>
                <Label>Adresse (optionnel)</Label>
                <Input disabled={running || finished} value={newParent.address} onChange={(e) => setNewParent({ ...newParent, address: e.target.value })} />
              </Field>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedParent ? (
                <div className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{selectedParent.firstName} {selectedParent.lastName}</p>
                    <p className="text-xs text-gray-400">{selectedParent.phone ?? selectedParent.email ?? "—"}</p>
                  </div>
                  {!running && !finished && (
                    <Button size="sm" variant="ghost" onClick={() => setSelectedParent(null)}>Changer</Button>
                  )}
                </div>
              ) : (
                <>
                  <Input
                    placeholder="Rechercher (nom, téléphone, email)…"
                    value={parentSearch}
                    onChange={(e) => setParentSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="max-h-56 space-y-1 overflow-auto">
                    {allParentsQuery.loading && <div className="flex justify-center py-3"><Spinner /></div>}
                    {parentSuggestions.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{p.firstName} {p.lastName}</p>
                          <p className="text-xs text-gray-400">{p.phone ?? p.email ?? "—"}</p>
                        </div>
                        <Button size="sm" onClick={() => setSelectedParent(p)}>Choisir</Button>
                      </div>
                    ))}
                    {parentSearch.trim() && !allParentsQuery.loading && parentSuggestions.length === 0 && (
                      <p className="text-sm text-gray-400">Aucun parent trouvé.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Enfants ({children.length})</CardTitle>
          <div className="w-56">
            <Select disabled={running || finished} value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
              {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
            </Select>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          {children.map((child, i) => (
            <div key={child.key} className="rounded-xl border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">Enfant {i + 1}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={child.status} />
                  {!running && !finished && children.length > 1 && (
                    <button onClick={() => removeChild(child.key)} aria-label="Retirer" className="rounded-lg p-1 text-gray-400 hover:bg-error-50 hover:text-error-600">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Field>
                  <Label>Prénom <span className="text-error-500">*</span></Label>
                  <Input disabled={running || child.status === "done"} value={child.firstName} onChange={(e) => updateChild(child.key, { firstName: e.target.value })} />
                </Field>
                <Field>
                  <Label>Nom <span className="text-error-500">*</span></Label>
                  <Input disabled={running || child.status === "done"} value={child.lastName} onChange={(e) => updateChild(child.key, { lastName: e.target.value })} />
                </Field>
                <Field>
                  <Label>Sexe</Label>
                  <Select disabled={running || child.status === "done"} value={child.gender} onChange={(e) => updateChild(child.key, { gender: e.target.value as Gender })}>
                    <option value="MALE">Garçon</option>
                    <option value="FEMALE">Fille</option>
                  </Select>
                </Field>
                <Field>
                  <Label>Date de naissance</Label>
                  <DatePicker value={child.birthDate} onChange={(v) => updateChild(child.key, { birthDate: v })} clearable disabled={running || child.status === "done"} />
                </Field>
                <Field>
                  <Label>Classe <span className="text-error-500">*</span></Label>
                  <Select disabled={running || child.status === "done"} value={child.classId} onChange={(e) => updateChild(child.key, { classId: e.target.value })}>
                    <option value="">—</option>
                    {classes.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                  </Select>
                </Field>
                <Field>
                  <Label>Lien de parenté</Label>
                  <Select disabled={running || child.status === "done"} value={child.relationship} onChange={(e) => updateChild(child.key, { relationship: e.target.value as Relationship })}>
                    {(Object.keys(RELATIONSHIP_LABEL) as Relationship[]).map((r) => (<option key={r} value={r}>{RELATIONSHIP_LABEL[r]}</option>))}
                  </Select>
                </Field>
              </div>
              {child.status === "error" && (
                <p className="mt-2 text-xs text-error-600">{child.error}</p>
              )}
            </div>
          ))}

          {!running && !finished && (
            <Button variant="secondary" onClick={addChild} leftSection={<Plus className="h-4 w-4" />}>
              Ajouter un enfant
            </Button>
          )}
        </CardBody>
      </Card>

      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {finished && (
            <span>
              {doneCount} / {children.length} enfant(s) inscrit(s) avec succès
              {errorCount > 0 && <span className="text-error-600"> — {errorCount} en échec</span>}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {finished && errorCount > 0 && (
            <Button variant="secondary" onClick={retryFailed} loading={running}>Réessayer les échecs</Button>
          )}
          {allDone && finished ? (
            <Link href="/students">
              <Button onClick={() => notifySuccess("Fratrie inscrite avec succès")}>Voir les élèves</Button>
            </Link>
          ) : (
            <Button onClick={submit} loading={running} disabled={finished && !errorCount}>
              {finished ? "Terminé" : `Inscrire ${children.length} enfant(s)`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ChildStatus }) {
  if (status === "creating") return <Badge tone="amber"><Loader2 className="mr-1 h-3 w-3 animate-spin" /> En cours</Badge>;
  if (status === "done") return <Badge tone="green"><CheckCircle2 className="mr-1 h-3 w-3" /> Inscrit</Badge>;
  if (status === "error") return <Badge tone="red"><XCircle className="mr-1 h-3 w-3" /> Échec</Badge>;
  return null;
}
