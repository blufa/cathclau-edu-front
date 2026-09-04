"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createUserWithRole } from "@/lib/api/iam";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface NewRedacteurModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

/** Création d'un compte plateforme "Rédacteur" — limité au blog, aucun accès écoles/abonnements.
 * Réutilise POST /api/v1/users (déjà capable de créer un compte sans tenant pour un appelant
 * SUPER_ADMIN) + l'affectation de rôle existante, comme les autres comptes créés depuis cette page. */
export function NewRedacteurModal({ open, onClose, onCreated }: NewRedacteurModalProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setFirstName(""); setLastName(""); setEmail(""); setPassword("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createUserWithRole({ firstName, lastName, email, password }, "REDACTEUR");
      notifySuccess("Compte rédacteur créé");
      reset();
      onCreated();
      onClose();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Nouveau rédacteur">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-500">
          Ce compte pourra uniquement gérer le blog d&apos;entreprise (articles, catégories, commentaires) —
          aucun accès aux écoles, abonnements ou données clients.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field>
            <Label>Prénom</Label>
            <Input required value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </Field>
          <Field>
            <Label>Nom</Label>
            <Input required value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </Field>
        </div>
        <Field>
          <Label>E-mail</Label>
          <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field>
          <Label>Mot de passe initial</Label>
          <Input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Annuler</Button>
          <Button type="submit" loading={saving}>Créer le compte</Button>
        </div>
      </form>
    </Modal>
  );
}
