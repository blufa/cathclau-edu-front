import type { ReactNode } from "react";
import { RouteTabs } from "@/components/layout/route-tabs";

export default function GradingLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <RouteTabs
        tabs={[
          { label: "Évaluations & notes", href: "/grading", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissions: ["note:read"], module: "GRADING" },
          { label: "Bulletins", href: "/grading/report-cards", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissions: ["bulletin:read"], module: "REPORT_CARD" },
          { label: "Conseil de classe", href: "/grading/validation", roles: ["SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE", "TEACHER"], permissions: ["bulletin:read"], module: "REPORT_CARD" },
          { label: "Paramètres", href: "/grading/settings", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["parametrage_notes:manage"], module: "GRADING" },
        ]}
      />
      {children}
    </div>
  );
}
