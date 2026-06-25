import React, { useState } from "react";
import ReactDOM from "react-dom";
import { T } from "../../data/tokens.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { getProductImage } from "../../lib/imageUtils.js";
import { useProductCache } from "../providers/ProductCacheProvider.jsx";
import { ProductImage } from "../ui/ProductImage.jsx";
import { poreStyle } from "./PoreScoreBadge.jsx";

function getProductDisplayName(p) {
  if (!p) return "";
  const name = p.productName || p.name || "";
  const brand = p.brand || "";
  if (!brand || !name) return name;
  const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const brandN = norm(brand);
  if (!brandN) return name;
  let working = name.trim();
  for (let pass = 0; pass < 3; pass++) {
    const workingN = norm(working);
    if (workingN === brandN) return name;
    if (!workingN.startsWith(brandN + " ")) break;
    const targetTokens = brandN.split(" ").length;
    let consumedTokens = 0, inToken = false, cutAt = -1;
    for (let i = 0; i < working.length; i++) {
      const ch = working[i];
      const isAlpha = /[a-zA-Z0-9]/.test(ch);
      if (isAlpha && !inToken) { inToken = true; consumedTokens++; }
      else if (!isAlpha && inToken) {
        inToken = false;
        if (consumedTokens >= targetTokens) { cutAt = i; break; }
      }
    }
    if (inToken && consumedTokens >= targetTokens) cutAt = working.length;
    if (cutAt < 0) break;
    working = working.slice(cutAt).trimStart();
  }
  return working || name;
}

export function analyzeRoutine(routine, shopProducts) {
  if (!routine || !routine.length) return null;
  const results = routine.map(name => {
    const nameLow = name.toLowerCase().trim();
    const product = shopProducts.find(p => p.productName?.toLowerCase() === nameLow)
      || shopProducts.find(p => (p.productName || "").toLowerCase().includes(nameLow))
      || shopProducts.find(p => nameLow.includes((p.productName || "").toLowerCase()))
      || shopProducts.find(p => {
        const pWords = (p.productName || "").toLowerCase().split(" ").filter(w => w.length > 3);
        const nWords = nameLow.split(" ").filter(w => w.length > 3);
        return pWords.length > 0 && pWords.filter(w => nWords.includes(w)).length >= Math.min(2, pWords.length);
      });
    if (!product?.ingredients) return { name, score: null, poreScore: null, flagged: [], irritants: [], totalIngredients: 0 };
    const res = analyzeIngredients(product.ingredients);
    const displayPoreScore = Math.round(res.avgScore ?? 0);
    const totalIngredients = (product.ingredients || "").split(",").filter(t => t.trim()).length;
    return {
      name,
      poreScore: displayPoreScore,
      flagged: (res.poreCloggers || []).sort((a, b) => b.score - a.score),
      irritants: (res.irritants || []),
      totalIngredients,
      hasData: true,
    };
  });
  const withData = results.filter(r => r.hasData);
  if (!withData.length) return { results, overall: null, grade: null, gradeColor: T.textLight, label: "Add products with ingredients", withData: 0, productCount: 0, toWatchCount: 0, toWatchList: [], totalIngredients: 0, overlaps: [] };
  const avg = withData.reduce((s, r) => s + (r.poreScore || 0), 0) / withData.length;
  const baseScore = Math.max(0, 10 - avg * 2);
  const ingredientMap = new Map();
  withData.forEach(r => {
    (r.flagged || []).forEach(f => {
      const key = f.name.toLowerCase();
      const prev = ingredientMap.get(key);
      if (prev) { prev.count += 1; prev.score = Math.max(prev.score, f.score || 0); }
      else { ingredientMap.set(key, { name: f.name, count: 1, score: f.score || 0 }); }
    });
  });
  const highRiskOverlaps = [...ingredientMap.values()].filter(o => o.count >= 2 && o.score >= 3).sort((a, b) => b.score - a.score || b.count - a.count);
  const overlapPenalty = Math.min(highRiskOverlaps.length * 0.7, 2.5);
  const overall = Math.max(0, Math.min(10, baseScore - overlapPenalty));
  const grade = overall >= 9.0 ? "A" : overall >= 8.0 ? "B" : overall >= 7.0 ? "C" : overall >= 6.0 ? "D" : "F";
  const gradeColor = overall >= 8.0 ? T.sage : overall >= 7.0 ? T.amber : T.rose;
  const label = overall >= 9.0 ? "Skin-safe" : overall >= 8.0 ? "Strong routine" : overall >= 7.0 ? "Some concern" : overall >= 6.0 ? "Needs work" : "High risk";
  const totalIngredients = withData.reduce((s, r) => s + (r.totalIngredients || 0), 0);
  const toWatchMap = new Map();
  withData.forEach(r => {
    (r.flagged || []).forEach(f => {
      const key = f.name.toLowerCase();
      const prev = toWatchMap.get(key);
      if (prev) { prev.productCount += 1; prev.score = Math.max(prev.score, f.score || 0); }
      else { toWatchMap.set(key, { name: f.name, kind: "clog", score: f.score || 0, productCount: 1 }); }
    });
    (r.irritants || []).forEach(i => {
      const key = (i.name || "").toLowerCase();
      if (!key) return;
      const prev = toWatchMap.get(key);
      if (prev) { prev.productCount += 1; }
      else { toWatchMap.set(key, { name: i.name, kind: "irritate", score: 0, productCount: 1 }); }
    });
  });
  const toWatchList = [...toWatchMap.values()].sort((a, b) => (b.score || 0) - (a.score || 0) || b.productCount - a.productCount);
  const toWatchCount = toWatchList.length;
  return {
    results,
    overall: Math.round(overall * 10) / 10,
    grade, gradeColor, label,
    overlaps: highRiskOverlaps,
    withData: withData.length,
    baseScore: Math.round(baseScore * 10) / 10,
    overlapPenalty: Math.round(overlapPenalty * 10) / 10,
    totalIngredients, toWatchCount, toWatchList,
    productCount: withData.length,
  };
}

