"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import jsQR from "jsqr";
import { ArrowLeft, CheckCircle2, LogIn, LogOut, ScanLine, UserX, Video, VideoOff, XCircle } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { searchStudents } from "@/lib/api/students";
import { listTeachers, listEmployees } from "@/lib/api/staff";
import { getStudentParents } from "@/lib/api/parents";
import { justifyAttendance, markEmployeeAbsent, markStudentAbsent, markTeacherAbsent, notifyParentNow, recordChildPickup, type ChildPickup, type ScanSubjectType } from "@/lib/api/attendance";
import { ATTENDANCE_OUTCOME_LABEL, SCAN_DIRECTION_LABEL, type AttendanceOutcome, type ScanDirection } from "@/lib/types/attendance";
import { submitScanOfflineAware } from "@/lib/offline/submit-attendance-offline-aware";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { IdBadge } from "@/components/cards/id-badge";
import { Reveal } from "@/components/public/reveal";
import { matriculeFromQr } from "@/lib/identity-qr";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatMinutes, formatTime } from "@/lib/format";

interface ScanFeedItem {
  id: string;
  name: string;
  kind: "ENTRY" | "EXIT" | "ABSENT";
  outcome?: AttendanceOutcome | null;
  lateMinutes?: number | null;
  checkOutTime?: string | null;
  realizedMinutes?: number | null;
  scheduledMinutes?: number | null;
  earlyMinutes?: number | null;
  /** Entrée élève en retard uniquement : permet d'afficher « Notifier »/« Justifier » directement. */
  subjectType?: ScanSubjectType;
  studentAttendanceId?: number | null;
  ok: boolean;
  at: string;
}

type ParseResult =
  | { subjectType: ScanSubjectType; subjectId: number }
  | { matricule: string };

