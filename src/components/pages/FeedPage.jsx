import React, { useState, useEffect, useRef } from "react";
import {
  getDocs, getDoc, doc, query, collection, where, orderBy, limit,
  onSnapshot, addDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove
} from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { AMAZON_AFFILIATE_TAG, DAILY_MESSAGES } from "../../data/constants.js";
import { RalliIcons } from "../../data/icons.jsx";
import { db } from "../../lib/firebase.js";
import { getProductImage, resolveProductImage } from "../../lib/imageUtils.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { followUser } from "../../lib/socialUtils.js";
import { useProductCache } from "../providers/ProductCacheProvider.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { poreStyle, PoreScoreBadge } from "../shared/PoreScoreBadge.jsx";
import { PostCard } from "../shared/PostCard.jsx";
import { ProductModal } from "../shared/ProductModal.jsx";

// ---------------------------------------------------------------------------
// Module-level helpers (only used within FeedPage and its sub-components)
// ---------------------------------------------------------------------------

const CURATED_RECS_FALLBACK = [];

async function fetchCuratedRecs() {
  try {
    const snap = await getDocs(query(
      collection(db, "products"),
      where("featured", "==", true),
      orderBy("communityRating", "desc"),
      limit(12)
    ));
    if (!snap.empty) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch {}
  return CURATED_RECS_FALLBACK;
}

function getProductDisplayName(p) {
  if (!p) return "";
  const name  = p.productName || p.name || "";
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
      const isWord = /[a-zA-Z0-9]/.test(ch);
      if (isWord) {
        if (!inToken) { consumedTokens++; inToken = true; if (consumedTokens > targetTokens) { cutAt = i; break; } }
      } else { inToken = false; }
    }
    if (cutAt < 0) break;
    working = working.slice(cutAt).trim();
  }
  return working || name;
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

async function getNotifications(uid) {
  try {
    const q = query(collection(db, "notifications"), where("toUid", "==", uid), orderBy("createdAt", "desc"), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function getFeed(followingIds, currentUid) {
  try {
    const ids = [...(followingIds || []), currentUid].slice(0, 10);
    if (ids.length <= 1) {
      return await getGlobalFeed();
    }
    const q = query(collection(db, "posts"), where("uid", "in", ids), orderBy("createdAt", "desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    return [];
  }
}

async function getGlobalFeed() {
  try {
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(30));
    const snap = await getDocs(q);
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log("[getGlobalFeed] found", posts.length, "posts");
    console.log("[getGlobalFeed] postTypes:", posts.map(p => p.postType));
    console.log("[getGlobalFeed] uids:", [...new Set(posts.map(p => p.uid))]);
    return posts;
  } catch (e) {
    console.error("[getGlobalFeed] failed:", e?.message || e);
    return [];
  }
}

async function searchUsers(q) {
  try {
    const snap = await getDocs(collection(db, "users"));
    return snap.docs.map(d => d.data()).filter(u =>
      u.displayName?.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 10);
  } catch { return []; }
}

// In-memory product cache (module-level, session-scoped)
let _productCache = null;
async function getProductCache() {
  if (_productCache) return _productCache;
  const snap = await getDocs(collection(db, "products"));
  _productCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setTimeout(() => { _productCache = null; }, 5 * 60 * 1000);
  return _productCache;
}

async function searchProducts(searchTerm) {
  const q = searchTerm.toLowerCase().trim();
  if (!q) return [];
  const seen = new Set();
  const results = [];

  try {
    const allCached = await getProductCache();
    allCached.forEach(p => {
      const nameMatch = (p.productName || "").toLowerCase().includes(q);
      const brandMatch = (p.brand || "").toLowerCase().includes(q);
      if (nameMatch || brandMatch) {
        const key = `${p.brand || ""} ${p.productName || ""}`.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            code: p.barcode || p.id,
            name: p.productName,
            brand: p.brand || "",
            image: p.adminImage || p.image || "",
            ingredients: p.ingredients || "",
            poreScore: p.poreScore ?? null,
            communityRating: p.communityRating || null,
            scanCount: p.scanCount || 0,
            buyUrl: p.buyUrl || "",
            source: p.source || "cache",
            _productId: p.id,
            _cached: true,
            _approved: !!p.approved,
          });
        }
      }
    });
  } catch {}

  try {
    const r = await fetch(
      `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,ingredients_text,ingredients_text_en,code,image_front_small_url`,
      { signal: AbortSignal.timeout(6000) }
    );
    const d = await r.json();
    const newToCache = [];
    (d.products || []).filter(p => p.product_name && (p.brands || p.product_name)).forEach(p => {
      const brand = p.brands?.split(",")[0]?.trim() || "";
      const key = `${brand} ${p.product_name}`.toLowerCase().trim();
      const ingredients = p.ingredients_text_en || p.ingredients_text || "";
      let poreScore = null;
      try {
        const analysis = analyzeIngredients(ingredients);
        if (analysis?.avgScore != null) poreScore = Math.round(analysis.avgScore);
      } catch {}
      if (!seen.has(key)) {
        seen.add(key);
        results.push({
          code: p.code,
          name: p.product_name,
          brand,
          image: "",
          obfImage: p.image_front_small_url || "",
          ingredients,
          poreScore,
          source: "obf",
          _cached: false,
        });
      }
    });
  } catch {}

  function dedupeKey(r) {
    const norm = s => (s || "")
      .toLowerCase()
      .replace(/\b\d+(\.\d+)?\s?(fl\s?oz|oz|ml|g| g|l|gram|grams|ounce|ounces)\b/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return `${norm(r.brand)}|${norm(r.name)}`;
  }
  function richness(r) {
    const tier = r._cached && r._approved ? (r.image ? 4 : 3) : r._cached ? 2 : 1;
    const ingLen = (r.ingredients || "").length;
    const activity = (r.scanCount || 0) + (r.communityRating ? 10 : 0);
    return tier * 100000 + ingLen + activity;
  }
  const bestByKey = new Map();
  for (const r of results) {
    const k = dedupeKey(r);
    if (!k.replace(/[|\s]/g, "")) { bestByKey.set(Symbol(), r); continue; }
    const existing = bestByKey.get(k);
    if (!existing || richness(r) > richness(existing)) bestByKey.set(k, r);
  }
  const deduped = Array.from(bestByKey.values());
  const qt = searchTerm.toLowerCase().trim();
  return deduped
    .sort((a, b) => {
      const tierA = a._cached && a._approved ? (a.image ? 0 : 1) : a._cached ? 2 : 3;
      const tierB = b._cached && b._approved ? (b.image ? 0 : 1) : b._cached ? 2 : 3;
      if (tierA !== tierB) return tierA - tierB;
      const aExact = (a.name || "").toLowerCase().startsWith(qt) ? 0 : 1;
      const bExact = (b.name || "").toLowerCase().startsWith(qt) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const aActivity = (a.scanCount || 0) + (a.communityRating ? 10 : 0);
      const bActivity = (b.scanCount || 0) + (b.communityRating ? 10 : 0);
      return bActivity - aActivity;
    })
    .slice(0, 30);
}

function getDailyMessage() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];
}

// ---------------------------------------------------------------------------
// Sub-components (only used within FeedPage)
// ---------------------------------------------------------------------------

const IMG_CACHE = new Map();

