import { Suspense } from "react";
import ClassDetailPage from "@/features/classes/components/detail-page";

export default function Page() {
  return (
    <Suspense>
      <ClassDetailPage />
    </Suspense>
  );
}
