"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Tabs, Textarea, TextInput } from "@mantine/core";
import { FileText, Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import {
  createTemplate,
  deleteTemplate,
  generateDocument,
  seedDefaultTemplates,
  listGeneratedDocuments,
  listTemplates,
  previewTemplate,
  resolveDocumentContext,
  setDefaultTemplate,
  updateTemplate,
} from "@/lib/api/documents";
import { searchStudents } from "@/lib/api/students";
import { listTeachers } from "@/lib/api/staff";
import { listInvoicesByStudent } from "@/lib/api/billing";
import { listPaymentsByStudent } from "@/lib/api/payment";
import { formatGNF } from "@/lib/format";
import {
  CATEGORY_LABEL,
  DOC_TYPE_LABEL,
  STYLE_LABEL,
  type DocumentCategory,
  type DocumentStyle,
  type DocumentTemplate,
  type DocumentType,
  type PageFormat,
  type TemplateInput,
} from "@/lib/types/documents";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const AUTO_VARS = new Set(["date", "reference", "logo", "signature", "cachet", "watermark"]);

function extractVars(...htmls: (string | null | undefined)[]): string[] {
  const set = new Set<string>();
  const re = /\{\{\s*([\w.]+)\s*}}/g;
  for (const h of htmls) {
    if (!h) continue;
    let m: RegExpExecArray | null;
    while ((m = re.exec(h)) !== null) if (!AUTO_VARS.has(m[1])) set.add(m[1]);
  }
  return [...set];
}

function printHtml(html: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { notifyError("Autorisez les pop-ups pour imprimer / exporter en PDF."); return; }
  w.document.write(html + "<script>window.onload=function(){window.print()}<\/script>");
  w.document.close();
}
function downloadWord(html: string, name: string) {
  const blob = new Blob(["﻿" + html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${name}.doc`; a.click();
  URL.revokeObjectURL(url);
}

export default function DocumentsPage() {
  const { user } = useAuth();
  const canManage = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const q = useQuery(listTemplates, []);
  const [editing, setEditing] = useState<DocumentTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState<DocumentTemplate | null>(null);
  const [generating, setGenerating] = useState<DocumentTemplate | null>(null);

  const byCategory = useMemo(() => {
    const map = new Map<DocumentCategory, DocumentTemplate[]>();
    for (const t of q.data ?? []) {
      const list = map.get(t.category) ?? [];
      list.push(t);
      map.set(t.category, list);
    }
    return map;
  }, [q.data]);

  function remove(t: DocumentTemplate) {
    confirmAction({
      title: "Supprimer le modèle", message: `Supprimer « ${t.name} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteTemplate(t.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }
  async function makeDefault(t: DocumentTemplate) {
    try { await setDefaultTemplate(t.id); notifySuccess("Modèle par défaut"); q.refetch(); } catch (e) { notifyError(e); }
  }
  function installDefaults() {
    confirmAction({
      title: "Installer les modèles par défaut",
      message: "Installer la bibliothèque de modèles professionnels prêts à l'emploi (certificat, attestations, reçu, convocation…) ?",
      confirmLabel: "Installer",
      onConfirm: async () => { try { await seedDefaultTemplates(); notifySuccess("Modèles installés"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <FileText className="h-6 w-6 text-brand-600" /> Documents & Modèles
          </h1>
          <p className="text-sm text-slate-500">Modèles personnalisables (branding, variables, format) — génération, impression, PDF & Word</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={installDefaults}>Modèles par défaut</Button>
            <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau modèle</Button>
          </div>
        )}
      </Reveal>

      <Tabs defaultValue="templates" color="brand" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="templates">Modèles</Tabs.Tab>
          <Tabs.Tab value="history">Historique</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="templates" pt="lg">
          {q.loading ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : (q.data ?? []).length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Aucun modèle. Créez-en un pour commencer.</p>
          ) : (
            <div className="space-y-6">
              {[...byCategory.entries()].map(([cat, list]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{CATEGORY_LABEL[cat]}</h3>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((t) => (
                      <TemplateCard key={t.id} t={t} canManage={canManage}
                        onPreview={() => setPreviewing(t)} onGenerate={() => setGenerating(t)}
                        onEdit={() => setEditing(t)} onDefault={() => makeDefault(t)} onRemove={() => remove(t)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tabs.Panel>

        <Tabs.Panel value="history" pt="lg"><HistoryTab /></Tabs.Panel>
      </Tabs>

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }}
        title={editing ? "Modifier le modèle" : "Nouveau modèle"}>
        <TemplateEditor template={editing} onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess("Modèle enregistré"); q.refetch(); }} />
      </Modal>

      <Modal open={!!previewing} onClose={() => setPreviewing(null)} title={`Aperçu — ${previewing?.name ?? ""}`}>
        {previewing && <PreviewPane template={previewing} context={SAMPLE} />}
      </Modal>

      <Modal open={!!generating} onClose={() => setGenerating(null)} title={`Générer — ${generating?.name ?? ""}`}>
        {generating && <GeneratePane template={generating} onClose={() => setGenerating(null)} />}
      </Modal>
    </div>
  );
}

const SAMPLE: Record<string, string> = {
  "ecole.nom": "Groupe Scolaire Exemple", "ecole.adresse": "Quartier Almamya, Conakry", "ecole.ville": "Conakry",
  "ecole.pays": "Guinée", "ecole.telephone": "+224 600 00 00 00", "ecole.email": "contact@exemple.gn", "ecole.directeur": "M. CAMARA",
  "eleve.nom": "DIALLO", "eleve.prenom": "Awa", "eleve.matricule": "2025-0042", "eleve.classe": "6e A",
  "eleve.date_naissance": "12/03/2014", "eleve.lieu_naissance": "Conakry", "eleve.sexe": "Féminin",
  "parent.nom": "DIALLO", "parent.prenom": "Mariam", "parent.telephone": "+224 620 00 00 00",
  "annee_scolaire": "2025-2026", "periode": "Trimestre 1", "appreciation": "Bon trimestre, continue ainsi.",
  "bulletin.moyenne": "14.50", "bulletin.rang": "3/32", "bulletin.mention": "Bien", "bulletin.decision": "Admis(e) en classe supérieure",
  "paiement.montant": "500 000", "paiement.mode": "Orange Money", "paiement.date": "01/10/2025", "paiement.reference": "PAY-2025-000123",
  "facture.reference": "FAC-2025-0042", "facture.total": "600 000", "facture.paye": "500 000", "facture.reste": "100 000",
  "enseignant.nom": "BAH", "enseignant.prenom": "Ibrahima", "enseignant.matricule": "ENS-007", "enseignant.specialite": "Mathématiques",
  "paie.periode": "Octobre 2025", "paie.net": "1 200 000", "paie.brut": "1 300 000", "paie.retenues": "100 000", "paie.heures": "80 h",
  "diplome.intitule": "Brevet d'Études", "diplome.mention": "Très Bien", "motif": "Entretien pédagogique", "rendez_vous": "Lundi 13/10 à 14h00",
  "contrat.debut": "01/09/2025", "contrat.remuneration": "Selon grille en vigueur",
};

function TemplateCard({ t, canManage, onPreview, onGenerate, onEdit, onDefault, onRemove }: {
  t: DocumentTemplate; canManage: boolean;
  onPreview: () => void; onGenerate: () => void; onEdit: () => void; onDefault: () => void; onRemove: () => void;
}) {
  const q = useQuery(() => previewTemplate(t.id, SAMPLE), [t.id]);
  return (
    <Card>
      <CardBody className="space-y-2">
        <button type="button" onClick={onPreview} title="Prévisualiser"
          className="block h-44 w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
          {q.loading ? (
            <div className="flex h-full items-center justify-center"><Spinner /></div>
          ) : (
            <iframe title={t.name} srcDoc={q.data?.html ?? ""} tabIndex={-1} aria-hidden
              style={{ width: "250%", height: "250%", transform: "scale(0.4)", transformOrigin: "top left", border: "none", pointerEvents: "none" }} />
          )}
        </button>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-slate-900">{t.name}</p>
            <p className="text-xs text-slate-500">{DOC_TYPE_LABEL[t.documentType]} · {STYLE_LABEL[t.style]} · {t.pageFormat}</p>
          </div>
          {t.isDefault && <Badge tone="green">Défaut</Badge>}
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="ghost" onClick={onPreview}>Aperçu</Button>
          <Button size="sm" onClick={onGenerate}>Générer</Button>
          {canManage && <Button size="sm" variant="ghost" onClick={onEdit}>Modifier</Button>}
          {canManage && !t.isDefault && <Button size="sm" variant="ghost" onClick={onDefault}>Défaut</Button>}
          {canManage && <Button size="sm" variant="ghost" className="text-red-600" onClick={onRemove}>Suppr.</Button>}
        </div>
      </CardBody>
    </Card>
  );
}

function PreviewPane({ template, context }: { template: DocumentTemplate; context: Record<string, string> }) {
  const q = useQuery(() => previewTemplate(template.id, context), [template.id, JSON.stringify(context)]);
  if (q.loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  const html = q.data?.html ?? "";
  return (
    <div className="space-y-3">
      <iframe title="preview" srcDoc={html} className="h-[60vh] w-full rounded-xl border border-slate-200 bg-white" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => downloadWord(html, template.name)}>Word</Button>
        <Button onClick={() => printHtml(html)}>Imprimer / PDF</Button>
      </div>
    </div>
  );
}

const TEACHER_DOCS = new Set(["FICHE_PAIE", "CONTRAT_ENSEIGNANT", "ATTESTATION_TRAVAIL", "CERTIFICAT_TRAVAIL"]);
const INVOICE_DOCS = new Set(["FACTURE", "ECHEANCIER"]);
const PAYMENT_DOCS = new Set(["RECU_PAIEMENT", "HISTORIQUE_PAIEMENTS"]);

function GeneratePane({ template, onClose }: { template: DocumentTemplate; onClose: () => void }) {
  const vars = useMemo(() => extractVars(template.headerHtml, template.bodyHtml, template.footerHtml), [template]);
  const isTeacherDoc = TEACHER_DOCS.has(template.documentType);
  const isInvoiceDoc = INVOICE_DOCS.has(template.documentType);
  const isPaymentDoc = PAYMENT_DOCS.has(template.documentType);
  const isFinanceDoc = isInvoiceDoc || isPaymentDoc;
  const subjectKind = isTeacherDoc ? "TEACHER" : "STUDENT";
  const [ctx, setCtx] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{ html: string; reference: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [financeId, setFinanceId] = useState<string | null>(null);
  const [filling, setFilling] = useState(false);

  const studentsQuery = useQuery(() => (isTeacherDoc ? Promise.resolve([]) : searchStudents({ size: 1000 }).then((p) => p.content)), [isTeacherDoc]);
  const teachersQuery = useQuery(() => (isTeacherDoc ? listTeachers() : Promise.resolve([])), [isTeacherDoc]);
  const options = isTeacherDoc
    ? (teachersQuery.data ?? []).map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))
    : (studentsQuery.data ?? []).map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName} (${s.studentNumber})` }));

  const invoicesQuery = useQuery(() => (isInvoiceDoc && subjectId ? listInvoicesByStudent(Number(subjectId)) : Promise.resolve([])), [subjectId, isInvoiceDoc]);
  const paymentsQuery = useQuery(() => (isPaymentDoc && subjectId ? listPaymentsByStudent(Number(subjectId)) : Promise.resolve([])), [subjectId, isPaymentDoc]);
  const financeOptions = isInvoiceDoc
    ? (invoicesQuery.data ?? []).map((i) => ({ value: String(i.id), label: `${i.reference} · ${i.periodLabel ?? ""} · reste ${formatGNF(i.remainingBalance ?? i.totalAmount)}` }))
    : (paymentsQuery.data ?? []).map((p) => ({ value: String(p.id), label: `${p.reference} · ${formatGNF(p.amount)} · ${p.paidAt?.slice(0, 10) ?? ""}` }));

  async function pickSubject(value: string | null) {
    setSubjectId(value);
    setFinanceId(null);
    if (!value) return;
    setFilling(true);
    try {
      const resolved = await resolveDocumentContext(subjectKind, Number(value));
      setCtx((p) => ({ ...resolved, ...stripEmpty(p) })); // auto-fill, garde les saisies non vides
    } catch (err) { notifyError(err); } finally { setFilling(false); }
  }
  async function pickFinance(value: string | null) {
    setFinanceId(value);
    if (!value) return;
    setFilling(true);
    try {
      const resolved = await resolveDocumentContext(isInvoiceDoc ? "INVOICE" : "PAYMENT", Number(value));
      setCtx((p) => ({ ...p, ...resolved })); // la facture/paiement précis prime
    } catch (err) { notifyError(err); } finally { setFilling(false); }
  }
  function stripEmpty(o: Record<string, string>): Record<string, string> {
    return Object.fromEntries(Object.entries(o).filter(([, v]) => v && v.trim()));
  }

  async function generate() {
    setLoading(true);
    try {
      setResult(await generateDocument(template.id, {
        context: ctx, title: template.name,
        subjectType: subjectId ? subjectKind : null, subjectId: subjectId ? Number(subjectId) : null,
      }));
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-3">
      <MantineSelect label={`Pré-remplir depuis un ${isTeacherDoc ? "enseignant" : "élève"} (facultatif)`}
        placeholder={isTeacherDoc ? "Choisir un enseignant" : "Choisir un élève"} searchable clearable
        data={options} value={subjectId} onChange={pickSubject} rightSection={filling ? <Spinner /> : null} />
      {isFinanceDoc && subjectId && (
        <MantineSelect label={isInvoiceDoc ? "Facture" : "Paiement"} searchable clearable
          placeholder={isInvoiceDoc ? "Choisir la facture" : "Choisir le paiement"}
          data={financeOptions} value={financeId} onChange={pickFinance}
          nothingFoundMessage={isInvoiceDoc ? "Aucune facture" : "Aucun paiement"} />
      )}
      {vars.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {vars.map((v) => (
            <TextInput key={v} label={v} placeholder={`{{${v}}}`} value={ctx[v] ?? ""}
              onChange={(e) => setCtx((p) => ({ ...p, [v]: e.currentTarget.value }))} />
          ))}
        </div>
      )}
      {!result ? (
        <Button onClick={generate} loading={loading}>Générer le document</Button>
      ) : (
        <>
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Document généré — réf. <strong>{result.reference}</strong></p>
          <iframe title="doc" srcDoc={result.html} className="h-[55vh] w-full rounded-xl border border-slate-200 bg-white" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setResult(null)}>Modifier</Button>
            <Button variant="secondary" onClick={() => downloadWord(result.html, result.reference)}>Word</Button>
            <Button onClick={() => printHtml(result.html)}>Imprimer / PDF</Button>
            <Button variant="ghost" onClick={onClose}>Fermer</Button>
          </div>
        </>
      )}
    </div>
  );
}

function HistoryTab() {
  const q = useQuery(listGeneratedDocuments, []);
  if (q.loading) return <div className="flex justify-center py-10"><Spinner /></div>;
  const docs = q.data ?? [];
  return docs.length === 0 ? (
    <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">Aucun document généré.</p>
  ) : (
    <Card><CardBody>
      <Table>
        <THead><tr><TH>Référence</TH><TH>Type</TH><TH>Titre</TH><TH>Date</TH></tr></THead>
        <TBody>
          {docs.map((d) => (
            <TR key={d.id}>
              <TD className="font-mono text-xs">{d.reference}</TD>
              <TD>{DOC_TYPE_LABEL[d.documentType]}</TD>
              <TD className="text-sm text-slate-600">{d.title ?? "—"}</TD>
              <TD className="text-sm text-slate-500">{d.generatedAt?.slice(0, 16).replace("T", " ") ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </CardBody></Card>
  );
}

function TemplateEditor({ template, onCancel, onSaved }: {
  template: DocumentTemplate | null; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [f, setF] = useState<TemplateInput>(() => ({
    category: template?.category ?? "ADMINISTRATIF",
    documentType: template?.documentType ?? "CERTIFICAT_SCOLARITE",
    name: template?.name ?? "",
    style: template?.style ?? "MODERNE",
    headerHtml: template?.headerHtml ?? `<table style="width:100%"><tr><td>{{logo}}</td><td style="text-align:right"><h2>{{ecole.nom}}</h2><div>{{ecole.adresse}}</div></td></tr></table>`,
    bodyHtml: template?.bodyHtml ?? `<h1 style="text-align:center">CERTIFICAT DE SCOLARITÉ</h1>\n<p>Je soussigné(e), Directeur de {{ecole.nom}}, certifie que l'élève <strong>{{eleve.prenom}} {{eleve.nom}}</strong> (matricule {{eleve.matricule}}) est inscrit(e) en classe de <strong>{{eleve.classe}}</strong> pour l'année {{annee_scolaire}}.</p>\n<p style="margin-top:30px">Fait à {{ecole.ville}}, le {{date}}.</p>\n<div style="text-align:right;margin-top:20px">{{signature}}{{cachet}}</div>`,
    footerHtml: template?.footerHtml ?? `<div style="text-align:center">{{ecole.nom}} · {{ecole.telephone}} · Réf. {{reference}}</div>`,
    primaryColor: template?.primaryColor ?? "#1d4ed8",
    fontFamily: template?.fontFamily ?? "system-ui, Arial, sans-serif",
    logoUrl: template?.logoUrl ?? "",
    signatureUrl: template?.signatureUrl ?? "",
    stampUrl: template?.stampUrl ?? "",
    watermarkText: template?.watermarkText ?? "",
    pageFormat: template?.pageFormat ?? "A4",
    marginTop: template?.marginTop ?? 18, marginRight: template?.marginRight ?? 16,
    marginBottom: template?.marginBottom ?? 18, marginLeft: template?.marginLeft ?? 16,
    numberingPrefix: template?.numberingPrefix ?? "",
    active: template?.active ?? true,
  }));
  const set = <K extends keyof TemplateInput>(k: K, v: TemplateInput[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit() {
    if (!f.name.trim()) { notifyError("Le nom est requis."); return; }
    setLoading(true);
    try {
      if (template) await updateTemplate(template.id, f);
      else await createTemplate(f);
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <Stack gap="sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Nom du modèle" withAsterisk value={f.name} onChange={(e) => set("name", e.currentTarget.value)} />
        <MantineSelect label="Catégorie" allowDeselect={false} value={f.category}
          data={(Object.keys(CATEGORY_LABEL) as DocumentCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          onChange={(v) => set("category", (v ?? "ADMINISTRATIF") as DocumentCategory)} />
        <MantineSelect label="Type de document" searchable allowDeselect={false} value={f.documentType}
          data={(Object.keys(DOC_TYPE_LABEL) as DocumentType[]).map((t) => ({ value: t, label: DOC_TYPE_LABEL[t] }))}
          onChange={(v) => set("documentType", (v ?? "AUTRE") as DocumentType)} />
        <MantineSelect label="Style" allowDeselect={false} value={f.style}
          data={(Object.keys(STYLE_LABEL) as DocumentStyle[]).map((s) => ({ value: s, label: STYLE_LABEL[s] }))}
          onChange={(v) => set("style", (v ?? "MODERNE") as DocumentStyle)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <MantineSelect label="Format" allowDeselect={false} value={f.pageFormat}
          data={[{ value: "A4", label: "A4" }, { value: "A5", label: "A5" }]} onChange={(v) => set("pageFormat", (v ?? "A4") as PageFormat)} />
        <TextInput label="Couleur" value={f.primaryColor ?? ""} onChange={(e) => set("primaryColor", e.currentTarget.value)} />
        <TextInput label="Police" value={f.fontFamily ?? ""} onChange={(e) => set("fontFamily", e.currentTarget.value)} />
        <TextInput label="Préfixe n°" placeholder="CERT" value={f.numberingPrefix ?? ""} onChange={(e) => set("numberingPrefix", e.currentTarget.value)} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput label="Logo (URL)" value={f.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.currentTarget.value)} />
        <TextInput label="Filigrane" placeholder="COPIE" value={f.watermarkText ?? ""} onChange={(e) => set("watermarkText", e.currentTarget.value)} />
        <TextInput label="Signature (URL)" value={f.signatureUrl ?? ""} onChange={(e) => set("signatureUrl", e.currentTarget.value)} />
        <TextInput label="Cachet (URL)" value={f.stampUrl ?? ""} onChange={(e) => set("stampUrl", e.currentTarget.value)} />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <NumberInput label="Marge haut" min={0} value={f.marginTop} onChange={(v) => set("marginTop", Number(v) || 0)} />
        <NumberInput label="Marge droite" min={0} value={f.marginRight} onChange={(v) => set("marginRight", Number(v) || 0)} />
        <NumberInput label="Marge bas" min={0} value={f.marginBottom} onChange={(v) => set("marginBottom", Number(v) || 0)} />
        <NumberInput label="Marge gauche" min={0} value={f.marginLeft} onChange={(v) => set("marginLeft", Number(v) || 0)} />
      </div>
      <Textarea label="En-tête (HTML, variables {{...}})" autosize minRows={2} value={f.headerHtml ?? ""} onChange={(e) => set("headerHtml", e.currentTarget.value)} />
      <Textarea label="Corps (HTML)" autosize minRows={6} value={f.bodyHtml ?? ""} onChange={(e) => set("bodyHtml", e.currentTarget.value)} />
      <Textarea label="Pied de page (HTML)" autosize minRows={2} value={f.footerHtml ?? ""} onChange={(e) => set("footerHtml", e.currentTarget.value)} />
      <p className="text-xs text-slate-400">Variables : {`{{ecole.nom}} {{eleve.nom}} {{eleve.classe}} {{date}} {{reference}} {{logo}} {{signature}} {{cachet}}`}…</p>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </Stack>
  );
}
