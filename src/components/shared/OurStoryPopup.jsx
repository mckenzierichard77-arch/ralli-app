import React, { useState, useEffect } from "react";
import { getDocs, query, collection, where, limit } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { FOUNDERS } from "../../data/constants.js";
import { RalliIcons } from "../../data/icons.jsx";
import { db } from "../../lib/firebase.js";
import { Avatar } from "../ui/Avatar.jsx";

function FounderByline({ onUserTap }) {
  const [founders, setFounders] = useState([]);

  useEffect(() => {
    Promise.all(FOUNDERS.map(async f => {
      try {
        const q = query(collection(db, "users"), where("email", "==", f.email), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { ...f, uid: snap.docs[0].id, photoURL: d.photoURL || "", displayName: d.displayName || f.name, offsetX: d.avatarOffsetX ?? 50, offsetY: d.avatarOffsetY ?? 50, scale: d.avatarScale ?? 1 };
        }
      } catch {}
      return { ...f, uid: null, photoURL: "", displayName: f.name, offsetX: 50, offsetY: 50, scale: 1 };
    })).then(setFounders);
  }, []);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
      <div style={{ display: "flex" }}>
        {founders.length === 0
          ? FOUNDERS.map((f, i) => (
              <div key={i} style={{ width: "26px", height: "26px", borderRadius: "50%", background: T.navy, display: "flex", alignItems: "center", justifyContent: "center", marginLeft: i > 0 ? "-6px" : "0", border: "2px solid " + T.accentSoft }}>
                <span style={{ fontSize: "0.65rem", color: "#fff", fontWeight: "600" }}>{f.initial}</span>
              </div>
            ))
          : founders.map((f, i) => (
              <button key={f.email} onClick={() => f.uid && onUserTap && onUserTap(f.uid)}
                style={{ width: "26px", height: "26px", borderRadius: "50%", marginLeft: i > 0 ? "-6px" : "0", border: "2px solid " + T.accentSoft, padding: 0, cursor: f.uid ? "pointer" : "default", overflow: "hidden", flexShrink: 0, background: T.navy, display: "block" }}
                title={f.displayName}>
                <Avatar photoURL={f.photoURL} name={f.displayName} size={26} />
              </button>
            ))
        }
      </div>
      <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
        {founders.length > 0
          ? founders.map((f, i) => (
              <React.Fragment key={f.email}>
                {i > 0 && <span style={{ fontSize: "0.65rem", color: T.navy, opacity: 0.5 }}>&</span>}
                <button onClick={() => f.uid && onUserTap && onUserTap(f.uid)}
                  style={{ background: "none", border: "none", padding: 0, cursor: f.uid ? "pointer" : "default", fontSize: "0.65rem", color: T.navy, fontFamily: "'Inter',sans-serif", fontWeight: "600", opacity: 0.8, textDecoration: f.uid ? "underline" : "none", textDecorationColor: "rgba(17,24,39,0.25)" }}>
                  {f.displayName.split(" ")[0]}
                </button>
              </React.Fragment>
            ))
          : <span style={{ fontSize: "0.65rem", color: T.navy, fontFamily: "'Inter',sans-serif", fontWeight: "600", opacity: 0.8 }}>McKenzie & Morgan</span>
        }
        <span style={{ fontSize: "0.65rem", color: T.navy, fontFamily: "'Inter',sans-serif", opacity: 0.6 }}>· Co-founders</span>
      </div>
    </div>
  );
}

export function OurStoryPopup({ onClose, onUserTap }) {
  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(28,28,26,0.55)", backdropFilter: "blur(6px)", pointerEvents: "none" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: "420px", background: T.accentSoft, borderRadius: "1.5rem", padding: "1.75rem 1.5rem 1.5rem", boxShadow: "0 20px 60px rgba(28,28,26,0.2)", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: "-1.5rem", bottom: "-1.5rem", opacity: 0.07, pointerEvents: "none" }}>
          {RalliIcons.flask(T.navy, 130)}
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: "0.5rem", color: T.navy, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", fontWeight: "700", marginBottom: "0.5rem", opacity: 0.6 }}>Our Story</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "1.25rem", color: T.navy, lineHeight: 1.2, marginBottom: "0.75rem", letterSpacing: "-0.02em" }}>
            Built out of necessity.
          </div>
          <p style={{ fontSize: "0.78rem", color: T.navy, fontFamily: "'Inter',sans-serif", lineHeight: 1.65, margin: "0 0 0.6rem", opacity: 0.8 }}>
            Ralli was born from the same frustration we know you've felt — spending hours deciphering ingredient labels, second-guessing whether a glowing review was paid for, and never quite trusting that the "dermatologist recommended" label meant anything real.
          </p>
          <p style={{ fontSize: "0.78rem", color: T.navy, fontFamily: "'Inter',sans-serif", lineHeight: 1.65, margin: "0 0 1rem", opacity: 0.8 }}>
            As sisters, we kept sending each other screenshots asking "is this pore-clogging?" We realized our most trusted source was each other — not ads, not influencers. So we built the tool we always wished existed.
          </p>
          <FounderByline onUserTap={onUserTap} />
          <button onClick={onClose}
            style={{ width: "100%", marginTop: "1rem", padding: "0.7rem", background: T.navy, color: "#FFFFFF", border: "none", borderRadius: "0.75rem", fontSize: "0.85rem", fontWeight: "700", cursor: "pointer", fontFamily: "'Inter',sans-serif", letterSpacing: "-0.01em" }}>
            Let's go →
          </button>
        </div>
      </div>
    </div>
  );
}
