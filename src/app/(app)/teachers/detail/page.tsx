import { Suspense } from "react";
import TeacherDetailPage from "./teacher-detail-client";

export default function Page() {
  return (
    <Suspense>
      <TeacherDetailPage />
    </Suspense>
  );
}
