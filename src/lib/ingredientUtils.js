import { INGDB } from "../data/ingredients.js";

// Shared ingredient-pattern matcher used by analyzeIngredients and the product-modal pill renderer.
// Long patterns (>=5 chars): plain substring match.
// Short patterns (<=4 chars): exact token match or hyphen-bounded chemical notation prefix/suffix.
export function matchIngredientPattern(token, pattern) {
  if (!token || !pattern) return false;
  const t = token.toLowerCase();
  const p = pattern.toLowerCase();
  if (p.length >= 5) {
    return t.includes(p);
  }
  if (t === p) return true;
  const escaped = p.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
  const re = new RegExp("(^" + escaped + "-)|(-" + escaped + "$)|(-" + escaped + "-)", "i");
  return re.test(t);
}

export function analyzeIngredients(text) {
  const lower = (text || "").toLowerCase();
  const tokens = lower.split(/[,;]\s*/).map(t => t.trim()).filter(Boolean);

  const lookup = [];
  for (const [name, data] of Object.entries(INGDB)) {
    const allNames = [name, ...(data.aliases || [])];
    for (const n of allNames) {
      if (n) lookup.push({ pattern: n.toLowerCase(), canonical: name, data });
    }
  }
  lookup.sort((a, b) => b.pattern.length - a.pattern.length);

  const found = [];
  const seenCanonical = new Set();
  tokens.forEach((token, idx) => {
    for (const entry of lookup) {
      if (seenCanonical.has(entry.canonical)) continue;
      if (matchIngredientPattern(token, entry.pattern)) {
        seenCanonical.add(entry.canonical);
        const display = token === entry.pattern ? entry.canonical : `${entry.canonical} (${token})`;
        found.push({ name: display, position: idx + 1, ...entry.data });
        break;
      }
    }
  });

  function positionWeight(pos) {
    if (pos <= 3) return 1.0;
    if (pos <= 7) return 0.7;
    if (pos <= 12) return 0.4;
    return 0.15;
  }

  const flagged = found.filter(i => i.score >= 1 || i.irritant);
  const poreCloggers = flagged.filter(i => i.score >= 1);
  const irritants = flagged.filter(i => i.irritant && i.score < 1);

  const avgScore = (() => {
    if (!poreCloggers.length) return found.length > 0 ? 0 : null;
    const weighted = poreCloggers.map(i => i.score * positionWeight(i.position || 99));
    const wMax = Math.max(...weighted);
    const wAvg = weighted.reduce((s, v) => s + v, 0) / weighted.length;
    const raw = (wMax * 0.7) + (wAvg * 0.3);
    return Math.round(Math.min(Math.max(raw, 0), 5) * 10) / 10;
  })();

  return { found, flagged, poreCloggers, irritants, avgScore };
}
