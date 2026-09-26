import type { ReactNode } from "react";

// Plus d'onglets ici (§retour comptable, point 31) : /budget est désormais une destination unique
// (fiches de dépense mensuelles). /budget/annual (ancien "Budget annuel") et /budget/grants
// (Subventions) restent intacts et accessibles par URL directe, mais ne sont plus mis en avant.
export default function BudgetLayout({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
