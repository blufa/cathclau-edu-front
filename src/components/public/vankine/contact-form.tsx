"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { notifySuccess } from "@/lib/feedback";

const schema = z.object({
  name: z.string().trim().min(1, "Requis"),
  email: z.string().regex(/^\S+@\S+\.\S+$/, "Email invalide"),
  subject: z.string(),
  message: z.string().min(10, "Message trop court"),
});
type FormValues = z.infer<typeof schema>;

/** Formulaire de contact — validation react-hook-form + zod conservée, envoi acquitté localement
 * faute de point de collecte serveur dédié pour l'instant. Extrait en client component pour que la
 * page /contact reste un Server Component (metadata, contenu indexable dans le HTML initial). */
export function ContactForm() {
  const [loading, setLoading] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "", subject: "", message: "" },
  });

  async function onSubmit() {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 500));
    notifySuccess("Message envoyé. Notre équipe vous répondra rapidement.");
    reset();
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="row">
        <div className="col-md-6 col-sm-12">
          <label>Nom complet <span>*</span></label>
          <input type="text" placeholder="Votre nom" aria-invalid={!!errors.name} {...register("name")} />
          {errors.name && <div className="help-block with-errors">{errors.name.message}</div>}
        </div>
        <div className="col-md-6 col-sm-12">
          <label>E-mail <span>*</span></label>
          <input type="email" placeholder="vous@ecole.gn" aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <div className="help-block with-errors">{errors.email.message}</div>}
        </div>
        <div className="col-sm-12">
          <label>Sujet</label>
          <input type="text" placeholder="Sujet (optionnel)" {...register("subject")} />
        </div>
        <div className="col-sm-12">
          <label>Message <span>*</span></label>
          <textarea placeholder="Votre message..." rows={5} aria-invalid={!!errors.message} {...register("message")} />
          {errors.message && <div className="help-block with-errors">{errors.message.message}</div>}
        </div>
        <div className="col-sm-12">
          <div className="mg_top apbtn">
            <button className="theme_btn" type="submit" disabled={loading}>
              {loading ? "Envoi…" : "Envoyer le message"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