export function RoutineScoreExplainer({ analysis, routine, onClose }) {
  if (!analysis) return null;
  const fillPct = Math.round((analysis.overall || 0) * 10);
  const ringBg = `conic-gradient(${analysis.gradeColor} 0% ${fillPct}%, ${T.border} ${fillPct}% 100%)`;
  const cleanCount = Math.max(0, (analysis.totalIngredients || 0) - (analysis.toWatchCount || 0));
  return ReactDOM.createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: "480px", background: T.surface, borderRadius: "1.25rem 1.25rem 0 0", padding: "1.4rem 1.25rem", maxHeight: "85vh", overflowY: "auto", zIndex: 1, paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))", fontFamily: "'Inter',sans-serif" }}>
        <div style={{ width: "36px", height: "4px", background: T.border, borderRadius: "2px", margin: "0 auto 1.2rem" }} />
        <button onClick={onClose} style={{ position: "absolute", top: "0.9rem", right: "0.9rem", background: T.surfaceAlt, border: "none", cursor: "pointer", width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: T.textMid, padding: 0 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.1rem" }}>
          <div style={{ width: "86px", height: "86px", borderRadius: "50%", background: ringBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <div style={{ width: "72px", height: "72px", borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: "2.2rem", fontWeight: "800", color: analysis.gradeColor, lineHeight: 1, letterSpacing: "-0.04em" }}>{analysis.grade}</div>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.65rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em" }}>Routine Score</div>
            <div style={{ fontSize: "1.15rem", fontWeight: "700", color: T.text, marginTop: "3px", letterSpacing: "-0.02em" }}>{analysis.label}</div>
            <div style={{ fontSize: "0.75rem", color: T.textLight, marginTop: "4px" }}>{analysis.productCount} product{analysis.productCount === 1 ? "" : "s"} · {analysis.totalIngredients} ingredient{analysis.totalIngredients === 1 ? "" : "s"} · {analysis.overall}/10</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.55rem", marginBottom: "0.85rem" }}>
          <div style={{ background: "#E7F3EC", borderRadius: "0.85rem", padding: "0.85rem" }}>
            <div style={{ color: T.sage, marginBottom: "0.3rem", lineHeight: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: "800", color: T.sage, lineHeight: 1, letterSpacing: "-0.03em" }}>{cleanCount}</div>
            <div style={{ fontSize: "0.7rem", color: T.textMid, marginTop: "4px" }}>Clean ingredients</div>
          </div>
          <div style={{ background: "#FBF1DE", borderRadius: "0.85rem", padding: "0.85rem" }}>
            <div style={{ color: T.amber, marginBottom: "0.3rem", lineHeight: 0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
            <div style={{ fontSize: "1.3rem", fontWeight: "800", color: T.amber, lineHeight: 1, letterSpacing: "-0.03em" }}>{analysis.toWatchCount}</div>
            <div style={{ fontSize: "0.7rem", color: T.textMid, marginTop: "4px" }}>To watch</div>
          </div>
        </div>
        {analysis.toWatchList?.length > 0 && (
          <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "0.85rem", padding: "0.35rem 0.85rem", marginBottom: "0.85rem" }}>
            <div style={{ fontSize: "0.62rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0.7rem 0 0.5rem" }}>To watch</div>
            {analysis.toWatchList.map((item, i) => {
              const isLast = i === analysis.toWatchList.length - 1;
              const kindColor = item.kind === "clog" ? T.rose : T.amber;
              const kindLabel = item.kind === "clog" ? "may clog" : "may irritate";
              return (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.55rem 0", borderTop: `1px solid ${T.border}`, gap: "0.5rem" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.82rem", fontWeight: "600", color: T.text, textTransform: "capitalize", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    {item.productCount > 1 && <div style={{ fontSize: "0.65rem", color: T.textLight, marginTop: "1px" }}>In {item.productCount} products</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                    <div style={{ fontSize: "0.68rem", color: kindColor, fontWeight: "600" }}>{kindLabel}</div>
                    {item.kind === "clog" && item.score > 0 && <div style={{ fontSize: "0.72rem", fontWeight: "700", color: kindColor }}>{item.score}/5</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={onClose} style={{ width: "100%", padding: "0.9rem", background: T.navy, color: "#fff", border: "none", borderRadius: "0.75rem", fontSize: "0.9rem", fontWeight: "700", cursor: "pointer", letterSpacing: "-0.01em", marginTop: "0.3rem" }}>Got it</button>
      </div>
    </div>,
    document.body
  );
}

export function ListSection({ title, icon, color, items, onAdd, onRemove, isPrivate, onTogglePrivacy, readOnly, onItemTap, allProducts = [], layout = "scroll" }) {
  const productCache = useProductCache();
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  function handleInput(val) {
    setInput(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    const matches = allProducts.filter(p => p.productName && (p.productName.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q))).slice(0, 6);
    setSuggestions(matches);
  }

  function submit(name) {
    const v = (name || input).trim();
    if (!v) return;
    onAdd(v); setInput(""); setAdding(false); setSuggestions([]);
  }

  return (
    <div style={{ marginBottom: "1.75rem", background: T.surface, borderRadius: "1.25rem", border: `1.5px solid ${color}22`, overflow: "hidden", boxShadow: `0 2px 12px ${color}10` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.85rem 1rem 0.75rem", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: T.navy, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter',sans-serif" }}>{title}</span>
          {items.length > 0 && <span style={{ fontSize: "0.65rem", background: color + "20", color, borderRadius: "999px", padding: "0.1rem 0.5rem", fontWeight: "700", fontFamily: "'Inter',sans-serif" }}>{items.length}</span>}
          {isPrivate && <span style={{ fontSize: "0.58rem", color: T.textLight, background: T.surfaceAlt, borderRadius: "999px", padding: "0.1rem 0.4rem", border: `1px solid ${T.border}` }}>Private</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          {!readOnly && onTogglePrivacy && (
            <button onClick={onTogglePrivacy} title={isPrivate ? "Make public" : "Make private"}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "0.2rem", color: isPrivate ? T.accent : T.textLight, display: "flex", alignItems: "center" }}
              onMouseEnter={e => e.currentTarget.style.color = color}
              onMouseLeave={e => e.currentTarget.style.color = isPrivate ? T.accent : T.textLight}>
              {isPrivate
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" /></svg>
              }
            </button>
          )}
          {!readOnly && (
            <button onClick={() => setAdding(a => !a)}
              style={{ width: "26px", height: "26px", borderRadius: "50%", background: adding ? color : color + "15", border: `1.5px solid ${adding ? color : color + "30"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: adding ? "#FFFFFF" : color, transition: "all 0.15s", padding: 0, flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: adding ? "rotate(45deg)" : "none", transition: "transform 0.2s" }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </button>
          )}
        </div>
      </div>

      {adding && (
        <div style={{ padding: "0.65rem 1rem", borderBottom: `1px solid ${T.border}`, position: "relative" }}>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <input value={input} onChange={e => handleInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") { setAdding(false); setInput(""); setSuggestions([]); } }}
              placeholder="Search products…" autoFocus
              style={{ flex: 1, padding: "0.55rem 0.8rem", borderRadius: "0.6rem", border: `1.5px solid ${color}`, fontSize: "0.82rem", color: T.text, background: "#fff", outline: "none", fontFamily: "'Inter',sans-serif" }} />
            <button onClick={() => submit()} disabled={!input.trim()}
              style={{ padding: "0.55rem 0.9rem", background: input.trim() ? color : T.surfaceAlt, color: input.trim() ? "#FFFFFF" : T.textLight, border: "none", borderRadius: "0.6rem", fontSize: "0.8rem", fontWeight: "600", cursor: input.trim() ? "pointer" : "not-allowed", fontFamily: "'Inter',sans-serif" }}>
              Add
            </button>
          </div>
          {suggestions.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 2px)", left: "1rem", right: "1rem", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "0.65rem", zIndex: 100, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,0.1)" }}>
              {suggestions.map((p, i) => (
                <button key={i} onClick={() => submit(p.productName)}
                  style={{ width: "100%", padding: "0.5rem 0.75rem", background: "transparent", border: "none", borderBottom: i < suggestions.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: "0.5rem", fontFamily: "'Inter',sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <div style={{ width: "32px", height: "32px", borderRadius: "0.4rem", overflow: "hidden", flexShrink: 0, background: T.surfaceAlt }}>
                    <ProductImage src={p.image || null} name={p.productName} brand={p.brand} size="full" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.78rem", fontWeight: "600", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</div>
                    <div style={{ fontSize: "0.65rem", color: T.textLight }}>{p.brand}</div>
                  </div>
                </button>
              ))}
              {input.trim() && !suggestions.find(p => p.productName.toLowerCase() === input.toLowerCase()) && (
                <button onClick={() => submit(input.trim())}
                  style={{ width: "100%", padding: "0.5rem 0.8rem", background: color + "0a", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", fontSize: "0.75rem", color, fontWeight: "600", fontFamily: "'Inter',sans-serif" }}
                  onMouseEnter={e => e.currentTarget.style.background = color + "18"}
                  onMouseLeave={e => e.currentTarget.style.background = color + "0a"}>
                  + Add "{input.trim()}" manually
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {items.length > 0 ? (
        <div style={layout === "grid"
          ? { display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "0.6rem", padding: "0.85rem 1rem", alignItems: "stretch" }
          : { overflowX: "auto", scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch", padding: "0.85rem 1rem", display: "flex", gap: "0.65rem", alignItems: "stretch" }
        }>
          {items.map((item, i) => {
            const prod = productCache.get(item)
              || allProducts.find(p => (p.productName || "").toLowerCase() === item.toLowerCase())
              || allProducts.find(p => (p.productName || "").toLowerCase().includes(item.toLowerCase().split(" ").slice(0, 2).join(" ")));
            const _cardIng = prod?.ingredients || "";
            const _cardScore = _cardIng.trim()
              ? Math.round(analyzeIngredients(_cardIng).avgScore ?? 0)
              : (prod?.poreScore ?? null);
            const ps = _cardScore != null ? poreStyle(_cardScore) : null;
            const imgSrc = getProductImage(prod);
            const hasImg = imgSrc.startsWith("http");
            const cardStyle = layout === "grid"
              ? { background: "#fff", borderRadius: "1rem", border: `1px solid ${T.border}`, cursor: onItemTap ? "pointer" : "default", display: "flex", flexDirection: "column", overflow: "hidden", transition: "border-color 0.15s,box-shadow 0.15s", position: "relative", minWidth: 0 }
              : { flexShrink: 0, width: "110px", background: "#fff", borderRadius: "1rem", border: `1px solid ${T.border}`, cursor: onItemTap ? "pointer" : "default", display: "flex", flexDirection: "column", overflow: "hidden", transition: "border-color 0.15s,box-shadow 0.15s", position: "relative" };
            const imageStyle = layout === "grid"
              ? { width: "100%", aspectRatio: "1 / 1", background: hasImg ? "#fff" : color + "10", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${T.border}` }
              : { width: "100%", height: "90px", background: hasImg ? "#fff" : color + "10", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", borderBottom: `1px solid ${T.border}` };
            return (
              <div key={i} onClick={() => onItemTap && onItemTap(item)} style={cardStyle}
                onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.boxShadow = `0 4px 16px ${color}25`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; }}>
                {!readOnly && (
                  <button onClick={e => { e.stopPropagation(); onRemove(item); }}
                    style={{ position: "absolute", top: "5px", right: "5px", width: "18px", height: "18px", borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: `1px solid ${T.border}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2, padding: 0, lineHeight: 1, transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = T.rose; e.currentTarget.style.borderColor = T.rose; e.currentTarget.querySelector("svg").style.stroke = "#fff"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.9)"; e.currentTarget.style.borderColor = T.border; e.currentTarget.querySelector("svg").style.stroke = T.textLight; }}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
                <div style={imageStyle}>
                  {hasImg
                    ? <img src={imgSrc} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "8px", mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }} onError={e => { e.target.style.display = "none"; }} />
                    : <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "0.5rem" }}>
                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: color + "25", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: color }} />
                      </div>
                    </div>
                  }
                </div>
                <div style={{ padding: "0.5rem 0.55rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {prod?.brand && <div style={{ fontSize: "0.52rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.07em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prod.brand}</div>}
                  <div style={{ fontSize: "0.7rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{getProductDisplayName({ productName: item, brand: prod?.brand || "" })}</div>
                  {ps && (
                    <div style={{ marginTop: "auto", display: "inline-flex", alignItems: "center", gap: "2px", background: ps.color + "15", borderRadius: "999px", padding: "0.12rem 0.4rem", alignSelf: "flex-start" }}>
                      <span style={{ fontSize: "0.6rem", fontWeight: "800", color: ps.color }}>{_cardScore}/5</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!readOnly && (
            <div onClick={() => setAdding(a => !a)}
              style={layout === "grid"
                ? { borderRadius: "1rem", border: `1.5px dashed ${color}50`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4rem", cursor: "pointer", transition: "all 0.15s", padding: "1rem 0.5rem", background: color + "05", minHeight: "100%", minWidth: 0 }
                : { flexShrink: 0, width: "80px", borderRadius: "1rem", border: `1.5px dashed ${color}50`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.4rem", cursor: "pointer", transition: "all 0.15s", padding: "1rem 0.5rem", background: color + "05" }
              }
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.background = color + "12"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = color + "50"; e.currentTarget.style.background = color + "05"; }}>
              <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: color + "20", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </div>
              <span style={{ fontSize: "0.6rem", color, fontWeight: "600", fontFamily: "'Inter',sans-serif", textAlign: "center" }}>Add</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "1rem" }}>
          {!readOnly && !adding && (
            <button onClick={() => setAdding(true)}
              style={{ width: "100%", padding: "0.75rem", background: "transparent", border: `1.5px dashed ${color}40`, borderRadius: "0.75rem", color: T.textLight, fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Inter',sans-serif", textAlign: "center", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = color + "40"; e.currentTarget.style.color = T.textLight; }}>
              + Add your first product
            </button>
          )}
          {readOnly && <div style={{ color: T.textLight, fontSize: "0.78rem", fontStyle: "italic", padding: "0.25rem 0" }}>Nothing here yet</div>}
        </div>
      )}
    </div>
  );
}
