"use client";

import { useState } from "react";
import { submitComment } from "@/lib/api/blog";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Formulaire de commentaire d'un article — isolé en client component pour que la page de détail
 * de l'article reste un Server Component (metadata dynamique, contenu indexable dès le HTML
 * initial). Les commentaires étant modérés avant publication, le nouveau commentaire n'a pas besoin
 * d'apparaître immédiatement dans la liste (déjà rendue côté serveur) : un message de confirmation
 * suffit, comme avant ce découpage. */
export function CommentForm({ postId }: { postId: number }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmitComment(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    try {
      await submitComment(postId, { authorName: name, authorEmail: email, website: website || undefined, content });
      notifySuccess("Commentaire envoyé — il sera visible après validation.");
      setName(""); setEmail(""); setWebsite(""); setContent("");
      setSubmitted(true);
    } catch (err) {
      notifyError(err);
    } finally {
      setSending(false);
    }
  }

  if (submitted) {
    return <p className="title_para">Merci, votre commentaire a bien été envoyé et sera publié après modération.</p>;
  }

  return (
    <form onSubmit={handleSubmitComment} id="commentform" className="comment-form">
      <p className="title_para">Votre adresse e-mail ne sera pas publiée.</p>
      <p className="comment-form-comment">
        <label>Laisser un commentaire</label>
        <textarea
          placeholder="Écrivez votre commentaire ici…" rows={12} required
          value={content} onChange={(e) => setContent(e.target.value)}
        />
      </p>
      <p className="comment-form-author">
        <label>Nom complet</label>
        <input placeholder="ex. Aïssatou Diallo" type="text" required value={name} onChange={(e) => setName(e.target.value)} />
      </p>
      <p className="comment-form-email">
        <label>Adresse e-mail</label>
        <input placeholder="ex. contact@ecole.gn" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </p>
      <p className="comment-form-url">
        <label>Site web (optionnel)</label>
        <input placeholder="ex. www.exemple.com" type="text" value={website} onChange={(e) => setWebsite(e.target.value)} />
      </p>
      <div className="clearfix" />
      <p className="form-submit">
        <input type="submit" className="submit" value={sending ? "Envoi…" : "Publier le commentaire"} disabled={sending} />
      </p>
    </form>
  );
}
