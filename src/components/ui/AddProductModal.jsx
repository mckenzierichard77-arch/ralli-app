import React, { useState } from "react";
import ReactDOM from "react-dom";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { T } from "../../data/tokens";

export function AddProductModal({ onClose, onAdded, user, prefillBarcode = "", prefillName = "" }) {
  const [productName, setProductName] = useState(prefillName);
  const [brand, setBrand]             = useState("");
  const [barcode, setBarcode]         = useState(prefillBarcode);
  const [ingredients, setIngredients] = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [err, setErr]                 = useState("");

  async function handleSave() {
    if (!productName.trim() || !ingredients.trim()) {
      setErr("Product name and ingredients are required."); return;
    }
    setSaving(true); setErr("");
    try {
      const key = (barcode || productName).toLowerCase().trim().replace(/\s+/g, "-");
      await setDoc(doc(db, "community_products", key), {
        barcode: barcode.trim(),
        productName: productName.trim(),
        brand: brand.trim(),
        ingredients: ingredients.trim(),
        addedBy: user?.uid || "anonymous",
        addedByName: user?.displayName || "",
        addedAt: serverTimestamp(),
        verifiedCount: 1,
      });
      setSaved(true);
      setTimeout(() => {
        onAdded({ productName: productName.trim(), brand: brand.trim(), ingredients: ingredients.trim(), barcode: barcode.trim() });
        onClose();
      }, 1200);
    } catch (e) { setErr("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  const inp = { width: "100%", padding: "0.75rem 1rem", borderRadius: "0.65rem", border: `1px solid ${T.border}`, fontSize: "0.85rem", color: T.text, background: "#FFFFFF", outline: "none", fontFamily: "'Inter',sans-serif", boxSizing: "border-box", marginBottom: "0.75rem" };

  return ReactDOM.createPortal(
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.45)", zIndex: 9000, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: T.surface, borderRadius: "1.5rem 1.5rem 0 0", width: "100%", maxWidth: "480px", padding: "1.5rem 1.25rem 2.5rem", maxHeight: "90vh", overflowY: "auto" }}>
        {/* Handle */}
        <div style={{ width: "2.5rem", height: "0.25rem", background: T.border, borderRadius: "999px", margin: "0 auto 1.25rem" }} />

        <div style={{ fontSize: "1.1rem", fontWeight: "700", color: T.text, marginBottom: "0.3rem", fontFamily: "'Inter',sans-serif" }}>Add missing product</div>
        <div style={{ fontSize: "0.8rem", color: T.textMid, marginBottom: "1.25rem", lineHeight: 1.5 }}>
          Help the Ralli community — add this product and everyone benefits instantly.
        </div>

        <div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Product name *</div>
        <input style={inp} value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Hydro Boost Water Gel" />

        <div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Brand</div>
        <input style={inp} value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Neutrogena" />

        <div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Barcode (if known)</div>
        <input style={inp} value={barcode} onChange={e => setBarcode(e.target.value)} placeholder="e.g. 070501103603" />

        <div style={{ fontSize: "0.72rem", color: T.textMid, fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.35rem" }}>Ingredient list * <span style={{ fontWeight: "400", textTransform: "none", letterSpacing: 0, color: T.textLight }}>— copy from the product label or brand website</span></div>
        <textarea style={{ ...inp, minHeight: "120px", resize: "vertical", lineHeight: 1.5 }} value={ingredients} onChange={e => setIngredients(e.target.value)} placeholder="Water, Glycerin, Niacinamide, Hyaluronic Acid..." />

        {err && <div style={{ fontSize: "0.8rem", color: T.rose, marginBottom: "0.75rem" }}>{err}</div>}

        {saved ? (
          <div style={{ padding: "0.9rem", background: "#F0FBF0", border: "1px solid #4CAF5044", borderRadius: "0.75rem", textAlign: "center", fontSize: "0.85rem", color: "#2E7D32", fontWeight: "600" }}>
            Saved! Analysing ingredients…
          </div>
        ) : (
          <button onClick={handleSave} disabled={saving}
            style={{ width: "100%", padding: "0.95rem", background: T.accent, color: "#FFFFFF", border: "none", borderRadius: "0.75rem", fontSize: "0.9rem", fontWeight: "600", cursor: "pointer", fontFamily: "'Inter',sans-serif", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save & analyse"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}