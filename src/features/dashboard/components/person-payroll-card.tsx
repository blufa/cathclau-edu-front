import { Badge } from "@/components/ui/badge";
import { formatGNF } from "@/lib/format";

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function attendanceTone(rate: number): "green" | "amber" | "red" {
  if (rate >= 90) return "green";
  if (rate >= 75) return "amber";
  return "red";
}

/**
 * Carte verticale « personne » (enseignant ou membre du personnel) pour la Vision Fondateur — photo
 * (ou initiales en dégradé, même repli que partout ailleurs dans l'app quand aucune photo n'est
 * renseignée) + montant(s) de paie + assiduité optionnelle. Remplace les tableaux denses pour donner
 * une vue plus lisible d'un coup d'œil sur qui coûte quoi.
 */
export function PersonPayrollCard({
  name,
  photoUrl,
  subtitle,
  monthlyAmount,
  monthlyLabel = "Ce mois",
  secondaryAmount,
  secondaryLabel,
  attendanceRate,
}: {
  name: string;
  photoUrl?: string | null;
  subtitle?: string | null;
  monthlyAmount: number;
  monthlyLabel?: string;
  secondaryAmount?: number;
  secondaryLabel?: string;
  /** Taux d'assiduité (%) — badge affiché uniquement si fourni (non pertinent pour le personnel non-enseignant). */
  attendanceRate?: number | null;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white">
          {initialsOf(name)}
        </div>
      )}
      <p className="mt-3 truncate text-sm font-semibold text-gray-900" title={name}>{name}</p>
      {subtitle && <p className="truncate text-xs text-gray-500" title={subtitle}>{subtitle}</p>}
      {attendanceRate != null && (
        <Badge tone={attendanceTone(attendanceRate)} className="mt-1.5">
          Assiduité {attendanceRate.toFixed(0)} %
        </Badge>
      )}
      <div className="mt-3 w-full border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400">{monthlyLabel}</p>
        <p className="text-sm font-bold text-gray-900">{formatGNF(monthlyAmount)}</p>
        {secondaryAmount != null && (
          <>
            <p className="mt-2 text-xs text-gray-400">{secondaryLabel}</p>
            <p className="text-sm font-semibold text-brand-700">{formatGNF(secondaryAmount)}</p>
          </>
        )}
      </div>
    </div>
  );
}
