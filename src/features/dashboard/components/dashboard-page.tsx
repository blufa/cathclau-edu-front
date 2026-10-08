"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, CalendarCheck, GraduationCap, MessageSquare, Percent, Receipt, Wallet, TrendingUp } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useSubscription } from "@/providers/subscription-provider";
import { setAutoRenewal } from "@/lib/api/platform";
import { Switch } from "@/components/ui/switch";
import { INVOICE_STATUS_LABEL, type Invoice, type InvoiceStatus } from "@/lib/types/billing";
import { CHANNEL_LABEL, REASON_LABEL } from "@/lib/types/communication";
import { EVENT_TYPE_LABEL, EVENT_TYPE_TONE } from "@/lib/types/calendar";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { CardSkeleton, StatCardSkeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { BarBreakdownChart, type BreakdownItem } from "@/components/charts/bar-breakdown-chart";
import { PieBreakdownChart } from "@/components/charts/pie-breakdown-chart";
import { SubscriptionStatusBadge } from "@/components/platform/status-badge";
import { QuotaProgress } from "@/components/platform/quota-progress";
import { PendingSubscriptionBanner } from "@/components/platform/pending-subscription-banner";
import { Reveal } from "@/components/public/reveal";
import { formatDate, formatDateTime, formatGNF } from "@/lib/format";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { GettingStarted } from "./getting-started";
import {
  useAcademicDashboardQuery,
  useAverageDistributionQuery,
  useCurrentPeriodQuery,
  useRecentCommunicationsQuery,
  useRecentInvoicesQuery,
  useStudentsCountQuery,
  useTodayAttendanceQuery,
  useUpcomingEventsQuery,
  useUpcomingInstallmentsQuery,
} from "../hooks/use-dashboard";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];

const STATUS_COLOR: Record<string, string> = { PAID: "#10b981", PARTIAL: "#f59e0b", UNPAID: "#f43f5e", CANCELLED: "#cbd5e1" };
const STATUS_TONE: Record<InvoiceStatus, "green" | "amber" | "red" | "gray"> = { PAID: "green", PARTIAL: "amber", UNPAID: "red", CANCELLED: "gray" };

const num = (v: string | number | null | undefined) => Number(v ?? 0);

