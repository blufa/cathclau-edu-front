import type { Metadata } from "next";
import { ProtectedShell } from "./protected-shell";

/**
 * Espace applicatif authentifié : jamais indexable (contenu privé par établissement, accessible
 * uniquement après connexion). Un layout serveur dédié est nécessaire pour exporter cette métadonnée
 * — ProtectedShell reste "use client" (garde d'authentification), ce qui empêche d'y déclarer
 * `metadata` directement.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <ProtectedShell>{children}</ProtectedShell>;
}
