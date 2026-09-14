"use client";

import { useState } from "react";
import { CalendarClock, Megaphone, Phone } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { getMyChildren, getParentAnnouncements, getParentContacts, getParentDashboard } from "@/lib/api/portal";
import { listEvents } from "@/lib/api/calendar";
import { EVENT_TYPE_LABEL, EVENT_TYPE_TONE } from "@/lib/types/calendar";
import type { Student } from "@/lib/types/student";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Reveal } from "@/components/public/reveal";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StudentOverview } from "@/components/portal/student-overview";
import { formatDate, formatGNF, formatDateTime } from "@/lib/format";

export default function ChildrenPage() {
  const q = useQuery(() => getMyChildren(), []);
  const dashboardQuery = useQuery(() => getParentDashboard(), []);
  const announcementsQuery = useQuery(() => getParentAnnouncements(), []);
  const contactsQuery = useQuery(() => getParentContacts(), []);
  const eventsQuery = useQuery(() => listEvents(), []);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingEvents = (eventsQuery.data ?? [])
    .filter((e) => e.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 5);
  const [selected, setSelected] = useState<number | null>(null);

  const children = q.data ?? [];
  const current: Student | undefined = children.find((c) => c.id === selected) ?? children[0];
  const summary = dashboardQuery.data?.children.find((c) => c.studentId === current?.id);
  const announcements = announcementsQuery.data ?? [];
  const currentContacts = contactsQuery.data?.children.find((c) => c.studentId === current?.id);
  const leadership = contactsQuery.data?.leadership ?? [];

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

      {upcomingEvents.length > 0 && (
        <Card>
          <CardHeader><CardTitle><span className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-brand-600" /> Prochains événements</span></CardTitle></CardHeader>
          <CardBody>
            <ul className="divide-y divide-slate-100">
              {upcomingEvents.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-900">{e.title}</p>
                    <Badge tone={EVENT_TYPE_TONE[e.eventType]}>{EVENT_TYPE_LABEL[e.eventType]}</Badge>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatDate(e.startDate)}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
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
              <Card>
                <CardHeader><CardTitle>Contacts de l&apos;établissement</CardTitle></CardHeader>
                <CardBody className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Enseignants de {current.firstName}
                    </p>
                    {contactsQuery.loading ? (
                      <div className="flex justify-center py-4"><Spinner /></div>
                    ) : !currentContacts || currentContacts.teachers.length === 0 ? (
                      <p className="rounded-xl bg-slate-50 px-4 py-4 text-center text-sm text-slate-400">
                        Aucun enseignant assigné à la classe pour l&apos;instant.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                        {currentContacts.teachers.map((t) => (
                          <li key={t.teacherId} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <div>
                              <p className="font-medium text-slate-900">{t.fullName}</p>
                              <p className="text-xs text-slate-500">{t.subject}</p>
                            </div>
                            {t.phone ? (
                              <a href={`tel:${t.phone}`} className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                                <Phone className="h-3.5 w-3.5" /> {t.phone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Téléphone non renseigné</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {leadership.length > 0 && (
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Direction de l&apos;école</p>
                      <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                        {leadership.map((l, i) => (
                          <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                            <div>
                              <p className="font-medium text-slate-900">{l.fullName}</p>
                              <p className="text-xs text-slate-500">{l.role}</p>
                            </div>
                            {l.phone ? (
                              <a href={`tel:${l.phone}`} className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100">
                                <Phone className="h-3.5 w-3.5" /> {l.phone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400">Téléphone non renseigné</span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardBody>
              </Card>
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
