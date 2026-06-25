import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { doc, getDoc, getDocs, query, collection, where, limit } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { sendMessage, sendToConversation } from "../../lib/messagingUtils.js";
import { Avatar } from "../ui/Avatar.jsx";

export function ShareProductModal({ user, product, onClose }) {
  const [following, setFollowing] = useState([]);
  const [groups, setGroups] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(null);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      const followingIds = snap?.data()?.following || [];
      if (followingIds.length) {
        const chunks = [];
        for (let i = 0; i < followingIds.length; i += 10) chunks.push(followingIds.slice(i, i+10));
        const users = [];
        for (const chunk of chunks) {
          const q = query(collection(db, "users"), where("__name__", "in", chunk));
          const s = await getDocs(q).catch(() => null);
          if (s) s.docs.forEach(d => users.push({ uid: d.id, ...d.data() }));
        }
        setFollowing(users);
      }
      if (followingIds.length < 3) {
        const fallback = await getDocs(query(collection(db, "users"), limit(15))).catch(() => null);
        if (fallback) {
          const extra = fallback.docs.map(d=>({uid:d.id,...d.data()}))
            .filter(u => u.uid !== user.uid && !followingIds.includes(u.uid));
          setFollowing(prev => {
            const seen = new Set(prev.map(u=>u.uid));
            return [...prev, ...extra.filter(u=>!seen.has(u.uid))];
          });
        }
      }
      try {
        const gq = query(collection(db, "conversations"),
          where("participants","array-contains", user.uid),
          limit(50)
        );
        const gs = await getDocs(gq);
        setGroups(gs.docs.map(d => ({ id: d.id, ...d.data() })).filter(c => c.isGroup));
      } catch(e) {}
      setLoading(false);
    }
    load();
  }, [user.uid]);

  useEffect(() => {
    if (!searchQ.trim()) return;
    const q = query(collection(db, "users"),
      where("displayName", ">=", searchQ),
      where("displayName", "<=", searchQ + ""),
      limit(10)
    );
    getDocs(q).then(snap => {
      const results = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid);
      setSearchResults(results);
    }).catch(() => {});
  }, [searchQ]);

  async function buildProductPayload() {
    let productName = product.productName || product.name || "Product";
    let brand = product.brand || "";
    let productImage = product.productImage || product.image || "";
    let poreScore = null;
    let hasScore = false;

    const postIng = product.ingredients || "";
    if (postIng.trim().length > 10) {
      const r = analyzeIngredients(postIng);
      if (r.avgScore != null) { poreScore = Math.round(r.avgScore); hasScore = true; }
    }

    if (!hasScore) {
      try {
        const q = query(collection(db, "products"), where("productName", "==", productName), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const p = snap.docs[0].data();
          brand = p.brand || brand;
          productImage = p.adminImage || p.image || productImage;
          const ing = p.ingredients || "";
          if (ing.trim().length > 10) {
            const r = analyzeIngredients(ing);
            if (r.avgScore != null) { poreScore = Math.round(r.avgScore); hasScore = true; }
          }
        }
      } catch {}
    }
    return { type: "product", productName, brand, productImage, poreScore, hasScore };
  }

  async function shareToGroup(group) {
    if (!user?.uid) { alert("Please sign in to share products"); return; }
    if (!group?.id) return;
    try {
      const payload = await buildProductPayload();
      const profileSnap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      const me = profileSnap?.exists() ? profileSnap.data() : {};
      await sendToConversation(group.id, user.uid, {
        ...payload,
        senderName: me.displayName || user.displayName || "",
        senderPhoto: me.photoURL || user.photoURL || "",
      });
      const groupTitle = (group.name || "").trim() || "the group";
      setSent(groupTitle);
      setTimeout(onClose, 1400);
    } catch(e) {
      console.error("share to group failed", e);
      alert("Failed to send: " + (e?.message || "unknown error"));
    }
  }

  async function shareToUser(toUser) {
    if (!user?.uid) { alert("Please sign in to share products"); return; }
    if (!toUser?.uid) { alert("Could not find that user — please try again"); return; }
    try {
      const payload = await buildProductPayload();
      await sendMessage(user.uid, toUser.uid, payload);
      setSent(toUser.displayName?.split(" ")[0] || "them");
      setTimeout(onClose, 1400);
    } catch(e) {
      console.error("share failed", e);
      alert("Failed to send: " + (e?.message || "unknown error"));
    }
  }

  const displayList = searchQ.trim() ? searchResults : following;
  const filtered = displayList.filter(u =>
    !searchQ.trim() || u.displayName?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return ReactDOM.createPortal(
    <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0, zIndex:19000, background:"rgba(0,0,0,0.45)", display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center" }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:"480px", background:T.surface, borderRadius:"1.25rem 1.25rem 0 0", padding:"1rem 1rem calc(1rem + env(safe-area-inset-bottom))", maxHeight:"65vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div style={{ width:"36px", height:"4px", borderRadius:"2px", background:T.border, margin:"0 auto 0.9rem" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
          <div>
            <div style={{ fontSize:"0.95rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif" }}>Share product</div>
            <div style={{ fontSize:"0.7rem", color:T.textLight, fontFamily:"'Inter',sans-serif", marginTop:"1px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"260px" }}>{product.productName || product.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.textLight }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {sent ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:"0.5rem" }}>
            <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:T.sage+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize:"0.88rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif" }}>Sent to {sent}!</div>
          </div>
        ) : (
          <>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search a name to start a new chat…"
              style={{ padding:"0.55rem 0.85rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"0.82rem", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surfaceAlt, outline:"none", marginBottom:"0.75rem" }}/>
            <div style={{ overflowY:"auto", flex:1 }}>
              {loading && <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>Loading…</div>}

              {!loading && !searchQ.trim() && groups.length > 0 && (
                <>
                  <div style={{ fontSize:"0.6rem", fontWeight:"700", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.12em", margin:"0.25rem 0 0.5rem", fontFamily:"'Inter',sans-serif" }}>Your groups</div>
                  {groups.map((g, i) => {
                    const title = (g.name || "").trim() || `Group of ${g.participants?.length || 0}`;
                    return (
                      <button key={g.id} onClick={() => shareToGroup(g)}
                        style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.75rem 0.5rem", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}30` : "none", cursor:"pointer", textAlign:"left", borderRadius:"0.5rem" }}
                        onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                        onMouseLeave={e=>e.currentTarget.style.background="none"}>
                        <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:T.accent+"18", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, fontSize:"1rem" }}>👥</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:"0.85rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{title}</div>
                          <div style={{ fontSize:"0.65rem", color:T.textLight, fontFamily:"'Inter',sans-serif" }}>{g.participants?.length || 0} people</div>
                        </div>
                        <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:T.navy, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                        </div>
                      </button>
                    );
                  })}
                  <div style={{ fontSize:"0.6rem", fontWeight:"700", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.12em", margin:"1.1rem 0 0.5rem", fontFamily:"'Inter',sans-serif" }}>People</div>
                </>
              )}

              {!loading && filtered.length === 0 && groups.length === 0 && (
                <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>
                  {searchQ.trim() ? "No users found" : following.length === 0 ? "Search for someone to share with" : "No matches"}
                </div>
              )}
              {filtered.map((u, i) => (
                <button key={u.uid} onClick={() => shareToUser(u)}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.75rem 0.5rem", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}30` : "none", cursor:"pointer", textAlign:"left", borderRadius:"0.5rem" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <Avatar photoURL={u.photoURL} name={u.displayName} size={38}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif" }}>{u.displayName}</div>
                  </div>
                  <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:T.navy, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  , document.body);
}
