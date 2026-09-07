import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";

/**
 * Enveloppe partagée par les pages publiques secondaires : charge encore les feuilles de style du
 * template (les sections de contenu de ces pages restent en classes Bootstrap pour l'instant), mais
 * utilise désormais l'en-tête/pied de page Tailwind (PublicHeader/PublicFooter) — navbar et footer
 * simples, cohérents avec le reste de l'app, sans le bandeau/menu Bootstrap plus lourd et sujet à
 * des sauts de mise en page sur mobile (classes Bootstrap "vankine-scope" qui pouvaient déborder
 * sur des éléments Tailwind). Voir src/app/(public)/page.tsx pour le détail de pourquoi des balises
 * <link> manuelles plutôt qu'un import global — même raisonnement ici, à l'identique sur chaque page.
 */
export function VankinePage({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* eslint-disable @next/next/no-css-tags */}
      <link rel="stylesheet" href="/vankine/css/bootstrap.min.css" />
      <link rel="stylesheet" href="/vankine/css/global-settings.css" />
      <link rel="stylesheet" href="/vankine/css/theme.css" />
      <link rel="stylesheet" href="/vankine/css/animate.min.css" />
      <link rel="stylesheet" href="/vankine/css/flaticon_vankine.css" />
      <link rel="stylesheet" href="/vankine/css/font-awesome.min.css" />
      <link rel="stylesheet" href="/vankine/css/uicons-regular-rounded.css" />
      <link rel="stylesheet" href="/vankine/css/uicons-regular-straight.css" />
      {/* eslint-enable @next/next/no-css-tags */}
      <PublicHeader />
      <div className="vankine-scope theme-vankine">{children}</div>
      <PublicFooter />
    </>
  );
}
