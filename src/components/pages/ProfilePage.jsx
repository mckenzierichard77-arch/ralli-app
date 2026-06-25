import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import {
  getDocs, getDoc, doc, query, collection, where, orderBy, limit,
  updateDoc, deleteDoc, addDoc, arrayUnion, arrayRemove, serverTimestamp, writeBatch,
} from "firebase/firestore";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { signOut } from "firebase/auth";
import { T } from "../../data/tokens.js";
import { FOUNDERS, AMAZON_AFFILIATE_TAG } from "../../data/constants.js";
import { db, storage, auth } from "../../lib/firebase.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { getProductImage } from "../../lib/imageUtils.js";
import { isAdmin, isVA, enrichedByTag } from "../../lib/userUtils.js";
import { postScan, followUser, unfollowUser, queryFollowersOf, getUserPosts } from "../../lib/socialUtils.js";
import { useProductCache } from "../providers/ProductCacheProvider.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { ProductImage } from "../ui/ProductImage.jsx";
import { PlaceholderCard } from "../ui/ProductImage.jsx";
import { poreStyle } from "../shared/PoreScoreBadge.jsx";
import { PostCard } from "../shared/PostCard.jsx";
import { ProductModal } from "../shared/ProductModal.jsx";

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function getProductDisplayName(p) {
  if (!p) return "";
  const name  = p.productName || p.name || "";
  const brand = p.brand || "";
  if (!brand || !name) return name;
  const norm = s => (s||"").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
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

function isTestOrSeedAccount(user) {
  const name = (user?.displayName || "").trim();
  if (!name) return true;
  const lower = name.toLowerCase();
  if (lower === "skincare lover" || lower === "anonymous" || lower === "user" ||
      lower === "undefined" || lower === "null" || lower === "new user" ||
      lower === "rallier") return true;
  const TEST_PATTERNS = [/^test/i, /test\d/i, /^demo/i, /^user\d+$/i, /^placeholder/i];
  return TEST_PATTERNS.some(p => p.test(name));
}

function displayNameOf(user) {
  const raw = (user?.displayName || "").trim();
  if (!raw) return "Rallier";
  const lower = raw.toLowerCase();
  if (lower === "skincare lover" || lower === "anonymous" || lower === "user" || lower === "undefined" || lower === "null") {
    return "Rallier";
  }
  return raw;
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
  if (asin) return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_AFFILIATE_TAG||""}`;
  const name = (productName||"").trim();
  const br = (brand||"").trim();
  const q = encodeURIComponent(br ? `${br} ${name}` : name);
  return `https://www.amazon.com/s?k=${q}&i=beauty${tag}`;
}

let _productCache = null;
async function getProductCache() {
  if (_productCache) return _productCache;
  const snap = await getDocs(collection(db,"products"));
  _productCache = snap.docs.map(d=>({id:d.id,...d.data()}));
  setTimeout(()=>{ _productCache = null; }, 5*60*1000);
  return _productCache;
}

async function getShopProducts() {
  try {
    const snap = await getDocs(collection(db,"products"));
    const CAT_LIMIT = 15;
    const candidates = snap.docs
      .map(d => {
        const p = {id:d.id,...d.data()};
        if (p.ingredients && p.ingredients.trim().length > 10) {
          const live = analyzeIngredients(p.ingredients).avgScore;
          if (live != null) p.poreScore = Math.round(live);
        }
        return p;
      })
      .filter(p => {
        if (p.shopOverride) return true;
        const ing = (p.ingredients||"").trim();
        const buy = (p.buyUrl||"").trim();
        const img = p.adminImage || p.image || "";
        if (!img || !img.startsWith("http")) return false;
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
      const sorted = arr.sort((a,b) => { const d=(a.poreScore??99)-(b.poreScore??99); return d!==0?d:(b.communityRating||0)-(a.communityRating||0); });
      selected.push(...sorted.slice(0, CAT_LIMIT));
    });
    const seen=new Map(),deduped=[];
    for(const p of selected){const key=(p.productName||"").toLowerCase().replace(/[^a-z0-9]/g,"").trim();if(!key){deduped.push(p);continue;}if(!seen.has(key)){seen.set(key,p);deduped.push(p);}else{const ex=seen.get(key);if((p.scanCount||0)>(ex.scanCount||0)){deduped[deduped.indexOf(ex)]=p;seen.set(key,p);}}}
    return deduped;
  } catch { return []; }
}

async function deleteUserAccount(user) {
  const uid = user.uid;
  try {
    const postsSnap = await getDocs(query(collection(db,"posts"), where("uid","==",uid)));
    const batch1 = writeBatch(db);
    postsSnap.docs.forEach(d => batch1.delete(d.ref));
    await batch1.commit();
    const scansSnap = await getDocs(query(collection(db,"scans"), where("uid","==",uid)));
    const batch2 = writeBatch(db);
    scansSnap.docs.forEach(d => batch2.delete(d.ref));
    await batch2.commit();
    const notifsTo = await getDocs(query(collection(db,"notifications"), where("toUid","==",uid)));
    const notifsFrom = await getDocs(query(collection(db,"notifications"), where("fromUid","==",uid)));
    const batch3 = writeBatch(db);
    [...notifsTo.docs, ...notifsFrom.docs].forEach(d => batch3.delete(d.ref));
    await batch3.commit();
    await deleteDoc(doc(db,"users",uid));
    await user.delete();
    return { success: true };
  } catch(e) {
    if (e.code === "auth/requires-recent-login") {
      return { success: false, needsReauth: true };
    }
    return { success: false, error: e.message };
  }
}

function analyzeRoutine(routine, shopProducts) {
  if (!routine || !routine.length) return null;
  const results = routine.map(name => {
    const nameLow = name.toLowerCase().trim();
    const product = shopProducts.find(p => p.productName?.toLowerCase() === nameLow)
      || shopProducts.find(p => (p.productName||"").toLowerCase().includes(nameLow))
      || shopProducts.find(p => nameLow.includes((p.productName||"").toLowerCase()))
      || shopProducts.find(p => {
        const pWords = (p.productName||"").toLowerCase().split(" ").filter(w=>w.length>3);
        const nWords = nameLow.split(" ").filter(w=>w.length>3);
        return pWords.length > 0 && pWords.filter(w=>nWords.includes(w)).length >= Math.min(2,pWords.length);
      });
    if (!product?.ingredients) return { name, score: null, poreScore: null, flagged: [], irritants: [], totalIngredients: 0 };
    const res = analyzeIngredients(product.ingredients);
    const displayPoreScore = Math.round(res.avgScore ?? 0);
    const totalIngredients = (product.ingredients || "").split(",").filter(t => t.trim()).length;
    return {
      name,
      poreScore: displayPoreScore,
      flagged: (res.poreCloggers||[]).sort((a,b)=>b.score-a.score),
      irritants: (res.irritants||[]),
      totalIngredients,
      hasData: true,
    };
  });
  const withData = results.filter(r => r.hasData);
  if (!withData.length) return { results, overall: null, grade: null, gradeColor: T.textLight, label: "Add products with ingredients", withData: 0, productCount: 0, toWatchCount: 0, toWatchList: [], totalIngredients: 0, overlaps: [] };
  const avg = withData.reduce((s,r) => s + (r.poreScore||0), 0) / withData.length;
  const baseScore = Math.max(0, 10 - avg * 2);
  const ingredientMap = new Map();
  withData.forEach(r => {
    (r.flagged || []).forEach(f => {
      const key = f.name.toLowerCase();
      const prev = ingredientMap.get(key);
      if (prev) { prev.count += 1; prev.score = Math.max(prev.score, f.score || 0); }
      else { ingredientMap.set(key, { name: f.name, count: 1, score: f.score || 0 }); }
    });
  });
  const highRiskOverlaps = [...ingredientMap.values()]
    .filter(o => o.count >= 2 && o.score >= 3)
    .sort((a, b) => b.score - a.score || b.count - a.count);
  const overlapPenalty = Math.min(highRiskOverlaps.length * 0.7, 2.5);
  const overall = Math.max(0, Math.min(10, baseScore - overlapPenalty));
  const grade = overall >= 9.0 ? "A" : overall >= 8.0 ? "B" : overall >= 7.0 ? "C" : overall >= 6.0 ? "D" : "F";
  const gradeColor = overall >= 8.0 ? T.sage : overall >= 7.0 ? T.amber : T.rose;
  const label = overall >= 9.0 ? "Skin-safe" : overall >= 8.0 ? "Strong routine" : overall >= 7.0 ? "Some concern" : overall >= 6.0 ? "Needs work" : "High risk";
  const totalIngredients = withData.reduce((s, r) => s + (r.totalIngredients || 0), 0);
  const toWatchMap = new Map();
  withData.forEach(r => {
    (r.flagged || []).forEach(f => {
      const key = f.name.toLowerCase();
      const prev = toWatchMap.get(key);
      if (prev) { prev.productCount += 1; prev.score = Math.max(prev.score, f.score || 0); }
      else { toWatchMap.set(key, { name: f.name, kind: "clog", score: f.score || 0, productCount: 1 }); }
    });
    (r.irritants || []).forEach(i => {
      const key = (i.name || "").toLowerCase();
      if (!key) return;
      const prev = toWatchMap.get(key);
      if (prev) { prev.productCount += 1; }
      else { toWatchMap.set(key, { name: i.name, kind: "irritate", score: 0, productCount: 1 }); }
    });
  });
  const toWatchList = [...toWatchMap.values()].sort((a, b) => (b.score || 0) - (a.score || 0) || b.productCount - a.productCount);
  const toWatchCount = toWatchList.length;
  return {
    results, overall: Math.round(overall * 10) / 10, grade, gradeColor, label,
    overlaps: highRiskOverlaps, withData: withData.length, baseScore: Math.round(baseScore * 10) / 10,
    overlapPenalty: Math.round(overlapPenalty * 10) / 10, totalIngredients, toWatchCount, toWatchList,
    productCount: withData.length,
  };
}

// ---------------------------------------------------------------------------
// CardReveal — intersection-observer fade-in wrapper
// ---------------------------------------------------------------------------
function CardReveal({children, delay=0}) {
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const el = ref.current; if(!el) return;
    const obs = new IntersectionObserver(([e])=>{
      if(e.isIntersecting){ el.classList.remove("card-hidden"); el.classList.add("card-visible"); obs.disconnect(); }
    },{threshold:0.08});
    obs.observe(el);
    return ()=>obs.disconnect();
  },[]);
  return <div ref={ref} className="card-hidden" style={{transitionDelay:`${delay}ms`}}>{children}</div>;
}

