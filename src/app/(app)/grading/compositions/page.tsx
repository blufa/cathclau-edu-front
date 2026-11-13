"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { CompositionsTab } from "@/components/grading/compositions-tab";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Label } from "@/components/ui/input";
import { Reveal } from "@/components/public/reveal";

export default function CompositionsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER") || hasAnyPermission(user, ["evaluation:create"]);
  const canManage = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY") || hasAnyPermission(user, ["examen:manage"]);
  // Only admins/directors may modify an already-entered grade; teachers can only enter new ones.
  const canEditExisting = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["note:unlock"]);

  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useCachedQuery(
    effectiveYearId ? `classes:${effectiveYearId}` : null,
    () => listClasses(effectiveYearId as number),
    [effectiveYearId],
  );
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );
  // Deep-link from the teacher space: /grading/compositions?class=ID preselects the class.
  const searchParams = useSearchParams();
  const [classId, setClassId] = useState<number | null>(() => {
    const c = searchParams.get("class");
    return c ? Number(c) : null;
  });

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Compositions</h1>
        <p className="text-sm text-gray-500">Planification, surveillance et notes des compositions par classe</p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label>Année</Label>
          <Select value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
          </Select>
        </div>
        <div className="w-56">
          <Label>Classe</Label>
          <SearchableSelect
            value={classId != null ? String(classId) : ""}
            options={classOptions}
            onChange={(v) => setClassId(v ? Number(v) : null)}
            triggerClassName="w-full justify-between px-3"
          />
        </div>
      </div>

      {!classId ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Sélectionnez une classe.
        </p>
      ) : (
        <CompositionsTab classId={classId} yearId={effectiveYearId} canManage={canManage} canWrite={canWrite} canEditExisting={canEditExisting} />
      )}
    </div>
  );
}
