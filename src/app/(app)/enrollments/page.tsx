import { redirect } from "next/navigation";

// L'onglet "Inscriptions" (ancien écran register-page) est masqué de la barre — arriver sur
// /enrollments directement doit amener sur "Nouvelle inscription", devenu le point d'entrée
// principal, plutôt que d'afficher une page sans onglet actif.
export default function EnrollmentsIndexPage() {
  redirect("/enrollments/bulk-family");
}
