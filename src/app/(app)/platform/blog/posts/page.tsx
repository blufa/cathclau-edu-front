"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { deletePost, listCategoriesAdmin, listPostsAdmin, publishPost, unpublishPost } from "@/lib/api/blog";
import type { BlogPost, BlogPostStatus } from "@/lib/types/blog";
import { RequireBlogAccess } from "@/components/platform/require-blog-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";

export default function BlogPostsPage() {
  return (
    <RequireBlogAccess>
      <PostsTable />
    </RequireBlogAccess>
  );
}

function PostsTable() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<BlogPostStatus | "">("");

  const postsQuery = useQuery(() => listPostsAdmin(statusFilter || undefined), [statusFilter]);
  const categoriesQuery = useQuery(() => listCategoriesAdmin(), []);

  const categoryLabel = useMemo(() => {
    const map = new Map<number, string>();
    for (const c of categoriesQuery.data ?? []) map.set(c.id, c.label);
    return map;
  }, [categoriesQuery.data]);

  function togglePublish(post: BlogPost) {
    const publishing = post.status === "DRAFT";
    confirmAction({
      title: publishing ? "Publier l'article" : "Dépublier l'article",
      message: publishing
        ? `Publier « ${post.title} » ? Il deviendra visible sur le blog public.`
        : `Dépublier « ${post.title} » ? Il repassera en brouillon.`,
      confirmLabel: publishing ? "Publier" : "Dépublier",
      onConfirm: async () => {
        try {
          await (publishing ? publishPost(post.id) : unpublishPost(post.id));
          notifySuccess(publishing ? "Article publié" : "Article dépublié");
          postsQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  function remove(post: BlogPost) {
    confirmAction({
      title: "Supprimer l'article",
      message: `Supprimer définitivement « ${post.title} » ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deletePost(post.id);
          notifySuccess("Article supprimé");
          postsQuery.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  const columns: Column<BlogPost>[] = [
    {
      key: "title",
      header: "Titre",
      accessor: (p) => p.title,
      render: (p) => (
        <div>
          <p className="font-medium text-gray-900">{p.title}</p>
          <p className="text-xs text-gray-400">/blog/{p.slug}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Catégorie",
      accessor: (p) => (p.categoryId != null ? categoryLabel.get(p.categoryId) ?? "" : ""),
      render: (p) => (p.categoryId != null ? categoryLabel.get(p.categoryId) ?? "—" : <span className="text-gray-300">—</span>),
    },
    {
      key: "status",
      header: "Statut",
      accessor: (p) => p.status,
      render: (p) => <Badge tone={p.status === "PUBLISHED" ? "green" : "gray"}>{p.status === "PUBLISHED" ? "Publié" : "Brouillon"}</Badge>,
    },
    {
      key: "date",
      header: "Date",
      accessor: (p) => p.publishedAt ?? p.createdAt,
      render: (p) => <span className="text-gray-500">{formatDate(p.publishedAt ?? p.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (p) => (
        <div className="flex justify-end gap-1">
          <Button size="sm" variant="ghost" onClick={() => router.push(`/platform/blog/posts/detail/edit?id=${p.id}`)}>Modifier</Button>
          <Button size="sm" variant="ghost" onClick={() => togglePublish(p)}>
            {p.status === "DRAFT" ? "Publier" : "Dépublier"}
          </Button>
          <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(p)}>Suppr.</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Blog</h1>
          <p className="text-sm text-slate-500">Articles publiés sur le blog public de CathClau Edu.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" component="a" href="/platform/blog/categories">Catégories</Button>
          <Button variant="secondary" component="a" href="/platform/blog/comments">Commentaires</Button>
          <Button leftSection={<Plus className="h-4 w-4" />} onClick={() => router.push("/platform/blog/posts/new")}>
            Nouvel article
          </Button>
        </div>
      </div>

      <Select className="max-w-[200px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BlogPostStatus | "")}>
        <option value="">Tous les statuts</option>
        <option value="DRAFT">Brouillon</option>
        <option value="PUBLISHED">Publié</option>
      </Select>

      <DataTable
        columns={columns}
        rows={postsQuery.data ?? []}
        loading={postsQuery.loading}
        error={!!postsQuery.error}
        getRowKey={(p) => p.id}
        emptyLabel="Aucun article pour l'instant."
        searchable
        searchPlaceholder="Rechercher un article…"
      />
    </div>
  );
}
