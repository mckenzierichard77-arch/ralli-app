import { doc, getDoc, setDoc, updateDoc, getDocs, query, collection, where, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";
import { ADMIN_UIDS, ADMIN_EMAILS, VA_EMAILS } from "../data/constants.js";

export async function getOrCreateProfile(user) {
  try {
    const ref  = doc(db, "users", user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    const profile = {
      uid: user.uid, displayName: user.displayName || user.email?.split("@")[0] || "",
      email: user.email, photoURL: user.photoURL || "",
      skinType: [], bio: "", createdAt: serverTimestamp(),
      following: [], followers: [], productHistory: [],
      isNew: true,
    };
    await setDoc(ref, profile);
    return profile;
  } catch {
    return {
      uid: user.uid, displayName: user.displayName || user.email?.split("@")[0] || "",
      email: user.email, photoURL: "", skinType: [], bio: "",
      following: [], followers: [], productHistory: [],
      isNew: true,
    };
  }
}

export async function markAllRead(uid) {
  try {
    const q = query(collection(db, "notifications"), where("toUid", "==", uid), where("read", "==", false));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
  } catch {}
}

export function isAdmin(user) {
  return ADMIN_UIDS.includes(user?.uid) || ADMIN_EMAILS.includes(user?.email) || VA_EMAILS.includes(user?.email);
}

export function isVA(user) {
  return VA_EMAILS.includes(user?.email);
}

export function enrichedByTag(user) {
  const email = (user?.email || "").toLowerCase();
  if (VA_EMAILS.map(e => e.toLowerCase()).includes(email)) return "va";
  if (email.includes("mckenzie")) return "mckenzie";
  if (email.includes("morgan")) return "morgan";
  return email.split("@")[0] || "admin";
}
