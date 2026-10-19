import type { SchoolProfile } from "@/lib/api/platform";

/**
 * Impression de l'emploi du temps (classe ou professeur) — reproduit fidèlement la maquette de
 * référence (§document-school, "Emploi du temps classe.dc.html" / "Emploi du temps professeur.dc.html") :
 * paysage A4, bandeau tricolore, grille horaire alignée par bandes (comme `TimetableGrid` à l'écran),
 * cellules colorées par matière/classe (couleur dérivée de l'identifiant, stable d'une impression à
 * l'autre), bande "RÉCRÉATION" détectée automatiquement (bande horaire sans aucune séance, tous jours
 * confondus) et légende récapitulant les heures par matière/classe.
 */

const PALETTE: { bg: string; ink: string }[] = [
  { bg: "#E3EEF9", ink: "#1F4E8A" },
  { bg: "#FBEBDD", ink: "#9A4A12" },
  { bg: "#E6F2EC", ink: "#0E4D3A" },
  { bg: "#E4F1F0", ink: "#136B5E" },
  { bg: "#EEF4E0", ink: "#4A6B12" },
  { bg: "#F6E6EC", ink: "#8A2348" },
  { bg: "#F4EEDA", ink: "#7A5A12" },
  { bg: "#EEEAF6", ink: "#503A8A" },
  { bg: "#EFEDE8", ink: "#4A4F5C" },
  { bg: "#FDEAEA", ink: "#A32424" },
];

