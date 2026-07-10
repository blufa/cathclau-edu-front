"use client";

import { useEffect, useState } from "react";
import { Group, Select, Stack, TextInput } from "@mantine/core";
import { Building2, Palette, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useBranding } from "@/providers/branding-provider";
import { hasRole } from "@/lib/auth/permissions";
import { updateTenantBranding } from "@/lib/api/branding";
import { getSchoolProfile, updateSchoolProfile, type SchoolProfile } from "@/lib/api/platform";
import { applyBrandColor } from "@/lib/branding/palette";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Reveal } from "@/components/public/reveal";
import { notifyError, notifySuccess } from "@/lib/feedback";

const PRESETS = ["#14b8a6", "#0ea5e9", "#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#ef4444", "#10b981", "#0f766e", "#1d4ed8"];

// Opérateurs du numéro marchand de reversement (Mobile Money).
const PAYOUT_OPERATORS = [
  { value: "ORANGE_MONEY", label: "Orange Money" },
  { value: "MTN_MONEY", label: "MTN MoMo" },
  { value: "WAVE", label: "Wave" },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const { branding, refresh } = useBranding();
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");
  const canEditInfo = hasRole(user, "SCHOOL_ADMIN");
  const tenantId = user?.tenantId ?? null;

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Paramètres</h1>
        <p className="text-sm text-slate-500">Informations, apparence et identité visuelle de votre établissement</p>
      </Reveal>

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Building2 className="h-4 w-4 text-brand-600" /> Informations de l&apos;établissement
        </h2>
        <p className="mb-4 text-xs text-slate-400">
          Ces informations (adresse, agrément, autorisation d&apos;ouverture, directeur) figurent sur tous
          les documents officiels : reçus, factures, bulletins.
        </p>
        <SchoolInfoForm canEdit={canEditInfo} />
      </div>

      <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Palette className="h-4 w-4 text-brand-600" /> Apparence
        </h2>
        {/* Remount when the loaded branding changes so fields reflect the latest values (no effect). */}
        <BrandingForm
          key={`${branding?.logo ?? ""}|${branding?.brandColor ?? ""}`}
          initialLogo={branding?.logo ?? ""}
          initialColor={branding?.brandColor ?? "#14b8a6"}
          canEdit={canEdit}
          onSaved={refresh}
        />
      </div>
    </div>
  );
}

