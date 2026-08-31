"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const TABS = [
  { id: 1, label: "Primaire" },
  { id: 2, label: "Collège" },
  { id: 3, label: "Lycée" },
  { id: 4, label: "Supérieur" },
];

/** Formulaire "Demander une démo" (mêmes classes CSS que Form4.js, onglets par niveau plutôt que
 * par type d'assurance) — redirige vers /contact avec les informations saisies, faute d'un point
 * de collecte de devis dédié côté serveur pour l'instant. */
export function DemoForm() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(1);
  const [students, setStudents] = useState(200);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const params = new URLSearchParams({
      nom: String(form.get("name") ?? ""),
      telephone: String(form.get("phone") ?? ""),
      email: String(form.get("email") ?? ""),
      niveau: TABS.find((t) => t.id === activeTab)?.label ?? "",
      eleves: String(students),
    });
    router.push(`/contact?${params.toString()}`);
  }

  return (
    <section className="form-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="section_title text-center type_one">
              <h4 className="sm_title">Parlons de votre établissement</h4>
              <div className="title_whole">
                <h2 className="title">Demandez une démo personnalisée</h2>
              </div>
            </div>
          </div>
        </div>
        <div className="pd_bottom_40" />
        <div className="row">
          <div className="col-lg-12">
            <section className="fom_tab_box custom_tabs type_four">
              <ul className="nav nav-tabs links trans justify-content-center" role="tablist">
                {TABS.map((t) => (
                  <li key={t.id} className="nav-item" onClick={() => setActiveTab(t.id)}>
                    <button type="button" className={activeTab === t.id ? "nav-link active" : "nav-link"}>{t.label}</button>
                  </li>
                ))}
              </ul>
              <div className="s_tabs_content tab-content">
                <div className="tab-pane active">
                  <div className="contentbox yes_image d-flex">
                    <div className="contact_form_shortcode">
                      <form onSubmit={handleSubmit}>
                        <div className="row">
                          <div className="col-lg-6 col-sm-12">
                            <label>Nom complet <span>*</span></label>
                            <input type="text" name="name" placeholder="Votre nom" required />
                          </div>
                          <div className="col-lg-6 col-sm-12">
                            <label>Téléphone</label>
                            <input type="text" name="phone" placeholder="+224 6XX XX XX XX" />
                          </div>
                          <div className="col-lg-6 col-sm-12">
                            <label>E-mail <span>*</span></label>
                            <input type="email" name="email" placeholder="vous@ecole.gn" required />
                          </div>
                          <div className="col-lg-6 col-sm-12">
                            <label>Niveau de l&apos;établissement</label>
                            <input type="text" value={TABS.find((t) => t.id === activeTab)?.label ?? ""} readOnly />
                          </div>
                          <div className="col-sm-12">
                            <label>Nombre d&apos;élèves approximatif</label>
                            <input
                              type="range" min={20} max={3000} step={10} style={{ width: "100%" }}
                              value={students} onChange={(e) => setStudents(Number(e.target.value))}
                            />
                            <div className="slider-hint">Valeur sélectionnée : <b>{students}</b></div>
                          </div>
                          <div className="col-lg-12 col-sm-12 text-md-end">
                            <button type="submit">Demander une démo</button>
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="pd_bottom_90" />
    </section>
  );
}
