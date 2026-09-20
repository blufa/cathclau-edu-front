/** Libellés français des rôles et des ressources de permissions — le backend renvoie désormais des
 * noms déjà en français (`Role.name`, `Permission.name`), mais ces tables restent un filet de
 * sécurité pour un code de rôle encore non traduit côté serveur, et pour l'en-tête de groupe (par
 * ressource) du sélecteur de permissions, qui n'a pas d'équivalent « name » côté backend. */

export const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super administrateur",
  SCHOOL_ADMIN: "Administrateur école",
  DIRECTOR: "Directeur",
  RESPONSABLE_PEDAGOGIQUE: "Responsable pédagogique",
  ACCOUNTANT: "Comptable",
  SECRETARY: "Secrétaire",
  TEACHER: "Enseignant",
  PARENT: "Parent",
  STUDENT: "Élève",
  REDACTEUR: "Rédacteur",
  DPE_ADMIN: "DPE/DCE",
};

/** Enlève le préfixe Spring Security `ROLE_` puis traduit ; renvoie le code brut si inconnu. */
export function roleLabel(role: string): string {
  return ROLE_LABEL[role.replace(/^ROLE_/, "")] ?? role;
}

/** En-tête de groupe (par ressource) du sélecteur de permissions — ex. « eleve » → « Élèves ». */
export const RESOURCE_LABEL: Record<string, string> = {
  abonnement: "Abonnements",
  annee: "Années scolaires",
  annonce: "Annonces",
  article: "Blog",
  audit: "Audit",
  biometrique: "Biométrie",
  budget: "Budget",
  bulletin: "Bulletins",
  cahier: "Cahier de textes",
  carte: "Cartes scolaires",
  classe: "Classes",
  communication: "Communications",
  cours: "Cours payants",
  dashboard: "Tableaux de bord",
  depense: "Dépenses",
  devoir: "Devoirs",
  discipline: "Discipline",
  document: "Documents",
  dpe: "DPE/DCE",
  echeance: "Échéances",
  eleve: "Élèves",
  emploi: "Emploi du temps",
  enseignant: "Enseignants",
  evaluation: "Évaluations",
  examen: "Examens",
  facture: "Factures",
  frais: "Frais scolaires",
  inscription: "Inscriptions",
  matiere: "Matières",
  modele: "Modèles de message",
  niveau: "Niveaux",
  note: "Notes",
  paie: "Paie",
  paiement: "Paiements",
  parent: "Parents",
  periode: "Périodes",
  permission: "Permissions",
  plan: "Plans d'abonnement",
  presence: "Présences",
  recu: "Reçus",
  role: "Rôles",
  salle: "Salles",
  sante: "Santé",
  tenant: "Écoles (plateforme)",
  transaction: "Transactions",
  transport: "Transport",
  user: "Utilisateurs",
  webhook: "Webhooks",
};

export function resourceLabel(resource: string): string {
  return RESOURCE_LABEL[resource] ?? resource;
}
