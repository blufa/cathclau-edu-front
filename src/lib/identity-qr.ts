/**
 * QR d'identité lisible pour les badges (type de personne, nom, matricule) — remplace l'ancien format
 * technique « LACA|tenant|… ». Le QR reste exploitable pour le pointage : le scanner en extrait le
 * type et le matricule pour retrouver directement la bonne personne, dans la bonne liste (élève,
 * enseignant ou personnel) — sans deviner. Format volontairement court et lisible une fois décodé :
 *
 *   Élève
 *   Mamadou Diallo
 *   Matricule : GSC-ELV-2026-00042
 *
 * Le nom de l'école a été retiré (déjà visible sur le reste du badge) et les libellés raccourcis :
 * moins de caractères encodés → un QR moins dense → des modules plus grands à taille d'impression
 * égale → un scan plus fiable (c'était la cause du « ça scanne difficilement » sur badge physique).
 */
export type IdentityQrType = "STUDENT" | "TEACHER" | "EMPLOYEE";

const TYPE_LABEL: Record<IdentityQrType, string> = {
  STUDENT: "Élève",
  TEACHER: "Enseignant",
  EMPLOYEE: "Personnel",
};

export function buildIdentityQr(params: {
  type: IdentityQrType;
  fullName?: string | null;
  matricule?: string | null;
}): string {
  const lines = [
    TYPE_LABEL[params.type],
    params.fullName?.trim() || "—",
    `Matricule : ${params.matricule?.trim() || "—"}`,
  ];
  return lines.join("\n");
}

/** Extrait le matricule d'un QR d'identité lisible (ou null si absent). */
export function matriculeFromQr(raw: string): string | null {
  const m = raw.match(/Matricule\s*:\s*(.+)/i);
  return m ? m[1].trim() : null;
}

/**
 * Extrait le type de personne d'un QR d'identité lisible — `null` pour un badge imprimé avant ce
 * correctif (ancien format sans ligne de type) : dans ce cas l'appelant doit retomber sur l'ancienne
 * recherche par matricule dans les trois listes (élève, enseignant, personnel), avec le risque de
 * collision de matricule entre types que ce nouveau champ élimine pour tout badge réimprimé.
 */
export function typeFromQr(raw: string): IdentityQrType | null {
  const firstLine = raw.split("\n")[0]?.trim().toLowerCase();
  if (firstLine === TYPE_LABEL.STUDENT.toLowerCase()) return "STUDENT";
  if (firstLine === TYPE_LABEL.TEACHER.toLowerCase()) return "TEACHER";
  if (firstLine === TYPE_LABEL.EMPLOYEE.toLowerCase()) return "EMPLOYEE";
  return null;
}
