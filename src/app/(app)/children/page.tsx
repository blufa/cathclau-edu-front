"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getMyChildren, getParentAnnouncements, getParentDashboard } from "@/lib/api/portal";
import type { Student } from "@/lib/types/student";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { StudentOverview } from "@/components/portal/student-overview";
import { formatGNF, formatDateTime } from "@/lib/format";

export default function ChildrenPage() {
  const q = useQuery(() => getMyChildren(), []);
  const dashboardQuery = useQuery(() => getParentDashboard(), []);
  const announcementsQuery = useQuery(() => getParentAnnouncements(), []);
  const [selected, setSelected] = useState<number | null>(null);

  const children = q.data ?? [];
  const current: Student | undefined = children.find((c) => c.id === selected) ?? children[0];
  const summary = dashboardQuery.data?.children.find((c) => c.studentId === current?.id);
  const announcements = announcementsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Mes enfants</h1>
        <p className="text-sm text-slate-500">Suivi scolaire : assiduité, bulletins, documents et factures</p>
      </Reveal>

      {announcements.length > 0 && (
        <section className="rounded-2xl border border-brand-100 bg-brand-50/50 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-800">
            <Megaphone className="h-4 w-4" /> Annonces de l&apos;école
          </h2>
          <ul className="space-y-2">
            {announcements.slice(0, 4).map((a) => (
              <li key={a.id} className="rounded-xl bg-white/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-900">{a.title}</p>
                  <span className="shrink-0 text-[11px] text-slate-400">{formatDateTime(a.publishedAt)}</span>
                </div>
                <p className="text-xs text-slate-600">{a.content}</p>
                {a.authorName && <p className="mt-0.5 text-[11px] text-slate-400">— {a.authorName}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : children.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">Aucun enfant rattaché à votre compte.</p>
      ) : (
        <>
          {children.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {children.map((c) => {
                const active = (current?.id ?? -1) === c.id;
                return (
                  <button key={c.id} onClick={() => setSelected(c.id)}
                    className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm transition ${active ? "border-brand-400 bg-brand-50 text-brand-700" : "border-slate-200 bg-white hover:border-brand-300"}`}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 text-xs font-bold text-white">{c.firstName[0]}{c.lastName[0]}</span>
                    {c.firstName} {c.lastName}
                  </button>
                );
              })}
            </div>
          )}
          {current && (
            <>
              <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-slate-200 bg-gradient-to-r from-brand-50 to-white p-5">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">{current.firstName[0]}{current.lastName[0]}</span>
                <div className="mr-auto">
                  <p className="text-lg font-bold text-slate-900">{current.firstName} {current.lastName}</p>
                  <p className="font-mono text-sm text-slate-500">{current.studentNumber}{summary?.className ? ` — ${summary.className}` : ""}</p>
                </div>
                {summary && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <SummaryStat label="Moyenne" value={summary.overallAverage != null ? `${summary.overallAverage}/20` : "—"} />
                    <SummaryStat label="Rang" value={summary.rank != null ? `${summary.rank}` : "—"} />
                    <SummaryStat label="Mention" value={summary.mention ?? "—"} />
                    <SummaryStat label="Reste à payer" value={summary.feesRemaining != null ? formatGNF(summary.feesRemaining) : "—"} />
                  </div>
                )}
              </div>
              <StudentOverview student={current} />
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold text-slate-900">{value}</p>
    </div>
  );
}
