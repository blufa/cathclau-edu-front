import type { SchoolProfile } from "@/lib/api/platform";

/**
 * En-tête officiel (logo + nom de l'établissement + adresse + contact), pour les documents imprimés
 * générés entièrement côté client (`printHtmlDocument`, voir `lib/print-node.ts`) — emploi du temps,
 * etc. — qui n'avaient jusqu'ici qu'un simple titre, contrairement aux documents PDF générés côté
 * serveur (reçus, bulletins...), qui portent tous cet en-tête (voir `SchoolPdfHeader` côté backend).
 * Volontairement plus sobre que l'en-tête PDF complet (sans bloc ministère/République) : ces
 * documents sont des plannings/listes de travail internes, pas des pièces administratives officielles.
 */
export function officialPrintHeaderHtml(profile: SchoolProfile | null | undefined): string {
  if (!profile) return "";
  const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c] ?? c));
  const address = [profile.address, profile.city, profile.country].filter(Boolean).join(" · ");
  const contact = [profile.phone, profile.phone2].filter(Boolean).join(" / ");
  return `<div class="print-header">`
    + (profile.logo ? `<img src="${esc(profile.logo)}" alt="" class="print-header-logo" />` : "")
    + `<div class="print-header-text">`
    + `<div class="print-header-name">${esc(profile.schoolName)}</div>`
    + (address ? `<div class="print-header-sub">${esc(address)}</div>` : "")
    + (contact ? `<div class="print-header-sub">Tél : ${esc(contact)}</div>` : "")
    + `</div></div>`;
}

export const PRINT_HEADER_CSS = `
  .print-header{display:flex;align-items:center;gap:12px;border-bottom:2px solid #0d9488;padding-bottom:10px;margin-bottom:14px}
  .print-header-logo{height:48px;width:48px;object-fit:contain}
  .print-header-name{font-size:15px;font-weight:700;color:#0f172a}
  .print-header-sub{font-size:10.5px;color:#64748b}
`;
