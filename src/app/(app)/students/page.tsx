"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  createStudent,
  deleteStudent,
  searchStudents,
  updateStudent,
} from "@/lib/api/students";
import type { CreateStudentInput, EnrollmentStatus, Gender, Student } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { StudentForm } from "@/components/students/student-form";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const PAGE_SIZE = 20;

export default function StudentsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "SECRETARY", "DIRECTOR");
  const canDelete = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [status, setStatus] = useState<EnrollmentStatus | "">("");
  const [page, setPage] = useState(0);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);

  const { data, loading, error, refetch } = useQuery(
    () =>
      searchStudents({
        search: search || undefined,
        gender: gender || undefined,
        enrollmentStatus: status || undefined,
        page,
        size: PAGE_SIZE,
        sort: "lastName,asc",
      }),
    [search, gender, status, page],
  );

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput.trim());
  }

  async function handleCreate(input: CreateStudentInput) {
    await createStudent(input);
    setCreating(false);
    notifySuccess("Élève créé");
    refetch();
  }

  async function handleUpdate(input: CreateStudentInput) {
    if (!editing) return;
    await updateStudent(editing.id, input);
    setEditing(null);
    notifySuccess("Élève mis à jour");
    refetch();
  }

  function handleDelete(student: Student) {
    confirmAction({
      title: "Archiver l'élève",
      message: `Archiver l'élève ${student.firstName} ${student.lastName} ?`,
      confirmLabel: "Archiver",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteStudent(student.id);
          notifySuccess("Élève archivé");
          refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Élèves</h1>
          <p className="text-sm text-gray-500">Gestion des élèves de l&apos;établissement</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)}>Nouvel élève</Button>}
      </div>

      <form onSubmit={applySearch} className="flex flex-wrap items-center gap-3">
        <Input
          className="max-w-xs"
          placeholder="Rechercher (nom, matricule)…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <Select
          className="max-w-[160px]"
          value={gender}
          onChange={(e) => {
            setPage(0);
            setGender(e.target.value as Gender | "");
          }}
        >
          <option value="">Tous sexes</option>
          <option value="MALE">Masculin</option>
          <option value="FEMALE">Féminin</option>
        </Select>
        <Select
          className="max-w-[200px]"
          value={status}
          onChange={(e) => {
            setPage(0);
            setStatus(e.target.value as EnrollmentStatus | "");
          }}
        >
          <option value="">Toutes inscriptions</option>
          <option value="PENDING">En attente</option>
          <option value="VALIDATED">Validée</option>
          <option value="CANCELLED">Annulée</option>
        </Select>
        <Button type="submit" variant="secondary">
          Filtrer
        </Button>
      </form>

      {error ? (
        <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Impossible de charger les élèves.
        </p>
      ) : loading && !data ? (
        <div className="flex justify-center py-16">
          <Spinner className="h-8 w-8" />
        </div>
      ) : (
        <>
          <Table>
            <THead>
              <tr>
                <TH>Matricule</TH>
                <TH>Nom</TH>
                <TH>Sexe</TH>
                <TH>Naissance</TH>
                <TH>Téléphone</TH>
                <TH className="text-right">Actions</TH>
              </tr>
            </THead>
            <TBody>
              {data?.content.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-10 text-center text-gray-400">
                    Aucun élève trouvé.
                  </TD>
                </TR>
              )}
              {data?.content.map((s) => (
                <TR key={s.id}>
                  <TD className="font-mono text-xs">{s.studentNumber}</TD>
                  <TD>
                    <Link href={`/students/${s.id}`} className="font-medium text-indigo-600 hover:underline">
                      {s.firstName} {s.lastName}
                    </Link>
                  </TD>
                  <TD>
                    <Badge tone={s.gender === "FEMALE" ? "indigo" : "blue"}>
                      {s.gender === "FEMALE" ? "F" : "M"}
                    </Badge>
                  </TD>
                  <TD>{s.birthDate ?? "—"}</TD>
                  <TD>{s.phone ?? "—"}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-2">
                      {canWrite && (
                        <Button size="sm" variant="ghost" onClick={() => setEditing(s)}>
                          Modifier
                        </Button>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(s)}>
                          Archiver
                        </Button>
                      )}
                    </div>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>

          {data && (
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              totalElements={data.totalElements}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvel élève">
        <StudentForm submitLabel="Créer" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'élève">
        {editing && (
          <StudentForm
            initial={editing}
            submitLabel="Enregistrer"
            onSubmit={handleUpdate}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
    </div>
  );
}
