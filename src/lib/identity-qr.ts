/**
 * QR d'identité lisible pour les badges (école, prénom, nom, matricule) — remplace l'ancien format
 * technique « LACA|tenant|… ». Le QR reste exploitable pour le pointage : le scanner en extrait le
 * matricule et retrouve la personne. Format volontairement lisible une fois décodé :
 *
 *   École : Groupe Scolaire La Cathédrale
 *   Nom : Mamadou Diallo
 *   Matricule : GSC-ELV-2026-00042
 */
export function buildIdentityQr(params: {
  schoolName?: string | null;
  fullName?: string | null;
  matricule?: string | null;
}): string {
  const lines = [
    `École : ${params.schoolName?.trim() || "—"}`,
    `Nom : ${params.fullName?.trim() || "—"}`,
    `Matricule : ${params.matricule?.trim() || "—"}`,
  ];
  return lines.join("\n");
}

/** Extrait le matricule d'un QR d'identité lisible (ou null si absent). */
export function matriculeFromQr(raw: string): string | null {
  const m = raw.match(/Matricule\s*:\s*(.+)/i);
  return m ? m[1].trim() : null;
}
