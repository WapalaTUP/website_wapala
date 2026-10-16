"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
export function PageMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hero = document.querySelector<HTMLElement>(".hero-photo");
    const strips = [...document.querySelectorAll<HTMLElement>("[data-scroll-divisions]")];
    let raf = 0;
    const update = () => {
      raf = 0;
      document.querySelector(".site-header")?.classList.toggle("scrolled", window.scrollY > 12);
      if (hero && !media.matches && window.innerWidth > 760) {
        hero.style.transform = `translate3d(0, ${Math.min(window.scrollY * 0.045, 26)}px, 0)`;
      }
      if (!media.matches && window.innerWidth > 760)
        strips.forEach((strip) => {
          const rect = strip.getBoundingClientRect();
          if (rect.bottom < 0 || rect.top > window.innerHeight) return;
          const offset = Math.max(
            -28,
            Math.min(28, (window.innerHeight / 2 - rect.top - rect.height / 2) * 0.06),
          );
          strip.querySelectorAll<HTMLElement>(".division-photo").forEach((photo) => {
            photo.style.backgroundPositionY = `calc(50% + ${offset}px)`;
          });
        });
    };
    const scroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", scroll);
      cancelAnimationFrame(raf);
    };
  }, [pathname]);
  return null;
}
