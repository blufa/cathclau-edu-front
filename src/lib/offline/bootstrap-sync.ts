import { offlineDb } from "./db";
import {
  getScheduleByClass,
  getScheduleByTeacher,
  listAcademicYears,
  listClasses,
  listClassSubjects,
  listLevels,
  listRooms,
  listSubjects,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { listRoutes } from "@/lib/api/transport";
import { listFeesByTenant } from "@/lib/api/billing";
import { listEvents } from "@/lib/api/calendar";

async function cachePut(key: string, payload: unknown): Promise<void> {
  await offlineDb.readCache.put({ key, payload, updatedAt: new Date().toISOString() });
}

/** Isole chaque étape : une permission refusée pour ce rôle ou un réseau coupé en cours de route ne
 * doit jamais empêcher les autres étapes de mettre à jour leur part du cache — un cache partiel vaut
 * mieux qu'aucun cache. */
async function safe(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch {
    // ignoré : voir commentaire ci-dessus.
  }
}

let running = false;

/**
 * Précharge dans le cache local (IndexedDB, `readCache`) toute la configuration de l'école — classes,
 * frais scolaires, emploi du temps (par classe et par enseignant), matières affectées par classe,
 * matières, niveaux, salles, années scolaires, enseignants, trajets transport, événements du calendrier
 * — pour que les écrans qui EN DÉPENDENT (programmation de séance, pointage, inscription, frais...)
 * restent utilisables une fois la connexion coupée, sans exiger que l'agent ait déjà visité chacun de
 * ces écrans en ligne au préalable (le cache `readCache` existant, lui, ne se remplissait qu'à la visite
 * d'un écran — voir `use-cached-query.ts`). Les clés utilisées sont EXACTEMENT celles déjà lues par les
 * écrans concernés (ex. `academic-years`, `subjects:${tenantId}`) : ce bootstrap ne fait qu'anticiper
 * leur remplissage, il n'introduit pas un second cache parallèle.
 *
 * Appelé après connexion réussie (voir `auth-provider.tsx`) et à chaque retour de réseau (utile pour le
 * cycle « je me connecte le soir pour synchroniser » décrit par la direction) — jamais bloquant : toute
 * la fonction est fire-and-forget côté appelant.
 */
export async function runConfigBootstrap(tenantId: number): Promise<void> {
  if (running) return;
  running = true;
  try {
    let years: { id: number }[] = [];
    await safe(async () => {
      years = await listAcademicYears();
      await cachePut("academic-years", years);
    });

    let teacherIds: number[] = [];
    await Promise.all([
      safe(async () => {
        const teachers = await listTeachers();
        teacherIds = teachers.map((t) => t.id);
        await cachePut(`teachers-all:${tenantId}`, teachers);
      }),
      safe(async () => cachePut(`subjects:${tenantId}`, await listSubjects())),
      safe(async () => cachePut(`rooms:${tenantId}`, await listRooms())),
      safe(async () => cachePut(`levels:${tenantId}`, await listLevels())),
      safe(async () => cachePut(`routes:${tenantId}`, await listRoutes())),
      safe(async () => cachePut(`fees:${tenantId}`, await listFeesByTenant(tenantId))),
    ]);

    // Classes + emploi du temps + matières affectées : par année, puis par classe (dépend des années).
    await Promise.all(
      years.map((year) =>
        safe(async () => {
          const classes = await listClasses(year.id);
          await cachePut(`classes:${year.id}`, classes);
          await cachePut(`events:${year.id}`, await listEvents(year.id).catch(() => []));
          await Promise.all(
            classes.map((c) =>
              Promise.all([
                safe(async () => cachePut(`schedule-class:${c.id}`, await getScheduleByClass(c.id))),
                safe(async () => cachePut(`class-subjects:${c.id}`, await listClassSubjects(c.id))),
              ]),
            ),
          );
        }),
      ),
    );

    await Promise.all(
      teacherIds.map((id) =>
        safe(async () => cachePut(`schedule-teacher:${id}`, await getScheduleByTeacher(id))),
      ),
    );
  } finally {
    running = false;
  }
}
