import { doc, getDoc, setDoc, addDoc, collection, increment, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase.js";

export function convId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

export function newGroupId() {
  return "group_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export async function sendToConversation(cid, fromUid, msg) {
  if (!cid || !fromUid) throw new Error("Missing cid or fromUid");
  const convRef = doc(db, "conversations", cid);
  const msgCol = collection(db, "conversations", cid, "messages");
  const ts = serverTimestamp();
  const cleanMsg = Object.fromEntries(Object.entries({ ...msg, fromUid, createdAt: ts }).filter(([,v]) => v !== undefined));

  let participants = [];
  let isGroup = false;
  try {
    const snap = await getDoc(convRef);
    if (snap.exists()) {
      const data = snap.data();
      participants = data.participants || [];
      isGroup = !!data.isGroup;
    }
  } catch {}
  if (!participants.length && cid.includes("_") && !cid.startsWith("group_")) {
    participants = cid.split("_");
  }

  const meta = {
    participants,
    isGroup,
    lastMessage: msg.type === "text" ? msg.text : msg.type === "product" ? `📦 ${msg.productName}` : "📷 Photo",
    lastAt: ts,
    hiddenFor: [],
    [`unread_${fromUid}`]: 0,
  };
  participants.filter(uid => uid !== fromUid).forEach(uid => {
    meta[`unread_${uid}`] = increment(1);
  });
  await setDoc(convRef, meta, { merge: true });
  await addDoc(msgCol, cleanMsg);

  const notifText = msg.type === "text" ? msg.text : msg.type === "product" ? `Shared a product: ${msg.productName}` : "Sent you a photo";
  participants.filter(uid => uid !== fromUid).forEach(uid => {
    addDoc(collection(db, "notifications"), {
      toUid: uid, fromUid, type: "message", conversationId: cid, isGroup,
      text: notifText, read: false, createdAt: ts,
    }).catch(() => {});
  });
}

export async function sendMessage(fromUid, toUid, msg) {
  if (!fromUid || !toUid) throw new Error("Missing uid: fromUid=" + fromUid + " toUid=" + toUid);
  const cid = convId(fromUid, toUid);
  return sendToConversation(cid, fromUid, msg);
}
