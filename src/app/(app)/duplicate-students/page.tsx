"use client";

import { Copy } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { deleteStudent, listDuplicateStudents, type DuplicateStudentCandidate } from "@/lib/api/students";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

/**
 * Détection de doublons élèves (§retour comptable : "il peut avoir deux à trois mêmes prénoms, nom,
 * adresse ou parent sans [être] la même dans la même classe") — jamais de suppression automatique :
 * le signal "suspect" ne se base que sur l'écart de facturation réelle au sein du groupe (une fiche
 * quasi vide à côté d'une fiche avec tout un historique de mensualités payées), jamais le seul nom.
 * Un groupe où chacun a son propre historique complet (vrais jumeaux, par exemple) n'a personne de
 * marqué suspect — c'est au comptable de trancher, pas à l'automatisme.
 */
export default function DuplicateStudentsPage() {
  const { user } = useAuth();
  // Réservé au SUPER_ADMIN (§retour utilisateur) : suppression de fiche élève, trop sensible pour le
  // personnel d'école.
  const canView = isSuperAdmin(user);
  const q = useQuery(() => (canView ? listDuplicateStudents() : Promise.resolve([])), [canView]);

  if (!canView) {
    return (
      <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
        Vous n&apos;avez pas accès à cette page.
      </p>
    );
  }

  const groups = q.data ?? [];

  function remove(c: DuplicateStudentCandidate) {
    confirmAction({
      title: "Supprimer cette fiche élève",
      message: `${c.firstName} ${c.lastName} — ${c.monthlyInvoiceCount} mensualité(s) facturée(s), `
        + `${formatGNF(c.totalInvoiced)} facturé au total. Cette suppression archive la fiche `
        + `(réversible). Vérifiez bien qu'il s'agit de la fiche en trop avant de confirmer.`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteStudent(c.studentId);
          notifySuccess("Fiche élève supprimée");
          q.refetch();
        } catch (e) { notifyError(e); }
      },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Doublons élèves</h1>
          <p className="mt-1 text-sm text-gray-500">
            Élèves ayant le même prénom et nom dans la même classe — comparés sur leur facturation
            réelle, jamais sur le seul nom (une homonymie comme des jumeaux n&apos;est jamais signalée
            si chacun a son propre historique complet de factures).
          </p>
        </div>
      </Reveal>

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : groups.length === 0 ? (
        <Card><CardBody className="py-10 text-center text-sm text-gray-400">Aucun doublon détecté.</CardBody></Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <Reveal key={g.classId + "-" + g.members.map((m) => m.studentId).join("-")} y={8}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Copy className="h-4 w-4 text-brand-500" />
                    {g.className}
                  </CardTitle>
                </CardHeader>
                <CardBody>
                  <Table>
                    <THead><tr>
                      <TH>Élève</TH>
                      <TH>Mensualités facturées</TH>
                      <TH>Total facturé</TH>
                      <TH>Total encaissé</TH>
                      <TH>Statut</TH>
                      <TH className="text-right">Actions</TH>
                    </tr></THead>
                    <TBody>
                      {g.members.map((c) => (
                        <TR key={c.studentId}>
                          <TD className="font-medium text-gray-900">{c.firstName} {c.lastName}</TD>
                          <TD>{c.monthlyInvoiceCount}</TD>
                          <TD>{formatGNF(c.totalInvoiced)}</TD>
                          <TD>{formatGNF(c.totalPaid)}</TD>
                          <TD>
                            {c.suspect
                              ? <Badge tone="red">Fiche probablement en trop</Badge>
                              : <Badge tone="green">Historique complet</Badge>}
                          </TD>
                          <TD className="text-right">
                            {c.suspect && (
                              <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(c)}>
                                Supprimer
                              </Button>
                            )}
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                </CardBody>
              </Card>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