function SchoolInfoForm({ canEdit }: { canEdit: boolean }) {
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getSchoolProfile()
      .then((p) => { if (active) setProfile(p); })
      .catch((err) => notifyError(err))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function set<K extends keyof SchoolProfile>(key: K, value: SchoolProfile[K]) {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  }

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      const updated = await updateSchoolProfile({
        schoolName: profile.schoolName,
        logo: profile.logo,
        brandColor: profile.brandColor,
        address: profile.address,
        city: profile.city,
        country: profile.country,
        phone: profile.phone,
        email: profile.email,
        website: profile.website,
        director: profile.director,
        accreditationNumber: profile.accreditationNumber,
        openingAuthorization: profile.openingAuthorization,
        payoutMerchantNumber: profile.payoutMerchantNumber,
        payoutOperator: profile.payoutOperator,
        payoutAccountName: profile.payoutAccountName,
      });
      setProfile(updated);
      notifySuccess("Informations enregistrées");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="py-6 text-sm text-slate-400">Chargement…</p>;
  if (!profile) return <p className="py-6 text-sm text-slate-400">Informations indisponibles.</p>;

  const ro = !canEdit;
  return (
    <Stack gap="md">
      <TextInput label="Nom de l'école" value={profile.schoolName ?? ""} readOnly={ro}
        onChange={(e) => set("schoolName", e.currentTarget.value)} />
      <TextInput label="Adresse" value={profile.address ?? ""} readOnly={ro}
        onChange={(e) => set("address", e.currentTarget.value)} />
      <Group grow>
        <TextInput label="Ville" value={profile.city ?? ""} readOnly={ro}
          onChange={(e) => set("city", e.currentTarget.value)} />
        <TextInput label="Pays" value={profile.country ?? ""} readOnly={ro}
          onChange={(e) => set("country", e.currentTarget.value)} />
      </Group>
      <Group grow>
        <TextInput label="Téléphone" value={profile.phone ?? ""} readOnly={ro}
          onChange={(e) => set("phone", e.currentTarget.value)} />
        <TextInput label="Email" value={profile.email ?? ""} readOnly={ro}
          onChange={(e) => set("email", e.currentTarget.value)} />
      </Group>
      <TextInput label="Site web" value={profile.website ?? ""} readOnly={ro}
        onChange={(e) => set("website", e.currentTarget.value)} />
      <TextInput label="Directeur" value={profile.director ?? ""} readOnly={ro}
        onChange={(e) => set("director", e.currentTarget.value)} />
      <Group grow>
        <TextInput label="Numéro d'agrément" value={profile.accreditationNumber ?? ""} readOnly={ro}
          onChange={(e) => set("accreditationNumber", e.currentTarget.value)} />
        <TextInput label="Autorisation d'ouverture" value={profile.openingAuthorization ?? ""} readOnly={ro}
          onChange={(e) => set("openingAuthorization", e.currentTarget.value)} />
      </Group>

      <div className="pt-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Wallet className="h-4 w-4 text-brand-600" /> Encaissements — reversement
        </h3>
        <p className="mb-3 mt-1 text-xs text-slate-400">
          Les paiements des parents sont encaissés par la plateforme, puis reversés à votre école sur
          ce compte Mobile Money. Renseignez le numéro marchand qui doit recevoir vos fonds.
        </p>
        <Stack gap="md">
          <Group grow align="flex-end">
            <TextInput label="Numéro marchand" placeholder="Ex. 620 00 00 00" inputMode="tel"
              value={profile.payoutMerchantNumber ?? ""} readOnly={ro}
              onChange={(e) => set("payoutMerchantNumber", e.currentTarget.value)} />
            <Select label="Opérateur" data={PAYOUT_OPERATORS} readOnly={ro}
              value={profile.payoutOperator ?? null}
              onChange={(v) => set("payoutOperator", v)} />
          </Group>
          <TextInput label="Titulaire du compte" value={profile.payoutAccountName ?? ""} readOnly={ro}
            onChange={(e) => set("payoutAccountName", e.currentTarget.value)} />
        </Stack>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </Stack>
  );
}

function BrandingForm({ initialLogo, initialColor, canEdit, onSaved }: {
  initialLogo: string; initialColor: string; canEdit: boolean; onSaved: () => void;
}) {
  const [logo, setLogo] = useState(initialLogo);
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);

  function pick(c: string) {
    setColor(c);
    applyBrandColor(c); // live preview across the UI
  }

  async function save() {
    setSaving(true);
    try {
      await updateTenantBranding({ logo: logo || null, brandColor: color || null });
      notifySuccess("Apparence enregistrée");
      onSaved();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="lg">
      <FileUpload label="Logo de l'établissement" variant="image" folder="tenants/logos"
        value={logo} onChange={(url) => setLogo(url ?? "")} />

      <div>
        <span className="text-sm font-medium text-slate-700">Couleur principale</span>
        <p className="mb-2 text-xs text-slate-400">Appliquée à toute la plateforme (boutons, accents, liens).</p>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((c) => (
            <button key={c} type="button" onClick={() => pick(c)}
              className="h-8 w-8 rounded-full border-2 transition"
              style={{ backgroundColor: c, borderColor: color.toLowerCase() === c.toLowerCase() ? "#0f172a" : "transparent" }}
              aria-label={c} />
          ))}
          <TextInput type="color" value={color} onChange={(e) => pick(e.currentTarget.value)} w={56} />
          <TextInput value={color} onChange={(e) => pick(e.currentTarget.value)} w={120} placeholder="#14b8a6" />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Aperçu</p>
        <div className="flex items-center gap-3">
          <Button>Bouton principal</Button>
          <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">Badge</span>
          <a className="text-sm font-medium text-brand-600 underline" href="#" onClick={(e) => e.preventDefault()}>Lien</a>
        </div>
      </div>

      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </Stack>
  );
}
