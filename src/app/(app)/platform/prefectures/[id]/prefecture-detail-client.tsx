"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import {
  assignSchoolToPrefecture,
  assignUserToPrefecture,
  getPrefecture,
  listPlatformUsers,
  listPrefectureSchools,
  listPrefectureUserIds,
  searchTenants,
  unassignSchoolFromPrefecture,
  unassignUserFromPrefecture,
} from "@/lib/api/platform";
import { RequireSuperAdmin } from "@/components/platform/require-super-admin";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function PrefectureDetailPage() {
  return (
    <RequireSuperAdmin>
      <PrefectureDetail />
    </RequireSuperAdmin>
  );
}

function PrefectureDetail() {
  const params = useParams<{ id: string }>();
  const prefectureId = Number(params.id);

  const prefectureQuery = useQuery(() => getPrefecture(prefectureId), [prefectureId]);
  const schoolsQuery = useQuery(() => listPrefectureSchools(prefectureId), [prefectureId]);
  const userIdsQuery = useQuery(() => listPrefectureUserIds(prefectureId), [prefectureId]);
  const platformUsersQuery = useQuery(() => listPlatformUsers(), []);

  const [addingSchool, setAddingSchool] = useState(false);
  const [addingUser, setAddingUser] = useState(false);

  const assignedUsers = useMemo(() => {
    const ids = new Set(userIdsQuery.data ?? []);
    return (platformUsersQuery.data ?? []).filter((u) => ids.has(u.id));
  }, [userIdsQuery.data, platformUsersQuery.data]);

  function unassignSchool(tenantId: number, schoolName: string) {
    confirmAction({
      title: "Détacher l'école",
      message: `Détacher « ${schoolName} » de cette préfecture/commune ?`,
      confirmLabel: "Détacher",
      danger: true,
      onConfirm: async () => {
        try { await unassignSchoolFromPrefecture(tenantId); notifySuccess("École détachée"); schoolsQuery.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  function unassignUser(userId: number, name: string) {
    confirmAction({
      title: "Retirer le compte DPE_ADMIN",
      message: `Retirer « ${name} » de cette préfecture/commune ?`,
      confirmLabel: "Retirer",
      danger: true,
      onConfirm: async () => {
        try { await unassignUserFromPrefecture(prefectureId, userId); notifySuccess("Compte retiré"); userIdsQuery.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  if (prefectureQuery.loading) {
    return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;
  }
  if (prefectureQuery.error || !prefectureQuery.data) {
    return <div className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-700">Préfecture/commune introuvable.</div>;
  }
  const prefecture = prefectureQuery.data;

  return (
    <div className="space-y-6">
      <Link href="/platform/prefectures" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Retour aux préfectures/communes
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-gray-900">{prefecture.nom}</h1>
        <Badge tone="brand">{prefecture.type}</Badge>
        <Badge tone={prefecture.statut === "ACTIVE" ? "green" : "gray"}>
          {prefecture.statut === "ACTIVE" ? "Active" : "Archivée"}
        </Badge>
      </div>
      {prefecture.region && <p className="text-sm text-gray-500">{prefecture.region}, {prefecture.pays}</p>}

      <div className="flex gap-2">
        <Button variant="outline" component={Link} href={`/dpe/dashboard?prefectureId=${prefecture.id}`}>
          Aperçu tableau de bord
        </Button>
      </div>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Écoles rattachées</CardTitle>
          <Button size="sm" onClick={() => setAddingSchool(true)}>Rattacher une école</Button>
        </CardHeader>
        <CardBody>
          {schoolsQuery.loading ? (
            <Spinner />
          ) : (
            <Table>
              <THead><TR><TH>École</TH><TH>Ville</TH><TH>Statut</TH><TH /></TR></THead>
              <TBody>
                {(schoolsQuery.data ?? []).map((s) => (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.schoolName}</TD>
                    <TD>{s.city ?? "—"}</TD>
                    <TD><Badge tone={s.status === "ACTIVE" ? "green" : "gray"}>{s.status}</Badge></TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button size="sm" variant="secondary" onClick={() => unassignSchool(s.id, s.schoolName)}>Détacher</Button>
                      </div>
                    </TD>
                  </TR>
                ))}
                {!schoolsQuery.loading && (schoolsQuery.data ?? []).length === 0 && (
                  <TR><TD colSpan={4} className="text-gray-400">Aucune école rattachée pour l&apos;instant.</TD></TR>
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Comptes DPE_ADMIN affectés</CardTitle>
          <Button size="sm" onClick={() => setAddingUser(true)}>Affecter un compte</Button>
        </CardHeader>
        <CardBody>
          {userIdsQuery.loading || platformUsersQuery.loading ? (
            <Spinner />
          ) : (
            <Table>
              <THead><TR><TH>Nom</TH><TH>E-mail</TH><TH>Rôles</TH><TH /></TR></THead>
              <TBody>
                {assignedUsers.map((u) => (
                  <TR key={u.id}>
                    <TD className="font-medium">{u.firstName} {u.lastName}</TD>
                    <TD>{u.email ?? "—"}</TD>
                    <TD>{u.roles.join(", ")}</TD>
                    <TD>
                      <div className="flex justify-end">
                        <Button size="sm" variant="secondary" onClick={() => unassignUser(u.id, `${u.firstName} ${u.lastName}`)}>Retirer</Button>
                      </div>
                    </TD>
                  </TR>
                ))}
                {assignedUsers.length === 0 && (
                  <TR><TD colSpan={4} className="text-gray-400">Aucun compte affecté pour l&apos;instant.</TD></TR>
                )}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={addingSchool} onClose={() => setAddingSchool(false)} title="Rattacher une école">
        <AssignSchoolForm
          prefectureId={prefectureId}
          onDone={() => { setAddingSchool(false); schoolsQuery.refetch(); }}
          onCancel={() => setAddingSchool(false)}
        />
      </Modal>

      <Modal open={addingUser} onClose={() => setAddingUser(false)} title="Affecter un compte DPE_ADMIN">
        <AssignUserForm
          prefectureId={prefectureId}
          excludeUserIds={new Set(userIdsQuery.data ?? [])}
          onDone={() => { setAddingUser(false); userIdsQuery.refetch(); }}
          onCancel={() => setAddingUser(false)}
        />
      </Modal>
    </div>
  );
}

function AssignSchoolForm({ prefectureId, onDone, onCancel }: {
  prefectureId: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const tenantsQuery = useQuery(() => searchTenants({ size: 200 }), []);
  const [tenantId, setTenantId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const options: SearchableOption[] = (tenantsQuery.data?.content ?? []).map((t) => ({
    value: String(t.id),
    trigger: t.schoolName,
    label: t.schoolName,
    searchText: `${t.schoolName} ${t.city ?? ""}`,
  }));

  async function submit() {
    if (!tenantId) { notifyError("Choisissez une école."); return; }
    setSubmitting(true);
    try {
      await assignSchoolToPrefecture(prefectureId, Number(tenantId));
      notifySuccess("École rattachée");
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {tenantsQuery.loading ? (
        <Spinner />
      ) : (
        <SearchableSelect value={tenantId} options={options} onChange={setTenantId} triggerClassName="w-full justify-between px-3" />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button onClick={submit} loading={submitting}>Rattacher</Button>
      </div>
    </div>
  );
}

function AssignUserForm({ prefectureId, excludeUserIds, onDone, onCancel }: {
  prefectureId: number;
  excludeUserIds: Set<number>;
  onDone: () => void;
  onCancel: () => void;
}) {
  const usersQuery = useQuery(() => listPlatformUsers(), []);
  const [userId, setUserId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const candidates = (usersQuery.data ?? []).filter((u) => !excludeUserIds.has(u.id));
  const options: SearchableOption[] = candidates.map((u) => {
    const label = `${u.firstName} ${u.lastName}${u.roles.includes("DPE_ADMIN") ? " (DPE_ADMIN)" : ""}`;
    return { value: String(u.id), trigger: label, label, searchText: `${label} ${u.email ?? ""}` };
  });

  async function submit() {
    if (!userId) { notifyError("Choisissez un compte."); return; }
    setSubmitting(true);
    try {
      await assignUserToPrefecture(prefectureId, Number(userId));
      notifySuccess("Compte affecté");
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-400">
        Seul un compte avec le rôle DPE_ADMIN pourra effectivement accéder au tableau de bord une fois
        affecté — attribuez ce rôle depuis la gestion des utilisateurs si nécessaire.
      </p>
      {usersQuery.loading ? (
        <Spinner />
      ) : (
        <SearchableSelect value={userId} options={options} onChange={setUserId} triggerClassName="w-full justify-between px-3" />
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button onClick={submit} loading={submitting}>Affecter</Button>
      </div>
    </div>
  );
}
