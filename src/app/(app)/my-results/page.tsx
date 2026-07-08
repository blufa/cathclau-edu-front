"use client";

import { useQuery } from "@/hooks/use-query";
import { getMyStudent } from "@/lib/api/portal";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { StudentOverview } from "@/components/portal/student-overview";

export default function MyResultsPage() {
  const q = useQuery(() => getMyStudent(), []);
  const student = q.data;

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes résultats</h1>
        <p className="text-sm text-slate-500">Mon assiduité, mes bulletins et ma situation financière</p>
      </Reveal>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : !student ? (
        <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">Aucun dossier élève rattaché à votre compte.</p>
      ) : (
        <>
          <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 to-white p-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">{student.firstName[0]}{student.lastName[0]}</span>
            <div>
              <p className="text-lg font-bold text-slate-900">{student.firstName} {student.lastName}</p>
              <p className="font-mono text-sm text-slate-500">{student.studentNumber}</p>
            </div>
          </div>
          <StudentOverview student={student} />
        </>
      )}
    </div>
  );
}
