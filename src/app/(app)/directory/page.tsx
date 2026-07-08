"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { searchDirectory } from "@/lib/api/directory";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";

export default function DirectoryPage() {
  const { user } = useAuth();
  const allowed = hasRole(user, "SUPER_ADMIN", "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");

  const [matricule, setMatricule] = useState("");
  const [name, setName] = useState("");
  const [params, setParams] = useState<{ matricule?: string; name?: string } | null>(null);

  // Dynamic search (debounced) once a matricule OR a name ≥ 3 chars is entered.
  useEffect(() => {
    const t = setTimeout(() => {
      const m = matricule.trim();
      const n = name.trim();
      setParams(!m && n.length < 3 ? null : { matricule: m || undefined, name: n || undefined });
    }, 350);
    return () => clearTimeout(t);
  }, [matricule, name]);

  const q = useQuery(() => (params ? searchDirectory(params) : Promise.resolve([])), [params]);

  if (!allowed) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Accès réservé à l&apos;administration de l&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Annuaire inter‑écoles</h1>
        <p className="text-sm text-slate-500">
          Recherchez un élève transféré sur toute la plateforme : école d&apos;origine, dernière classe / décision de passage,
          régularité de paiement et dernière moyenne.
        </p>
      </Reveal>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="w-full pl-9" placeholder="Matricule exact" value={matricule} onChange={(e) => setMatricule(e.target.value)} />
        </div>
        <span className="text-xs text-slate-400">ou</span>
        <div className="relative max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input className="w-full pl-9" placeholder="Nom (≥ 3 caractères)" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      {!params ? (
        <p className="rounded-xl bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
          Saisissez un matricule exact, ou un nom d&apos;au moins 3 caractères.
        </p>
      ) : q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Matricule</TH><TH>Naissance</TH><TH>École (plateforme)</TH><TH>Dernière classe</TH><TH>Décision</TH><TH>Finances</TH><TH>Moyenne</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-slate-400">Aucun élève trouvé.</TD></TR>}
            {(q.data ?? []).map((e, i) => (
              <TR key={`${e.studentNumber}-${i}`}>
                <TD className="font-medium text-slate-900">{e.firstName} {e.lastName}</TD>
                <TD className="font-mono text-xs text-slate-600">{e.studentNumber ?? "—"}</TD>
                <TD className="text-slate-500">{e.birthDate ?? "—"}</TD>
                <TD>{e.schoolName ?? "—"}</TD>
                <TD>{e.lastClass ?? "—"}</TD>
                <TD>{e.lastDecision ? <Badge tone="indigo">{e.lastDecision}</Badge> : "—"}</TD>
                <TD>
                  {e.unpaidMonths > 0
                    ? <Badge tone="red">Pas à jour · {e.unpaidMonths} mois</Badge>
                    : <Badge tone="green">À jour</Badge>}
                </TD>
                <TD className="text-slate-600">{e.overallAverage ? `${e.overallAverage}/20` : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <p className="text-xs text-slate-400">
        Confidentialité : seuls des champs limités sont affichés (pas les notes détaillées), et chaque consultation est journalisée.
      </p>
    </div>
  );
}
