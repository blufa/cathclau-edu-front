"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { getParentChildren, listParents } from "@/lib/api/parents";
import type { Parent } from "@/lib/types/student";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";

/** Liste de tous les parents du tenant — cliquer sur un parent affiche tous ses enfants rattachés. */
export default function ParentsListPage() {
  // Aucune donnée "parents" n'était mise en cache hors-ligne (§retour comptable, guichet d'accueil) —
  // `useCachedQuery` au lieu du hook maison sans cache : le filtrage est déjà 100% client (voir
  // `parents` ci-dessous), la liste complète tient donc en un seul appel mis en cache IndexedDB.
  const q = useCachedQuery("parents", listParents, []);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Parent | null>(null);

  const parents = useMemo(() => {
    const list = q.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return list;
    return list.filter((p) => `${p.firstName} ${p.lastName} ${p.phone ?? ""} ${p.email ?? ""}`.toLowerCase().includes(term));
  }, [q.data, search]);

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Parents</h1>
        <p className="text-sm text-gray-500">Tous les parents de l&apos;école — cliquez sur un parent pour voir ses enfants</p>
      </Reveal>

      <Input
        className="max-w-sm"
        placeholder="Rechercher (nom, téléphone, email)…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {q.loading ? (
        <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>
      ) : (
        <Table>
          <THead>
            <tr><TH>Nom</TH><TH className="hidden sm:table-cell">Téléphone</TH><TH className="hidden sm:table-cell">Email</TH><TH className="hidden sm:table-cell">Profession</TH></tr>
          </THead>
          <TBody>
            {parents.length === 0 && (
              <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucun parent trouvé.</TD></TR>
            )}
            {parents.map((p) => (
              <TR key={p.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(p)}>
                <TD className="font-medium text-gray-900">{p.firstName} {p.lastName}</TD>
                <TD className="hidden text-gray-600 sm:table-cell">{p.phone ?? "—"}</TD>
                <TD className="hidden text-gray-600 sm:table-cell">{p.email ?? "—"}</TD>
                <TD className="hidden text-gray-600 sm:table-cell">{p.occupation ?? "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.firstName} ${selected.lastName}` : ""}>
        {selected && <ParentChildren parent={selected} />}
      </Modal>
    </div>
  );
}

function ParentChildren({ parent }: { parent: Parent }) {
  const childrenQuery = useCachedQuery(`parent-children:${parent.id}`, () => getParentChildren(parent.id), [parent.id]);
  const children = childrenQuery.data ?? [];

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div><dt className="text-gray-400">Téléphone</dt><dd className="text-gray-900">{parent.phone ?? "—"}</dd></div>
        <div><dt className="text-gray-400">Email</dt><dd className="text-gray-900">{parent.email ?? "—"}</dd></div>
        <div><dt className="text-gray-400">Profession</dt><dd className="text-gray-900">{parent.occupation ?? "—"}</dd></div>
        <div><dt className="text-gray-400">Adresse</dt><dd className="text-gray-900">{parent.address ?? "—"}</dd></div>
      </dl>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-gray-700">
          <Users className="h-4 w-4" /> Enfants ({children.length})
        </p>
        {childrenQuery.loading ? (
          <div className="flex justify-center py-6"><Spinner /></div>
        ) : children.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun enfant rattaché.</p>
        ) : (
          <ul className="space-y-2">
            {children.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2">
                <div>
                  <Link href={`/students/${c.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                    {c.firstName} {c.lastName}
                  </Link>
                  <p className="text-xs text-gray-400">{c.studentNumber}</p>
                </div>
                <Badge tone="gray">{c.gender === "MALE" ? "Garçon" : c.gender === "FEMALE" ? "Fille" : c.gender}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
