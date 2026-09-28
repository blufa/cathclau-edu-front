"use client";

import { useSearchParams } from "next/navigation";
import { RequireBlogAccess } from "@/components/platform/require-blog-access";
import { BlogPostForm } from "@/components/platform/blog-post-form";
import { getPostAdmin, updatePost } from "@/lib/api/blog";
import { useQuery } from "@/hooks/use-query";
import { Spinner } from "@/components/ui/spinner";

export default function EditBlogPostPage() {
  const searchParams = useSearchParams();
  const postId = Number(searchParams.get("id"));
  const postQuery = useQuery(() => getPostAdmin(postId), [postId]);

  return (
    <RequireBlogAccess>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Modifier l&apos;article</h1>
          <p className="text-sm text-slate-500">{postQuery.data?.title}</p>
        </div>
        {postQuery.loading && !postQuery.data ? (
          <div className="flex justify-center py-16"><Spinner /></div>
        ) : postQuery.data ? (
          <BlogPostForm initial={postQuery.data} onSubmit={(input) => updatePost(postId, input)} />
        ) : (
          <p className="text-sm text-error-600">Article introuvable.</p>
        )}
      </div>
    </RequireBlogAccess>
  );
}
