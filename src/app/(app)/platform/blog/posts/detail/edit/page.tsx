import { Suspense } from "react";
import EditBlogPostPage from "./edit-blog-post-client";

export default function Page() {
  return (
    <Suspense>
      <EditBlogPostPage />
    </Suspense>
  );
}
