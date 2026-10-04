"use client";

import { useEffect, useState } from "react";
import { WifiOff, RefreshCw, AlertTriangle, X } from "lucide-react";
import { useNetworkStore } from "@/lib/offline/network-store";
import { isDesktop } from "@/lib/offline/desktop-runtime";
import { getDesktopQueueStatus, discardDesktopQueueItem, type DesktopQueueItem } from "@/lib/offline/desktop-queue-status";
import { triggerDesktopSyncNow } from "@/lib/offline/desktop-sync";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

/**
 * Équivalent desktop d'`OfflineBanner` (web/Dexie) : celui-ci ne lisait que les files IndexedDB, donc
 * un échec de synchro SQLite (caisse, séances, dépenses, notes, encaissements, présences,
 * inscriptions) restait invisible sur le poste desktop (§retour fondateurs, gap découvert en
 * préparant l'extension du hors-ligne — voir `desktop-queue-status.ts`). Pas de store Zustand
 * dédié ici : l'état desktop est lu par sondage léger (SQLite n'a pas d'abonnement temps réel côté
 * JS), toutes les 10s et après chaque tentative de synchro.
 */
export function DesktopOfflineBanner() {
  const online = useNetworkStore((s) => s.online);
  const [status, setStatus] = useState<{ pendingCount: number; failedItems: DesktopQueueItem[] } | null>(null);
  const [showFailed, setShowFailed] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!isDesktop()) return;
    let cancelled = false;
    async function refresh() {
      const s = await getDesktopQueueStatus();
      if (!cancelled) setStatus(s);
    }
    void refresh();
    const interval = setInterval(refresh, 10_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  if (!isDesktop() || !status) return null;
  const { pendingCount, failedItems } = status;
  if (online && pendingCount === 0) return null;

  async function retryAll() {
    setSyncing(true);
    triggerDesktopSyncNow();
    // Laisse le temps à la synchro de tourner avant de rafraîchir l'état affiché.
    await new Promise((r) => setTimeout(r, 2000));
    setStatus(await getDesktopQueueStatus());
    setSyncing(false);
  }

  async function discard(item: DesktopQueueItem) {
    await discardDesktopQueueItem(item.table, item.idColumn, item.rowId);
    setStatus(await getDesktopQueueStatus());
  }

  return (
    <>
      <div
        className={
          "mb-4 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium " +
          (!online
            ? "border-warning-200 bg-warning-50 text-warning-800"
            : failedItems.length > 0
              ? "border-error-200 bg-error-50 text-error-800"
              : "border-info-200 bg-info-50 text-info-800")
        }
      >
        <div className="flex items-center gap-2">
          {!online ? (
            <>
              <WifiOff className="h-4 w-4" />
              <span>
                Hors-ligne — caisse, cahier de texte, présences, notes et dépenses continuent de
                fonctionner{pendingCount > 0 ? ` (${pendingCount} en attente de synchronisation)` : ""}.
              </span>
            </>
          ) : syncing || pendingCount > 0 ? (
            <>
              <RefreshCw className={"h-4 w-4" + (syncing ? " animate-spin" : "")} />
              <span>Synchronisation — {pendingCount} en attente.</span>
            </>
          ) : null}
          {failedItems.length > 0 && (
            <>
              <AlertTriangle className="h-4 w-4" />
              <button type="button" className="underline" onClick={() => setShowFailed(true)}>
                {failedItems.length} en échec — voir le détail
              </button>
            </>
          )}
        </div>
        {online && pendingCount > 0 && (
          <Button size="sm" variant="secondary" onClick={() => void retryAll()} loading={syncing}>
            Réessayer maintenant
          </Button>
        )}
      </div>

      <Modal open={showFailed} onClose={() => setShowFailed(false)} title="Éléments en échec (desktop)">
        <div className="space-y-3">
          {failedItems.length === 0 ? (
            <p className="text-sm text-slate-500">Rien en échec.</p>
          ) : (
            failedItems.map((item) => (
              <div key={`${item.table}-${item.rowId}`} className="rounded-lg border border-error-100 bg-error-50/40 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{item.label} · {item.description}</span>
                </div>
                {item.lastError && <p className="mt-1 text-xs text-error-600">{item.lastError}</p>}
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" variant="ghost" leftSection={<X className="h-3.5 w-3.5" />}
                    onClick={() => void discard(item)}>
                    Ignorer
                  </Button>
                  <Button size="sm" onClick={() => void retryAll()}>Réessayer</Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>
    </>
  );
}
