"use client";

import { useState } from "react";
import Link from "next/link";
import { NavbarNav } from "./navbar-nav";

/** Header "style 5" du template Vankine — mêmes classes/structure (bandeau coordonnées + barre de
 * navigation), contenu réel de CathClau Edu à la place du contenu de démonstration. */
export function Header5() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="header_area" id="header_contents">
      <header className="header-area header-style-5 htype_one">
        <div className="top_bar">
          <div className="bgiamge">
            <img src="/vankine/images/header-5-bg.png" className="img-fluid" alt="" />
          </div>
          <div className="container">
            <div className="row align-items-center">
              <div className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
                <div className="logo_box">
                  <Link href="/" className="logo navbar-brand">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/logo.png" alt="CathClau Edu" className="logo_default" style={{ maxHeight: 48 }} />
                  </Link>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
                <div className="d-flex align-items-center contact_header_one">
                  <div className="icon_s"><i className="fi-rr-marker" /></div>
                  <div className="content">
                    <h6 className="tite">Nos écoles</h6>
                    <div className="title_no_a_20">Guinée, toutes régions</div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
                <div className="d-flex align-items-center contact_header_one">
                  <div className="icon_s"><i className="fi-rr-envelope" /></div>
                  <div className="content">
                    <h6 className="tite">Écrivez-nous</h6>
                    <div className="title_no_a_20">contact@cathclau.edu</div>
                  </div>
                </div>
              </div>
              <div className="col-lg-3 col-md-6 col-sm-6 col-xs-12">
                <div className="d-flex align-items-center contact_header_one">
                  <div className="icon_s"><i className="fi-rr-phone-call" /></div>
                  <div className="content">
                    <h6 className="tite">Appelez-nous</h6>
                    <div className="title_no_a_20">+224 620 00 00 00</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="medium-container position-relative">
          <div className="main_header_content default_header">
            <div className="row align-items-center">
              <div className="col-lg-9 col-md-0 col-sm-0 col-xs-0 column_menu">
                <div className="navbar_content d-flex align-items-center">
                  <NavbarNav />
                </div>
              </div>
              <div className="col-lg-3 col-md-12 col-sm-12 col-xs-12 nav_tog_column">
                <div className="d-flex right_content align-items-center">
                  <div className="navbar_togglers hamburger_menu" onClick={() => setMobileOpen((v) => !v)}>
                    <span className="line" />
                    <span className="line" />
                    <span className="line" />
                  </div>
                  <div className="button">
                    <Link href="/signup" className="theme_btn" style={{ backgroundImage: "url(/vankine/images/bg-1.png)" }}>
                      Essai gratuit
                    </Link>
                  </div>
                  <Link href="/login" className="contact-toggler" aria-label="Connexion">
                    <svg width={18} height={19} viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M9 1C4.58 1 1 4.58 1 9s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8Z" stroke="#0F3567" strokeWidth="1.5" />
                      <path d="M9 6v3.5l2.5 1.5" stroke="#0F3567" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
        {mobileOpen && (
          <div className="mobile_menu_wrap" style={{ background: "#fff", padding: "16px", boxShadow: "0 10px 30px rgba(0,0,0,.08)" }}>
            <NavbarNav />
          </div>
        )}
      </header>
    </div>
  );
}
