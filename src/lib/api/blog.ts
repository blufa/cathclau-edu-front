import { api } from "@/lib/api/client";
import type {
  AdjacentPosts,
  BlogCategory,
  BlogComment,
  BlogCommentStatus,
  BlogCommentSubmission,
  BlogPost,
  BlogPostInput,
  BlogPostStatus,
  BlogPostSummary,
  PublicBlogComment,
} from "@/lib/types/blog";

// ── Public : lecture des articles publiés + commentaires ────────────────────

export function listPublicPosts(params?: { categoryId?: number; tag?: string; search?: string }): Promise<BlogPostSummary[]> {
  return api.get<BlogPostSummary[]>("/public/blog/posts", { auth: false, query: params });
}

export function getPublicPost(slug: string): Promise<BlogPost> {
  return api.get<BlogPost>(`/public/blog/posts/${encodeURIComponent(slug)}`, { auth: false });
}

export function getAdjacentPosts(slug: string): Promise<AdjacentPosts> {
  return api.get<AdjacentPosts>(`/public/blog/posts/${encodeURIComponent(slug)}/adjacent`, { auth: false });
}

export function listPublicCategories(): Promise<BlogCategory[]> {
  return api.get<BlogCategory[]>("/public/blog/categories", { auth: false });
}

export function listPublicTags(): Promise<string[]> {
  return api.get<string[]>("/public/blog/tags", { auth: false });
}

export function listPublicComments(postId: number): Promise<PublicBlogComment[]> {
  return api.get<PublicBlogComment[]>(`/public/blog/posts/${postId}/comments`, { auth: false });
}

export function submitComment(postId: number, input: BlogCommentSubmission): Promise<PublicBlogComment> {
  return api.post<PublicBlogComment>(`/public/blog/posts/${postId}/comments`, input, { auth: false });
}

// ── Back-office : gestion des articles, catégories, modération ──────────────

export function listPostsAdmin(status?: BlogPostStatus): Promise<BlogPost[]> {
  return api.get<BlogPost[]>("/platform/blog/posts", { query: { status } });
}

export function getPostAdmin(id: number): Promise<BlogPost> {
  return api.get<BlogPost>(`/platform/blog/posts/${id}`);
}

export function createPost(input: BlogPostInput): Promise<BlogPost> {
  return api.post<BlogPost>("/platform/blog/posts", input);
}

export function updatePost(id: number, input: BlogPostInput): Promise<BlogPost> {
  return api.put<BlogPost>(`/platform/blog/posts/${id}`, input);
}

export function deletePost(id: number): Promise<void> {
  return api.delete<void>(`/platform/blog/posts/${id}`);
}

export function publishPost(id: number): Promise<BlogPost> {
  return api.patch<BlogPost>(`/platform/blog/posts/${id}/publish`);
}

export function unpublishPost(id: number): Promise<BlogPost> {
  return api.patch<BlogPost>(`/platform/blog/posts/${id}/unpublish`);
}

export function listCategoriesAdmin(): Promise<BlogCategory[]> {
  return api.get<BlogCategory[]>("/platform/blog/categories");
}

export function createCategory(label: string, slug?: string): Promise<BlogCategory> {
  return api.post<BlogCategory>("/platform/blog/categories", { label, slug });
}

export function updateCategory(id: number, label: string, slug?: string): Promise<BlogCategory> {
  return api.put<BlogCategory>(`/platform/blog/categories/${id}`, { label, slug });
}

export function deleteCategory(id: number): Promise<void> {
  return api.delete<void>(`/platform/blog/categories/${id}`);
}

export function listCommentsAdmin(status?: BlogCommentStatus): Promise<BlogComment[]> {
  return api.get<BlogComment[]>("/platform/blog/comments", { query: { status } });
}

export function moderateComment(id: number, decision: "APPROVED" | "REJECTED"): Promise<BlogComment> {
  return api.patch<BlogComment>(`/platform/blog/comments/${id}/moderate`, { decision });
}
