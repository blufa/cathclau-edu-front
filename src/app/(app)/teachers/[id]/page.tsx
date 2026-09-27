import TeacherDetailPage from "./teacher-detail-client";

// Nécessaire pour que `output: "export"` accepte cette route dynamique (build desktop uniquement,
// voir next.config.ts, DESKTOP_BUILD) — le composant réel (déplacé dans teacher-detail-client.tsx,
// "use client") relit l'id réel depuis l'URL via `useParams()` une fois chargé, jamais depuis ce qui a
// été pré-rendu au build.
export function generateStaticParams() {
  return [{ id: "placeholder" }];
}

export default function Page() {
  return <TeacherDetailPage />;
}
