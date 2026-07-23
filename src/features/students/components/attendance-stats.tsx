"use client";

import { useQuery } from "@/hooks/use-query";
import { getStudentAttendanceStats } from "@/lib/api/attendance";
import { Spinner } from "@/components/ui/spinner";

/** Compact attendance summary for a student (rate + counts). */
export function StudentAttendanceStats({ studentId }: { studentId: number }) {
  const { data, loading, error } = useQuery(() => getStudentAttendanceStats(studentId), [studentId]);

  if (loading) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (error || !data) return <p className="text-sm text-slate-400">Statistiques indisponibles.</p>;

  const rate = Math.round(Number(data.attendanceRate || 0));
  const tone = rate >= 90 ? "text-emerald-600" : rate >= 75 ? "text-amber-600" : "text-rose-600";

  const items = [
    { label: "Présences", value: data.presentDays, cls: "text-emerald-600" },
    { label: "Absences", value: data.absentDays, cls: "text-rose-600" },
    { label: "Retards", value: data.lateDays, cls: "text-amber-600" },
    { label: "Jours suivis", value: data.totalDays, cls: "text-slate-700" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline gap-2">
        <span className={`text-3xl font-bold ${tone}`}>{rate}%</span>
        <span className="text-sm text-slate-500">taux d&apos;assiduité</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((i) => (
          <div key={i.label} className="rounded-xl border border-slate-200 p-3 text-center">
            <div className={`text-lg font-bold ${i.cls}`}>{i.value}</div>
            <div className="text-xs text-slate-500">{i.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
