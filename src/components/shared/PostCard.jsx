import React, { useState } from "react";
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";
import { getProductImage } from "../../lib/imageUtils.js";
import { useProduct } from "../providers/ProductCacheProvider.jsx";
import { Avatar } from "../ui/Avatar.jsx";
import { poreStyle } from "./PoreScoreBadge.jsx";
import { ShareProductModal } from "./ShareProductModal.jsx";

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - (ts.seconds ? ts.seconds*1000 : new Date(ts).getTime());
  const m = Math.floor(diff/60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function displayNameOf(user) {
  const raw = (user?.displayName || "").trim();
  if (!raw) return "Rallier";
  const lower = raw.toLowerCase();
  if (lower === "skincare lover" || lower === "anonymous" || lower === "user" || lower === "undefined" || lower === "null") return "Rallier";
  return raw;
}

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
      if (isWord) { if (!inToken) { consumedTokens++; inToken = true; if (consumedTokens > targetTokens) { cutAt = i; break; } } }
      else { inToken = false; }
    }
    if (cutAt < 0) break;
    working = working.slice(cutAt).trim();
  }
  return working || name;
}

async function toggleLike(postId, uid) {
  try {
    const ref = doc(db, "posts", postId);
    const snap = await getDoc(ref);
    const likes = snap.data()?.likes || [];
    if (likes.includes(uid)) await updateDoc(ref, { likes: arrayRemove(uid) });
    else await updateDoc(ref, { likes: arrayUnion(uid) });
  } catch {}
}

