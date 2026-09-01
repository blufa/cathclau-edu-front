"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@/hooks/use-query";
import { archivePrefecture, createPrefecture, listPrefectures, reactivatePrefecture } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import type { Prefecture, PrefectureType } from "@/lib/types/platform";

export default function PlatformPrefecturesPage() {
  return (
    <RequireSuperAdmin>
      <PrefecturesTable />
    </RequireSuperAdmin>
  );
}

const schema = z.object({
  nom: z.string().trim().min(1, "Requis"),
  type: z.enum(["DPE", "DCE"]),
  region: z.string().trim().optional(),
});
type FormValues = z.infer<typeof schema>;

function PrefecturesTable() {
  const { data, loading, refetch } = useQuery(() => listPrefectures(), []);
  const [creating, setCreating] = useState(false);

  function archive(p: Prefecture) {
    confirmAction({
      title: "Archiver la préfecture/commune",
      message: `Archiver « ${p.nom} » ? Les écoles déjà rattachées le restent, mais elle ne pourra plus recevoir de nouvelles écoles ni de comptes DPE_ADMIN.`,
      confirmLabel: "Archiver",
      danger: true,
      onConfirm: async () => {
        try { await archivePrefecture(p.id); notifySuccess("Préfecture archivée"); refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  async function reactivate(p: Prefecture) {
    try { await reactivatePrefecture(p.id); notifySuccess("Préfecture réactivée"); refetch(); }
    catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Préfectures / Communes (DPE-DCE)</h1>
          <p className="text-sm text-gray-500">
            Périmètres de supervision pour les partenariats DPE (préfecture) et DCE (commune) — rattachez
            des écoles et des comptes DPE_ADMIN depuis la fiche de chaque préfecture.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Ajouter</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : (
        <Table>
          <THead>
            <TR><TH>Nom</TH><TH>Type</TH><TH>Région</TH><TH>Statut</TH><TH /></TR>
          </THead>
          <TBody>
            {(data ?? []).map((p) => (
              <TR key={p.id}>
                <TD className="font-medium">
                  <Link href={`/platform/prefectures/${p.id}`} className="text-brand-600 hover:underline">{p.nom}</Link>
                </TD>
                <TD>{p.type}</TD>
                <TD>{p.region ?? "—"}</TD>
                <TD><Badge tone={p.statut === "ACTIVE" ? "green" : "gray"}>{p.statut === "ACTIVE" ? "Active" : "Archivée"}</Badge></TD>
                <TD>
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="secondary" component={Link} href={`/dpe/dashboard?prefectureId=${p.id}`}>
                      Aperçu
                    </Button>
                    {p.statut === "ACTIVE" ? (
                      <Button size="sm" variant="secondary" onClick={() => archive(p)}>Archiver</Button>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => reactivate(p)}>Réactiver</Button>
                    )}
                  </div>
                </TD>
              </TR>
            ))}
            {!loading && (data ?? []).length === 0 && (
              <TR><TD colSpan={5} className="text-gray-400">Aucune préfecture/commune créée pour l&apos;instant.</TD></TR>
            )}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Ajouter une préfecture / commune">
        <CreatePrefectureForm onDone={() => { setCreating(false); refetch(); }} onCancel={() => setCreating(false)} />
      </Modal>
    </div>
  );
}

function CreatePrefectureForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nom: "", type: "DPE" as PrefectureType, region: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const type = watch("type");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      await createPrefecture({
        nom: values.nom,
        type: values.type,
        region: values.region || null,
        pays: "Guinée",
        latitude: null,
        longitude: null,
      });
      notifySuccess("Préfecture créée");
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Field>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setValue("type", e.target.value as PrefectureType)}>
          <option value="DPE">DPE — Direction Préfectorale de l&apos;Éducation</option>
          <option value="DCE">DCE — Direction Communale de l&apos;Éducation</option>
        </Select>
      </Field>
      <Field>
        <Label>Nom {type === "DPE" ? "de la préfecture" : "de la commune"} <span className="text-error-500">*</span></Label>
        <Input placeholder={type === "DPE" ? "ex. Coyah" : "ex. Matam"} {...register("nom")} aria-invalid={!!errors.nom} />
        {errors.nom && <p className="text-xs text-error-600">{errors.nom.message}</p>}
      </Field>
      <Field>
        <Label>Région (optionnel)</Label>
        <Input placeholder="ex. Kindia" {...register("region")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Créer</Button>
      </div>
    </form>
  );
}