function PlaceholderCard({ name, brand }) {
  const words = ((brand || name || "?").trim()).split(" ").filter(Boolean);
  const inits = words.length >= 2
    ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
    : (words[0] || "?").slice(0, 2).toUpperCase();
  const colors = [
    { bg: "#E8F0E8", fg: "#5A7A54" }, { bg: "#EAE4DC", fg: "#7C6E58" },
    { bg: "#EDE8F0", fg: "#7A6490" }, { bg: "#F0E8E8", fg: "#8A5A5A" },
    { bg: "#E8EDF0", fg: "#4A7080" }, { bg: "#F0EDE4", fg: "#7A6A40" },
  ];
  const c = colors[(inits.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: "100%", height: "100%", background: c.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.3rem", padding: "0.5rem" }}>
      <div style={{ fontSize: "1.3rem", fontWeight: "800", color: c.fg, fontFamily: "'Inter',sans-serif", lineHeight: 1, letterSpacing: "-0.02em" }}>{inits}</div>
      <div style={{ fontSize: "0.46rem", fontWeight: "600", color: c.fg, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", maxWidth: "72px", lineHeight: 1.3, overflow: "hidden" }}>
        {(name || "").length > 20 ? (name || "").slice(0, 18) + "…" : (name || "")}
      </div>
    </div>
  );
}

function ProductImage({ src, name, brand, barcode, size = "full" }) {
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

function FeedSkeleton() {
  return (
    <div style={{ padding: "0 1rem" }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ paddingTop: "0.85rem", marginBottom: "0.1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", marginBottom: "0.65rem" }}>
            <div className="skeleton" style={{ width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: "10px", width: `${55 + i * 12}px`, borderRadius: "6px", marginBottom: "5px" }} />
              <div className="skeleton" style={{ height: "9px", width: "48px", borderRadius: "6px" }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", borderRadius: "1rem", padding: "0.75rem", border: `1px solid ${T.border}`, marginBottom: "0.65rem" }}>
            <div className="skeleton" style={{ width: "56px", height: "56px", borderRadius: "0.65rem", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: "9px", width: "60px", borderRadius: "5px", marginBottom: "6px" }} />
              <div className="skeleton" style={{ height: "12px", width: `${110 + i * 18}px`, borderRadius: "6px", marginBottom: "5px" }} />
              <div className="skeleton" style={{ height: "9px", width: "80px", borderRadius: "5px" }} />
            </div>
            <div className="skeleton" style={{ width: "44px", height: "52px", borderRadius: "0.65rem", flexShrink: 0 }} />
          </div>
          <div style={{ display: "flex", gap: "1.1rem", paddingBottom: "0.75rem" }}>
            <div className="skeleton" style={{ height: "10px", width: "36px", borderRadius: "5px" }} />
            <div className="skeleton" style={{ height: "10px", width: "52px", borderRadius: "5px" }} />
          </div>
          <div style={{ height: "1px", background: T.border + "40", margin: "0 -1rem" }} />
        </div>
      ))}
    </div>
  );
}

function CardReveal({ children, delay = 0 }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { el.classList.remove("card-hidden"); el.classList.add("card-visible"); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return <div ref={ref} className="card-hidden" style={{ transitionDelay: `${delay}ms` }}>{children}</div>;
}

function PageHero({ pageTitle, pageIcon, fixed, rightAction }) {
  const [msg, setMsg] = useState(fixed || getDailyMessage());

  useEffect(() => {
    if (fixed) return;
    const now = Date.now();
    getDocs(collection(db, "config", "editorial", "entries"))
      .then(snap => {
        const quotes = snap.docs
          .map(d => ({ ...d.data() }))
          .filter(e => e.type === "quote" && e.scheduledFor <= now)
          .sort((a, b) => b.scheduledFor - a.scheduledFor);
        if (quotes[0]) setMsg(quotes[0].value);
      }).catch(() => {});
  }, []);

  return (
    <div style={{ padding: "0.6rem 1rem 0.25rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ fontSize: "0.52rem", color: T.textLight, letterSpacing: "0.06em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", fontWeight: "500", flex: 1, minWidth: 0 }}>
        {msg}
      </div>
      {rightAction && <div style={{ flexShrink: 0, marginLeft: "0.5rem" }}>{rightAction}</div>}
    </div>
  );
}

function ContactSuggestions({ currentUid, currentProfile, onFollow, onUserTap }) {
  const [suggestions, setSuggestions] = useState([]);
  const [followed, setFollowed] = useState(new Set());

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(collection(db, "users"));
        const already = new Set([...(currentProfile?.following || []), currentUid]);
        const all = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid && !already.has(u.uid) && u.displayName)
          .map(u => ({ ...u, followerCount: (u.followers || []).length }))
          .sort((a, b) => b.followerCount - a.followerCount)
          .slice(0, 8);
        setSuggestions(all);
      } catch (e) { console.error("suggestions", e); }
    }
    load();
  }, [currentUid]);

  async function handleFollow(uid) {
    await onFollow(uid);
    setFollowed(prev => new Set([...prev, uid]));
  }

  if (!suggestions.length) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {suggestions.map(u => (
        <div key={u.uid} style={{ background: T.surface, borderRadius: "0.85rem", border: `1px solid ${followed.has(u.uid) ? T.sage : T.border}`, padding: "0.65rem 0.85rem", display: "flex", alignItems: "center", gap: "0.75rem", transition: "border-color 0.2s" }}>
          <button onClick={() => onUserTap(u.uid)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0 }}>
            <Avatar photoURL={u.photoURL} name={u.displayName} size={38} />
          </button>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => onUserTap(u.uid)}>
            <div style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName}</div>
            <div style={{ fontSize: "0.65rem", color: T.textLight, marginTop: "1px" }}>
              {u.followerCount > 0 ? `${u.followerCount} follower${u.followerCount !== 1 ? "s" : ""}` : "New to Ralli"}
            </div>
          </div>
          <button onClick={() => !followed.has(u.uid) && handleFollow(u.uid)}
            style={{ padding: "0.35rem 0.85rem", background: followed.has(u.uid) ? T.sage + "22" : "transparent", color: followed.has(u.uid) ? T.sage : T.navy, border: `1.5px solid ${followed.has(u.uid) ? T.sage : T.navy}`, borderRadius: "999px", fontSize: "0.72rem", fontWeight: "700", cursor: followed.has(u.uid) ? "default" : "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0, transition: "all 0.2s" }}>
            {followed.has(u.uid) ? "✓ Following" : "Follow"}
          </button>
        </div>
      ))}
    </div>
  );
}

