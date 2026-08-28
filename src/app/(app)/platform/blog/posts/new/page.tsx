"use client";

import { RequireBlogAccess } from "@/components/platform/require-blog-access";
import { BlogPostForm } from "@/components/platform/blog-post-form";
import { createPost } from "@/lib/api/blog";

export default function NewBlogPostPage() {
  return (
    <RequireBlogAccess>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Nouvel article</h1>
          <p className="text-sm text-slate-500">Brouillon jusqu&apos;à publication.</p>
        </div>
        <BlogPostForm onSubmit={(input) => createPost(input)} />
      </div>
    </RequireBlogAccess>
  );
}
