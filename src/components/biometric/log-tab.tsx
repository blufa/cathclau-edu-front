"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { listDevices, listPunches } from "@/lib/api/biometric";
import { DIRECTION_LABEL, SUBJECT_TYPE_LABEL } from "@/lib/types/biometric";
import { useDirectory } from "@/components/biometric/use-directory";
import { Spinner } from "@/components/ui/spinner";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";

export function LogTab() {
  const devicesQuery = useQuery(listDevices, []);
  const { name } = useDirectory();
  const [deviceFilter, setDeviceFilter] = useState("");
  const q = useQuery(() => listPunches({ deviceId: deviceFilter ? Number(deviceFilter) : undefined }), [deviceFilter]);
  const deviceName = useMemo(() => new Map((devicesQuery.data ?? []).map((d) => [d.id, d.name])), [devicesQuery.data]);
  const deviceOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Tous les appareils", label: "Tous les appareils", searchText: "tous" },
      ...(devicesQuery.data ?? []).map((d) => ({ value: String(d.id), trigger: d.name, label: d.name, searchText: d.name })),
    ],
    [devicesQuery.data],
  );

  return (
    <div className="space-y-4">
      <SearchableSelect value={deviceFilter} options={deviceOptions} onChange={setDeviceFilter} triggerClassName="min-w-[200px] justify-between px-3" />
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Horodatage</TH><TH>Personne</TH><TH>Appareil</TH><TH>Sens</TH><TH>Temp.</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun pointage. Les appareils poussent les pointages via l&apos;API d&apos;ingestion.</TD></TR>}
            {(q.data ?? []).map((p) => (
              <TR key={p.id}>
                <TD>{new Date(p.punchTime).toLocaleString("fr-FR")}</TD>
                <TD className="font-medium text-gray-900">{p.subjectType && p.subjectId ? (name.get(`${p.subjectType}-${p.subjectId}`) ?? `${SUBJECT_TYPE_LABEL[p.subjectType]} #${p.subjectId}`) : <span className="text-warning-600">Non enrôlé ({p.externalUserId})</span>}</TD>
                <TD>{deviceName.get(p.deviceId) ?? `#${p.deviceId}`}</TD>
                <TD>{DIRECTION_LABEL[p.direction]}</TD>
                <TD>{p.temperature != null ? `${p.temperature} °C` : "—"}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}
