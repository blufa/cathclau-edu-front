"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, Rocket, X } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import {
  listAcademicYears,
  listClasses,
  listLevels,
  listPeriods,
  listRooms,
  listSubjects,
  searchSchedules,
} from "@/lib/api/academics";
import { listEmployees, listTeachers } from "@/lib/api/staff";
import { searchStudents } from "@/lib/api/students";
import { listParents } from "@/lib/api/parents";
import { listFeesByTenant } from "@/lib/api/billing";
import { getSchoolProfile } from "@/lib/api/platform";
import { listTemplates } from "@/lib/api/communication";

interface Step {
  title: string;
  help: string;
  href: string;
  done: boolean;
}
interface Group {
  title: string;
  steps: Step[];
}

/**
 * Guide « Premiers pas » complet pour une école : un point d'entrée unique qui liste, regroupées par
 * thème, toutes les configurations à faire — l'admin n'a pas à fouiller les menus. Chaque étape se
 * coche automatiquement d'après les données réelles. Masquable (mémorisé), et masqué une fois tout fait.
 */
export function GettingStarted() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const storageKey = tenantId ? `laca-onboarding-hidden-${tenantId}` : "";

  const [hidden, setHidden] = useState<boolean>(
    () => typeof window !== "undefined" && !!storageKey && window.localStorage.getItem(storageKey) === "1",
  );
  const off = hidden || !tenantId; // quand masqué / pas d'école → on ne va rien chercher

  // Requêtes conditionnelles : rien n'est chargé si le guide est masqué (économise le réseau).
  const yearsQ = useQuery(() => (off ? Promise.resolve([]) : listAcademicYears()), [off]);
  const currentYear = (yearsQ.data ?? []).find((y) => y.current) ?? (yearsQ.data ?? [])[0];
  const yearId = currentYear?.id ?? null;

  const periodsQ = useQuery(() => (off || !yearId ? Promise.resolve([]) : listPeriods(yearId)), [off, yearId]);
  const levelsQ = useQuery(() => (off ? Promise.resolve([]) : listLevels()), [off]);
  const roomsQ = useQuery(() => (off ? Promise.resolve([]) : listRooms()), [off]);
  const classesQ = useQuery(() => (off || !yearId ? Promise.resolve([]) : listClasses(yearId)), [off, yearId]);
  const subjectsQ = useQuery(() => (off ? Promise.resolve([]) : listSubjects()), [off]);
  const schedulesQ = useQuery(() => (off ? Promise.resolve([]) : searchSchedules({})), [off]);
  const teachersQ = useQuery(() => (off ? Promise.resolve([]) : listTeachers()), [off]);
  const employeesQ = useQuery(() => (off ? Promise.resolve([]) : listEmployees()), [off]);
  const studentsQ = useQuery(() => (off ? Promise.resolve(null) : searchStudents({ size: 1 })), [off]);
  const parentsQ = useQuery(() => (off ? Promise.resolve([]) : listParents(undefined, 1)), [off]);
  const feesQ = useQuery(() => (off || !tenantId ? Promise.resolve([]) : listFeesByTenant(tenantId)), [off, tenantId]);
  const profileQ = useQuery(() => (off ? Promise.resolve(null) : getSchoolProfile()), [off]);
  const templatesQ = useQuery(() => (off || !tenantId ? Promise.resolve([]) : listTemplates(tenantId)), [off, tenantId]);

  const loading =
    yearsQ.loading || periodsQ.loading || levelsQ.loading || roomsQ.loading || classesQ.loading ||
    subjectsQ.loading || schedulesQ.loading || teachersQ.loading || employeesQ.loading || studentsQ.loading ||
    parentsQ.loading || feesQ.loading || profileQ.loading || templatesQ.loading;

  if (off) return null;
  if (loading) return null;

  const has = (arr: unknown[] | null | undefined) => (arr?.length ?? 0) > 0;
  const profile = profileQ.data;

  const groups: Group[] = [
    {
      title: "1. Structure de l'établissement",
      steps: [
        { title: "Année scolaire & périodes", help: "Confirmez l'année en cours et créez vos trimestres/semestres.", href: "/classes", done: !!currentYear && has(periodsQ.data) },
        { title: "Niveaux (cycles)", help: "Définissez les niveaux (Primaire, Collège, Lycée…).", href: "/classes", done: has(levelsQ.data) },
        { title: "Salles", help: "Ajoutez les salles de classe de l'école.", href: "/classes", done: has(roomsQ.data) },
        { title: "Classes", help: "Créez les classes (ex. « 7ème A »).", href: "/classes", done: has(classesQ.data) },
        { title: "Matières", help: "Renseignez les matières enseignées.", href: "/classes", done: has(subjectsQ.data) },
        { title: "Emploi du temps", help: "Placez les cours dans la semaine.", href: "/timetable", done: has(schedulesQ.data) },
      ],
    },
    {
      title: "2. Personnel",
      steps: [
        { title: "Enseignants", help: "Créez les comptes des enseignants et leurs affectations.", href: "/teachers", done: has(teachersQ.data) },
        { title: "Personnel administratif", help: "Ajoutez le personnel non enseignant.", href: "/personnel", done: has(employeesQ.data) },
      ],
    },
    {
      title: "3. Élèves & familles",
      steps: [
        { title: "Élèves", help: "Inscrivez vos élèves et affectez-les à une classe.", href: "/students", done: (studentsQ.data?.totalElements ?? 0) > 0 },
        { title: "Parents / tuteurs", help: "Rattachez les parents pour les notifications.", href: "/students", done: has(parentsQ.data) },
      ],
    },
    {
      title: "4. Finances",
      steps: [
        { title: "Frais scolaires", help: "Configurez les frais (inscription, mensualités, transport…).", href: "/fees", done: has(feesQ.data) },
        { title: "Numéro marchand de reversement", help: "Le compte Mobile Money où recevoir vos encaissements.", href: "/settings", done: !!profile?.payoutMerchantNumber },
      ],
    },
    {
      title: "5. Personnalisation & communication",
      steps: [
        { title: "Logo & couleurs de l'école", help: "Personnalisez l'apparence (figure sur les documents).", href: "/settings", done: !!profile?.logo },
        { title: "Modèles de messages", help: "Standardisez vos SMS/emails automatiques.", href: "/templates", done: has(templatesQ.data) },
      ],
    },
  ];

  const allSteps = groups.flatMap((g) => g.steps);
  const doneCount = allSteps.filter((s) => s.done).length;
  const total = allSteps.length;
  const next = allSteps.find((s) => !s.done);

  function hide() {
    if (storageKey) window.localStorage.setItem(storageKey, "1");
    setHidden(true);
  }

  // Tout est configuré → on masque définitivement (et on mémorise).
  if (doneCount === total) {
    if (storageKey && typeof window !== "undefined") window.localStorage.setItem(storageKey, "1");
    return null;
  }

  return (
    <section className="rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-brand-500 text-white">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Bienvenue ! Configurons votre école</h2>
            <p className="text-sm text-slate-500">
              Tout se fait ici, étape par étape — {doneCount}/{total} terminées. Pas besoin de chercher dans les menus.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {next && (
            <Link
              href={next.href}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Continuer&nbsp;: {next.title} <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <button
            type="button"
            onClick={hide}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            title="Masquer le guide"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-brand-100">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
      </div>

      <div className="mt-4 space-y-4">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{g.title}</p>
            <ol className="grid gap-2 sm:grid-cols-2">
              {g.steps.map((s) => (
                <li key={s.title}>
                  <Link
                    href={s.href}
                    className={`flex items-start gap-3 rounded-xl border px-4 py-3 transition ${
                      s.done ? "border-slate-100 bg-white/60" : "border-slate-200 bg-white hover:border-brand-300 hover:shadow-sm"
                    }`}
                  >
                    {s.done ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-green-500" />
                    ) : (
                      <span className="mt-0.5 h-5 w-5 flex-none rounded-full border-2 border-brand-300" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm font-medium ${s.done ? "text-slate-400 line-through" : "text-slate-900"}`}>
                        {s.title}
                      </p>
                      {!s.done && <p className="text-xs text-slate-500">{s.help}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
