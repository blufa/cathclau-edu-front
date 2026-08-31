import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ConfirmDialogHost } from "@/lib/feedback";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // Chaque page publique compose déjà son propre titre complet (avec le nom du site) : pas de
  // gabarit ici, qui dupliquerait le nom (« Page | CathClau Edu | CathClau Edu »).
  title: `${SITE_NAME} — Gestion scolaire`,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  robots: { index: true, follow: true },
  // Pas d'icône explicite ici : src/app/icon.png (256x256) et favicon.ico sont déjà détectés
  // automatiquement par la convention de fichiers Next.js — les déclarer ici les remplacerait par
  // une seule icône moins nette.
  manifest: "/manifest.webmanifest",
  openGraph: {
    siteName: SITE_NAME,
    locale: "fr_GN",
    type: "website",
    url: SITE_URL,
    images: [{ url: "/images/logo.png", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: ["/images/logo.png"],
  },
  verification: {
    google: "googleb53507edf28cf3e0",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`h-full antialiased ${outfit.variable}`}>
      <body className="min-h-full font-outfit" suppressHydrationWarning>
        <Toaster position="top-right" richColors closeButton />
        <ConfirmDialogHost />
        <QueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
