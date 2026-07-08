export type DocumentCategory = "ADMINISTRATIF" | "ELEVE" | "ENSEIGNANT" | "FINANCIER" | "PEDAGOGIQUE" | "RH" | "STATISTIQUE";
export type DocumentStyle = "MODERNE" | "ADMINISTRATIF" | "PREMIUM" | "ACADEMIQUE" | "CORPORATE";
export type PageFormat = "A4" | "A5";
export type DocumentType =
  | "BULLETIN" | "RELEVE_NOTES" | "CERTIFICAT_SCOLARITE" | "ATTESTATION_INSCRIPTION" | "ATTESTATION_FREQUENTATION"
  | "ATTESTATION_REUSSITE" | "CARTE_SCOLAIRE" | "BADGE_ELEVE" | "RECU_PAIEMENT" | "FACTURE" | "ECHEANCIER"
  | "HISTORIQUE_PAIEMENTS" | "FICHE_PAIE" | "CONTRAT_ENSEIGNANT" | "ATTESTATION_TRAVAIL" | "CERTIFICAT_TRAVAIL"
  | "EMPLOI_DU_TEMPS" | "LISTE_CLASSE" | "FEUILLE_PRESENCE" | "CONVOCATION" | "DIPLOME" | "RAPPORT_FINANCIER"
  | "RAPPORT_ACADEMIQUE" | "AUTRE";

export const CATEGORY_LABEL: Record<DocumentCategory, string> = {
  ADMINISTRATIF: "Administratif", ELEVE: "Élèves", ENSEIGNANT: "Enseignants", FINANCIER: "Financier",
  PEDAGOGIQUE: "Pédagogique", RH: "RH", STATISTIQUE: "Statistique",
};
export const STYLE_LABEL: Record<DocumentStyle, string> = {
  MODERNE: "Moderne", ADMINISTRATIF: "Administratif", PREMIUM: "Premium", ACADEMIQUE: "Académique", CORPORATE: "Corporate",
};
export const DOC_TYPE_LABEL: Record<DocumentType, string> = {
  BULLETIN: "Bulletin de notes", RELEVE_NOTES: "Relevé de notes", CERTIFICAT_SCOLARITE: "Certificat de scolarité",
  ATTESTATION_INSCRIPTION: "Attestation d'inscription", ATTESTATION_FREQUENTATION: "Attestation de fréquentation",
  ATTESTATION_REUSSITE: "Attestation de réussite", CARTE_SCOLAIRE: "Carte scolaire", BADGE_ELEVE: "Badge élève",
  RECU_PAIEMENT: "Reçu de paiement", FACTURE: "Facture", ECHEANCIER: "Échéancier", HISTORIQUE_PAIEMENTS: "Historique des paiements",
  FICHE_PAIE: "Fiche de paie", CONTRAT_ENSEIGNANT: "Contrat enseignant", ATTESTATION_TRAVAIL: "Attestation de travail",
  CERTIFICAT_TRAVAIL: "Certificat de travail", EMPLOI_DU_TEMPS: "Emploi du temps", LISTE_CLASSE: "Liste de classe",
  FEUILLE_PRESENCE: "Feuille de présence", CONVOCATION: "Convocation", DIPLOME: "Diplôme",
  RAPPORT_FINANCIER: "Rapport financier", RAPPORT_ACADEMIQUE: "Rapport académique", AUTRE: "Autre",
};

export interface DocumentTemplate {
  id: number; tenantId: number | null; category: DocumentCategory; documentType: DocumentType; name: string;
  style: DocumentStyle; headerHtml: string | null; bodyHtml: string | null; footerHtml: string | null;
  primaryColor: string | null; fontFamily: string | null; logoUrl: string | null; signatureUrl: string | null;
  stampUrl: string | null; watermarkText: string | null; pageFormat: PageFormat;
  marginTop: number; marginRight: number; marginBottom: number; marginLeft: number;
  numberingPrefix: string | null; version: number; isDefault: boolean; active: boolean;
  createdAt: string | null; updatedAt: string | null;
}

export interface GeneratedDocument {
  id: number; tenantId: number | null; templateId: number | null; documentType: DocumentType;
  reference: string; title: string | null; subjectType: string | null; subjectId: number | null;
  generatedBy: number | null; generatedAt: string | null;
}

export interface VariableGroup { group: string; variables: string[] }

export type TemplateInput = Omit<DocumentTemplate,
  "id" | "tenantId" | "version" | "isDefault" | "createdAt" | "updatedAt">;