function colorFor(key: number | string): { bg: string; ink: string } {
  const s = String(key);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function minutesToTime(min: number): string {
  const c = Math.max(0, Math.min(23 * 60 + 59, min));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}h${String(c % 60).padStart(2, "0")}`;
}

const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));

export interface TimetablePrintSlot {
  startTime: string;
  endTime: string;
  title: string;
  subLabel: string | null;
  colorKey: string | number;
}

export interface TimetablePrintPage {
  heading: string;
  kicker: string;
  subheading?: string | null;
  badgeLabel: string;
  badgeValue: string;
  slotsByDayLabel: Record<string, TimetablePrintSlot[]>;
  /** Cadence des bandes horaires pour CETTE page (2h secondaire / 1h ailleurs, voir `isSecondaryCycle`
   * côté appelant) — par page plutôt que globale au document : "Imprimer toutes les classes" mélange
   * des classes de cycles différents dans un même document multi-pages. */
  bandMinutes: number;
}

const DAY_LABELS = ["LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI", "SAMEDI"];

function buildRowsHtml(page: TimetablePrintPage): string {
  const bandMinutes = page.bandMinutes;
  const allSlots = DAY_LABELS.flatMap((d) => page.slotsByDayLabel[d] ?? []);
  if (allSlots.length === 0) {
    return `<div style="padding:8mm;text-align:center;color:#8A7A55;font-size:9pt">Aucune séance programmée.</div>`;
  }
  let rangeStart = Math.min(480, ...allSlots.map((s) => timeToMinutes(s.startTime)));
  let rangeEnd = Math.max(1080, ...allSlots.map((s) => timeToMinutes(s.endTime)));
  rangeStart = Math.floor(rangeStart / bandMinutes) * bandMinutes;
  rangeEnd = Math.ceil(rangeEnd / bandMinutes) * bandMinutes;

  const rows: string[] = [];
  for (let t = rangeStart; t < rangeEnd; t += bandMinutes) {
    const bandStart = t, bandEnd = t + bandMinutes;
    const cellsByDay = DAY_LABELS.map((d) =>
      (page.slotsByDayLabel[d] ?? []).find((s) => timeToMinutes(s.startTime) < bandEnd && timeToMinutes(s.endTime) > bandStart) ?? null,
    );
    const isEmptyBand = cellsByDay.every((c) => c === null);
    if (isEmptyBand) {
      rows.push(
        `<div style="display:grid;grid-template-columns:22mm minmax(0,1fr);gap:1.2mm;flex:none">`
        + `<div style="font-family:'JetBrains Mono',monospace;font-size:7pt;color:#8A7A55;display:flex;align-items:center;justify-content:center">${minutesToTime(bandStart)}</div>`
        + `<div style="border-radius:2mm;background:repeating-linear-gradient(45deg,#F5EEDB 0 2mm,#FBF6EA 2mm 4mm);padding:1.4mm;text-align:center;font-size:7pt;font-weight:700;letter-spacing:.3em;color:#8A6A1F">RÉCRÉATION</div>`
        + `</div>`,
      );
      continue;
    }
    const cellsHtml = cellsByDay.map((c) => {
      if (!c) {
        return `<div style="border-radius:2mm;background:transparent;border:0.3mm dashed #E2DCCD"></div>`;
      }
      const col = colorFor(c.colorKey);
      return `<div style="border-radius:2mm;background:${col.bg};border:0.3mm solid transparent;padding:2mm 2.5mm;display:flex;flex-direction:column;justify-content:center;gap:0.8mm;position:relative;overflow:hidden;box-sizing:border-box">`
        + `<div style="position:absolute;left:0;top:0;bottom:0;width:1mm;background:${col.ink}"></div>`
        + `<div style="font-size:9pt;font-weight:700;color:${col.ink};line-height:1.15">${esc(c.title)}</div>`
        + (c.subLabel ? `<div style="font-size:7pt;color:#5E6B65;line-height:1.2">${esc(c.subLabel)}</div>` : "")
        + `</div>`;
    }).join("");
    rows.push(
      `<div style="display:grid;grid-template-columns:22mm repeat(6,minmax(0,1fr));gap:1.2mm;flex:1;min-height:0">`
      + `<div style="border-radius:2mm;background:#F4F1EA;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5mm;font-family:'JetBrains Mono',monospace">`
      + `<div style="font-size:8.5pt;font-weight:600">${minutesToTime(bandStart)}</div>`
      + `<div style="font-size:7pt;color:#8A7A55">${minutesToTime(bandEnd)}</div></div>`
      + cellsHtml + `</div>`,
    );
  }
  return rows.join("");
}

function buildLegendHtml(page: TimetablePrintPage): string {
  const hours = new Map<string, { label: string; sub: string | null; ink: string; minutes: number }>();
  for (const d of DAY_LABELS) {
    for (const s of page.slotsByDayLabel[d] ?? []) {
      const key = String(s.colorKey);
      const dur = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
      const existing = hours.get(key);
      if (existing) existing.minutes += dur;
      else hours.set(key, { label: s.title, sub: s.subLabel, ink: colorFor(s.colorKey).ink, minutes: dur });
    }
  }
  return [...hours.values()].map((h) =>
    `<div style="display:flex;align-items:center;gap:2mm;font-size:7.5pt;min-width:0">`
    + `<div style="width:3mm;height:3mm;border-radius:0.8mm;background:${h.ink};flex:none"></div>`
    + `<div style="font-weight:700;white-space:nowrap">${esc(h.label)}</div>`
    + (h.sub ? `<div style="color:#5E6B65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(h.sub)}</div>` : "")
    + `<div style="margin-left:auto;font-family:'JetBrains Mono',monospace;font-weight:600;color:#8A7A55">${Math.round(h.minutes / 60)}h</div>`
    + `</div>`,
  ).join("");
}

