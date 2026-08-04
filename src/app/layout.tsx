import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { AuthProvider } from "@/providers/auth-provider";
import { ConfirmDialogHost } from "@/lib/feedback";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit-sans", display: "swap" });

export const metadata: Metadata = {
  title: "CathClau Edu — Gestion scolaire",
  description: "Plateforme de gestion d'établissements scolaires",
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
