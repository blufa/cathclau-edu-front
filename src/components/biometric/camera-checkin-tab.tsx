"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, RefreshCw, SwitchCamera, Video, VideoOff } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { listDevices, listEnrollments, recordPunch } from "@/lib/api/biometric";
import type { PunchDirection } from "@/lib/types/biometric";
import { useDirectory } from "@/components/biometric/use-directory";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Field, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Pointage par caméra : ouvre la caméra de l'appareil (webcam de l'ordinateur ou caméra du téléphone)
 * via l'API navigateur getUserMedia, capture une photo de confirmation et enregistre le pointage —
 * qui se déverse automatiquement dans les présences. Aucun lecteur d'empreinte requis.
 */
export function CameraCheckinTab() {
  const devicesQuery = useQuery(listDevices, []);
  const enrollmentsQuery = useQuery(() => listEnrollments(), []);
  const { name } = useDirectory();

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");
  const [externalUserId, setExternalUserId] = useState("");
  const [direction, setDirection] = useState<PunchDirection>("IN");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  const startCamera = useCallback(async (mode: "user" | "environment") => {
    setError(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne permet pas l'accès à la caméra.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
    } catch {
      setError("Caméra inaccessible : autorisez l'accès à la caméra dans le navigateur.");
    }
  }, [stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  function capture() {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.7));
  }

  async function submit() {
    if (!deviceId) { notifyError("Choisissez un appareil de pointage."); return; }
    if (!externalUserId) { notifyError("Sélectionnez la personne à pointer."); return; }
    if (!snapshot) { notifyError("Capturez d'abord une photo de confirmation."); return; }
    setSubmitting(true);
    try {
      await recordPunch(Number(deviceId), {
        externalUserId, direction, punchTime: new Date().toISOString(),
        rawPayload: "camera-checkin; source=web-camera",
      });
      notifySuccess("Pointage enregistré");
      setSnapshot(null);
      setExternalUserId("");
    } catch (err) { notifyError(err); } finally { setSubmitting(false); }
  }

  const devices = useMemo(() => devicesQuery.data ?? [], [devicesQuery.data]);
  const enrollments = useMemo(() => enrollmentsQuery.data ?? [], [enrollmentsQuery.data]);
  const deviceOptions: SearchableOption[] = useMemo(
    () => devices.map((d) => ({ value: String(d.id), trigger: d.name, label: d.name, searchText: d.name })),
    [devices],
  );
  const personOptions: SearchableOption[] = useMemo(
    () => enrollments.map((e) => {
      const label = `${name.get(`${e.subjectType}-${e.subjectId}`) ?? e.externalUserId} (${e.externalUserId})`;
      return { value: e.externalUserId, trigger: label, label, searchText: label };
    }),
    [enrollments, name],
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-3">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-gray-900">
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
            {!streaming && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-gray-400">
                <VideoOff className="h-8 w-8" />
                <span className="text-sm">Caméra éteinte</span>
              </div>
            )}
          </div>
          {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
          <div className="flex flex-wrap gap-2">
            {!streaming ? (
              <Button size="sm" onClick={() => startCamera(facing)} leftSection={<Video className="h-4 w-4" />}>Démarrer la caméra</Button>
            ) : (
              <>
                <Button size="sm" onClick={capture} leftSection={<Camera className="h-4 w-4" />}>Capturer</Button>
                <Button size="sm" variant="secondary" leftSection={<SwitchCamera className="h-4 w-4" />}
                  onClick={() => { const next = facing === "user" ? "environment" : "user"; setFacing(next); startCamera(next); }}>
                  Avant / arrière
                </Button>
                <Button size="sm" variant="ghost" className="text-error-600" leftSection={<VideoOff className="h-4 w-4" />} onClick={stopCamera}>Éteindre</Button>
              </>
            )}
          </div>
          <p className="text-xs text-gray-400">
            La caméra utilisée est celle de l&apos;appareil ouvrant la page : webcam sur ordinateur, caméra avant/arrière sur téléphone.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700">Enregistrer le pointage</h3>
          {devicesQuery.loading || enrollmentsQuery.loading ? <div className="flex justify-center py-6"><Spinner /></div> : (
            <>
              {devices.length === 0 && (
                <p className="rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800">
                  Aucun appareil. Créez un appareil (onglet « Appareils », ex. « Caméra Web ») pour rattacher les pointages.
                </p>
              )}
              <Field>
                <Label>Appareil de pointage</Label>
                <SearchableSelect value={deviceId} options={deviceOptions} onChange={setDeviceId} triggerClassName="w-full justify-between px-3" />
              </Field>
              <Field>
                <Label>Personne (enrôlée)</Label>
                <SearchableSelect value={externalUserId} options={personOptions} onChange={setExternalUserId} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun enrôlement — enrôlez d'abord la personne" />
              </Field>
              <div>
                <p className="mb-1 text-sm font-medium text-gray-600">Sens</p>
                <div className="flex gap-2">
                  {(["IN", "OUT"] as PunchDirection[]).map((d) => (
                    <button key={d} type="button" onClick={() => setDirection(d)}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${direction === d ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                      {d === "IN" ? "Entrée" : "Sortie"}
                    </button>
                  ))}
                </div>
              </div>

              {snapshot ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={snapshot} alt="Capture" className="aspect-video w-full rounded-xl border border-gray-200 object-cover" />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
                  Aucune capture — cliquez sur « Capturer »
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={submit} loading={submitting} disabled={!snapshot}>Pointer</Button>
                {snapshot && <Button variant="ghost" leftSection={<RefreshCw className="h-4 w-4" />} onClick={() => setSnapshot(null)}>Reprendre</Button>}
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
