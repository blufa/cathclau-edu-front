import type { RoleCode } from "@/lib/types/enums";

export interface NavItem {
  label: string;
  href: string;
  /** Roles allowed to see this item. Omitted = visible to any authenticated user. */
  roles?: RoleCode[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar structure mirroring the backend modules; items are filtered by the user's roles. */
export const NAVIGATION: NavSection[] = [
  {
    title: "Pilotage",
    items: [{ label: "Tableau de bord", href: "/dashboard" }],
  },
  {
    title: "Scolarité",
    items: [
      { label: "Élèves", href: "/students", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
      { label: "Inscriptions", href: "/enrollments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
      { label: "Classes", href: "/classes", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
      { label: "Enseignants", href: "/teachers", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
      { label: "Emploi du temps", href: "/timetable", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY"] },
    ],
  },
  {
    title: "Pédagogie",
    items: [
      { label: "Évaluations & notes", href: "/grading", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
      { label: "Bulletins", href: "/report-cards", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
      { label: "Présences", href: "/attendance", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY"] },
    ],
  },
  {
    title: "Finances",
    items: [
      { label: "Factures", href: "/invoices", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
      { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
      { label: "Frais scolaires", href: "/fees", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"] },
    ],
  },
  {
    title: "Communication",
    items: [
      { label: "Messages", href: "/communications", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"] },
      { label: "Modèles", href: "/templates", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
    ],
  },
  {
    title: "Mon espace",
    items: [
      { label: "Mes enfants", href: "/children", roles: ["PARENT"] },
      { label: "Mes résultats", href: "/my-results", roles: ["STUDENT"] },
    ],
  },
  {
    title: "Plateforme",
    items: [
      { label: "Écoles", href: "/platform/tenants", roles: ["SUPER_ADMIN"] },
      { label: "Abonnements", href: "/platform/subscriptions", roles: ["SUPER_ADMIN"] },
      { label: "Plans", href: "/platform/plans", roles: ["SUPER_ADMIN"] },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Années scolaires", href: "/academic-years", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
      { label: "Référentiels", href: "/referentials", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Utilisateurs", href: "/users", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
      { label: "Rôles & permissions", href: "/roles", roles: ["SCHOOL_ADMIN"] },
      { label: "Paramètres", href: "/settings", roles: ["SCHOOL_ADMIN"] },
    ],
  },
];
