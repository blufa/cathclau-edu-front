import { create } from "zustand";

const DISMISSED_KEY = "cathclau.pwa.installBannerDismissedAt";
/** Après un refus de la bannière, on ne la ré-affiche pas avant ce délai. */
const DISMISS_DAYS = 14;

/** Event natif Chrome/Edge/Android — absent du lib.dom.d.ts standard de TypeScript. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaInstallState {
  /** Référence à l'event `beforeinstallprompt` capturé, réutilisable une seule fois (`.prompt()`). */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** true si le navigateur a signalé l'app comme installable (Android/Chrome/Edge). */
  isInstallable: boolean;
  /** true si l'app tourne déjà en mode standalone (déjà installée, sur ce device). */
  isInstalled: boolean;
  /** true sur iOS Safari, où `beforeinstallprompt` n'existe pas (instructions manuelles). */
  isIosSafari: boolean;
  setDeferredPrompt: (event: BeforeInstallPromptEvent | null) => void;
  setInstalled: (installed: boolean) => void;
  setIosSafari: (isIos: boolean) => void;
}

export const usePwaInstallStore = create<PwaInstallState>((set) => ({
  deferredPrompt: null,
  isInstallable: false,
  isInstalled: false,
  isIosSafari: false,
  setDeferredPrompt: (event) => set({ deferredPrompt: event, isInstallable: event !== null }),
  setInstalled: (installed) => set({ isInstalled: installed }),
  setIosSafari: (isIos) => set({ isIosSafari: isIos }),
}));

export function isRunningStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

export function isIosSafariDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

export function hasDismissedBannerRecently(): boolean {
  if (typeof window === "undefined") return true;
  const raw = window.localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  if (Number.isNaN(dismissedAt)) return false;
  const elapsedDays = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
  return elapsedDays < DISMISS_DAYS;
}

export function dismissInstallBanner(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
}
