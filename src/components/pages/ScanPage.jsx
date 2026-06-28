import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  getDocs, getDoc, doc, query, collection, where, orderBy, limit,
  updateDoc, setDoc, serverTimestamp, increment,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { T } from "../../data/tokens.js";
import { INGDB, INGDB_META } from "../../data/ingredients.js";
import { AMAZON_AFFILIATE_TAG, SKIN_TIPS } from "../../data/constants.js";
import { auth, db, storage, ANTHROPIC_KEY } from "../../lib/firebase.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { getProductImage, setCachedImage, imgCacheKey } from "../../lib/imageUtils.js";
import { upsertProduct, recordScan } from "../../lib/socialUtils.js";
import { useToast } from "../providers/ToastProvider.jsx";
import { useProductCache } from "../providers/ProductCacheProvider.jsx";
import { poreStyle, PoreScoreBadge } from "../shared/PoreScoreBadge.jsx";
import { ProductModal } from "../shared/ProductModal.jsx";
import { ProductImage } from "../ui/ProductImage.jsx";
import { GlossaryPage } from "./GlossaryPage.jsx";
import { AddProductModal } from "../ui/AddProductModal.jsx";

// ---------------------------------------------------------------------------
// Module-level helpers (ScanPage-only)
// ---------------------------------------------------------------------------

let _productCache = null;

async function getProductCache() {
  if (_productCache) return _productCache;
  const snap = await getDocs(collection(db, "products"));
  _productCache = snap.docs.map(d => ({ id: d.id, .../** @type {any} */(d.data()) }));
  setTimeout(() => { _productCache = null; }, 5 * 60 * 1000);
  return _productCache;
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
  const br   = (brand || "").trim();
  const q    = encodeURIComponent(br ? `${br} ${name}` : name);
  return `https://www.amazon.com/s?k=${q}&i=beauty${tag}`;
}

