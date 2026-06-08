// =============================================================================
// Ralli by GoodSisters — v9 (Simplified: Scan → Score → History)
// -----------------------------------------------------------------------------
// Single-file React app. Personal skincare ingredient analyzer.
//
// FLOW:
//   1. User opens app → input box (type a product name OR take a picture)
//   2. AI resolves the product's ingredient list (web search)
//   3. Ingredients are scored against the local comedogenic database
//   4. A Pore Score (0–5) + flagged ingredients are returned
//   5. Result is cached to Firestore (shared) + appended to the user's history
//
// INPUT MODES BUILT HERE:
//   • Type a product name        → FULLY BUILT
//   • AI search (the resolve step) → FULLY BUILT
//   • Take a picture             → STUBBED (clearly marked) — extend after
//                                   on-device testing. See resolveFromPhoto().
//
// ARCHITECTURE:
//   input → check Firestore cache → hit? instant score
//                                 → miss? AI search → score → write cache
//         → append to per-user history
//
// PRESERVED IP: the comedogenic ingredient database + analyzeIngredients()
//   scoring logic. This is the moat — everything else is plumbing.
//
// BRAND: Deep Navy #111827 · Cloud White #F8F9FB · Sage #2C7A5C ·
//        Ice Blue #CFE8FF · Rose #AA4F57 · Amber #8B6914
//        Fonts: Inter (UI), Poppins (logo/display). No Cormorant.
// =============================================================================

import React, { useState, useEffect, useRef, useCallback } from "react";
import { initializeApp } from "firebase/app";
import {
  getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, collection, addDoc, query,
  orderBy, onSnapshot, serverTimestamp, deleteDoc,
} from "firebase/firestore";

