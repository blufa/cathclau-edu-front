"use client";

import { useState } from "react";
import { IdCard, Printer } from "lucide-react";
import { generateBadge, type BadgeResult } from "@/lib/api/biometric";
import type { BiometricSubjectType } from "@/lib/types/biometric";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { notifyError, notifySuccess } from "@/lib/feedback";

function qrUrl(data: string, size = 220) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

/**
 * Émission de badge en un clic depuis une liste (classe, élèves…) : plus besoin d'aller sur l'onglet
 * Badges, chercher la personne par son nom, puis émettre — le sujet est déjà connu depuis la ligne.
 */
export function QuickBadgeButton({ subjectType, subjectId, subjectName, size = "sm" }: {
  subjectType: BiometricSubjectType; subjectId: number; subjectName: string; size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [badge, setBadge] = useState<BadgeResult | null>(null);
  const [loading, setLoading] = useState(false);

  function openModal() {
    setBadge(null);
    setOpen(true);
  }

  async function generate() {
    setLoading(true);
    try {
      const b = await generateBadge(subjectType, subjectId);
      setBadge(b);
      notifySuccess("Badge généré — la personne est enrôlée");
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  function printBadge() {
    if (!badge) return;
    const w = window.open("", "_blank", "width=420,height=560");
    if (!w) { notifyError("Autorisez les pop-ups pour imprimer."); return; }
    w.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Badge</title>`
      + `<style>body{font-family:system-ui,Arial,sans-serif;display:flex;justify-content:center;padding:24px}`
      + `.b{width:320px;border:1px solid #cbd5e1;border-radius:16px;padding:18px;text-align:center}`
      + `.t{font-weight:800;letter-spacing:2px;color:#1d4ed8}.n{margin:8px 0;font-size:16px;font-weight:600}`
      + `.id{font-size:11px;color:#64748b;margin-top:8px}@media print{body{padding:0}}</style></head><body>`
      + `<div class="b"><div class="t">BADGE</div><div class="n">${subjectName}</div>`
      + `<img src="${qrUrl(badge.qrPayload, 200)}" width="190" height="190" alt="QR"/>`
      + `<div class="id">${badge.externalUserId}</div></div>`
      + `<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`,
    );
    w.document.close();
  }

  return (
    <>
      <Button size={size} variant="ghost" leftSection={<IdCard className="h-4 w-4" />} onClick={openModal}>
        Badge
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Badge — ${subjectName}`}>
        {!badge ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-500">Émettre immédiatement le badge QR de {subjectName}. La personne sera enrôlée automatiquement.</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
              <Button onClick={generate} loading={loading}>Émettre le badge</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-[280px] rounded-2xl border border-gray-200 p-4 text-center">
              <div className="text-sm font-extrabold tracking-widest text-brand-700">BADGE</div>
              <div className="mt-1 text-base font-semibold text-gray-900">{subjectName}</div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl(badge.qrPayload)} alt="QR badge" width={180} height={180} className="mx-auto my-2" />
              <div className="text-xs text-gray-400">{badge.externalUserId}</div>
            </div>
            <div className="flex justify-center">
              <Button variant="secondary" leftSection={<Printer className="h-4 w-4" />} onClick={printBadge}>Imprimer le badge</Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
