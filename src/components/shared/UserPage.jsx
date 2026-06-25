import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import { doc, getDoc, getDocs, updateDoc, collection, query, limit } from "firebase/firestore";
import { arrayRemove, arrayUnion } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";
import { followUser, unfollowUser, queryFollowersOf, getUserPosts } from "../../lib/socialUtils.js";
import { Avatar } from "../ui/Avatar.jsx";
import { PostCard } from "./PostCard.jsx";
import { ProductModal } from "./ProductModal.jsx";
import { analyzeIngredients } from "../../lib/ingredientUtils.js";

function displayNameOf(user) {
  const raw = (user?.displayName || "").trim();
  if (!raw) return "Rallier";
  const lower = raw.toLowerCase();
  if (lower === "skincare lover" || lower === "anonymous" || lower === "user" || lower === "undefined" || lower === "null") return "Rallier";
  return raw;
}

function isTestOrSeedAccount(user) {
  const name = (user?.displayName || "").trim();
  if (!name) return true;
  const lower = name.toLowerCase();
  if (lower === "skincare lover" || lower === "anonymous" || lower === "user" || lower === "undefined" || lower === "null" || lower === "new user" || lower === "rallier") return true;
  const TEST_PATTERNS = [/^test/i, /test\d/i, /^demo/i, /^user\d+$/i, /^placeholder/i];
  return TEST_PATTERNS.some(p => p.test(name));
}

export function FollowListItem({ uid, onTap }) {
  const [u, setU] = React.useState(null);
  React.useEffect(() => {
    getDoc(doc(db, "users", uid)).then(d => d.exists() && setU({ uid: d.id, ...d.data() })).catch(() => {});
  }, [uid]);
  if (!u) return <div style={{ height: "52px", borderRadius: "0.75rem", marginBottom: "0.5rem" }} className="skeleton" />;
  const GENERIC = ["skincare lover", "anonymous", "user", "undefined", "null", ""];
  if (GENERIC.includes((u.displayName || "").toLowerCase().trim())) return null;
  return (
    <button onClick={() => onTap(uid)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.5rem", background: "none", border: "none", cursor: "pointer", borderBottom: `1px solid ${T.border}`, textAlign: "left" }}>
      <Avatar photoURL={u.photoURL} name={u.displayName} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName || "Ralli User"}</div>
        <div style={{ fontSize: "0.65rem", color: T.textLight, marginTop: "1px" }}>{(u.followers || []).length} followers</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
    </button>
  );
}