/**
 * Décode un QR scanné :
 *  - QR d'identité lisible (« … Matricule : GSC-ELV-… ») → on retrouve l'élève par matricule ;
 *  - ancien format carte « LACA|tenant|studentId|… » (rétro-compat) → élève par id ;
 *  - badge biométrique « BADGE|tenant|TYPE|id » → élève, enseignant ou personnel par id.
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
    if ((type === "STUDENT" || type === "TEACHER" || type === "EMPLOYEE") && Number.isFinite(id) && id > 0) {
      return { subjectType: type, subjectId: id };
    }
  }
  const matricule = matriculeFromQr(raw);
  return matricule ? { matricule } : null;
}

export default function AttendanceScanPage() {
  const { user } = useAuth();
  // L'enseignant ne doit jamais pouvoir scanner (ni lui-même ni les élèves) — retiré volontairement.
  // TODO : ajouter le rôle SURVEILLANT une fois créé (rôle prévu pour la surveillance/scan).
  const canScan = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "STUDENT");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef<{ key: string; at: number }>({ key: "", at: 0 });
  // Sujets dont un pointage est en cours : évite deux envois simultanés pour la même personne.
  const inFlightRef = useRef<Set<string>>(new Set());

  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direction, setDirection] = useState<ScanDirection>("ENTRY");
  const [feed, setFeed] = useState<ScanFeedItem[]>([]);
  // Badge de retrait (maternelle/primaire) : ouvert automatiquement après une sortie qui le requiert.
  const [pickupPrompt, setPickupPrompt] = useState<{ studentId: number; name: string } | null>(null);

  // Manual / teacher / employee fallback
  const [subjectType, setSubjectType] = useState<ScanSubjectType>("STUDENT");
  const [manualId, setManualId] = useState("");
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const teachersQuery = useQuery(listTeachers, []);
  const employeesQuery = useQuery(() => listEmployees(), []);
  const manualOptions: SearchableOption[] = useMemo(() => {
    if (subjectType === "EMPLOYEE") {
      return (employeesQuery.data ?? []).map((p) => {
        const label = `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim();
        return { value: String(p.id), trigger: label, label, searchText: label };
      });
    }
    const src = subjectType === "STUDENT" ? (studentsQuery.data ?? []) : (teachersQuery.data ?? []);
    return src.map((p) => {
      const label = `${p.firstName} ${p.lastName}`;
      return { value: String(p.id), trigger: label, label, searchText: label };
    });
  }, [subjectType, studentsQuery.data, teachersQuery.data, employeesQuery.data]);

  const pushFeed = useCallback((item: ScanFeedItem) => {
    setFeed((f) => [item, ...f].slice(0, 25));
  }, []);

  const submit = useCallback(async (type: ScanSubjectType, subjectId: number, dir: ScanDirection) => {
    const key = `${type}:${subjectId}:${dir}`;
    if (inFlightRef.current.has(key)) return; // un pointage est déjà en cours pour ce sujet
    inFlightRef.current.add(key);
    try {
      const attempt = await submitScanOfflineAware(type, subjectId, dir);
      if (attempt.outcome === "queued") {
        // Hors-ligne : le retard/durée n'est calculé que côté serveur, donc pas de retour riche ici —
        // seul le fait que le scan a bien été enregistré localement est garanti (synchro automatique).
        pushFeed({
          id: `${Date.now()}`, name: `#${subjectId}`, kind: dir,
          ok: true, at: new Date().toLocaleTimeString(),
        });
        notifySuccess("Scan enregistré hors-ligne — sera synchronisé automatiquement.");
        return;
      }
      const res = attempt.result;
      pushFeed({
        id: `${Date.now()}`, name: res.name ?? `#${res.subjectId}`, kind: res.direction,
        outcome: res.outcome, lateMinutes: res.lateMinutes, checkOutTime: res.checkOutTime,
        realizedMinutes: res.realizedMinutes, scheduledMinutes: res.scheduledMinutes,
        earlyMinutes: res.earlyMinutes,
        subjectType: res.subjectType as ScanSubjectType, studentAttendanceId: res.studentAttendanceId,
        ok: true, at: new Date().toLocaleTimeString(),
      });
      if (res.requiresPickupInfo) {
        setPickupPrompt({ studentId: subjectId, name: res.name ?? `#${subjectId}` });
      }
    } catch (err) {
      pushFeed({ id: `${Date.now()}`, name: `#${subjectId}`, kind: dir, ok: false, at: new Date().toLocaleTimeString() });
      notifyError(err);
    } finally {
      inFlightRef.current.delete(key);
    }
  }, [pushFeed]);

  const markAbsent = useCallback(async (type: ScanSubjectType, subjectId: number, name: string) => {
    try {
      if (type === "STUDENT") await markStudentAbsent(subjectId);
      else if (type === "EMPLOYEE") await markEmployeeAbsent(subjectId);
      else await markTeacherAbsent(subjectId);
      pushFeed({ id: `${Date.now()}`, name, kind: "ABSENT", ok: true, at: new Date().toLocaleTimeString() });
    } catch (err) {
      notifyError(err);
    }
  }, [pushFeed]);

  const handleRaw = useCallback((raw: string) => {
    const now = Date.now();
    // Débounce par carte + sens choisi : re-sélectionner l'autre sens et rescanner la même carte
    // doit repartir immédiatement, pas rester bloqué par le dernier scan.
    const debounceKey = `${raw}:${direction}`;
    if (debounceKey === lastRef.current.key && now - lastRef.current.at < 3000) return;
    const parsed = parseScan(raw);
    if (!parsed) return;
    lastRef.current = { key: debounceKey, at: now };
    if ("matricule" in parsed) {
      // QR d'identité lisible : on retrouve la personne par son matricule (listes déjà chargées) —
      // élève, puis enseignant, puis personnel non-enseignant.
      const mat = parsed.matricule.toLowerCase();
      const student = (studentsQuery.data ?? []).find((s) => (s.studentNumber ?? "").trim().toLowerCase() === mat);
      if (student) {
        submit("STUDENT", student.id, direction);
        return;
      }
      const teacher = (teachersQuery.data ?? []).find((t) => (t.staffNumber ?? "").trim().toLowerCase() === mat);
      if (teacher) {
        submit("TEACHER", teacher.id, direction);
        return;
      }
      const employee = (employeesQuery.data ?? []).find((e) => (e.employeeNumber ?? "").trim().toLowerCase() === mat);
      if (employee) {
        submit("EMPLOYEE", employee.id, direction);
        return;
      }
      notifyError(`Matricule introuvable : ${parsed.matricule}`);
      return;
    }
    submit(parsed.subjectType, parsed.subjectId, direction);
  }, [direction, submit, studentsQuery.data, teachersQuery.data, employeesQuery.data]);

  // La boucle de lecture caméra (tick, ci-dessous) est lancée UNE fois par startCamera() et se
  // rappelle elle-même en boucle via requestAnimationFrame — sa closure sur handleRaw reste donc
  // figée à sa valeur du moment où la caméra a démarré. Sans cette ref, basculer Entrée/Sortie (ou le
  // profil élève/enseignant/personnel) après le démarrage de la caméra n'avait aucun effet sur les
  // scans suivants : ils continuaient à utiliser l'ancien sens (« Entrée ») malgré le bouton « Sortie »
  // sélectionné à l'écran — d'où un scan de sortie traité comme une nouvelle entrée (même retard
  // affiché, calculé sur la même séance déjà pointée en entrée).
  const handleRawRef = useRef(handleRaw);
  useEffect(() => { handleRawRef.current = handleRaw; }, [handleRaw]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const startCamera = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) { setError("Caméra non disponible sur ce navigateur."); return; }
    try {
      // Résolution demandée à la caméra la plus haute possible (surtout sur téléphone, où la
      // résolution par défaut de la caméra arrière peut être basse) : plus de détail = un QR code
      // plus petit, plus loin ou incliné dans l'image reste décodable.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
      setStreaming(true);
      // Décodage QR en JS pur (jsQR) via un canvas caché : fonctionne sur tous les navigateurs,
      // contrairement à l'API native BarcodeDetector (absente de Firefox et de la plupart des
      // versions de Safari iOS), qui laissait le scan tourner sans jamais rien détecter.
      const MAX_DIM = 900; // détail suffisant pour décoder un QR petit/incliné dans l'image, sans
      // traiter le flux en pleine résolution à chaque frame (coût CPU).
      const tick = () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
          const scale = Math.min(1, MAX_DIM / Math.max(video.videoWidth, video.videoHeight));
          canvas.width = Math.round(video.videoWidth * scale);
          canvas.height = Math.round(video.videoHeight * scale);
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // "attemptBoth" : essaie aussi les couleurs inversées (code clair sur fond sombre,
            // reflets d'écran de téléphone…) — améliore la détection quelle que soit la position.
            const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" });
            if (code?.data) handleRawRef.current(code.data);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setError("Caméra inaccessible : autorisez l'accès à la caméra.");
    }
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  if (!canScan) return <p className="rounded-xl bg-error-50 px-4 py-6 text-sm text-error-700">Accès non autorisé.</p>;

  return (
    <div className="space-y-6">
      <Link href="/attendance" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Retour aux présences
      </Link>

      <Reveal y={12}>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <ScanLine className="h-6 w-6 text-brand-600" /> Pointage par scan de carte
        </h1>
        <p className="text-sm text-gray-500">
          Scannez à l&apos;entrée et à la sortie de chaque cours (téléphone ou ordinateur). Le statut
          (présent/retard) et la durée réalisée sont calculés automatiquement à partir de l&apos;emploi
          du temps — vous choisissez seulement le sens du scan.
        </p>
      </Reveal>

      {/* Direction selector — applies to every scan */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-gray-600">Sens du scan :</span>
        {(["ENTRY", "EXIT"] as ScanDirection[]).map((d) => (
          <button key={d} type="button" onClick={() => setDirection(d)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${direction === d
              ? d === "ENTRY" ? "bg-success-600 text-white" : "bg-brand-600 text-white"
              : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
            {d === "ENTRY" ? <LogIn className="h-3.5 w-3.5" /> : <LogOut className="h-3.5 w-3.5" />}
            {SCAN_DIRECTION_LABEL[d]}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-3">
            <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-900">
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {streaming && <div className="pointer-events-none absolute inset-x-10 inset-y-8 rounded-xl border-2 border-brand-400/70" />}
              {!streaming && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                  <VideoOff className="h-8 w-8" /><span className="text-sm">Caméra éteinte</span>
                </div>
              )}
            </div>
            {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
            <div className="flex gap-2">
              {!streaming ? (
                <Button onClick={startCamera} leftSection={<Video className="h-4 w-4" />}>Démarrer le scan</Button>
              ) : (
                <Button variant="ghost" className="text-error-600" leftSection={<VideoOff className="h-4 w-4" />} onClick={stopCamera}>Arrêter</Button>
              )}
            </div>
            <p className="text-xs text-gray-400">Le sens sélectionné ci-dessus est appliqué à chaque carte scannée. Un re-scan corrige le pointage de la séance.</p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Pointage manuel</h3>
              <div className="mb-2 flex gap-2">
                {(["STUDENT", "TEACHER", "EMPLOYEE"] as ScanSubjectType[]).map((t) => (
                  <button key={t} type="button" onClick={() => { setSubjectType(t); setManualId(""); }}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${subjectType === t ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                    {t === "STUDENT" ? "Élève" : t === "TEACHER" ? "Enseignant" : "Personnel"}
                  </button>
                ))}
              </div>
              <SearchableSelect
                noResultsLabel={subjectType === "STUDENT" ? "Aucun élève" : subjectType === "TEACHER" ? "Aucun enseignant" : "Aucun membre du personnel"}
                options={manualOptions} value={manualId} onChange={setManualId}
                triggerClassName="w-full justify-between px-3" />
              <div className="mt-2 flex flex-wrap gap-2">
                <Button disabled={!manualId}
                  onClick={() => { if (manualId) submit(subjectType, Number(manualId), direction); }}
                  leftSection={direction === "ENTRY" ? <LogIn className="h-4 w-4" /> : <LogOut className="h-4 w-4" />}>
                  Pointer ({SCAN_DIRECTION_LABEL[direction]})
                </Button>
                <Button variant="ghost" className="text-error-600" disabled={!manualId}
                  leftSection={<UserX className="h-4 w-4" />}
                  onClick={() => {
                    if (!manualId) return;
                    const opt = manualOptions.find((o) => o.value === manualId);
                    markAbsent(subjectType, Number(manualId), opt?.searchText ?? `#${manualId}`);
                  }}>
                  Marquer absent
                </Button>
              </div>
              {subjectType === "EMPLOYEE" && <p className="mt-1 text-xs text-gray-400">Personnel administratif, direction et soutien — un seul pointage par jour (pas par cours).</p>}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">Pointages récents</h3>
              {feed.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">Aucun pointage pour l&apos;instant.</p>
              ) : (
                <ul className="space-y-1.5">
                  {feed.map((f) => (
                    <li key={f.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                      <span className="flex items-center gap-2 text-sm">
                        {f.ok ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : <XCircle className="h-4 w-4 text-error-600" />}
                        <span className="font-medium text-gray-800">{f.name}</span>
                      </span>
                      <FeedOutcome item={f} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

      {pickupPrompt && (
        <PickupModal studentId={pickupPrompt.studentId} studentName={pickupPrompt.name}
          onClose={() => setPickupPrompt(null)} />
      )}
    </div>
  );
}

/**
 * Badge de retrait (maternelle/primaire) : ouvert obligatoirement après une sortie d'un élève dont la
 * classe est de ce cycle. On choisit un parent/tuteur déjà lié à l'élève, ou « Autre personne » en
 * saisie libre, puis on imprime la preuve (même composant `IdBadge` que le badge élève — recto/verso
 * sur une seule page, format carte réel).
 */
function PickupModal({ studentId, studentName, onClose }: { studentId: number; studentName: string; onClose: () => void }) {
  const parentsQuery = useQuery(() => getStudentParents(studentId), [studentId]);
  const [parentId, setParentId] = useState("");
  const [other, setOther] = useState(false);
  const [otherName, setOtherName] = useState("");
  const [relation, setRelation] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickup, setPickup] = useState<ChildPickup | null>(null);

  const parentOptions: SearchableOption[] = useMemo(
    () => (parentsQuery.data ?? []).map((p) => {
      const label = `${p.firstName} ${p.lastName}`;
      return { value: String(p.id), trigger: label, label, searchText: label };
    }),
    [parentsQuery.data],
  );

  async function confirm() {
    setSaving(true);
    try {
      const result = await recordChildPickup(studentId, other
        ? { pickerName: otherName.trim(), pickerRelation: relation.trim() || undefined }
        : { pickerParentId: Number(parentId), pickerRelation: relation.trim() || undefined });
      setPickup(result);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  const canConfirm = other ? otherName.trim().length > 0 : !!parentId;

  return (
    <Modal open onClose={onClose} title="Badge de retrait">
      {pickup ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Retrait enregistré — imprimez le badge ci-dessous.</p>
          <IdBadge kind="Badge de retrait" fullName={studentName}
            fields={[
              { label: "Récupéré par", value: pickup.pickerName },
              { label: "Lien", value: pickup.pickerRelation || "—" },
              { label: "Date", value: pickup.pickupDate },
              { label: "Heure", value: pickup.pickupTime.slice(0, 5) },
            ]}
            footerNote="Preuve de retrait — à conserver par l'établissement." />
          <div className="flex justify-end"><Button onClick={onClose}>Terminé</Button></div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Élève de maternelle/primaire : qui vient récupérer <strong>{studentName}</strong> ?
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setOther(false)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${!other ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              Parent / tuteur déjà lié
            </button>
            <button type="button" onClick={() => setOther(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${other ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
              Autre personne
            </button>
          </div>
          {other ? (
            <Field>
              <Label>Nom de la personne</Label>
              <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} autoFocus />
            </Field>
          ) : (
            <Field>
              <Label>Parent / tuteur</Label>
              <SearchableSelect noResultsLabel="Aucun parent lié à cet élève"
                options={parentOptions} value={parentId} onChange={setParentId}
                triggerClassName="w-full justify-between px-3" />
            </Field>
          )}
          <Field>
            <Label>Lien avec l&apos;enfant (optionnel)</Label>
            <Input value={relation} onChange={(e) => setRelation(e.target.value)} placeholder="Père, Mère, Tuteur, Oncle…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>Annuler</Button>
            <Button disabled={!canConfirm} loading={saving} onClick={confirm}>Confirmer le retrait</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Actions immédiates pour un élève en retard, directement dans le fil de scan — le surveillant n'a
 * pas besoin de naviguer vers /attendance. « Notifier » relance l'envoi SMS/email (déjà tenté
 * automatiquement à l'instant du scan, utile si le premier essai a échoué) ; « Justifier »/« Non
 * justifié » enregistrent la décision du surveillant sur le retard. */
function LateActions({ attendanceId }: { attendanceId: number }) {
  const [notifying, setNotifying] = useState(false);
  const [notified, setNotified] = useState(false);
  const [justifying, setJustifying] = useState<"yes" | "no" | null>(null);
  const [justified, setJustified] = useState<boolean | null>(null);

  async function notify() {
    setNotifying(true);
    try {
      await notifyParentNow(attendanceId);
      setNotified(true);
      notifySuccess("Parent notifié.");
    } catch (err) {
      notifyError(err);
    } finally {
      setNotifying(false);
    }
  }

  async function justify(value: boolean) {
    setJustifying(value ? "yes" : "no");
    try {
      await justifyAttendance(attendanceId, { justified: value });
      setJustified(value);
      notifySuccess(value ? "Retard justifié." : "Retard marqué non justifié.");
    } catch (err) {
      notifyError(err);
    } finally {
      setJustifying(null);
    }
  }

  return (
    <span className="flex items-center gap-1.5">
      {notified ? (
        <span className="text-xs text-success-600">Parent notifié</span>
      ) : (
        <Button size="sm" variant="ghost" loading={notifying} onClick={notify}>Notifier parent</Button>
      )}
      {justified == null ? (
        <>
          <Button size="sm" variant="ghost" className="text-success-700" loading={justifying === "yes"} onClick={() => justify(true)}>
            Justifier
          </Button>
          <Button size="sm" variant="ghost" className="text-error-600" loading={justifying === "no"} onClick={() => justify(false)}>
            Non justifié
          </Button>
        </>
      ) : (
        <span className="text-xs text-gray-400">{justified ? "Justifié" : "Non justifié"}</span>
      )}
    </span>
  );
}

function FeedOutcome({ item }: { item: ScanFeedItem }) {
  if (!item.ok) {
    return <span className="text-xs text-gray-400">{item.at}</span>;
  }
  if (item.kind === "ABSENT") {
    return (
      <span className="flex items-center gap-2">
        <Badge tone="red">Absent</Badge>
        <span className="text-xs text-gray-400">{item.at}</span>
      </span>
    );
  }
  if (item.kind === "ENTRY") {
    const outcome = item.outcome ?? "PRESENT";
    return (
      <span className="flex flex-wrap items-center gap-2">
        <Badge tone={outcome === "LATE" ? "amber" : "green"}>
          {ATTENDANCE_OUTCOME_LABEL[outcome]}{outcome === "LATE" && item.lateMinutes ? ` (${formatMinutes(item.lateMinutes)})` : ""}
        </Badge>
        <span className="text-xs text-gray-400">{item.at}</span>
        {outcome === "LATE" && item.subjectType === "STUDENT" && item.studentAttendanceId != null && (
          <LateActions attendanceId={item.studentAttendanceId} />
        )}
      </span>
    );
  }
  // EXIT : heure de sortie réelle toujours affichée, avec un badge « À l'heure »/« Anticipé X min »
  // basé sur earlyMinutes (calculé et enregistré côté serveur) — pas une approximation recalculée ici
  // à partir de réalisé/prévu, qui ne montrait ni l'heure ni un libellé clair de départ anticipé.
  const early = item.earlyMinutes ?? 0;
  const tone = early > 0 ? "amber" : "green";
  const time = item.checkOutTime ? `Sortie ${formatTime(item.checkOutTime)}` : "Sortie enregistrée";
  return (
    <span className="flex items-center gap-2">
      <Badge tone={tone}>
        {time}{early > 0 ? ` — Anticipé ${formatMinutes(early)}` : ""}
      </Badge>
      <span className="text-xs text-gray-400">{item.at}</span>
    </span>
  );
}
