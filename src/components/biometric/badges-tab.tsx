"use client";

import { useMemo, useState } from "react";
import { Nfc, Printer } from "lucide-react";
import { associateNfcUid, generateBadge, type BadgeResult } from "@/lib/api/biometric";
import { getCurrentAcademicYear } from "@/lib/api/academics";
import { SUBJECT_TYPE_LABEL, type BiometricSubjectType } from "@/lib/types/biometric";
import { useDirectory } from "@/components/biometric/use-directory";
import { useQuery } from "@/hooks/use-query";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { printHtmlDocument } from "@/lib/print-node";

function qrUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/** API native Web NFC (Chrome Android uniquement — absente des types DOM standards de TypeScript) :
 * lit l'UID matériel d'une carte NFC présentée au téléphone/tablette. Ailleurs (desktop, iOS), on
 * retombe sur la saisie manuelle de l'UID ci-dessous — même repli que le scan QR par caméra. */
interface NDEFReadingEventLike { serialNumber: string }
interface NDEFReaderLike {
  scan(): Promise<void>;
  onreading: ((event: NDEFReadingEventLike) => void) | null;
  onreadingerror: (() => void) | null;
}

/**
 * Génération de badges QR. La génération enrôle automatiquement la personne (élève ou enseignant) :
 * le QR « BADGE2|<jeton opaque> » est ensuite scannable au pointage (kiosk « Scanner les cartes »).
 * Régénérer le badge d'une personne révoque silencieusement tout ancien QR déjà imprimé pour elle
 * (perte/vol : on régénère, l'ancien devient inutilisable).
 */
export function BadgesTab() {
  const { teachers, students, employees } = useDirectory();
  const yearQuery = useQuery(getCurrentAcademicYear, []);
  const yearLabel = yearQuery.data?.label ?? "";
  const [subjectType, setSubjectType] = useState<BiometricSubjectType>("STUDENT");
  const [subjectId, setSubjectId] = useState("");
  const [badge, setBadge] = useState<BadgeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [nfcUidInput, setNfcUidInput] = useState("");
  const [nfcScanning, setNfcScanning] = useState(false);
  const [nfcAssociating, setNfcAssociating] = useState(false);
  const [nfcAssociated, setNfcAssociated] = useState<string | null>(null);
  const nfcAvailable = typeof window !== "undefined" && "NDEFReader" in window;

  const directory = useMemo(
    () => (subjectType === "STUDENT" ? students : subjectType === "TEACHER" ? teachers : employees),
    [subjectType, students, teachers, employees],
  );

  const options: SearchableOption[] = useMemo(() => {
    return directory.map((p) => {
      const label = `${p.firstName} ${p.lastName}`;
      return { value: String(p.id), trigger: label, label, searchText: label };
    });
  }, [directory]);

  const selectedName = useMemo(() => {
    const p = directory.find((x) => String(x.id) === subjectId);
    return p ? `${p.firstName} ${p.lastName}` : "";
  }, [directory, subjectId]);

  async function generate() {
    if (!subjectId) { notifyError("Sélectionnez une personne."); return; }
    setLoading(true);
    try {
      const b = await generateBadge(subjectType, Number(subjectId));
      setBadge(b);
      setNfcUidInput("");
      setNfcAssociated(null);
      notifySuccess("Badge généré — la personne est enrôlée");
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  async function associateNfc(uid: string) {
    if (!badge || !uid.trim()) return;
    setNfcAssociating(true);
    try {
      await associateNfcUid(badge.enrollmentId, uid.trim());
      setNfcAssociated(uid.trim());
      notifySuccess("Carte NFC associée au badge.");
    } catch (e) { notifyError(e); } finally { setNfcAssociating(false); }
  }

  // Lecture NFC native (Chrome Android) : l'utilisateur présente la carte, on en extrait l'UID matériel
  // puis on l'associe directement — sans ressaisie manuelle quand le matériel le permet.
  async function scanNfcCard() {
    const Ctor = (window as unknown as { NDEFReader?: new () => NDEFReaderLike }).NDEFReader;
    if (!Ctor) { notifyError("Lecture NFC non disponible sur cet appareil — saisissez l'UID manuellement."); return; }
    setNfcScanning(true);
    try {
      const reader = new Ctor();
      await reader.scan();
      await new Promise<void>((resolve, reject) => {
        reader.onreading = (event) => {
          setNfcUidInput(event.serialNumber);
          associateNfc(event.serialNumber);
          resolve();
        };
        reader.onreadingerror = () => reject(new Error("Lecture de la carte impossible, réessayez."));
      });
    } catch (e) {
      notifyError(e);
    } finally {
      setNfcScanning(false);
    }
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
            {(["STUDENT", "TEACHER", "EMPLOYEE"] as BiometricSubjectType[]).map((t) => (
              <button key={t} type="button" onClick={() => { setSubjectType(t); setSubjectId(""); setBadge(null); }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${subjectType === t ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {SUBJECT_TYPE_LABEL[t]}
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

              <div className="space-y-2 border-t border-gray-100 pt-3">
                <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-600">
                  <Nfc className="h-3.5 w-3.5" /> Carte NFC (optionnel)
                </h4>
                {nfcAssociated ? (
                  <p className="text-xs text-success-600">Carte NFC associée ({nfcAssociated}) — pointage possible par badge QR ou carte NFC.</p>
                ) : (
                  <p className="text-xs text-gray-400">Même badge, deuxième technologie : présentez la carte (Android) ou saisissez son UID.</p>
                )}
                {nfcAvailable && (
                  <Button size="sm" variant="secondary" loading={nfcScanning}
                    leftSection={<Nfc className="h-3.5 w-3.5" />} onClick={scanNfcCard}>
                    Présenter la carte NFC
                  </Button>
                )}
                <div className="flex gap-2">
                  <Input value={nfcUidInput} onChange={(e) => setNfcUidInput(e.target.value)}
                    placeholder="UID de la carte (saisie manuelle)" className="flex-1 text-sm" aria-label="UID de la carte NFC" />
                  <Button size="sm" variant="secondary" loading={nfcAssociating} disabled={!nfcUidInput.trim()}
                    onClick={() => associateNfc(nfcUidInput)}>
                    Associer
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
