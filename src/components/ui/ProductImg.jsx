import React from "react";
import { T } from "../../data/tokens.js";

export function ProductImg({ src, alt, style = {}, brand = "" }) {
  const [errored, setErrored] = React.useState(false);
  const inits = (brand || alt || "?").slice(0, 2).toUpperCase();
  if (!src || errored) {
    return (
      <div style={{
        ...style,
        background: T.iceBlue,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: T.navy,
        fontWeight: "700",
        fontSize: Math.min((style.width || 40) * 0.32, 18),
        fontFamily: "'Inter',sans-serif",
        letterSpacing: "-0.02em",
        flexShrink: 0,
      }}>
        {inits}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt || brand || ""}
      style={{ ...style, objectFit: "cover", display: "block" }}
      onError={() => setErrored(true)}
    />
  );
}
