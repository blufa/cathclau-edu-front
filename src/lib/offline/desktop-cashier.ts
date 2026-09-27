import { openCashierSession, closeCashierSession } from "@/lib/api/payment";
import { getDesktopDb } from "./desktop-db";

interface OfflineCashierSessionRow {
  id: string;
  id_serveur: number | null;
  ouverte_le: string;
  fermee_le: string | null;
  comptage_physique: number | null;
  notes: string | null;
}

export interface PendingOfflineSession { id: string; openedAt: string }

/** Session ouverte localement mais pas encore confirmée côté serveur (hors ligne depuis l'ouverture) —
 * permet à l'écran d'afficher "caisse ouverte" même sans réseau, avant toute synchronisation. `null` si
 * aucune (soit pas de session en cours, soit une session déjà confirmée en ligne). */
export async function getPendingOfflineOpenSession(): Promise<PendingOfflineSession | null> {
  const db = await getDesktopDb();
  const rows = await db.select<{ id: string; ouverte_le: string }[]>(
    "SELECT id, ouverte_le FROM caisse_sessions_offline WHERE fermee_le IS NULL AND synced = 0 ORDER BY ouverte_le DESC LIMIT 1",
  );
  return rows[0] ? { id: rows[0].id, openedAt: rows[0].ouverte_le } : null;
}

/** Total encaissé (provisoire, cette machine seulement) depuis l'ouverture d'une session encore
 * locale — mêmes limites que `total_systeme_provisoire` (voir commentaire de `closeOfflineCashierSession`).
 * Ne compte que le canal CASH, exactement comme `CashierSessionService.computeSystemTotal` côté serveur
 * (Orange Money/carte encaissés hors ligne ne font pas partie du rapprochement de caisse ESPÈCES). */
export async function getOfflineRunningTotal(localId: string): Promise<number> {
  const db = await getDesktopDb();
  const rows = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(montant), 0) AS total FROM encaissements_offline
     WHERE mode_paiement = 'CASH'
       AND date_paiement >= (SELECT ouverte_le FROM caisse_sessions_offline WHERE id = $1)`,
    [localId],
  );
  return rows[0]?.total ?? 0;
}

/** Ouvre une caisse hors ligne — l'horodatage réel d'ouverture côté serveur sera celui de la
 * synchronisation (même limitation acceptée que pour un scan de présence, voir `desktop-attendance.ts`) :
 * ce qui compte est de ne jamais bloquer le premier encaissement du matin faute de réseau. */
export async function openOfflineCashierSession(etablissementId: number): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO caisse_sessions_offline (id, etablissement_id, ouverte_le, synced)
     VALUES ($1, $2, $3, 0)`,
    [id, etablissementId, new Date().toISOString()],
  );
  return id;
}

/**
 * Demande la clôture — `total_systeme_provisoire` est calculé LOCALEMENT (somme des encaissements
 * CASH de cette machine sur la période, synchronisés ou non — même filtre canal que le serveur, voir
 * {@link getOfflineRunningTotal}) : un chiffre indicatif pour que le caissier puisse quand même compter
 * sa caisse le soir sans réseau, JAMAIS le total officiel. Le vrai rapprochement (`Payment.systemTotal`
 * côté serveur, qui voit TOUS les encaissements de la session, y compris ceux saisis depuis un autre
 * poste) n'a lieu qu'à la synchronisation réelle.
 */
export async function closeOfflineCashierSession(
  localId: string, physicalCount: number, notes?: string,
): Promise<void> {
  const db = await getDesktopDb();
  const [{ total } = { total: 0 }] = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(montant), 0) AS total FROM encaissements_offline
     WHERE mode_paiement = 'CASH'
       AND date_paiement >= (SELECT ouverte_le FROM caisse_sessions_offline WHERE id = $1)`,
    [localId],
  );
  await db.execute(
    `UPDATE caisse_sessions_offline
     SET fermee_le = $1, comptage_physique = $2, notes = $3, total_systeme_provisoire = $4, synced = 0
     WHERE id = $5`,
    [new Date().toISOString(), physicalCount, notes ?? null, total, localId],
  );
}

/**
 * Cas inverse d'{@link openOfflineCashierSession} : la session avait été ouverte EN LIGNE (le serveur
 * la connaît déjà, `serverSessionId` réel), mais sa CLÔTURE échoue faute de réseau en fin de journée.
 * Réutilise la même table (`id_serveur` déjà connu) : {@link pushOfflineCashierSessions} saute alors
 * l'étape d'ouverture (déjà faite) et ne rejoue que la clôture. `openedAt` doit être l'heure
 * d'ouverture réelle de la session serveur — nécessaire au calcul du total provisoire local. */
export async function queueOfflineCashierClose(
  etablissementId: number, serverSessionId: number, openedAt: string, physicalCount: number, notes?: string,
): Promise<void> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  const [{ total } = { total: 0 }] = await db.select<{ total: number }[]>(
    "SELECT COALESCE(SUM(montant), 0) AS total FROM encaissements_offline WHERE mode_paiement = 'CASH' AND date_paiement >= $1",
    [openedAt],
  );
  await db.execute(
    `INSERT INTO caisse_sessions_offline
       (id, etablissement_id, id_serveur, ouverte_le, fermee_le, comptage_physique, notes, total_systeme_provisoire, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
    [id, etablissementId, serverSessionId, openedAt, new Date().toISOString(), physicalCount, notes ?? null, total],
  );
}

/** Rejoue les sessions de caisse : ouvre d'abord celles jamais transmises au serveur, puis ferme
 * celles marquées comme fermées localement une fois leur ouverture confirmée en ligne — dans cet
 * ordre précis, jamais l'inverse (fermer une session qui n'existe pas encore côté serveur échouerait). */
export async function pushOfflineCashierSessions(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineCashierSessionRow[]>(
    "SELECT * FROM caisse_sessions_offline WHERE synced = 0 ORDER BY ouverte_le ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      let serverId = row.id_serveur;
      if (serverId == null) {
        const opened = await openCashierSession();
        serverId = opened.id;
        await db.execute("UPDATE caisse_sessions_offline SET id_serveur = $1 WHERE id = $2", [serverId, row.id]);
      }
      if (row.fermee_le != null) {
        await closeCashierSession(serverId, row.comptage_physique ?? 0, row.notes ?? undefined);
      }
      await db.execute("UPDATE caisse_sessions_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE caisse_sessions_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}
