import type { Timestamp } from "firebase/firestore";

export type Product = {
  id?: string;
  productName: string;
  brand: string;
  barcode?: string;
  code?: string;

  // Scoring
  poreScore: number;
  communityRating: number | null;
  scanCount: number;
  ratingCount?: number;
  totalRating?: number;

  // Content
  ingredients: string;
  image: string;
  adminImage: string;
  productImage?: string;

  // Metadata
  category: string;
  buyUrl: string;
  asin?: string;

  // Admin
  approved: boolean;
  autoApproved?: boolean;
  featured?: boolean;
  hidden?: boolean;
  lastEnrichedBy?: string;

  // Timestamps
  createdAt?: Timestamp | number;
  updatedAt?: Timestamp | number;
  approvedAt?: Timestamp | null;
  lastVerified?: Timestamp | number;

  // Tracking
  clickCount?: number;
  lastClickedAt?: number;
  uniqueScanners?: string[];
};

export type Ingredient = {
  name: string;
  score: number;
  note: string;
  aliases: string[];
  irritant?: boolean;
};

export type IngredientMatch = {
  name: string;
  position: number;
  score: number;
  note: string;
  irritant?: boolean;
};

export type ScanResult = {
  found: IngredientMatch[];
  flagged: IngredientMatch[];
  poreCloggers: IngredientMatch[];
  irritants: IngredientMatch[];
  avgScore: number | null;
};

export type Rating = {
  id?: string;
  uid: string;
  displayName: string;
  photoURL: string;
  productName: string;
  productId: string;
  brand: string;
  poreScore: number;
  communityRating: number;
  productImage: string;
  ingredients: string;
  raterSkinTypes: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type IngredientReport = {
  id?: string;
  productName: string;
  brand: string;
  productId: string;
  currentIngredients: string;
  reportText: string;
  reportedBy: string;
  reporterName: string;
  createdAt: Timestamp;
  status: "pending";
};
