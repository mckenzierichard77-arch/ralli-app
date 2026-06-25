import React, { useState, useEffect, useRef } from "react";
import {
  signOut, onAuthStateChanged,
} from "firebase/auth";
import {
  doc, getDoc, updateDoc, arrayUnion,
  collection, query, where, orderBy, limit,
  onSnapshot,
} from "firebase/firestore";
import { T, GS } from "./data/tokens.js";
import { auth, db, ANTHROPIC_KEY } from "./lib/firebase.js";
import { getOrCreateProfile, markAllRead, isAdmin } from "./lib/userUtils.js";
import { ToastProvider, useToast } from "./components/providers/ToastProvider.jsx";
import { ProductCacheProvider } from "./components/providers/ProductCacheProvider.jsx";
import { BottomNav } from "./components/ui/BottomNav.jsx";

// Pages
import { ScanPage } from "./components/pages/ScanPage.jsx";
import { FeedPage } from "./components/pages/FeedPage.jsx";
import { ShopPage } from "./components/pages/ShopPage.jsx";
import { MessagesPage } from "./components/pages/MessagesPage.jsx";
import { NotificationsPage, NotifDropdown } from "./components/pages/NotifsPage.jsx";
import { MyProfilePage } from "./components/pages/ProfilePage.jsx";
import { AdminDashboard } from "./components/pages/AdminPage.jsx";
import { GlossaryPage } from "./components/pages/GlossaryPage.jsx";
import { AuthPage } from "./components/pages/AuthPage.jsx";

// Shared overlays used by the app shell
import { UserPage } from "./components/shared/UserPage.jsx";
import { OnboardingFlow } from "./components/shared/OnboardingFlow.jsx";
import { WelcomeBackScreen } from "./components/shared/WelcomeBackScreen.jsx";
import { OurStoryPopup } from "./components/shared/OurStoryPopup.jsx";

