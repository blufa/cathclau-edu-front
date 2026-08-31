import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyEmailView } from "@/components/public/verify-email-view";
import { FullPageSpinner } from "@/components/ui/spinner";

/** Page transactionnelle (lien à usage unique reçu par e-mail) : aucune valeur de référencement,
 * jamais indexée. */
export const metadata: Metadata = {
  title: "Vérification d'e-mail — CathClau Edu",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <VerifyEmailView />
    </Suspense>
  );
}
