"use client";

import { useState } from "react";
import { Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Mail, MapPin, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/public/reveal";
import { AuroraBackground, Spotlight } from "@/components/ui/aceternity";
import { notifySuccess } from "@/lib/feedback";

const COORDS = [
  { icon: Mail, label: "E-mail", value: "contact@cathclau.edu", href: "mailto:contact@cathclau.edu" },
  { icon: Phone, label: "Téléphone", value: "+224 620 00 00 00", href: "tel:+224620000000" },
  { icon: MapPin, label: "Adresse", value: "Conakry, Guinée" },
];

export default function ContactPage() {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { name: "", email: "", subject: "", message: "" },
    validate: {
      name: (v) => (v ? null : "Requis"),
      email: (v) => (/^\S+@\S+\.\S+$/.test(v) ? null : "Email invalide"),
      message: (v) => (v.length >= 10 ? null : "Message trop court"),
    },
  });

  async function submit() {
    setLoading(true);
    // No contact backend yet — acknowledge locally.
    await new Promise((r) => setTimeout(r, 500));
    notifySuccess("Message envoyé. Notre équipe vous répondra rapidement.");
    form.reset();
    setLoading(false);
  }

  return (
    <>
      <AuroraBackground className="px-4 py-24 text-center">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#99f6e4" />
        <Reveal className="relative z-10 mx-auto max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Contact</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Parlons de votre établissement
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-600">
            Une question, une démo, un devis ? Écrivez-nous, on vous répond vite.
          </p>
        </Reveal>
      </AuroraBackground>

      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1fr_1.4fr]">
        {/* Coordinates */}
        <Reveal className="space-y-4">
          {COORDS.map((c) => {
            const Icon = c.icon;
            const inner = (
              <div className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{c.label}</p>
                  <p className="text-sm text-slate-600">{c.value}</p>
                </div>
              </div>
            );
            return c.href ? (
              <a key={c.label} href={c.href} className="block transition hover:opacity-90">
                {inner}
              </a>
            ) : (
              <div key={c.label}>{inner}</div>
            );
          })}
        </Reveal>

        {/* Form */}
        <Reveal delay={0.1}>
          <form
            onSubmit={form.onSubmit(submit)}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <Stack gap="md">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextInput label="Nom complet" withAsterisk {...form.getInputProps("name")} />
                <TextInput label="E-mail" withAsterisk {...form.getInputProps("email")} />
              </div>
              <TextInput label="Sujet" {...form.getInputProps("subject")} />
              <Textarea label="Message" autosize minRows={5} withAsterisk {...form.getInputProps("message")} />
              <Button type="submit" loading={loading} fullWidth>
                Envoyer le message
              </Button>
            </Stack>
          </form>
        </Reveal>
      </section>
    </>
  );
}