/** 6 derniers mois : frais émis vs encaissés, d'après la date d'émission des factures élèves. */
function billingByMonth(invoices: Invoice[]) {
  const map = new Map<string, { emis: number; encaisse: number }>();
  for (const i of invoices) {
    const key = (i.issueDate ?? "").slice(0, 7);
    if (!key) continue;
    const cur = map.get(key) ?? { emis: 0, encaisse: 0 };
    cur.emis += num(i.totalAmount);
    cur.encaisse += num(i.paidAmount);
    map.set(key, cur);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([key, v]) => ({
    name: MONTHS[Number(key.slice(5, 7)) - 1] ?? key,
    Émis: Math.round(v.emis),
    Encaissé: Math.round(v.encaisse),
  }));
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
  const { subscription, plan, tenantStatus, loading: subLoading, tenantScoped, refresh } = useSubscription();
  const tenantId = user?.tenantId ?? null;

  const studentsQuery = useStudentsCountQuery(tenantScoped);
  const invoicesQuery = useRecentInvoicesQuery(tenantId, tenantScoped);
  const periodQuery = useCurrentPeriodQuery(tenantScoped);
  const currentPeriod = periodQuery.data ?? null;
  const academicQuery = useAcademicDashboardQuery(currentPeriod?.id ?? null, tenantScoped);
  const academicClassIds = (academicQuery.data?.classes ?? []).map((c) => c.classId);
  const distributionQuery = useAverageDistributionQuery(academicClassIds, currentPeriod?.id ?? null, tenantScoped && !!academicQuery.data);
  const communicationsQuery = useRecentCommunicationsQuery(tenantId, tenantScoped);
  const attendanceQuery = useTodayAttendanceQuery(tenantScoped);
  const upcomingInstallmentsQuery = useUpcomingInstallmentsQuery(tenantScoped);
  const upcomingEventsQuery = useUpcomingEventsQuery(tenantScoped);
  // Guide « Premiers pas » : contenu 100% configuration (classes, enseignants, logo, modèles...) et
  // appels à des endpoints réservés à l'admin (profil école, modèles de message) — ne doit se
  // déclencher que pour les rôles qui font réellement cette configuration, pas pour tout le monde
  // atterrissant sur /dashboard (ex. Comptable, Secrétaire), sous peine d'« Access denied » en boucle.
  const canSetup = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  if (!user) return null;

  const invoices = invoicesQuery.data ?? [];
  const consumed = studentsQuery.data?.totalElements ?? 0;
  const totalBilled = invoices.reduce((s, i) => s + num(i.totalAmount), 0);
  const totalPaid = invoices.reduce((s, i) => s + num(i.paidAmount), 0);
  const due = invoices.reduce((s, i) => s + num(i.remainingBalance ?? num(i.totalAmount) - num(i.paidAmount)), 0);
  const recovery = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  // Les factures PARTIELLEMENT payées restent dues (donc comptées ici) — sans ça, ce compteur ne
  // correspondait pas au "Reste à recouvrer" juste au-dessus, qui lui somme bien les deux statuts
  // (retour comptable : écart observé avec "Impayés" du rapport, qui comptait déjà les deux).
  const unpaidCount = invoices.filter((i) => i.status === "UNPAID" || i.status === "PARTIAL").length;
  const excludedCount = invoices.filter((i) => i.recoveryStage === "EXCLUDED").length;
  const monthly = billingByMonth(invoices);
  const breakdown = statusBreakdown(invoices);
  const quotaNearLimit = plan?.studentLimit != null && consumed >= plan.studentLimit * 0.9;
  // École qui a déjà des données réelles → on affiche le tableau financier ; sinon (école neuve) on
  // laisse le guide « Premiers pas » être le centre de la page, sans widgets vides qui l'encombrent.
  const hasData = consumed > 0 || invoices.length > 0;

  async function toggleAutoRenew(enabled: boolean) {
    if (!subscription) return;
    try {
      await setAutoRenewal(subscription.id, enabled);
      notifySuccess(enabled ? "Renouvellement automatique activé" : "Renouvellement automatique désactivé");
      refresh();
    } catch (err) { notifyError(err); }
  }

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

          {/* Activité pédagogique — présences du jour, moyenne générale, réussite, messages récents,
              prochaines échéances, répartition des moyennes élèves (période scolaire actuellement
              ouverte). */}
          {(attendanceQuery.data || (academicQuery.data && Number(academicQuery.data.studentCount) > 0)) && (
          <Reveal y={12}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {attendanceQuery.data && (
                <StatCard title="Présences aujourd'hui"
                  value={attendanceQuery.data.expectedCount > 0 ? `${attendanceQuery.data.presentPercentage}%` : "—"}
                  icon={CalendarCheck} accent="teal"
                  hint={attendanceQuery.data.expectedCount > 0
                    ? `${attendanceQuery.data.presentCount}/${attendanceQuery.data.expectedCount} élèves présents`
                    : "Aucun élève inscrit"} />
              )}
              {academicQuery.data && Number(academicQuery.data.studentCount) > 0 && (
                <>
                  <StatCard title="Moyenne générale" value={`${academicQuery.data.overallAverage}/20`} icon={GraduationCap} accent="amber"
                    hint={currentPeriod?.label ?? undefined} />
                  <StatCard title="Taux de réussite" value={`${academicQuery.data.passRate}%`} icon={Percent} accent="emerald"
                    trend={{ value: `${academicQuery.data.passRate}%`, positive: Number(academicQuery.data.passRate) >= 70 }} />
                </>
              )}
            </div>
          </Reveal>
          )}

          {(communicationsQuery.data?.length || distributionQuery.data || upcomingInstallmentsQuery.data || upcomingEventsQuery.data) && (
          <Reveal y={12}>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardHeader><CardTitle>Messages récents</CardTitle></CardHeader>
                <CardBody>
                  {!communicationsQuery.data || communicationsQuery.data.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">Aucune communication envoyée.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {communicationsQuery.data.map((c) => (
                        <li key={c.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-2 font-medium text-gray-900">
                              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                              {c.subject || REASON_LABEL[c.reason]}
                            </p>
                            <p className="truncate text-xs text-gray-500">{CHANNEL_LABEL[c.channel]} — {c.content}</p>
                          </div>
                          <span className="shrink-0 text-xs text-gray-400">{c.sentAt ? formatDateTime(c.sentAt) : "—"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="pt-3"><Button component={Link} href="/communications" size="sm" variant="ghost">Toutes les communications →</Button></div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Prochaines échéances</CardTitle></CardHeader>
                <CardBody>
                  {!upcomingInstallmentsQuery.data || upcomingInstallmentsQuery.data.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">Aucune échéance de frais à venir.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {upcomingInstallmentsQuery.data.map((i) => (
                        <li key={i.installmentId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <div className="flex items-center gap-2 text-gray-900">
                            <CalendarClock className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                            {i.label}
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-gray-900">{formatGNF(i.amount)}</p>
                            <p className="text-xs text-gray-400">{formatDate(i.dueDate)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Prochains événements</CardTitle></CardHeader>
                <CardBody>
                  {!upcomingEventsQuery.data || upcomingEventsQuery.data.length === 0 ? (
                    <p className="py-6 text-center text-sm text-gray-400">Aucun événement à venir.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {upcomingEventsQuery.data.map((e) => (
                        <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-900">{e.title}</p>
                            <Badge tone={EVENT_TYPE_TONE[e.eventType]}>{EVENT_TYPE_LABEL[e.eventType]}</Badge>
                          </div>
                          <span className="shrink-0 text-xs text-gray-400">{formatDate(e.startDate)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="pt-3"><Button component={Link} href="/calendar" size="sm" variant="ghost">Tout le calendrier →</Button></div>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Résumé des performances</CardTitle></CardHeader>
                <CardBody>
                  {distributionQuery.error ? (
                    <p className="py-10 text-center text-sm text-gray-400">Aucune donnée disponible.</p>
                  ) : !distributionQuery.data ? (
                    <div className="flex justify-center py-10"><Spinner /></div>
                  ) : (
                    <PieBreakdownChart
                      centerLabel="élèves notés"
                      data={[
                        { name: "Excellents (16-20)", value: distributionQuery.data.excellent, color: "#10b981" },
                        { name: "Bien (14-16)", value: distributionQuery.data.bien, color: "#6366f1" },
                        { name: "Assez bien (10-14)", value: distributionQuery.data.assezBien, color: "#f59e0b" },
                        { name: "À améliorer (<10)", value: distributionQuery.data.aAmeliorer, color: "#f43f5e" },
                      ]}
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          </Reveal>
          )}

          {/* Charts — frais élèves */}
          {hasData && (
          <Reveal y={12}>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader><CardTitle>Frais scolaires — 6 derniers mois</CardTitle></CardHeader>
                <CardBody>
                  {monthly.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">Pas encore de factures de frais émises.</p>
                  ) : (
                    <BarTrendChart data={monthly} valueFormatter={(v) => formatGNF(v)}
                      series={[{ key: "Émis", name: "Émis", color: "#6366f1" }, { key: "Encaissé", name: "Encaissé", color: "#14b8a6" }]} />
                  )}
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

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Mon abonnement</CardTitle></CardHeader>
              <CardBody className="space-y-3 text-sm text-gray-700">
                {subscription ? (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">Plan</span><span>{plan?.name ?? "—"}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Statut</span><SubscriptionStatusBadge status={subscription.status} /></div>
                    <div className="flex justify-between"><span className="text-gray-500">Fin de période</span><span>{formatDate(subscription.endDate)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">Montant</span><span>{formatGNF(subscription.amount)}</span></div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Renouvellement auto</span>
                      <Switch checked={!!subscription.autoRenewal} onChange={toggleAutoRenew} ariaLabel="Renouvellement automatique" />
                    </div>
                    <div className="flex gap-2 pt-2"><Button component={Link} href="/subscription" size="sm">Gérer l&apos;abonnement</Button></div>
                  </>
                ) : tenantStatus === "ACTIVE" ? (
                  <div className="space-y-2">
                    <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-medium text-success-600">École activée</span></div>
                    <p className="text-xs text-gray-400">Votre établissement est actif. Aucune action requise.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-gray-500">
                      {tenantStatus === "TRIAL" ? "Vous êtes en période d'essai. Choisissez un plan pour continuer." : "Choisissez un plan pour activer durablement votre école."}
                    </p>
                    <Button component={Link} href="/subscription" size="sm">Voir les plans</Button>
                  </div>
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader><CardTitle>Quota élèves</CardTitle></CardHeader>
              <CardBody><QuotaProgress consumed={consumed} limit={plan?.studentLimit ?? null} /></CardBody>
            </Card>
          </div>

          {/* Dernières factures élèves */}
          {hasData && (
          <Card>
            <CardHeader><CardTitle>Dernières factures élèves</CardTitle></CardHeader>
            <CardBody>
              {invoicesQuery.isLoading ? (
                <div className="flex justify-center py-6"><Spinner /></div>
              ) : invoices.length === 0 ? (
                <p className="text-sm text-gray-400">Aucune facture de frais émise pour le moment.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {[...invoices].sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? "")).slice(0, 6).map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                      <span className="font-mono text-xs text-gray-600">{inv.reference}</span>
                      <span className="flex-1 truncate text-gray-500">{inv.periodLabel ?? "Frais"}</span>
                      <span className="text-gray-700">{formatGNF(inv.totalAmount)}</span>
                      <Badge tone={STATUS_TONE[inv.status]}>{INVOICE_STATUS_LABEL[inv.status]}</Badge>
                      <span className="text-gray-500">{formatDate(inv.issueDate)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="pt-3"><Button component={Link} href="/invoices" size="sm" variant="ghost">Toutes les factures →</Button></div>
            </CardBody>
          </Card>
          )}
        </>
      )}
    </div>
  );
}
