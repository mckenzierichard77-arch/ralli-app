import React from "react";
import { T } from "../../data/tokens.js";

export function poreStyle(score) {
  if (score === 0) return {color:T.sage,  label:"Clear",   sub:"Won't clog pores"};
  if (score === 1) return {color:T.sage,  label:"Minimal", sub:"Very low risk"};
  if (score === 2) return {color:T.amber, label:"Low risk", sub:"May affect some skin"};
  if (score === 3) return {color:T.amber, label:"Medium",   sub:"Likely to clog pores"};
  if (score === 4) return {color:T.rose,  label:"High",     sub:"High clog risk"};
  return               {color:T.rose,  label:"Avoid",   sub:"Clogs pores"};
}

export function PoreScoreBadge({ score, size="md", instant=false }) {
  const [displayed, setDisplayed] = React.useState(instant ? (score||0) : 0);
  const prevScore = React.useRef(null);

  React.useEffect(() => {
    if (score == null) return;
    if (prevScore.current === score) return;
    prevScore.current = score;
    if (instant) { setDisplayed(score); return; }
    setDisplayed(0);
    if (score === 0) return;
    let current = 0;
    let timeoutId;
    const tick = () => {
      current += 1;
      setDisplayed(current);
      if (current < score) {
        const remaining = score - current;
        const interval = remaining > 2 ? 110 : remaining > 1 ? 160 : 240;
        timeoutId = setTimeout(tick, interval);
      }
    };
    timeoutId = setTimeout(tick, 120);
    return () => clearTimeout(timeoutId);
  }, [score, instant]);

  if (score == null) return null;
  const ps = poreStyle(displayed);
  const finalPs = poreStyle(score);

  const sizes = {
    sm:  { wrap: { borderRadius:"0.45rem", padding:"0.2rem 0.4rem", minWidth:"36px" }, label: "0.48rem", num: "0.88rem", sub: "0.45rem" },
    md:  { wrap: { borderRadius:"0.65rem", padding:"0.35rem 0.55rem", minWidth:"44px" }, label: "0.5rem",  num: "1.05rem", sub: "0.52rem" },
    lg:  { wrap: { borderRadius:"0.85rem", padding:"0.55rem 0.8rem",  minWidth:"60px" }, label: "0.6rem",  num: "1.6rem",  sub: "0.7rem"  },
  };
  const s = sizes[size] || sizes.md;
  const color = finalPs.color;

  return (
    <div style={{
      ...s.wrap,
      flexShrink:0,
      background: ps.color+"12",
      border: `1px solid ${ps.color}25`,
      textAlign: "center",
      transition: "background 0.25s ease, border-color 0.25s ease",
    }}>
      <div style={{ fontSize: s.label, fontWeight:"700", color: ps.color, textTransform:"uppercase", letterSpacing:"0.07em", lineHeight:1, transition:"color 0.25s ease" }}>pore</div>
      <div style={{
        fontSize: s.num,
        fontWeight: "800",
        color: ps.color,
        fontFamily: "'Inter',sans-serif",
        lineHeight: 1.1,
        transition: "color 0.25s ease",
        animation: displayed > 0 && displayed < score ? "scoreTick 0.12s ease-out" : "none",
      }}>
        {displayed}
        <span style={{ fontSize: s.sub, fontWeight:"400", color: T.textLight }}>/5</span>
      </div>
    </div>
  );
}
