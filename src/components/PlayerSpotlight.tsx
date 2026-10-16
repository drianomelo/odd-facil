"use client";

import { useEffect, useState } from "react";

const fullBodyImages = [
  "/players/jogador-1.png",
  "/players/jogador-2.png",
  "/players/jogador-3.png",
];

export function PlayerSpotlight() {
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveImage((current) => (current + 1) % fullBodyImages.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="relative z-20 h-full min-h-[50vh] w-full lg:min-h-full"
    >
      <div className="absolute inset-x-[8%] bottom-0 top-[12%] bg-[radial-gradient(ellipse_at_50%_80%,rgba(255,255,255,0.18),transparent_68%)]" />
      <img
        src={fullBodyImages[activeImage]}
        alt=""
        className="absolute inset-x-0 bottom-0 mx-auto h-[96%] max-h-[850px] w-full object-contain object-bottom transition-opacity duration-700"
        key={fullBodyImages[activeImage]}
      />
    </div>
  );
}
