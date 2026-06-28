import React, { useState, useEffect } from "react";
import { T } from "../../data/tokens.js";

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
  const [failed, setFailed] = useState(false);

  useEffect(() => { setFailed(false); }, [src]);

  const dim = size === "full" ? { width: "100%", height: "100%" } : { width: size, height: size };

  if (!src || failed) {
    return (
      <div style={{ ...dim, borderRadius: "inherit", overflow: "hidden", flexShrink: 0 }}>
        <PlaceholderCard name={name} brand={brand} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name || ""}
      style={{ ...dim, objectFit: "contain", padding: "8px", background: "#ffffff", mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }}
      onError={() => setFailed(true)}
    />
  );
}
