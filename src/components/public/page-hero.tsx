/** Compact teal page header used by static public pages (legal, help, …). */
export function PageHero({ eyebrow, title, subtitle }: { eyebrow?: string; title: string; subtitle?: string }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 to-brand-900 px-4 py-20 text-center text-white">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,.12),transparent_60%)]" />
      <div className="relative mx-auto max-w-3xl">
        {eyebrow && (
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-200">{eyebrow}</p>
        )}
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mx-auto mt-4 max-w-xl text-brand-100">{subtitle}</p>}
      </div>
    </section>
  );
}
