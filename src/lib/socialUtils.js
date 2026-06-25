import {
  doc, getDoc, setDoc, addDoc, updateDoc, getDocs,
  collection, query, where, orderBy, limit,
  increment, arrayUnion, arrayRemove, serverTimestamp,
} from "firebase/firestore";
import { db } from "./firebase.js";

function guessCategory(name) {
  const n = name.toLowerCase();
  if (/cleanser|wash|clean/.test(n)) return "face-wash";
  if (/moistur|cream|lotion|gel/.test(n)) return "moisturizer";
  if (/serum|essence/.test(n)) return "serum";
  if (/exfoliant|peel|aha|bha|glycolic|salicylic/.test(n)) return "exfoliant";
  if (/spf|sunscreen|sunscree|sun\s*block/.test(n)) return "spf";
  if (/eye/.test(n)) return "eye";
  if (/body|ointment|healing/.test(n)) return "body";
  if (/acne|spot|blemish/.test(n)) return "acne";
  if (/hair|scalp|shampoo|conditioner/.test(n)) return "hair";
  if (/foundation|concealer|blush|lip|makeup/.test(n)) return "makeup";
  return "other";
}

export async function upsertProduct(barcode, data) {
  const id = barcode || `manual_${Date.now()}`;
  const ref = doc(db, "products", id);
  const snap = await getDoc(ref);
  const rawImg = (data.image || "").trim();
  const isObfImg = rawImg && rawImg.includes("openbeautyfacts");
  const cleanImg = isObfImg ? "" : rawImg;
  const obfImg = isObfImg ? rawImg : (data.obfImage || "");
  if (snap.exists()) {
    const existing = snap.data();
    const updates = {};
    if (data.productName && !existing.productName) updates.productName = data.productName;
    if (data.brand && !existing.brand) updates.brand = data.brand;
    if (data.ingredients && (!existing.ingredients || existing.ingredients.trim().length < 10)) updates.ingredients = data.ingredients;
    if (cleanImg && !existing.image && !existing.adminImage) updates.image = cleanImg;
    if (obfImg && !existing.obfImage) updates.obfImage = obfImg;
    if (Object.keys(updates).length) { updates.updatedAt = Date.now(); await updateDoc(ref, updates); }
    return { id, ...existing, ...updates };
  } else {
    const newProduct = {
      barcode: id,
      productName: data.productName || "",
      brand: data.brand || "",
      category: guessCategory(data.productName || ""),
      poreScore: data.poreScore ?? 0,
      ingredients: data.ingredients || "",
      image: cleanImg,
      obfImage: obfImg,
      buyUrl: data.buyUrl || "",
      approved: false,
      hidden: false,
      pendingReview: true,
      scanCount: 0,
      uniqueScanners: [],
      communityRating: null,
      source: data.source || "scan",
      createdAt: serverTimestamp(),
      updatedAt: Date.now(),
    };
    await setDoc(ref, newProduct);
    return { id, ...newProduct };
  }
}

export async function recordScan(uid, displayName, photoURL, productId, productName, brand, poreScore, ingredients, found, communityRating, postType = "scan") {
  try {
    let productImage = "";
    try {
      const prodSnap = await getDoc(doc(db, "products", productId));
      if (prodSnap.exists()) productImage = prodSnap.data().adminImage || prodSnap.data().image || "";
    } catch (e) {}

    const postRef = await addDoc(collection(db, "posts"), {
      uid, displayName, photoURL: photoURL || "",
      productId,
      productName, brand: brand || "",
      poreScore,
      productImage,
      communityRating: communityRating || null,
      ingredients: ingredients.slice(0, 500),
      flaggedIngredients: found.filter(i => i.score >= 1 || i.irritant).sort((a, b) => b.score - a.score).slice(0, 6).map(i => i.name),
      postType: postType || "scan",
      createdAt: serverTimestamp(),
      likes: [],
      comments: [],
    });

    await addDoc(collection(db, "scans"), {
      uid, productId, productName, brand: brand || "",
      poreScore, createdAt: serverTimestamp(),
    });

    try {
      await updateDoc(doc(db, "products", productId), {
        scanCount: increment(1),
        uniqueScanners: arrayUnion(uid),
      });
    } catch (e) {}

    return postRef.id;
  } catch (e) { console.error("recordScan error:", e); }
}

export async function postScan(uid, displayName, photoURL, productName, brand, poreScore, communityRating, ingredients, found, postType = "search") {
  const stableId = "manual_" + (brand || "").toLowerCase().replace(/\s+/g, "_") + "_" + productName.toLowerCase().replace(/\s+/g, "_");
  await upsertProduct(stableId, { productName, brand, poreScore, ingredients, source: "scan" });
  return recordScan(uid, displayName, photoURL, stableId, productName, brand, poreScore, ingredients, found, communityRating, postType);
}

export async function followUser(myUid, theirUid) {
  try {
    await updateDoc(doc(db, "users", myUid), { following: arrayUnion(theirUid) });
  } catch (e) {
    console.error("followUser: failed to update my following list:", e);
    throw e;
  }
  try {
    await updateDoc(doc(db, "users", theirUid), { followers: arrayUnion(myUid) });
  } catch (e) {
    console.warn("followUser: couldn't update target user's followers list:", e?.message || e);
  }
}

export async function unfollowUser(myUid, theirUid) {
  try {
    await updateDoc(doc(db, "users", myUid), { following: arrayRemove(theirUid) });
  } catch (e) {
    console.error("unfollowUser: failed to update my following list:", e);
    throw e;
  }
  try {
    await updateDoc(doc(db, "users", theirUid), { followers: arrayRemove(myUid) });
  } catch (e) {
    console.warn("unfollowUser: couldn't update target user's followers list:", e?.message || e);
  }
}

export async function queryFollowersOf(targetUid) {
  try {
    const snap = await getDocs(query(
      collection(db, "users"),
      where("following", "array-contains", targetUid),
      limit(500)
    ));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (e) {
    console.warn("queryFollowersOf failed:", e);
    return [];
  }
}

export async function getUserPosts(uid) {
  try {
    const q = query(collection(db, "posts"), where("uid", "==", uid), orderBy("createdAt", "desc"), limit(100));
    const snap = await getDocs(q);
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`[getUserPosts] uid=${uid} found ${posts.length} posts (indexed query)`);
    if (posts.length === 0) {
      try {
        const fallback = await getDocs(query(collection(db, "posts"), where("uid", "==", uid), limit(100)));
        const fallbackPosts = fallback.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log(`[getUserPosts] fallback (no orderBy) found ${fallbackPosts.length} posts`);
        return fallbackPosts.sort((a, b) => {
          const at = a.createdAt?.seconds ?? 0;
          const bt = b.createdAt?.seconds ?? 0;
          return bt - at;
        });
      } catch (fe) {
        console.warn("[getUserPosts] fallback also failed:", fe?.message || fe);
      }
    }
    return posts;
  } catch (e) {
    console.error("[getUserPosts] indexed query failed:", e?.message || e);
    return [];
  }
}
