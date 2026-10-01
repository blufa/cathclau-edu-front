import { createStudent } from "@/lib/api/students";
import { createParent, linkParentToStudent, type Relationship } from "@/lib/api/parents";
import { enroll } from "@/lib/api/enrollments";
import { grantExemption, generateAllForEnrollment } from "@/lib/api/billing";
import type { EnrollmentType, Gender } from "@/lib/types/student";
import type { ExemptionType, FeeType } from "@/lib/types/billing";
import { getDesktopDb } from "./desktop-db";

/** Parent de la soumission — soit déjà résolu (id connu, choisi/créé en ligne avant la coupure), soit
 * à créer à la synchro (mode "nouveau parent"/"personnel" sans id encore connu au moment de la mise en
 * file). */
export interface QueuedParent {
  id: number | null;
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
  staffUserId?: number | null;
  /** Personnel SANS compte de connexion (ex. pas de smartphone Android) : lien direct, alternative à
   * staffUserId — voir StaffSearchResult/StaffChildBenefitService#isStaffChild. */
  staffType?: "TEACHER" | "EMPLOYEE" | null;
  staffId?: number | null;
}

/** Un enfant de la soumission, avec SES champs ET sa progression déjà accomplie (voir migration 8) —
 * `done` une fois les 6 étapes passées (ou sautées quand non applicables), jamais retraité ensuite. */
export interface QueuedChild {
  key: string;
  firstName: string;
  lastName: string;
  gender: Gender;
  birthDate: string | null;
  address: string | null;
  originSchool: string | null;
  previousClass: string | null;
  classId: number;
  relationship: Relationship;
  enrollmentType: EnrollmentType;
  monthlyPaymentOptIn: boolean;
  exemption: {
    type: ExemptionType;
    percentage: number | null;
    amount: number | null;
    feeTypes: FeeType[] | null;
    reason: string;
    staffBenefit: boolean;
  } | null;
  // Progression (§retour comptable) : persistée après CHAQUE étape réussie pour qu'un cycle de
  // synchro interrompu (nouvelle coupure pendant la synchro elle-même) reprenne exactement là où il
  // s'était arrêté au cycle suivant, sans jamais recréer un élève déjà créé.
  studentId: number | null;
  parentLinked: boolean;
  enrolled: boolean;
  exemptionApplied: boolean;
  feesGenerated: boolean;
  done: boolean;
}

interface OfflineEnrollmentRow {
  id: string;
  etablissement_id: number;
  annee_scolaire_id: number;
  parent_json: string;
  enfants_json: string;
}

/** Met en file une soumission complète (parent + un ou plusieurs enfants) — appelé automatiquement
 * dès qu'un appel réseau échoue pendant "Nouvelle inscription" (voir `bulk-family-enrollment-page.tsx`),
 * jamais après un clic manuel : contrairement à l'encaissement/aux dépenses, l'utilisateur n'a rien à
 * faire, la synchro se charge de tout au retour du réseau (§retour comptable, demande explicite d'une
 * file "100% automatique"). */
export async function queueOfflineEnrollment(
  etablissementId: number, academicYearId: number, parent: QueuedParent, children: QueuedChild[],
): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO inscriptions_offline
       (id, etablissement_id, annee_scolaire_id, parent_json, enfants_json, synced)
     VALUES ($1, $2, $3, $4, $5, 0)`,
    [id, etablissementId, academicYearId, JSON.stringify(parent), JSON.stringify(children)],
  );
  return id;
}

export async function countPendingOfflineEnrollments(): Promise<number> {
  const db = await getDesktopDb();
  const rows = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM inscriptions_offline WHERE synced = 0",
  );
  return rows[0]?.n ?? 0;
}

/**
 * Rejoue automatiquement chaque soumission en attente : résout/crée le parent (idempotent — même
 * `id` de ligne locale utilisé comme clé, voir plus bas), puis traite chaque enfant non encore "done"
 * en sautant les étapes déjà réussies. Une erreur RÉSEAU sur un enfant arrête le traitement de CETTE
 * ligne (les enfants restants seront retentés au prochain cycle, inutile de marteler le réseau pendant
 * une coupure) sans empêcher les autres lignes/autres modules de synchroniser. Une erreur MÉTIER
 * (validation, conflit...) sur une étape non bloquante (exonération, transport, génération des
 * factures) est avalée comme en ligne — ces étapes ne bloquent jamais l'inscription elle-même.
 */
export async function pushOfflineEnrollments(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineEnrollmentRow[]>(
    "SELECT * FROM inscriptions_offline WHERE synced = 0 ORDER BY rowid ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    const parent: QueuedParent = JSON.parse(row.parent_json);
    const children: QueuedChild[] = JSON.parse(row.enfants_json);
    const persistChildren = () =>
      db.execute("UPDATE inscriptions_offline SET enfants_json = $1 WHERE id = $2", [JSON.stringify(children), row.id]);
    const persistParent = () =>
      db.execute("UPDATE inscriptions_offline SET parent_json = $1 WHERE id = $2", [JSON.stringify(parent), row.id]);

    try {
      let parentId = parent.id;
      if (parentId == null) {
        // Clé d'idempotence = id de la ligne locale : un même appel rejoué (coupure juste après une
        // création réussie côté serveur) renvoie le parent déjà créé au lieu d'en créer un second.
        const created = await createParent({
          firstName: parent.firstName ?? "", lastName: parent.lastName ?? "",
          phone: parent.phone ?? null, email: parent.email ?? null,
          occupation: parent.occupation ?? null, address: parent.address ?? null,
          idempotencyKey: row.id,
        }, parent.staffUserId ?? null, parent.staffType ?? null, parent.staffId ?? null);
        parentId = created.id;
        parent.id = parentId;
        await persistParent();
      }

      for (const child of children) {
        if (child.done) continue;

        let studentId = child.studentId;
        if (studentId == null) {
          const student = await createStudent({
            firstName: child.firstName, lastName: child.lastName, gender: child.gender,
            birthDate: child.birthDate, address: child.address,
            originSchool: child.originSchool, previousClass: child.previousClass,
            idempotencyKey: `${row.id}:${child.key}`,
          });
          studentId = student.id;
          child.studentId = studentId;
          await persistChildren();
        }

        if (!child.parentLinked) {
          await linkParentToStudent(parentId, studentId, child.relationship);
          child.parentLinked = true;
          await persistChildren();
        }

        if (!child.enrolled) {
          await enroll({
            studentId, classId: child.classId, academicYearId: row.annee_scolaire_id,
            type: child.enrollmentType, monthlyPaymentOptIn: child.monthlyPaymentOptIn,
          });
          child.enrolled = true;
          await persistChildren();
        }

        if (child.exemption && !child.exemptionApplied) {
          try {
            await grantExemption({
              studentId, type: child.exemption.type, percentage: child.exemption.percentage,
              amount: child.exemption.amount, feeTypes: child.exemption.feeTypes,
              reason: child.exemption.reason, staffBenefit: child.exemption.staffBenefit,
            });
            child.exemptionApplied = true;
            await persistChildren();
          } catch { /* non bloquant, comme en ligne */ }
        }

        if (!child.feesGenerated) {
          try {
            await generateAllForEnrollment({
              studentId, classId: child.classId, academicYearId: row.annee_scolaire_id,
              enrollmentType: child.enrollmentType, wantsTransport: false, transportFeeId: null,
            });
            child.feesGenerated = true;
            await persistChildren();
          } catch { /* non bloquant, comme en ligne */ }
        }

        child.done = true;
        await persistChildren();
      }

      await db.execute("UPDATE inscriptions_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE inscriptions_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
