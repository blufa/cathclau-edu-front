import { listClasses, listClassSubjects, getScheduleByClass, listLevels, listRooms, listSubjects } from "@/lib/api/academics";
import { listFeesByTenant, listInvoicesByTenant } from "@/lib/api/billing";
import { searchStudentsSummary } from "@/lib/api/students";
import { listTeachers } from "@/lib/api/staff";
import { listAssessmentsByClass } from "@/lib/api/grading";
import { listMonthlyExpenseSheets } from "@/lib/api/expense";
import { listAcademicYears } from "@/lib/api/academics";
import { getDesktopDb } from "./desktop-db";

const STUDENTS_PAGE_SIZE = 500;

/**
 * Rafraîchit le miroir local (SQLite) de TOUT ce qui est manipulé au jour le jour hors ligne :
 * classes, élèves, frais/factures (encaissement), enseignants/matières/emploi du temps (cahier de
 * texte), évaluations (notes) et fiches de dépense ouvertes. À lancer dès que l'appli desktop détecte
 * une connexion — au démarrage, et à intervalle régulier tant qu'elle reste ouverte (voir
 * `wireDesktopSyncTriggers` dans `desktop-sync.ts`).
 *
 * Volontairement HORS de ce miroir : tout ce qui n'est pas manipulé quotidiennement par un caissier/
 * enseignant, ou qui doit rester strictement server-side pour rester correct/sûr (paie, comptabilité
 * générale, RBAC, abonnement SaaS, audit...) — voir la revue complète communiquée séparément.
 *
 * Remplacement complet (DELETE puis réinsertion) par table, pas un merge incrémental : les volumes
 * visés (une école, quelques milliers d'élèves/factures) rendent un `updated_at`/delta inutilement
 * complexe pour l'instant — à revoir si ça devient un vrai goulot d'étranglement réseau.
 */
export async function pullReferenceData(tenantId: number, academicYearId: number): Promise<void> {
  const db = await getDesktopDb();

  const [classes, fees, invoices, teachers, subjects, levels, rooms, academicYears, expenseSheets] = await Promise.all([
    listClasses(academicYearId),
    listFeesByTenant(tenantId),
    listInvoicesByTenant(tenantId, academicYearId),
    listTeachers(),
    listSubjects(),
    listLevels(),
    listRooms(),
    listAcademicYears(),
    listMonthlyExpenseSheets(),
  ]);

  const students: { id: number; matricule: string; nom: string; prenom: string; classeId: number | null }[] = [];
  for (let page = 0; ; page++) {
    const result = await searchStudentsSummary({ page, size: STUDENTS_PAGE_SIZE });
    for (const s of result.content) {
      students.push({
        id: s.student.id,
        matricule: s.student.studentNumber,
        nom: s.student.lastName,
        prenom: s.student.firstName,
        classeId: s.classId,
      });
    }
    if (page + 1 >= result.totalPages) break;
  }

  // Par classe : affectations matière/enseignant, créneaux d'emploi du temps, évaluations à noter.
  const classSubjects = [];
  const scheduleSlots = [];
  const assessments = [];
  for (const c of classes) {
    const [cs, sched, asm] = await Promise.all([
      listClassSubjects(c.id),
      getScheduleByClass(c.id),
      listAssessmentsByClass(c.id),
    ]);
    classSubjects.push(...cs);
    scheduleSlots.push(...sched);
    assessments.push(...asm);
  }

  for (const table of [
    "classes", "eleves", "frais_scolaires", "factures", "enseignants", "matieres",
    "classe_matieres", "emploi_du_temps", "fiches_depense", "annees_scolaires", "niveaux",
    "salles", "evaluations",
  ]) {
    await db.execute(`DELETE FROM ${table} WHERE etablissement_id = $1`, [tenantId]);
  }

  for (const c of classes) {
    await db.execute(
      `INSERT INTO classes (id, etablissement_id, annee_scolaire_id, niveau_id, nom, effectif, capacite_max)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [c.id, tenantId, c.academicYearId, c.levelId, c.label, c.headcount, c.maxCapacity],
    );
  }
  for (const s of students) {
    await db.execute(
      `INSERT INTO eleves (id, etablissement_id, classe_id, matricule, nom, prenom)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [s.id, tenantId, s.classeId, s.matricule, s.nom, s.prenom],
    );
  }
  for (const f of fees) {
    await db.execute(
      `INSERT INTO frais_scolaires (id, etablissement_id, classe_id, type, libelle, montant)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [f.id, tenantId, f.classId, f.type, f.label, Number(f.amount)],
    );
  }
  for (const i of invoices) {
    await db.execute(
      `INSERT INTO factures (id, etablissement_id, eleve_id, frais_id, reference, montant_total, montant_paye, solde_restant, statut)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        i.id, tenantId, i.studentId, i.feeId, i.reference,
        Number(i.totalAmount), Number(i.paidAmount ?? 0), Number(i.remainingBalance ?? 0), i.status,
      ],
    );
  }
  for (const t of teachers) {
    await db.execute(
      `INSERT INTO enseignants (id, etablissement_id, matricule, nom, prenom, telephone)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [t.id, tenantId, t.staffNumber, t.lastName, t.firstName, t.phone],
    );
  }
  for (const m of subjects) {
    await db.execute(
      `INSERT INTO matieres (id, etablissement_id, libelle, coefficient) VALUES ($1, $2, $3, $4)`,
      [m.id, tenantId, m.label, Number(m.coefficient)],
    );
  }
  for (const cm of classSubjects) {
    await db.execute(
      `INSERT INTO classe_matieres (id, etablissement_id, classe_id, matiere_id, enseignant_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [cm.id, tenantId, cm.schoolClassId, cm.subjectId, cm.teacherId],
    );
  }
  for (const sl of scheduleSlots) {
    await db.execute(
      `INSERT INTO emploi_du_temps (id, etablissement_id, classe_id, matiere_id, enseignant_id, salle_id, jour, heure_debut, heure_fin, libelle)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [sl.id, tenantId, sl.schoolClassId, sl.subjectId, sl.teacherId, sl.roomId, sl.day, sl.startTime, sl.endTime, sl.label],
    );
  }
  for (const a of assessments) {
    await db.execute(
      `INSERT INTO evaluations (id, etablissement_id, classe_id, matiere_id, periode_id, libelle, note_sur, coefficient)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [a.id, tenantId, a.classId, a.subjectId, a.periodId, a.label, Number(a.maxScore), Number(a.coefficient)],
    );
  }
  for (const sheet of expenseSheets.filter((s) => !s.closedAt)) {
    await db.execute(
      `INSERT INTO fiches_depense (id, etablissement_id, libelle, annee_scolaire, cloturee)
       VALUES ($1, $2, $3, $4, 0)`,
      [sheet.id, tenantId, sheet.label, sheet.academicYear],
    );
  }
  for (const y of academicYears) {
    await db.execute(
      `INSERT INTO annees_scolaires (id, etablissement_id, libelle, courante) VALUES ($1, $2, $3, $4)`,
      [y.id, tenantId, y.label, y.current ? 1 : 0],
    );
  }
  for (const n of levels) {
    await db.execute(
      `INSERT INTO niveaux (id, etablissement_id, libelle, ordre) VALUES ($1, $2, $3, $4)`,
      [n.id, tenantId, n.label, n.sortOrder],
    );
  }
  for (const r of rooms) {
    await db.execute(
      `INSERT INTO salles (id, etablissement_id, libelle, batiment) VALUES ($1, $2, $3, $4)`,
      [r.id, tenantId, r.label, r.building],
    );
  }
}
