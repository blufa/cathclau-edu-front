"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { getCatalogueMepua, importerMatieresMepua } from "@/lib/api/academics";
import type { Matiere, SchoolCycle } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

const SERIES_LYCEE = [
  { value: "SCIENCES", label: "11ème — Sciences (tronc commun)" },
  { value: "SOCIALES", label: "11ème — Sciences Sociales (tronc commun)" },
  { value: "SM", label: "Terminale — Sciences Mathématiques (SM)" },
  { value: "SE", label: "Terminale — Sciences Expérimentales (SE)" },
  { value: "SS", label: "Terminale — Sciences Sociales (SS)" },
];

/**
 * Import du catalogue officiel MEPUA (matière + coefficient déjà déterminé par le cycle/série),
 * plutôt qu'une liste de matières sans coefficient à ressaisir une par une.
 */
export function SubjectCatalogPicker({
  existing,
  onDone,
  onCancel,
}: {
  existing: Matiere[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [cycle, setCycle] = useState<SchoolCycle>("COLLEGE");
  const [serie, setSerie] = useState(SERIES_LYCEE[0].value);
  const [importing, setImporting] = useState(false);
  const effectiveSerie = cycle === "LYCEE" ? serie : undefined;

  const catalogueQuery = useQuery(() => getCatalogueMepua(cycle, effectiveSerie), [cycle, effectiveSerie]);
  const catalogue = catalogueQuery.data ?? [];
  const existingLabels = new Set(existing.map((m) => m.label.trim().toLowerCase()));

  async function handleImport() {
    setImporting(true);
    try {
      const created = await importerMatieresMepua(cycle, effectiveSerie);
      if (created.length === 0) {
        notifySuccess("Toutes les matières de ce programme existent déjà.");
      } else {
        notifySuccess(`${created.length} matière${created.length > 1 ? "s importées" : " importée"} (coefficient officiel appliqué)`);
      }
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setImporting(false);
    }
  }

  const importCount = catalogue.filter((m) => !existingLabels.has(m.libelle.trim().toLowerCase())).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Le coefficient officiel de chaque matière est déterminé par le programme (cycle/série) — pas besoin de le saisir.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Cycle</Label>
          <Select value={cycle} onChange={(e) => setCycle(e.target.value as SchoolCycle)}>
            <option value="PRIMAIRE">Primaire</option>
            <option value="COLLEGE">Collège</option>
            <option value="LYCEE">Lycée</option>
          </Select>
        </Field>
        {cycle === "LYCEE" && (
          <Field>
            <Label>Série</Label>
            <Select value={serie} onChange={(e) => setSerie(e.target.value)}>
              {SERIES_LYCEE.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
            </Select>
          </Field>
        )}
      </div>

      {catalogueQuery.loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : catalogue.length === 0 ? (
        <p className="py-6 text-center text-sm text-gray-400">Aucun programme officiel pour ce choix.</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {catalogue.map((m) => {
            const already = existingLabels.has(m.libelle.trim().toLowerCase());
            return (
              <div key={m.code} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm">
                <span className={already ? "text-gray-400" : "text-gray-800"}>
                  {m.libelle} {already && <span className="text-xs">(déjà créée)</span>}
                </span>
                <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                  Coef. {m.coefficient}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={importing}>Annuler</Button>
        <Button onClick={handleImport} loading={importing} disabled={catalogue.length === 0 || importCount === 0}>
          {importCount === 0 ? "Déjà toutes importées" : `Importer (${importCount})`}
        </Button>
      </div>
    </div>
  );
}
