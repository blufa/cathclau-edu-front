import { Suspense } from "react";
import { PaymentFlow } from "@/components/platform/payment-flow";
import { Spinner } from "@/components/ui/spinner";

export default function SubscriptionPaymentPage() {
  return (
    <div className="mx-auto max-w-xl space-y-5">
      <h1 className="text-2xl font-semibold text-gray-900">Paiement de l&apos;abonnement</h1>
      <Suspense fallback={<div className="flex justify-center py-16"><Spinner /></div>}>
        <PaymentFlow />
      </Suspense>
    </div>
  );
}
