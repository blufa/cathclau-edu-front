"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

/** Accordéon FAQ (mêmes classes/interaction que le bloc "block_faq" de service-details.js /
 * pricing.js du template) — un seul item ouvert à la fois, premier item ouvert par défaut. */
export function FaqAccordionVankine({ items, defaultOpen = 0 }: { items: FaqItem[]; defaultOpen?: number }) {
  const [openIndex, setOpenIndex] = useState<number | null>(defaultOpen);

  const toggle = (index: number) => {
    setOpenIndex((current) => (current === index ? null : index));
  };

  return (
    <div className="block_faq">
      <div className="accordion-box">
        {items.map((item, index) => {
          const active = openIndex === index;
          return (
            <div key={item.q} className={active ? "accordion active-block" : "accordion"}>
              <button
                type="button"
                className={active ? "question faq_header active" : "question faq_header"}
                onClick={() => toggle(index)}
              >
                <div className="question_box">
                  <div className="title_no_a_18 trans">{item.q}</div>
                  <span className="icon_fq trans fi-rs-arrow-small-right" />
                </div>
              </button>
              <div className="answer accordion-content" style={{ display: active ? "block" : "none" }}>
                {item.a}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