// -----------------------------------------------------------------------------
// Firebase — project feb242026morg
// -----------------------------------------------------------------------------
const firebaseConfig = {
  apiKey: "AIzaSyCPPl-cpHpA714AgE_mJI3MDj6nSVlSJRg",
  authDomain: "feb242026morg.firebaseapp.com",
  projectId: "feb242026morg",
  storageBucket: "feb242026morg.firebasestorage.app",
  messagingSenderId: "75912486030",
  appId: "1:75912486030:web:ff8eebbc6f93fcf4307ddf",
  measurementId: "G-T0HD8TRQKL",
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =============================================================================
// BRAND TOKENS
// =============================================================================
const C = {
  navy: "#111827",
  cloud: "#F8F9FB",
  surface: "#FFFFFF",
  midText: "#4A5568",
  lightText: "#9AACBC",
  sage: "#2C7A5C",
  rose: "#AA4F57",
  amber: "#8B6914",
  ice: "#CFE8FF",
  border: "#E6E8EC",
};
const FONT_UI = "'Inter', -apple-system, system-ui, sans-serif";
const FONT_DISPLAY = "'Poppins', 'Inter', sans-serif";

// =============================================================================
// COMEDOGENIC INGREDIENT DATABASE  (the preserved IP)
// -----------------------------------------------------------------------------
// rating: 0–5 comedogenic (pore-clogging). type: 'clogger' | 'irritant'.
// Sodium chloride & potassium chloride are deliberately EXCLUDED — high Fulton
// scores but only matter at high concentration; they cause false positives.
//
// This is a representative seed. Expand from your full audited ~250-row set.
// =============================================================================
const INGREDIENT_DB = {
  // — High pore-cloggers —
  "coconut oil": { rating: 4, type: "clogger", note: "Highly comedogenic oil." },
  "cocos nucifera oil": { rating: 4, type: "clogger", note: "Coconut oil — highly comedogenic." },
  "isopropyl myristate": { rating: 5, type: "clogger", note: "Very high pore-clogging potential." },
  "isopropyl palmitate": { rating: 4, type: "clogger", note: "High pore-clogging potential." },
  "myristyl myristate": { rating: 5, type: "clogger", note: "Very high pore-clogging potential." },
  "isopropyl isostearate": { rating: 5, type: "clogger", note: "Very high pore-clogging potential." },
  "cocoa butter": { rating: 4, type: "clogger", note: "Rich butter, can clog pores." },
  "theobroma cacao seed butter": { rating: 4, type: "clogger", note: "Cocoa butter — can clog pores." },
  "wheat germ oil": { rating: 5, type: "clogger", note: "Very high comedogenic rating." },
  "flax seed oil": { rating: 4, type: "clogger", note: "High comedogenic rating." },
  "lauric acid": { rating: 4, type: "clogger", note: "Fatty acid, high pore-clogging." },
  "oleic acid": { rating: 3, type: "clogger", note: "Fatty acid, moderate pore-clogging." },
  "myristic acid": { rating: 3, type: "clogger", note: "Fatty acid, moderate pore-clogging." },
  "palmitic acid": { rating: 2, type: "clogger", note: "Fatty acid, low–moderate." },
  "stearic acid": { rating: 2, type: "clogger", note: "Fatty acid, generally low risk." },
  "algae extract": { rating: 4, type: "clogger", note: "Can be comedogenic." },
  "laureth-4": { rating: 5, type: "clogger", note: "Very high pore-clogging potential." },
  "myristyl lactate": { rating: 4, type: "clogger", note: "High pore-clogging potential." },
  "octyl palmitate": { rating: 4, type: "clogger", note: "High pore-clogging potential." },
  "ethylhexyl palmitate": { rating: 4, type: "clogger", note: "High pore-clogging potential." },
  "decyl oleate": { rating: 3, type: "clogger", note: "Moderate pore-clogging." },
  "glyceryl stearate se": { rating: 3, type: "clogger", note: "Self-emulsifying, moderate." },
  "lanolin": { rating: 2, type: "clogger", note: "Occlusive, low–moderate for acne-prone." },
  "acetylated lanolin": { rating: 4, type: "clogger", note: "High pore-clogging potential." },
  "shea butter": { rating: 0, type: "clogger", note: "Generally non-comedogenic." },
  "butyrospermum parkii butter": { rating: 0, type: "clogger", note: "Shea butter — non-comedogenic." },

  // — Low / safe (rating 0–1) —
  "squalane": { rating: 0, type: "clogger", note: "Non-comedogenic, mimics skin's own oils." },
  "glycerin": { rating: 0, type: "clogger", note: "Humectant, non-comedogenic." },
  "hyaluronic acid": { rating: 0, type: "clogger", note: "Humectant, non-comedogenic." },
  "sodium hyaluronate": { rating: 0, type: "clogger", note: "Humectant, non-comedogenic." },
  "niacinamide": { rating: 0, type: "clogger", note: "Non-comedogenic active." },
  "dimethicone": { rating: 1, type: "clogger", note: "Silicone, very low pore-clogging." },
  "cyclopentasiloxane": { rating: 0, type: "clogger", note: "Volatile silicone, non-comedogenic." },
  "water": { rating: 0, type: "clogger", note: "Solvent, inert." },
  "pentylene glycol": { rating: 0, type: "clogger", note: "Humectant/solvent, non-comedogenic." },
  "caprylyl glycol": { rating: 0, type: "clogger", note: "Conditioning, non-comedogenic." },
  "1,2-hexanediol": { rating: 0, type: "clogger", note: "Solvent/preservative booster." },
  "ceramide np": { rating: 0, type: "clogger", note: "Barrier lipid, non-comedogenic." },
  "ceramide ap": { rating: 0, type: "clogger", note: "Barrier lipid, non-comedogenic." },
  "ceramide eop": { rating: 0, type: "clogger", note: "Barrier lipid, non-comedogenic." },
  "ceramide ng": { rating: 0, type: "clogger", note: "Barrier lipid, non-comedogenic." },
  "ceramide as": { rating: 0, type: "clogger", note: "Barrier lipid, non-comedogenic." },
  "carnosine": { rating: 0, type: "clogger", note: "Antioxidant, non-comedogenic." },
  "hydrogenated lecithin": { rating: 1, type: "clogger", note: "Emulsifier, very low risk." },
  "phytosterols": { rating: 0, type: "clogger", note: "Barrier support, non-comedogenic." },
  "polyglyceryl-2 stearate": { rating: 1, type: "clogger", note: "Emulsifier, low risk." },
  "glyceryl stearate": { rating: 1, type: "clogger", note: "Emulsifier, low risk." },
  "stearyl alcohol": { rating: 1, type: "clogger", note: "Fatty alcohol, low risk." },
  "cetyl alcohol": { rating: 2, type: "clogger", note: "Fatty alcohol, low–moderate." },
  "cetearyl alcohol": { rating: 2, type: "clogger", note: "Fatty alcohol, low–moderate." },
  "polyacrylate crosspolymer-11": { rating: 0, type: "clogger", note: "Texture agent, non-comedogenic." },

  // — Irritants (flagged separately, do not raise pore score) —
  "fragrance": { rating: 0, type: "irritant", note: "Common irritant / allergen." },
  "parfum": { rating: 0, type: "irritant", note: "Fragrance — common irritant." },
  "alcohol denat": { rating: 0, type: "irritant", note: "Drying alcohol, can irritate." },
  "denatured alcohol": { rating: 0, type: "irritant", note: "Drying alcohol, can irritate." },
  "menthol": { rating: 0, type: "irritant", note: "Can irritate sensitive skin." },
  "limonene": { rating: 0, type: "irritant", note: "Fragrance component, potential allergen." },
  "linalool": { rating: 0, type: "irritant", note: "Fragrance component, potential allergen." },
  "citrus limon peel oil": { rating: 0, type: "irritant", note: "Essential oil, potential irritant." },
  "eugenol": { rating: 0, type: "irritant", note: "Fragrance component, potential allergen." },
  "sodium lauryl sulfate": { rating: 0, type: "irritant", note: "Harsh surfactant, can irritate." },
};

// =============================================================================
// SCORING  (analyzeIngredients) — shared pure function, single source of truth
// -----------------------------------------------------------------------------
// Pore Score = average of matched CLOGGER ratings, rounded to nearest integer.
// Irritants are surfaced separately and do NOT affect the pore score.
// =============================================================================
function normalize(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")     // drop parentheticals
    .replace(/[*•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseIngredientString(raw) {
  if (!raw) return [];
  return raw
    .split(/[,;\n]/)
    .map((x) => normalize(x))
    .filter(Boolean);
}

function analyzeIngredients(rawIngredients) {
  const list = Array.isArray(rawIngredients)
    ? rawIngredients.map(normalize).filter(Boolean)
    : parseIngredientString(rawIngredients);

  const cloggers = [];
  const irritants = [];
  let scoreSum = 0;
  let scoreCount = 0;

  list.forEach((name) => {
    // exact match first, then loose contains match for compound names
    let hit = INGREDIENT_DB[name];
    if (!hit) {
      const key = Object.keys(INGREDIENT_DB).find(
        (k) => name === k || name.includes(k) || k.includes(name)
      );
      if (key) hit = INGREDIENT_DB[key];
    }
    if (!hit) return;

    if (hit.type === "irritant") {
      irritants.push({ name, ...hit });
    } else {
      if (hit.rating >= 2) cloggers.push({ name, ...hit });
      scoreSum += hit.rating;
      scoreCount += 1;
    }
  });

  const poreScore = scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0;
  return {
    poreScore,
    cloggers: cloggers.sort((a, b) => b.rating - a.rating),
    irritants,
    matched: scoreCount,
    total: list.length,
  };
}

const SCORE_META = {
  0: { label: "Clear", color: C.sage, desc: "No known pore-cloggers. Safe for all skin types including acne-prone." },
  1: { label: "Minimal", color: C.sage, desc: "Very low risk." },
  2: { label: "Low", color: C.amber, desc: "Some moderate pore-cloggers. Use cautiously if acne-prone." },
  3: { label: "High", color: C.rose, desc: "Multiple higher-risk ingredients. May break out acne-prone or oily skin." },
  4: { label: "High", color: C.rose, desc: "Multiple high-risk ingredients. Likely to break out acne-prone or oily skin." },
  5: { label: "Avoid", color: "#7A1F25", desc: "Highly comedogenic formula. Most dermatologists would not recommend." },
};

// =============================================================================
// AI RESOLVE — the "AI searches for the ingredients" step
// -----------------------------------------------------------------------------
// Calls our OWN backend proxy (/api/resolve), which holds the Anthropic API key
// server-side and forwards to the Anthropic API with the web_search tool. The
// browser never sees the key. See api/resolve.js in the Vercel project.
//
// NOTE: This only works when deployed to Vercel (or running `vercel dev`
// locally). It will NOT work in StackBlitz's preview, which doesn't run
// serverless functions — sign-in and the UI work there, but the scan does not.
// =============================================================================
async function resolveFromName(rawQuery) {
  const prompt = `You are an ingredient-lookup tool for a skincare app. The user typed this product: "${rawQuery}".

Search the web for this exact skincare product and find its full INCI ingredient list from a reliable source (the manufacturer's site, a major retailer, or an ingredient database like INCIDecoder/CosDNA). Be careful to match the exact product variant.

Respond with ONLY a JSON object, no preamble, no markdown fences:
{
  "found": true,
  "productName": "exact product name",
  "brand": "brand name",
  "ingredients": ["Water", "Glycerin", ...],
  "source": "where you found it"
}
If you cannot confidently find the ingredient list, respond: { "found": false }`;

  let res;
  try {
    res = await fetch("/api/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      }),
    });
  } catch {
    throw new Error("Couldn't reach the lookup service. (The AI scan only works on the deployed site, not the preview.)");
  }
  if (!res.ok) throw new Error("Lookup service error. Please try again.");
  const data = await res.json();

  const text = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .replace(/```json|```/g, "")
    .trim();

  let parsed;
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("Could not read the ingredient list. Try the exact product name.");
  }
  if (!parsed.found) throw new Error("Couldn't find that product. Try a more specific name or photograph the ingredient label.");
  return parsed;
}

// STUB — Take-a-picture path. Build out after on-device testing.
// Two sub-modes intended: (a) photo of FRONT → identify product → resolveFromName;
// (b) photo of BACK → read the INCI panel directly via vision. Add a confirm
// step before scoring so the user can correct misreads.
async function resolveFromPhoto(/* base64Image */) {
  throw new Error("Photo scanning is coming soon — use product name for now.");
}

// =============================================================================
// CACHE KEY
// =============================================================================
function cacheKey(productName, brand) {
  return normalize(`${brand || ""} ${productName || ""}`).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 180);
}

// =============================================================================
// SMALL UI PIECES
// =============================================================================
function PoreScoreBadge({ score, size = 96 }) {
  const [display, setDisplay] = useState(0);
  const meta = SCORE_META[score] ?? SCORE_META[0];
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setDisplay(n);
      if (n >= score) clearInterval(id);
    }, 110);
    if (score === 0) setDisplay(0);
    return () => clearInterval(id);
  }, [score]);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: meta.color, color: "#fff", display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center",
      fontFamily: FONT_DISPLAY, boxShadow: "0 6px 20px rgba(17,24,39,0.18)",
    }}>
      <span style={{ fontSize: size * 0.42, fontWeight: 800, lineHeight: 1 }}>{display}</span>
      <span style={{ fontSize: size * 0.14, letterSpacing: 0.5, opacity: 0.92 }}>{meta.label}</span>
    </div>
  );
}

