import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  getDocs, getDoc, doc, query, collection, where, orderBy, limit,
  onSnapshot, addDoc, updateDoc, setDoc, deleteDoc, serverTimestamp,
  arrayUnion, arrayRemove,
} from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";
import { convId, newGroupId, sendToConversation } from "../../lib/messagingUtils.js";
import { Avatar } from "../ui/Avatar.jsx";
import { useToast } from "../providers/ToastProvider.jsx";
import { ProductModal } from "../shared/ProductModal.jsx";
import { getProductImage } from "../../lib/imageUtils.js";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";

// ---------------------------------------------------------------------------
// Local helpers (not exported — only used within MessagesPage and sub-components)
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

function poreStyle(score) {
  if (score === 0) return { color: T.sage,  label: "Clear",    sub: "Won't clog pores" };
  if (score === 1) return { color: T.sage,  label: "Minimal",  sub: "Very low risk" };
  if (score === 2) return { color: T.amber, label: "Low risk", sub: "May affect some skin" };
  if (score === 3) return { color: T.amber, label: "Medium",   sub: "Likely to clog pores" };
  if (score === 4) return { color: T.rose,  label: "High",     sub: "High clog risk" };
  return                   { color: T.rose,  label: "Avoid",   sub: "Clogs pores" };
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - (ts.seconds ? ts.seconds * 1000 : new Date(ts).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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

// ProductCache context — re-used inside ChatView for product bubble lookups.
// We consume it via a local hook that reads a context provided by the app root.
const ProductCacheContext = React.createContext({
  byId: {}, byNameLower: {}, ready: false,
  get: () => null, getImage: () => "",
});
function useProductCache() { return React.useContext(ProductCacheContext); }

async function createGroupConversation({ creatorUid, participants, name = "" }) {
  if (!creatorUid) throw new Error("Missing creatorUid");
  const allParticipants = Array.from(new Set([creatorUid, ...(participants || [])])).filter(Boolean);
  if (allParticipants.length < 3) throw new Error("Group needs at least 3 people (you + 2 others)");
  if (allParticipants.length > 10) throw new Error("Group can have at most 10 people");

  const cid = newGroupId();
  const convRef = doc(db, "conversations", cid);
  const unreadInit = {};
  allParticipants.forEach(uid => { unreadInit[`unread_${uid}`] = 0; });
  await setDoc(convRef, {
    isGroup: true,
    participants: allParticipants,
    name: (name || "").trim().slice(0, 60),
    createdBy: creatorUid,
    createdAt: serverTimestamp(),
    lastAt: serverTimestamp(),
    lastMessage: "",
    ...unreadInit,
  });
  return cid;
}

// ---------------------------------------------------------------------------
// Sub-components (not exported)
// ---------------------------------------------------------------------------

function ConnectionRow({ u, i, onClick }) {
  return (
    <button onClick={onClick}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.65rem 0", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}40` : "none", cursor:"pointer", textAlign:"left" }}>
      <Avatar photoURL={u.photoURL} name={u.displayName} size={42}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.85rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif" }}>{u.displayName}</div>
        <div style={{ fontSize:"0.68rem", color:T.textLight }}>{(u.followers||[]).length} followers</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
  );
}

function NewGroupModal({ user, profile, connections, onClose, onCreated }) {
  const { toast } = useToast();
  const [selected, setSelected] = useState(new Set());
  const [selectedDocs, setSelectedDocs] = useState({});
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = search.trim();
    if (!q) { setSearchResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      const titleCased = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
      const variants = [...new Set([q, titleCased])];
      try {
        const snaps = await Promise.all(variants.map(v => getDocs(query(
          collection(db, "users"),
          where("displayName", ">=", v),
          where("displayName", "<=", v + ""),
          limit(15)
        )).catch(() => null)));
        const seen = new Set();
        const found = [];
        snaps.forEach(snap => {
          if (!snap) return;
          snap.docs.forEach(d => {
            if (d.id === user.uid || seen.has(d.id)) return;
            seen.add(d.id);
            found.push({ uid: d.id, ...d.data() });
          });
        });
        setSearchResults(found);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 250);
    return () => clearTimeout(t);
  }, [search, user.uid]);

  const candidates = (() => {
    if (!search.trim()) {
      return [...connections]
        .filter(u => !isTestOrSeedAccount(u))
        .sort((a, b) => (a.displayName||"").localeCompare(b.displayName||""));
    }
    const merged = new Map();
    connections
      .filter(u => !isTestOrSeedAccount(u))
      .filter(u => (u.displayName||"").toLowerCase().includes(search.toLowerCase()))
      .forEach(u => merged.set(u.uid, u));
    searchResults
      .filter(u => !isTestOrSeedAccount(u))
      .forEach(u => { if (!merged.has(u.uid)) merged.set(u.uid, u); });
    return [...merged.values()].sort((a, b) => (a.displayName||"").localeCompare(b.displayName||""));
  })();

  function togglePick(u) {
    const uid = typeof u === "string" ? u : u.uid;
    setSelected(s => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else if (n.size >= 9) { toast("Groups can have at most 10 people including you", "warning"); return n; }
      else n.add(uid);
      return n;
    });
    if (typeof u !== "string") {
      setSelectedDocs(d => ({ ...d, [uid]: u }));
    }
  }

  async function handleCreate() {
    if (selected.size < 2) { toast("Pick at least 2 people", "warning"); return; }
    setCreating(true);
    try {
      const cid = await createGroupConversation({
        creatorUid: user.uid,
        participants: [...selected],
        name: name.trim(),
      });
      const conv = {
        isGroup: true,
        id: cid,
        participants: [user.uid, ...selected],
        name: name.trim(),
        createdBy: user.uid,
      };
      onCreated?.(cid, conv);
    } catch(e) {
      toast("Couldn't create group: " + (e?.message || "unknown"), "error");
    }
    setCreating(false);
  }

  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9700,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center",background:"rgba(17,24,39,0.4)"}}
      onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:"480px",background:T.surface,borderRadius:"1.25rem 1.25rem 0 0",maxHeight:"88vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"0.85rem 1rem 0.65rem",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <button onClick={onClose} style={{background:"none",border:"none",padding:"0.3rem",cursor:"pointer",color:T.textMid,fontSize:"1.1rem"}}>✕</button>
          <div style={{flex:1,fontSize:"0.95rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>New group chat</div>
          <button onClick={handleCreate} disabled={selected.size < 2 || creating}
            style={{padding:"0.4rem 0.85rem",borderRadius:"999px",background:selected.size>=2?T.accent:T.surfaceAlt,color:selected.size>=2?"#fff":T.textLight,border:"none",cursor:selected.size>=2?"pointer":"not-allowed",fontSize:"0.78rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>
            {creating ? "…" : `Create${selected.size>0?` (${selected.size+1})`:""}`}
          </button>
        </div>

        {/* Optional name */}
        <div style={{padding:"0.85rem 1rem 0.5rem"}}>
          <input value={name} onChange={e=>setName(e.target.value.slice(0,60))}
            placeholder="Group name (optional)"
            style={{width:"100%",padding:"0.6rem 0.85rem",borderRadius:"0.75rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:T.bg,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"}}/>
        </div>

        {/* Selected chips */}
        {selected.size > 0 && (
          <div style={{padding:"0 1rem 0.6rem",display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
            {[...selected].map(uid => {
              const u = connections.find(c => c.uid === uid) || selectedDocs[uid];
              if (!u) return null;
              return (
                <button key={uid} onClick={()=>togglePick(uid)}
                  style={{display:"flex",alignItems:"center",gap:"0.35rem",padding:"0.3rem 0.6rem 0.3rem 0.35rem",borderRadius:"999px",background:T.accent+"15",border:`1px solid ${T.accent}40`,color:T.accent,cursor:"pointer",fontSize:"0.72rem",fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>
                  <Avatar photoURL={u.photoURL} name={u.displayName} size={20}/>
                  <span>{u.displayName?.split(" ")[0]||"User"}</span>
                  <span style={{opacity:0.7}}>✕</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div style={{padding:"0 1rem 0.6rem"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search people…"
            style={{width:"100%",padding:"0.55rem 0.85rem",borderRadius:"999px",border:`1px solid ${T.border}`,fontSize:"0.78rem",color:T.text,background:T.bg,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"}}/>
        </div>

        {/* Candidates list */}
        <div style={{flex:1,overflowY:"auto",padding:"0 1rem 1.5rem"}}>
          {candidates.length === 0 && !searching && (
            <div style={{padding:"2rem 1rem",textAlign:"center",color:T.textLight,fontSize:"0.78rem",lineHeight:1.5}}>
              {search.trim()
                ? `No users found for "${search}". Try a different name.`
                : connections.length === 0
                  ? "Search for people by name above, or follow some people to see them here."
                  : "No connections to show."}
            </div>
          )}
          {searching && candidates.length === 0 && (
            <div style={{padding:"2rem 1rem",textAlign:"center",color:T.textLight,fontSize:"0.78rem"}}>Searching…</div>
          )}
          {candidates.map(u => {
            const isSel = selected.has(u.uid);
            return (
              <button key={u.uid} onClick={()=>togglePick(u)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.65rem 0.4rem",background:isSel?T.accent+"12":"transparent",borderRadius:"0.6rem",border:"none",cursor:"pointer",textAlign:"left",marginBottom:"0.15rem"}}>
                <Avatar photoURL={u.photoURL} name={u.displayName} size={38}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.82rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{displayNameOf(u)}</div>
                </div>
                <div style={{width:"22px",height:"22px",borderRadius:"50%",border:`2px solid ${isSel?T.accent:T.border}`,background:isSel?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {isSel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function GroupConvoRow({ convo, unread, currentUid, onOpen, onDelete }) {
  const [members, setMembers] = useState([]);
  const lpTimer = React.useRef(null);
  const lpFired = React.useRef(false);
  useEffect(() => {
    const ids = (convo.participants || []).filter(uid => uid !== currentUid).slice(0, 4);
    if (!ids.length) return;
    Promise.all(ids.map(uid => getDoc(doc(db, "users", uid)).catch(() => null)))
      .then(snaps => setMembers(snaps.filter(s => s && s.exists()).map(s => ({ uid: s.id, ...s.data() }))));
  }, [convo.id, currentUid]);

  function startLP() {
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      onDelete?.();
    }, 550);
  }
  function endLP() { clearTimeout(lpTimer.current); }

  const ts = convo.lastAt?.seconds ? timeAgo({ seconds: convo.lastAt.seconds }) : "";
  const title = (convo.name || "").trim() || (() => {
    const names = members.map(m => displayNameOf(m).split(" ")[0] || "Rallier");
    if (names.length === 0) return "Group chat";
    if (names.length <= 2) return names.join(" & ");
    return `${names[0]}, ${names[1]} & ${(convo.participants?.length || 0) - 3} more`;
  })();

  return (
    <button
      onClick={() => { if (lpFired.current) return; onOpen?.(); }}
      onTouchStart={startLP} onTouchEnd={endLP} onTouchMove={endLP} onTouchCancel={endLP}
      onMouseDown={startLP} onMouseUp={endLP} onMouseLeave={endLP}
      onContextMenu={e => { e.preventDefault(); onDelete?.(); }}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.85rem 0", background:"none", border:"none", borderBottom:`1px solid ${T.border}40`, cursor:"pointer", textAlign:"left" }}>
      <div style={{ position:"relative", flexShrink:0, width:"44px", height:"44px" }}>
        {members.slice(0, 3).map((m, i) => (
          <div key={m.uid} style={{ position:"absolute", top: i===0?0:i===1?14:0, left: i===0?0:i===1?16:24, zIndex: 3-i }}>
            <Avatar photoURL={m.photoURL} name={m.displayName} size={i===0?28:24}/>
          </div>
        ))}
        {unread > 0 && <div style={{ position:"absolute", top:0, right:0, width:"10px", height:"10px", borderRadius:"50%", background:T.rose, border:`2px solid ${T.bg}`, zIndex:10 }}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <span style={{ fontSize:"0.85rem", fontWeight: unread > 0 ? "700" : "600", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
            <span style={{ color:T.accent, marginRight:"0.3rem" }}>👥</span>{title}
          </span>
          <span style={{ fontSize:"0.62rem", color:T.textLight, flexShrink:0, marginLeft:"0.5rem" }}>{ts}</span>
        </div>
        <div style={{ fontSize:"0.75rem", color: unread > 0 ? T.text : T.textLight, fontWeight: unread > 0 ? "500" : "400", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:"1px", fontFamily:"'Inter',sans-serif" }}>
          {convo.lastMessage || "No messages yet — say hi!"}
        </div>
      </div>
    </button>
  );
}

function ConvoRow({ convoId, otherUid, lastMessage, lastAt, unread, onOpen, currentUid, onDelete }) {
  const [other, setOther] = useState(null);
  const lpTimer = React.useRef(null);
  const lpFired = React.useRef(false);
  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, "users", otherUid)).then(d => { if (d.exists()) setOther({ uid: d.id, ...d.data() }); }).catch(() => {});
  }, [otherUid]);
  if (!other) return null;
  const ts = lastAt?.seconds ? timeAgo({ seconds: lastAt.seconds }) : "";

  function startLP() {
    lpFired.current = false;
    lpTimer.current = setTimeout(() => {
      lpFired.current = true;
      if (navigator.vibrate) navigator.vibrate(20);
      onDelete?.();
    }, 550);
  }
  function endLP() {
    clearTimeout(lpTimer.current);
  }

  return (
    <button
      onClick={() => { if (lpFired.current) return; onOpen(other); }}
      onTouchStart={startLP} onTouchEnd={endLP} onTouchMove={endLP} onTouchCancel={endLP}
      onMouseDown={startLP} onMouseUp={endLP} onMouseLeave={endLP}
      onContextMenu={e => { e.preventDefault(); onDelete?.(); }}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.85rem 0", background:"none", border:"none", borderBottom:`1px solid ${T.border}40`, cursor:"pointer", textAlign:"left" }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <Avatar photoURL={other.photoURL} name={other.displayName} size={44}/>
        {unread > 0 && <div style={{ position:"absolute", top:0, right:0, width:"10px", height:"10px", borderRadius:"50%", background:T.rose, border:`2px solid ${T.bg}` }}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <span style={{ fontSize:"0.85rem", fontWeight: unread > 0 ? "700" : "600", color:T.text, fontFamily:"'Inter',sans-serif" }}>{other.displayName}</span>
          <span style={{ fontSize:"0.62rem", color:T.textLight, flexShrink:0 }}>{ts}</span>
        </div>
        <div style={{ fontSize:"0.75rem", color: unread > 0 ? T.text : T.textLight, fontWeight: unread > 0 ? "500" : "400", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:"1px", fontFamily:"'Inter',sans-serif" }}>
          {lastMessage || "Say hi!"}
        </div>
      </div>
    </button>
  );
}

function GroupInfoSheet({ user, profile, conversation, memberDocs, onClose, onLeave }) {
  const { toast } = useToast();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!conversation) return null;
  const participants = conversation.participants || [];

  async function removeMember(uid) {
    if (busy) return;
    if (uid === user.uid) {
      if (!confirm("Leave this group? You'll stop receiving messages from it.")) return;
    } else {
      const m = memberDocs[uid];
      const name = m?.displayName || "this person";
      if (!confirm(`Remove ${name} from the group?`)) return;
    }
    setBusy(true);
    try {
      await updateDoc(doc(db, "conversations", conversation.id), {
        participants: arrayRemove(uid),
        [`unread_${uid}`]: 0,
      });
      const removedName = memberDocs[uid]?.displayName || "Someone";
      const isLeave = uid === user.uid;
      await addDoc(collection(db, "conversations", conversation.id, "messages"), {
        type: "system",
        text: isLeave ? `${profile?.displayName || "Someone"} left the group` : `${profile?.displayName || "Someone"} removed ${removedName}`,
        fromUid: user.uid,
        createdAt: serverTimestamp(),
      });
      if (uid === user.uid) onLeave?.();
    } catch(e) {
      toast("Couldn't remove: " + (e?.message || "unknown"), "error");
    }
    setBusy(false);
  }

  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9700,background:"rgba(17,24,39,0.4)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:"480px",margin:"0 auto",background:T.surface,borderRadius:"1.25rem 1.25rem 0 0",maxHeight:"80vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"0.85rem 1rem",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <button onClick={onClose} style={{background:"none",border:"none",padding:"0.3rem",cursor:"pointer",color:T.textMid,fontSize:"1.1rem"}}>✕</button>
          <div style={{flex:1,fontSize:"0.95rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>
            {(conversation.name || "").trim() || "Group chat"} · {participants.length} people
          </div>
        </div>

        <div style={{flex:1,overflowY:"auto",padding:"0.5rem 1rem 1.5rem"}}>
          {participants.map(uid => {
            const m = memberDocs[uid];
            const isMe = uid === user.uid;
            return (
              <div key={uid} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0",borderBottom:`1px solid ${T.border}40`}}>
                <Avatar photoURL={m?.photoURL} name={m?.displayName} size={38}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>
                    {isMe ? "You" : (m?.displayName || "Loading…")}
                    {uid === conversation.createdBy && <span style={{fontSize:"0.6rem",color:T.textLight,fontWeight:"500",marginLeft:"0.4rem"}}>· creator</span>}
                  </div>
                </div>
                <button onClick={() => removeMember(uid)} disabled={busy}
                  style={{padding:"0.3rem 0.65rem",background:isMe?T.rose+"15":"transparent",color:isMe?T.rose:T.textLight,border:`1px solid ${isMe?T.rose+"40":T.border}`,borderRadius:"0.5rem",fontSize:"0.65rem",fontWeight:"600",cursor:busy?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif"}}>
                  {isMe ? "Leave group" : "Remove"}
                </button>
              </div>
            );
          })}

          {participants.length < 10 && (
            <button onClick={()=>setAdding(true)}
              style={{marginTop:"0.85rem",width:"100%",padding:"0.7rem 1rem",background:T.accent+"10",color:T.accent,border:`1px dashed ${T.accent}55`,borderRadius:"0.7rem",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
              ＋ Add people ({10 - participants.length} slots left)
            </button>
          )}
          {participants.length >= 10 && (
            <div style={{marginTop:"0.85rem",textAlign:"center",fontSize:"0.7rem",color:T.textLight}}>
              Group is full (10 / 10)
            </div>
          )}
        </div>
      </div>

      {adding && (
        <AddGroupMembersModal
          user={user}
          profile={profile}
          conversation={conversation}
          existingUids={new Set(participants)}
          onClose={()=>setAdding(false)}
          onAdded={()=>{setAdding(false);}}
        />
      )}
    </div>,
    document.body
  );
}

function AddGroupMembersModal({ user, profile, conversation, existingUids, onClose, onAdded }) {
  const { toast } = useToast();
  const [connections, setConnections] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      const data = snap?.data() || {};
      const allIds = [...new Set([...(data.following||[]), ...(data.followers||[])])].filter(id => id !== user.uid && !existingUids.has(id));
      if (!allIds.length) return;
      const chunks = [];
      for (let i = 0; i < allIds.length; i += 10) chunks.push(allIds.slice(i, i + 10));
      const users = [];
      for (const chunk of chunks) {
        const s = await getDocs(query(collection(db, "users"), where("__name__", "in", chunk))).catch(() => null);
        if (s) s.docs.forEach(d => users.push({ uid: d.id, ...d.data() }));
      }
      setConnections(users);
    })();
  }, [user?.uid]);

  const slotsLeft = 10 - existingUids.size;
  const candidates = connections
    .filter(u => !search.trim() || (u.displayName||"").toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => (a.displayName||"").localeCompare(b.displayName||""));

  function togglePick(uid) {
    setSelected(s => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else if (n.size >= slotsLeft) { toast(`Only ${slotsLeft} slot${slotsLeft===1?"":"s"} left`, "warning"); return n; }
      else n.add(uid);
      return n;
    });
  }

  async function handleAdd() {
    if (!selected.size) return;
    setBusy(true);
    try {
      const newIds = [...selected];
      const update = { participants: arrayUnion(...newIds) };
      newIds.forEach(uid => { update[`unread_${uid}`] = 0; });
      await updateDoc(doc(db, "conversations", conversation.id), update);
      const names = newIds.map(uid => connections.find(c => c.uid === uid)?.displayName || "Someone");
      await addDoc(collection(db, "conversations", conversation.id, "messages"), {
        type: "system",
        text: `${profile?.displayName || "Someone"} added ${names.join(", ")}`,
        fromUid: user.uid,
        createdAt: serverTimestamp(),
      });
      onAdded?.();
    } catch(e) {
      toast("Couldn't add: " + (e?.message || "unknown"), "error");
    }
    setBusy(false);
  }

  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9800,background:"rgba(17,24,39,0.5)",display:"flex",flexDirection:"column",justifyContent:"flex-end"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()}
        style={{width:"100%",maxWidth:"480px",margin:"0 auto",background:T.surface,borderRadius:"1.25rem 1.25rem 0 0",maxHeight:"82vh",display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <div style={{padding:"0.85rem 1rem",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <button onClick={onClose} style={{background:"none",border:"none",padding:"0.3rem",cursor:"pointer",color:T.textMid,fontSize:"1.1rem"}}>✕</button>
          <div style={{flex:1,fontSize:"0.95rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>Add to group</div>
          <button onClick={handleAdd} disabled={!selected.size || busy}
            style={{padding:"0.4rem 0.85rem",borderRadius:"999px",background:selected.size?T.accent:T.surfaceAlt,color:selected.size?"#fff":T.textLight,border:"none",cursor:selected.size?"pointer":"not-allowed",fontSize:"0.78rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>
            {busy ? "…" : `Add${selected.size>0?` (${selected.size})`:""}`}
          </button>
        </div>
        <div style={{padding:"0.7rem 1rem 0.5rem"}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search people…"
            style={{width:"100%",padding:"0.55rem 0.85rem",borderRadius:"999px",border:`1px solid ${T.border}`,fontSize:"0.78rem",color:T.text,background:T.bg,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"}}/>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 1rem 1.5rem"}}>
          {candidates.length === 0 && (
            <div style={{padding:"2rem 1rem",textAlign:"center",color:T.textLight,fontSize:"0.78rem"}}>
              {connections.length === 0 ? "Everyone you follow is already in this group." : `No matches for "${search}".`}
            </div>
          )}
          {candidates.map(u => {
            const isSel = selected.has(u.uid);
            return (
              <button key={u.uid} onClick={()=>togglePick(u.uid)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:"0.7rem",padding:"0.55rem 0.4rem",background:isSel?T.accent+"12":"transparent",borderRadius:"0.6rem",border:"none",cursor:"pointer",textAlign:"left"}}>
                <Avatar photoURL={u.photoURL} name={u.displayName} size={36}/>
                <div style={{flex:1,minWidth:0,fontSize:"0.82rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{u.displayName}</div>
                <div style={{width:"22px",height:"22px",borderRadius:"50%",border:`2px solid ${isSel?T.accent:T.border}`,background:isSel?T.accent:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {isSel && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ProductPickerModal({ user, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDocs(query(collection(db, "products"), where("approved", "==", true), limit(200)))
      .then(snap => {
        setAllProducts(snap.docs.map(d => ({ ...d.data(), id: d.id })));
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const results = q.trim().length < 2 ? [] : allProducts.filter(p =>
    (p.productName||"").toLowerCase().includes(q.toLowerCase()) ||
    (p.brand||"").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 15);

  return (
    <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0, zIndex:200, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:"480px", margin:"0 auto", background:T.surface, borderRadius:"1.25rem 1.25rem 0 0", padding:"1rem", maxHeight:"70vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.85rem" }}>
          <span style={{ fontSize:"0.95rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif" }}>Share a product</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.textLight }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" autoFocus
          style={{ padding:"0.6rem 0.9rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"0.82rem", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surfaceAlt, outline:"none", marginBottom:"0.75rem" }}/>
        <div style={{ overflowY:"auto", flex:1 }}>
          {loading && <div style={{ textAlign:"center", color:T.textLight, padding:"1rem", fontSize:"0.78rem" }}>Searching…</div>}
          {results.map((p, i) => {
            const ps = poreStyle(p.poreScore ?? 0);
            return (
              <button key={p.id} onClick={() => onSelect({...p, image: p.adminImage||p.image||""})}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.65rem", padding:"0.7rem 0", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}40` : "none", cursor:"pointer", textAlign:"left" }}>
                <div style={{ width:"44px", height:"44px", flexShrink:0, borderRadius:"0.6rem", overflow:"hidden", background:T.surfaceAlt }}>
                  {p.image ? <img src={p.image} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", padding:"4px", mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)" }}/> : null}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  {p.brand && <div style={{ fontSize:"0.6rem", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.09em" }}>{p.brand}</div>}
                  <div style={{ fontSize:"0.82rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.productName}</div>
                </div>
                {p.poreScore != null && <span style={{ fontSize:"0.72rem", fontWeight:"700", color:ps.color, flexShrink:0 }}>{p.poreScore}/5</span>}
              </button>
            );
          })}
          {!loading && q.trim().length < 2 && (
            <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>Type to search your products…</div>
          )}
          {!loading && q.trim().length >= 2 && results.length === 0 && (
            <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>No products found</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChatView({ user, profile, other, kind = "dm", conversation = null, onBack, onUserTap, onProductTap }) {
  const productCache = useProductCache();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [groupConv, setGroupConv] = useState(conversation);
  const [memberDocs, setMemberDocs] = useState({});
  const bottomRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const typingTimerRef = React.useRef(null);

  const isGroup = kind === "group";
  const cid = isGroup ? (conversation?.id || groupConv?.id) : convId(user.uid, other?.uid || "");
  const participants = isGroup ? (groupConv?.participants || conversation?.participants || []) : [user.uid, other?.uid].filter(Boolean);

  useEffect(() => {
    if (!isGroup || !cid) return;
    const unsub = onSnapshot(doc(db, "conversations", cid), snap => {
      if (snap.exists()) setGroupConv({ id: snap.id, ...snap.data() });
    });
    return unsub;
  }, [isGroup, cid]);

  useEffect(() => {
    if (!isGroup) return;
    const unknown = participants.filter(uid => !memberDocs[uid]);
    if (!unknown.length) return;
    Promise.all(unknown.map(uid => getDoc(doc(db, "users", uid)).catch(() => null)))
      .then(snaps => {
        const next = {};
        snaps.forEach(s => { if (s && s.exists()) next[s.id] = { uid: s.id, ...s.data() }; });
        if (Object.keys(next).length) setMemberDocs(d => ({ ...d, ...next }));
      });
  }, [isGroup, participants.join(",")]);

  useEffect(() => {
    if (!cid) return;
    const q = query(collection(db, "conversations", cid, "messages"), orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    updateDoc(doc(db, "conversations", cid), { [`unread_${user.uid}`]: 0 }).catch(() => {});
    return unsub;
  }, [cid]);

  useEffect(() => {
    if (!cid) return;
    const unsub = onSnapshot(doc(db, "conversations", cid), snap => {
      const data = snap.data() || {};
      if (isGroup) {
        const someoneTyping = participants.some(uid => uid !== user.uid && data[`typing_${uid}`]);
        setOtherTyping(someoneTyping);
      } else {
        setOtherTyping(!!(data[`typing_${other?.uid}`]));
      }
    }, () => {});
    return unsub;
  }, [cid, isGroup, participants.join(","), other?.uid]);

  function onTextChange(val) {
    setText(val);
    if (!val.trim()) {
      updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: false }).catch(() => {});
      return;
    }
    updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: true }).catch(() => {});
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: false }).catch(() => {});
    }, 2500);
  }

  useEffect(() => () => {
    updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: false }).catch(() => {});
    clearTimeout(typingTimerRef.current);
  }, [cid]);

  async function deleteMessage(msgId) {
    setLongPressMsg(null);
    await deleteDoc(doc(db, "conversations", cid, "messages", msgId)).catch(() => {});
  }

  async function hideChat() {
    if (!cid) return;
    const verb = isGroup ? "Delete this group chat from your inbox?" : "Delete this chat from your inbox?";
    const detail = "It will reappear if anyone sends a new message. " + (isGroup ? "Use 'Leave group' if you want to leave permanently." : "");
    if (!confirm(verb + "\n\n" + detail)) return;
    setShowHeaderMenu(false);
    try {
      await updateDoc(doc(db, "conversations", cid), {
        hiddenFor: arrayUnion(user.uid),
        [`unread_${user.uid}`]: 0,
      });
      onBack?.();
    } catch(e) {
      console.error("hideChat failed:", e);
      alert("Couldn't delete chat: " + (e?.message || "unknown"));
    }
  }

  async function send() {
    if (!text.trim() || !cid) return;
    setSending(true);
    const draft = text.trim();
    try {
      await sendToConversation(cid, user.uid, {
        type: "text",
        text: draft,
        senderName: profile?.displayName || user.displayName || "",
        senderPhoto: profile?.photoURL || user.photoURL || "",
      });
      setText("");
    } catch(e) {
      console.error("send failed:", e);
      alert("Couldn't send: " + (e?.message || "unknown error") + ". Your message wasn't sent — try again.");
    }
    setSending(false);
  }

  async function sendPhoto(file) {
    if (!file || !cid) return;
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        try {
          await sendToConversation(cid, user.uid, {
            type: "photo",
            photoData: base64,
            senderName: profile?.displayName || user.displayName || "",
            senderPhoto: profile?.photoURL || user.photoURL || "",
          });
        } catch(err) {
          console.error("sendPhoto failed:", err);
          alert("Couldn't send photo: " + (err?.message || "unknown error"));
        }
        setPhotoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setPhotoUploading(false); }
  }

  async function sendProduct(product) {
    setShowProductPicker(false);
    if (!cid) return;
    const ing = product.ingredients || "";
    const liveScore = ing.trim().length > 10
      ? (() => { try { const r = analyzeIngredients(ing); return r.avgScore!=null ? Math.round(r.avgScore) : null; } catch { return null; } })()
      : null;
    try {
      await sendToConversation(cid, user.uid, {
        type: "product",
        productName: product.productName || product.name || "",
        brand: product.brand || "",
        productImage: product.adminImage || product.productImage || product.image || "",
        poreScore: liveScore ?? product.poreScore ?? null,
        hasScore: true,
        ingredients: ing,
        buyUrl: product.buyUrl || "",
        senderName: profile?.displayName || user.displayName || "",
        senderPhoto: profile?.photoURL || user.photoURL || "",
      });
    } catch(e) {
      console.error("sendProduct failed:", e);
      alert("Couldn't share product: " + (e?.message || "unknown error"));
    }
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", maxHeight:"-webkit-fill-available", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.85rem 1rem", borderBottom:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:"0.2rem", color:T.textLight, display:"flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        {isGroup ? (
          <button onClick={() => setShowGroupInfo(true)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", gap:"0.6rem", flex:1, minWidth:0 }}>
            <div style={{ position:"relative", flexShrink:0, width:"40px", height:"32px" }}>
              {participants.filter(uid => uid !== user.uid).slice(0, 3).map((uid, i) => {
                const m = memberDocs[uid];
                return (
                  <div key={uid} style={{ position:"absolute", top: i===0?0:i===1?8:0, left: i===0?0:i===1?12:18, zIndex: 3-i }}>
                    <Avatar photoURL={m?.photoURL} name={m?.displayName||"?"} size={i===0?24:20}/>
                  </div>
                );
              })}
            </div>
            <div style={{ minWidth:0, flex:1, textAlign:"left" }}>
              <div style={{ fontSize:"0.88rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {(groupConv?.name || "").trim() || (() => {
                  const others = participants.filter(uid => uid !== user.uid).map(uid => memberDocs[uid]?.displayName?.split(" ")[0] || "Someone");
                  if (others.length <= 2) return others.join(" & ");
                  return `${others[0]}, ${others[1]} & ${others.length - 2} more`;
                })()}
              </div>
              <div style={{ fontSize:"0.62rem", color:T.textLight, marginTop:"1px" }}>{participants.length} people · tap to manage</div>
            </div>
          </button>
        ) : (
          <button onClick={() => onUserTap(other.uid)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", gap:"0.6rem" }}>
            <Avatar photoURL={other.photoURL} name={other.displayName} size={36}/>
            <span style={{ fontSize:"0.9rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif" }}>{other.displayName}</span>
          </button>
        )}
        <div style={{ flex:1 }}/>
        <div style={{ position:"relative", flexShrink:0 }}>
          <button onClick={() => setShowHeaderMenu(m => !m)}
            style={{ background:"none", border:"none", cursor:"pointer", padding:"0.4rem", color:T.textMid, display:"flex" }}
            aria-label="Chat options">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
          </button>
          {showHeaderMenu && (
            <>
              <div onClick={() => setShowHeaderMenu(false)}
                style={{ position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:90 }}/>
              <div style={{ position:"absolute", top:"100%", right:0, marginTop:"0.4rem", background:T.surface, borderRadius:"0.7rem", border:`1px solid ${T.border}`, boxShadow:"0 6px 24px rgba(17,24,39,0.12)", minWidth:"180px", zIndex:91, overflow:"hidden" }}>
                {isGroup && (
                  <button onClick={() => { setShowHeaderMenu(false); setShowGroupInfo(true); }}
                    style={{ width:"100%", padding:"0.7rem 0.85rem", background:"none", border:"none", borderBottom:`1px solid ${T.border}40`, cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.6rem", color:T.text, fontSize:"0.8rem", fontFamily:"'Inter',sans-serif" }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                    Group info
                  </button>
                )}
                <button onClick={hideChat}
                  style={{ width:"100%", padding:"0.7rem 0.85rem", background:"none", border:"none", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.6rem", color:T.rose, fontSize:"0.8rem", fontFamily:"'Inter',sans-serif", fontWeight:"600" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  Delete chat
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      {showGroupInfo && isGroup && (
        <GroupInfoSheet
          user={user}
          conversation={groupConv}
          memberDocs={memberDocs}
          profile={profile}
          onClose={() => setShowGroupInfo(false)}
          onLeave={() => { setShowGroupInfo(false); onBack(); }}
        />
      )}

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"1rem", paddingBottom:"1.5rem", display:"flex", flexDirection:"column", gap:"0.6rem" }}>
        {messages.map((m, idx) => {
          const isMe = m.fromUid === user.uid;
          const prev = idx > 0 ? messages[idx-1] : null;
          const showSender = isGroup && !isMe && (!prev || prev.fromUid !== m.fromUid);
          const senderName = m.senderName || memberDocs[m.fromUid]?.displayName || "";
          const senderPhoto = m.senderPhoto || memberDocs[m.fromUid]?.photoURL || "";
          if (m.type === "system") {
            return (
              <div key={m.id} style={{ display:"flex", justifyContent:"center", padding:"0.25rem 0" }}>
                <span style={{ fontSize:"0.65rem", color:T.textLight, fontFamily:"'Inter',sans-serif", fontStyle:"italic" }}>
                  {m.text}
                </span>
              </div>
            );
          }
          return (
            <div key={m.id} style={{ display:"flex", flexDirection:"column", alignItems: isMe ? "flex-end" : "flex-start" }}>
              {showSender && (
                <div style={{ display:"flex", alignItems:"center", gap:"0.4rem", marginLeft:"0.3rem", marginBottom:"0.15rem" }}>
                  <Avatar photoURL={senderPhoto} name={senderName} size={18}/>
                  <span style={{ fontSize:"0.65rem", color:T.textLight, fontWeight:"600", fontFamily:"'Inter',sans-serif" }}>{senderName?.split(" ")[0] || "Someone"}</span>
                </div>
              )}
              <div style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start", width:"100%" }}>
              {m.type === "text" && (
                <div
                  onContextMenu={e => { e.preventDefault(); setLongPressMsg({id:m.id, isMe}); }}
                  onTouchStart={(() => { let t; return () => { t = setTimeout(() => setLongPressMsg({id:m.id, isMe}), 500); return () => clearTimeout(t); }; })()}
                  style={{ maxWidth:"75%", padding:"0.55rem 0.9rem", borderRadius: isMe ? "1.1rem 1.1rem 0.2rem 1.1rem" : "1.1rem 1.1rem 1.1rem 0.2rem", background: isMe ? T.navy : T.surfaceAlt, color: isMe ? "#fff" : T.text, fontSize:"0.85rem", fontFamily:"'Inter',sans-serif", lineHeight:1.45, cursor:"default", userSelect:"none" }}>
                  {m.text}
                </div>
              )}
              {m.type === "photo" && m.photoData && (
                <div style={{ maxWidth:"65%", borderRadius:"0.85rem", overflow:"hidden", border:`1px solid ${T.border}` }}>
                  <img src={m.photoData} alt="Skin photo" style={{ width:"100%", display:"block", maxHeight:"280px", objectFit:"cover" }}/>
                </div>
              )}
              {m.type === "product" && (() => {
                const live = productCache.get(m.productId) || productCache.get(m.productName) || null;
                const liveImg = (live ? getProductImage(live) : "") || m.productImage || "";
                const liveBr = live?.brand || m.brand || "";
                const liveSc = live?.poreScore ?? m.poreScore;
                return (
                <button onClick={() => onProductTap?.({ id: live?.id || m.productId, productId: live?.id || m.productId, productName: m.productName, brand: liveBr, productImage: liveImg, poreScore: liveSc })}
                  style={{ maxWidth:"75%", background: T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:"0.85rem", overflow:"hidden", cursor:"pointer", textAlign:"left", padding:0 }}>
                  <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", padding:"0.65rem 0.75rem" }}>
                    {liveImg && (
                      <div style={{ width:"44px", height:"44px", flexShrink:0, borderRadius:"0.5rem", overflow:"hidden", background:T.surface }}>
                        <img src={liveImg} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", padding:"3px", mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)" }}/>
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      {liveBr && <div style={{ fontSize:"0.58rem", fontWeight:"600", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.09em" }}>{liveBr}</div>}
                      <div style={{ fontSize:"0.82rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{getProductDisplayName({productName: m.productName, brand: liveBr})}</div>
                      {m.hasScore && liveSc !== null && liveSc !== undefined
                        ? <div style={{ fontSize:"0.68rem", fontWeight:"700", color:poreStyle(liveSc).color, marginTop:"2px" }}>{liveSc}/5 · {poreStyle(liveSc).label}</div>
                        : <div style={{ fontSize:"0.68rem", color:T.textLight, marginTop:"2px" }}>Tap to view details</div>
                      }
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </button>
                );
              })()}
              </div>
            </div>
          );
        })}
        {photoUploading && (
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <div style={{ padding:"0.55rem 0.9rem", borderRadius:"1.1rem", background:T.surfaceAlt, fontSize:"0.78rem", color:T.textLight }}>Sending photo…</div>
          </div>
        )}
        {otherTyping && (
          <div style={{ display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"0.4rem" }}>
            {!isGroup && <Avatar photoURL={other?.photoURL} name={other?.displayName} size={22}/>}
            <div style={{ padding:"0.5rem 0.8rem", borderRadius:"1.1rem 1.1rem 1.1rem 0.2rem", background:T.surfaceAlt, display:"flex", gap:"4px", alignItems:"center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:T.textLight, animation:`typingDot 1.2s ${i*0.2}s infinite ease-in-out` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Long-press delete sheet */}
      {longPressMsg && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0, zIndex:200, background:"rgba(0,0,0,0.4)" }} onClick={() => setLongPressMsg(null)}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:T.surface, borderRadius:"1.25rem 1.25rem 0 0", padding:"1rem", paddingBottom:"calc(1rem + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:"36px", height:"4px", borderRadius:"2px", background:T.border, margin:"0 auto 1rem" }}/>
            {longPressMsg.isMe ? (
              <>
                <button onClick={() => deleteMessage(longPressMsg.id)}
                  style={{ width:"100%", padding:"0.85rem 1rem", background:"none", border:"none", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.75rem", color:T.rose, fontFamily:"'Inter',sans-serif", fontSize:"0.9rem", fontWeight:"500" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  Delete message
                </button>
              </>
            ) : (
              <div style={{ padding:"0.85rem 1rem", color:T.textLight, fontFamily:"'Inter',sans-serif", fontSize:"0.85rem" }}>You can only delete your own messages</div>
            )}
            <button onClick={() => setLongPressMsg(null)}
              style={{ width:"100%", padding:"0.75rem", background:T.surfaceAlt, border:"none", borderRadius:"0.85rem", cursor:"pointer", fontFamily:"'Inter',sans-serif", fontSize:"0.85rem", color:T.text, marginTop:"0.5rem" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product picker modal */}
      {showProductPicker && (
        <ProductPickerModal user={user} onSelect={sendProduct} onClose={() => setShowProductPicker(false)}/>
      )}

      {/* Input bar */}
      <div style={{ padding:"0.65rem 1rem", paddingBottom:"calc(4.5rem + env(safe-area-inset-bottom))", borderTop:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", gap:"0.5rem", flexShrink:0, zIndex:61, position:"relative" }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ background:"none", border:"none", cursor:"pointer", padding:"0.3rem", color:T.textLight, display:"flex", flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { if(e.target.files[0]) sendPhoto(e.target.files[0]); e.target.value=""; }}/>
        <button onClick={() => setShowProductPicker(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0.3rem", color:T.textLight, display:"flex", flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </button>
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          value={text}
          onChange={e => onTextChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && !sending && send()}
          placeholder="Message…"
          style={{ flex:1, padding:"0.5rem 0.85rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"16px", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surfaceAlt, outline:"none" }}
        />
        <button onClick={send} disabled={!text.trim() || sending}
          style={{ width:"34px", height:"34px", borderRadius:"50%", background: text.trim() ? T.navy : T.surfaceAlt, border:"none", cursor: text.trim() ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? "#fff" : T.textLight} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessagesPage — named export
// ---------------------------------------------------------------------------

export function MessagesPage({ user, profile, onUserTap, onUnreadChange, onChatOpen, chatCloseRef }) {
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openConvo, setOpenConvo] = useState(null);

  React.useEffect(() => {
    if (chatCloseRef) chatCloseRef.current = () => { setOpenConvo(null); onChatOpen?.(false); };
    return () => { if (chatCloseRef) chatCloseRef.current = null; };
  }, []);

  const [chatProduct, setChatProduct] = useState(null);
  const [chatProductLoading, setChatProductLoading] = useState(false);

  function openChat(payload) {
    if (payload && payload.uid && !payload.isGroup) {
      setOpenConvo({ kind: "dm", other: payload });
    } else if (payload && payload.isGroup) {
      setOpenConvo({ kind: "group", conversation: payload });
    } else {
      setOpenConvo(payload);
    }
    onChatOpen?.(true);
  }

  const [showNewGroup, setShowNewGroup] = useState(false);

  async function openChatProduct(snap) {
    setChatProductLoading(true);
    try {
      const q = query(collection(db, "products"), where("productName", "==", snap.productName), limit(1));
      const res = await getDocs(q);
      if (!res.empty) {
        const p = { id: res.docs[0].id, ...res.docs[0].data() };
        const ing = p.ingredients || "";
        const liveScore = ing.trim().length > 10
          ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : null; })()
          : null;
        setChatProduct({
          id: p.id,
          productId: p.id,
          productName: p.productName || snap.productName,
          brand: p.brand || snap.brand,
          image: p.adminImage || p.image || snap.productImage || "",
          poreScore: liveScore ?? p.poreScore ?? snap.poreScore ?? 0,
          communityRating: p.communityRating || null,
          ingredients: ing,
          flaggedIngredients: ing ? analyzeIngredients(ing).found : [],
          buyUrl: p.buyUrl || "",
        });
      } else {
        setChatProduct({ productName: snap.productName, brand: snap.brand, image: snap.productImage, poreScore: snap.poreScore ?? 0, ingredients: "", flaggedIngredients: [] });
      }
    } catch {
      setChatProduct({ productName: snap.productName, brand: snap.brand, image: snap.productImage, poreScore: snap.poreScore ?? 0, ingredients: "", flaggedIngredients: [] });
    }
    setChatProductLoading(false);
  }

  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [connections, setConnections] = useState([]);
  const searchRef = React.useRef(null);
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    async function loadConnections() {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      const data = snap?.data() || {};
      const followingIds = data.following || [];
      const followerIds = data.followers || [];
      const allIds = [...new Set([...followingIds, ...followerIds])].filter(id => id !== user.uid);
      if (!allIds.length) return;
      const snaps = await Promise.all(allIds.map(uid => getDoc(doc(db, "users", uid)).catch(() => null)));
      const users = snaps.filter(s => s && s.exists()).map(s => ({ uid: s.id, ...s.data() }));
      setConnections(users);
    }
    loadConnections();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      limit(50)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ ...d.data(), id: d.id }))
        .filter(c => !((c.hiddenFor || []).includes(user.uid)));
      list.sort((a, b) => {
        const aTs = a.lastAt?.seconds ?? Date.now() / 1000;
        const bTs = b.lastAt?.seconds ?? Date.now() / 1000;
        return bTs - aTs;
      });
      setConvos(list.slice(0, 30));
      const total = list.reduce((sum, c) => sum + (c[`unread_${user.uid}`] || 0), 0);
      onUnreadChange?.(total);
      setLoading(false);
    }, err => { console.warn("MessagesPage convos listener error:", err); setLoading(false); });
    return unsub;
  }, [user?.uid]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchRes([]); return; }
    getDocs(query(collection(db, "users"),
      where("displayName", ">=", searchQ),
      where("displayName", "<=", searchQ + ""),
      limit(10)
    )).then(snap => {
      setSearchRes(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid));
    }).catch(() => {});
  }, [searchQ]);

  if (openConvo) {
    return (
      <>
        <div style={{position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:60, background:T.bg, display:"flex", flexDirection:"column", height:"100%", maxHeight:"-webkit-fill-available"}}>
          <ChatView
            user={user}
            profile={profile}
            kind={openConvo.kind || "dm"}
            other={openConvo.other || openConvo}
            conversation={openConvo.conversation}
            onBack={() => { setOpenConvo(null); onChatOpen?.(false); }}
            onUserTap={onUserTap}
            onProductTap={openChatProduct}
          />
        </div>
        {chatProduct && <ProductModal product={chatProduct} user={user} profile={profile} onUpdateProfile={()=>{}} onClose={() => setChatProduct(null)} onUserTap={onUserTap}/>}
      </>
    );
  }

  const existingConvoUids = new Set(convos.filter(c => !c.isGroup).map(c => c.participants?.find(p => p !== user.uid)).filter(Boolean));
  const newConnections = connections.filter(u => !existingConvoUids.has(u.uid));

  const activeList = searchQ.trim() ? searchRes : null;

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "6rem", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.bg, zIndex: 10, borderBottom: `1px solid ${T.border}`, marginBottom: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: "700", color: T.navy, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>Messages</div>
        </div>
        <button onClick={() => setShowNewGroup(true)}
          style={{ display:"flex", alignItems:"center", gap:"0.3rem", padding:"0.4rem 0.7rem", borderRadius:"999px", background:T.accent+"12", border:`1px solid ${T.accent}55`, color:T.accent, cursor:"pointer", fontSize:"0.7rem", fontWeight:"600", fontFamily:"'Inter',sans-serif" }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          New group
        </button>
      </div>
      {showNewGroup && (
        <NewGroupModal
          user={user}
          profile={profile}
          connections={connections}
          onClose={() => setShowNewGroup(false)}
          onCreated={(cid, conv) => { setShowNewGroup(false); openChat({ ...conv, id: cid }); }}
        />
      )}
      <div style={{ padding: "0 1rem 0.75rem" }}>
        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: "1rem", display:"flex", gap:"0.5rem", alignItems:"center" }}>
          <div style={{ position:"relative", flex:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ position:"absolute", left:"0.8rem", top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              ref={searchRef}
              id="msg-search"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onFocus={e => { e.target.style.borderColor = T.accent; setTimeout(()=>e.target.scrollIntoView({behavior:"smooth",block:"center"}),100); }}
              onBlur={e => e.target.style.borderColor = T.border}
              placeholder="Search people…"
              style={{ width:"100%", padding:"0.6rem 1rem 0.6rem 2.2rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"0.82rem", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surface, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" }}
            />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ position:"absolute", right:"0.8rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.textLight, padding:"2px" }}>✕</button>}
          </div>
        </div>

        {/* Search results */}
        {activeList && (
          <div style={{ marginBottom:"1rem" }}>
            {activeList.length === 0
              ? <div style={{ textAlign:"center", color:T.textLight, fontSize:"0.78rem", padding:"1rem" }}>No users found</div>
              : activeList.map((u, i) => (
                  <ConnectionRow key={u.uid} u={u} i={i} onClick={() => { setSearchQ(""); openChat({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL }); }}/>
                ))
            }
          </div>
        )}

        {!activeList && (
          <>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.75rem 0" }}>
                  <div className="skeleton" style={{ width:"44px", height:"44px", borderRadius:"50%", flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div className="skeleton" style={{ height:"11px", width:"55%", marginBottom:"6px" }}/>
                    <div className="skeleton" style={{ height:"9px", width:"75%" }}/>
                  </div>
                </div>
              ))
            ) : convos.length > 0 && (
              <>
                <div style={{ fontSize:"0.6rem", fontWeight:"700", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.5rem", fontFamily:"'Inter',sans-serif" }}>Recent</div>
                {convos.map(c => {
                  const unread = c[`unread_${user.uid}`] || 0;
                  const handleDelete = async () => {
                    const isGrp = !!c.isGroup;
                    const verb = isGrp ? "Delete this group chat from your inbox?" : "Delete this chat from your inbox?";
                    const detail = "It will reappear if anyone sends a new message." + (isGrp ? " Use 'Leave group' inside the chat to leave permanently." : "");
                    if (!confirm(verb + "\n\n" + detail)) return;
                    try {
                      await updateDoc(doc(db, "conversations", c.id), {
                        hiddenFor: arrayUnion(user.uid),
                        [`unread_${user.uid}`]: 0,
                      });
                    } catch(e) { alert("Couldn't delete: " + (e?.message || "unknown")); }
                  };
                  if (c.isGroup) {
                    return <GroupConvoRow key={c.id} convo={c} unread={unread} currentUid={user.uid} onOpen={() => openChat(c)} onDelete={handleDelete}/>;
                  }
                  const otherUid = c.participants?.find(p => p !== user.uid);
                  return <ConvoRow key={c.id} convoId={c.id} otherUid={otherUid} lastMessage={c.lastMessage} lastAt={c.lastAt} unread={unread} onOpen={openChat} currentUid={user.uid} onDelete={handleDelete}/>;
                })}
              </>
            )}

            {newConnections.length > 0 && (
              <>
                <div style={{ fontSize:"0.6rem", fontWeight:"700", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.12em", margin:"1.1rem 0 0.5rem", fontFamily:"'Inter',sans-serif" }}>
                  {convos.length > 0 ? "People you can message" : "👋 Start a conversation"}
                </div>
                {newConnections.map((u, i) => (
                  <ConnectionRow key={u.uid} u={u} i={i} onClick={() => openChat({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL })}/>
                ))}
              </>
            )}

            {!loading && convos.length === 0 && newConnections.length === 0 && (
              <div style={{ textAlign:"center", padding:"3rem 1rem", color:T.textLight }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5" style={{ marginBottom:"0.75rem" }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <div style={{ fontSize:"0.85rem", fontFamily:"'Inter',sans-serif", fontWeight:"600", color:T.text }}>No conversations yet</div>
                <div style={{ fontSize:"0.72rem", marginTop:"0.35rem", lineHeight:1.5 }}>Search a name above to send your first message</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