function guessCategory(name) {
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

async function getProductByBarcode(barcode) {
  if (!barcode) return null;
  try {
    const snap = await getDoc(doc(db, "products", barcode));
    if (snap.exists()) return { id: snap.id, .../** @type {any} */(snap.data()) };
    return null;
  } catch { return null; }
}

async function postScan(uid, displayName, photoURL, productName, brand, poreScore, communityRating, ingredients, found, postType = "search") {
  const stableId = "manual_" + (brand || "").toLowerCase().replace(/\s+/g, "_") + "_" + productName.toLowerCase().replace(/\s+/g, "_");
  await upsertProduct(stableId, { productName, brand, poreScore, ingredients, source: "scan" });
  return recordScan(uid, displayName, photoURL, stableId, productName, brand, poreScore, ingredients, found, communityRating, postType);
}

async function searchProducts(searchTerm) {
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

async function lookupBarcode(barcode) {
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

async function extractFromPhoto(b64, mime, mode = "auto") {
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

// Daily skin tip — cycles by day of year
const todayTip = SKIN_TIPS[Math.floor(Date.now() / 86400000) % SKIN_TIPS.length];

// ---------------------------------------------------------------------------
// Sub-components (ScanPage-only)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ScanPage
// ---------------------------------------------------------------------------

// NOTE: FeedPage is not yet extracted. Pass it as the `feedComponent` prop from
// the parent (AppInner / the monolith) until FeedPage has its own module.
export function ScanPage({ user, profile, onPosted, onUpdateProfile, onUserTap = () => {}, feedComponent = null }) {
  const [showGlossary, setShowGlossary]   = useState(false);
  const [inputMode, setInputMode]         = useState("camera");
  const [ingredients, setIngredients]     = useState("");
  const [productName, setProductName]     = useState("");
  const [brand, setBrand]                 = useState("");
  const [results, setResults]             = useState(null);
  const [communityRating, setCommunityRating] = useState(0);
  const [posting, setPosting]             = useState(false);
  const [posted, setPosted]               = useState(false);
  const [cameraMode, setCameraMode]       = useState("choose");
  const [cameraErr, setCameraErr]         = useState("");
  const [photoPreview, setPhotoPreview]   = useState(null);
  const [aiStatus, setAiStatus]           = useState("");
  const [searchQ, setSearchQ]             = useState("");
  const [searchRes, setSearchRes]         = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr]         = useState("");
  const [hasSearched, setHasSearched]     = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddModal, setShowAddModal]   = useState(false);
  const [addPrefillBarcode, setAddPrefillBarcode] = useState("");
  const [addPrefillName, setAddPrefillName]       = useState("");
  const [currentBarcode, setCurrentBarcode]       = useState("");
  const [postSource, setPostSource]   = useState("search"); // "scan" | "search" | "type"
  const [postReaction, setPostReaction] = useState("loved"); // "loved" | "brokeout" | "wantToTry"
  const [photoMode, setPhotoMode]     = useState("auto"); // "product" | "ingredients" | "auto"
  const photoRef = useRef(null);
  const camRef   = useRef(null);

  function reset() {
    setIngredients(""); setProductName(""); setBrand(""); setResults(null);
    setCommunityRating(0); setPosted(false); setPostReaction("loved");
    setCameraMode("choose"); setCameraErr(""); setPhotoPreview(null);
    setSearchQ(""); setSearchRes([]); setSearchErr(""); setHasSearched(false);
    setInputMode("type");
  }

  function switchTab(m) {
    setInputMode(m === "scan" ? "camera" : m);
    setResults(null); setCameraMode("choose"); setCameraErr(""); setPhotoPreview(null);
    if (m === "type")   setPostSource("type");
    if (m === "search") setPostSource("search");
  }

  function analyze() {
    if (!ingredients.trim()) return;
    const res = analyzeIngredients(ingredients);
    setResults(res);
  }

  async function handlePost() {
    if (!productName.trim() || !results) return;
    setPosting(true);
    const poreScore = Math.round(results?.avgScore || 0);
    const resolvedPostType = postReaction || (postSource === "scan" ? "scan" : "search");
    if (currentBarcode) {
      await recordScan(user.uid, profile.displayName, profile.photoURL || user.photoURL || "", currentBarcode, productName, brand, poreScore, ingredients, results.found, communityRating || null, resolvedPostType);
    } else {
      await postScan(user.uid, profile.displayName, profile.photoURL || user.photoURL || "", productName, brand, poreScore, null, ingredients, results.found, resolvedPostType);
    }
    setPosting(false); setPosted(true);
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    onPosted();
    setTimeout(reset, 1500);
  }

  async function onBarcode(code) {
    setCameraMode("processing"); setCameraErr("");
    console.info(`Barcode scanned: ${code}`);
    try {
      const existing = await getProductByBarcode(code);
      if (existing && existing.ingredients) {
        console.info(`Found in catalog: ${existing.productName}`);
        setIngredients(existing.ingredients || "");
        setProductName(existing.productName);
        setBrand(existing.brand || "");
        setCurrentBarcode(code);
        setPostSource("scan");
        const res = analyzeIngredients(existing.ingredients);
        setResults(res);
        setInputMode("type");
        setCameraMode("choose");
        return;
      }
      console.info(`Not in catalog — trying OBF for ${code}`);
      const p = await lookupBarcode(code);
      console.info(`OBF found: ${p.name} (ingredients: ${p.hasIngredients})`);
      setProductName(p.name); setBrand(p.brand);
      setCurrentBarcode(code);
      setPostSource("scan");
      let resolvedIngredients = "";
      if (p.hasIngredients) {
        resolvedIngredients = p.ingredients;
        setIngredients(p.ingredients);
        const res = analyzeIngredients(p.ingredients);
        setResults(res);
        setInputMode("type");
        setCameraMode("choose");
      } else {
        // Try OBF name search as a last attempt to find ingredients
        let ingFromSearch = "";
        try {
          const q = `${p.brand} ${p.name}`.trim();
          const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,ingredients_text,ingredients_text_en`, { signal: AbortSignal.timeout(5000) });
          const d = await r.json();
          ingFromSearch = d.products?.[0]?.ingredients_text_en || d.products?.[0]?.ingredients_text || "";
          if (ingFromSearch) console.info(`OBF name search found ingredients for ${p.name}`);
        } catch {}

        if (ingFromSearch.trim().length > 10) {
          resolvedIngredients = ingFromSearch;
          setIngredients(ingFromSearch);
          const res = analyzeIngredients(ingFromSearch);
          setResults(res);
          setInputMode("type");
          setCameraMode("choose");
        } else {
          setIngredients("");
          setInputMode("type");
          setCameraMode("choose");
          setCameraErr(`Found "${p.name}" but no ingredient list on file — photograph the ingredients label on the back to analyse it, or paste it below.`);
        }
      }
      upsertProduct(code, {
        productName: p.name, brand: p.brand,
        ingredients: resolvedIngredients,
        image: p.image || "",
        source: "obf-barcode-scan",
      }).catch(e => console.warn(`Upsert failed: ${e.message}`));
    } catch (e) {
      console.error(`Barcode lookup failed: ${e.message}`);
      setCameraMode("choose");
      if (e.message?.includes("not found") || e.message?.includes("Not found")) {
        setCameraErr("Product not found. Photograph the ingredient list on the back of the packaging, or search by name above.");
      } else {
        setCameraErr(e.message || "Something went wrong. Please try again.");
      }
    }
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setCameraErr(""); setPhotoPreview(URL.createObjectURL(file)); setCameraMode("processing");
    setAiStatus("Reading label…");
    console.info(`Photo: ${file.name} ${(file.size / 1024).toFixed(0)}kb ${file.type}`);
    if (!ANTHROPIC_KEY) console.error("No ANTHROPIC_KEY set — AI scan will fail");
    try {
      const b64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => {
          const result = r.result;
          if (typeof result !== "string") return rej(new Error("Unexpected file reader result"));
          res(result.split(",")[1]);
        };
        r.onerror = rej;
        r.readAsDataURL(file);
      });
      console.info("Sending image to Claude AI…");
      const result = await extractFromPhoto(b64, file.type, photoMode);
      console.info(`AI response: ${result.slice(0, 120)}`);
      if (result.startsWith("PRODUCT:")) {
        // Claude identified the product from its packaging — look it up
        const nameMatch  = result.match(/^NAME:(.+)$/m);
        const brandMatch = result.match(/^BRAND:(.+)$/m);
        const name  = nameMatch?.[1]?.trim() || "";
        const brand = brandMatch?.[1]?.trim() || "";
        if (name) {
          setProductName(name); setBrand(brand);
          setAiStatus("Finding product…");
          console.info(`Product identified: ${brand} ${name}`);
          try {
            const res = await searchProducts(`${brand} ${name}`);
            const match = res[0];
            if (match && match.ingredients) {
              setIngredients(match.ingredients);
              const r = analyzeIngredients(match.ingredients);
              setResults(r);
              console.info(`Found in catalog: ${match.name}`);
            } else {
              // Try OBF name search
              const r2 = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(`${brand} ${name}`)}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,code,ingredients_text,ingredients_text_en,image_front_small_url`, { signal: AbortSignal.timeout(5000) });
              const d2  = await r2.json();
              const hit = d2.products?.[0];
              const ing = hit?.ingredients_text_en || hit?.ingredients_text || "";
              if (ing.trim().length > 10) {
                setIngredients(ing);
                const r = analyzeIngredients(ing);
                setResults(r);
                console.info(`OBF found ingredients for ${name}`);
              } else {
                setCameraErr(`Found "${name}" but couldn't locate its ingredient list. Try photographing the ingredient label on the back instead.`);
              }
              const persistId = hit?.code || ("manual_" + (brand || "").toLowerCase().replace(/\s+/g, "_") + "_" + name.toLowerCase().replace(/\s+/g, "_"));
              upsertProduct(persistId, {
                productName: name, brand,
                ingredients: ing,
                image: hit?.image_front_small_url || "",
                source: "obf-photo-product",
              }).catch(e => console.warn(`Upsert failed: ${e.message}`));
            }
          } catch { setCameraErr(`Found "${name}" but the lookup failed. Try photographing the ingredient label on the back instead.`); }
        } else {
          setCameraErr("Couldn't identify the product clearly. Try better lighting or photograph the ingredient list on the back.");
        }
        setInputMode("type"); setCameraMode("choose"); setAiStatus("");
      } else if (result.startsWith("BARCODE:")) {
        setAiStatus("Found barcode — looking up product…");
        const bcode = result.replace("BARCODE:", "").trim();
        console.info(`Barcode from photo: ${bcode}`);
        const p = await lookupBarcode(bcode);
        console.info(`OBF: ${p.name} | ingredients: ${p.hasIngredients}`);
        setIngredients(p.ingredients || ""); setProductName(p.name); setBrand(p.brand);
        setCurrentBarcode(bcode);
        setPostSource("scan");
        if (p.hasIngredients) {
          setAiStatus("Analysing ingredients…");
          const res = analyzeIngredients(p.ingredients);
          setResults(res);
          console.info(`Score: ${Math.round(res.avgScore ?? 0)} | flagged: ${res.found?.length ?? 0}`);
        } else {
          setCameraErr(`Found "${p.name}" but no ingredient list on file — paste the ingredients below.`);
        }
        upsertProduct(bcode, {
          productName: p.name, brand: p.brand,
          ingredients: p.ingredients || "",
          image: p.image || "",
          source: "obf-photo-barcode",
        }).catch(e => console.warn(`Upsert failed: ${e.message}`));
      } else if (result.includes("INGREDIENTS:")) {
        const nameMatch  = result.match(/^NAME:(.+)$/m);
        const brandMatch = result.match(/^BRAND:(.+)$/m);
        const ingMatch   = result.match(/^INGREDIENTS:(.+)$/ms);
        const ingText    = ingMatch?.[1]?.trim() || "";
        if (nameMatch?.[1]) setProductName(nameMatch[1].trim());
        if (brandMatch?.[1]) setBrand(brandMatch[1].trim());
        if (ingText) {
          setIngredients(ingText);
          setAiStatus("Scoring ingredients…");
          const res = analyzeIngredients(ingText);
          setResults(res);
          console.info(`Structured: ${ingText.slice(0, 80)} | score: ${Math.round(res.avgScore ?? 0)}`);
        }
      } else {
        setIngredients(result);
        setAiStatus("Scoring ingredients…");
        const res = analyzeIngredients(result);
        setResults(res);
        console.info(`Plain ingredients: ${result.slice(0, 80)} | score: ${Math.round(res.avgScore ?? 0)}`);
      }
      setInputMode("type");
      setCameraMode("choose");
      setAiStatus("");
    } catch (e) {
      console.error(`Photo scan error: ${e.message}`);
      setAiStatus("");
      setCameraErr(e.message || "Couldn't read image. Try better lighting or move closer.");
      setCameraMode("choose");
      setPhotoPreview(null);
    }
  }

  async function doSearch() {
    if (!searchQ.trim()) return;
    setSearchLoading(true); setSearchErr(""); setSearchRes([]); setHasSearched(true);
    try {
      const res = await searchProducts(searchQ);
      setSearchRes(res);
      if (!res.length) setSearchErr("no_results");
    } catch { setSearchErr("Search failed."); }
    finally { setSearchLoading(false); }
  }

  function selectProduct(p) {
    const ingText  = p.ingredients || "";
    const analysis = ingText ? analyzeIngredients(ingText) : { found: [], avgScore: 0 };
    const fromCatalog = p.source === "catalog";
    setSelectedProduct({
      productName: p.name,
      brand: p.brand || "",
      image: p.adminImage || p.image || null,
      barcode: p.code || "",
      _productId: p._productId || p.code || "",
      id: p._productId || p.code || "",
      ingredients: ingText,
      skinTypes: p.skinTypes || [],
      description: p.description || "",
      flaggedIngredients: [...(analysis.poreCloggers || []), ...(analysis.irritants || [])],
      poreScore: ingText ? Math.round(analysis.avgScore ?? 0) : (p.poreScore ?? 0),
      communityRating: p.communityRating || null,
      buyUrl: p.buyUrl || amazonUrl(p.name, p.brand, p.code, p.asin, p.buyUrl),
      fromCatalog,
    });
    if (p._productId) { setCurrentBarcode(p._productId); setPostSource("search"); }
  }

  const Tab = ({ m, lbl }) => {
    const active = m === "scan" ? inputMode === "camera" : inputMode === m;
    return (
      <button onClick={() => switchTab(m)} style={{ flex: 1, padding: "0.55rem", background: active ? T.accent : "transparent", color: active ? "#FFFFFF" : T.textMid, border: `1px solid ${active ? T.accent : "transparent"}`, borderRadius: "0.4rem", fontSize: "0.78rem", fontFamily: "'Inter',sans-serif", cursor: "pointer", fontWeight: active ? "600" : "400", transition: "all 0.15s" }}>{lbl}</button>
    );
  };

  const inp = { width: "100%", padding: "0.75rem 1rem", borderRadius: "0.65rem", border: `1px solid ${T.border}`, fontSize: "0.85rem", color: T.text, background: "#FFFFFF", outline: "none", fontFamily: "'Inter',sans-serif", transition: "border-color 0.15s" };

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "6rem" }}>
      <div style={{ padding: "1rem" }}>

        <div style={{ background: T.surface, borderRadius: "1rem", border: `1px solid ${T.border}`, padding: "0.85rem", boxShadow: "0 2px 12px rgba(28,23,20,0.05)" }}>

          {/* -- Processing state -- */}
          {cameraMode === "processing" ? (
            <div style={{ textAlign: "center", padding: "1.5rem 1rem" }}>
              {photoPreview && <img src={photoPreview} alt="" style={{ width: "100%", maxHeight: "200px", objectFit: "cover", borderRadius: "0.75rem", marginBottom: "1rem", opacity: 0.85 }} />}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "0.6rem", background: T.accentSoft, padding: "0.65rem 1.1rem", borderRadius: "999px", marginBottom: "0.5rem" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: T.accent, animation: "pulse 1s ease-in-out infinite", flexShrink: 0 }} />
                <span style={{ color: T.accent, fontWeight: "600", fontFamily: "'Inter',sans-serif", fontSize: "0.85rem" }}>
                  {aiStatus || "Analysing with AI…"}
                </span>
              </div>
              <div style={{ fontSize: "0.68rem", color: T.textLight, marginTop: "0.35rem" }}>
                {aiStatus === "Scoring ingredients…" || aiStatus === "Analysing ingredients…" ? "Almost done — calculating your pore score"
                  : aiStatus === "Finding product…" ? "Searching our database and Open Beauty Facts"
                  : "Reading your photo with AI"}
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: "0.75rem" }}>

              {/* Hidden file inputs */}
              <input ref={camRef}   type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: "none" }} />
              <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} style={{ display: "none" }} />

              {/* Single-row scan bar: live search input + camera */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", marginBottom: "0.5rem" }}>
                <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" strokeLinecap="round" style={{ position: "absolute", left: "0.85rem", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  <input type="text" value={searchQ}
                    onFocus={e => { if (inputMode !== "search") setInputMode("search"); e.target.style.borderColor = T.accent; }}
                    onBlur={e => e.target.style.borderColor = T.border}
                    onChange={e => {
                      setSearchQ(e.target.value);
                      if (!e.target.value.trim()) {
                        setSearchRes([]); setHasSearched(false); setSearchErr("");
                      } else {
                        setSearchLoading(true);
                        const scanWindow = /** @type {Window & { _scanSearchTimer?: ReturnType<typeof setTimeout> }} */ (window);
                        clearTimeout(scanWindow._scanSearchTimer);
                        scanWindow._scanSearchTimer = setTimeout(async () => {
                          try {
                            const res = await searchProducts(e.target.value);
                            setSearchRes(res); setHasSearched(true);
                            if (!res.length) setSearchErr("no_results"); else setSearchErr("");
                          } catch { setSearchErr("Search failed."); }
                          setSearchLoading(false);
                        }, 350);
                      }
                    }}
                    onKeyDown={e => e.key === "Enter" && doSearch()}
                    placeholder="Search or scan a product…"
                    style={{ width: "100%", boxSizing: "border-box", padding: "0.7rem 0.95rem 0.7rem 2.4rem", background: T.surfaceAlt, border: `1px solid ${T.border}`, borderRadius: "0.85rem", fontSize: "0.88rem", color: T.text, fontFamily: "'Inter',sans-serif", outline: "none" }}
                  />
                  {searchQ && <button onClick={() => { setSearchQ(""); setSearchRes([]); setHasSearched(false); setSearchErr(""); }} style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.textLight, padding: "2px", display: "flex" }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
                </div>
                <button onClick={() => { setCameraErr(""); setPhotoMode("auto"); camRef.current?.click(); }}
                  aria-label="Take a photo"
                  style={{ flexShrink: 0, width: "48px", background: T.navy, border: "none", borderRadius: "0.85rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
                </button>
              </div>

              {/* Paste ingredients — secondary text link */}
              <button onClick={() => switchTab("type")}
                style={{ background: "none", border: "none", padding: "0.15rem 0.1rem", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "0.35rem", color: T.textMid, fontSize: "0.78rem", fontFamily: "'Inter',sans-serif" }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
                Paste an ingredient list instead
              </button>

              {cameraErr && <div style={{ padding: "0.65rem", background: "#FBF0EE", border: `1px solid ${T.rose}44`, borderRadius: "0.5rem", fontSize: "0.78rem", color: T.rose, fontFamily: "'Inter',sans-serif", marginTop: "0.5rem" }}>{cameraErr}</div>}
            </div>
          )}

          {/* Type tab */}
          {inputMode === "type" && (
            <div className="fu">
              <div style={{ fontSize: "0.75rem", color: T.textLight, marginBottom: "0.5rem", fontFamily: "'Inter',sans-serif", lineHeight: 1.5 }}>
                Copy the ingredient list from the product's packaging or brand website and paste it below.
              </div>
              <textarea value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="Water, Glycerin, Niacinamide, Cetearyl Alcohol…" rows={5}
                style={{ ...inp, resize: "vertical", lineHeight: "1.7" }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
              <button onClick={analyze} disabled={!ingredients.trim()} style={{ width: "100%", marginTop: "0.75rem", padding: "0.75rem", background: ingredients.trim() ? T.accent : T.surfaceAlt, color: ingredients.trim() ? "#FFFFFF" : T.textLight, border: "none", borderRadius: "0.65rem", fontSize: "0.85rem", fontWeight: "600", cursor: ingredients.trim() ? "pointer" : "not-allowed", fontFamily: "'Inter',sans-serif" }}>
                Analyze ingredients
              </button>
            </div>
          )}

          {/* Search tab */}
          {inputMode === "search" && (
            <div className="fu">
              {searchErr && searchErr !== "no_results" && <div style={{ padding: "0.65rem", background: "#FBF0EE", border: `1px solid ${T.rose}44`, borderRadius: "0.5rem", fontSize: "0.78rem", color: T.rose, marginBottom: "0.75rem" }}>{searchErr}</div>}
              {searchErr === "no_results" && (
                <div style={{ textAlign: "center", padding: "1.25rem 0.5rem" }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: "600", color: T.text, marginBottom: "0.3rem" }}>No products found</div>
                  <div style={{ fontSize: "0.78rem", color: T.textMid, marginBottom: "1rem", lineHeight: 1.5 }}>Be the first to add it — it'll be available for everyone instantly.</div>
                  <button onClick={() => { setAddPrefillName(searchQ); setShowAddModal(true); }}
                    style={{ padding: "0.65rem 1.4rem", background: T.accent, color: "#FFFFFF", border: "none", borderRadius: "0.65rem", fontSize: "0.85rem", fontWeight: "600", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
                    Add this product
                  </button>
                </div>
              )}
              {searchLoading && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", padding: "1.25rem", color: T.textLight, fontSize: "0.82rem" }}><div style={{ width: "14px", height: "14px", borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} /> Searching…</div>}
              {!searchLoading && searchRes.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {searchRes.map((p, i) => {
                    const res = analyzeIngredients(p.ingredients || "");
                    const ps  = poreStyle(res.avgScore || 0);
                    return (
                      <button key={p.code || i} onClick={() => selectProduct(p)}
                        style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.5rem", background: p._cached ? "rgba(44,122,92,0.03)" : "none", border: "none", borderBottom: i < searchRes.length - 1 ? `1px solid ${T.border}` : "none", cursor: "pointer", textAlign: "left", transition: "background 0.1s" }}
                        onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
                        onMouseLeave={e => e.currentTarget.style.background = "none"}>
                        <div style={{ width: "44px", height: "44px", borderRadius: "0.65rem", flexShrink: 0, overflow: "hidden", background: T.surfaceAlt }}>
                          <ProductImage src={p.image || null} name={p.name} brand={p.brand || ""} barcode={p.code || ""} size="full" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                          {p.brand && <div style={{ fontSize: "0.72rem", color: T.textMid, marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.brand}</div>}
                          {(p.communityRating || p.scanCount > 0) && <div style={{ fontSize: "0.62rem", color: T.textLight, marginTop: "1px" }}>
                            {p.communityRating ? `⭐ ${p.communityRating}/10` : ""}{p.scanCount > 0 ? ` · ${p.scanCount} scans` : ""}
                          </div>}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.25rem", flexShrink: 0 }}>
                          <PoreScoreBadge score={res.avgScore != null ? Math.round(res.avgScore) : null} size="sm" />
                          {/* ✓ In Ralli badge — commented out until approved field is added to product schema */}
                        </div>
                      </button>
                    );
                  })}
                  <button onClick={() => { setAddPrefillName(searchQ); setShowAddModal(true); }}
                    style={{ background: "transparent", border: "none", fontSize: "0.75rem", color: T.textLight, cursor: "pointer", fontFamily: "'Inter',sans-serif", textDecoration: "underline", padding: "0.75rem 0.5rem", textAlign: "left" }}>
                    Can't find your product? Add it
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {results && inputMode === "type" && (
            <div style={{ marginTop: "1.25rem", borderTop: `1px solid ${T.border}`, paddingTop: "1.25rem" }} className="fu">

              {/* Pore clog score */}
              <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.85rem", background: poreStyle(Math.round(results.avgScore || 0)).color + "12", borderRadius: "0.75rem", border: `1px solid ${poreStyle(Math.round(results.avgScore || 0)).color}25`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "0.6rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>Pore Clog Score</div>
                  <div style={{ fontSize: "0.82rem", fontWeight: "600", color: poreStyle(Math.round(results.avgScore || 0)).color, fontFamily: "'Inter',sans-serif" }}>{poreStyle(Math.round(results.avgScore || 0)).label}</div>
                </div>
                <PoreScoreBadge score={Math.round(results.avgScore || 0)} size="lg" />
              </div>

              {/* Flagged ingredients — detailed breakdown */}
              {results.found.length > 0 && (
                <>
                  {/* Pore-clogging ingredients */}
                  {results.poreCloggers?.length > 0 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.6rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", fontWeight: "700" }}>
                        {results.poreCloggers.length} pore-clogging ingredient{results.poreCloggers.length !== 1 ? "s" : ""} found
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {results.poreCloggers.sort((a, b) => b.score - a.score).map((ing, i) => {
                          const ps = poreStyle(ing.score);
                          return (
                            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.5rem 0.65rem", background: ps.color + "0e", borderRadius: "0.6rem", border: `1px solid ${ps.color}22` }}>
                              <div style={{ minWidth: "28px", height: "28px", borderRadius: "0.4rem", background: ps.color + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                <span style={{ fontSize: "0.75rem", fontWeight: "800", color: ps.color, lineHeight: 1 }}>{ing.score}</span>
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: "0.78rem", fontWeight: "700", color: T.text, textTransform: "capitalize", marginBottom: "1px" }}>{ing.name}</div>
                                <div style={{ fontSize: "0.68rem", color: T.textMid, lineHeight: 1.4 }}>{ing.note}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Irritants section */}
                  {results.irritants?.length > 0 && (
                    <div style={{ marginBottom: "0.75rem" }}>
                      <div style={{ fontSize: "0.6rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.5rem", fontWeight: "700" }}>
                        {results.irritants.length} irritant{results.irritants.length !== 1 ? "s" : ""} found
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                        {results.irritants.map((ing, i) => (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem", padding: "0.5rem 0.65rem", background: T.amber + "0d", borderRadius: "0.6rem", border: `1px solid ${T.amber}25` }}>
                            <div style={{ minWidth: "28px", height: "28px", borderRadius: "0.4rem", background: T.amber + "20", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <span style={{ fontSize: "0.8rem", lineHeight: 1 }}>⚠</span>
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: "700", color: T.text, textTransform: "capitalize", marginBottom: "1px" }}>{ing.name}</div>
                              <div style={{ fontSize: "0.68rem", color: T.textMid, lineHeight: 1.4 }}>{ing.note}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All clear */}
                  {(!results.poreCloggers?.length && !results.irritants?.length) && (
                    <div style={{ marginBottom: "0.75rem", padding: "0.6rem 0.85rem", background: T.sage + "10", borderRadius: "0.65rem", border: `1px solid ${T.sage}25`, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontSize: "1rem" }}>✓</span>
                      <div style={{ fontSize: "0.78rem", color: T.sage, fontWeight: "600" }}>No pore-clogging or irritating ingredients found</div>
                    </div>
                  )}
                </>
              )}

              {/* Product name — only needed to share */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="Product name (to share)" style={{ ...inp, flex: 1 }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
                <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Brand" style={{ ...inp, width: "110px" }} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
              </div>

              {/* Reaction type */}
              <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
                {[
                  { type: "loved",     label: "💖 Loved it",     color: T.sage  },
                  { type: "brokeout",  label: "⚠️ Broke me out", color: T.rose  },
                  { type: "wantToTry", label: "👀 Want to try",  color: T.amber },
                ].map(({ type, label, color }) => (
                  <button key={type} onClick={() => setPostReaction(type)}
                    style={{ flex: 1, padding: "0.5rem 0.25rem", background: postReaction === type ? color + "18" : "transparent", border: `1.5px solid ${postReaction === type ? color : T.border}`, borderRadius: "0.65rem", fontSize: "0.65rem", fontWeight: postReaction === type ? "700" : "500", color: postReaction === type ? color : T.textMid, cursor: "pointer", fontFamily: "'Inter',sans-serif", transition: "all 0.15s" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Post button */}
              {posted
                ? <div style={{ textAlign: "center", padding: "0.75rem", color: T.sage, fontFamily: "'Inter',sans-serif", fontWeight: "600", fontSize: "0.9rem", animation: "successPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2.5" style={{ animation: "successPop 0.45s 0.05s cubic-bezier(0.34,1.56,0.64,1) both" }}><polyline points="20 6 9 17 4 12" /></svg>
                    Posted to your feed!
                  </div>
                : <button onClick={handlePost} disabled={!productName.trim() || posting} style={{ width: "100%", padding: "0.85rem", background: productName.trim() ? T.accent : T.surfaceAlt, color: productName.trim() ? "#FAF8F5" : T.textLight, border: "none", borderRadius: "2rem", fontSize: "0.85rem", fontWeight: "500", cursor: productName.trim() ? "pointer" : "not-allowed", letterSpacing: "0.02em", fontFamily: "'Inter',sans-serif" }}>
                    {posting ? "Posting…" : "Share to feed"}
                  </button>
              }
              {!productName.trim() && <div style={{ textAlign: "center", fontSize: "0.72rem", color: T.textLight, marginTop: "0.4rem" }}>Add a product name to share to the feed</div>}
            </div>
          )}
        </div>

        {selectedProduct && (
          <ProductModal
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            user={user}
            profile={profile}
            onUpdateProfile={onUpdateProfile || (() => {})}
            onUserTap={onUserTap}
          />
        )}

        {showAddModal && (
          <AddProductModal
            user={user}
            prefillBarcode={addPrefillBarcode}
            prefillName={addPrefillName}
            onClose={() => { setShowAddModal(false); setAddPrefillBarcode(""); setAddPrefillName(""); }}
            onAdded={(p) => {
              setIngredients(p.ingredients);
              setProductName(p.productName);
              setBrand(p.brand);
              setInputMode("type");
              setShowAddModal(false);
              setAddPrefillBarcode("");
              setAddPrefillName("");
            }}
          />
        )}

        {/* Social feed — full For You / Following feed below the scan bar */}
        {feedComponent}

        {/* Glossary slide-up sheet */}
        {showGlossary && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
            <div onClick={() => setShowGlossary(false)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(15,25,35,0.35)", backdropFilter: "blur(2px)" }} />
            <div style={{ position: "relative", background: T.bg, borderRadius: "1.5rem 1.5rem 0 0", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}>
              <div style={{ position: "sticky", top: 0, background: T.bg, padding: "0.75rem 1.25rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${T.border}`, zIndex: 1 }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "1rem", color: T.text, letterSpacing: "-0.02em" }}>Ingredient Glossary</span>
                <button onClick={() => setShowGlossary(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.25rem", color: T.textLight }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>
              <div style={{ padding: "0 0 2rem" }}>
                <GlossaryPage />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
