/**
 * Images du site public — centralisées ici pour pouvoir remplacer les visuels Unsplash
 * par TES images locales sans toucher aux pages.
 *
 * → Pour utiliser des images locales : dépose tes fichiers dans `public/images/`
 *   (ex. public/images/hero-1.jpg) puis remplace l'URL par le chemin "/images/hero-1.jpg".
 *   `next/image` accepte indifféremment une URL distante (configurée dans next.config.ts)
 *   ou un chemin local commençant par "/".
 */

/** Diaporama du héros (page d'accueil) — photos locales de l'établissement. */
export const HERO_SLIDES: { src: string; alt: string }[] = [
  { src: "/images/school-1.jpg", alt: "Vie scolaire à l'établissement" },
  { src: "/images/school-3.jpg", alt: "Élèves de l'établissement" },
  { src: "/images/school-5.jpg", alt: "Activités à l'école" },
  { src: "/images/school-6.jpg", alt: "Communauté de l'école" },
];

export const IMAGES = {
  support: "/images/school-2.jpg",
  features: "/images/school-4.jpg",
  pricing: "/images/school-6.jpg",
  classroom: "/images/school-1.jpg",
};
