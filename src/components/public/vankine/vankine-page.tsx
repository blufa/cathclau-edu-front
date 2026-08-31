import { Header5 } from "@/components/public/vankine/header5";
import { Footer5 } from "@/components/public/vankine/footer5";

/**
 * Enveloppe partagée par toutes les pages publiques reconstruites en Vankine natif : charge les
 * mêmes fichiers CSS que le template (scopés sous .vankine-scope), et fournit Header5/Footer5.
 * Voir src/app/(public)/page.tsx pour le détail de pourquoi des balises <link> manuelles plutôt
 * qu'un import global — même raisonnement ici, à l'identique sur chaque page.
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
      <div className="vankine-scope theme-vankine">
        <Header5 />
        {children}
        <Footer5 />
      </div>
    </>
  );
}
