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
  // Fichier final (déjà cadré/redimensionné au format badge) — c'est lui qu'on remonte au parent via
  // onCapture, jamais un nouvel aller-retour base64.
  const [resultFile, setResultFile] = useState<File | null>(null);
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
  }

  // Cadre portrait de la photo du badge (voir IdBadgePortrait, print:h-[22mm] print:w-[17.5mm]) —
  // recadrer ET redimensionner DÈS la capture (pas après coup) sert deux objectifs à la fois : la
  // photo est déjà cadrée comme une photo de carte d'identité, ET surtout sa taille — quelques
  // centaines de milliers de pixels au lieu des 12+ mégapixels natifs d'une caméra de téléphone — est
  // ce qui rend le détourage fond blanc rapide (le temps de traitement dépend directement du nombre
  // de pixels à analyser) ; capturer à pleine résolution puis réduire après le détourage aurait laissé
  // le modèle tourner inutilement longtemps sur une image bien plus grande que nécessaire.
  const BADGE_PHOTO_WIDTH = 480;
  const BADGE_PHOTO_HEIGHT = 600;

  async function capture() {
    const video = videoRef.current;
    if (!video || !streaming) return;
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const targetRatio = BADGE_PHOTO_WIDTH / BADGE_PHOTO_HEIGHT;
    const sourceRatio = vw / vh;
    // Recadrage centré à la bonne proportion (portrait), avant réduction — même logique que
    // `object-cover` déjà utilisé pour l'aperçu vidéo ci-dessous : ce que l'utilisateur voit cadré à
    // l'écran est ce qui est effectivement capturé.
    let sx = 0, sy = 0, sw = vw, sh = vh;
    if (sourceRatio > targetRatio) {
      sw = vh * targetRatio;
      sx = (vw - sw) / 2;
    } else {
      sh = vw / targetRatio;
      sy = (vh - sh) / 2;
    }
    const canvas = document.createElement("canvas");
    canvas.width = BADGE_PHOTO_WIDTH;
    canvas.height = BADGE_PHOTO_HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, BADGE_PHOTO_WIDTH, BADGE_PHOTO_HEIGHT);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    // Plus de détourage/fond blanc automatique par IA ici (retiré : trop lent sur mobile) — l'école
    // positionne désormais elle-même l'élève devant un fond blanc physique avant la prise de vue, le
    // cadrage au format badge (ci-dessus) suffit.
    const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
    setResultFile(file);
    setSnapshot(URL.createObjectURL(file));
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
        {/* Même proportion portrait (4:5) que le cadrage réellement capturé ci-dessous
            (BADGE_PHOTO_WIDTH/HEIGHT) — ce que l'utilisateur voit cadré ici doit être exactement ce
            qui est capturé, pas un format d'aperçu différent du résultat final. */}
        <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-slate-900">
          {snapshot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={snapshot} alt="Capture" className="h-full w-full object-cover" />
          ) : (
            <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          )}
          {streaming && !snapshot && (
            // Guide de cadrage visuel (carré, pas un ovale) — demande explicite : même une personne
            // qui ne sait pas prendre de photo doit pouvoir respecter les dimensions juste en
            // centrant le sujet dans ce repère, sans réflexion. Le cadre vidéo lui-même est DÉJÀ
            // exactement la zone capturée (aspect-[4/5] ci-dessus) ; ce carré aide seulement à centrer
            // le sujet à l'intérieur, comme un viseur d'appareil photo d'identité classique.
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-square h-[62%] rounded-md shadow-[0_0_0_9999px_rgba(15,23,42,0.45)]" />
              <span className="absolute left-3 top-3 h-6 w-6 rounded-tl-md border-l-2 border-t-2 border-white/80" />
              <span className="absolute right-3 top-3 h-6 w-6 rounded-tr-md border-r-2 border-t-2 border-white/80" />
              <span className="absolute bottom-3 left-3 h-6 w-6 rounded-bl-md border-b-2 border-l-2 border-white/80" />
              <span className="absolute bottom-3 right-3 h-6 w-6 rounded-br-md border-b-2 border-r-2 border-white/80" />
              <p className="absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-slate-900/70 px-3 py-1 text-xs font-medium text-white">
                Centrez le sujet dans le cadre
              </p>
            </div>
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
              <Button type="button" variant="secondary" leftSection={<RefreshCw className="h-4 w-4" />} onClick={retake}>Reprendre</Button>
              <Button type="button" onClick={confirm} disabled={!resultFile}>Utiliser cette photo</Button>
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
