"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Bus,
  Calculator,
  CheckCircle2,
  ClipboardList,
  FileText,
  Fingerprint,
  HeartPulse,
  IdCard,
  Megaphone,
  MessagesSquare,
  NotebookPen,
  PiggyBank,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  UserSearch,
  Users,
  Webhook,
  X,
} from "lucide-react";
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

/** Fonctionnalité complémentaire (non indispensable au démarrage) listée pour mémoire, avec le
 * bouton exact à utiliser — pour qu'aucune fonctionnalité ne reste cachée dans les menus. */
interface ExtraItem {
  title: string;
  help: string;
  href: string;
  icon: typeof Bus;
}
interface ExtraGroup {
  title: string;
  theme: keyof typeof THEME;
  items: ExtraItem[];
}

/** Classes Tailwind statiques par thème de couleur (une couleur par grand domaine, pour repérer
 * les familles de fonctionnalités d'un coup d'œil — les classes doivent rester écrites en toutes
 * lettres pour que Tailwind les détecte). */
const THEME = {
  sky: { title: "text-sky-700", card: "border-sky-100 bg-sky-50/60 hover:border-sky-300", icon: "bg-sky-100 text-sky-700" },
  emerald: { title: "text-emerald-700", card: "border-emerald-100 bg-emerald-50/60 hover:border-emerald-300", icon: "bg-emerald-100 text-emerald-700" },
  amber: { title: "text-amber-700", card: "border-amber-100 bg-amber-50/60 hover:border-amber-300", icon: "bg-amber-100 text-amber-700" },
  violet: { title: "text-violet-700", card: "border-violet-100 bg-violet-50/60 hover:border-violet-300", icon: "bg-violet-100 text-violet-700" },
} as const;

const EXTRA_GROUPS: ExtraGroup[] = [
  {
    title: "Vie scolaire au quotidien",
    theme: "sky",
    items: [
      { title: "Devoirs", help: "Bouton « Nouveau devoir » pour donner un travail à une classe.", href: "/assignments", icon: ClipboardList },
      { title: "Cahier de textes", help: "Bouton « Nouvelle séance » pour noter ce qui a été fait en cours.", href: "/lessons", icon: NotebookPen },
      { title: "Discipline", help: "Bouton « Signaler un incident » pour consigner un fait disciplinaire.", href: "/student-life/discipline", icon: ShieldAlert },
      { title: "Santé / infirmerie", help: "Bouton « Enregistrer un passage » pour un élève reçu à l'infirmerie.", href: "/student-life/health", icon: HeartPulse },
      { title: "Transport scolaire", help: "Onglet « Lignes » → « Nouvelle ligne » ; onglet « Abonnements » → « Abonner un élève ».", href: "/transport", icon: Bus },
      { title: "Cartes scolaires (badges)", help: "Onglet « Cartes » → bouton « Émettre une carte ».", href: "/student-cards", icon: IdCard },
      { title: "Réinscription & mouvements", help: "Cochez des élèves puis « Réinscrire la sélection » ; onglets Liste d'attente / Arrivées / Départs pour le suivi.", href: "/enrollments/re-enrollment", icon: ClipboardList },
      { title: "Annuaire inter-écoles", help: "Recherchez un élève déjà scolarisé dans une autre école du réseau.", href: "/directory", icon: UserSearch },
    ],
  },
  {
    title: "Finances avancées",
    theme: "emerald",
    items: [
      { title: "Factures élèves", help: "Bouton « Nouvelle facture », ou « Générer en masse » pour toute une classe.", href: "/invoices", icon: FileText },
      { title: "Règles de facturation", help: "Onglets Exonérations, Remises fratrie, Enfants du personnel pour les cas particuliers.", href: "/invoices/rules", icon: FileText },
      { title: "Comptabilité générale", help: "Onglets Plan comptable, Journaux, Écritures ; boutons « Nouveau compte », « Nouvelle écriture »…", href: "/accounting", icon: Calculator },
      { title: "Rapprochement bancaire", help: "Bouton « Nouveau rapprochement » pour pointer un relevé de banque.", href: "/accounting/reconciliation", icon: Calculator },
      { title: "Petite caisse", help: "Bouton « Nouvelle caisse », puis « Bon de sortie » et « Réapprovisionner ».", href: "/accounting/petty-cash", icon: PiggyBank },
      { title: "Budget annuel", help: "Bouton « Nouveau budget » pour planifier vos dépenses de l'année.", href: "/budget", icon: PiggyBank },
      { title: "Subventions", help: "Bouton « Nouvelle subvention » pour suivre un financement externe.", href: "/budget/grants", icon: Banknote },
      { title: "Paie du personnel", help: "Bouton « Générer une fiche » (ou « Générer en lot ») pour les salaires.", href: "/payroll", icon: Banknote },
    ],
  },
  {
    title: "Communication",
    theme: "amber",
    items: [
      { title: "Messages", help: "Bouton « Nouveau message » pour un SMS, un email ou un WhatsApp ciblé.", href: "/communications", icon: MessagesSquare },
      { title: "Annonces", help: "Bouton « Nouvelle annonce » pour informer toute l'école, une classe ou un élève.", href: "/communications/announcements", icon: Megaphone },
      { title: "Documents & modèles", help: "Bouton « Nouveau modèle » (ou « Modèles par défaut ») pour vos certificats, reçus, attestations.", href: "/documents", icon: FileText },
    ],
  },
  {
    title: "Sécurité & intégrations",
    theme: "violet",
    items: [
      { title: "Utilisateurs", help: "Bouton « Nouvel utilisateur » pour créer un accès (secrétaire, comptable…).", href: "/users", icon: Users },
      { title: "Rôles & permissions", help: "Bouton « Nouveau rôle » pour créer un profil d'accès sur mesure.", href: "/users/roles", icon: ShieldCheck },
      { title: "Biométrie", help: "Onglets Pointage caméra, Badges, Appareils, Enrôlements pour la reconnaissance des présences.", href: "/biometric", icon: Fingerprint },
      { title: "Webhooks", help: "Bouton « Nouvel endpoint » pour connecter un système externe à vos événements.", href: "/biometric/webhooks", icon: Webhook },
    ],
  },
];

