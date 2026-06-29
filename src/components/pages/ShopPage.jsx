import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { getDocs, getDoc, doc, query, collection, where, orderBy, limit, addDoc, updateDoc, setDoc, serverTimestamp, arrayUnion, arrayRemove, onSnapshot, deleteDoc, increment } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { T } from "../../data/tokens.js";
import { AMZN, SHOP_CATEGORIES, CAT_EMOJI, CAT_LABEL, CAT_ORDER, FOUNDER_AVATARS, FOUNDER_EMAILS as SHOP_FOUNDER_EMAILS, CLEAN_BRANDS_SEED } from "../../data/shopData.js";
import { AMAZON_AFFILIATE_TAG, FOUNDERS, ADMIN_UIDS, ADMIN_EMAILS, BRAND_BLURBS, BRAND_PALETTE } from "../../data/constants.js";
import { RalliIcons } from "../../data/icons.jsx";
import { auth, db, storage } from "../../lib/firebase.js";
import { isAdmin, isVA } from "../../lib/userUtils.js";
import { upsertProduct } from "../../lib/socialUtils.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { hasValidImage, getProductImage } from "../../lib/imageUtils.js";
import { useToast } from "../providers/ToastProvider.jsx";
import { useProductCache, useProduct } from "../providers/ProductCacheProvider.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { ProductImage } from "../ui/ProductImage.jsx";
import { poreStyle, PoreScoreBadge } from "../shared/PoreScoreBadge.jsx";
import { ProductModal } from "../shared/ProductModal.jsx";
import { ShareProductModal } from "../shared/ShareProductModal.jsx";

// BRAND_COLORS is a local fallback palette for ShopImageCell / ShopCard.
// Only used when a brand doesn't appear in BRAND_PALETTE from constants.
const BRAND_COLORS = {};

// ---------------------------------------------------------------------------
// Helper: friends who have a product in their routine
// ---------------------------------------------------------------------------
function getFriendRoutineUsers(friendScans, productName, productId) {
  if (!friendScans || !productName) return [];
  const key = (productName || "").toLowerCase().trim();
  const byName = friendScans[key] || [];
  const byId = productId ? (friendScans[productId] || []) : [];
  const merged = [...byName];
  byId.forEach(f => { if (!merged.find(m => m.uid === f.uid)) merged.push(f); });
  return merged;
}

// Pill shown on any product card when friends have it in their routine
function FriendRoutinePill({ friends }) {
  if (!friends.length) return null;
  const GENERIC_NAMES = new Set(["skincare lover", "user", "anonymous", "undefined", "null", ""]);
  const firstName = (n) => {
    const first = (n || "").split(" ")[0];
    return GENERIC_NAMES.has(first.toLowerCase()) ? null : first;
  };
  const realName = firstName(friends[0].displayName);
  const label = friends.length === 1
    ? realName ? `${realName} uses this` : "1 friend uses this"
    : `${friends.length} friends use this`;
  return (
    <div style={{ position: "absolute", bottom: "6px", left: "7px", display: "flex", alignItems: "center", gap: "4px", background: "rgba(17,24,39,0.62)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "3px 7px 3px 4px", pointerEvents: "none" }}>
      <div style={{ display: "flex" }}>
        {friends.slice(0, 3).map((f, fi) => (
          <span key={f.uid} style={{ width: "16px", height: "16px", borderRadius: "50%", overflow: "hidden", border: "1.5px solid rgba(255,255,255,0.7)", marginLeft: fi > 0 ? "-5px" : "0", flexShrink: 0, background: T.accent, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            {f.photoURL ? <img src={f.photoURL} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" /> : <span style={{ fontSize: "7px", fontWeight: "700", color: "#fff" }}>{(f.displayName || "?")[0].toUpperCase()}</span>}
          </span>
        ))}
      </div>
      <span style={{ fontSize: "0.52rem", fontWeight: "600", color: "#fff", whiteSpace: "nowrap" }}>{label}</span>
    </div>
  );
}

// Placeholder card shown when a product has no image
function PlaceholderCard({ name, brand }) {
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

// ---------------------------------------------------------------------------
// Amazon affiliate URL builder
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Track product link clicks (fire-and-forget)
// ---------------------------------------------------------------------------
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
      const r = doc(db, "productClicks", key);
      await setDoc(r, {
        productName,
        clickCount: increment(1),
        lastClickedAt: Date.now(),
      }, { merge: true });
    }
  } catch {}
}

// ---------------------------------------------------------------------------
// getShopProducts — fetch and rank products for the shop shelf
// Module-level cache so BrandOfTheWeek + ShopPage share one fetch per session.
// ---------------------------------------------------------------------------
let _shopCache = null;
let _shopCachePromise = null;

async function getShopProducts() {
  if (_shopCache) return _shopCache;
  if (_shopCachePromise) return _shopCachePromise;
  _shopCachePromise = (async () => {
  try {
    const snap = await getDocs(collection(db, "products"));
    const CAT_LIMIT = 15;
    const candidates = snap.docs
      .map(d => {
        const raw = d.data();
        if (Array.isArray(raw.ingredients)) raw.ingredients = raw.ingredients.map(i => i.label_name || i.name || "").join(", ");
        const p = { id: d.id, ...raw };
        if (p.ingredients && p.ingredients.trim().length > 10) {
          const live = analyzeIngredients(p.ingredients).avgScore;
          if (live != null) p.poreScore = Math.round(live);
        }
        return p;
      })
      .filter(p => {
        if (p.shopOverride) return true;
        const ing = (p.ingredients || "").trim();
        const buy = (p.buyUrl || "").trim();
        if (!hasValidImage(p)) return false;
        if (ing.length <= 10) return false;
        if (!buy.startsWith("http")) return false;
        return true;
      });
    const grouped = {};
    candidates.forEach(p => {
      const cat = p.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    const selected = [];
    Object.values(grouped).forEach(arr => {
      const sorted = arr.sort((a, b) => {
        const d = (a.poreScore ?? 99) - (b.poreScore ?? 99);
        return d !== 0 ? d : (b.communityRating || 0) - (a.communityRating || 0);
      });
      selected.push(...sorted.slice(0, CAT_LIMIT));
    });
    const seen = new Map(), deduped = [];
    for (const p of selected) {
      const key = (p.productName || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();
      if (!key) { deduped.push(p); continue; }
      if (!seen.has(key)) { seen.set(key, p); deduped.push(p); }
      else {
        const ex = seen.get(key);
        if ((p.scanCount || 0) > (ex.scanCount || 0)) {
          deduped[deduped.indexOf(ex)] = p;
          seen.set(key, p);
        }
      }
    }
    _shopCache = deduped;
    return deduped;
  } catch { return []; }
  })();
  const result = await _shopCachePromise;
  _shopCachePromise = null;
  return result;
}

// ---------------------------------------------------------------------------
// Brand-of-the-week helpers
// ---------------------------------------------------------------------------
function getWeekIndex() {
  return Math.floor(Date.now() / (86400000 * 7));
}

function getBrandBlurb(brand) {
  const key = (brand || "").toLowerCase().trim();
  return BRAND_BLURBS[key] || null;
}

function getBrandTagline(brand) {
  const blurb = getBrandBlurb(brand);
  if (blurb) return blurb.blurb;
  const key = (brand || "").toLowerCase().trim();
  const legacy = {
    "tatcha": "Japanese skincare rituals, modernized.",
    "olay": "Decades of skin science. Millions of fans.",
    "aveeno": "Powered by nature. Proven by science.",
    "kiehl's": "Formulated with the finest natural ingredients.",
    "origins": "High-performance natural ingredients.",
    "belif": "Honest ingredients. Honest results.",
  };
  return legacy[key] || "Community-verified skincare.";
}

function getBrandPalette(brand) {
  const key = (brand || "").toLowerCase().trim();
  return BRAND_PALETTE[key] || { bg: "linear-gradient(135deg,#1B2A3A,#0f1e2d)", accent: "#7EC8E3" };
}

// ---------------------------------------------------------------------------
// useFounderAvatars hook
// ---------------------------------------------------------------------------
function useFounderAvatars() {
  const [avatars, setAvatars] = useState({ McKenzie: "", Morgan: "" });
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("email", "in", [SHOP_FOUNDER_EMAILS.McKenzie, SHOP_FOUNDER_EMAILS.Morgan])));
        const updated = { McKenzie: "", Morgan: "" };
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.email === SHOP_FOUNDER_EMAILS.McKenzie) updated.McKenzie = data.photoURL || "";
          if (data.email === SHOP_FOUNDER_EMAILS.Morgan) updated.Morgan = data.photoURL || "";
        });
        setAvatars(updated);
      } catch {}
    }
    load();
  }, []);
  return avatars;
}

