"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select as MantineSelect } from "@mantine/core";
import { CheckCircle2, ScanLine, Video, VideoOff, XCircle } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { searchStudents } from "@/lib/api/students";
import { listTeachers } from "@/lib/api/staff";
import { scanAttendance, type ScanSubjectType } from "@/lib/api/attendance";
import { ATTENDANCE_STATUS_LABEL, type AttendanceStatus } from "@/lib/types/attendance";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Reveal } from "@/components/public/reveal";
import { matriculeFromQr } from "@/lib/identity-qr";
import { notifyError } from "@/lib/feedback";

// Minimal typing for the native BarcodeDetector API (no dependency).
interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

interface ScanFeedItem { id: string; name: string; status: AttendanceStatus; ok: boolean; at: string }

type ParseResult =
  | { subjectType: ScanSubjectType; subjectId: number }
  | { matricule: string };

/**
 * Décode un QR scanné :
 *  - QR d'identité lisible (« … Matricule : GSC-ELV-… ») → on retrouve l'élève par matricule ;
 *  - ancien format carte « LACA|tenant|studentId|… » (rétro-compat) → élève par id ;
 *  - badge biométrique « BADGE|tenant|TYPE|id » → élève ou enseignant par id.
 */
function parseScan(raw: string): ParseResult | null {
  const parts = raw.split("|");
  if (parts[0] === "LACA" && parts.length >= 3) {
    const id = Number(parts[2]);
    return Number.isFinite(id) && id > 0 ? { subjectType: "STUDENT", subjectId: id } : null;
  }
  if (parts[0] === "BADGE" && parts.length >= 4) {
    const type = parts[2];
    const id = Number(parts[3]);
    if ((type === "STUDENT" || type === "TEACHER") && Number.isFinite(id) && id > 0) {
      return { subjectType: type, subjectId: id };
    }
  }
  const matricule = matriculeFromQr(raw);
  return matricule ? { matricule } : null;
}

const STATUS_TONE: Record<AttendanceStatus, "green" | "red" | "amber"> = { PRESENT: "green", ABSENT: "red", LATE: "amber" };

