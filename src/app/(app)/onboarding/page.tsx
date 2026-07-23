import { GettingStarted } from "@/features/dashboard/components/getting-started";

export default function OnboardingPage() {
  return (
    <div className="space-y-6">
      <GettingStarted forceShow />
    </div>
  );
}