// ---------------------------------------------------------------------------
// BrandOfTheWeek
// ---------------------------------------------------------------------------
function BrandOfTheWeek({ onBrandTap }) {
  const [brandData, setBrandData] = useState(null);
  const [editorial, setEditorial] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = Date.now();
    let editorialDone = false, brandDone = false;
    const checkDone = () => { if (editorialDone && brandDone) setLoading(false); };

    Promise.all([
      getDocs(collection(db, "config", "editorial", "entries")).catch(() => ({ docs: [] })),
      getDoc(doc(db, "config", "brandOfTheWeek")).catch(() => ({ exists: () => false })),
    ]).then(([calSnap, configSnap]) => {
      const calEntries = calSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e => e.type === "brand" && e.scheduledFor <= now)
        .sort((a, b) => b.scheduledFor - a.scheduledFor);
      if (calEntries[0]) { setEditorial(calEntries[0].value); }
      else if (configSnap.exists?.()) {
        const d = configSnap.data();
        if (!d.scheduledFor || d.scheduledFor <= now) setEditorial(d.brand);
      }
    }).catch(() => {}).finally(() => { editorialDone = true; checkDone(); });

    getShopProducts().then(products => {
      if (!products.length) return;
      const brandMap = {};
      products.forEach(p => {
        const b = (p.brand || "").trim();
        if (!b) return;
        if (!brandMap[b]) brandMap[b] = { total: 0, safe: 0, products: [] };
        if (!p.ingredients || p.ingredients.trim().length < 10) return;
        const liveScore = (() => { const r = analyzeIngredients(p.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : 99; })();
        brandMap[b].total++;
        if (liveScore <= 1) brandMap[b].safe++;
        brandMap[b].products.push(p);
      });
      const eligible = Object.entries(brandMap)
        .filter(([, v]) => v.total >= 3 && (v.safe / v.total) >= 0.8)
        .sort(([, a], [, b]) => {
          const pctDiff = (b.safe / b.total) - (a.safe / a.total);
          if (Math.abs(pctDiff) > 0.05) return pctDiff;
          return b.total - a.total;
        });
      if (eligible.length) {
        const weekIdx = getWeekIndex() % eligible.length;
        const [name, data] = eligible[weekIdx];
        setBrandData({ name, safeCount: data.safe, totalCount: data.total, pct: Math.round((data.safe / data.total) * 100), products: data.products });
      }
    }).catch(() => {}).finally(() => { brandDone = true; checkDone(); });
  }, []);

  const activeBrand = editorial || brandData?.name;
  const blurbData = activeBrand ? getBrandBlurb(activeBrand) : null;
  const pct = brandData?.pct ?? null;
  const safeCount = brandData?.safeCount ?? null;
  const totalCount = brandData?.totalCount ?? null;

  if (loading) return <div style={{ height: "148px", background: T.surfaceAlt, borderRadius: "1rem", marginBottom: "1.1rem" }} />;
  if (!activeBrand) return null;

  return (
    <button onClick={() => onBrandTap && onBrandTap(activeBrand)}
      style={{ width: "100%", textAlign: "left", background: getBrandPalette(activeBrand).bg, borderRadius: "1rem", overflow: "hidden", marginBottom: "1.1rem", cursor: "pointer", border: "none", position: "relative", transition: "opacity 0.15s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.92"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      <div style={{ position: "absolute", right: "-1rem", top: "-1rem", opacity: 0.05, pointerEvents: "none" }}>
        {RalliIcons.flask("#FFFFFF", 130)}
      </div>
      <div style={{ position: "relative", zIndex: 1, padding: "1.1rem 1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
          <div style={{ fontSize: "0.5rem", color: T.iceBlue, letterSpacing: "0.22em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", fontWeight: "600" }}>
            Brand of the Week
          </div>
          {pct !== null && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(255,255,255,0.1)", borderRadius: "999px", padding: "0.15rem 0.55rem" }}>
              <span style={{ fontSize: "0.72rem", fontWeight: "800", color: T.sage, fontFamily: "'Inter',sans-serif" }}>{pct}%</span>
              <span style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.55)", fontFamily: "'Inter',sans-serif" }}>pore safe</span>
            </div>
          )}
        </div>
        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "800", fontSize: "1.6rem", color: "#FFFFFF", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: "0.6rem" }}>
          {activeBrand}
        </div>
        <div style={{ fontSize: "0.78rem", color: "rgba(255,255,255,0.7)", fontFamily: "'Inter',sans-serif", fontWeight: "400", lineHeight: 1.55, marginBottom: "0.75rem" }}>
          {blurbData?.blurb || getBrandTagline(activeBrand)}
        </div>
        {blurbData?.founder && (
          <div style={{ fontSize: "0.67rem", color: "rgba(255,255,255,0.4)", fontFamily: "'Inter',sans-serif", fontStyle: "italic", lineHeight: 1.4, marginBottom: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "0.6rem" }}>
            {blurbData.founder}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          {safeCount !== null && (
            <div style={{ fontSize: "0.62rem", color: "rgba(255,255,255,0.5)", fontFamily: "'Inter',sans-serif" }}>
              <span style={{ color: T.sage, fontWeight: "700" }}>{safeCount}</span> of {totalCount} products score 0–1
            </div>
          )}
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span style={{ fontSize: "0.62rem", color: T.iceBlue, fontFamily: "'Inter',sans-serif", fontWeight: "500" }}>See products</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.iceBlue} strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </div>
        </div>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ShopDisclaimer
// ---------------------------------------------------------------------------
function ShopDisclaimer() {
  return (
    <div style={{ fontSize: "0.6rem", color: "#9AACBC", fontFamily: "'Inter',sans-serif", textAlign: "center", padding: "1rem 1.5rem 0.5rem", lineHeight: 1.6 }}>
      Ralli is for informational purposes only and is not a substitute for professional dermatological advice. We earn a commission on purchases made through our links.
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShopImageCell
// ---------------------------------------------------------------------------
function ShopImageCell({ p }) {
  const [status, setStatus] = useState("loading");
  const [imgSrc, setImgSrc] = useState(p.adminImage || p.image || "");

  React.useEffect(() => {
    const newSrc = p.adminImage || p.image || "";
    if (newSrc !== imgSrc) { setImgSrc(newSrc); setStatus("loading"); }
  }, [p.adminImage, p.image]);

  const bc = BRAND_COLORS[p.brand] || { bg: "#F5F5F5", accent: "#555", text: "#333" };
  const initials = (p.brand || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const words = (p.productName || "").split(" ");
  const shortLabel = words.slice(0, 3).join(" ");
  const showFallback = !imgSrc || status === "failed";
  const showImg = !!imgSrc && status !== "failed";

  function handleError() {
    const revMatch = imgSrc.match(/front_en\.(\d+)\.400\.jpg/);
    if (revMatch) {
      const nextRev = parseInt(revMatch[1]) + 1;
      if (nextRev <= 6) {
        setImgSrc(imgSrc.replace(`front_en.${revMatch[1]}.400.jpg`, `front_en.${nextRev}.400.jpg`));
        return;
      }
    }
    setStatus("failed");
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {showImg && (
        <img src={imgSrc} alt={p.productName}
          style={{ width: "82%", height: "82%", objectFit: "contain", display: status === "loaded" ? "block" : "none", position: "relative", zIndex: 2, mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }}
          onLoad={() => setStatus("loaded")}
          onError={handleError} />
      )}
      {(showFallback || status === "loading") && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "5px", padding: "12px", opacity: status === "loaded" ? 0 : 1, transition: "opacity 0.2s" }}>
          <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: bc.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: "800", color: "#fff", letterSpacing: "-0.02em" }}>{initials}</span>
          </div>
          <span style={{ fontSize: "0.46rem", fontWeight: "700", color: bc.text, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center", lineHeight: 1.35, maxWidth: "72px" }}>{shortLabel}</span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShopCard
// ---------------------------------------------------------------------------
function ShopCard({ p, onTap, currentUid }) {
  const ps = poreStyle(p.poreScore || 0);
  const bc = BRAND_COLORS[p.brand] || { bg: "#F5F5F5", accent: "#444", text: "#222" };
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
      <button onClick={onTap}
        style={{ width: "100%", background: T.surface, borderRadius: "0.75rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", display: "flex", flexDirection: "column", overflow: "hidden", transition: "transform 0.15s,box-shadow 0.15s", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}
        onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}>
        <div style={{ width: "100%", aspectRatio: "4/5", background: `linear-gradient(160deg, ${bc.bg} 0%, ${bc.accent}14 100%)`, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", position: "relative" }}>
          <ShopImageCell p={p} />
          <div style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(255,255,255,0.92)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "0.18rem 0.5rem", fontSize: "0.6rem", fontWeight: "700", color: ps.color, border: `1px solid ${ps.color}22` }}>
            {p.poreScore}/5
          </div>
        </div>
        <div style={{ padding: "0.7rem 0.75rem 0.8rem", borderTop: `1px solid ${T.border}` }}>
          <div style={{ fontSize: "0.52rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.brand}</div>
          <div style={{ fontSize: "0.75rem", fontWeight: "600", color: T.text, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: "0.45rem", minHeight: "2em" }}>{p.productName}</div>
          {p.scanCount > 0 && p.communityRating
            ? <span style={{ fontSize: "0.6rem", padding: "0.15rem 0.45rem", background: T.sage + "14", color: T.sage, borderRadius: "999px", fontWeight: "600" }}>
              ★ {p.communityRating}/10 Rallier · {p.scanCount} {p.scanCount === 1 ? "check" : "checks"}
            </span>
            : null
          }
          {currentUid && (
            <button onClick={e => { e.stopPropagation(); setShareOpen(true); }} style={{ marginTop: "0.5rem", display: "flex", alignItems: "center", gap: "0.35rem", background: "none", border: `1px solid ${T.border}`, borderRadius: "999px", padding: "0.2rem 0.6rem", cursor: "pointer", color: T.textLight, fontSize: "0.62rem", fontFamily: "'Inter',sans-serif", fontWeight: "500" }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
              Share
            </button>
          )}
        </div>
      </button>
      {shareOpen && <ShareProductModal user={{ uid: currentUid }} product={p} onClose={() => setShareOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// FriendsUsingSection
// ---------------------------------------------------------------------------
function FriendsUsingSection({ friendScans, products, onTap, profile }) {
  const friendProducts = React.useMemo(() => {
    const entries = Object.entries(friendScans || {});
    if (entries.length >= 1) {
      const productMap = {};
      products.forEach(p => { productMap[(p.productName || "").toLowerCase().trim()] = p; });
      return entries
        .filter(([, friends]) => friends.length >= 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([key, friends]) => {
          const p = productMap[key];
          if (!p) return null;
          const img = (p.adminImage || p.image || "").trim();
          if (!img || !img.startsWith("http")) return null;
          return { ...p, friends };
        })
        .filter(Boolean);
    }
    return [];
  }, [friendScans, products]);

  if (!friendProducts.length) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "0.75rem", fontFamily: "'Inter',sans-serif" }}>
        What your friends are using
      </div>
      <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
        {friendProducts.map((p, i) => {
          const score = p.poreScore ?? 0;
          const ps = poreStyle(score);
          const friendNames = p.friends || [];
          const label = friendNames.length === 1
            ? `${friendNames[0].displayName.split(" ")[0]} uses this`
            : friendNames.length === 2
              ? `${friendNames[0].displayName.split(" ")[0]} & ${friendNames[1].displayName.split(" ")[0]} use this`
              : `${friendNames[0].displayName.split(" ")[0]}, ${friendNames[1].displayName.split(" ")[0]} & ${friendNames.length - 2} more`;

          return (
            <button key={i} onClick={() => onTap(p)}
              style={{ flexShrink: 0, width: "148px", background: T.surface, borderRadius: "1.1rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              <div style={{ position: "relative", background: T.surfaceAlt, height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(p.adminImage || p.image || null) ? (
                  <img src={p.adminImage || p.image || null} alt={p.productName} style={{ width: "80px", height: "80px", objectFit: "contain", mixBlendMode: "multiply" }} onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div style={{ fontSize: "1.4rem", fontWeight: "800", color: T.textLight, opacity: 0.3 }}>{(p.brand || "?").slice(0, 2).toUpperCase()}</div>
                )}
                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: ps.color, borderRadius: "0.5rem", padding: "2px 6px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "0.55rem", fontWeight: "700", color: "#fff", lineHeight: 1 }}>PORE</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#fff", lineHeight: 1.1 }}>{score}<span style={{ fontSize: "0.5rem" }}>/5</span></span>
                </div>
              </div>
              <div style={{ padding: "0.6rem 0.65rem 0.7rem" }}>
                <div style={{ fontSize: "0.55rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>{p.brand}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.3, marginBottom: "0.45rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.productName}</div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <div style={{ display: "flex" }}>
                    {friendNames.slice(0, 3).map((f, j) => (
                      <div key={j} style={{ width: "18px", height: "18px", borderRadius: "50%", border: `1.5px solid ${T.surface}`, marginLeft: j > 0 ? "-5px" : "0", background: T.accent, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {f.photoURL
                          ? <img src={f.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <span style={{ fontSize: "0.38rem", fontWeight: "700", color: "#fff" }}>{(f.displayName || "?")[0]}</span>
                        }
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: "0.58rem", color: T.textLight, fontFamily: "'Inter',sans-serif", lineHeight: 1.2 }}>{label}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FounderPicksSection — Top Picks (featured products, auto-curated)
// ---------------------------------------------------------------------------
export function FounderPicksSection({ onTap, friendScans = {} }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        try {
          const fSnap = await getDocs(query(
            collection(db, "products"),
            where("featuredOnExplore", "==", true),
            limit(100)
          ));
          const featured = fSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(p => !p.hidden)
            .sort((a, b) => (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999))
            .slice(0, 100);

          setPicks(featured.map(p => ({
            id: p.id,
            productId: p.id,
            productName: p.productName,
            brand: p.brand || "",
            category: p.category || "other",
            image: p.adminImage || p.image || "",
            adminImage: p.adminImage || "",
            poreScore: p.poreScore ?? 0,
            ingredients: p.ingredients || "",
            buyUrl: p.buyUrl || "",
            communityRating: p.communityRating || null,
            order: p.featuredOrder ?? 0,
          })));
        } catch (e) { console.warn("featuredOnExplore query failed", e); }
      } catch (e) { console.error("Top Picks load error", e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ height: "13px", width: "180px", background: T.surfaceAlt, borderRadius: "4px", marginBottom: "0.5rem" }} />
      <div style={{ height: "11px", width: "140px", background: T.surfaceAlt, borderRadius: "4px", marginBottom: "1rem", opacity: 0.6 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: "260px", background: T.surface, borderRadius: "1rem", border: `1px solid ${T.border}` }} />)}
      </div>
    </div>
  );
  if (!picks.length) return null;

  const grouped = {};
  picks.forEach(p => {
    const cat = p.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });
  const orderedCategories = [
    ...CAT_ORDER.filter(c => grouped[c]?.length),
    ...Object.keys(grouped).filter(c => !CAT_ORDER.includes(c)),
  ];

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ marginBottom: "1.1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "2px" }}>
          <span style={{ fontSize: "0.85rem" }}>⭐</span>
          <span style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#D4A015", fontWeight: "700", fontFamily: "'Inter',sans-serif" }}>Top Picks</span>
        </div>
        <div style={{ fontSize: "0.72rem", color: T.textLight, fontFamily: "'Inter',sans-serif" }}>The cleanest, most-loved formulas in Ralli — by category</div>
      </div>

      {orderedCategories.map(cat => {
        const items = grouped[cat];
        if (!items?.length) return null;
        const label = CAT_LABEL[cat] || cat;
        const emoji = CAT_EMOJI[cat] || "🛍";
        return (
          <div key={cat} style={{ marginBottom: "1.4rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.65rem" }}>
              <span style={{ fontSize: "0.95rem" }}>{emoji}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif" }}>{label}</span>
              <span style={{ fontSize: "0.58rem", color: T.textLight, fontFamily: "'Inter',sans-serif", fontWeight: "500", marginLeft: "auto" }}>{items.length} pick{items.length === 1 ? "" : "s"}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
              {items.map(pick => {
                const ps = poreStyle(pick.poreScore || 0);
                const img = (pick.adminImage || pick.image || "").trim();
                const pickFriends = getFriendRoutineUsers(friendScans, pick.productName, pick.id);
                return (
                  <button key={pick.id} onClick={() => onTap({ ...pick, productImage: img })}
                    style={{ background: T.surface, borderRadius: "1rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", transition: "all 0.18s", display: "flex", flexDirection: "column" }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "#D4A01580"; e.currentTarget.style.boxShadow = `0 6px 20px #D4A01518`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                    <div style={{ width: "100%", aspectRatio: "4/3", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                      {img
                        ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "12px", mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }} onError={e => e.target.style.display = "none"} />
                        : <PlaceholderCard name={pick.productName} brand={pick.brand || ""} />
                      }
                      {pick.ingredients && pick.ingredients.trim().length >= 10 && pick.poreScore != null && pick.poreScore > 0 && (
                        <div style={{ position: "absolute", top: "8px", left: "8px", background: ps.color, borderRadius: "0.4rem", padding: "2px 7px", display: "flex", alignItems: "center", gap: "3px" }}>
                          <span style={{ fontSize: "0.6rem", fontWeight: "700", color: "#fff" }}>{pick.poreScore}/5</span>
                        </div>
                      )}
                      <FriendRoutinePill friends={pickFriends} />
                    </div>
                    <div style={{ padding: "0.65rem 0.7rem 0.75rem", flex: 1, display: "flex", flexDirection: "column" }}>
                      {pick.brand && <div style={{ fontSize: "0.53rem", color: T.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pick.brand}</div>}
                      <div style={{ fontSize: "0.78rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{pick.productName}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AdminFounderPicks — admin UI to manage the founder_picks collection
// ---------------------------------------------------------------------------
export function AdminFounderPicks() {
  const [picks, setPicks] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const productCache = useProductCache();

  function liveScoreFor(p) {
    if (!p) return 0;
    const ing = (p.ingredients || "").trim();
    if (ing.length > 10) {
      try {
        const r = analyzeIngredients(ing);
        if (r?.avgScore != null) return Math.round(r.avgScore);
      } catch {}
    }
    return p.poreScore ?? 0;
  }

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const prodSnap = await getDocs(collection(db, "products"));
        setProducts(prodSnap.docs.map(d => { const r = d.data(); if (Array.isArray(r.ingredients)) r.ingredients = r.ingredients.map(i => i.label_name || i.name || "").join(", "); return { id: d.id, ...r }; }).filter(p => p.approved));
      } catch (e) { console.error("AdminFounderPicks products error:", e); }
      try {
        const pickSnap = await getDocs(query(collection(db, "founder_picks"), orderBy("order", "asc")));
        setPicks(pickSnap.docs.map(d => { const r = d.data(); if (Array.isArray(r.ingredients)) r.ingredients = r.ingredients.map(i => i.label_name || i.name || "").join(", "); return { id: d.id, ...r }; }));
      } catch {
        try {
          const pickSnap = await getDocs(collection(db, "founder_picks"));
          setPicks(pickSnap.docs.map(d => { const r = d.data(); if (Array.isArray(r.ingredients)) r.ingredients = r.ingredients.map(i => i.label_name || i.name || "").join(", "); return { id: d.id, ...r }; }));
        } catch (e) { console.error("AdminFounderPicks picks error:", e); }
      }
      setLoading(false);
    }
    load();
  }, []);

  async function addPick(product) {
    if (picks.find(p => p.productId === product.id || p.productName === product.productName)) {
      setMsg("Already in picks"); setTimeout(() => setMsg(""), 2000); return;
    }
    setMsg("Adding…");
    try {
      const newPick = {
        productId: product.id,
        productName: product.productName,
        brand: product.brand || "",
        image: product.adminImage || product.image || "",
        poreScore: product.poreScore || 0,
        buyUrl: product.buyUrl || "",
        note: "",
        founderName: "McKenzie",
        order: picks.length,
        createdAt: serverTimestamp(),
      };
      const r = await addDoc(collection(db, "founder_picks"), newPick);
      setPicks(p => [...p, { id: r.id, ...newPick }]);
      setSearch("");
      setMsg("✓ Added!"); setTimeout(() => setMsg(""), 2000);
    } catch (e) {
      setMsg("Error: " + e.message); setTimeout(() => setMsg(""), 4000);
    }
  }

  async function updateNote(id, note) {
    await updateDoc(doc(db, "founder_picks", id), { note });
    setPicks(p => p.map(x => x.id === id ? { ...x, note } : x));
  }

  async function updateFounder(id, founderName) {
    await updateDoc(doc(db, "founder_picks", id), { founderName });
    setPicks(p => p.map(x => x.id === id ? { ...x, founderName } : x));
  }

  async function remove(id) {
    if (!confirm("Remove this pick?")) return;
    await deleteDoc(doc(db, "founder_picks", id));
    setPicks(p => p.filter(x => x.id !== id));
  }

  const filtered = search.trim().length > 0
    ? products.filter(p => (p.productName + " " + p.brand).toLowerCase().includes(search.toLowerCase())).slice(0, 8)
    : [];

  if (loading) return <div style={{ padding: "2rem", textAlign: "center", color: T.textLight }}>Loading…</div>;

  return (
    <div style={{ padding: "1rem" }}>
      <div style={{ fontWeight: "700", fontFamily: "'Inter',sans-serif", fontSize: "1rem", color: T.text, marginBottom: "0.35rem" }}>
        What We're Loving
      </div>
      <div style={{ fontSize: "0.72rem", color: T.textLight, marginBottom: "1.25rem" }}>
        Search your product database and add picks. These appear on the Explore page.
      </div>
      <div style={{ marginBottom: "0.75rem" }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder={`Search ${products.length} products…`}
          style={{ width: "100%", padding: "0.65rem 1rem", borderRadius: "0.65rem", border: `1px solid ${T.border}`, fontSize: "0.82rem", fontFamily: "'Inter',sans-serif", color: T.text, background: T.surface, outline: "none", boxSizing: "border-box" }} />
      </div>
      {filtered.length > 0 && (
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "0.65rem", overflow: "hidden", marginBottom: "0.75rem" }}>
          {filtered.map(p => (
            <button key={p.id} onClick={() => { document.activeElement?.blur(); addPick(p); }}
              style={{ width: "100%", padding: "0.85rem 1rem", background: "none", border: "none", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "rgba(0,0,0,0.05)" }}>
              {(p.adminImage || p.image) && <img src={p.adminImage || p.image} alt="" style={{ width: "40px", height: "40px", objectFit: "contain", borderRadius: "0.35rem", background: "#ffffff", flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</div>
                <div style={{ fontSize: "0.68rem", color: T.textLight }}>{p.brand} · Pore {liveScoreFor(p)}/5</div>
              </div>
              <div style={{ flexShrink: 0, background: T.sage, color: "#fff", borderRadius: "0.5rem", padding: "0.35rem 0.75rem", fontSize: "0.75rem", fontWeight: "700" }}>+ Add</div>
            </button>
          ))}
        </div>
      )}
      {msg && <div style={{ fontSize: "0.75rem", color: T.sage, fontWeight: "600", marginBottom: "0.5rem" }}>{msg}</div>}
      <div style={{ fontSize: "0.62rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: "600", marginBottom: "0.5rem" }}>{picks.length} / 10 picks</div>
      {picks.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: T.textLight, fontSize: "0.8rem", background: T.surfaceAlt, borderRadius: "0.75rem" }}>
          No picks yet — search and add products above
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
        {picks.map(pick => (
          <div key={pick.id} style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: "0.85rem", padding: "0.75rem", display: "flex", gap: "0.65rem", alignItems: "flex-start" }}>
            <div style={{ width: "44px", height: "44px", flexShrink: 0, borderRadius: "0.4rem", overflow: "hidden", background: "#fff", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {pick.image ? <img src={pick.image} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "3px" }} alt="" /> : <span style={{ fontSize: "1rem" }}>📦</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.8rem", fontWeight: "600", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pick.productName}</div>
              <div style={{ fontSize: "0.65rem", color: T.textLight, marginBottom: "0.4rem" }}>{pick.brand} · Pore {liveScoreFor(productCache.get(pick.productId) || productCache.get(pick.productName) || pick)}/5</div>
              <select value={pick.founderName || "McKenzie"} onChange={e => updateFounder(pick.id, e.target.value)}
                style={{ fontSize: "0.68rem", padding: "0.2rem 0.4rem", borderRadius: "0.3rem", border: `1px solid ${T.border}`, background: T.surface, color: T.textMid, marginBottom: "0.35rem", fontFamily: "'Inter',sans-serif" }}>
                <option>McKenzie</option>
                <option>Morgan</option>
              </select>
              <input value={pick.note || ""} onChange={e => updateNote(pick.id, e.target.value)}
                placeholder="Add a short note (e.g. 'My go-to SPF')"
                style={{ width: "100%", padding: "0.35rem 0.55rem", borderRadius: "0.4rem", border: `1px solid ${T.border}`, fontSize: "0.72rem", fontFamily: "'Inter',sans-serif", color: T.text, background: T.bg, outline: "none", boxSizing: "border-box" }} />
            </div>
            <button onClick={() => remove(pick.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.rose, padding: "0.2rem", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Legacy alias — existing code still uses WhatWereLovingSection in ShopPage
function WhatWereLovingSection({ onTap, friendScans = {} }) {
  return <FounderPicksSection onTap={onTap} friendScans={friendScans} />;
}

// ---------------------------------------------------------------------------
// FounderPicksRow — personal picks from McKenzie & Morgan
// Reads from the founder_picks Firestore collection. Managed via:
//   Admin → Content → Founder Picks
// ---------------------------------------------------------------------------
export function FounderPicksRow({ onTap, friendScans = {} }) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const founderAvatars = useFounderAvatars();
  const productCache = useProductCache();

  useEffect(() => {
    if (!productCache.ready) return;
    async function load() {
      try {
        let snap;
        try {
          snap = await getDocs(query(collection(db, "founder_picks"), orderBy("order", "asc"), limit(12)));
        } catch {
          snap = await getDocs(query(collection(db, "founder_picks"), limit(12)));
        }
        if (snap.empty) { setLoading(false); return; }
        const pickData = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        setPicks(pickData.map(pick => {
          const p = productCache.get(pick.productId) || productCache.get(pick.productName) || {};
          const ingredients = p.ingredients || pick.ingredients || "";
          let liveScore = p.poreScore ?? pick.poreScore ?? 99;
          try {
            if (ingredients.trim().length > 10) {
              const r = analyzeIngredients(ingredients);
              if (r?.avgScore != null) liveScore = Math.round(r.avgScore);
            }
          } catch {}
          return {
            ...pick,
            image: getProductImage(p) || pick.image || "",
            poreScore: liveScore,
            ingredients,
            brand: p.brand || pick.brand || "",
            buyUrl: p.buyUrl || pick.buyUrl || "",
            communityRating: p.communityRating || pick.communityRating || null,
          };
        }).filter(pick => pick.poreScore <= 1));
      } catch (e) { console.error("FounderPicks load error", e); }
      setLoading(false);
    }
    load();
  }, [productCache.ready]);

  if (loading) return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ height: "13px", width: "160px", background: T.surfaceAlt, borderRadius: "4px", marginBottom: "0.5rem" }} />
      <div style={{ height: "11px", width: "220px", background: T.surfaceAlt, borderRadius: "4px", marginBottom: "1rem", opacity: 0.6 }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
        {[1, 2, 3, 4].map(i => <div key={i} style={{ height: "230px", background: T.surface, borderRadius: "1rem", border: `1px solid ${T.border}` }} />)}
      </div>
    </div>
  );
  if (!picks.length) return null;

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ marginBottom: "0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "2px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={T.rose}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
          <span style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: T.rose, fontWeight: "700", fontFamily: "'Inter',sans-serif" }}>What We're Loving</span>
        </div>
        <div style={{ fontSize: "0.72rem", color: T.textLight, fontFamily: "'Inter',sans-serif" }}>Personally curated by the Founders</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.65rem" }}>
        {picks.map(pick => {
          const ps = poreStyle(pick.poreScore || 0);
          const img = (pick.adminImage || pick.image || "").trim();
          const founderPhoto = pick.founderPhoto || founderAvatars[pick.founderName] || "";
          const pickFriends = getFriendRoutineUsers(friendScans, pick.productName, pick.id);
          return (
            <button key={pick.id} onClick={() => onTap({ ...pick, productImage: img })}
              style={{ background: T.surface, borderRadius: "1rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", transition: "all 0.18s", display: "flex", flexDirection: "column" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.rose + "80"; e.currentTarget.style.boxShadow = `0 6px 20px ${T.rose}18`; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: "100%", aspectRatio: "4/3", background: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                {img
                  ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "12px", mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }} onError={e => e.target.style.display = "none"} />
                  : <PlaceholderCard name={pick.productName} brand={pick.brand || ""} />
                }
                {pick.ingredients && pick.ingredients.trim().length >= 10 && pick.poreScore != null && pick.poreScore > 0 && (
                  <div style={{ position: "absolute", top: "8px", left: "8px", background: ps.color, borderRadius: "0.4rem", padding: "2px 7px", display: "flex", alignItems: "center", gap: "3px" }}>
                    <span style={{ fontSize: "0.6rem", fontWeight: "700", color: "#fff" }}>{pick.poreScore}/5</span>
                  </div>
                )}
                {founderPhoto && !pickFriends.length && (
                  <div style={{ position: "absolute", bottom: "8px", right: "8px", borderRadius: "50%", border: `2px solid ${T.surface}`, overflow: "hidden", width: "26px", height: "26px", boxShadow: "0 1px 6px rgba(0,0,0,0.15)" }}>
                    <img src={founderPhoto} alt={pick.founderName || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                  </div>
                )}
                {founderPhoto && pickFriends.length > 0 && (
                  <div style={{ position: "absolute", bottom: "8px", right: "8px", borderRadius: "50%", border: `2px solid ${T.surface}`, overflow: "hidden", width: "26px", height: "26px", boxShadow: "0 1px 6px rgba(0,0,0,0.15)", opacity: 0.5 }}>
                    <img src={founderPhoto} alt={pick.founderName || ""} style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={e => e.target.style.display = "none"} />
                  </div>
                )}
                <FriendRoutinePill friends={pickFriends} />
              </div>
              <div style={{ padding: "0.65rem 0.7rem 0.75rem", flex: 1, display: "flex", flexDirection: "column" }}>
                {pick.brand && <div style={{ fontSize: "0.53rem", color: T.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pick.brand}</div>}
                <div style={{ fontSize: "0.78rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", marginBottom: "0.45rem" }}>{pick.productName}</div>
                {pick.note && (
                  <div style={{ fontSize: "0.65rem", color: T.textMid, lineHeight: 1.4, fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", flex: 1, marginBottom: "0.45rem" }}>
                    "{pick.note}"
                  </div>
                )}
                {pick.founderName && (
                  <div style={{ fontSize: "0.58rem", color: T.textLight, fontFamily: "'Inter',sans-serif", fontWeight: "600" }}>
                    — {pick.founderName}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShopPage
// ---------------------------------------------------------------------------
export function ShopPage({ user, profile, onUpdateProfile }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [brandFilter, setBrandFilter] = useState(null);
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [friendScans, setFriendScans] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [requestSent, setRequestSent] = useState("");

  async function openProductFromPost(post) {
    try {
      const q = query(collection(db, "products"), where("productName", "==", post.productName || post.name || ""), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const rawP = snap.docs[0].data();
        if (Array.isArray(rawP.ingredients)) rawP.ingredients = rawP.ingredients.map(i => i.label_name || i.name || "").join(", ");
        const p = { id: snap.docs[0].id, ...rawP };
        const ingA = (p.ingredients || "").trim();
        const rawIB = post.ingredients || ""; const ingB = (Array.isArray(rawIB) ? rawIB.map(i => i.label_name || i.name || "").join(", ") : rawIB).trim();
        const ing = ingA.length >= ingB.length ? (ingA || ingB) : (ingB || ingA);
        const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
        setSelectedProduct({ id: p.id, productId: p.id, productName: p.productName || post.productName, brand: p.brand || post.brand, image: p.adminImage || p.image || post.productImage || post.image || "", poreScore: liveScore ?? p.poreScore ?? post.poreScore ?? 0, communityRating: p.communityRating || post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: p.buyUrl || post.buyUrl || amazonUrl(p.productName || post.productName, p.brand || post.brand, p.barcode || post.barcode, p.asin || post.asin, p.buyUrl || post.buyUrl) });
        return;
      }
    } catch (e) {}
    const pName = post.productName || post.name || "";
    const rawIngFb = post.ingredients || ""; const ing = (Array.isArray(rawIngFb) ? rawIngFb.map(i => i.label_name || i.name || "").join(", ") : rawIngFb).trim();
    const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
    setSelectedProduct({ productName: pName, brand: post.brand, image: post.adminImage || post.image || post.productImage || "", poreScore: liveScore ?? post.poreScore ?? 0, communityRating: post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: post.buyUrl || amazonUrl(pName, post.brand, post.barcode, post.asin, post.buyUrl) });
  }

  useEffect(() => {
    getShopProducts().then(ps => {
      setProducts(ps);
      setLoading(false);
    });
    async function loadFriendScans() {
      const following = profile?.following || [];
      if (!following.length) return;
      try {
        const chunks = [];
        for (let i = 0; i < Math.min(following.length, 30); i += 10)
          chunks.push(following.slice(i, i + 10));
        const map = {};
        await Promise.all(chunks.map(async chunk => {
          const snap = await getDocs(query(collection(db, "users"), where("__name__", "in", chunk)));
          snap.docs.forEach(d => {
            const u = d.data();
            const routine = u.routine || [];
            const displayName = u.displayName || "";
            const photoURL = u.photoURL || "";
            const uid = d.id;
            routine.forEach(productName => {
              if (!productName) return;
              const key = productName.toLowerCase().trim();
              if (!map[key]) map[key] = [];
              if (!map[key].find(f => f.uid === uid))
                map[key].push({ displayName, photoURL, uid, productName });
            });
          });
        }));
        setFriendScans(map);
      } catch (e) { console.error("friendScans", e); }
    }
    loadFriendScans();
  }, []);

  function hasRealImage(p) {
    return hasValidImage(p);
  }

  const completeProducts = products.filter(p => {
    if (!p.approved) return false;
    if (!hasRealImage(p)) return false;
    if (!(p.buyUrl || "").trim().startsWith("http")) return false;
    if ((p.ingredients || "").trim().length <= 10) return false;
    const liveScore = (() => { const r = analyzeIngredients(p.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : (p.poreScore ?? 99); })();
    return liveScore <= 1;
  });

  const rankedProducts = [...completeProducts].sort((a, b) =>
    (a.poreScore ?? 99) - (b.poreScore ?? 99) ||
    (b.communityRating || 0) - (a.communityRating || 0) ||
    (b.scanCount || 0) - (a.scanCount || 0)
  ).slice(0, 100);

  const filteredProducts = brandFilter
    ? rankedProducts.filter(p => (p.brand || "").toLowerCase() === brandFilter.toLowerCase())
    : rankedProducts;

  const grouped = {};
  filteredProducts.forEach(p => {
    const cat = p.category || "other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const categories = CAT_ORDER
    .filter(c => grouped[c]?.length > 0)
    .map(c => {
      const all = (grouped[c] || []).filter(p => { const img = (p.adminImage || p.image || p.productImage || "").trim(); return img.startsWith("http"); }).sort((a, b) => (a.poreScore ?? 99) - (b.poreScore ?? 99) || (b.scanCount || 0) - (a.scanCount || 0));
      const isExpanded = expandedCats.has(c) || activeCat === c;
      return {
        id: c,
        label: CAT_LABEL[c] || c,
        emoji: CAT_EMOJI[c] || "🛍",
        products: isExpanded ? all : all.slice(0, 5),
        total: all.length,
        isExpanded,
      };
    });

  const searchFiltered = searchQuery.trim().length > 1
    ? completeProducts.filter(p => (p.productName + " " + p.brand).toLowerCase().includes(searchQuery.toLowerCase()))
    : null;

  const displayCats = searchFiltered
    ? [{ id: "search", label: `Results for "${searchQuery}"`, emoji: "🔍", products: searchFiltered.slice(0, 20), total: searchFiltered.length, isExpanded: true }]
    : activeCat ? categories.filter(c => c.id === activeCat) : categories;

  if (loading) return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "3rem 1rem", textAlign: "center" }}>
      <div style={{ width: "24px", height: "24px", borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto 0.75rem" }} />
      <div style={{ color: T.textLight, fontSize: "0.82rem" }}>Loading…</div>
    </div>
  );

  async function requestProduct(name) {
    if (requestSent === name) return;
    setRequestSent(name + "_loading");
    try {
      const existing = await getDocs(query(
        collection(db, "products"),
        where("productName", "==", name.trim())
      ));
      if (!existing.empty) { setRequestSent(name); return; }

      let productData = { productName: name.trim(), brand: "", barcode: "", ingredients: "" };
      try {
        const q = encodeURIComponent(name.trim());
        const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,code,ingredients_text,ingredients_text_en`, { signal: AbortSignal.timeout(5000) });
        const d = await r.json();
        const hit = (d.products || [])[0];
        if (hit) {
          productData.productName = hit.product_name || name.trim();
          productData.brand = hit.brands?.split(",")[0]?.trim() || "";
          productData.barcode = hit.code || "";
          productData.ingredients = hit.ingredients_text_en || hit.ingredients_text || "";
        }
      } catch {}

      let poreScore = 0;
      if (productData.ingredients) {
        try {
          const a = analyzeIngredients(productData.ingredients);
          if (a?.avgScore != null) poreScore = Math.round(a.avgScore);
        } catch {}
      }

      await addDoc(collection(db, "products"), {
        productName: productData.productName,
        brand: productData.brand,
        barcode: productData.barcode,
        ingredients: productData.ingredients,
        poreScore,
        image: "",
        adminImage: "",
        approved: false,
        hidden: false,
        source: "user_request",
        requestedBy: user?.uid || "anon",
        scanCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: Date.now(),
      });

      setRequestSent(name);
    } catch (e) { console.error(e); setRequestSent(""); }
  }

  if (!products.length) return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "3rem 1rem", textAlign: "center", color: T.textLight }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🛍</div>
      <div style={{ fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", marginBottom: "0.4rem" }}>No products yet</div>
      <div style={{ fontSize: "0.8rem" }}>Ask an admin to seed the product catalog.</div>
    </div>
  );

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "6rem" }}>
      <div style={{ padding: "0.85rem 1rem 0" }}>

        {/* Brand of the Week */}
        <BrandOfTheWeek onBrandTap={b => {
          setBrandFilter(b);
          setActiveCat(null);
          setTimeout(() => {
            const el = document.getElementById("shop-products-list");
            if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          }, 100);
        }} />

        {/* Founder Picks — manual selections from McKenzie & Morgan */}
        <FounderPicksRow friendScans={friendScans} onTap={openProductFromPost} />

        {/* Brand filter banner */}
        <div id="shop-products-list" />
        {brandFilter && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem 0.75rem", background: T.navy, borderRadius: "0.65rem", marginBottom: "0.75rem" }}>
            <span style={{ fontSize: "0.72rem", color: "#fff", fontFamily: "'Inter',sans-serif", fontWeight: "500" }}>
              Showing: <strong>{brandFilter}</strong>
            </span>
            <button onClick={() => setBrandFilter(null)} style={{ background: "none", border: "none", color: T.iceBlue, cursor: "pointer", fontSize: "0.72rem", fontFamily: "'Inter',sans-serif", padding: "0" }}>
              Clear ✕
            </button>
          </div>
        )}

        {/* Search + request */}
        <div style={{ position: "relative", marginBottom: "0.75rem" }}>
          <input
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setRequestSent(""); }}
            placeholder="Search products…"
            style={{ width: "100%", padding: "0.65rem 1rem 0.65rem 2.2rem", borderRadius: "0.75rem", border: `1px solid ${T.border}`, fontSize: "0.82rem", fontFamily: "'Inter',sans-serif", color: T.text, background: T.surface, outline: "none", boxSizing: "border-box" }}
          />
          <svg style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          {searchQuery && <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textLight, fontSize: "1rem", padding: 0, lineHeight: 1 }}>×</button>}
        </div>
        {searchQuery.trim().length > 1 && completeProducts.filter(p => (p.productName + " " + p.brand).toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
          <div style={{ background: T.surfaceAlt, borderRadius: "0.75rem", padding: "0.9rem 1rem", marginBottom: "0.75rem", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.75rem" }}
            ref={el => { if (el && requestSent !== searchQuery.trim() && requestSent !== searchQuery.trim() + "_loading") requestProduct(searchQuery.trim()); }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "0.78rem", color: T.textMid, fontFamily: "'Inter',sans-serif" }}>
                No results for <strong>"{searchQuery}"</strong>
              </div>
              <div style={{ fontSize: "0.68rem", color: T.textLight, marginTop: "2px" }}>
                {requestSent === searchQuery.trim() + "_loading"
                  ? "Adding to our database…"
                  : requestSent === searchQuery.trim()
                    ? "✓ Added — we'll find an image overnight"
                    : "Searching database…"
                }
              </div>
            </div>
            <div style={{ fontSize: "1.2rem" }}>
              {requestSent === searchQuery.trim() ? "✓" : "⏳"}
            </div>
          </div>
        )}

        {/* Category filter pills */}
        <div style={{ display: "flex", gap: "0.4rem", overflowX: "auto", paddingBottom: "0.5rem", marginBottom: "1rem", scrollbarWidth: "none" }}>
          <button onClick={() => setActiveCat(null)}
            style={{ padding: "0.3rem 0.9rem", borderRadius: "999px", border: `1px solid ${!activeCat ? T.navy : T.border}`, background: !activeCat ? T.navy : "transparent", color: !activeCat ? "#FFFFFF" : T.textMid, fontSize: "0.68rem", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif", flexShrink: 0, letterSpacing: "0.03em", transition: "all 0.15s" }}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setActiveCat(activeCat === cat.id ? null : cat.id)}
              style={{ padding: "0.3rem 0.9rem", borderRadius: "999px", border: `1px solid ${activeCat === cat.id ? T.navy : T.border}`, background: activeCat === cat.id ? T.navy : "transparent", color: activeCat === cat.id ? "#FFFFFF" : T.textMid, fontSize: "0.68rem", fontWeight: "500", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif", flexShrink: 0, letterSpacing: "0.03em", transition: "all 0.15s" }}>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Sephora-style horizontal shelves */}
        {displayCats.map(cat => (
          <div key={cat.id} style={{ marginBottom: "2rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.85rem", paddingRight: "0.25rem" }}>
              <div>
                <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "1rem", color: T.text, letterSpacing: "-0.02em" }}>{cat.label}</div>
                <div style={{ fontSize: "0.62rem", color: T.textLight, marginTop: "1px" }}>{cat.total} products · sorted by pore safety</div>
              </div>
              <button onClick={() => {
                const expanding = activeCat !== cat.id;
                setActiveCat(expanding ? cat.id : null);
                if (expanding) {
                  requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: "smooth" }));
                }
              }}
                style={{ fontSize: "0.68rem", color: T.accent, background: "none", border: `1px solid ${T.accent}33`, borderRadius: "999px", padding: "0.25rem 0.75rem", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontWeight: "600", whiteSpace: "nowrap" }}>
                {activeCat === cat.id ? "↑ Less" : "See all →"}
              </button>
            </div>

            <div style={cat.isExpanded ? {
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.7rem",
              paddingBottom: "0.75rem",
            } : {
              display: "flex",
              gap: "0.7rem",
              overflowX: "auto",
              paddingBottom: "0.75rem",
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
              marginLeft: "-1rem",
              paddingLeft: "1rem",
              marginRight: "-1rem",
              paddingRight: "1rem",
            }}>
              {cat.products.map((p, i) => {
                const liveCardScore = (p.ingredients && p.ingredients.trim().length >= 10) ? (() => { const r = analyzeIngredients(p.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : null; })() : null;
                const ps = poreStyle(liveCardScore ?? 0);
                const img = (p.adminImage || p.image || "").trim();
                const friends = getFriendRoutineUsers(friendScans, p.productName, p.id);
                return (
                  <button key={p.id} onClick={() => setSelectedProduct(p)}
                    style={cat.isExpanded ? {
                      width: "100%", background: T.surface, borderRadius: "1.1rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", transition: "all 0.18s", display: "flex", flexDirection: "column", boxShadow: "0 1px 6px rgba(17,24,39,0.04)"
                    } : {
                      flexShrink: 0, width: "148px", background: T.surface, borderRadius: "1.1rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", transition: "all 0.18s", display: "flex", flexDirection: "column", boxShadow: "0 1px 6px rgba(17,24,39,0.04)"
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = `0 8px 24px rgba(17,24,39,0.12)`; e.currentTarget.style.borderColor = T.accent; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 1px 6px rgba(17,24,39,0.04)"; e.currentTarget.style.borderColor = T.border; }}>

                    <div style={{ width: "100%", aspectRatio: cat.isExpanded ? "1/1" : undefined, height: cat.isExpanded ? undefined : "148px", background: "#ffffff", position: "relative", overflow: "hidden" }}>
                      {img
                        ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "12px", mixBlendMode: "multiply", filter: "brightness(1.05) contrast(1.05)" }} onError={e => e.target.style.opacity = "0"} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <div style={{ width: "44px", height: "44px", borderRadius: "50%", background: T.accent + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: "1rem", fontWeight: "800", color: T.accent }}>{(p.brand || "?")[0].toUpperCase()}</span>
                          </div>
                        </div>
                      }
                      {liveCardScore != null && (
                        <div style={{ position: "absolute", top: "7px", right: "7px", background: ps.color, borderRadius: "0.45rem", padding: "3px 6px", boxShadow: "0 1px 4px rgba(0,0,0,0.15)" }}>
                          <div style={{ fontSize: "0.7rem", fontWeight: "800", color: "#fff", lineHeight: 1 }}>{liveCardScore}<span style={{ fontSize: "0.42rem", opacity: 0.85 }}>/5</span></div>
                        </div>
                      )}
                      {i < 3 && <div style={{ position: "absolute", top: "6px", left: "6px", background: "rgba(17,24,39,0.65)", backdropFilter: "blur(4px)", borderRadius: "999px", padding: "2px 6px" }}>
                        <span style={{ fontSize: "0.5rem", fontWeight: "700", color: "#fff", letterSpacing: "0.03em", fontFamily: "'Inter',sans-serif" }}>{i === 0 ? "#1" : i === 1 ? "#2" : "#3"}</span>
                      </div>}
                      <FriendRoutinePill friends={friends} />
                    </div>

                    <div style={{ padding: "0.6rem 0.7rem 0.75rem", flex: 1, display: "flex", flexDirection: "column", gap: "2px", borderTop: `1px solid ${T.border}` }}>
                      {p.brand && <div style={{ fontSize: "0.52rem", color: T.accent, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.brand}</div>}
                      <div style={{ fontSize: "0.78rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.25, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: "2.4em" }}>{p.productName}</div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                        <span style={{ fontSize: "0.58rem", fontWeight: "600", color: ps.color, background: ps.color + "12", padding: "2px 6px", borderRadius: "999px" }}>{ps.label}</span>
                        {p.buyUrl && (
                          <a href={p.buyUrl} target="_blank" rel="noopener noreferrer" onClick={e => { e.stopPropagation(); trackProductClick(p.id || null, p.productName || ""); }}
                            style={{ fontSize: "0.6rem", color: T.accent, textDecoration: "none", fontWeight: "700" }}>Shop →</a>
                        )}
                      </div>
                      {p.scanCount > 0 && <div style={{ fontSize: "0.55rem", color: "#6366f1", fontWeight: "600", marginTop: "1px" }}>🔥 {p.scanCount} scans</div>}
                      {(() => {
                        const fr = getFriendRoutineUsers(friendScans, p.productName, p.id);
                        if (fr.length > 0) return null;
                        const st = profile?.skinType;
                        const skinLabel = Array.isArray(st) ? st[0] : st;
                        if (skinLabel && p.skinTypes?.some(s => s.toLowerCase().includes(skinLabel.toLowerCase()))) {
                          return <div style={{ fontSize: "0.55rem", color: "#6366f1", fontWeight: "600", marginTop: "1px" }}>✨ Popular with {skinLabel.toLowerCase()} skin</div>;
                        }
                        if ((p.communityRating || 0) >= 8 && (p.ratingCount || p.scanCount || 0) >= 3) return <div style={{ fontSize: "0.55rem", color: T.rose, fontWeight: "600", marginTop: "1px" }}>⭐ Top rated this week</div>;
                        return null;
                      })()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {selectedProduct && (
          <ProductModal
            product={{
              productName: selectedProduct.productName,
              brand: selectedProduct.brand,
              image: selectedProduct.image,
              barcode: selectedProduct.barcode || selectedProduct.id,
              ingredients: selectedProduct.ingredients || "",
              poreScore: selectedProduct.poreScore ?? 0,
              flaggedIngredients: selectedProduct.ingredients ? analyzeIngredients(selectedProduct.ingredients).found : [],
              communityRating: selectedProduct.communityRating || null,
              buyUrl: selectedProduct.buyUrl || "",
            }}
            onClose={() => setSelectedProduct(null)}
            user={user}
            profile={profile}
            onUpdateProfile={onUpdateProfile}
          />
        )}
        <ShopDisclaimer />
      </div>
    </div>
  );
}
