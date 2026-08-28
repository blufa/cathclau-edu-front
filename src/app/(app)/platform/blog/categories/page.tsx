"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { createCategory, deleteCategory, listCategoriesAdmin, updateCategory } from "@/lib/api/blog";
import type { BlogCategory } from "@/lib/types/blog";
import { RequireBlogAccess } from "@/components/platform/require-blog-access";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Field, Input, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function BlogCategoriesPage() {
  return (
    <RequireBlogAccess>
      <CategoriesTable />
    </RequireBlogAccess>
  );
}

function CategoriesTable() {
  const { data, loading, error, refetch } = useQuery(() => listCategoriesAdmin(), []);
  const [editing, setEditing] = useState<BlogCategory | null>(null);
  const [creating, setCreating] = useState(false);

  function remove(category: BlogCategory) {
    confirmAction({
      title: "Supprimer la catégorie",
      message: `Supprimer « ${category.label} » ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteCategory(category.id);
          notifySuccess("Catégorie supprimée");
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Catégories du blog</h1>
          <p className="text-sm text-slate-500">Organisent les articles publiés.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" component="a" href="/platform/blog/posts">Retour aux articles</Button>
          <Button onClick={() => setCreating(true)}>Nouvelle catégorie</Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md bg-error-50 px-4 py-3 text-sm text-error-700">Impossible de charger les catégories.</p>
      ) : loading && !data ? (
        <div className="flex justify-center py-16"><Spinner /></div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Libellé</TH><TH>Slug</TH><TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {data?.length === 0 && (
              <TR><TD colSpan={3} className="py-10 text-center text-gray-400">Aucune catégorie.</TD></TR>
            )}
            {data?.map((c) => (
              <TR key={c.id}>
                <TD className="font-medium">{c.label}</TD>
                <TD className="text-gray-500">{c.slug}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(c)}>Modifier</Button>
                    <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(c)}>Suppr.</Button>
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle catégorie">
        <CategoryForm
          onCancel={() => setCreating(false)}
          onSubmit={async (label, slug) => {
            await createCategory(label, slug);
            setCreating(false);
            notifySuccess("Catégorie créée");
            refetch();
          }}
        />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la catégorie">
        {editing && (
          <CategoryForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (label, slug) => {
              await updateCategory(editing.id, label, slug);
              setEditing(null);
              notifySuccess("Catégorie mise à jour");
              refetch();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function CategoryForm({ initial, onSubmit, onCancel }: {
  initial?: BlogCategory;
  onSubmit: (label: string, slug?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSubmit(label, slug || undefined);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field>
        <Label>Libellé</Label>
        <Input required value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field>
        <Label>Slug (optionnel, généré à partir du libellé sinon)</Label>
        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={saving}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </form>
  );
}
