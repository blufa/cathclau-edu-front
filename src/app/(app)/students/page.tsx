import { Suspense } from "react";
import StudentsPage from "@/features/students/components/list-page";

export default function Page() {
  return (
    <Suspense>
      <StudentsPage />
    </Suspense>
  );
}
