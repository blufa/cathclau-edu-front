"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Download, Upload } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { importStudentsCsv, type ImportReport } from "@/lib/api/students";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";

const HEADER = "firstName,lastName,gender,birthDate,birthPlace,phone,email,nationality,studentNumber,originSchool";
const SAMPLE = [
  "Mariama,Diallo,FEMALE,2012-09-01,Conakry,620000000,,Guinéenne,,École Sainte-Marie",
  "Mamadou,Bah,MALE,2011-03-15,Labé,621111111,parent@mail.com,Guinéenne,,",
].join("\n");

export default function StudentImportPage() {
  const { user } = useAuth();
  const allowed = hasRole(user, "SUPER_ADMIN", "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR") || hasAnyPermission(user, ["eleve:create"]);

  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([`${HEADER}\n${SAMPLE}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modele-import-eleves.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setReport(null);
    try {
      const r = await importStudentsCsv(file);
      setReport(r);
      notifySuccess(`${r.created} élève(s) importé(s) sur ${r.total}`);
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Accès réservé à l&apos;administration.</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/students" className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline">
        <ArrowLeft className="h-4 w-4" /> Retour aux élèves
      </Link>

      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Import d&apos;élèves (rentrée)</h1>
        <p className="text-sm text-slate-500">Importez une liste d&apos;élèves depuis un fichier CSV (export Excel possible : « Enregistrer sous → CSV »).</p>
      </Reveal>

      <Card>
        <CardBody className="space-y-4">
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Colonnes attendues (1re ligne = en-tête) :</p>
            <code className="mt-1 block overflow-x-auto whitespace-pre text-xs text-slate-500">{HEADER}</code>
            <ul className="mt-2 list-inside list-disc text-xs text-slate-500">
              <li><strong>firstName</strong> et <strong>lastName</strong> obligatoires ; les autres colonnes sont optionnelles.</li>
              <li><strong>gender</strong> : MALE / FEMALE (ou commençant par F pour fille).</li>
              <li><strong>birthDate</strong> : AAAA-MM-JJ ou JJ/MM/AAAA. <strong>studentNumber</strong> vide = matricule auto-généré.</li>
              <li>Le quota d&apos;élèves du plan est respecté (les lignes en dépassement sont signalées).</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={downloadTemplate} leftSection={<Download className="h-4 w-4" />}>Télécharger le modèle</Button>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setReport(null); }}
              className="block text-sm text-slate-600 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
            />
            <Button onClick={runImport} loading={busy} disabled={!file} leftSection={<Upload className="h-4 w-4" />}>Importer</Button>
          </div>
        </CardBody>
      </Card>

      {report && (
        <Card>
          <CardBody className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <Badge tone="indigo">Total : {report.total}</Badge>
              <Badge tone="green">Créés : {report.created}</Badge>
              <Badge tone={report.errors.length ? "red" : "green"}>Erreurs : {report.errors.length}</Badge>
            </div>
            {report.errors.length > 0 ? (
              <Table>
                <THead><tr><TH>Ligne</TH><TH>Erreur</TH></tr></THead>
                <TBody>
                  {report.errors.map((e) => (
                    <TR key={e.line}><TD className="font-mono text-xs">{e.line}</TD><TD className="text-red-600">{e.message}</TD></TR>
                  ))}
                </TBody>
              </Table>
            ) : (
              <p className="text-sm text-green-700">Toutes les lignes ont été importées avec succès.</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
