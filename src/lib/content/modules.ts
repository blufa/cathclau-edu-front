import {
  BarChart3,
  Bell,
  Calendar,
  CalendarClock,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  MessagesSquare,
  Receipt,
  ShieldCheck,
  Smartphone,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export interface ModuleBlock {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface ModuleFaq {
  q: string;
  a: string;
}

export interface ModuleDetail {
  slug: string;
  icon: LucideIcon;
  title: string;
  lead: string;
  points: string[];
  image: string;
  secondaryImage: string;
  benefits: ModuleBlock[];
  advantages: ModuleBlock[];
  faqs: ModuleFaq[];
}

/** Contenu détaillé des modules — partagé entre la page d'ensemble (/fonctionnalites) et les pages
 * détail par module (/fonctionnalites/[module]). Images réelles de l'établissement, réutilisées
 * entre sections (aucune photo fabriquée). */
export const MODULE_DETAILS: ModuleDetail[] = [
  {
    slug: "scolarite",
    icon: GraduationCap,
    title: "Scolarité",
    lead: "Le cœur de votre établissement, du dossier élève au bulletin.",
    points: [
      "Élèves, inscriptions & réinscriptions",
      "Classes, niveaux et salles",
      "Emploi du temps avec détection de conflits",
      "Notes, examens et bulletins automatisés",
    ],
    image: "/images/school-1.jpg",
    secondaryImage: "/images/school-3.jpg",
    benefits: [
      { icon: Users, title: "Dossier élève centralisé", text: "Identité, classe, parents, documents et historique scolaire au même endroit." },
      { icon: CalendarClock, title: "Emploi du temps sans conflit", text: "Détection automatique des chevauchements de salle, d'enseignant ou de classe." },
      { icon: FileText, title: "Bulletins automatisés", text: "Moyennes, rangs et mentions calculés à la clôture de chaque période." },
    ],
    advantages: [
      { icon: GraduationCap, title: "Inscriptions fluides", text: "De la première inscription à la réinscription annuelle, sans ressaisie." },
      { icon: Calendar, title: "Années & périodes", text: "Trimestres ou semestres, clôturés puis archivés en lecture seule." },
      { icon: ShieldCheck, title: "Historique fiable", text: "Rien n'est perdu d'une année sur l'autre, même après clôture." },
      { icon: BarChart3, title: "Suivi des résultats", text: "Moyennes de classe, plus fort, plus faible, en un coup d'œil." },
    ],
    faqs: [
      { q: "Peut-on gérer plusieurs niveaux (maternelle, primaire, collège, lycée) ?", a: "Oui, chaque niveau a son propre cycle, ses classes et ses règles de progression, y compris la maternelle (Petite, Moyenne, Grande Section)." },
      { q: "Les bulletins sont-ils calculés automatiquement ?", a: "Oui, dès la clôture d'une période : moyennes par matière et générale, rang de classe, mention, à partir des coefficients configurés." },
      { q: "Peut-on reprendre les élèves d'une année précédente ?", a: "Oui, la réinscription reprend le dossier existant de l'élève et l'affecte à sa nouvelle classe." },
    ],
  },
  {
    slug: "communication",
    icon: MessagesSquare,
    title: "Communication",
    lead: "Gardez le lien avec les familles, au bon moment, sur le bon canal.",
    points: [
      "SMS, e-mail et WhatsApp",
      "Notifications automatiques (absences, résultats, échéances)",
      "Diffusion de masse par classe ou niveau",
      "Modèles de messages personnalisables",
    ],
    image: "/images/school-2.jpg",
    secondaryImage: "/images/school-5.jpg",
    benefits: [
      { icon: Bell, title: "Alertes en temps réel", text: "Absence, retard, résultat publié : le parent est informé au moment même." },
      { icon: Smartphone, title: "Multi-canal", text: "SMS, e-mail ou WhatsApp — chaque famille reçoit l'information sur son canal habituel." },
      { icon: MessagesSquare, title: "Diffusion ciblée", text: "Un message à une classe, un niveau ou toute l'école, en un envoi." },
    ],
    advantages: [
      { icon: FileText, title: "Modèles réutilisables", text: "Standardisez vos messages récurrents (échéances, réunions, résultats)." },
      { icon: UserCheck, title: "Statuts de livraison", text: "Sachez qui a reçu, lu ou n'a pas reçu chaque message." },
      { icon: Bell, title: "Relances automatiques", text: "Échéances de paiement dépassées : relance envoyée sans intervention manuelle." },
      { icon: Users, title: "Portail parent", text: "Les familles retrouvent l'historique de leurs échanges avec l'école." },
    ],
    faqs: [
      { q: "Faut-il une application dédiée pour les parents ?", a: "Non, les notifications arrivent par SMS, e-mail ou WhatsApp — aucune application à installer côté famille." },
      { q: "Peut-on envoyer un message à une seule classe ?", a: "Oui, la diffusion de masse cible une classe, un niveau ou toute l'école selon le besoin." },
      { q: "Les relances de paiement sont-elles automatiques ?", a: "Oui, une échéance dépassée déclenche une relance automatique par le canal configuré." },
    ],
  },
  {
    slug: "facturation",
    icon: Wallet,
    title: "Facturation & paiements",
    lead: "Encaissez plus vite, avec moins d'efforts.",
    points: [
      "Frais scolaires et échéanciers",
      "Factures par élève et par classe",
      "Paiements mobile money (Orange, MTN, Wave)",
      "Reçus générés automatiquement",
    ],
    image: "/images/school-6.jpg",
    secondaryImage: "/images/school-4.jpg",
    benefits: [
      { icon: Receipt, title: "Facturation automatique", text: "Inscription validée, échéance atteinte : la facture est déjà prête." },
      { icon: CreditCard, title: "Mobile money intégré", text: "Orange Money, MTN Money et Wave, directement depuis la plateforme." },
      { icon: Wallet, title: "Paiement par tranche", text: "Le parent choisit de régler mois par mois, sans ressaisie côté école." },
    ],
    advantages: [
      { icon: Download, title: "Reçus PDF instantanés", text: "Généré et envoyé automatiquement à chaque paiement réussi." },
      { icon: TrendingUp, title: "Suivi du recouvrement", text: "Voyez en temps réel ce qui est payé, en attente ou en retard." },
      { icon: Bell, title: "Relances intégrées", text: "Échéances dépassées relancées automatiquement par SMS ou WhatsApp." },
      { icon: ShieldCheck, title: "Remises maîtrisées", text: "Remises familiales et paiement anticipé calculées et tracées, jamais approximatives." },
    ],
    faqs: [
      { q: "Quels moyens de paiement sont pris en charge ?", a: "Orange Money, MTN Money, Wave, carte bancaire et paiement en espèces au guichet." },
      { q: "Peut-on payer en plusieurs fois ?", a: "Oui, chaque frais peut être échelonné en tranches, avec un reçu à chaque paiement." },
      { q: "Le reçu est-il automatique ?", a: "Oui, dès qu'un paiement est confirmé, le reçu PDF est généré et peut être envoyé à la famille." },
    ],
  },
  {
    slug: "pilotage",
    icon: BarChart3,
    title: "Pilotage",
    lead: "Décidez à partir de chiffres fiables, en temps réel.",
    points: [
      "Tableaux de bord par rôle",
      "Taux d'assiduité et de recouvrement",
      "Exports CSV / Excel",
      "Audit et traçabilité complète",
    ],
    image: "/images/school-4.jpg",
    secondaryImage: "/images/school-1.jpg",
    benefits: [
      { icon: BarChart3, title: "Tableaux de bord par rôle", text: "Direction, comptabilité, enseignants : chacun voit ce qui le concerne." },
      { icon: TrendingUp, title: "Indicateurs clés", text: "Effectifs, assiduité, recouvrement des frais, en un coup d'œil." },
      { icon: Download, title: "Exports à la demande", text: "Élèves, notes, paiements, présences — exportables en CSV ou Excel." },
    ],
    advantages: [
      { icon: ShieldCheck, title: "Journal d'audit", text: "Chaque action sensible (paiement, publication, rôle) est tracée." },
      { icon: Users, title: "Vue multi-établissement", text: "Comparez plusieurs écoles d'un même groupe scolaire." },
      { icon: BarChart3, title: "Suivi par période", text: "Comparez une année scolaire à la précédente sur les mêmes indicateurs." },
      { icon: FileText, title: "Rapports prêts à partager", text: "Générez les chiffres à présenter en conseil d'établissement." },
    ],
    faqs: [
      { q: "Peut-on suivre plusieurs écoles depuis un seul compte ?", a: "Oui, pour un groupe scolaire, chaque établissement reste isolé mais reste consultable depuis un espace de pilotage." },
      { q: "Les exports respectent-ils les permissions de chacun ?", a: "Oui, chaque export est filtré selon les données auxquelles le rôle de l'utilisateur donne accès." },
      { q: "L'historique est-il conservé après clôture d'une année ?", a: "Oui, les années clôturées passent en lecture seule mais restent consultables et exportables." },
    ],
  },
];

export function findModuleBySlug(slug: string): ModuleDetail | undefined {
  return MODULE_DETAILS.find((m) => m.slug === slug);
}
