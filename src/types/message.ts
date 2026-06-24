import type { Timestamp } from "firebase/firestore";

export type MessageType = "text" | "photo" | "product" | "system";

export type Message = {
  id?: string;
  fromUid: string;
  senderName?: string;
  senderPhoto?: string;
  type: MessageType;

  // Text / system
  text?: string;

  // Photo
  photoData?: string;

  // Product share
  productName?: string;
  brand?: string;
  productImage?: string;
  poreScore?: number | null;
  hasScore?: boolean;
  ingredients?: string;
  buyUrl?: string;

  createdAt: Timestamp;
};

export type Conversation = {
  id?: string;
  participants: string[];
  isGroup: boolean;
  name?: string;
  createdAt?: Timestamp;
  lastAt?: Timestamp;
  lastMessage: string;
  hiddenFor: string[];
  // Dynamic per-user unread counts: unread_<uid>
  [key: string]: unknown;
};
