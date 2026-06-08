# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server (hot reload)
npm run build     # Build to dist/
npm run preview   # Preview production build locally
```

No linting or test scripts are configured.

## Architecture

Ralli is a React 18 + Firebase skincare social app. The **entire application lives in a single file: `RalliGoodSisters_v8.jsx`** (~19k lines). This is intentional — do not split it without a specific reason.

### File layout within `RalliGoodSisters_v8.jsx`

- **Lines 1–700**: Firebase init, design token object (`T`), ingredient database (`INGDB` — 200+ entries), global CSS injection
- **Lines 700–1200**: Utility functions (`analyzeIngredients`, image handling, URL/affiliate link generation)
- **Lines 1200+**: All React components and pages

### Component tree

```
App (default export)
  ErrorBoundary
    ToastProvider         ← global toast notifications via context
      ProductCacheProvider  ← caches product images via context
        AppInner          ← auth state, current user, tab routing
```

### Routing

Tab-based, no URL router. `AppInner` tracks `activeTab` in state (values: `check`, `feed`, `shop`, `messages`, `notifs`, `profile`, `admin`, `glossary`). `BottomNav` switches tabs. Sub-views (e.g. a user profile, a product detail modal) are rendered as overlays or state conditionals within each page component.

### State management

- Local `useState` / `useEffect` / `useCallback` / `useMemo` in each component
- React Context for `ToastContext` and `ProductCacheContext`
- Firebase `onSnapshot` listeners for real-time Firestore updates (posts, messages, notifications)
- `sessionStorage` for persisting the active tab across reloads

### Firebase (Firestore collections)

| Collection | Contents |
|---|---|
| `users` | Profiles — displayName, photoURL, bio, followers |
| `products` | Catalog — name, brand, ingredients, adminImage, featured |
| `posts` | Feed posts — author, product ref, caption, likes, comments |
| `conversations` | Chat threads — participants, messages subcollection |
| `notifications` | Activity events — like, comment, follow |
| `actives` | Skincare actives education database |

### Ingredient analysis

`analyzeIngredients(ingredientString)` scores a product 0–5 for pore-clogging risk using the embedded `INGDB` constant. Returns `{ score, flagged[] }`. This is the core domain logic of the app — changes here affect scan results, feed posts, and the glossary.

### Anthropic / Claude Vision integration

- Client sends a product photo → `/api/anthropic.js` (Vercel serverless function) → Anthropic API
- Used exclusively for extracting ingredient text from product photos on the **Scan** tab
- The API key is `VITE_ANTHROPIC_KEY` (dev) or set as a server-side env var for the API route

### Environment variables

All must be in `.env.local` (never committed):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
VITE_ANTHROPIC_KEY        # optional — needed for photo ingredient scanning
```

### Design system

Colors, spacing, and shadows are defined in the `T` object near the top of `RalliGoodSisters_v8.jsx`. All styling is inline CSS-in-JS using `T` tokens — there is no external CSS framework or stylesheet (except a small global CSS block injected via `<style>` tag). Add new styles by extending `T` or adding to the injected style block, not by creating CSS files.
