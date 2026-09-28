import { Suspense } from "react";
import TenantDetailPage from "./tenant-detail-client";

export default function Page() {
  return (
    <Suspense>
      <TenantDetailPage />
    </Suspense>
  );
}
