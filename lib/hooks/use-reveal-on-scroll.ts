"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Lightweight "reveal once when scrolled into view" hook, paired with the
 * .reveal-on-scroll / .is-visible classes in globals.css. No animation
 * library — just an IntersectionObserver flipping one class.
 *
 * Hydration safety: `visible` MUST start as the same value on the server
 * and on the client's first render, or React logs a hydration mismatch
 * (exactly what happened before this fix — see the fix history below).
 * The only way to guarantee that is to never read anything
 * environment-dependent (window, document, IntersectionObserver) while
 * computing the initial value. So `visible` always starts `false`, full
 * stop, and is only ever flipped to `true` from inside the effect below —
 * which never runs during SSR and never runs during the render that
 * produces the client's first paint, only afterward, once React has
 * committed and hydration has finished. That's what makes "is-visible"
 * a *post*-hydration state change instead of a render-time one.
 */
export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      // No observer support in this environment — reveal on the next
      // frame instead of leaving the section stuck at opacity 0 forever.
      // requestAnimationFrame's callback is a genuine async browser
      // callback (like the IntersectionObserver callback below), not a
      // value computed synchronously inside the effect body itself.
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return { ref, className: `reveal-on-scroll${visible ? " is-visible" : ""}` };
}
