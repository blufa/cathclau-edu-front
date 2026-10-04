import { listClasses, listClassSubjects, getScheduleByClass, listLevels, listRooms, listSubjects } from "@/lib/api/academics";
import { listFeesByTenant, listInvoicesByTenant } from "@/lib/api/billing";
import { searchStudentsSummary } from "@/lib/api/students";
import { listTeachers } from "@/lib/api/staff";
import { listAssessmentsByClass } from "@/lib/api/grading";
import { listMonthlyExpenseSheets } from "@/lib/api/expense";
import { listAcademicYears } from "@/lib/api/academics";
import { getDesktopDb } from "./desktop-db";

const STUDENTS_PAGE_SIZE = 500;

/** `ok=false` quand la requête a échoué (réseau OU permission refusée pour ce rôle — ex. un
 * enseignant n'a pas `frais_scolaire:read`) : la table correspondante n'est alors PAS touchée
 * (ni vidée ni réinsérée), pour ne jamais remplacer des données locales valides par du vide à
 * cause d'un échec sur une donnée que ce rôle n'a de toute façon pas le droit de lire. */
async function safeList<T>(fn: () => Promise<T[]>): Promise<{ ok: boolean; data: T[] }> {
  try {
    return { ok: true, data: await fn() };
  } catch {
    return { ok: false, data: [] };
  }
}

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
 *
 * §retour fondateurs — chaque source est isolée (voir `safeList`) : un enseignant qui se connecte
 * n'a pas la permission de lire les frais/factures/fiches de dépense (réservé à l'administration),
 * et AVANT ce correctif, ce refus de permission faisait échouer `Promise.all` en bloc — plus aucune
 * classe, élève, matière, emploi du temps ni évaluation n'était synchronisée pour lui, alors que ce
 * sont exactement les données dont il a besoin chaque jour pour le cahier de texte et les notes.
 */
