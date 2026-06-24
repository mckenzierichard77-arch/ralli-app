import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

// Priority order: adminImage → image → productImage
// Filters out blob URLs, empty strings, and low-quality OBF images.
export function getProductImage(p) {
  if (!p) return "";
  const candidates = [p.adminImage, p.image, p.productImage];
  for (const raw of candidates) {
    const url = (raw || "").trim();
    if (!url) continue;
    if (!url.startsWith("http")) continue;
    if (url.includes("openbeautyfacts")) continue;
    return url;
  }
  return "";
}

// Validates that an image URL points to a known good image host.
export function hasValidImage(p) {
  const url = ((p.adminImage || p.image) || "").trim();
  if (!url || !url.startsWith("http")) return false;
  if (url.includes("media-amazon.com")) return false;
  if (url.includes("amazon.com/s?k=")) return false;
  if (url.includes("amazon.com/dp/")) return false;
  const goodDomains = ["sephora.com","ulta.com","openbeautyfacts.org","clearstem.com","cdn.shopify","images.ctfassets","cloudinary","imgix","akamaized","fastly","squarespace","wixstatic","theordinary.com","cerave.com","neutrogena.com","laroche-posay","skinstore.com","dermstore.com"];
  if (goodDomains.some(d => url.includes(d))) return true;
  if (/\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(url)) return true;
  return false;
}

export async function getCachedImage(key) {
  try {
    const snap = await getDoc(doc(db, "productImages", key));
    return snap.exists() ? snap.data().url : null;
  } catch { return null; }
}

export async function setCachedImage(key, url) {
  try { await setDoc(doc(db, "productImages", key), { url, updatedAt: serverTimestamp() }); } catch {}
}

export function imgCacheKey(brand, name) {
  return `${(brand||"").toLowerCase().replace(/\s+/g,"_")}|${(name||"").toLowerCase().replace(/\s+/g,"_")}`.slice(0,200);
}

// Tries: Firestore cache → Sephora API → ULTA API → Open Beauty Facts → null
export async function resolveProductImage(brand, name, barcode) {
  const key = imgCacheKey(brand, name);

  const cached = await getCachedImage(key);
  if (cached) return cached;

  const q = `${brand||""} ${name||""}`.trim();

  try {
    const workerUrl = `https://raspy-math-6c02ralli-image-proxy.mckenzierichard77.workers.dev?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand||"")}`;
    const r = await fetch(workerUrl, {signal:AbortSignal.timeout(8000)});
    const d = await r.json();
    if (d?.url && d.source === "sephora") { await setCachedImage(key, d.url); return d.url; }
  } catch {}

  try {
    const workerUrl = `https://raspy-math-6c02ralli-image-proxy.mckenzierichard77.workers.dev?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand||"")}`;
    const r = await fetch(workerUrl, {signal:AbortSignal.timeout(8000)});
    const d = await r.json();
    if (d?.url && d.source === "ulta") { await setCachedImage(key, d.url); return d.url; }
  } catch {}

  if (barcode && !/^seed_/.test(barcode)) {
    try {
      const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      const img = d?.product?.image_front_url || d?.product?.image_url || null;
      if (img) { await setCachedImage(key, img); return img; }
    } catch {}
    const b = barcode.replace(/\D/g,"");
    const path = b.length === 13 ? `${b.slice(0,3)}/${b.slice(3,6)}/${b.slice(6,9)}/${b.slice(9)}` : b;
    for (const rev of ["3","2","1"]) {
      const candidate = `https://images.openbeautyfacts.org/images/products/${path}/front_en.${rev}.full.jpg`;
      try {
        const probe = await fetch(candidate, { method: "HEAD", signal: AbortSignal.timeout(3000) });
        if (probe.ok) { await setCachedImage(key, candidate); return candidate; }
      } catch {}
    }
  }

  return null;
}