export function PostCard({ post, currentUid, currentUserName="", currentUserPhoto="", onUserTap, onProductTap, onDeleted, productImageMap={} }) {
  const [liked, setLiked] = useState((post.likes||[]).includes(currentUid));
  const [likeCount, setLikeCount] = useState((post.likes||[]).length);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments||[]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const isOwner = post.uid === currentUid;

  const canonicalProduct = useProduct(post.productId || post.productName, null);

  const mappedImage = productImageMap[(post.productName||"").toLowerCase().trim()] || "";
  const liveImage = (canonicalProduct ? getProductImage(canonicalProduct) : "") || post.productImage || post.image || mappedImage;

  const liveIngredients = canonicalProduct?.ingredients || post.ingredients || "";
  const livePostScore = (liveIngredients && liveIngredients.trim().length > 10)
    ? (() => { const r = analyzeIngredients(liveIngredients); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
    : null;
  const displayScore = livePostScore ?? canonicalProduct?.poreScore ?? post.poreScore ?? null;
  const ps = poreStyle(displayScore??0);
  const liveBrand = canonicalProduct?.brand || post.brand || "";
  const [likeAnim, setLikeAnim] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStart = React.useRef(0);

  function onSwipeStart(e) { swipeStart.current = e.touches[0].clientX; }
  function onSwipeMove(e) {
    const dx = e.touches[0].clientX - swipeStart.current;
    if (Math.abs(dx) < 5) return;
    if (dx > 0) setSwipeX(Math.min(dx * 0.35, 60));
    else if (isOwner) setSwipeX(Math.max(dx * 0.35, -60));
  }
  function onSwipeEnd() {
    if (swipeX > 45 && !liked) handleLike();
    if (swipeX < -45 && isOwner) setMenuOpen(true);
    setSwipeX(0);
  }

  async function submitComment() {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    const newComment = { uid: currentUid, displayName: currentUserName||"User", photoURL: currentUserPhoto||"", text: commentText.trim(), createdAt: Date.now() };
    try {
      await updateDoc(doc(db,"posts",post.id), { comments: arrayUnion(newComment) });
      setComments(c=>[...c, newComment]);
      setCommentText("");
    } catch(e) { console.error(e); }
    setPosting(false);
  }

  async function deleteComment(c) {
    try {
      await updateDoc(doc(db,"posts",post.id), { comments: arrayRemove(c) });
      setComments(cs=>cs.filter(x=>x.uid!==c.uid||x.text!==c.text||x.createdAt!==c.createdAt));
    } catch(e) { console.error(e); }
  }

  async function handleLike() {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c+1 : c-1);
    if (newLiked) {
      setLikeAnim(true);
      setTimeout(()=>setLikeAnim(false), 400);
      if (navigator.vibrate) navigator.vibrate(12);
    }
    await toggleLike(post.id, currentUid);
  }

  async function handleDelete() {
    if (!confirm("Delete this post? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "posts", post.id));
      setDeleted(true);
      onDeleted && onDeleted(post.id);
    } catch(e) { alert("Couldn't delete post."); }
    setDeleting(false);
  }

  if (deleted) return null;

  const firstName = displayNameOf(post)?.split(" ")[0] || "Rallier";
  const isMe = post.uid === currentUid;
  const she = isMe ? "you" : firstName;
  const her = isMe ? "your" : "their";
  const ratingVal = Number(post.communityRating);
  const ratingLabel = Number.isFinite(ratingVal) && ratingVal > 0 ? `rated ${ratingVal}/10` : "rated this";
  const labelMap = {
    brokeout:  isMe ? `you said this wasn't for me`   : `${firstName} said this wasn't for them`,
    wantToTry: isMe ? `you want to try this`           : `${firstName} wants to try this`,
    loved:     isMe ? `you added this to your routine` : `${firstName} added this to their routine`,
    commented: isMe ? `you commented on this`          : `${firstName} commented on this`,
    rated:     isMe ? `you ${ratingLabel}`             : `${firstName} ${ratingLabel}`,
  };

  const ratedColor = Number.isFinite(ratingVal) && ratingVal > 0
    ? (ratingVal >= 8 ? T.sage : ratingVal >= 5 ? T.amber : T.rose)
    : T.textMid;
  const typeAccent =
    post.postType==="brokeout"  ? T.rose :
    post.postType==="wantToTry" ? T.textLight :
    post.postType==="loved"     ? T.sage :
    post.postType==="rated"     ? ratedColor :
                                  T.textMid;
  const typeIcon =
    post.postType==="brokeout"
      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={typeAccent} strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    : post.postType==="wantToTry"
      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={typeAccent} strokeWidth="2.5"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
    : post.postType==="loved"
      ? <svg width="12" height="12" viewBox="0 0 24 24" fill={typeAccent} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
    : post.postType==="rated"
      ? <svg width="12" height="12" viewBox="0 0 24 24" fill={typeAccent} stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={typeAccent} strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>;

  return (
    <div style={{position:"relative"}}
      onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}>

      {swipeX>10&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:T.rose+"08",pointerEvents:"none",zIndex:0,borderRadius:"1.1rem"}}/>}

      <div style={{transform:`translateX(${swipeX}px)`,transition:swipeX===0?"transform 0.2s ease":"none",position:"relative",zIndex:1,padding:"0.75rem 1rem"}}>

        <div style={{background:T.surface,borderRadius:"1.1rem",border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:"0 1px 6px rgba(28,28,26,0.05)",marginBottom:"0.5rem"}}>

          <div style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.7rem 0.85rem 0.6rem",borderBottom:`1px solid ${T.border}50`}}>
            <button onClick={()=>onUserTap(post.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0}}>
              <Avatar photoURL={post.photoURL} name={displayNameOf(post)} size={34}/>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.35rem"}}>
                <button onClick={()=>onUserTap(post.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontWeight:"700",color:T.text,fontSize:"0.85rem",fontFamily:"'Inter',sans-serif"}}>{firstName}</button>
                <span style={{fontSize:"0.68rem",color:T.textLight}}>·</span>
                <span style={{fontSize:"0.68rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>{timeAgo(post.createdAt)}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"0.25rem",marginTop:"1px"}}>
                <span style={{display:"flex",alignItems:"center"}}>{typeIcon}</span>
                <span style={{fontSize:"0.68rem",fontWeight:"600",color:typeAccent,fontFamily:"'Inter',sans-serif"}}>
                  {post.postType==="brokeout"?"not for me":post.postType==="wantToTry"?"wants to try":post.postType==="loved"?"added to routine":post.postType==="rated"?ratingLabel:"checked this"}
                </span>
              </div>
            </div>
            {isOwner&&(
              <div style={{position:"relative",flexShrink:0}}>
                <button onClick={()=>setMenuOpen(m=>!m)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:T.textLight,display:"flex"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {menuOpen&&(
                  <><div onClick={()=>setMenuOpen(false)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:100}}/>
                  <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.6rem",boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:101,minWidth:"110px",overflow:"hidden"}}>
                    <button onClick={()=>{setMenuOpen(false);handleDelete();}} disabled={deleting}
                      style={{width:"100%",padding:"0.6rem 0.8rem",background:"none",border:"none",cursor:"pointer",fontSize:"0.78rem",color:T.rose,fontFamily:"'Inter',sans-serif",textAlign:"left",display:"flex",alignItems:"center",gap:"0.35rem"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      {deleting?"Deleting…":"Delete"}
                    </button>
                  </div></>
                )}
              </div>
            )}
          </div>

          <div onClick={onProductTap?()=>onProductTap(post):undefined} className={onProductTap?"pressable":""}
            style={{display:"flex",gap:"0.65rem",alignItems:"center",padding:"0.65rem 0.85rem",cursor:onProductTap?"pointer":"default",background:T.surface}}>
            <div style={{width:"42px",height:"42px",flexShrink:0,borderRadius:"0.55rem",overflow:"hidden",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {liveImage
                ? <img src={liveImage} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"4px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.opacity="0"}/>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              }
            </div>
            <div style={{flex:1,minWidth:0}}>
              {liveBrand&&<div style={{fontSize:"0.58rem",fontWeight:"600",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.1rem",fontFamily:"'Inter',sans-serif"}}>{liveBrand}</div>}
              <div style={{fontWeight:"600",color:T.text,fontSize:"0.85rem",fontFamily:"'Inter',sans-serif",lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{getProductDisplayName({productName: canonicalProduct?.productName||post.productName, brand: liveBrand})}</div>
              {post.communityRating&&<div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"2px",fontFamily:"'Inter',sans-serif"}}>★ {(post.communityRating/2).toFixed(1)} community</div>}
            </div>
            <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"3px"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:displayScore!=null?ps.color:T.border,flexShrink:0}}/>
                <span style={{fontSize:"0.82rem",fontWeight:"600",color:displayScore!=null?ps.color:T.textLight,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{displayScore??"—"}</span>
                <span style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>/5</span>
              </div>
              <span style={{fontSize:"0.5rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'Inter',sans-serif"}}>pore</span>
            </div>
          </div>

          <div style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.5rem 0.85rem 0.65rem",borderTop:`1px solid ${T.border}40`}}>
            <button onClick={handleLike} style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"none",border:"none",cursor:"pointer",padding:"2px 0",color:liked?T.rose:T.textLight,transition:"color 0.15s"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="1.8" style={{animation:likeAnim?"heartBounce 0.4s ease both":"none"}}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              {likeCount>0&&<span style={{fontSize:"0.72rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>{likeCount}</span>}
            </button>
            <button onClick={()=>setShowComments(s=>!s)} style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"none",border:"none",cursor:"pointer",padding:"2px 0",color:showComments?T.accent:T.textLight,transition:"color 0.15s"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {comments.length>0
                ? <span style={{fontSize:"0.72rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>{comments.length}</span>
                : <span style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Comment</span>
              }
            </button>
            <button onClick={()=>setShareOpen(true)} style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"none",border:"none",cursor:"pointer",padding:"2px 0",color:T.textLight,marginLeft:"auto",transition:"color 0.15s"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>

        {shareOpen&&<ShareProductModal user={{uid:currentUid}} product={post} onClose={()=>setShareOpen(false)}/>}
        {showComments&&(
          <div style={{padding:"0 0.1rem 0.5rem",display:"flex",flexDirection:"column",gap:"0.45rem"}}>
          {comments.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem"}}>
              <Avatar photoURL={c.photoURL} name={c.displayName} size={24}/>
              <div style={{flex:1,background:T.surfaceAlt,borderRadius:"0.65rem",padding:"0.35rem 0.6rem"}}>
                <span style={{fontSize:"0.7rem",fontWeight:"700",color:T.text,marginRight:"0.3rem"}}>{c.displayName||"User"}</span>
                <span style={{fontSize:"0.75rem",color:T.textMid,lineHeight:1.4}}>{c.text}</span>
              </div>
              {(c.uid===currentUid||post.uid===currentUid)&&(
                <button onClick={()=>deleteComment(c)} style={{background:"none",border:"none",cursor:"pointer",color:T.textLight,padding:"4px",flexShrink:0,marginTop:"2px"}}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          ))}
          <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
            <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submitComment()} placeholder="Add a comment…"
              style={{flex:1,padding:"0.45rem 0.75rem",borderRadius:"999px",border:`1px solid ${T.border}`,fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none"}}/>
            <button onClick={submitComment} disabled={!commentText.trim()||posting}
              style={{width:"30px",height:"30px",borderRadius:"50%",background:commentText.trim()?T.accent:T.surfaceAlt,border:"none",cursor:commentText.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={commentText.trim()?"#fff":T.textLight} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}