function Chip({ children, kind }) {
  const bg = kind === "irritant" ? "rgba(139,105,20,0.12)" : "rgba(170,79,87,0.12)";
  const fg = kind === "irritant" ? C.amber : C.rose;
  return (
    <span style={{
      display: "inline-block", padding: "5px 10px", borderRadius: 999,
      background: bg, color: fg, fontSize: 12.5, fontWeight: 600,
      margin: "3px 4px 3px 0", textTransform: "capitalize",
    }}>{children}</span>
  );
}

// =============================================================================
// RESULT CARD
// =============================================================================
function ResultCard({ result }) {
  const meta = SCORE_META[result.poreScore] ?? SCORE_META[0];
  return (
    <div style={{
      background: C.surface, borderRadius: 20, border: `1px solid ${C.border}`,
      padding: 22, boxShadow: "0 2px 14px rgba(17,24,39,0.05)",
    }}>
      <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
        <PoreScoreBadge score={result.poreScore} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, letterSpacing: 1, color: C.lightText, textTransform: "uppercase", fontWeight: 700 }}>
            {result.brand || "Product"}
          </div>
          <div style={{ fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: 700, color: C.navy, lineHeight: 1.2, marginTop: 2 }}>
            {result.productName}
          </div>
          <div style={{ fontSize: 13.5, color: C.midText, marginTop: 8 }}>{meta.desc}</div>
        </div>
      </div>

      {result.cloggers.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.rose, marginBottom: 6 }}>Pore-clogging ingredients</div>
          <div>{result.cloggers.map((c) => <Chip key={c.name} kind="clogger">{c.name} · {c.rating}</Chip>)}</div>
        </div>
      )}

      {result.irritants.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.amber, marginBottom: 6 }}>Potential irritants</div>
          <div>{result.irritants.map((c) => <Chip key={c.name} kind="irritant">{c.name}</Chip>)}</div>
        </div>
      )}

      {result.cloggers.length === 0 && result.irritants.length === 0 && (
        <div style={{ marginTop: 16, fontSize: 13.5, color: C.sage, fontWeight: 600 }}>
          ✓ No flagged pore-cloggers or common irritants detected.
        </div>
      )}

      <div style={{ marginTop: 16, fontSize: 11.5, color: C.lightText }}>
        Matched {result.matched} of {result.total} ingredients against the database.
        {result.source ? ` Source: ${result.source}.` : ""}
      </div>
    </div>
  );
}

