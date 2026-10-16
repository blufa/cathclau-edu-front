"use client";

import { usePathname } from "next/navigation";
import { DM_Sans } from "next/font/google";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { SITE_NAME, SITE_URL } from "@/lib/site";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans-var", display: "swap" });

/** Données réelles de l'établissement (mêmes coordonnées que la page /contact — jamais inventées). */
const ORGANIZATION_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  email: "contact@cathclau.edu",
  telephone: "+224614324299",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Conakry",
    addressCountry: "GN",
  },
};

/** Public marketing & onboarding shell (no authentication). Police DM Sans dédiée (identique au
 * template Vankine home-5 reproduit) — n'affecte jamais le shell applicatif authentifié (Outfit).
 * Les 6 pages reconstruites en Vankine natif (refont-front.md) fournissent chacune leur propre
 * Header5/Footer5 (mêmes classes CSS que le template, scopées sous .vankine-scope) : notre
 * header/footer Tailwind est donc masqué sur ces routes précises, pour éviter un header/footer en
 * double. Les autres pages publiques (contact, aide, mentions légales, inscription...) restent en
 * Tailwind avec PublicHeader/PublicFooter tant qu'elles ne sont pas converties. */
function isVankineNativeRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "/a-propos" || pathname === "/tarifs" || pathname === "/faqs" || pathname === "/aide" || pathname === "/contact" || pathname === "/signup") return true;
  if (pathname === "/blog" || pathname.startsWith("/blog/")) return true;
  if (pathname.startsWith("/fonctionnalites/")) return true;
  return false;
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isVankineNative = isVankineNativeRoute(pathname);
  return (
    <div className={`flex min-h-screen flex-col bg-white font-dm-sans ${dmSans.variable}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
      />
      {!isVankineNative && <PublicHeader />}
      <main className="flex-1">{children}</main>
      {!isVankineNative && <PublicFooter />}
    </div>
  );
}