// ── ErrorBoundary ──────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error("App error:", error, info); }
  render() {
    if (this.state.error) {
      const isFirebase = this.state.error?.message?.includes("Firebase") || this.state.error?.message?.includes("network") || this.state.error?.message?.includes("fetch");
      return (
        <div style={{minHeight:"100vh",background:"#F8F9FB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:"'Inter',sans-serif"}}>
          <div style={{width:"56px",height:"56px",borderRadius:"50%",background:"#FBF0EE",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"1.25rem"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#AA4F57" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{fontSize:"1rem",fontWeight:"700",color:"#111827",marginBottom:"0.4rem",textAlign:"center"}}>
            {isFirebase ? "Connection issue" : "Something went wrong"}
          </div>
          <div style={{fontSize:"0.8rem",color:"#9AACBC",marginBottom:"1.5rem",textAlign:"center",maxWidth:"280px",lineHeight:1.6}}>
            {isFirebase
              ? "Couldn't reach the server. Check your connection and try again."
              : "An unexpected error occurred. Tapping retry usually fixes it."}
          </div>
          <button onClick={() => this.setState({ error: null, info: null })}
            style={{padding:"0.75rem 2rem",background:"#111827",color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Try again
          </button>
          {(process.env.NODE_ENV === "development" || true) && (
            <pre style={{marginTop:"1.5rem",fontSize:"0.6rem",color:"#9AACBC",maxWidth:"360px",whiteSpace:"pre-wrap",wordBreak:"break-all",background:"#F0F3F7",padding:"0.75rem",borderRadius:"0.5rem"}}>
              {this.state.error?.message}{"\n"}{this.state.error?.stack?.slice(0, 400)}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

// ── DebugPanel — admin-only floating log viewer ────────────────
const debugLogs = { entries: [], listeners: [] };
function debugLog(type, msg, data) {
  const entry = { type, msg, data, ts: Date.now() };
  debugLogs.entries.unshift(entry);
  if (debugLogs.entries.length > 80) debugLogs.entries.pop();
  debugLogs.listeners.forEach(fn => fn([...debugLogs.entries]));
}
const _origError = console.error;
const _origWarn  = console.warn;
console.error = (...args) => { _origError(...args); debugLog("error", args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")); };
console.warn  = (...args) => { _origWarn(...args);  debugLog("warn",  args.map(a => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" ")); };

function DebugPanel({ user, hidden = false }) {
  const [open, setOpen] = React.useState(false);
  const [logs, setLogs] = React.useState([...debugLogs.entries]);
  const [filter, setFilter] = React.useState("all");
  const [testStatus, setTestStatus] = React.useState("");

  React.useEffect(() => {
    debugLogs.listeners.push(setLogs);
    return () => { debugLogs.listeners = debugLogs.listeners.filter(fn => fn !== setLogs); };
  }, []);

  if (!isAdmin(user)) return null;
  if (hidden) return null;

  const filtered = filter === "all" ? logs : logs.filter(l => l.type === filter);
  const errorCount = logs.filter(l => l.type === "error").length;
  const typeColor = { error: "#f87171", warn: "#fbbf24", info: "#60a5fa", ok: "#4ade80", network: "#c084fc" };

  async function testAnthropicKey() {
    setTestStatus("Testing…");
    try {
      const res = await fetch("/api/anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 10, messages: [{ role: "user", content: "hi" }] }),
      });
      const d = await res.json();
      if (d.error) { setTestStatus("❌ " + d.error.message); debugLog("error", "API key test failed: " + d.error.message); }
      else { setTestStatus("✅ API key works"); debugLog("ok", "API key test passed"); }
    } catch(e) { setTestStatus("❌ " + e.message); debugLog("error", "API key test error: " + e.message); }
  }

  async function testOBF() {
    setTestStatus("Testing OBF…");
    try {
      const r = await fetch("https://world.openbeautyfacts.org/api/v0/product/3337875545082.json", { signal: AbortSignal.timeout(8000) });
      const d = await r.json();
      if (d.status === 1) { setTestStatus("✅ OBF reachable"); debugLog("ok", "OBF test passed: " + d.product?.product_name); }
      else { setTestStatus("❌ OBF: product not found"); }
    } catch(e) { setTestStatus("❌ OBF unreachable: " + e.message); debugLog("error", "OBF test failed: " + e.message); }
  }

  function addManualLog() {
    debugLog("info", "Manual test entry — " + new Date().toLocaleTimeString());
  }

  return (
    <>
      <button onClick={() => setOpen(o => !o)} style={{position:"fixed",bottom:"calc(5.5rem + env(safe-area-inset-bottom))",right:"1rem",zIndex:9998,width:"40px",height:"40px",borderRadius:"50%",background:errorCount > 0 ? "#ef4444" : "#111827",border:"2px solid rgba(255,255,255,0.2)",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 2px 12px rgba(0,0,0,0.4)",fontSize:"1rem",fontFamily:"'Inter',sans-serif"}}>
        {open ? "✕" : errorCount > 0 ? <span style={{fontSize:"0.65rem",fontWeight:"800"}}>{errorCount > 9 ? "9+" : errorCount}!</span> : "🐛"}
      </button>
      {open && (
        <div style={{position:"fixed",bottom:"calc(7.5rem + env(safe-area-inset-bottom))",right:"0.75rem",left:"0.75rem",maxWidth:"480px",margin:"0 auto",zIndex:9997,background:"#0d1117",borderRadius:"1rem",border:"1px solid rgba(255,255,255,0.1)",boxShadow:"0 8px 40px rgba(0,0,0,0.6)",maxHeight:"60vh",display:"flex",flexDirection:"column",overflow:"hidden",fontFamily:"monospace"}}>
          <div style={{padding:"0.65rem 0.85rem",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <span style={{fontSize:"0.75rem",fontWeight:"700",color:"#fff"}}>🐛 Debug Console</span>
            <div style={{display:"flex",gap:"0.35rem"}}>
              {["all","error","warn","info","ok"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{fontSize:"0.55rem",padding:"0.15rem 0.4rem",borderRadius:"4px",border:"none",cursor:"pointer",background:filter===f ? typeColor[f]||"#fff" : "rgba(255,255,255,0.1)",color:filter===f ? "#000" : "#aaa",fontFamily:"monospace",fontWeight:"600"}}>{f}</button>
              ))}
              <button onClick={() => { debugLogs.entries = []; setLogs([]); }} style={{fontSize:"0.55rem",padding:"0.15rem 0.4rem",borderRadius:"4px",border:"none",cursor:"pointer",background:"rgba(239,68,68,0.3)",color:"#f87171",fontFamily:"monospace"}}>clr</button>
            </div>
          </div>
          <div style={{padding:"0.5rem 0.85rem",borderBottom:"1px solid rgba(255,255,255,0.08)",display:"flex",gap:"0.4rem",alignItems:"center",flexShrink:0,flexWrap:"wrap"}}>
            <button onClick={testAnthropicKey} style={{fontSize:"0.6rem",padding:"0.2rem 0.55rem",borderRadius:"4px",border:"none",cursor:"pointer",background:"rgba(99,102,241,0.3)",color:"#a5b4fc",fontFamily:"monospace"}}>Test AI Key</button>
            <button onClick={testOBF} style={{fontSize:"0.6rem",padding:"0.2rem 0.55rem",borderRadius:"4px",border:"none",cursor:"pointer",background:"rgba(34,197,94,0.2)",color:"#86efac",fontFamily:"monospace"}}>Test OBF</button>
            <button onClick={addManualLog} style={{fontSize:"0.6rem",padding:"0.2rem 0.55rem",borderRadius:"4px",border:"none",cursor:"pointer",background:"rgba(255,255,255,0.1)",color:"#aaa",fontFamily:"monospace"}}>Ping</button>
            <span style={{fontSize:"0.6rem",color:ANTHROPIC_KEY ? "#4ade80" : "#f87171",marginLeft:"auto"}}>
              {ANTHROPIC_KEY ? `✓ Key: …${ANTHROPIC_KEY.slice(-6)}` : "✗ No API key"}
            </span>
          </div>
          {testStatus && (
            <div style={{padding:"0.3rem 0.85rem",background:"rgba(255,255,255,0.05)",fontSize:"0.65rem",color:"#e2e8f0",borderBottom:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
              {testStatus}
            </div>
          )}
          <div style={{overflowY:"auto",flex:1,padding:"0.4rem 0"}}>
            {filtered.length === 0 && (
              <div style={{textAlign:"center",padding:"1.5rem",color:"#4b5563",fontSize:"0.7rem"}}>No logs yet</div>
            )}
            {filtered.map((entry, i) => (
              <div key={i} style={{padding:"0.25rem 0.85rem",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",gap:"0.5rem",alignItems:"flex-start"}}>
                <span style={{fontSize:"0.55rem",color:typeColor[entry.type]||"#9ca3af",flexShrink:0,marginTop:"2px",fontWeight:"700",textTransform:"uppercase",minWidth:"36px"}}>{entry.type}</span>
                <span style={{fontSize:"0.65rem",color:entry.type==="error"?"#fca5a5":entry.type==="warn"?"#fde68a":"#d1d5db",lineHeight:1.45,wordBreak:"break-all"}}>{entry.msg}</span>
                <span style={{fontSize:"0.5rem",color:"#374151",flexShrink:0,marginTop:"2px"}}>{new Date(entry.ts).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
          <div style={{padding:"0.4rem 0.85rem",borderTop:"1px solid rgba(255,255,255,0.08)",flexShrink:0}}>
            <div style={{fontSize:"0.55rem",color:"#4b5563",lineHeight:1.6}}>
              {navigator.userAgent.slice(0, 80)} · {window.innerWidth}×{window.innerHeight}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── AppInner — auth state, tab routing, overlays ───────────────
function AppInner() {
  const { toast } = useToast();

  // Replace native alert() with our toast.
  useEffect(() => {
    const orig = window.alert;
    window.alert = (msg) => {
      const text = String(msg ?? "");
      let kind = "info";
      if (/^✓|^✅|done|success|saved|copied|added|cleaned/i.test(text)) kind = "success";
      else if (/failed|error|couldn't|could not|cannot|denied|invalid/i.test(text)) kind = "error";
      else if (/heads up|warning|⚠|caution/i.test(text)) kind = "warning";
      toast(text, kind);
    };
    return () => { window.alert = orig; };
  }, [toast]);

  // Global autofix runner state
  const [afRunning, setAfRunning]   = useState(false);
  const [afLog, setAfLog]           = useState([]);
  const [afDone, setAfDone]         = useState(false);
  const [afProducts, setAfProducts] = useState([]);
  const afLogRef = useRef([]);

  function afAddLog(type, msg) {
    const entry = { type, msg };
    afLogRef.current = [...afLogRef.current, entry];
    setAfLog([...afLogRef.current]);
  }

  const [user, setUser]               = useState(null);
  const [profile, setProfile]         = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab]                 = useState(() => "check");
  const [tabDir, setTabDir]           = useState("tab-fade");
  const prevTabRef                    = useRef("feed");
  const TAB_ORDER                     = ["check","feed","shop","messages","notifs","profile","admin","glossary"];

  function switchTab(t) {
    const prev    = prevTabRef.current;
    const prevIdx = TAB_ORDER.indexOf(prev);
    const nextIdx = TAB_ORDER.indexOf(t);
    if (prevIdx === -1 || nextIdx === -1 || prevIdx === nextIdx) setTabDir("tab-fade");
    else setTabDir(nextIdx > prevIdx ? "tab-slide-left" : "tab-slide-right");
    prevTabRef.current = t;
    setTab(t);
    try { sessionStorage.setItem("ralli_tab", t); } catch {}
  }

  const [viewingUid, setViewingUid]       = useState(null);
  const [feedRefresh, setFeedRefresh]     = useState(0);
  const [msgUnread, setMsgUnread]         = useState(0);
  const [chatOpen, setChatOpen]           = useState(false);
  const chatCloseRef                      = useRef(null);
  const [showOnboarding, setShowOnboarding]   = useState(false);
  const [showOurStory, setShowOurStory]       = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);
  const [unreadCount, setUnreadCount]         = useState(0);
  const [showNotifPanel, setShowNotifPanel]   = useState(false);
  const [showGlobalGlossary, setShowGlobalGlossary] = useState(false);
  const [msgBanner, setMsgBanner]         = useState(null);
  const msgBannerTimer                    = useRef(null);
  const prevConvosRef                     = useRef({});

  // Listen for incoming messages → show banner when not on messages tab
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, async snap => {
      const prev = prevConvosRef.current;
      const newBanners = [];
      for (const d of snap.docs) {
        const data = d.data();
        const cid  = d.id;
        const lastAt = data.lastAt?.seconds || 0;
        const unread = data[`unread_${user.uid}`] || 0;
        const otherUid = data.participants?.find(p => p !== user.uid);
        if (prev[cid] && prev[cid] < lastAt && unread > 0 && otherUid) {
          newBanners.push({ cid, otherUid, lastMessage: data.lastMessage || "Sent you a message" });
        }
        prev[cid] = lastAt;
      }
      prevConvosRef.current = prev;
      if (newBanners.length > 0 && tab !== "messages") {
        const b = newBanners[0];
        try {
          const usnap = await getDoc(doc(db, "users", b.otherUid));
          const udata = usnap.data() || {};
          setMsgBanner({ senderName: udata.displayName || "Someone", senderPhoto: udata.photoURL || "", text: b.lastMessage, uid: b.otherUid });
          clearTimeout(msgBannerTimer.current);
          msgBannerTimer.current = setTimeout(() => setMsgBanner(null), 4000);
        } catch {}
      }
    }, () => {});
    return () => { unsub(); clearTimeout(msgBannerTimer.current); };
  }, [user?.uid, tab]);

  // Real-time unread notifications count
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "notifications"), where("toUid", "==", user.uid), where("read", "==", false), limit(20));
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size), () => {});
    return unsub;
  }, [user]);

  useEffect(() => {
    return onAuthStateChanged(auth, async u => {
      if (u) {
        const p = await getOrCreateProfile(u);
        setUser(u); setProfile(p);
        if (p.isNew) setShowOnboarding(true);
        else {
          try {
            const seenKey = `ralli_welcome_lastSeen_${u.uid}`;
            const today   = new Date().toISOString().slice(0, 10);
            const lastSeen = localStorage.getItem(seenKey);
            if (lastSeen !== today) { localStorage.setItem(seenKey, today); setShowWelcomeBack(true); }
          } catch {}
        }
        const key   = `goodsistersStoryCount_${u.uid}`;
        const count = parseInt(localStorage.getItem(key) || "0");
        if (count < 5) { localStorage.setItem(key, String(count + 1)); setTimeout(() => setShowOurStory(true), 1200); }
      } else { setUser(null); setProfile(null); }
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (tab === "profile" && user && !profile) {
      getOrCreateProfile(user).then(p => setProfile(p));
    }
  }, [tab, user]);

  function handleUserTap(uid) { setViewingUid(uid); }
  function handleBack()       { setViewingUid(null); }

  useEffect(() => {
    const handler = (e) => { if (e.detail) { setViewingUid(e.detail); switchTab("check"); } };
    window.addEventListener("ralli_view_user", handler);
    return () => window.removeEventListener("ralli_view_user", handler);
  }, []);

  if (authLoading) return (
    <><style>{GS}</style>
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>
    </div></>
  );

  if (!user) return <><style>{GS}</style><AuthPage/></>;

  if (showOnboarding) return (
    <><style>{GS}</style>
    <OnboardingFlow
      user={user} profile={profile}
      onComplete={async (updates) => {
        try {
          const FOUNDER_UIDS = [
            "rNOrHLZzbXOAh58uB1tv6OXoWEq2",
            "jXGCJEHLl8c0CGPBlU9963qFvb83",
          ];
          const foundersToFollow = FOUNDER_UIDS.filter(uid => uid !== user.uid);
          const newFollowing = [...new Set([...(profile?.following || []), ...foundersToFollow])];
          await updateDoc(doc(db, "users", user.uid), { ...updates, following: newFollowing, isNew: false });
          for (const founderUid of foundersToFollow) {
            try { await updateDoc(doc(db, "users", founderUid), { followers: arrayUnion(user.uid) }); } catch(e) {}
          }
          setProfile(p => ({ ...p, ...updates, following: newFollowing, isNew: false }));
        } catch(e) { console.error("[onboarding] complete failed:", e); }
        setShowOnboarding(false);
      }}
    /></>
  );

  const welcomeBackOverlay = showWelcomeBack ? (
    <WelcomeBackScreen user={user} profile={profile} onDismiss={() => setShowWelcomeBack(false)}/>
  ) : null;

  return (
    <><style>{GS}</style>
    <div style={{minHeight:"100vh",background:T.bg}}>
      {/* Top bar */}
      <div style={{background:T.bg+"FA",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderBottom:`1px solid ${T.border}`,padding:"0.9rem 1.5rem",position:"sticky",top:0,zIndex:40}}>
        <div style={{maxWidth:"480px",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"'Poppins',sans-serif",fontWeight:"900",fontSize:"1.1rem",color:T.text,letterSpacing:"-0.04em"}}>
            <span style={{display:"block",fontFamily:"'Poppins',sans-serif",fontWeight:"900",fontSize:"1.2rem",letterSpacing:"-0.04em",lineHeight:1}}>Ralli</span>
            <span style={{display:"block",fontFamily:"'Inter',sans-serif",fontWeight:"300",fontSize:"0.55rem",letterSpacing:"0.18em",textTransform:"uppercase",color:T.textLight,marginTop:"2px"}}>by GoodSisters</span>
          </span>
          <div style={{display:"flex",alignItems:"center",gap:"0.2rem"}}>
            <button onClick={() => setShowGlobalGlossary(true)} title="Ingredient Glossary"
              style={{background:"none",border:"none",cursor:"pointer",padding:"0.4rem",color:T.textMid,display:"flex",alignItems:"center",borderRadius:"50%",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.surfaceAlt;e.currentTarget.style.color=T.text;}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.textMid;}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            </button>
            <button onClick={async () => {
              const shareText = `Join me on Ralli — a skincare community where your friends help you find products that actually work for your skin.\n\nhttps://app.theralliapp.com`;
              try {
                if (navigator.share) await navigator.share({ title: "Join me on Ralli", text: shareText });
                else if (navigator.clipboard) await navigator.clipboard.writeText(shareText);
              } catch(e) {}
            }} title="Invite friends"
              style={{background:"none",border:"none",cursor:"pointer",padding:"0.4rem",color:T.textMid,display:"flex",alignItems:"center",borderRadius:"50%",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.surfaceAlt;e.currentTarget.style.color=T.text;}}
              onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=T.textMid;}}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
            <div style={{position:"relative"}}>
              <button onClick={() => { setShowNotifPanel(p => !p); if (!showNotifPanel) { setUnreadCount(0); markAllRead(user.uid); } }}
                style={{background:showNotifPanel?T.surfaceAlt:"none",border:"none",cursor:"pointer",padding:"0.4rem",position:"relative",color:showNotifPanel?T.text:T.textMid,display:"flex",alignItems:"center",borderRadius:"50%",transition:"all 0.15s"}}
                onMouseEnter={e=>{e.currentTarget.style.background=T.surfaceAlt;e.currentTarget.style.color=T.text;}}
                onMouseLeave={e=>{if(!showNotifPanel){e.currentTarget.style.background="none";e.currentTarget.style.color=T.textMid;}}}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                {unreadCount > 0 && (
                  <div style={{position:"absolute",top:"-1px",right:"-1px",minWidth:"16px",height:"16px",borderRadius:"999px",background:T.rose,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
                    <span style={{fontSize:"0.5rem",fontWeight:"800",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1}}>{unreadCount > 9 ? "9+" : unreadCount}</span>
                  </div>
                )}
              </button>
              {showNotifPanel && (
                <>
                  <div onClick={() => setShowNotifPanel(false)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:44}}/>
                  <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:"min(340px,90vw)",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",boxShadow:"0 8px 32px rgba(17,24,39,0.12)",zIndex:45,overflow:"hidden",animation:"slideDown 0.18s ease"}}>
                    <NotifDropdown user={user} onUserTap={uid => { setShowNotifPanel(false); setViewingUid(uid); switchTab("check"); }}/>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Pages */}
      <div key={viewingUid || tab} className={viewingUid ? "tab-fade" : tabDir} style={{minHeight:"60vh", ...(tab === "messages" && !viewingUid ? {height:"calc(100vh - 3.5rem)",display:"flex",flexDirection:"column",overflow:"hidden"} : {})}}>
        {viewingUid
          ? <UserPage uid={viewingUid} currentUid={user.uid} currentProfile={profile} onUpdateProfile={setProfile} onBack={handleBack} onUserTap={handleUserTap}/>
          : tab === "feed"
            ? <FeedPage user={user} profile={profile} refreshKey={feedRefresh} onUserTap={handleUserTap} onUpdateProfile={(updates) => {
                if (updates?._navigateTo === "profile_people") { switchTab("profile"); setTimeout(() => window.dispatchEvent(new CustomEvent("ralli_profile_tab", { detail: "people" })), 100); return; }
                setProfile(updates);
              }}/>
            : tab === "check"
              ? <ScanPage user={user} profile={profile} onPosted={() => { setFeedRefresh(r => r + 1); switchTab("check"); }} onUpdateProfile={setProfile} onUserTap={handleUserTap}
                  feedComponent={<FeedPage user={user} profile={profile} refreshKey={feedRefresh} onUserTap={handleUserTap} onUpdateProfile={setProfile} embedded={true} />}
                />
              : tab === "messages"
                ? <MessagesPage user={user} profile={profile} onUserTap={handleUserTap} onUnreadChange={setMsgUnread} onChatOpen={setChatOpen} chatCloseRef={chatCloseRef}/>
                : tab === "shop"
                  ? <ShopPage user={user} profile={profile} onUpdateProfile={setProfile}/>
                  : tab === "admin"
                    ? <AdminDashboard user={user} afRunning={afRunning} afLog={afLog} afDone={afDone} afProducts={afProducts} setAfRunning={setAfRunning} setAfLog={setAfLog} setAfDone={setAfDone} setAfProducts={setAfProducts} afAddLog={afAddLog}/>
                    : tab === "glossary"
                      ? <GlossaryPage/>
                      : tab === "notifs"
                        ? <NotificationsPage user={user} onUserTap={uid => { setViewingUid(uid); switchTab("check"); }}/>
                        : profile
                          ? <MyProfilePage user={user} profile={profile} onUpdate={setProfile} onUserTap={handleUserTap} onAdminTap={() => switchTab("admin")}/>
                          : <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"0.75rem"}}>
                              <div style={{width:"28px",height:"28px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
                              <div style={{color:T.textLight,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif"}}>Loading profile…</div>
                            </div>
        }
      </div>

      {/* Message notification banner */}
      {msgBanner && (
        <div onClick={() => { setMsgBanner(null); switchTab("messages"); }}
          style={{position:"fixed",top:"env(safe-area-inset-top, 0px)",left:0,right:0,zIndex:200,display:"flex",justifyContent:"center",padding:"0.5rem 1rem",pointerEvents:"none"}}>
          <div style={{pointerEvents:"all",maxWidth:"420px",width:"100%",background:"rgba(20,20,30,0.92)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",borderRadius:"1rem",padding:"0.7rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem",boxShadow:"0 4px 24px rgba(0,0,0,0.25)",animation:"slideDown 0.3s ease",cursor:"pointer"}}>
            <div style={{width:"36px",height:"36px",borderRadius:"50%",overflow:"hidden",flexShrink:0,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {msgBanner.senderPhoto
                ? <img src={msgBanner.senderPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                : <span style={{fontSize:"0.7rem",fontWeight:"700",color:"#fff"}}>{msgBanner.senderName[0]}</span>
              }
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"0.75rem",fontWeight:"700",color:"#fff",fontFamily:"'Inter',sans-serif"}}>{msgBanner.senderName}</div>
              <div style={{fontSize:"0.72rem",color:"rgba(255,255,255,0.7)",fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{msgBanner.text}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setMsgBanner(null); }} style={{background:"none",border:"none",color:"rgba(255,255,255,0.5)",cursor:"pointer",padding:"2px",flexShrink:0,fontSize:"1rem",lineHeight:1}}>✕</button>
          </div>
        </div>
      )}

      <BottomNav tab={tab} onChange={t => {
        if (chatCloseRef.current) chatCloseRef.current();
        setChatOpen(false);
        switchTab(t);
        setViewingUid(null);
        if (t === "notifs") setUnreadCount(0);
        if (t === "messages") setMsgUnread(0);
      }} unreadCount={unreadCount} msgUnread={msgUnread} currentUid={user?.uid || ""} isAdmin={isAdmin(user)}/>

      {showOurStory && !showOnboarding && (
        <OurStoryPopup onClose={() => setShowOurStory(false)} onUserTap={handleUserTap}/>
      )}
      {showGlobalGlossary && (
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={() => setShowGlobalGlossary(false)} style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(15,25,35,0.35)",backdropFilter:"blur(2px)"}}/>
          <div style={{position:"relative",background:T.bg,borderRadius:"1.5rem 1.5rem 0 0",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.12)"}}>
            <div style={{position:"sticky",top:0,background:T.bg,padding:"0.75rem 1.25rem 0.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,zIndex:1}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1rem",color:T.text,letterSpacing:"-0.02em"}}>Ingredient Glossary</span>
              <button onClick={() => setShowGlobalGlossary(false)} style={{background:"none",border:"none",cursor:"pointer",padding:"0.25rem",color:T.textLight}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{padding:"0 0 2rem"}}>
              <GlossaryPage/>
            </div>
          </div>
        </div>
      )}
      {afRunning && (
        <div style={{position:"fixed",bottom:"5.5rem",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:T.text,color:"#fff",padding:"0.45rem 1rem",borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap",pointerEvents:"none"}}>
          <span style={{display:"inline-block",width:"8px",height:"8px",borderRadius:"50%",background:"#4ade80",animation:"pulse 1s infinite"}}/>
          Auto-fix running… {afLog.filter(l => l.type === "ok").length} fixed
        </div>
      )}
      <DebugPanel user={user} hidden={chatOpen}/>
    </div>
    {welcomeBackOverlay}
    </>
  );
}

// ── Root App ───────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <ProductCacheProvider>
          <AppInner/>
        </ProductCacheProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}

// Set page title
if (typeof document !== "undefined") {
  document.title = "Ralli by GoodSisters — Real people. Real skin. Real insights.";
}
