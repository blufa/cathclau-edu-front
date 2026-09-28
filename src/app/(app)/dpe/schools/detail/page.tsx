import { Suspense } from "react";
import DpeSchoolDetailPage from "./dpe-school-detail-client";

export default function Page() {
  return (
    <Suspense>
      <DpeSchoolDetailPage />
    </Suspense>
  );
}
