import React, { useState, useEffect } from "react";
import { getDocs, query, collection, where, orderBy, limit } from "firebase/firestore";
import { T } from "../../data/tokens.js";
import { db } from "../../lib/firebase.js";

function numberToWord(n) {
  const words = ["Zero","One","Two","Three","Four","Five","Six","Seven","Eight","Nine","Ten"];
  return n >= 0 && n <= 10 ? words[n] : String(n);
}

export function WelcomeBackScreen({ user, profile, onDismiss }) {
  const [stats, setStats] = useState(null);
  const [visible, setVisible] = useState(true);

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 5)  return "Up late";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Good night";
  }, []);

  const firstName = React.useMemo(() => {
    const dn = profile?.displayName || user?.displayName || user?.email?.split("@")[0] || "";
    return (dn.split(" ")[0] || "you").trim();
  }, [profile, user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const following = Array.isArray(profile?.following) ? profile.following.slice(0, 30) : [];
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

        const userRoutine   = Array.isArray(profile?.routine)   ? profile.routine   : [];
        const userWantToTry = Array.isArray(profile?.wantToTry) ? profile.wantToTry : [];
        const userLoved     = Array.isArray(profile?.loved)     ? profile.loved     : [];

        const friendPosts = [];
        const activeFriendUids = new Set();
        if (following.length > 0) {
          const chunks = [];
          for (let i = 0; i < following.length; i += 10) chunks.push(following.slice(i, i + 10));
          for (const chunk of chunks) {
            try {
              const snap = await getDocs(query(
                collection(db, "posts"),
                where("uid", "in", chunk),
                orderBy("createdAt", "desc"),
                limit(40)
              ));
              snap.forEach(d => {
                const data = d.data();
                const ts = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : data.createdAt;
                if (ts && ts > sevenDaysAgo && data.uid) {
                  activeFriendUids.add(data.uid);
                  friendPosts.push({
                    uid: data.uid,
                    displayName: data.displayName || "",
                    productName: data.productName || "",
                    brand: data.brand || "",
                    postType: data.postType || "scan",
                    createdAt: ts,
                  });
                }
              });
            } catch {}
          }
        }

        let routineRatingsThisWeek = 0;
        for (const fp of friendPosts) {
          if (fp.productName && userRoutine.includes(fp.productName)) routineRatingsThisWeek++;
        }

        let mistakeIngredient = null;
        let mistakeProductName = null;
        try {
          const ownSnap = await getDocs(query(
            collection(db, "posts"),
            where("uid", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(30)
          ));
          const tally = new Map();
          ownSnap.forEach(d => {
            const data = d.data();
            if (!data.productName || !userRoutine.includes(data.productName)) return;
            const flagged = Array.isArray(data.flaggedIngredients) ? data.flaggedIngredients : [];
            for (const ing of flagged) {
              const key = String(ing || "").toLowerCase().trim();
              if (!key) continue;
              const cur = tally.get(key) || { count: 0, sampleProduct: data.productName, displayIng: ing };
              cur.count++;
              tally.set(key, cur);
            }
          });
          let best = null;
          for (const [, v] of tally) {
            if (v.count >= 2 && (!best || v.count > best.count)) best = v;
          }
          if (best) { mistakeIngredient = best.displayIng; mistakeProductName = best.sampleProduct; }
        } catch {}

        if (!cancelled) setStats({
          activeFriendCount: activeFriendUids.size,
          friendPosts,
          routineRatingsThisWeek,
          mistakeIngredient,
          mistakeProductName,
          userRoutineCount: userRoutine.length,
          userWantToTryCount: userWantToTry.length,
          userLovedCount: userLoved.length,
          userWantToTry,
          userRoutine,
        });
      } catch {
        if (!cancelled) setStats({
          activeFriendCount: 0, friendPosts: [], routineRatingsThisWeek: 0,
          mistakeIngredient: null, mistakeProductName: null,
          userRoutineCount: 0, userWantToTryCount: 0, userLovedCount: 0,
          userWantToTry: [], userRoutine: [],
        });
      }
    })();
    return () => { cancelled = true; };
  }, [user?.uid, profile?.following, profile?.routine, profile?.wantToTry, profile?.loved]);

  const handleTap = () => {
    setVisible(false);
    setTimeout(onDismiss, 250);
  };

  const copyLine = React.useMemo(() => {
    if (!stats) return "Welcome back.";
    const {
      activeFriendCount, friendPosts, routineRatingsThisWeek,
      mistakeIngredient, mistakeProductName,
      userRoutineCount, userWantToTryCount,
      userWantToTry, userRoutine,
    } = stats;

    const latestFriendPost = (filter) => {
      for (const fp of friendPosts || []) if (filter(fp)) return fp;
      return null;
    };
    const firstNameOf = (full) => (String(full || "").split(" ")[0] || "").trim();

    const candidates = [];

    if (mistakeIngredient && mistakeProductName) {
      candidates.push({ category: "mistake", text: `Heads up — ${mistakeIngredient} shows up in more than one product in your routine.` });
    }

    const namedFriendPost = latestFriendPost(fp => fp.displayName && fp.productName);
    if (namedFriendPost) {
      const fn = firstNameOf(namedFriendPost.displayName);
      const verb = namedFriendPost.postType === "loved" ? "loves" : namedFriendPost.postType === "brokeout" ? "broke out from" : namedFriendPost.postType === "wantToTry" ? "wants to try" : "added";
      candidates.push({ category: "social", text: `${fn} ${verb} ${namedFriendPost.productName}.` });
    }
    if (routineRatingsThisWeek > 0 && candidates.length < 2) {
      candidates.push({ category: "social", text: routineRatingsThisWeek === 1 ? "A friend posted about a product in your routine this week." : `${numberToWord(routineRatingsThisWeek)} friends posted about products in your routine this week.` });
    }

    const wantTrySet = new Set((userWantToTry || []).map(s => String(s)));
    const wantTryMatch = latestFriendPost(fp => fp.productName && wantTrySet.has(fp.productName) && fp.displayName);
    if (wantTryMatch) {
      const fn = firstNameOf(wantTryMatch.displayName);
      candidates.push({ category: "action", text: `${fn} uses ${wantTryMatch.productName} — it's on your Want to Try.` });
    } else if (userWantToTryCount >= 3) {
      candidates.push({ category: "action", text: `You have ${numberToWord(userWantToTryCount)} products on your Want to Try list — pick one this week?` });
    }

    const userBrands = new Set();
    for (const name of (userRoutine || [])) {
      const firstWord = String(name).split(" ")[0];
      if (firstWord) userBrands.add(firstWord.toLowerCase());
    }
    const newBrandPost = latestFriendPost(fp => fp.brand && !userBrands.has(String(fp.brand).toLowerCase()) && fp.displayName);
    if (newBrandPost) {
      const fn = firstNameOf(newBrandPost.displayName);
      candidates.push({ category: "curiosity", text: `${fn} is using ${newBrandPost.brand} — a brand you haven't tried.` });
    }

    const productCounts = new Map();
    for (const fp of friendPosts || []) {
      if (!fp.productName) continue;
      const set = productCounts.get(fp.productName) || new Set();
      set.add(fp.uid);
      productCounts.set(fp.productName, set);
    }
    let fomoProduct = null, fomoCount = 0;
    for (const [name, uids] of productCounts) {
      if (uids.size >= 2 && uids.size > fomoCount) { fomoProduct = name; fomoCount = uids.size; }
    }
    if (fomoProduct) {
      candidates.push({ category: "fomo", text: `${numberToWord(fomoCount)} friends are using ${fomoProduct} right now.` });
    }

    if (userRoutineCount >= 3) {
      candidates.push({ category: "teach", text: `Your routine has ${numberToWord(userRoutineCount)} products — tap your Routine Score to see how they stack up.` });
    }

    if (activeFriendCount > 0) {
      candidates.push({ category: "seen", text: activeFriendCount === 1 ? "One friend has been active this week." : `${numberToWord(activeFriendCount)} friends have been active this week.` });
    }

    if (candidates.length === 0) {
      const POSITIVE_LINES = [
        "A fresh week for your skin.",
        "New ingredients are waiting.",
        "Today's a good day to learn something new.",
        "Your routine, your rhythm.",
        "Curated for you, by women like you.",
        "Take a moment for your skin today.",
      ];
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      return POSITIVE_LINES[dayOfYear % POSITIVE_LINES.length];
    }

    let lastShown = null;
    try { lastShown = localStorage.getItem("ralli_last_hero_category"); } catch {}
    let chosen = candidates[0];
    if (lastShown && candidates.length > 1 && chosen.category === lastShown) {
      chosen = candidates.find(c => c.category !== lastShown) || candidates[0];
    }
    try { localStorage.setItem("ralli_last_hero_category", chosen.category); } catch {}
    return chosen.text;
  }, [stats]);

  return (
    <>
      <style>{`
        @keyframes wbFadeIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes wbFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes wbPulse   { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        .wb-screen { animation: ${visible ? "wbFadeIn 0.6s ease-out both" : "wbFadeOut 0.4s ease-in both"}; }
        .wb-display-line { animation: wbFadeIn 0.7s ease-out 0.15s both; }
        .wb-italic-line  { animation: wbFadeIn 0.7s ease-out 0.35s both; }
        .wb-stats-line   { animation: wbFadeIn 0.7s ease-out 0.6s both; }
        .wb-tap-cue      { animation: wbFadeIn 0.7s ease-out 0.9s both, wbPulse 2.4s ease-in-out 1.6s infinite; }
      `}</style>
      <div className="wb-screen" onClick={handleTap}
        style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: T.bg, zIndex: 9500, display: "flex", flexDirection: "column", padding: "3.5rem 1.75rem 2rem", cursor: "pointer", fontFamily: "'Inter', sans-serif" }}>
        <div style={{ fontSize: "0.7rem", letterSpacing: "0.22em", fontWeight: 600, color: T.textLight, textTransform: "uppercase", marginTop: "0.5rem" }}>
          Welcome back
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", maxWidth: "30ch" }}>
          <div className="wb-display-line" style={{ fontFamily: "'Inter', sans-serif", fontSize: "2.2rem", fontWeight: 300, color: T.text, lineHeight: 1.1, letterSpacing: "-0.03em" }}>
            {greeting},
          </div>
          <div className="wb-italic-line" style={{ fontFamily: "'Inter', sans-serif", fontSize: "2.2rem", fontWeight: 600, color: T.text, lineHeight: 1.1, letterSpacing: "-0.03em", marginTop: "0.1rem" }}>
            {firstName}.
          </div>
          <div className="wb-stats-line" style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.95rem", fontWeight: 400, color: T.textMid, lineHeight: 1.55, marginTop: "1.5rem", maxWidth: "28ch" }}>
            {copyLine}
          </div>
        </div>
        <div style={{ paddingTop: "1.5rem", borderTop: `1px solid ${T.border}` }}>
          <div className="wb-tap-cue" style={{ fontSize: "0.62rem", letterSpacing: "0.22em", fontWeight: 500, color: T.textLight, textTransform: "uppercase", textAlign: "center", marginBottom: "1.25rem", opacity: 0.7 }}>
            Tap to continue
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontWeight: 900, fontSize: "1.75rem", color: T.text, lineHeight: 1, letterSpacing: "-0.01em" }}>Ralli</div>
              <div style={{ fontSize: "0.65rem", letterSpacing: "0.22em", fontWeight: 600, color: T.textLight, textTransform: "uppercase", marginTop: "0.4rem" }}>by Goodsisters</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
