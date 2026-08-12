"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, RefreshCw, Video, VideoOff } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

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
  const [error, setError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreaming(false);
  }, []);

  async function startCamera(id: string) {
    setError(null);
    setSnapshot(null);
    stopCamera();
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Ce navigateur ne permet pas l'accès à la caméra.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: id ? { deviceId: { exact: id } } : true,
        audio: false,
      });
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

  function capture() {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setSnapshot(canvas.toDataURL("image/jpeg", 0.85));
  }

  function confirm() {
    if (!snapshot) return;
    const arr = snapshot.split(",");
    const mime = /:(.*?);/.exec(arr[0])?.[1] ?? "image/jpeg";
    const bin = atob(arr[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    onCapture(new File([bytes], `photo-${Date.now()}.jpg`, { type: mime }));
    stopCamera();
    onClose();
  }

  function close() {
    stopCamera();
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
          {!streaming && !snapshot && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
              <VideoOff className="h-8 w-8" />
              <span className="text-sm">Caméra éteinte</span>
            </div>
          )}
        </div>
        {error && <p className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-700">{error}</p>}
        <p className="text-xs text-slate-400">
          Fonctionne avec la webcam de l&apos;ordinateur, la caméra du téléphone, ou un appareil photo externe branché sur la machine.
        </p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={close}>Annuler</Button>
          {snapshot ? (
            <>
              <Button type="button" variant="secondary" leftSection={<RefreshCw className="h-4 w-4" />} onClick={() => setSnapshot(null)}>Reprendre</Button>
              <Button type="button" onClick={confirm}>Utiliser cette photo</Button>
            </>
          ) : streaming ? (
            <Button type="button" leftSection={<Camera className="h-4 w-4" />} onClick={capture}>Capturer</Button>
          ) : (
            <Button type="button" leftSection={<Video className="h-4 w-4" />} onClick={() => void startCamera(deviceId)}>Démarrer la caméra</Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
