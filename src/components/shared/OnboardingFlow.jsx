import React, { useState } from "react";
import { getDocs, collection } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";
import { followUser } from "../../lib/socialUtils.js";
import { Avatar } from "../ui/Avatar.jsx";

export function OnboardingFlow({ user, profile, onComplete }) {
  const [step, setStep] = useState(0);
  const [skinTypes, setSkinTypes] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [followed, setFollowed] = useState(new Set());
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);
  const [contactsGranted, setContactsGranted] = useState(false);

  const skinTypeOptions = ["Normal", "Dry", "Oily", "Combination", "Sensitive", "Acne-prone"];
  const concernOptions = ["Acne", "Blackheads", "Redness", "Dark spots", "Anti-aging", "Dullness", "Large pores", "Dryness"];

  function toggle(arr, setArr, val) {
    setArr(prev => prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]);
  }

  async function loadSuggested() {
    if (suggestedUsers.length) return;
    setLoadingSuggested(true);
    try {
      const FOUNDER_UIDS = ["rNOrHLZzbXOAh58uB1tv6OXoWEq2", "jXGCJEHLl8c0CGPBlU9963qFvb83"];
      const FOUNDER_EMAILS = ["mckenzierichard77@gmail.com", "morganrichard777@gmail.com"];
      const snap = await getDocs(collection(db, "users"));
      const all = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid && u.displayName);
      const founders = all.filter(u => FOUNDER_UIDS.includes(u.uid) || FOUNDER_EMAILS.includes(u.email || ""));
      const founderPlaceholders = [];
      const FOUNDER_DEFAULTS = [
        { uid: "rNOrHLZzbXOAh58uB1tv6OXoWEq2", displayName: "Morgan Richard", photoURL: "", skinType: ["Acne-prone", "Sensitive"] },
        { uid: "jXGCJEHLl8c0CGPBlU9963qFvb83", displayName: "McKenzie Richard", photoURL: "", skinType: ["Acne-prone"] },
      ];
      for (const f of FOUNDER_DEFAULTS) {
        if (f.uid !== user.uid && !founders.find(u => u.uid === f.uid)) founderPlaceholders.push({ ...f, _isFounder: true });
      }
      const others = all.filter(u => !FOUNDER_UIDS.includes(u.uid) && !FOUNDER_EMAILS.includes(u.email || ""));

      let contactEmails = new Set();
      let contactPhones = new Set();
      if ("contacts" in navigator && "ContactsManager" in window) {
        try {
          const contacts = await navigator.contacts.select(["email", "tel"], { multiple: true });
          setContactsGranted(true);
          contacts.forEach(c => {
            (c.email || []).forEach(e => contactEmails.add(e.toLowerCase().trim()));
            (c.tel || []).forEach(p => contactPhones.add(p.replace(/\D/g, "")));
          });
        } catch (e) { console.log("[contacts] not available or denied:", e.message); }
      }

      const taggedOthers = others.map(u => {
        const emailMatch = u.email && contactEmails.has(u.email.toLowerCase().trim());
        const phoneMatch = u.phone && contactPhones.has(u.phone.replace(/\D/g, ""));
        return { ...u, _isContact: emailMatch || phoneMatch };
      });
      const contactMatches = taggedOthers.filter(u => u._isContact).sort((a, b) => (b.followers?.length || 0) - (a.followers?.length || 0));
      const DEFAULT_NAMES = new Set(["skincare lover", "user", "ralli user", "new user"]);
      const skinScored = taggedOthers
        .filter(u => !u._isContact && (u.photoURL || (u.followers?.length || 0) > 0) && !DEFAULT_NAMES.has((u.displayName || "").toLowerCase()))
        .map(u => {
          const uSkins = Array.isArray(u.skinType) ? u.skinType : [u.skinType].filter(Boolean);
          const overlap = skinTypes.filter(s => uSkins.includes(s)).length;
          return { ...u, _score: overlap * 10 + (u.followers?.length || 0) };
        })
        .sort((a, b) => b._score - a._score)
        .slice(0, Math.max(0, 3 - contactMatches.length));
      setSuggestedUsers([...founders, ...founderPlaceholders, ...contactMatches, ...skinScored].slice(0, 5));
    } catch (e) { console.error("[follow] error:", e); }
    setLoadingSuggested(false);
  }

  async function handleFindContacts() {
    if (!("contacts" in navigator && "ContactsManager" in window)) return;
    setLoadingSuggested(true);
    try {
      const contacts = await navigator.contacts.select(["email", "tel"], { multiple: true });
      setContactsGranted(true);
      const contactEmails = new Set();
      const contactPhones = new Set();
      contacts.forEach(c => {
        (c.email || []).forEach(e => contactEmails.add(e.toLowerCase().trim()));
        (c.tel || []).forEach(p => contactPhones.add(p.replace(/\D/g, "")));
      });
      const snap = await getDocs(collection(db, "users"));
      const all = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid && u.displayName);
      const FOUNDER_UIDS = ["rNOrHLZzbXOAh58uB1tv6OXoWEq2", "jXGCJEHLl8c0CGPBlU9963qFvb83"];
      const newContacts = all.filter(u => !FOUNDER_UIDS.includes(u.uid)).filter(u => {
        const emailMatch = u.email && contactEmails.has(u.email.toLowerCase().trim());
        const phoneMatch = u.phone && contactPhones.has(u.phone.replace(/\D/g, ""));
        return emailMatch || phoneMatch;
      }).map(u => ({ ...u, _isContact: true }));
      setSuggestedUsers(prev => {
        const founders = prev.filter(u => FOUNDER_UIDS.includes(u.uid) || u._isFounder);
        const existingUids = new Set(prev.map(u => u.uid));
        return [...founders, ...newContacts.filter(u => !existingUids.has(u.uid)), ...prev.filter(u => !FOUNDER_UIDS.includes(u.uid) && !u._isFounder)].slice(0, 8);
      });
    } catch (e) { console.log("[contacts] re-request denied:", e.message); }
    setLoadingSuggested(false);
  }

  async function handleFollow(uid) {
    try {
      await followUser(user.uid, uid);
      setFollowed(prev => new Set([...prev, uid]));
    } catch {}
  }

  async function finish() {
    setSaving(true);
    await onComplete({ skinType: skinTypes, concerns, displayName: displayName.trim() || undefined });
  }

  React.useEffect(() => {
    if (step >= 4) loadSuggested();
  }, [step]);

  React.useEffect(() => { loadSuggested(); }, []);

  const FollowStep = (
    <div style={{ marginTop: "1rem" }}>
      {"contacts" in navigator && "ContactsManager" in window && !contactsGranted && (
        <button onClick={handleFindContacts}
          style={{ width: "100%", padding: "0.6rem 1rem", marginBottom: "0.75rem", background: T.surfaceAlt, border: `1.5px solid ${T.border}`, borderRadius: "0.85rem", fontSize: "0.78rem", fontWeight: "600", color: T.text, cursor: "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
          <span>📇</span> Find people from your contacts
        </button>
      )}
      {loadingSuggested ? (
        <div style={{ textAlign: "center", padding: "2rem", color: T.textLight, fontSize: "0.82rem" }}>Finding people for you…</div>
      ) : suggestedUsers.length === 0 ? (
        <div style={{ textAlign: "center", padding: "1.5rem", color: T.textLight, fontSize: "0.82rem" }}>No suggestions yet — you can follow people from the Feed.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {suggestedUsers.map(u => {
            const uSkins = Array.isArray(u.skinType) ? u.skinType : [u.skinType].filter(Boolean);
            const skinMatch = skinTypes.filter(s => uSkins.includes(s));
            const isFollowed = followed.has(u.uid);
            const isFounder = u._isFounder || ["rNOrHLZzbXOAh58uB1tv6OXoWEq2", "jXGCJEHLl8c0CGPBlU9963qFvb83"].includes(u.uid);
            return (
              <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.7rem 0.85rem", background: T.surface, borderRadius: "0.85rem", border: `1px solid ${isFollowed ? T.sage + "44" : T.border}`, transition: "border-color 0.2s" }}>
                <Avatar photoURL={u.photoURL} name={u.displayName} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                    <div style={{ fontSize: "0.85rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.displayName}</div>
                    {isFounder && <span style={{ fontSize: "0.58rem", fontWeight: "700", color: "#fff", background: "#111827", borderRadius: "999px", padding: "0.1rem 0.45rem", letterSpacing: "0.03em", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>Ralli Founder</span>}
                    {u._isContact && !isFounder && <span style={{ fontSize: "0.58rem", fontWeight: "700", color: T.sage, background: T.sage + "18", borderRadius: "999px", padding: "0.1rem 0.45rem", letterSpacing: "0.03em", fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>In your contacts</span>}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: T.textLight, marginTop: "1px" }}>
                    {isFounder ? <span style={{ color: T.textLight }}>GoodSisters co-founder</span>
                      : skinMatch.length > 0 ? <span style={{ color: T.sage, fontWeight: "600" }}>✓ {skinMatch.join(", ")} skin</span>
                        : <span>{u.followers?.length || 0} followers</span>}
                  </div>
                </div>
                <button onClick={() => handleFollow(u.uid)} disabled={isFollowed}
                  style={{ padding: "0.35rem 0.9rem", background: isFollowed ? T.sage + "18" : "#111827", color: isFollowed ? T.sage : "#fff", border: `1.5px solid ${isFollowed ? T.sage + "44" : "#111827"}`, borderRadius: "999px", fontSize: "0.72rem", fontWeight: "600", cursor: isFollowed ? "default" : "pointer", fontFamily: "'Inter',sans-serif", flexShrink: 0, transition: "all 0.15s" }}>
                  {isFollowed ? "✓ Following" : "Follow"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const steps = [
    {
      title: "Real people. Real skin.\nReal insights.",
      subtitle: "Ralli checks every ingredient in your skincare for pore-clogging risk — so you finally know what's breaking you out.",
      content: (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "1.25rem" }}>
            {[
              { icon: "📸", text: "Scan any product barcode" },
              { icon: "🔬", text: "See every ingredient scored 0–5" },
              { icon: "💬", text: "Learn what real people with your skin think" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.65rem 0.85rem", background: T.surfaceAlt, borderRadius: "0.75rem", border: `1px solid ${T.border}` }}>
                <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontSize: "0.82rem", color: T.text, fontFamily: "'Inter',sans-serif", fontWeight: "500" }}>{item.text}</span>
              </div>
            ))}
          </div>
          <div style={{ padding: "0.75rem 1rem", background: `linear-gradient(135deg,${T.accent}10,${T.blush}20)`, borderRadius: "0.85rem", border: `1px solid ${T.accent}20` }}>
            <div style={{ fontSize: "0.68rem", color: T.textLight, fontFamily: "'Inter',sans-serif", fontStyle: "italic", lineHeight: 1.5, textAlign: "center" }}>
              "We broke out from products we trusted. So we built the app we wish we had."
              <br /><span style={{ fontWeight: "600", color: T.accent, fontStyle: "normal" }}>— McKenzie & Morgan, Founders</span>
            </div>
          </div>
        </div>
      ),
      cta: "Get started →",
    },
    {
      title: "What's your skin type?",
      subtitle: "Select all that apply — we'll personalize your recommendations.",
      content: (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem" }}>
            {skinTypeOptions.map(t => {
              const on = skinTypes.includes(t);
              return <button key={t} onClick={() => toggle(skinTypes, setSkinTypes, t)}
                style={{ padding: "0.6rem 1.1rem", borderRadius: "999px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Inter',sans-serif", background: on ? "#fff" : T.surface, color: on ? T.navy : T.textMid, border: `1.5px solid ${on ? "#fff" : T.border + "66"}`, transition: "all 0.15s", fontWeight: on ? "700" : "400" }}>
                {t}
              </button>;
            })}
          </div>
          {skinTypes.length > 0 && <div style={{ textAlign: "center", fontSize: "0.7rem", color: T.sage, fontWeight: "600" }}>✓ {skinTypes.join(" · ")} selected</div>}
        </div>
      ),
      cta: skinTypes.length > 0 ? "Next →" : "Skip",
    },
    {
      title: "Any skin concerns?",
      subtitle: "We'll flag ingredients that matter most for your skin.",
      content: (
        <div style={{ marginTop: "1.5rem" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "center", marginBottom: "1rem" }}>
            {concernOptions.map(c => {
              const on = concerns.includes(c);
              return <button key={c} onClick={() => toggle(concerns, setConcerns, c)}
                style={{ padding: "0.6rem 1.1rem", borderRadius: "999px", fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Inter',sans-serif", background: on ? "#fff" : T.surface, color: on ? T.navy : T.textMid, border: `1.5px solid ${on ? "#fff" : T.border + "66"}`, transition: "all 0.15s", fontWeight: on ? "700" : "400" }}>
                {c}
              </button>;
            })}
          </div>
          {concerns.length > 0 && <div style={{ textAlign: "center", fontSize: "0.7rem", color: T.sage, fontWeight: "600" }}>✓ {concerns.length} concern{concerns.length !== 1 ? "s" : ""} selected</div>}
        </div>
      ),
      cta: concerns.length > 0 ? "Next →" : "Skip",
    },
    {
      title: displayName.trim() ? `Hi, ${displayName.trim()}!` : "What's your name?",
      subtitle: displayName.trim() ? "We pulled this from your account. Change it if you'd like." : "This is how you'll appear to others on Ralli.",
      content: (
        <div style={{ marginTop: "1.5rem" }}>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Your name"
            style={{ width: "100%", padding: "0.85rem 1rem", borderRadius: "0.85rem", border: `1.5px solid ${T.border}`, fontSize: "1rem", color: T.text, background: T.surface, outline: "none", fontFamily: "'Inter',sans-serif" }}
            onFocus={e => { e.target.style.borderColor = T.sage; }}
            onBlur={e => { e.target.style.borderColor = T.border; }} />
          {displayName.trim().length > 0 && <div style={{ textAlign: "center", fontSize: "0.7rem", color: T.sage, fontWeight: "600", marginTop: "0.75rem" }}>✓ Looking good!</div>}
        </div>
      ),
      cta: displayName.trim().length > 0 ? "Next →" : "Skip →",
    },
    {
      title: "Follow people on Ralli",
      subtitle: "Start with the GoodSisters founders and people who share your skin type.",
      content: FollowStep,
      cta: saving ? "Saving…" : followed.size >= 1 ? "Let's go 🎉" : "Skip for now →",
      isLast: true,
    },
  ];

  const s = steps[step];

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(160deg,${T.navy} 0%,#1e2d4a 40%,${T.bg} 100%)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem 1.5rem" }}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontFamily: "'Poppins',sans-serif", fontWeight: "900", fontSize: "2.8rem", color: "#ffffff", letterSpacing: "-0.04em", lineHeight: 1 }}>Ralli</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "300", fontSize: "0.65rem", color: "rgba(255,255,255,0.5)", letterSpacing: "0.25em", textTransform: "uppercase", marginTop: "0.3rem" }}>by GoodSisters</div>
        </div>

        <div style={{ display: "flex", gap: "0.4rem", justifyContent: "center", marginBottom: "1.5rem" }}>
          {steps.map((_, i) => (
            <div key={i} style={{ width: i === step ? "1.75rem" : "0.4rem", height: "0.4rem", borderRadius: "999px", background: i <= step ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.2)", transition: "all 0.3s" }} />
          ))}
        </div>

        <div style={{ background: "#ffffff", borderRadius: "2rem", padding: "2rem 1.75rem", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }} className="fu">
          <div style={{ fontSize: "1.35rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.02em", marginBottom: "0.5rem", lineHeight: 1.25, whiteSpace: "pre-line", textAlign: "center" }}>{s.title}</div>
          <div style={{ fontSize: "0.82rem", color: T.textMid, lineHeight: 1.6, textAlign: "center" }}>{s.subtitle}</div>
          {s.content}
        </div>

        <button onClick={() => { if (s.isLast) finish(); else setStep(s => s + 1); }}
          disabled={saving}
          style={{ width: "100%", marginTop: "1rem", padding: "1rem", background: "#ffffff", color: T.navy, border: "none", borderRadius: "2rem", fontSize: "1rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif", opacity: saving ? 0.6 : 1, boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
          {s.cta}
        </button>

        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ width: "100%", marginTop: "0.5rem", padding: "0.7rem", background: "transparent", color: "rgba(255,255,255,0.5)", border: "none", fontSize: "0.82rem", cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
