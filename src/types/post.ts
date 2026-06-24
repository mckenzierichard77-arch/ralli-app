import type { Timestamp } from "firebase/firestore";

export type PostType =
  | "scan"
  | "loved"
  | "brokeout"
  | "wantToTry"
  | "rated"
  | "search";

export type Comment = {
  uid: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: Timestamp | number;
};

export type Post = {
  id?: string;
  uid: string;
  displayName: string;
  photoURL: string;

  // Product reference
  productId: string;
  productName: string;
  brand: string;

  // Cached product details
  poreScore: number;
  productImage: string;
  communityRating: number | null;
  ingredients: string;
  flaggedIngredients: string[];

  // Post metadata
  postType: PostType;

  // Engagement
  likes: string[];
  comments: Comment[];

  // Optional
  barcode?: string;
  buyUrl?: string;

  createdAt: Timestamp;
};

export type Notification = {
  id?: string;
  toUid: string;
  fromUid: string;
  fromName: string;
  fromPhoto: string;
  type: "like" | "follow" | "scan" | "comment";
  payload?: {
    productName?: string;
    postId?: string;
    [key: string]: unknown;
  };
  read: boolean;
  createdAt: Timestamp;
};
