"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export function StickyCtaBar() {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const hero = document.querySelector("[data-hero-section]");
    if (!hero) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observerRef.current.observe(hero);

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/15 bg-slate-900/95 backdrop-blur-md px-6 py-3 md:hidden"
      data-testid="sticky-cta-bar"
    >
      <Link
        href="/debates"
        className="flex w-full items-center justify-center rounded-sm bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 min-h-[44px]"
      >
        Enter the Arena
      </Link>
    </div>
  );
}
