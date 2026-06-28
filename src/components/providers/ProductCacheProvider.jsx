import React from "react";
import { onSnapshot, collection } from "firebase/firestore";
import { db } from "../../lib/firebase.js";
import { getProductImage } from "../../lib/imageUtils.js";

export const ProductCacheContext = React.createContext({
  byId: {}, byNameLower: {}, ready: false,
  get: () => null, getImage: () => "",
});

export function ProductCacheProvider({ children }) {
  const [byId, setById] = React.useState({});
  const [byNameLower, setByNameLower] = React.useState({});
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onSnapshot(collection(db, "products"), (snap) => {
        const ix = {};
        const ixn = {};
        snap.forEach(d => {
          const data = { id: d.id, ...d.data() };
          ix[d.id] = data;
          const nameLower = (data.productName || data.name || "").toLowerCase().trim();
          if (nameLower) {
            const existing = ixn[nameLower];
            if (!existing) ixn[nameLower] = data;
            else {
              const score = p => (p.adminImage?3:0) + (p.image_url?2:0) + (p.image?1:0) + ((p.ingredients||"").length>10?2:0) + (p.communityRating?1:0) + (p.scanCount||0)*0.01;
              if (score(data) > score(existing)) ixn[nameLower] = data;
            }
          }
        });
        setById(ix);
        setByNameLower(ixn);
        setReady(true);
      }, (err) => {
        console.warn("ProductCache snapshot error:", err);
        setReady(true);
      });
    } catch(e) {
      console.warn("ProductCache subscribe failed:", e);
      setReady(true);
    }
    return () => { try { unsub(); } catch {} };
  }, []);

  const get = React.useCallback((idOrName) => {
    if (!idOrName) return null;
    const key = String(idOrName).trim();
    if (!key) return null;
    if (byId[key]) return byId[key];
    const lower = key.toLowerCase();
    if (byNameLower[lower]) return byNameLower[lower];
    return null;
  }, [byId, byNameLower]);

  const getImage = React.useCallback((idOrName) => {
    const p = get(idOrName);
    return p ? getProductImage(p) : "";
  }, [get]);

  const value = React.useMemo(() => ({ byId, byNameLower, ready, get, getImage }), [byId, byNameLower, ready, get, getImage]);
  return <ProductCacheContext.Provider value={value}>{children}</ProductCacheContext.Provider>;
}

export function useProductCache() { return React.useContext(ProductCacheContext); }

export function useProduct(idOrName, fallback = null) {
  const cache = useProductCache();
  const live = cache.get(idOrName);
  return live || fallback;
}

export function useProductImage(idOrName, fallback = "") {
  const cache = useProductCache();
  const live = cache.get(idOrName);
  if (live) {
    const url = getProductImage(live);
    if (url) return url;
  }
  return fallback || "";
}
