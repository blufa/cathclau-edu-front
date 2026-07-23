"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { createRoom } from "@/lib/api/academics";
import type { Salle, TypeSalle } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { BUILDINGS, nextRoomNumber, roomSuggestions } from "@/lib/academics-rooms";
import { ROOM_TYPE_OPTIONS } from "@/components/referentials/room-form";

/**
 * Assistant : bâtiment + étage + nombre de salles → crée toutes les salles d'un coup
 * (« Salle 101 », « Salle 102 »…), avec capacité et type communs. Évite la saisie répétitive.
 */
export function RoomAssistant({
  existingRooms,
  onCreated,
  onCancel,
}: {
  existingRooms: Salle[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [building, setBuilding] = useState("Bâtiment principal");
  // Numéro de départ = reprend automatiquement après la dernière salle existante (numérotation continue).
  const [startNum, setStartNum] = useState<number | string>(() => nextRoomNumber(existingRooms.map((r) => r.label)));
  const [count, setCount] = useState<number | string>(6);
  const [capacity, setCapacity] = useState<number | string>("");
  const [type, setType] = useState<TypeSalle>("SALLE_COURS");
  const [saving, setSaving] = useState(false);

  const planned = useMemo(
    () => roomSuggestions(Math.max(1, Number(startNum) || 1), Math.max(0, Number(count) || 0)),
    [startNum, count],
  );
  const existingLabels = new Set(existingRooms.map((r) => r.label.trim().toLowerCase()));
  const toCreate = planned.filter((label) => !existingLabels.has(label.toLowerCase()));
  const skipped = planned.length - toCreate.length;

  async function handleCreate() {
    if (toCreate.length === 0) return;
    setSaving(true);
    try {
      for (const label of toCreate) {
        await createRoom({
          label,
          building: building || null,
          capacity: capacity === "" ? null : Number(capacity),
          type,
        });
      }
      notifySuccess(`${toCreate.length} salle${toCreate.length > 1 ? "s créées" : " créée"}`);
      onCreated();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Numérotation <strong>continue</strong> : l&apos;assistant reprend après la dernière salle
        (ex. « Salle 001 », « Salle 002 »… puis l&apos;étage suivant enchaîne « 003 », « 004 »…).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Bâtiment</Label>
          <Combobox value={building} onChange={setBuilding} options={BUILDINGS} />
        </Field>
        <Field>
          <Label>Numéro de départ</Label>
          <Input type="number" min={1} value={startNum} onChange={(e) => setStartNum(e.target.value)} disabled={saving} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <Label>Nombre de salles</Label>
          <Input type="number" min={1} max={40} value={count} onChange={(e) => setCount(e.target.value)} disabled={saving} />
        </Field>
        <Field>
          <Label>Capacité (toutes)</Label>
          <Input type="number" min={0} value={capacity} onChange={(e) => setCapacity(e.target.value)} disabled={saving} />
        </Field>
        <Field>
          <Label>Type</Label>
          <Select value={type} onChange={(e) => setType(e.target.value as TypeSalle)} disabled={saving}>
            {ROOM_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </Field>
      </div>

      {planned.length > 0 && (
        <p className="text-sm text-gray-700">
          <strong>{toCreate.length}</strong> salle{toCreate.length > 1 ? "s" : ""} à créer
          {skipped > 0 && ` (${skipped} déjà existante${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""})`}
          {toCreate.length > 0 && ` : ${toCreate.slice(0, 8).join(", ")}${toCreate.length > 8 ? "…" : ""}`}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button onClick={handleCreate} loading={saving} disabled={toCreate.length === 0}>
          Créer {toCreate.length > 0 ? `(${toCreate.length})` : ""}
        </Button>
      </div>
    </div>
  );
}
