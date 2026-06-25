import React, { useState, useRef, useEffect } from "react";
import { T } from "../../data/tokens.js";
import { INGDB, INGDB_META } from "../../data/ingredients.js";
import { poreStyle } from "../shared/PoreScoreBadge.jsx";

export function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [liveResult, setLiveResult] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const searchTimer = useRef(null);

  const allIngredients = Object.entries(INGDB).map(([name, data]) => ({
    name, ...data, ...(INGDB_META[name] || {}),
  }));

  const categories = ["all", "Irritant", ...new Set(allIngredients.map(i => i.category).filter(c => c && c !== "Irritant"))];

  const filtered = allIngredients.filter(ing => {
    const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase()) ||
      (ing.aliases || []).some(a => a.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filter === "all" || ing.category === filter;
    return matchSearch && matchCat;
  }).sort((a, b) => a.name.localeCompare(b.name));

  useEffect(() => {
    if (!search.trim() || filtered.length > 0) { setLiveResult(null); return; }
    clearTimeout(searchTimer.current);
    setLiveLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`https://world.openbeautyfacts.org/api/v2/ingredients?search_terms=${encodeURIComponent(search)}&fields=id,name,vegan,vegetarian,from_palm_oil,description&page_size=5`);
        const d = await r.json();
        if (d.ingredients?.length > 0) {
          setLiveResult(d.ingredients.map(i => ({
            name: i.name || i.id?.replace(/-/g, " ") || search,
            id: i.id,
            description: i.description || null,
            vegan: i.vegan,
            vegetarian: i.vegetarian,
            fromPalmOil: i.from_palm_oil,
            score: null,
            isLive: true,
          })));
        } else {
          setLiveResult([]);
        }
      } catch { setLiveResult([]); }
      setLiveLoading(false);
    }, 500);
    return () => clearTimeout(searchTimer.current);
  }, [search, filtered.length]);

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "1rem 1rem 6rem" }}>
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "1.1rem", color: T.text, letterSpacing: "-0.02em", marginBottom: "0.2rem" }}>Ingredient Glossary</div>
        <div style={{ fontSize: "0.75rem", color: T.textLight }}>Tap any ingredient to learn more</div>
      </div>

      <div style={{ position: "relative", marginBottom: "0.75rem" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ingredients…"
          style={{ width: "100%", padding: "0.65rem 0.75rem 0.65rem 2.25rem", borderRadius: "2rem", border: `1px solid ${T.border}`, fontSize: "0.85rem", color: T.text, background: T.surface, outline: "none", fontFamily: "'Inter',sans-serif", boxSizing: "border-box" }}
          onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
      </div>

      <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1rem", scrollbarWidth: "none" }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            style={{ flexShrink: 0, padding: "0.3rem 0.75rem", borderRadius: "999px", border: `1px solid ${filter === cat ? T.accent : T.border}`, background: filter === cat ? T.accent : "transparent", color: filter === cat ? "#FFFFFF" : T.textMid, fontSize: "0.72rem", fontWeight: "500", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s", whiteSpace: "nowrap" }}>
            {cat === "all" ? "All" : cat === "Irritant" ? "⚠ Irritants" : cat}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {filtered.map(ing => {
          const ps = poreStyle(ing.score);
          return (
            <button key={ing.name} onClick={() => setSelected(selected?.name === ing.name ? null : ing)}
              style={{ background: T.surface, border: `1px solid ${selected?.name === ing.name ? T.accent : T.border}`, borderRadius: "0.85rem", padding: "0.75rem 1rem", textAlign: "left", cursor: "pointer", width: "100%", transition: "all 0.15s" }}
              onMouseEnter={e => { if (selected?.name !== ing.name) e.currentTarget.style.borderColor = T.accent + "88"; }}
              onMouseLeave={e => { if (selected?.name !== ing.name) e.currentTarget.style.borderColor = T.border; }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", textTransform: "capitalize" }}>{ing.name}</span>
                    {ing.category && <span style={{ fontSize: "0.6rem", color: T.textLight, background: T.surfaceAlt, padding: "0.1rem 0.4rem", borderRadius: "999px", border: `1px solid ${T.border}` }}>{ing.category}</span>}
                  </div>
                  {!(selected?.name === ing.name) && ing.benefit && <div style={{ fontSize: "0.72rem", color: T.textLight, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ing.benefit}</div>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, marginLeft: "0.5rem" }}>
                  <div style={{ padding: "0.2rem 0.5rem", background: ps.color + "18", borderRadius: "0.35rem", border: `1px solid ${ps.color}30` }}>
                    <span style={{ fontSize: "0.65rem", fontWeight: "700", color: ps.color, fontFamily: "'Inter',sans-serif" }}>{ing.score}/5</span>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ transform: selected?.name === ing.name ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}><polyline points="9 18 15 12 9 6" /></svg>
                </div>
              </div>
              {selected?.name === ing.name && (
                <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: `1px solid ${T.border}`, display: "flex", flexDirection: "column", gap: "0.6rem", animation: "fadeUp 0.18s ease" }}>
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    <div style={{ padding: "0.2rem 0.6rem", background: ps.color + "18", borderRadius: "999px", border: `1px solid ${ps.color}30`, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.6rem", fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: "0.05em" }}>Pore risk</span>
                      <span style={{ fontSize: "0.72rem", fontWeight: "800", color: ps.color }}>{ps.label} · {ing.score}/5</span>
                    </div>
                    {ing.irritant && <div style={{ padding: "0.2rem 0.6rem", background: T.amber + "18", borderRadius: "999px", border: `1px solid ${T.amber}30`, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: "700", color: T.amber }}>⚠ Potential irritant</span>
                    </div>}
                    {ing.score === 0 && !ing.irritant && <div style={{ padding: "0.2rem 0.6rem", background: T.sage + "18", borderRadius: "999px", border: `1px solid ${T.sage}30`, display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: "700", color: T.sage }}>✓ Generally safe</span>
                    </div>}
                  </div>
                  {ing.benefit && (
                    <div>
                      <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.sage, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>What it does</div>
                      <div style={{ fontSize: "0.78rem", color: T.text, lineHeight: 1.55 }}>{ing.benefit}</div>
                    </div>
                  )}
                  {ing.note && ing.note !== ing.benefit && (
                    <div>
                      <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.accent, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>Why it matters</div>
                      <div style={{ fontSize: "0.75rem", color: T.textMid, lineHeight: 1.55 }}>{ing.note}</div>
                    </div>
                  )}
                  {ing.concern && ing.concern !== "None known" && (
                    <div style={{ padding: "0.5rem 0.65rem", background: T.rose + "08", borderRadius: "0.5rem", border: `1px solid ${T.rose}20` }}>
                      <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.rose, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>Watch out</div>
                      <div style={{ fontSize: "0.75rem", color: T.textMid, lineHeight: 1.5 }}>{ing.concern}</div>
                    </div>
                  )}
                  {(ing.aliases || []).length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "3px" }}>Also listed as</div>
                      <div style={{ fontSize: "0.72rem", color: T.textLight, lineHeight: 1.5 }}>{ing.aliases.join(" · ")}</div>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 && search.trim() && (
        <div>
          {liveLoading && (
            <div style={{ textAlign: "center", padding: "2rem", color: T.textLight, fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              <div style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
              Looking up product...
            </div>
          )}
          {!liveLoading && liveResult && liveResult.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {liveResult.map((ing, i) => (
                <div key={i} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "0.85rem", padding: "0.85rem 1rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", textTransform: "capitalize" }}>{ing.name}</span>
                    <span style={{ fontSize: "0.65rem", color: T.textLight, background: T.surfaceAlt, padding: "0.15rem 0.5rem", borderRadius: "999px", border: `1px solid ${T.border}` }}>Not in local DB</span>
                  </div>
                  {ing.description && <p style={{ fontSize: "0.78rem", color: T.textMid, margin: "0 0 0.4rem", lineHeight: 1.5 }}>{ing.description}</p>}
                  <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {ing.vegan === "yes" && <span style={{ fontSize: "0.62rem", padding: "0.15rem 0.5rem", background: T.sage + "15", color: T.sage, borderRadius: "999px", border: `1px solid ${T.sage}30` }}>Vegan</span>}
                    {ing.vegetarian === "yes" && <span style={{ fontSize: "0.62rem", padding: "0.15rem 0.5rem", background: T.sage + "15", color: T.sage, borderRadius: "999px", border: `1px solid ${T.sage}30` }}>Vegetarian</span>}
                    {ing.fromPalmOil === "yes" && <span style={{ fontSize: "0.62rem", padding: "0.15rem 0.5rem", background: T.amber + "15", color: T.amber, borderRadius: "999px", border: `1px solid ${T.amber}30` }}>Palm oil derived</span>}
                    <span style={{ fontSize: "0.62rem", padding: "0.15rem 0.5rem", background: T.textLight + "15", color: T.textLight, borderRadius: "999px", border: `1px solid ${T.border}` }}>Pore clog score unknown</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {!liveLoading && liveResult && liveResult.length === 0 && (
            <div style={{ textAlign: "center", padding: "2rem", color: T.textLight, fontSize: "0.82rem" }}>
              No results found for "{search}" — try a different spelling or the INCI name
            </div>
          )}
        </div>
      )}
    </div>
  );
}