function TrendingSection({ openProductFromPost, trendingList, friendScans = {}, totalCommunityCounts = {} }) {
  const productCache = useProductCache();
  const [trendData, setTrendData] = React.useState([]);
  const [trendReady, setTrendReady] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const snap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(300)));
        const map = {};
        snap.docs.forEach(d => {
          const p = d.data();
          const ts = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : 0;
          if (ts < weekAgo) return;
          const key = (p.productName || "").toLowerCase().trim();
          if (!key) return;
          if (!map[key]) {
            const ing = (p.ingredients || "").trim();
            const computedScore = ing.length > 10
              ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
              : (p.poreScore ?? 0);
            map[key] = { ...p, id: d.id, scanCount: 0, totalRating: 0, ratingCount: 0, lovedCount: 0, brokeoutCount: 0, poreScore: computedScore };
          }
          map[key].scanCount++;
          if (p.communityRating) { map[key].totalRating += Number(p.communityRating); map[key].ratingCount++; }
          if (p.postType === "loved") map[key].lovedCount++;
          if (p.postType === "brokeout") map[key].brokeoutCount++;
        });
        const weekly = Object.values(map).sort((a, b) => b.scanCount - a.scanCount).slice(0, 8).map(p => ({ ...p, avgCommunity: p.ratingCount > 0 ? Math.round(p.totalRating / p.ratingCount) : null }));
        setTrendData(weekly.length ? weekly : trendingList.slice(0, 8));
      } catch { setTrendData(trendingList.slice(0, 8)); }
      setTrendReady(true);
    })();
  }, []);

  if (!trendReady || !trendData.length) return null;

  const topProduct = trendData[0];
  const rest = trendData.slice(1);
  const topLive = productCache.get(topProduct?.id) || productCache.get(topProduct?.productName) || topProduct;
  const topImage = getProductImage(topLive) || topProduct.productImage || topProduct.image || "";
  const topBrand = topLive?.brand || topProduct?.brand || "";
  const topScore = topLive?.poreScore ?? topProduct?.poreScore ?? 0;

  return (
    <div style={{ marginBottom: "1.75rem" }}>
      <div style={{ padding: "0 1rem", marginBottom: "0.85rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "2px" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={T.navy}><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></svg>
          <span style={{ fontSize: "0.62rem", letterSpacing: "0.1em", textTransform: "uppercase", color: T.navy, fontWeight: "700", fontFamily: "'Inter',sans-serif" }}>Trending</span>
        </div>
        <div style={{ fontSize: "0.72rem", color: T.textLight, fontFamily: "'Inter',sans-serif" }}>What people are checking this week</div>
      </div>

      <button onClick={() => openProductFromPost(topProduct)}
        style={{ width: "calc(100% - 2rem)", margin: "0 1rem 0.75rem", background: T.surface, border: `1px solid ${T.border}`, borderRadius: "1rem", padding: "0.85rem", cursor: "pointer", textAlign: "left", overflow: "hidden", display: "flex", gap: "0.85rem", alignItems: "center", transition: "all 0.18s" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = T.navy + "55"; e.currentTarget.style.boxShadow = `0 6px 20px ${T.navy}15`; e.currentTarget.style.transform = "translateY(-1px)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
        <div style={{ width: 78, height: 78, flexShrink: 0, background: "#ffffff", borderRadius: "0.65rem", overflow: "hidden", position: "relative" }}>
          <ProductImage src={topImage || null} name={topProduct.productName} brand={topBrand} barcode={topProduct.barcode || ""} size="full" />
          {topProduct.ingredients && topProduct.ingredients.trim().length >= 10 && topScore > 0 && (() => {
            const ps = poreStyle(topScore);
            return (
              <div style={{ position: "absolute", top: "6px", left: "6px", background: ps.color, borderRadius: "0.4rem", padding: "2px 7px", display: "flex", alignItems: "center", gap: "3px" }}>
                <span style={{ fontSize: "0.6rem", fontWeight: "700", color: "#fff" }}>{topScore}/5</span>
              </div>
            );
          })()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.2rem", fontFamily: "'Inter',sans-serif" }}>{topBrand}</div>
          <div style={{ fontSize: "0.92rem", fontWeight: "700", color: T.navy, fontFamily: "'Inter',sans-serif", lineHeight: 1.25, letterSpacing: "-0.01em", marginBottom: "0.4rem", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{getProductDisplayName({ productName: topProduct.productName, brand: topBrand })}</div>
          {(() => {
            const productKey = (topProduct.productName || "").toLowerCase().trim();
            const friends = friendScans[productKey] || [];
            const friendCount = friends.length;
            const communityCount = totalCommunityCounts[productKey] || 0;
            let signal = null;
            if (friendCount > 0) {
              const first = friends[0]?.displayName?.split(" ")[0];
              signal = friendCount === 1 && first
                ? `${first} uses this`
                : `Used by ${friendCount} friend${friendCount === 1 ? "" : "s"}`;
            } else if (communityCount > 0) {
              signal = `Used by ${communityCount} on Ralli`;
            } else if (topProduct.avgCommunity) {
              signal = `Community ${(topProduct.avgCommunity / 2).toFixed(1)}`;
            } else if (topProduct.scanCount > 1) {
              signal = `${topProduct.scanCount} checks this week`;
            }
            return signal ? (
              <div style={{ fontSize: "0.66rem", color: T.textMid, fontFamily: "'Inter',sans-serif", fontWeight: "500" }}>
                {signal}
              </div>
            ) : null;
          })()}
        </div>
      </button>

      {rest.length > 0 && (
        <div style={{ display: "flex", gap: "0.6rem", overflowX: "auto", paddingLeft: "1rem", paddingRight: "1rem", paddingBottom: "0.5rem", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {rest.map((p, i) => {
            const liveP = productCache.get(p.id) || productCache.get(p.productName) || p;
            const liveImg = getProductImage(liveP) || p.productImage || p.image || null;
            const liveBr = liveP.brand || p.brand || "";
            const liveSc = liveP.poreScore ?? p.poreScore ?? 0;
            const hasIng = (liveP.ingredients || p.ingredients || "").trim().length >= 10;
            return (
              <button key={p.productName + i} onClick={() => openProductFromPost(p)}
                style={{ flexShrink: 0, width: "110px", background: T.surface, borderRadius: "0.85rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", display: "flex", flexDirection: "column", transition: "all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = T.navy + "55"; e.currentTarget.style.boxShadow = `0 4px 14px ${T.navy}12`; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
                <div style={{ width: "100%", aspectRatio: "1/1", background: "#ffffff", position: "relative", overflow: "hidden" }}>
                  <ProductImage src={liveImg} name={p.productName} brand={liveBr} barcode={p.barcode || ""} size="full" />
                  {hasIng && liveSc > 0 && (() => {
                    const ps = poreStyle(liveSc);
                    return (
                      <div style={{ position: "absolute", top: "6px", left: "6px", background: ps.color, borderRadius: "0.35rem", padding: "1px 5px" }}>
                        <span style={{ fontSize: "0.55rem", fontWeight: "700", color: "#fff" }}>{liveSc}/5</span>
                      </div>
                    );
                  })()}
                </div>
                <div style={{ padding: "0.45rem 0.55rem 0.6rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.15rem" }}>
                  <div style={{ fontSize: "0.54rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.08em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'Inter',sans-serif" }}>{liveBr}</div>
                  <div style={{ fontSize: "0.7rem", fontWeight: "700", color: T.navy, fontFamily: "'Inter',sans-serif", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: 1.25, letterSpacing: "-0.005em" }}>{getProductDisplayName({ productName: p.productName, brand: liveBr })}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <div style={{ margin: "0.75rem 1rem 0", height: "1px", background: T.border }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FeedPage({ user, profile, refreshKey, onUserTap, onUpdateProfile, embedded = false }) {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("forYou");
  const [recPosts, setRecPosts]           = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQ, setSearchQ]             = useState("");
  const [searchResults, setSearchResults] = useState({ users: [], products: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [pullY, setPullY]           = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notifs, setNotifs]         = useState([]);
  const [feedFriendScans, setFeedFriendScans] = useState({});
  const [communityRoutineCounts, setCommunityRoutineCounts] = useState({});
  const [productImageMap, setProductImageMap] = useState({});
  const scrollRef   = React.useRef(null);
  const touchStartY = React.useRef(0);

  // Load product image map once
  React.useEffect(() => {
    getDocs(collection(db, "products")).then(snap => {
      const map = {};
      snap.docs.forEach(d => {
        const p = d.data();
        const img = p.adminImage || p.image || "";
        if (img && p.productName) {
          map[p.productName.toLowerCase().trim()] = img;
        }
      });
      setProductImageMap(map);
    }).catch(() => {});
  }, []);

  function onTouchStart(e) { touchStartY.current = e.touches[0].clientY; }
  function onTouchMove(e) {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.4, 72));
  }
  async function onTouchEnd() {
    if (pullY > 50 && !refreshing) {
      setRefreshing(true); setPullY(0);
      await loadFeed();
      setRefreshing(false);
    } else { setPullY(0); }
  }

  const skinLabels = profile?.skinType
    ? (Array.isArray(profile.skinType) ? profile.skinType : [profile.skinType]).join(", ")
    : "";
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingList, setTrendingList] = useState([]);
  const globalPostsRef = React.useRef([]);

  useEffect(() => {
    const ids = [...(profile?.following || []), user?.uid].filter(Boolean).slice(0, 10);
    console.log("[FeedPage] subscription effect — ids:", ids, "profile.following:", profile?.following);
    if (!ids.length) { console.warn("[FeedPage] no ids, skipping subscription"); setLoading(false); return; }
    let unsubFeed = () => {};
    try {
      const q = query(collection(db, "posts"), where("uid", "in", ids), orderBy("createdAt", "desc"), limit(30));
      unsubFeed = onSnapshot(q, snap => {
        console.log("[FeedPage] snapshot fired —", snap.docs.length, "raw docs");
        const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const FEED_TYPES = new Set(["brokeout", "wantToTry", "loved", "commented", "rated", "scan", "search"]);
        const realPosts = fetched.filter(post => FEED_TYPES.has(post.postType))
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        console.log("[FeedPage] realPosts after FEED_TYPES filter:", realPosts.length, realPosts.map(p => p.postType));
        if (realPosts.length === 0) {
          console.log("[FeedPage] no posts from subscription, falling back to getGlobalFeed");
          // No posts from user+following — fall back to global feed (same as monolith loadFeed behavior)
          getGlobalFeed().then(global => {
            const globalPosts = global.filter(post => FEED_TYPES.has(post.postType))
              .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
            console.log("[FeedPage] globalPosts:", globalPosts.length, globalPosts.map(p => p.postType));
            setPosts(globalPosts);
            setLoading(false);
          }).catch((e) => { console.error("[FeedPage] getGlobalFeed failed:", e); setLoading(false); });
        } else {
          setPosts(realPosts);
          setLoading(false);
        }
      }, err => { console.warn("feed subscription error:", err); setLoading(false); });
    } catch (e) { console.warn("feed subscribe failed:", e); setLoading(false); }

    getNotifications(user?.uid).then(setNotifs).catch(() => {});

    async function loadFriendRoutines() {
      const following = profile?.following || [];
      if (!following.length) return;
      try {
        const chunks = [];
        for (let i = 0; i < Math.min(following.length, 30); i += 10) chunks.push(following.slice(i, i + 10));
        const map = {};
        await Promise.all(chunks.map(async chunk => {
          const snap = await getDocs(query(collection(db, "users"), where("__name__", "in", chunk)));
          snap.docs.forEach(d => {
            const u = d.data(); const uid = d.id;
            (u.routine || []).forEach(productName => {
              if (!productName) return;
              const key = productName.toLowerCase().trim();
              if (!map[key]) map[key] = [];
              if (!map[key].find(f => f.uid === uid)) map[key].push({ displayName: u.displayName || "", photoURL: u.photoURL || "", uid, productName });
            });
          });
        }));
        setFeedFriendScans(map);
      } catch (e) {}
    }
    loadFriendRoutines();

    async function loadCommunityRoutineCounts() {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(50)));
        const counts = {};
        snap.docs.forEach(d => {
          const u = d.data();
          if (!u || !Array.isArray(u.routine)) return;
          const seen = new Set();
          u.routine.forEach(productName => {
            if (!productName) return;
            const key = productName.toLowerCase().trim();
            if (seen.has(key)) return;
            seen.add(key);
            counts[key] = (counts[key] || 0) + 1;
          });
        });
        setCommunityRoutineCounts(counts);
      } catch (e) { console.warn("[loadCommunityRoutineCounts] failed:", e?.message); }
    }
    loadCommunityRoutineCounts();

    return () => { try { unsubFeed(); } catch {} };
  }, [refreshKey, user?.uid, profile?.following?.length]);

  const MOCK_POSTS = [
    { id: "mock_01", uid: "seed_u01", displayName: "Cassidy Monroe", photoURL: "https://i.pravatar.cc/150?img=47", productName: "CeraVe Moisturizing Cream", brand: "CeraVe", poreScore: 3, productImage: "https://images.openfoodfacts.org/images/products/001/600/031/6210/front_en.5.400.jpg", communityRating: 9, postType: "loved", ingredients: "water, glycerin, cetearyl alcohol, ceramide np, ceramide ap, ceramide eop, cholesterol, sodium hyaluronate, niacinamide, panthenol, allantoin", flaggedIngredients: [], likes: ["seed_u02", "seed_u03", "seed_u04"], comments: [{ uid: "seed_u02", displayName: "Jenna Caldwell", photoURL: "https://i.pravatar.cc/150?img=49", text: "been using this for 3 years, never switching 💙" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 3600 } },
    { id: "mock_02", uid: "seed_u02", displayName: "Jenna Caldwell", photoURL: "https://i.pravatar.cc/150?img=49", productName: "The Ordinary Niacinamide 10%", brand: "The Ordinary", poreScore: 0, productImage: "https://theordinary.com/dw/image/v2/BGMS_PRD/on/demandware.static/-/Sites-deciem-master/default/dw0b0f0e6a/Images/products/The%20Ordinary/rdn-niacinamide-10pct-zinc-1pct-30ml.png", communityRating: 8, postType: "loved", ingredients: "aqua, niacinamide, pentylene glycol, zinc pca, sodium hyaluronate, tamarindus indica seed gum", flaggedIngredients: [], likes: ["seed_u01", "seed_u04", "seed_u05"], comments: [{ uid: "seed_u03", displayName: "Leila Ramos", photoURL: "https://i.pravatar.cc/150?img=32", text: "does this help with hormonal acne?" }, { uid: "seed_u01", displayName: "Cassidy Monroe", photoURL: "https://i.pravatar.cc/150?img=47", text: "yes!! my chin breakouts are so much better" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 7200 } },
    { id: "mock_03", uid: "seed_u03", displayName: "Leila Ramos", photoURL: "https://i.pravatar.cc/150?img=32", productName: "EltaMD UV Clear SPF 46", brand: "EltaMD", poreScore: 2, productImage: "https://eltamd.com/cdn/shop/products/UV-Clear-Broad-Spectrum-SPF-46-1.png", communityRating: 10, postType: "loved", ingredients: "zinc oxide 9.0%, niacinamide, hyaluronic acid, lactic acid, tocopheryl acetate, glycerin", flaggedIngredients: [], likes: ["seed_u01", "seed_u02", "seed_u05"], comments: [{ uid: "seed_u04", displayName: "Priya Nair", photoURL: "https://i.pravatar.cc/150?img=44", text: "my derm literally recommended this exact one 🙌" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 18000 } },
    { id: "mock_04", uid: "seed_u04", displayName: "Priya Nair", photoURL: "https://i.pravatar.cc/150?img=44", productName: "Cosrx Snail Mucin 96%", brand: "Cosrx", poreScore: 0, productImage: "https://www.cosrx.com/cdn/shop/files/advanced_snail_96_mucin_power_essence_100ml_1.jpg", communityRating: 9, postType: "loved", ingredients: "snail secretion filtrate 96.3%, betaine, sodium polyacrylate, hyaluronic acid, panthenol, allantoin", flaggedIngredients: [], likes: ["seed_u03", "seed_u06"], comments: [{ uid: "seed_u06", displayName: "Danielle Park", photoURL: "https://i.pravatar.cc/150?img=45", text: "my skin texture completely changed after using this 😭✨" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 28800 } },
    { id: "mock_05", uid: "seed_u05", displayName: "Brooke Sullivan", photoURL: "https://i.pravatar.cc/150?img=39", productName: "Paula's Choice BHA Exfoliant", brand: "Paula's Choice", poreScore: 0, productImage: "https://www.paulaschoice.com/dw/image/v2/BDRS_PRD/on/demandware.static/-/Sites-paula-choice-master/default/dw29f84f25/Images/2010/2010_large.jpg", communityRating: 8, postType: "loved", ingredients: "water, methylpropanediol, butylene glycol, salicylic acid, polysorbate 20, camellia oleifera leaf extract, allantoin", flaggedIngredients: [], likes: ["seed_u02", "seed_u04"], comments: [{ uid: "seed_u07", displayName: "Alexis Turner", photoURL: "https://i.pravatar.cc/150?img=38", text: "blackheads GONE after 2 weeks no joke" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 43200 } },
    { id: "mock_06", uid: "seed_u06", displayName: "Danielle Park", photoURL: "https://i.pravatar.cc/150?img=45", productName: "Laneige Lip Sleeping Mask", brand: "Laneige", poreScore: 4, productImage: "https://www.sephora.com/productimages/sku/s2153693-main-zoom.jpg", communityRating: 6, postType: "brokeout", ingredients: "polybutene, phytosteryl/octyldodecyl lauroyl glutamate, hydrogenated polyisobutene, dipentaerythrityl hexacaprylate, fragrance, tocopheryl acetate", flaggedIngredients: ["fragrance", "tocopheryl acetate"], likes: ["seed_u01", "seed_u03"], comments: [{ uid: "seed_u08", displayName: "Megan Foster", photoURL: "https://i.pravatar.cc/150?img=26", text: "ugh same, the fragrance got me around my mouth 😢" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 57600 } },
    { id: "mock_07", uid: "seed_u07", displayName: "Alexis Turner", photoURL: "https://i.pravatar.cc/150?img=38", productName: "Drunk Elephant Protini Polypeptide", brand: "Drunk Elephant", poreScore: 1, productImage: "https://www.sephora.com/productimages/sku/s2053919-main-zoom.jpg", communityRating: 8, postType: "wantToTry", ingredients: "water, glycerin, pentylene glycol, cetearyl alcohol, dimethicone, palmitoyl tripeptide-1, sodium hyaluronate, allantoin, panthenol", flaggedIngredients: [], likes: ["seed_u02", "seed_u05"], comments: [{ uid: "seed_u09", displayName: "Simone Okafor", photoURL: "https://i.pravatar.cc/150?img=29", text: "omg let me know when you try it! I've been eyeing this for months" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 72000 } },
    { id: "mock_08", uid: "seed_u08", displayName: "Megan Foster", photoURL: "https://i.pravatar.cc/150?img=26", productName: "Glow Recipe Watermelon Toner", brand: "Glow Recipe", poreScore: 1, productImage: "https://www.glowrecipe.com/cdn/shop/products/watermelon-glow-pha-bha-pore-tight-toner-glow-recipe-1.jpg", communityRating: 7, postType: "loved", ingredients: "water, citrullus lanatus fruit extract, glycerin, hyaluronic acid, niacinamide, aloe barbadensis leaf juice, sodium hyaluronate", flaggedIngredients: [], likes: ["seed_u03", "seed_u07"], comments: [{ uid: "seed_u10", displayName: "Taylor Nguyen", photoURL: "https://i.pravatar.cc/150?img=43", text: "just added this to my cart because of this post 😂" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 90000 } },
    { id: "mock_09", uid: "seed_u09", displayName: "Simone Okafor", photoURL: "https://i.pravatar.cc/150?img=29", productName: "Sunday Riley Good Genes", brand: "Sunday Riley", poreScore: 1, productImage: "https://sundayriley.com/cdn/shop/products/GoodGenes_1.7oz_Front_800x.jpg", communityRating: 9, postType: "loved", ingredients: "water, lactic acid, glycerin, aloe barbadensis leaf juice, sodium hydroxide, paeonia albiflora root extract, licorice root extract", flaggedIngredients: [], likes: ["seed_u01", "seed_u04", "seed_u06"], comments: [{ uid: "seed_u11", displayName: "Camille Petit", photoURL: "https://i.pravatar.cc/150?img=35", text: "my hyperpigmentation has literally never looked better 🙌" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 108000 } },
    { id: "mock_10", uid: "seed_u10", displayName: "Taylor Nguyen", photoURL: "https://i.pravatar.cc/150?img=43", productName: "La Roche-Posay Toleriane Cleanser", brand: "La Roche-Posay", poreScore: 0, productImage: "https://www.laroche-posay.us/dw/image/v2/AANG_PRD/on/demandware.static/-/Sites-lrp-master-catalog/default/toleriane-hydrating-gentle-cleanser-400ml.jpg", communityRating: 8, postType: "loved", ingredients: "aqua, glycerin, cocamidopropyl betaine, sodium lauroyl methyl isethionate, sodium chloride, citric acid, sodium benzoate", flaggedIngredients: [], likes: ["seed_u02", "seed_u05", "seed_u07"], comments: [{ uid: "seed_u12", displayName: "Naomi Whitfield", photoURL: "https://i.pravatar.cc/150?img=25", text: "sensitive skin girly approved ✅ my redness is so much calmer" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 129600 } },
    { id: "mock_11", uid: "seed_u11", displayName: "Camille Petit", photoURL: "https://i.pravatar.cc/150?img=35", productName: "Summer Fridays Jet Lag Mask", brand: "Summer Fridays", poreScore: 1, productImage: "https://summerfridays.com/cdn/shop/products/JetLagMask-2oz_1.jpg", communityRating: 8, postType: "loved", ingredients: "water, glycerin, niacinamide, squalane, centella asiatica extract, hyaluronic acid, oat extract, allantoin, ceramide np", flaggedIngredients: [], likes: ["seed_u01", "seed_u07", "seed_u09"], comments: [{ uid: "seed_u02", displayName: "Jenna Caldwell", photoURL: "https://i.pravatar.cc/150?img=49", text: "I use this before flights and land with glowing skin every time ✈️" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 151200 } },
    { id: "mock_12", uid: "seed_u12", displayName: "Naomi Whitfield", photoURL: "https://i.pravatar.cc/150?img=25", productName: "First Aid Beauty KP Bump Eraser", brand: "First Aid Beauty", poreScore: 1, productImage: "https://www.firstaidbeauty.com/cdn/shop/products/KP-Bump-Eraser-Body-Scrub-10-AHA_10oz.jpg", communityRating: 8, postType: "loved", ingredients: "water, glycolic acid, lactic acid, glycerin, urea, allantoin, aloe barbadensis leaf juice, salicylic acid", flaggedIngredients: [], likes: ["seed_u03", "seed_u06", "seed_u10"], comments: [{ uid: "seed_u07", displayName: "Alexis Turner", photoURL: "https://i.pravatar.cc/150?img=38", text: "been using this on my arms for a month and the texture is so smooth now" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 172800 } },
    { id: "mock_13", uid: "seed_u13", displayName: "Kavya Sharma", photoURL: "https://i.pravatar.cc/150?img=31", productName: "Kiehl's Ultra Facial Cream", brand: "Kiehl's", poreScore: 3, productImage: "https://www.kiehls.com/dw/image/v2/AAKG_PRD/on/demandware.static/-/Sites-kiehls-master-catalog/default/ultra-facial-cream-50ml.jpg", communityRating: 6, postType: "brokeout", ingredients: "water, glycerin, squalane, petrolatum, stearyl alcohol, avocado oil, tocopheryl acetate, glacial glycoprotein", flaggedIngredients: ["avocado oil", "tocopheryl acetate"], likes: ["seed_u04", "seed_u08"], comments: [{ uid: "seed_u05", displayName: "Brooke Sullivan", photoURL: "https://i.pravatar.cc/150?img=39", text: "same!! avocado oil is the worst for acne-prone skin 😤" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 194400 } },
    { id: "mock_14", uid: "seed_u14", displayName: "Riley Andrews", photoURL: "https://i.pravatar.cc/150?img=27", productName: "Tatcha The Water Cream", brand: "Tatcha", poreScore: 1, productImage: "https://www.tatcha.com/cdn/shop/products/TheWaterCream_1.7oz_Front.jpg", communityRating: 9, postType: "loved", ingredients: "water, glycerin, dimethicone, isononyl isononanoate, niacinamide, pentylene glycol, haematococcus pluvialis extract, sodium hyaluronate", flaggedIngredients: [], likes: ["seed_u01", "seed_u02", "seed_u04", "seed_u07"], comments: [{ uid: "seed_u03", displayName: "Leila Ramos", photoURL: "https://i.pravatar.cc/150?img=32", text: "splurged on this and honestly it's worth every penny 💸✨" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 216000 } },
    { id: "mock_15", uid: "seed_u15", displayName: "Ava Chen", photoURL: "https://i.pravatar.cc/150?img=48", productName: "Neutrogena Hydro Boost Gel", brand: "Neutrogena", poreScore: 1, productImage: "https://www.neutrogena.com/dw/image/v2/BBPF_PRD/on/demandware.static/-/Sites-neutrogena-master/default/Hydro-Boost-Water-Gel-1.7oz.jpg", communityRating: 7, postType: "wantToTry", ingredients: "water, dimethicone, glycerin, dimethicone/vinyl dimethicone crosspolymer, sodium hyaluronate, phenoxyethanol, carbomer, sodium hydroxide", flaggedIngredients: [], likes: ["seed_u03", "seed_u06", "seed_u10"], comments: [{ uid: "seed_u15", displayName: "Ava Chen", photoURL: "https://i.pravatar.cc/150?img=48", text: "the drugstore version of the Tatcha — adding to my list!" }], createdAt: { seconds: Math.floor(Date.now() / 1000) - 237600 } },
  ];

  async function openProductFromPost(post) {
    try {
      const q = query(collection(db, "products"),
        where("productName", "==", post.productName), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = { id: snap.docs[0].id, ...snap.docs[0].data() };
        const ingA = (p.ingredients || "").trim();
        const ingB = (post.ingredients || "").trim();
        const ing = ingA.length >= ingB.length ? (ingA || ingB) : (ingB || ingA);
        const liveScore = ing.length > 10
          ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
          : null;
        const computedScore = liveScore ?? p.poreScore ?? post.poreScore ?? 0;
        setSelectedProduct({
          productName: p.productName || post.productName,
          brand: p.brand || post.brand,
          image: p.adminImage || p.image || post.productImage || "",
          poreScore: computedScore,
          communityRating: p.communityRating || post.communityRating,
          ingredients: ing,
          flaggedIngredients: ing ? analyzeIngredients(ing).found : (post.flaggedIngredients || []),
          buyUrl: p.buyUrl || amazonUrl(post.productName, post.brand, post.barcode, post.asin, post.buyUrl),
        });
        return;
      }
    } catch (e) { /* fall through */ }
    const ing = (post.ingredients || "").trim();
    const liveScore = ing.length > 10
      ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
      : null;
    const pName = post.productName || post.name || "";
    setSelectedProduct({
      productName: pName, brand: post.brand,
      image: post.adminImage || post.image || post.productImage || "",
      poreScore: liveScore ?? post.poreScore ?? 0,
      communityRating: post.communityRating,
      ingredients: ing,
      flaggedIngredients: ing ? analyzeIngredients(ing).found : (post.flaggedIngredients || []),
      buyUrl: post.buyUrl || amazonUrl(pName, post.brand, post.barcode, post.asin, post.buyUrl),
    });
  }

  async function loadFeed() {
    setLoading(true);
    try {
      const [p, n] = await Promise.all([
        getFeed(profile?.following, user.uid),
        getNotifications(user.uid),
      ]);
      const realPosts = p.filter(post => post.postType && post.uid)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(realPosts);
      setNotifs(n);
    } catch (e) { console.error("loadFeed", e); }
    setLoading(false);
  }

  // Unified search: users + products simultaneously
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults({ users: [], products: [] }); setSearchOpen(false); return; }
    setSearchOpen(true);
    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [users, products] = await Promise.all([
          searchUsers(searchQ),
          searchProducts(searchQ).catch(() => []),
        ]);
        setSearchResults({ users: users.slice(0, 3), products: products.slice(0, 20) });
      } catch {}
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQ]);

  // Load suggested users to follow
  useEffect(() => {
    async function loadSuggested() {
      try {
        const snap = await getDocs(query(collection(db, "users"), limit(100)));
        const following = new Set(profile?.following || []);
        const myFollowing = profile?.following || [];
        const others = snap.docs
          .map(d => ({ uid: d.id, ...d.data() }))
          .filter(u => u.uid !== user.uid && !following.has(u.uid))
          .map(u => {
            const followerCount = (u.followers || []).length;
            const sharedConnections = (u.followers || []).filter(fid => myFollowing.includes(fid)).length;
            return { ...u, followerCount, sharedConnections };
          })
          .filter(u => u.sharedConnections > 0 || u.followerCount >= 10)
          .sort((a, b) => (b.sharedConnections - a.sharedConnections) || (b.followerCount - a.followerCount))
          .slice(0, 6);
        setSuggestedUsers(others);
      } catch {}
    }
    loadSuggested();
  }, [refreshKey]);

  // Build recommendations: community posts first, fall back to curated list
  useEffect(() => {
    async function loadRecs() {
      try {
        const followingIds = profile?.following || [];

        if (followingIds.length > 0) {
          const friendDocs = await Promise.all(
            followingIds.slice(0, 10).map(uid =>
              getDoc(doc(db, "users", uid)).then(d => d.exists() ? { uid: d.id, ...d.data() } : null).catch(() => null)
            )
          );
          const friends = friendDocs.filter(Boolean);

          const productCount = {};
          const productFriends = {};
          friends.forEach(f => {
            (f.routine || []).forEach(name => {
              const key = name.toLowerCase().trim();
              productCount[key] = (productCount[key] || 0) + 1;
              if (!productFriends[key]) productFriends[key] = [];
              productFriends[key].push(f.displayName || "Someone");
            });
          });

          const friendRecs = Object.entries(productCount)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([key, count]) => ({
              id: key,
              productName: key.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
              poreScore: 0,
              communityRating: null,
              image: null,
              friendCount: count,
              friendNames: productFriends[key],
            }));

          if (friendRecs.length >= 2) {
            setRecPosts(friendRecs);
            const allGlobal = await getGlobalFeed();
            const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
            const recent = allGlobal.filter(p => { const ts = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : 0; return ts > weekAgo; });
            if (recent.length) {
              const counted = {};
              recent.forEach(p => { if (!p.productName) return; const k = p.productName.toLowerCase(); if (!counted[k]) counted[k] = { productName: p.productName, brand: p.brand, poreScore: p.poreScore, communityRating: p.communityRating, image: p.productImage || p.image || "", scanCount: 0, likeCount: 0, postType: p.postType }; counted[k].scanCount++; counted[k].likeCount += (p.likes?.length || 0); });
              const top5 = Object.values(counted).sort((a, b) => (b.scanCount + b.likeCount) - (a.scanCount + a.likeCount)).slice(0, 5);
              if (top5.length) setTrendingList(top5);
            }
            return;
          }
        }

        const followPosts = await getFeed(followingIds, user.uid);
        const globalPosts = await getGlobalFeed();
        globalPostsRef.current = globalPosts;
        const allPosts = [...followPosts, ...globalPosts];
        const seen = new Set();
        const communityRecs = allPosts
          .filter(p => p.communityRating >= 7 && (p.poreScore ?? 5) <= 1 && p.productName)
          .filter(p => { const key = p.productName.toLowerCase(); if (seen.has(key)) return false; seen.add(key); return true; })
          .slice(0, 6);

        if (communityRecs.length >= 3) {
          setRecPosts(communityRecs);
        } else {
          const curated = await fetchCuratedRecs();
          const curatedNeeded = curated.filter(c => (c.poreScore ?? 99) <= 1 && !communityRecs.some(r => r.productName.toLowerCase() === c.productName.toLowerCase()));
          setRecPosts([...communityRecs, ...curatedNeeded].slice(0, 6));
        }

        const allGlobal = await getGlobalFeed();
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recent = allGlobal.filter(p => { const ts = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : 0; return ts > weekAgo; });
        if (recent.length) {
          const counted = {};
          recent.forEach(p => { if (!p.productName) return; const k = p.productName.toLowerCase(); if (!counted[k]) counted[k] = { productName: p.productName, brand: p.brand, poreScore: p.poreScore, communityRating: p.communityRating, image: p.productImage || p.image || "", scanCount: 0, likeCount: 0 }; counted[k].scanCount++; counted[k].likeCount += (p.likes?.length || 0); });
          const top5 = Object.values(counted).sort((a, b) => (b.scanCount + b.likeCount) - (a.scanCount + a.likeCount)).slice(0, 5);
          if (top5.length) setTrendingList(top5);
        }
      } catch {
        setRecPosts(CURATED_RECS_FALLBACK);
      }
    }
    loadRecs();
  }, [refreshKey, profile?.skinType, profile?.following]);

  const inp = { width: "100%", padding: "0.65rem 1rem", borderRadius: "0.65rem", border: `1px solid ${T.border}`, fontSize: "0.85rem", color: T.text, background: T.surface, outline: "none", fontFamily: "'Inter',sans-serif", transition: "border-color 0.15s" };

  return (
    <div
      ref={scrollRef}
      style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "6rem", overflowY: "auto", height: "100%" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullY > 5 || refreshing) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: `${refreshing ? 48 : Math.max(pullY * 0.85, 0)}px`, transition: refreshing ? "height 0.2s ease" : "height 0.12s", overflow: "hidden" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.25rem", opacity: Math.min((pullY / 45), 1), transition: "opacity 0.1s" }}>
            {refreshing ? (
              <div style={{ width: "22px", height: "22px", borderRadius: "50%", border: `2.5px solid ${T.accent}20`, borderTopColor: T.accent, animation: "ptrSpin 0.7s linear infinite" }} />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"
                style={{ transform: `rotate(${Math.min(pullY / 45 * 180, 180)}deg)`, transition: "transform 0.1s" }}>
                <polyline points="17 11 12 6 7 11" /><line x1="12" y1="6" x2="12" y2="18" />
              </svg>
            )}
            <span style={{ fontSize: "0.62rem", color: T.textLight, fontFamily: "'Inter',sans-serif", letterSpacing: "0.04em" }}>
              {refreshing ? "Refreshing…" : pullY > 45 ? "Release" : "Pull to refresh"}
            </span>
          </div>
        </div>
      )}
      {!embedded && <PageHero pageTitle="Feed" pageIcon={RalliIcons.community(T.textLight, 16)} fixed="Real people. Real skin. Real insights." />}
      <div style={{ padding: "0.85rem 1rem 0" }}>
        {/* Unified search — hidden when embedded */}
        {!embedded && (
          <div style={{ marginBottom: "1rem", position: "relative" }}>
            <div style={{ position: "relative" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                onFocus={() => searchQ.trim() && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                onKeyDown={e => { if (e.key === "Enter" && searchQ.trim()) { setSearchOpen(true); } }}
                placeholder="Search products, brands or people…"
                style={{ ...inp, paddingLeft: "2.25rem", paddingRight: searchQ ? "2.25rem" : "1rem" }}
                onFocusCapture={e => e.target.style.borderColor = T.accent}
                onBlurCapture={e => e.target.style.borderColor = T.border}
              />
              {searchQ && (
                <button onClick={() => { setSearchQ(""); setSearchResults({ users: [], products: [] }); setSearchOpen(false); }}
                  style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: "2px", color: T.textLight, display: "flex", alignItems: "center" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              )}
            </div>

            {/* Dropdown results */}
            {searchOpen && searchQ.trim() && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: T.surface, border: `1px solid ${T.border}`, borderRadius: "0.85rem", boxShadow: "0 8px 32px rgba(28,28,26,0.12)", zIndex: 50, overflow: "hidden", maxHeight: "70vh", overflowY: "auto" }}>
                {searchLoading && (
                  <div style={{ padding: "1rem", textAlign: "center", color: T.textLight, fontSize: "0.82rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite", flexShrink: 0 }} />
                    Searching 200k+ products…
                  </div>
                )}

                {!searchLoading && searchResults.users.length === 0 && searchResults.products.length === 0 && (
                  <div style={{ padding: "1rem" }}>
                    <div style={{ textAlign: "center", color: T.textLight, fontSize: "0.82rem", marginBottom: "0.75rem" }}>Not found in 200k+ products</div>
                    <button
                      onMouseDown={async () => {
                        try {
                          await addDoc(collection(db, "products"), {
                            productName: searchQ,
                            brand: "Unknown",
                            category: "other",
                            image: "",
                            buyUrl: "",
                            ingredients: "",
                            poreScore: 0,
                            scanCount: 0,
                            approved: false,
                            hidden: false,
                            isRequest: true,
                            requestedBy: user.uid,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            source: "user_request",
                          });
                          setSearchQ("");
                          setSearchOpen(false);
                          alert("✅ Request submitted! We'll add \"" + searchQ + "\" soon.");
                        } catch (e) {
                          alert("Could not submit request: " + e.message);
                        }
                      }}
                      style={{ width: "100%", padding: "0.65rem", background: T.accent + "18", border: `1.5px dashed ${T.accent}55`, borderRadius: "0.75rem", cursor: "pointer", fontFamily: "'Inter',sans-serif", fontSize: "0.8rem", fontWeight: "600", color: T.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                      <span style={{ fontSize: "1rem" }}>➕</span> Add "{searchQ}" manually
                    </button>
                    <div style={{ textAlign: "center", fontSize: "0.65rem", color: T.textLight, marginTop: "0.4rem" }}>Paste the ingredient list and we'll score it</div>
                  </div>
                )}

                {/* People section */}
                {!searchLoading && searchResults.users.length > 0 && (
                  <div>
                    <div style={{ padding: "0.5rem 1rem 0.25rem", fontSize: "0.62rem", color: T.textLight, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter',sans-serif" }}>People</div>
                    {searchResults.users.map((u, i) => (
                      <button key={u.uid} onMouseDown={() => { setSearchQ(""); setSearchOpen(false); onUserTap(u.uid); }}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.6rem 1rem", background: "none", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left" }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <Avatar photoURL={u.photoURL} name={u.displayName} size={32} />
                        <div>
                          <div style={{ fontSize: "0.83rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif" }}>{u.displayName}</div>
                          <div style={{ fontSize: "0.7rem", color: T.textLight }}>{(u.followers || []).length} followers</div>
                        </div>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ marginLeft: "auto", flexShrink: 0 }}><polyline points="9 18 15 12 9 6" /></svg>
                      </button>
                    ))}
                  </div>
                )}

                {/* Products section */}
                {!searchLoading && searchResults.products.length > 0 && (
                  <div>
                    <div style={{ padding: "0.5rem 1rem 0.25rem", fontSize: "0.62rem", color: T.textLight, fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter',sans-serif", borderTop: searchResults.users.length > 0 ? `1px solid ${T.border}` : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Products & Brands</span>
                    </div>
                    {searchResults.products.map((p, i) => {
                      const res = analyzeIngredients(p.ingredients || "");
                      const ps = poreStyle(res.avgScore || 0);
                      return (
                        <button key={p.code || i}
                          onMouseDown={() => {
                            setSearchQ(""); setSearchOpen(false);
                            setSelectedProduct({
                              id: p.code, productName: p.name, brand: p.brand,
                              image: p.image, poreScore: Math.round(res.avgScore || 0),
                              communityRating: null, ingredients: p.ingredients,
                              flaggedIngredients: [...(res.poreCloggers || res.found.filter(x => x.score >= 1) || []), ...(res.irritants || [])].sort((a, b) => b.score - a.score).slice(0, 6).map(x => x.name),
                            });
                          }}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 1rem", background: "none", border: "none", borderTop: `1px solid ${T.border}`, cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                          onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
                          onMouseLeave={e => e.currentTarget.style.background = "none"}>
                          <div style={{ width: "44px", height: "44px", borderRadius: "0.65rem", flexShrink: 0, overflow: "hidden", background: T.surfaceAlt }}>
                            <ProductImage src={p.image || null} name={p.name} brand={p.brand || ""} barcode={p.code || ""} size="full" />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</div>
                            {p.brand && <div style={{ fontSize: "0.72rem", color: T.textMid, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: "1px" }}>{p.brand.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}</div>}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.2rem", flexShrink: 0 }}>
                            <PoreScoreBadge score={res.avgScore != null ? Math.round(res.avgScore) : null} size="sm" />
                            {p.communityRating && <span style={{ fontSize: "0.5rem", color: T.textMid, fontWeight: "500" }}>⭐ {p.communityRating}/10</span>}
                            {p.scanCount > 0 && <span style={{ fontSize: "0.48rem", color: T.textLight }}>{p.scanCount} {p.scanCount === 1 ? "scan" : "scans"}</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdateProfile} onUserTap={onUserTap} />

        {loading
          ? <FeedSkeleton />
          : (() => {
              const friendCount = (profile?.following || []).length;
              const realPosts = posts.filter(p => !p.uid?.startsWith("seed_"));
              const hasFriendPosts = realPosts.length > 0;
              const recentNotifs = (notifs || []).filter(n => ["like", "comment", "follow"].includes(n.type)).slice(0, 5);
              const doFollow = async uid => { await followUser(user.uid, uid, profile?.displayName || "Someone", profile?.photoURL || ""); onUpdateProfile({ ...profile, following: [...(profile?.following || []), uid] }); };

              const FeedSectionLabel = ({ label, icon = null, color = T.textLight }) => (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.6rem", fontWeight: "700", color, textTransform: "uppercase", letterSpacing: "0.12em", padding: "1.1rem 1rem 0.5rem", fontFamily: "'Inter',sans-serif", borderLeft: `3px solid ${T.iceBlue}`, marginLeft: "0.5rem" }}>
                  {icon && icon}{label}
                </div>
              );

              const DiscoverCard = ({ label = "Suggested for you" }) => (
                <div style={{ marginBottom: "0.85rem" }}>
                  <div style={{ fontSize: "0.6rem", fontWeight: "600", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem", fontFamily: "'Inter',sans-serif" }}>{label}</div>
                  <ContactSuggestions currentUid={user.uid} currentProfile={profile} onFollow={doFollow} onUserTap={onUserTap} />
                </div>
              );

              const RecsCard = () => null;

              // -- FOR YOU TAB --
              if (tab === "forYou") {
                const seen = new Set();
                const allPosts = posts.filter(p => { const k = p.productName?.toLowerCase() || p.id; if (seen.has(k)) return false; seen.add(k); return true; })
                  .filter(p => ["loved", "brokeout", "wantToTry"].includes(p.postType))
                  .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

                const lovedPosts = allPosts.filter(p => p.postType === "loved");
                const warningPosts = allPosts.filter(p => p.postType === "brokeout");
                const watchingPosts = allPosts.filter(p => p.postType === "wantToTry");

                const mainFeed = [];
                let wi = 0, wai = 0;
                lovedPosts.forEach((p, i) => {
                  mainFeed.push(p);
                  if (i % 3 === 2 && wi < warningPosts.length) mainFeed.push(warningPosts[wi++]);
                });
                while (wi < warningPosts.length) mainFeed.push(warningPosts[wi++]);
                while (wai < watchingPosts.length) mainFeed.push(watchingPosts[wai++]);

                const displayFeed = mainFeed.length > 0 ? mainFeed : MOCK_POSTS;
                const isShowingMocks = mainFeed.length === 0;

                return (
                  <div style={{ paddingBottom: "1rem" }}>
                    {friendCount < 3 && (
                      <div style={{ margin: "0 1rem 1.25rem", padding: "0.85rem 1rem", background: `linear-gradient(135deg,${T.accent}10,${T.sage}08)`, borderRadius: "0.85rem", border: `1px solid ${T.border}`, display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <div style={{ fontSize: "1.4rem", flexShrink: 0 }}>👋</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.8rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", marginBottom: "2px" }}>Follow people to personalise your feed</div>
                          <div style={{ fontSize: "0.7rem", color: T.textLight, lineHeight: 1.4 }}>See what your circle is actually using</div>
                        </div>
                        <button onClick={() => onUpdateProfile({ _navigateTo: "profile_people" })} style={{ padding: "0.4rem 0.85rem", background: T.navy, color: "#fff", border: "none", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>Find People →</button>
                      </div>
                    )}

                    <TrendingSection
                      openProductFromPost={openProductFromPost}
                      trendingList={trendingList}
                      friendScans={feedFriendScans}
                      totalCommunityCounts={communityRoutineCounts}
                    />

                    {isShowingMocks && (
                      <div style={{ padding: "0 1rem 0.5rem", fontSize: "0.58rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter',sans-serif" }}>Community activity</div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0 0.75rem" }}>
                      {displayFeed.map((p, i) => (
                        <CardReveal key={p.id} delay={i * 30}>
                          <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName || ""} currentUserPhoto={profile?.photoURL || ""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap} />
                        </CardReveal>
                      ))}
                    </div>

                    {!isShowingMocks && (
                      <div style={{ margin: "1.5rem 1rem 0", padding: "1rem", background: T.surfaceAlt, borderRadius: "0.85rem", textAlign: "center" }}>
                        <div style={{ fontSize: "0.75rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", marginBottom: "0.25rem" }}>Find more Ralliers like you</div>
                        <div style={{ fontSize: "0.68rem", color: T.textLight, marginBottom: "0.75rem" }}>Follow people to see their real skincare routines</div>
                        <button onClick={() => onUpdateProfile({ _navigateTo: "profile_people" })} style={{ padding: "0.45rem 1.25rem", background: T.navy, color: "#fff", border: "none", borderRadius: "999px", fontSize: "0.75rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Find People</button>
                      </div>
                    )}
                  </div>
                );
              }

              // -- FOLLOWING TAB (empty state) --
              if (!hasFriendPosts) return (
                <div style={{ paddingBottom: "1rem" }}>
                  <div style={{ textAlign: "center", padding: "2rem 1rem 1.25rem" }}>
                    <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>✨</div>
                    <div style={{ fontSize: "0.9rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", marginBottom: "0.35rem" }}>Your following feed is empty</div>
                    <div style={{ fontSize: "0.75rem", color: T.textLight, lineHeight: 1.5, marginBottom: "1rem" }}>Follow people to see what they're actually using on their skin.</div>
                    <button onClick={() => onUpdateProfile({ _navigateTo: "profile_people" })} style={{ padding: "0.6rem 1.5rem", background: T.navy, color: "#fff", border: "none", borderRadius: "999px", fontSize: "0.8rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>Find People →</button>
                  </div>
                  <div style={{ padding: "0 1rem 0.5rem", fontSize: "0.58rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "'Inter',sans-serif" }}>What the community is using</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0 0.75rem" }}>
                    {(() => {
                      const realCommunityPosts = posts.filter(p => !p.uid?.startsWith("seed_") && p.uid && p.postType);
                      return realCommunityPosts.slice(0, 6).map((p, i) => (
                        <CardReveal key={p.id || p.uid + i} delay={i * 40}>
                          <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName || ""} currentUserPhoto={profile?.photoURL || ""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap} />
                        </CardReveal>
                      ));
                    })()}
                  </div>
                </div>
              );

              // -- Has real friend posts --
              const allFollowingPosts = realPosts.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

              return (
                <div style={{ paddingBottom: "1rem" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", padding: "0 0.75rem" }}>
                    {allFollowingPosts.map((p, i) => (
                      <CardReveal key={p.id} delay={i * 40}>
                        <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName || ""} currentUserPhoto={profile?.photoURL || ""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap} />
                      </CardReveal>
                    ))}
                  </div>
                  {friendCount < 8 && (
                    <div style={{ margin: "1.25rem 0.75rem 0", padding: "0.85rem 1rem", background: T.surfaceAlt, borderRadius: "0.85rem", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                      <div style={{ fontSize: "0.75rem", color: T.textMid, fontFamily: "'Inter',sans-serif", lineHeight: 1.4 }}>Follow more people to grow your feed</div>
                      <button onClick={() => onUpdateProfile({ _navigateTo: "profile_people" })} style={{ padding: "0.4rem 0.85rem", background: T.navy, color: "#fff", border: "none", borderRadius: "999px", fontSize: "0.72rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>Find People →</button>
                    </div>
                  )}
                </div>
              );
            })()
        }
      </div>
    </div>
  );
}
