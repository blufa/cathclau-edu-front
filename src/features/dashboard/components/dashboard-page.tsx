"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Banknote, GraduationCap, HandCoins, Landmark, Receipt, Wallet, TrendingUp } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useSubscription } from "@/providers/subscription-provider";
import { INVOICE_STATUS_LABEL, type Invoice, type InvoiceStatus } from "@/lib/types/billing";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { BarBreakdownChart, type BreakdownItem } from "@/components/charts/bar-breakdown-chart";
import { PieBreakdownChart } from "@/components/charts/pie-breakdown-chart";
import { PendingSubscriptionBanner } from "@/components/platform/pending-subscription-banner";
import { Reveal } from "@/components/public/reveal";
import { formatDate, formatGNF } from "@/lib/format";
import { GettingStarted } from "./getting-started";
import {
  useAttendanceHistoryQuery,
  useMonthlyFinancialSummaryQuery,
  useRecentInvoicesQuery,
  useStudentsCountQuery,
} from "../hooks/use-dashboard";

const STATUS_COLOR: Record<string, string> = { PAID: "#10b981", PARTIAL: "#f59e0b", UNPAID: "#f43f5e", CANCELLED: "#cbd5e1" };

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/** "YYYY-MM" du mois courant — valeur par défaut du filtre et borne max du sélecteur (pas de mois
 * futur, qui n'aurait aucune fiche de paie). */
