"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { listCommentsAdmin, listPostsAdmin, moderateComment } from "@/lib/api/blog";
import type { BlogComment, BlogCommentStatus } from "@/lib/types/blog";
import { RequireBlogAccess } from "@/components/platform/require-blog-access";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { formatDateTime } from "@/lib/format";

const STATUS_TONE: Record<BlogCommentStatus, "amber" | "green" | "red"> = {
  PENDING: "amber",
  APPROVED: "green",
  REJECTED: "red",
};
const STATUS_LABEL: Record<BlogCommentStatus, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

export default function BlogCommentsPage() {
  return (
    <RequireBlogAccess>
      <CommentsTable />
    </RequireBlogAccess>
  );
}

function CommentsTable() {
  const [statusFilter, setStatusFilter] = useState<BlogCommentStatus | "">("PENDING");
  const commentsQuery = useQuery(() => listCommentsAdmin(statusFilter || undefined), [statusFilter]);
  const postsQuery = useQuery(() => listPostsAdmin(), []);

  const postTitle = useMemo(() => {
    const map = new Map<number, string>();
    for (const p of postsQuery.data ?? []) map.set(p.id, p.title);
    return map;
  }, [postsQuery.data]);

  async function moderate(comment: BlogComment, decision: "APPROVED" | "REJECTED") {
    try {
      await moderateComment(comment.id, decision);
      notifySuccess(decision === "APPROVED" ? "Commentaire approuvé" : "Commentaire rejeté");
      commentsQuery.refetch();
    } catch (err) {
      notifyError(err);
    }
  }

  const columns: Column<BlogComment>[] = [
    {
      key: "post",
      header: "Article",
      accessor: (c) => postTitle.get(c.postId) ?? "",
      render: (c) => <span className="text-gray-700">{postTitle.get(c.postId) ?? `#${c.postId}`}</span>,
    },
    {
      key: "author",
      header: "Auteur",
      accessor: (c) => c.authorName,
      render: (c) => (
        <div>
          <p className="font-medium text-gray-900">{c.authorName}</p>
          <p className="text-xs text-gray-400">{c.authorEmail}</p>
        </div>
      ),
    },
    {
      key: "content",
      header: "Commentaire",
      render: (c) => <p className="max-w-md text-gray-600">{c.content}</p>,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (c) => c.status,
      render: (c) => <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>,
    },
    {
      key: "date",
      header: "Date",
      accessor: (c) => c.createdAt,
      render: (c) => <span className="text-gray-500">{formatDateTime(c.createdAt)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (c) =>
        c.status === "PENDING" ? (
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" className="text-emerald-600" onClick={() => moderate(c, "APPROVED")}>Approuver</Button>
            <Button size="sm" variant="ghost" className="text-error-600" onClick={() => moderate(c, "REJECTED")}>Rejeter</Button>
          </div>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Modération des commentaires</h1>
          <p className="text-sm text-slate-500">Un commentaire visiteur n&apos;est visible publiquement qu&apos;après approbation.</p>
        </div>
        <Button variant="secondary" component="a" href="/platform/blog/posts">Retour aux articles</Button>
      </div>

      <Select className="max-w-[220px]" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as BlogCommentStatus | "")}>
        <option value="PENDING">En attente</option>
        <option value="APPROVED">Approuvés</option>
        <option value="REJECTED">Rejetés</option>
        <option value="">Tous</option>
      </Select>

      <DataTable
        columns={columns}
        rows={commentsQuery.data ?? []}
        loading={commentsQuery.loading}
        error={!!commentsQuery.error}
        getRowKey={(c) => c.id}
        emptyLabel="Aucun commentaire."
      />
    </div>
  );
}
