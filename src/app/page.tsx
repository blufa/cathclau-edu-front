"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { FullPageSpinner } from "@/components/ui/spinner";

/** Entry point: route to the dashboard when authenticated, otherwise to the login page. */
export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
    else if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  return <FullPageSpinner />;
}
