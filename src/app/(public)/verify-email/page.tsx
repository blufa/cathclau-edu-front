import { Suspense } from "react";
import { VerifyEmailView } from "@/components/public/verify-email-view";
import { FullPageSpinner } from "@/components/ui/spinner";

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <VerifyEmailView />
    </Suspense>
  );
}
