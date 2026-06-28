import {
  getDocs, getDoc, doc, collection
} from "firebase/firestore";
import { AMAZON_AFFILIATE_TAG } from "../data/constants.js";
import { db, ANTHROPIC_KEY } from "../lib/firebase.js"
import { setCachedImage, imgCacheKey } from "../lib/imageUtils.js";
import { upsertProduct, recordScan } from "../lib/socialUtils.js";

export function getProductDisplayName(p) {
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

let _productCache = null

async function getProductCache() {
  if (_productCache) return _productCache;
  const snap = await getDocs(collection(db, "products"));
  _productCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  setTimeout(() => { _productCache = null; }, 5 * 60 * 1000);
  return _productCache;
}

export function amazonUrl(productName, brand, barcode, asin, existingBuyUrl) {
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
  const br   = (brand || "").trim();
  const q    = encodeURIComponent(br ? `${br} ${name}` : name);
  return `https://www.amazon.com/s?k=${q}&i=beauty${tag}`;
}

export function guessCategory(name) {
  const n = name.toLowerCase();
  if (/cleanser|wash|clean/.test(n)) return "face-wash";
  if (/moistur|cream|lotion|gel/.test(n)) return "moisturizer";
  if (/serum|essence/.test(n)) return "serum";
  if (/exfoliant|peel|aha|bha|glycolic|salicylic/.test(n)) return "exfoliant";
  if (/spf|sunscreen|sunscree|sun\s*block/.test(n)) return "spf";
  if (/eye/.test(n)) return "eye";
  if (/body|ointment|healing/.test(n)) return "body";
  if (/acne|spot|blemish/.test(n)) return "acne";
  if (/hair|scalp|shampoo|conditioner/.test(n)) return "hair";
  if (/foundation|concealer|blush|lip|makeup/.test(n)) return "makeup";
  return "other";
}

export async function getProductByBarcode(barcode) {
  if (!barcode) return null;
  try {
    const snap = await getDoc(doc(db, "products", barcode));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch { return null; }
}

export async function postScan(uid, displayName, photoURL, productName, brand, poreScore, communityRating, ingredients, found, postType = "search") {
  const stableId = "manual_" + (brand || "").toLowerCase().replace(/\s+/g, "_") + "_" + productName.toLowerCase().replace(/\s+/g, "_");
  await upsertProduct(stableId, { productName, brand, poreScore, ingredients, source: "scan" });
  return recordScan(uid, displayName, photoURL, stableId, productName, brand, poreScore, ingredients, found, communityRating, postType);
}

export async function searchProducts(searchTerm) {
  const q = searchTerm.toLowerCase().trim();
  if (!q) return [];

  const all = await getProductCache();
  const qt = q;

  const normalize = s => s.toLowerCase().replace(/['‘’]/g, "");
  const tokens = normalize(qt).split(/\s+/).filter(Boolean);

  return all
    .filter(p => {
      const imageUrl = p.image_url || p.adminImage || "";
      if (!imageUrl || !imageUrl.includes("cloudinary")) return false;
      const haystack = normalize(`${p.brand || ""} ${p.name || p.productName || ""}`);
      return tokens.every(t => haystack.includes(t));
    })
    .map(p => ({
      code:        p.id,
      name:        p.name  || p.productName || "",
      brand:       p.brand || "",
      image:       p.image_url || p.adminImage || "",
      ingredients: p.ingredients || "",
      poreScore:   p.poreScore ?? null,
      _productId:  p.id,
      _cached:     true,
      _approved:   true,
    }))
    .sort((a, b) => {
      const aExact = (a.name).toLowerCase().startsWith(qt) ? 0 : 1;
      const bExact = (b.name).toLowerCase().startsWith(qt) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      return (a.name).localeCompare(b.name);
    })
    .slice(0, 30);
}

export async function lookupBarcode(barcode) {
  // Source 1: Open Beauty Facts
  try {
    const res  = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    if (data.status === 1 && data.product?.product_name) {
      const ing   = data.product?.ingredients_text_en || data.product?.ingredients_text || "";
      const name  = data.product.product_name;
      const brand = data.product?.brands?.split(",")?.[0]?.trim() || "";
      const image = data.product?.image_front_url || data.product?.image_url || "";
      if (image) setCachedImage(imgCacheKey(brand, name), image);
      return { name, brand, ingredients: ing, image, hasIngredients: ing.trim().length > 10, source: "obf" };
    }
  } catch (e) { console.warn(`OBF failed: ${e.message}`); }

  // Source 2: UPC Item DB
  try {
    const res  = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, { signal: AbortSignal.timeout(6000) });
    const data = await res.json();
    const item = data.items?.[0];
    if (item?.title) {
      const name  = item.title;
      const brand = item.brand || "";
      const image = item.images?.[0] || "";
      return { name, brand, ingredients: "", image, hasIngredients: false, source: "upcitemdb" };
    }
  } catch (e) { console.warn(`UPCItemDB failed: ${e.message}`); }

  // Source 3: Go-UPC
  try {
    const res  = await fetch(`https://go-upc.com/api/v1/code/${barcode}?key=free`, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.product?.name) {
      const name  = data.product.name;
      const brand = data.product.brand || "";
      const image = data.product.imageUrl || "";
      return { name, brand, ingredients: "", image, hasIngredients: false, source: "goupc" };
    }
  } catch (e) { console.warn(`Go-UPC failed: ${e.message}`); }

  throw new Error("Product not found. Try photographing the ingredient list on the back of the packaging, or search by product name.");
}

export async function extractFromPhoto(b64, mime, mode = "auto") {
  if (!ANTHROPIC_KEY) throw new Error("No API key — photo scanning requires ANTHROPIC_KEY to be set in Vercel.");
  const prompts = {
    product:     "You are identifying a skincare product from a photo of its packaging (front of bottle, tube, or box).\nIdentify the brand and product name and respond in ONLY this format:\nPRODUCT:\nNAME:<exact product name>\nBRAND:<exact brand name>\n\nIf you cannot identify the product clearly, respond: UNCLEAR\nNo explanations. No markdown. Just the format above.",
    ingredients: "You are reading a skincare ingredient list from a photo of product packaging.\nExtract every ingredient exactly as written and respond in ONLY this format:\nINGREDIENTS:<comma-separated INCI ingredient names exactly as written>\n\nIf you cannot read the ingredient list clearly, respond: UNCLEAR\nNo explanations. No markdown. Just the format above.",
    auto:        "You are analysing a skincare product image. Look carefully and respond with ONLY one of these formats:\n1. If you see an ingredient list: INGREDIENTS:<comma-separated INCI ingredient names exactly as written>\n2. If you see the front of a product: PRODUCT:\nNAME:<product name>\nBRAND:<brand name>\n3. If you see both: NAME:<product name>\nBRAND:<brand name>\nINGREDIENTS:<comma-separated ingredients>\n4. If unclear: UNCLEAR\nNo explanations. No markdown. Just the format above.",
  };
  const res = await fetch("/api/anthropic", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5", max_tokens: 1200,
      messages: [{ role: "user", content: [
        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
        { type: "text",  text: prompts[mode] || prompts.auto },
      ] }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "AI could not process the image.");
  const text = data.content?.map(b => b.text || "").join("").trim();
  if (!text || text === "UNCLEAR") throw new Error("Image is unclear — try better lighting, move closer, or ensure the ingredient list is in focus.");
  return text;
}