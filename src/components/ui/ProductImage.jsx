import React, { useState, useEffect } from "react";
import { T } from "../../data/tokens.js";
import { resolveProductImage } from "../../lib/imageUtils.js";

export const IMG_CACHE = new Map();

export function PlaceholderCard({ name, brand }) {
  const words = ((brand || name || "?").trim()).split(" ").filter(Boolean);
  const initials = words.length >= 2
    ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
    : (words[0] || "?").slice(0, 2).toUpperCase();
  const colors = [
    { bg: "#E8F0E8", fg: "#5A7A54" }, { bg: "#EAE4DC", fg: "#7C6E58" },
    { bg: "#EDE8F0", fg: "#7A6490" }, { bg: "#F0E8E8", fg: "#8A5A5A" },
    { bg: "#E8EDF0", fg: "#4A7080" }, { bg: "#F0EDE4", fg: "#7A6A40" },
  ];
  const c = colors[(initials.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: "100%", height: "100%", background: c.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.3rem", padding: "0.5rem" }}>
      <div style={{ fontSize: "1.3rem", fontWeight: "800", color: c.fg, fontFamily: "'Inter',sans-serif", lineHeight: 1, letterSpacing: "-0.02em" }}>{initials}</div>
      <div style={{ fontSize: "0.46rem", fontWeight: "600", color: c.fg, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", maxWidth: "72px", lineHeight: 1.3, overflow: "hidden" }}>
        {(name || "").length > 20 ? (name || "").slice(0, 18) + "…" : (name || "")}
      </div>
    </div>
  );
}

export function ProductImage({ src, name, brand, barcode, size = "full" }) {
  const [imgSrc, setImgSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const OBF_REVS = ["3", "2", "1", "4", "5"];

  useEffect(() => {
    setFailed(false); setAttempt(0);
    const cacheKey = `${barcode || ""}|${brand || ""}|${name || ""}`.toLowerCase();
    if (IMG_CACHE.has(cacheKey)) { setImgSrc(IMG_CACHE.get(cacheKey)); return; }
    if (src) { IMG_CACHE.set(cacheKey, src); setImgSrc(src); return; }
    if (name) {
      resolveProductImage(brand, name, barcode).then(img => {
        if (img) { IMG_CACHE.set(cacheKey, img); setImgSrc(img); }
        else setImgSrc(null);
      });
    } else {
      setImgSrc(null);
    }
  }, [src, barcode, name, brand]);

  function handleError() {
    const nextAttempt = attempt + 1;
    if (barcode && nextAttempt < OBF_REVS.length) {
      setAttempt(nextAttempt);
      const b = barcode.replace(/\D/g, "");
      const path = b.length === 13
        ? `${b.slice(0, 3)}/${b.slice(3, 6)}/${b.slice(6, 9)}/${b.slice(9)}`
        : b;
      setImgSrc(`https://images.openbeautyfacts.org/images/products/${path}/front_en.${OBF_REVS[nextAttempt]}.full.jpg`);
    } else {
      setFailed(true);
    }
  }

  const dim = size === "full" ? { width: "100%", height: "100%" } : { width: size, height: size };
  if (!imgSrc || failed) return <div style={{ ...dim, borderRadius: "inherit", overflow: "hidden", flexShrink: 0 }}><PlaceholderCard name={name} brand={brand} /></div>;
  return <img src={imgSrc} alt={name || ""} style={{ ...dim, objectFit: "contain", padding: "8px", background: "#ffffff", mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }} onError={handleError} />;
}
