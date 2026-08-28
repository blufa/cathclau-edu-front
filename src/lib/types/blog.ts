export type BlogPostStatus = "DRAFT" | "PUBLISHED";
export type BlogCommentStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  contentHtml: string;
  categoryId: number | null;
  authorId: number;
  tags: string[];
  status: BlogPostStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}

/** Version allégée renvoyée par les listes (cartes) — sans le contenu HTML complet. */
export type BlogPostSummary = Pick<
  BlogPost,
  "id" | "slug" | "title" | "excerpt" | "coverImageUrl" | "categoryId" | "tags" | "status" | "publishedAt"
>;

export interface BlogCategory {
  id: number;
  label: string;
  slug: string;
}

export interface BlogComment {
  id: number;
  postId: number;
  authorName: string;
  authorEmail: string;
  website: string | null;
  content: string;
  status: BlogCommentStatus;
  createdAt: string;
}

/** Vue publique d'un commentaire — ne contient jamais l'e-mail du visiteur. */
export interface PublicBlogComment {
  id: number;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface BlogPostInput {
  title: string;
  slug?: string;
  excerpt?: string;
  coverImageUrl?: string;
  contentHtml: string;
  categoryId?: number | null;
  tags?: string[];
}

export interface BlogCommentSubmission {
  authorName: string;
  authorEmail: string;
  website?: string;
  content: string;
}

export interface AdjacentPosts {
  previous: BlogPostSummary | null;
  next: BlogPostSummary | null;
}
