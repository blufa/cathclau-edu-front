import { useNetworkStore } from "./network-store";
import { pullReferenceData } from "./desktop-reference-sync";
import { pushOfflineEncaissements } from "./desktop-payments";
import { pushOfflinePresences } from "./desktop-attendance";
import { pushOfflineLessons } from "./desktop-lessons";
import { pushOfflineSchedules } from "./desktop-schedule";
import { pushOfflineClasses } from "./desktop-classes";
import { pushOfflineAssessments } from "./desktop-assessments";
import { pushOfflineExpenses } from "./desktop-expenses";
import { pushOfflineGrades } from "./desktop-grades";
import { pushOfflineCashierSessions } from "./desktop-cashier";
import { pushOfflineEnrollments } from "./desktop-enrollment";

/** Contexte résolu au moment de synchroniser — jamais figé au démarrage : un caissier peut rester
 * connecté plusieurs jours, l'année scolaire courante doit rester à jour sans redémarrer l'appli. */
export type DesktopSyncContext = { tenantId: number; academicYearId: number } | null;

let wired = false;
let syncing = false;
let lastGetContext: (() => DesktopSyncContext) | null = null;

async function runSync(getContext: () => DesktopSyncContext): Promise<void> {
  if (syncing || !useNetworkStore.getState().online) return;
  const ctx = getContext();
  if (!ctx) return;
  syncing = true;
  try {
    // Caisse d'abord (ouvrir la session avant que les encaissements qu'elle couvre ne soient rejoués),
    // puis inscriptions (un élève doit exister côté serveur avant tout le reste), puis les autres
    // files d'attente — argent et présences avant le confort (cahier de texte, emploi du temps,
    // notes, dépenses) — et enfin le référentiel, pour repartir avec un miroir à jour. Les notes
    // sont rejouées après les évaluations : une évaluation doit exister côté serveur avant de
    // rejouer les notes qui s'y rattachent (même logique qu'inscriptions → encaissements).
    await pushOfflineCashierSessions();
    await pushOfflineEnrollments();
    await pushOfflineEncaissements();
    await pushOfflinePresences();
    await pushOfflineLessons();
    await pushOfflineSchedules();
    await pushOfflineClasses();
    await pushOfflineAssessments();
    await pushOfflineExpenses();
    await pushOfflineGrades();
    await pullReferenceData(ctx.tenantId, ctx.academicYearId);
  } finally {
    syncing = false;
  }
}

/**
 * Branche la synchronisation desktop : au retour du réseau, au démarrage (si déjà en ligne), et par
 * sécurité toutes les 15 minutes tant que l'appli reste ouverte (l'événement navigateur `online` n'est
 * pas toujours fiable — voir `network-store.ts`). Couvre de fait la "synchro du soir" demandée : dès que
 * la connexion internet de l'école redevient disponible, généralement en fin de journée, la file part
 * immédiatement plutôt que d'attendre une heure fixe.
 *
 * `getContext` est appelé à chaque synchronisation (jamais mémorisé) : à brancher sur le tenant/année
 * scolaire courante de l'utilisateur connecté (ex. depuis le provider d'authentification), pas sur une
 * valeur figée au montage.
 */
export function wireDesktopSyncTriggers(getContext: () => DesktopSyncContext): void {
  lastGetContext = getContext;
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("online", () => void runSync(getContext));
  void runSync(getContext);
  setInterval(() => void runSync(getContext), 15 * 60 * 1000);
}

/** Relance immédiate (bouton "Réessayer" du bandeau desktop, voir `desktop-offline-banner.tsx`) —
 * ne fait rien si la synchro n'a jamais été branchée (`DesktopSyncBootstrap` pas encore monté). */
export function triggerDesktopSyncNow(): void {
  if (lastGetContext) void runSync(lastGetContext);
}
