import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  CreditCard,
  GraduationCap,
  Home,
  MessagesSquare,
  ScanLine,
  Search,
} from "lucide-react";
import type { RoleGate } from "@/lib/auth/permissions";

export type MobileTabAction = "role-home" | "open-search";

export interface MobileTabItem extends RoleGate {
  key: string;
  label: string;
  icon: LucideIcon;
  /** Destination directe. Omis pour un item piloté par `action` ou `comingSoon`. */
  href?: string;
  /** Comportement spécial ne nécessitant pas de route fixe (accueil dépendant du rôle, recherche). */
  action?: MobileTabAction;
  /** Emplacement réservé pour une fonctionnalité pas encore disponible : même apparence que les
   * autres onglets, badge « Bientôt » et toast au tap au lieu d'une navigation — jamais un lien mort. */
  comingSoon?: boolean;
}

/** Maximum d'onglets « métier » affichés avant l'onglet « Plus » fixe (voir mobile-tab-bar.tsx). */
export const MAX_ROLE_TABS = 4;

/**
 * Pool d'onglets candidats pour la barre de navigation mobile, filtré par rôle (voir
 * `isNavItemAllowed`, réutilisé tel quel — même logique que la sidebar). Un seul « Accueil »
 * générique couvre tous les rôles via `roleHome()` (src/lib/auth/role-access.ts), plutôt que de
 * dupliquer une entrée par rôle.
 */
export const MOBILE_TABS: MobileTabItem[] = [
  { key: "home", label: "Accueil", icon: Home, action: "role-home" },

  // Parent
  { key: "parent-courses", label: "Cours en ligne", icon: BookOpen, href: "/courses", roles: ["PARENT", "STUDENT"] },
  { key: "parent-payments", label: "Paiement en ligne", icon: CreditCard, roles: ["PARENT"], comingSoon: true },
  { key: "parent-messages", label: "Messages", icon: MessagesSquare, roles: ["PARENT"], comingSoon: true },

  // Élève
  { key: "student-messages", label: "Messages", icon: MessagesSquare, roles: ["STUDENT"], comingSoon: true },

  // Enseignant
  { key: "teacher-classes", label: "Mes classes", icon: GraduationCap, href: "/my-classes", roles: ["TEACHER"] },
  { key: "teacher-timetable", label: "Emploi du temps", icon: CalendarDays, href: "/timetable", roles: ["TEACHER"] },
  { key: "teacher-attendance", label: "Présences", icon: CalendarCheck, href: "/attendance", roles: ["TEACHER"] },

  // Staff (direction, secrétariat, comptabilité)
  {
    key: "staff-search",
    label: "Recherche",
    icon: Search,
    action: "open-search",
    roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"],
  },
  {
    key: "staff-scan",
    label: "Scan présence",
    icon: ScanLine,
    href: "/attendance/scan",
    roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY"],
  },
  {
    key: "staff-payments",
    label: "Paiements",
    icon: CreditCard,
    href: "/payments",
    roles: ["SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT"],
  },
  {
    key: "staff-notifications",
    label: "Notifications",
    icon: Bell,
    roles: ["SCHOOL_ADMIN", "DIRECTOR", "SECRETARY", "ACCOUNTANT"],
    comingSoon: true,
  },
];
