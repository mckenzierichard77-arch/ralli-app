import React, { useState, useEffect, useRef, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  doc, getDoc, getDocs, addDoc, setDoc, deleteDoc, updateDoc,
  collection, query, where, limit, serverTimestamp, increment,
  arrayRemove, arrayUnion, deleteField,
} from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { ACTIVES } from "../../data/actives.js";
import { INGDB, INGDB_META } from "../../data/ingredients.js";
import { AMAZON_AFFILIATE_TAG } from "../../data/constants.js";
import { analyzeIngredients, matchIngredientPattern, getIngredientLookup } from "../../lib/ingredientUtils.js";
import { getProductImage } from "../../lib/imageUtils.js";
import { db } from "../../lib/firebase.js";
import { poreStyle } from "./PoreScoreBadge.jsx";
import { ShareProductModal } from "./ShareProductModal.jsx";
import { useProduct } from "../providers/ProductCacheProvider.jsx";
import { postScan } from "../../lib/socialUtils.js";
import { ProductImage } from "../ui/ProductImage.jsx";

function communityColor(r) {
  if (r >= 8) return T.sage;
  if (r >= 5) return T.amber;
  return T.rose;
}

function amazonUrl(productName, brand, barcode, asin, existingBuyUrl) {
  const tag = AMAZON_AFFILIATE_TAG ? `&tag=${AMAZON_AFFILIATE_TAG}` : "";
  if (existingBuyUrl && existingBuyUrl.startsWith("http")) {
    if (AMAZON_AFFILIATE_TAG && existingBuyUrl.includes("amazon.com")) {
      const sep = existingBuyUrl.includes("?") ? "&" : "?";
      return existingBuyUrl.includes("tag=") ? existingBuyUrl : `${existingBuyUrl}${sep}tag=${AMAZON_AFFILIATE_TAG}`;
    }
    return existingBuyUrl;
  }
  if (asin) return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_AFFILIATE_TAG || ""}`;
  const name = (productName || "").trim();
  const br = (brand || "").trim();
  const q = encodeURIComponent(br ? `${br} ${name}` : name);
  return `https://www.amazon.com/s?k=${q}&i=beauty${tag}`;
}

function shareProduct(productName, brand) {
  const text = `Check out ${brand ? brand + " " : ""}${productName} on Ralli`;
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: "Ralli by GoodSisters", text, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(`${text} — ${url}`).then(() => {
      const toast = document.createElement("div");
      toast.className = "share-toast";
      toast.textContent = "Link copied!";
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2200);
    }).catch(() => {});
  }
}

async function trackProductClick(productId, productName) {
  if (!productId && !productName) return;
  try {
    if (productId) {
      await updateDoc(doc(db, "products", productId), {
        clickCount: increment(1),
        lastClickedAt: Date.now(),
      });
    } else {
      const key = productName.toLowerCase().trim();
      const ref = doc(db, "productClicks", key);
      await setDoc(ref, { productName, clickCount: increment(1), lastClickedAt: Date.now() }, { merge: true });
    }
  } catch {}
}

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

