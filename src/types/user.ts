import type { Timestamp } from "firebase/firestore";

export type ListPrivacy = "public" | "private";

export type UserProfile = {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;

  // Profile content
  bio: string;
  skinType: string[];
  concerns?: string[];

  // Social
  following: string[];
  followers: string[];

  // Product lists
  routine: string[];
  brokeout: string[];
  wantToTry: string[];
  loved: string[];

  // Privacy settings per list
  listPrivacy: Record<string, ListPrivacy>;

  // Metadata
  createdAt?: Timestamp;
  isNew?: boolean;

  // Avatar crop/position
  avatarOffsetX?: number;
  avatarOffsetY?: number;
  avatarScale?: number;
};
