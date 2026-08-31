"use client";

import { usePathname } from "next/navigation";
import { DM_Sans } from "next/font/google";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";

const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans-var", display: "swap" });

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
      {!isVankineNative && <PublicHeader />}
      <main className="flex-1">{children}</main>
      {!isVankineNative && <PublicFooter />}
    </div>
  );
}
