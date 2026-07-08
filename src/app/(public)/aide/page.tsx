import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CreditCard, GraduationCap, LifeBuoy, MessagesSquare, ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/public/page-hero";

export const metadata: Metadata = {
  title: "Centre d'aide — CathClau Edu",
};

const TOPICS = [
  { icon: GraduationCap, title: "Démarrer", text: "Créer son école, vérifier l'e-mail et inviter ses équipes.", href: "/signup" },
  { icon: BookOpen, title: "Scolarité", text: "Élèves, inscriptions, classes, notes et bulletins.", href: "/fonctionnalites" },
  { icon: CreditCard, title: "Facturation & paiements", text: "Frais, échéances et paiements mobile money.", href: "/fonctionnalites" },
  { icon: MessagesSquare, title: "Communication", text: "SMS, e-mail et WhatsApp aux familles.", href: "/fonctionnalites" },
  { icon: ShieldCheck, title: "Sécurité & accès", text: "Rôles, permissions et confidentialité des données.", href: "/#securite" },
  { icon: LifeBuoy, title: "Nous contacter", text: "Une question ? Notre équipe vous répond.", href: "/contact" },
];

export default function HelpPage() {
  return (
    <>
      <PageHero
        eyebrow="Support"
        title="Centre d'aide"
        subtitle="Trouvez rapidement des réponses, ou contactez notre équipe."
      />
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <Link
                key={t.title}
                href={t.href}
                className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-xl"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition group-hover:bg-brand-600 group-hover:text-white">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <h2 className="mt-4 text-lg font-semibold text-slate-900">{t.title}</h2>
                <p className="mt-1 text-sm text-slate-600">{t.text}</p>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
