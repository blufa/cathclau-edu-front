"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { useCashierSessionGate } from "@/hooks/use-cashier-session-gate";
import { openCashierSession } from "@/lib/api/payment";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { useRouter } from "next/navigation";

/** Une seule fois par connexion (pas à chaque navigation) — la session se rouvrirait sinon après
 * chaque "Plus tard" dès qu'on change de page, puisque AppShell reste monté mais ce composant est
 * réévalué à chaque changement de sessionOpen/loading. */
const DISMISS_KEY = "cashier-session-reminder-dismissed";

/**
 * Rappel automatique à la connexion (§angles morts comptables, demande utilisateur) : un comptable/
 * caissier qui se connecte sans avoir encore ouvert sa caisse aujourd'hui reçoit une popup l'invitant
 * à le faire immédiatement, plutôt que de le découvrir seulement en butant sur un bouton désactivé
 * plus tard dans sa journée.
 */
export function CashierSessionReminderModal() {
  const { user } = useAuth();
  const router = useRouter();
  const { sessionOpen, loading, refetch } = useCashierSessionGate();
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);

  // SUPER_ADMIN a toutes les permissions même hors impersonation (aucune école choisie, "Plateforme")
  // — sans tenantId effectif, "ouvrir ma caisse" n'aurait aucune école à qui rattacher la session, le
  // rappel n'a donc de sens que dans le contexte d'une école (personnel normal, ou SUPER_ADMIN qui
  // impersonne une école précise — voir auth-provider.tsx, tenantId = impersonatedTenantId alors).
  const canCollectCash = user?.tenantId != null && hasAnyPermission(user, ["paiement:create", "depense:create"]);

  // Lu une seule fois côté client, pendant le rendu (pas dans un Effect, voir react.dev/learn/
  // you-might-not-need-an-effect) — le rendu serveur initial (sans window) et la première passe
  // client avant hydratation donnent le même résultat (bloc ignoré), donc aucune divergence.
  const [checkedStorage, setCheckedStorage] = useState(false);
  if (!checkedStorage && typeof window !== "undefined") {
    setCheckedStorage(true);
    if (sessionStorage.getItem(DISMISS_KEY) === "1") setDismissed(true);
  }

  const open = canCollectCash && !loading && !sessionOpen && !dismissed;

  function dismiss() {
    sessionStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  async function openNow() {
    setOpening(true);
    try {
      await openCashierSession();
      notifySuccess("Caisse ouverte");
      dismiss();
      refetch();
      router.refresh();
    } catch (err) {
      notifyError(err);
    } finally {
      setOpening(false);
    }
  }

  return (
    <Modal open={open} onClose={dismiss} title="Caisse fermée">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Vous n&apos;avez pas encore ouvert votre session de caisse. Tant qu&apos;elle n&apos;est
            pas ouverte, l&apos;encaissement au guichet, les dépenses et les inscriptions/réinscriptions
            restent désactivés.
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={dismiss}>Plus tard</Button>
          <Button type="button" onClick={openNow} loading={opening}>Ouvrir ma caisse</Button>
        </div>
      </div>
    </Modal>
  );
}
