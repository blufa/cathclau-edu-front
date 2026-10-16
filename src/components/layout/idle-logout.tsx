"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { useIdleTimer } from "@/hooks/use-idle-timer";
import { notifyError, notifyInfo } from "@/lib/feedback";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * Déconnexion automatique après 15 min sans activité (souris/clavier/défilement/tactile) — §retour
 * utilisateur : un compte resté ouvert longtemps sans qu'on y touche peut accumuler un état front
 * périmé (jeton proche de l'expiration, données en cache obsolètes) qui se manifeste par des écrans
 * qui semblent "ne rien charger" ; se reconnecter repart d'un état propre. Monté une seule fois dans
 * AppShell (donc uniquement sur les pages authentifiées, jamais sur /login).
 */
export function IdleLogout() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleIdle = useCallback(() => {
    void (async () => {
      // La redirection vers /login ne doit jamais dépendre du réseau (§retour utilisateur, mobile en
      // connexion instable) : logout() est déjà défensif côté client (authService.logout() avale
      // l'échec de révocation serveur et vide le token local dans tous les cas), mais on s'assure ici
      // qu'un incident imprévu ne laisse jamais quelqu'un bloqué sur l'écran courant au lieu de /login.
      try {
        await logout();
        notifyInfo("Vous avez été déconnecté après 15 minutes sans activité — reconnectez-vous pour continuer.", "Déconnecté pour inactivité");
      } catch (err) {
        notifyError(err, "Déconnexion automatique impossible");
      } finally {
        router.replace("/login");
      }
    })();
  }, [logout, router]);

  useIdleTimer(IDLE_TIMEOUT_MS, handleIdle, !!user);

  return null;
}
