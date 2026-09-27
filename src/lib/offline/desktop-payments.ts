import { initiateGroupPayment } from "@/lib/api/payment";
import type { PaymentChannel } from "@/lib/types/payment";
import { getDesktopDb } from "./desktop-db";

export interface QueueOfflineEncaissementInput {
  etablissementId: number;
  eleveId: number;
  /** Facture ciblée (voir table `factures`, alimentée par `pullReferenceData`) — sans elle, impossible
   * de rejouer le paiement plus tard (le backend exige une `invoiceId` par part, voir `GroupPaymentInput.shares`). */
  factureId: number;
  montant: number;
  modePaiement: Extract<PaymentChannel, "CASH" | "ORANGE_MONEY" | "BANK_CARD">;
  collecteParUserId: number | null;
  /** Date/heure réelle de l'encaissement (celle vue par le caissier), pas celle de la synchronisation. */
  datePaiement: string;
}

interface OfflineEncaissementRow {
  id: string;
  etablissement_id: number;
  eleve_id: number;
  facture_id: number | null;
  montant: number;
  date_paiement: string;
  mode_paiement: string;
  collecte_par_user_id: number | null;
  synced: number;
  tentatives: number;
}

/** Enregistre un encaissement dans la base locale — jamais un appel réseau direct : c'est
 * `pushOfflineEncaissements()` (déclenché au retour du réseau, voir `desktop-sync.ts`) qui se charge de
 * l'envoyer au serveur, que la machine ait été en ligne ou non au moment de la saisie. */
export async function queueOfflineEncaissement(input: QueueOfflineEncaissementInput): Promise<string> {
  const db = await getDesktopDb();
  const id = crypto.randomUUID();
  await db.execute(
    `INSERT INTO encaissements_offline
       (id, etablissement_id, eleve_id, facture_id, montant, date_paiement, mode_paiement, collecte_par_user_id, synced)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)`,
    [
      id, input.etablissementId, input.eleveId, input.factureId, input.montant,
      input.datePaiement, input.modePaiement, input.collecteParUserId,
    ],
  );
  return id;
}

/** Rejoue vers l'API Java tous les encaissements pas encore synchronisés. Réutilise directement
 * `initiateGroupPayment` (le même endpoint que la saisie en ligne) avec `idempotencyKey = id local` :
 * si l'appel avait déjà réussi lors d'une tentative précédente (coupure juste après la réponse serveur,
 * par ex.), le serveur renvoie le paiement déjà créé au lieu d'en créer un second — voir
 * `GroupPaymentInput.idempotencyKey` côté client et son usage identique dans `sync-engine.ts` (web). */
export async function pushOfflineEncaissements(): Promise<{ synced: number; failed: number }> {
  const db = await getDesktopDb();
  const rows = await db.select<OfflineEncaissementRow[]>(
    "SELECT * FROM encaissements_offline WHERE synced = 0 ORDER BY date_paiement ASC",
  );

  let synced = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await initiateGroupPayment({
        tenantId: row.etablissement_id,
        studentId: row.eleve_id,
        channel: row.mode_paiement as PaymentChannel,
        coverageLabel: "Encaissement hors ligne",
        monthsCount: 1,
        remainingAfter: 0,
        shares: row.facture_id != null ? [{ invoiceId: row.facture_id, amount: row.montant }] : [],
        idempotencyKey: row.id,
        // Sans ces deux champs, le serveur attribuait l'encaissement à qui synchronise (pas forcément
        // qui a physiquement encaissé) et à l'heure de la synchro (pas celle de l'encaissement réel) —
        // §retour comptable : SMS de confirmation à la mauvaise personne, reçu/rapports de caisse datés
        // du mauvais jour.
        collectedByUserId: row.collecte_par_user_id,
        paidAt: row.date_paiement,
      });
      await db.execute("UPDATE encaissements_offline SET synced = 1 WHERE id = $1", [row.id]);
      synced++;
    } catch (err) {
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      await db.execute(
        "UPDATE encaissements_offline SET tentatives = tentatives + 1, derniere_erreur = $1 WHERE id = $2",
        [message, row.id],
      );
    }
  }
  return { synced, failed };
}

/** Encaissements en attente (pour un badge "N à synchroniser" dans l'UI desktop) — inclut ceux déjà
 * en échec (`tentatives > 0`), qui restent comptés tant qu'ils ne sont pas réglés manuellement. */
export async function countPendingOfflineEncaissements(): Promise<number> {
  const db = await getDesktopDb();
  const rows = await db.select<{ n: number }[]>(
    "SELECT COUNT(*) AS n FROM encaissements_offline WHERE synced = 0",
  );
  return rows[0]?.n ?? 0;
}
