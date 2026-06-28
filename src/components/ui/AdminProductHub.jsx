import React from 'react'

// ── Admin Products Tab ──────────────────────────────────────────────────────
// Simple product manager: filter, edit inline, export/upload CSV
export function AdminProductHub({ user } = {}) {
  const [products, setProducts]   = React.useState([]);
  const [loading, setLoading]     = React.useState(true);
  const [mode, setMode]           = React.useState("list"); // list | swipe | add
  const [filter, setFilter]       = React.useState("all");
  const [reviewerFilter, setReviewerFilter] = React.useState("all"); // "all" | "none" (not reviewed) | <tag>
  const [sort, setSort]           = React.useState("scans");
  const [search, setSearch]       = React.useState("");
  const [editing, setEditing]     = React.useState(null);
  const [saving, setSaving]       = React.useState(false);
  const [savedId, setSavedId]     = React.useState(null);
  const [uploadingImg, setUploadingImg] = React.useState(false);
  const [liveScore, setLiveScore] = React.useState(null);

  // VA Mode — defaults ON for VA users, OFF for founders.
  // When ON: hides power tools (seed, top 100, dupe finder, bulk delete, CSV import)
  // and surfaces a focused daily-queue panel at the top.
  const [vaMode, setVaMode] = React.useState(() => isVA(user));
  // Show/hide the "Advanced tools" expander inside VA mode (always collapsed by default).
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Seed clean brands
  const [seeding, setSeeding] = React.useState(false);
  const [seedResult, setSeedResult] = React.useState(null); // {added, skipped, total, examples}

  // Multi-select mode for bulk hide/delete
  const [selectMode, setSelectMode]   = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState(() => new Set());
  const [bulkBusy, setBulkBusy]       = React.useState(false);

  // Duplicate-finder mode
  const [dupeView, setDupeView]       = React.useState(false); // when true, list filters down to dupes only
  const [dupeGroups, setDupeGroups]   = React.useState([]);    // [{key, brand, name, products: [...]}]

  // Swipe mode
  const [swipeIdx, setSwipeIdx]   = React.useState(0);
  const [swipeFilter, setSwipeFilter] = React.useState("needswork"); // what to swipe through
  const [swipeSaving, setSwipeSaving] = React.useState(false);
  const [swipeEdit, setSwipeEdit] = React.useState(null);
  const [swipeLiveScore, setSwipeLiveScore] = React.useState(null);
  const swipeImgRef = React.useRef(null);

  // Add product mode
  const [addSearch, setAddSearch] = React.useState("");
  const [addForm, setAddForm]     = React.useState({ productName:"", brand:"", category:"", skinTypes:[], ingredients:"", buyUrl:"", reason:"" });
  const [addImg, setAddImg]       = React.useState(null); // {file, preview}
  const [addScore, setAddScore]   = React.useState(null);
  const [addSaving, setAddSaving] = React.useState(false);
  const [addDone, setAddDone]     = React.useState(false);
  const addImgRef = React.useRef(null);

  // CSV bulk import (Cowork-produced research)
  const [csvImporting, setCsvImporting] = React.useState(false);
  const [csvReview, setCsvReview]       = React.useState(null);  // {rows: [...], kind: 'ingredients'|'images'}
  const [csvApplying, setCsvApplying]   = React.useState(false);
  const [csvResult, setCsvResult]       = React.useState(null);  // {applied, skipped, errors}
  const csvFileRef = React.useRef(null);

  const imgInputRef = React.useRef(null);
  const [prefilling, setPrefilling] = React.useState(false);

  const CATEGORIES = ["Face Wash","Moisturiser","Serum","SPF","Toner","Eye Cream","Mask","Acne Treatment","Body","Hair","Lip"];
  const SKIN_TYPES = ["All","Oily","Dry","Sensitive","Combination","Normal","Acne-prone","Ageing","Dull","Hyperpigmentation"];

  React.useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "products"));
      // Always use d.id (Firestore doc ID) — never let document data override it
      setProducts(snap.docs.map(d => ({ ...d.data(), id: d.id })));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function runSeed() {
    if (seeding) return;
    if (!window.confirm(`Seed ~${CLEAN_BRANDS_SEED.length} clean-brand products into your catalog?\n\nDuplicates already in your database will be skipped automatically. New products land in the swipe queue with empty ingredients + image so you can fill them in.`)) return;
    setSeeding(true);
    setSeedResult(null);
    try {
      const result = await seedCleanBrands();
      setSeedResult(result);
      await load(); // refresh so the new products appear in counts + swipe queue
    } catch(e) {
      alert("Seed failed: " + e.message);
    }
    setSeeding(false);
  }

  // ── CSV bulk import (Cowork research → paste into admin) ──────────────
  // Expects a CSV with a header row. Detects ingredients CSV vs images CSV by columns.
  // Ingredients CSV columns:  product_name, brand, ingredients, source_url, confidence
  // Images CSV columns:       product_name, brand, image_url, source_page_url, dimensions
  function parseCsv(text) {
    // Minimal CSV parser that handles quoted fields containing commas.
    const rows = [];
    let row = [], field = "", inQuote = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], next = text[i+1];
      if (inQuote) {
        if (c === '"' && next === '"') { field += '"'; i++; }
        else if (c === '"') inQuote = false;
        else field += c;
      } else {
        if (c === '"') inQuote = true;
        else if (c === ',') { row.push(field); field = ""; }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ""; }
        else if (c === '\r') { /* skip */ }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    if (!rows.length) return { header: [], rows: [] };
    const header = rows[0].map(h => h.trim().toLowerCase());
    const data = rows.slice(1).filter(r => r.some(c => c.trim().length)).map(r => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
      return obj;
    });
    return { header, rows: data };
  }

  async function onCsvChosen(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setCsvImporting(true);
    setCsvResult(null);
    try {
      const text = await file.text();
      const { header, rows } = parseCsv(text);
      if (!rows.length) { alert("CSV has no data rows."); setCsvImporting(false); return; }

      // Detect kind
      const hasIng = header.includes("ingredients");
      const hasImg = header.includes("image_url");
      if (!hasIng && !hasImg) {
        alert("CSV must have either an 'ingredients' column or an 'image_url' column.\n\nColumns found: " + header.join(", "));
        setCsvImporting(false);
        return;
      }
      const kind = hasIng ? "ingredients" : "images";

      // Match each CSV row to a product in the catalog by brand+name (normalized)
      const norm = s => (s||"").toLowerCase().replace(/[^\w\s]/g,"").replace(/\s+/g," ").trim();
      const productLookup = new Map();
      products.forEach(p => {
        const key = `${norm(p.brand)}|${norm(p.productName)}`;
        if (key !== "|") productLookup.set(key, p);
      });

      const matched = rows.map((r, idx) => {
        const key = `${norm(r.brand)}|${norm(r.product_name)}`;
        const product = productLookup.get(key) || null;
        return {
          csvRow: idx + 2,  // human-friendly row number (header=1)
          brand: r.brand || "",
          productName: r.product_name || "",
          product,
          value: kind === "ingredients" ? (r.ingredients || "") : (r.image_url || ""),
          source: r.source_url || r.source_page_url || "",
          confidence: r.confidence || "",
          accepted: !!product,   // only auto-accept rows that matched a product
        };
      });

      setCsvReview({ kind, rows: matched });
    } catch(err) {
      alert("CSV parse failed: " + err.message);
    }
    setCsvImporting(false);
  }

  function toggleCsvRow(idx) {
    setCsvReview(cr => {
      if (!cr) return cr;
      const next = { ...cr, rows: cr.rows.map((r, i) => i === idx ? { ...r, accepted: !r.accepted } : r) };
      return next;
    });
  }

  async function applyCsvReview() {
    if (!csvReview) return;
    const toApply = csvReview.rows.filter(r => r.accepted && r.product);
    if (!toApply.length) { alert("No rows selected to apply."); return; }
    if (!window.confirm(`Apply ${toApply.length} ${csvReview.kind === "ingredients" ? "ingredient list(s)" : "image(s)"} to products?\n\nEach product will have its ${csvReview.kind === "ingredients" ? "ingredients" : "adminImage + image"} field updated and go into the review queue (pendingReview: true).`)) return;
    setCsvApplying(true);
    const result = { applied: 0, skipped: 0, errors: [] };
    for (const row of toApply) {
      try {
        const patch = { lastEnrichedAt: Date.now(), lastEnrichedBy: "csv-import", updatedAt: serverTimestamp(), pendingReview: true };
        if (csvReview.kind === "ingredients") {
          const cleaned = row.value.toLowerCase().trim().replace(/\s+/g," ").replace(/\s*,\s*/g,", ");
          if (cleaned.length < 10) { result.skipped++; continue; }
          patch.ingredients = cleaned;
        } else {
          if (!/^https?:\/\//.test(row.value)) { result.skipped++; continue; }
          patch.image = row.value;
          patch.adminImage = row.value;
        }
        await updateDoc(doc(db, "products", row.product.id), patch);
        result.applied++;
      } catch(e) {
        result.errors.push(`Row ${row.csvRow} (${row.brand} ${row.productName}): ${e.message}`);
      }
    }
    setCsvApplying(false);
    setCsvResult(result);
    setCsvReview(null);
    await load();
  }

  // ── Multi-select bulk actions ─────────────────────────────────────────
  function toggleSelected(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function selectAllVisible(ids) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(id));
      return next;
    });
  }
  function clearSelection() {
    setSelectedIds(new Set());
  }
  function exitSelectMode() {
    setSelectMode(false);
    clearSelection();
    setDupeView(false);
    setDupeGroups([]);
  }

  async function bulkHide() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Hide ${ids.length} product${ids.length===1?"":"s"}?\n\nHidden products stay in your database and can be un-hidden later — they just won't show up in the app.`)) return;
    setBulkBusy(true);
    try {
      // Firestore batch limit = 500 — chunk to be safe
      const CHUNK = 400;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(id => batch.update(doc(db, "products", id), { hidden: true, approved: false, updatedAt: Date.now() }));
        await batch.commit();
      }
      // Reflect locally without a full reload
      setProducts(ps => ps.map(p => ids.includes(p.id) ? { ...p, hidden: true, approved: false } : p));
      exitSelectMode();
    } catch(e) {
      alert("Bulk hide failed: " + e.message);
    }
    setBulkBusy(false);
  }

  async function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`PERMANENTLY DELETE ${ids.length} product${ids.length===1?"":"s"}?\n\nThis cannot be undone. If you might want them back later, use Hide instead.`)) return;
    if (ids.length >= 25 && !window.confirm(`Just to be sure — you're about to delete ${ids.length} products. Continue?`)) return;
    setBulkBusy(true);
    try {
      const CHUNK = 400;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(id => batch.delete(doc(db, "products", id)));
        await batch.commit();
      }
      setProducts(ps => ps.filter(p => !ids.includes(p.id)));
      exitSelectMode();
    } catch(e) {
      alert("Bulk delete failed: " + e.message);
    }
    setBulkBusy(false);
  }

  async function bulkUnhide() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Unhide ${ids.length} product${ids.length===1?"":"s"}?\n\nThey'll reappear in the main catalog. You may still need to approve them individually if they were never approved.`)) return;
    setBulkBusy(true);
    try {
      const CHUNK = 400;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(id => batch.update(doc(db, "products", id), { hidden: false, updatedAt: Date.now() }));
        await batch.commit();
      }
      setProducts(ps => ps.map(p => ids.includes(p.id) ? { ...p, hidden: false } : p));
      exitSelectMode();
    } catch(e) {
      alert("Bulk unhide failed: " + e.message);
    }
    setBulkBusy(false);
  }

  // ── Duplicate finder ──────────────────────────────────────────────────
  // Groups products by normalized brand+name. Any group with 2+ entries is a duplicate set.
  // Within each group we suggest a "keep" (highest score: has admin image > has ingredients > scan count > newer)
  // and the rest become preselected for hide/delete.
  function findDuplicates() {
    const groups = new Map();
    products.forEach(p => {
      const key = _normProductKey(p.brand, p.productName);
      if (!key || key === "|") return; // skip products with no brand+name
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    const dupes = [];
    groups.forEach((arr, key) => {
      if (arr.length < 2) return;
      // Score each: prioritize the one most worth keeping
      const scored = arr.map(p => ({
        p,
        score: (
          (p.adminImage && p.adminImage.length > 8 ? 1000 : 0) +
          (p.image && p.image.length > 8 && !p.image.includes("openbeautyfacts") ? 500 : 0) +
          ((p.ingredients||"").trim().length > 10 ? 250 : 0) +
          (p.approved ? 100 : 0) +
          (p.scanCount || 0) * 5 +
          (p.communityRating ? 50 : 0)
        ),
      }));
      scored.sort((a, b) => b.score - a.score);
      dupes.push({
        key,
        brand: arr[0].brand || "(no brand)",
        name: arr[0].productName || "(no name)",
        keep: scored[0].p,
        drop: scored.slice(1).map(s => s.p),
        all: scored.map(s => s.p),
      });
    });
    // Sort: groups with most duplicates first, then alpha
    dupes.sort((a, b) => (b.all.length - a.all.length) || a.brand.localeCompare(b.brand));
    setDupeGroups(dupes);
    setDupeView(true);
    // Preselect all "drop" candidates so user can one-tap Hide/Delete
    const preselect = new Set();
    dupes.forEach(g => g.drop.forEach(p => preselect.add(p.id)));
    setSelectedIds(preselect);
    setSelectMode(true);
  }

  function exitDupeView() {
    setDupeView(false);
    setDupeGroups([]);
    exitSelectMode();
  }

  // ── Featured-on-Explore bulk actions ──────────────────────────────────
  // Flips `featuredOnExplore` on selected products. Featured products show up
  // in the "What We're Loving" section on the Explore page.
  async function bulkFeature(featured) {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    const verb = featured ? "Feature" : "Unfeature";
    if (!window.confirm(`${verb} ${ids.length} product${ids.length===1?"":"s"} on Explore?`)) return;
    setBulkBusy(true);
    try {
      const CHUNK = 400;
      // For new featured items, assign incremental order based on what's already featured
      let nextOrder = featured
        ? products.filter(p => p.featuredOnExplore).reduce((m, p) => Math.max(m, p.featuredOrder ?? 0), -1) + 1
        : 0;
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          const update = { featuredOnExplore: featured, updatedAt: Date.now() };
          if (featured) update.featuredOrder = nextOrder++;
          batch.update(doc(db, "products", id), update);
        });
        await batch.commit();
      }
      // Reflect locally
      setProducts(ps => ps.map(p => {
        if (!ids.includes(p.id)) return p;
        const update = { featuredOnExplore: featured };
        if (featured) {
          // assign a sequential order; recalc based on current featured count
          update.featuredOrder = (ps.filter(x => x.featuredOnExplore).length);
        }
        return { ...p, ...update };
      }));
      exitSelectMode();
    } catch(e) {
      alert(`${verb} failed: ` + e.message);
    }
    setBulkBusy(false);
  }

  // ── Top 100 auto-feature ─────────────────────────────────────────────
  // Picks the 100 best products: prioritizes complete data (image + ingredients),
  // low pore score, high community rating, high scan count.
  async function runTop100() {
    if (!window.confirm("Auto-feature the top 100 products on Explore?\n\nThis ranks every product in your catalog by quality (data completeness + pore score + community rating + scans), then marks the top 100 as Featured. Any products currently featured will be UN-featured if they're not in the new top 100.")) return;
    setBulkBusy(true);
    try {
      // Score every product
      const hasCleanImg = p => { const u=(p.adminImage||p.image||"").trim(); return u.length>8 && !u.includes("openbeautyfacts") && !u.startsWith("blob:"); };
      const hasIngredients = p => (p.ingredients||"").trim().length > 10;

      const ranked = products
        .filter(p => !p.hidden) // never feature hidden products
        .map(p => {
          const imgOk = hasCleanImg(p);
          const ingOk = hasIngredients(p);
          // Composite score (higher = better)
          const score =
            (imgOk ? 1000 : 0) +                                          // must-have: real image
            (ingOk ? 800 : 0) +                                            // must-have: ingredients
            (p.approved ? 200 : 0) +                                       // admin-approved bonus
            (Math.max(0, 5 - (p.poreScore ?? 5))) * 100 +                  // lower pore score = better (0=best=500pts)
            ((p.communityRating ?? 0) * 30) +                              // community rating 0-10 → 0-300
            Math.min((p.scanCount ?? 0) * 2, 200) +                        // scan popularity, capped
            (p.featuredOnExplore ? 25 : 0);                                // small tiebreaker for currently-featured
          return { p, score, imgOk, ingOk };
        })
        // Filter out products that are missing both image and ingredients — won't render well
        .filter(x => x.imgOk || x.ingOk)
        .sort((a, b) => b.score - a.score);

      const top100 = ranked.slice(0, 100).map(x => x.p);
      const top100Ids = new Set(top100.map(p => p.id));
      const currentlyFeatured = products.filter(p => p.featuredOnExplore);
      const toUnfeature = currentlyFeatured.filter(p => !top100Ids.has(p.id));

      // Batch the updates
      const CHUNK = 400;
      const allUpdates = [
        ...top100.map((p, idx) => ({ id: p.id, update: { featuredOnExplore: true, featuredOrder: idx, updatedAt: Date.now() } })),
        ...toUnfeature.map(p => ({ id: p.id, update: { featuredOnExplore: false, featuredOrder: 0, updatedAt: Date.now() } })),
      ];
      for (let i = 0; i < allUpdates.length; i += CHUNK) {
        const chunk = allUpdates.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(({ id, update }) => batch.update(doc(db, "products", id), update));
        await batch.commit();
      }

      // Reflect locally
      const updateMap = new Map(allUpdates.map(u => [u.id, u.update]));
      setProducts(ps => ps.map(p => updateMap.has(p.id) ? { ...p, ...updateMap.get(p.id) } : p));

      alert(`✓ Top 100 done\n\n${top100.length} products featured · ${toUnfeature.length} unfeatured\n\nThey'll show up in the "What We're Loving" section on the Explore page.`);
    } catch(e) {
      alert("Top 100 failed: " + e.message);
    }
    setBulkBusy(false);
  }

  // ── Catalog cleanup: strip duplicated brand prefix from product names ─────
  // Walks every product, runs stripBrandFromName(brand, name) and writes only
  // the ones that actually change. Shows a preview first.
  async function runStripBrandFromNames() {
    if (bulkBusy) return;
    // First pass — find candidates without writing anything
    const candidates = products
      .map(p => ({ p, newName: stripBrandFromName(p.brand, p.productName) }))
      .filter(({ p, newName }) => newName !== (p.productName||"").trim() && newName.length >= 3);

    if (candidates.length === 0) {
      alert("✓ No duplicate brand prefixes found — your product names are already clean.");
      return;
    }

    // Show a preview of the first few changes
    const previewLines = candidates.slice(0, 10).map(({ p, newName }) =>
      `  ${p.brand} — "${p.productName}" → "${newName}"`
    ).join("\n");
    const more = candidates.length > 10 ? `\n  …and ${candidates.length - 10} more` : "";

    if (!window.confirm(
      `Strip duplicated brand prefix from ${candidates.length} product name${candidates.length===1?"":"s"}?\n\nPreview:\n${previewLines}${more}\n\nThis only changes the productName field. Brand stays the same. Cannot be undone.`
    )) return;

    setBulkBusy(true);
    try {
      const CHUNK = 400;
      const editor = enrichedByTag(auth.currentUser);
      for (let i = 0; i < candidates.length; i += CHUNK) {
        const chunk = candidates.slice(i, i + CHUNK);
        const batch = writeBatch(db);
        chunk.forEach(({ p, newName }) => {
          batch.update(doc(db, "products", p.id), {
            productName: newName,
            updatedAt: Date.now(),
            // Don't update lastEnrichedBy — this isn't a content review, just a name fix
            lastNameCleanedAt: Date.now(),
            lastNameCleanedBy: editor,
          });
        });
        await batch.commit();
      }
      // Reflect locally
      const map = new Map(candidates.map(({ p, newName }) => [p.id, newName]));
      setProducts(ps => ps.map(p => map.has(p.id) ? { ...p, productName: map.get(p.id) } : p));
      alert(`✓ Cleaned ${candidates.length} product name${candidates.length===1?"":"s"}.`);
    } catch(e) {
      alert("Name cleanup failed: " + e.message);
    }
    setBulkBusy(false);
  }

  const hasImg = p => { const u=(p.adminImage||p.image||"").trim(); return u.length>8&&!u.includes("openbeautyfacts")&&!u.startsWith("blob:"); };
  const hasIng = p => (p.ingredients||"").trim().length > 10;
  // Newer completeness checks — a row "needs work" when any of these is missing.
  const hasSkin = p => Array.isArray(p.skinTypes) ? p.skinTypes.length > 0 : (p.skinTypes||"").trim().length > 0;
  const hasCategory = p => (p.category||"").trim().length > 0;
  const hasBuyUrl = p => /^https?:\/\//.test((p.buyUrl||"").trim());
  // A product is "complete" only when all five fields are present.
  const isComplete = p => hasImg(p) && hasIng(p) && hasSkin(p) && hasCategory(p) && hasBuyUrl(p);
  // What's missing on this product? Returns an array of short labels for UI badges.
  const missingFields = p => {
    const out = [];
    if (!hasImg(p))      out.push("img");
    if (!hasIng(p))      out.push("ing");
    if (!hasSkin(p))     out.push("skin");
    if (!hasCategory(p)) out.push("cat");
    if (!hasBuyUrl(p))   out.push("buy");
    return out;
  };

  // prefillProduct — defined here inside AdminProductHub so it uses the right setPrefilling
  async function prefillProductAdmin(p) {
    const originalId = p.id;
    setPrefilling(true);
    const result = { ...p };
    const q = encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim());
    result.buyUrl = result.buyUrl || `https://www.amazon.com/s?k=${q}&i=beauty&tag=ralliapp-20`;
    result.googleSearch = `https://www.google.com/search?q=${encodeURIComponent((p.brand||"")+" "+(p.productName||"")+" ingredients site:incidecoder.com OR site:sephora.com")}`;
    result.inciSearch = `https://incidecoder.com/search?query=${encodeURIComponent((p.brand||"")+" "+(p.productName||""))}`;
    if (!(result.ingredients||"").trim()) {
      try {
        if (p.barcode && !/^seed_/.test(p.barcode)) {
          const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${p.barcode}.json`,{signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          if (d.status===1) { const ing=d.product?.ingredients_text_en||d.product?.ingredients_text||""; if(ing.length>10) result.ingredients=ing; }
        }
        if (!result.ingredients) {
          const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(`${p.brand||""} ${p.productName||""}`)}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,ingredients_text,ingredients_text_en`,{signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          const brandLow=(p.brand||"").toLowerCase().split(" ")[0];
          const hit=(d.products||[]).find(x=>(x.brands||"").toLowerCase().includes(brandLow))||(d.products||[])[0];
          const ing=hit?.ingredients_text_en||hit?.ingredients_text||"";
          if(ing.length>10) result.ingredients=ing;
        }
      } catch(e) { console.warn("OBF",e); }
    }
    setPrefilling(false);
    result.id = originalId; // always restore original Firestore ID
    return result;
  }

  // When in dupeView, only show products that are part of a duplicate group.
  // We also flatten the dupe groups into a single list so the user sees them grouped visually below.
  const dupeIdSet = React.useMemo(() => {
    const s = new Set();
    dupeGroups.forEach(g => g.all.forEach(p => s.add(p.id)));
    return s;
  }, [dupeGroups]);

  // Editor identity — used to power the "👤 Mine" filter and the "edited by you"
  // counter in Today's Queue.
  const myTag = enrichedByTag(auth.currentUser);
  const myEditCount = products.filter(p => p.lastEnrichedBy === myTag).length;
  // Today only — for the daily progress display in Today's Queue.
  const _startOfToday = (() => { const d=new Date(); d.setHours(0,0,0,0); return d.getTime(); })();
  const myEditCountToday = products.filter(p => p.lastEnrichedBy === myTag && (p.lastEnrichedAt||0) >= _startOfToday).length;

  const filtered = products
    .filter(p => dupeView ? dupeIdSet.has(p.id) : true)
    .filter(p => {
      if (dupeView) return true; // skip status filters in dupe view
      // Hidden filter: dedicated bucket for hidden products
      if (filter==="hidden")        return !!p.hidden;
      // Every other filter excludes hidden products by default — they only show in the "hidden" view
      if (p.hidden) return false;
      if (filter==="mine")          return p.lastEnrichedBy === myTag;
      if (filter==="featured")      return !!p.featuredOnExplore;
      if (filter==="enriched")      return !!p.lastEnrichedAt;
      if (filter==="unchecked")     return !p.lastEnrichedAt;
      if (filter==="noimage")       return !hasImg(p);
      if (filter==="noingredients") return !hasIng(p);
      if (filter==="noskin")        return !hasSkin(p);
      if (filter==="nocategory")    return !hasCategory(p);
      if (filter==="nobuy")         return !hasBuyUrl(p);
      if (filter==="both")          return !hasImg(p)&&!hasIng(p);  // legacy
      if (filter==="needswork")     return !isComplete(p);
      if (filter==="ready")         return isComplete(p);
      return true;
    })
    .filter(p => {
      // Reviewer filter — independent of the main "filter" state.
      if (reviewerFilter === "all") return true;
      if (reviewerFilter === "none") return !p.lastEnrichedBy;
      return p.lastEnrichedBy === reviewerFilter;
    })
    .filter(p => { if(!search.trim()) return true; const q=search.toLowerCase(); return (p.productName||"").toLowerCase().includes(q)||(p.brand||"").toLowerCase().includes(q); })
    .sort((a,b) => {
      if (dupeView) {
        // Group dupes together: sort by normalized key, then "keep" first within each group
        const ka = _normProductKey(a.brand, a.productName);
        const kb = _normProductKey(b.brand, b.productName);
        if (ka !== kb) return ka.localeCompare(kb);
        const ga = dupeGroups.find(g => g.all.some(x => x.id === a.id));
        if (ga?.keep?.id === a.id) return -1;
        if (ga?.keep?.id === b.id) return 1;
        return 0;
      }
      if(sort==="featured") {
        // Featured first (by featuredOrder), then unfeatured
        const af = a.featuredOnExplore ? 0 : 1;
        const bf = b.featuredOnExplore ? 0 : 1;
        if (af !== bf) return af - bf;
        if (a.featuredOnExplore && b.featuredOnExplore) return (a.featuredOrder ?? 999) - (b.featuredOrder ?? 999);
        return (a.productName||"").localeCompare(b.productName||"");
      }
      if(sort==="scans") return (b.scanCount||0)-(a.scanCount||0);
      if(sort==="name") return (a.productName||"").localeCompare(b.productName||"");
      if(sort==="checked") {
        // Most recently checked first; products never checked sink to the bottom.
        const av = a.lastEnrichedAt || 0;
        const bv = b.lastEnrichedAt || 0;
        if (av === bv) return (a.productName||"").localeCompare(b.productName||"");
        return bv - av;
      }
      return (b.updatedAt||0)-(a.updatedAt||0);
    });

  const swipeQueue = products
    .filter(p => {
      if (p.hidden) return false;
      // Swipe queue is always "everything that needs work" — anything missing image,
      // ingredients, skin type, category, or buy URL.
      return !isComplete(p);
    })
    .sort((a,b) => {
      // Pending-review products (newly added via OBF scan/search) go first
      const aPending = a.pendingReview ? 0 : 1;
      const bPending = b.pendingReview ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      // Within tier: most-scanned first
      return (b.scanCount||0)-(a.scanCount||0);
    });

  const counts = {
    all: products.filter(p=>!p.hidden).length,
    featured: products.filter(p=>!p.hidden && p.featuredOnExplore).length,
    enriched: products.filter(p=>!p.hidden && p.lastEnrichedAt).length,
    unchecked: products.filter(p=>!p.hidden && !p.lastEnrichedAt).length,
    noimage: products.filter(p=>!p.hidden && !hasImg(p)).length,
    noingredients: products.filter(p=>!p.hidden && !hasIng(p)).length,
    noskin: products.filter(p=>!p.hidden && !hasSkin(p)).length,
    nocategory: products.filter(p=>!p.hidden && !hasCategory(p)).length,
    nobuy: products.filter(p=>!p.hidden && !hasBuyUrl(p)).length,
    // "needswork" — anything missing any of the five required fields. This is the new queue definition.
    needswork: products.filter(p=>!p.hidden && !isComplete(p)).length,
    // Legacy: kept for backward compat with code that hasn't been migrated yet.
    both: products.filter(p=>!p.hidden && !hasImg(p) && !hasIng(p)).length,
    // "ready" — fully complete (all five fields). Replaces the previous "image+ingredients only" definition.
    ready: products.filter(p=>!p.hidden && isComplete(p)).length,
    hidden: products.filter(p=>p.hidden).length,
  };

  // Build the list of reviewers actually present in the catalog, with counts.
  // Sorted by count desc so most-active reviewer is at the top of the dropdown.
  const reviewerOptions = (() => {
    const tally = {};
    products.forEach(p => {
      if (!p.hidden && p.lastEnrichedBy) {
        tally[p.lastEnrichedBy] = (tally[p.lastEnrichedBy] || 0) + 1;
      }
    });
    const entries = Object.entries(tally).sort((a,b) => b[1] - a[1]);
    return entries; // [[tag, count], ...]
  })();
  const notReviewedCount = products.filter(p => !p.hidden && !p.lastEnrichedBy).length;

  async function openEdit(p) {
    const base = { ...p, skinTypes: Array.isArray(p.skinTypes)?p.skinTypes:(p.skinTypes||"").split(",").map(s=>s.trim()).filter(Boolean) };
    setEditing(base);
    setLiveScore(p.poreScore??null);
    const filled = await prefillProductAdmin(p);
    setEditing(e => e?.id===p.id ? { ...e, ...filled, skinTypes: Array.isArray(p.skinTypes)?p.skinTypes:(p.skinTypes||"").split(",").map(s=>s.trim()).filter(Boolean) } : e);
    if (filled.ingredients) {
      try { const a=analyzeIngredients(filled.ingredients); if(a?.avgScore!=null) setLiveScore(Math.round(a.avgScore)); } catch {}
    }
  }

  function handleIngChange(val, isSwipe=false) {
    if (isSwipe) {
      setSwipeEdit(e=>({...e,ingredients:val}));
      try { if(val.trim().length>10){const a=analyzeIngredients(val);if(a?.avgScore!=null)setSwipeLiveScore(Math.round(a.avgScore));}else setSwipeLiveScore(null); } catch { setSwipeLiveScore(null); }
    } else {
      setEditing(e=>({...e,ingredients:val}));
      try { if(val.trim().length>10){const a=analyzeIngredients(val);if(a?.avgScore!=null)setLiveScore(Math.round(a.avgScore));}else setLiveScore(null); } catch { setLiveScore(null); }
    }
  }

  function handleAddIngChange(val) {
    setAddForm(f=>({...f,ingredients:val}));
    try { if(val.trim().length>10){const a=analyzeIngredients(val);if(a?.avgScore!=null)setAddScore(Math.round(a.avgScore));}else setAddScore(null); } catch { setAddScore(null); }
  }

  async function uploadImage(file, productId) {
    if (!productId || productId.length < 10) throw new Error("Invalid product ID: " + productId);
    // Normalize mime type and extension
    let mime = file.type || "image/jpeg";
    if (mime === "image/jpg") mime = "image/jpeg";
    const extMap = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/heic":"jpg","image/heif":"jpg"};
    const ext = extMap[mime] || "jpg";
    const path = `products/${productId}/admin_image.${ext}`;
    const ref = storageRef(storage, path);
    await uploadBytes(ref, file, { contentType: mime });
    const url = await getDownloadURL(ref);
    // Also write directly to Firestore so it's saved even if user forgets to hit Save
    await setDoc(doc(db, "products", productId), { adminImage: url, image: url, updatedAt: Date.now() }, { merge: true });
    return url;
  }

  async function handleImgUpload(file, isSwipe=false) {
    if (!file) return;
    if (isSwipe) {
      setSwipeSaving(true);
      try { const url=await uploadImage(file,swipeEdit.id); setSwipeEdit(e=>({...e,adminImage:url,image:url})); } catch(e) { alert("Upload failed: "+e.message); }
      setSwipeSaving(false);
    } else {
      setUploadingImg(true);
      try { const url=await uploadImage(file,editing.id); setEditing(e=>({...e,adminImage:url,image:url})); } catch(e) { alert("Upload failed: "+e.message); }
      setUploadingImg(false);
    }
  }

  async function save(isSwipe=false) {
    const src = isSwipe ? swipeEdit : editing;
    const score = isSwipe ? swipeLiveScore : liveScore;
    if (!src) return;
    if (!src.id || src.id.length < 10) {
      if (isSwipe) { skipSwipe(); return; } // skip bad products in swipe mode
      alert("Save failed: invalid product ID (" + src.id + "). This product may be corrupted — delete it from Firestore.");
      return;
    }
    if (isSwipe) setSwipeSaving(true); else setSaving(true);
    try {
      // Tag the edit with who saved it — so you can filter "edited by VA" later
      const editor = enrichedByTag(auth.currentUser);
      const cleanBrand = (src.brand||"").trim();
      // Auto-strip duplicated brand prefix from product name (e.g. "CeraVe CeraVe Foaming Cleanser" → "Foaming Cleanser")
      const cleanName  = stripBrandFromName(cleanBrand, (src.productName||"").trim());
      const updates = {
        productName: cleanName,
        brand:       cleanBrand,
        category:    src.category||"",
        skinTypes:   Array.isArray(src.skinTypes)?src.skinTypes:(src.skinTypes||"").split(",").map(s=>s.trim()).filter(Boolean),
        reason:      (src.reason||"").trim(),
        ingredients: (src.ingredients||"").trim(),
        buyUrl:      (src.buyUrl||"").trim(),
        approved:    true,
        pendingReview: false,   // cleared once admin has reviewed
        lastEnrichedAt: Date.now(),
        lastEnrichedBy: editor,
        updatedAt:   Date.now(),
      };
      if (src.adminImage) { updates.adminImage=src.adminImage; updates.image=src.adminImage; }
      if (score!==null) updates.poreScore=score;
      await setDoc(doc(db,"products",src.id), updates, { merge: true });
      setProducts(ps=>ps.map(p=>p.id===src.id?{...p,...updates}:p));
      if (isSwipe) {
        const nextIdx = swipeIdx + 1;
        setSwipeIdx(nextIdx);
        const next = swipeQueue[nextIdx];
        if (next) {
          const base = {...next, skinTypes:Array.isArray(next.skinTypes)?next.skinTypes:[]};
          setSwipeEdit(base);
          setSwipeLiveScore(next.poreScore??null);
          prefillProductAdmin(next).then(filled => {
            setSwipeEdit(e => e?.id===next.id ? {...e,...filled,skinTypes:base.skinTypes} : e);
            if (filled.ingredients) { try { const a=analyzeIngredients(filled.ingredients); if(a?.avgScore!=null) setSwipeLiveScore(Math.round(a.avgScore)); } catch {} }
          });
        }
      } else {
        setSavedId(src.id); setEditing(null); setTimeout(()=>setSavedId(null),2500);
      }
    } catch(e) { alert("Save failed: "+e.message); }
    if (isSwipe) setSwipeSaving(false); else setSaving(false);
  }

  async function skipSwipe() {
    const nextIdx = swipeIdx + 1;
    setSwipeIdx(nextIdx);
    const next = swipeQueue[nextIdx];
    if (next) {
      const base = {...next, skinTypes:Array.isArray(next.skinTypes)?next.skinTypes:[]};
      setSwipeEdit(base);
      setSwipeLiveScore(next.poreScore??null);
      const filled = await prefillProductAdmin(next);
      setSwipeEdit(e => e?.id===next.id ? {...e,...filled,skinTypes:base.skinTypes} : e);
      if (filled.ingredients) { try { const a=analyzeIngredients(filled.ingredients); if(a?.avgScore!=null) setSwipeLiveScore(Math.round(a.avgScore)); } catch {} }
    }
  }

  async function startSwipe() {
    setSwipeIdx(0);
    setMode("swipe");
    const first = swipeQueue[0];
    if (first) {
      const base = {...first, skinTypes:Array.isArray(first.skinTypes)?first.skinTypes:[]};
      setSwipeEdit(base);
      setSwipeLiveScore(first.poreScore??null);
      const filled = await prefillProductAdmin(first);
      setSwipeEdit(e => e?.id===first.id ? {...e,...filled,skinTypes:base.skinTypes} : e);
      if (filled.ingredients) { try { const a=analyzeIngredients(filled.ingredients); if(a?.avgScore!=null) setSwipeLiveScore(Math.round(a.avgScore)); } catch {} }
    }
  }

  async function saveNewProduct() {
    if (!addForm.productName.trim()||!addForm.brand.trim()) { alert("Product name and brand are required"); return; }
    setAddSaving(true);
    try {
      const editor = enrichedByTag(auth.currentUser);
      const cleanBrand = addForm.brand.trim();
      const cleanName  = stripBrandFromName(cleanBrand, addForm.productName.trim());
      const newDoc = {
        productName:   cleanName,
        brand:         cleanBrand,
        category:      addForm.category||"",
        skinTypes:     addForm.skinTypes||[],
        ingredients:   addForm.ingredients.trim(),
        buyUrl:        addForm.buyUrl.trim(),
        reason:        addForm.reason.trim(),
        poreScore:     addScore||0,
        approved:      true,
        hidden:        false,
        scanCount:     0,
        communityRating: 0,
        image:         "",
        adminImage:    "",
        barcode:       "",
        lastEnrichedAt: Date.now(),
        lastEnrichedBy: editor,
        addedBy:       editor,  // who originally created this product
        createdAt:     Date.now(),
        updatedAt:     Date.now(),
      };
      const ref = await addDoc(collection(db,"products"), newDoc);
      // Upload image if selected
      if (addImg?.file) {
        const url = await uploadImage(addImg.file, ref.id);
        await updateDoc(doc(db,"products",ref.id), { adminImage:url, image:url });
        newDoc.adminImage=url; newDoc.image=url;
      }
      setProducts(ps=>[{id:ref.id,...newDoc},...ps]);
      setAddDone(true);
      setAddForm({productName:"",brand:"",category:"",skinTypes:[],ingredients:"",buyUrl:"",reason:""});
      setAddImg(null); setAddScore(null); setAddSearch("");
      setTimeout(()=>setAddDone(false),3000);
    } catch(e) { alert("Failed to add: "+e.message); }
    setAddSaving(false);
  }

  const scoreColor = s => s<=1?T.sage:s<=2?"#5B8C3E":s<=3?T.amber:T.rose;

  async function exportCsv() {
    function esc(v){v=(v==null?"":String(v)).replace(/\r?\n/g," ");return(v.includes(",")||v.includes('"'))?`"${v.replace(/"/g,'""')}"`:v;}
    const headers=["productName","brand","imageUrl","ingredients","category","skinTypes","buyUrl","barcode","reason"];
    const lines=[headers.join(","),...products.map(r=>[esc(r.productName),esc(r.brand),esc(r.adminImage||r.image||""),esc(r.ingredients||""),esc(r.category||""),esc(Array.isArray(r.skinTypes)?r.skinTypes.join(","):r.skinTypes||""),esc(r.buyUrl||""),esc(r.barcode||""),esc(r.reason||"")].join(","))];
    const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([lines.join("\n")],{type:"text/csv"})); a.download="ralli_products.csv"; a.click();
  }

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading products…</div>;

  // ─────────────────────────────────────────────────────────────────────────
  // EDIT DRAWER (list mode)
  // ─────────────────────────────────────────────────────────────────────────
  if (editing) return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
      <button onClick={()=>setEditing(null)} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",textAlign:"left",padding:0}}>← Back</button>
      {renderEditForm({src:editing,setSrc:setEditing,score:liveScore,onIngChange:v=>handleIngChange(v,false),onImgUpload:f=>handleImgUpload(f,false),uploading:uploadingImg,imgRef:imgInputRef,onSave:()=>save(false),onCancel:()=>setEditing(null),onDelete:async()=>{ if(!window.confirm("Delete this product permanently?")) return; await deleteDoc(doc(db,"products",editing.id)); setProducts(ps=>ps.filter(p=>p.id!==editing.id)); setEditing(null); },saving,CATEGORIES,SKIN_TYPES,scoreColor,toggleSkin:(t)=>setEditing(e=>{const c=e.skinTypes||[];return{...e,skinTypes:c.includes(t)?c.filter(s=>s!==t):[...c,t]};})})}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // SWIPE MODE
  // ─────────────────────────────────────────────────────────────────────────
  if (mode==="swipe") {
    const current = swipeQueue[swipeIdx];
    if (!current || swipeIdx >= swipeQueue.length) return (
      <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
        <button onClick={()=>setMode("list")} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",textAlign:"left",padding:0}}>← Back</button>
        <div style={{background:T.sage+"18",border:`1px solid ${T.sage}44`,borderRadius:"1rem",padding:"2rem",textAlign:"center"}}>
          <div style={{fontSize:"1.5rem",marginBottom:"0.5rem"}}>🎉</div>
          <div style={{fontSize:"0.9rem",fontWeight:"700",color:T.sage,fontFamily:"'Inter',sans-serif"}}>All done!</div>
          <div style={{fontSize:"0.72rem",color:T.textMid,fontFamily:"'Inter',sans-serif",marginTop:"0.25rem"}}>You've gone through all {swipeQueue.length} products in this queue.</div>
          <button onClick={()=>{setMode("list");setSwipeIdx(0);}} style={{marginTop:"1rem",padding:"0.6rem 1.5rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.75rem",fontSize:"0.75rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Back to list</button>
        </div>
      </div>
    );

    return (
      <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={()=>setMode("list")} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",padding:0}}>← Exit</button>
          <div style={{fontSize:"0.72rem",color:T.textMid,fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>{swipeIdx+1} of {swipeQueue.length} {prefilling&&<span style={{color:T.amber}}>⟳</span>}</div>
          <button onClick={skipSwipe} style={{background:"none",border:"none",color:T.textLight,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",padding:0}}>Skip →</button>
        </div>

        {/* Progress bar */}
        <div style={{height:"3px",background:T.surfaceAlt,borderRadius:"999px"}}>
          <div style={{height:"100%",background:T.accent,width:`${(swipeIdx/swipeQueue.length)*100}%`,borderRadius:"999px",transition:"width 0.3s"}}/>
        </div>

        {/* Same full edit form as list mode */}
        {renderEditForm({
          src: swipeEdit,
          setSrc: setSwipeEdit,
          score: swipeLiveScore,
          onIngChange: v => handleIngChange(v, true),
          onImgUpload: f => handleImgUpload(f, true),
          uploading: swipeSaving,
          imgRef: swipeImgRef,
          onSave: () => save(true),
          onCancel: skipSwipe,
          saving: swipeSaving,
          saveLabel: "✓ Save & Next",
          cancelLabel: "Skip →",
          CATEGORIES,
          SKIN_TYPES,
          scoreColor,
          toggleSkin: t => setSwipeEdit(e => { const c=e.skinTypes||[]; return {...e, skinTypes:c.includes(t)?c.filter(s=>s!==t):[...c,t]}; }),
          prefilling,
        })}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // BOT MODE — Enrichment Bot for batch image+ingredient search
  // ─────────────────────────────────────────────────────────────────────────
  if (mode==="bot") return <EnrichmentBot onBack={()=>setMode("list")}/>;

  // ─────────────────────────────────────────────────────────────────────────
  // ADD PRODUCT MODE
  // ─────────────────────────────────────────────────────────────────────────
  if (mode==="add") return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
      <button onClick={()=>setMode("list")} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",textAlign:"left",padding:0}}>← Back</button>

      <div style={{background:T.surface,borderRadius:"1rem",border:`1px solid ${T.border}`,padding:"1rem",display:"flex",flexDirection:"column",gap:"0.85rem"}}>
        <div style={{fontSize:"0.9rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>+ Add New Product</div>

        {addDone && <div style={{background:T.sage+"18",border:`1px solid ${T.sage}44`,borderRadius:"0.6rem",padding:"0.6rem 0.85rem",fontSize:"0.72rem",color:T.sage,fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>✓ Product added successfully!</div>}

        {/* Image upload */}
        <div>
          <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.4rem",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>Product Image</div>
          <div style={{display:"flex",gap:"0.75rem",alignItems:"center"}}>
            <div style={{width:"70px",height:"70px",borderRadius:"0.6rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,overflow:"hidden",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {addImg?.preview ? <img src={addImg.preview} style={{width:"100%",height:"100%",objectFit:"cover"}}/> : <span style={{fontSize:"1.5rem"}}>📷</span>}
            </div>
            <button onClick={()=>addImgRef.current?.click()}
              style={{padding:"0.55rem 1rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              📱 Pick image
            </button>
            <input ref={addImgRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(f)setAddImg({file:f,preview:URL.createObjectURL(f)});}}/>
          </div>
        </div>

        {/* Name + Brand */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
          {[["Product Name *","productName"],["Brand *","brand"]].map(([label,field])=>(
            <div key={field}>
              <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</div>
              <input value={addForm[field]||""} onChange={e=>setAddForm(f=>({...f,[field]:e.target.value}))}
                style={{width:"100%",padding:"0.5rem 0.6rem",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.75rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surfaceAlt,boxSizing:"border-box"}}/>
            </div>
          ))}
        </div>

        {/* Category */}
        <div>
          <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>Category</div>
          <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
            {CATEGORIES.map(c=>(
              <button key={c} onClick={()=>setAddForm(f=>({...f,category:c}))}
                style={{padding:"0.3rem 0.65rem",background:addForm.category===c?T.accent:T.surfaceAlt,color:addForm.category===c?"#fff":T.textMid,border:`1px solid ${addForm.category===c?T.accent:T.border}`,borderRadius:"999px",fontSize:"0.65rem",fontWeight:addForm.category===c?"600":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Skin types */}
        <div>
          <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>Skin Types</div>
          <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
            {SKIN_TYPES.map(s=>{const active=(addForm.skinTypes||[]).includes(s);return(
              <button key={s} onClick={()=>setAddForm(f=>({...f,skinTypes:active?f.skinTypes.filter(x=>x!==s):[...f.skinTypes,s]}))}
                style={{padding:"0.3rem 0.65rem",background:active?T.sage:T.surfaceAlt,color:active?"#fff":T.textMid,border:`1px solid ${active?T.sage:T.border}`,borderRadius:"999px",fontSize:"0.65rem",fontWeight:active?"600":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                {s}
              </button>
            );})}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.25rem"}}>
            <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>Ingredients</div>
            {addScore!==null&&<div style={{fontSize:"0.78rem",fontWeight:"700",color:scoreColor(addScore),fontFamily:"'Inter',sans-serif"}}>Pore score: {addScore}/5</div>}
          </div>
          <textarea value={addForm.ingredients} onChange={e=>handleAddIngChange(e.target.value)} rows={4}
            placeholder="Paste INCI ingredient list from brand website, Sephora, or incidecoder.com…"
            style={{width:"100%",padding:"0.5rem 0.6rem",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",fontFamily:"monospace",color:T.text,background:T.surfaceAlt,resize:"vertical",boxSizing:"border-box"}}/>
        </div>

        {/* Buy URL */}
        <div>
          <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem",fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>Buy URL (optional)</div>
          <input value={addForm.buyUrl} onChange={e=>setAddForm(f=>({...f,buyUrl:e.target.value}))} placeholder="https://…"
            style={{width:"100%",padding:"0.5rem 0.6rem",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surfaceAlt,boxSizing:"border-box"}}/>
        </div>

        <button onClick={saveNewProduct} disabled={addSaving||!addForm.productName.trim()||!addForm.brand.trim()}
          style={{padding:"0.75rem",background:addSaving||!addForm.productName.trim()||!addForm.brand.trim()?"#ccc":T.accent,color:"#fff",border:"none",borderRadius:"0.75rem",fontSize:"0.82rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          {addSaving?"Adding…":"+ Add Product"}
        </button>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // LIST MODE
  // ─────────────────────────────────────────────────────────────────────────
  // VA-friendly "Today's Queue" card — the daily landing strip at the top of
  // the Products tab. Tells the editor (you or VA) exactly what to work on
  // next, and one tap takes them straight there. Priority order:
  //   1. Both image + ingredients missing  → swipe queue
  //   2. Image missing                      → swipe queue
  //   3. Ingredients missing                → swipe queue
  //   4. Never checked by anyone            → list view (filter=unchecked)
  // The "Mine" counter shows how many products this editor has saved — gives
  // the VA a sense of progress.
  // (myTag and myEditCount are declared above, before `filtered`.)
  // Today's Queue logic — what to surface as "the thing to do today."
  // Priority: anything missing any required field (image, ingredients, skin type,
  // category, or buy URL) is the queue. If everything is complete, fall through
  // to "never reviewed" for verification work.
  const todaySuggestion = (() => {
    if (counts.needswork > 0) {
      // Build a friendly label that names what's most commonly missing.
      const breakdown = [];
      if (counts.noimage > 0)       breakdown.push(`${counts.noimage} no image`);
      if (counts.noingredients > 0) breakdown.push(`${counts.noingredients} no ingredients`);
      if (counts.noskin > 0)        breakdown.push(`${counts.noskin} no skin type`);
      if (counts.nocategory > 0)    breakdown.push(`${counts.nocategory} no category`);
      if (counts.nobuy > 0)         breakdown.push(`${counts.nobuy} no buy link`);
      const subline = breakdown.slice(0, 3).join(" · ");
      return {
        filter: "needswork",
        label: `${counts.needswork} product${counts.needswork===1?"":"s"} need${counts.needswork===1?"s":""} work`,
        sublabel: subline,
        swipe: "needswork",
        color: "#7C3AED",
      };
    }
    if (counts.unchecked > 0) return { filter:"unchecked", label:`${counts.unchecked} not yet reviewed — verify them`, sublabel:"", swipe:null, color:"#EC4899" };
    return null;
  })();

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>


      {/* Power tools (Top 100, CSV import) — hidden by default. Toggle the Advanced expander below to show them. */}
      {showAdvanced && (
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
        <div style={{display:"flex",gap:"0.4rem"}}>
          <button onClick={runTop100} disabled={bulkBusy||seeding}
            title="Auto-pick the 100 best products to feature on Explore"
            style={{flex:1,padding:"0.6rem 0.85rem",background:(bulkBusy||seeding)?T.surfaceAlt:`linear-gradient(135deg, #D4A015, #E8B73A)`,color:(bulkBusy||seeding)?T.textMid:"#fff",border:`1px solid ${(bulkBusy||seeding)?T.border:"#D4A015"}`,borderRadius:"0.6rem",fontSize:"0.7rem",fontWeight:"700",cursor:(bulkBusy||seeding)?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.35rem"}}>
            {bulkBusy ? "⏳ …" : `✨ Run Top 100`}
          </button>
        </div>

        {/* CSV import row — bulk-update ingredients or images from a CSV */}
        <div style={{display:"flex",gap:"0.4rem"}}>
          <input type="file" accept=".csv,text/csv" ref={csvFileRef} onChange={onCsvChosen} style={{display:"none"}}/>
          <button onClick={()=>csvFileRef.current?.click()} disabled={csvImporting||csvApplying||bulkBusy||seeding}
            title="Upload a CSV with product_name, brand, ingredients (or image_url) columns to bulk-update products"
            style={{flex:1,padding:"0.6rem 0.85rem",background:(csvImporting||csvApplying)?T.surfaceAlt:`linear-gradient(135deg, #6B5CA5, #8B7BC5)`,color:(csvImporting||csvApplying)?T.textMid:"#fff",border:`1px solid ${(csvImporting||csvApplying)?T.border:"#6B5CA5"}`,borderRadius:"0.6rem",fontSize:"0.7rem",fontWeight:"700",cursor:(csvImporting||csvApplying)?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.35rem"}}>
            {csvImporting ? "⏳ Parsing…" : "📥 Import CSV"}
          </button>
        </div>

        {csvResult && (
          <div style={{padding:"0.65rem 0.85rem",background:(csvResult.errors?.length?T.rose:T.sage)+"15",border:`1px solid ${(csvResult.errors?.length?T.rose:T.sage)}55`,borderRadius:"0.6rem",fontFamily:"'Inter',sans-serif"}}>
            <div style={{fontSize:"0.72rem",fontWeight:"700",color:csvResult.errors?.length?T.rose:T.sage,marginBottom:"0.25rem"}}>
              ✓ Applied {csvResult.applied} · Skipped {csvResult.skipped}{csvResult.errors?.length?` · ${csvResult.errors.length} errors`:""}
            </div>
            {csvResult.errors?.length > 0 && (
              <div style={{fontSize:"0.6rem",color:T.textMid,lineHeight:1.5,maxHeight:"80px",overflow:"auto"}}>
                {csvResult.errors.slice(0,5).map((e,i)=><div key={i}>• {e}</div>)}
                {csvResult.errors.length > 5 && <div>...and {csvResult.errors.length-5} more</div>}
              </div>
            )}
          </div>
        )}

        {/* CSV review modal — shows matched rows, lets user accept/reject before apply */}
        {csvReview && ReactDOM.createPortal(
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",flexDirection:"column",padding:"0.5rem"}}>
            <div style={{flex:1,background:T.surface,borderRadius:"0.75rem",display:"flex",flexDirection:"column",overflow:"hidden",maxWidth:"520px",margin:"0 auto",width:"100%",border:`1px solid ${T.border}`}}>
              {/* Header */}
              <div style={{padding:"0.85rem 1rem",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>📥 Review CSV Import</div>
                  <div style={{fontSize:"0.65rem",color:T.textMid,marginTop:"2px"}}>
                    {csvReview.rows.filter(r=>r.product).length} matched · {csvReview.rows.filter(r=>!r.product).length} unmatched · Will apply: <strong style={{color:T.sage}}>{csvReview.rows.filter(r=>r.accepted&&r.product).length}</strong>
                  </div>
                </div>
                <button onClick={()=>setCsvReview(null)} style={{background:"none",border:"none",fontSize:"1.1rem",cursor:"pointer",color:T.textMid,padding:"0.25rem"}}>✕</button>
              </div>

              {/* Rows */}
              <div style={{flex:1,overflowY:"auto",padding:"0.5rem"}}>
                {csvReview.rows.map((row, idx) => {
                  const hasMatch = !!row.product;
                  const lowConf = row.confidence?.toLowerCase() === "low";
                  return (
                    <div key={idx} onClick={()=>hasMatch && toggleCsvRow(idx)}
                      style={{padding:"0.55rem 0.7rem",borderRadius:"0.5rem",border:`1px solid ${hasMatch?(row.accepted?T.sage+"80":T.border):T.rose+"55"}`,background:hasMatch?(row.accepted?T.sage+"10":T.surface):T.rose+"10",marginBottom:"0.35rem",cursor:hasMatch?"pointer":"default",opacity:hasMatch?1:0.75}}>
                      <div style={{display:"flex",alignItems:"start",gap:"0.5rem"}}>
                        <div style={{fontSize:"0.9rem",marginTop:"1px"}}>{hasMatch ? (row.accepted?"✓":"○") : "⚠"}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"0.7rem",fontWeight:"700",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                            {row.brand ? `${row.brand} — ` : ""}{row.productName}
                          </div>
                          {!hasMatch && <div style={{fontSize:"0.58rem",color:T.rose,marginTop:"2px"}}>No matching product in catalog</div>}
                          {hasMatch && (
                            <div style={{fontSize:"0.58rem",color:T.textMid,marginTop:"3px",lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
                              {csvReview.kind === "ingredients" ? row.value : `Image: ${row.value.slice(0,60)}${row.value.length>60?"…":""}`}
                            </div>
                          )}
                          <div style={{display:"flex",gap:"0.4rem",marginTop:"3px",flexWrap:"wrap"}}>
                            {row.confidence && (
                              <span style={{fontSize:"0.52rem",padding:"1px 5px",borderRadius:"0.3rem",background:lowConf?T.rose+"22":T.sage+"22",color:lowConf?T.rose:T.sage,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.04em"}}>
                                {row.confidence}
                              </span>
                            )}
                            {row.source && (
                              <a href={row.source} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                                style={{fontSize:"0.52rem",color:T.accent,textDecoration:"underline"}}>
                                source ↗
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{padding:"0.75rem 1rem",borderTop:`1px solid ${T.border}`,display:"flex",gap:"0.5rem"}}>
                <button onClick={()=>setCsvReview(null)}
                  style={{flex:1,padding:"0.65rem",background:T.surface,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Cancel
                </button>
                <button onClick={applyCsvReview} disabled={csvApplying || !csvReview.rows.some(r=>r.accepted&&r.product)}
                  style={{flex:2,padding:"0.65rem",background:csvApplying?T.surfaceAlt:T.sage,color:csvApplying?T.textMid:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.72rem",fontWeight:"700",cursor:csvApplying?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
                  {csvApplying ? "⏳ Applying…" : `Apply ${csvReview.rows.filter(r=>r.accepted&&r.product).length} update${csvReview.rows.filter(r=>r.accepted&&r.product).length===1?"":"s"}`}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
        {seedResult && (
          <div style={{padding:"0.65rem 0.85rem",background:T.sage+"15",border:`1px solid ${T.sage}55`,borderRadius:"0.6rem",fontFamily:"'Inter',sans-serif"}}>
            <div style={{fontSize:"0.72rem",fontWeight:"700",color:T.sage,marginBottom:"0.25rem"}}>
              ✓ Added {seedResult.added} · Skipped {seedResult.skipped} duplicate{seedResult.skipped===1?"":"s"}
            </div>
            <div style={{fontSize:"0.62rem",color:T.textMid,lineHeight:1.5}}>
              {seedResult.added > 0
                ? <>New products are in the <strong>swipe queue</strong> with empty ingredients + image. Tap <strong>👆 Swipe</strong> above to fill them in.</>
                : <>All {seedResult.total} seed products were already in your catalog — nothing to add.</>}
            </div>
            {seedResult.examples?.length > 0 && (
              <div style={{fontSize:"0.58rem",color:T.textLight,marginTop:"0.4rem",fontStyle:"italic"}}>
                e.g. {seedResult.examples.slice(0,3).join(" · ")}
              </div>
            )}
            <button onClick={()=>setSeedResult(null)}
              style={{marginTop:"0.4rem",background:"none",border:"none",color:T.accent,fontSize:"0.6rem",cursor:"pointer",padding:0,fontFamily:"'Inter',sans-serif"}}>
              dismiss
            </button>
          </div>
        )}
      </div>
      )}

      {/* Advanced tools toggle — universal. Hides power tools, mode switcher, swipe queue filter, dupe finder, bulk select, and the sort row by default. */}
      <button onClick={()=>setShowAdvanced(s=>!s)}
        style={{padding:"0.4rem 0.75rem",background:"none",border:`1px dashed ${T.border}`,borderRadius:"0.5rem",fontSize:"0.65rem",color:T.textLight,cursor:"pointer",fontFamily:"'Inter',sans-serif",alignSelf:"flex-start"}}>
        {showAdvanced ? "▾ Hide advanced tools" : "▸ Advanced tools"}
      </button>

      {/* Search + actions */}
      <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
          style={{flex:1,padding:"0.55rem 0.75rem",border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.75rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface}}/>
        {/* Dupe finder + bulk select — only shown in Advanced */}
        {showAdvanced && (
        <button onClick={dupeView ? exitDupeView : findDuplicates}
          title={dupeView ? "Exit duplicate view" : "Find duplicate products"}
          style={{padding:"0.55rem 0.75rem",background:dupeView?"#7C3AED":T.surfaceAlt,color:dupeView?"#fff":T.textMid,border:`1px solid ${dupeView?"#7C3AED":T.border}`,borderRadius:"0.6rem",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          {dupeView ? "✕" : "👯"}
        </button>
        )}
        {showAdvanced && (
        <button onClick={()=>{ if(selectMode) exitSelectMode(); else setSelectMode(true); }}
          title={selectMode ? "Exit select mode" : "Select multiple to hide or delete"}
          style={{padding:"0.55rem 0.75rem",background:selectMode?T.accent:T.surfaceAlt,color:selectMode?"#fff":T.textMid,border:`1px solid ${selectMode?T.accent:T.border}`,borderRadius:"0.6rem",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          {selectMode ? "✕" : "☑"}
        </button>
        )}
        <button onClick={exportCsv} title="Export catalog to CSV" style={{padding:"0.55rem 0.85rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>⬇️</button>
        <button onClick={load} title="Refresh" style={{padding:"0.55rem 0.75rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.72rem",color:T.textMid,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>↺</button>
      </div>

      {/* Duplicate view banner */}
      {dupeView && (
        <div style={{padding:"0.65rem 0.85rem",background:"#7C3AED12",border:`1px solid #7C3AED44`,borderRadius:"0.6rem",fontFamily:"'Inter',sans-serif"}}>
          {dupeGroups.length === 0 ? (
            <div style={{fontSize:"0.72rem",color:"#7C3AED",fontWeight:"700"}}>
              ✓ No duplicates found — your catalog is clean.
            </div>
          ) : (
            <>
              <div style={{fontSize:"0.72rem",color:"#7C3AED",fontWeight:"700",marginBottom:"0.25rem"}}>
                👯 Found {dupeGroups.length} duplicate group{dupeGroups.length===1?"":"s"} · {dupeGroups.reduce((n,g)=>n+g.drop.length,0)} extra cop{dupeGroups.reduce((n,g)=>n+g.drop.length,0)===1?"y":"ies"} preselected
              </div>
              <div style={{fontSize:"0.62rem",color:T.textMid,lineHeight:1.5}}>
                The "best" copy in each group (most data, most scans) is marked <strong>KEEP</strong>. The rest are preselected — review the selection then tap <strong>🙈 Hide</strong> or <strong>🗑 Delete</strong>. Matching is case- and punctuation-insensitive on brand + name.
              </div>
            </>
          )}
        </div>
      )}

      {/* Sort — always visible. Defaults to Most Scanned. */}
      <div style={{display:"flex",gap:"0.3rem",alignItems:"center",flexWrap:"wrap"}}>
        <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginRight:"0.2rem"}}>Sort:</div>
        {[["scans","Most scanned"],["checked","🕒 Date checked"],["name","A–Z"]].map(([id,label])=>(
          <button key={id} onClick={()=>setSort(id)}
            style={{padding:"0.25rem 0.6rem",background:sort===id?T.accent:T.surfaceAlt,color:sort===id?"#fff":T.textMid,border:`1px solid ${sort===id?T.accent:T.border}`,borderRadius:"999px",fontSize:"0.62rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:sort===id?"600":"400"}}>
            {label}
          </button>
        ))}

        {/* Reviewer dropdown — populated from actual reviewers in the catalog */}
        <div style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginLeft:"0.5rem",marginRight:"0.2rem"}}>Reviewed by:</div>
        <select value={reviewerFilter} onChange={e=>setReviewerFilter(e.target.value)}
          style={{padding:"0.28rem 0.6rem",background:reviewerFilter==="all"?T.surfaceAlt:T.accent+"15",color:reviewerFilter==="all"?T.textMid:T.accent,border:`1px solid ${reviewerFilter==="all"?T.border:T.accent}`,borderRadius:"999px",fontSize:"0.62rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:reviewerFilter==="all"?"400":"600"}}>
          <option value="all">Anyone ({counts.all})</option>
          {notReviewedCount > 0 && <option value="none">🤖 Not reviewed ({notReviewedCount})</option>}
          {reviewerOptions.map(([tag, n]) => (
            <option key={tag} value={tag}>{reviewerLabel(tag)} ({n})</option>
          ))}
        </select>
      </div>

      {/* Filter pills — default set: All / Needs work / No image / No ingredients / No skin / No buy / Complete / Mine. Advanced exposes everything. */}
      <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
        {(showAdvanced
          ? [["all",`All (${counts.all})`,null],["needswork",`🚧 Needs work (${counts.needswork})`,"#7C3AED"],["featured",`⭐ Featured (${counts.featured})`,"#D4A015"],["enriched",`✨ Reviewed (${counts.enriched})`,"#6366F1"],["unchecked",`🤖 Not reviewed (${counts.unchecked})`,"#EC4899"],["noimage",`No image (${counts.noimage})`,T.rose],["noingredients",`No ingredients (${counts.noingredients})`,T.amber],["noskin",`No skin type (${counts.noskin})`,T.amber],["nocategory",`No category (${counts.nocategory})`,T.amber],["nobuy",`No buy link (${counts.nobuy})`,T.amber],["ready",`Complete (${counts.ready})`,T.sage],["hidden",`🙈 Hidden (${counts.hidden})`,T.textMid]]
          : [["all",`All (${counts.all})`,null],["needswork",`🚧 Needs work (${counts.needswork})`,"#7C3AED"],["noimage",`No image (${counts.noimage})`,T.rose],["noingredients",`No ingredients (${counts.noingredients})`,T.amber],["noskin",`No skin type (${counts.noskin})`,T.amber],["nobuy",`No buy link (${counts.nobuy})`,T.amber],["ready",`Complete (${counts.ready})`,T.sage]]
        ).map(([id,label,color])=>(
          <button key={id} onClick={()=>setFilter(id)}
            style={{padding:"0.3rem 0.7rem",background:filter===id?(color||T.accent):T.surfaceAlt,color:filter===id?"#fff":T.textMid,border:`1px solid ${filter===id?(color||T.accent):T.border}`,borderRadius:"999px",fontSize:"0.65rem",fontWeight:filter===id?"600":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {label}
          </button>
        ))}
      </div>

      {/* Inline explainer for the active filter — disappears for "All" */}
      {filter !== "all" && (
        <div style={{padding:"0.45rem 0.7rem",background:T.surfaceAlt,borderRadius:"0.5rem",fontSize:"0.62rem",color:T.textMid,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>
          {filter === "noimage"       && <>📷 <strong>No image</strong> — products missing a clean product photo. Tap one to find and upload an image.</>}
          {filter === "noingredients" && <>🧪 <strong>No ingredients</strong> — products missing the INCI ingredient list. Tap one to look it up and paste it in.</>}
          {filter === "noskin"        && <>🧴 <strong>No skin type</strong> — products without skin-type tags. Tap one to add at least one (Oily, Dry, Sensitive, etc.).</>}
          {filter === "nocategory"    && <>📂 <strong>No category</strong> — products with no category set. Tap one to assign Face Wash / Moisturiser / Serum / etc.</>}
          {filter === "nobuy"         && <>🛒 <strong>No buy link</strong> — products with no Amazon, Sephora, or brand purchase URL.</>}
          {filter === "needswork"     && <>🚧 <strong>Needs work</strong> — products missing one or more of: image, ingredients, skin type, category, or buy link. The full daily queue.</>}
          {filter === "ready"         && <>✅ <strong>Complete</strong> — products with image, ingredients, skin type, category, and buy link. Ready for users.</>}
          {filter === "featured"      && <>⭐ <strong>Featured</strong> — products currently shown in "What We're Loving" on Explore.</>}
          {filter === "enriched"      && <>✨ <strong>Reviewed</strong> — products that have been verified at least once by you or the team.</>}
          {filter === "unchecked"     && <>🤖 <strong>Not reviewed</strong> — products no one has verified yet. May have stale or auto-fetched data.</>}
          {filter === "hidden"        && <>🙈 <strong>Hidden</strong> — products excluded from the app. Still in the database, can be unhidden anytime.</>}
        </div>
      )}

      {/* Copy filtered list → clipboard. Useful when sharing a working list with the team. */}
      {filter !== "all" && filtered.length > 0 && (
        <button onClick={async ()=>{
          const lines = filtered.map(p => `${p.brand || "?"} — ${p.productName || "?"}`);
          const text = lines.join("\n");
          try {
            await navigator.clipboard.writeText(text);
            alert(`Copied ${filtered.length} product${filtered.length===1?"":"s"} to clipboard.`);
          } catch(e) {
            // Fallback for iOS Safari or blocked clipboard: show the text in a textarea
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.style.position = "fixed";
            ta.style.top = "10%";
            ta.style.left = "5%";
            ta.style.width = "90%";
            ta.style.height = "70%";
            ta.style.zIndex = "99999";
            ta.style.padding = "1rem";
            ta.style.fontSize = "0.8rem";
            ta.style.fontFamily = "monospace";
            document.body.appendChild(ta);
            ta.select();
            alert("Clipboard blocked — text is shown in a box. Long-press to Select All → Copy, then tap outside to dismiss.");
            ta.addEventListener("blur", () => ta.remove(), { once: true });
          }
        }} style={{padding:"0.5rem 0.85rem",background:`linear-gradient(135deg, #6B5CA5, #8B7BC5)`,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.7rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem",alignSelf:"flex-start"}}>
          📋 Copy {filtered.length} product{filtered.length===1?"":"s"} to clipboard
        </button>
      )}

      {/* Select-all bar (visible when in select mode) */}
      {selectMode && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.5rem 0.75rem",background:T.accent+"12",border:`1px solid ${T.accent}40`,borderRadius:"0.6rem"}}>
          <div style={{fontSize:"0.7rem",color:T.text,fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Tap rows to select"}
          </div>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <button onClick={()=>selectAllVisible(filtered.map(p=>p.id))}
              style={{background:"none",border:"none",color:T.accent,fontSize:"0.65rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",padding:"0.2rem 0.4rem"}}>
              Select all visible ({filtered.length})
            </button>
            {selectedIds.size > 0 && (
              <button onClick={clearSelection}
                style={{background:"none",border:"none",color:T.textMid,fontSize:"0.65rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",padding:"0.2rem 0.4rem"}}>
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Product list */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
        {filtered.length===0&&<div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.78rem",fontFamily:"'Inter',sans-serif"}}>No products match this filter.</div>}
        {filtered.map((p, idx)=>{
          const imgOk=hasImg(p), ingOk=hasIng(p), scans=p.scanCount||0;
          const isSelected = selectedIds.has(p.id);
          const onRowClick = selectMode ? (()=>toggleSelected(p.id)) : (()=>openEdit(p));
          const dupeGroup = dupeView ? dupeGroups.find(g => g.all.some(x => x.id === p.id)) : null;
          const isKeep = dupeGroup?.keep?.id === p.id;
          // In dupe view: emit a visual group header before the first item of each group (always the KEEP item, since we sorted that way)
          const showGroupHeader = dupeView && isKeep;
          const groupSize = dupeGroup ? dupeGroup.all.length : 0;
          return (
            <React.Fragment key={p.id}>
              {showGroupHeader && (
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:idx===0?"0 0.25rem 0.15rem":"0.55rem 0.25rem 0.15rem",borderTop:idx===0?"none":`1px dashed ${T.border}`,marginTop:idx===0?0:"0.25rem"}}>
                  <span style={{fontSize:"0.6rem",fontWeight:"700",color:"#7C3AED",fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.06em"}}>
                    👯 {dupeGroup.brand} — {dupeGroup.name}
                  </span>
                  <span style={{fontSize:"0.55rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>
                    {groupSize} cop{groupSize===1?"y":"ies"}
                  </span>
                </div>
              )}
              <div onClick={onRowClick}
                style={{background:isSelected?T.accent+"15":(isKeep?T.sage+"10":(savedId===p.id?T.sage+"18":T.surface)),border:`1px solid ${isSelected?T.accent:(isKeep?T.sage+"66":(savedId===p.id?T.sage:T.border))}`,borderRadius:"0.75rem",padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.65rem",cursor:"pointer",opacity:p.hidden?0.55:1}}>
                {selectMode && (
                  <div style={{width:"22px",height:"22px",borderRadius:"0.35rem",border:`2px solid ${isSelected?T.accent:T.border}`,background:isSelected?T.accent:T.surface,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.12s"}}>
                    {isSelected && <span style={{color:"#fff",fontSize:"0.78rem",fontWeight:"700",lineHeight:1}}>✓</span>}
                  </div>
                )}
                <div style={{width:"44px",height:"44px",borderRadius:"0.5rem",background:T.surfaceAlt,flexShrink:0,overflow:"hidden",border:`1px solid ${T.border}`}}>
                  {imgOk?<img src={p.adminImage||p.image} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>📷</div>}
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                    {isKeep && <span style={{fontSize:"0.5rem",fontWeight:"700",color:T.sage,background:T.sage+"22",padding:"0.12rem 0.4rem",borderRadius:"999px",textTransform:"uppercase",letterSpacing:"0.06em",flexShrink:0}}>★ KEEP</span>}
                    {p.featuredOnExplore && <span title="Featured on Explore" style={{fontSize:"0.55rem",fontWeight:"700",color:"#D4A015",flexShrink:0}}>⭐</span>}
                    <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",minWidth:0}}>{p.productName}</span>
                    {p.hidden&&<span style={{fontSize:"0.55rem",color:T.rose,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.05em",flexShrink:0}}>· hidden</span>}
                  </div>
                  <div style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>
                    {p.brand}{p.category?` · ${p.category}`:""}{scans>0&&<span style={{color:T.accent,fontWeight:"600"}}> · {scans} scans</span>}{dupeView&&<span style={{color:T.textMid}}> · ID {p.id.slice(0,12)}…</span>}
                  </div>
                </div>
                {!selectMode && (
                  <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",flexShrink:0,minWidth:"54px"}}>
                    {/* Reviewer avatar — initials + relative time */}
                    {p.lastEnrichedAt ? (
                      <>
                        <div style={{width:"30px",height:"30px",borderRadius:"50%",background:reviewerColor(p.lastEnrichedBy||"admin"),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.62rem",fontWeight:"700",fontFamily:"'Inter',sans-serif",letterSpacing:"0.02em"}}
                          title={`Last reviewed ${new Date(p.lastEnrichedAt).toLocaleString()} by ${reviewerLabel(p.lastEnrichedBy) || "Team"}`}>
                          {reviewerInitials(p.lastEnrichedBy||"admin")}
                        </div>
                        <div style={{fontSize:"0.55rem",color:T.textLight,fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>{relTime(p.lastEnrichedAt)}</div>
                      </>
                    ) : (
                      <>
                        <div style={{width:"30px",height:"30px",borderRadius:"50%",background:T.surfaceAlt,border:`1.5px dashed ${"#EC4899"}`,color:"#EC4899",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem",fontFamily:"'Inter',sans-serif"}}
                          title="Not yet reviewed">
                          🤖
                        </div>
                        <div style={{fontSize:"0.55rem",color:"#EC4899",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>new</div>
                      </>
                    )}
                    {/* Missing-field badges — small dots underneath */}
                    {(() => {
                      const miss = missingFields(p);
                      if (miss.length === 0) return <span style={{fontSize:"0.5rem",color:T.sage,fontWeight:"700",letterSpacing:"0.05em"}}>✓ COMPLETE</span>;
                      return (
                        <div style={{display:"flex",gap:"2px",flexWrap:"wrap",justifyContent:"center",maxWidth:"54px"}}>
                          {miss.map(f => (
                            <span key={f} title={`Missing: ${f}`}
                              style={{fontSize:"0.5rem",padding:"0.08rem 0.3rem",borderRadius:"999px",background:T.rose+"22",color:T.rose,fontFamily:"'Inter',sans-serif",fontWeight:"700",lineHeight:1.3}}>
                              {f}
                            </span>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {!selectMode && <div style={{fontSize:"0.65rem",color:T.textLight,flexShrink:0,marginLeft:"0.25rem"}}>›</div>}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {filtered.length>0&&<div style={{textAlign:"center",fontSize:"0.65rem",color:T.textLight,fontFamily:"'Inter',sans-serif",paddingBottom:selectMode&&selectedIds.size>0?"6rem":"2rem"}}>{filtered.length} of {products.length} products · {dupeView?"in duplicate groups":(selectMode?"tap to select":"tap to edit")}{reviewerFilter !== "all" && <> · reviewed by <strong style={{color:T.textMid}}>{reviewerFilter==="none"?"no one":reviewerLabel(reviewerFilter)}</strong></>}</div>}

      {/* Sticky bulk action bar — visible when in select mode with selections */}
      {selectMode && selectedIds.size > 0 && (
        <div style={{position:"fixed",bottom:"4.5rem",left:"50%",transform:"translateX(-50%)",zIndex:50,maxWidth:"460px",width:"calc(100% - 2rem)",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",boxShadow:"0 10px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",padding:"0.65rem 0.75rem",display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <div style={{flex:1,fontSize:"0.7rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>
            {selectedIds.size} selected
          </div>
          {filter==="featured" ? (
            <button onClick={()=>bulkFeature(false)} disabled={bulkBusy}
              style={{padding:"0.55rem 0.9rem",background:bulkBusy?T.surfaceAlt:T.textMid,color:bulkBusy?T.textMid:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.7rem",fontWeight:"700",cursor:bulkBusy?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
              {bulkBusy ? "…" : `Unfeature ${selectedIds.size}`}
            </button>
          ) : (
            <button onClick={()=>bulkFeature(true)} disabled={bulkBusy}
              style={{padding:"0.55rem 0.9rem",background:bulkBusy?T.surfaceAlt:"#D4A015",color:bulkBusy?T.textMid:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.7rem",fontWeight:"700",cursor:bulkBusy?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
              {bulkBusy ? "…" : `⭐ Feature ${selectedIds.size}`}
            </button>
          )}
          {filter==="hidden" ? (
            <button onClick={bulkUnhide} disabled={bulkBusy}
              style={{padding:"0.55rem 0.9rem",background:bulkBusy?T.surfaceAlt:T.sage,color:bulkBusy?T.textMid:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.7rem",fontWeight:"700",cursor:bulkBusy?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
              {bulkBusy ? "…" : `👁 Unhide ${selectedIds.size}`}
            </button>
          ) : (
            <button onClick={bulkHide} disabled={bulkBusy}
              style={{padding:"0.55rem 0.9rem",background:bulkBusy?T.surfaceAlt:T.amber,color:bulkBusy?T.textMid:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.7rem",fontWeight:"700",cursor:bulkBusy?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
              {bulkBusy ? "…" : `🙈 Hide ${selectedIds.size}`}
            </button>
          )}
          <button onClick={bulkDelete} disabled={bulkBusy}
            style={{padding:"0.55rem 0.9rem",background:bulkBusy?T.surfaceAlt:T.rose,color:bulkBusy?T.textMid:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.7rem",fontWeight:"700",cursor:bulkBusy?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
            {bulkBusy ? "…" : `🗑 Delete ${selectedIds.size}`}
          </button>
        </div>
      )}
    </div>
  );
}