// =============================================================================
// SCAN SCREEN  (type a name + AI search + photo stub)
// =============================================================================
function ScanScreen({ user, onScored }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const runScan = useCallback(async (rawQuery) => {
    setError(""); setResult(null); setLoading(true);
    try {
      // 1) Resolve product + ingredients (AI search)
      const resolved = await resolveFromName(rawQuery);
      const key = cacheKey(resolved.productName, resolved.brand);

      // 2) Check Firestore cache
      let scored;
      const cachedSnap = await getDoc(doc(db, "products", key));
      if (cachedSnap.exists()) {
        const c = cachedSnap.data();
        scored = {
          productName: c.productName, brand: c.brand, source: c.source,
          ...analyzeIngredients(c.ingredients),
        };
      } else {
        // 3) Score + write to shared cache
        const analysis = analyzeIngredients(resolved.ingredients);
        scored = { productName: resolved.productName, brand: resolved.brand, source: resolved.source, ...analysis };
        await setDoc(doc(db, "products", key), {
          productName: resolved.productName, brand: resolved.brand,
          ingredients: resolved.ingredients, source: resolved.source || "",
          poreScore: analysis.poreScore, createdAt: serverTimestamp(),
        });
      }

      // 4) Append to per-user history
      await addDoc(collection(db, "users", user.uid, "scans"), {
        productName: scored.productName, brand: scored.brand,
        poreScore: scored.poreScore, scannedAt: serverTimestamp(),
        cloggers: scored.cloggers.map((c) => c.name),
        irritants: scored.irritants.map((c) => c.name),
      });

      setResult(scored);
      onScored?.();
    } catch (e) {
      setError(e.message || "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }, [user, onScored]);

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    try {
      await resolveFromPhoto(file); // stub throws "coming soon"
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ padding: "8px 18px 28px" }}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, color: C.navy, margin: "10px 0 4px" }}>
        Check a product
      </h2>
      <p style={{ fontSize: 14, color: C.midText, marginTop: 0, marginBottom: 18 }}>
        Type a product name or snap its label — we'll find the ingredients and score it.
      </p>

      <div style={{
        display: "flex", gap: 8, background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 16, padding: 8, boxShadow: "0 2px 10px rgba(17,24,39,0.04)",
      }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && text.trim() && !loading) runScan(text.trim()); }}
          placeholder="e.g. Vanicream Daily Facial Moisturizer"
          style={{
            flex: 1, border: "none", outline: "none", fontSize: 15,
            fontFamily: FONT_UI, color: C.navy, padding: "10px 8px", background: "transparent",
          }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          title="Take a picture"
          style={{
            border: `1px solid ${C.border}`, background: C.cloud, borderRadius: 12,
            width: 44, cursor: "pointer", fontSize: 18,
          }}
        >📷</button>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handlePhoto} style={{ display: "none" }} />
        <button
          onClick={() => text.trim() && runScan(text.trim())}
          disabled={loading || !text.trim()}
          style={{
            border: "none", background: loading || !text.trim() ? C.lightText : C.navy,
            color: "#fff", borderRadius: 12, padding: "0 18px", fontSize: 14.5,
            fontWeight: 700, cursor: loading || !text.trim() ? "default" : "pointer",
            fontFamily: FONT_UI,
          }}
        >{loading ? "…" : "Check"}</button>
      </div>

      {loading && (
        <div style={{ marginTop: 22, textAlign: "center", color: C.midText, fontSize: 14 }}>
          <div style={{
            width: 26, height: 26, border: `3px solid ${C.ice}`, borderTopColor: C.navy,
            borderRadius: "50%", margin: "0 auto 10px", animation: "ralliSpin 0.8s linear infinite",
          }} />
          Searching for ingredients…
        </div>
      )}

      {error && (
        <div style={{
          marginTop: 18, padding: "12px 14px", borderRadius: 12,
          background: "rgba(170,79,87,0.08)", color: C.rose, fontSize: 13.5, fontWeight: 500,
        }}>{error}</div>
      )}

      {result && !loading && (
        <div style={{ marginTop: 22 }}><ResultCard result={result} /></div>
      )}

      <style>{`@keyframes ralliSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// =============================================================================
// HISTORY SCREEN
// =============================================================================
function HistoryScreen({ user }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "users", user.uid, "scans"), orderBy("scannedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setScans(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [user]);

  const remove = async (id) => { await deleteDoc(doc(db, "users", user.uid, "scans", id)); };

  return (
    <div style={{ padding: "8px 18px 28px" }}>
      <h2 style={{ fontFamily: FONT_DISPLAY, fontSize: 26, fontWeight: 800, color: C.navy, margin: "10px 0 16px" }}>
        Your scans
      </h2>
      {loading && <div style={{ color: C.lightText, fontSize: 14 }}>Loading…</div>}
      {!loading && scans.length === 0 && (
        <div style={{ color: C.midText, fontSize: 14, textAlign: "center", marginTop: 40 }}>
          No scans yet. Check your first product to start your history.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {scans.map((s) => {
          const meta = SCORE_META[s.poreScore] ?? SCORE_META[0];
          return (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 14, background: C.surface,
              border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px",
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: "50%", background: meta.color,
                color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT_DISPLAY, fontWeight: 800, fontSize: 18, flexShrink: 0,
              }}>{s.poreScore}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: C.lightText, fontWeight: 700, textTransform: "uppercase" }}>{s.brand}</div>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {s.productName}
                </div>
              </div>
              <button onClick={() => remove(s.id)} style={{
                border: "none", background: "transparent", color: C.lightText,
                cursor: "pointer", fontSize: 18, padding: 4,
              }}>×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// AUTH SCREEN
// =============================================================================
function AuthScreen() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");

  const google = async () => {
    setError("");
    try { await signInWithPopup(auth, new GoogleAuthProvider()); }
    catch (e) { setError(e.message); }
  };
  const emailAuth = async () => {
    setError("");
    try {
      if (mode === "signin") await signInWithEmailAndPassword(auth, email, pw);
      else await createUserWithEmailAndPassword(auth, email, pw);
    } catch (e) { setError(e.message); }
  };

  return (
    <div style={{
      minHeight: "100vh", background: C.cloud, display: "flex",
      flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24,
    }}>
      <div style={{ fontFamily: FONT_DISPLAY, fontSize: 44, fontWeight: 800, color: C.navy }}>Ralli</div>
      <div style={{ fontSize: 14, color: C.midText, marginBottom: 28 }}>Real people. Real skin. Real insights.</div>

      <div style={{ width: "100%", maxWidth: 340, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 20, padding: 22 }}>
        <button onClick={google} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: `1px solid ${C.border}`,
          background: "#fff", fontSize: 14.5, fontWeight: 600, cursor: "pointer", marginBottom: 14, fontFamily: FONT_UI,
        }}>Continue with Google</button>

        <div style={{ textAlign: "center", color: C.lightText, fontSize: 12, margin: "6px 0 14px" }}>or</div>

        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 10, fontSize: 14, fontFamily: FONT_UI }} />
        <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" placeholder="Password"
          style={{ width: "100%", boxSizing: "border-box", padding: "11px 12px", borderRadius: 12, border: `1px solid ${C.border}`, marginBottom: 14, fontSize: 14, fontFamily: FONT_UI }} />
        <button onClick={emailAuth} style={{
          width: "100%", padding: "12px", borderRadius: 12, border: "none",
          background: C.navy, color: "#fff", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: FONT_UI,
        }}>{mode === "signin" ? "Sign in" : "Create account"}</button>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: C.midText }}>
          {mode === "signin" ? "New here? " : "Have an account? "}
          <span onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            style={{ color: C.sage, fontWeight: 700, cursor: "pointer" }}>
            {mode === "signin" ? "Create one" : "Sign in"}
          </span>
        </div>
        {error && <div style={{ marginTop: 12, color: C.rose, fontSize: 12.5 }}>{error}</div>}
      </div>
    </div>
  );
}

// =============================================================================
// ROOT
// =============================================================================
export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("scan");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => { setUser(u); setAuthReady(true); });
    return () => unsub();
  }, []);

  if (!authReady) {
    return <div style={{ minHeight: "100vh", background: C.cloud, display: "flex", alignItems: "center", justifyContent: "center", color: C.lightText, fontFamily: FONT_UI }}>Loading…</div>;
  }
  if (!user) return <AuthScreen />;

  return (
    <div style={{ minHeight: "100vh", background: C.cloud, fontFamily: FONT_UI, display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <span style={{ fontFamily: FONT_DISPLAY, fontSize: 24, fontWeight: 800, color: C.navy }}>Ralli</span>
        <button onClick={() => signOut(auth)} style={{ border: "none", background: "transparent", color: C.lightText, fontSize: 13, cursor: "pointer", fontFamily: FONT_UI }}>Sign out</button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "scan" ? <ScanScreen user={user} onScored={() => {}} /> : <HistoryScreen user={user} />}
      </div>

      {/* Bottom nav */}
      <div style={{ display: "flex", borderTop: `1px solid ${C.border}`, background: C.surface }}>
        {[["scan", "Check", "🔍"], ["history", "Scans", "📋"]].map(([id, label, icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "12px 0 16px", border: "none", background: "transparent",
            cursor: "pointer", color: tab === id ? C.navy : C.lightText,
            fontWeight: tab === id ? 700 : 500, fontSize: 12, fontFamily: FONT_UI,
          }}>
            <div style={{ fontSize: 20, marginBottom: 3 }}>{icon}</div>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
