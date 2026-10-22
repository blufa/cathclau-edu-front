import { removeBackground } from "@imgly/background-removal";

/**
 * Fond blanc automatique pour une photo d'identité (§11.2 cahier des charges) — entièrement LOCAL
 * dans le navigateur (WASM/ONNX via `@imgly/background-removal`, gratuit, open-source) : seul le
 * modèle générique (fichier de poids réseau de neurones, jamais la photo) est téléchargé une fois
 * depuis son CDN et mis en cache par le navigateur — la photo elle-même n'est JAMAIS envoyée à un
 * service externe, le détourage + calcul tournent exclusivement sur l'appareil de l'utilisateur.
 *
 * `removeBackground` renvoie un PNG à fond TRANSPARENT ; on l'aplatit nous-mêmes sur un fond blanc
 * uni (exigence littérale du cahier des charges) puis on reconvertit en JPEG (plus léger, pas besoin
 * de transparence pour une photo d'identité — "optimiser taille et qualité du fichier").
 *
 * Ne lève jamais : si le traitement échoue (WASM indisponible, mémoire insuffisante...), renvoie le
 * fichier ORIGINAL inchangé — jamais de photo dégradée/corrompue silencieusement, et l'appelant
 * reste libre de proposer quand même l'aperçu pour validation/reprise (§11.2).
 */
export async function whitenPhotoBackground(file: File): Promise<{ file: File; backgroundRemoved: boolean }> {
  try {
    const transparentBlob = await removeBackground(file);
    const image = await blobToImage(transparentBlob);
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return { file, backgroundRemoved: false };
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    URL.revokeObjectURL(image.src);
    const jpegBlob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob a échoué"))), "image/jpeg", 0.92));
    const name = file.name.replace(/\.\w+$/, "") + "-fond-blanc.jpg";
    return { file: new File([jpegBlob], name, { type: "image/jpeg" }), backgroundRemoved: true };
  } catch (err) {
    console.warn("Fond blanc automatique indisponible, photo originale conservée :", err);
    return { file, backgroundRemoved: false };
  }
}

function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image invalide"));
    img.src = URL.createObjectURL(blob);
  });
}
