import { Loader } from "@mantine/core";

export function Spinner({ className }: { className?: string }) {
  return <Loader size="sm" color="indigo" className={className} />;
}

export function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader size="lg" color="indigo" />
    </div>
  );
}
