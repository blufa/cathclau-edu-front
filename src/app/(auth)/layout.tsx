"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { FullPageSpinner } from "@/components/ui/spinner";
import { getBranding } from "@/lib/branding";

/** Layout for unauthenticated pages: already-authenticated users are bounced to the dashboard. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const branding = getBranding();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  if (status === "loading" || status === "authenticated") return <FullPageSpinner />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
            {branding.logoLetter}
          </div>
          <h1 className="text-xl font-semibold text-gray-900">{branding.appName}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
