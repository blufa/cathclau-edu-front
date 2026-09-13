/**
 * Retour haptique léger (scan de badge, etc.). Échoue silencieusement là où l'API Vibration
 * n'existe pas (notamment Safari iOS, qui ne la supporte pas) — jamais d'erreur bloquante.
 */
function vibrate(pattern: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(pattern);
  }
}

export function vibrateSuccess(): void {
  vibrate(80);
}

export function vibrateWarning(): void {
  vibrate([60, 60, 60]);
}

export function vibrateError(): void {
  vibrate(200);
}
