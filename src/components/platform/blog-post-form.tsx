"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@/hooks/use-query";
import { listCategoriesAdmin, publishPost } from "@/lib/api/blog";
import type { BlogPost, BlogPostInput } from "@/lib/types/blog";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FileUpload } from "@/components/ui/file-upload";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { Button } from "@/components/ui/button";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface BlogPostFormProps {
  initial?: BlogPost;
  onSubmit: (input: BlogPostInput) => Promise<BlogPost>;
}

/** Formulaire de création/édition d'un article — reproduit les champs de "Blog Details" (image de
 * couverture, titre, extrait, catégorie, tags, contenu riche) côté back-office. "Publier" enregistre
 * d'abord (création ou mise à jour) puis publie l'article obtenu, que ce soit un nouvel article ou un
 * brouillon existant — le même bouton fonctionne donc pour les deux pages (nouveau/édition). */
export function BlogPostForm({ initial, onSubmit }: BlogPostFormProps) {
  const router = useRouter();
  const categoriesQuery = useQuery(() => listCategoriesAdmin(), []);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initial?.coverImageUrl ?? null);
  const [categoryId, setCategoryId] = useState<string>(initial?.categoryId != null ? String(initial.categoryId) : "");
  const [tagsInput, setTagsInput] = useState((initial?.tags ?? []).join(", "));
  const [contentHtml, setContentHtml] = useState(initial?.contentHtml ?? "");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  function slugify(text: string) {
    return text.toLowerCase().trim()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  function handleTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  function buildInput(): BlogPostInput {
    return {
      title,
      slug: slug || undefined,
      excerpt: excerpt || undefined,
      coverImageUrl: coverImageUrl || undefined,
      contentHtml,
      categoryId: categoryId ? Number(categoryId) : null,
      tags: tagsInput.split(",").map((t) => t.trim()).filter(Boolean),
    };
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await onSubmit(buildInput());
      notifySuccess("Article enregistré");
      if (!initial) router.replace(`/platform/blog/posts/${saved.id}/edit`);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      const saved = await onSubmit(buildInput());
      await publishPost(saved.id);
      notifySuccess("Article publié");
      router.push("/platform/blog/posts");
    } catch (err) {
      notifyError(err);
    } finally {
      setPublishing(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <Field>
        <Label>Titre <span className="text-error-500">*</span></Label>
        <Input required value={title} onChange={(e) => handleTitleChange(e.target.value)} />
      </Field>

      <Field>
        <Label>Slug (URL)</Label>
        <Input
          value={slug}
          onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
        />
        <p className="text-xs text-gray-400">/blog/{slug || "…"}</p>
      </Field>

      <Field>
        <Label>Extrait</Label>
        <Textarea rows={2} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Résumé affiché dans les listes et les partages" />
      </Field>

      <Field>
        <Label>Image de couverture</Label>
        <FileUpload variant="image" folder="blog" value={coverImageUrl} onChange={setCoverImageUrl} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <Label>Catégorie</Label>
          <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Aucune catégorie</option>
            {(categoriesQuery.data ?? []).map((c) => (
              <option key={c.id} value={String(c.id)}>{c.label}</option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label>Tags (séparés par une virgule)</Label>
          <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="guinée, rentrée, numérique" />
        </Field>
      </div>

      <Field>
        <Label>Contenu <span className="text-error-500">*</span></Label>
        <RichTextEditor value={contentHtml} onChange={setContentHtml} placeholder="Rédigez l'article…" />
      </Field>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="secondary" onClick={() => router.push("/platform/blog/posts")}>Annuler</Button>
        <Button type="submit" variant="secondary" loading={saving}>Enregistrer le brouillon</Button>
        <Button type="button" loading={publishing} onClick={handlePublish}>Publier</Button>
      </div>
    </form>
  );
}