/**
 * Guide « Premiers pas » complet pour une école : un point d'entrée unique qui liste, regroupées par
 * thème, toutes les configurations à faire — l'admin n'a pas à fouiller les menus. Chaque étape se
 * coche automatiquement d'après les données réelles. En dessous, une liste de référence indique,
 * bouton par bouton, où trouver chaque fonctionnalité complémentaire. Masquable (mémorisé), et
 * masqué une fois l'essentiel terminé.
 *
 * `compact` : bannière cliquable (utilisée sur le tableau de bord) qui renvoie vers la page dédiée
 * `/onboarding`, plutôt que d'afficher la liste complète directement sur le dashboard.
 * `forceShow` : ignore le masquage/l'auto-masquage (utilisé sur la page dédiée, ouverte volontairement).
 */
export function GettingStarted({ compact = false, forceShow = false }: { compact?: boolean; forceShow?: boolean } = {}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const storageKey = tenantId ? `laca-onboarding-hidden-${tenantId}` : "";

  const [hidden, setHidden] = useState<boolean>(
    () => typeof window !== "undefined" && !!storageKey && window.localStorage.getItem(storageKey) === "1",
  );
  const off = (hidden && !forceShow) || !tenantId; // quand masqué / pas d'école → on ne va rien chercher

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
        { title: "Année scolaire & périodes", help: "Bouton « Nouvelle année », puis « Nouvelle période » pour vos trimestres/semestres.", href: "/academic-years", done: !!currentYear && has(periodsQ.data) },
        { title: "Niveaux (cycles)", help: "Onglet « Niveaux » → bouton « Nouveau niveau » (ou un modèle prêt à l'emploi).", href: "/referentials", done: has(levelsQ.data) },
        { title: "Salles", help: "Onglet « Salles » → bouton « Nouvelle salle ».", href: "/referentials", done: has(roomsQ.data) },
        { title: "Classes", help: "Bouton « Nouvelle classe » en haut à droite de la page.", href: "/classes", done: has(classesQ.data) },
        { title: "Matières", help: "Onglet « Matières » → bouton « Nouvelle matière ».", href: "/referentials", done: has(subjectsQ.data) },
        { title: "Emploi du temps", help: "Bouton « Ajouter un créneau » pour placer un cours dans la semaine.", href: "/timetable", done: has(schedulesQ.data) },
      ],
    },
    {
      title: "2. Personnel",
      steps: [
        { title: "Enseignants", help: "Bouton « Nouvel enseignant » et ses affectations classe/matière.", href: "/teachers", done: has(teachersQ.data) },
        { title: "Personnel administratif", help: "Bouton « Nouveau membre » (secrétaire, comptable…).", href: "/teachers/staff", done: has(employeesQ.data) },
      ],
    },
    {
      title: "3. Élèves & familles",
      steps: [
        { title: "Élèves", help: "Bouton « Nouvel élève » en haut à droite, puis choisissez sa classe.", href: "/students", done: (studentsQ.data?.totalElements ?? 0) > 0 },
        { title: "Parents / tuteurs", help: "Fiche de l'élève → onglet « Parents » → bouton « Ajouter un parent ».", href: "/students", done: has(parentsQ.data) },
      ],
    },
    {
      title: "4. Finances",
      steps: [
        { title: "Frais scolaires", help: "Bouton « Nouveau frais », puis « + Ajouter une échéance » pour étaler le paiement.", href: "/invoices/fees", done: has(feesQ.data) },
        { title: "Numéro marchand de reversement", help: "Bas de la section « Informations de l'établissement » → champ « Numéro marchand » (Mobile Money).", href: "/settings", done: !!profile?.payoutMerchantNumber },
      ],
    },
    {
      title: "5. Personnalisation & communication",
      steps: [
        { title: "Logo & couleurs de l'école", help: "Section « Apparence » → bouton d'import « Logo de l'établissement » et palette de couleurs.", href: "/settings", done: !!profile?.logo },
        { title: "Modèles de messages", help: "Bouton « Nouveau modèle » pour standardiser vos SMS/emails automatiques.", href: "/communications/templates", done: has(templatesQ.data) },
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

  // Tout est configuré → on masque définitivement (et on mémorise) — sauf sur la page dédiée
  // (forceShow), ouverte volontairement, où l'on montre quand même le récapitulatif complet.
  if (doneCount === total && !forceShow) {
    if (storageKey && typeof window !== "undefined") window.localStorage.setItem(storageKey, "1");
    return null;
  }

  if (compact) {
    return (
      <Link
        href="/onboarding"
        className="flex items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-brand-500 text-white">
            <Rocket className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Bienvenue ! Configurons votre école</p>
            <p className="text-xs text-slate-500">Guide de démarrage étape par étape — {doneCount}/{total} terminées</p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 flex-none text-brand-600" />
      </Link>
    );
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

      {/* Référence complète : chaque fonctionnalité restante, avec le bouton exact à utiliser — rien
          n'est laissé de côté, même ce qui n'est pas indispensable pour démarrer. */}
      <div className="mt-6 border-t border-brand-100 pt-5">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Pour aller plus loin — le reste de la plateforme, bouton par bouton
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          {EXTRA_GROUPS.map((g) => {
            const t = THEME[g.theme];
            return (
              <div key={g.title} className="rounded-xl border border-slate-100 bg-white/70 p-3">
                <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${t.title}`}>{g.title}</p>
                <ul className="space-y-1.5">
                  {g.items.map((it) => {
                    const Icon = it.icon;
                    return (
                      <li key={it.title}>
                        <Link
                          href={it.href}
                          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2 transition ${t.card}`}
                        >
                          <span className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-lg ${t.icon}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{it.title}</span>
                            <span className="block text-xs text-slate-500">{it.help}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
