import ClassDetailPage from "@/features/classes/components/detail-page";

// Nécessaire pour que `output: "export"` accepte cette route dynamique (build desktop uniquement,
// voir next.config.ts, DESKTOP_BUILD). La page reste un vrai SPA côté client une fois chargée : elle
// relit l'id réel depuis l'URL via `useParams()`, jamais depuis ce qui a été pré-rendu au build.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <ClassDetailPage />;
}
