"use client";

import { useState } from "react";
import { Stack, Textarea } from "@mantine/core";
import { FileSignature } from "lucide-react";
import { useBranding } from "@/providers/branding-provider";
import { generateTransferCertificate } from "@/lib/api/students";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { FilePreview } from "@/components/ui/file-preview";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Generates and previews the school-leaving / transfer certificate (PDF) for a student. */
export function CertificateAction({ studentId }: { studentId: number }) {
  const schoolName = useBranding().branding?.schoolName ?? undefined;
  const [open, setOpen] = useState(false);
  const [motif, setMotif] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    try {
      const { url } = await generateTransferCertificate(studentId, { schoolName, motif: motif || undefined });
      setPdfUrl(url);
      setOpen(false);
      notifySuccess("Certificat généré");
    } catch (e) {
      notifyError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} leftSection={<FileSignature className="h-4 w-4" />}>
        Certificat de radiation / transfert
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Certificat de radiation / transfert">
        <Stack gap="md">
          <p className="text-sm text-slate-500">
            Génère le certificat officiel (PDF) attestant que l&apos;élève quitte l&apos;établissement, à remettre à l&apos;école d&apos;accueil.
          </p>
          <Textarea label="Motif (optionnel)" placeholder="Transfert vers un autre établissement, déménagement…" autosize minRows={2} value={motif} onChange={(e) => setMotif(e.currentTarget.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={generate} loading={busy} leftSection={<FileSignature className="h-4 w-4" />}>Générer</Button>
          </div>
        </Stack>
      </Modal>

      <FilePreview open={!!pdfUrl} onClose={() => setPdfUrl(null)} url={pdfUrl} title="Certificat de radiation / transfert" />
    </>
  );
}
