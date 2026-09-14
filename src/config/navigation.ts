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
  Landmark,
  LayoutDashboard,
  Layers,
  Library,
  MessagesSquare,
  Newspaper,
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
  /** Roles allowed to see this item — réservé aux identités système (SUPER_ADMIN, DPE_ADMIN,
   * TEACHER/PARENT/STUDENT en libre-service) qui ne passent pas par le catalogue de permissions.
   * Omitted = visible à tout utilisateur authentifié. */
  roles?: RoleCode[];
  /** Permissions (au moins une) qui donnent aussi accès à cet item, pour un rôle personnalisé sans
   * code fixe (créé via /users/roles). Un item avec `roles` ET `permissions` est visible si l'un ou
   * l'autre matche — voir useNavGating / role-access.ts. */
  permissions?: string[];
  /** Rôles système exclus même si `permissions` matche — ex. eleve:read est aussi accordé à PARENT
   * pour son propre portail (/students/me), pas pour la page admin « Élèves » (liste complète). */
  excludeRoles?: RoleCode[];
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
      { label: "Tableau de bord", href: "/dashboard", icon: LayoutDashboard, roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"], permissions: ["eleve:read", "facture:read"], excludeRoles: ["PARENT"] },
      { label: "Vision Fondateur", href: "/founder", icon: TrendingUp, roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["dashboard:direction"] },
      { label: "Rapports & analytique", href: "/reports", icon: Gauge, roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["dashboard:admin"] },
    ],
  },
  {
    title: "Scolarité",
    items: [
      { label: "Élèves", href: "/students", icon: GraduationCap, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["eleve:read"], excludeRoles: ["PARENT"], module: "STUDENTS" },
      { label: "Guichet d'accueil", href: "/guichet", icon: Receipt, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"], permissions: ["eleve:read"], excludeRoles: ["PARENT"] },
      { label: "Cartes scolaires (badges)", href: "/student-cards", icon: IdCard, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["carte:manage"], module: "STUDENT_CARDS" },
      {
        label: "Inscriptions & rentrée", icon: ClipboardList, module: "STUDENTS",
        children: [
          { label: "Inscriptions", href: "/enrollments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], excludeRoles: ["PARENT"], module: "STUDENTS" },
          { label: "Réinscription (rentrée)", href: "/enrollments/re-enrollment", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:create"], module: "STUDENTS" },
          { label: "Mouvements & attente", href: "/enrollments/movements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], excludeRoles: ["PARENT"], module: "STUDENTS" },
          { label: "Tableau de la rentrée", href: "/enrollments/overview", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["inscription:read"], excludeRoles: ["PARENT"], module: "STUDENTS" },
        ],
      },
      // Pas de permission classe:* qui corresponde exactement à l'accès actuel (classe:manage
      // exclut Secrétaire, classe:read inclut Enseignant) — laissé en rôles fixes pour l'instant.
      { label: "Classes", href: "/classes", icon: School, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], module: "ACADEMICS" },
      { label: "Emploi du temps", href: "/timetable", icon: CalendarDays, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY"], permissions: ["emploi:read"], excludeRoles: ["STUDENT"], module: "ACADEMICS" },
      // Page dédiée aux événements du calendrier (pas de gestion d'année scolaire, contrairement à
      // « Année scolaire & calendrier ») — seul écran auquel le responsable pédagogique a accès pour
      // programmer réunions/sorties, sans les droits plus larges de gestion des années scolaires.
      { label: "Calendrier des événements", href: "/calendar", icon: CalendarRange, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "RESPONSABLE_PEDAGOGIQUE"], module: "ACADEMICS" },
      {
        label: "Personnel", icon: Briefcase, module: "STAFF",
        children: [
          { label: "Enseignants", href: "/teachers", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "STAFF" },
          { label: "Personnel administratif", href: "/teachers/staff", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "STAFF" },
        ],
      },
      { label: "Transport", href: "/transport", icon: Bus, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["transport:manage"] },
      // Recherche cross-tenant volontairement restreinte aux rôles système (données d'autres écoles).
      { label: "Annuaire inter-écoles", href: "/directory", icon: UserSearch, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"] },
    ],
  },
  {
    title: "Pédagogie",
    items: [
      {
        label: "Notes & bulletins", icon: BookOpen,
        children: [
          { label: "Évaluations & notes", href: "/grading", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissions: ["note:read"], excludeRoles: ["PARENT", "STUDENT"], module: "GRADING" },
          { label: "Bulletins", href: "/grading/report-cards", roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissions: ["bulletin:read"], excludeRoles: ["PARENT", "STUDENT"], module: "REPORT_CARD" },
          { label: "Conseil de classe", href: "/grading/validation", roles: ["SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE", "TEACHER"], permissions: ["bulletin:read"], excludeRoles: ["PARENT", "STUDENT"], module: "REPORT_CARD" },
          // Pas de permission dédiée à ce réglage (hasAnyRole non migré) — laissé en rôles fixes.
          { label: "Paramètres de notation", href: "/grading/settings", roles: ["SCHOOL_ADMIN", "DIRECTOR"], module: "GRADING" },
        ],
      },
      { label: "Devoirs", href: "/assignments", icon: ClipboardList, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissions: ["devoir:manage"] },
      { label: "Cahier de textes", href: "/lessons", icon: NotebookPen, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER"], permissions: ["cahier:manage"] },
      { label: "Cours en ligne", href: "/courses", icon: BookOpen, roles: ["SCHOOL_ADMIN", "DIRECTOR", "RESPONSABLE_PEDAGOGIQUE", "TEACHER"], permissions: ["cours:manage"], excludeRoles: ["PARENT", "STUDENT"] },
      { label: "Présences", href: "/attendance", icon: CalendarCheck, roles: ["SCHOOL_ADMIN", "DIRECTOR", "TEACHER", "SECRETARY"], permissions: ["presence:read"], excludeRoles: ["PARENT", "STUDENT"], module: "ATTENDANCE" },
      {
        label: "Vie scolaire", icon: ShieldAlert,
        children: [
          { label: "Discipline", href: "/student-life/discipline", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], permissions: ["discipline:manage"] },
          { label: "Santé / Infirmerie", href: "/student-life/health", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], permissions: ["sante:read", "sante:manage"] },
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
          { label: "Factures élèves", href: "/invoices", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["facture:read"], excludeRoles: ["PARENT"], module: "BILLING" },
          { label: "Frais scolaires", href: "/invoices/fees", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"], permissions: ["frais:manage"], module: "BILLING" },
          { label: "Règles de facturation", href: "/invoices/rules", roles: ["SCHOOL_ADMIN", "ACCOUNTANT"], permissions: ["frais:manage"], module: "BILLING" },
        ],
      },
      {
        label: "Encaissements", icon: CreditCard, module: "PAYMENTS",
        children: [
          { label: "Paiements", href: "/payments", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], excludeRoles: ["PARENT"], module: "PAYMENTS" },
          // Vue jour par jour, tous canaux confondus, pour le contrôle mensuel du fondateur
          // (§angles morts comptables) — indépendante du fait que les frais soient réglés par tranche.
          { label: "Encaissements par jour", href: "/payments/daily", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paiement:read"], module: "PAYMENTS" },
          { label: "Transactions & reçus", href: "/payments/transactions", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["transaction:read"], module: "PAYMENTS" },
          // Rapprochement de caisse (§angles morts comptables) : usage quotidien au guichet, contrairement
          // au reste de la section « Comptabilité » (masquée du menu, cf. plus bas) — reste visible ici.
          { label: "Session de caisse", href: "/accounting/cashier-session", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT", "SECRETARY"], permissions: ["paiement:create"], module: "PAYMENTS" },
        ],
      },
      // "Comptabilité" (module SYSCOHADA complet) est masquée du menu — jugée redondante avec
      // Budget & subventions / Dépenses pour l'usage courant — mais son code/ses pages restent
      // intacts et accessibles par URL directe si besoin (décision utilisateur, pas de suppression).
      {
        label: "Budget & subventions", icon: PiggyBank,
        children: [
          { label: "Budget annuel", href: "/budget", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["budget:manage", "budget:approve"] },
          { label: "Subventions", href: "/budget/grants", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["budget:manage"] },
          { label: "Dépenses", href: "/budget/expenses", roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["depense:create", "depense:approve"], module: "EXPENSES" },
        ],
      },
      { label: "Paie", href: "/payroll", icon: Banknote, roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"], permissions: ["paie:manage"] },
    ],
  },
  {
    title: "Communication",
    items: [
      {
        label: "Messagerie & annonces", icon: MessagesSquare,
        children: [
          // Messages : pas encore couvert par le catalogue de permissions (communication:send
          // n'inclut pas TEACHER par défaut, contrairement au rôle codé en dur ici — §écart à trancher).
          { label: "Messages", href: "/communications", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], module: "COMMUNICATION" },
          { label: "Annonces", href: "/communications/announcements", roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "TEACHER"], permissions: ["annonce:manage"] },
          { label: "Modèles", href: "/communications/templates", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["modele:manage"], module: "COMMUNICATION" },
        ],
      },
    ],
  },
  {
    title: "Mon espace",
    items: [
      { label: "Mon tableau de bord", href: "/dashboard/enseignant", icon: Gauge, roles: ["TEACHER"] },
      { label: "Mes classes", href: "/my-classes", icon: GraduationCap, roles: ["TEACHER"] },
      { label: "Ma paie", href: "/my-payslips", icon: Banknote, roles: ["TEACHER"] },
      { label: "Mes enfants", href: "/children", icon: Users, roles: ["PARENT"] },
      { label: "Mes résultats", href: "/my-results", icon: Award, roles: ["STUDENT"] },
      { label: "Cours en ligne", href: "/courses", icon: BookOpen, roles: ["PARENT", "STUDENT"] },
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
      { label: "Frais plateforme", href: "/platform/frais", icon: Banknote, roles: ["SUPER_ADMIN"] },
      { label: "Préfectures DPE/DCE", href: "/platform/prefectures", icon: Landmark, roles: ["SUPER_ADMIN"] },
      { label: "Blog", href: "/platform/blog/posts", icon: Newspaper, roles: ["SUPER_ADMIN", "REDACTEUR"] },
    ],
  },
  {
    title: "DPE / DCE",
    items: [
      { label: "Tableau de bord", href: "/dpe/dashboard", icon: Gauge, roles: ["DPE_ADMIN"] },
      { label: "Écoles du périmètre", href: "/dpe/schools", icon: Building2, roles: ["DPE_ADMIN"] },
      { label: "Alertes", href: "/dpe/alerts", icon: ShieldAlert, roles: ["DPE_ADMIN"] },
    ],
  },
  {
    title: "Mon abonnement",
    items: [
      {
        label: "Abonnement",
        icon: CreditCard,
        roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
        permissions: ["abonnement:read"],
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
      { label: "Année scolaire & calendrier", href: "/academic-years", icon: CalendarRange, roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["annee:manage"] },
      { label: "Référentiels", href: "/referentials", icon: Library, roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["niveau:manage", "salle:manage", "matiere:manage"] },
      { label: "Documents & modèles", href: "/documents", icon: FileText, roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"], permissions: ["document:manage", "document:generate"] },
      {
        label: "Utilisateurs & Rôles", icon: Users,
        children: [
          { label: "Utilisateurs", href: "/users", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["user:read"] },
          { label: "Rôles & permissions", href: "/users/roles", roles: ["SCHOOL_ADMIN"], permissions: ["role:read"] },
        ],
      },
      {
        label: "Intégrations", icon: Webhook,
        children: [
          { label: "Biométrie", href: "/biometric", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["biometrique:manage"] },
          { label: "Webhooks", href: "/biometric/webhooks", roles: ["SCHOOL_ADMIN", "DIRECTOR"], permissions: ["webhook:manage"], module: "WEBHOOKS" },
        ],
      },
      // Pas encore couvert par le catalogue de permissions (§task paramètres tenant).
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
