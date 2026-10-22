"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, Video, VideoOff } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { whitenPhotoBackground } from "@/lib/background-removal";

interface PhotoCaptureModalProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

/**
 * Capture photo via la caméra du navigateur (getUserMedia). La liste des appareils vidéo inclut
 * aussi bien la webcam intégrée / caméra du téléphone qu'un appareil externe branché sur la
 * machine (webcam USB, caméra de documents…) — le navigateur les expose tous de la même façon,
 * il suffit de laisser l'utilisateur choisir dans la liste. Le parent ne doit monter ce composant
 * que pendant la capture (voir FileUpload) afin que la caméra soit bien coupée à la fermeture.
 */
export function PhotoCaptureModal({ open, onClose, onCapture }: PhotoCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [snapshot, setSnapshot] = useState<string | null>(null);
  // Fichier final (déjà traité fond blanc si le traitement a réussi) — c'est lui qu'on remonte au
  // parent via onCapture, jamais un nouvel aller-retour base64 (voir §11.2 cahier des charges).
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  async function startCamera(id: string) {
    setError(null);
    retake();
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne permet pas l'accès à la caméra.");
      return;
    }
    try {
      // §11.1 cahier des charges : caméra ARRIÈRE par défaut sur mobile (photo d'identité prise par
      // quelqu'un d'autre, pas un selfie) — "environment" n'est qu'une préférence pour le navigateur,
      // jamais une garantie sur tous les appareils (voir fallback ci-dessous). Un appareil choisi
      // explicitement dans la liste (id fourni) prime toujours sur cette préférence.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: id ? { deviceId: { exact: id } } : { facingMode: { ideal: "environment" } },
          audio: false,
        });
      } catch {
        // Certains navigateurs/appareils (webcam d'ordinateur sans "environment", contrainte refusée)
        // échouent sur facingMode — on retente sans contrainte plutôt que de bloquer la capture.
        if (id) throw new Error("device-failed");
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStreaming(true);
      // Certains navigateurs ne révèlent les labels des appareils qu'après autorisation.
      const list = await navigator.mediaDevices.enumerateDevices();
      const cams = list.filter((d) => d.kind === "videoinput");
      setDevices(cams);
      if (!id && cams[0]) setDeviceId(cams[0].deviceId);
    } catch {
      setError("Caméra inaccessible : autorisez l'accès à la caméra dans le navigateur.");
    }
  }

  // Coupe la caméra quand la modale se ferme ou se démonte (jamais de flux actif en arrière-plan).
  useEffect(() => () => stopCamera(), [stopCamera]);

  function switchDevice(id: string) {
    setDeviceId(id);
    void startCamera(id);
  }

  function retake() {
    if (snapshot) URL.revokeObjectURL(snapshot);
    setSnapshot(null);
    setResultFile(null);
    setBackgroundRemoved(false);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const rawBlob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!rawBlob) return;
    const rawFile = new File([rawBlob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    // §11.2 cahier des charges : traitement fond blanc automatique après la prise de vue, AVANT de
    // montrer l'aperçu que l'utilisateur confirme/reprend — jamais après coup sur une photo déjà validée.
    setProcessing(true);
    try {
      const { file, backgroundRemoved: removed } = await whitenPhotoBackground(rawFile);
      setResultFile(file);
      setBackgroundRemoved(removed);
      setSnapshot(URL.createObjectURL(file));
    } finally {
      setProcessing(false);
    }
  }

  function confirm() {
    if (!resultFile) return;
    onCapture(resultFile);
    stopCamera();
    onClose();
  }

  function close() {
    stopCamera();
    if (snapshot) URL.revokeObjectURL(snapshot);
    onClose();
  }

  const deviceOptions = useMemo(
    () => devices.map((d, i) => ({ value: d.deviceId, label: d.label || `Caméra ${i + 1}` })),
    [devices],
  );

  return (
    <Modal open={open} onClose={close} title="Prendre une photo">
      <div className="space-y-3">
        {deviceOptions.length > 1 && (
          <Select value={deviceId} onChange={(e) => switchDevice(e.target.value)}>
            {deviceOptions.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </Select>
        )}
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
          {snapshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={snapshot} alt="Capture" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          )}
          {!streaming && !snapshot && !processing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
              <VideoOff className="h-8 w-8" />
              <span className="text-sm">Caméra éteinte</span>
            </div>
          )}
          {processing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/70 text-white">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Traitement du fond en cours…</span>
            </div>
          )}
        </div>
        {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
        {snapshot && !backgroundRemoved && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
            Le fond blanc automatique n&apos;a pas pu être appliqué — photo originale conservée. Vous
            pouvez reprendre la photo ou la valider telle quelle.
          </p>
        )}
        <p className="text-xs text-slate-400">
          Fonctionne avec la webcam de l&apos;ordinateur, la caméra du téléphone, ou un appareil photo externe branché sur la machine.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>Annuler</Button>
          {snapshot ? (
            <>
              <Button type="button" variant="secondary" leftSection={<RefreshCw className="h-4 w-4" />} onClick={retake} disabled={processing}>Reprendre</Button>
              <Button type="button" onClick={confirm} disabled={processing || !resultFile}>Utiliser cette photo</Button>
            </>
          ) : streaming ? (
            <Button type="button" leftSection={<Camera className="h-4 w-4" />} onClick={capture} loading={processing}>Capturer</Button>
          ) : (
            <Button type="button" leftSection={<Video className="h-4 w-4" />} onClick={() => void startCamera(deviceId)}>Démarrer la caméra</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
