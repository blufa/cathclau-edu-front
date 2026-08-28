"use client";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";
import Link from "next/link";
import { Autoplay, Navigation, Pagination } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

const swiperOptions = {
  modules: [Autoplay, Pagination, Navigation],
  slidesPerView: 1,
  spaceBetween: 0,
  autoplay: { delay: 4000, disableOnInteraction: false },
  loop: true,
  navigation: { nextEl: ".slick-next", prevEl: ".slick-prev" },
  pagination: { el: ".swiper-pagination", clickable: true },
};

const SLIDES = [
  {
    image: "/images/school-1.jpg",
    eyebrow: "Bienvenue sur CathClau Edu",
    title: <>Gagnez du temps pour<br />ce qui compte : vos élèves</>,
  },
  {
    image: "/images/school-3.jpg",
    eyebrow: "Toute la scolarité, réunie",
    title: <>Bulletins, présences,<br />emplois du temps automatisés</>,
  },
  {
    image: "/images/school-5.jpg",
    eyebrow: "Familles informées en temps réel",
    title: <>SMS, e-mail, WhatsApp,<br />au bon moment</>,
  },
  {
    image: "/images/school-6.jpg",
    eyebrow: "Encaissements simplifiés",
    title: <>Mobile money intégré,<br />reçus automatiques</>,
  },
];

/** Hero "style 5" du template Vankine (mêmes classes CSS que Slider4.js), avec nos vraies photos
 * d'établissement et notre propre contenu — Swiper pilote le défilement comme dans l'original. */
export function HeroSlider() {
  return (
    <div className="slider style_five">
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <Swiper {...(swiperOptions as any)} className="tab_content_slick">
        {SLIDES.map((s) => (
          <SwiperSlide key={s.image} className="slide-item-content">
            <div className="image-layer" style={{ backgroundImage: `url(${s.image})` }} />
            <div className="slide-item content_left">
              <div className="auto-container">
                <div className="row align-items-center">
                  <div className="col-md-12 text-center">
                    <div className="slider_content">
                      <h6 className="animate_up">{s.eyebrow}</h6>
                      <h1 className="animate_left">{s.title}</h1>
                      <div className="button_all animate_down">
                        <Link href="/signup" className="theme_btn color_white animated">
                          Essai gratuit 30 jours
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </SwiperSlide>
        ))}
        <div>
          <button type="button" className="slick-prev slick-arrow" aria-label="Image précédente"><span className="fi-rs-arrow-small-left" /></button>
          <button type="button" className="slick-next slick-arrow" aria-label="Image suivante"><span className="fi-rs-arrow-small-right" /></button>
        </div>
      </Swiper>
      <div className="tab_postion_absolute">
        <div className="container">
          <div className="slider tab_slick" style={{ display: "flex", gap: "2rem", justifyContent: "center" }}>
            <div className="title"><h3>Scolarité</h3></div>
            <div className="title"><h3>Communication</h3></div>
            <div className="title"><h3>Facturation</h3></div>
            <div className="title"><h3>Pilotage</h3></div>
          </div>
        </div>
      </div>
    </div>
  );
}