export async function pullReferenceData(tenantId: number, academicYearId: number): Promise<void> {
  const db = await getDesktopDb();

  const [classesR, feesR, invoicesR, teachersR, subjectsR, levelsR, roomsR, academicYearsR, expenseSheetsR] = await Promise.all([
    safeList(() => listClasses(academicYearId)),
    safeList(() => listFeesByTenant(tenantId)),
    safeList(() => listInvoicesByTenant(tenantId, academicYearId)),
    safeList(() => listTeachers()),
    safeList(() => listSubjects()),
    safeList(() => listLevels()),
    safeList(() => listRooms()),
    safeList(() => listAcademicYears()),
    safeList(() => listMonthlyExpenseSheets()),
  ]);
  const classes = classesR.data;
  const expenseSheets = expenseSheetsR.data.filter((s) => !s.closedAt);

  const studentsResult = await safeList(async () => {
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
    return students;
  });

  // Par classe : affectations matière/enseignant, créneaux d'emploi du temps, évaluations à noter.
  // Chaque sous-requête est isolée par classe (pas un seul Promise.all global) : l'échec sur UNE
  // classe (ex. permission refusée pour un enseignant sans affectation sur celle-ci) ne doit pas
  // priver toutes les AUTRES classes de leurs données.
  const classSubjects = [];
  const scheduleSlots = [];
  const assessments = [];
  for (const c of classes) {
    const [cs, sched, asm] = await Promise.all([
      safeList(() => listClassSubjects(c.id)),
      safeList(() => getScheduleByClass(c.id)),
      safeList(() => listAssessmentsByClass(c.id)),
    ]);
    classSubjects.push(...cs.data);
    scheduleSlots.push(...sched.data);
    assessments.push(...asm.data);
  }

  const tablesToRefresh: string[] = [];
  if (classesR.ok) tablesToRefresh.push("classes", "classe_matieres", "emploi_du_temps", "evaluations");
  if (studentsResult.ok) tablesToRefresh.push("eleves");
  if (feesR.ok) tablesToRefresh.push("frais_scolaires");
  if (invoicesR.ok) tablesToRefresh.push("factures");
  if (teachersR.ok) tablesToRefresh.push("enseignants");
  if (subjectsR.ok) tablesToRefresh.push("matieres");
  if (expenseSheetsR.ok) tablesToRefresh.push("fiches_depense");
  if (academicYearsR.ok) tablesToRefresh.push("annees_scolaires");
  if (levelsR.ok) tablesToRefresh.push("niveaux");
  if (roomsR.ok) tablesToRefresh.push("salles");

  for (const table of tablesToRefresh) {
    await db.execute(`DELETE FROM ${table} WHERE etablissement_id = $1`, [tenantId]);
  }

  if (classesR.ok) {
    for (const c of classes) {
      await db.execute(
        `INSERT INTO classes (id, etablissement_id, annee_scolaire_id, niveau_id, nom, effectif, capacite_max)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [c.id, tenantId, c.academicYearId, c.levelId, c.label, c.headcount, c.maxCapacity],
      );
    }
  }
  if (studentsResult.ok) {
    for (const s of studentsResult.data) {
      await db.execute(
        `INSERT INTO eleves (id, etablissement_id, classe_id, matricule, nom, prenom)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [s.id, tenantId, s.classeId, s.matricule, s.nom, s.prenom],
      );
    }
  }
  if (feesR.ok) {
    for (const f of feesR.data) {
      await db.execute(
        `INSERT INTO frais_scolaires (id, etablissement_id, classe_id, type, libelle, montant)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [f.id, tenantId, f.classId, f.type, f.label, Number(f.amount)],
      );
    }
  }
  if (invoicesR.ok) {
    for (const i of invoicesR.data) {
      await db.execute(
        `INSERT INTO factures (id, etablissement_id, eleve_id, frais_id, reference, montant_total, montant_paye, solde_restant, statut)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          i.id, tenantId, i.studentId, i.feeId, i.reference,
          Number(i.totalAmount), Number(i.paidAmount ?? 0), Number(i.remainingBalance ?? 0), i.status,
        ],
      );
    }
  }
  if (teachersR.ok) {
    for (const t of teachersR.data) {
      await db.execute(
        `INSERT INTO enseignants (id, etablissement_id, matricule, nom, prenom, telephone)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [t.id, tenantId, t.staffNumber, t.lastName, t.firstName, t.phone],
      );
    }
  }
  if (subjectsR.ok) {
    for (const m of subjectsR.data) {
      await db.execute(
        `INSERT INTO matieres (id, etablissement_id, libelle, coefficient) VALUES ($1, $2, $3, $4)`,
        [m.id, tenantId, m.label, Number(m.coefficient)],
      );
    }
  }
  if (classesR.ok) {
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
  }
  if (expenseSheetsR.ok) {
    for (const sheet of expenseSheets) {
      await db.execute(
        `INSERT INTO fiches_depense (id, etablissement_id, libelle, annee_scolaire, cloturee)
         VALUES ($1, $2, $3, $4, 0)`,
        [sheet.id, tenantId, sheet.label, sheet.academicYear],
      );
    }
  }
  if (academicYearsR.ok) {
    for (const y of academicYearsR.data) {
      await db.execute(
        `INSERT INTO annees_scolaires (id, etablissement_id, libelle, courante) VALUES ($1, $2, $3, $4)`,
        [y.id, tenantId, y.label, y.current ? 1 : 0],
      );
    }
  }
  if (levelsR.ok) {
    for (const n of levelsR.data) {
      await db.execute(
        `INSERT INTO niveaux (id, etablissement_id, libelle, ordre) VALUES ($1, $2, $3, $4)`,
        [n.id, tenantId, n.label, n.sortOrder],
      );
    }
  }
  if (roomsR.ok) {
    for (const r of roomsR.data) {
      await db.execute(
        `INSERT INTO salles (id, etablissement_id, libelle, batiment) VALUES ($1, $2, $3, $4)`,
        [r.id, tenantId, r.label, r.building],
      );
    }
  }
}
