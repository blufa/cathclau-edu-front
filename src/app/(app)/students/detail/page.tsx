import { Suspense } from "react";
import StudentDetailPage from "@/features/students/components/detail-page";

export default function Page() {
  return (
    <Suspense>
      <StudentDetailPage />
    </Suspense>
  );
}
