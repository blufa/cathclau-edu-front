import { Suspense } from "react";
import PrefectureDetailPage from "./prefecture-detail-client";

export default function Page() {
  return (
    <Suspense>
      <PrefectureDetailPage />
    </Suspense>
  );
}
