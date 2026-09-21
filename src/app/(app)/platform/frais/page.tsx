"use client";

import { useQuery } from "@/hooks/use-query";
import { listPlatformFeeBalancesByTenant } from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatGNF } from "@/lib/format";

export default function PlatformFeePage() {
  return (
    <RequireSuperAdmin>
      <PlatformFeeSettings />
    </RequireSuperAdmin>
  );
}

function PlatformFeeSettings() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Frais d&apos;usage de la plateforme</h1>
        <p className="text-sm text-gray-500">
          Chaque école configure elle-même son frais plateforme (nom et montant, comme n&apos;importe
          quel frais annexe, depuis Facturation → Frais scolaires). Ce tableau récapitule combien
          chaque école doit actuellement à la plateforme, réglé ensuite par l&apos;école depuis son
          tableau de bord finance (bouton « Verser »).
        </p>
      </div>

      <PlatformFeeBalancesByTenant />
    </div>
  );
}

/** Combien chaque école doit actuellement à la plateforme (encaissé auprès des parents − déjà réglé). */
function PlatformFeeBalancesByTenant() {
  const { data, loading } = useQuery(() => listPlatformFeeBalancesByTenant(), []);
  const rows = data ?? [];
  const dueRows = rows.filter((r) => Number(r.balance) > 0);

  return (
    <Card>
      <CardHeader><CardTitle>Solde dû par école</CardTitle></CardHeader>
      <CardBody>
        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Aucune école.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-gray-400">
              {dueRows.length} école(s) avec un solde à verser, sur {rows.length}.
            </p>
            <Table>
              <THead><tr><TH>École</TH><TH className="text-right">Encaissé</TH><TH className="text-right">Déjà réglé</TH><TH className="text-right">Solde dû</TH></tr></THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.tenantId}>
                    <TD className="text-gray-900">{r.tenantName ?? `#${r.tenantId}`}</TD>
                    <TD className="text-right">{formatGNF(r.collected)}</TD>
                    <TD className="text-right">{formatGNF(r.settled)}</TD>
                    <TD className={`text-right font-semibold ${Number(r.balance) > 0 ? "text-amber-600" : "text-gray-400"}`}>
                      {formatGNF(r.balance)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </>
        )}
      </CardBody>
    </Card>
  );
}
