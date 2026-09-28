"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { generateBadge, type BadgeResult } from "@/lib/api/biometric";
import { getCurrentAcademicYear } from "@/lib/api/academics";
import type { BiometricSubjectType } from "@/lib/types/biometric";
import { useDirectory } from "@/components/biometric/use-directory";
import { useQuery } from "@/hooks/use-query";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { printHtmlDocument } from "@/lib/print-node";

function qrUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/**
 * Génération de badges QR. La génération enrôle automatiquement la personne (élève ou enseignant) :
 * le QR « BADGE|tenant|type|id » est ensuite scannable au pointage (kiosk « Scanner les cartes »).
 */
export function BadgesTab() {
  const { teachers, students } = useDirectory();
  const yearQuery = useQuery(getCurrentAcademicYear, []);
  const yearLabel = yearQuery.data?.label ?? "";
  const [subjectType, setSubjectType] = useState<BiometricSubjectType>("STUDENT");
  const [subjectId, setSubjectId] = useState("");
  const [badge, setBadge] = useState<BadgeResult | null>(null);
  const [loading, setLoading] = useState(false);

  const options: SearchableOption[] = useMemo(() => {
    const src = subjectType === "STUDENT" ? students : teachers;
    return src.map((p) => {
      const label = `${p.firstName} ${p.lastName}`;
      return { value: String(p.id), trigger: label, label, searchText: label };
    });
  }, [subjectType, students, teachers]);

  const selectedName = useMemo(() => {
    const src = subjectType === "STUDENT" ? students : teachers;
    const p = src.find((x) => String(x.id) === subjectId);
    return p ? `${p.firstName} ${p.lastName}` : "";
  }, [subjectType, subjectId, students, teachers]);

  async function generate() {
    if (!subjectId) { notifyError("Sélectionnez une personne."); return; }
    setLoading(true);
    try {
      const b = await generateBadge(subjectType, Number(subjectId));
      setBadge(b);
      notifySuccess("Badge généré — la personne est enrôlée");
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  function printBadge() {
    if (!badge) return;
    printHtmlDocument(
      `<!doctype html><html><head><meta charset="utf-8"><title>Badge</title>`
      + `<style>body{font-family:system-ui,Arial,sans-serif;display:flex;justify-content:center;padding:24px}`
      + `.b{width:320px;border:1px solid #cbd5e1;border-radius:16px;padding:18px;text-align:center}`
      + `.t{font-weight:800;letter-spacing:2px;color:#1d4ed8}.n{margin:8px 0;font-size:16px;font-weight:600}`
      + `.id{font-size:11px;color:#64748b;margin-top:8px}.v{font-size:11px;color:#94a3b8;margin-top:2px}`
      + `@media print{body{padding:0}}</style></head><body>`
      + `<div class="b"><div class="t">BADGE</div><div class="n">${selectedName}</div>`
      + `<img src="${qrUrl(badge.qrPayload, 200)}" width="190" height="190" alt="QR"/>`
      + `<div class="id">${badge.externalUserId}</div>`
      + (yearLabel ? `<div class="v">Valide : ${yearLabel}</div>` : "")
      + `</div>`
      + `</body></html>`
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Générer un badge</h3>
          <div className="flex gap-2">
            {(["STUDENT", "TEACHER"] as BiometricSubjectType[]).map((t) => (
              <button key={t} type="button" onClick={() => { setSubjectType(t); setSubjectId(""); setBadge(null); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${subjectType === t ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {t === "STUDENT" ? "Élève" : "Enseignant / Personnel"}
              </button>
            ))}
          </div>
          <SearchableSelect value={subjectId} options={options} onChange={setSubjectId} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucune personne" />
          <Button onClick={generate} loading={loading} disabled={!subjectId}>Générer le badge (enrôle automatiquement)</Button>
          <p className="text-xs text-gray-400">Dès la génération, la personne est enrôlée : son badge QR fonctionne immédiatement au pointage (élèves <strong>et</strong> personnel).</p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Badge</h3>
          {!badge ? (
            <p className="py-10 text-center text-sm text-gray-400">Aucun badge généré.</p>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto w-[280px] rounded-2xl border border-gray-200 p-4 text-center">
                <div className="text-sm font-extrabold tracking-widest text-brand-700">BADGE</div>
                <div className="mt-1 text-base font-semibold text-gray-900">{selectedName}</div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl(badge.qrPayload)} alt="QR badge" width={180} height={180} className="mx-auto my-2" />
                <div className="text-xs text-gray-400">{badge.externalUserId}</div>
                {yearLabel && <div className="text-xs text-gray-400">Valide : {yearLabel}</div>}
              </div>
              <div className="flex justify-center">
                <Button variant="secondary" leftSection={<Printer className="h-4 w-4" />} onClick={printBadge}>Imprimer le badge</Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
