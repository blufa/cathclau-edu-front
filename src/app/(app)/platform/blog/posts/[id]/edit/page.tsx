import EditBlogPostPage from "./edit-blog-post-client";

// Nécessaire pour que `output: "export"` accepte cette route dynamique (build desktop uniquement,
// voir next.config.ts, DESKTOP_BUILD) — voir teachers/[id]/page.tsx pour l'explication complète.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <EditBlogPostPage />;
}
