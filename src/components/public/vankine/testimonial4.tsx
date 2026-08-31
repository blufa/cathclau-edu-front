"use client";

import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const swiperOptions = {
  modules: [Autoplay, Pagination, Navigation],
  slidesPerView: 3,
  spaceBetween: 30,
  autoplay: { delay: 3500, disableOnInteraction: false },
  loop: true,
  pagination: { el: ".swiper-pagination", clickable: true },
  breakpoints: {
    320: { slidesPerView: 1, spaceBetween: 20 },
    767: { slidesPerView: 2, spaceBetween: 20 },
    1199: { slidesPerView: 3, spaceBetween: 30 },
  },
};

const TESTIMONIALS = [
  { name: "Mariam Diallo", role: "Directrice — Groupe Scolaire Espoir, Conakry", quote: "Le recouvrement des frais a bondi de 40 % en un trimestre, et les relances se font toutes seules." },
  { name: "Ibrahima Bah", role: "Proviseur — Collège Les Lauriers, Kindia", quote: "Les bulletins se génèrent automatiquement à la clôture. Fini les week-ends entiers de calcul." },
  { name: "Aïssata Camara", role: "Censeure — Lycée Sainte-Marie, Labé", quote: "Les parents reçoivent les absences en temps réel par WhatsApp. La relation famille a changé." },
];

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).join("").toUpperCase();
}

/** Carrousel de témoignages (mêmes classes CSS que Testimonial4.js) — nos vrais témoignages,
 * avatars à initiales plutôt que des photos de personnes inventées. */
export function Testimonial4() {
  return (
    <section className="testimonial-section">
      <div className="pd_top_90" />
      <div className="container">
        <div className="row">
          <div className="col-lg-12">
            <div className="section_title text-center type_one">
              <h4 className="sm_title">Témoignages</h4>
              <div className="title_whole"><h2 className="title">Ils parlent de nous</h2></div>
            </div>
          </div>
        </div>
        <div className="pd_bottom_30" />
        <div className="testimonial_carousel position-relative position_one nav_false dot_true">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <Swiper {...(swiperOptions as any)} className="theme_carousel">
            {TESTIMONIALS.map((t) => (
              <SwiperSlide key={t.name} className="testimonial_box type_two">
                <div className="auth d-flex align-items-center clearfix">
                  <div className="image_box">
                    <span
                      style={{
                        display: "inline-flex", height: 56, width: 56, borderRadius: "50%", alignItems: "center",
                        justifyContent: "center", background: "linear-gradient(135deg,#3b82f6,#1e4fa8)", color: "#fff",
                        fontWeight: 700,
                      }}
                    >
                      {initials(t.name)}
                    </span>
                  </div>
                  <div className="cont">
                    <h4 className="title_no_a_24">{t.name}</h4>
                    <p>{t.role}</p>
                  </div>
                </div>
                <div className="title_no_a_22 t_comment">
                  <sup>&ldquo;</sup>{t.quote}<sub>&rdquo;</sub>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </div>
      <div className="pd_top_70" />
    </section>
  );
}
