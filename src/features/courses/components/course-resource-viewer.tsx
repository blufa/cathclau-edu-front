"use client";

import { FileText, Lock, PlayCircle } from "lucide-react";
import type { CourseResource } from "@/lib/types/courses";

/**
 * Lecteur intégré pour une ressource de cours déjà déverrouillée (achat réglé). Protection
 * « lecteur web » choisie par l'établissement (pas de DRM) : clic droit et téléchargement direct
 * désactivés côté interface (barre d'outils PDF masquée, `controlsList=nodownload` sur la vidéo) —
 * dissuasif pour l'utilisateur courant, pas une protection cryptographique du fichier.
 */
export function CourseResourceViewer({ resource }: { resource: CourseResource }) {
  if (!resource.fileUrl) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 py-10 text-center text-sm text-gray-400">
        <Lock className="h-6 w-6" />
        Achetez le cours pour déverrouiller cette ressource.
      </div>
    );
  }

  if (resource.type === "VIDEO") {
    return (
      <video
        key={resource.id}
        controls
        controlsList="nodownload noremoteplayback"
        disablePictureInPicture
        onContextMenu={(e) => e.preventDefault()}
        className="aspect-video w-full rounded-xl bg-black"
        src={resource.fileUrl}
      >
        Votre navigateur ne prend pas en charge la lecture vidéo.
      </video>
    );
  }

  return (
    <div onContextMenu={(e) => e.preventDefault()} className="overflow-hidden rounded-xl border border-gray-200">
      <iframe
        key={resource.id}
        src={`${resource.fileUrl}#toolbar=0&navpanes=0`}
        title={resource.title ?? "Document"}
        className="h-[70vh] w-full"
      />
    </div>
  );
}

export function ResourceIcon({ type }: { type: CourseResource["type"] }) {
  return type === "VIDEO" ? <PlayCircle className="h-4 w-4" /> : <FileText className="h-4 w-4" />;
}