export default function AttendanceScanPage() {
  const { user } = useAuth();
  const canScan = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const lastRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  // Sujets dont un pointage est en cours : évite deux envois simultanés pour la même personne.
  const inFlightRef = useRef<Set<string>>(new Set());

  const [streaming, setStreaming] = useState(false);
  const [supported, setSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<AttendanceStatus>("PRESENT");
  const [feed, setFeed] = useState<ScanFeedItem[]>([]);

  // Manual / teacher fallback
  const [subjectType, setSubjectType] = useState<ScanSubjectType>("STUDENT");
  const [manualId, setManualId] = useState<string | null>(null);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const teachersQuery = useQuery(listTeachers, []);
  const manualOptions = useMemo(() => {
    const src = subjectType === "STUDENT" ? (studentsQuery.data ?? []) : (teachersQuery.data ?? []);
    return src.map((p) => ({ value: String(p.id), label: `${p.firstName} ${p.lastName}` }));
  }, [subjectType, studentsQuery.data, teachersQuery.data]);

  const submit = useCallback(async (type: ScanSubjectType, subjectId: number, st: AttendanceStatus) => {
    const key = `${type}:${subjectId}`;
    if (inFlightRef.current.has(key)) return; // un pointage est déjà en cours pour ce sujet
    inFlightRef.current.add(key);
    try {
      const res = await scanAttendance({ subjectType: type, subjectId, status: st });
      setFeed((f) => [{ id: `${Date.now()}`, name: res.name ?? `#${res.subjectId}`, status: res.status, ok: true, at: new Date().toLocaleTimeString() }, ...f].slice(0, 25));
    } catch (err) {
      setFeed((f) => [{ id: `${Date.now()}`, name: `#${subjectId}`, status: st, ok: false, at: new Date().toLocaleTimeString() }, ...f].slice(0, 25));
      notifyError(err);
    } finally {
      inFlightRef.current.delete(key);
    }
  }, []);

  const handleRaw = useCallback((raw: string) => {
    const now = Date.now();
    if (raw === lastRef.current.key && now - lastRef.current.at < 3000) return; // debounce same code
    const parsed = parseScan(raw);
    if (!parsed) return;
    lastRef.current = { key: raw, at: now };
    if ("matricule" in parsed) {
      // QR d'identité lisible : on retrouve la personne par son matricule (listes déjà chargées) —
      // élève d'abord, sinon enseignant.
      const mat = parsed.matricule.toLowerCase();
      const student = (studentsQuery.data ?? []).find((s) => (s.studentNumber ?? "").trim().toLowerCase() === mat);
      if (student) {
        submit("STUDENT", student.id, status);
        return;
      }
      const teacher = (teachersQuery.data ?? []).find((t) => (t.staffNumber ?? "").trim().toLowerCase() === mat);
      if (teacher) {
        submit("TEACHER", teacher.id, status);
        return;
      }
      notifyError(`Matricule introuvable : ${parsed.matricule}`);
      return;
    }
    submit(parsed.subjectType, parsed.subjectId, status);
  }, [status, submit, studentsQuery.data, teachersQuery.data]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    const Ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Ctor) { setSupported(false); }
    if (!navigator.mediaDevices?.getUserMedia) { setError("Caméra non disponible sur ce navigateur."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      if (Ctor) detectorRef.current = new Ctor({ formats: ["qr_code"] });
      setStreaming(true);
      const tick = async () => {
        if (videoRef.current && detectorRef.current) {
          try {
            const codes = await detectorRef.current.detect(videoRef.current);
            if (codes.length) handleRaw(codes[0].rawValue);
          } catch { /* frame not ready */ }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Caméra inaccessible : autorisez l'accès à la caméra.");
    }
  }, [handleRaw]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  if (!canScan) return <p className="rounded-xl bg-red-50 px-4 py-6 text-sm text-red-700">Accès non autorisé.</p>;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
          <ScanLine className="h-6 w-6 text-brand-600" /> Pointage par scan de carte
        </h1>
        <p className="text-sm text-slate-500">Présentez la carte scolaire devant la caméra (téléphone ou ordinateur). Élèves et enseignants.</p>
      </Reveal>

      {/* Status selector — applies to every scan */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-600">Statut à appliquer :</span>
        {(["PRESENT", "ABSENT", "LATE"] as AttendanceStatus[]).map((s) => (
          <button key={s} type="button" onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === s
              ? s === "PRESENT" ? "bg-emerald-600 text-white" : s === "ABSENT" ? "bg-red-600 text-white" : "bg-amber-500 text-white"
              : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
            {ATTENDANCE_STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              {streaming && <div className="pointer-events-none absolute inset-x-10 inset-y-8 rounded-xl border-2 border-brand-400/70" />}
              {!streaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <VideoOff className="h-8 w-8" /><span className="text-sm">Caméra éteinte</span>
                </div>
              )}
            </div>
            {!supported && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Ce navigateur ne décode pas les QR nativement — utilisez la sélection manuelle ci-contre (ou Chrome/Android, Safari iOS 17+).</p>}
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              {!streaming ? (
                <Button onClick={startCamera} leftSection={<Video className="h-4 w-4" />}>Démarrer le scan</Button>
              ) : (
                <Button variant="ghost" className="text-red-600" leftSection={<VideoOff className="h-4 w-4" />} onClick={stopCamera}>Arrêter</Button>
              )}
            </div>
            <p className="text-xs text-slate-400">Le statut sélectionné ci-dessus est appliqué à chaque carte scannée. Un re-scan corrige le statut du jour.</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Pointage manuel</h3>
              <div className="mb-2 flex gap-2">
                {(["STUDENT", "TEACHER"] as ScanSubjectType[]).map((t) => (
                  <button key={t} type="button" onClick={() => { setSubjectType(t); setManualId(null); }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${subjectType === t ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {t === "STUDENT" ? "Élève" : "Enseignant / Direction"}
                  </button>
                ))}
              </div>
              <MantineSelect placeholder={subjectType === "STUDENT" ? "Rechercher un élève" : "Rechercher un enseignant / membre de la direction"} searchable
                data={manualOptions} value={manualId} onChange={setManualId} />
              <Button className="mt-2" disabled={!manualId}
                onClick={() => { if (manualId) submit(subjectType, Number(manualId), status); setManualId(null); }}>
                Pointer ({ATTENDANCE_STATUS_LABEL[status]})
              </Button>
              {subjectType === "TEACHER" && <p className="mt-1 text-xs text-slate-400">Enseignant / direction : présent / absent (le retard est compté présent côté RH). Le personnel de direction doit être enregistré comme membre du staff.</p>}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">Pointages récents</h3>
              {feed.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">Aucun pointage pour l&apos;instant.</p>
              ) : (
                <ul className="space-y-1.5">
                  {feed.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm">
                        {f.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                        <span className="font-medium text-slate-800">{f.name}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge tone={STATUS_TONE[f.status]}>{ATTENDANCE_STATUS_LABEL[f.status]}</Badge>
                        <span className="text-xs text-slate-400">{f.at}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