function pageHtml(profile: SchoolProfile | null | undefined, page: TimetablePrintPage, yearLabel: string | null): string {
  const addressBits = [yearLabel ? `Année scolaire ${yearLabel}` : null, profile?.address, profile?.city]
    .filter(Boolean).join(" · ");
  return `<section class="page" style="display:flex;flex-direction:column;box-sizing:border-box;padding:8mm 10mm 6mm 13mm;background:#FFFDF8;position:relative;gap:3.5mm;font-size:8.5pt">`
    + `<div style="position:absolute;left:0;top:0;bottom:0;width:3mm;display:flex;flex-direction:column">`
    + `<div style="flex:1;background:#CE1126"></div><div style="flex:1;background:#FCD116"></div><div style="flex:1;background:#009460"></div></div>`
    + `<div style="display:flex;justify-content:space-between;align-items:center;gap:6mm">`
    + `<div style="display:flex;gap:3mm;align-items:center">`
    + `<div style="width:15mm;height:15mm;flex:none;border-radius:3mm;border:0.3mm solid #D9D2C0;background:#fff;padding:1.2mm;box-sizing:border-box;display:flex;align-items:center;justify-content:center;overflow:hidden">`
    + (profile?.logo ? `<img src="${esc(profile.logo)}" alt="" style="max-width:100%;max-height:100%;object-fit:contain"/>` : "")
    + `</div>`
    + `<div style="display:flex;flex-direction:column;gap:0.6mm">`
    + `<div style="font-family:'Cormorant Garamond',serif;font-size:15pt;font-weight:700;line-height:1;color:#0E4D3A">${esc(profile?.schoolName ?? "Établissement")}</div>`
    + (addressBits ? `<div style="font-size:7.5pt;color:#5E6B65">${esc(addressBits)}</div>` : "")
    + `</div></div>`
    + `<div style="display:flex;align-items:center;gap:4mm">`
    + `<div style="display:flex;flex-direction:column;align-items:flex-end">`
    + `<div style="font-size:7pt;font-weight:600;letter-spacing:.24em;color:#8A7A55">${esc(page.kicker)}</div>`
    + `<div style="font-family:'Cormorant Garamond',serif;font-size:22pt;font-weight:700;color:#0E4D3A;line-height:1">${esc(page.heading)}</div>`
    + (page.subheading ? `<div style="font-size:8pt;font-weight:600;color:#1F4E8A">${esc(page.subheading)}</div>` : "")
    + `</div>`
    + `<div style="background:#0E4D3A;color:#fff;border-radius:2.5mm;padding:2mm 3.5mm;display:flex;flex-direction:column;align-items:center">`
    + `<div style="font-size:6pt;letter-spacing:.14em;color:#E9D79E">${esc(page.badgeLabel)}</div>`
    + `<div style="font-size:13pt;font-weight:800">${esc(page.badgeValue)}</div></div>`
    + `</div></div>`
    + `<div style="flex:1;display:flex;flex-direction:column;gap:1.2mm;min-height:0">`
    + `<div style="display:grid;grid-template-columns:22mm repeat(6,minmax(0,1fr));gap:1.2mm">`
    + `<div></div>` + DAY_LABELS.map((d) =>
      `<div style="background:#0E4D3A;color:#fff;border-radius:2mm;padding:2mm;text-align:center;font-weight:700;letter-spacing:.12em;font-size:8pt">${d}</div>`,
    ).join("")
    + `</div>` + buildRowsHtml(page) + `</div>`
    + `<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1.5mm 4mm;padding-top:2.5mm;border-top:0.2mm solid #E2DCCD">${buildLegendHtml(page)}</div>`
    + `</section>`;
}

/** Document complet (une ou plusieurs pages, saut de page automatique entre chacune). */
export function buildTimetableDocumentHtml(
  profile: SchoolProfile | null | undefined,
  pages: TimetablePrintPage[],
  yearLabel: string | null,
): string {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Emploi du temps</title>`
    + `<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,600&family=Sora:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">`
    + `<style>@page{size:landscape}body{margin:0;font-family:'Sora',sans-serif;color:#13261F}`
    + `*{-webkit-print-color-adjust:exact;print-color-adjust:exact}`
    + `.page{page-break-after:always}.page:last-child{page-break-after:auto}`
    + `@media print{.page{width:297mm;height:210mm}}@media screen{.page{width:297mm;height:210mm;margin:8px auto;box-shadow:0 1px 4px rgba(0,0,0,.15)}}</style>`
    + `</head><body>${pages.map((p) => pageHtml(profile, p, yearLabel)).join("")}</body></html>`;
}