function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function statusBreakdown(invoices: Invoice[]): BreakdownItem[] {
  const counts = new Map<string, number>();
  for (const i of invoices) counts.set(i.status, (counts.get(i.status) ?? 0) + 1);
  return [...counts.entries()].map(([status, value]) => ({
    name: INVOICE_STATUS_LABEL[status as InvoiceStatus] ?? status,
    value,
    color: STATUS_COLOR[status] ?? "#94a3b8",
  }));
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { plan, loading: subLoading, tenantScoped } = useSubscription();
  const tenantId = user?.tenantId ?? null;

  // Filtre par mois de l'État financier (§retour comptable : "si je choisi par mois il fait sortir
  // l'état financier du mois et le cumul qui s'affiche") — pilote aussi bien la répartition de la
  // masse salariale que le cumul des salaires réellement payés ce mois-là.
  const [period, setPeriod] = useState(currentPeriod());
  const [periodYear, periodMonth] = period.split("-").map(Number);

  const studentsQuery = useStudentsCountQuery(tenantScoped);
  const invoicesQuery = useRecentInvoicesQuery(tenantId, tenantScoped);
  const attendanceHistoryQuery = useAttendanceHistoryQuery(tenantScoped);
  const financialSummaryQuery = useMonthlyFinancialSummaryQuery(tenantScoped, periodYear, periodMonth);
  // Guide « Premiers pas » : contenu 100% configuration (classes, enseignants, logo, modèles...) et
  // appels à des endpoints réservés à l'admin (profil école, modèles de message) — ne doit se
  // déclencher que pour les rôles qui font réellement cette configuration, pas pour tout le monde
  // atterrissant sur /dashboard (ex. Comptable, Secrétaire), sous peine d'« Access denied » en boucle.
  const canSetup = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  if (!user) return null;

  const invoices = invoicesQuery.data ?? [];
  const consumed = studentsQuery.data?.totalElements ?? 0;
  const totalBilled = invoices.reduce((s, i) => s + num(i.totalAmount), 0);
  // §retour comptable, écart constaté en production (~5-6M GNF) : paidAmount inclut le crédit reporté
  // d'un transfert de classe (creditedAmount) — déjà compté une fois comme encaissé sur l'ANCIENNE
  // facture, jamais un nouvel encaissement. Sans la soustraction, "Encaissé" comptait cet argent deux
  // fois (même correctif que SchoolBillingStatsProviderAdapter#computeStats côté backend).
  const totalPaid = invoices.reduce((s, i) => s + num(i.paidAmount) - num(i.creditedAmount), 0);
  const due = invoices.reduce((s, i) => s + num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount)), 0);
  const recovery = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  // Les factures PARTIELLEMENT payées restent dues (donc comptées ici) — sans ça, ce compteur ne
  // correspondait pas au "Reste à recouvrer" juste au-dessus, qui lui somme bien les deux statuts
  // (retour comptable : écart observé avec "Impayés" du rapport, qui comptait déjà les deux).
  const unpaidCount = invoices.filter((i) => i.status === "UNPAID" || i.status === "PARTIAL").length;
  const excludedCount = invoices.filter((i) => i.recoveryStage === "EXCLUDED").length;
  const breakdown = statusBreakdown(invoices);
  const attendanceHistory = attendanceHistoryQuery.data ?? [];
  const attendanceTotals = attendanceHistory.reduce(
    (acc, d) => ({
      present: acc.present + d.presentCount,
      absent: acc.absent + d.absentCount,
      late: acc.late + d.lateCount,
    }),
    { present: 0, absent: 0, late: 0 },
  );
  const financialSummary = financialSummaryQuery.data ?? null;
  // Affiché explicitement sur la carte : l'état financier suit le mois choisi dans le filtre, jamais
  // figé sur le mois courant (retour fondateur : "État financier du mois c'est chaque mois ça change").
  const periodLabel = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" })
    .format(new Date(periodYear, periodMonth - 1, 1));
  // Sortie de caisse réelle pour la paie du mois sélectionné = salaires RÉELLEMENT payés + avances
  // accordées (une avance EST une sortie de caisse immédiate, retour comptable) — jamais une masse
  // salariale théorique calculée. Partagé par les deux cartes ci-dessous : "Cumul payé pour la paie"
  // l'affiche telle quelle, "Encaissé net" la soustrait de l'encaissé — les deux bougent donc
  // immédiatement dès qu'une avance est accordée ou qu'une fiche est marquée payée.
  const actualPaidSalaries = financialSummary
    ? num(financialSummary.actualPaidSalariesTotal) + num(financialSummary.salaryAdvancesTotal)
    : null;
  const netCollected = actualPaidSalaries != null ? totalPaid - actualPaidSalaries : null;
  const quotaNearLimit = plan?.studentLimit != null && consumed >= plan.studentLimit * 0.9;
  // École qui a déjà des données réelles → on affiche le tableau financier ; sinon (école neuve) on
  // laisse le guide « Premiers pas » être le centre de la page, sans widgets vides qui l'encombrent.
  const hasData = consumed > 0 || invoices.length > 0;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-600 to-brand-500 p-6 text-white shadow-sm">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-12 right-24 h-32 w-32 rounded-full bg-white/10" />
        <div className="relative">
          <h1 className="text-2xl font-bold tracking-tight">Bonjour {user.firstName} 👋</h1>
          <p className="mt-1 text-sm text-white/85">
            {tenantScoped && !hasData && !studentsQuery.isLoading && !invoicesQuery.isLoading
              ? "Configurons votre établissement — suivez le guide ci-dessous, étape par étape."
              : "Voici un aperçu de votre établissement aujourd'hui."}
          </p>
        </div>
      </div>

      {tenantScoped && <PendingSubscriptionBanner />}

      {/* Bannière cliquable vers le guide « Premiers pas » (page dédiée /onboarding) — se masque une
          fois configuré ou fermée manuellement. Réservée aux rôles qui font la configuration. */}
      {tenantScoped && canSetup && <GettingStarted compact />}

      {/* École sans donnée encore (ni élève, ni facture) ET rôle qui ne fait pas la configuration
          (comptable, secrétaire...) : le guide « Premiers pas » ci-dessus ne s'affiche pas pour eux
          (réservé aux admins), la page serait donc quasiment vide sans ce message explicite — pas une
          erreur, juste rien à afficher pour l'instant. */}
      {tenantScoped && !subLoading && !canSetup && !hasData && !studentsQuery.isLoading && !invoicesQuery.isLoading && (
        <Card>
          <CardBody className="py-10 text-center text-sm text-gray-500">
            Aucune donnée à afficher pour le moment — l&apos;établissement n&apos;a pas encore d&apos;élèves
            ou de factures enregistrés.
          </CardBody>
        </Card>
      )}

      {!tenantScoped ? (
        <Card>
          <CardBody className="text-sm text-gray-600">
            Vous êtes connecté en tant qu&apos;administrateur de la plateforme. Rendez-vous dans
            l&apos;espace <Link href="/platform/tenants" className="text-brand-700 hover:underline">Plateforme</Link>.
          </CardBody>
        </Card>
      ) : subLoading ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <CardSkeleton lines={6} /><CardSkeleton lines={6} /><CardSkeleton lines={6} />
          </div>
        </div>
      ) : (
        <>
          {/* Alertes */}
          {(unpaidCount > 0 || excludedCount > 0 || quotaNearLimit) && (
            <Reveal y={8}>
              <div className="flex flex-wrap gap-2">
                {unpaidCount > 0 && (
                  <Link href="/invoices" className="inline-flex items-center gap-2 rounded-xl bg-error-50 px-3 py-2 text-sm text-error-700 hover:bg-error-100">
                    <AlertTriangle className="h-4 w-4" /> {unpaidCount} facture(s) impayée(s)
                  </Link>
                )}
                {excludedCount > 0 && (
                  <Link href="/invoices" className="inline-flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-800 hover:bg-warning-100">
                    <AlertTriangle className="h-4 w-4" /> {excludedCount} élève(s) exclu(s) pour impayé
                  </Link>
                )}
                {quotaNearLimit && (
                  <Link href="/subscription" className="inline-flex items-center gap-2 rounded-xl bg-warning-50 px-3 py-2 text-sm text-warning-800 hover:bg-warning-100">
                    <AlertTriangle className="h-4 w-4" /> Quota élèves bientôt atteint
                  </Link>
                )}
              </div>
            </Reveal>
          )}

          {/* KPI cards — données scolaires réelles (masqués tant qu'aucune donnée : école neuve) */}
          {hasData && (
          <Reveal y={12}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Élèves inscrits" value={consumed} icon={GraduationCap} accent="teal"
                hint={plan?.studentLimit != null ? `Limite : ${plan.studentLimit}` : "Plan illimité"} />
              <StatCard title="Frais facturés" value={formatGNF(totalBilled)} icon={Receipt} accent="indigo"
                hint={`Encaissé : ${formatGNF(totalPaid)}`} />
              <StatCard title="Reste à recouvrer" value={formatGNF(due)} icon={Wallet} accent={due > 0 ? "rose" : "emerald"}
                hint={`${unpaidCount} impayée(s)`} />
              <StatCard title="Taux de recouvrement" value={`${recovery}%`} icon={TrendingUp} accent="sky"
                trend={{ value: `${recovery}%`, positive: recovery >= 70 }} />
            </div>
          </Reveal>
          )}

          {/* Cartes à part (pas dans la grille 4 colonnes ci-dessus) : dérivées de DEUX sources
              (facturation + paie), mises en avant plutôt que noyées/orphelines dans une grille prévue
              pour 4 cartes. Le cumul des salaires payés (droite) suit le même filtre par mois que
              l'État financier ci-dessous (§retour comptable). */}
          {financialSummary && netCollected != null && (
          <Reveal y={12}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-5 shadow-sm ${
                netCollected >= 0 ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white shadow-sm ${
                    netCollected >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}>
                    <Landmark className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Encaissé net (après paie)</p>
                    <p className="text-xs text-gray-500">Encaissé moins salaires réellement payés et avances — {periodLabel}</p>
                  </div>
                </div>
                <p className={`text-2xl font-bold ${netCollected >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                  {formatGNF(netCollected)}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-white text-indigo-600 shadow-sm">
                    <Banknote className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Cumul payé pour la paie</p>
                    <p className="text-xs text-gray-500">
                      Salaires versés + avances accordées — {periodLabel}. S&apos;additionne à chaque paiement ou avance.
                    </p>
                  </div>
                </div>
                <p className="text-2xl font-bold text-indigo-700">
                  {formatGNF(actualPaidSalaries ?? 0)}
                </p>
              </div>
            </div>
          </Reveal>
          )}

          {(attendanceHistory.length > 0 || hasData) && (
          <Reveal y={12}>
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader><CardTitle>Présences, absences, retards des 14 derniers jours</CardTitle></CardHeader>
                <CardBody>
                  <PieBreakdownChart
                    centerLabel="Total 14 jours"
                    data={[
                      { name: "Présences", value: attendanceTotals.present, color: "#10b981" },
                      { name: "Absences", value: attendanceTotals.absent, color: "#f43f5e" },
                      { name: "Retards", value: attendanceTotals.late, color: "#f59e0b" },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Statut des factures élèves</CardTitle></CardHeader>
                <CardBody>
                  {breakdown.length === 0 ? <p className="py-10 text-center text-sm text-gray-400">Aucune facture.</p>
                    : <BarBreakdownChart data={breakdown} centerLabel="factures" />}
                </CardBody>
              </Card>
            </div>
          </Reveal>
          )}

          {/* État financier du mois — masse salariale (Maternelle/Primaire/Secondaire/Personnel) +
              avances sur salaire accordées ce mois (§retour fondateur), avec filtre par mois
              (§retour comptable) — le libellé et le cumul affichés suivent le mois choisi. */}
          {financialSummary && (
          <Reveal y={12}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle>État financier | {periodLabel}</CardTitle>
                  <div className="w-40">
                    <Label className="sr-only">Mois</Label>
                    <Input
                      type="month"
                      value={period}
                      max={currentPeriod()}
                      onChange={(e) => e.target.value && setPeriod(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                </CardHeader>
                <CardBody>
                  <PieBreakdownChart
                    centerLabel={`Total ${periodLabel}`}
                    valueFormatter={(v) => formatGNF(v)}
                    data={[
                      { name: "Enseignants Maternelle", value: num(financialSummary.maternelleTeacherPayroll), color: "#ec4899" },
                      { name: "Enseignants Primaire", value: num(financialSummary.primaryTeacherPayroll), color: "#6366f1" },
                      { name: "Enseignants Secondaire", value: num(financialSummary.secondaryTeacherPayroll), color: "#f59e0b" },
                      { name: "Personnel", value: num(financialSummary.staffPayroll), color: "#14b8a6" },
                      { name: "Avances sur salaire", value: num(financialSummary.salaryAdvancesTotal), color: "#f43f5e" },
                    ]}
                  />
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Avances sur salaire du mois</CardTitle></CardHeader>
                <CardBody>
                  {financialSummary.advances.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">Aucune avance accordée ce mois.</p>
                  ) : (
                    // max-h + scroll (§retour utilisateur : "le card de avance sur salaire beaucoup, il
                    // faut le limiter") — une carte de tableau de bord ne doit jamais grandir sans limite
                    // avec le nombre d'avances du mois, le détail complet reste accessible en scrollant.
                    <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                      {financialSummary.advances.map((a, idx) => (
                        <li key={idx} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-gray-900">
                              <HandCoins className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                              <span className="truncate font-medium">{a.employeeName}</span>
                            </div>
                            <p className="text-xs text-gray-400">{a.className ?? "—"}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{formatGNF(a.amount)}</p>
                            <p className="text-xs text-gray-400">{formatDate(a.grantedAt)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          </Reveal>
          )}
        </>
      )}
    </div>
  );
}