export function StarRating({ max, value, onChange, label }) {
  return (
    <div>
      <div style={{ fontSize: "0.72rem", color: T.textLight, marginBottom: "0.4rem", fontFamily: "'Inter',sans-serif" }}>{label}</div>
      <div style={{ display: "flex", gap: "0.3rem" }}>
        {Array.from({ length: max }, (_, i) => (
          <button key={i} onClick={() => onChange(i + 1)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", fontSize: "1.4rem", color: i < value ? T.accent : T.border, transition: "color 0.1s" }}>
            ★
          </button>
        ))}
        <span style={{ fontSize: "0.82rem", color: T.textMid, marginLeft: "0.25rem", alignSelf: "center" }}>{value}/{max}</span>
      </div>
    </div>
  );
}

export function KeyActivesSection({ ingredients }) {
  const [activeDetail, setActiveDetail] = React.useState(null);
  if (!ingredients) return null;
  const ingLower = ingredients.toLowerCase();
  const found = ACTIVES.filter((a, i, arr) =>
    ingLower.includes(a.name) &&
    arr.findIndex(b => b.label === a.label) === i
  );
  if (!found.length) return null;
  return (
    <div style={{ marginBottom: "0.75rem" }}>
      <div style={{ fontSize: "0.6rem", color: T.navy, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: "600", marginBottom: "0.5rem" }}>Key Actives <span style={{ fontWeight: "400", color: T.textLight, textTransform: "none", letterSpacing: 0, fontSize: "0.58rem" }}>— tap to learn more</span></div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
        {found.map(a => {
          const isOpen = activeDetail === a.name;
          const dbEntry = INGDB_META[a.name.toLowerCase()] || {};
          return (
            <div key={a.name} style={{ width: "100%" }}>
              <button onClick={() => setActiveDetail(isOpen ? null : a.name)}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: isOpen ? T.accent + "18" : T.accent + "10", border: `1px solid ${isOpen ? T.accent + "55" : T.accent + "25"}`, borderRadius: isOpen ? "0.5rem 0.5rem 0 0" : "0.5rem", padding: "0.4rem 0.65rem", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: "700", color: T.accent }}>{a.label}</div>
                  <div style={{ fontSize: "0.62rem", color: T.textMid }}>{a.benefit}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" style={{ flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {isOpen && (
                <div style={{ background: T.accent + "08", border: `1px solid ${T.accent + "25"}`, borderTop: "none", borderRadius: "0 0 0.5rem 0.5rem", padding: "0.65rem 0.75rem", display: "flex", flexDirection: "column", gap: "0.5rem", animation: "fadeUp 0.15s ease" }}>
                  {dbEntry.benefit && <div>
                    <div style={{ fontSize: "0.58rem", fontWeight: "700", color: T.sage, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2px" }}>What it does</div>
                    <div style={{ fontSize: "0.78rem", color: T.text, lineHeight: 1.5 }}>{dbEntry.benefit}</div>
                  </div>}
                  {a.detail && <div>
                    <div style={{ fontSize: "0.58rem", fontWeight: "700", color: T.accent, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2px" }}>How it works</div>
                    <div style={{ fontSize: "0.78rem", color: T.text, lineHeight: 1.5 }}>{a.detail}</div>
                  </div>}
                  {a.goodFor && <div>
                    <div style={{ fontSize: "0.58rem", fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "4px" }}>Best for</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {a.goodFor.map(s => <span key={s} style={{ padding: "0.15rem 0.5rem", background: T.sage + "15", border: `1px solid ${T.sage}30`, borderRadius: "999px", fontSize: "0.65rem", color: T.sage, fontWeight: "500" }}>{s}</span>)}
                    </div>
                  </div>}
                  {dbEntry.concern && dbEntry.concern !== "None known" && <div>
                    <div style={{ fontSize: "0.58rem", fontWeight: "700", color: T.rose, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2px" }}>Watch out</div>
                    <div style={{ fontSize: "0.75rem", color: T.textMid, lineHeight: 1.45 }}>{dbEntry.concern}</div>
                  </div>}
                  {a.howToUse && <div style={{ padding: "0.45rem 0.6rem", background: "rgba(255,255,255,0.7)", borderRadius: "0.4rem", border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: "0.58rem", fontWeight: "700", color: T.textMid, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "2px" }}>How to use</div>
                    <div style={{ fontSize: "0.72rem", color: T.textMid, lineHeight: 1.45 }}>{a.howToUse}</div>
                  </div>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function IngredientDetailSheet({ ing, onClose }) {
  const ingKey = (ing.name || "").toLowerCase().replace(/\s*\(.*?\)/g, "").trim();
  const dbEntry = INGDB[ingKey] || (() => {
    const found = Object.entries(INGDB).find(([k, v]) => {
      const allNames = [k, ...(v.aliases || [])];
      return allNames.some(n => n && n.toLowerCase() === ingKey);
    });
    return found ? found[1] : null;
  })();
  const metaEntry = INGDB_META[ingKey] || (() => {
    const found = Object.entries(INGDB_META).find(([k]) => k === ingKey);
    return found ? found[1] : null;
  })();
  const rating = dbEntry?.score ?? null;
  const isFlagged = dbEntry && (dbEntry.score >= 1 || dbEntry.irritant);
  const ratingLabels = ["Non-comedogenic", "Minimal", "Low", "High", "High", "Avoid"];
  const category = metaEntry?.category || (dbEntry?.irritant ? "Irritant" : rating >= 1 ? "Comedogenic" : "Ingredient");
  const benefit = metaEntry?.benefit || null;
  const concern = (metaEntry?.concern && metaEntry.concern !== "None known") ? metaEntry.concern : (dbEntry?.note || null);

  return (
    <div onClick={e => e.stopPropagation()} style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: T.surface, borderRadius: "1.25rem 1.25rem 0 0", border: `1px solid ${T.border}`, borderBottom: "none", padding: "1rem 1.25rem 2rem", zIndex: 10, boxShadow: "0 -6px 32px rgba(0,0,0,0.14)", animation: "fadeUp 0.2s ease" }}>
      <div style={{ width: 36, height: 3, borderRadius: 2, background: T.border, margin: "0 auto 0.85rem" }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "0.35rem" }}>
        <div style={{ fontSize: "0.95rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", textTransform: "capitalize", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ing.name}</div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: T.textLight, padding: "2px 0 2px 0.75rem", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>✕ close</button>
      </div>
      <span style={{ display: "inline-block", fontSize: "0.62rem", padding: "0.18rem 0.65rem", borderRadius: 20, marginBottom: "0.85rem", background: isFlagged ? "#FAECE7" : "#E1F5EE", color: isFlagged ? "#712B13" : "#085041", fontWeight: "600", fontFamily: "'Inter',sans-serif" }}>{category}</span>
      {benefit && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.6rem" }}>
          <div style={{ fontSize: "0.62rem", color: T.textLight, width: 90, flexShrink: 0, paddingTop: 2, fontFamily: "'Inter',sans-serif" }}>Benefit</div>
          <div style={{ fontSize: "0.78rem", color: T.text, flex: 1, lineHeight: 1.55, fontFamily: "'Inter',sans-serif" }}>{benefit}</div>
        </div>
      )}
      {rating != null && (
        <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.65rem", alignItems: "center" }}>
          <div style={{ fontSize: "0.62rem", color: T.textLight, width: 90, flexShrink: 0, fontFamily: "'Inter',sans-serif" }}>Comedogenic</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[0, 1, 2, 3, 4].map(i => <div key={i} style={{ width: 9, height: 9, borderRadius: "50%", background: i < rating ? T.rose : T.border, flexShrink: 0 }} />)}
            <span style={{ fontSize: "0.62rem", color: T.textMid, marginLeft: 6, fontFamily: "'Inter',sans-serif" }}>{rating}/5 — {ratingLabels[Math.min(rating, 5)]}</span>
          </div>
        </div>
      )}
      {concern && isFlagged && <div style={{ background: "#FAECE7", borderRadius: 8, padding: "0.6rem 0.8rem" }}><div style={{ fontSize: "0.72rem", color: "#712B13", lineHeight: 1.55, fontFamily: "'Inter',sans-serif" }}>{concern}</div></div>}
      {concern && !isFlagged && dbEntry?.irritant && <div style={{ background: T.amber + "18", borderRadius: 8, padding: "0.6rem 0.8rem" }}><div style={{ fontSize: "0.72rem", color: T.amber, lineHeight: 1.55, fontFamily: "'Inter',sans-serif" }}>⚠ {concern}</div></div>}
      {!benefit && rating == null && !concern && <div style={{ fontSize: "0.72rem", color: T.textLight, fontStyle: "italic", fontFamily: "'Inter',sans-serif" }}>No detailed info available for this ingredient yet.</div>}
    </div>
  );
}

export function ProductModal({ product, onClose, user, profile, onUpdateProfile, onUserTap }) {
  if (!product) return null;
  return ReactDOM.createPortal(
    <ProductModalInner product={product} onClose={onClose} user={user} profile={profile} onUpdateProfile={onUpdateProfile} onUserTap={onUserTap} />,
    document.body
  );
}

function ProductModalInner({ product: incomingProduct, onClose, user, profile, onUpdateProfile, onUserTap }) {
  const productName = incomingProduct?.productName || incomingProduct?.name || "";
  const canonicalProduct = useProduct(incomingProduct?.id || incomingProduct?.productId || productName, null);
  const product = useMemo(() => {
    const base = !canonicalProduct ? (incomingProduct || {}) : {
      ...(incomingProduct || {}),
      ...canonicalProduct,
      flaggedIngredients: canonicalProduct.flaggedIngredients || incomingProduct?.flaggedIngredients || [],
      image: getProductImage(canonicalProduct) || incomingProduct?.image_url || incomingProduct?.image || "",
    };
    const ing = base.ingredients;
    return {
      ...base,
      ingredients: Array.isArray(ing)
        ? ing.map(i => i.label_name || i.name || "").join(", ")
        : (ing || ""),
    };
  }, [incomingProduct, canonicalProduct]);

  const [whyScoreOpen, setWhyScoreOpen] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      document.documentElement.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  const [myCommunityRating, setMyCommunityRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [reportState, setReportState] = useState("idle");
  const [reportText, setReportText] = useState("");
  const [skinTwinRating, setSkinTwinRating] = useState(null);

  useEffect(() => {
    if (!productName) { setSkinTwinRating(null); return; }
    const mySkinTypes = Array.isArray(profile?.skinTypes) ? profile.skinTypes.filter(Boolean) : [];
    if (mySkinTypes.length === 0) { setSkinTwinRating(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "ratings"), where("productName", "==", productName), limit(100)));
        if (cancelled) return;
        const matches = snap.docs
          .map(d => d.data())
          .filter(r => r.uid !== user?.uid)
          .filter(r => { const theirs = Array.isArray(r.raterSkinTypes) ? r.raterSkinTypes : []; return theirs.some(t => mySkinTypes.includes(t)); })
          .map(r => Number(r.communityRating))
          .filter(n => !isNaN(n) && n > 0);
        if (matches.length === 0) setSkinTwinRating(null);
        else { const sum = matches.reduce((a, b) => a + b, 0); setSkinTwinRating({ avg: sum / matches.length, count: matches.length, mySkinTypes }); }
      } catch (e) { console.warn("skinTwinRating fetch failed:", e); if (!cancelled) setSkinTwinRating(null); }
    })();
    return () => { cancelled = true; };
  }, [productName, user?.uid, profile?.skinTypes?.join("|")]);

  const [followersWhoUse, setFollowersWhoUse] = useState([]);
  useEffect(() => {
    const following = profile?.following || [];
    if (!following.length) return;
    (async () => {
      try {
        const snaps = await Promise.all(following.slice(0, 15).map(uid => getDoc(doc(db, "users", uid))));
        const users = snaps.filter(s => s.exists()).map(s => ({ uid: s.id, ...s.data() }));
        const using = users.filter(u => (u.routine || []).some(r => {
          const rn = typeof r === "object" ? (r?.productName || r?.name || "") : String(r || "");
          return rn.toLowerCase() === productName.toLowerCase();
        }));
        if (using.length > 0) setFollowersWhoUse(using);
      } catch {}
    })();
  }, [productName]);

  useEffect(() => {
    if (!user?.uid || !productName || !product) { setLoadingExisting(false); return; }
    setLoadingExisting(true); setExistingRating(null); setSubmitted(false);
    Promise.all([
      getDocs(query(collection(db, "ratings"), where("uid", "==", user.uid), where("productName", "==", productName), limit(1))).then(snap => snap.empty ? null : Number(snap.docs[0].data().communityRating) || null).catch(() => null),
      getDocs(query(collection(db, "posts"), where("uid", "==", user.uid), where("productName", "==", productName), where("communityRating", "!=", null), limit(1))).then(snap => snap.empty ? null : Number(snap.docs[0].data().communityRating) || null).catch(() => null),
    ]).then(([fromRatings, fromPosts]) => {
      const found = fromRatings || fromPosts;
      if (found) setExistingRating(found);
      setLoadingExisting(false);
    });
  }, [user?.uid, productName]);

  const _ingAnalysis = useMemo(() => product.ingredients ? analyzeIngredients(product.ingredients) : null, [product.ingredients]);
  const safeHighlights = useMemo(() => {
    if (!product.ingredients) return [];
    const res = _ingAnalysis || analyzeIngredients(product.ingredients);
    return (res.found || [])
      .filter(i => i.score === 0 && !i.irritant)
      .filter(i => ["niacinamide", "hyaluronic acid", "sodium hyaluronate", "ceramide", "glycerin", "centella asiatica", "salicylic acid", "retinol", "panthenol", "allantoin", "squalane", "zinc pca", "azelaic acid", "alpha-arbutin"].includes(i.name.toLowerCase()))
      .slice(0, 3);
  }, [_ingAnalysis, product.ingredients]);
  const liveScore = _ingAnalysis
    ? (_ingAnalysis.avgScore != null ? Math.round(_ingAnalysis.avgScore) : (_ingAnalysis.poreCloggers?.length ? 1 : 0))
    : (product.poreScore ?? 0);
  const ps = poreStyle(liveScore);
  const cc = communityColor(product.communityRating || 0);

  const { poreCloggers: modalCloggers, irritants: modalIrritants } = useMemo(() => {
    if (_ingAnalysis) return { poreCloggers: (_ingAnalysis.poreCloggers || []).sort((a, b) => b.score - a.score).slice(0, 6), irritants: (_ingAnalysis.irritants || []).slice(0, 6) };
    if (product.flaggedIngredients?.length) {
      const mapped = product.flaggedIngredients.map(raw => {
        if (raw && typeof raw === "object") return { name: raw.name || "", score: raw.score ?? 3, note: raw.note ?? "Potential pore-clogger", irritant: raw.irritant };
        const rawName = String(raw || "");
        const key = rawName.toLowerCase().replace(/\s*\(.*?\)/g, "").trim();
        const dbEntry = INGDB[key] || Object.entries(INGDB).find(([k, v]) => k === key || (v.aliases || []).some(a => a === key))?.[1];
        return { name: rawName, score: dbEntry?.score ?? 3, note: dbEntry?.note ?? "Potential pore-clogger", irritant: dbEntry?.irritant };
      });
      return { poreCloggers: mapped.filter(i => i.score >= 1).sort((a, b) => b.score - a.score), irritants: mapped.filter(i => i.irritant && i.score < 1) };
    }
    return { poreCloggers: [], irritants: [] };
  }, [_ingAnalysis, product.flaggedIngredients]);

  const ingredientChips = useMemo(() => {
    if (!product.ingredients?.trim()) return null;
    const lookup = getIngredientLookup();
    return product.ingredients.split(",").map((ingRaw, i) => {
      const trimmed = ingRaw.trim();
      if (!trimmed) return null;
      const lowered = trimmed.toLowerCase();
      const hit = lookup.find(entry => matchIngredientPattern(lowered, entry.pattern));
      const dbEntry = hit ? hit.data : null;
      const isPoreClogger = !!(dbEntry && dbEntry.score >= 1);
      const isIrritant = !!(dbEntry && dbEntry.irritant && !isPoreClogger);
      const isSelected = selectedIngredient?.name === trimmed;
      const styleByKind = (() => {
        if (isPoreClogger) return { bg: "#FAECE7", color: "#712B13", icon: " ⚠", weight: "600" };
        if (isIrritant) return { bg: "#FBF1DE", color: "#8B6914", icon: " ⓘ", weight: "600" };
        return { bg: T.surfaceAlt, color: T.textMid, icon: "", weight: "400" };
      })();
      return (
        <button key={i} onClick={() => setSelectedIngredient(isSelected ? null : { name: trimmed, irritant: dbEntry?.irritant, score: dbEntry?.score ?? 0 })}
          style={{ fontSize: "0.6rem", padding: "0.18rem 0.55rem", borderRadius: 20, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.12s", border: isSelected ? `1.5px solid ${T.navy}` : "none", background: isSelected ? (isPoreClogger ? "#FAECE7" : isIrritant ? "#FBF1DE" : T.accentSoft) : styleByKind.bg, color: styleByKind.color, fontWeight: styleByKind.weight, outline: "none" }}>
          {trimmed}{styleByKind.icon}
        </button>
      );
    });
  }, [product.ingredients, selectedIngredient]);

  const _listName = productName || product.name || "";
  const inRoutine = (profile?.routine || []).includes(_listName);
  const inBrokeout = (profile?.brokeout || []).includes(_listName);
  const inWantToTry = (profile?.wantToTry || []).includes(_listName);

  async function submitRating() {
    if (!user || !myCommunityRating) return;
    setSubmitting(true);
    try {
      const ingredients = product.ingredients || "";
      const analysis = analyzeIngredients(ingredients);
      const autoPoreScore = analysis.avgScore != null ? Math.round(analysis.avgScore) : (product.poreScore || 0);
      const displayName = profile?.displayName || user.displayName || "Anonymous";
      const photoURL = profile?.photoURL || user.photoURL || "";
      const ratingDocId = `${user.uid}_${productName.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 60)}`;
      const raterSkinTypes = Array.isArray(profile?.skinTypes) ? profile.skinTypes : [];
      await setDoc(doc(db, "ratings", ratingDocId), { uid: user.uid, displayName, photoURL, productName, productId: product.id || product.productId || "", brand: product.brand || "", poreScore: autoPoreScore, communityRating: myCommunityRating, productImage: product.adminImage || product.image || product.productImage || "", ingredients: ingredients.slice(0, 500), raterSkinTypes, updatedAt: serverTimestamp(), createdAt: serverTimestamp() }, { merge: true });
      await postScan(user.uid, displayName, photoURL, productName, product.brand || "", autoPoreScore, myCommunityRating, ingredients, analysis.found);
      setSubmitted(true); setExistingRating(myCommunityRating);
      onUpdateProfile?.(p => ({ ...p, _ratingsRefresh: Date.now() }));
    } catch (e) { console.error("submitRating error:", e); }
    setSubmitting(false);
  }

  async function toggleList(field, inList) {
    if (!user) return;
    const name = productName || product.name || product.productName || "";
    if (!name.trim()) return;
    if (!inList && navigator.vibrate) navigator.vibrate([8, 40, 8]);
    try {
      const pid = product._productId || product.productId || product.id || "";
      const imgUrl = product.image || product.image_url || "";
      if (inList) {
        const updates = { [field]: arrayRemove(name) };
        if (pid) updates[`${field}Refs.${pid}`] = deleteField();
        await updateDoc(doc(db, "users", user.uid), updates);
        onUpdateProfile?.(p => {
          const refs = { ...(p[`${field}Refs`] || {}) };
          if (pid) delete refs[pid];
          return { ...p, [field]: (p[field] || []).filter(v => v !== name), [`${field}Refs`]: refs };
        });
        try {
          const reactionType = field === "routine" ? "loved" : field === "brokeout" ? "brokeout" : field === "wantToTry" ? "wantToTry" : null;
          if (reactionType) {
            const q2 = query(collection(db, "posts"), where("uid", "==", user.uid), where("productName", "==", name), where("postType", "==", reactionType), limit(5));
            const snap = await getDocs(q2);
            await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
          }
        } catch (e) { console.warn("toggleList: failed to delete linked post", e); }
      } else {
        const updates = { [field]: arrayUnion(name) };
        if (pid && imgUrl) updates[`${field}Refs.${pid}`] = { id: pid, name, brand: product.brand || "", image_url: imgUrl };
        await updateDoc(doc(db, "users", user.uid), updates);
        onUpdateProfile?.(p => {
          const refs = { ...(p[`${field}Refs`] || {}) };
          if (pid && imgUrl) refs[pid] = { id: pid, name, brand: product.brand || "", image_url: imgUrl };
          return { ...p, [field]: [...(p[field] || []), name], [`${field}Refs`]: refs };
        });
        try {
          const reactionType = field === "routine" ? "loved" : field === "brokeout" ? "brokeout" : field === "wantToTry" ? "wantToTry" : null;
          if (reactionType) {
            const ingText = product.ingredients || "";
            const analysis = ingText ? analyzeIngredients(ingText) : { found: [], avgScore: 0 };
            const pScore = ingText ? Math.round(analysis.avgScore ?? 0) : (product.poreScore || 0);
            const dispName = profile?.displayName || user.displayName || "Anonymous";
            const phURL = profile?.photoURL || user.photoURL || "";
            const brand = product.brand || "";
            const postId = await postScan(user.uid, dispName, phURL, name, brand, pScore, null, ingText, analysis.found || [], reactionType);
            console.log(`[toggleList] created ${reactionType} post for "${name}" → postId=${postId || "(unknown)"}`);
          }
        } catch (e) { console.warn(`[toggleList] failed to create ${field} post for "${name}":`, e?.message || e); }
      }
      const listLabel = field === "routine" ? "Routine" : field === "loved" ? "Loved" : "Want to Try";
      const t = document.createElement("div"); t.className = "save-toast"; t.textContent = inList ? "Removed" : `Added to ${listLabel} ✓`;
      document.body.appendChild(t); setTimeout(() => t.remove(), 2100);
    } catch (e) { console.error("toggleList error", e); }
  }

  const DIAL_R = 28;
  const DIAL_CIRC = 2 * Math.PI * DIAL_R;
  const dialFill = Math.min(liveScore / 5, 1);
  const dialDash = `${dialFill * DIAL_CIRC} ${DIAL_CIRC}`;
  const scoreLabel = ["Clear", "Minimal", "Low risk", "Medium risk", "High risk", "Avoid"][liveScore] || "Clear";
  const scoreSubtext = ["Won't clog pores", "Very unlikely to clog", "May affect some skin", "Likely to clog pores", "High clog risk", "Avoid — clogs pores"][liveScore] || "";

  const commStars = product.communityRating ? (() => {
    const s = product.communityRating / 2;
    return { full: Math.floor(s), half: s - Math.floor(s) >= 0.5, empty: 5 - Math.floor(s) - (s - Math.floor(s) >= 0.5 ? 1 : 0), label: product.communityRating >= 9 ? "Loved" : product.communityRating >= 7 ? "Liked" : product.communityRating >= 5 ? "Mixed" : "Low" };
  })() : null;

  const buyUrl = product.buyUrl || amazonUrl(product.productName || product.name || "", product.brand || "", product.barcode || product.code || "");

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9500, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
      {shareOpen && <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 19000 }}><ShareProductModal user={user || { uid: "" }} product={product} onClose={() => setShareOpen(false)} /></div>}
      <div onClick={() => { setSelectedIngredient(null); onClose(); }} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(28,28,26,0.45)", cursor: "pointer" }} />

      <div ref={modalRef} style={{ position: "relative", width: "100%", maxWidth: "480px", background: T.surface, borderRadius: "1.5rem 1.5rem 0 0", padding: "1.25rem 1.25rem", paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))", boxShadow: "0 -8px 40px rgba(28,28,26,0.15)", maxHeight: "92vh", overflowY: selectedIngredient ? "hidden" : "auto", zIndex: 1 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "1rem", position: "relative" }}>
          <div style={{ width: "36px", height: "4px", background: T.border, borderRadius: "999px" }} />
          <button onClick={() => setShareOpen(true)} style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", background: T.surfaceAlt, border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.textMid }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
          </button>
          <button onClick={onClose} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", background: T.surfaceAlt, border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "0.9rem", color: T.textMid }}>✕</button>
        </div>

        <div style={{ width: "100%", height: "190px", background: `linear-gradient(135deg,${T.iceBlue}40,${T.surfaceAlt})`, borderRadius: "1rem", overflow: "hidden", marginBottom: "1.1rem", display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${T.iceBlue}66` }}>
          <ProductImage src={getProductImage(product)} name={product.productName} brand={product.brand} barcode={product.barcode || ""} />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          {product.brand && <div style={{ display: "inline-block", fontSize: "0.6rem", color: T.navy, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "0.35rem", fontFamily: "'Inter',sans-serif", background: T.iceBlue + "55", padding: "0.2rem 0.6rem", borderRadius: "999px", border: `1px solid ${T.iceBlue}` }}>{product.brand}</div>}
          <div style={{ fontSize: "1.45rem", fontWeight: "800", color: T.navy, fontFamily: "'Inter',sans-serif", lineHeight: 1.15, letterSpacing: "-0.03em" }}>{getProductDisplayName(product)}</div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem", paddingBottom: "1rem", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
            <svg viewBox="0 0 68 68" width="72" height="72">
              <circle cx="34" cy="34" r={DIAL_R} fill="none" stroke={T.border} strokeWidth="5" />
              <circle cx="34" cy="34" r={DIAL_R} fill="none" stroke={ps.color} strokeWidth="5" strokeDasharray={dialDash} strokeLinecap="round" transform="rotate(-90 34 34)" style={{ transition: "stroke-dasharray 0.5s ease" }} />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: "1.4rem", fontWeight: "800", color: ps.color, fontFamily: "'Inter',sans-serif", lineHeight: 1 }}>{liveScore}</span>
              <span style={{ fontSize: "0.42rem", color: T.textLight, fontFamily: "'Inter',sans-serif", textTransform: "uppercase" }}>/5</span>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.55rem", color: T.textLight, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem", fontFamily: "'Inter',sans-serif" }}>Pore Score</div>
            <div style={{ fontSize: "1rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.2 }}>{scoreLabel}</div>
            <div style={{ fontSize: "0.68rem", color: T.textLight, fontFamily: "'Inter',sans-serif", marginTop: "0.15rem" }}>{scoreSubtext}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            {product.communityRating ? (<>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "2px" }}>
                {commStars && <>{[...Array(commStars.full)].map((_, i) => <svg key={"f" + i} width="15" height="15" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)}{commStars.half && <svg key="h" width="15" height="15" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth="1"><defs><linearGradient id="hgc"><stop offset="50%" stopColor="#F59E0B" /><stop offset="50%" stopColor="none" stopOpacity="0" /></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#hgc)" /></svg>}{[...Array(commStars.empty)].map((_, i) => <svg key={"e" + i} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.3"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)}</>}
              </div>
              <div style={{ fontSize: "0.6rem", color: T.textLight, marginTop: "3px", fontFamily: "'Inter',sans-serif", textAlign: "right" }}>{commStars?.label || ""} · Community</div>
            </>) : (<>
              <div style={{ display: "flex", gap: "2px", justifyContent: "flex-end" }}>
                {[1, 2, 3, 4, 5].map(i => <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>)}
              </div>
              <div style={{ fontSize: "0.6rem", color: T.textLight, marginTop: "3px", fontFamily: "'Inter',sans-serif", textAlign: "right" }}>No ratings yet</div>
            </>)}
          </div>
        </div>

        <div style={{ marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 0", borderBottom: `0.5px solid ${T.border}` }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.5" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            <span style={{ fontSize: "0.8rem", color: T.textMid, flex: 1, fontFamily: "'Inter',sans-serif" }}>Flagged ingredients</span>
            {(() => {
              const c = modalCloggers.length; const ir = modalIrritants.length;
              let label;
              if (c === 0 && ir === 0) label = "None found";
              else if (c > 0 && ir > 0) label = `${c} clog · ${ir} irritate`;
              else if (c > 0) label = `${c} may clog`;
              else label = `${ir} may irritate`;
              const dotColor = c > 0 ? T.rose : ir > 0 ? T.amber : T.sage;
              return (<><span style={{ fontSize: "0.8rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif" }}>{label}</span><div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: dotColor }} /></>);
            })()}
          </div>
          {product.skinTypes?.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 0", borderBottom: `0.5px solid ${T.border}` }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
              <span style={{ fontSize: "0.8rem", color: T.textMid, flex: 1, fontFamily: "'Inter',sans-serif" }}>Skin types</span>
              <span style={{ fontSize: "0.8rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif" }}>{product.skinTypes.join(", ")}</span>
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: T.sage }} />
            </div>
          )}
          {skinTwinRating && skinTwinRating.count > 0 && (() => {
            const dotColor = skinTwinRating.avg >= 7 ? T.sage : skinTwinRating.avg >= 5 ? T.amber : T.rose;
            const skinTwinLabel = skinTwinRating.mySkinTypes.length === 1 ? `${skinTwinRating.mySkinTypes[0].toLowerCase()} skin` : "skin like yours";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 0", borderBottom: `0.5px solid ${T.border}` }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="1.5" style={{ flexShrink: 0 }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                <span style={{ fontSize: "0.8rem", color: T.textMid, flex: 1, fontFamily: "'Inter',sans-serif" }}>Users with {skinTwinLabel}</span>
                <span style={{ fontSize: "0.8rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif" }}>{skinTwinRating.avg.toFixed(1)}/10 · {skinTwinRating.count}</span>
                <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: dotColor }} />
              </div>
            );
          })()}
          {followersWhoUse.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 0", borderBottom: `0.5px solid ${T.border}` }}>
              <div style={{ display: "flex", flexShrink: 0 }}>
                {followersWhoUse.slice(0, 3).map((u, i) => {
                  const isSeed = u.uid?.startsWith("seed_");
                  return <div key={u.uid} onClick={() => { if (!isSeed && onUserTap) { onClose(); onUserTap(u.uid); } }} style={{ width: 24, height: 24, borderRadius: "50%", overflow: "hidden", border: `2px solid ${T.surface}`, marginLeft: i > 0 ? -7 : 0, background: T.accent + "22", flexShrink: 0, cursor: (!isSeed && onUserTap) ? "pointer" : "default", zIndex: 10 - i, position: "relative" }}>
                    {u.photoURL ? <img src={u.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: T.accent, fontSize: "0.5rem", fontWeight: "700", color: "#fff" }}>{(u.displayName || "?")[0].toUpperCase()}</div>}
                  </div>;
                })}
              </div>
              <button onClick={() => { if (followersWhoUse.length === 1 && !followersWhoUse[0].uid?.startsWith("seed_") && onUserTap) { onClose(); onUserTap(followersWhoUse[0].uid); } else { setShowFriendsList(v => !v); } }} style={{ flex: 1, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
                <span style={{ fontSize: "0.8rem", color: T.textMid, fontFamily: "'Inter',sans-serif" }}>
                  {followersWhoUse.length === 1 ? <><b style={{ color: T.text }}>{followersWhoUse[0].displayName?.split(" ")[0]}</b> uses this</> : <><b style={{ color: T.text }}>{followersWhoUse.slice(0, 2).map(f => f.displayName?.split(" ")[0]).join(" & ")}</b> use this</>}
                </span>
              </button>
              <div style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: T.sage }} />
            </div>
          )}
          {showFriendsList && followersWhoUse.length > 1 && (
            <div style={{ paddingBottom: "0.5rem", borderBottom: `0.5px solid ${T.border}` }}>
              {followersWhoUse.map(u => { const isSeed = u.uid?.startsWith("seed_"); return (
                <button key={u.uid} onClick={() => { if (!isSeed && onUserTap) { onClose(); onUserTap(u.uid); } }} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.6rem", background: "none", border: "none", cursor: (!isSeed && onUserTap) ? "pointer" : "default", padding: "0.35rem 0", textAlign: "left" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", overflow: "hidden", background: T.accent + "22", flexShrink: 0 }}>{u.photoURL ? <img src={u.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: T.accent, fontSize: "0.5rem", fontWeight: "700", color: "#fff" }}>{(u.displayName || "?")[0].toUpperCase()}</div>}</div>
                  <span style={{ fontSize: "0.8rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif" }}>{u.displayName}</span>
                  {!isSeed && onUserTap && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ marginLeft: "auto", flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>}
                </button>
              );})}
              <button onClick={() => setShowFriendsList(false)} style={{ fontSize: "0.68rem", color: T.textLight, background: "none", border: "none", cursor: "pointer", padding: "0.2rem 0", fontFamily: "'Inter',sans-serif" }}>Show less</button>
            </div>
          )}
        </div>

        {user && (
          <div style={{ display: "flex", gap: "0.4rem", paddingTop: "0.75rem", paddingBottom: "1rem", borderBottom: `1px solid ${T.border}`, marginBottom: "1rem" }}>
            {[
              { field: "routine", active: inRoutine, label: "Add to Routine", activeLabel: "In Routine ✓" },
              { field: "wantToTry", active: inWantToTry, label: "Want to Try", activeLabel: "Want to Try ✓" },
              { field: "brokeout", active: inBrokeout, label: "Not For Me", activeLabel: "Not For Me ✓" },
            ].map(({ field, active, label, activeLabel }) => (
              <button key={field} onClick={() => toggleList(field, active)}
                style={{ flex: 1, padding: "0.6rem 0.2rem", background: active ? T.navy : "transparent", color: active ? "#fff" : T.textMid, border: `1px solid ${active ? T.navy : T.border}`, borderRadius: "999px", fontSize: "0.7rem", fontWeight: active ? "600" : "400", cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.18s", minWidth: 0, textAlign: "center", letterSpacing: active ? "-0.01em" : "0" }}>
                {active ? activeLabel : label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.4rem" }}>
          <a href={buyUrl} target="_blank" rel="noopener noreferrer"
            onClick={() => trackProductClick(product._productId || product.id || null, product.productName || product.name || "")}
            style={{ flex: 1, padding: "0.75rem", background: T.navy, color: "#FFFFFF", borderRadius: "0.75rem", fontSize: "0.88rem", fontWeight: "700", textAlign: "center", textDecoration: "none", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            Shop
          </a>
          <button onClick={() => shareProduct(product.productName || product.name || "", product.brand || "")} style={{ padding: "0.75rem 1.1rem", background: "transparent", border: `1.5px solid ${T.border}`, borderRadius: "0.75rem", color: T.textMid, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.35rem", fontFamily: "'Inter',sans-serif", fontSize: "0.85rem", fontWeight: "600" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></svg>
            Share
          </button>
        </div>

        <div style={{ fontSize: "0.58rem", color: T.textLight, fontFamily: "'Inter',sans-serif", marginBottom: "0.85rem", textAlign: "center" }}>
          Affiliate link — Ralli may earn a commission on purchases
        </div>

        {product.ingredients && liveScore !== null && (() => {
          const cloggers = modalCloggers.slice(0, 5);
          const irritants = modalIrritants.slice(0, 3);
          const safeHighlights = (() => {
            if (!product.ingredients) return [];
            const res = analyzeIngredients(product.ingredients);
            return (res.found || []).filter(i => i.score === 0 && !i.irritant).filter(i => ["niacinamide", "hyaluronic acid", "sodium hyaluronate", "ceramide", "glycerin", "centella asiatica", "salicylic acid", "retinol", "panthenol", "allantoin", "squalane", "zinc pca", "azelaic acid", "tranexamic acid", "vitamin c", "ascorbic acid", "alpha-arbutin"].includes(i.name.toLowerCase())).slice(0, 3);
          })();
          const sentence = (() => {
            if (liveScore === 0 && !cloggers.length) return safeHighlights.length ? `Clean formula — no pore-clogging ingredients. Contains ${safeHighlights.map(i => i.name).join(", ")}.` : "No pore-clogging ingredients detected in this formula.";
            if (cloggers.length === 1) { const c = cloggers[0]; return `Scored ${liveScore}/5 because it contains ${c.name}, which is ${c.score >= 4 ? "highly likely" : c.score === 3 ? "moderately likely" : "likely"} to clog pores.`; }
            const w = cloggers[0]; return `Scored ${liveScore}/5 — primarily due to ${w?.name}${cloggers.length > 1 ? ` and ${cloggers.length - 1} other ingredient${cloggers.length > 2 ? "s" : ""}` : ""} known to clog pores.`;
          })();
          return (
            <div style={{ marginBottom: "1rem" }}>
              <button onClick={() => setWhyScoreOpen(o => !o)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.7rem 0.9rem", background: ps.color + "0D", border: `1px solid ${ps.color}30`, borderRadius: whyScoreOpen ? "0.75rem 0.75rem 0 0" : "0.75rem", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ps.color} strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  <span style={{ fontSize: "0.78rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif" }}>Why this score?</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2.5" style={{ transform: whyScoreOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
              </button>
              {whyScoreOpen && (
                <div style={{ border: `1px solid ${T.border}`, borderTop: "none", borderRadius: "0 0 0.75rem 0.75rem", padding: "0.85rem 0.9rem", background: T.surface }}>
                  <p style={{ fontSize: "0.8rem", color: T.textMid, lineHeight: 1.55, margin: "0 0 0.9rem" }}>{sentence}</p>
                  {(cloggers.length > 0 || irritants.length > 0) && (
                    <div style={{ marginBottom: "0.85rem" }}>
                      <div style={{ fontSize: "0.58rem", fontWeight: "600", color: T.rose, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.45rem" }}>Watch out for</div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {cloggers.map((ing, i) => (
                          <div key={"c" + i} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", padding: "0.42rem 0", borderBottom: `0.5px solid ${T.border}` }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: ing.score >= 3 ? T.rose : T.amber, flexShrink: 0, marginTop: "0.28rem" }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: "600", color: T.text, textTransform: "capitalize" }}>{ing.name}</span>
                              <span style={{ fontSize: "0.72rem", color: T.textMid, marginLeft: "0.4rem" }}>{ing.note || "Pore-clogging"}</span>
                            </div>
                          </div>
                        ))}
                        {irritants.map((ing, i) => (
                          <div key={"ir" + i} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", padding: "0.42rem 0", borderBottom: `0.5px solid ${T.border}` }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.amber, flexShrink: 0, marginTop: "0.28rem" }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: "600", color: T.text, textTransform: "capitalize" }}>{ing.name}</span>
                              <span style={{ fontSize: "0.72rem", color: T.textMid, marginLeft: "0.4rem" }}>{ing.note || "Potential irritant"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {safeHighlights.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.58rem", fontWeight: "600", color: T.sage, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: "0.45rem" }}>Works in your favour</div>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        {safeHighlights.map((ing, i) => (
                          <div key={"g" + i} style={{ display: "flex", alignItems: "flex-start", gap: "0.55rem", padding: "0.42rem 0", borderBottom: i < safeHighlights.length - 1 ? `0.5px solid ${T.border}` : "none" }}>
                            <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.sage, flexShrink: 0, marginTop: "0.28rem" }} />
                            <div style={{ flex: 1 }}>
                              <span style={{ fontSize: "0.78rem", fontWeight: "600", color: T.text, textTransform: "capitalize" }}>{ing.name}</span>
                              <span style={{ fontSize: "0.72rem", color: T.textMid, marginLeft: "0.4rem" }}>{INGDB_META[ing.name.toLowerCase()]?.benefit || ing.note || ""}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {!cloggers.length && !irritants.length && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.sage, flexShrink: 0 }} />
                      <span style={{ fontSize: "0.78rem", color: T.sage, fontWeight: "600" }}>No flagged ingredients — pore-safe formula</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {user && (
          <div style={{ paddingTop: "0.75rem", paddingBottom: "1rem", borderTop: `1px solid ${T.border}`, borderBottom: `1px solid ${T.border}`, marginBottom: "1rem" }}>
            <div style={{ fontSize: "0.6rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: "700", marginBottom: "0.6rem", fontFamily: "'Inter',sans-serif" }}>
              {submitted ? "Rating saved! ✓" : existingRating ? `Your rating: ${existingRating / 2}/5 stars — tap to update` : "Rate this product"}
            </div>
            {loadingExisting ? <div style={{ height: "36px", borderRadius: "0.75rem" }} className="skeleton" /> : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: "0.15rem" }}>
                  {[2, 4, 6, 8, 10].map(val => {
                    const filled = (myCommunityRating || existingRating || 0) >= val;
                    return (
                      <button key={val} onClick={() => setMyCommunityRating(myCommunityRating === val ? 0 : val)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.1rem", lineHeight: 1, transition: "transform 0.1s" }} onMouseEnter={e => e.currentTarget.style.transform = "scale(1.2)"} onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}>
                        <svg width="32" height="32" viewBox="0 0 24 24" strokeWidth="1.5" fill={filled ? "#F59E0B" : "none"} stroke={filled ? "#F59E0B" : "#D1D5DB"}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  {myCommunityRating > 0 && <span style={{ fontSize: "0.78rem", fontWeight: "700", color: "#F59E0B" }}>{myCommunityRating / 2}/5</span>}
                  <button onClick={submitRating} disabled={submitting || !myCommunityRating} style={{ width: "34px", height: "34px", borderRadius: "50%", background: myCommunityRating ? T.accent : T.surfaceAlt, border: "none", cursor: myCommunityRating ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}>
                    {submitting ? <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} /> : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={myCommunityRating ? "#fff" : T.textLight} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {product.ingredients && product.ingredients.trim() && (
          <div style={{ marginBottom: "1rem", position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31l-3.24 4.65A3 3 0 0 0 9.24 19H14.76a3 3 0 0 0 2.48-5.04L14 9.31V2" /><line x1="8.5" y1="2" x2="15.5" y2="2" /></svg>
              <div style={{ fontSize: "0.6rem", color: T.navy, textTransform: "uppercase", letterSpacing: "0.14em", fontWeight: "600", fontFamily: "'Inter',sans-serif" }}>Full Ingredient List</div>
            </div>
            <div style={{ fontSize: "0.58rem", color: T.textLight, marginBottom: "0.5rem", fontFamily: "'Inter',sans-serif" }}>Tap any ingredient to learn more</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.22rem", marginBottom: "0.4rem" }}>
              {ingredientChips}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.15rem", fontSize: "0.56rem", fontStyle: "italic", fontFamily: "'Inter',sans-serif" }}>
              <div style={{ color: "#712B13" }}>⚠ may clog pores</div>
              <div style={{ color: "#8B6914" }}>ⓘ may cause irritation</div>
            </div>
            {selectedIngredient && <IngredientDetailSheet ing={selectedIngredient} onClose={() => setSelectedIngredient(null)} />}
          </div>
        )}

        <div style={{ fontSize: "0.58rem", color: T.textLight, fontFamily: "'Inter',sans-serif", textAlign: "center", padding: "0.75rem 0 0.25rem", lineHeight: 1.6 }}>
          For informational purposes only — not a substitute for professional dermatological advice.{product.buyUrl && <span> Ralli earns a commission on purchases made through our links.</span>}
        </div>

        {user && product.ingredients && (() => {
          async function submitReport() {
            if (!reportText.trim()) return;
            setReportState("sending");
            try {
              await addDoc(collection(db, "ingredientReports"), { productName: product.productName || product.name || "", brand: product.brand || "", productId: product._productId || product.id || "", currentIngredients: product.ingredients || "", reportText: reportText.trim(), reportedBy: user.uid, reporterName: profile?.displayName || "", createdAt: serverTimestamp(), status: "pending" });
              setReportState("sent");
            } catch { setReportState("editing"); }
          }
          return (
            <div style={{ paddingTop: "0.75rem", borderTop: `1px solid ${T.border}` }}>
              {reportState === "sent"
                ? <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.6rem 0.75rem", background: T.sage + "12", borderRadius: "0.65rem", border: `1px solid ${T.sage}25` }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg><span style={{ fontSize: "0.75rem", color: T.sage, fontWeight: "600", fontFamily: "'Inter',sans-serif" }}>Thanks — we'll review and update this</span></div>
                : reportState === "editing"
                  ? <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}><div style={{ fontSize: "0.68rem", color: T.textLight, lineHeight: 1.4 }}>Paste the correct ingredient list from the packaging or brand website:</div><textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="Aqua, Glycerin, Niacinamide…" rows={4} style={{ width: "100%", padding: "0.6rem 0.75rem", borderRadius: "0.6rem", border: `1.5px solid ${T.accent}`, fontSize: "0.78rem", fontFamily: "'Inter',sans-serif", color: T.text, background: T.surface, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.5 }} /><div style={{ display: "flex", gap: "0.5rem" }}><button onClick={submitReport} disabled={!reportText.trim() || reportState === "sending"} style={{ flex: 1, padding: "0.6rem", background: T.navy, color: "#fff", border: "none", borderRadius: "0.6rem", fontSize: "0.78rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>{reportState === "sending" ? "Sending…" : "Submit correction"}</button><button onClick={() => setReportState("idle")} style={{ padding: "0.6rem 0.85rem", background: T.surfaceAlt, color: T.textMid, border: `1px solid ${T.border}`, borderRadius: "0.6rem", fontSize: "0.78rem", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Cancel</button></div></div>
                  : <button onClick={() => setReportState("editing")} style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "none", border: "none", cursor: "pointer", padding: "0.2rem 0", fontFamily: "'Inter',sans-serif" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    <span style={{ fontSize: "0.7rem", color: T.textLight }}>Ingredients look wrong? Report a correction</span>
                  </button>
              }
            </div>
          );
        })()}
      </div>
    </div>
  );
}