// ---------------------------------------------------------------------------
// ListItemImage — product image with Amazon fetch fallback
// ---------------------------------------------------------------------------
function ListItemImage({name, color}) {
  const [img, setImg] = useState(null);
  const [tried, setTried] = useState(false);

  useEffect(()=>{
    if (tried || !name) return;
    setTried(true);
    async function fetchImg() {
      try {
        const productBuyUrl = amazonUrl(name, "", "");
        const html = await (await fetch(productBuyUrl)).text();
        const matches = [...html.matchAll(/https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\._AC_[A-Z0-9_,]+_\.jpg/g)];
        const imgMatch = matches.find(m => !m[0].includes('_SR') && !m[0].includes('sprite'));
        if (imgMatch?.[0]) { setImg(imgMatch[0]); return; }
      } catch {}
    }
    fetchImg();
  },[name]);

  const words = name.trim().split(" ");
  const abbr = words.length>=2 ? words[0][0].toUpperCase()+words[1][0].toUpperCase() : name.slice(0,2).toUpperCase();

  return (
    <div style={{width:"100%",height:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {!img&&<PlaceholderCard name={name} brand=""  />}
      {img&&<img src={img} alt={name} style={{position:"absolute",top:0,left:0,right:0,bottom:0,width:"100%",height:"100%",objectFit:"contain",padding:"6px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={()=>setImg(null)}/>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ListSection — routine / want-to-try / not-for-me list UI
// ---------------------------------------------------------------------------
function ListSection({title, icon, color, items, onAdd, onRemove, isPrivate, onTogglePrivacy, readOnly, onItemTap, allProducts=[], layout="scroll"}) {
  const productCache = useProductCache();
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  function handleInput(val) {
    setInput(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    const matches = allProducts
      .filter(p => p.productName && (
        p.productName.toLowerCase().includes(q) ||
        (p.brand||"").toLowerCase().includes(q)
      ))
      .slice(0, 6);
    setSuggestions(matches);
  }

  function submit(name) {
    const v = (name || input).trim();
    if (!v) return;
    onAdd(v); setInput(""); setAdding(false); setSuggestions([]);
  }

  const visibleItems = expanded ? items : items;

  return (
    <div style={{marginBottom:"1.75rem",background:T.surface,borderRadius:"1.25rem",border:`1.5px solid ${color}22`,overflow:"hidden",boxShadow:`0 2px 12px ${color}10`}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem 0.75rem",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:color,flexShrink:0}}/>
          <span style={{fontSize:"0.75rem",fontWeight:"700",color:T.navy,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif"}}>{title}</span>
          {items.length>0&&<span style={{fontSize:"0.65rem",background:color+"20",color:color,borderRadius:"999px",padding:"0.1rem 0.5rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>{items.length}</span>}
          {isPrivate&&<span style={{fontSize:"0.58rem",color:T.textLight,background:T.surfaceAlt,borderRadius:"999px",padding:"0.1rem 0.4rem",border:`1px solid ${T.border}`}}>Private</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
          {!readOnly&&onTogglePrivacy&&(
            <button onClick={onTogglePrivacy} title={isPrivate?"Make public":"Make private"}
              style={{background:"none",border:"none",cursor:"pointer",padding:"0.2rem",color:isPrivate?T.accent:T.textLight,display:"flex",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.color=color}
              onMouseLeave={e=>e.currentTarget.style.color=isPrivate?T.accent:T.textLight}>
              {isPrivate
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              }
            </button>
          )}
          {!readOnly&&(
            <button onClick={()=>setAdding(a=>!a)}
              style={{width:"26px",height:"26px",borderRadius:"50%",background:adding?color:color+"15",border:`1.5px solid ${adding?color:color+"30"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:adding?"#FFFFFF":color,transition:"all 0.15s",padding:0,flexShrink:0}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform:adding?"rotate(45deg)":"none",transition:"transform 0.2s"}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
        </div>
      </div>

      {adding&&(
        <div style={{padding:"0.65rem 1rem",borderBottom:`1px solid ${T.border}`,position:"relative"}}>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <input value={input} onChange={e=>handleInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")submit();if(e.key==="Escape"){setAdding(false);setInput("");setSuggestions([]);}}}
              placeholder="Search products…" autoFocus
              style={{flex:1,padding:"0.55rem 0.8rem",borderRadius:"0.6rem",border:`1.5px solid ${color}`,fontSize:"0.82rem",color:T.text,background:"#fff",outline:"none",fontFamily:"'Inter',sans-serif"}}/>
            <button onClick={()=>submit()} disabled={!input.trim()}
              style={{padding:"0.55rem 0.9rem",background:input.trim()?color:T.surfaceAlt,color:input.trim()?"#FFFFFF":T.textLight,border:"none",borderRadius:"0.6rem",fontSize:"0.8rem",fontWeight:"600",cursor:input.trim()?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif"}}>
              Add
            </button>
          </div>
          {suggestions.length>0&&(
            <div style={{position:"absolute",top:"calc(100% + 2px)",left:"1rem",right:"1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.65rem",zIndex:100,overflow:"hidden",boxShadow:"0 6px 20px rgba(0,0,0,0.1)"}}>
              {suggestions.map((p,i)=>(
                <button key={i} onClick={()=>submit(p.productName)}
                  style={{width:"100%",padding:"0.5rem 0.75rem",background:"transparent",border:"none",borderBottom:i<suggestions.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"0.5rem",fontFamily:"'Inter',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:"32px",height:"32px",borderRadius:"0.4rem",overflow:"hidden",flexShrink:0,background:T.surfaceAlt}}>
                    <ProductImage src={p.image||null} name={p.productName} brand={p.brand} size="full"/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                    <div style={{fontSize:"0.65rem",color:T.textLight}}>{p.brand}</div>
                  </div>
                </button>
              ))}
              {input.trim()&&!suggestions.find(p=>p.productName.toLowerCase()===input.toLowerCase())&&(
                <button onClick={()=>submit(input.trim())}
                  style={{width:"100%",padding:"0.5rem 0.8rem",background:color+"0a",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",textAlign:"left",fontSize:"0.75rem",color,fontWeight:"600",fontFamily:"'Inter',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background=color+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background=color+"0a"}>
                  + Add "{input.trim()}" manually
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {items.length > 0 ? (
        <div style={layout === "grid"
          ? {display:"grid",gridTemplateColumns:"repeat(3, minmax(0, 1fr))",gap:"0.6rem",padding:"0.85rem 1rem",alignItems:"stretch"}
          : {overflowX:"auto",scrollbarWidth:"none",msOverflowStyle:"none",WebkitOverflowScrolling:"touch",padding:"0.85rem 1rem",display:"flex",gap:"0.65rem",alignItems:"stretch"}
        }>
          {items.map((item,i)=>{
            const prod = productCache.get(item)
              || allProducts.find(p=>(p.productName||"").toLowerCase()===item.toLowerCase())
              || allProducts.find(p=>(p.productName||"").toLowerCase().includes(item.toLowerCase().split(" ").slice(0,2).join(" ")));
            const _cardIng = prod?.ingredients || "";
            const _cardScore = _cardIng.trim()
              ? Math.round(analyzeIngredients(_cardIng).avgScore ?? 0)
              : (prod?.poreScore ?? null);
            const ps = _cardScore != null ? poreStyle(_cardScore) : null;
            const imgSrc = getProductImage(prod);
            const hasImg = imgSrc.startsWith("http");
            const cardStyle = layout === "grid"
              ? {background:"#fff",borderRadius:"1rem",border:`1px solid ${T.border}`,cursor:onItemTap?"pointer":"default",display:"flex",flexDirection:"column",overflow:"hidden",transition:"border-color 0.15s,box-shadow 0.15s",position:"relative",minWidth:0}
              : {flexShrink:0,width:"110px",background:"#fff",borderRadius:"1rem",border:`1px solid ${T.border}`,cursor:onItemTap?"pointer":"default",display:"flex",flexDirection:"column",overflow:"hidden",transition:"border-color 0.15s,box-shadow 0.15s",position:"relative"};
            const imageStyle = layout === "grid"
              ? {width:"100%",aspectRatio:"1 / 1",background:hasImg?"#fff":color+"10",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",borderBottom:`1px solid ${T.border}`}
              : {width:"100%",height:"90px",background:hasImg?"#fff":color+"10",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",borderBottom:`1px solid ${T.border}`};
            return (
              <div key={i} onClick={()=>onItemTap&&onItemTap(item)}
                style={cardStyle}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.boxShadow=`0 4px 16px ${color}25`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}>
                {!readOnly&&(
                  <button onClick={e=>{e.stopPropagation();onRemove(item);}}
                    style={{position:"absolute",top:"5px",right:"5px",width:"18px",height:"18px",borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,padding:0,lineHeight:1,transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.rose;e.currentTarget.style.borderColor=T.rose;e.currentTarget.querySelector("svg").style.stroke="#fff";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.9)";e.currentTarget.style.borderColor=T.border;e.currentTarget.querySelector("svg").style.stroke=T.textLight;}}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
                <div style={imageStyle}>
                  {hasImg
                    ? <img src={imgSrc} style={{width:"100%",height:"100%",objectFit:"contain",padding:"8px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>{e.target.style.display="none";}}/>
                    : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",padding:"0.5rem"}}>
                        <div style={{width:"28px",height:"28px",borderRadius:"50%",background:color+"25",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <div style={{width:"10px",height:"10px",borderRadius:"50%",background:color}}/>
                        </div>
                      </div>
                  }
                </div>
                <div style={{padding:"0.5rem 0.55rem",flex:1,display:"flex",flexDirection:"column",gap:"0.2rem"}}>
                  {prod?.brand&&<div style={{fontSize:"0.52rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.brand}</div>}
                  <div style={{fontSize:"0.7rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.25,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{getProductDisplayName({productName: item, brand: prod?.brand||""})}</div>
                  {ps&&(
                    <div style={{marginTop:"auto",display:"inline-flex",alignItems:"center",gap:"2px",background:ps.color+"15",borderRadius:"999px",padding:"0.12rem 0.4rem",alignSelf:"flex-start"}}>
                      <span style={{fontSize:"0.6rem",fontWeight:"800",color:ps.color}}>{_cardScore}/5</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!readOnly&&(
            <div onClick={()=>setAdding(a=>!a)}
              style={layout === "grid"
                ? {borderRadius:"1rem",border:`1.5px dashed ${color}50`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.4rem",cursor:"pointer",transition:"all 0.15s",padding:"1rem 0.5rem",background:color+"05",minHeight:"100%",minWidth:0}
                : {flexShrink:0,width:"80px",borderRadius:"1rem",border:`1.5px dashed ${color}50`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.4rem",cursor:"pointer",transition:"all 0.15s",padding:"1rem 0.5rem",background:color+"05"}
              }
              onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=color+"12";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"50";e.currentTarget.style.background=color+"05";}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:color+"20",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <span style={{fontSize:"0.6rem",color:color,fontWeight:"600",fontFamily:"'Inter',sans-serif",textAlign:"center"}}>Add</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{padding:"1rem"}}>
          {!readOnly&&!adding&&(
            <button onClick={()=>setAdding(true)}
              style={{width:"100%",padding:"0.75rem",background:"transparent",border:`1.5px dashed ${color}40`,borderRadius:"0.75rem",color:T.textLight,fontSize:"0.78rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",textAlign:"center",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.color=color;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"40";e.currentTarget.style.color=T.textLight;}}>
              + Add your first product
            </button>
          )}
          {readOnly&&<div style={{color:T.textLight,fontSize:"0.78rem",fontStyle:"italic",padding:"0.25rem 0"}}>Nothing here yet</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AvatarCropModal — drag to reposition + zoom avatar
// ---------------------------------------------------------------------------
function AvatarCropModal({photoURL, initialOffsetX=50, initialOffsetY=50, initialScale=1, onSave, onClose}) {
  const [ox, setOx] = useState(initialOffsetX);
  const [oy, setOy] = useState(initialOffsetY);
  const [scale, setScale] = useState(initialScale);
  const dragStart = useRef(null);
  const containerRef = useRef(null);

  function onMouseDown(e) {
    e.preventDefault();
    dragStart.current = {x: e.clientX, y: e.clientY, ox, oy};
  }
  function onMouseMove(e) {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.current.x) / rect.width * 100;
    const dy = (e.clientY - dragStart.current.y) / rect.height * 100;
    setOx(Math.max(0, Math.min(100, dragStart.current.ox - dx)));
    setOy(Math.max(0, Math.min(100, dragStart.current.oy - dy)));
  }
  function onMouseUp() { dragStart.current = null; }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      dragStart.current = {x: e.touches[0].clientX, y: e.touches[0].clientY, ox, oy};
    }
  }
  function onTouchMove(e) {
    if (!containerRef.current) return;
    if (e.touches.length === 1 && dragStart.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (e.touches[0].clientX - dragStart.current.x) / rect.width * 100;
      const dy = (e.touches[0].clientY - dragStart.current.y) / rect.height * 100;
      setOx(Math.max(0, Math.min(100, dragStart.current.ox - dx)));
      setOy(Math.max(0, Math.min(100, dragStart.current.oy - dy)));
    }
  }
  function onTouchEnd() { dragStart.current = null; }

  const s = scale||1;
  const imgStyle = {
    width:"100%", height:"100%",
    objectFit:"cover",
    objectPosition:`${ox}% ${oy}%`,
    transform:`scale(${s})`,
    transformOrigin:`${ox}% ${oy}%`,
    userSelect:"none", pointerEvents:"none",
  };

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,0.75)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:"#fff",borderRadius:"1.25rem",padding:"1.25rem",width:"100%",maxWidth:"360px"}}>
        <div style={{fontSize:"0.6rem",letterSpacing:"0.15em",textTransform:"uppercase",color:T.textLight,fontFamily:"'Inter',sans-serif",fontWeight:"600",marginBottom:"0.75rem",textAlign:"center"}}>
          Position & Zoom
        </div>
        <div ref={containerRef}
          style={{width:"200px",height:"200px",borderRadius:"50%",overflow:"hidden",margin:"0 auto 1.25rem",cursor:"grab",position:"relative",background:T.surfaceAlt,border:`3px solid ${T.accent}`}}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <img src={photoURL} alt="" style={imgStyle} draggable={false}/>
        </div>
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.7rem",color:T.textMid,fontFamily:"'Inter',sans-serif",marginBottom:"0.35rem",textAlign:"center"}}>Zoom</div>
          <input type="range" min="1" max="3" step="0.05" value={scale}
            onChange={e=>setScale(parseFloat(e.target.value))}
            style={{width:"100%",accentColor:T.accent}}/>
        </div>
        <div style={{display:"flex",gap:"0.6rem"}}>
          <button onClick={onClose} style={{flex:1,padding:"0.65rem",borderRadius:"0.6rem",border:`1px solid ${T.border}`,background:"#fff",color:T.textMid,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={()=>onSave(ox,oy,scale)} style={{flex:2,padding:"0.65rem",borderRadius:"0.6rem",border:"none",background:T.accent,color:"#fff",fontSize:"0.82rem",fontWeight:"600",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RoutineScoreExplainer — bottom sheet explaining routine grade math
// ---------------------------------------------------------------------------
function RoutineScoreExplainer({ analysis, routine, onClose }) {
  if (!analysis) return null;
  const fillPct = Math.round((analysis.overall || 0) * 10);
  const ringBg = `conic-gradient(${analysis.gradeColor} 0% ${fillPct}%, ${T.border} ${fillPct}% 100%)`;
  const cleanCount = Math.max(0, (analysis.totalIngredients || 0) - (analysis.toWatchCount || 0));
  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9000,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div onClick={onClose} style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)"}}/>
      <div style={{position:"relative",width:"100%",maxWidth:"480px",background:T.surface,borderRadius:"1.25rem 1.25rem 0 0",padding:"1.4rem 1.25rem",maxHeight:"85vh",overflowY:"auto",zIndex:1,paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))",fontFamily:"'Inter',sans-serif"}}>
        <div style={{width:"36px",height:"4px",background:T.border,borderRadius:"2px",margin:"0 auto 1.2rem"}}/>
        <button onClick={onClose} style={{position:"absolute",top:"0.9rem",right:"0.9rem",background:T.surfaceAlt,border:"none",cursor:"pointer",width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",color:T.textMid,padding:0}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>

        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.1rem"}}>
          <div style={{width:"86px",height:"86px",borderRadius:"50%",background:ringBg,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <div style={{width:"72px",height:"72px",borderRadius:"50%",background:T.surface,display:"flex",alignItems:"center",justifyContent:"center"}}>
              <div style={{fontSize:"2.2rem",fontWeight:"800",color:analysis.gradeColor,lineHeight:1,letterSpacing:"-0.04em"}}>{analysis.grade}</div>
            </div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.65rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em"}}>Routine Score</div>
            <div style={{fontSize:"1.15rem",fontWeight:"700",color:T.text,marginTop:"3px",letterSpacing:"-0.02em"}}>{analysis.label}</div>
            <div style={{fontSize:"0.75rem",color:T.textLight,marginTop:"4px"}}>{analysis.productCount} product{analysis.productCount===1?"":"s"} · {analysis.totalIngredients} ingredient{analysis.totalIngredients===1?"":"s"} · {analysis.overall}/10</div>
          </div>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.55rem",marginBottom:"0.85rem"}}>
          <div style={{background:"#E7F3EC",borderRadius:"0.85rem",padding:"0.85rem"}}>
            <div style={{color:T.sage,marginBottom:"0.3rem",lineHeight:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{fontSize:"1.3rem",fontWeight:"800",color:T.sage,lineHeight:1,letterSpacing:"-0.03em"}}>{cleanCount}</div>
            <div style={{fontSize:"0.7rem",color:T.textMid,marginTop:"4px"}}>Clean ingredients</div>
          </div>
          <div style={{background:"#FBF1DE",borderRadius:"0.85rem",padding:"0.85rem"}}>
            <div style={{color:T.amber,marginBottom:"0.3rem",lineHeight:0}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div style={{fontSize:"1.3rem",fontWeight:"800",color:T.amber,lineHeight:1,letterSpacing:"-0.03em"}}>{analysis.toWatchCount}</div>
            <div style={{fontSize:"0.7rem",color:T.textMid,marginTop:"4px"}}>To watch</div>
          </div>
        </div>

        {analysis.toWatchList?.length > 0 && (
          <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"0.35rem 0.85rem",marginBottom:"0.85rem"}}>
            <div style={{fontSize:"0.62rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",padding:"0.7rem 0 0.5rem"}}>To watch</div>
            {analysis.toWatchList.map((item, i) => {
              const isLast = i === analysis.toWatchList.length - 1;
              const kindColor = item.kind === "clog" ? T.rose : T.amber;
              const kindLabel = item.kind === "clog" ? "may clog" : "may irritate";
              return (
                <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.55rem 0",borderTop:`1px solid ${T.border}`,gap:"0.5rem"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.82rem",fontWeight:"600",color:T.text,textTransform:"capitalize",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.name}</div>
                    {item.productCount > 1 && (
                      <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>In {item.productCount} products</div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0}}>
                    <div style={{fontSize:"0.68rem",color:kindColor,fontWeight:"600"}}>{kindLabel}</div>
                    {item.kind === "clog" && item.score > 0 && (
                      <div style={{fontSize:"0.72rem",fontWeight:"700",color:kindColor}}>{item.score}/5</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <button onClick={onClose} style={{width:"100%",padding:"0.9rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.75rem",fontSize:"0.9rem",fontWeight:"700",cursor:"pointer",letterSpacing:"-0.01em",marginTop:"0.3rem"}}>
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
}

// ---------------------------------------------------------------------------
// RoutineScore — routine grade card with breakdown
// ---------------------------------------------------------------------------
function RoutineScore({routine, shopProducts, onShareRoutine, compact}) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExplainer, setShowExplainer] = useState(false);

  const analysis = React.useMemo(
    () => analyzeRoutine(routine, shopProducts),
    [routine, shopProducts]
  );

  async function handleShare() {
    setSharing(true);
    try {
      const lines = [
        `✨ My Ralli by GoodSisters Skincare Routine Score: ${analysis?.grade || "?"} (${analysis?.overall || "?"}/10)`,
        `"${analysis?.label}"`,
        ``,
        `📋 Products (${routine.length}):`,
        ...routine.map(name => {
          const r = analysis?.results?.find(r => r.name === name);
          return `• ${name}${r?.poreScore != null ? ` — pore clog score ${r.poreScore}/5` : ""}`;
        }),
        ``,
        `🔍 Analyzed on Ralli by GoodSisters`,
      ].join("\n");
      if (navigator.share) {
        await navigator.share({ title: "My Ralli by GoodSisters Routine Score", text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {}
    setSharing(false);
  }

  if (!routine.length) {
    if (compact) return null;
    return (
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem 1.25rem",marginBottom:"1rem",textAlign:"center"}}>
        <div style={{fontSize:"0.82rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Add products to your routine to see your score</div>
      </div>
    );
  }

  if (compact) {
    const grade = analysis?.grade;
    const gradeColor = analysis?.gradeColor || T.sage;
    async function handleShareScore() {
      const text = analysis
        ? `✨ My Ralli Routine Score: ${analysis.grade} (${analysis.overall}/10)\n"${analysis.label}"\n${routine.length} products in my routine\n\nCheck yours at https://app.theralliapp.com`
        : `I'm building my skincare routine on Ralli — come join me!\nhttps://app.theralliapp.com`;
      try {
        if (navigator.share) {
          await navigator.share({ title: "My Ralli Routine Score", text });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        }
      } catch(e) {}
    }
    return (
      <>
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem 1.1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:"1rem"}}>
        <button onClick={()=>setShowExplainer(true)} title="How is this calculated?"
          style={{background:"none",border:"none",padding:0,cursor:"pointer",lineHeight:0.9,minWidth:"44px",textAlign:"center"}}>
          {grade
            ? <div style={{fontSize:"2.7rem",fontWeight:"800",color:gradeColor,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.04em"}}>{grade}</div>
            : <div style={{fontSize:"1.4rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>—</div>
          }
        </button>
        <button onClick={()=>setShowExplainer(true)} style={{background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left",flex:1,fontFamily:"'Inter',sans-serif",minWidth:0}}>
          <div style={{fontSize:"0.62rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"4px"}}>Routine Score</div>
          {analysis ? (
            <div style={{fontSize:"0.88rem",fontWeight:"500",color:T.text,letterSpacing:"-0.01em",overflow:"hidden",textOverflow:"ellipsis"}}>
              {analysis.label} <span style={{color:T.textLight,margin:"0 4px"}}>·</span> <span style={{color:T.textMid,fontWeight:"500"}}>{analysis.overall}/10</span>
            </div>
          ) : (
            <div style={{fontSize:"0.88rem",fontWeight:"500",color:T.textLight}}>
              {routine.length === 0 ? "Add products to your routine" : "Loading…"}
            </div>
          )}
        </button>
        <div style={{display:"flex",flexDirection:"column",gap:"0.25rem",alignItems:"center",flexShrink:0}}>
          <button onClick={()=>setShowExplainer(true)} title="How is this calculated?"
            style={{background:"none",border:"none",cursor:"pointer",padding:"0.3rem",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",transition:"background 0.15s",color:T.textLight}}
            onMouseEnter={e=>{e.currentTarget.style.background=T.surfaceAlt;}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
          </button>
          {analysis && (
            <button onClick={handleShareScore} title="Share my routine score"
              style={{background:"none",border:"none",cursor:"pointer",padding:"0.3rem",display:"flex",alignItems:"center",justifyContent:"center",borderRadius:"50%",transition:"background 0.15s",color:T.textLight}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.surfaceAlt;e.currentTarget.style.color=T.navy;}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.textLight;}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          )}
        </div>
      </div>
      {showExplainer && <RoutineScoreExplainer analysis={analysis} routine={routine} onClose={()=>setShowExplainer(false)}/>}
      </>
    );
  }

  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",marginBottom:"1rem",overflow:"hidden"}}>
      <div style={{padding:"1rem 1.25rem",display:"flex",alignItems:"center",gap:"1rem"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:"0.7rem",color:T.textLight,fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"2px"}}>Routine Score</div>
          <div style={{fontSize:"0.88rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>
            {analysis ? analysis.label : routine.length === 0 ? "Add products to your routine" : "Loading…"}
          </div>
          {analysis?.overlaps?.length > 0 && (
            <button onClick={()=>setShowExplainer(true)} style={{background:"none",border:"none",padding:0,marginTop:"3px",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
              <div style={{fontSize:"0.72rem",color:T.amber}}>
                ⚠ {analysis.overlaps.slice(0,2).map(o=>o.name).join(", ")}
                {analysis.overlaps.length>2 ? ` +${analysis.overlaps.length-2} more` : ""}
                {" "}in multiple products
              </div>
              <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"1px"}}>Tap to learn more →</div>
            </button>
          )}
        </div>
        {analysis?.overall != null ? (
          <div style={{textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:"2rem",fontWeight:"800",color:analysis.gradeColor,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{analysis.grade}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"2px"}}>{analysis.overall}/10</div>
          </div>
        ) : (
          <div style={{width:"44px",height:"44px",borderRadius:"50%",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <div style={{width:"20px",height:"20px",borderRadius:"50%",border:`2px solid ${T.textLight}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
          </div>
        )}
      </div>

      {analysis?.results && (
        <>
          <button onClick={() => setExpanded(e => !e)}
            style={{width:"100%",padding:"0.5rem 1.25rem",background:T.surfaceAlt,border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"'Inter',sans-serif",fontSize:"0.75rem",color:T.textMid}}>
            <span>{expanded ? "Hide breakdown" : `See breakdown (${routine.length} products)`}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {expanded && (
            <div style={{padding:"0.75rem 1rem"}}>
              {analysis.results.map((r,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.5rem 0",borderBottom:i<analysis.results.length-1?`1px solid ${T.border}`:"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.82rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                    {r.flagged?.length > 0 && (
                      <div style={{fontSize:"0.68rem",color:T.rose,marginTop:"2px",fontFamily:"'Inter',sans-serif"}}>
                        {r.flagged.slice(0,2).map(f=>f.name).join(", ")}
                      </div>
                    )}
                    {r.irritants?.length > 0 && (
                      <div style={{fontSize:"0.68rem",color:T.amber,marginTop:"1px",fontFamily:"'Inter',sans-serif"}}>
                        ⚠ {r.irritants.slice(0,2).map(f=>f.name).join(", ")}
                      </div>
                    )}
                    {!r.hasData && <div style={{fontSize:"0.68rem",color:T.textLight,fontStyle:"italic"}}>No ingredient data</div>}
                  </div>
                  {r.poreScore != null && (
                    <div style={{textAlign:"center",padding:"0.3rem 0.5rem",background:`${r.poreScore>=4?T.rose:r.poreScore>=2?T.amber:T.sage}14`,borderRadius:"0.5rem",flexShrink:0}}>
                      <div style={{fontSize:"0.85rem",fontWeight:"700",color:r.poreScore>=4?T.rose:r.poreScore>=2?T.amber:T.sage,lineHeight:1}}>{r.poreScore}</div>
                      <div style={{fontSize:"0.5rem",color:T.textLight}}>pore</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {analysis?.overall != null && (
        <div style={{padding:"0.5rem 1.25rem 1rem",display:"flex"}}>
          <button onClick={handleShare} disabled={sharing}
            style={{flex:1,padding:"0.6rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.8rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem",opacity:sharing?0.7:1}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            {copied ? "Copied!" : sharing ? "Sharing..." : "Share My Routine Score"}
          </button>
        </div>
      )}
      {showExplainer && <RoutineScoreExplainer analysis={analysis} routine={routine} onClose={()=>setShowExplainer(false)}/>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FounderByline — stacked avatar row with founder names
// ---------------------------------------------------------------------------
function FounderByline({onUserTap}) {
  const [founders, setFounders] = useState([]);

  useEffect(()=>{
    Promise.all(FOUNDERS.map(async f => {
      try {
        const q = query(collection(db,"users"), where("email","==",f.email), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { ...f, uid: snap.docs[0].id, photoURL: d.photoURL||"",
                   displayName: d.displayName||f.name,
                   offsetX: d.avatarOffsetX??50, offsetY: d.avatarOffsetY??50, scale: d.avatarScale??1 };
        }
      } catch {}
      return { ...f, uid: null, photoURL: "", displayName: f.name, offsetX:50, offsetY:50, scale:1 };
    })).then(setFounders);
  },[]);

  return (
    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
      <div style={{display:"flex"}}>
        {founders.length===0
          ? FOUNDERS.map((f,i)=>(
              <div key={i} style={{width:"26px",height:"26px",borderRadius:"50%",background:T.navy,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:i>0?"-6px":"0",border:"2px solid "+T.accentSoft}}>
                <span style={{fontSize:"0.65rem",color:"#fff",fontWeight:"600"}}>{f.initial}</span>
              </div>
            ))
          : founders.map((f,i)=>(
              <button key={f.email} onClick={()=>f.uid&&onUserTap&&onUserTap(f.uid)}
                style={{width:"26px",height:"26px",borderRadius:"50%",marginLeft:i>0?"-6px":"0",border:"2px solid "+T.accentSoft,padding:0,cursor:f.uid?"pointer":"default",overflow:"hidden",flexShrink:0,background:T.navy,display:"block"}}
                title={f.displayName}>
                <Avatar photoURL={f.photoURL} name={f.displayName} size={26}/>
              </button>
            ))
        }
      </div>
      <div style={{display:"flex",gap:"0.25rem",alignItems:"center"}}>
        {founders.length>0
          ? founders.map((f,i)=>(
              <React.Fragment key={f.email}>
                {i>0&&<span style={{fontSize:"0.65rem",color:T.navy,opacity:0.5}}>&</span>}
                <button onClick={()=>f.uid&&onUserTap&&onUserTap(f.uid)}
                  style={{background:"none",border:"none",padding:0,cursor:f.uid?"pointer":"default",fontSize:"0.65rem",color:T.navy,fontFamily:"'Inter',sans-serif",fontWeight:"600",opacity:0.8,textDecoration:f.uid?"underline":"none",textDecorationColor:"rgba(17,24,39,0.25)"}}>
                  {f.displayName.split(" ")[0]}
                </button>
              </React.Fragment>
            ))
          : <span style={{fontSize:"0.65rem",color:T.navy,fontFamily:"'Inter',sans-serif",fontWeight:"600",opacity:0.8}}>McKenzie & Morgan</span>
        }
        <span style={{fontSize:"0.65rem",color:T.navy,fontFamily:"'Inter',sans-serif",opacity:0.6}}>· Co-founders</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FounderLinks — founder profile cards (full or compact story mode)
// ---------------------------------------------------------------------------
function FounderLinks({onUserTap, inStory=false}) {
  const [profiles, setProfiles] = useState([]);

  useEffect(()=>{
    Promise.all(FOUNDERS.map(async f => {
      try {
        const q = query(collection(db,"users"), where("email","==",f.email), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { ...f, uid: snap.docs[0].id, photoURL: d.photoURL||"", displayName: d.displayName||f.name,
                   bio: d.bio||"", offsetX: d.avatarOffsetX??50, offsetY: d.avatarOffsetY??50, scale: d.avatarScale??1 };
        }
        return { ...f, uid: null, photoURL: "", displayName: f.name, bio: "", offsetX:50, offsetY:50, scale:1 };
      } catch { return { ...f, uid: null, photoURL: "", displayName: f.name, bio: "", offsetX:50, offsetY:50, scale:1 }; }
    })).then(setProfiles);
  },[]);

  if (inStory) {
    return (
      <div style={{display:"flex",gap:"0.5rem",marginTop:"0.85rem",paddingTop:"0.75rem",borderTop:"1px solid rgba(255,255,255,0.15)"}}>
        {profiles.map(f=>(
          <button key={f.email}
            onClick={()=>{ if(f.uid && onUserTap) onUserTap(f.uid); }}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",padding:"0.65rem 0.5rem",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"0.85rem",cursor:f.uid?"pointer":"default",textAlign:"center",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(f.uid)e.currentTarget.style.background="rgba(255,255,255,0.12)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";}}>
            <Avatar photoURL={f.photoURL} name={f.displayName} size={52}/>
            <div>
              <div style={{fontSize:"0.72rem",fontWeight:"600",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>{f.displayName}</div>
              <div style={{fontSize:"0.58rem",color:"rgba(207,232,255,0.7)",fontFamily:"'Inter',sans-serif",marginTop:"0.1rem"}}>Co-founder</div>
            </div>
            {f.uid&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(207,232,255,0.5)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={{marginTop:"0.75rem"}}>
      <div style={{fontSize:"0.55rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'Inter',sans-serif",fontWeight:"600",marginBottom:"0.4rem"}}>Founders</div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
        {profiles.map(f=>(
          <button key={f.email} onClick={()=>{ if(f.uid && onUserTap) onUserTap(f.uid); }}
            style={{width:"100%",display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0.75rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:f.uid?"pointer":"default",textAlign:"left",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(f.uid)e.currentTarget.style.borderColor=T.accent;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;}}>
            <Avatar photoURL={f.photoURL} name={f.displayName} size={40}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{f.displayName}</div>
              <div style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Co-founder, Ralli by GoodSisters</div>
            </div>
            {f.uid&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DeleteAccountModal — confirm + delete user data
// ---------------------------------------------------------------------------
function DeleteAccountModal({ user, onClose, onDeleted }) {
  const [step, setStep] = React.useState("confirm");
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState("");
  const CONFIRM_WORD = "DELETE";

  async function handleDelete() {
    if (typed !== CONFIRM_WORD) return;
    setStep("deleting");
    const result = await deleteUserAccount(user);
    if (result.success) {
      setStep("done");
      setTimeout(() => onDeleted(), 1500);
    } else if (result.needsReauth) {
      setError("For security, please sign out and sign back in before deleting your account.");
      setStep("confirm");
    } else {
      setError(result.error || "Something went wrong. Please try again.");
      setStep("confirm");
    }
  }

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:T.bg,borderRadius:"1.5rem 1.5rem 0 0",padding:"1.5rem 1.25rem 2.5rem",width:"100%",maxWidth:"480px",boxShadow:"0 -4px 32px rgba(0,0,0,0.15)"}}>
        {step === "done" ? (
          <div style={{textAlign:"center",padding:"2rem 0"}}>
            <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>👋</div>
            <div style={{fontSize:"1.1rem",fontWeight:"700",color:T.text,marginBottom:"0.4rem",fontFamily:"'Inter',sans-serif"}}>Account deleted</div>
            <div style={{fontSize:"0.82rem",color:T.textLight}}>All your data has been removed.</div>
          </div>
        ) : step === "deleting" ? (
          <div style={{textAlign:"center",padding:"2rem 0"}}>
            <div style={{width:"32px",height:"32px",border:`3px solid ${T.rose}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 1rem"}}/>
            <div style={{fontSize:"0.88rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>Deleting your account…</div>
          </div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1.25rem"}}>
              <div style={{width:"42px",height:"42px",borderRadius:"50%",background:T.rose+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.rose} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </div>
              <div>
                <div style={{fontSize:"1rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>Delete account</div>
                <div style={{fontSize:"0.72rem",color:T.textLight}}>This cannot be undone</div>
              </div>
            </div>

            <div style={{background:T.rose+"0F",border:`1px solid ${T.rose}22`,borderRadius:"0.75rem",padding:"0.85rem 1rem",marginBottom:"1.25rem"}}>
              <div style={{fontSize:"0.78rem",color:T.textMid,lineHeight:1.6,fontFamily:"'Inter',sans-serif"}}>
                <strong style={{color:T.rose}}>This will permanently delete:</strong>
                <ul style={{margin:"0.4rem 0 0",paddingLeft:"1.1rem",display:"flex",flexDirection:"column",gap:"0.15rem"}}>
                  <li>Your profile and skin data</li>
                  <li>All your posts and scans</li>
                  <li>Your lists and routines</li>
                </ul>
              </div>
            </div>

            <div style={{marginBottom:"1rem"}}>
              <div style={{fontSize:"0.75rem",color:T.textMid,marginBottom:"0.4rem",fontFamily:"'Inter',sans-serif"}}>
                Type <strong style={{color:T.rose,letterSpacing:"0.05em"}}>DELETE</strong> to confirm
              </div>
              <input
                value={typed}
                onChange={e=>{ setTyped(e.target.value.toUpperCase()); setError(""); }}
                placeholder="DELETE"
                autoFocus
                style={{width:"100%",padding:"0.75rem 1rem",border:`2px solid ${typed===CONFIRM_WORD?T.rose:T.border}`,borderRadius:"0.65rem",fontSize:"0.95rem",fontFamily:"monospace",letterSpacing:"0.1em",color:T.text,background:T.bg,outline:"none",boxSizing:"border-box",transition:"border-color 0.15s"}}
              />
              {error && <div style={{fontSize:"0.72rem",color:T.rose,marginTop:"0.4rem",fontFamily:"'Inter',sans-serif"}}>{error}</div>}
            </div>

            <div style={{display:"flex",gap:"0.5rem"}}>
              <button onClick={handleDelete} disabled={typed!==CONFIRM_WORD}
                style={{flex:1,padding:"0.75rem",background:typed===CONFIRM_WORD?T.rose:"#ccc",color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"700",cursor:typed===CONFIRM_WORD?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif",transition:"background 0.15s"}}>
                Delete my account
              </button>
              <button onClick={onClose}
                style={{padding:"0.75rem 1.1rem",background:"transparent",color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.65rem",fontSize:"0.85rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FollowingList — list of users the current user is following
// ---------------------------------------------------------------------------
function FollowingList({uids, currentUid, onUserTap, onUnfollow}) {
  const [users, setUsers] = useState([]);
  const [unfollowed, setUnfollowed] = useState(new Set());

  useEffect(()=>{
    if (!uids.length) return;
    Promise.all(uids.map(uid=>
      getDoc(doc(db,"users",uid)).then(d=>d.exists()?{uid:d.id,...d.data()}:null).catch(()=>null)
    )).then(results=>setUsers(results.filter(Boolean)));
  },[uids.join(",")]);

  if (!users.length) return <div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.78rem"}}>Loading…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      {users.filter(u=>!unfollowed.has(u.uid)).map(u=>(
        <div key={u.uid} style={{background:T.surface,borderRadius:"0.85rem",border:`1px solid ${T.border}`,padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div onClick={()=>onUserTap(u.uid)} style={{cursor:"pointer",flexShrink:0}}>
            <Avatar photoURL={u.photoURL} name={displayNameOf(u)} size={40}/>
          </div>
          <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUserTap(u.uid)}>
            <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayNameOf(u)}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>{(u.followers||[]).length} followers</div>
          </div>
          <button onClick={async()=>{ await onUnfollow(u.uid); setUnfollowed(prev=>new Set([...prev,u.uid])); }}
            style={{padding:"0.35rem 0.75rem",background:"transparent",color:T.textLight,border:`1px solid ${T.border}`,borderRadius:"999px",fontSize:"0.7rem",fontWeight:"500",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
            Unfollow
          </button>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PeopleFinder — Find Friends tab
// ---------------------------------------------------------------------------
function PeopleFinder({ user, profile, onUpdate, onUserTap }) {
  const [search, setSearch]       = useState("");
  const [results, setResults]     = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [skinMatches, setSkinMatches] = useState([]);
  const [followed, setFollowed]   = useState(new Set());
  const [loading, setLoading]     = useState(false);
  const [following, setFollowing] = useState(profile?.following || []);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const FOUNDER_UIDS = [
          "rNOrHLZzbXOAh58uB1tv6OXoWEq2",
          "jXGCJEHLl8c0CGPBlU9963qFvb83",
        ];
        const FOUNDER_EMAILS = [
          "mckenzierichard77@gmail.com",
          "morganrichard777@gmail.com",
        ];

        const founderDocs = await Promise.all(
          FOUNDER_UIDS
            .filter(uid => uid !== user.uid)
            .map(async uid => {
              try {
                const snap = await getDoc(doc(db, "users", uid));
                if (snap.exists()) return { uid, ...snap.data(), _isFounder: true };
              } catch {}
              return null;
            })
        );
        const founders = founderDocs.filter(Boolean);

        const allSnap = await getDocs(query(collection(db, "users"), limit(40)));
        const allUsers = allSnap.docs.map(d => ({ uid: d.id, ...d.data() }));

        const followingSet = new Set(profile?.following || []);
        const mySkinTypes = Array.isArray(profile?.skinType)
          ? profile.skinType
          : profile?.skinType ? [profile.skinType] : [];

        const filtered = allUsers.filter(u =>
          u.uid !== user.uid &&
          !FOUNDER_UIDS.includes(u.uid) &&
          !FOUNDER_EMAILS.includes(u.email || "") &&
          !followingSet.has(u.uid) &&
          !isTestOrSeedAccount(u)
        );

        const sug = filtered.filter(u =>
          (u.followers || []).some(f => followingSet.has(f))
        );
        const fallback = filtered
          .filter(u => !sug.find(s => s.uid === u.uid))
          .sort((a, b) => (b.followers || []).length - (a.followers || []).length);

        const finalSuggested = [...founders, ...sug, ...fallback].slice(0, 10);
        setSuggested(finalSuggested);

        setSkinMatches(
          filtered.filter(u => {
            const t = Array.isArray(u.skinType) ? u.skinType : u.skinType ? [u.skinType] : [];
            return t.some(s => mySkinTypes.includes(s));
          }).slice(0, 8)
        );
      } catch (e) { console.error("[PeopleFinder] suggestion load failed:", e); }
    })();
  }, [user?.uid]);

  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    const q = search.toLowerCase();
    getDocs(query(collection(db,"users"), limit(50)))
      .then(snap => {
        const res = snap.docs.map(d=>({uid:d.id,...d.data()}))
          .filter(u => u.uid!==user.uid && !isTestOrSeedAccount(u) && (
            (u.displayName||"").toLowerCase().includes(q) ||
            (u.email||"").toLowerCase().includes(q)
          )).slice(0,15);
        setResults(res);
        setLoading(false);
      }).catch(()=>setLoading(false));
  }, [search]);

  const doFollow = async (uid, displayName, photoURL) => {
    await followUser(user.uid, uid, profile?.displayName||"Someone", profile?.photoURL||"");
    setFollowed(prev => new Set([...prev, uid]));
    const newFollowing = [...(profile?.following||[]), uid];
    onUpdate(p => ({...p, following: newFollowing}));
    setFollowing(newFollowing);
  };

  const UserRow = ({ u }) => {
    const isFollowed = followed.has(u.uid) || (profile?.following||[]).includes(u.uid);
    const shared = (u.followers||[]).filter(f=>(profile?.following||[]).includes(f)).length;
    const mySkinTypes = Array.isArray(profile?.skinType)?profile.skinType:profile?.skinType?[profile.skinType]:[];
    const theirTypes = Array.isArray(u.skinType)?u.skinType:u.skinType?[u.skinType]:[];
    const skinMatch = theirTypes.some(t=>mySkinTypes.includes(t));
    return (
      <div style={{background:T.surface,borderRadius:"0.85rem",border:`1px solid ${isFollowed?T.sage:T.border}`,padding:"0.75rem",display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.5rem",transition:"border-color 0.2s"}}>
        <button onClick={()=>onUserTap(u.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0}}><Avatar photoURL={u.photoURL} name={displayNameOf(u)} size={42}/></button>
        <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUserTap(u.uid)}>
          <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayNameOf(u)}</div>
          <div style={{fontSize:"0.68rem",color:T.textLight,marginTop:"2px",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
            {shared>0&&<span style={{color:T.accent,fontWeight:"600"}}>{shared} mutual</span>}
            {skinMatch&&<span style={{background:T.sage+"18",color:T.sage,padding:"0.1rem 0.4rem",borderRadius:"999px",fontWeight:"600",fontSize:"0.6rem"}}>Same skin type</span>}
            <span>{(u.followers||[]).length} followers</span>
          </div>
        </div>
        <button onClick={()=>!isFollowed&&doFollow(u.uid,u.displayName,u.photoURL)}
          style={{padding:"0.35rem 0.85rem",background:isFollowed?T.sage+"22":"transparent",color:isFollowed?T.sage:T.navy,border:`1.5px solid ${isFollowed?T.sage:T.navy}`,borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",cursor:isFollowed?"default":"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0,transition:"all 0.2s"}}>
          {isFollowed?"✓ Following":"Follow"}
        </button>
      </div>
    );
  };

  return (
    <div style={{paddingTop:"0.5rem"}}>
      <div style={{position:"relative",marginBottom:"1.25rem"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{position:"absolute",left:"0.85rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name…"
          style={{width:"100%",padding:"0.65rem 1rem 0.65rem 2.25rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
        {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textLight,padding:"2px"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
      </div>

      {search.trim()&&(
        <div style={{marginBottom:"1.5rem"}}>
          {loading&&<div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.8rem"}}>Searching…</div>}
          {!loading&&results.length===0&&<div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.8rem"}}>No users found for "{search}"</div>}
          {!loading&&results.map(u=><UserRow key={u.uid} u={u}/>)}
        </div>
      )}

      {!search.trim()&&(profile?.following||[]).length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>
            Following · {(profile?.following||[]).length}
          </div>
          <FollowingList uids={profile?.following||[]} currentUid={user.uid} onUserTap={onUserTap}
            onUnfollow={async uid=>{ await unfollowUser(user.uid,uid); onUpdate(p=>({...p,following:(p.following||[]).filter(f=>f!==uid)})); }}/>
        </div>
      )}

      {!search.trim()&&suggested.length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>
            {(profile?.following||[]).length>0?"People you might know":"Top members"}
          </div>
          {suggested.map(u=><UserRow key={u.uid} u={u}/>)}
        </div>
      )}

      {!search.trim()&&skinMatches.length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>Same skin type as you</div>
          <div style={{display:"flex",gap:"0.65rem",overflowX:"auto",paddingBottom:"0.5rem",scrollbarWidth:"none"}}>
            {skinMatches.map(u=>{
              const isFollowed = followed.has(u.uid)||(profile?.following||[]).includes(u.uid);
              return (
                <div key={u.uid} onClick={()=>onUserTap(u.uid)} style={{flexShrink:0,width:"130px",background:T.surface,borderRadius:"1rem",border:`1px solid ${isFollowed?T.sage:T.border}`,padding:"0.85rem 0.5rem 0.65rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",cursor:"pointer"}}>
                  <Avatar photoURL={u.photoURL} name={u.displayName} size={44}/>
                  <div style={{fontSize:"0.75rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",padding:"0 0.25rem"}}>{u.displayName}</div>
                  <div style={{fontSize:"0.6rem",color:T.textLight,textAlign:"center"}}>{Array.isArray(u.skinType)?u.skinType.join(", "):u.skinType||"Rallier"}</div>
                  <button onClick={e=>{e.stopPropagation();!isFollowed&&doFollow(u.uid,u.displayName,u.photoURL);}}
                    style={{marginTop:"0.15rem",padding:"0.3rem 0.75rem",background:isFollowed?T.sage+"22":T.accent,color:isFollowed?T.sage:"#fff",border:`1.5px solid ${isFollowed?T.sage:T.accent}`,borderRadius:"999px",fontSize:"0.68rem",fontWeight:"700",cursor:isFollowed?"default":"pointer",fontFamily:"'Inter',sans-serif"}}>
                    {isFollowed?"✓":"Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{background:`linear-gradient(135deg,${T.accent}12,${T.sage}10)`,borderRadius:"1rem",border:`1px solid ${T.accent}22`,padding:"1.1rem",textAlign:"center",marginBottom:"1rem"}}>
        <div style={{fontSize:"1.4rem",marginBottom:"0.35rem"}}>💌</div>
        <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>Invite your friends to Ralli</div>
        <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.75rem",lineHeight:1.4}}>Skincare is better with friends. Share your pore-clogging scores together.</div>
        <button onClick={()=>{ if(navigator.share){navigator.share({title:"Join me on Ralli!",text:"I use Ralli to check if my skincare products clog pores. Check it out!",url:window.location.href});}else{navigator.clipboard?.writeText(window.location.href);alert("Link copied! Share it with your friends.");}}}
          style={{padding:"0.6rem 1.5rem",background:T.accent,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          Invite Friends
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContactModal — email contact bottom sheet with copy + deep-links
// ---------------------------------------------------------------------------
function ContactModal({ open, onClose, subject = "Ralli by GoodSisters Feedback" }) {
  const [copied, setCopied] = React.useState(false);
  const EMAIL = "hello@theralliapp.com";
  const encodedSubject = encodeURIComponent(subject);

  React.useEffect(() => { if (!open) setCopied(false); }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = EMAIL;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }

  const gmailUrl   = `https://mail.google.com/mail/?view=cm&fs=1&to=${EMAIL}&su=${encodedSubject}`;
  const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${EMAIL}&subject=${encodedSubject}`;
  const mailtoUrl  = `mailto:${EMAIL}?subject=${encodedSubject}`;

  const modal = (
    <div
      onClick={onClose}
      style={{
        position:"fixed", top:0, left:0, right:0, bottom:0,
        background:"rgba(17,24,39,0.55)",
        zIndex:9999,
        display:"flex", alignItems:"flex-end", justifyContent:"center",
        padding:"0",
        fontFamily:"'Inter',sans-serif",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background:T.surface,
          borderRadius:"1.25rem 1.25rem 0 0",
          width:"100%",
          maxWidth:"480px",
          padding:"1.25rem 1.25rem 2rem",
          boxShadow:"0 -8px 32px rgba(17,24,39,0.18)",
        }}
      >
        <div style={{width:"36px",height:"4px",background:T.border,borderRadius:"999px",margin:"0 auto 1rem"}}/>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.85rem"}}>
          <div style={{fontSize:"1.05rem",fontWeight:"700",color:T.text}}>Contact us</div>
          <button onClick={onClose} aria-label="Close"
            style={{background:"none",border:"none",cursor:"pointer",padding:"0.25rem",color:T.textMid,fontSize:"1.1rem",lineHeight:1}}>
            ✕
          </button>
        </div>

        <div style={{fontSize:"0.78rem",color:T.textMid,marginBottom:"1.1rem",lineHeight:1.5}}>
          We read every email. Choose how you want to reach us:
        </div>

        <div style={{
          background:T.surfaceAlt || "#F0F3F7",
          border:`1px solid ${T.border}`,
          borderRadius:"0.75rem",
          padding:"0.85rem 1rem",
          marginBottom:"0.85rem",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:"0.75rem",
        }}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.6rem",color:T.textLight,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.2rem"}}>Email</div>
            <div style={{fontSize:"0.85rem",color:T.text,fontWeight:"500",overflow:"hidden",textOverflow:"ellipsis"}}>{EMAIL}</div>
          </div>
          <button onClick={copyEmail}
            style={{
              padding:"0.5rem 0.85rem",
              background: copied ? T.sage : T.accent,
              color:"#fff", border:"none", borderRadius:"999px",
              fontSize:"0.72rem", fontWeight:"700", cursor:"pointer", flexShrink:0,
              transition:"background 0.2s ease",
            }}>
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <div style={{fontSize:"0.6rem",color:T.textLight,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.5rem"}}>Or open in</div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
          <a href={gmailUrl} target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",textDecoration:"none",color:T.text,fontSize:"0.85rem",fontWeight:"500"}}>
            <span>Gmail</span><span style={{color:T.textLight,fontSize:"0.7rem"}}>→</span>
          </a>
          <a href={outlookUrl} target="_blank" rel="noopener noreferrer"
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",textDecoration:"none",color:T.text,fontSize:"0.85rem",fontWeight:"500"}}>
            <span>Outlook</span><span style={{color:T.textLight,fontSize:"0.7rem"}}>→</span>
          </a>
          <a href={mailtoUrl}
            style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",textDecoration:"none",color:T.text,fontSize:"0.85rem",fontWeight:"500"}}>
            <span>Default mail app</span><span style={{color:T.textLight,fontSize:"0.7rem"}}>→</span>
          </a>
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}

// ---------------------------------------------------------------------------
// MyProfilePage — main profile page (default export)
// ---------------------------------------------------------------------------
function MyProfilePage({user, profile, onUpdate, onUserTap, onAdminTap=()=>{}}) {
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [showContactModal, setShowContactModal] = React.useState(false);
  const [posts, setPosts]               = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState("routine");
  const [editing, setEditing]           = useState(false);
  const [bio, setBio]                   = useState(profile?.bio||"");
  const [skinTypes2, setSkinTypes2]     = useState(
    Array.isArray(profile?.skinType) ? profile.skinType : profile?.skinType ? [profile.skinType] : []
  );
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [userListModal, setUserListModal]     = useState(null);
  const [userListData, setUserListData]       = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [photoUploading, setPhotoUploading]   = useState(false);
  const [phoneEdit, setPhoneEdit]             = useState(profile?.phone||"");
  const [realFollowerCount, setRealFollowerCount] = useState(null);
  const [realFollowingCount, setRealFollowingCount] = useState(null);

  React.useEffect(() => {
    if (!user?.uid) return;
    let cancelled = false;
    const GENERIC = ["skincare lover","anonymous","user","undefined","null",""];
    (async () => {
      const followers = await queryFollowersOf(user.uid);
      const realFollowers = followers.filter(u => !GENERIC.includes((u.displayName||"").toLowerCase().trim()));
      if (!cancelled) setRealFollowerCount(realFollowers.length);
    })();
    (async () => {
      const ids = profile?.following || [];
      if (!ids.length) { if (!cancelled) setRealFollowingCount(0); return; }
      const snaps = await Promise.all(ids.map(uid => getDoc(doc(db,"users",uid)).catch(()=>null)));
      const realFollowing = snaps
        .filter(s => s && s.exists())
        .map(s => ({uid: s.id, ...s.data()}))
        .filter(u => !GENERIC.includes((u.displayName||"").toLowerCase().trim()));
      if (!cancelled) setRealFollowingCount(realFollowing.length);
    })();
    return () => { cancelled = true; };
  }, [user?.uid, (profile?.following || []).join(",")]);

  if (!profile) return <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>;

  const skinTypeOptions = ["Normal","Dry","Oily","Combination","Sensitive","Acne-prone"];
  const routine    = profile.routine    || [];
  const brokeout   = profile.brokeout   || [];
  const wantToTry  = profile.wantToTry  || [];
  const privacy    = profile.listPrivacy || {};
  const routineAnalysis = React.useMemo(
    () => analyzeRoutine(routine, shopProducts),
    [routine.join("|"), shopProducts.length]
  );
  const [showGradeExplainer, setShowGradeExplainer] = useState(false);

  async function openUserList(type) {
    setUserListModal(type);
    setUserListLoading(true);
    try {
      let users = [];
      if (type === "followers") {
        users = await queryFollowersOf(user.uid);
        if (!users.length && (profile.followers || []).length) {
          const snaps = await Promise.all((profile.followers || []).map(uid => getDoc(doc(db,"users",uid)).catch(()=>null)));
          users = snaps.filter(s => s && s.exists()).map(s => ({ uid: s.id, ...s.data() }));
        }
      } else {
        const ids = profile.following || [];
        const snaps = await Promise.all(ids.map(uid => getDoc(doc(db,"users",uid)).catch(()=>null)));
        users = snaps.filter(s => s && s.exists()).map(s => ({ uid: s.id, ...s.data() }));
      }
      users = users.filter(u => !isTestOrSeedAccount(u));
      setUserListData(users);
    } catch(e) { console.warn("openUserList failed:", e); }
    setUserListLoading(false);
  }

  async function handleFollowToggleInList(targetUid) {
    const currentlyFollowing = (profile?.following || []).includes(targetUid);
    try {
      if (currentlyFollowing) {
        await updateDoc(doc(db,"users",user.uid), { following: arrayRemove(targetUid) });
        await updateDoc(doc(db,"users",targetUid),  { followers: arrayRemove(user.uid) }).catch(()=>{});
        onUpdate(p => ({ ...p, following: (p.following||[]).filter(u => u !== targetUid) }));
      } else {
        await updateDoc(doc(db,"users",user.uid), { following: arrayUnion(targetUid) });
        await updateDoc(doc(db,"users",targetUid),  { followers: arrayUnion(user.uid) }).catch(()=>{});
        onUpdate(p => ({ ...p, following: [...(p.following||[]), targetUid] }));
      }
    } catch(e) { console.warn("[handleFollowToggleInList] failed:", e); }
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const size = 300;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        try {
          const blob = await new Promise(resolve =>
            canvas.toBlob(resolve, "image/jpeg", 0.85)
          );
          if (!blob) throw new Error("canvas.toBlob returned null");
          const ref = storageRef(storage, `avatars/${user.uid}.jpg`);
          await uploadBytes(ref, blob, { contentType: "image/jpeg" });
          const downloadUrl = await getDownloadURL(ref);
          await updateDoc(doc(db, "users", user.uid), { photoURL: downloadUrl });
          onUpdate(p => ({ ...p, photoURL: downloadUrl }));
        } catch (err) {
          console.error("[handlePhotoUpload] Storage upload failed:", err);
          alert("Photo upload failed: " + (err?.message || "unknown error") + "\n\nPlease try again or contact support if this persists.");
        }
        setPhotoUploading(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function togglePrivacy(field) {
    const newPrivacy = {...privacy, [field]: !privacy[field]};
    try {
      await updateDoc(doc(db,"users",user.uid),{listPrivacy: newPrivacy});
      onUpdate(p=>({...p, listPrivacy: newPrivacy}));
    } catch {}
  }

  function toggleSkinType(t) {
    setSkinTypes2(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  }

  function reloadPosts() {
    setLoading(true);
    Promise.all([
      getUserPosts(user.uid),
      getDocs(query(collection(db,"ratings"), where("uid","==",user.uid), orderBy("createdAt","desc"), limit(50)))
        .then(snap => { console.log("ratings fetched:", snap.docs.length); return snap.docs.map(d=>({id:d.id,...d.data(),_fromRatings:true})); })
        .catch(() =>
          getDocs(query(collection(db,"ratings"), where("uid","==",user.uid), limit(50)))
            .then(snap => { console.log("ratings fallback:", snap.docs.length); return snap.docs.map(d=>({id:d.id,...d.data(),_fromRatings:true})); })
            .catch(e => { console.error("ratings fetch error:", e); return []; })
        ),
    ]).then(([postsData, ratingsData]) => {
      const merged = [...postsData];
      ratingsData.forEach(r => {
        const rRating = Number(r.communityRating);
        if (!Number.isFinite(rRating) || rRating <= 0) return;
        const isDup = merged.some(p => {
          const pRating = Number(p.communityRating);
          return p.productName === r.productName
              && Number.isFinite(pRating) && pRating > 0
              && pRating === rRating;
        });
        if (!isDup) {
          merged.push({ ...r, postType: "rated" });
        }
      });
      console.log("[reloadPosts] merged:", merged.length, "rated:", merged.filter(p=>p.postType==="rated").length, "ratings input:", ratingsData.length);
      merged.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setPosts(merged);
      setLoading(false);
    });
  }

  async function openProductFromPost(post) {
    try {
      const q = query(collection(db,"products"), where("productName","==", post.productName||post.name||""), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = {id:snap.docs[0].id, ...snap.docs[0].data()};
        const ingA = (p.ingredients||"").trim();
        const ingB = (post.ingredients||"").trim();
        const ing = ingA.length >= ingB.length ? (ingA||ingB) : (ingB||ingA);
        const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
        setSelectedProduct({ id: p.id, productId: p.id, productName: p.productName||post.productName, brand: p.brand||post.brand, image: p.adminImage||p.image||post.productImage||post.image||"", poreScore: liveScore ?? p.poreScore ?? post.poreScore ?? 0, communityRating: p.communityRating||post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: p.buyUrl||post.buyUrl||amazonUrl(p.productName||post.productName, p.brand||post.brand, p.barcode||post.barcode, p.asin||post.asin, p.buyUrl||post.buyUrl) });
        return;
      }
    } catch(e) {}
    const pName = post.productName||post.name||"";
    const ing = (post.ingredients||"").trim();
    const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
    setSelectedProduct({ productName: pName, brand: post.brand, image: post.adminImage||post.image||post.productImage||"", poreScore: liveScore ?? post.poreScore ?? 0, communityRating: post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: post.buyUrl||amazonUrl(pName, post.brand, post.barcode, post.asin, post.buyUrl) });
  }

  useEffect(()=>{
    reloadPosts();
    getProductCache().then(cached => { if (cached.length) setShopProducts(cached); });
    getShopProducts().then(p=>setShopProducts(p));
  },[]);

  useEffect(()=>{
    if (activeTab === "scans") reloadPosts();
  },[activeTab]);

  useEffect(()=>{
    if (profile?._ratingsRefresh) reloadPosts();
  },[profile?._ratingsRefresh]);

  const routineKey  = (profile?.routine  || []).join("|");
  const wantKey     = (profile?.wantToTry || []).join("|");
  const brokeKey    = (profile?.brokeout || []).join("|");
  const isFirstListRefresh = useRef(true);
  useEffect(() => {
    if (isFirstListRefresh.current) {
      isFirstListRefresh.current = false;
      return;
    }
    if (!user?.uid) return;
    const t = setTimeout(() => {
      try { reloadPosts(); } catch (e) { console.error("[auto-reload] failed:", e); }
    }, 400);
    return () => clearTimeout(t);
  }, [routineKey, wantKey, brokeKey, user?.uid]);

  async function saveProfile() {
    try {
      const phoneClean = phoneEdit.replace(/[^0-9]/g,"");
      const phoneUpdate = phoneClean.length >= 10 ? {phone: phoneClean} : {};
      await updateDoc(doc(db,"users",user.uid),{bio, skinType: skinTypes2, ...phoneUpdate});
      onUpdate(p=>({...p, bio, skinType: skinTypes2, ...phoneUpdate}));
    } catch {}
    setEditing(false);
  }

  async function addToList(field, value) {
    try {
      await updateDoc(doc(db,"users",user.uid),{[field]:arrayUnion(value)});
      onUpdate(p=>({...p,[field]:[...(p[field]||[]),value]}));

      const reactionType = field === "routine" ? "loved" :
                          field === "brokeout" ? "brokeout" :
                          field === "wantToTry" ? "wantToTry" : null;
      if (reactionType) {
        const product = shopProducts.find(p =>
          (p.productName || "").toLowerCase() === value.toLowerCase()
        ) || posts.find(p =>
          (p.productName || "").toLowerCase() === value.toLowerCase()
        );

        const ingText = product?.ingredients || "";
        const analysis = ingText ? analyzeIngredients(ingText) : { found: [], avgScore: 0 };
        const ps = ingText ? Math.round(analysis.avgScore ?? 0) : (product?.poreScore || 0);
        const dispName = profile?.displayName || user.displayName || "Anonymous";
        const phURL = profile?.photoURL || user.photoURL || "";
        const brand = product?.brand || "";

        try {
          await postScan(user.uid, dispName, phURL, value, brand, ps, null, ingText, analysis.found || [], reactionType);
          console.log(`[addToList] created ${reactionType} post for "${value}"`);
        } catch (e) {
          console.warn(`[addToList] failed to create post for "${value}":`, e?.message || e);
        }
      }
    } catch (e) {
      console.error(`[addToList] failed for field=${field} value=${value}:`, e?.message || e);
    }
  }

  async function removeFromList(field, value) {
    try {
      await updateDoc(doc(db,"users",user.uid),{[field]:arrayRemove(value)});
      onUpdate(p=>({...p,[field]:(p[field]||[]).filter(v=>v!==value)}));

      const reactionType = field === "routine" ? "loved" :
                          field === "brokeout" ? "brokeout" :
                          field === "wantToTry" ? "wantToTry" : null;
      if (reactionType) {
        try {
          const q = query(
            collection(db, "posts"),
            where("uid", "==", user.uid),
            where("productName", "==", value),
            where("postType", "==", reactionType),
            limit(5)
          );
          const snap = await getDocs(q);
          await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
          if (snap.docs.length > 0) console.log(`[removeFromList] deleted ${snap.docs.length} post(s) for "${value}"`);
        } catch (e) {
          console.warn(`[removeFromList] failed to delete post for "${value}":`, e?.message || e);
        }
      }
    } catch (e) {
      console.error(`[removeFromList] failed for field=${field} value=${value}:`, e?.message || e);
    }
  }

  const tabs = [
    {id:"routine", label:"Routine"},
    {id:"lists",   label:"Lists"},
    {id:"scans",   label:"Activities"},
  ];

  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail || "people");
    window.addEventListener("ralli_profile_tab", handler);
    return () => window.removeEventListener("ralli_profile_tab", handler);
  }, []);

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",paddingBottom:"6rem"}}>
      <div style={{padding:"1rem 1rem 0"}}>

      {userListModal&&ReactDOM.createPortal(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(28,28,26,0.45)",zIndex:9000,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}} onClick={()=>setUserListModal(null)}>
          <div style={{width:"100%",maxWidth:"480px",background:T.surface,borderRadius:"1.5rem 1.5rem 0 0",padding:"1.25rem 1rem 0",height:"70vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.75rem",flexShrink:0}}>
              <span style={{fontSize:"1rem",fontWeight:"700",fontFamily:"'Inter',sans-serif",color:T.text,textTransform:"capitalize"}}>
                {userListModal}
                <span style={{fontSize:"0.72rem",fontWeight:"400",color:T.textLight,marginLeft:"0.5rem"}}>{userListData.length}</span>
              </span>
              <button onClick={()=>setUserListModal(null)} style={{background:T.surfaceAlt,border:"none",cursor:"pointer",color:T.textMid,width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <button onClick={()=>{setUserListModal(null); setActiveTab("people");}}
              style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"0.45rem",width:"100%",padding:"0.6rem",background:T.surfaceAlt,border:`1px dashed ${T.border}`,borderRadius:"0.7rem",fontSize:"0.78rem",fontWeight:"600",color:T.navy,cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem",flexShrink:0,transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background="#fff";e.currentTarget.style.borderColor=T.navy+"40";}}
              onMouseLeave={e=>{e.currentTarget.style.background=T.surfaceAlt;e.currentTarget.style.borderColor=T.border;}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/></svg>
              Find people to follow
            </button>
            <div style={{overflowY:"auto",flex:1,paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))"}}>
              {userListLoading
                ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight}}>Loading…</div>
                : userListData.length===0
                  ? <div style={{textAlign:"center",padding:"1.5rem",color:T.textLight,fontSize:"0.85rem"}}>Nobody here yet</div>
                  : userListData
                      .filter(u => !isTestOrSeedAccount(u))
                      .map(u => {
                        const isMe = u.uid === user.uid;
                        const isFollowed = (profile?.following || []).includes(u.uid);
                        return (
                          <div key={u.uid}
                            style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.25rem",borderBottom:`1px solid ${T.border}`}}>
                            <div onClick={()=>{setUserListModal(null);onUserTap(u.uid);}}
                              style={{display:"flex",alignItems:"center",gap:"0.75rem",flex:1,minWidth:0,cursor:"pointer"}}>
                              <Avatar photoURL={u.photoURL} name={displayNameOf(u)} size={40}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:"0.88rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayNameOf(u)}</div>
                                <div style={{fontSize:"0.72rem",color:T.textLight}}>{(u.followers||[]).length} followers</div>
                              </div>
                            </div>
                            {!isMe && (
                              <button onClick={async (e) => { e.stopPropagation(); await handleFollowToggleInList(u.uid); }}
                                style={{
                                  padding:"0.4rem 0.85rem",
                                  background: isFollowed ? "transparent" : T.navy,
                                  color: isFollowed ? T.text : "#fff",
                                  border: `1px solid ${isFollowed ? T.border : T.navy}`,
                                  borderRadius:"999px",
                                  fontSize:"0.72rem",
                                  fontWeight:"700",
                                  cursor:"pointer",
                                  fontFamily:"'Inter',sans-serif",
                                  flexShrink:0,
                                  letterSpacing:"-0.01em",
                                }}>
                                {isFollowed ? "Following" : "Follow"}
                              </button>
                            )}
                          </div>
                        );
                      })
              }
            </div>
          </div>
        </div>
      , document.body)}

      {/* Profile Header */}
      <div style={{marginBottom:"1.25rem",paddingTop:"0.5rem"}}>

        {!profile.photoURL && !user.photoURL && (
          <div style={{marginBottom:"0.85rem",padding:"0.75rem 1rem",background:`linear-gradient(135deg,${T.accent}12,${T.blush}20)`,borderRadius:"1rem",border:`1px solid ${T.accent}25`,display:"flex",alignItems:"center",gap:"0.75rem"}}>
            <span style={{fontSize:"1.25rem",flexShrink:0}}>📸</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,marginBottom:"1px"}}>Add a profile photo</div>
              <div style={{fontSize:"0.68rem",color:T.textMid}}>Tap the camera icon on your avatar below</div>
            </div>
          </div>
        )}

        <div style={{display:"flex",alignItems:"center",gap:"1.25rem",marginBottom:"1rem"}}>
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:"76px",height:"76px",borderRadius:"50%",overflow:"hidden",border:`2.5px solid ${T.surface}`,boxShadow:`0 0 0 2px ${T.accent}`}}>
              {profile.photoURL||user.photoURL
                ? <img src={profile.photoURL||user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                : <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${T.accent}cc,${T.navy})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:"1.75rem",fontWeight:"700",color:"#fff",fontFamily:"'Inter',sans-serif"}}>{(profile.displayName||"?")[0].toUpperCase()}</span>
                  </div>
              }
            </div>
            <label style={{position:"absolute",bottom:"1px",right:"1px",width:"22px",height:"22px",borderRadius:"50%",background:T.navy,border:`2px solid ${T.bg}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
              {photoUploading
                ? <div style={{width:"7px",height:"7px",borderRadius:"50%",border:"1.5px solid #fff",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{display:"none"}}/>
            </label>
          </div>

          <div style={{flex:1,display:"flex",justifyContent:"space-around"}}>
            {[
              {label:"Activities", value:posts.length,                                              onClick:null,                                       isGrade:false},
              {label:"Followers",  value: realFollowerCount ?? (profile.followers||[]).length,      onClick:()=>openUserList("followers"),              isGrade:false},
              {label:"Following",  value: realFollowingCount ?? (profile.following||[]).length,     onClick:()=>openUserList("following"),              isGrade:false},
              {label:"Routine",    value: routineAnalysis?.grade || "—",                            onClick: routineAnalysis ? ()=>setShowGradeExplainer(true) : null, isGrade:true,
               color: routineAnalysis?.gradeColor},
            ].map(({label,value,onClick,isGrade,color})=>(
              <button key={label} onClick={onClick||undefined} disabled={!onClick}
                style={{textAlign:"center",background:"none",border:"none",cursor:onClick?"pointer":"default",padding:"0.15rem 0.5rem",lineHeight:1}}>
                <div style={{fontSize:"1.25rem",fontWeight:"800",color: isGrade && color ? color : T.navy,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.03em"}}>{value}</div>
                <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"3px",fontFamily:"'Inter',sans-serif",letterSpacing:"0.02em"}}>{label}</div>
              </button>
            ))}
          </div>
        </div>
        {showGradeExplainer && routineAnalysis && (
          <RoutineScoreExplainer
            analysis={routineAnalysis}
            routine={routine}
            onClose={()=>setShowGradeExplainer(false)}
          />
        )}

        <div style={{marginBottom:"0.75rem"}}>
          <div style={{fontSize:"1.05rem",fontWeight:"700",color:T.navy,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.02em",lineHeight:1.2}}>{profile.displayName}</div>
          {!editing&&(
            <div style={{fontSize:"0.82rem",color:T.textMid,marginTop:"0.3rem",lineHeight:1.5}}>
              {profile.bio||<span style={{color:T.textLight,fontStyle:"italic",fontSize:"0.78rem"}}>No bio yet — tap Edit to add one</span>}
            </div>
          )}
        </div>

        {!editing&&(Array.isArray(profile.skinType)?profile.skinType:[profile.skinType].filter(Boolean)).length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",marginBottom:"0.75rem"}}>
            {(Array.isArray(profile.skinType)?profile.skinType:[profile.skinType]).filter(Boolean).map(t=>(
              <span key={t} style={{padding:"0.22rem 0.7rem",background:T.accentSoft,color:T.accent,borderRadius:"999px",fontSize:"0.68rem",fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>{t}</span>
            ))}
          </div>
        )}

        <div style={{display:"flex",gap:"0.5rem"}}>
          <button onClick={()=>editing?saveProfile():setEditing(true)}
            style={{flex:1,padding:"0.5rem",
              color:editing?"#fff":T.navy,
              border:`1.5px solid ${editing?T.accent:T.navy}22`,
              borderRadius:"0.6rem",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",
              fontFamily:"'Inter',sans-serif",letterSpacing:"-0.01em",
              background: editing ? T.accent : T.surfaceAlt,
            }}>
            {editing ? "Save Profile" : "Edit Profile"}
          </button>
        </div>
      </div>

      {editing&&(
        <div style={{background:T.surface,borderRadius:"0.75rem",border:`1px solid ${T.border}`,padding:"1rem",marginBottom:"1rem"}} className="fu">
          <input value={bio} onChange={e=>setBio(e.target.value)} placeholder="Add a bio…" style={{width:"100%",padding:"0.65rem 0.9rem",borderRadius:"0.5rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",marginBottom:"0.6rem"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.25rem",fontFamily:"'Inter',sans-serif"}}>Phone <span style={{fontStyle:"italic"}}>(so contacts can find you)</span></div>
          <input value={phoneEdit} onChange={e=>setPhoneEdit(e.target.value)} placeholder="+1 (555) 000-0000" type="tel" style={{width:"100%",padding:"0.65rem 0.9rem",borderRadius:"0.5rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.4rem"}}>Skin type <span style={{color:T.textLight,fontStyle:"italic"}}>(select all that apply)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem"}}>
            {skinTypeOptions.map(t=>{
              const on = skinTypes2.includes(t);
              return <button key={t} onClick={()=>toggleSkinType(t)} style={{padding:"0.3rem 0.75rem",borderRadius:"999px",fontSize:"0.75rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",background:on?T.accent:T.surfaceAlt,color:on?"#FFFFFF":T.textMid,border:`1px solid ${on?T.accent:T.border}`,transition:"all 0.15s"}}>{t}</button>;
            })}
          </div>
        </div>
      )}

      {activeTab!=="people"&&(
        <div style={{display:"flex",borderBottom:`2px solid ${T.border}`,marginBottom:"1.25rem",gap:0}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>setActiveTab(t.id)}
              style={{flex:1,padding:"0.65rem 0.5rem",background:"transparent",border:"none",
                borderBottom:`2px solid ${activeTab===t.id?T.navy:"transparent"}`,marginBottom:"-2px",
                fontSize:"0.82rem",fontWeight:activeTab===t.id?"700":"400",
                color:activeTab===t.id?T.navy:T.textLight,cursor:"pointer",
                fontFamily:"'Inter',sans-serif",transition:"all 0.15s",letterSpacing:"-0.01em"}}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {activeTab==="scans"&&(
        loading
          ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight}}>Loading…</div>
          : posts.length===0
            ? <div style={{textAlign:"center",color:T.textLight,padding:"2.5rem 1rem",fontSize:"0.85rem",fontFamily:"'Inter',sans-serif"}}>
                <div style={{fontSize:"1.6rem",marginBottom:"0.5rem",opacity:0.4}}>✨</div>
                <div>No activity yet.</div>
                <div style={{fontSize:"0.72rem",marginTop:"0.4rem",opacity:0.7}}>Scan a product, search for one, rate something, or react to start your activity.</div>
                <button onClick={()=>setActiveTab("people")}
                  style={{marginTop:"1.25rem",padding:"0.55rem 1.1rem",background:T.navy,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.78rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"inline-flex",alignItems:"center",gap:"0.4rem"}}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/><path d="M19 8v6"/></svg>
                  Find people to follow
                </button>
              </div>
            : <>{posts.map((p,i)=><CardReveal key={p.id} delay={i*40}><PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName||""} currentUserPhoto={profile?.photoURL||""} onUserTap={onUserTap} onProductTap={openProductFromPost}/></CardReveal>)}</>
      )}

      {activeTab==="routine"&&(
        <div className="fu">
          {(()=>{
            const allProds = [...shopProducts, ...posts];
            function openListItem(name) {
              const found = allProds.find(p=>(p.productName||p.name||"").toLowerCase()===name.toLowerCase());
              setSelectedProduct({
                id: found?.id || "",
                productId: found?.id || "",
                productName: name,
                brand: found?.brand||"",
                poreScore: found?.poreScore??0,
                communityRating: found?.communityRating||null,
                image: getProductImage(found),
                adminImage: found?.adminImage||"",
                ingredients: found?.ingredients||"",
                flaggedIngredients: found?.flaggedIngredients||[],
                buyUrl: found?.buyUrl||"",
              });
            }
            return (<>
          <ListSection
            title="My Routine" icon="✦" color={T.sage}
            items={routine} isPrivate={!!privacy.routine}
            readOnly={false}
            layout="grid"
            onTogglePrivacy={()=>togglePrivacy("routine")}
            onAdd={v=>addToList("routine",v)}
            onRemove={v=>removeFromList("routine",v)}
            allProducts={allProds}
            onItemTap={openListItem}
          />
          <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdate} onUserTap={onUserTap}/>
            </>);
          })()}
        </div>
      )}

      {activeTab==="lists"&&(
        <div className="fu">
          {(()=>{
            const allProds = [...shopProducts, ...posts];
            function openListItem(name) {
              const found = allProds.find(p=>(p.productName||p.name||"").toLowerCase()===name.toLowerCase());
              setSelectedProduct({
                id: found?.id || "",
                productId: found?.id || "",
                productName: name,
                brand: found?.brand||"",
                poreScore: found?.poreScore??0,
                communityRating: found?.communityRating||null,
                image: getProductImage(found),
                adminImage: found?.adminImage||"",
                ingredients: found?.ingredients||"",
                flaggedIngredients: found?.flaggedIngredients||[],
                buyUrl: found?.buyUrl||"",
              });
            }
            return (<>
          <ListSection
            title="Want to Try" icon="→" color={T.amber}
            items={wantToTry} isPrivate={!!privacy.wantToTry}
            readOnly={false}
            onTogglePrivacy={()=>togglePrivacy("wantToTry")}
            onAdd={v=>addToList("wantToTry",v)}
            onRemove={v=>removeFromList("wantToTry",v)}
            allProducts={allProds}
            onItemTap={openListItem}
          />
          <ListSection
            title="Not For Me" icon="!" color={T.rose}
            items={brokeout} isPrivate={!!privacy.brokeout}
            readOnly={false}
            onTogglePrivacy={()=>togglePrivacy("brokeout")}
            onAdd={v=>addToList("brokeout",v)}
            onRemove={v=>removeFromList("brokeout",v)}
            allProducts={allProds}
            onItemTap={openListItem}
          />
          <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdate} onUserTap={onUserTap}/>
            </>);
          })()}
        </div>
      )}

      {activeTab==="people"&&(
        <div>
          <button onClick={()=>setActiveTab("scans")} style={{background:"none",border:"none",color:T.textMid,fontSize:"0.85rem",cursor:"pointer",padding:"0 0 0.75rem 0",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
            Back to profile
          </button>
          <PeopleFinder user={user} profile={profile} onUpdate={onUpdate} onUserTap={onUserTap}/>
        </div>
      )}

      <div style={{marginTop:"1.25rem",display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
        <a href="https://theralliapp.com/privacy.html" target="_blank" rel="noopener noreferrer"
          style={{fontSize:"0.72rem",color:T.textLight,textDecoration:"underline",textDecorationColor:T.border,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
          Privacy Policy
        </a>
        <span style={{fontSize:"0.72rem",color:T.border}}>·</span>
        <a href="https://theralliapp.com/terms.html" target="_blank" rel="noopener noreferrer"
          style={{fontSize:"0.72rem",color:T.textLight,textDecoration:"underline",textDecorationColor:T.border,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
          Terms of Service
        </a>
        <span style={{fontSize:"0.72rem",color:T.border}}>·</span>
        <button onClick={()=>setShowContactModal(true)}
          style={{fontSize:"0.72rem",color:T.textLight,textDecoration:"underline",textDecorationColor:T.border,fontFamily:"'Inter',sans-serif",cursor:"pointer",background:"none",border:"none",padding:0}}>
          Contact Us
        </button>
      </div>

      <div style={{marginTop:"0.75rem",padding:"0.85rem 1rem",background:T.accentSoft,borderRadius:"0.85rem",border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
          <div style={{fontSize:"1.1rem",flexShrink:0}}>💬</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.navy,fontFamily:"'Inter',sans-serif",marginBottom:"2px"}}>Share feedback</div>
            <div style={{fontSize:"0.7rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>Found a bug? Want a feature? We read everything.</div>
          </div>
          <button onClick={()=>setShowContactModal(true)}
            style={{padding:"0.4rem 0.75rem",background:T.accent,color:"#fff",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"600",fontFamily:"'Inter',sans-serif",border:"none",cursor:"pointer",flexShrink:0}}>
            Email us
          </button>
        </div>
      </div>

      <button onClick={()=>signOut(auth)} style={{width:"100%",marginTop:"0.75rem",padding:"0.7rem",background:"transparent",color:T.textLight,border:`1px solid ${T.border}`,borderRadius:"0.65rem",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        Sign out
      </button>
      <button onClick={()=>setShowDeleteModal(true)}
        style={{width:"100%",marginTop:"0.5rem",padding:"0.6rem",background:"transparent",color:T.rose,border:`1px solid ${T.rose}30`,borderRadius:"0.65rem",fontSize:"0.78rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        Delete account
      </button>
      {showDeleteModal && (
        <DeleteAccountModal
          user={user}
          onClose={()=>setShowDeleteModal(false)}
          onDeleted={()=>{ signOut(auth); }}
        />
      )}
      <ContactModal open={showContactModal} onClose={()=>setShowContactModal(false)} />

      <div style={{marginTop:"0.75rem",padding:"0.6rem 0.75rem",background:T.surfaceAlt,borderRadius:"0.65rem",border:`1px solid ${T.border}`}}>
        <div style={{fontSize:"0.55rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.2rem",fontFamily:"'Inter',sans-serif"}}>Your account UID</div>
        <div style={{fontSize:"0.65rem",color:T.textMid,fontFamily:"monospace",wordBreak:"break-all",userSelect:"all"}}>{user?.uid}</div>
      </div>

      {isAdmin(user)&&(
        <button onClick={onAdminTap} style={{width:"100%",marginTop:"0.5rem",padding:"0.7rem",background:T.text,color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Admin Dashboard
        </button>
      )}

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PoreScoreInfo — info tooltip explaining the 0-5 pore clog scale (exported)
// ---------------------------------------------------------------------------
export function PoreScoreInfo({ score, inline=false }) {
  const [open, setOpen] = React.useState(false);
  const ps = poreStyle(score ?? 0);

  const levels = [
    { range:"0", label:"Clear", color:"#22C55E", desc:"No known pore-cloggers. Safe for all skin types including acne-prone." },
    { range:"1", label:"Mild",  color:"#84CC16", desc:"One or two mildly comedogenic ingredients. Unlikely to cause breakouts for most people." },
    { range:"2", label:"Low",   color:"#EAB308", desc:"Some moderate pore-cloggers present. Fine for normal skin, use cautiously if acne-prone." },
    { range:"3", label:"Medium",color:"#F97316", desc:"Notable pore-clogging potential. Patch test first if your skin breaks out easily." },
    { range:"4", label:"High",  color:"#EF4444", desc:"Multiple high-risk ingredients. Likely to cause breakouts for acne-prone or oily skin." },
    { range:"5", label:"Avoid", color:"#DC2626", desc:"Highly comedogenic formula. Most dermatologists would not recommend for acne-prone skin." },
  ];

  return (
    <span style={{position:"relative",display:inline?"inline-flex":"flex",alignItems:"center",gap:"0.3rem"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}
        style={{background:"none",border:"none",cursor:"pointer",padding:"0",display:"flex",alignItems:"center",gap:"0.25rem",color:T.textLight}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
      {open && (
        <>
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9998}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",zIndex:9999,
            background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",
            padding:"1rem",width:"260px",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:"0.7rem",fontWeight:"700",color:T.text,marginBottom:"0.6rem",fontFamily:"'Inter',sans-serif",letterSpacing:"0.02em"}}>
              What is the Pore Clog Score?
            </div>
            <div style={{fontSize:"0.68rem",color:T.textMid,lineHeight:1.5,marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>
              We score each product 0–5 based on how comedogenic (pore-clogging) its ingredients are,
              using a database of known ingredient ratings. Lower is better for acne-prone skin.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
              {levels.map(l=>(
                <div key={l.range} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem"}}>
                  <div style={{minWidth:"42px",padding:"0.1rem 0.35rem",background:l.color+"18",border:`1px solid ${l.color}33`,borderRadius:"0.3rem",textAlign:"center",flexShrink:0}}>
                    <span style={{fontSize:"0.6rem",fontWeight:"800",color:l.color,fontFamily:"'Inter',sans-serif"}}>{l.range} — {l.label}</span>
                  </div>
                  <span style={{fontSize:"0.62rem",color:T.textMid,lineHeight:1.4}}>{l.desc}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:"0.75rem",padding:"0.5rem 0.65rem",background:T.accentSoft,borderRadius:"0.5rem"}}>
              <div style={{fontSize:"0.62rem",color:T.navy,lineHeight:1.4,fontFamily:"'Inter',sans-serif",marginBottom:"0.45rem"}}><strong>Note:</strong> Comedogenicity varies by person. These ratings are guidelines, not guarantees.</div>
              <div style={{fontSize:"0.58rem",color:T.textLight,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>
                <span style={{fontWeight:"600",color:T.textMid,display:"block",marginBottom:"0.2rem"}}>Sources</span>
                <a href="https://www.paulaschoice.com/ingredient-dictionary" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· Paula's Choice Ingredient Dictionary</a>
                <a href="https://cosdna.com" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· CosDNA Ingredient Analysis</a>
                <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2835894/" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· Draelos &amp; DiNardo, <em>J Cosmet Dermatol</em> (2006)</a>
                <a href="https://incidecoder.com" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· INCIDecoder</a>
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Exports — named + default so App.jsx can use either form
// ---------------------------------------------------------------------------
export { MyProfilePage };
export default MyProfilePage;
