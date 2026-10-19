"use client";

import { useMemo } from "react";
import { useQuery } from "@/hooks/use-query";
import { searchStudents } from "@/lib/api/students";
import { listTeachers, listEmployees } from "@/lib/api/staff";

/** Charge enseignants + élèves + personnel et fournit une résolution de nom par clé `TYPE-id`. */
export function useDirectory() {
  const teachersQuery = useQuery(listTeachers, []);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }).then((p) => p.content), []);
  const employeesQuery = useQuery(() => listEmployees(), []);
  const name = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of teachersQuery.data ?? []) m.set(`TEACHER-${t.id}`, `${t.firstName} ${t.lastName}`);
    for (const s of studentsQuery.data ?? []) m.set(`STUDENT-${s.id}`, `${s.firstName} ${s.lastName}`);
    for (const e of employeesQuery.data ?? []) m.set(`EMPLOYEE-${e.id}`, `${e.firstName} ${e.lastName}`);
    return m;
  }, [teachersQuery.data, studentsQuery.data, employeesQuery.data]);
  return { teachers: teachersQuery.data ?? [], students: studentsQuery.data ?? [], employees: employeesQuery.data ?? [], name };
}
