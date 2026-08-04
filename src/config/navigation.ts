import type { LucideIcon } from "lucide-react";
import {
  Award,
  BookOpen,
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CreditCard,
  IdCard,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Library,
  MessagesSquare,
  School,
  Settings,
  Gauge,
  PiggyBank,
  ShieldAlert,
  NotebookPen,
  Banknote,
  Briefcase,
  Bus,
  Receipt,
  TrendingUp,
  UserSearch,
  Users,
  Webhook,
} from "lucide-react";
import type { RoleCode } from "@/lib/types/enums";

/** Functional module codes, mirroring the backend ModuleCode enum. */
export type ModuleCode =
  | "IAM" | "STUDENTS" | "STAFF" | "ACADEMICS" | "ATTENDANCE" | "GRADING"
  | "BILLING" | "PAYMENTS" | "WEBHOOKS" | "REPORT_CARD" | "COMMUNICATION"
  | "EXPENSES" | "ACCOUNTING" | "STUDENT_CARDS";

export interface NavItem {
  label: string;
  /** Omitted for pure parent items that only group children. */
  href?: string;
  icon?: LucideIcon;
  /** Roles allowed to see this item. Omitted = visible to any authenticated user. */
  roles?: RoleCode[];
  /** Backend ModuleCode gating this item. Omitted = always available (not module-gated). */
  module?: ModuleCode;
  /** Optional collapsible sub-menu. */
  children?: NavItem[];
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/** Sidebar structure mirroring the backend modules; items are filtered by the user's roles. */
export const NAVIGATION: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"] },
      { label: "Vision Fondateur", href: "/founder", icon: TrendingUp, roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
      { label: "Rapports & analytique", href: "/reports", icon: Gauge, roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
    ],
  },
  {
    title: "Scolarité",
    items: [
      { label: "Élèves", href: "/students", icon: GraduationCap, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
      { label: "Guichet d'accueil", href: "/guichet", icon: Receipt, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"] },
      { label: "Cartes scolaires (badges)", href: "/student-cards", icon: IdCard, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENT_CARDS" },
      {
        label: "Inscriptions & rentrée", icon: ClipboardList, module: "STUDENTS",
        children: [
          { label: "Inscriptions", href: "/enrollments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
          { label: "Réinscription (rentrée)", href: "/enrollments/re-enrollment", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
          { label: "Mouvements & attente", href: "/enrollments/movements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
          { label: "Tableau de la rentrée", href: "/enrollments/overview", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "STUDENTS" },
        ],
      },
      { label: "Classes", href: "/classes", icon: School, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "ACADEMICS" },
      { label: "Emploi du temps", href: "/timetable", icon: CalendarDays, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY"], module: "ACADEMICS" },
      {
        label: "Personnel", icon: Briefcase, module: "STAFF",
        children: [
          { label: "Enseignants", href: "/teachers", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "STAFF" },
          { label: "Personnel administratif", href: "/teachers/staff", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "STAFF" },
        ],
      },
      { label: "Transport", href: "/transport", icon: Bus, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
      { label: "Annuaire inter-écoles", href: "/directory", icon: UserSearch, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
    ],
  },
  {
    title: "Pédagogie",
    items: [
      {
        label: "Notes & bulletins", icon: BookOpen,
        children: [
          { label: "Évaluations & notes", href: "/grading", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], module: "GRADING" },
          { label: "Bulletins", href: "/grading/report-cards", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], module: "REPORT_CARD" },
          { label: "Conseil de classe", href: "/grading/validation", roles: ["SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE", "TEACHER"], module: "REPORT_CARD" },
          { label: "Paramètres de notation", href: "/grading/settings", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "GRADING" },
        ],
      },
      { label: "Devoirs", href: "/assignments", icon: ClipboardList, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
      { label: "Cahier de textes", href: "/lessons", icon: NotebookPen, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"] },
      { label: "Présences", href: "/attendance", icon: CalendarCheck, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY"], module: "ATTENDANCE" },
      {
        label: "Vie scolaire", icon: ShieldAlert,
        children: [
          { label: "Discipline", href: "/student-life/discipline", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"] },
          { label: "Santé / Infirmerie", href: "/student-life/health", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"] },
        ],
      },
    ],
  },
  {
    title: "Finances",
    items: [
      {
        label: "Facturation", icon: FileText, module: "BILLING",
        children: [
          { label: "Factures élèves", href: "/invoices", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "BILLING" },
          { label: "Frais scolaires", href: "/invoices/fees", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"], module: "BILLING" },
          { label: "Règles de facturation", href: "/invoices/rules", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"], module: "BILLING" },
        ],
      },
      {
        label: "Encaissements", icon: CreditCard, module: "PAYMENTS",
        children: [
          { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "PAYMENTS" },
          { label: "Transactions & reçus", href: "/payments/transactions", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "PAYMENTS" },
        ],
      },
      // "Comptabilité" (module SYSCOHADA complet) est masquée du menu — jugée redondante avec
      // Budget & subventions / Dépenses pour l'usage courant — mais son code/ses pages restent
      // intacts et accessibles par URL directe si besoin (décision utilisateur, pas de suppression).
      {
        label: "Budget & subventions", icon: PiggyBank,
        children: [
          { label: "Budget annuel", href: "/budget", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
          { label: "Subventions", href: "/budget/grants", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
          { label: "Dépenses", href: "/budget/expenses", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], module: "EXPENSES" },
        ],
      },
      { label: "Paie", href: "/payroll", icon: Banknote, roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"] },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        label: "Messagerie & annonces", icon: MessagesSquare,
        children: [
          { label: "Messages", href: "/communications", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], module: "COMMUNICATION" },
          { label: "Annonces", href: "/communications/announcements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"] },
          { label: "Modèles", href: "/communications/templates", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "COMMUNICATION" },
        ],
      },
    ],
  },
  {
    title: "Mon espace",
    items: [
      { label: "Mon tableau de bord", href: "/dashboard/enseignant", icon: Gauge, roles: ["TEACHER"] },
      { label: "Mes classes", href: "/my-classes", icon: GraduationCap, roles: ["TEACHER"] },
      { label: "Mes enfants", href: "/children", icon: Users, roles: ["PARENT"] },
      { label: "Mes résultats", href: "/my-results", icon: Award, roles: ["STUDENT"] },
    ],
  },
  {
    title: "Plateforme",
    items: [
      { label: "Tableau de bord", href: "/platform/dashboard", icon: Gauge, roles: ["SUPER_ADMIN"] },
      { label: "Écoles", href: "/platform/tenants", icon: Building2, roles: ["SUPER_ADMIN"] },
      { label: "Utilisateurs", href: "/platform/users", icon: Users, roles: ["SUPER_ADMIN"] },
      { label: "Abonnements", href: "/platform/subscriptions", icon: CreditCard, roles: ["SUPER_ADMIN"] },
      { label: "Plans", href: "/platform/plans", icon: Layers, roles: ["SUPER_ADMIN"] },
    ],
  },
  {
    title: "Mon abonnement",
    items: [
      {
        label: "Abonnement",
        icon: CreditCard,
        roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
        children: [
          { label: "Vue d'ensemble", href: "/subscription" },
          { label: "Factures d'abonnement", href: "/subscription/invoices" },
        ],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Année scolaire & calendrier", href: "/academic-years", icon: CalendarRange, roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
      { label: "Référentiels", href: "/referentials", icon: Library, roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
      { label: "Documents & modèles", href: "/documents", icon: FileText, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
      {
        label: "Utilisateurs & Rôles", icon: Users,
        children: [
          { label: "Utilisateurs", href: "/users", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
          { label: "Rôles & permissions", href: "/users/roles", roles: ["SCHOOL_ADMIN"] },
        ],
      },
      {
        label: "Intégrations", icon: Webhook,
        children: [
          { label: "Biométrie", href: "/biometric", roles: ["SCHOOL_ADMIN", "DIRECTOR"] },
          { label: "Webhooks", href: "/biometric/webhooks", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "WEBHOOKS" },
        ],
      },
      { label: "Paramètres", href: "/settings", icon: Settings, roles: ["SCHOOL_ADMIN"] },
    ],
  },
];

/** Flattens nav items (incl. children) to leaf entries that have an href — used by global search. */
export function flattenNav(items: NavItem[]): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  for (const item of items) {
    if (item.href) out.push({ label: item.label, href: item.href });
    if (item.children) out.push(...flattenNav(item.children));
  }
  return out;
}
