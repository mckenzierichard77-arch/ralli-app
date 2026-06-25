import React, { useState, useEffect } from "react";
import { getDocs, query, collection, where, orderBy, limit, updateDoc } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";

async function getNotifications(uid) {
  try {
    const q = query(collection(db, "notifications"), where("toUid", "==", uid), orderBy("createdAt", "desc"), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { return []; }
}

async function markAllRead(uid) {
  try {
    const q = query(collection(db, "notifications"), where("toUid", "==", uid), where("read", "==", false));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
  } catch {}
}

function timeAgo(ts) {
  if (!ts) return "";
  const secs = Math.floor((Date.now() - (ts.seconds ? ts.seconds * 1000 : ts)) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function notifIcon(type) {
  if (type === "like") return (
    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: T.rose + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill={T.rose} stroke={T.rose} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
    </div>
  );
  if (type === "follow") return (
    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: T.sage + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
    </div>
  );
  if (type === "scan") return (
    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: T.amber + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
    </div>
  );
  return (
    <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: T.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
    </div>
  );
}

function notifText(n) {
  if (n.type === "like")   return <><strong>{n.fromName}</strong> liked your post on <em>{n.payload?.productName || "a product"}</em></>;
  if (n.type === "follow") return <><strong>{n.fromName}</strong> started following you</>;
  if (n.type === "scan")   return <><strong>{n.fromName}</strong> also checked <em>{n.payload?.productName || "a product"}</em></>;
  return <><strong>{n.fromName}</strong> sent you a notification</>;
}

export function NotifDropdown({ user, onUserTap }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid).then(n => { setNotifs(n); setLoading(false); });
  }, [user]);

  function dropdownNotifIcon(type) {
    if (type === "like") return <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.rose + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill={T.rose} stroke={T.rose} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg></div>;
    if (type === "follow") return <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.sage + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg></div>;
    return <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: T.accent + "18", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg></div>;
  }

  function dropdownNotifText(n) {
    if (n.type === "like")   return <><strong>{n.fromName}</strong> liked your post</>;
    if (n.type === "follow") return <><strong>{n.fromName}</strong> followed you</>;
    if (n.type === "scan")   return <><strong>{n.fromName}</strong> checked {n.payload?.productName || "a product"}</>;
    return <><strong>{n.fromName}</strong> sent a notification</>;
  }

  return (
    <div>
      <div style={{ padding: "0.85rem 1rem 0.6rem", borderBottom: `1px solid ${T.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif" }}>Notifications</span>
        {notifs.length > 0 && <span style={{ fontSize: "0.65rem", color: T.textLight }}>{notifs.length} total</span>}
      </div>
      <div style={{ maxHeight: "320px", overflowY: "auto" }}>
        {loading && (
          <div style={{ padding: "1.5rem", textAlign: "center" }}>
            <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: `2px solid ${T.accent}`, borderTopColor: "transparent", animation: "spin 0.8s linear infinite", margin: "0 auto" }} />
          </div>
        )}
        {!loading && notifs.length === 0 && (
          <div style={{ padding: "2rem 1rem", textAlign: "center", color: T.textLight, fontSize: "0.78rem" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>🔔</div>
            All caught up!
          </div>
        )}
        {!loading && notifs.map(n => (
          <div key={n.id}
            style={{ display: "flex", alignItems: "center", gap: "0.65rem", padding: "0.75rem 1rem", borderBottom: `1px solid ${T.border}`, background: n.read ? "transparent" : T.accent + "06", cursor: n.fromUid ? "pointer" : "default", transition: "background 0.1s" }}
            onClick={() => n.fromUid && onUserTap(n.fromUid)}
            onMouseEnter={e => e.currentTarget.style.background = T.surfaceAlt}
            onMouseLeave={e => e.currentTarget.style.background = n.read ? "transparent" : T.accent + "06"}>
            {dropdownNotifIcon(n.type)}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "0.75rem", color: T.text, lineHeight: 1.4 }}>{dropdownNotifText(n)}</div>
              <div style={{ fontSize: "0.6rem", color: T.textLight, marginTop: "2px" }}>{timeAgo(n.createdAt)}</div>
            </div>
            {!n.read && <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: T.accent, flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function NotificationsPage({ user, onUserTap }) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    getNotifications(user.uid).then(n => { setNotifs(n); setLoading(false); });
    markAllRead(user.uid);
  }, [user]);

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "1rem 1rem 6rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "1.1rem", color: T.text, letterSpacing: "-0.02em", marginBottom: "0.2rem" }}>Notifications</div>
        <div style={{ fontSize: "0.75rem", color: T.textLight }}>Likes, follows, and activity</div>
      </div>

      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {[1, 2, 3].map(i => <div key={i} style={{ height: "60px", background: T.surface, borderRadius: "0.75rem", border: `1px solid ${T.border}`, opacity: 0.6 }} />)}
        </div>
      )}

      {!loading && notifs.length === 0 && (
        <div style={{ textAlign: "center", padding: "3rem 1rem", color: T.textLight }}>
          <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "600", color: T.textMid, marginBottom: "0.4rem" }}>All caught up</div>
          <div style={{ fontSize: "0.8rem" }}>Notifications for likes and follows will appear here</div>
        </div>
      )}

      {!loading && notifs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {notifs.map(n => (
            <div key={n.id}
              style={{ background: n.read ? T.surface : T.accent + "08", border: `1px solid ${n.read ? T.border : T.accent + "33"}`, borderRadius: "1rem", padding: "0.85rem", display: "flex", alignItems: "center", gap: "0.75rem", cursor: n.fromUid ? "pointer" : "default", transition: "all 0.15s" }}
              onClick={() => n.fromUid && onUserTap && onUserTap(n.fromUid)}>
              {notifIcon(n.type)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", color: T.text, lineHeight: 1.4 }}>{notifText(n)}</div>
                <div style={{ fontSize: "0.65rem", color: T.textLight, marginTop: "2px" }}>{timeAgo(n.createdAt)}</div>
              </div>
              {!n.read && <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: T.accent, flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