export function UserPage({ uid, currentUid, currentProfile, onUpdateProfile, onBack, onUserTap }) {
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFollowList, setShowFollowList] = useState(null);
  const [activeTab, setActiveTab] = useState("routine");
  const [shopProducts, setShopProducts] = useState([]);
  const [showGradeExplainer, setShowGradeExplainer] = useState(false);
  const isMe = uid === currentUid;
  const isFollowing = (currentProfile?.following || []).includes(uid);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) setProfile(snap.data());
        const p = await getUserPosts(uid);
        setPosts(p);
        const psnap = await getDocs(query(collection(db, "products"), limit(200)));
        setShopProducts(psnap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch {}
      setLoading(false);
    }
    load();
  }, [uid]);

  async function handleFollow() {
    if (isFollowing) {
      await unfollowUser(currentUid, uid);
      onUpdateProfile(p => ({ ...p, following: (p.following || []).filter(id => id !== uid) }));
    } else {
      await followUser(currentUid, uid);
      onUpdateProfile(p => ({ ...p, following: [...(p.following || []), uid] }));
    }
  }

  if (loading) return <div style={{ padding: "3rem", textAlign: "center", color: T.textLight, fontFamily: "'Inter',sans-serif" }}>Loading…</div>;
  if (!profile) return <div style={{ padding: "3rem", textAlign: "center", color: T.textLight }}>User not found</div>;

  const analyzeRoutine = (routine, shopProds) => {
    if (!routine || !routine.length) return null;
    const results = routine.map(name => {
      const nameLow = name.toLowerCase().trim();
      const product = shopProds.find(p => p.productName?.toLowerCase() === nameLow)
        || shopProds.find(p => (p.productName || "").toLowerCase().includes(nameLow));
      if (!product?.ingredients) return { name, score: null, poreScore: null, flagged: [], irritants: [], totalIngredients: 0 };
      const res = analyzeIngredients(product.ingredients);
      const displayPoreScore = Math.round(res.avgScore ?? 0);
      return { name, poreScore: displayPoreScore, flagged: (res.poreCloggers || []).sort((a, b) => b.score - a.score), irritants: (res.irritants || []), totalIngredients: (product.ingredients || "").split(",").filter(t => t.trim()).length, hasData: true };
    });
    const withData = results.filter(r => r.hasData);
    if (!withData.length) return { results, overall: null, grade: null, gradeColor: T.textLight, label: "Add products with ingredients", withData: 0, productCount: 0, toWatchCount: 0, toWatchList: [], totalIngredients: 0, overlaps: [] };
    const avg = withData.reduce((s, r) => s + (r.poreScore || 0), 0) / withData.length;
    const baseScore = Math.max(0, 10 - avg * 2);
    const overall = Math.max(0, Math.min(10, baseScore));
    const grade = overall >= 9.0 ? "A" : overall >= 8.0 ? "B" : overall >= 7.0 ? "C" : overall >= 6.0 ? "D" : "F";
    const gradeColor = overall >= 8.0 ? T.sage : overall >= 7.0 ? T.amber : T.rose;
    return { overall, grade, gradeColor, productCount: withData.length, toWatchCount: 0, toWatchList: [], totalIngredients: 0, overlaps: [] };
  };

  const ListSection = ({ title, items, color, onItemTap }) => {
    if (!items.length) return null;
    return (
      <div style={{ marginBottom: "1.75rem", background: T.surface, borderRadius: "1.25rem", border: `1.5px solid ${color}22`, overflow: "hidden", boxShadow: `0 2px 12px ${color}10` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.85rem 1rem 0.75rem", borderBottom: `1px solid ${T.border}` }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color, flexShrink: 0 }} />
          <span style={{ fontSize: "0.75rem", fontWeight: "700", color: T.navy, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: "'Inter',sans-serif" }}>{title}</span>
          <span style={{ fontSize: "0.65rem", background: color + "20", color, borderRadius: "999px", padding: "0.1rem 0.5rem", fontWeight: "700", fontFamily: "'Inter',sans-serif" }}>{items.length}</span>
        </div>
        <div style={{ padding: "0.75rem 1rem", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {items.map((item, i) => (
            <button key={i} onClick={() => onItemTap && onItemTap(item)}
              style={{ padding: "0.35rem 0.75rem", background: color + "12", border: `1px solid ${color}30`, borderRadius: "999px", fontSize: "0.75rem", color, fontWeight: "500", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
              {item}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <>
      <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "5rem" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: T.textMid, fontSize: "0.85rem", cursor: "pointer", padding: "1.25rem 1rem 0.5rem", fontFamily: "'Inter',sans-serif" }}>← Back</button>
        <div style={{ padding: "0 1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.25rem" }}>
            <Avatar photoURL={profile.photoURL} name={profile.displayName} size={64} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "1.35rem", fontWeight: "700", color: T.navy, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.03em" }}>{profile.displayName}</div>
              {profile.bio && <div style={{ fontSize: "0.78rem", color: T.textMid, marginTop: "2px" }}>{profile.bio}</div>}
              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", color: T.textLight }}><b style={{ color: T.text }}>{posts.length}</b> activities</span>
                <button onClick={() => setShowFollowList("followers")} style={{ fontSize: "0.75rem", color: T.textLight, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}><b style={{ color: T.text }}>{(profile.followers || []).length}</b> followers</button>
                <button onClick={() => setShowFollowList("following")} style={{ fontSize: "0.75rem", color: T.textLight, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif" }}><b style={{ color: T.text }}>{(profile.following || []).length}</b> following</button>
                {(() => {
                  const priv = profile.listPrivacy || {};
                  if (priv.routine) return null;
                  const userRoutine = profile.routine || [];
                  if (!userRoutine.length || !shopProducts.length) return null;
                  const a = analyzeRoutine(userRoutine, shopProducts);
                  if (!a?.grade) return null;
                  return (
                    <button onClick={() => setShowGradeExplainer(true)}
                      style={{ fontSize: "0.75rem", color: T.textLight, background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", gap: "3px" }}>
                      <b style={{ color: a.gradeColor, fontSize: "0.85rem", letterSpacing: "-0.02em" }}>{a.grade}</b> routine
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>

          {!isMe && (
            <button onClick={handleFollow}
              style={{ width: "100%", padding: "0.85rem 1rem", background: isFollowing ? "#FFFFFF" : T.navy, color: isFollowing ? T.text : "#FFFFFF", border: `1.5px solid ${isFollowing ? T.border : T.navy}`, borderRadius: "0.7rem", fontSize: "0.92rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif", marginBottom: "1.25rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", transition: "all 0.15s", letterSpacing: "-0.01em" }}>
              {isFollowing
                ? <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>Following</>
                : <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>Follow</>
              }
            </button>
          )}

          {(() => {
            const priv = profile.listPrivacy || {};
            const routineCount = (!priv.routine && (profile.routine || []).length) || 0;
            const wantCount = (!priv.wantToTry && (profile.wantToTry || []).length) || 0;
            const brokeCount = (!priv.brokeout && (profile.brokeout || []).length) || 0;
            const tabs = [
              { id: "routine", label: "Routine", count: routineCount },
              { id: "lists", label: "Lists", count: wantCount + brokeCount },
              { id: "activity", label: "Activities", count: posts.length },
            ];
            return (
              <div style={{ display: "flex", gap: "0", borderBottom: `1px solid ${T.border}`, marginBottom: "1rem" }}>
                {tabs.map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      style={{ flex: 1, padding: "0.7rem 0.4rem", background: "none", border: "none", cursor: "pointer", fontSize: "0.78rem", fontWeight: isActive ? "700" : "500", color: isActive ? T.navy : T.textLight, borderBottom: `2px solid ${isActive ? T.sage : "transparent"}`, marginBottom: "-1px", fontFamily: "'Inter',sans-serif", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.35rem" }}>
                      {tab.label}
                      {tab.count > 0 && <span style={{ fontSize: "0.62rem", fontWeight: "600", color: isActive ? T.sage : T.textLight, background: isActive ? T.sage + "18" : T.surfaceAlt, padding: "0.08rem 0.45rem", borderRadius: "999px", minWidth: "18px" }}>{tab.count}</span>}
                    </button>
                  );
                })}
              </div>
            );
          })()}

          {activeTab === "activity" && (
            posts.length === 0
              ? <div style={{ textAlign: "center", color: T.textLight, padding: "2.5rem 1rem", fontSize: "0.85rem", fontFamily: "'Inter',sans-serif" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "0.5rem", opacity: 0.4 }}>✨</div>
                <div>{isMe ? "You haven't posted anything yet." : `${displayNameOf(profile)} hasn't posted anything yet.`}</div>
                <div style={{ fontSize: "0.72rem", marginTop: "0.4rem", opacity: 0.7 }}>Posts are created when scanning, searching, or reacting to products.</div>
              </div>
              : <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {posts.map(p => (
                  <PostCard key={p.id} post={p} currentUid={currentUid} onUserTap={() => {}}
                    onProductTap={p2 => setSelectedProduct({ productName: p2.productName, brand: p2.brand, image: p2.productImage || "", poreScore: p2.poreScore ?? 0, communityRating: p2.communityRating, ingredients: p2.ingredients || "", flaggedIngredients: p2.flaggedIngredients || [] })}
                  />
                ))}
              </div>
          )}

          {activeTab === "routine" && (() => {
            const priv = profile.listPrivacy || {};
            if (priv.routine) return <div style={{ textAlign: "center", color: T.textLight, padding: "2.5rem 1rem", fontSize: "0.85rem" }}>This routine is private.</div>;
            const routine = profile.routine || [];
            if (routine.length === 0) return (
              <div style={{ textAlign: "center", color: T.textLight, padding: "2.5rem 1rem", fontSize: "0.85rem", fontFamily: "'Inter',sans-serif" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "0.5rem", opacity: 0.4 }}>🧴</div>
                <div>{isMe ? "You haven't built a routine yet." : `${displayNameOf(profile)} hasn't built a routine yet.`}</div>
              </div>
            );
            return <ListSection title="My Routine" color={T.sage} items={routine}
              onItemTap={name => setSelectedProduct({ productName: name, poreScore: 0, communityRating: null, image: null, ingredients: "", flaggedIngredients: [] })}
            />;
          })()}

          {activeTab === "lists" && (() => {
            const priv = profile.listPrivacy || {};
            const visibleLists = [
              { field: "wantToTry", title: "Want to Try", color: T.amber },
              { field: "brokeout", title: "Not For Me", color: T.rose },
            ].filter(l => !priv[l.field] && (profile[l.field] || []).length > 0);
            if (visibleLists.length === 0) return (
              <div style={{ textAlign: "center", color: T.textLight, padding: "2.5rem 1rem", fontSize: "0.85rem", fontFamily: "'Inter',sans-serif" }}>
                <div style={{ fontSize: "1.6rem", marginBottom: "0.5rem", opacity: 0.4 }}>📋</div>
                <div>{isMe ? "You haven't added to any lists yet." : `${displayNameOf(profile)} hasn't added to any lists yet.`}</div>
              </div>
            );
            return (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {visibleLists.map(l => (
                  <ListSection key={l.field} title={l.title} color={l.color} items={profile[l.field] || []}
                    onItemTap={name => setSelectedProduct({ productName: name, poreScore: 0, communityRating: null, image: null, ingredients: "", flaggedIngredients: [] })}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      </div>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          user={{ uid: currentUid, displayName: currentProfile?.displayName, photoURL: currentProfile?.photoURL }}
          profile={currentProfile}
          onUpdateProfile={onUpdateProfile}
          onUserTap={onUserTap}
        />
      )}

      {showFollowList && ReactDOM.createPortal(
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center" }}>
          <div onClick={() => setShowFollowList(null)} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} />
          <div style={{ position: "relative", width: "100%", maxWidth: "480px", background: T.surface, borderRadius: "1.5rem 1.5rem 0 0", padding: "1.25rem 1.25rem 0", height: "70vh", display: "flex", flexDirection: "column", zIndex: 1 }}>
            <FollowListSheetContent
              mode={showFollowList}
              profileUid={profile.uid || profile.id}
              followingUids={profile.following || []}
              followerUids={profile.followers || []}
              onClose={() => setShowFollowList(null)}
              onUserTap={uid => { setShowFollowList(null); onUserTap?.(uid); }}
              currentUid={currentUid}
              currentProfile={currentProfile}
              onFollowToggle={async (targetUid, currentlyFollowing) => {
                try {
                  if (currentlyFollowing) {
                    await updateDoc(doc(db, "users", currentUid), { following: arrayRemove(targetUid) });
                    await updateDoc(doc(db, "users", targetUid), { followers: arrayRemove(currentUid) }).catch(() => {});
                    onUpdateProfile?.(p => ({ ...p, following: (p.following || []).filter(u => u !== targetUid) }));
                  } else {
                    await updateDoc(doc(db, "users", currentUid), { following: arrayUnion(targetUid) });
                    await updateDoc(doc(db, "users", targetUid), { followers: arrayUnion(currentUid) }).catch(() => {});
                    onUpdateProfile?.(p => ({ ...p, following: [...(p.following || []), targetUid] }));
                  }
                } catch (e) { console.warn("[FollowListSheet] follow toggle failed:", e); }
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export function FollowListSheetContent({ mode, profileUid, followingUids, followerUids, onClose, onUserTap, currentUid, currentProfile, onFollowToggle }) {
  const [users, setUsers] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [busyUids, setBusyUids] = React.useState(new Set());

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      let collected = [];
      if (mode === "following") {
        const snaps = await Promise.all((followingUids || []).map(uid => getDoc(doc(db, "users", uid)).catch(() => null)));
        collected = snaps.filter(s => s && s.exists()).map(s => ({ uid: s.id, ...s.data() })).filter(u => !isTestOrSeedAccount(u));
      } else {
        if (profileUid) {
          const realFollowers = await queryFollowersOf(profileUid);
          collected = realFollowers.filter(u => !isTestOrSeedAccount(u));
        }
        if (!collected.length && (followerUids || []).length) {
          const snaps = await Promise.all(followerUids.map(uid => getDoc(doc(db, "users", uid)).catch(() => null)));
          collected = snaps.filter(s => s && s.exists()).map(s => ({ uid: s.id, ...s.data() })).filter(u => !isTestOrSeedAccount(u));
        }
      }
      if (!cancelled) { setUsers(collected); setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [mode, profileUid, (followingUids || []).join(","), (followerUids || []).join(",")]);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem", flexShrink: 0 }}>
        <div style={{ fontSize: "1rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif" }}>
          {mode === "followers" ? "Followers" : "Following"}
          <span style={{ fontSize: "0.72rem", fontWeight: "400", color: T.textLight, marginLeft: "0.5rem" }}>{loading ? "…" : users.length}</span>
        </div>
        <button onClick={onClose} style={{ background: T.surfaceAlt, border: "none", cursor: "pointer", color: T.textMid, width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>✕</button>
      </div>
      <div style={{ overflowY: "auto", flex: 1, paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}>
        {loading && <>{[1, 2, 3].map(i => <div key={i} style={{ height: "52px", borderRadius: "0.75rem", marginBottom: "0.5rem" }} className="skeleton" />)}</>}
        {!loading && users.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: T.textLight, fontSize: "0.82rem" }}>No {mode} yet</div>}
        {!loading && users.map(u => {
          const isMe = u.uid === currentUid;
          const isFollowed = (currentProfile?.following || []).includes(u.uid);
          const isBusy = busyUids.has(u.uid);
          async function handleFollowTap(e) {
            e.stopPropagation();
            if (isMe || isBusy) return;
            setBusyUids(prev => new Set([...prev, u.uid]));
            try { await onFollowToggle?.(u.uid, isFollowed); }
            finally { setBusyUids(prev => { const next = new Set(prev); next.delete(u.uid); return next; }); }
          }
          return (
            <div key={u.uid} style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.6rem 0.5rem", borderBottom: `1px solid ${T.border}` }}>
              <button onClick={() => onUserTap(u.uid)} style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1, minWidth: 0, background: "none", border: "none", cursor: "pointer", textAlign: "left", padding: 0 }}>
                <Avatar photoURL={u.photoURL} name={displayNameOf(u)} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", color: T.text, fontFamily: "'Inter',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayNameOf(u)}</div>
                  <div style={{ fontSize: "0.65rem", color: T.textLight, marginTop: "1px" }}>{(u.followers || []).length} followers</div>
                </div>
              </button>
              {!isMe && onFollowToggle && (
                <button onClick={handleFollowTap} disabled={isBusy}
                  style={{ padding: "0.4rem 0.85rem", background: isFollowed ? "transparent" : T.navy, color: isFollowed ? T.text : "#fff", border: `1px solid ${isFollowed ? T.border : T.navy}`, borderRadius: "999px", fontSize: "0.72rem", fontWeight: "700", cursor: isBusy ? "default" : "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0, opacity: isBusy ? 0.5 : 1, transition: "all 0.15s", letterSpacing: "-0.01em" }}>
                  {isFollowed ? "Following" : "Follow"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
