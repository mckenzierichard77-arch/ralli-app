// v2.4 - compact feed cards, barcode scan icon, navy rank badges
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, sendPasswordResetEmail
} from "firebase/auth";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, arrayUnion, arrayRemove, increment,
  collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp,
  onSnapshot, getCountFromServer
} from "firebase/firestore";

const firebaseApp = initializeApp({
  apiKey:            import.meta.env?.VITE_FIREBASE_API_KEY            || "AIzaSyCPPl-cpHpA714AgE_mJI3MDj6nSVlSJRg",
  authDomain:        import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN        || "feb242026morg.firebaseapp.com",
  projectId:         import.meta.env?.VITE_FIREBASE_PROJECT_ID         || "feb242026morg",
  storageBucket:     import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET     || "feb242026morg.firebasestorage.app",
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID|| "75912486030",
  appId:             import.meta.env?.VITE_FIREBASE_APP_ID             || "1:75912486030:web:ff8eebbc6f93fcf4307ddf",
});
const auth     = getAuth(firebaseApp);
const db       = getFirestore(firebaseApp);
const gProvider = new GoogleAuthProvider();

// ── Product images now live in Firestore (adminImage field on each product doc) ──

// ── Anthropic API key — used for photo ingredient scanning only ──
// Set this in your environment / deployment config, never commit it
const ANTHROPIC_KEY = import.meta.env?.VITE_ANTHROPIC_KEY || "";

// ── Design tokens ─────────────────────────────────────────────
const T = {
  bg:        "#F8F9FB",   // Cloud White #F8F9FB
  surface:   "#FFFFFF",
  surfaceAlt:"#F0F3F7",
  border:    "#E6E8EC",   // Soft Gray #E6E8EC
  text:      "#111827",   // Deep Navy #111827
  textMid:   "#4A5568",
  textLight: "#9AACBC",
  accent:    "#111827",
  accentSoft:"#E4EBF5",
  navy:      "#111827",   // Deep Navy  — PRIMARY brand color
  navyDark:  "#0C1220",   // darker navy for hover states
  slate:     "#9AACBC",   // Brand Slate #9AACBC
  slateGray: "#5A6A7A",
  iceBlue:   "#CFE8FF",   // Ice Blue   — accent/highlight
  softGray:  "#E6E8EC",   // Soft Gray  — dividers
  sage:      "#2C7A5C",
  amber:     "#8B6914",
  rose:      "#AA4F57",
  blush:     "#E8F2FF",   // light iceBlue tint for backgrounds
};

const GS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Poppins:wght@900&display=swap');
  *{box-sizing:border-box;} body{margin:0;background:#F8F9FB;font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;letter-spacing:0;overscroll-behavior-y:none;} html{height:-webkit-fill-available;}
  ::placeholder{color:${T.textLight};}
  .share-toast{position:fixed;bottom:calc(5rem + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:${T.text};color:#fff;padding:0.5rem 1.1rem;border-radius:999px;font-size:0.78rem;font-family:'Inter',sans-serif;font-weight:500;z-index:9999;opacity:0;animation:toastIn 2.2s ease forwards;pointer-events:none;white-space:nowrap;}
  @keyframes toastIn{0%{opacity:0;transform:translateX(-50%) translateY(8px)}12%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-4px)}}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes slideDown{from{opacity:0;transform:translateY(-16px)}to{opacity:1;transform:translateY(0)}}
  @keyframes scanPulse{0%,100%{opacity:0.3;transform:scale(1)}50%{opacity:0.7;transform:scale(1.04)}}
  @keyframes scanline{0%,100%{top:10%}50%{top:85%}}
  @keyframes typingDot {
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
}
@keyframes spin{to{transform:rotate(360deg)}}
  @keyframes scoreTick{0%{transform:scale(1)}50%{transform:scale(1.18)}100%{transform:scale(1)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes tabSlideLeft{0%{opacity:0}100%{opacity:1}}
  @keyframes tabSlideRight{0%{opacity:0}100%{opacity:1}}
  @keyframes tabFade{0%{opacity:0}100%{opacity:1}}
  .tab-slide-left{animation:tabSlideLeft 0.2s ease forwards;}
  .tab-slide-right{animation:tabSlideRight 0.2s ease forwards;}
  .tab-fade{animation:tabFade 0.18s ease forwards;}
  @keyframes heartBurst{0%{transform:scale(1)}30%{transform:scale(1.45)}60%{transform:scale(0.9)}100%{transform:scale(1)}}
  @keyframes heartBounce{0%{transform:scale(1)}20%{transform:scale(1.4)}50%{transform:scale(0.88)}70%{transform:scale(1.12)}100%{transform:scale(1)}}
  @keyframes ptrSpin{to{transform:rotate(360deg)}}
  @keyframes ptrArrow{0%{transform:translateY(0)}100%{transform:translateY(6px)}}
  @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
  @keyframes commentIn{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
  .skeleton{background:linear-gradient(90deg,#F4F4F2 25%,#E8E8E4 50%,#F4F4F2 75%);background-size:800px 100%;animation:shimmer 1.4s infinite linear;border-radius:0.4rem;}
  ::-webkit-scrollbar{width:3px;height:3px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#CFE8FF;border-radius:999px;}
  ::selection{background:#CFE8FF;color:#111827;}
  .fu{animation:fadeUp 0.3s ease forwards;}
  .card-hidden{opacity:0;transform:translateY(16px);}
  .card-visible{opacity:1;transform:translateY(0);transition:opacity 0.35s ease,transform 0.35s cubic-bezier(0.34,1.2,0.64,1);}
  .pressable{cursor:pointer;transition:transform 0.08s ease;-webkit-tap-highlight-color:transparent;}
  .pressable:active{transform:scale(0.96);}
  .tap-scale:active{transform:scale(0.97);transition:transform 0.08s ease;}
  .save-toast{position:fixed;bottom:calc(5.5rem + env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);background:${T.sage};color:#fff;padding:0.45rem 1rem;border-radius:999px;font-size:0.76rem;font-family:'Inter',sans-serif;font-weight:600;z-index:9999;pointer-events:none;white-space:nowrap;animation:toastIn 2s ease forwards;}
  input,button,textarea{font-family:'Inter',sans-serif;}
  /* Brand hero header used on every page */
  .ralli-page-hero{background:#111827;padding:1.1rem 1rem 1rem;margin-bottom:0;}
  .ralli-wordmark{font-family:'Poppins',sans-serif;font-weight:900;font-size:2.2rem;color:#FFFFFF;letter-spacing:-0.04em;line-height:1;}
  .ralli-slogan{font-size:0.58rem;color:#CFE8FF;letter-spacing:0.22em;text-transform:uppercase;font-family:'Inter',sans-serif;font-weight:400;margin-top:0.2rem;}
  .ralli-page-title{font-family:'Inter',sans-serif;font-weight:300;font-size:1.05rem;color:rgba(255,255,255,0.7);letter-spacing:0.04em;line-height:1;}
  /* Section headings inside content */
  .ralli-section-head{font-family:'Inter',sans-serif;font-weight:700;font-size:1.2rem;color:#111827;letter-spacing:-0.02em;}
  /* Eyebrow labels above sections */
  .ralli-eyebrow{font-size:0.58rem;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:#5A6A7A;font-family:'Inter',sans-serif;}
  /* Navy pill button */
  .ralli-btn-navy{background:#111827;color:#FFFFFF;border:none;border-radius:0.5rem;padding:0.75rem 1.25rem;font-family:'Inter',sans-serif;font-size:0.85rem;font-weight:500;cursor:pointer;letter-spacing:0.02em;transition:background 0.15s;}
  .ralli-btn-navy:hover{background:#0C1220;}
  /* Ghost button */
  .ralli-btn-ghost{background:transparent;color:#111827;border:1px solid #E6E8EC;border-radius:0.5rem;padding:0.65rem 1.1rem;font-family:'Inter',sans-serif;font-size:0.82rem;font-weight:500;cursor:pointer;transition:border-color 0.15s;}
  .ralli-btn-ghost:hover{border-color:#111827;}
`;

// ── Curated recs — loaded from Firestore (featured:true products) ──────────
// Data lives in Firestore. Run Admin → Products → "Migrate to Firestore" if needed.
const CURATED_RECS_FALLBACK = [];

// ── Fetch featured/curated products from Firestore ────────────
// Falls back to CURATED_RECS_FALLBACK if collection is empty.
async function fetchCuratedRecs() {
  try {
    const snap = await getDocs(query(
      collection(db, "products"),
      where("featured", "==", true),
      orderBy("communityRating", "desc"),
      limit(12)
    ));
    if (!snap.empty) {
      return snap.docs.map(d => ({id: d.id, ...d.data()}));
    }
  } catch {}
  return CURATED_RECS_FALLBACK;
}

// ── PRODUCT_IMG_MAP removed — images now live on product documents in Firestore ──
// The adminImage field on each product document is the source of truth.
// Run Admin → Products → "Migrate to Firestore" to seed initial data.
// Use Admin → Products → Auto-fix to fill in any missing images automatically.

// ── Ingredient DB ─────────────────────────────────────────────
const INGDB = {
  // Schema: score = pore-clogging 0-5, irritant = true if known skin irritant
  // irritant covers: fragrance allergens, drying alcohols, harsh surfactants, essential oils, sensitizers

  // ── Highly pore-clogging (4-5) ──────────────────────────────
  "coconut oil":                 {score:4, note:"Heavy oil that clogs pores easily",                aliases:["cocos nucifera oil","cocos nucifera (coconut) oil","cocos nucifera","cocos nucifera (coconut)","coconut"]},
  "wheat germ oil":              {score:5, note:"Very likely to cause breakouts",                   aliases:["triticum vulgare germ oil"]},
  "palm oil":                    {score:4, note:"Clogs pores and triggers breakouts",               aliases:["elaeis guineensis oil","palm kernel oil"]},
  "isopropyl myristate":         {score:5, note:"One of the most pore-clogging ingredients known",  aliases:["IPM"]},
  "isopropyl palmitate":         {score:4, note:"Softening compound that often clogs pores",        aliases:["isopropyl palmitate"]},
  "myristyl myristate":          {score:5, note:"Very likely to cause breakouts",                   aliases:[]},
  "myristyl propionate":         {score:4, note:"High pore-clogging ester",                         aliases:[]},
  "octyl palmitate":             {score:4, note:"Skin-softening compound that often clogs pores",   aliases:["ethylhexyl palmitate","2-ethylhexyl palmitate"]},
  "flaxseed oil":                {score:3, note:"Omega-3 oil that tends to clog pores",             aliases:["linum usitatissimum seed oil","linseed oil"]},
  "algae extract":               {score:3, note:"Can clog pores significantly",                     aliases:["seaweed extract","algae"]},
  "carrageenan":                 {score:4, note:"Thickener that blocks pores",                      aliases:["irish moss extract"]},
  "irish moss":                  {score:4, note:"Pore-clogging seaweed derivative",                 aliases:["chondrus crispus extract","chondrus crispus"]},
  "lauric acid":                 {score:4, note:"Fatty acid found in coconut oil — clogs pores",    aliases:[]},
  "acetylated lanolin":          {score:4, note:"High pore-clogging lanolin derivative",            aliases:["acetylated lanolin alcohol"]},
  "wheat germ glycerides":       {score:4, note:"Very likely to clog pores",                        aliases:[]},
  "grape seed oil":              {score:2, note:"Can clog pores despite being light",               aliases:["vitis vinifera seed oil"]},
  "decyl oleate":                {score:3, note:"Moderate pore-clogging emollient",                 aliases:[]},
  "myristoyl sarcosine":         {score:4, note:"Pore-clogging conditioning agent",                 aliases:[]},
  "peg-16 macadamia glycerides": {score:3, note:"Moderate pore-clogging emollient",                aliases:[]},

  // ── Moderate pore-clogging (3) ──────────────────────────────
  "butyl stearate":              {score:3, note:"May clog pores in some people",                    aliases:[]},
  "myristic acid":               {score:3, note:"May clog pores in some people",                    aliases:[]},
  "corn oil":                    {score:3, note:"May clog pores in some people",                    aliases:["zea mays oil","zea mays (corn) oil"]},
  "cottonseed oil":              {score:3, note:"May clog pores in some people",                    aliases:["gossypium herbaceum seed oil"]},
  "marula oil":                  {score:2, note:"May clog pores in some people",                    aliases:["sclerocarya birrea seed oil"]},
  "sea kelp":                    {score:2, note:"May clog pores",                                   aliases:["laminaria digitata extract","kelp extract"]},
  "sea kelp extract":            {score:2, note:"May clog pores",                                   aliases:["laminaria extract"]},
  "oleic acid":                  {score:3, note:"High-oleic oils tend to clog pores",               aliases:[]},
  "isononyl isononanoate":       {score:2, note:"Moderate pore-clogging ester",                     aliases:[]},
  "steareth-2":                  {score:2, note:"Moderate pore-clogging emulsifier",                aliases:[]},
  "peg-8 stearate":              {score:3, note:"Moderate pore-clogging PEG ester",                 aliases:[]},
  "glyceryl stearate se":        {score:2, note:"May clog pores for some",                         aliases:[]},
  "soybean oil":                 {score:3, note:"May clog pores in acne-prone skin",               aliases:["glycine soja oil","soya oil"]},
  "hazelnut oil":                {score:2, note:"Moderate risk of clogging pores",                  aliases:["corylus avellana seed oil"]},
  "sesame oil":                  {score:2, note:"Moderate chance of clogging pores",               aliases:["sesamum indicum seed oil","sesamum indicum (sesame) seed oil"]},
  "apricot kernel oil":          {score:2, note:"Moderate chance of clogging pores",               aliases:["prunus armeniaca kernel oil"]},
  "borage oil":                  {score:2, note:"Moderate chance of clogging pores",               aliases:["borago officinalis seed oil"]},

  // ── Low-moderate pore-clogging (2) — now flagged as moderate risk ─
  "peach kernel oil":            {score:2, note:"Moderate risk — may clog pores for some",          aliases:["prunus persica kernel oil"]},
  "avocado oil":                 {score:2, note:"Moderate risk — may clog pores for some",          aliases:["persea gratissima oil","persea americana fruit oil"]},
  "olive oil":                   {score:2, note:"Moderate risk — high oleic acid content",          aliases:["olea europaea fruit oil","olea europaea (olive) fruit oil"]},
  "evening primrose oil":        {score:2, note:"Moderate risk — may clog pores for some",          aliases:["oenothera biennis oil"]},
  "sweet almond oil":            {score:2, note:"Moderate risk — may clog pores for some",          aliases:["prunus amygdalus dulcis oil"]},
  "black seed oil":              {score:2, note:"Moderate risk for acne-prone skin",               aliases:["nigella sativa seed oil"]},
  "pumpkin seed oil":            {score:2, note:"Moderate risk — may clog pores for some",          aliases:["cucurbita pepo seed oil"]},
  "tamanu oil":                  {score:2, note:"Moderate risk — may clog pores for some",          aliases:["calophyllum inophyllum seed oil"]},
  "stearic acid":                {score:2, note:"Moderate risk — may clog pores for some",          aliases:[]},
  "vitamin e":                   {score:2, note:"Moderate risk when in high concentrations",        aliases:["tocopherol","tocopheryl acetate","dl-alpha tocopherol"]},
  "tocopherol":                  {score:2, note:"Moderate risk when used heavily",                  aliases:["vitamin e","d-alpha tocopherol"]},
  "tocopheryl acetate":          {score:2, note:"Stable vitamin E — moderate pore-clogging risk",   aliases:[]},
  "C12-15 alkyl benzoate":       {score:2, note:"Moderate risk emollient",                          aliases:["c12-15 alkyl benzoate"]},
  "polysorbate 60":              {score:2, note:"Moderate risk emulsifier",                         aliases:[]},
  "noni extract":                {score:2, note:"Moderate clogging risk extract",                   aliases:["morinda citrifolia fruit extract"]},
  "nylon-12":                    {score:1, note:"Low risk texture agent",                           aliases:[]},

  // ── Irritants — fragrance & alcohols ─────────────────────────
  "fragrance":                   {score:1, irritant:true, note:"Catch-all for undisclosed scent chemicals — one of the top skin sensitizers",        aliases:["parfum","fragrance mix","aroma"]},
  "parfum":                      {score:1, irritant:true, note:"Synthetic scent blend — common cause of contact dermatitis",                         aliases:["fragrance","perfume"]},
  "denatured alcohol":           {score:0, irritant:true, note:"Drying alcohol that strips the skin barrier and can cause irritation",               aliases:["alcohol denat","alcohol denat.","sd alcohol","sd alcohol 40","sd alcohol 40-b"]},
  "alcohol denat":               {score:0, irritant:true, note:"Drying alcohol — disrupts skin barrier and causes dryness",                          aliases:["denatured alcohol","alcohol denat."]},
  "isopropyl alcohol":           {score:0, irritant:true, note:"Harsh drying alcohol — can cause irritation and barrier damage",                     aliases:["isopropanol","rubbing alcohol"]},
  "ethanol":                     {score:0, irritant:true, note:"Drying alcohol — in high amounts can irritate and dry out skin",                     aliases:["alcohol","grain alcohol"]},
  "linalool":                    {score:0, irritant:true, note:"Floral fragrance component — EU-listed allergen, can cause reactions",               aliases:[]},
  "limonene":                    {score:0, irritant:true, note:"Citrus fragrance component — EU-listed allergen",                                    aliases:["d-limonene"]},
  "geraniol":                    {score:0, irritant:true, note:"Rose fragrance component — EU-listed allergen",                                      aliases:[]},
  "eugenol":                     {score:0, irritant:true, note:"Spice fragrance component — EU-listed allergen, high sensitization rate",            aliases:[]},
  "cinnamal":                    {score:0, irritant:true, note:"Cinnamon fragrance — strong allergen and skin sensitizer",                           aliases:["cinnamaldehyde"]},
  "citronellol":                 {score:0, irritant:true, note:"Floral fragrance — EU-listed allergen",                                              aliases:[]},
  "hydroxycitronellal":          {score:0, irritant:true, note:"Synthetic floral fragrance — EU-listed allergen",                                    aliases:[]},
  "isoeugenol":                  {score:0, irritant:true, note:"Fragrance allergen — frequently causes contact allergy",                             aliases:[]},
  "benzyl alcohol":              {score:0, irritant:true, note:"Preservative and fragrance — can irritate sensitive skin",                           aliases:[]},
  "benzyl salicylate":           {score:0, irritant:true, note:"Fragrance fixative — EU-listed allergen",                                            aliases:[]},
  "benzyl benzoate":             {score:0, irritant:true, note:"Fragrance solvent — EU-listed allergen",                                             aliases:[]},
  "coumarin":                    {score:0, irritant:true, note:"Vanilla-like fragrance — EU-listed allergen",                                        aliases:[]},
  "amyl cinnamal":               {score:0, irritant:true, note:"Floral fragrance — EU-listed allergen",                                              aliases:[]},
  "hexyl cinnamal":              {score:0, irritant:true, note:"Floral fragrance — EU-listed allergen",                                              aliases:[]},
  "farnesol":                    {score:0, irritant:true, note:"Floral fragrance — EU-listed allergen",                                              aliases:[]},
  "anise alcohol":               {score:0, irritant:true, note:"Sweet fragrance — EU-listed allergen",                                               aliases:[]},
  "essential oil":               {score:1, irritant:true, note:"Highly concentrated plant compounds — major irritant and sensitizer risk",            aliases:[]},
  "lavender oil":                {score:1, irritant:true, note:"Contains linalool and linalyl acetate — common sensitizer",                          aliases:["lavandula angustifolia oil","lavender essential oil"]},
  "tea tree oil":                {score:1, irritant:true, note:"Antimicrobial but a potent sensitizer — avoid if skin is reactive",                  aliases:["melaleuca alternifolia leaf oil"]},
  "peppermint oil":              {score:1, irritant:true, note:"Menthol causes nerve irritation — not recommended for sensitive skin",               aliases:["mentha piperita oil"]},
  "eucalyptus oil":              {score:1, irritant:true, note:"Can cause irritation and sensitization",                                             aliases:["eucalyptus globulus leaf oil"]},
  "citrus oil":                  {score:1, irritant:true, note:"Photosensitizing and allergen risk",                                                 aliases:["lemon oil","lime oil","orange oil","bergamot oil"]},
  "bergamot oil":                {score:1, irritant:true, note:"Photosensitizing and contains EU allergens",                                         aliases:["citrus bergamia peel oil"]},
  "clove oil":                   {score:1, irritant:true, note:"High eugenol content — major irritant",                                              aliases:["eugenia caryophyllus bud oil"]},
  "cinnamon oil":                {score:1, irritant:true, note:"Potent sensitizer — cinnamal content",                                               aliases:["cinnamomum zeylanicum bark oil"]},
  "menthol":                     {score:0, irritant:true, note:"Cooling agent that can irritate and sensitize skin with repeated use",               aliases:[]},
  "phthalates":                  {score:0, irritant:true, note:"Plasticizers used in fragrance — potential endocrine disruptors",                    aliases:["dibutyl phthalate","dbp"]},

  // ── Harsh surfactants ─────────────────────────────────────────
  "ammonium lauryl sulfate":     {score:0, irritant:true, note:"Harsh surfactant — strips skin barrier similar to SLS",                             aliases:["ALS"]},
  "sodium laureth sulfate":      {score:0, irritant:true, note:"Milder than SLS but still potentially irritating with daily use",                   aliases:["SLES","sodium lauryl ether sulfate"]},

  // ── Silicones ─────────────────────────────────────────────────
  "dimethicone":                 {score:1, note:"Silicone that gives smooth feel — low clogging risk",                aliases:["polydimethylsiloxane","dimethicone crosspolymer"]},
  "cyclomethicone":              {score:1, note:"Lightweight silicone — low clogging risk",                          aliases:["cyclopentasiloxane"]},
  "cyclopentasiloxane":          {score:1, note:"Lightweight volatile silicone",                                     aliases:["D5","cyclopentasiloxane"]},
  "cyclohexasiloxane":           {score:1, note:"Low risk silicone",                                                 aliases:["D6"]},
  "phenyl trimethicone":         {score:1, note:"Low risk silicone — adds shine",                                    aliases:[]},
  "amodimethicone":              {score:0, note:"Light conditioning silicone — non-clogging",                        aliases:[]},
  "trimethylsiloxysilicate":     {score:1, note:"Film-forming silicone — low risk",                                  aliases:[]},

  // ── Safe emollients & waxes ───────────────────────────────────
  "petrolatum":                  {score:0, note:"Non-clogging occlusive that seals in moisture",                     aliases:["petroleum jelly","vaseline","white petrolatum"]},
  "mineral oil":                 {score:0, note:"Non-clogging occlusive moisturiser",                                aliases:["paraffinum liquidum","white mineral oil"]},
  "castor oil":                  {score:1, note:"Low clogging risk — thickening and conditioning",                   aliases:["ricinus communis seed oil"]},
  "sea buckthorn oil":           {score:1, note:"Low clogging risk — vitamin rich",                                  aliases:["hippophae rhamnoides fruit oil"]},
  "sea buckthorn":               {score:1, note:"Low clogging risk",                                                 aliases:["hippophae rhamnoides"]},
  "bakuchiol":                   {score:0, note:"Non-clogging retinol alternative",                                  aliases:[]},
  "argan oil":                   {score:0, note:"Non-clogging — balanced oleic/linoleic ratio",                      aliases:["argania spinosa kernel oil"]},
  "squalane":                    {score:0, note:"Skin-identical oil — non-clogging and excellent for all skin types", aliases:["olive squalane","sugarcane squalane"]},
  "hemp seed oil":               {score:0, note:"Non-clogging — high linoleic acid content",                         aliases:["cannabis sativa seed oil"]},
  "rosehip oil":                 {score:1, note:"Low clogging risk — high in vitamin A",                             aliases:["rosa canina fruit oil","rosa rubiginosa seed oil"]},
  "sunflower oil":               {score:0, note:"Non-clogging — high linoleic acid",                                 aliases:["helianthus annuus seed oil","helianthus annuus (sunflower) seed oil"]},
  "safflower oil":               {score:0, note:"Non-clogging — very high linoleic acid",                            aliases:["carthamus tinctorius seed oil"]},
  "carnauba wax":                {score:1, note:"Low clogging vegan wax",                                           aliases:["copernicia cerifera wax","copernicia cerifera (carnauba) wax"]},
  "candelilla wax":              {score:1, note:"Low clogging vegan wax",                                           aliases:["euphorbia cerifera wax"]},
  "caprylic/capric triglyceride":{score:1, note:"Low clogging MCT ester — skin-compatible",                         aliases:["MCT oil","fractionated coconut oil","caprylic capric triglyceride"]},
  "linoleic acid":               {score:0, note:"Non-clogging fatty acid — actually helps acne-prone skin",          aliases:[]},
  "squalene":                    {score:1, note:"Natural skin lipid — low clogging risk",                            aliases:[]},

  // ── Humectants ────────────────────────────────────────────────
  "glycerin":                    {score:0, note:"Draws water into skin — essential moisturising ingredient",          aliases:["glycerol","vegetable glycerin"]},
  "hyaluronic acid":             {score:0, note:"Holds 1000x its weight in water — deeply hydrating",               aliases:["sodium hyaluronate","hyaluronate"]},
  "sodium hyaluronate":          {score:0, note:"Smaller HA molecule — penetrates deeper",                          aliases:["hyaluronic acid"]},
  "butylene glycol":             {score:1, note:"Low risk humectant",                                               aliases:["BG","1,3-butanediol"]},
  "pentylene glycol":            {score:0, note:"Gentle humectant — non-clogging",                                  aliases:[]},
  "sorbitol":                    {score:0, note:"Sugar-derived humectant — non-clogging",                           aliases:[]},
  "urea":                        {score:0, note:"Natural moisturising factor — softens and hydrates",               aliases:["carbamide"]},
  "sodium PCA":                  {score:0, note:"Natural moisturising factor — non-clogging",                       aliases:[]},
  "trehalose":                   {score:0, note:"Sugar humectant — protective and non-clogging",                    aliases:[]},
  "aloe vera":                   {score:0, note:"Soothing and hydrating — non-clogging",                            aliases:["aloe barbadensis leaf juice","aloe barbadensis","aloe"]},
  "beta glucan":                 {score:0, note:"Soothing humectant from oats or yeast",                            aliases:["oat beta glucan","beta-glucan"]},
  "polyglutamic acid":           {score:0, note:"Humectant 4x stronger than HA",                                   aliases:["PGA"]},
  "erythritol":                  {score:0, note:"Sugar humectant — skin-compatible",                                aliases:[]},
  "xylitol":                     {score:0, note:"Sugar humectant with antimicrobial benefits",                      aliases:[]},

  // ── Actives ───────────────────────────────────────────────────
  "retinol":                     {score:0, note:"Speeds up cell turnover — reduces lines and breakouts",             aliases:["vitamin a","retinyl palmitate","retinyl acetate"]},
  "retinal":                     {score:0, note:"11x stronger than retinol — non-clogging",                         aliases:["retinaldehyde"]},
  "tretinoin":                   {score:0, note:"Prescription retinoid — highly effective",                         aliases:["retinoic acid","all-trans retinoic acid"]},
  "salicylic acid":              {score:0, note:"BHA that goes inside pores to clear congestion",                   aliases:["acid exfoliator (BHA)","beta hydroxy acid","BHA","willow bark"]},
  "benzoyl peroxide":            {score:0, note:"Kills acne-causing bacteria directly",                             aliases:["BPO","benzoyl peroxide 2.5%","benzoyl peroxide 5%"]},
  "vitamin c":                   {score:0, note:"Brightens and protects against UV damage",                         aliases:["ascorbic acid","l-ascorbic acid","ascorbyl glucoside","ascorbyl palmitate"]},
  "ascorbic acid":               {score:0, note:"Pure vitamin C — brightens and boosts collagen",                   aliases:["vitamin c","l-ascorbic acid"]},
  "ascorbyl glucoside":          {score:0, note:"Stable vitamin C derivative — gentle and effective",               aliases:[]},
  "sodium ascorbyl phosphate":   {score:0, note:"Stable vitamin C — also antimicrobial",                            aliases:["SAP"]},
  "azelaic acid":                {score:0, note:"Anti-inflammatory — great for rosacea and PIH",                    aliases:[]},
  "tranexamic acid":             {score:0, note:"Brightening — fades dark spots gently",                            aliases:[]},
  "kojic acid":                  {score:0, note:"Brightening — inhibits melanin production",                        aliases:[]},
  "arbutin":                     {score:0, note:"Gentle brightener — safe for sensitive skin",                      aliases:["alpha-arbutin","alpha arbutin"]},
  "alpha-arbutin":               {score:0, note:"More effective form of arbutin",                                   aliases:["arbutin","alpha arbutin"]},
  "coenzyme q10":                {score:0, note:"Antioxidant — anti-aging and energising",                          aliases:["ubiquinone","ubiquinol"]},
  "copper peptide":              {score:0, note:"Healing and anti-aging",                                           aliases:["GHK-Cu","copper tripeptide-1"]},
  "epidermal growth factor":     {score:0, note:"Skin repair — stimulates cell renewal",                            aliases:["EGF","sh-oligopeptide-1"]},
  "adenosine":                   {score:0, note:"Anti-wrinkle and soothing",                                        aliases:[]},
  "zinc pca":                    {score:0, note:"Oil control and anti-acne",                                        aliases:["zinc PCA"]},
  "sulfur":                      {score:0, note:"Anti-acne and antimicrobial — spot treatment staple",              aliases:[]},
  "mandelic acid":               {score:0, note:"Gentle AHA — great for sensitive and acne-prone skin",             aliases:[]},

  // ── Exfoliants ────────────────────────────────────────────────
  "lactic acid":                 {score:0, note:"Gentle AHA — hydrating and exfoliating",                           aliases:["sodium lactate"]},
  "glycolic acid":               {score:0, note:"Strong AHA — effective but can be sensitising",                    aliases:[]},
  "malic acid":                  {score:0, note:"Mild AHA from fruit",                                             aliases:[]},
  "tartaric acid":               {score:0, note:"Mild AHA from grapes",                                            aliases:[]},
  "citric acid":                 {score:0, note:"AHA and pH adjuster",                                              aliases:[]},
  "polyhydroxy acid":            {score:0, note:"Gentle next-gen AHA — won't irritate sensitive skin",              aliases:["PHA","gluconolactone","lactobionic acid"]},
  "gluconolactone":              {score:0, note:"Gentle PHA — also an antioxidant",                                 aliases:["PHA"]},

  // ── Barrier & Repair ──────────────────────────────────────────
  "ceramide":                    {score:0, note:"Essential lipid that rebuilds the skin barrier",                   aliases:["ceramide np","ceramide ap","ceramide eg","ceramide eop","ceramide ns","ceramide as"]},
  "ceramide np":                 {score:0, note:"Key barrier ceramide",                                             aliases:[]},
  "ceramide ap":                 {score:0, note:"Key barrier ceramide",                                             aliases:[]},
  "ceramide eop":                {score:0, note:"Key barrier ceramide",                                             aliases:[]},
  "cholesterol":                 {score:0, note:"Barrier lipid — works with ceramides",                             aliases:[]},
  "sphingosine":                 {score:0, note:"Barrier lipid component",                                          aliases:[]},
  "panthenol":                   {score:0, note:"Pro-vitamin B5 — soothing and hydrating",                          aliases:["pro-vitamin b5","dexpanthenol","d-panthenol"]},
  "allantoin":                   {score:0, note:"Calming and wound-healing",                                        aliases:[]},
  "bisabolol":                   {score:0, note:"Anti-inflammatory — from chamomile",                               aliases:["alpha-bisabolol","(-)-alpha-bisabolol"]},
  "centella asiatica":           {score:0, note:"Powerful wound healing and anti-inflammatory",                     aliases:["cica","gotu kola","madecassoside","centella","CICA","tiger grass"]},
  "madecassoside":               {score:0, note:"Active centella compound — healing",                               aliases:[]},
  "asiaticoside":                {score:0, note:"Active centella compound — soothing",                              aliases:[]},
  "oat extract":                 {score:0, note:"Soothing — reduces redness and itch",                              aliases:["avena sativa kernel extract","colloidal oat"]},
  "colloidal oatmeal":           {score:0, note:"FDA-approved skin protectant — calms irritation",                  aliases:["avena sativa meal","oat flour"]},
  "beta-glucan":                 {score:0, note:"Soothing humectant from oats or yeast",                            aliases:[]},
  "ectoin":                      {score:0, note:"Protective extremolyte — shields barrier",                         aliases:[]},
  "sodium pca":                  {score:0, note:"Natural moisturising factor",                                      aliases:[]},
  "dexpanthenol":                {score:0, note:"Pro-vitamin B5 — barrier repair",                                  aliases:[]},

  // ── Peptides ──────────────────────────────────────────────────
  "palmitoyl pentapeptide-4":    {score:0, note:"Anti-aging peptide (Matrixyl) — boosts collagen",                  aliases:["matrixyl"]},
  "palmitoyl tripeptide-1":      {score:0, note:"Collagen-boosting peptide",                                        aliases:[]},
  "palmitoyl tripeptide-38":     {score:0, note:"Anti-aging peptide — targets deep wrinkles",                       aliases:["matrixyl synthe'6"]},
  "acetyl hexapeptide-3":        {score:0, note:"Anti-wrinkle peptide — relaxes expression lines",                  aliases:["argireline","acetyl hexapeptide-8"]},
  "leuphasyl":                   {score:0, note:"Anti-wrinkle peptide",                                             aliases:[]},
  "syn-ake":                     {score:0, note:"Snake venom mimic — smooths wrinkles",                             aliases:["dipeptide diaminobutyroyl benzylamide diacetate"]},
  "matrixyl 3000":               {score:0, note:"Peptide complex — clinically proven for collagen",                 aliases:[]},
  "tripeptide-1":                {score:0, note:"Wound healing and firming peptide",                                aliases:[]},
  "tetrapeptide-21":             {score:0, note:"Collagen-stimulating peptide",                                     aliases:[]},

  // ── Sunscreen Filters ─────────────────────────────────────────
  "zinc oxide":                  {score:0, note:"Mineral SPF — broad spectrum, non-clogging",                       aliases:[]},
  "titanium dioxide":            {score:0, note:"Mineral SPF — gentle, no chemical reaction on skin",               aliases:[]},
  "octinoxate":                  {score:0, note:"Chemical UVB filter",                                              aliases:["ethylhexyl methoxycinnamate","octyl methoxycinnamate"]},
  "octisalate":                  {score:0, note:"Chemical UVB filter — also a fragrance",                          aliases:["ethylhexyl salicylate","octyl salicylate"]},
  "octocrylene":                 {score:1, note:"Chemical filter — low pore risk",                                  aliases:[]},
  "avobenzone":                  {score:0, note:"Chemical UVA filter",                                              aliases:["butyl methoxydibenzoylmethane"]},
  "oxybenzone":                  {score:0, irritant:true, note:"Chemical UVA filter — potential hormone disruptor and reef-damaging",  aliases:["benzophenone-3"]},
  "tinosorb s":                  {score:0, note:"Broad-spectrum EU-approved filter",                                aliases:["bis-ethylhexyloxyphenol methoxyphenyl triazine"]},
  "tinosorb m":                  {score:0, note:"Broad-spectrum EU-approved filter",                                aliases:["methylene bis-benzotriazolyl tetramethylbutylphenol"]},
  "uvinul a plus":               {score:0, note:"UVA filter — EU and US approved",                                  aliases:["diethylamino hydroxybenzoyl hexyl benzoate"]},
  "homosalate":                  {score:0, note:"Chemical UVB filter",                                              aliases:[]},
  "iscotrizinol":                {score:0, note:"Broad-spectrum EU filter",                                         aliases:["DHHB","diethylhexyl butamido triazone"]},

  // ── Botanicals & Extracts ─────────────────────────────────────
  "green tea extract":           {score:0, note:"Potent antioxidant and anti-inflammatory",                         aliases:["camellia sinensis leaf extract","epigallocatechin gallate","EGCG"]},
  "chamomile extract":           {score:0, note:"Soothing and anti-inflammatory",                                   aliases:["matricaria recutita flower extract","anthemis nobilis flower extract"]},
  "licorice root extract":       {score:0, note:"Brightening and anti-inflammatory",                                aliases:["glycyrrhiza glabra root extract","glycyrrhizin"]},
  "turmeric extract":            {score:0, note:"Anti-inflammatory antioxidant",                                    aliases:["curcuma longa root extract","curcumin"]},
  "willow bark extract":         {score:0, note:"Natural salicylate source — gentle exfoliant",                     aliases:["salix alba bark extract"]},
  "rosemary extract":            {score:0, note:"Antioxidant preservative",                                         aliases:["rosmarinus officinalis leaf extract"]},
  "ferulic acid":                {score:0, note:"Antioxidant — boosts vitamin C stability",                         aliases:[]},
  "caffeine":                    {score:0, note:"De-puffing and antioxidant",                                       aliases:[]},
  "resveratrol":                 {score:0, note:"Antioxidant from grapes — anti-aging",                             aliases:[]},
  "pomegranate extract":         {score:0, note:"Antioxidant and brightening",                                      aliases:["punica granatum fruit extract"]},
  "sea buckthorn berry":         {score:1, note:"Rich in carotenoids — low clogging risk",                         aliases:["hippophae rhamnoides fruit"]},
  "niacinamide":                 {score:0, note:"Visibly shrinks pores and evens skin tone",                        aliases:["vitamin b3","nicotinamide"]},
  "witch hazel":                 {score:0, irritant:true, note:"Astringent — can disrupt barrier with prolonged use",aliases:["hamamelis virginiana leaf extract","hamamelis virginiana water"]},
  "sodium lauryl sulfate":       {score:0, irritant:true, note:"Strong detergent — strips skin barrier",           aliases:["SLS"]},

  // ── Clays & Minerals ──────────────────────────────────────────
  "kaolin":                      {score:0, note:"Gentle clay — absorbs oil without clogging",                       aliases:["kaolin clay","china clay"]},
  "bentonite":                   {score:0, note:"Oil-absorbing purifying clay",                                     aliases:["bentonite clay"]},
  "montmorillonite":             {score:0, note:"Purifying clay",                                                   aliases:[]},
  "zinc":                        {score:0, note:"Oil control and anti-inflammatory",                                 aliases:[]},
  "iron oxides":                 {score:0, note:"Mineral colorants — non-clogging",                                 aliases:[]},
  "mica":                        {score:0, note:"Shimmer mineral — non-clogging",                                   aliases:[]},
  "silica":                      {score:0, note:"Mattifying and oil absorbing",                                     aliases:["amorphous silica"]},

  // ── Preservatives ─────────────────────────────────────────────
  "phenoxyethanol":              {score:0, note:"Common broad-spectrum preservative",                               aliases:[]},
  "ethylhexylglycerin":          {score:0, note:"Gentle preservative booster",                                     aliases:[]},
  "sodium benzoate":             {score:0, note:"Preservative — safe in normal concentrations",                     aliases:[]},
  "potassium sorbate":           {score:0, note:"Natural-derived preservative",                                     aliases:[]},
  "dehydroacetic acid":          {score:0, note:"Gentle preservative",                                              aliases:[]},
  "caprylyl glycol":             {score:0, note:"Conditioning preservative booster",                               aliases:[]},
  "chlorphenesin":               {score:0, note:"Preservative — low risk",                                          aliases:[]},
  "methylparaben":               {score:0, irritant:true, note:"Paraben preservative — potential hormone disruptor at high levels",  aliases:["methyl paraben"]},
  "propylparaben":               {score:0, irritant:true, note:"Paraben preservative — potential hormone disruptor",aliases:["propyl paraben"]},
  "butylparaben":                {score:0, irritant:true, note:"Paraben preservative — most controversial paraben", aliases:["butyl paraben"]},
  "formaldehyde":                {score:0, irritant:true, note:"Preservative and known carcinogen — rare in skincare now",aliases:[]},
  "dmdm hydantoin":              {score:0, irritant:true, note:"Formaldehyde-releasing preservative — can cause irritation",aliases:[]},
  "imidazolidinyl urea":         {score:0, irritant:true, note:"Formaldehyde-releasing preservative",               aliases:[]},
  "quaternium-15":               {score:0, irritant:true, note:"Formaldehyde-releasing preservative — high sensitization rate",aliases:[]},

  // ── pH adjusters ─────────────────────────────────────────────
  "sodium hydroxide":            {score:0, note:"pH balancer — makes the formula work on your skin",               aliases:["lye","caustic soda"]},
  "potassium hydroxide":         {score:0, note:"pH balancer",                                                      aliases:[]},

  // ── Thickeners & Texture ──────────────────────────────────────
  "xanthan gum":                 {score:0, note:"Natural thickener — makes formula spreadable",                    aliases:[]},
  "carbomer":                    {score:0, note:"Gel former — non-clogging",                                        aliases:["carbopol","acrylates/c10-30 alkyl acrylate crosspolymer"]},
  "hydroxyethylcellulose":       {score:0, note:"Plant-derived thickener",                                          aliases:["HEC"]},
  "hydroxypropyl cellulose":     {score:0, note:"Plant-derived thickener",                                          aliases:[]},
  "guar gum":                    {score:0, note:"Natural thickener",                                                aliases:[]},
  "cellulose":                   {score:0, note:"Plant-derived texture agent",                                      aliases:[]},
  "polyacrylate crosspolymer":   {score:0, note:"Gel thickener — non-clogging",                                    aliases:["polyacrylate crosspolymer-6"]},
  "polyethylene":                {score:1, note:"Low risk texture agent",                                           aliases:[]},

  // ── Emulsifiers ───────────────────────────────────────────────
  "polysorbate 20":              {score:0, note:"Gentle emulsifier — keeps oil and water mixed",                    aliases:[]},
  "polysorbate 80":              {score:0, note:"Gentle emulsifier",                                                aliases:[]},
  "lecithin":                    {score:0, note:"Natural emulsifier — skin-identical",                              aliases:["soy lecithin","sunflower lecithin","phosphatidylcholine"]},
  "cocamidopropyl betaine":      {score:0, note:"Gentle amphoteric surfactant",                                     aliases:[]},
  "decyl glucoside":             {score:0, note:"Very gentle non-ionic surfactant",                                 aliases:[]},
  "sodium cocoyl isethionate":   {score:0, note:"Gentle skin-friendly surfactant",                                  aliases:["SCI"]},
  "sodium cocoamphoacetate":     {score:0, note:"Gentle amphoteric surfactant",                                     aliases:[]},
  "coco-glucoside":              {score:0, note:"Very gentle plant-derived surfactant",                             aliases:[]},
  "behentrimonium methosulfate": {score:0, note:"Gentle conditioning emulsifier",                                   aliases:["BTMS","BTMS-50"]},
  "glyceryl stearate":           {score:1, note:"Common emulsifier — low clogging risk",                           aliases:[]},

  // ── Additional high-clogging esters & oils (4-5) ─────────────
  "lauryl alcohol":              {score:4, note:"Fatty alcohol derived from coconut — clogs pores",                aliases:[]},
  "myristyl alcohol":            {score:2, note:"Fatty alcohol — moderate to high clogging risk",                  aliases:[]},
  "octyl stearate":              {score:4, note:"Heavy ester — high pore-clogging risk",                           aliases:["ethylhexyl stearate"]},
  "octyl dodecanol":             {score:3, note:"Emollient alcohol — moderate clogging risk",                      aliases:[]},
  "isostearyl alcohol":          {score:3, note:"Branched fatty alcohol — moderate clogging risk",                 aliases:[]},
  "isostearyl isostearate":      {score:5, note:"Highly pore-clogging ester",                                      aliases:[]},
  "isostearyl neopentanoate":    {score:4, note:"Heavy emollient ester — clogs pores",                             aliases:[]},
  "isocetyl alcohol":            {score:4, note:"Fatty alcohol — high pore-clogging risk",                         aliases:[]},
  "isocetyl stearate":           {score:4, note:"Pore-clogging emollient ester",                                   aliases:[]},
  "cetyl octanoate":             {score:2, note:"Emollient ester — moderate clogging risk",                        aliases:[]},
  "propylene glycol stearate":   {score:2, note:"Moderate pore-clogging emulsifier",                               aliases:[]},
  "ethylhexyl isononanoate":     {score:2, note:"Lightweight but comedogenic ester",                               aliases:[]},
  "myristyl lactate":            {score:4, note:"High pore-clogging emollient",                                    aliases:[]},
  "decyl stearate":              {score:4, note:"Heavy emollient — clogs pores",                                   aliases:[]},
  "laureth-4":                   {score:5, note:"One of the most comedogenic surfactants",                         aliases:[]},
  "sodium laureth-5 carboxylate":{score:1, note:"Moderate clogging surfactant derivative",                        aliases:[]},
  "peg-8 laurate":               {score:3, note:"Moderate clogging PEG ester",                                     aliases:[]},
  "peg-75 lanolin":              {score:4, note:"High pore-clogging lanolin PEG ester",                            aliases:[]},
  "acetylated lanolin alcohol":  {score:4, note:"High pore-clogging lanolin derivative",                           aliases:[]},
  "choleth-24":                  {score:4, note:"Pore-clogging cholesterol ether",                                 aliases:[]},
  "ceteth-2":                    {score:4, note:"Pore-clogging fatty alcohol ether",                               aliases:[]},
  "oleth-3":                     {score:4, note:"High pore-clogging PEG ether",                                    aliases:[]},
  "mink oil":                    {score:3, note:"Animal-derived oil — moderate pore-clogging risk",                aliases:[]},
  "emu oil":                     {score:2, note:"Animal-derived oil — moderate pore-clogging risk",                aliases:[]},
  "shark liver oil":             {score:2, note:"High squalene content — moderate clogging risk",                  aliases:[]},
  "lard":                        {score:3, note:"Pork fat — moderate pore-clogging risk",                          aliases:["suet","tallow"]},
  "tallow":                      {score:3, note:"Animal fat — moderate pore-clogging",                             aliases:[]},
  "hydrogenated coconut oil":    {score:4, note:"Solidified coconut oil — clogs pores",                            aliases:[]},
  "hydrogenated vegetable oil":  {score:3, note:"Processed plant oil — moderate clogging risk",                    aliases:[]},
  "hydrogenated palm oil":       {score:4, note:"Hydrogenated palm — high pore-clogging risk",                     aliases:[]},
  "hydrogenated castor oil":     {score:1, note:"Processed castor oil — lower clogging than raw",                  aliases:["castor wax"]},
  "castor wax":                  {score:1, note:"Hydrogenated castor oil — low clogging risk",                     aliases:[]},
  "stearyl heptanoate":          {score:2, note:"Emollient ester — moderate pore-clogging",                        aliases:[]},
  "hexadecyl alcohol":           {score:3, note:"Another name for cetyl alcohol — moderate pore risk",             aliases:[]},
  "undecylenoyl glycine":        {score:0, note:"Antimicrobial — non-clogging",                                    aliases:[]},

  // ── More moderate comedogenic ingredients (2-3) ──────────────
  "rose hip seed oil":           {score:1, note:"Low clogging — high linoleic acid",                               aliases:["rosa canina seed oil","rosa moschata seed oil"]},
  "macadamia oil":               {score:2, note:"Moderate risk — high oleic acid content",                         aliases:["macadamia integrifolia seed oil","macadamia ternifolia seed oil"]},
  "neem oil":                    {score:2, note:"Moderate pore-clogging risk",                                     aliases:["azadirachta indica seed oil"]},
  "rice bran oil":               {score:2, note:"Moderate risk — mixed fatty acid profile",                        aliases:["oryza sativa bran oil"]},
  "pecan oil":                   {score:2, note:"Moderate pore-clogging risk",                                     aliases:["carya illinoinensis kernel oil"]},
  "walnut oil":                  {score:2, note:"Moderate risk for acne-prone skin",                               aliases:["juglans regia seed oil"]},
  "moringa oil":                 {score:2, note:"Moderate pore-clogging risk",                                     aliases:["moringa oleifera seed oil"]},
  "baobab oil":                  {score:2, note:"Moderate risk — high oleic acid",                                 aliases:["adansonia digitata seed oil"]},
  "meadowfoam seed oil":         {score:1, note:"Low clogging risk — stable and skin-compatible",                  aliases:["limnanthes alba seed oil"]},
  "watermelon seed oil":         {score:0, note:"Non-clogging — high linoleic acid",                               aliases:["citrullus lanatus seed oil"]},
  "sea buckthorn seed oil":      {score:1, note:"Low clogging — different profile from berry oil",                 aliases:["hippophae rhamnoides seed oil"]},
  "prickly pear seed oil":       {score:0, note:"Non-clogging — very high linoleic acid",                          aliases:["opuntia ficus-indica seed oil"]},
  "black currant seed oil":      {score:1, note:"Low clogging — high GLA content",                                 aliases:["ribes nigrum seed oil"]},
  "chia seed oil":               {score:0, note:"Non-clogging — very high linoleic acid",                          aliases:["salvia hispanica seed oil"]},
  "perilla seed oil":            {score:0, note:"Non-clogging — very high alpha-linolenic acid",                   aliases:["perilla frutescens seed oil"]},
  "acai oil":                    {score:3, note:"High oleic acid — moderate pore-clogging risk",                   aliases:["euterpe oleracea fruit oil"]},
  "passion fruit oil":           {score:1, note:"Low clogging — high linoleic acid",                               aliases:["passiflora edulis seed oil","maracuja oil"]},
  "pomegranate seed oil":        {score:1, note:"Low clogging — unique punicic acid content",                      aliases:["punica granatum seed oil"]},
  "broccoli seed oil":           {score:1, note:"Low clogging — silicone-like slip",                               aliases:["brassica oleracea italica seed oil"]},
  "hemp oil":                    {score:0, note:"Non-clogging — very high linoleic acid",                          aliases:["cannabis sativa seed oil","hemp seed oil"]},
  "vitamin f":                   {score:0, note:"Essential fatty acids — linoleic and alpha-linolenic acid",       aliases:["linoleic acid","alpha-linolenic acid"]},

  // ── Waxes ─────────────────────────────────────────────────────
  "paraffin wax":                {score:1, note:"Mineral wax — low to moderate clogging risk",                     aliases:["paraffin","cera microcristallina","microcrystalline wax"]},
  "microcrystalline wax":        {score:2, note:"Moderate pore-clogging mineral wax",                              aliases:["cera microcristallina"]},
  "ozokerite":                   {score:2, note:"Mineral wax — moderate clogging risk",                            aliases:["ozokerite wax","ceresin"]},
  "ceresin":                     {score:2, note:"Mineral wax — moderate clogging risk",                            aliases:["ceresin wax"]},
  "rice bran wax":               {score:1, note:"Natural wax — low clogging risk",                                 aliases:["oryza sativa bran wax"]},
  "polyethylene wax":            {score:2, note:"Synthetic wax — moderate pore-clogging risk",                     aliases:[]},
  "spermaceti":                  {score:3, note:"Whale-derived wax — moderate to high clogging",                   aliases:[]},
  "synthetic wax":               {score:2, note:"Moderate clogging risk",                                          aliases:[]},

  // ── Makeup-specific ingredients ───────────────────────────────
  "bismuth oxychloride":         {score:2, irritant:true, note:"Shimmery mineral in makeup — can cause itching and pore congestion", aliases:[]},
  "talc":                        {score:1, note:"Mineral powder — low clogging but can block pores if heavy",      aliases:[]},
  "zinc stearate":               {score:2, note:"Found in makeup — moderate pore-clogging risk",                   aliases:[]},
  "magnesium stearate":          {score:2, note:"Found in pressed powders — moderate clogging",                    aliases:[]},
  "d&c red":                     {score:1, note:"Synthetic dyes used in makeup — low risk",                        aliases:["d&c red 6","d&c red 7","d&c red 27","d&c red 30","d&c red 33","d&c red 36"]},
  "red 40":                      {score:0, note:"Synthetic dye — non-clogging",                                    aliases:["allura red","fd&c red 40"]},
  "fd&c yellow":                 {score:0, note:"Synthetic dye — non-clogging",                                    aliases:["fd&c yellow 5","fd&c yellow 6"]},

  // ── More irritants & sensitizers ─────────────────────────────
  "methylisothiazolinone":       {score:0, irritant:true, note:"Preservative — extremely high allergen rate, now restricted in EU leave-on products", aliases:["MIT","methylisothiazolinone"]},
  "methylchloroisothiazolinone": {score:0, irritant:true, note:"Preservative — one of the most sensitizing ingredients, banned in EU leave-ons",     aliases:["CMIT","MCI/MI"]},
  "iodopropynyl butylcarbamate": {score:0, irritant:true, note:"Preservative — skin sensitizer, restricted in products for children",                aliases:["IPBC"]},
  "sodium lauryl sulfoacetate":  {score:0, irritant:true, note:"Surfactant — milder than SLS but can still irritate",                                aliases:["SLSA"]},
  "cocamide DEA":                {score:0, irritant:true, note:"Surfactant — potential carcinogen and skin sensitizer",                               aliases:["cocamide diethanolamine"]},
  "cocamide MEA":                {score:0, irritant:true, note:"Surfactant — potential skin sensitizer",                                              aliases:[]},
  "triethanolamine lauryl sulfate":{score:0, irritant:true, note:"Harsh surfactant — can cause irritation",                                          aliases:["TEA lauryl sulfate"]},
  "sodium C14-16 olefin sulfonate":{score:0, irritant:true, note:"Moderate-strength surfactant — can irritate sensitive skin",                       aliases:[]},
  "alpha isomethyl ionone":      {score:0, irritant:true, note:"Violet fragrance — EU-listed allergen",                                               aliases:[]},
  "cinnamyl alcohol":            {score:0, irritant:true, note:"Cinnamon fragrance alcohol — EU-listed allergen",                                     aliases:[]},
  "citral":                      {score:0, irritant:true, note:"Citrus fragrance — EU-listed allergen",                                               aliases:[]},
  "evernia prunastri":           {score:0, irritant:true, note:"Oakmoss extract — potent EU-listed allergen",                                         aliases:["oakmoss extract"]},
  "evernia furfuracea":          {score:0, irritant:true, note:"Treemoss extract — EU-listed allergen",                                               aliases:["treemoss extract"]},
  "lilial":                      {score:0, irritant:true, note:"Floral fragrance — EU-listed allergen, now banned in EU",                             aliases:["butylphenyl methylpropional","BMHCA"]},
  "lyral":                       {score:0, irritant:true, note:"Fragrance — banned in EU due to high allergen rate",                                  aliases:["hydroxyisohexyl 3-cyclohexene carboxaldehyde","HICC"]},
  "musk ambrette":               {score:0, irritant:true, note:"Nitro musk — banned fragrance, potent sensitizer",                                    aliases:[]},
  "propylene glycol":            {score:0, irritant:true, note:"Humectant — can irritate very sensitive skin at high concentrations",                 aliases:["PG","1,2-propanediol"]},
  "mineral spirits":             {score:0, irritant:true, note:"Solvent — skin irritant",                                                             aliases:[]},
  "camphor":                     {score:0, irritant:true, note:"Cooling agent — skin irritant and sensitizer",                                        aliases:["cinnamomum camphora"]},
  "salicylate":                  {score:0, irritant:true, note:"Fragrance and UV filter — can cause reactions in salicylate-sensitive individuals",   aliases:[]},
  "dihydroxyacetone":            {score:0, note:"Self-tanning agent — non-clogging but can cause dryness",                                            aliases:["DHA"]},
  "retinyl palmitate":           {score:1, note:"Vitamin A ester — low clogging, mild retinoid activity",                                             aliases:[]},
  "ethylparaben":                {score:0, irritant:true, note:"Paraben preservative — potential hormone disruptor",                                  aliases:["ethyl paraben"]},
  "isobutylparaben":             {score:0, irritant:true, note:"Paraben preservative — potential hormone disruptor",                                  aliases:[]},
  "benzylparaben":               {score:0, irritant:true, note:"Paraben preservative",                                                                aliases:[]},
  "sodium sulfate":              {score:0, irritant:true, note:"Can be irritating — often a byproduct in SLS manufacturing",                          aliases:[]},
  "ammonium laureth sulfate":    {score:0, irritant:true, note:"Moderate-strength surfactant — can cause irritation",                                 aliases:["ALES"]},
  "toluene":                     {score:0, irritant:true, note:"Solvent found in some nail products — toxic and irritating",                          aliases:[]},
  "formaldehyde releasers":      {score:0, irritant:true, note:"Preservatives that slowly release formaldehyde — sensitizers",                       aliases:["dmdm hydantoin","imidazolidinyl urea","diazolidinyl urea"]},

  // ── Score corrections — raising previously lenient entries ───
  "cetyl alcohol":               {score:2, note:"Common emollient — moderately pore-clogging, especially for acne-prone skin", aliases:[]},
  "cetearyl alcohol":            {score:2, note:"Blend of cetyl/stearyl alcohol — moderately pore-clogging",                  aliases:[]},
  "stearyl alcohol":             {score:2, note:"Fatty alcohol — may clog pores for some",                                    aliases:[]},
  "beeswax":                     {score:3, note:"Natural wax — moderate to high pore-clogging risk",                          aliases:["cera alba","white wax","yellow wax"]},
  "jojoba oil":                  {score:1, note:"Technically a wax ester — generally well-tolerated but not truly non-comedogenic", aliases:["simmondsia chinensis seed oil","simmondsia chinensis (jojoba) seed oil"]},
  "shea butter":                 {score:2, note:"Rich butter — moderate to high pore-clogging risk for acne-prone skin",      aliases:["butyrospermum parkii butter","butyrospermum parkii (shea) butter"]},
  "cocoa butter":                {score:4, note:"Thick occlusive butter — high pore-clogging risk",                           aliases:["theobroma cacao seed butter","cacao butter"]},
  "mango butter":                {score:2, note:"Rich butter — moderate pore-clogging risk",                                  aliases:["mangifera indica seed butter"]},
  "lanolin":                     {score:2, note:"Wool-derived emollient — moderately pore-clogging",                          aliases:["wool wax","wool grease","lanolin alcohol","wool fat"]},
  "triethanolamine":             {score:2, note:"pH adjuster — moderate clogging risk, also a potential irritant",            aliases:["TEA","trolamine"]},
};

// ── ProductImg — image with graceful branded fallback ─────────
function ProductImg({ src, alt, style = {}, brand = "" }) {
  const [errored, setErrored] = React.useState(false);
  const initials = (brand || alt || "?").slice(0, 2).toUpperCase();
  if (!src || errored) {
    return (
      <div style={{
        ...style,
        background: T.iceBlue,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: "900",
          fontSize: typeof style.width === "number" ? style.width * 0.3 : "1rem",
          color: T.navy,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          opacity: 0.6,
        }}>{initials}</span>
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      style={{ ...style, objectFit: "cover", flexShrink: 0 }}
      onError={() => setErrored(true)}
    />
  );
}

// ── Helpers ─────────────────────────────────────────────────── ───────────────────────────────────────────────────
function poreStyle(score) {
  if (score === 0) return {color:T.sage,  label:"Clear",   sub:"Won't clog pores"};
  if (score === 1) return {color:T.sage,  label:"Minimal", sub:"Very low risk"};
  if (score === 2) return {color:T.amber, label:"Low risk", sub:"May affect some skin"};
  if (score === 3) return {color:T.amber, label:"Medium",   sub:"Likely to clog pores"};
  if (score === 4) return {color:T.rose,  label:"High",     sub:"High clog risk"};
  return               {color:T.rose,  label:"Avoid",   sub:"Clogs pores"};
}

// ── PoreScoreBadge ────────────────────────────────────────────
// Animated score badge — counts up from 0 to the real score on mount.
// size: "sm" (feed cards) | "md" (default) | "lg" (product modal hero)
function PoreScoreBadge({ score, size="md", instant=false }) {
  const [displayed, setDisplayed] = React.useState(instant ? (score||0) : 0);
  const prevScore = React.useRef(null);

  React.useEffect(() => {
    if (score == null) return;
    if (prevScore.current === score) return;
    prevScore.current = score;
    if (instant) { setDisplayed(score); return; }
    setDisplayed(0);
    if (score === 0) return;
    let current = 0;
    let timeoutId;
    const tick = () => {
      current += 1;
      setDisplayed(current);
      if (current < score) {
        const remaining = score - current;
        const interval = remaining > 2 ? 110 : remaining > 1 ? 160 : 240;
        timeoutId = setTimeout(tick, interval);
      }
    };
    timeoutId = setTimeout(tick, 120);
    return () => clearTimeout(timeoutId);
  }, [score, instant]);

  if (score == null) return null;
  const ps = poreStyle(displayed);
  const finalPs = poreStyle(score);

  const sizes = {
    sm:  { wrap: { borderRadius:"0.45rem", padding:"0.2rem 0.4rem", minWidth:"36px" }, label: "0.48rem", num: "0.88rem", sub: "0.45rem" },
    md:  { wrap: { borderRadius:"0.65rem", padding:"0.35rem 0.55rem", minWidth:"44px" }, label: "0.5rem",  num: "1.05rem", sub: "0.52rem" },
    lg:  { wrap: { borderRadius:"0.85rem", padding:"0.55rem 0.8rem",  minWidth:"60px" }, label: "0.6rem",  num: "1.6rem",  sub: "0.7rem"  },
  };
  const s = sizes[size] || sizes.md;

  // Use the final color immediately (so badge bg matches target, not intermediate)
  const color = finalPs.color;

  return (
    <div style={{
      ...s.wrap,
      flexShrink:0,
      background: ps.color+"12",
      border: `1px solid ${ps.color}25`,
      textAlign: "center",
      transition: "background 0.25s ease, border-color 0.25s ease",
    }}>
      <div style={{ fontSize: s.label, fontWeight:"700", color: ps.color, textTransform:"uppercase", letterSpacing:"0.07em", lineHeight:1, transition:"color 0.25s ease" }}>pore</div>
      <div style={{
        fontSize: s.num,
        fontWeight: "800",
        color: ps.color,
        fontFamily: "'Inter',sans-serif",
        lineHeight: 1.1,
        transition: "color 0.25s ease",
        animation: displayed > 0 && displayed < score ? "scoreTick 0.12s ease-out" : "none",
      }}>
        {displayed}
        <span style={{ fontSize: s.sub, fontWeight:"400", color: T.textLight }}>/5</span>
      </div>
    </div>
  );
}


// ── FeedSkeleton ──────────────────────────────────────────────
function FeedSkeleton() {
  return (
    <div style={{padding:"0 1rem"}}>
      {[0,1,2,3].map(i=>(
        <div key={i} style={{paddingTop:"0.85rem",marginBottom:"0.1rem"}}>
          {/* Header row */}
          <div style={{display:"flex",alignItems:"center",gap:"0.55rem",marginBottom:"0.65rem"}}>
            <div className="skeleton" style={{width:"32px",height:"32px",borderRadius:"50%",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div className="skeleton" style={{height:"10px",width:`${55+i*12}px`,borderRadius:"6px",marginBottom:"5px"}}/>
              <div className="skeleton" style={{height:"9px",width:"48px",borderRadius:"6px"}}/>
            </div>
          </div>
          {/* Product card */}
          <div style={{display:"flex",gap:"0.75rem",alignItems:"center",borderRadius:"1rem",padding:"0.75rem",border:`1px solid ${T.border}`,marginBottom:"0.65rem"}}>
            <div className="skeleton" style={{width:"56px",height:"56px",borderRadius:"0.65rem",flexShrink:0}}/>
            <div style={{flex:1}}>
              <div className="skeleton" style={{height:"9px",width:"60px",borderRadius:"5px",marginBottom:"6px"}}/>
              <div className="skeleton" style={{height:"12px",width:`${110+i*18}px`,borderRadius:"6px",marginBottom:"5px"}}/>
              <div className="skeleton" style={{height:"9px",width:"80px",borderRadius:"5px"}}/>
            </div>
            <div className="skeleton" style={{width:"44px",height:"52px",borderRadius:"0.65rem",flexShrink:0}}/>
          </div>
          {/* Actions row */}
          <div style={{display:"flex",gap:"1.1rem",paddingBottom:"0.75rem"}}>
            <div className="skeleton" style={{height:"10px",width:"36px",borderRadius:"5px"}}/>
            <div className="skeleton" style={{height:"10px",width:"52px",borderRadius:"5px"}}/>
          </div>
          <div style={{height:"1px",background:T.border+"40",margin:"0 -1rem"}}/>
        </div>
      ))}
    </div>
  );
}

// Looks up friends who have a product in their routine from the friendScans map
function getFriendRoutineUsers(friendScans, productName, productId) {
  if (!friendScans || !productName) return [];
  const key = (productName||"").toLowerCase().trim();
  const byName = friendScans[key]||[];
  const byId = productId ? (friendScans[productId]||[]) : [];
  const merged = [...byName];
  byId.forEach(f => { if (!merged.find(m=>m.uid===f.uid)) merged.push(f); });
  return merged;
}

// Pill shown on any product card when friends have it in their routine
function FriendRoutinePill({friends}) {
  if (!friends.length) return null;
  const GENERIC_NAMES = new Set(["skincare lover","user","anonymous","undefined","null",""]);
  const firstName = (n) => {
    const first = (n||"").split(" ")[0];
    return GENERIC_NAMES.has(first.toLowerCase()) ? null : first;
  };
  const realName = firstName(friends[0].displayName);
  const label = friends.length === 1
    ? realName ? `${realName} has this` : "1 friend has this"
    : `${friends.length} friends have this`;
  return (
    <div style={{position:"absolute",bottom:"6px",left:"7px",display:"flex",alignItems:"center",gap:"4px",background:"rgba(17,24,39,0.62)",backdropFilter:"blur(4px)",borderRadius:"999px",padding:"3px 7px 3px 4px",pointerEvents:"none"}}>
      <div style={{display:"flex"}}>
        {friends.slice(0,3).map((f,fi)=>(
          <span key={f.uid} style={{width:"16px",height:"16px",borderRadius:"50%",overflow:"hidden",border:"1.5px solid rgba(255,255,255,0.7)",marginLeft:fi>0?"-5px":"0",flexShrink:0,background:T.accent,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
            {f.photoURL?<img src={f.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<span style={{fontSize:"7px",fontWeight:"700",color:"#fff"}}>{(f.displayName||"?")[0].toUpperCase()}</span>}
          </span>
        ))}
      </div>
      <span style={{fontSize:"0.52rem",fontWeight:"600",color:"#fff",whiteSpace:"nowrap"}}>{label}</span>
    </div>
  );
}

function communityColor(r) {
  if (r >= 8) return T.sage;
  if (r >= 5) return T.amber;
  return T.rose;
}

// ── Image URL validator — must point to a real image host, not just any URL ──
// Rejects placeholders, camera emojis, and non-image URLs.
// ── Image validation ──────────────────────────────────────────
// Tests if an image URL actually loads rather than checking URL format.
// Uses a cache to avoid re-testing the same URL repeatedly.
const _imgValidCache = {};
function hasValidImage(p) {
  const url = ((p.adminImage || p.image) || "").trim();
  if (!url || !url.startsWith("http")) return false;
  // Reject known non-image URLs
  if (url.includes("media-amazon.com")) return false;
  if (url.includes("amazon.com/s?k=")) return false;
  if (url.includes("amazon.com/dp/")) return false;
  // Allow known good image CDNs and domains
  const goodDomains = ["sephora.com","ulta.com","openbeautyfacts.org","clearstem.com","cdn.shopify","images.ctfassets","cloudinary","imgix","akamaized","fastly","squarespace","wixstatic","theordinary.com","cerave.com","neutrogena.com","laroche-posay","skinstore.com","dermstore.com"];
  if (goodDomains.some(d => url.includes(d))) return true;
  // For other domains, require a proper image file extension
  if (/\.(jpg|jpeg|png|webp|avif|gif)(\?|$)/i.test(url)) return true;
  return false;
}
// For admin display, use actual image load test
function AdminImageStatus({ p }) {
  const url = ((p.adminImage || p.image) || "").trim();
  const [status, setStatus] = React.useState(
    !url || url.includes("media-amazon.com") ? "broken" : "loading"
  );
  React.useEffect(() => {
    if (status !== "loading" || !url) return;
    let done = false;
    const img = new Image();
    img.onload = () => { if (!done) { done=true; setStatus("ok"); }};
    img.onerror = () => { if (!done) { done=true; setStatus("broken"); }};
    img.src = url;
    // 8 second hard timeout — if it hasn't loaded, it's broken
    const t = setTimeout(() => { if (!done) { done=true; setStatus("broken"); }}, 8000);
    return () => { done=true; clearTimeout(t); };
  }, [url]);
  if (status === "broken") return <span style={{color:T.rose}}>no img</span>;
  if (status === "ok") return <span style={{color:T.sage}}>✓ img</span>;
  return <span style={{color:T.textLight, fontSize:"0.6rem"}}>…</span>;
}
// ASINs now live in Firestore (asin field). If the product doc has a buyUrl
// or asin already set, those take priority. Falls back to Amazon search.
// ── Amazon affiliate tag — replace YOUR_TAG with your actual Associates tag ──
const AMAZON_AFFILIATE_TAG = ""; // e.g. "ralliapp-20"

function amazonUrl(productName, brand, barcode, asin, existingBuyUrl) {
  const tag = AMAZON_AFFILIATE_TAG ? `&tag=${AMAZON_AFFILIATE_TAG}` : "";
  if (existingBuyUrl && existingBuyUrl.startsWith("http")) {
    // Inject affiliate tag into existing Amazon URLs
    if (AMAZON_AFFILIATE_TAG && existingBuyUrl.includes("amazon.com")) {
      const sep = existingBuyUrl.includes("?") ? "&" : "?";
      return existingBuyUrl.includes("tag=") ? existingBuyUrl : `${existingBuyUrl}${sep}tag=${AMAZON_AFFILIATE_TAG}`;
    }
    return existingBuyUrl;
  }
  if (asin) return `https://www.amazon.com/dp/${asin}?tag=${AMAZON_AFFILIATE_TAG||""}`;
  const name = (productName||"").trim();
  const br = (brand||"").trim();
  const q = encodeURIComponent(br ? `${br} ${name}` : name);
  return `https://www.amazon.com/s?k=${q}&i=beauty${tag}`;
}


function shareProduct(productName, brand) {
  const text = `Check out ${brand ? brand+" " : ""}${productName} on Ralli`;
  const url  = window.location.href;
  if (navigator.share) {
    navigator.share({title:"Ralli by GoodSisters", text, url}).catch(()=>{});
  } else {
    navigator.clipboard.writeText(`${text} — ${url}`).then(()=>{
      const toast = document.createElement("div");
      toast.className = "share-toast";
      toast.textContent = "Link copied!";
      document.body.appendChild(toast);
      setTimeout(()=>toast.remove(), 2200);
    }).catch(()=>{});
  }
}

function analyzeIngredients(text) {
  const lower = text.toLowerCase();
  const found = [];
  const seen = new Set();       // canonical names already added
  const seenText = new Set();   // matched strings already claimed by another entry

  for (const [name, data] of Object.entries(INGDB)) {
    const allNames = [name, ...(data.aliases||[])];
    const matched = allNames.find(n => n && lower.includes(n.toLowerCase()));
    if (!matched) continue;
    const matchedLower = matched.toLowerCase();
    // Skip if this canonical name already added, or if the matched text was already claimed
    if (seen.has(name) || seenText.has(matchedLower)) continue;
    seen.add(name);
    // Claim all alias texts for this entry so they can't match again
    allNames.forEach(n => n && seenText.add(n.toLowerCase()));
    const display = matchedLower === name.toLowerCase() ? name : `${name} (${matched})`;
    found.push({name:display, ...data});
  }
  // Flagged = pore-clogging score >= 1 OR irritant
  const flagged = found.filter(i => i.score >= 1 || i.irritant);
  const poreCloggers = flagged.filter(i => i.score >= 1);
  const irritants = flagged.filter(i => i.irritant && i.score < 1);
  // Pore clog score: 70% max + 30% average, tiny count penalty for truly problematic lists
  const avgScore = (() => {
    if (!poreCloggers.length) return found.length > 0 ? 0 : null;
    const max = Math.max(...poreCloggers.map(i => i.score));
    const avg = poreCloggers.reduce((s,i)=>s+i.score,0) / poreCloggers.length;
    const countPenalty = Math.min(Math.max(poreCloggers.length - 3, 0), 3) * 0.1;
    const raw = (max * 0.7) + (avg * 0.3) + countPenalty;
    return Math.round(Math.min(raw, 5) * 10) / 10;
  })();
  return {found, flagged, poreCloggers, irritants, avgScore};
}

function initials(name="") {
  return name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "?";
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - (ts.seconds ? ts.seconds*1000 : new Date(ts).getTime());
  const m = Math.floor(diff/60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

// ── Firebase helpers ──────────────────────────────────────────
// ── Firestore image cache — saves found images for all users forever ──
async function getCachedImage(key) {
  try {
    const snap = await getDoc(doc(db, "productImages", key));
    return snap.exists() ? snap.data().url : null;
  } catch { return null; }
}
async function setCachedImage(key, url) {
  try { await setDoc(doc(db, "productImages", key), { url, updatedAt: serverTimestamp() }); } catch {}
}
function imgCacheKey(brand, name) {
  return `${(brand||"").toLowerCase().replace(/\s+/g,"_")}|${(name||"").toLowerCase().replace(/\s+/g,"_")}`.slice(0,200);
}

// ── Multi-source product image resolver ──────────────────────
// Tries: Firestore cache → Sephora API → Ulta API → OBF → null
async function resolveProductImage(brand, name, barcode) {
  const key = imgCacheKey(brand, name);

  // 1. Firestore permanent cache — instant for repeat lookups
  const cached = await getCachedImage(key);
  if (cached) return cached;

  const q = `${brand||""} ${name||""}`.trim();

  // 2. Sephora — via Cloudflare Worker
  try {
    const workerUrl = `https://raspy-math-6c02ralli-image-proxy.mckenzierichard77.workers.dev?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand||"")}`;
    const r = await fetch(workerUrl, {signal:AbortSignal.timeout(8000)});
    const d = await r.json();
    if (d?.url && d.source === "sephora") { await setCachedImage(key, d.url); return d.url; }
  } catch {}

  // 3. ULTA — via Cloudflare Worker
  try {
    const workerUrl = `https://raspy-math-6c02ralli-image-proxy.mckenzierichard77.workers.dev?q=${encodeURIComponent(q)}&brand=${encodeURIComponent(brand||"")}`;
    const r = await fetch(workerUrl, {signal:AbortSignal.timeout(8000)});
    const d = await r.json();
    if (d?.url && d.source === "ulta") { await setCachedImage(key, d.url); return d.url; }
  } catch {}

  // 4. Open Beauty Facts — reliable for barcoded products, no CORS issues
  if (barcode && !/^seed_/.test(barcode)) {
    try {
      const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`, { signal: AbortSignal.timeout(5000) });
      const d = await r.json();
      const img = d?.product?.image_front_url || d?.product?.image_url || null;
      if (img) { await setCachedImage(key, img); return img; }
    } catch {}
    // OBF CDN direct — try revision numbers without an API call
    const b = barcode.replace(/\D/g,"");
    const path = b.length === 13 ? `${b.slice(0,3)}/${b.slice(3,6)}/${b.slice(6,9)}/${b.slice(9)}` : b;
    for (const rev of ["3","2","1"]) {
      const candidate = `https://images.openbeautyfacts.org/images/products/${path}/front_en.${rev}.full.jpg`;
      try {
        const probe = await fetch(candidate, { method: "HEAD", signal: AbortSignal.timeout(3000) });
        if (probe.ok) { await setCachedImage(key, candidate); return candidate; }
      } catch {}
    }
  }

  return null;
}

// In-memory product cache so searches after the first are instant
let _productCache = null;
async function getProductCache() {
  if (_productCache) return _productCache;
  const snap = await getDocs(collection(db,"products"));
  _productCache = snap.docs.map(d=>({id:d.id,...d.data()}));
  // Expire cache after 5 minutes
  setTimeout(()=>{ _productCache = null; }, 5*60*1000);
  return _productCache;
}

// ── Track outbound buy clicks ──────────────────────────────────
async function trackProductClick(productId, productName) {
  if (!productId && !productName) return;
  try {
    if (productId) {
      await updateDoc(doc(db,"products",productId), {
        clickCount: increment(1),
        lastClickedAt: Date.now(),
      });
    } else {
      // No Firestore id yet — write to a lightweight clicks collection
      const key = productName.toLowerCase().trim();
      const ref = doc(db,"productClicks", key);
      await setDoc(ref, {
        productName,
        clickCount: increment(1),
        lastClickedAt: Date.now(),
      }, {merge: true});
    }
  } catch {}
}

// ── Live product search: Firestore cache first, then OBF ──────
async function searchProducts(searchTerm) {
  const q = searchTerm.toLowerCase().trim();
  if (!q) return [];
  const seen = new Set();
  const results = [];

  // 1. Search Firestore cache first (instant)
  try {
    const allCached = await getProductCache();
    allCached.forEach(p => {
      const nameMatch = (p.productName||"").toLowerCase().includes(q);
      const brandMatch = (p.brand||"").toLowerCase().includes(q);
      if (nameMatch || brandMatch) {
        const key = `${p.brand||""} ${p.productName||""}`.toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            code: p.barcode||p.id,
            name: p.productName,
            brand: p.brand||"",
            image: p.adminImage||p.image||"",
            ingredients: p.ingredients||"",
            poreScore: p.poreScore??null,
            communityRating: p.communityRating||null,
            scanCount: p.scanCount||0,
            buyUrl: p.buyUrl||"",
            source: p.source||"cache",
            _productId: p.id,
            _cached: true,
            _approved: !!p.approved,
          });
        }
      }
    });
  } catch {}

  // 2. Query OBF live in parallel
  try {
    const r = await fetch(
      `https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(searchTerm)}&search_simple=1&action=process&json=1&page_size=20&fields=product_name,brands,ingredients_text,ingredients_text_en,code,image_front_small_url`,
      {signal: AbortSignal.timeout(6000)}
    );
    const d = await r.json();
    const newToCache = [];
    (d.products||[]).filter(p=>p.product_name&&(p.brands||p.product_name)).forEach(p=>{
      const brand = p.brands?.split(",")[0]?.trim()||"";
      const key = `${brand} ${p.product_name}`.toLowerCase().trim();
      const ingredients = p.ingredients_text_en||p.ingredients_text||"";
      // Calculate pore clog score on the fly
      let poreScore = null;
      try {
        const analysis = analyzeIngredients(ingredients);
        if (analysis?.avgScore != null) poreScore = Math.round(analysis.avgScore);
      } catch {}

      if (!seen.has(key)) {
        seen.add(key);
        const result = {
          code: p.code,
          name: p.product_name,
          brand,
          image: "",           // no OBF image — admin will add
          obfImage: p.image_front_small_url||"",  // stored but not shown by default
          ingredients,
          poreScore,
          source: "obf",
          _cached: false,
        };
        results.push(result);
        // Queue for caching
        newToCache.push({
          productName: p.product_name,
          brand,
          barcode: p.code||"",
          image: "",
          obfImage: p.image_front_small_url||"",
          ingredients,
          poreScore: poreScore??0,
          buyUrl: `https://www.amazon.com/s?k=${encodeURIComponent(brand+" "+p.product_name)}`,
          approved: false,
          hidden: false,
          source: "user-scan",
          isRequest: true,
          scanCount: 0,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    });

    // Auto-cache new OBF results to Firestore (background, don't await)
    if (newToCache.length > 0) {
      (async () => {
        try {
          const existing = await getProductCache();
          const existingBarcodes = new Set(existing.map(p=>p.barcode).filter(Boolean));
          const existingKeys = new Set(existing.map(p=>`${p.brand||""} ${p.productName||""}`.toLowerCase().trim()));
          for (const p of newToCache) {
            const k = `${p.brand||""} ${p.productName||""}`.toLowerCase().trim();
            if (!existingBarcodes.has(p.barcode) && !existingKeys.has(k)) {
              await addDoc(collection(db,"products"), p);
            }
          }
          // Bust cache so next search sees new products
          _productCache = null;
        } catch(e) { console.error("cache error", e); }
      })();
    }
  } catch(e) { console.error("OBF search error", e); }

  const qt = searchTerm.toLowerCase().trim();
  return results
    .sort((a, b) => {
      // Tier: 0=approved+image, 1=approved, 2=pending DB, 3=OBF
      const tierA = a._cached && a._approved ? (a.image ? 0 : 1) : a._cached ? 2 : 3;
      const tierB = b._cached && b._approved ? (b.image ? 0 : 1) : b._cached ? 2 : 3;
      if (tierA !== tierB) return tierA - tierB;
      // Within tier: exact name match first
      const aExact = (a.name||"").toLowerCase().startsWith(qt) ? 0 : 1;
      const bExact = (b.name||"").toLowerCase().startsWith(qt) ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      // Then by scan/rating activity (most popular first)
      const aActivity = (a.scanCount||0) + (a.communityRating ? 10 : 0);
      const bActivity = (b.scanCount||0) + (b.communityRating ? 10 : 0);
      return bActivity - aActivity;
    })
    .slice(0, 30);
}

// Keep for backward compat
async function searchProductsExternal(searchTerm, existingKeys=new Set()) {
  return [];
}

// ── Account deletion ─────────────────────────────────────────
async function deleteUserAccount(user) {
  const uid = user.uid;
  try {
    // Delete all user's posts
    const postsSnap = await getDocs(query(collection(db,"posts"), where("uid","==",uid)));
    const batch1 = writeBatch(db);
    postsSnap.docs.forEach(d => batch1.delete(d.ref));
    await batch1.commit();
    // Delete all user's scans
    const scansSnap = await getDocs(query(collection(db,"scans"), where("uid","==",uid)));
    const batch2 = writeBatch(db);
    scansSnap.docs.forEach(d => batch2.delete(d.ref));
    await batch2.commit();
    // Delete notifications
    const notifsTo = await getDocs(query(collection(db,"notifications"), where("toUid","==",uid)));
    const notifsFrom = await getDocs(query(collection(db,"notifications"), where("fromUid","==",uid)));
    const batch3 = writeBatch(db);
    [...notifsTo.docs, ...notifsFrom.docs].forEach(d => batch3.delete(d.ref));
    await batch3.commit();
    // Delete user profile doc
    await deleteDoc(doc(db,"users",uid));
    // Delete Firebase Auth account
    await user.delete();
    return { success: true };
  } catch(e) {
    if (e.code === "auth/requires-recent-login") {
      return { success: false, needsReauth: true };
    }
    return { success: false, error: e.message };
  }
}

// ── Notification helpers ──────────────────────────────────────
async function addNotification(toUid, fromUid, fromName, fromPhoto, type, payload={}) {
  try {
    await addDoc(collection(db,"notifications"), {
      toUid, fromUid, fromName, fromPhoto,
      type, payload,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch(e) { console.error("notif error",e); }
}
async function getNotifications(uid) {
  try {
    const q = query(collection(db,"notifications"), where("toUid","==",uid), orderBy("createdAt","desc"), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch { return []; }
}
async function markAllRead(uid) {
  try {
    const q = query(collection(db,"notifications"), where("toUid","==",uid), where("read","==",false));
    const snap = await getDocs(q);
    await Promise.all(snap.docs.map(d=>updateDoc(d.ref,{read:true})));
  } catch {}
}
async function getTrendingProducts(limitN=10) {
  try {
    const q = query(collection(db,"posts"), orderBy("createdAt","desc"), limit(100));
    const snap = await getDocs(q);
    const map = {};
    snap.docs.forEach(d=>{
      const p = d.data();
      const key = (p.productName||"").toLowerCase().trim();
      if (!key) return;
      if (!map[key]) map[key] = {...p, id:d.id, scanCount:0, totalRating:0, ratingCount:0};
      map[key].scanCount++;
      if (p.communityRating) { map[key].totalRating+=p.communityRating; map[key].ratingCount++; }
    });
    return Object.values(map)
      .sort((a,b)=>b.scanCount-a.scanCount)
      .slice(0,limitN)
      .map(p=>({...p, avgCommunity: p.ratingCount>0 ? Math.round(p.totalRating/p.ratingCount) : null}));
  } catch { return []; }
}


async function getOrCreateProfile(user) {
  try {
    const ref  = doc(db,"users",user.uid);
    const snap = await getDoc(ref);
    if (snap.exists()) return snap.data();
    const profile = {
      uid:user.uid, displayName:user.displayName||user.email?.split("@")[0]||"",
      email:user.email, photoURL:user.photoURL||"",
      skinType:[], bio:"", createdAt:serverTimestamp(),
      following:[], followers:[], productHistory:[],
      isNew: true,
    };
    await setDoc(ref,profile);
    return profile;
  } catch {
    return {
      uid:user.uid, displayName:user.displayName||user.email?.split("@")[0]||"",
      email:user.email, photoURL:"", skinType:[], bio:"",
      following:[], followers:[], productHistory:[],
      isNew: true,
    };
  }
}

// ── Product catalog (single source of truth) ─────────────────
// Each product lives at products/{barcode} or products/{generated-id}
// Scans reference productId. No more string matching.

async function getProductByBarcode(barcode) {
  if (!barcode) return null;
  try {
    const snap = await getDoc(doc(db,"products",barcode));
    if (snap.exists()) return {id:snap.id,...snap.data()};
    return null;
  } catch { return null; }
}

async function upsertProduct(barcode, data) {
  // barcode is the document ID — guaranteed unique key
  const id = barcode || `manual_${Date.now()}`;
  const ref = doc(db,"products",id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    // Update mutable fields only — don't overwrite admin edits
    const updates = {};
    if (data.productName && !snap.data().productName) updates.productName = data.productName;
    if (data.brand && !snap.data().brand) updates.brand = data.brand;
    if (data.ingredients) updates.ingredients = data.ingredients;
    if (data.image && !snap.data().image) updates.image = data.image;
    if (Object.keys(updates).length) await updateDoc(ref, updates);
    return {id, ...snap.data(), ...updates};
  } else {
    const newProduct = {
      barcode: id,
      productName: data.productName || "",
      brand: data.brand || "",
      category: guessCategory(data.productName || ""),
      poreScore: data.poreScore ?? 0,
      ingredients: data.ingredients || "",
      image: data.image || "",
      buyUrl: data.buyUrl || "",
      approved: false,
      scanCount: 0,
      uniqueScanners: [],
      communityRating: null,
      source: data.source || "scan",
      createdAt: serverTimestamp(),
    };
    await setDoc(ref, newProduct);
    return {id, ...newProduct};
  }
}

async function recordScan(uid, displayName, photoURL, productId, productName, brand, poreScore, ingredients, found, communityRating, postType="scan") {
  try {
    // 1. Write scan event to posts (feed)
    // Try to get product image for the post card
    let productImage = "";
    try {
      const prodSnap = await getDoc(doc(db,"products",productId));
      if (prodSnap.exists()) productImage = prodSnap.data().adminImage || prodSnap.data().image || "";
    } catch(e) {}

    const postRef = await addDoc(collection(db,"posts"), {
      uid, displayName, photoURL: photoURL||"",
      productId,
      productName, brand: brand||"",
      poreScore,
      productImage,
      communityRating: communityRating||null,
      ingredients: ingredients.slice(0,500),
      flaggedIngredients: found.filter(i=>i.score>=1||i.irritant).sort((a,b)=>b.score-a.score).slice(0,6).map(i=>i.name),
      postType: postType||"scan",
      createdAt: serverTimestamp(),
      likes: [],
      comments: [],
    });

    // 2. Write to scans sub-collection for analytics
    await addDoc(collection(db,"scans"), {
      uid, productId, productName, brand: brand||"",
      poreScore, createdAt: serverTimestamp(),
    });

    // 3. Atomically increment scanCount and add uid to uniqueScanners
    // Wrapped separately — permission-denied here (non-admin users can't write products)
    // should not surface as an error since the post + scan already succeeded
    try {
      const productRef = doc(db,"products",productId);
      await updateDoc(productRef, {
        scanCount: increment(1),
        uniqueScanners: arrayUnion(uid),
      });
    } catch(e) {
      // Silently ignore — user may not have write access to products collection
    }

    return postRef.id;
  } catch(e) { console.error("recordScan error:", e); }
}

// Legacy alias — keep callers working during transition
async function postScan(uid, displayName, photoURL, productName, brand, poreScore, communityRating, ingredients, found, postType="search") {
  // Generate a stable ID from brand+name for products without barcodes
  const stableId = "manual_" + (brand||"").toLowerCase().replace(/\s+/g,"_") + "_" + productName.toLowerCase().replace(/\s+/g,"_");
  await upsertProduct(stableId, {productName, brand, poreScore, ingredients, source:"scan"});
  return recordScan(uid, displayName, photoURL, stableId, productName, brand, poreScore, ingredients, found, communityRating);
}

async function getFeed(followingIds, currentUid) {
  try {
    const ids = [...(followingIds||[]), currentUid].slice(0,10);
    if (!ids.length) return [];
    const q = query(collection(db,"posts"), where("uid","in",ids), orderBy("createdAt","desc"), limit(20));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch { return []; }
}

async function getGlobalFeed() {
  try {
    const q = query(collection(db,"posts"), orderBy("createdAt","desc"), limit(30));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch { return []; }
}

async function toggleLike(postId, uid) {
  try {
    const ref = doc(db,"posts",postId);
    const snap = await getDoc(ref);
    const likes = snap.data()?.likes||[];
    if (likes.includes(uid)) await updateDoc(ref,{likes:arrayRemove(uid)});
    else await updateDoc(ref,{likes:arrayUnion(uid)});
  } catch {}
}

async function followUser(myUid, theirUid) {
  try {
    await updateDoc(doc(db,"users",myUid),{following:arrayUnion(theirUid)});
    await updateDoc(doc(db,"users",theirUid),{followers:arrayUnion(myUid)});
  } catch {}
}

async function unfollowUser(myUid, theirUid) {
  try {
    await updateDoc(doc(db,"users",myUid),{following:arrayRemove(theirUid)});
    await updateDoc(doc(db,"users",theirUid),{followers:arrayRemove(myUid)});
  } catch {}
}

async function searchUsers(q) {
  try {
    const snap = await getDocs(collection(db,"users"));
    return snap.docs.map(d=>d.data()).filter(u=>
      u.displayName?.toLowerCase().includes(q.toLowerCase()) ||
      u.email?.toLowerCase().includes(q.toLowerCase())
    ).slice(0,10);
  } catch { return []; }
}

async function getUserPosts(uid) {
  try {
    const q = query(collection(db,"posts"),where("uid","==",uid),orderBy("createdAt","desc"),limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d=>({id:d.id,...d.data()}));
  } catch { return []; }
}

// ── Barcode lookup — tries multiple sources ───────────────────
async function lookupBarcode(barcode) {
  // Source 1: Open Beauty Facts
  try {
    const res = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`, {signal: AbortSignal.timeout(6000)});
    const data = await res.json();
    if (data.status === 1 && data.product?.product_name) {
      const ing = data.product?.ingredients_text_en || data.product?.ingredients_text || "";
      const name = data.product.product_name;
      const brand = data.product?.brands?.split(",")?.[0]?.trim() || "";
      const image = data.product?.image_front_url || data.product?.image_url || "";
      if (image) setCachedImage(imgCacheKey(brand, name), image);
      debugLog("ok", `OBF found: ${name}`);
      return { name, brand, ingredients: ing, image, hasIngredients: ing.trim().length > 10, source: "obf" };
    }
  } catch(e) { debugLog("warn", `OBF failed: ${e.message}`); }

  // Source 2: UPC Item DB (good US coverage)
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`, {signal: AbortSignal.timeout(6000)});
    const data = await res.json();
    const item = data.items?.[0];
    if (item?.title) {
      const name = item.title;
      const brand = item.brand || "";
      const image = item.images?.[0] || "";
      debugLog("ok", `UPCItemDB found: ${name}`);
      return { name, brand, ingredients: "", image, hasIngredients: false, source: "upcitemdb" };
    }
  } catch(e) { debugLog("warn", `UPCItemDB failed: ${e.message}`); }

  // Source 3: Buycott / Go-UPC (free tier)
  try {
    const res = await fetch(`https://go-upc.com/api/v1/code/${barcode}?key=free`, {signal: AbortSignal.timeout(5000)});
    const data = await res.json();
    if (data.product?.name) {
      const name = data.product.name;
      const brand = data.product.brand || "";
      const image = data.product.imageUrl || "";
      debugLog("ok", `Go-UPC found: ${name}`);
      return { name, brand, ingredients: "", image, hasIngredients: false, source: "goupc" };
    }
  } catch(e) { debugLog("warn", `Go-UPC failed: ${e.message}`); }

  // All sources failed
  throw new Error("Product not found. Try photographing the ingredient list on the back of the packaging, or search by product name.");
}

async function extractFromPhoto(b64, mime, mode="auto") {
  if (!ANTHROPIC_KEY) throw new Error("No API key — photo scanning requires VITE_ANTHROPIC_KEY to be set in Vercel.");
  const prompts = {
    product: "You are identifying a skincare product from a photo of its packaging (front of bottle, tube, or box).\nIdentify the brand and product name and respond in ONLY this format:\nPRODUCT:\nNAME:<exact product name>\nBRAND:<exact brand name>\n\nIf you cannot identify the product clearly, respond: UNCLEAR\nNo explanations. No markdown. Just the format above.",
    ingredients: "You are reading a skincare ingredient list from a photo of product packaging.\nExtract every ingredient exactly as written and respond in ONLY this format:\nINGREDIENTS:<comma-separated INCI ingredient names exactly as written>\n\nIf you cannot read the ingredient list clearly, respond: UNCLEAR\nNo explanations. No markdown. Just the format above.",
    auto: "You are analysing a skincare product image. Look carefully and respond with ONLY one of these formats:\n1. If you see an ingredient list: INGREDIENTS:<comma-separated INCI ingredient names exactly as written>\n2. If you see the front of a product: PRODUCT:\nNAME:<product name>\nBRAND:<brand name>\n3. If you see both: NAME:<product name>\nBRAND:<brand name>\nINGREDIENTS:<comma-separated ingredients>\n4. If unclear: UNCLEAR\nNo explanations. No markdown. Just the format above."
  };
  const res = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST", headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({
      model:"claude-haiku-4-5-20251001", max_tokens:1200,
      messages:[{role:"user",content:[
        {type:"image",source:{type:"base64",media_type:mime,data:b64}},
        {type:"text",text:prompts[mode]||prompts.auto}
      ]}]
    })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "AI could not process the image.");
  const text = data.content?.map(b=>b.text||"").join("").trim();
  if (!text || text === "UNCLEAR") throw new Error("Image is unclear — try better lighting, move closer, or ensure the ingredient list is in focus.");
  return text;
}

// ── BarcodeScanner ────────────────────────────────────────────
function BarcodeScanner({onDetected, onError}) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("loading");
  useEffect(()=>{
    let reader=null,stopped=false;
    const s=document.createElement("script");
    s.src="https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js";
    s.onload=async()=>{
      if(stopped) return;
      try {
        reader=new window.ZXing.BrowserMultiFormatReader();
        const devices=await reader.listVideoInputDevices();
        if(!devices.length) throw new Error("No camera found");
        const cam=devices.find(d=>/back|rear/i.test(d.label))||devices[devices.length-1];
        setStatus("scanning");
        await reader.decodeFromVideoDevice(cam.deviceId,videoRef.current,(result)=>{
          if(stopped||!result) return;
          stopped=true; reader.reset(); onDetected(result.getText());
        });
      } catch(e){if(!stopped){setStatus("error");onError(e.message);}}
    };
    s.onerror=()=>onError("Failed to load scanner");
    document.head.appendChild(s);
    return()=>{stopped=true;if(reader)reader.reset();if(s.parentNode)s.parentNode.removeChild(s);};
  },[]);
  return (
    <div style={{position:"relative",borderRadius:"1rem",overflow:"hidden",background:"#000"}}>
      <video ref={videoRef} style={{width:"100%",display:"block",maxHeight:"260px",objectFit:"cover"}}/>
      {status==="scanning"&&(
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"0.75rem"}}>
          <div style={{width:"200px",height:"100px",position:"relative"}}>
            {[{top:0,left:0,borderTop:`3px solid ${T.accent}`,borderLeft:`3px solid ${T.accent}`},{top:0,right:0,borderTop:`3px solid ${T.accent}`,borderRight:`3px solid ${T.accent}`},{bottom:0,left:0,borderBottom:`3px solid ${T.accent}`,borderLeft:`3px solid ${T.accent}`},{bottom:0,right:0,borderBottom:`3px solid ${T.accent}`,borderRight:`3px solid ${T.accent}`}].map((st,i)=>(
              <div key={i} style={{position:"absolute",width:"20px",height:"20px",...st}}/>
            ))}
            <div style={{position:"absolute",left:"4px",right:"4px",height:"2px",background:T.accent,animation:"scanline 1.5s ease-in-out infinite",top:"50%"}}/>
          </div>
          <span style={{color:"white",fontSize:"0.8rem",background:"rgba(0,0,0,0.5)",padding:"4px 12px",borderRadius:"999px"}}>Point at barcode</span>
        </div>
      )}
      {status==="loading"&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",color:"white"}}>Starting camera…</div>}
    </div>
  );
}

// ── PlaceholderCard — styled fallback when no image ─────────
function PlaceholderCard({name, brand}) {
  const words = ((brand||name||"?").trim()).split(" ").filter(Boolean);
  const initials = words.length >= 2
    ? words[0][0].toUpperCase() + words[1][0].toUpperCase()
    : (words[0]||"?").slice(0,2).toUpperCase();
  // Pick a soft color based on first char
  const colors = [
    {bg:"#E8F0E8",fg:"#5A7A54"}, {bg:"#EAE4DC",fg:"#7C6E58"},
    {bg:"#EDE8F0",fg:"#7A6490"}, {bg:"#F0E8E8",fg:"#8A5A5A"},
    {bg:"#E8EDF0",fg:"#4A7080"}, {bg:"#F0EDE4",fg:"#7A6A40"},
  ];
  const c = colors[(initials.charCodeAt(0)||0) % colors.length];
  return (
    <div style={{width:"100%",height:"100%",background:c.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.3rem",padding:"0.5rem"}}>
      <div style={{fontSize:"1.3rem",fontWeight:"800",color:c.fg,fontFamily:"'Inter',sans-serif",lineHeight:1,letterSpacing:"-0.02em"}}>{initials}</div>
      <div style={{fontSize:"0.46rem",fontWeight:"600",color:c.fg,opacity:0.65,textTransform:"uppercase",letterSpacing:"0.05em",textAlign:"center",maxWidth:"72px",lineHeight:1.3,overflow:"hidden"}}>
        {(name||"").length>20?(name||"").slice(0,18)+"…":(name||"")}
      </div>
    </div>
  );
}

// ── ProductImage ─────────────────────────────────────────────
// In-memory image cache (session-level, fast)
const IMG_CACHE = new Map();

function ProductImage({src, name, brand, barcode, size="full"}) {
  const [imgSrc, setImgSrc]   = useState(null);
  const [failed, setFailed]   = useState(false);
  const [attempt, setAttempt] = useState(0);
  const OBF_REVS = ["3","2","1","4","5"];

  useEffect(()=>{
    setFailed(false); setAttempt(0);
    const cacheKey = `${barcode||""}|${brand||""}|${name||""}`.toLowerCase();
    // 1. Session cache
    if (IMG_CACHE.has(cacheKey)) { setImgSrc(IMG_CACHE.get(cacheKey)); return; }
    // 2. Firestore-stored src (admin-set or user-scanned)
    if (src) { IMG_CACHE.set(cacheKey, src); setImgSrc(src); return; }
    // 3. Static map (curated products)
    // Image resolved from Firestore adminImage field
    // 4. Async resolve: Firestore cache → Sephora → Ulta → OBF
    if (name) {
      resolveProductImage(brand, name, barcode).then(img => {
        if (img) { IMG_CACHE.set(cacheKey, img); setImgSrc(img); }
        else setImgSrc(null);
      });
    } else {
      setImgSrc(null);
    }
  },[src, barcode, name, brand]);

  function handleError() {
    const nextAttempt = attempt + 1;
    if (barcode && nextAttempt < OBF_REVS.length) {
      setAttempt(nextAttempt);
      const b = barcode.replace(/\D/g,"");
      const path = b.length === 13
        ? `${b.slice(0,3)}/${b.slice(3,6)}/${b.slice(6,9)}/${b.slice(9)}`
        : b;
      setImgSrc(`https://images.openbeautyfacts.org/images/products/${path}/front_en.${OBF_REVS[nextAttempt]}.full.jpg`);
    } else {
      setFailed(true);
    }
  }

  const dim = size==="full" ? {width:"100%",height:"100%"} : {width:size,height:size};
  if (!imgSrc || failed) return <div style={{...dim,borderRadius:"inherit",overflow:"hidden",flexShrink:0}}><PlaceholderCard name={name} brand={brand}/></div>;
  return <img src={imgSrc} alt={name||""} style={{...dim,objectFit:"contain",padding:"8px",background:"#ffffff",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={handleError}/>;
}

// ── Avatar ────────────────────────────────────────────────────
function Avatar({photoURL, name, size=36}) {
  if (!photoURL) return (
    <div style={{width:size,height:size,borderRadius:"50%",background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:"700",color:T.accent,fontFamily:"'Inter',sans-serif",flexShrink:0}}>{initials(name)}</div>
  );
  return (
    <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:T.surfaceAlt}}>
      <img src={photoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
    </div>
  );
}

// ── CardReveal ─────────────────────────────────────────────
function CardReveal({children, delay=0}) {
  const ref = React.useRef(null);
  React.useEffect(()=>{
    const el = ref.current; if(!el) return;
    const obs = new IntersectionObserver(([e])=>{
      if(e.isIntersecting){ el.classList.remove("card-hidden"); el.classList.add("card-visible"); obs.disconnect(); }
    },{threshold:0.08});
    obs.observe(el);
    return ()=>obs.disconnect();
  },[]);
  return <div ref={ref} className="card-hidden" style={{transitionDelay:`${delay}ms`}}>{children}</div>;
}


// ── PostCard ──────────────────────────────────────────────────

// ── ShareProductModal — pick a follower to send a product to ──
function ShareProductModal({ user, product, onClose }) {
  const [following, setFollowing] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(null);
  const [searchQ, setSearchQ] = useState("");

  useEffect(() => {
    async function load() {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      const followingIds = snap?.data()?.following || [];
      // Load following users
      if (followingIds.length) {
        const chunks = [];
        for (let i = 0; i < followingIds.length; i += 10) chunks.push(followingIds.slice(i, i+10));
        const users = [];
        for (const chunk of chunks) {
          const q = query(collection(db, "users"), where("__name__", "in", chunk));
          const s = await getDocs(q).catch(() => null);
          if (s) s.docs.forEach(d => users.push({ uid: d.id, ...d.data() }));
        }
        setFollowing(users);
      }
      // Also load some recent users as fallback if following list is small
      if (followingIds.length < 3) {
        const fallback = await getDocs(query(collection(db, "users"), limit(15))).catch(() => null);
        if (fallback) {
          const extra = fallback.docs.map(d=>({uid:d.id,...d.data()}))
            .filter(u => u.uid !== user.uid && !followingIds.includes(u.uid));
          setFollowing(prev => {
            const seen = new Set(prev.map(u=>u.uid));
            return [...prev, ...extra.filter(u=>!seen.has(u.uid))];
          });
        }
      }
      setLoading(false);
    }
    load();
  }, [user.uid]);

  // Live search Firestore when user types
  useEffect(() => {
    if (!searchQ.trim()) return;
    const q = query(collection(db, "users"),
      where("displayName", ">=", searchQ),
      where("displayName", "<=", searchQ + ""),
      limit(10)
    );
    getDocs(q).then(snap => {
      const results = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid);
      setSearchResults(results);
    }).catch(() => {});
  }, [searchQ]);

  async function shareToUser(toUser) {
    if (!user?.uid) { alert("Please sign in to share products"); return; }
    if (!toUser?.uid) { alert("Could not find that user — please try again"); return; }
    try {
      let productName = product.productName || product.name || "Product";
      let brand = product.brand || "";
      let productImage = product.productImage || product.image || "";
      let poreScore = null;
      let hasScore = false;

      // First try: use ingredients already on the post/product object
      const postIng = product.ingredients || "";
      if (postIng.trim().length > 10) {
        const r = analyzeIngredients(postIng);
        if (r.avgScore != null) { poreScore = Math.round(r.avgScore); hasScore = true; }
      }

      // Second try: look up from Firestore products collection
      if (!hasScore) {
        try {
          const q = query(collection(db, "products"), where("productName", "==", productName), limit(1));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const p = snap.docs[0].data();
            brand = p.brand || brand;
            productImage = p.adminImage || p.image || productImage;
            const ing = p.ingredients || "";
            if (ing.trim().length > 10) {
              const r = analyzeIngredients(ing);
              if (r.avgScore != null) { poreScore = Math.round(r.avgScore); hasScore = true; }
            }
          }
        } catch { /* use what we have */ }
      }

      await sendMessage(user.uid, toUser.uid, {
        type: "product",
        productName,
        brand,
        productImage,
        poreScore,
        hasScore,
      });
      setSent(toUser.displayName?.split(" ")[0] || "them");
      setTimeout(onClose, 1400);
    } catch(e) {
      console.error("share failed", e);
      alert("Failed to send: " + (e?.message || "unknown error"));
    }
  }

  const displayList = searchQ.trim() ? searchResults : following;
  const filtered = displayList.filter(u =>
    !searchQ.trim() || u.displayName?.toLowerCase().includes(searchQ.toLowerCase())
  );

  return ReactDOM.createPortal(
    <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0, zIndex:9000, background:"rgba(0,0,0,0.45)", display:"flex", flexDirection:"column", justifyContent:"flex-end", alignItems:"center" }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:"480px", background:T.surface, borderRadius:"1.25rem 1.25rem 0 0", padding:"1rem 1rem calc(1rem + env(safe-area-inset-bottom))", maxHeight:"65vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        {/* Handle */}
        <div style={{ width:"36px", height:"4px", borderRadius:"2px", background:T.border, margin:"0 auto 0.9rem" }}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.75rem" }}>
          <div>
            <div style={{ fontSize:"0.95rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif" }}>Share product</div>
            <div style={{ fontSize:"0.7rem", color:T.textLight, fontFamily:"'Inter',sans-serif", marginTop:"1px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:"260px" }}>{product.productName || product.name}</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.textLight }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {sent ? (
          <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", flex:1, gap:"0.5rem" }}>
            <div style={{ width:"44px", height:"44px", borderRadius:"50%", background:T.sage+"22", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div style={{ fontSize:"0.88rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif" }}>Sent to {sent}!</div>
          </div>
        ) : (
          <>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search a name to start a new chat…"
              style={{ padding:"0.55rem 0.85rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"0.82rem", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surfaceAlt, outline:"none", marginBottom:"0.75rem" }}/>
            <div style={{ overflowY:"auto", flex:1 }}>
              {loading && <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>Loading…</div>}
              {!loading && filtered.length === 0 && (
                <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>
                  {searchQ.trim() ? "No users found" : following.length === 0 ? "Search for someone to share with" : "No matches"}
                </div>
              )}
              {filtered.map((u, i) => (
                <button key={u.uid} onClick={() => shareToUser(u)}
                  style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.75rem 0.5rem", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}30` : "none", cursor:"pointer", textAlign:"left", borderRadius:"0.5rem" }}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="none"}>
                  <Avatar photoURL={u.photoURL} name={u.displayName} size={38}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"0.85rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif" }}>{u.displayName}</div>
                  </div>
                  <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:T.navy, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  , document.body);
}

function PostCard({post, currentUid, currentUserName="", currentUserPhoto="", onUserTap, onProductTap, onDeleted, productImageMap={}}) {
  const [liked, setLiked] = useState((post.likes||[]).includes(currentUid));
  const [likeCount, setLikeCount] = useState((post.likes||[]).length);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState(post.comments||[]);
  const [commentText, setCommentText] = useState("");
  const [posting, setPosting] = useState(false);
  const isOwner = post.uid === currentUid;

  // Use post image, or look up from productImageMap
  const mappedImage = productImageMap[(post.productName||"").toLowerCase().trim()] || "";
  const liveImage = post.productImage || post.image || mappedImage;

  const livePostScore = (post.ingredients && post.ingredients.trim().length > 10)
    ? (() => { const r = analyzeIngredients(post.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
    : null;
  const displayScore = livePostScore ?? post.poreScore ?? null;
  const ps = poreStyle(displayScore??0);
  const [likeAnim, setLikeAnim] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [swipeX, setSwipeX] = useState(0);
  const swipeStart = React.useRef(0);

  function onSwipeStart(e) { swipeStart.current = e.touches[0].clientX; }
  function onSwipeMove(e) {
    const dx = e.touches[0].clientX - swipeStart.current;
    if (Math.abs(dx) < 5) return;
    // Right swipe → like (max 60px), left swipe → delete hint (max -60px, owner only)
    if (dx > 0) setSwipeX(Math.min(dx * 0.35, 60));
    else if (isOwner) setSwipeX(Math.max(dx * 0.35, -60));
  }
  function onSwipeEnd() {
    if (swipeX > 45 && !liked) handleLike();
    if (swipeX < -45 && isOwner) setMenuOpen(true);
    setSwipeX(0);
  }

  async function submitComment() {
    if (!commentText.trim() || posting) return;
    setPosting(true);
    const newComment = { uid: currentUid, displayName: currentUserName||"User", photoURL: currentUserPhoto||"", text: commentText.trim(), createdAt: Date.now() };
    try {
      await updateDoc(doc(db,"posts",post.id), { comments: arrayUnion(newComment) });
      setComments(c=>[...c, newComment]);
      setCommentText("");
    } catch(e) { console.error(e); }
    setPosting(false);
  }

  async function deleteComment(c) {
    try {
      await updateDoc(doc(db,"posts",post.id), { comments: arrayRemove(c) });
      setComments(cs=>cs.filter(x=>x.uid!==c.uid||x.text!==c.text||x.createdAt!==c.createdAt));
    } catch(e) { console.error(e); }
  }

  async function handleLike() {
    const newLiked = !liked;
    setLiked(newLiked);
    setLikeCount(c => newLiked ? c+1 : c-1);
    if (newLiked) {
      setLikeAnim(true);
      setTimeout(()=>setLikeAnim(false), 400);
      if (navigator.vibrate) navigator.vibrate(12);
    }
    await toggleLike(post.id, currentUid);
  }

  async function handleDelete() {
    if (!confirm("Delete this post? This can't be undone.")) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "posts", post.id));
      setDeleted(true);
      onDeleted && onDeleted(post.id);
    } catch(e) { alert("Couldn't delete post."); }
    setDeleting(false);
  }

  if (deleted) return null;

  const firstName = post.displayName?.split(" ")[0] || "Someone";
  const captionMap = {
    brokeout:  { icon: "⚠️", text: `${firstName} broke out from this`,        verb: "broke out from" },
    wantToTry: { icon: "👀", text: `${firstName} wants to try this`,           verb: "wants to try" },
    loved:     { icon: "💖", text: `${firstName} loves this`,                  verb: "loves" },
    commented: { icon: "💬", text: `${firstName} commented on this`,           verb: "commented on" },
  };
  const caption = captionMap[post.postType] || null;

  // ── Context line: why this post is showing ──────────────────
  const contextLine = (() => {
    if (post._context) return post._context;
    const type = post.postType;
    if (type === "brokeout")  return { text: `${firstName} broke out from this` };
    if (type === "wantToTry") return { text: `${firstName} wants to try this` };
    if (type === "loved")     return { text: `${firstName} loves this` };
    if (type === "commented") return { text: `${firstName} commented on this` };
    // scan/search/type — show what the score revealed
    if (displayScore === 0) return { text: `${firstName} checked the ingredients — pore safe ✓` };
    if (displayScore === 1) return { text: `${firstName} checked the ingredients — low risk` };
    if (displayScore >= 2) return { text: `${firstName} checked the ingredients — flagged ${displayScore}/5` };
    return { text: `${firstName} checked the ingredients` };
  })();

  const typeAccent = post.postType==="brokeout" ? T.rose : post.postType==="wantToTry" ? T.amber : T.sage;
  const typeIcon   = post.postType==="brokeout"
    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={typeAccent} strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    : post.postType==="wantToTry"
    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={typeAccent} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    : <svg width="12" height="12" viewBox="0 0 24 24" fill={typeAccent} stroke="none"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>;

  return (
    <div style={{position:"relative"}}
      onTouchStart={onSwipeStart} onTouchMove={onSwipeMove} onTouchEnd={onSwipeEnd}>

      {swipeX>10&&<div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:T.rose+"08",pointerEvents:"none",zIndex:0,borderRadius:"1.1rem"}}/>}

      <div style={{transform:`translateX(${swipeX}px)`,transition:swipeX===0?"transform 0.2s ease":"none",position:"relative",zIndex:1,padding:"0.75rem 1rem"}}>

        {/* ── Single unified card ── */}
        <div style={{background:T.surface,borderRadius:"1.1rem",border:`1px solid ${T.border}`,overflow:"hidden",boxShadow:"0 1px 6px rgba(28,28,26,0.05)",marginBottom:"0.5rem"}}>

          {/* Card header */}
          <div style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.7rem 0.85rem 0.6rem",borderBottom:`1px solid ${T.border}50`}}>
            <button onClick={()=>onUserTap(post.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0}}>
              <Avatar photoURL={post.photoURL} name={post.displayName} size={34}/>
            </button>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.35rem"}}>
                <button onClick={()=>onUserTap(post.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontWeight:"700",color:T.text,fontSize:"0.85rem",fontFamily:"'Inter',sans-serif"}}>{firstName}</button>
                <span style={{fontSize:"0.68rem",color:T.textLight}}>·</span>
                <span style={{fontSize:"0.68rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>{timeAgo(post.createdAt)}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"0.25rem",marginTop:"1px"}}>
                <span style={{display:"flex",alignItems:"center"}}>{typeIcon}</span>
                <span style={{fontSize:"0.68rem",fontWeight:"600",color:typeAccent,fontFamily:"'Inter',sans-serif"}}>
                  {post.postType==="brokeout"?"broke out from this":post.postType==="wantToTry"?"wants to try this":post.postType==="loved"?"loves this":"checked this"}
                </span>
              </div>
            </div>
            {isOwner&&(
              <div style={{position:"relative",flexShrink:0}}>
                <button onClick={()=>setMenuOpen(m=>!m)} style={{background:"none",border:"none",cursor:"pointer",padding:"4px",color:T.textLight,display:"flex"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>
                </button>
                {menuOpen&&(
                  <><div onClick={()=>setMenuOpen(false)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:100}}/>
                  <div style={{position:"absolute",right:0,top:"calc(100% + 4px)",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.6rem",boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:101,minWidth:"110px",overflow:"hidden"}}>
                    <button onClick={()=>{setMenuOpen(false);handleDelete();}} disabled={deleting}
                      style={{width:"100%",padding:"0.6rem 0.8rem",background:"none",border:"none",cursor:"pointer",fontSize:"0.78rem",color:T.rose,fontFamily:"'Inter',sans-serif",textAlign:"left",display:"flex",alignItems:"center",gap:"0.35rem"}}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      {deleting?"Deleting…":"Delete"}
                    </button>
                  </div></>
                )}
              </div>
            )}
          </div>

          {/* Product row — A1 style: thumb + info + dot score */}
          <div onClick={onProductTap?()=>onProductTap(post):undefined} className={onProductTap?"pressable":""}
            style={{display:"flex",gap:"0.65rem",alignItems:"center",padding:"0.65rem 0.85rem",cursor:onProductTap?"pointer":"default",background:T.surface}}>
            {/* Thumbnail */}
            <div style={{width:"42px",height:"42px",flexShrink:0,borderRadius:"0.55rem",overflow:"hidden",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {liveImage
                ? <img src={liveImage} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"4px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.opacity="0"}/>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              }
            </div>
            {/* Name + brand */}
            <div style={{flex:1,minWidth:0}}>
              {post.brand&&<div style={{fontSize:"0.58rem",fontWeight:"600",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"0.1rem",fontFamily:"'Inter',sans-serif"}}>{post.brand}</div>}
              <div style={{fontWeight:"600",color:T.text,fontSize:"0.85rem",fontFamily:"'Inter',sans-serif",lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{post.productName}</div>
              {post.communityRating&&<div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"2px",fontFamily:"'Inter',sans-serif"}}>★ {(post.communityRating/2).toFixed(1)} community</div>}
            </div>
            {/* Dot + score — A1 style */}
            <div style={{flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px"}}>
              <div style={{display:"flex",alignItems:"center",gap:"3px"}}>
                <div style={{width:7,height:7,borderRadius:"50%",background:displayScore!=null?ps.color:T.border,flexShrink:0}}/>
                <span style={{fontSize:"0.82rem",fontWeight:"600",color:displayScore!=null?ps.color:T.textLight,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{displayScore??"—"}</span>
                <span style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>/5</span>
              </div>
              <span style={{fontSize:"0.5rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'Inter',sans-serif"}}>pore</span>
            </div>
          </div>

          {/* Actions row inside the card */}
          <div style={{display:"flex",alignItems:"center",gap:"1rem",padding:"0.5rem 0.85rem 0.65rem",borderTop:`1px solid ${T.border}40`}}>
            <button onClick={handleLike} style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"none",border:"none",cursor:"pointer",padding:"2px 0",color:liked?T.rose:T.textLight,transition:"color 0.15s"}}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill={liked?"currentColor":"none"} stroke="currentColor" strokeWidth="1.8" style={{animation:likeAnim?"heartBounce 0.4s ease both":"none"}}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              {likeCount>0&&<span style={{fontSize:"0.72rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>{likeCount}</span>}
            </button>
            <button onClick={()=>setShowComments(s=>!s)} style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"none",border:"none",cursor:"pointer",padding:"2px 0",color:showComments?T.accent:T.textLight,transition:"color 0.15s"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              {comments.length>0
                ? <span style={{fontSize:"0.72rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>{comments.length}</span>
                : <span style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Comment</span>
              }
            </button>
            <button onClick={()=>setShareOpen(true)} style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"none",border:"none",cursor:"pointer",padding:"2px 0",color:T.textLight,marginLeft:"auto",transition:"color 0.15s"}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
        </div>

        {shareOpen&&<ShareProductModal user={{uid:currentUid}} product={post} onClose={()=>setShareOpen(false)}/>}
        {/* Comments */}
        {showComments&&(
          <div style={{padding:"0 0.1rem 0.5rem",display:"flex",flexDirection:"column",gap:"0.45rem"}}>
          {comments.map((c,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem"}}>
              <Avatar photoURL={c.photoURL} name={c.displayName} size={24}/>
              <div style={{flex:1,background:T.surfaceAlt,borderRadius:"0.65rem",padding:"0.35rem 0.6rem"}}>
                <span style={{fontSize:"0.7rem",fontWeight:"700",color:T.text,marginRight:"0.3rem"}}>{c.displayName||"User"}</span>
                <span style={{fontSize:"0.75rem",color:T.textMid,lineHeight:1.4}}>{c.text}</span>
              </div>
              {(c.uid===currentUid||post.uid===currentUid)&&(
                <button onClick={()=>deleteComment(c)} style={{background:"none",border:"none",cursor:"pointer",color:T.textLight,padding:"4px",flexShrink:0,marginTop:"2px"}}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              )}
            </div>
          ))}
          <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
            <input value={commentText} onChange={e=>setCommentText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&submitComment()} placeholder="Add a comment…"
              style={{flex:1,padding:"0.45rem 0.75rem",borderRadius:"999px",border:`1px solid ${T.border}`,fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none"}}/>
            <button onClick={submitComment} disabled={!commentText.trim()||posting}
              style={{width:"30px",height:"30px",borderRadius:"50%",background:commentText.trim()?T.accent:T.surfaceAlt,border:"none",cursor:commentText.trim()?"pointer":"default",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"background 0.15s"}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={commentText.trim()?"#fff":T.textLight} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            </button>
          </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── StarRating ────────────────────────────────────────────────
function StarRating({max, value, onChange, label}) {
  return (
    <div>
      <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.4rem",fontFamily:"'Inter',sans-serif"}}>{label}</div>
      <div style={{display:"flex",gap:"0.3rem"}}>
        {Array.from({length:max},(_,i)=>(
          <button key={i} onClick={()=>onChange(i+1)} style={{background:"none",border:"none",cursor:"pointer",padding:"2px",fontSize:"1.4rem",color:i<value?T.accent:T.border,transition:"color 0.1s"}}>
            ★
          </button>
        ))}
        <span style={{fontSize:"0.82rem",color:T.textMid,marginLeft:"0.25rem",alignSelf:"center"}}>{value}/{max}</span>
      </div>
    </div>
  );
}


// ── KeyActivesSection — extracted to fix Rules of Hooks (no useState inside IIFE) ──
function KeyActivesSection({ ingredients }) {
  const [activeDetail, setActiveDetail] = React.useState(null);
  if (!ingredients) return null;
const ACTIVES = [
  {name:"niacinamide",      label:"Niacinamide",       benefit:"Pore-minimizing, brightening",   detail:"A form of vitamin B3 that visibly shrinks pores, fades dark spots, and regulates oil production — all without irritating the skin.", goodFor:["Oily","Acne-prone","Combination","Hyperpigmentation"], howToUse:"Can be used morning and night. Pairs well with most actives including retinol and vitamin C."},
  {name:"retinol",          label:"Retinol",            benefit:"Cell turnover, anti-aging",       detail:"Converts to retinoic acid on the skin, speeding up cell renewal. One of the best-studied anti-aging ingredients — also clears pores over time.", goodFor:["Mature","Acne-prone","Dull"], howToUse:"Start 1–2x per week at night. Always follow with SPF the next morning. Expect some purging in weeks 2–4."},
  {name:"retinyl",          label:"Retinyl",            benefit:"Gentle vitamin A derivative",    detail:"Retinyl palmitate or acetate — a gentler retinoid that converts to retinol, then retinoic acid. Less potent but much better tolerated.", goodFor:["Sensitive","Beginners","Mature"], howToUse:"Can be used nightly. A good entry point before moving to stronger retinol."},
  {name:"salicylic acid",   label:"Salicylic Acid",    benefit:"BHA — unclogs pores",             detail:"A beta-hydroxy acid (BHA) that's oil-soluble, so it can penetrate inside pores and dissolve the sebum and dead cells causing blackheads and breakouts.", goodFor:["Oily","Acne-prone","Blackheads"], howToUse:"Use 1–3x per week. Avoid combining with other strong acids on the same day."},
  {name:"glycolic acid",    label:"Glycolic Acid",     benefit:"AHA — exfoliates & brightens",    detail:"The smallest AHA molecule — penetrates deepest and exfoliates most effectively. Resurfaces dead skin, brightens tone, and stimulates collagen.", goodFor:["Dull","Uneven tone","Rough texture"], howToUse:"Use at night, 2–3x per week. Always wear SPF next day — AHAs increase sun sensitivity."},
  {name:"lactic acid",      label:"Lactic Acid",       benefit:"AHA — gentle exfoliant",          detail:"A larger AHA molecule that exfoliates more gently than glycolic. Also a humectant — it hydrates while it resurfaces, making it ideal for dry or sensitive skin.", goodFor:["Dry","Sensitive","Beginners"], howToUse:"Can be used 2–3x per week at night. Gentler than glycolic but still requires SPF the next day."},
  {name:"mandelic acid",    label:"Mandelic Acid",     benefit:"AHA — acne-safe exfoliant",       detail:"The largest AHA molecule — exfoliates slowest and most gently. Also has antimicrobial properties, making it one of the safest exfoliants for acne-prone and darker skin tones.", goodFor:["Sensitive","Acne-prone","Darker skin tones"], howToUse:"Can be used 2–3x per week at night. Lower irritation risk than glycolic or lactic acid."},
  {name:"azelaic acid",     label:"Azelaic Acid",      benefit:"Fades marks, calms redness",      detail:"Naturally found in wheat and barley. Fades post-acne marks, reduces redness, and kills acne bacteria. One of the few actives safe during pregnancy.", goodFor:["Rosacea","Post-acne marks","Sensitive"], howToUse:"Can be used morning and/or night. Works well layered under SPF. No major interactions."},
  {name:"ascorbic acid",    label:"Vitamin C",         benefit:"Brightening, antioxidant",        detail:"L-ascorbic acid is the purest, most potent form of vitamin C. Inhibits melanin production to fade dark spots, boosts collagen, and neutralises free radical damage from UV.", goodFor:["Dull","Hyperpigmentation","Anti-aging"], howToUse:"Use in the morning under SPF — sunlight degrades vitamin C. Store in a dark, cool place."},
  {name:"thd ascorbate",    label:"Vitamin C (THD)",   benefit:"Stable vitamin C derivative",    detail:"Tetrahexyldecyl ascorbate — an oil-soluble, highly stable vitamin C that penetrates deeper than L-ascorbic acid without the irritation or oxidation issues.", goodFor:["Sensitive","Dry","Anti-aging"], howToUse:"Can be used morning or night. More stable than L-ascorbic acid — less likely to oxidise."},
  {name:"hyaluronic acid",  label:"Hyaluronic Acid",   benefit:"Deep hydration",                 detail:"A sugar molecule that holds up to 1000x its weight in water. Draws moisture from the air into skin and creates a plumping, smoothing effect.", goodFor:["Dry","Dehydrated","All skin types"], howToUse:"Apply to damp skin before moisturiser. Layer under a cream to seal in hydration."},
  {name:"sodium hyaluronate",label:"Hyaluronic Acid",  benefit:"Surface hydration",              detail:"A smaller form of hyaluronic acid that penetrates the skin surface more effectively. Hydrates the epidermis and reduces the appearance of fine lines.", goodFor:["All skin types","Dehydrated"], howToUse:"Use morning and night before heavier products. Layer under moisturiser."},
  {name:"ceramide",         label:"Ceramides",         benefit:"Barrier repair",                  detail:"Lipids naturally found in skin (40–50% of the stratum corneum). Ceramides seal the gaps between skin cells, locking in moisture and keeping irritants out.", goodFor:["Dry","Eczema","Sensitive","Damaged barrier"], howToUse:"Can be used morning and night. Essential in a barrier-repair routine — combine with cholesterol and fatty acids for best results."},
  {name:"zinc oxide",       label:"Zinc Oxide",        benefit:"Mineral SPF + calming",           detail:"Broad-spectrum mineral UV filter that sits on the surface of skin, reflecting and scattering UV rays. Also has anti-inflammatory and mild antimicrobial properties.", goodFor:["Sensitive","Acne-prone","Rosacea"], howToUse:"Apply as the last step in your morning routine, before makeup. Reapply every 2 hours in sun."},
  {name:"benzoyl peroxide", label:"Benzoyl Peroxide",  benefit:"Kills acne bacteria",             detail:"One of the most effective over-the-counter acne treatments. Releases oxygen into the pore, killing C. acnes bacteria that cause breakouts. Also helps unclog pores.", goodFor:["Acne-prone","Oily"], howToUse:"Start with 2.5% to minimise irritation. Use as a spot treatment or thin layer — avoid mixing with retinol on the same application."},
  {name:"peptide",          label:"Peptides",          benefit:"Firming, anti-aging",             detail:"Short chains of amino acids that signal the skin to produce more collagen and elastin. Different peptides target different concerns — from wrinkles to sagging to discoloration.", goodFor:["Mature","Anti-aging"], howToUse:"Can be used morning and night. Layer under moisturiser. Generally well tolerated alongside most other actives."},
  {name:"ferulic acid",     label:"Ferulic Acid",      benefit:"Antioxidant booster",             detail:"A plant-derived antioxidant that dramatically boosts the stability and effectiveness of vitamin C and E. Standard in high-performance vitamin C serums.", goodFor:["All skin types","Anti-aging"], howToUse:"Usually formulated with vitamin C — no separate application needed. Use in the morning under SPF."},
  {name:"snail secretion",  label:"Snail Mucin",       benefit:"Barrier repair, hydration",       detail:"Snail secretion filtrate contains glycoproteins, hyaluronic acid, glycolic acid, and antimicrobial peptides. Repairs skin barrier, fades scars, and provides lightweight hydration.", goodFor:["Acne scars","Dry","Damaged barrier"], howToUse:"Can be used morning and night. Layer under heavier creams. Extremely gentle — suitable for sensitive skin."},
  {name:"centella",         label:"Centella Asiatica",  benefit:"Calming, healing",               detail:"Also called cica or tiger grass. Contains madecassoside and asiaticoside — compounds that promote wound healing, reduce inflammation, and strengthen the skin barrier.", goodFor:["Sensitive","Rosacea","Post-procedure","Acne scars"], howToUse:"Can be used morning and night. Ideal after treatments, waxing, or during a compromised-barrier recovery period."},
  {name:"squalane",         label:"Squalane",           benefit:"Lightweight moisturizer",         detail:"A stable, skin-identical emollient derived from sugarcane or olives. Mimics the skin's own squalene, absorbs without grease, and is completely non-comedogenic.", goodFor:["All skin types","Oily","Sensitive"], howToUse:"Apply morning or night before heavier moisturisers, or mix a drop into your existing cream. Also works as a hair serum."},
  {name:"allantoin",        label:"Allantoin",          benefit:"Soothing, healing",               detail:"A compound found in comfrey root. Promotes cell proliferation, speeds healing, and has keratolytic properties — softening rough skin while calming irritation.", goodFor:["Sensitive","Dry","Post-active irritation"], howToUse:"Works well in any routine step. Often used to buffer the irritation caused by retinol or acids."},
];
const ingLower = ingredients.toLowerCase();
const found = ACTIVES.filter((a,i,arr) =>
  ingLower.includes(a.name) &&
  arr.findIndex(b=>b.label===a.label)===i
);
if (!found.length) return null;
return (
  <div style={{marginBottom:"0.75rem"}}>
    <div style={{fontSize:"0.6rem",color:T.navy,textTransform:"uppercase",letterSpacing:"0.14em",fontWeight:"600",marginBottom:"0.5rem"}}>Key Actives <span style={{fontWeight:"400",color:T.textLight,textTransform:"none",letterSpacing:0,fontSize:"0.58rem"}}>— tap to learn more</span></div>
    <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem"}}>
      {found.map(a=>{
        const isOpen = activeDetail===a.name;
        const dbEntry = INGDB_META[a.name.toLowerCase()] || {};
        return (
          <div key={a.name} style={{width:"100%"}}>
            <button onClick={()=>setActiveDetail(isOpen?null:a.name)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",width:"100%",background:isOpen?T.accent+"18":T.accent+"10",border:`1px solid ${isOpen?T.accent+"55":T.accent+"25"}`,borderRadius:isOpen?"0.5rem 0.5rem 0 0":"0.5rem",padding:"0.4rem 0.65rem",cursor:"pointer",textAlign:"left",transition:"all 0.15s"}}>
              <div>
                <div style={{fontSize:"0.72rem",fontWeight:"700",color:T.accent}}>{a.label}</div>
                <div style={{fontSize:"0.62rem",color:T.textMid}}>{a.benefit}</div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" style={{flexShrink:0,transform:isOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {isOpen&&(
              <div style={{background:T.accent+"08",border:`1px solid ${T.accent+"25"}`,borderTop:"none",borderRadius:"0 0 0.5rem 0.5rem",padding:"0.65rem 0.75rem",display:"flex",flexDirection:"column",gap:"0.5rem",animation:"fadeUp 0.15s ease"}}>
                {dbEntry.benefit&&<div>
                  <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.sage,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"2px"}}>What it does</div>
                  <div style={{fontSize:"0.78rem",color:T.text,lineHeight:1.5}}>{dbEntry.benefit}</div>
                </div>}
                {a.detail&&<div>
                  <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"2px"}}>How it works</div>
                  <div style={{fontSize:"0.78rem",color:T.text,lineHeight:1.5}}>{a.detail}</div>
                </div>}
                {a.goodFor&&<div>
                  <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"4px"}}>Best for</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"0.25rem"}}>
                    {a.goodFor.map(s=><span key={s} style={{padding:"0.15rem 0.5rem",background:T.sage+"15",border:`1px solid ${T.sage}30`,borderRadius:"999px",fontSize:"0.65rem",color:T.sage,fontWeight:"500"}}>{s}</span>)}
                  </div>
                </div>}
                {dbEntry.concern&&dbEntry.concern!=="None known"&&<div>
                  <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.rose,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"2px"}}>Watch out</div>
                  <div style={{fontSize:"0.75rem",color:T.textMid,lineHeight:1.45}}>{dbEntry.concern}</div>
                </div>}
                {a.howToUse&&<div style={{padding:"0.45rem 0.6rem",background:"rgba(255,255,255,0.7)",borderRadius:"0.4rem",border:`1px solid ${T.border}`}}>
                  <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"2px"}}>How to use</div>
                  <div style={{fontSize:"0.72rem",color:T.textMid,lineHeight:1.45}}>{a.howToUse}</div>
                </div>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  </div>
);
}


// ── IngredientDetailSheet ─────────────────────────────────────
function IngredientDetailSheet({ ing, onClose }) {
  const ingKey = (ing.name || "").toLowerCase().replace(/\s*\(.*?\)/g, "").trim();
  const dbEntry = INGDB[ingKey] || (() => {
    const found = Object.entries(INGDB).find(([k, v]) => {
      const allNames = [k, ...(v.aliases || [])];
      return allNames.some(n => n && n.toLowerCase() === ingKey);
    });
    return found ? found[1] : null;
  })();
  const metaEntry = INGDB_META[ingKey] || (() => {
    const found = Object.entries(INGDB_META).find(([k]) => k === ingKey);
    return found ? found[1] : null;
  })();
  const rating = dbEntry?.score ?? null;
  const isFlagged = dbEntry && (dbEntry.score >= 1 || dbEntry.irritant);
  const ratingLabels = ["Non-comedogenic","Minimal","Low","High","High","Avoid"];
  const category = metaEntry?.category || (dbEntry?.irritant ? "Irritant" : rating >= 1 ? "Comedogenic" : "Ingredient");
  const benefit = metaEntry?.benefit || null;
  const concern = (metaEntry?.concern && metaEntry.concern !== "None known") ? metaEntry.concern : (dbEntry?.note || null);

  return (
    <div onClick={e => e.stopPropagation()} style={{position:"absolute",bottom:0,left:0,right:0,background:T.surface,borderRadius:"1.25rem 1.25rem 0 0",border:`1px solid ${T.border}`,borderBottom:"none",padding:"1rem 1.25rem 2rem",zIndex:10,boxShadow:"0 -6px 32px rgba(0,0,0,0.14)",animation:"fadeUp 0.2s ease"}}>
      <div style={{width:36,height:3,borderRadius:2,background:T.border,margin:"0 auto 0.85rem"}}/>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.35rem"}}>
        <div style={{fontSize:"0.95rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",textTransform:"capitalize",flex:1,minWidth:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ing.name}</div>
        <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.72rem",color:T.textLight,padding:"2px 0 2px 0.75rem",fontFamily:"'Inter',sans-serif",flexShrink:0}}>✕ close</button>
      </div>
      <span style={{display:"inline-block",fontSize:"0.62rem",padding:"0.18rem 0.65rem",borderRadius:20,marginBottom:"0.85rem",background:isFlagged?"#FAECE7":"#E1F5EE",color:isFlagged?"#712B13":"#085041",fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>{category}</span>
      {benefit && (
        <div style={{display:"flex",gap:"0.75rem",marginBottom:"0.6rem"}}>
          <div style={{fontSize:"0.62rem",color:T.textLight,width:90,flexShrink:0,paddingTop:2,fontFamily:"'Inter',sans-serif"}}>Benefit</div>
          <div style={{fontSize:"0.78rem",color:T.text,flex:1,lineHeight:1.55,fontFamily:"'Inter',sans-serif"}}>{benefit}</div>
        </div>
      )}
      {rating != null && (
        <div style={{display:"flex",gap:"0.75rem",marginBottom:"0.65rem",alignItems:"center"}}>
          <div style={{fontSize:"0.62rem",color:T.textLight,width:90,flexShrink:0,fontFamily:"'Inter',sans-serif"}}>Comedogenic</div>
          <div style={{display:"flex",alignItems:"center",gap:4}}>
            {[0,1,2,3,4].map(i=><div key={i} style={{width:9,height:9,borderRadius:"50%",background:i<rating?T.rose:T.border,flexShrink:0}}/>)}
            <span style={{fontSize:"0.62rem",color:T.textMid,marginLeft:6,fontFamily:"'Inter',sans-serif"}}>{rating}/5 — {ratingLabels[Math.min(rating,5)]}</span>
          </div>
        </div>
      )}
      {concern && isFlagged && <div style={{background:"#FAECE7",borderRadius:8,padding:"0.6rem 0.8rem"}}><div style={{fontSize:"0.72rem",color:"#712B13",lineHeight:1.55,fontFamily:"'Inter',sans-serif"}}>{concern}</div></div>}
      {concern && !isFlagged && dbEntry?.irritant && <div style={{background:T.amber+"18",borderRadius:8,padding:"0.6rem 0.8rem"}}><div style={{fontSize:"0.72rem",color:T.amber,lineHeight:1.55,fontFamily:"'Inter',sans-serif"}}>⚠ {concern}</div></div>}
      {!benefit && rating == null && !concern && <div style={{fontSize:"0.72rem",color:T.textLight,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>No detailed info available for this ingredient yet.</div>}
    </div>
  );
}

// ── ProductModal ──────────────────────────────────────────────
function ProductModal({product, onClose, user, profile, onUpdateProfile, onUserTap}) {
  if (!product) return null;
  return ReactDOM.createPortal(
    <ProductModalInner product={product} onClose={onClose} user={user} profile={profile} onUpdateProfile={onUpdateProfile} onUserTap={onUserTap}/>,
    document.body
  );
}

function ProductModalInner({product, onClose, user, profile, onUpdateProfile, onUserTap}) {
  const productName = product?.productName || product?.name || "";
  const [whyScoreOpen, setWhyScoreOpen] = React.useState(false);
  const [selectedIngredient, setSelectedIngredient] = React.useState(null);
  const modalRef = React.useRef(null);

  // Scroll lock
  React.useEffect(() => {
    const scrollY = window.pageYOffset;
    const scrollEls = Array.from(document.querySelectorAll('*')).filter(el => {
      if (modalRef.current && modalRef.current.contains(el)) return false;
      const s = window.getComputedStyle(el);
      return (s.overflowY === 'auto' || s.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
    });
    const saved = scrollEls.map(el => ({ el, top: el.scrollTop }));
    scrollEls.forEach(el => { el.style.overflow = 'hidden'; });
    document.body.style.cssText += `;overflow:hidden;position:fixed;top:-${scrollY}px;width:100%;`;
    return () => {
      saved.forEach(({ el, top }) => { el.style.overflow = ''; el.scrollTop = top; });
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const [myCommunityRating, setMyCommunityRating] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingRating, setExistingRating] = useState(null);
  const [loadingExisting, setLoadingExisting] = useState(true);
  const [shareOpen, setShareOpen] = useState(false);
  const [showFriendsList, setShowFriendsList] = useState(false);
  const [reportState, setReportState] = useState("idle");
  const [reportText, setReportText] = useState("");

  // Seed + real friends
  const SEED_FRIENDS = [
    {uid:"seed_01",displayName:"Cassidy Monroe",  photoURL:"https://i.pravatar.cc/150?img=47"},
    {uid:"seed_02",displayName:"Jenna Caldwell",  photoURL:"https://i.pravatar.cc/150?img=49"},
    {uid:"seed_03",displayName:"Leila Ramos",     photoURL:"https://i.pravatar.cc/150?img=32"},
    {uid:"seed_04",displayName:"Priya Nair",      photoURL:"https://i.pravatar.cc/150?img=44"},
    {uid:"seed_05",displayName:"Brooke Sullivan", photoURL:"https://i.pravatar.cc/150?img=39"},
    {uid:"seed_06",displayName:"Danielle Park",   photoURL:"https://i.pravatar.cc/150?img=45"},
    {uid:"seed_07",displayName:"Alexis Turner",   photoURL:"https://i.pravatar.cc/150?img=38"},
    {uid:"seed_08",displayName:"Megan Foster",    photoURL:"https://i.pravatar.cc/150?img=26"},
    {uid:"seed_09",displayName:"Simone Okafor",   photoURL:"https://i.pravatar.cc/150?img=29"},
    {uid:"seed_10",displayName:"Taylor Nguyen",   photoURL:"https://i.pravatar.cc/150?img=43"},
    {uid:"seed_11",displayName:"Camille Petit",   photoURL:"https://i.pravatar.cc/150?img=35"},
    {uid:"seed_12",displayName:"Naomi Whitfield", photoURL:"https://i.pravatar.cc/150?img=25"},
    {uid:"seed_13",displayName:"Kavya Sharma",    photoURL:"https://i.pravatar.cc/150?img=31"},
    {uid:"seed_14",displayName:"Riley Andrews",   photoURL:"https://i.pravatar.cc/150?img=27"},
    {uid:"seed_15",displayName:"Ava Chen",        photoURL:"https://i.pravatar.cc/150?img=48"},
  ];
  const _seedHash = (productName||"x").split("").reduce((a,c,i)=>a + c.charCodeAt(0)*(i+1), 0);
  const _seedCount = 2 + (_seedHash % 4);
  const _seededFriends = [...SEED_FRIENDS].sort((a,b)=>((parseInt(a.uid.slice(-2))*_seedHash)%97)-((parseInt(b.uid.slice(-2))*_seedHash)%97)).slice(0,_seedCount);
  const [followersWhoUse, setFollowersWhoUse] = useState(_seededFriends);

  useEffect(()=>{
    const following = profile?.following || [];
    if (!following.length) return;
    (async()=>{
      try {
        const snaps = await Promise.all(following.slice(0,15).map(uid=>getDoc(doc(db,"users",uid))));
        const users = snaps.filter(s=>s.exists()).map(s=>({uid:s.id,...s.data()}));
        const using = users.filter(u=>(u.routine||[]).some(r=>r.toLowerCase()===productName.toLowerCase()));
        if (using.length > 0) setFollowersWhoUse(using);
      } catch {}
    })();
  },[productName]);

  useEffect(() => {
    if (!user?.uid || !productName || !product) { setLoadingExisting(false); return; }
    setLoadingExisting(true); setExistingRating(null); setSubmitted(false);
    Promise.all([
      getDocs(query(collection(db,"ratings"), where("uid","==",user.uid), where("productName","==",productName), limit(1))).then(snap => snap.empty ? null : Number(snap.docs[0].data().communityRating)||null).catch(()=>null),
      getDocs(query(collection(db,"posts"), where("uid","==",user.uid), where("productName","==",productName), where("communityRating","!=",null), limit(1))).then(snap => snap.empty ? null : Number(snap.docs[0].data().communityRating)||null).catch(()=>null),
    ]).then(([fromRatings, fromPosts]) => {
      const found = fromRatings || fromPosts;
      if (found) setExistingRating(found);
      setLoadingExisting(false);
    });
  }, [user?.uid, productName]);

  const _ingAnalysis = product.ingredients ? analyzeIngredients(product.ingredients) : null;
  const liveScore = _ingAnalysis
    ? (_ingAnalysis.avgScore != null ? Math.round(_ingAnalysis.avgScore) : (_ingAnalysis.poreCloggers?.length ? 1 : 0))
    : (product.poreScore ?? 0);
  const ps = poreStyle(liveScore);
  const cc = communityColor(product.communityRating||0);

  const _listName   = productName || product.name || "";
  const inRoutine   = (profile?.routine   ||[]).includes(_listName);
  const inBrokeout  = (profile?.brokeout  ||[]).includes(_listName);
  const inWantToTry = (profile?.wantToTry ||[]).includes(_listName);

  async function submitRating() {
    if (!user || !myCommunityRating) return;
    setSubmitting(true);
    try {
      const ingredients = product.ingredients || "";
      const analysis = analyzeIngredients(ingredients);
      const autoPoreScore = analysis.avgScore != null ? Math.round(analysis.avgScore) : (product.poreScore || 0);
      const displayName = profile?.displayName || user.displayName || "Anonymous";
      const photoURL = profile?.photoURL || user.photoURL || "";
      const ratingDocId = `${user.uid}_${productName.toLowerCase().replace(/[^a-z0-9]/g,'_').slice(0,60)}`;
      await setDoc(doc(db, "ratings", ratingDocId), { uid:user.uid, displayName, photoURL, productName, productId:product.id||product.productId||"", brand:product.brand||"", poreScore:autoPoreScore, communityRating:myCommunityRating, productImage:product.adminImage||product.image||product.productImage||"", ingredients:ingredients.slice(0,500), updatedAt:serverTimestamp(), createdAt:serverTimestamp() }, { merge: true });
      await postScan(user.uid, displayName, photoURL, productName, product.brand||"", autoPoreScore, myCommunityRating, ingredients, analysis.found);
      setSubmitted(true); setExistingRating(myCommunityRating);
      onUpdateProfile?.(p=>({...p, _ratingsRefresh: Date.now()}));
    } catch(e) { console.error("submitRating error:", e); }
    setSubmitting(false);
  }

  async function toggleList(field, inList) {
    if (!user) return;
    const name = productName || product.name || product.productName || "";
    if (!name.trim()) return;
    if (!inList && navigator.vibrate) navigator.vibrate([8, 40, 8]);
    try {
      if (inList) {
        await updateDoc(doc(db,"users",user.uid),{[field]:arrayRemove(name)});
        onUpdateProfile?.(p=>({...p,[field]:(p[field]||[]).filter(v=>v!==name)}));
      } else {
        await updateDoc(doc(db,"users",user.uid),{[field]:arrayUnion(name)});
        onUpdateProfile?.(p=>({...p,[field]:[...(p[field]||[]),name]}));
      }
      const listLabel = field==="routine"?"Routine":field==="loved"?"Loved":"Want to Try";
      const t = document.createElement("div"); t.className="save-toast"; t.textContent=inList?"Removed":`Added to ${listLabel} ✓`;
      document.body.appendChild(t); setTimeout(()=>t.remove(), 2100);
    } catch(e) { console.error("toggleList error", e); }
  }

  const {poreCloggers: modalCloggers, irritants: modalIrritants} = (() => {
    if (_ingAnalysis) return { poreCloggers:(_ingAnalysis.poreCloggers||[]).sort((a,b)=>b.score-a.score).slice(0,6), irritants:(_ingAnalysis.irritants||[]).slice(0,6) };
    if (product.flaggedIngredients?.length) {
      const mapped = product.flaggedIngredients.map(rawName => {
        const key = rawName.toLowerCase().replace(/\s*\(.*?\)/g,"").trim();
        const dbEntry = INGDB[key] || Object.entries(INGDB).find(([k,v])=>k===key||(v.aliases||[]).some(a=>a===key))?.[1];
        return { name:rawName, score:dbEntry?.score??3, note:dbEntry?.note??"Potential pore-clogger", irritant:dbEntry?.irritant };
      });
      return { poreCloggers:mapped.filter(i=>i.score>=1).sort((a,b)=>b.score-a.score), irritants:mapped.filter(i=>i.irritant&&i.score<1) };
    }
    return {poreCloggers:[], irritants:[]};
  })();

  // ── Pore score SVG dial values
  const DIAL_R = 28;
  const DIAL_CIRC = 2 * Math.PI * DIAL_R;
  const dialFill = Math.min(liveScore / 5, 1);
  const dialDash = `${dialFill * DIAL_CIRC} ${DIAL_CIRC}`;
  const scoreLabel = ["Clear","Minimal","Low","High","High","Avoid"][liveScore] || "Clear";
  const scoreSubtext = ["Won't clog pores","Very unlikely to clog","May affect some skin","Likely to clog pores","High clog risk","Avoid — clogs pores"][liveScore] || "";

  // ── Community stars
  const commStars = product.communityRating ? (() => {
    const s = product.communityRating / 2;
    return { full:Math.floor(s), half:s-Math.floor(s)>=0.5, empty:5-Math.floor(s)-(s-Math.floor(s)>=0.5?1:0), label:product.communityRating>=9?"Loved":product.communityRating>=7?"Liked":product.communityRating>=5?"Mixed":"Low" };
  })() : null;

  const buyUrl = product.buyUrl || amazonUrl(product.productName||product.name||"", product.brand||"", product.barcode||product.code||"");

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9500,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}>
      {/* Backdrop */}
      <div onClick={()=>{setSelectedIngredient(null);onClose();}} style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(28,28,26,0.45)",backdropFilter:"blur(4px)",cursor:"pointer"}}/>

      {/* Sheet */}
      <div ref={modalRef} style={{position:"relative",width:"100%",maxWidth:"480px",background:T.surface,borderRadius:"1.5rem 1.5rem 0 0",padding:"1.25rem 1.25rem",paddingBottom:"calc(2.5rem + env(safe-area-inset-bottom))",boxShadow:"0 -8px 40px rgba(28,28,26,0.15)",maxHeight:"92vh",overflowY:selectedIngredient?"hidden":"auto",zIndex:1}} className="fu">

        {/* ── Handle + share/close ── */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"1rem",position:"relative"}}>
          <div style={{width:"36px",height:"4px",background:T.border,borderRadius:"999px"}}/>
          <button onClick={()=>setShareOpen(true)} style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",background:T.surfaceAlt,border:"none",borderRadius:"50%",width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:T.textMid}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
          <button onClick={onClose} style={{position:"absolute",right:0,top:"50%",transform:"translateY(-50%)",background:T.surfaceAlt,border:"none",borderRadius:"50%",width:"28px",height:"28px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"0.9rem",color:T.textMid}}>✕</button>
        </div>
        {shareOpen&&<ShareProductModal user={user||{uid:""}} product={product} onClose={()=>setShareOpen(false)}/>}

        {/* ── 1. Product image ── */}
        <div style={{width:"100%",height:"190px",background:`linear-gradient(135deg,${T.iceBlue}40,${T.surfaceAlt})`,borderRadius:"1rem",overflow:"hidden",marginBottom:"1.1rem",display:"flex",alignItems:"center",justifyContent:"center",border:`1px solid ${T.iceBlue}66`}}>
          <ProductImage src={product.image} name={product.productName} brand={product.brand} barcode={product.barcode}/>
        </div>

        {/* ── 2. Brand pill + Name ── */}
        <div style={{marginBottom:"1rem"}}>
          {product.brand&&<div style={{display:"inline-block",fontSize:"0.6rem",color:T.navy,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"0.35rem",fontFamily:"'Inter',sans-serif",background:T.iceBlue+"55",padding:"0.2rem 0.6rem",borderRadius:"999px",border:`1px solid ${T.iceBlue}`}}>{product.brand}</div>}
          <div style={{fontSize:"1.45rem",fontWeight:"800",color:T.navy,fontFamily:"'Inter',sans-serif",lineHeight:1.15,letterSpacing:"-0.03em"}}>{product.productName}</div>
        </div>

        {/* ── 3. Score row: dial + label + community ── */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",paddingBottom:"1rem",borderBottom:`1px solid ${T.border}`}}>
          <div style={{position:"relative",width:72,height:72,flexShrink:0}}>
            <svg viewBox="0 0 68 68" width="72" height="72">
              <circle cx="34" cy="34" r={DIAL_R} fill="none" stroke={T.border} strokeWidth="5"/>
              <circle cx="34" cy="34" r={DIAL_R} fill="none" stroke={ps.color} strokeWidth="5" strokeDasharray={dialDash} strokeLinecap="round" transform="rotate(-90 34 34)" style={{transition:"stroke-dasharray 0.5s ease"}}/>
            </svg>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center"}}>
              <span style={{fontSize:"1.4rem",fontWeight:"800",color:ps.color,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{liveScore}</span>
              <span style={{fontSize:"0.42rem",color:T.textLight,fontFamily:"'Inter',sans-serif",textTransform:"uppercase"}}>/5</span>
            </div>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.55rem",color:T.textLight,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.2rem",fontFamily:"'Inter',sans-serif"}}>Pore Score</div>
            <div style={{fontSize:"1rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>{scoreLabel} risk</div>
            <div style={{fontSize:"0.68rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginTop:"0.15rem"}}>{scoreSubtext}</div>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            {product.communityRating ? (<>
              <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:"2px"}}>
                {commStars&&<>{[...Array(commStars.full)].map((_,i)=><svg key={"f"+i} width="15" height="15" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}{commStars.half&&<svg key="h" width="15" height="15" viewBox="0 0 24 24" stroke="#F59E0B" strokeWidth="1"><defs><linearGradient id="hgc"><stop offset="50%" stopColor="#F59E0B"/><stop offset="50%" stopColor="none" stopOpacity="0"/></linearGradient></defs><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="url(#hgc)"/></svg>}{[...Array(commStars.empty)].map((_,i)=><svg key={"e"+i} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.3"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</>}
              </div>
              <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"3px",fontFamily:"'Inter',sans-serif",textAlign:"right"}}>{commStars?.label||""} · Community</div>
            </>) : (<>
              <div style={{display:"flex",gap:"2px",justifyContent:"flex-end"}}>
                {[1,2,3,4,5].map(i=><svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.5" opacity="0.2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}
              </div>
              <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"3px",fontFamily:"'Inter',sans-serif",textAlign:"right"}}>No ratings yet</div>
            </>)}
          </div>
        </div>

        {/* ── 4. Attribute rows ── */}
        <div style={{marginBottom:"0.5rem"}}>
          <div style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0",borderBottom:`0.5px solid ${T.border}`}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.5" style={{flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span style={{fontSize:"0.8rem",color:T.textMid,flex:1,fontFamily:"'Inter',sans-serif"}}>Flagged ingredients</span>
            <span style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{(modalCloggers.length+modalIrritants.length)>0?`${modalCloggers.length+modalIrritants.length} flagged`:"None found"}</span>
            <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:(modalCloggers.length+modalIrritants.length)>2?T.rose:(modalCloggers.length+modalIrritants.length)>0?T.amber:T.sage}}/>
          </div>
          {product.skinTypes?.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0",borderBottom:`0.5px solid ${T.border}`}}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.5" style={{flexShrink:0}}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <span style={{fontSize:"0.8rem",color:T.textMid,flex:1,fontFamily:"'Inter',sans-serif"}}>Skin types</span>
              <span style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{product.skinTypes.join(", ")}</span>
              <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:T.sage}}/>
            </div>
          )}
          {followersWhoUse.length>0&&(
            <div style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0",borderBottom:`0.5px solid ${T.border}`}}>
              <div style={{display:"flex",flexShrink:0}}>
                {followersWhoUse.slice(0,3).map((u,i)=>{
                  const isSeed=u.uid?.startsWith("seed_");
                  return <div key={u.uid} onClick={()=>{if(!isSeed&&onUserTap){onClose();onUserTap(u.uid);}}} style={{width:24,height:24,borderRadius:"50%",overflow:"hidden",border:`2px solid ${T.surface}`,marginLeft:i>0?-7:0,background:T.accent+"22",flexShrink:0,cursor:(!isSeed&&onUserTap)?"pointer":"default",zIndex:10-i,position:"relative"}}>
                    {u.photoURL?<img src={u.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:T.accent,fontSize:"0.5rem",fontWeight:"700",color:"#fff"}}>{(u.displayName||"?")[0].toUpperCase()}</div>}
                  </div>;
                })}
              </div>
              <button onClick={()=>{if(followersWhoUse.length===1&&!followersWhoUse[0].uid?.startsWith("seed_")&&onUserTap){onClose();onUserTap(followersWhoUse[0].uid);}else{setShowFriendsList(v=>!v);}}} style={{flex:1,background:"none",border:"none",padding:0,cursor:"pointer",textAlign:"left"}}>
                <span style={{fontSize:"0.8rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>
                  {followersWhoUse.length===1?<><b style={{color:T.text}}>{followersWhoUse[0].displayName?.split(" ")[0]}</b> uses this</>:<><b style={{color:T.text}}>{followersWhoUse.slice(0,2).map(f=>f.displayName?.split(" ")[0]).join(" & ")}</b> use this</>}
                </span>
              </button>
              <div style={{width:8,height:8,borderRadius:"50%",flexShrink:0,background:T.sage}}/>
            </div>
          )}
          {showFriendsList&&followersWhoUse.length>1&&(
            <div style={{paddingBottom:"0.5rem",borderBottom:`0.5px solid ${T.border}`}}>
              {followersWhoUse.map(u=>{const isSeed=u.uid?.startsWith("seed_");return(
                <button key={u.uid} onClick={()=>{if(!isSeed&&onUserTap){onClose();onUserTap(u.uid);}}} style={{width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",background:"none",border:"none",cursor:(!isSeed&&onUserTap)?"pointer":"default",padding:"0.35rem 0",textAlign:"left"}}>
                  <div style={{width:26,height:26,borderRadius:"50%",overflow:"hidden",background:T.accent+"22",flexShrink:0}}>{u.photoURL?<img src={u.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>:<div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",background:T.accent,fontSize:"0.5rem",fontWeight:"700",color:"#fff"}}>{(u.displayName||"?")[0].toUpperCase()}</div>}</div>
                  <span style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{u.displayName}</span>
                  {!isSeed&&onUserTap&&<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{marginLeft:"auto",flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>}
                </button>
              );})}
              <button onClick={()=>setShowFriendsList(false)} style={{fontSize:"0.68rem",color:T.textLight,background:"none",border:"none",cursor:"pointer",padding:"0.2rem 0",fontFamily:"'Inter',sans-serif"}}>Show less</button>
            </div>
          )}
        </div>

        {/* ── 5. Action buttons — pill toggle style ── */}
        {user&&(
          <div style={{display:"flex",gap:"0.4rem",paddingTop:"0.75rem",paddingBottom:"1rem",borderBottom:`1px solid ${T.border}`,marginBottom:"1rem"}}>
            {[
              {field:"routine",   active:inRoutine,   label:"Add to Routine", activeLabel:"In Routine ✓"},
              {field:"wantToTry", active:inWantToTry, label:"Want to Try",     activeLabel:"Want to Try ✓"},
              {field:"brokeout",  active:inBrokeout,  label:"Broke Me Out",    activeLabel:"Broke Out ✓"},
            ].map(({field,active,label,activeLabel})=>(
              <button key={field} onClick={()=>toggleList(field,active)}
                style={{flex:1,padding:"0.6rem 0.2rem",background:active?T.navy:"transparent",color:active?"#fff":T.textMid,border:`1px solid ${active?T.navy:T.border}`,borderRadius:"999px",fontSize:"0.7rem",fontWeight:active?"600":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.18s",minWidth:0,textAlign:"center",letterSpacing:active?"-0.01em":"0"}}>
                {active?activeLabel:label}
              </button>
            ))}
          </div>
        )}

        {/* ── 6. Shop + Share ── */}
        <div style={{display:"flex",gap:"0.5rem",marginBottom:"1rem"}}>
          <a href={buyUrl} target="_blank" rel="noopener noreferrer"
            onClick={()=>trackProductClick(product._productId||product.id||null,product.productName||product.name||"")}
            style={{flex:1,padding:"0.75rem",background:T.navy,color:"#FFFFFF",borderRadius:"0.75rem",fontSize:"0.88rem",fontWeight:"700",textAlign:"center",textDecoration:"none",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Shop
          </a>
          <button onClick={()=>shareProduct(product.productName||product.name||"",product.brand||"")} style={{padding:"0.75rem 1.1rem",background:"transparent",border:`1.5px solid ${T.border}`,borderRadius:"0.75rem",color:T.textMid,cursor:"pointer",display:"flex",alignItems:"center",gap:"0.35rem",fontFamily:"'Inter',sans-serif",fontSize:"0.85rem",fontWeight:"600"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
        </div>

        {/* ── 7. Why this score? (collapsed by default) ── */}
        {product.ingredients&&liveScore!==null&&(()=>{
          const cloggers=modalCloggers.slice(0,5);
          const irritants=modalIrritants.slice(0,3);
          const safeHighlights=(()=>{
            if(!product.ingredients)return[];
            const res=analyzeIngredients(product.ingredients);
            return(res.found||[]).filter(i=>i.score===0&&!i.irritant).filter(i=>["niacinamide","hyaluronic acid","sodium hyaluronate","ceramide","glycerin","centella asiatica","salicylic acid","retinol","panthenol","allantoin","squalane","zinc pca","azelaic acid","tranexamic acid","vitamin c","ascorbic acid","alpha-arbutin"].includes(i.name.toLowerCase())).slice(0,3);
          })();
          const sentence=(()=>{
            if(liveScore===0&&!cloggers.length)return safeHighlights.length?`Clean formula — no pore-clogging ingredients. Contains ${safeHighlights.map(i=>i.name).join(", ")}.`:"No pore-clogging ingredients detected in this formula.";
            if(cloggers.length===1){const c=cloggers[0];return`Scored ${liveScore}/5 because it contains ${c.name}, which is ${c.score>=4?"highly likely":c.score===3?"moderately likely":"likely"} to clog pores.`;}
            const w=cloggers[0];return`Scored ${liveScore}/5 — primarily due to ${w?.name}${cloggers.length>1?` and ${cloggers.length-1} other ingredient${cloggers.length>2?"s":""}`:""} known to clog pores.`;
          })();
          return(
            <div style={{marginBottom:"1rem"}}>
              <button onClick={()=>setWhyScoreOpen(o=>!o)} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.7rem 0.9rem",background:ps.color+"0D",border:`1px solid ${ps.color}30`,borderRadius:whyScoreOpen?"0.75rem 0.75rem 0 0":"0.75rem",cursor:"pointer",textAlign:"left"}}>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ps.color} strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>Why this score?</span>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2.5" style={{transform:whyScoreOpen?"rotate(180deg)":"none",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              {whyScoreOpen&&(
                <div style={{border:`1px solid ${T.border}`,borderTop:"none",borderRadius:"0 0 0.75rem 0.75rem",padding:"0.85rem 0.9rem",background:T.surface}}>
                  <p style={{fontSize:"0.8rem",color:T.textMid,lineHeight:1.55,margin:"0 0 0.9rem"}}>{sentence}</p>

                  {/* Watch out for — flagged + irritants combined */}
                  {(cloggers.length>0||irritants.length>0)&&(
                    <div style={{marginBottom:"0.85rem"}}>
                      <div style={{fontSize:"0.58rem",fontWeight:"600",color:T.rose,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:"0.45rem"}}>Watch out for</div>
                      <div style={{display:"flex",flexDirection:"column"}}>
                        {cloggers.map((ing,i)=>(
                          <div key={"c"+i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.42rem 0",borderBottom:`0.5px solid ${T.border}`}}>
                            <div style={{width:7,height:7,borderRadius:"50%",background:ing.score>=3?T.rose:T.amber,flexShrink:0,marginTop:"0.28rem"}}/>
                            <div style={{flex:1}}>
                              <span style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,textTransform:"capitalize"}}>{ing.name}</span>
                              <span style={{fontSize:"0.72rem",color:T.textMid,marginLeft:"0.4rem"}}>{ing.note||"Pore-clogging"}</span>
                            </div>
                          </div>
                        ))}
                        {irritants.map((ing,i)=>(
                          <div key={"ir"+i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.42rem 0",borderBottom:`0.5px solid ${T.border}`}}>
                            <div style={{width:7,height:7,borderRadius:"50%",background:T.amber,flexShrink:0,marginTop:"0.28rem"}}/>
                            <div style={{flex:1}}>
                              <span style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,textTransform:"capitalize"}}>{ing.name}</span>
                              <span style={{fontSize:"0.72rem",color:T.textMid,marginLeft:"0.4rem"}}>{ing.note||"Potential irritant"}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Works in your favour — beneficial ingredients */}
                  {safeHighlights.length>0&&(
                    <div>
                      <div style={{fontSize:"0.58rem",fontWeight:"600",color:T.sage,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:"0.45rem"}}>Works in your favour</div>
                      <div style={{display:"flex",flexDirection:"column"}}>
                        {safeHighlights.map((ing,i)=>(
                          <div key={"g"+i} style={{display:"flex",alignItems:"flex-start",gap:"0.55rem",padding:"0.42rem 0",borderBottom:i<safeHighlights.length-1?`0.5px solid ${T.border}`:"none"}}>
                            <div style={{width:7,height:7,borderRadius:"50%",background:T.sage,flexShrink:0,marginTop:"0.28rem"}}/>
                            <div style={{flex:1}}>
                              <span style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,textTransform:"capitalize"}}>{ing.name}</span>
                              <span style={{fontSize:"0.72rem",color:T.textMid,marginLeft:"0.4rem"}}>{INGDB_META[ing.name.toLowerCase()]?.benefit||ing.note||""}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All clear */}
                  {!cloggers.length&&!irritants.length&&(
                    <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                      <div style={{width:7,height:7,borderRadius:"50%",background:T.sage,flexShrink:0}}/>
                      <span style={{fontSize:"0.78rem",color:T.sage,fontWeight:"600"}}>No flagged ingredients — pore-safe formula</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── 8. Rate this product ── */}
        {user&&(
          <div style={{paddingTop:"0.75rem",paddingBottom:"1rem",borderTop:`1px solid ${T.border}`,borderBottom:`1px solid ${T.border}`,marginBottom:"1rem"}}>
            <div style={{fontSize:"0.6rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:"700",marginBottom:"0.6rem",fontFamily:"'Inter',sans-serif"}}>
              {submitted?"Rating saved! ✓":existingRating?`Your rating: ${existingRating/2}/5 stars — tap to update`:"Rate this product"}
            </div>
            {loadingExisting?<div style={{height:"36px",borderRadius:"0.75rem"}} className="skeleton"/>:(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{display:"flex",gap:"0.15rem"}}>
                  {[2,4,6,8,10].map(val=>{
                    const filled=(myCommunityRating||existingRating||0)>=val;
                    return(<button key={val} onClick={()=>setMyCommunityRating(myCommunityRating===val?0:val)} style={{background:"none",border:"none",cursor:"pointer",padding:"0.1rem",lineHeight:1,transition:"transform 0.1s"}} onMouseEnter={e=>e.currentTarget.style.transform="scale(1.2)"} onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                      <svg width="32" height="32" viewBox="0 0 24 24" strokeWidth="1.5" fill={filled?"#F59E0B":"none"} stroke={filled?"#F59E0B":"#D1D5DB"}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    </button>);
                  })}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  {myCommunityRating>0&&<span style={{fontSize:"0.78rem",fontWeight:"700",color:"#F59E0B"}}>{myCommunityRating/2}/5</span>}
                  <button onClick={submitRating} disabled={submitting||!myCommunityRating} style={{width:"34px",height:"34px",borderRadius:"50%",background:myCommunityRating?T.accent:T.surfaceAlt,border:"none",cursor:myCommunityRating?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                    {submitting?<div style={{width:"10px",height:"10px",borderRadius:"50%",border:"2px solid #fff",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>:<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={myCommunityRating?"#fff":T.textLight} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 9. Key Actives + Full Ingredient List ── */}
        {product.ingredients&&product.ingredients.trim()&&(
          <div style={{marginBottom:"1rem",position:"relative"}}>
            <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.25rem"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.navy} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v7.31l-3.24 4.65A3 3 0 0 0 9.24 19H14.76a3 3 0 0 0 2.48-5.04L14 9.31V2"/><line x1="8.5" y1="2" x2="15.5" y2="2"/></svg>
              <div style={{fontSize:"0.6rem",color:T.navy,textTransform:"uppercase",letterSpacing:"0.14em",fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>Full Ingredient List</div>
            </div>
            <div style={{fontSize:"0.58rem",color:T.textLight,marginBottom:"0.5rem",fontFamily:"'Inter',sans-serif"}}>Tap any ingredient to learn more</div>

            <div style={{display:"flex",flexWrap:"wrap",gap:"0.22rem",marginBottom:"0.4rem"}}>
              {product.ingredients.split(",").map((ingRaw,i)=>{
                const trimmed=ingRaw.trim();
                if(!trimmed)return null;
                const key=trimmed.toLowerCase().replace(/\s*\(.*?\)/g,"").trim();
                const dbEntry=INGDB[key]||(()=>{const found=Object.entries(INGDB).find(([k,v])=>{const allNames=[k,...(v.aliases||[])];return allNames.some(n=>n&&n.toLowerCase()===key);});return found?found[1]:null;})();
                const isFlagged=dbEntry&&(dbEntry.score>=1||dbEntry.irritant);
                const isSelected=selectedIngredient?.name===trimmed;
                return(
                  <button key={i} onClick={()=>setSelectedIngredient(isSelected?null:{name:trimmed,irritant:dbEntry?.irritant,score:dbEntry?.score??0})}
                    style={{fontSize:"0.6rem",padding:"0.18rem 0.55rem",borderRadius:20,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.12s",border:isSelected?`1.5px solid ${T.navy}`:"none",background:isSelected?(isFlagged?"#FAECE7":T.accentSoft):isFlagged?"#FAECE7":T.surfaceAlt,color:isFlagged?"#712B13":isSelected?T.navy:T.textMid,fontWeight:isFlagged?"600":"400",outline:"none"}}>
                    {trimmed}{isFlagged?" ⚠":""}
                  </button>
                );
              })}
            </div>
            <div style={{fontSize:"0.56rem",color:T.textLight,fontStyle:"italic",fontFamily:"'Inter',sans-serif"}}>⚠ flagged ingredients may clog pores or irritate</div>

            {selectedIngredient&&<IngredientDetailSheet ing={selectedIngredient} onClose={()=>setSelectedIngredient(null)}/>}
          </div>
        )}

        {/* ── 10. Report wrong ingredients (subtle, at the bottom) ── */}
        {user&&product.ingredients&&(()=>{
          const lowConfidence=(product.ingredients||"").split(",").length<8;
          async function submitReport(){
            if(!reportText.trim())return;
            setReportState("sending");
            try{
              await addDoc(collection(db,"ingredientReports"),{productName:product.productName||product.name||"",brand:product.brand||"",productId:product._productId||product.id||"",currentIngredients:product.ingredients||"",reportText:reportText.trim(),reportedBy:user.uid,reporterName:profile?.displayName||"",createdAt:serverTimestamp(),status:"pending"});
              setReportState("sent");
            }catch{setReportState("editing");}
          }
          return(
            <div style={{paddingTop:"0.75rem",borderTop:`1px solid ${T.border}`}}>
              {reportState==="sent"
                ?<div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.6rem 0.75rem",background:T.sage+"12",borderRadius:"0.65rem",border:`1px solid ${T.sage}25`}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style={{fontSize:"0.75rem",color:T.sage,fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>Thanks — we'll review and update this</span></div>
                :reportState==="editing"
                ?<div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}><div style={{fontSize:"0.68rem",color:T.textLight,lineHeight:1.4}}>Paste the correct ingredient list from the packaging or brand website:</div><textarea value={reportText} onChange={e=>setReportText(e.target.value)} placeholder="Aqua, Glycerin, Niacinamide…" rows={4} style={{width:"100%",padding:"0.6rem 0.75rem",borderRadius:"0.6rem",border:`1.5px solid ${T.accent}`,fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none",resize:"vertical",boxSizing:"border-box",lineHeight:1.5}}/><div style={{display:"flex",gap:"0.5rem"}}><button onClick={submitReport} disabled={!reportText.trim()||reportState==="sending"} style={{flex:1,padding:"0.6rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.78rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>{reportState==="sending"?"Sending…":"Submit correction"}</button><button onClick={()=>setReportState("idle")} style={{padding:"0.6rem 0.85rem",background:T.surfaceAlt,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.78rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Cancel</button></div></div>
                :<button onClick={()=>setReportState("editing")} style={{display:"flex",alignItems:"center",gap:"0.4rem",background:"none",border:"none",cursor:"pointer",padding:"0.2rem 0",fontFamily:"'Inter',sans-serif"}}>
                  {lowConfidence&&<span style={{fontSize:"0.6rem",color:T.amber,background:T.amber+"15",padding:"0.1rem 0.4rem",borderRadius:"999px",border:`1px solid ${T.amber}30`,fontWeight:"700",marginRight:"0.15rem"}}>⚠ Low confidence</span>}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span style={{fontSize:"0.7rem",color:T.textLight}}>Ingredients look wrong? Report a correction</span>
                </button>
              }
            </div>
          );
        })()}

      </div>
    </div>
  );
}

// ── AuthPage ──────────────────────────────────────────────────
// ── Onboarding Flow ───────────────────────────────────────────
function OnboardingFlow({user, profile, onComplete}) {
  const [step, setStep] = useState(0);
  const [skinTypes, setSkinTypes] = useState([]);
  const [concerns, setConcerns] = useState([]);
  const [displayName, setDisplayName] = useState(user?.displayName||"");
  const [pronoun, setPronoun] = useState("");
  const [saving, setSaving] = useState(false);
  const [followed, setFollowed] = useState(new Set());
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [loadingSuggested, setLoadingSuggested] = useState(false);

  const skinTypeOptions = ["Normal","Dry","Oily","Combination","Sensitive","Acne-prone"];
  const concernOptions  = ["Acne","Blackheads","Redness","Dark spots","Anti-aging","Dullness","Large pores","Dryness"];

  function toggle(arr, setArr, val) {
    setArr(prev => prev.includes(val) ? prev.filter(x=>x!==val) : [...prev,val]);
  }

  // Load suggested users when we reach the follow step
  async function loadSuggested() {
    if (suggestedUsers.length) return;
    setLoadingSuggested(true);
    try {
      const snap = await getDocs(query(collection(db,"users"), limit(50)));
      const all = snap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==user.uid && u.displayName);
      // Prioritise: founders first, then skin-type matches, then follower count
      const FOUNDER_EMAILS = ["mckenzierichard77@gmail.com","morganrichard777@gmail.com"];
      const scored = all.map(u=>{
        const uSkins = Array.isArray(u.skinType)?u.skinType:[u.skinType].filter(Boolean);
        const overlap = skinTypes.filter(s=>uSkins.includes(s)).length;
        const isFounder = FOUNDER_EMAILS.includes(u.email);
        return {...u, _score: (isFounder?1000:0) + overlap*10 + (u.followers?.length||0)};
      }).sort((a,b)=>b._score-a._score).slice(0,8);
      setSuggestedUsers(scored);
    } catch(e) { console.error(e); }
    setLoadingSuggested(false);
  }

  async function handleFollow(uid) {
    try {
      await followUser(user.uid, uid, profile?.displayName||"Someone", profile?.photoURL||"");
      setFollowed(prev=>new Set([...prev,uid]));
    } catch {}
  }

  async function finish() {
    setSaving(true);
    await onComplete({skinType: skinTypes, concerns, displayName: displayName.trim()||undefined});
  }

  const FollowStep = (
    <div style={{marginTop:"1rem"}}>
      {loadingSuggested ? (
        <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.82rem"}}>Finding people for you…</div>
      ) : suggestedUsers.length === 0 ? (
        <div style={{textAlign:"center",padding:"1.5rem",color:T.textLight,fontSize:"0.82rem"}}>No suggestions yet — you can follow people from the Feed.</div>
      ) : (
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
          {suggestedUsers.map(u=>{
            const uSkins = Array.isArray(u.skinType)?u.skinType:[u.skinType].filter(Boolean);
            const skinMatch = skinTypes.filter(s=>uSkins.includes(s));
            const isFollowed = followed.has(u.uid);
            return (
              <div key={u.uid} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.7rem 0.85rem",background:T.surface,borderRadius:"0.85rem",border:`1px solid ${isFollowed?T.sage+"44":T.border}`,transition:"border-color 0.2s"}}>
                <Avatar photoURL={u.photoURL} name={u.displayName} size={40}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.displayName}</div>
                  <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>
                    {skinMatch.length > 0
                      ? <span style={{color:T.sage,fontWeight:"600"}}>✓ {skinMatch.join(", ")} skin</span>
                      : <span>{u.followers?.length||0} followers</span>
                    }
                  </div>
                </div>
                <button onClick={()=>handleFollow(u.uid)} disabled={isFollowed}
                  style={{padding:"0.35rem 0.9rem",background:isFollowed?T.sage+"18":"#111827",color:isFollowed?T.sage:"#fff",border:`1.5px solid ${isFollowed?T.sage+"44":"#111827"}`,borderRadius:"999px",fontSize:"0.72rem",fontWeight:"600",cursor:isFollowed?"default":"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0,transition:"all 0.15s"}}>
                  {isFollowed ? "✓ Following" : "Follow"}
                </button>
              </div>
            );
          })}
          <div style={{textAlign:"center",fontSize:"0.68rem",color:T.textLight,marginTop:"0.25rem"}}>
            {followed.size} of 3 recommended · you can always follow more from the Feed
          </div>
        </div>
      )}
    </div>
  );

  const poreExamples = [
    {label:"CeraVe Moisturiser",score:0,color:"#22C55E"},
    {label:"Coconut Oil",score:4,color:"#EF4444"},
    {label:"The Ordinary Niacinamide",score:0,color:"#22C55E"},
    {label:"Isopropyl Myristate",score:5,color:"#DC2626"},
  ];

  const steps = [
    {
      title: "Real people. Real skin.\nReal insights.",
      subtitle: "Ralli checks every ingredient in your skincare for pore-clogging risk — so you finally know what's breaking you out.",
      content: (
        <div style={{marginTop:"1.5rem"}}>
          <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginBottom:"1.25rem"}}>
            {[
              {icon:"📸", text:"Scan any product barcode"},
              {icon:"🔬", text:"See every ingredient scored 0–5"},
              {icon:"💬", text:"Learn what real people with your skin think"},
            ].map((item,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.85rem",background:T.surfaceAlt,borderRadius:"0.75rem",border:`1px solid ${T.border}`}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{item.icon}</span>
                <span style={{fontSize:"0.82rem",color:T.text,fontFamily:"'Inter',sans-serif",fontWeight:"500"}}>{item.text}</span>
              </div>
            ))}
          </div>
          <div style={{padding:"0.75rem 1rem",background:`linear-gradient(135deg,${T.accent}10,${T.blush}20)`,borderRadius:"0.85rem",border:`1px solid ${T.accent}20`}}>
            <div style={{fontSize:"0.68rem",color:T.textLight,fontFamily:"'Inter',sans-serif",fontStyle:"italic",lineHeight:1.5,textAlign:"center"}}>
              "We broke out from products we trusted. So we built the app we wish we had."
              <br/><span style={{fontWeight:"600",color:T.accent,fontStyle:"normal"}}>— McKenzie & Morgan, Founders</span>
            </div>
          </div>
        </div>
      ),
      cta: "Get started →",
    },
    {
      title: "What's your skin type?",
      subtitle: "Select all that apply — we'll personalise your recommendations.",
      content: (
        <div style={{marginTop:"1.5rem"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",justifyContent:"center",marginBottom:"1rem"}}>
            {skinTypeOptions.map(t=>{
              const on = skinTypes.includes(t);
              const icons = {Normal:"🌿",Dry:"🏜️",Oily:"💧",Combination:"☯️",Sensitive:"🌸","Acne-prone":"🎯"};
              return <button key={t} onClick={()=>toggle(skinTypes,setSkinTypes,t)}
                style={{padding:"0.6rem 1rem",borderRadius:"999px",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",background:on?T.accent:T.surface,color:on?"#FFFFFF":T.textMid,border:`1.5px solid ${on?T.accent:T.border}`,transition:"all 0.15s",fontWeight:on?"600":"400",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <span>{icons[t]||""}</span>{t}
              </button>;
            })}
          </div>
          {skinTypes.length > 0 && (
            <div style={{textAlign:"center",fontSize:"0.7rem",color:T.sage,fontWeight:"600"}}>
              ✓ {skinTypes.join(" · ")} selected
            </div>
          )}
        </div>
      ),
      cta: skinTypes.length>0 ? "Next →" : "Skip",
    },
    {
      title: "Any skin concerns?",
      subtitle: "We'll flag ingredients that matter most for your skin.",
      content: (
        <div style={{marginTop:"1.5rem"}}>
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.5rem",justifyContent:"center",marginBottom:"1rem"}}>
            {concernOptions.map(c=>{
              const on = concerns.includes(c);
              const icons = {Acne:"🎯",Blackheads:"🔬",Redness:"🌹","Dark spots":"🌑","Anti-aging":"⏳",Dullness:"✨","Large pores":"🔍",Dryness:"💧"};
              return <button key={c} onClick={()=>toggle(concerns,setConcerns,c)}
                style={{padding:"0.6rem 1rem",borderRadius:"999px",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",background:on?T.accent:T.surface,color:on?"#FFFFFF":T.textMid,border:`1.5px solid ${on?T.accent:T.border}`,transition:"all 0.15s",fontWeight:on?"600":"400",display:"flex",alignItems:"center",gap:"0.3rem"}}>
                <span>{icons[c]||""}</span>{c}
              </button>;
            })}
          </div>
          {concerns.length > 0 && (
            <div style={{textAlign:"center",fontSize:"0.7rem",color:T.sage,fontWeight:"600"}}>
              ✓ {concerns.length} concern{concerns.length!==1?"s":""} selected
            </div>
          )}
        </div>
      ),
      cta: concerns.length > 0 ? "Next →" : "Skip",
    },
    {
      title: "What's your name?",
      subtitle: "This is how you'll appear to others on Ralli.",
      content: (
        <div style={{marginTop:"1.5rem"}}>
          <input
            value={displayName}
            onChange={e=>setDisplayName(e.target.value)}
            placeholder="Your name"
            autoFocus
            style={{width:"100%",padding:"0.85rem 1rem",borderRadius:"0.85rem",border:`1.5px solid ${T.border}`,fontSize:"1rem",color:T.text,background:"rgba(255,255,255,0.08)",outline:"none",fontFamily:"'Inter',sans-serif",color:"#fff",caretColor:"#fff"}}
            onFocus={e=>{e.target.style.borderColor=T.sage;}}
            onBlur={e=>{e.target.style.borderColor=T.border;}}
          />
          {displayName.trim().length > 0 && (
            <div style={{textAlign:"center",fontSize:"0.7rem",color:T.sage,fontWeight:"600",marginTop:"0.75rem"}}>
              ✓ Hi {displayName.trim()}!
            </div>
          )}
        </div>
      ),
      cta: displayName.trim().length > 0 ? "Next →" : "Skip →",
    },
    {
      title: "Follow people on Ralli",
      subtitle: "Start with the GoodSisters founders and people who share your skin type.",
      content: FollowStep,
      cta: saving ? "Saving…" : followed.size >= 1 ? "Let's go 🎉" : "Skip for now →",
      isLast: true,
    },
  ];

  const s = steps[step];

  return (
    <div style={{minHeight:"100vh",background:`linear-gradient(160deg,${T.navy} 0%,#1e2d4a 40%,${T.bg} 100%)`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1.5rem"}}>
      <div style={{width:"100%",maxWidth:"400px"}}>

        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:"900",fontSize:"2.8rem",color:"#ffffff",letterSpacing:"-0.04em",lineHeight:1}}>Ralli</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"300",fontSize:"0.65rem",color:"rgba(255,255,255,0.5)",letterSpacing:"0.25em",textTransform:"uppercase",marginTop:"0.3rem"}}>by GoodSisters</div>
        </div>

        {/* Progress dots */}
        <div style={{display:"flex",gap:"0.4rem",justifyContent:"center",marginBottom:"1.5rem"}}>
          {steps.map((_,i)=>(
            <div key={i} style={{width:i===step?"1.75rem":"0.4rem",height:"0.4rem",borderRadius:"999px",background:i<=step?"rgba(255,255,255,0.9)":"rgba(255,255,255,0.2)",transition:"all 0.3s"}}/>
          ))}
        </div>

        {/* Card */}
        <div style={{background:"#ffffff",borderRadius:"2rem",padding:"2rem 1.75rem",boxShadow:"0 20px 60px rgba(0,0,0,0.25)"}} className="fu">
          <div style={{fontSize:"1.35rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.02em",marginBottom:"0.5rem",lineHeight:1.25,whiteSpace:"pre-line",textAlign:"center"}}>{s.title}</div>
          <div style={{fontSize:"0.82rem",color:T.textMid,lineHeight:1.6,textAlign:"center"}}>{s.subtitle}</div>
          {s.content}
        </div>

        <button onClick={()=>{ if(s.isLast) finish(); else { if(s.onNext) s.onNext(); setStep(s=>s+1); } }}
          disabled={saving}
          style={{width:"100%",marginTop:"1rem",padding:"1rem",background:"#ffffff",color:T.navy,border:"none",borderRadius:"2rem",fontSize:"1rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",opacity:saving?0.6:1,boxShadow:"0 4px 20px rgba(0,0,0,0.15)"}}>
          {s.cta}
        </button>

        {step>0&&(
          <button onClick={()=>setStep(s=>s-1)}
            style={{width:"100%",marginTop:"0.5rem",padding:"0.7rem",background:"transparent",color:"rgba(255,255,255,0.5)",border:"none",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}

function AuthPage() {
  const [mode, setMode]         = useState("login");
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function sendReset() {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setLoading(true); setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch(e) {
      setError(e.code==="auth/user-not-found" ? "No account found with that email." : "Could not send reset email. Try again.");
    }
    setLoading(false);
  }

  const inp = {width:"100%",padding:"0.85rem 1rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.9rem",fontFamily:"'Inter',sans-serif",color:T.text,background:"#FFFFFF",outline:"none",transition:"border-color 0.15s"};

  function friendly(code) {
    if (code==="auth/email-already-in-use") return "An account with this email already exists.";
    if (code==="auth/invalid-email")        return "Please enter a valid email address.";
    if (code==="auth/weak-password")        return "Password must be at least 6 characters.";
    if (code==="auth/invalid-credential")   return "Incorrect email or password.";
    return "Something went wrong. Please try again.";
  }

  async function submit() {
    setError(""); setLoading(true);
    try {
      if (mode==="signup") {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth,email,password);
        await updateProfile(cred.user,{displayName:name.trim()});
      } else {
        await signInWithEmailAndPassword(auth,email,password);
      }
    } catch(e) { setError(friendly(e.code)); }
    finally { setLoading(false); }
  }

  async function google() {
    setError(""); setLoading(true);
    try { await signInWithPopup(auth,gProvider); }
    catch(e) { if(e.code!=="auth/popup-closed-by-user") setError("Google sign-in failed."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",flexDirection:"column"}}>
      {/* Auth header — clean minimal */}
      <div style={{padding:"2.5rem 2rem 1.5rem",textAlign:"center",borderBottom:`1px solid ${T.border}`}}>
        <div style={{lineHeight:1}}>
          <div style={{fontFamily:"'Poppins',sans-serif",fontWeight:"900",fontSize:"3rem",color:T.navy,letterSpacing:"-0.04em",lineHeight:1}}>Ralli</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"300",fontSize:"0.72rem",color:T.textLight,letterSpacing:"0.22em",textTransform:"uppercase",marginTop:"0.4rem"}}>by GoodSisters</div>
        </div>
        <div style={{width:"32px",height:"1px",background:T.border,margin:"0.75rem auto"}}/>
        <div style={{fontSize:"0.58rem",color:T.textLight,letterSpacing:"0.04em",textTransform:"uppercase",fontFamily:"'Inter',sans-serif",fontWeight:"400"}}>
          Real people. Real skin. Real insights.
        </div>
      </div>

      {/* Auth card */}
      <div style={{flex:1,display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"2rem 1.5rem"}}>
      <div style={{width:"100%",maxWidth:"380px",background:T.surface,borderRadius:"1rem",border:`1px solid ${T.border}`,padding:"1.75rem",boxShadow:"0 4px 24px rgba(17,24,39,0.06)"}}>
        <div style={{display:"flex",gap:"0",marginBottom:"1.75rem",borderBottom:`1px solid ${T.border}`}}>
          {["login","signup"].map(m=>(
            <button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,padding:"0.65rem 0.5rem",background:"transparent",color:mode===m?T.navy:T.textLight,border:"none",borderBottom:`2px solid ${mode===m?T.navy:"transparent"}`,fontSize:"0.8rem",fontFamily:"'Inter',sans-serif",cursor:"pointer",fontWeight:mode===m?"600":"400",transition:"all 0.15s",letterSpacing:"0.02em",marginBottom:"-1px"}}>
              {m==="login"?"Log in":"Create account"}
            </button>
          ))}
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:"0.65rem"}}>
          {mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" style={inp} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>}
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={inp} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" style={inp} onKeyDown={e=>e.key==="Enter"&&submit()} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
        </div>
        {mode==="login"&&(
          <div style={{textAlign:"right",marginTop:"0.4rem"}}>
            {resetSent
              ? <span style={{fontSize:"0.72rem",color:T.sage}}>✓ Reset email sent — check your inbox</span>
              : <button onClick={sendReset} disabled={loading} style={{background:"none",border:"none",cursor:"pointer",fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif",padding:0,textDecoration:"underline",textDecorationColor:T.border}}>Forgot password?</button>
            }
          </div>
        )}
        {error&&<div style={{marginTop:"0.75rem",padding:"0.65rem 0.9rem",background:"#FBF0EE",border:`1px solid ${T.rose}44`,borderRadius:"0.5rem",fontSize:"0.78rem",color:T.rose}}>{error}</div>}
        <button onClick={submit} disabled={loading} style={{width:"100%",marginTop:"1.25rem",padding:"0.85rem",background:T.navy,color:"#FFFFFF",border:"none",borderRadius:"0.65rem",fontSize:"0.88rem",fontWeight:"500",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:"0.03em",opacity:loading?0.7:1,transition:"opacity 0.15s"}}>
          {loading?"Please wait…":mode==="login"?"Log in →":"Create account →"}
        </button>
        {mode==="signup"&&(
          <div style={{marginTop:"0.9rem",fontSize:"0.72rem",color:T.textLight,textAlign:"center",lineHeight:1.6}}>
            By creating an account, you agree to our{" "}
            <a href="https://theralliapp.com/terms.html" target="_blank" rel="noopener noreferrer"
              style={{color:T.textMid,textDecoration:"underline",textDecorationColor:T.border,cursor:"pointer"}}>
              Terms of Service
            </a>
            {" "}and{" "}
            <a href="https://theralliapp.com/privacy.html" target="_blank" rel="noopener noreferrer"
              style={{color:T.textMid,textDecoration:"underline",textDecorationColor:T.border,cursor:"pointer"}}>
              Privacy Policy
            </a>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem",margin:"1.25rem 0"}}>
          <div style={{flex:1,height:"1px",background:T.border}}/><span style={{fontSize:"0.72rem",color:T.textLight}}>or</span><div style={{flex:1,height:"1px",background:T.border}}/>
        </div>
        <button onClick={google} disabled={loading} style={{width:"100%",padding:"0.8rem",background:T.surface,color:T.text,border:`1px solid ${T.border}`,borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"500",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.6rem"}}
          onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent} onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
          <svg width="18" height="18" viewBox="0 0 48 48">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continue with Google
        </button>
      </div>
      </div>{/* end auth card wrapper */}
    </div>
  );
}

// ── UserPage ──────────────────────────────────────────────────
// ── FollowListItem — loads a user by UID and renders them tappable ──
function FollowListItem({ uid, onTap }) {
  const [u, setU] = React.useState(null);
  React.useEffect(() => {
    getDoc(doc(db, "users", uid)).then(d => d.exists() && setU({uid:d.id,...d.data()})).catch(()=>{});
  }, [uid]);
  if (!u) return <div style={{height:"52px",borderRadius:"0.75rem",marginBottom:"0.5rem"}} className="skeleton"/>;
  const GENERIC = ["skincare lover","anonymous","user","undefined","null",""];
  if (GENERIC.includes((u.displayName||"").toLowerCase().trim())) return null;
  return (
    <button onClick={()=>onTap(uid)} style={{width:"100%",display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.6rem 0.5rem",background:"none",border:"none",cursor:"pointer",borderBottom:`1px solid ${T.border}`,textAlign:"left"}}>
      <Avatar photoURL={u.photoURL} name={u.displayName} size={38}/>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.displayName||"Ralli User"}</div>
        <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>{(u.followers||[]).length} followers</div>
      </div>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

function UserPage({uid, currentUid, currentProfile, onUpdateProfile, onBack, onUserTap}) {
  const [profile, setProfile]   = useState(null);
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showFollowList, setShowFollowList] = useState(null);
  const isMe = uid === currentUid;
  const isFollowing = (currentProfile?.following||[]).includes(uid);

  useEffect(()=>{
    async function load() {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db,"users",uid));
        if (snap.exists()) setProfile(snap.data());
        const p = await getUserPosts(uid);
        setPosts(p);
      } catch {}
      setLoading(false);
    }
    load();
  },[uid]);

  async function handleFollow() {
    if (isFollowing) {
      await unfollowUser(currentUid, uid, currentProfile?.displayName||"Someone", currentProfile?.photoURL||"");
      onUpdateProfile(p=>({...p, following:(p.following||[]).filter(id=>id!==uid)}));
    } else {
      await followUser(currentUid, uid, currentProfile?.displayName||"Someone", currentProfile?.photoURL||"");
      onUpdateProfile(p=>({...p, following:[...(p.following||[]),uid]}));
    }
  }

  if (loading) return <div style={{padding:"3rem",textAlign:"center",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>;
  if (!profile) return <div style={{padding:"3rem",textAlign:"center",color:T.textLight}}>User not found</div>;

  return (
    <>
    <div style={{maxWidth:"480px",margin:"0 auto",paddingBottom:"5rem"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.textMid,fontSize:"0.85rem",cursor:"pointer",padding:"1.25rem 1rem 0.5rem",fontFamily:"'Inter',sans-serif"}}>← Back</button>
      <div style={{padding:"0 1rem"}}>
        {/* Profile header */}
        <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.25rem"}}>
          <Avatar photoURL={profile.photoURL} name={profile.displayName} size={64}/>
          <div style={{flex:1}}>
            <div style={{fontSize:"1.35rem",fontWeight:"700",color:T.navy,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.03em"}}>{profile.displayName}</div>
            {profile.bio&&<div style={{fontSize:"0.78rem",color:T.textMid,marginTop:"2px"}}>{profile.bio}</div>}
            <div style={{display:"flex",gap:"1rem",marginTop:"0.5rem"}}>
              <span style={{fontSize:"0.75rem",color:T.textLight}}><b style={{color:T.text}}>{posts.length}</b> posts</span>
              <button onClick={()=>setShowFollowList("followers")} style={{fontSize:"0.75rem",color:T.textLight,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Inter',sans-serif"}}><b style={{color:T.text}}>{(profile.followers||[]).length}</b> followers</button>
              <button onClick={()=>setShowFollowList("following")} style={{fontSize:"0.75rem",color:T.textLight,background:"none",border:"none",cursor:"pointer",padding:0,fontFamily:"'Inter',sans-serif"}}><b style={{color:T.text}}>{(profile.following||[]).length}</b> following</button>
            </div>
          </div>
        </div>
        {!isMe&&(
          <button onClick={handleFollow} style={{width:"100%",padding:"0.65rem",background:isFollowing?T.surfaceAlt:T.accent,color:isFollowing?T.text:"#FFFFFF",border:`1px solid ${isFollowing?T.border:T.accent}`,borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"1.25rem"}}>
            {isFollowing?"Following":"Follow"}
          </button>
        )}

        {/* Their lists (public only) */}
        {profile&&(()=>{
          const priv = profile.listPrivacy||{};
          const lists = [
            {field:"routine",  title:"My Routine",   icon:"", color:T.sage},
            {field:"brokeout", title:"Broke Me Out",  icon:"", color:T.rose},
            {field:"wantToTry",title:"Want to Try",   icon:"", color:T.amber},
          ].filter(l=>!priv[l.field]&&(profile[l.field]||[]).length>0);
          if (!lists.length) return null;
          return (
            <div style={{marginBottom:"1.25rem"}}>
              {lists.map(l=>(
                <ListSection key={l.field} title={l.title} icon={l.icon} color={l.color}
                  items={profile[l.field]||[]} readOnly={true}
                  onItemTap={name=>setSelectedProduct({productName:name,poreScore:0,communityRating:null,image:null,ingredients:"",flaggedIngredients:[]})}/>
              ))}
            </div>
          );
        })()}

        {/* Posts */}
        {posts.length===0
          ? <div style={{textAlign:"center",color:T.textLight,padding:"2rem",fontSize:"0.85rem"}}>No scans yet</div>
          : posts.map(p=><PostCard key={p.id} post={p} currentUid={currentUid} onUserTap={()=>{}} onProductTap={p2=>setSelectedProduct({productName:p2.productName,brand:p2.brand,image:p2.productImage||"",poreScore:p2.poreScore??0,communityRating:p2.communityRating,ingredients:p2.ingredients||"",flaggedIngredients:p2.flaggedIngredients||[]})}/>)
        }
      </div>
    </div>

    {selectedProduct&&(
      <ProductModal
        product={selectedProduct}
        onClose={()=>setSelectedProduct(null)}
        user={{uid:currentUid, displayName:currentProfile?.displayName, photoURL:currentProfile?.photoURL}}
        profile={currentProfile}
        onUpdateProfile={onUpdateProfile}
        onUserTap={onUserTap}
      />
    )}
    {showFollowList && ReactDOM.createPortal(
      <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9000,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}}>
        <div onClick={()=>setShowFollowList(null)} style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.4)",backdropFilter:"blur(4px)"}}/>
        <div style={{position:"relative",width:"100%",maxWidth:"480px",background:T.surface,borderRadius:"1.5rem 1.5rem 0 0",padding:"1.25rem 1.25rem 0",height:"70vh",display:"flex",flexDirection:"column",zIndex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem",flexShrink:0}}>
            <div style={{fontSize:"1rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>
              {showFollowList === "followers" ? "Followers" : "Following"}
              <span style={{fontSize:"0.72rem",fontWeight:"400",color:T.textLight,marginLeft:"0.5rem"}}>
                {(showFollowList === "followers" ? (profile.followers||[]) : (profile.following||[])).length}
              </span>
            </div>
            <button onClick={()=>setShowFollowList(null)} style={{background:T.surfaceAlt,border:"none",cursor:"pointer",color:T.textMid,width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>✕</button>
          </div>
          <div style={{overflowY:"auto",flex:1,paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))"}}>
            {(showFollowList === "followers" ? (profile.followers||[]) : (profile.following||[])).map(uid => (
              <FollowListItem key={uid} uid={uid} onTap={uid=>{setShowFollowList(null); onUserTap?.(uid);}}/>
            ))}
            {(showFollowList === "followers" ? (profile.followers||[]) : (profile.following||[])).length === 0 && (
              <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.82rem"}}>No {showFollowList} yet</div>
            )}
          </div>
        </div>
      </div>
    , document.body)}
    </>
  );
}

// ── ScanPage ──────────────────────────────────────────────────

// ── Add Missing Product Modal ─────────────────────────────────
function AddProductModal({onClose, onAdded, user, prefillBarcode="", prefillName=""}) {
  const [productName, setProductName] = useState(prefillName);
  const [brand, setBrand]             = useState("");
  const [barcode, setBarcode]         = useState(prefillBarcode);
  const [ingredients, setIngredients] = useState("");
  const [saving, setSaving]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [err, setErr]                 = useState("");

  async function handleSave() {
    if (!productName.trim() || !ingredients.trim()) {
      setErr("Product name and ingredients are required."); return;
    }
    setSaving(true); setErr("");
    try {
      const key = (barcode||productName).toLowerCase().trim().replace(/\s+/g,"-");
      await setDoc(doc(db,"community_products", key), {
        barcode: barcode.trim(),
        productName: productName.trim(),
        brand: brand.trim(),
        ingredients: ingredients.trim(),
        addedBy: user?.uid||"anonymous",
        addedByName: user?.displayName||"",
        addedAt: serverTimestamp(),
        verifiedCount: 1,
      });
      setSaved(true);
      setTimeout(()=>{ onAdded({productName:productName.trim(),brand:brand.trim(),ingredients:ingredients.trim(),barcode:barcode.trim()}); onClose(); }, 1200);
    } catch(e) { setErr("Failed to save. Please try again."); }
    finally { setSaving(false); }
  }

  const inp = {width:"100%",padding:"0.75rem 1rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box",marginBottom:"0.75rem"};

  return ReactDOM.createPortal(
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.45)",zIndex:9000,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:T.surface,borderRadius:"1.5rem 1.5rem 0 0",width:"100%",maxWidth:"480px",padding:"1.5rem 1.25rem 2.5rem",maxHeight:"90vh",overflowY:"auto"}} className="fu">
        {/* Handle */}
        <div style={{width:"2.5rem",height:"0.25rem",background:T.border,borderRadius:"999px",margin:"0 auto 1.25rem"}}/>

        <div style={{fontSize:"1.1rem",fontWeight:"700",color:T.text,marginBottom:"0.3rem",fontFamily:"'Inter',sans-serif"}}>Add missing product</div>
        <div style={{fontSize:"0.8rem",color:T.textMid,marginBottom:"1.25rem",lineHeight:1.5}}>
          Help the Ralli community — add this product and everyone benefits instantly.
        </div>

        <div style={{fontSize:"0.72rem",color:T.textMid,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.35rem"}}>Product name *</div>
        <input style={inp} value={productName} onChange={e=>setProductName(e.target.value)} placeholder="e.g. Hydro Boost Water Gel"/>

        <div style={{fontSize:"0.72rem",color:T.textMid,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.35rem"}}>Brand</div>
        <input style={inp} value={brand} onChange={e=>setBrand(e.target.value)} placeholder="e.g. Neutrogena"/>

        <div style={{fontSize:"0.72rem",color:T.textMid,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.35rem"}}>Barcode (if known)</div>
        <input style={inp} value={barcode} onChange={e=>setBarcode(e.target.value)} placeholder="e.g. 070501103603"/>

        <div style={{fontSize:"0.72rem",color:T.textMid,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.35rem"}}>Ingredient list * <span style={{fontWeight:"400",textTransform:"none",letterSpacing:0,color:T.textLight}}>— copy from the product label or brand website</span></div>
        <textarea style={{...inp,minHeight:"120px",resize:"vertical",lineHeight:1.5}} value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder="Water, Glycerin, Niacinamide, Hyaluronic Acid..."/>

        {err&&<div style={{fontSize:"0.8rem",color:T.rose,marginBottom:"0.75rem"}}>{err}</div>}

        {saved ? (
          <div style={{padding:"0.9rem",background:"#F0FBF0",border:"1px solid #4CAF5044",borderRadius:"0.75rem",textAlign:"center",fontSize:"0.85rem",color:"#2E7D32",fontWeight:"600"}}>
            Saved! Analysing ingredients…
          </div>
        ) : (
          <button onClick={handleSave} disabled={saving}
            style={{width:"100%",padding:"0.95rem",background:T.accent,color:"#FFFFFF",border:"none",borderRadius:"0.75rem",fontSize:"0.9rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",opacity:saving?0.6:1}}>
            {saving?"Saving…":"Save & analyse"}
          </button>
        )}
      </div>
    </div>
  , document.body);
}


function SearchResultCard({p, onSelect}) {
  const fromCatalog = p.source === "catalog";
  const ingText = p.ingredients||"";
  const hasIng = ingText.trim().length > 0;
  // Always recalculate live from ingredients so score is always accurate
  const pScore = hasIng ? Math.round(analyzeIngredients(ingText).avgScore||0) : (p.poreScore??null);
  const ps = pScore !== null ? poreStyle(pScore) : null;
  return (
    <button onClick={()=>onSelect(p)} style={{background:T.surface,border:`1.5px solid ${fromCatalog?T.sage+"66":T.border}`,borderRadius:"0.75rem",cursor:"pointer",textAlign:"left",padding:0,overflow:"hidden",transition:"all 0.15s",display:"flex",flexDirection:"column",position:"relative"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=fromCatalog?T.sage+"66":T.border;}}>
      <div style={{width:"100%",aspectRatio:"1/1",background:"#FFFFFF",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
        <ProductImage src={p.image||null} name={p.name} brand={p.brand||""} barcode={p.code||""}/>
        {pScore!=null&&<div style={{position:"absolute",top:"6px",right:"6px"}}><PoreScoreBadge score={pScore} size="sm"/></div>}
        {fromCatalog&&<div style={{position:"absolute",top:"5px",left:"5px",fontSize:"0.48rem",fontWeight:"700",background:T.sage,color:"#fff",borderRadius:"999px",padding:"0.12rem 0.4rem",letterSpacing:"0.04em",display:"flex",alignItems:"center",gap:"2px"}}>✓ Verified</div>}
        {!fromCatalog&&p.source==="makeup"&&<div style={{position:"absolute",top:"5px",left:"5px",fontSize:"0.48rem",fontWeight:"700",background:T.rose+"22",color:T.rose,border:`1px solid ${T.rose}33`,borderRadius:"999px",padding:"0.1rem 0.35rem",textTransform:"uppercase",letterSpacing:"0.04em"}}>Makeup</div>}
        {!fromCatalog&&!hasIng&&<div style={{position:"absolute",bottom:"5px",left:"5px",fontSize:"0.45rem",fontWeight:"600",background:"rgba(0,0,0,0.5)",color:"#fff",borderRadius:"999px",padding:"0.1rem 0.35rem"}}>No ingredients</div>}
      </div>
      <div style={{padding:"0.5rem 0.6rem"}}>
        <div style={{fontSize:"0.75rem",color:T.text,fontWeight:"600",lineHeight:"1.3",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{p.name}</div>
        {p.brand&&<div style={{fontSize:"0.65rem",color:T.textMid,fontWeight:"400",marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand}</div>}
        {(p.communityRating||p.scanCount>0)&&(
          <div style={{display:"flex",alignItems:"center",gap:"0.35rem",marginTop:"0.3rem",flexWrap:"wrap"}}>
            {p.communityRating&&<span style={{fontSize:"0.58rem",color:T.textMid,fontWeight:"600"}}>⭐ {p.communityRating}/10</span>}
            {p.scanCount>0&&<span style={{fontSize:"0.55rem",color:T.textLight}}>{p.scanCount} {p.scanCount===1?"rally":"rallies"}</span>}
          </div>
        )}
      </div>
    </button>
  );
}


// Daily skin tip — cycles by day of year
const SKIN_TIPS = [
    // Ingredients — unexpected science
    {tip:"Isopropyl myristate, a silky-feeling emollient in many foundations and sunscreens, scores a 5/5 on pore-clogging scales.",icon:"",tag:"Ingredients"},
    {tip:"Algae extract sounds clean and natural — but it's one of the most consistently pore-clogging ingredients in skincare.",icon:"",tag:"Ingredients"},
    {tip:"Sodium lauryl sulfate (SLS) doesn't cause acne directly, but it damages the skin barrier — making breakouts easier to trigger.",icon:"",tag:"Ingredients"},
    {tip:"Coconut oil has a comedogenic rating of 4/5. It's great for hair and body, but a breakout risk on acne-prone facial skin.",icon:"",tag:"Ingredients"},
    {tip:"Dimethicone, the silicone in almost every primer, is non-comedogenic — but it traps everything underneath it.",icon:"",tag:"Ingredients"},
    {tip:"Wheat germ oil is one of the most pore-clogging oils in existence — it hides in 'natural' products all the time.",icon:"",tag:"Ingredients"},
    {tip:"Cetyl alcohol and stearyl alcohol are not irritants — they're fatty alcohols that actually moisturise. Only short-chain alcohols dry skin out.",icon:"",tag:"Myth busting"},
    {tip:"Lanolin closely mimics the skin's own sebum — it's one of the most effective moisturisers ever studied, despite its old-fashioned reputation.",icon:"",tag:"Ingredients"},
    {tip:"Squalane derived from sugarcane is chemically identical to shark-derived squalane — and it's non-comedogenic.",icon:"",tag:"Ingredients"},
    {tip:"Niacinamide at 10%+ can sometimes cause flushing in sensitive skin — 2–5% is often just as effective.",icon:"",tag:"Ingredients"},
    // Acne — less obvious
    {tip:"Hormonal acne tends to cluster around the jawline and chin, while comedonal acne (clogged pores) appears across the forehead and nose.",icon:"",tag:"Acne"},
    {tip:"Malassezia (fungal acne) is fed by fatty acids in most moisturisers — it's why some people break out more when they moisturise.",icon:"",tag:"Acne"},
    {tip:"Zinc pyrithione, the active in anti-dandruff shampoo, also treats fungal acne when left on skin briefly.",icon:"",tag:"Acne"},
    {tip:"Purging from retinol or acids looks like small, uniform whiteheads. Breakouts from irritation are random and larger.",icon:"",tag:"Acne"},
    {tip:"Milia (the hard white bumps that won't pop) aren't acne — they're trapped keratin. Salicylic acid doesn't touch them; gentle exfoliation over time does.",icon:"",tag:"Acne"},
    {tip:"Adapalene (Differin) is a third-generation retinoid specifically engineered for acne — it's more targeted and less irritating than retinol.",icon:"",tag:"Acne"},
    // Barrier & moisture — the unexpected stuff
    {tip:"Your skin produces more oil when it's dehydrated — moisturising oily skin is not counterintuitive, it's essential.",icon:"",tag:"Barrier"},
    {tip:"Glycerin at concentrations above 40% can actually draw moisture out of skin rather than into it. Most products use 5–20%.",icon:"",tag:"Barrier"},
    {tip:"Using occlusive products (like Vaseline) on broken or infected skin can seal in bacteria and make infections worse.",icon:"",tag:"Barrier"},
    {tip:"The outermost layer of your skin, the stratum corneum, is completely dead — but it's responsible for 90% of your skin's protective function.",icon:"",tag:"Barrier"},
    {tip:"Ceramide 1, 3, and 6-II are the three ceramides most depleted in eczema-prone skin. Look for them on labels, not just 'ceramides'.",icon:"",tag:"Barrier"},
    // Retinol — the details
    {tip:"Retinol needs to be converted to retinoic acid by your skin to work — retinaldehyde skips one conversion step and is noticeably more potent.",icon:"",tag:"Retinol"},
    {tip:"The irritation from retinol isn't a sign it's working — it's a sign you're using too much, too fast.",icon:"",tag:"Retinol"},
    {tip:"Bakuchiol, a plant-based retinol alternative, has clinical evidence for similar anti-aging effects without photosensitivity.",icon:"",tag:"Retinol"},
    {tip:"Encapsulated retinol releases slowly on skin, causing far less irritation — worth looking for if you've struggled with retinol before.",icon:"",tag:"Retinol"},
    // SPF — things people get wrong
    {tip:"The SPF number only tells you UVB protection. PA++++ (or broad-spectrum labelling) tells you about UVA protection — both matter.",icon:"",tag:"Sun care"},
    {tip:"Tinted SPF provides meaningfully better protection against visible light and HEV (blue light) than untinted versions.",icon:"",tag:"Sun care"},
    {tip:"Powder SPF on top of makeup doesn't give full protection — it helps maintain it, but can't replace the base layer.",icon:"",tag:"Sun care"},
    {tip:"Iron oxides in tinted sunscreens block the visible light that triggers melasma — untinted SPF alone doesn't cover this.",icon:"",tag:"Sun care"},
    // Brightening & pigmentation
    {tip:"Post-inflammatory hyperpigmentation (PIH) takes an average of 6–24 months to fully fade without actives — even after the spot is gone.",icon:"",tag:"Brightening"},
    {tip:"Tranexamic acid is now considered comparable to hydroquinone for melasma treatment — without the risks of long-term hydroquinone use.",icon:"",tag:"Brightening"},
    {tip:"Kojic acid is unstable in sunlight — it should only be used at night, otherwise it breaks down before it can work.",icon:"",tag:"Brightening"},
    {tip:"Alpha arbutin converts to hydroquinone on skin at low concentrations — it's one of the most effective over-the-counter brighteners.",icon:"",tag:"Brightening"},
    // Exfoliation
    {tip:"Mandelic acid, made from bitter almonds, is the largest AHA molecule — it penetrates slowest and is the gentlest option for darker skin tones.",icon:"",tag:"Exfoliation"},
    {tip:"PHAs (polyhydroxy acids) like gluconolactone exfoliate at the surface only — ideal for rosacea-prone or very sensitised skin.",icon:"",tag:"Exfoliation"},
    {tip:"Enzymatic exfoliants (papain, bromelain) work without changing skin pH — which means they can be layered more safely than acids.",icon:"",tag:"Exfoliation"},
    // Vitamin C — nuance
    {tip:"L-ascorbic acid is the only form of vitamin C with strong clinical evidence. Most 'vitamin C' products use derivatives with far less proof.",icon:"",tag:"Vitamin C"},
    {tip:"L-ascorbic acid works best at pH 3.5 or below — which is why it stings. Formulas with a higher pH are more comfortable but less effective.",icon:"",tag:"Vitamin C"},
    {tip:"Vitamin C and niacinamide don't cancel each other out — that myth came from a 1960s study using pure nicotinic acid, not niacinamide.",icon:"",tag:"Vitamin C"},
    // Texture & aging
    {tip:"Topical peptides are too large to penetrate the dermis where collagen lives — they work at the surface and still have measurable effects.",icon:"",tag:"Anti-aging"},
    {tip:"The biggest driver of premature skin aging is UVA exposure — not stress, diet, or sleep, though those matter too.",icon:"",tag:"Anti-aging"},
    {tip:"Facial massage with gua sha or rollers doesn't change bone structure, but it does temporarily reduce puffiness by moving lymphatic fluid.",icon:"",tag:"Anti-aging"},
    {tip:"Collagen supplements have small but real evidence for improving skin elasticity — the collagen is digested into peptides that signal your skin to produce more.",icon:"",tag:"Anti-aging"},
    // Sensitivity & reactions
    {tip:"Contact dermatitis from skincare can appear up to 96 hours after exposure — making it very hard to identify the culprit product.",icon:"",tag:"Sensitivity"},
    {tip:"Essential oil sensitisation gets worse over time, not better — repeated exposure to lavender or citrus can eventually cause severe reactions.",icon:"",tag:"Sensitivity"},
    {tip:"Denatured alcohol (SD alcohol, alcohol denat.) evaporates fast and feels mattifying, but at high concentrations it measurably disrupts the skin barrier.",icon:"",tag:"Sensitivity"},
    {tip:"A reaction to a new product doesn't always mean allergy — purging, irritation, and contact dermatitis look similar but have different causes.",icon:"",tag:"Sensitivity"},
    // Surprising lifestyle
    {tip:"Your phone screen harbours more bacteria than a toilet seat — jawline breakouts are a near-universal consequence of daily calls.",icon:"",tag:"Lifestyle"},
    {tip:"Air conditioning and central heating both reduce indoor humidity — which accelerates transepidermal water loss while you sleep.",icon:"",tag:"Lifestyle"},
    {tip:"Swimming pool chlorine doesn't just dry skin — it reacts with skin proteins and can trigger eczema flares hours later.",icon:"",tag:"Lifestyle"},
    {tip:"Sleeping on your side consistently creates 'sleep lines' — vertical creases that eventually become permanent wrinkles on one side of your face.",icon:"",tag:"Lifestyle"},
    {tip:"The skin microbiome contains over 1,000 bacterial species. Overwashing and heavy actives disrupt it — often making skin more reactive.",icon:"",tag:"Lifestyle"},
  ];
const todayTip = SKIN_TIPS[Math.floor(Date.now()/86400000) % SKIN_TIPS.length];

function ScanPage({user, profile, onPosted, onUpdateProfile}) {
  const [showGlossary, setShowGlossary] = useState(false);
  const [inputMode, setInputMode]       = useState("camera");
  const [ingredients, setIngredients]   = useState("");
  const [productName, setProductName]   = useState("");
  const [brand, setBrand]               = useState("");
  const [results, setResults]           = useState(null);
  const [communityRating, setCommunityRating] = useState(0);
  const [posting, setPosting]           = useState(false);
  const [posted, setPosted]             = useState(false);
  const [cameraMode, setCameraMode]     = useState("choose");
  const [cameraErr, setCameraErr]       = useState("");
  const [photoPreview, setPhotoPreview] = useState(null);
  const [aiStatus, setAiStatus]         = useState(""); // step label shown during AI analysis
  const [searchQ, setSearchQ]           = useState("");
  const [searchRes, setSearchRes]       = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErr, setSearchErr]       = useState("");
  const [hasSearched, setHasSearched]   = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPrefillBarcode, setAddPrefillBarcode] = useState("");
  const [addPrefillName, setAddPrefillName] = useState("");
  const [currentBarcode, setCurrentBarcode] = useState("");
  const [postSource, setPostSource] = useState("search"); // "scan" | "search" | "type"
  const [postReaction, setPostReaction] = useState("loved"); // "loved" | "brokeout" | "wantToTry"
  const [photoMode, setPhotoMode] = useState("auto"); // "product" | "ingredients" | "auto"
  const photoRef = useRef(null);
  const camRef   = useRef(null);

  function reset() {
    setIngredients(""); setProductName(""); setBrand(""); setResults(null);
    setCommunityRating(0); setPosted(false); setPostReaction("loved");
    setCameraMode("choose"); setCameraErr(""); setPhotoPreview(null);
    setSearchQ(""); setSearchRes([]); setSearchErr(""); setHasSearched(false);
    setInputMode("type");
  }

  function switchTab(m) { setInputMode(m==='scan'?'camera':m); setResults(null); setCameraMode("choose"); setCameraErr(""); setPhotoPreview(null); if(m==="type") setPostSource("type"); if(m==="search") setPostSource("search"); }

  function analyze() {
    if (!ingredients.trim()) return;
    const res = analyzeIngredients(ingredients);
    setResults(res);
  }

  async function handlePost() {
    if (!productName.trim()||!results) return;
    setPosting(true);
    const poreScore = Math.round(results?.avgScore||0);
    const resolvedPostType = postReaction || (postSource === "scan" ? "scan" : "search");
    if (currentBarcode) {
      await recordScan(user.uid, profile.displayName, profile.photoURL||user.photoURL||"", currentBarcode, productName, brand, poreScore, ingredients, results.found, communityRating||null, resolvedPostType);
    } else {
      await postScan(user.uid, profile.displayName, profile.photoURL||user.photoURL||"", productName, brand, poreScore, null, ingredients, results.found, resolvedPostType);
    }
    setPosting(false); setPosted(true);
    if (navigator.vibrate) navigator.vibrate([40, 30, 40]);
    onPosted();
    setTimeout(reset, 1500);
  }

  async function onBarcode(code) {
    setCameraMode("processing"); setCameraErr("");
    debugLog("info", `Barcode scanned: ${code}`);
    try {
      const existing = await getProductByBarcode(code);
      if (existing && existing.ingredients) {
        debugLog("ok", `Found in catalog: ${existing.productName}`);
        setIngredients(existing.ingredients||"");
        setProductName(existing.productName);
        setBrand(existing.brand||"");
        setCurrentBarcode(code);
        setPostSource("scan");
        const res = analyzeIngredients(existing.ingredients);
        setResults(res);
        setInputMode("type");
        setCameraMode("choose");
        return;
      }
      debugLog("info", `Not in catalog — trying OBF for ${code}`);
      const p = await lookupBarcode(code);
      debugLog("ok", `OBF found: ${p.name} (ingredients: ${p.hasIngredients})`);
      setProductName(p.name); setBrand(p.brand);
      setCurrentBarcode(code);
      setPostSource("scan");
      if (p.hasIngredients) {
        setIngredients(p.ingredients);
        const res = analyzeIngredients(p.ingredients);
        setResults(res);
        setInputMode("type");
        setCameraMode("choose");
      } else {
        // Try OBF name search as a last attempt to find ingredients
        let ingFromSearch = "";
        try {
          const q = `${p.brand} ${p.name}`.trim();
          const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,ingredients_text,ingredients_text_en`, {signal: AbortSignal.timeout(5000)});
          const d = await r.json();
          ingFromSearch = d.products?.[0]?.ingredients_text_en || d.products?.[0]?.ingredients_text || "";
          if (ingFromSearch) debugLog("ok", `OBF name search found ingredients for ${p.name}`);
        } catch {}

        if (ingFromSearch.trim().length > 10) {
          setIngredients(ingFromSearch);
          const res = analyzeIngredients(ingFromSearch);
          setResults(res);
          setInputMode("type");
          setCameraMode("choose");
        } else {
          setIngredients("");
          setInputMode("type");
          setCameraMode("choose");
          setCameraErr(`Found "${p.name}" but no ingredient list on file — photograph the ingredients label on the back to analyse it, or paste it below.`);
        }
      }
      upsertProduct(code, {
        productName: p.name, brand: p.brand,
        ingredients: p.ingredients, image: p.image||"",
        source: "scan",
      }).catch(()=>{});
    } catch(e) {
      debugLog("error", `Barcode lookup failed: ${e.message}`);
      setCameraMode("choose");
      if (e.message?.includes("not found") || e.message?.includes("Not found")) {
        setCameraErr("Product not found. Photograph the ingredient list on the back of the packaging, or search by name above.");
      } else {
        setCameraErr(e.message || "Something went wrong. Please try again.");
      }
    }
  }

  async function onPhoto(e) {
    const file=e.target.files?.[0]; if(!file) return;
    setCameraErr(""); setPhotoPreview(URL.createObjectURL(file)); setCameraMode("processing");
    setAiStatus("Reading label…");
    debugLog("info", `Photo: ${file.name} ${(file.size/1024).toFixed(0)}kb ${file.type}`);
    if (!ANTHROPIC_KEY) debugLog("error", "No ANTHROPIC_KEY set — AI scan will fail");
    try {
      const b64=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result.split(",")[1]);r.onerror=rej;r.readAsDataURL(file);});
      debugLog("info", "Sending image to Claude AI…");
      const result=await extractFromPhoto(b64,file.type,photoMode);
      debugLog("ok", `AI response: ${result.slice(0,120)}`);
      if(result.startsWith("PRODUCT:")) {
        // Claude identified the product from its packaging — look it up
        const nameMatch = result.match(/^NAME:(.+)$/m);
        const brandMatch = result.match(/^BRAND:(.+)$/m);
        const name = nameMatch?.[1]?.trim() || "";
        const brand = brandMatch?.[1]?.trim() || "";
        if (name) {
          setProductName(name); setBrand(brand);
          setAiStatus("Finding product…");
          debugLog("info", `Product identified: ${brand} ${name}`);
          // Search catalog first, then OBF
          try {
            const res = await searchProducts(`${brand} ${name}`);
            const match = res[0];
            if (match && match.ingredients) {
              setIngredients(match.ingredients);
              const r = analyzeIngredients(match.ingredients);
              setResults(r);
              debugLog("ok", `Found in catalog: ${match.name}`);
            } else {
              // Try OBF name search
              const r2 = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(`${brand} ${name}`)}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,ingredients_text,ingredients_text_en`,{signal:AbortSignal.timeout(5000)});
              const d2 = await r2.json();
              const ing = d2.products?.[0]?.ingredients_text_en || d2.products?.[0]?.ingredients_text || "";
              if (ing.trim().length > 10) {
                setIngredients(ing);
                const r = analyzeIngredients(ing);
                setResults(r);
                debugLog("ok", `OBF found ingredients for ${name}`);
              } else {
                setCameraErr(`Found "${name}" but couldn't locate its ingredient list. Try photographing the ingredient label on the back instead.`);
              }
            }
          } catch { setCameraErr(`Found "${name}" but the lookup failed. Try photographing the ingredient label on the back instead.`); }
        } else {
          setCameraErr("Couldn't identify the product clearly. Try better lighting or photograph the ingredient list on the back.");
        }
        setInputMode("type"); setCameraMode("choose"); setAiStatus("");
      } else if(result.startsWith("BARCODE:")) {
        setAiStatus("Found barcode — looking up product…");
        const bcode = result.replace("BARCODE:","").trim();
        debugLog("info", `Barcode from photo: ${bcode}`);
        const p=await lookupBarcode(bcode);
        debugLog("ok", `OBF: ${p.name} | ingredients: ${p.hasIngredients}`);
        setIngredients(p.ingredients||""); setProductName(p.name); setBrand(p.brand);
        if (p.hasIngredients) {
          setAiStatus("Analysing ingredients…");
          const res = analyzeIngredients(p.ingredients);
          setResults(res);
          debugLog("ok", `Score: ${Math.round(res.avgScore??0)} | flagged: ${res.found?.length??0}`);
        } else {
          setCameraErr(`Found "${p.name}" but no ingredient list on file — paste the ingredients below.`);
        }
      } else if(result.includes("INGREDIENTS:")) {
        const nameMatch = result.match(/^NAME:(.+)$/m);
        const brandMatch = result.match(/^BRAND:(.+)$/m);
        const ingMatch = result.match(/^INGREDIENTS:(.+)$/ms);
        const ingText = ingMatch?.[1]?.trim() || "";
        if (nameMatch?.[1]) setProductName(nameMatch[1].trim());
        if (brandMatch?.[1]) setBrand(brandMatch[1].trim());
        if (ingText) {
          setIngredients(ingText);
          setAiStatus("Scoring ingredients…");
          const res = analyzeIngredients(ingText);
          setResults(res);
          debugLog("ok", `Structured: ${ingText.slice(0,80)} | score: ${Math.round(res.avgScore??0)}`);
        }
      } else {
        setIngredients(result);
        setAiStatus("Scoring ingredients…");
        const res = analyzeIngredients(result);
        setResults(res);
        debugLog("ok", `Plain ingredients: ${result.slice(0,80)} | score: ${Math.round(res.avgScore??0)}`);
      }
      setInputMode("type");
      setCameraMode("choose");
      setAiStatus("");
    } catch(e) {
      debugLog("error", `Photo scan error: ${e.message}`);
      setAiStatus("");
      setCameraErr(e.message || "Couldn't read image. Try better lighting or move closer.");
      setCameraMode("choose");
      setPhotoPreview(null);
    }
  }

  async function doSearch() {
    if(!searchQ.trim()) return;
    setSearchLoading(true); setSearchErr(""); setSearchRes([]); setHasSearched(true);
    try {
      const res = await searchProducts(searchQ);
      setSearchRes(res);
      if (!res.length) setSearchErr("no_results");
    } catch { setSearchErr("Search failed."); }
    finally { setSearchLoading(false); }
  }

  function selectProduct(p) {
    const ingText = p.ingredients || "";
    const analysis = ingText ? analyzeIngredients(ingText) : {found:[], avgScore:0};
    const fromCatalog = p.source === "catalog";
    setSelectedProduct({
      productName: p.name,
      brand: p.brand || "",
      image: p.adminImage || p.image || null,
      barcode: p.code || "",
      _productId: p._productId || p.code || "",
      id: p._productId || p.code || "",
      ingredients: ingText,
      skinTypes: p.skinTypes || [],
      description: p.description || "",
      flaggedIngredients: [...(analysis.poreCloggers||[]), ...(analysis.irritants||[])],
      poreScore: ingText ? Math.round(analysis.avgScore ?? 0) : (p.poreScore ?? 0),
      communityRating: p.communityRating || null,
      buyUrl: p.buyUrl || amazonUrl(p.name, p.brand, p.code, p.asin, p.buyUrl),
      fromCatalog,
    });
    // If from catalog, set barcode so handlePost uses recordScan
    if (p._productId) { setCurrentBarcode(p._productId); setPostSource("search"); }
  }

  const Tab = ({m,lbl}) => {
    const active = m==='scan' ? inputMode==='camera' : inputMode===m;
    return <button onClick={()=>switchTab(m)} style={{flex:1,padding:"0.55rem",background:active?T.accent:"transparent",color:active?"#FFFFFF":T.textMid,border:`1px solid ${active?T.accent:"transparent"}`,borderRadius:"0.4rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",cursor:"pointer",fontWeight:active?"600":"400",transition:"all 0.15s"}}>{lbl}</button>;
  };

  const inp = {width:"100%",padding:"0.75rem 1rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",transition:"border-color 0.15s"};

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",paddingBottom:"6rem"}}>
      <div style={{padding:"1rem"}}>

      {/* Tip of the day */}
      <div style={{marginBottom:"1rem",padding:"1rem 1.1rem",background:`linear-gradient(135deg,${T.iceBlue}60,${T.surface})`,borderRadius:"1.25rem",border:`1px solid ${T.blush}CC`,display:"flex",gap:"0.85rem",alignItems:"flex-start"}}>
        <div style={{width:"34px",height:"34px",borderRadius:"0.6rem",background:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.rose} strokeWidth="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:"0.58rem",fontWeight:"600",color:T.navy,textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:"0.3rem",fontFamily:"'Inter',sans-serif"}}>Tip of the day</div>
          <div style={{fontSize:"0.83rem",color:T.text,lineHeight:1.55,fontFamily:"'Inter',sans-serif",fontWeight:"400"}}>{todayTip.tip}</div>
        </div>
      </div>

      <div style={{background:T.surface,borderRadius:"1.25rem",border:`1px solid ${T.border}`,padding:"1.25rem",boxShadow:"0 4px 24px rgba(28,23,20,0.06),0 1px 4px rgba(28,23,20,0.04)"}}>

        {/* ── Four check options ── */}
        {cameraMode==="processing" ? (
          <div style={{textAlign:"center",padding:"1.5rem 1rem"}}>
            {photoPreview&&<img src={photoPreview} alt="" style={{width:"100%",maxHeight:"200px",objectFit:"cover",borderRadius:"0.75rem",marginBottom:"1rem",opacity:0.85}}/>}
            <div style={{display:"inline-flex",alignItems:"center",gap:"0.6rem",background:T.accentSoft,padding:"0.65rem 1.1rem",borderRadius:"999px",marginBottom:"0.5rem"}}>
              <div style={{width:"8px",height:"8px",borderRadius:"50%",background:T.accent,animation:"pulse 1s ease-in-out infinite",flexShrink:0}}/>
              <span style={{color:T.accent,fontWeight:"600",fontFamily:"'Inter',sans-serif",fontSize:"0.85rem"}}>
                {aiStatus || "Analysing with AI…"}
              </span>
            </div>
            <div style={{fontSize:"0.68rem",color:T.textLight,marginTop:"0.35rem"}}>
              {aiStatus==="Scoring ingredients…"||aiStatus==="Analysing ingredients…" ? "Almost done — calculating your pore score"
                : aiStatus==="Finding product…" ? "Searching our database and Open Beauty Facts"
                : "Reading your photo with AI"}
            </div>
          </div>
        ) : (
          <div style={{marginBottom:"0.75rem"}}>

            {/* Hidden file inputs */}
            <input ref={camRef} type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{display:"none"}}/>
            <input ref={photoRef} type="file" accept="image/*" onChange={onPhoto} style={{display:"none"}}/>

            {/* Search bar — primary hero */}
            <button onClick={()=>switchTab("search")}
              style={{width:"100%",display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.75rem 1rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:"0.85rem",cursor:"pointer",textAlign:"left",marginBottom:"1rem",transition:"border-color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
              onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span style={{flex:1,fontSize:"0.9rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Search products or brands…</span>
            </button>

            {/* Camera section label */}
            <div style={{fontSize:"0.6rem",fontWeight:"600",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.6rem",fontFamily:"'Inter',sans-serif"}}>Or use your camera</div>

            {/* Camera + Paste row */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.5rem"}}>

              {/* Single combined camera button — auto mode, AI figures out what it sees */}
              <button onClick={()=>{setCameraErr("");setPhotoMode("auto");camRef.current?.click();}}
                style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.5rem",padding:"1rem 0.75rem",background:T.navy,border:"none",borderRadius:"0.75rem",cursor:"pointer",textAlign:"center"}}>
                <div style={{width:36,height:36,borderRadius:"0.55rem",background:"rgba(255,255,255,0.12)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <div>
                  <div style={{fontSize:"0.82rem",fontWeight:"600",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>Take a photo</div>
                  <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.55)",marginTop:"2px",fontFamily:"'Inter',sans-serif",lineHeight:1.3}}>Product or ingredient label</div>
                </div>
              </button>

              {/* Paste ingredient list */}
              <button onClick={()=>switchTab("type")}
                style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.5rem",padding:"1rem 0.75rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:"pointer",textAlign:"center"}}>
                <div style={{width:36,height:36,borderRadius:"0.55rem",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textMid} strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                </div>
                <div>
                  <div style={{fontSize:"0.82rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>Paste list</div>
                  <div style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginTop:"2px",lineHeight:1.3}}>Copy from label</div>
                </div>
              </button>

            </div>

            {cameraErr&&<div style={{padding:"0.65rem",background:"#FBF0EE",border:`1px solid ${T.rose}44`,borderRadius:"0.5rem",fontSize:"0.78rem",color:T.rose,fontFamily:"'Inter',sans-serif",marginTop:"0.25rem"}}>{cameraErr}</div>}
          </div>
        )}

        {/* Type tab */}
        {inputMode==="type"&&(
          <div className="fu">
            <div style={{fontSize:"0.75rem",color:T.textLight,marginBottom:"0.5rem",fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>
              Copy the ingredient list from the product's packaging or brand website and paste it below.
            </div>
            <textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} placeholder="Water, Glycerin, Niacinamide, Cetearyl Alcohol…" rows={5}
              style={{...inp,resize:"vertical",lineHeight:"1.7"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
            <button onClick={analyze} disabled={!ingredients.trim()} style={{width:"100%",marginTop:"0.75rem",padding:"0.75rem",background:ingredients.trim()?T.accent:T.surfaceAlt,color:ingredients.trim()?"#FFFFFF":T.textLight,border:"none",borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"600",cursor:ingredients.trim()?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif"}}>
              Analyze ingredients
            </button>
          </div>
        )}

        {/* Search tab */}
        {inputMode==="search"&&(
          <div className="fu">
            <div style={{position:"relative",marginBottom:"0.75rem"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{position:"absolute",left:"0.85rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" value={searchQ}
                onChange={e=>{ setSearchQ(e.target.value); if(!e.target.value.trim()){setSearchRes([]);setHasSearched(false);setSearchErr("");} else { setSearchLoading(true); clearTimeout(window._scanSearchTimer); window._scanSearchTimer=setTimeout(async()=>{ try{ const res=await searchProducts(e.target.value); setSearchRes(res); setHasSearched(true); if(!res.length)setSearchErr("no_results"); else setSearchErr(""); }catch{setSearchErr("Search failed.");} setSearchLoading(false); },350); } }}
                onKeyDown={e=>e.key==="Enter"&&doSearch()}
                placeholder="Search products or brands…"
                style={{...inp, paddingLeft:"2.25rem", paddingRight:searchQ?"2.25rem":"0.85rem"}}
                onFocus={e=>e.target.style.borderColor=T.accent}
                onBlur={e=>e.target.style.borderColor=T.border}
                autoFocus
              />
              {searchQ&&<button onClick={()=>{setSearchQ("");setSearchRes([]);setHasSearched(false);setSearchErr("");}} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textLight,padding:"2px",display:"flex"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
            </div>
            {searchErr&&searchErr!=="no_results"&&<div style={{padding:"0.65rem",background:"#FBF0EE",border:`1px solid ${T.rose}44`,borderRadius:"0.5rem",fontSize:"0.78rem",color:T.rose,marginBottom:"0.75rem"}}>{searchErr}</div>}
            {searchErr==="no_results"&&(
              <div style={{textAlign:"center",padding:"1.25rem 0.5rem"}}>
                <div style={{fontSize:"0.88rem",fontWeight:"600",color:T.text,marginBottom:"0.3rem"}}>No products found</div>
                <div style={{fontSize:"0.78rem",color:T.textMid,marginBottom:"1rem",lineHeight:1.5}}>Be the first to add it — it'll be available for everyone instantly.</div>
                <button onClick={()=>{setAddPrefillName(searchQ);setShowAddModal(true);}}
                  style={{padding:"0.65rem 1.4rem",background:T.accent,color:"#FFFFFF",border:"none",borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                  Add this product
                </button>
              </div>
            )}
            {searchLoading&&<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem",padding:"1.25rem",color:T.textLight,fontSize:"0.82rem"}}><div style={{width:"14px",height:"14px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/> Searching…</div>}
            {!searchLoading&&searchRes.length>0&&(
              <div style={{display:"flex",flexDirection:"column",gap:"0"}}>
                {searchRes.map((p,i)=>{
                  const res = analyzeIngredients(p.ingredients||"");
                  const ps = poreStyle(res.avgScore||0);
                  return (
                    <button key={p.code||i} onClick={()=>selectProduct(p)}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.5rem",background:p._cached?"rgba(44,122,92,0.03)":"none",border:"none",borderBottom:i<searchRes.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",textAlign:"left",transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      <div style={{width:"44px",height:"44px",borderRadius:"0.65rem",flexShrink:0,overflow:"hidden",background:T.surfaceAlt}}>
                        <ProductImage src={p.image||null} name={p.name} brand={p.brand||""} barcode={p.code||""} size="full"/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                        {p.brand&&<div style={{fontSize:"0.72rem",color:T.textMid,marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand}</div>}
                        {(p.communityRating||p.scanCount>0)&&<div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"1px"}}>
                          {p.communityRating?`⭐ ${p.communityRating}/10`:""}{p.scanCount>0?` · ${p.scanCount} scans`:""}
                        </div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"0.25rem",flexShrink:0}}>
                        <PoreScoreBadge score={res.avgScore!=null?Math.round(res.avgScore):null} size="sm"/>
                        {p._cached&&p._approved
                          ? <span style={{fontSize:"0.5rem",color:T.sage,background:T.sage+"15",padding:"0.05rem 0.3rem",borderRadius:"999px",border:`1px solid ${T.sage}30`,fontWeight:"700"}}>✓ In Ralli</span>
                          : null}
                      </div>
                    </button>
                  );
                })}
                <button onClick={()=>{setAddPrefillName(searchQ);setShowAddModal(true);}}
                  style={{background:"transparent",border:"none",fontSize:"0.75rem",color:T.textLight,cursor:"pointer",fontFamily:"'Inter',sans-serif",textDecoration:"underline",padding:"0.75rem 0.5rem",textAlign:"left"}}>
                  Can't find your product? Add it
                </button>
              </div>
            )}
          </div>
        )}

        {/* Results */}
        {results&&inputMode==="type"&&(
          <div style={{marginTop:"1.25rem",borderTop:`1px solid ${T.border}`,paddingTop:"1.25rem"}} className="fu">

            {/* Pore clog score auto-calculated */}
            <div style={{marginBottom:"0.75rem",padding:"0.6rem 0.85rem",background:poreStyle(Math.round(results.avgScore||0)).color+"12",borderRadius:"0.75rem",border:`1px solid ${poreStyle(Math.round(results.avgScore||0)).color}25`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div>
                <div style={{fontSize:"0.6rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px"}}>Pore Clog Score</div>
                <div style={{fontSize:"0.82rem",fontWeight:"600",color:poreStyle(Math.round(results.avgScore||0)).color,fontFamily:"'Inter',sans-serif"}}>{poreStyle(Math.round(results.avgScore||0)).label}</div>
              </div>
              <PoreScoreBadge score={Math.round(results.avgScore||0)} size="lg"/>
            </div>
            {/* Flagged ingredients — detailed breakdown */}
            {results.found.length > 0 && (
              <>
              {/* Pore-clogging ingredients */}
              {results.poreCloggers?.length > 0 && (
                <div style={{marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.6rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.5rem",fontWeight:"700"}}>
                    {results.poreCloggers.length} pore-clogging ingredient{results.poreCloggers.length!==1?"s":""} found
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                    {results.poreCloggers.sort((a,b)=>b.score-a.score).map((ing,i)=>{
                      const ps = poreStyle(ing.score);
                      return (
                        <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem",padding:"0.5rem 0.65rem",background:ps.color+"0e",borderRadius:"0.6rem",border:`1px solid ${ps.color}22`}}>
                          <div style={{minWidth:"28px",height:"28px",borderRadius:"0.4rem",background:ps.color+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            <span style={{fontSize:"0.75rem",fontWeight:"800",color:ps.color,lineHeight:1}}>{ing.score}</span>
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:"0.78rem",fontWeight:"700",color:T.text,textTransform:"capitalize",marginBottom:"1px"}}>{ing.name}</div>
                            <div style={{fontSize:"0.68rem",color:T.textMid,lineHeight:1.4}}>{ing.note}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Irritants section */}
              {results.irritants?.length > 0 && (
                <div style={{marginBottom:"0.75rem"}}>
                  <div style={{fontSize:"0.6rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.5rem",fontWeight:"700"}}>
                    {results.irritants.length} irritant{results.irritants.length!==1?"s":""} found
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
                    {results.irritants.map((ing,i)=>(
                      <div key={i} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem",padding:"0.5rem 0.65rem",background:T.amber+"0d",borderRadius:"0.6rem",border:`1px solid ${T.amber}25`}}>
                        <div style={{minWidth:"28px",height:"28px",borderRadius:"0.4rem",background:T.amber+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                          <span style={{fontSize:"0.8rem",lineHeight:1}}>⚠</span>
                        </div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:"0.78rem",fontWeight:"700",color:T.text,textTransform:"capitalize",marginBottom:"1px"}}>{ing.name}</div>
                          <div style={{fontSize:"0.68rem",color:T.textMid,lineHeight:1.4}}>{ing.note}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All clear */}
              {(!results.poreCloggers?.length && !results.irritants?.length) && (
                <div style={{marginBottom:"0.75rem",padding:"0.6rem 0.85rem",background:T.sage+"10",borderRadius:"0.65rem",border:`1px solid ${T.sage}25`,display:"flex",alignItems:"center",gap:"0.5rem"}}>
                  <span style={{fontSize:"1rem"}}>✓</span>
                  <div style={{fontSize:"0.78rem",color:T.sage,fontWeight:"600"}}>No pore-clogging or irritating ingredients found</div>
                </div>
              )}
              </>
            )}
            {/* Product name — only needed to share */}
            <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem"}}>
              <input value={productName} onChange={e=>setProductName(e.target.value)} placeholder="Product name (to share)" style={{...inp,flex:1}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
              <input value={brand} onChange={e=>setBrand(e.target.value)} placeholder="Brand" style={{...inp,width:"110px"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
            </div>
            {/* Reaction type */}
            <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem"}}>
              {[
                {type:"loved",     label:"💖 Loved it",     color:T.sage},
                {type:"brokeout",  label:"⚠️ Broke me out", color:T.rose},
                {type:"wantToTry", label:"👀 Want to try",  color:T.amber},
              ].map(({type,label,color})=>(
                <button key={type} onClick={()=>setPostReaction(type)}
                  style={{flex:1,padding:"0.5rem 0.25rem",background:postReaction===type?color+"18":"transparent",border:`1.5px solid ${postReaction===type?color:T.border}`,borderRadius:"0.65rem",fontSize:"0.65rem",fontWeight:postReaction===type?"700":"500",color:postReaction===type?color:T.textMid,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>
                  {label}
                </button>
              ))}
            </div>
            {/* Post button */}
            {posted
              ? <div style={{textAlign:"center",padding:"0.75rem",color:T.sage,fontFamily:"'Inter',sans-serif",fontWeight:"600",fontSize:"0.9rem",animation:"successPop 0.45s cubic-bezier(0.34,1.56,0.64,1) both",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2.5" style={{animation:"successPop 0.45s 0.05s cubic-bezier(0.34,1.56,0.64,1) both"}}><polyline points="20 6 9 17 4 12"/></svg>
                  Posted to your feed!
                </div>
              : <button onClick={handlePost} disabled={!productName.trim()||posting} style={{width:"100%",padding:"0.85rem",background:productName.trim()?T.accent:T.surfaceAlt,color:productName.trim()?"#FAF8F5":T.textLight,border:"none",borderRadius:"2rem",fontSize:"0.85rem",fontWeight:"500",cursor:productName.trim()?"pointer":"not-allowed",letterSpacing:"0.02em",fontFamily:"'Inter',sans-serif"}}>
                  {posting?"Posting…":"Share to feed"}
                </button>
            }
            {!productName.trim()&&<div style={{textAlign:"center",fontSize:"0.72rem",color:T.textLight,marginTop:"0.4rem"}}>Add a product name to share to the feed</div>}
          </div>
        )}
      </div>
      {selectedProduct&&<ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdateProfile||(() => {})} onUserTap={onUserTap}/>}
      {showAddModal&&<AddProductModal
        user={user}
        prefillBarcode={addPrefillBarcode}
        prefillName={addPrefillName}
        onClose={()=>{setShowAddModal(false);setAddPrefillBarcode("");setAddPrefillName("");}}
        onAdded={(p)=>{
          setIngredients(p.ingredients);
          setProductName(p.productName);
          setBrand(p.brand);
          setInputMode("type");
          setShowAddModal(false);
          setAddPrefillBarcode("");
          setAddPrefillName("");
        }}
      />}

      {/* Glossary entry card */}
      <button onClick={()=>setShowGlossary(true)}
        style={{width:"100%",marginTop:"1rem",padding:"0.85rem 1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"0.85rem",transition:"all 0.15s",boxShadow:"0 1px 3px rgba(0,0,0,0.04)"}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.transform="translateY(-1px)";}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
        <div style={{width:"38px",height:"38px",borderRadius:"0.65rem",background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.1rem"}}>Ingredient Glossary</div>
          <div style={{fontSize:"0.7rem",color:T.textLight}}>Decode what's in your products</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      {/* Glossary slide-up sheet */}
      {showGlossary&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:100,display:"flex",flexDirection:"column",justifyContent:"flex-end"}}>
          <div onClick={()=>setShowGlossary(false)} style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(15,25,35,0.35)",backdropFilter:"blur(2px)"}}/>
          <div style={{position:"relative",background:T.bg,borderRadius:"1.5rem 1.5rem 0 0",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,0.12)"}}>
            <div style={{position:"sticky",top:0,background:T.bg,padding:"0.75rem 1.25rem 0.5rem",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.border}`,zIndex:1}}>
              <span style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1rem",color:T.text,letterSpacing:"-0.02em"}}>Ingredient Glossary</span>
              <button onClick={()=>setShowGlossary(false)} style={{background:"none",border:"none",cursor:"pointer",padding:"0.25rem",color:T.textLight}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{padding:"0 0 2rem"}}>
              <GlossaryPage/>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// ── FeedPage ──────────────────────────────────────────────────

// ── NetworkGroupCard — shown when 2+ people you follow use the same product ──
function NetworkGroupCard({productName, brand, productImage, poreScore, users, onProductTap, onUserTap, currentUid}) {
  const [shareOpen, setShareOpen] = useState(false);
  const ps = poreStyle(poreScore??0);
  const names = users.slice(0,3).map(u=>u.displayName?.split(" ")[0]||"Someone");
  const label = names.length === 1
    ? `${names[0]} uses this`
    : names.length === 2
      ? `${names[0]} and ${names[1]} use this`
      : `${names[0]}, ${names[1]} and ${users.length > 3 ? `${users.length-2} others` : names[2]} use this`;

  return (
    <div style={{borderBottom:`1px solid ${T.border}35`,padding:"0.9rem 1rem 0.8rem"}}>
      {/* Context line */}
      <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"0.65rem"}}>
        {/* Stacked avatars */}
        <div style={{display:"flex",marginRight:"0.15rem"}}>
          {users.slice(0,3).map((u,i)=>(
            <button key={u.uid||i} onClick={()=>onUserTap&&onUserTap(u.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",marginLeft:i>0?"-8px":"0",zIndex:3-i,position:"relative"}}>
              <Avatar photoURL={u.photoURL} name={u.displayName} size={26}/>
            </button>
          ))}
        </div>
        <div style={{flex:1,fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",lineHeight:1.3}}>
          <span style={{fontWeight:"700",color:T.text}}>{names[0]}</span>
          {users.length > 1 && <span style={{color:T.textLight}}>{label.replace(names[0],"")}</span>}
        </div>
      </div>
      {/* Product pill */}
      <div onClick={onProductTap} style={{display:"flex",gap:"0.75rem",alignItems:"center",background:T.surfaceAlt,borderRadius:"0.85rem",padding:"0.7rem 0.75rem",cursor:onProductTap?"pointer":"default"}}>
        <div style={{width:"52px",height:"52px",flexShrink:0,borderRadius:"0.5rem",overflow:"hidden",background:T.surface}}>
          {productImage
            ? <img src={productImage} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"4px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.opacity="0"}/>
            : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:T.border}}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>
          }
        </div>
        <div style={{flex:1,minWidth:0}}>
          {brand&&<div style={{fontSize:"0.6rem",fontWeight:"600",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.09em",marginBottom:"0.1rem",fontFamily:"'Inter',sans-serif"}}>{brand}</div>}
          <div style={{fontWeight:"600",color:T.text,fontSize:"0.9rem",fontFamily:"'Inter',sans-serif",lineHeight:1.25,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{productName}</div>
        </div>
        <PoreScoreBadge score={poreScore} size="md"/>
      </div>
      {currentUid&&(
        <button onClick={e=>{e.stopPropagation();setShareOpen(true);}} style={{display:"flex",alignItems:"center",gap:"0.35rem",background:"none",border:"none",padding:"0.5rem 0 0.1rem",cursor:"pointer",color:T.textLight,fontSize:"0.68rem",fontFamily:"'Inter',sans-serif"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          Share with someone
        </button>
      )}
      {shareOpen&&<ShareProductModal user={{uid:currentUid}} product={{productName,brand,productImage,poreScore}} onClose={()=>setShareOpen(false)}/>}
    </div>
  );
}


// ── TrendingSection — extracted from FeedPage IIFE to fix Rules of Hooks ──
function TrendingSection({ openProductFromPost, trendingList }) {
  const [trendData, setTrendData] = React.useState([]);
  const [trendReady, setTrendReady] = React.useState(false);
  React.useEffect(()=>{
    (async()=>{
      try {
        const weekAgo = Date.now() - 7*24*60*60*1000;
        const snap = await getDocs(query(collection(db,"posts"), orderBy("createdAt","desc"), limit(300)));
        const map = {};
        snap.docs.forEach(d=>{
          const p = d.data();
          const ts = p.createdAt?.seconds ? p.createdAt.seconds*1000 : 0;
          if (ts < weekAgo) return;
          const key = (p.productName||"").toLowerCase().trim();
          if (!key) return;
          if (!map[key]) {
            // Compute poreScore from ingredients at aggregation time so card matches modal
            const ing = (p.ingredients||"").trim();
            const computedScore = ing.length > 10
              ? (()=>{ const r = analyzeIngredients(ing); return r.avgScore!=null ? Math.round(r.avgScore) : (r.poreCloggers?.length?1:0); })()
              : (p.poreScore??0);
            map[key] = {...p, id:d.id, scanCount:0, totalRating:0, ratingCount:0, lovedCount:0, brokeoutCount:0, poreScore:computedScore};
          }
          map[key].scanCount++;
          if (p.communityRating){ map[key].totalRating+=Number(p.communityRating); map[key].ratingCount++; }
          if (p.postType==="loved") map[key].lovedCount++;
          if (p.postType==="brokeout") map[key].brokeoutCount++;
        });
        const weekly = Object.values(map).sort((a,b)=>b.scanCount-a.scanCount).slice(0,8).map(p=>({...p, avgCommunity: p.ratingCount>0?Math.round(p.totalRating/p.ratingCount):null}));
        setTrendData(weekly.length ? weekly : trendingList.slice(0,8));
      } catch { setTrendData(trendingList.slice(0,8)); }
      setTrendReady(true);
    })();
  },[]);
  if (!trendReady || !trendData.length) return null;
const now = new Date();
const weekStart = new Date(now); weekStart.setDate(now.getDate()-now.getDay());
const weekStr = weekStart.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const endStr = now.toLocaleDateString("en-US",{month:"short",day:"numeric"});
const topProduct = trendData[0];
const rest = trendData.slice(1);
return (
  <div style={{marginBottom:"1rem"}}>
    {/* Header */}
    <div style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0 1rem",marginBottom:"0.75rem"}}>
      <span style={{fontSize:"1rem"}}>🔥</span>
      <div>
        <div style={{fontSize:"0.82rem",fontWeight:"800",color:T.text,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.01em"}}>Trending This Week</div>
        <div style={{fontSize:"0.58rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>{weekStr} – {endStr} · {trendData.reduce((a,b)=>a+b.scanCount,0)} scans across Ralli</div>
      </div>
    </div>

    {/* #1 hero card */}
    <button onClick={()=>openProductFromPost(topProduct)}
      style={{width:"calc(100% - 2rem)",margin:"0 1rem 0.65rem",background:T.surface,border:`0.5px solid ${T.border}`,borderRadius:"1rem",padding:"0.85rem",cursor:"pointer",textAlign:"left",overflow:"hidden",display:"flex",gap:"0.85rem",alignItems:"center",transition:"transform 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-1px)"}
      onMouseLeave={e=>e.currentTarget.style.transform=""}>
      {/* Product image */}
      <div style={{width:72,height:72,flexShrink:0,background:T.surfaceAlt,borderRadius:"0.65rem",overflow:"hidden",position:"relative"}}>
        <ProductImage src={topProduct.productImage||topProduct.image||null} name={topProduct.productName} brand={topProduct.brand||""} barcode={topProduct.barcode||""} size="full"/>
        <div style={{position:"absolute",top:4,left:4,background:T.navy,borderRadius:"999px",padding:"1px 6px"}}>
          <span style={{fontSize:"0.48rem",fontWeight:"700",color:"#fff"}}>#1</span>
        </div>
      </div>
      {/* Info */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"0.58rem",color:T.textLight,marginBottom:"0.15rem",textTransform:"uppercase",letterSpacing:"0.06em"}}>{topProduct.brand||""}</div>
        <div style={{fontSize:"0.9rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.25,marginBottom:"0.4rem",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{topProduct.productName}</div>
        {/* Score row */}
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginBottom:"0.35rem"}}>
          {(()=>{const ps=poreStyle(topProduct.poreScore??0);return(
            <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:ps.color,flexShrink:0}}/>
              <span style={{fontSize:"0.7rem",fontWeight:"600",color:ps.color}}>{topProduct.poreScore??0}/5</span>
              <span style={{fontSize:"0.65rem",color:T.textLight}}>pore score</span>
            </div>
          );})()}
          {topProduct.avgCommunity&&(
            <div style={{display:"flex",alignItems:"center",gap:"0.2rem"}}>
              <span style={{fontSize:"0.7rem",color:"#F59E0B"}}>★</span>
              <span style={{fontSize:"0.7rem",fontWeight:"600",color:T.textMid}}>{(topProduct.avgCommunity/2).toFixed(1)}</span>
            </div>
          )}
        </div>
        {/* Reaction pills */}
        <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap"}}>
          {topProduct.lovedCount>0&&<span style={{fontSize:"0.6rem",color:T.sage,background:T.surfaceAlt,padding:"0.1rem 0.45rem",borderRadius:"999px",border:`0.5px solid ${T.border}`}}>{topProduct.lovedCount} loved it</span>}
          {topProduct.brokeoutCount>0&&<span style={{fontSize:"0.6rem",color:T.rose,background:T.surfaceAlt,padding:"0.1rem 0.45rem",borderRadius:"999px",border:`0.5px solid ${T.border}`}}>{topProduct.brokeoutCount} broke out</span>}
          <span style={{fontSize:"0.6rem",color:T.textLight,background:T.surfaceAlt,padding:"0.1rem 0.45rem",borderRadius:"999px",border:`0.5px solid ${T.border}`}}>{topProduct.scanCount} scans</span>
        </div>
      </div>
    </button>

    {/* #2–8 horizontal scroll */}
    {rest.length>0&&(
      <div style={{display:"flex",gap:"0.6rem",overflowX:"auto",paddingLeft:"1rem",paddingRight:"1rem",paddingBottom:"0.5rem",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        {rest.map((p,i)=>{
          const rank = i+2;
          const rankColor = T.navy;
          return (
            <button key={p.productName+rank} onClick={()=>openProductFromPost(p)}
              style={{flexShrink:0,width:"110px",background:T.surface,borderRadius:"0.85rem",border:`1px solid ${T.border}`,padding:0,cursor:"pointer",textAlign:"left",overflow:"hidden",display:"flex",flexDirection:"column",boxShadow:"0 1px 4px rgba(0,0,0,0.05)",transition:"transform 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
              onMouseLeave={e=>e.currentTarget.style.transform=""}>
              <div style={{width:"100%",aspectRatio:"1/1",background:T.surfaceAlt,position:"relative",overflow:"hidden"}}>
                <ProductImage src={p.productImage||p.image||null} name={p.productName} brand={p.brand||""} barcode={p.barcode||""} size="full"/>
                <div style={{position:"absolute",top:"5px",left:"5px",width:"18px",height:"18px",borderRadius:"50%",background:rankColor,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontSize:"0.5rem",fontWeight:"800",color:"#fff"}}>{rank}</span>
                </div>
                <div style={{position:"absolute",top:"5px",right:"5px"}}><PoreScoreBadge score={p.poreScore??0} size="sm"/></div>
              </div>
              <div style={{padding:"0.4rem 0.45rem 0.5rem",flex:1,display:"flex",flexDirection:"column",gap:"0.12rem"}}>
                <div style={{fontSize:"0.56rem",color:T.textLight,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand||""}</div>
                <div style={{fontSize:"0.66rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",lineHeight:1.3}}>{p.productName}</div>
                <div style={{display:"flex",alignItems:"center",gap:"0.2rem",marginTop:"auto",paddingTop:"0.15rem"}}>
                  {p.lovedCount>0&&<span style={{fontSize:"0.52rem",color:T.sage}}>💚{p.lovedCount}</span>}
                  {p.brokeoutCount>0&&<span style={{fontSize:"0.52rem",color:T.rose}}>⚠{p.brokeoutCount}</span>}
                  <span style={{fontSize:"0.52rem",color:T.textLight,marginLeft:"auto"}}>{p.scanCount} scans</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    )}
    <div style={{margin:"0.75rem 1rem 0",height:"1px",background:T.border}}/>
  </div>
);
}

function FeedPage({user, profile, refreshKey, onUserTap, onUpdateProfile}) {
  const [posts, setPosts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("forYou");
  const [recPosts, setRecPosts]           = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQ, setSearchQ]             = useState("");
  const [searchResults, setSearchResults] = useState({users:[], products:[]});
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen]       = useState(false);
  const [pullY, setPullY]           = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [notifs, setNotifs]         = useState([]);
  const [feedFriendScans, setFeedFriendScans] = useState({});
  const [productImageMap, setProductImageMap] = useState({}); // name→image lookup
  // (Find Friends moved to Profile > People tab)
  const scrollRef   = React.useRef(null);
  const touchStartY = React.useRef(0);

  // Load product image map once
  React.useEffect(()=>{
    getDocs(collection(db,"products")).then(snap=>{
      const map = {};
      snap.docs.forEach(d=>{
        const p = d.data();
        const img = p.adminImage||p.image||"";
        if (img && p.productName) {
          map[p.productName.toLowerCase().trim()] = img;
        }
      });
      setProductImageMap(map);
    }).catch(()=>{});
  },[]);

  function onTouchStart(e) { touchStartY.current = e.touches[0].clientY; }
  function onTouchMove(e) {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    if (delta > 0) setPullY(Math.min(delta * 0.4, 72));
  }
  async function onTouchEnd() {
    if (pullY > 50 && !refreshing) {
      setRefreshing(true); setPullY(0);
      await loadFeed();
      setRefreshing(false);
    } else { setPullY(0); }
  }
  const skinLabels = profile?.skinType
    ? (Array.isArray(profile.skinType) ? profile.skinType : [profile.skinType]).join(", ")
    : "";
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [trendingList, setTrendingList] = useState([]);
  const globalPostsRef = React.useRef([]);



  useEffect(()=>{
    loadFeed();
    // Load friend routines for social proof on rec cards
    async function loadFriendRoutines() {
      const following = profile?.following||[];
      if (!following.length) return;
      try {
        const chunks = [];
        for (let i=0; i<Math.min(following.length,30); i+=10) chunks.push(following.slice(i,i+10));
        const map = {};
        await Promise.all(chunks.map(async chunk => {
          const snap = await getDocs(query(collection(db,"users"), where("__name__","in",chunk)));
          snap.docs.forEach(d => {
            const u = d.data(); const uid = d.id;
            (u.routine||[]).forEach(productName => {
              if (!productName) return;
              const key = productName.toLowerCase().trim();
              if (!map[key]) map[key]=[];
              if (!map[key].find(f=>f.uid===uid)) map[key].push({displayName:u.displayName||"",photoURL:u.photoURL||"",uid,productName});
            });
          });
        }));
        setFeedFriendScans(map);
      } catch(e) {}
    }
    loadFriendRoutines();
  },[refreshKey,user?.uid]);

  // ── Mock community posts — show a lively feed out of the box ──
  const MOCK_POSTS = [
    {id:"mock_01",uid:"seed_u01",displayName:"Cassidy Monroe",photoURL:"https://i.pravatar.cc/150?img=47",productName:"CeraVe Moisturizing Cream",brand:"CeraVe",poreScore:3,productImage:"",communityRating:9,postType:"loved",ingredients:"water, glycerin, cetearyl alcohol, ceramide np, ceramide ap, ceramide eop, cholesterol, sodium hyaluronate, niacinamide, panthenol, allantoin",flaggedIngredients:[],likes:["seed_u02","seed_u03","seed_u04"],comments:[{uid:"seed_u02",displayName:"Jenna Caldwell",photoURL:"https://i.pravatar.cc/150?img=49",text:"been using this for 3 years, never switching 💙"}],createdAt:{seconds:Math.floor(Date.now()/1000)-3600}},
    {id:"mock_02",uid:"seed_u02",displayName:"Jenna Caldwell",photoURL:"https://i.pravatar.cc/150?img=49",productName:"The Ordinary Niacinamide 10%",brand:"The Ordinary",poreScore:0,productImage:"",communityRating:8,postType:"loved",ingredients:"aqua, niacinamide, pentylene glycol, zinc pca, sodium hyaluronate, tamarindus indica seed gum",flaggedIngredients:[],likes:["seed_u01","seed_u04","seed_u05"],comments:[{uid:"seed_u03",displayName:"Leila Ramos",photoURL:"https://i.pravatar.cc/150?img=32",text:"does this help with hormonal acne?"},{uid:"seed_u01",displayName:"Cassidy Monroe",photoURL:"https://i.pravatar.cc/150?img=47",text:"yes!! my chin breakouts are so much better"}],createdAt:{seconds:Math.floor(Date.now()/1000)-7200}},
    {id:"mock_03",uid:"seed_u03",displayName:"Leila Ramos",photoURL:"https://i.pravatar.cc/150?img=32",productName:"EltaMD UV Clear SPF 46",brand:"EltaMD",poreScore:2,productImage:"",communityRating:10,postType:"loved",ingredients:"zinc oxide 9.0%, niacinamide, hyaluronic acid, lactic acid, tocopheryl acetate, glycerin",flaggedIngredients:[],likes:["seed_u01","seed_u02","seed_u05"],comments:[{uid:"seed_u04",displayName:"Priya Nair",photoURL:"https://i.pravatar.cc/150?img=44",text:"my derm literally recommended this exact one 🙌"}],createdAt:{seconds:Math.floor(Date.now()/1000)-18000}},
    {id:"mock_04",uid:"seed_u04",displayName:"Priya Nair",photoURL:"https://i.pravatar.cc/150?img=44",productName:"Cosrx Snail Mucin 96%",brand:"Cosrx",poreScore:0,productImage:"",communityRating:9,postType:"loved",ingredients:"snail secretion filtrate 96.3%, betaine, sodium polyacrylate, hyaluronic acid, panthenol, allantoin",flaggedIngredients:[],likes:["seed_u03","seed_u06"],comments:[{uid:"seed_u06",displayName:"Danielle Park",photoURL:"https://i.pravatar.cc/150?img=45",text:"my skin texture completely changed after using this 😭✨"}],createdAt:{seconds:Math.floor(Date.now()/1000)-28800}},
    {id:"mock_05",uid:"seed_u05",displayName:"Brooke Sullivan",photoURL:"https://i.pravatar.cc/150?img=39",productName:"Paula's Choice BHA Exfoliant",brand:"Paula's Choice",poreScore:0,productImage:"",communityRating:8,postType:"loved",ingredients:"water, methylpropanediol, butylene glycol, salicylic acid, polysorbate 20, camellia oleifera leaf extract, allantoin",flaggedIngredients:[],likes:["seed_u02","seed_u04"],comments:[{uid:"seed_u07",displayName:"Alexis Turner",photoURL:"https://i.pravatar.cc/150?img=38",text:"blackheads GONE after 2 weeks no joke"}],createdAt:{seconds:Math.floor(Date.now()/1000)-43200}},
    {id:"mock_06",uid:"seed_u06",displayName:"Danielle Park",photoURL:"https://i.pravatar.cc/150?img=45",productName:"Laneige Lip Sleeping Mask",brand:"Laneige",poreScore:4,productImage:"",communityRating:6,postType:"brokeout",ingredients:"polybutene, phytosteryl/octyldodecyl lauroyl glutamate, hydrogenated polyisobutene, dipentaerythrityl hexacaprylate, fragrance, tocopheryl acetate",flaggedIngredients:["fragrance","tocopheryl acetate"],likes:["seed_u01","seed_u03"],comments:[{uid:"seed_u08",displayName:"Megan Foster",photoURL:"https://i.pravatar.cc/150?img=26",text:"ugh same, the fragrance got me around my mouth 😢"}],createdAt:{seconds:Math.floor(Date.now()/1000)-57600}},
    {id:"mock_07",uid:"seed_u07",displayName:"Alexis Turner",photoURL:"https://i.pravatar.cc/150?img=38",productName:"Drunk Elephant Protini Polypeptide",brand:"Drunk Elephant",poreScore:1,productImage:"",communityRating:8,postType:"wantToTry",ingredients:"water, glycerin, pentylene glycol, cetearyl alcohol, dimethicone, palmitoyl tripeptide-1, sodium hyaluronate, allantoin, panthenol",flaggedIngredients:[],likes:["seed_u02","seed_u05"],comments:[{uid:"seed_u09",displayName:"Simone Okafor",photoURL:"https://i.pravatar.cc/150?img=29",text:"omg let me know when you try it! I've been eyeing this for months"}],createdAt:{seconds:Math.floor(Date.now()/1000)-72000}},
    {id:"mock_08",uid:"seed_u08",displayName:"Megan Foster",photoURL:"https://i.pravatar.cc/150?img=26",productName:"Glow Recipe Watermelon Toner",brand:"Glow Recipe",poreScore:1,productImage:"",communityRating:7,postType:"loved",ingredients:"water, citrullus lanatus fruit extract, glycerin, hyaluronic acid, niacinamide, aloe barbadensis leaf juice, sodium hyaluronate",flaggedIngredients:[],likes:["seed_u03","seed_u07"],comments:[{uid:"seed_u10",displayName:"Taylor Nguyen",photoURL:"https://i.pravatar.cc/150?img=43",text:"just added this to my cart because of this post 😂"}],createdAt:{seconds:Math.floor(Date.now()/1000)-90000}},
    {id:"mock_09",uid:"seed_u09",displayName:"Simone Okafor",photoURL:"https://i.pravatar.cc/150?img=29",productName:"Sunday Riley Good Genes",brand:"Sunday Riley",poreScore:1,productImage:"",communityRating:9,postType:"loved",ingredients:"water, lactic acid, glycerin, aloe barbadensis leaf juice, sodium hydroxide, paeonia albiflora root extract, licorice root extract",flaggedIngredients:[],likes:["seed_u01","seed_u04","seed_u06"],comments:[{uid:"seed_u11",displayName:"Camille Petit",photoURL:"https://i.pravatar.cc/150?img=35",text:"my hyperpigmentation has literally never looked better 🙌"}],createdAt:{seconds:Math.floor(Date.now()/1000)-108000}},
    {id:"mock_10",uid:"seed_u10",displayName:"Taylor Nguyen",photoURL:"https://i.pravatar.cc/150?img=43",productName:"La Roche-Posay Toleriane Cleanser",brand:"La Roche-Posay",poreScore:0,productImage:"",communityRating:8,postType:"loved",ingredients:"aqua, glycerin, cocamidopropyl betaine, sodium lauroyl methyl isethionate, sodium chloride, citric acid, sodium benzoate",flaggedIngredients:[],likes:["seed_u02","seed_u05","seed_u07"],comments:[{uid:"seed_u12",displayName:"Naomi Whitfield",photoURL:"https://i.pravatar.cc/150?img=25",text:"sensitive skin girly approved ✅ my redness is so much calmer"}],createdAt:{seconds:Math.floor(Date.now()/1000)-129600}},
    {id:"mock_11",uid:"seed_u11",displayName:"Camille Petit",photoURL:"https://i.pravatar.cc/150?img=35",productName:"Summer Fridays Jet Lag Mask",brand:"Summer Fridays",poreScore:1,productImage:"",communityRating:8,postType:"loved",ingredients:"water, glycerin, niacinamide, squalane, centella asiatica extract, hyaluronic acid, oat extract, allantoin, ceramide np",flaggedIngredients:[],likes:["seed_u01","seed_u07","seed_u09"],comments:[{uid:"seed_u02",displayName:"Jenna Caldwell",photoURL:"https://i.pravatar.cc/150?img=49",text:"I use this before flights and land with glowing skin every time ✈️"}],createdAt:{seconds:Math.floor(Date.now()/1000)-151200}},
    {id:"mock_12",uid:"seed_u12",displayName:"Naomi Whitfield",photoURL:"https://i.pravatar.cc/150?img=25",productName:"First Aid Beauty KP Bump Eraser",brand:"First Aid Beauty",poreScore:1,productImage:"",communityRating:8,postType:"loved",ingredients:"water, glycolic acid, lactic acid, glycerin, urea, allantoin, aloe barbadensis leaf juice, salicylic acid",flaggedIngredients:[],likes:["seed_u03","seed_u06","seed_u10"],comments:[{uid:"seed_u07",displayName:"Alexis Turner",photoURL:"https://i.pravatar.cc/150?img=38",text:"been using this on my arms for a month and the texture is so smooth now"}],createdAt:{seconds:Math.floor(Date.now()/1000)-172800}},
    {id:"mock_13",uid:"seed_u13",displayName:"Kavya Sharma",photoURL:"https://i.pravatar.cc/150?img=31",productName:"Kiehl's Ultra Facial Cream",brand:"Kiehl's",poreScore:3,productImage:"",communityRating:6,postType:"brokeout",ingredients:"water, glycerin, squalane, petrolatum, stearyl alcohol, avocado oil, tocopheryl acetate, glacial glycoprotein",flaggedIngredients:["avocado oil","tocopheryl acetate"],likes:["seed_u04","seed_u08"],comments:[{uid:"seed_u05",displayName:"Brooke Sullivan",photoURL:"https://i.pravatar.cc/150?img=39",text:"same!! avocado oil is the worst for acne-prone skin 😤"}],createdAt:{seconds:Math.floor(Date.now()/1000)-194400}},
    {id:"mock_14",uid:"seed_u14",displayName:"Riley Andrews",photoURL:"https://i.pravatar.cc/150?img=27",productName:"Tatcha The Water Cream",brand:"Tatcha",poreScore:1,productImage:"",communityRating:9,postType:"loved",ingredients:"water, glycerin, dimethicone, isononyl isononanoate, niacinamide, pentylene glycol, haematococcus pluvialis extract, sodium hyaluronate",flaggedIngredients:[],likes:["seed_u01","seed_u02","seed_u04","seed_u07"],comments:[{uid:"seed_u03",displayName:"Leila Ramos",photoURL:"https://i.pravatar.cc/150?img=32",text:"splurged on this and honestly it's worth every penny 💸✨"}],createdAt:{seconds:Math.floor(Date.now()/1000)-216000}},
    {id:"mock_15",uid:"seed_u15",displayName:"Ava Chen",photoURL:"https://i.pravatar.cc/150?img=48",productName:"Neutrogena Hydro Boost Gel",brand:"Neutrogena",poreScore:1,productImage:"",communityRating:7,postType:"wantToTry",ingredients:"water, dimethicone, glycerin, dimethicone/vinyl dimethicone crosspolymer, sodium hyaluronate, phenoxyethanol, carbomer, sodium hydroxide",flaggedIngredients:[],likes:["seed_u03","seed_u06","seed_u10"],comments:[{uid:"seed_u15",displayName:"Ava Chen",photoURL:"https://i.pravatar.cc/150?img=48",text:"the drugstore version of the Tatcha — adding to my list!"}],createdAt:{seconds:Math.floor(Date.now()/1000)-237600}},
  ];

  // Looks up full product from Firestore by name to get authoritative ingredients/score
  async function openProductFromPost(post) {
    try {
      const q = query(collection(db,"products"),
        where("productName","==", post.productName), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = {id:snap.docs[0].id, ...snap.docs[0].data()};
        // Always prefer the longer/more complete ingredients string
        const ingA = (p.ingredients||"").trim();
        const ingB = (post.ingredients||"").trim();
        const ing = ingA.length >= ingB.length ? (ingA || ingB) : (ingB || ingA);
        const liveScore = ing.length > 10
          ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
          : null;
        const computedScore = liveScore ?? p.poreScore ?? post.poreScore ?? 0;
        setSelectedProduct({
          productName: p.productName || post.productName,
          brand: p.brand || post.brand,
          image: p.adminImage || p.image || post.productImage || "",
          poreScore: computedScore,
          communityRating: p.communityRating || post.communityRating,
          ingredients: ing,
          flaggedIngredients: ing ? analyzeIngredients(ing).found : (post.flaggedIngredients||[]),
          buyUrl: p.buyUrl || amazonUrl(post.productName, post.brand, post.barcode, post.asin, post.buyUrl),
        });
        return;
      }
    } catch(e) { /* fall through */ }
    // Fallback to post/product data (handles both post and product objects)
    const ing = (post.ingredients||"").trim();
    const liveScore = ing.length > 10
      ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })()
      : null;
    const pName = post.productName || post.name || "";
    setSelectedProduct({
      productName: pName, brand: post.brand,
      image: post.adminImage || post.image || post.productImage || "",
      poreScore: liveScore ?? post.poreScore ?? 0,
      communityRating: post.communityRating,
      ingredients: ing,
      flaggedIngredients: ing ? analyzeIngredients(ing).found : (post.flaggedIngredients||[]),
      buyUrl: post.buyUrl || amazonUrl(pName, post.brand, post.barcode, post.asin, post.buyUrl),
    });
  }

  async function loadFeed() {
    setLoading(true);
    try {
      const [p, n] = await Promise.all([
        getFeed(profile?.following, user.uid),
        getNotifications(user.uid),
      ]);
      const FEED_TYPES = new Set(["brokeout","wantToTry","loved","commented"]);
      const realPosts = p.filter(post => FEED_TYPES.has(post.postType))
        .sort((a,b) => (b.createdAt?.seconds||0) - (a.createdAt?.seconds||0));
      // Seeds always append — real posts take priority if same product name
      const realNames = new Set(realPosts.map(p => p.productName?.toLowerCase()));
      const seedPosts = MOCK_POSTS.filter(m => !realNames.has(m.productName?.toLowerCase()));
      setPosts([...realPosts, ...seedPosts]);
      setNotifs(n);
    } catch(e) { console.error("loadFeed", e); }
    setLoading(false);
  }

  // Unified search: users + products simultaneously
  useEffect(()=>{
    if (!searchQ.trim()) { setSearchResults({users:[],products:[]}); setSearchOpen(false); return; }
    setSearchOpen(true);
    setSearchLoading(true);
    const timer = setTimeout(async ()=>{
      try {
        const [users, products] = await Promise.all([
          searchUsers(searchQ),
          searchProducts(searchQ).catch(()=>[]),
        ]);
        setSearchResults({users: users.slice(0,3), products: products.slice(0,20)});
      } catch {}
      setSearchLoading(false);
    }, 350);
    return ()=>clearTimeout(timer);
  },[searchQ]);

  // Load suggested users to follow
  useEffect(()=>{
    async function loadSuggested() {
      try {
        const snap = await getDocs(query(collection(db,"users"), limit(100)));
        const following = new Set(profile?.following || []);
        const myFollowing = profile?.following || [];

        const others = snap.docs
          .map(d=>({uid:d.id,...d.data()}))
          .filter(u => u.uid !== user.uid && !following.has(u.uid))
          .map(u => {
            const followerCount = (u.followers||[]).length;
            // Shared connections: people I follow who also follow this user
            const sharedConnections = (u.followers||[]).filter(fid => myFollowing.includes(fid)).length;
            return {...u, followerCount, sharedConnections};
          })
          // Only show users with shared connections OR 10+ followers
          .filter(u => u.sharedConnections > 0 || u.followerCount >= 10)
          .sort((a,b) => (b.sharedConnections - a.sharedConnections) || (b.followerCount - a.followerCount))
          .slice(0,6);
        setSuggestedUsers(others);
      } catch {}
    }
    loadSuggested();
  },[refreshKey]);

  // Build recommendations: community posts first, fall back to curated list
  useEffect(()=>{
    async function loadRecs() {
      try {
        const followingIds = profile?.following||[];

        // Build "what friends are using" from their routines
        if (followingIds.length > 0) {
          const friendDocs = await Promise.all(
            followingIds.slice(0,10).map(uid =>
              getDoc(doc(db,"users",uid)).then(d => d.exists() ? {uid:d.id,...d.data()} : null).catch(()=>null)
            )
          );
          const friends = friendDocs.filter(Boolean);

          // Count how many friends have each product in their routine
          const productCount = {};
          const productFriends = {};
          friends.forEach(f => {
            (f.routine||[]).forEach(name => {
              const key = name.toLowerCase().trim();
              productCount[key] = (productCount[key]||0) + 1;
              if (!productFriends[key]) productFriends[key] = [];
              productFriends[key].push(f.displayName||"Someone");
            });
          });

          const friendRecs = Object.entries(productCount)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,8)
            .map(([key, count]) => ({
              id: key,
              productName: key.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" "),
              poreScore: 0,
              communityRating: null,
              image: null,
              friendCount: count,
              friendNames: productFriends[key],
            }));

          if (friendRecs.length >= 2) {
            setRecPosts(friendRecs);
            // Still load trending
            const allGlobal = await getGlobalFeed();
            const weekAgo = Date.now() - 7*24*60*60*1000;
            const recent = allGlobal.filter(p=>{ const ts=p.createdAt?.seconds?p.createdAt.seconds*1000:0; return ts>weekAgo; });
            if (recent.length) {
              const counted = {};
              recent.forEach(p=>{ if(!p.productName) return; const k=p.productName.toLowerCase(); if(!counted[k]) counted[k]={productName:p.productName,brand:p.brand,poreScore:p.poreScore,communityRating:p.communityRating,image:p.productImage||p.image||"",scanCount:0,likeCount:0,postType:p.postType}; counted[k].scanCount++; counted[k].likeCount+=(p.likes?.length||0); });
              const top5 = Object.values(counted).sort((a,b)=>(b.scanCount+b.likeCount)-(a.scanCount+a.likeCount)).slice(0,5);
              if(top5.length) setTrendingList(top5);
            }
            return;
          }
        }

        // Fallback: community recs + curated from Firestore
        const followPosts = await getFeed(followingIds, user.uid);
        const globalPosts = await getGlobalFeed();
        globalPostsRef.current = globalPosts;
        const allPosts = [...followPosts, ...globalPosts];
        const seen = new Set();
        const communityRecs = allPosts
          .filter(p => p.communityRating >= 7 && (p.poreScore ?? 5) <= 1 && p.productName)
          .filter(p => { const key=p.productName.toLowerCase(); if(seen.has(key))return false; seen.add(key); return true; })
          .slice(0, 6);

        if (communityRecs.length >= 3) {
          setRecPosts(communityRecs);
        } else {
          const curated = await fetchCuratedRecs();
          const curatedNeeded = curated.filter(c => (c.poreScore??99) <= 1 && !communityRecs.some(r=>r.productName.toLowerCase()===c.productName.toLowerCase()));
          setRecPosts([...communityRecs, ...curatedNeeded].slice(0, 6));
        }

        // Trending
        const allGlobal = await getGlobalFeed();
        const weekAgo = Date.now() - 7*24*60*60*1000;
        const recent = allGlobal.filter(p=>{ const ts=p.createdAt?.seconds?p.createdAt.seconds*1000:0; return ts>weekAgo; });
        if (recent.length) {
          const counted = {};
          recent.forEach(p=>{ if(!p.productName) return; const k=p.productName.toLowerCase(); if(!counted[k]) counted[k]={productName:p.productName,brand:p.brand,poreScore:p.poreScore,communityRating:p.communityRating,image:p.productImage||p.image||"",scanCount:0,likeCount:0}; counted[k].scanCount++; counted[k].likeCount+=(p.likes?.length||0); });
          const top5 = Object.values(counted).sort((a,b)=>(b.scanCount+b.likeCount)-(a.scanCount+a.likeCount)).slice(0,5);
          if(top5.length) setTrendingList(top5);
        }
      } catch {
        setRecPosts(CURATED_RECS_FALLBACK);
      }
    }
    loadRecs();
  },[refreshKey, profile?.skinType, profile?.following]);





  const inp = {width:"100%",padding:"0.65rem 1rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",transition:"border-color 0.15s"};

  return (
    <div
      ref={scrollRef}
      style={{maxWidth:"480px",margin:"0 auto",paddingBottom:"6rem",overflowY:"auto",height:"100%"}}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {(pullY > 5 || refreshing) && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:`${refreshing?48:Math.max(pullY*0.85,0)}px`,transition:refreshing?"height 0.2s ease":"height 0.12s",overflow:"hidden"}}>
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.25rem",opacity:Math.min((pullY/45),1),transition:"opacity 0.1s"}}>
            {refreshing ? (
              <div style={{width:"22px",height:"22px",borderRadius:"50%",border:`2.5px solid ${T.accent}20`,borderTopColor:T.accent,animation:"ptrSpin 0.7s linear infinite"}}/>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"
                style={{transform:`rotate(${Math.min(pullY/45*180,180)}deg)`,transition:"transform 0.1s"}}>
                <polyline points="17 11 12 6 7 11"/><line x1="12" y1="6" x2="12" y2="18"/>
              </svg>
            )}
            <span style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif",letterSpacing:"0.04em"}}>
              {refreshing ? "Refreshing…" : pullY > 45 ? "Release" : "Pull to refresh"}
            </span>
          </div>
        </div>
      )}
      <PageHero pageTitle="Feed" pageIcon={RalliIcons.community(T.textLight, 16)} fixed="Real people. Real skin. Real insights."/>
      {/* Divider */}
      <div style={{padding:"0.85rem 1rem 0"}}>
      {/* Unified search */}
      <div style={{marginBottom:"1rem",position:"relative"}}>
        <div style={{position:"relative"}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{position:"absolute",left:"0.85rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            value={searchQ}
            onChange={e=>setSearchQ(e.target.value)}
            onFocus={()=>searchQ.trim()&&setSearchOpen(true)}
            onBlur={()=>setTimeout(()=>setSearchOpen(false),150)}
            onKeyDown={e=>{if(e.key==="Enter"&&searchQ.trim()){setSearchOpen(true);}}}
            placeholder="Search products, brands or people…"
            style={{...inp, paddingLeft:"2.25rem", paddingRight: searchQ?"2.25rem":"1rem"}}
            onFocusCapture={e=>e.target.style.borderColor=T.accent}
            onBlurCapture={e=>e.target.style.borderColor=T.border}
          />
          {searchQ&&(
            <button onClick={()=>{setSearchQ("");setSearchResults({users:[],products:[]});setSearchOpen(false);}}
              style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",padding:"2px",color:T.textLight,display:"flex",alignItems:"center"}}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {searchOpen&&searchQ.trim()&&(
          <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",boxShadow:"0 8px 32px rgba(28,28,26,0.12)",zIndex:50,overflow:"hidden",maxHeight:"70vh",overflowY:"auto"}}>
            {searchLoading&&(
              <div style={{padding:"1rem",textAlign:"center",color:T.textLight,fontSize:"0.82rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
                <div style={{width:"10px",height:"10px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite",flexShrink:0}}/>
                Searching 200k+ products…
              </div>
            )}

            {!searchLoading&&searchResults.users.length===0&&searchResults.products.length===0&&(
              <div style={{padding:"1rem"}}>
                <div style={{textAlign:"center",color:T.textLight,fontSize:"0.82rem",marginBottom:"0.75rem"}}>Not found in 200k+ products</div>
                <button
                  onMouseDown={async()=>{
                    try {
                      await addDoc(collection(db,"products"),{
                        productName: searchQ,
                        brand: "Unknown",
                        category: "other",
                        image: "",
                        buyUrl: "",
                        ingredients: "",
                        poreScore: 0,
                        scanCount: 0,
                        approved: false,
                        hidden: false,
                        isRequest: true,
                        requestedBy: user.uid,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        source: "user_request",
                      });
                      setSearchQ("");
                      setSearchOpen(false);
                      alert("✅ Request submitted! We'll add \"" + searchQ + "\" soon.");
                    } catch(e) {
                      alert("Could not submit request: " + e.message);
                    }
                  }}
                  style={{width:"100%",padding:"0.65rem",background:T.accent+"18",border:`1.5px dashed ${T.accent}55`,borderRadius:"0.75rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontSize:"0.8rem",fontWeight:"600",color:T.accent,display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem"}}>
                  <span style={{fontSize:"1rem"}}>➕</span> Add "{searchQ}" manually
                </button>
                <div style={{textAlign:"center",fontSize:"0.65rem",color:T.textLight,marginTop:"0.4rem"}}>Paste the ingredient list and we'll score it</div>
              </div>
            )}

            {/* People section */}
            {!searchLoading&&searchResults.users.length>0&&(
              <div>
                <div style={{padding:"0.5rem 1rem 0.25rem",fontSize:"0.62rem",color:T.textLight,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif"}}>People</div>
                {searchResults.users.map((u,i)=>(
                  <button key={u.uid} onMouseDown={()=>{setSearchQ("");setSearchOpen(false);onUserTap(u.uid);}}
                    style={{width:"100%",display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 1rem",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",textAlign:"left"}}
                    onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                    onMouseLeave={e=>e.currentTarget.style.background="none"}>
                    <Avatar photoURL={u.photoURL} name={u.displayName} size={32}/>
                    <div>
                      <div style={{fontSize:"0.83rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{u.displayName}</div>
                      <div style={{fontSize:"0.7rem",color:T.textLight}}>{(u.followers||[]).length} followers</div>
                    </div>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{marginLeft:"auto",flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
                  </button>
                ))}
              </div>
            )}

            {/* Products section */}
            {!searchLoading&&searchResults.products.length>0&&(
              <div>
                <div style={{padding:"0.5rem 1rem 0.25rem",fontSize:"0.62rem",color:T.textLight,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif",borderTop:searchResults.users.length>0?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>Products & Brands</span>
                  
                </div>
                {searchResults.products.map((p,i)=>{
                  const res = analyzeIngredients(p.ingredients||"");
                  const ps  = poreStyle(res.avgScore||0);
                  return (
                    <button key={p.code||i}
                      onMouseDown={()=>{
                        setSearchQ(""); setSearchOpen(false);
                        setSelectedProduct({
                          id:p.code, productName:p.name, brand:p.brand,
                          image:p.image, poreScore:Math.round(res.avgScore||0),
                          communityRating:null, ingredients:p.ingredients,
                          flaggedIngredients: [...(res.poreCloggers||res.found.filter(x=>x.score>=1)||[]), ...(res.irritants||[])].sort((a,b)=>b.score-a.score).slice(0,6).map(x=>x.name),
                        });
                      }}
                      style={{width:"100%",display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 1rem",background:"none",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",textAlign:"left",transition:"background 0.1s"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                      onMouseLeave={e=>e.currentTarget.style.background="none"}>
                      <div style={{width:"44px",height:"44px",borderRadius:"0.65rem",flexShrink:0,overflow:"hidden",background:T.surfaceAlt}}>
                        <ProductImage src={p.image||null} name={p.name} brand={p.brand||""} barcode={p.code||""} size="full"/>
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</div>
                        {p.brand&&<div style={{fontSize:"0.72rem",color:T.textMid,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginTop:"1px"}}>{p.brand.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</div>}
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"0.2rem",flexShrink:0}}>
                        <PoreScoreBadge score={res.avgScore!=null ? Math.round(res.avgScore) : null} size="sm"/>
                        {p._cached && p._approved
                          ? <span style={{fontSize:"0.5rem",color:T.navy,background:T.iceBlue+"80",padding:"0.05rem 0.35rem",borderRadius:"999px",border:`1px solid ${T.iceBlue}`,fontWeight:"700"}}>✓ In Ralli</span>
                          : null
                        }
                        {p.communityRating&&<span style={{fontSize:"0.5rem",color:T.textMid,fontWeight:"500"}}>⭐ {p.communityRating}/10</span>}
                        {p.scanCount>0&&<span style={{fontSize:"0.48rem",color:T.textLight}}>{p.scanCount} {p.scanCount===1?"scan":"scans"}</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Feed Tab Bar ─────────────────────────────────────── */}
      {(()=>{
        const FEED_TABS=[{id:"forYou",label:"For You"},{id:"following",label:"Following"}];
        const tabIdx=FEED_TABS.findIndex(t=>t.id===tab);
        return (
          <div style={{position:"relative",display:"flex",marginBottom:"1rem",background:T.surfaceAlt,borderRadius:"0.85rem",padding:"0.25rem"}}>
            {/* Sliding pill */}
            <div style={{position:"absolute",top:"0.25rem",left:`calc(${tabIdx}/2*100% + 0.25rem)`,width:`calc(100%/2 - 0.17rem)`,height:"calc(100% - 0.5rem)",background:T.surface,borderRadius:"0.65rem",boxShadow:"0 1px 4px rgba(0,0,0,0.08)",transition:"left 0.22s cubic-bezier(0.34,1.3,0.64,1)",pointerEvents:"none"}}/>
            {FEED_TABS.map(t=>(
              <button key={t.id} onClick={()=>setTab(t.id)} className="tap-scale"
                style={{flex:1,padding:"0.5rem 0",background:"transparent",border:"none",borderRadius:"0.65rem",fontSize:"0.75rem",fontWeight:tab===t.id?"700":"500",color:tab===t.id?T.text:T.textLight,cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"color 0.2s",position:"relative",zIndex:1}}>
                {t.label}
              </button>
            ))}
          </div>
        );
      })()}

      <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdateProfile} onUserTap={onUserTap}/>

      {loading
        ? <FeedSkeleton/>
        : (()=>{
            const friendCount = (profile?.following||[]).length;
            const realPosts = posts.filter(p => !p.uid?.startsWith("seed_"));
            const hasFriendPosts = realPosts.length > 0;
            const recentNotifs = (notifs||[]).filter(n=>["like","comment","follow"].includes(n.type)).slice(0,5);
            const doFollow = async uid => { await followUser(user.uid,uid,profile?.displayName||"Someone",profile?.photoURL||""); onUpdateProfile({...profile,following:[...(profile?.following||[]),uid]}); };

            const FeedSectionLabel = ({label, icon=null, color=T.textLight}) => (
              <div style={{display:"flex",alignItems:"center",gap:"0.35rem",fontSize:"0.6rem",fontWeight:"700",color,textTransform:"uppercase",letterSpacing:"0.12em",padding:"1.1rem 1rem 0.5rem",fontFamily:"'Inter',sans-serif",borderLeft:`3px solid ${T.iceBlue}`,marginLeft:"0.5rem"}}>
                {icon&&icon}{label}
              </div>
            );

            // ── Discover card ──────────────────────────────────────
            const DiscoverCard = ({label="Suggested for you"}) => (
              <div style={{marginBottom:"0.85rem"}}>
                <div style={{fontSize:"0.6rem",fontWeight:"600",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.5rem",fontFamily:"'Inter',sans-serif"}}>{label}</div>
                <ContactSuggestions currentUid={user.uid} currentProfile={profile} onFollow={doFollow} onUserTap={onUserTap}/>
              </div>
            );

            // ── Recs card ── (rendered above the tip, not here)
            const RecsCard = () => null;

            // ── FOR YOU TAB ────────────────────────────────────────
            if (tab==="forYou") {
              const seen = new Set();
              const realDeduped = posts.filter(p=>{ const k=p.productName?.toLowerCase()||p.id; if(seen.has(k))return false; seen.add(k); return true; });
              const seedDeduped = MOCK_POSTS.filter(m=>{ const k=m.productName?.toLowerCase()||m.id; if(seen.has(k))return false; seen.add(k); return true; });
              const allPosts = [...realDeduped, ...seedDeduped]
                .filter(p=>["loved","brokeout","wantToTry"].includes(p.postType))
                .sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));

              // Separate into community love and warnings
              const lovedPosts = allPosts.filter(p=>p.postType==="loved");
              const warningPosts = allPosts.filter(p=>p.postType==="brokeout");
              const watchingPosts = allPosts.filter(p=>p.postType==="wantToTry");

              // Interleaved feed: loved first, warning cards sprinkled in
              const mainFeed = [];
              let wi = 0, wai = 0;
              lovedPosts.forEach((p, i) => {
                mainFeed.push(p);
                if (i % 3 === 2 && wi < warningPosts.length) mainFeed.push(warningPosts[wi++]);
              });
              while (wi < warningPosts.length) mainFeed.push(warningPosts[wi++]);
              while (wai < watchingPosts.length) mainFeed.push(watchingPosts[wai++]);

              return (
                <div style={{paddingBottom:"1rem"}}>
                  {/* Only show discover nudge if fewer than 3 real following */}
                  {friendCount < 3 && (
                    <div style={{margin:"0 1rem 1.25rem",padding:"0.85rem 1rem",background:`linear-gradient(135deg,${T.accent}10,${T.sage}08)`,borderRadius:"0.85rem",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.75rem"}}>
                      <div style={{fontSize:"1.4rem",flexShrink:0}}>👋</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.8rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"2px"}}>Follow people to personalise your feed</div>
                        <div style={{fontSize:"0.7rem",color:T.textLight,lineHeight:1.4}}>See what your circle is actually using</div>
                      </div>
                      <button onClick={()=>onUpdateProfile({_navigateTo:"profile_people"})} style={{padding:"0.4rem 0.85rem",background:T.navy,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>Find People →</button>
                    </div>
                  )}

                  {/* ── Trending This Week ── */}
                  <TrendingSection openProductFromPost={openProductFromPost} trendingList={trendingList} />

                  {/* Clean product feed */}
                  <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",padding:"0 0.75rem"}}>
                    {mainFeed.map((p,i)=>(
                      <CardReveal key={p.id} delay={i*30}>
                        <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName||""} currentUserPhoto={profile?.photoURL||""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap}/>
                      </CardReveal>
                    ))}
                  </div>

                  {/* Discover more at bottom */}
                  {mainFeed.length > 0 && (
                    <div style={{margin:"1.5rem 1rem 0",padding:"1rem",background:T.surfaceAlt,borderRadius:"0.85rem",textAlign:"center"}}>
                      <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>Find more Ralliers like you</div>
                      <div style={{fontSize:"0.68rem",color:T.textLight,marginBottom:"0.75rem"}}>Follow people to see their real skincare routines</div>
                      <button onClick={()=>onUpdateProfile({_navigateTo:"profile_people"})} style={{padding:"0.45rem 1.25rem",background:T.navy,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.75rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Find People</button>
                    </div>
                  )}
                </div>
              );
            }

            // ── FOLLOWING TAB ──────────────────────────────────────
            if (!hasFriendPosts) return (
              <div style={{paddingBottom:"1rem"}}>
                <div style={{textAlign:"center",padding:"2rem 1rem 1.25rem"}}>
                  <div style={{fontSize:"1.8rem",marginBottom:"0.5rem"}}>✨</div>
                  <div style={{fontSize:"0.9rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.35rem"}}>Your following feed is empty</div>
                  <div style={{fontSize:"0.75rem",color:T.textLight,lineHeight:1.5,marginBottom:"1rem"}}>Follow people to see what they're actually using on their skin.</div>
                  <button onClick={()=>onUpdateProfile({_navigateTo:"profile_people"})} style={{padding:"0.6rem 1.5rem",background:T.navy,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Find People →</button>
                </div>
                <div style={{padding:"0 1rem 0.5rem",fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'Inter',sans-serif"}}>What the community is using</div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",padding:"0 0.75rem"}}>
                  {MOCK_POSTS.slice(0,6).map((p,i)=>(
                    <CardReveal key={p.id} delay={i*40}>
                      <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName||""} currentUserPhoto={profile?.photoURL||""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap}/>
                    </CardReveal>
                  ))}
                </div>
              </div>
            );

            // ── Has real friend posts ──────────────────────────────
            const allFollowingPosts = realPosts.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0));
            const seedPad = allFollowingPosts.length < 4
              ? MOCK_POSTS.filter(m=>!allFollowingPosts.some(p=>p.productName?.toLowerCase()===m.productName?.toLowerCase())).slice(0, 5-allFollowingPosts.length)
              : [];

            return (
              <div style={{paddingBottom:"1rem"}}>
                <div style={{display:"flex",flexDirection:"column",gap:"0.75rem",padding:"0 0.75rem"}}>
                  {allFollowingPosts.map((p,i)=>(
                    <CardReveal key={p.id} delay={i*40}>
                      <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName||""} currentUserPhoto={profile?.photoURL||""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap}/>
                    </CardReveal>
                  ))}
                  {seedPad.length > 0 && <>
                    <div style={{padding:"0.5rem 0 0.25rem",fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'Inter',sans-serif"}}>Also in the community</div>
                    {seedPad.map((p,i)=>(
                      <CardReveal key={p.id} delay={i*40}>
                        <PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName||""} currentUserPhoto={profile?.photoURL||""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap}/>
                      </CardReveal>
                    ))}
                  </>}
                </div>
                {friendCount < 8 && (
                  <div style={{margin:"1.25rem 0.75rem 0",padding:"0.85rem 1rem",background:T.surfaceAlt,borderRadius:"0.85rem",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.75rem"}}>
                    <div style={{fontSize:"0.75rem",color:T.textMid,fontFamily:"'Inter',sans-serif",lineHeight:1.4}}>Follow more people to grow your feed</div>
                    <button onClick={()=>onUpdateProfile({_navigateTo:"profile_people"})} style={{padding:"0.4rem 0.85rem",background:T.navy,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>Find People →</button>
                  </div>
                )}
              </div>
            );
          })()
      }
      </div>
    </div>
  );
}

// ── ProfilePage ───────────────────────────────────────────────
// Fetches product image: UPCItemDB → Open Beauty Facts → placeholder
function ListItemImage({name, color}) {
  const [img, setImg] = useState(null);
  const [tried, setTried] = useState(false);

  useEffect(()=>{
    if (tried || !name) return;
    setTried(true);
    async function fetchImg() {
      // Amazon first — clean retail photos
      try {
        const productBuyUrl = amazonUrl(name, brand, barcode);
                const html = await r.text();
        const matches = [...html.matchAll(/https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9%._-]+\._AC_[A-Z0-9_,]+_\.jpg/g)];
        const img = matches.find(m => !m[0].includes('_SR') && !m[0].includes('sprite'));
        if (img?.[0]) { setImg(img[0]); return; }
      } catch {}
    }
    fetchImg();
  },[name]);

  const words = name.trim().split(" ");
  const abbr = words.length>=2 ? words[0][0].toUpperCase()+words[1][0].toUpperCase() : name.slice(0,2).toUpperCase();

  return (
    <div style={{width:"100%",height:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {!img&&<PlaceholderCard name={name} brand=""  />}
      {img&&<img src={img} alt={name} style={{position:"absolute",top:0,left:0,right:0,bottom:0,width:"100%",height:"100%",objectFit:"contain",padding:"6px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={()=>setImg(null)}/>}
    </div>
  );
}

function ListSection({title, icon, color, items, onAdd, onRemove, isPrivate, onTogglePrivacy, readOnly, onItemTap, allProducts=[]}) {
  const [input, setInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  function handleInput(val) {
    setInput(val);
    if (!val.trim()) { setSuggestions([]); return; }
    const q = val.toLowerCase();
    const matches = allProducts
      .filter(p => p.productName && (
        p.productName.toLowerCase().includes(q) ||
        (p.brand||"").toLowerCase().includes(q)
      ))
      .slice(0, 6);
    setSuggestions(matches);
  }

  function submit(name) {
    const v = (name || input).trim();
    if (!v) return;
    onAdd(v); setInput(""); setAdding(false); setSuggestions([]);
  }

  const visibleItems = expanded ? items : items;

  return (
    <div style={{marginBottom:"1.75rem",background:T.surface,borderRadius:"1.25rem",border:`1.5px solid ${color}22`,overflow:"hidden",boxShadow:`0 2px 12px ${color}10`}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.85rem 1rem 0.75rem",borderBottom:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <div style={{width:"8px",height:"8px",borderRadius:"50%",background:color,flexShrink:0}}/>
          <span style={{fontSize:"0.75rem",fontWeight:"700",color:T.navy,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif"}}>{title}</span>
          {items.length>0&&<span style={{fontSize:"0.65rem",background:color+"20",color:color,borderRadius:"999px",padding:"0.1rem 0.5rem",fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>{items.length}</span>}
          {isPrivate&&<span style={{fontSize:"0.58rem",color:T.textLight,background:T.surfaceAlt,borderRadius:"999px",padding:"0.1rem 0.4rem",border:`1px solid ${T.border}`}}>Private</span>}
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"0.3rem"}}>
          {!readOnly&&onTogglePrivacy&&(
            <button onClick={onTogglePrivacy} title={isPrivate?"Make public":"Make private"}
              style={{background:"none",border:"none",cursor:"pointer",padding:"0.2rem",color:isPrivate?T.accent:T.textLight,display:"flex",alignItems:"center"}}
              onMouseEnter={e=>e.currentTarget.style.color=color}
              onMouseLeave={e=>e.currentTarget.style.color=isPrivate?T.accent:T.textLight}>
              {isPrivate
                ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
              }
            </button>
          )}
          {!readOnly&&(
            <button onClick={()=>setAdding(a=>!a)}
              style={{width:"26px",height:"26px",borderRadius:"50%",background:adding?color:color+"15",border:`1.5px solid ${adding?color:color+"30"}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:adding?"#FFFFFF":color,transition:"all 0.15s",padding:0,flexShrink:0}}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform:adding?"rotate(45deg)":"none",transition:"transform 0.2s"}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* Add input */}
      {adding&&(
        <div style={{padding:"0.65rem 1rem",borderBottom:`1px solid ${T.border}`,position:"relative"}}>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <input value={input} onChange={e=>handleInput(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter")submit();if(e.key==="Escape"){setAdding(false);setInput("");setSuggestions([]);}}}
              placeholder="Search products…" autoFocus
              style={{flex:1,padding:"0.55rem 0.8rem",borderRadius:"0.6rem",border:`1.5px solid ${color}`,fontSize:"0.82rem",color:T.text,background:"#fff",outline:"none",fontFamily:"'Inter',sans-serif"}}/>
            <button onClick={()=>submit()} disabled={!input.trim()}
              style={{padding:"0.55rem 0.9rem",background:input.trim()?color:T.surfaceAlt,color:input.trim()?"#FFFFFF":T.textLight,border:"none",borderRadius:"0.6rem",fontSize:"0.8rem",fontWeight:"600",cursor:input.trim()?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif"}}>
              Add
            </button>
          </div>
          {suggestions.length>0&&(
            <div style={{position:"absolute",top:"calc(100% + 2px)",left:"1rem",right:"1rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.65rem",zIndex:100,overflow:"hidden",boxShadow:"0 6px 20px rgba(0,0,0,0.1)"}}>
              {suggestions.map((p,i)=>(
                <button key={i} onClick={()=>submit(p.productName)}
                  style={{width:"100%",padding:"0.5rem 0.75rem",background:"transparent",border:"none",borderBottom:i<suggestions.length-1?`1px solid ${T.border}`:"none",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:"0.5rem",fontFamily:"'Inter',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <div style={{width:"32px",height:"32px",borderRadius:"0.4rem",overflow:"hidden",flexShrink:0,background:T.surfaceAlt}}>
                    <ProductImage src={p.image||null} name={p.productName} brand={p.brand} size="full"/>
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                    <div style={{fontSize:"0.65rem",color:T.textLight}}>{p.brand}</div>
                  </div>
                </button>
              ))}
              {input.trim()&&!suggestions.find(p=>p.productName.toLowerCase()===input.toLowerCase())&&(
                <button onClick={()=>submit(input.trim())}
                  style={{width:"100%",padding:"0.5rem 0.8rem",background:color+"0a",border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",textAlign:"left",fontSize:"0.75rem",color,fontWeight:"600",fontFamily:"'Inter',sans-serif"}}
                  onMouseEnter={e=>e.currentTarget.style.background=color+"18"}
                  onMouseLeave={e=>e.currentTarget.style.background=color+"0a"}>
                  + Add "{input.trim()}" manually
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Carousel */}
      {items.length > 0 ? (
        <div style={{overflowX:"auto",scrollbarWidth:"none",msOverflowStyle:"none",WebkitOverflowScrolling:"touch",padding:"0.85rem 1rem",display:"flex",gap:"0.65rem",alignItems:"stretch"}}>
          {items.map((item,i)=>{
            const prod = allProducts.find(p=>(p.productName||"").toLowerCase()===item.toLowerCase())
              || allProducts.find(p=>(p.productName||"").toLowerCase().includes(item.toLowerCase().split(" ").slice(0,2).join(" ")));
            const ps = prod?.poreScore!=null ? poreStyle(prod.poreScore) : null;
            const imgSrc = prod?.adminImage||prod?.image||prod?.productImage||"";
            const hasImg = imgSrc.startsWith("http");
            return (
              <div key={i} onClick={()=>onItemTap&&onItemTap(item)}
                style={{flexShrink:0,width:"110px",background:"#fff",borderRadius:"1rem",border:`1px solid ${T.border}`,
                  cursor:onItemTap?"pointer":"default",display:"flex",flexDirection:"column",overflow:"hidden",
                  transition:"border-color 0.15s,box-shadow 0.15s",position:"relative"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.boxShadow=`0 4px 16px ${color}25`;}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";}}>
                {/* Remove button */}
                {!readOnly&&(
                  <button onClick={e=>{e.stopPropagation();onRemove(item);}}
                    style={{position:"absolute",top:"5px",right:"5px",width:"18px",height:"18px",borderRadius:"50%",background:"rgba(255,255,255,0.9)",border:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:2,padding:0,lineHeight:1,transition:"all 0.12s"}}
                    onMouseEnter={e=>{e.currentTarget.style.background=T.rose;e.currentTarget.style.borderColor=T.rose;e.currentTarget.querySelector("svg").style.stroke="#fff";}}
                    onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.9)";e.currentTarget.style.borderColor=T.border;e.currentTarget.querySelector("svg").style.stroke=T.textLight;}}>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                )}
                {/* Image area */}
                <div style={{width:"100%",height:"90px",background:hasImg?"#fff":color+"10",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",borderBottom:`1px solid ${T.border}`}}>
                  {hasImg
                    ? <img src={imgSrc} style={{width:"100%",height:"100%",objectFit:"contain",padding:"8px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>{e.target.style.display="none";}}/>
                    : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"4px",padding:"0.5rem"}}>
                        <div style={{width:"28px",height:"28px",borderRadius:"50%",background:color+"25",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <div style={{width:"10px",height:"10px",borderRadius:"50%",background:color}}/>
                        </div>
                      </div>
                  }
                </div>
                {/* Info */}
                <div style={{padding:"0.5rem 0.55rem",flex:1,display:"flex",flexDirection:"column",gap:"0.2rem"}}>
                  {prod?.brand&&<div style={{fontSize:"0.52rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{prod.brand}</div>}
                  <div style={{fontSize:"0.7rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.25,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{item}</div>
                  {ps&&(
                    <div style={{marginTop:"auto",display:"inline-flex",alignItems:"center",gap:"2px",background:ps.color+"15",borderRadius:"999px",padding:"0.12rem 0.4rem",alignSelf:"flex-start"}}>
                      <span style={{fontSize:"0.6rem",fontWeight:"800",color:ps.color}}>{prod.poreScore}/5</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {/* Add card */}
          {!readOnly&&(
            <div onClick={()=>setAdding(a=>!a)}
              style={{flexShrink:0,width:"80px",borderRadius:"1rem",border:`1.5px dashed ${color}50`,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"0.4rem",cursor:"pointer",transition:"all 0.15s",padding:"1rem 0.5rem",background:color+"05"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.background=color+"12";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"50";e.currentTarget.style.background=color+"05";}}>
              <div style={{width:"28px",height:"28px",borderRadius:"50%",background:color+"20",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </div>
              <span style={{fontSize:"0.6rem",color:color,fontWeight:"600",fontFamily:"'Inter',sans-serif",textAlign:"center"}}>Add</span>
            </div>
          )}
        </div>
      ) : (
        <div style={{padding:"1rem"}}>
          {!readOnly&&!adding&&(
            <button onClick={()=>setAdding(true)}
              style={{width:"100%",padding:"0.75rem",background:"transparent",border:`1.5px dashed ${color}40`,borderRadius:"0.75rem",color:T.textLight,fontSize:"0.78rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",textAlign:"center",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=color;e.currentTarget.style.color=color;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=color+"40";e.currentTarget.style.color=T.textLight;}}>
              + Add your first product
            </button>
          )}
          {readOnly&&<div style={{color:T.textLight,fontSize:"0.78rem",fontStyle:"italic",padding:"0.25rem 0"}}>Nothing here yet</div>}
        </div>
      )}
    </div>
  );
}

const FOUNDERS = [
  {email:"mckenzierichard77@gmail.com", name:"McKenzie Richard", initial:"Mk"},
  {email:"morganrichard777@gmail.com",  name:"Morgan Richard",   initial:"Mo"},
];

// ── Avatar Crop / Position Modal ─────────────────────────────
function AvatarCropModal({photoURL, initialOffsetX=50, initialOffsetY=50, initialScale=1, onSave, onClose}) {
  const [ox, setOx] = useState(initialOffsetX);
  const [oy, setOy] = useState(initialOffsetY);
  const [scale, setScale] = useState(initialScale);
  const dragStart = useRef(null);
  const containerRef = useRef(null);

  function onMouseDown(e) {
    e.preventDefault();
    dragStart.current = {x: e.clientX, y: e.clientY, ox, oy};
  }
  function onMouseMove(e) {
    if (!dragStart.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const dx = (e.clientX - dragStart.current.x) / rect.width * 100;
    const dy = (e.clientY - dragStart.current.y) / rect.height * 100;
    setOx(Math.max(0, Math.min(100, dragStart.current.ox - dx)));
    setOy(Math.max(0, Math.min(100, dragStart.current.oy - dy)));
  }
  function onMouseUp() { dragStart.current = null; }

  function onTouchStart(e) {
    if (e.touches.length === 1) {
      dragStart.current = {x: e.touches[0].clientX, y: e.touches[0].clientY, ox, oy};
    }
  }
  function onTouchMove(e) {
    if (!containerRef.current) return;
    if (e.touches.length === 1 && dragStart.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (e.touches[0].clientX - dragStart.current.x) / rect.width * 100;
      const dy = (e.touches[0].clientY - dragStart.current.y) / rect.height * 100;
      setOx(Math.max(0, Math.min(100, dragStart.current.ox - dx)));
      setOy(Math.max(0, Math.min(100, dragStart.current.oy - dy)));
    }
  }
  function onTouchEnd() { dragStart.current = null; }

  const s = scale||1;
  const imgStyle = {
    width:"100%", height:"100%",
    objectFit:"cover",
    objectPosition:`${ox}% ${oy}%`,
    transform:`scale(${s})`,
    transformOrigin:`${ox}% ${oy}%`,
    userSelect:"none", pointerEvents:"none",
  };

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,0.75)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}>
      <div style={{background:"#fff",borderRadius:"1.25rem",padding:"1.25rem",width:"100%",maxWidth:"360px"}}>
        <div style={{fontSize:"0.6rem",letterSpacing:"0.15em",textTransform:"uppercase",color:T.textLight,fontFamily:"'Inter',sans-serif",fontWeight:"600",marginBottom:"0.75rem",textAlign:"center"}}>
          Position & Zoom
        </div>

        {/* Preview circle — draggable */}
        <div ref={containerRef}
          style={{width:"200px",height:"200px",borderRadius:"50%",overflow:"hidden",margin:"0 auto 1.25rem",cursor:"grab",position:"relative",background:T.surfaceAlt,border:`3px solid ${T.accent}`}}
          onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
          <img src={photoURL} alt="" style={imgStyle} draggable={false}/>
        </div>

        {/* Zoom slider */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.7rem",color:T.textMid,fontFamily:"'Inter',sans-serif",marginBottom:"0.35rem",textAlign:"center"}}>Zoom</div>
          <input type="range" min="1" max="3" step="0.05" value={scale}
            onChange={e=>setScale(parseFloat(e.target.value))}
            style={{width:"100%",accentColor:T.accent}}/>
        </div>

        <div style={{display:"flex",gap:"0.6rem"}}>
          <button onClick={onClose} style={{flex:1,padding:"0.65rem",borderRadius:"0.6rem",border:`1px solid ${T.border}`,background:"#fff",color:T.textMid,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
            Cancel
          </button>
          <button onClick={()=>onSave(ox,oy,scale)} style={{flex:2,padding:"0.65rem",borderRadius:"0.6rem",border:"none",background:T.accent,color:"#fff",fontSize:"0.82rem",fontWeight:"600",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
            Save Photo
          </button>
        </div>
      </div>
    </div>
  );
}

function FounderByline({onUserTap}) {
  const [founders, setFounders] = useState([]);

  useEffect(()=>{
    Promise.all(FOUNDERS.map(async f => {
      try {
        const q = query(collection(db,"users"), where("email","==",f.email), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { ...f, uid: snap.docs[0].id, photoURL: d.photoURL||"",
                   displayName: d.displayName||f.name,
                   offsetX: d.avatarOffsetX??50, offsetY: d.avatarOffsetY??50, scale: d.avatarScale??1 };
        }
      } catch {}
      return { ...f, uid: null, photoURL: "", displayName: f.name, offsetX:50, offsetY:50, scale:1 };
    })).then(setFounders);
  },[]);

  return (
    <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
      <div style={{display:"flex"}}>
        {founders.length===0
          ? FOUNDERS.map((f,i)=>(
              <div key={i} style={{width:"26px",height:"26px",borderRadius:"50%",background:T.navy,display:"flex",alignItems:"center",justifyContent:"center",marginLeft:i>0?"-6px":"0",border:"2px solid "+T.accentSoft}}>
                <span style={{fontSize:"0.65rem",color:"#fff",fontWeight:"600"}}>{f.initial}</span>
              </div>
            ))
          : founders.map((f,i)=>(
              <button key={f.email} onClick={()=>f.uid&&onUserTap&&onUserTap(f.uid)}
                style={{width:"26px",height:"26px",borderRadius:"50%",marginLeft:i>0?"-6px":"0",border:"2px solid "+T.accentSoft,padding:0,cursor:f.uid?"pointer":"default",overflow:"hidden",flexShrink:0,background:T.navy,display:"block"}}
                title={f.displayName}>
                <Avatar photoURL={f.photoURL} name={f.displayName} size={26}/>
              </button>
            ))
        }
      </div>
      <div style={{display:"flex",gap:"0.25rem",alignItems:"center"}}>
        {founders.length>0
          ? founders.map((f,i)=>(
              <React.Fragment key={f.email}>
                {i>0&&<span style={{fontSize:"0.65rem",color:T.navy,opacity:0.5}}>&</span>}
                <button onClick={()=>f.uid&&onUserTap&&onUserTap(f.uid)}
                  style={{background:"none",border:"none",padding:0,cursor:f.uid?"pointer":"default",fontSize:"0.65rem",color:T.navy,fontFamily:"'Inter',sans-serif",fontWeight:"600",opacity:0.8,textDecoration:f.uid?"underline":"none",textDecorationColor:"rgba(17,24,39,0.25)"}}>
                  {f.displayName.split(" ")[0]}
                </button>
              </React.Fragment>
            ))
          : <span style={{fontSize:"0.65rem",color:T.navy,fontFamily:"'Inter',sans-serif",fontWeight:"600",opacity:0.8}}>McKenzie & Morgan</span>
        }
        <span style={{fontSize:"0.65rem",color:T.navy,fontFamily:"'Inter',sans-serif",opacity:0.6}}>· Co-founders</span>
      </div>
    </div>
  );
}

// ── RoutineScore ─────────────────────────────────────────────────────────────
function RoutineScore({routine, shopProducts, onShareRoutine, compact}) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use useMemo for instant recalculation — no async needed since shopProducts is already loaded
  const analysis = React.useMemo(() => {
    if (!routine.length) return null;
    // Look up each routine product's ingredients from shopProducts
    const results = routine.map(name => {
      const product = shopProducts.find(p =>
        p.productName?.toLowerCase() === name.toLowerCase() ||
        p.productName?.toLowerCase().includes(name.toLowerCase())
      );
      if (!product?.ingredients) return { name, score: null, poreScore: null, flagged: [], irritants: [] };
      const res = analyzeIngredients(product.ingredients);
      return {
        name,
        poreScore: res.avgScore,
        flagged: (res.poreCloggers||[]).sort((a,b)=>b.score-a.score).slice(0,3),
        irritants: (res.irritants||[]).slice(0,3),
        hasData: true,
      };
    });

    const withData = results.filter(r => r.hasData);
    if (!withData.length) return { results, overall: null };

    // Overall routine score: avg poreScore, penalized for overlap
    const avg = withData.reduce((s,r) => s + (r.poreScore||0), 0) / withData.length;

    // Find ingredients appearing in multiple products (double-exposure risk)
    const allFlagged = withData.flatMap(r => r.flagged.map(f => f.name.toLowerCase()));
    const counts = {};
    allFlagged.forEach(n => counts[n] = (counts[n]||0) + 1);
    const overlaps = Object.entries(counts).filter(([,c]) => c > 1).map(([n]) => n);

    // Grade: invert poreScore (0-5 scale → 10-0), overlap penalty
    const baseScore = Math.max(0, 10 - avg * 2);
    const overlapPenalty = Math.min(overlaps.length * 0.5, 2);
    const overall = Math.max(0, Math.min(10, baseScore - overlapPenalty));

    const grade = overall >= 9 ? "A+" : overall >= 8 ? "A" : overall >= 7 ? "B+" : overall >= 6 ? "B" : overall >= 5 ? "C+" : overall >= 4 ? "C" : overall >= 3 ? "D" : "F";
    const gradeColor = overall >= 7 ? T.sage : overall >= 5 ? T.amber : T.rose;
    const label = overall >= 8 ? "Skin-safe routine" : overall >= 6 ? "Mostly clear" : overall >= 4 ? "Some concern" : "High risk";

    return { results, overall: Math.round(overall * 10) / 10, grade, gradeColor, label, overlaps, withData: withData.length };
  }, [routine, shopProducts]);

  async function handleShare() {
    setSharing(true);
    try {
      const lines = [
        `✨ My Ralli by GoodSisters Skincare Routine Score: ${analysis?.grade || "?"} (${analysis?.overall || "?"}/10)`,
        `"${analysis?.label}"`,
        ``,
        `📋 Products (${routine.length}):`,
        ...routine.map(name => {
          const r = analysis?.results?.find(r => r.name === name);
          return `• ${name}${r?.poreScore != null ? ` — pore clog score ${r.poreScore}/5` : ""}`;
        }),
        ``,
        `🔍 Analyzed on Ralli by GoodSisters`,
      ].join("\n");

      if (navigator.share) {
        await navigator.share({ title: "My Ralli by GoodSisters Routine Score", text: lines });
      } else {
        await navigator.clipboard.writeText(lines);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    } catch {}
    setSharing(false);
  }

  if (!routine.length) {
    if (compact) return null;
    return (
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem 1.25rem",marginBottom:"1rem",textAlign:"center"}}>
        <div style={{fontSize:"0.82rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Add products to your routine to see your score</div>
      </div>
    );
  }

  // Compact mode — small pill badge below profile header
  if (compact) {
    const grade = analysis?.grade;
    const gradeColor = analysis?.gradeColor || T.sage;
    return (
      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.5rem 0.85rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"999px",marginBottom:"1rem",width:"fit-content"}}>
        <div style={{fontSize:"0.65rem",fontWeight:"700",color:T.textLight,fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.06em"}}>Routine</div>
        {grade
          ? <div style={{fontSize:"0.95rem",fontWeight:"800",color:gradeColor,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{grade}</div>
          : <div style={{fontSize:"0.75rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Analyzing…</div>
        }
        {analysis?.overall!=null&&<div style={{fontSize:"0.65rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>{analysis.overall}/10</div>}
        {analysis?.label&&<div style={{fontSize:"0.65rem",color:T.textMid,fontFamily:"'Inter',sans-serif",borderLeft:`1px solid ${T.border}`,paddingLeft:"0.5rem"}}>{analysis.label}</div>}
      </div>
    );
  }

  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",marginBottom:"1rem",overflow:"hidden"}}>
      {/* Header row */}
      <div style={{padding:"1rem 1.25rem",display:"flex",alignItems:"center",gap:"1rem"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:"0.7rem",color:T.textLight,fontFamily:"'Inter',sans-serif",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"2px"}}>Routine Score</div>
          <div style={{fontSize:"0.88rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>
            {analysis ? analysis.label : "Analyzing…"}
          </div>
          {analysis?.overlaps?.length > 0 && (
            <div style={{fontSize:"0.72rem",color:T.amber,marginTop:"3px",fontFamily:"'Inter',sans-serif"}}>
              ⚠ {analysis.overlaps.length} ingredient{analysis.overlaps.length>1?"s appear":"  appears"} in multiple products
            </div>
          )}
        </div>
        {analysis?.overall != null ? (
          <div style={{textAlign:"center",flexShrink:0}}>
            <div style={{fontSize:"2rem",fontWeight:"800",color:analysis.gradeColor,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{analysis.grade}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"2px"}}>{analysis.overall}/10</div>
          </div>
        ) : (
          <div style={{width:"44px",height:"44px",borderRadius:"50%",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <div style={{width:"20px",height:"20px",borderRadius:"50%",border:`2px solid ${T.textLight}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
          </div>
        )}
      </div>

      {/* Per-product breakdown */}
      {analysis?.results && (
        <>
          <button onClick={() => setExpanded(e => !e)}
            style={{width:"100%",padding:"0.5rem 1.25rem",background:T.surfaceAlt,border:"none",borderTop:`1px solid ${T.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"'Inter',sans-serif",fontSize:"0.75rem",color:T.textMid}}>
            <span>{expanded ? "Hide breakdown" : `See breakdown (${routine.length} products)`}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{transform:expanded?"rotate(180deg)":"none",transition:"transform 0.2s"}}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {expanded && (
            <div style={{padding:"0.75rem 1rem"}}>
              {analysis.results.map((r,i) => (
                <div key={i} style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.5rem 0",borderBottom:i<analysis.results.length-1?`1px solid ${T.border}`:"none"}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.82rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                    {r.flagged?.length > 0 && (
                      <div style={{fontSize:"0.68rem",color:T.rose,marginTop:"2px",fontFamily:"'Inter',sans-serif"}}>
                        {r.flagged.slice(0,2).map(f=>f.name).join(", ")}
                      </div>
                    )}
                    {r.irritants?.length > 0 && (
                      <div style={{fontSize:"0.68rem",color:T.amber,marginTop:"1px",fontFamily:"'Inter',sans-serif"}}>
                        ⚠ {r.irritants.slice(0,2).map(f=>f.name).join(", ")}
                      </div>
                    )}
                    {!r.hasData && <div style={{fontSize:"0.68rem",color:T.textLight,fontStyle:"italic"}}>No ingredient data</div>}
                  </div>
                  {r.poreScore != null && (
                    <div style={{textAlign:"center",padding:"0.3rem 0.5rem",background:`${r.poreScore>=4?T.rose:r.poreScore>=2?T.amber:T.sage}14`,borderRadius:"0.5rem",flexShrink:0}}>
                      <div style={{fontSize:"0.85rem",fontWeight:"700",color:r.poreScore>=4?T.rose:r.poreScore>=2?T.amber:T.sage,lineHeight:1}}>{r.poreScore}</div>
                      <div style={{fontSize:"0.5rem",color:T.textLight}}>pore</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {analysis?.overall != null && (
        <div style={{padding:"0.5rem 1.25rem 1rem",display:"flex"}}>
          <button onClick={handleShare} disabled={sharing}
            style={{flex:1,padding:"0.6rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.8rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.4rem",opacity:sharing?0.7:1}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            {copied ? "Copied!" : sharing ? "Sharing..." : "Share My Routine Score"}
          </button>
        </div>
      )}
    </div>
  );
}

function FounderLinks({onUserTap, inStory=false}) {
  const [profiles, setProfiles] = useState([]);


  useEffect(()=>{
    Promise.all(FOUNDERS.map(async f => {
      try {
        const q = query(collection(db,"users"), where("email","==",f.email), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0].data();
          return { ...f, uid: snap.docs[0].id, photoURL: d.photoURL||"", displayName: d.displayName||f.name,
                   bio: d.bio||"", offsetX: d.avatarOffsetX??50, offsetY: d.avatarOffsetY??50, scale: d.avatarScale??1 };
        }
        return { ...f, uid: null, photoURL: "", displayName: f.name, bio: "", offsetX:50, offsetY:50, scale:1 };
      } catch { return { ...f, uid: null, photoURL: "", displayName: f.name, bio: "", offsetX:50, offsetY:50, scale:1 }; }
    })).then(setProfiles);
  },[]);

  if (inStory) {
    // Compact horizontal cards for the feed story card
    return (
      <div style={{display:"flex",gap:"0.5rem",marginTop:"0.85rem",paddingTop:"0.75rem",borderTop:"1px solid rgba(255,255,255,0.15)"}}>
        {profiles.map(f=>(
          <button key={f.email}
            onClick={()=>{ if(f.uid && onUserTap) onUserTap(f.uid); }}
            style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",padding:"0.65rem 0.5rem",background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"0.85rem",cursor:f.uid?"pointer":"default",textAlign:"center",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(f.uid)e.currentTarget.style.background="rgba(255,255,255,0.12)";}}
            onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.07)";}}>
            <Avatar photoURL={f.photoURL} name={f.displayName} size={52}/>
            <div>
              <div style={{fontSize:"0.72rem",fontWeight:"600",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1.2}}>{f.displayName}</div>
              <div style={{fontSize:"0.58rem",color:"rgba(207,232,255,0.7)",fontFamily:"'Inter',sans-serif",marginTop:"0.1rem"}}>Co-founder</div>
            </div>
            {f.uid&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(207,232,255,0.5)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
        ))}
      </div>
    );
  }

  // Full list for profile page
  return (
    <div style={{marginTop:"0.75rem"}}>
      <div style={{fontSize:"0.55rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",fontFamily:"'Inter',sans-serif",fontWeight:"600",marginBottom:"0.4rem"}}>Founders</div>
      <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
        {profiles.map(f=>(
          <button key={f.email} onClick={()=>{ if(f.uid && onUserTap) onUserTap(f.uid); }}
            style={{width:"100%",display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 0.75rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:f.uid?"pointer":"default",textAlign:"left",transition:"all 0.15s"}}
            onMouseEnter={e=>{if(f.uid)e.currentTarget.style.borderColor=T.accent;}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;}}>
            <Avatar photoURL={f.photoURL} name={f.displayName} size={40}/>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{f.displayName}</div>
              <div style={{fontSize:"0.62rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Co-founder, Ralli by GoodSisters</div>
            </div>
            {f.uid&&<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Delete Account Modal ─────────────────────────────────────
function DeleteAccountModal({ user, onClose, onDeleted }) {
  const [step, setStep] = React.useState("confirm"); // confirm | typing | deleting | done
  const [typed, setTyped] = React.useState("");
  const [error, setError] = React.useState("");
  const CONFIRM_WORD = "DELETE";

  async function handleDelete() {
    if (typed !== CONFIRM_WORD) return;
    setStep("deleting");
    const result = await deleteUserAccount(user);
    if (result.success) {
      setStep("done");
      setTimeout(() => onDeleted(), 1500);
    } else if (result.needsReauth) {
      setError("For security, please sign out and sign back in before deleting your account.");
      setStep("confirm");
    } else {
      setError(result.error || "Something went wrong. Please try again.");
      setStep("confirm");
    }
  }

  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(0,0,0,0.55)",zIndex:9999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:T.bg,borderRadius:"1.5rem 1.5rem 0 0",padding:"1.5rem 1.25rem 2.5rem",width:"100%",maxWidth:"480px",boxShadow:"0 -4px 32px rgba(0,0,0,0.15)"}}>
        {step === "done" ? (
          <div style={{textAlign:"center",padding:"2rem 0"}}>
            <div style={{fontSize:"2.5rem",marginBottom:"0.75rem"}}>👋</div>
            <div style={{fontSize:"1.1rem",fontWeight:"700",color:T.text,marginBottom:"0.4rem",fontFamily:"'Inter',sans-serif"}}>Account deleted</div>
            <div style={{fontSize:"0.82rem",color:T.textLight}}>All your data has been removed.</div>
          </div>
        ) : step === "deleting" ? (
          <div style={{textAlign:"center",padding:"2rem 0"}}>
            <div style={{width:"32px",height:"32px",border:`3px solid ${T.rose}`,borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 1rem"}}/>
            <div style={{fontSize:"0.88rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>Deleting your account…</div>
          </div>
        ) : (
          <>
            <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1.25rem"}}>
              <div style={{width:"42px",height:"42px",borderRadius:"50%",background:T.rose+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.rose} strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
              </div>
              <div>
                <div style={{fontSize:"1rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>Delete account</div>
                <div style={{fontSize:"0.72rem",color:T.textLight}}>This cannot be undone</div>
              </div>
            </div>

            <div style={{background:T.rose+"0F",border:`1px solid ${T.rose}22`,borderRadius:"0.75rem",padding:"0.85rem 1rem",marginBottom:"1.25rem"}}>
              <div style={{fontSize:"0.78rem",color:T.textMid,lineHeight:1.6,fontFamily:"'Inter',sans-serif"}}>
                <strong style={{color:T.rose}}>This will permanently delete:</strong>
                <ul style={{margin:"0.4rem 0 0",paddingLeft:"1.1rem",display:"flex",flexDirection:"column",gap:"0.15rem"}}>
                  <li>Your profile and skin data</li>
                  <li>All your posts and scans</li>
                  <li>Your lists and routines</li>
                </ul>
              </div>
            </div>

            <div style={{marginBottom:"1rem"}}>
              <div style={{fontSize:"0.75rem",color:T.textMid,marginBottom:"0.4rem",fontFamily:"'Inter',sans-serif"}}>
                Type <strong style={{color:T.rose,letterSpacing:"0.05em"}}>DELETE</strong> to confirm
              </div>
              <input
                value={typed}
                onChange={e=>{ setTyped(e.target.value.toUpperCase()); setError(""); }}
                placeholder="DELETE"
                autoFocus
                style={{width:"100%",padding:"0.75rem 1rem",border:`2px solid ${typed===CONFIRM_WORD?T.rose:T.border}`,borderRadius:"0.65rem",fontSize:"0.95rem",fontFamily:"monospace",letterSpacing:"0.1em",color:T.text,background:T.bg,outline:"none",boxSizing:"border-box",transition:"border-color 0.15s"}}
              />
              {error && <div style={{fontSize:"0.72rem",color:T.rose,marginTop:"0.4rem",fontFamily:"'Inter',sans-serif"}}>{error}</div>}
            </div>

            <div style={{display:"flex",gap:"0.5rem"}}>
              <button onClick={handleDelete} disabled={typed!==CONFIRM_WORD}
                style={{flex:1,padding:"0.75rem",background:typed===CONFIRM_WORD?T.rose:"#ccc",color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"700",cursor:typed===CONFIRM_WORD?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif",transition:"background 0.15s"}}>
                Delete my account
              </button>
              <button onClick={onClose}
                style={{padding:"0.75rem 1.1rem",background:"transparent",color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.65rem",fontSize:"0.85rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── PeopleFinder — Find Friends tab in Profile ───────────────
function PeopleFinder({ user, profile, onUpdate, onUserTap }) {
  const [search, setSearch]       = useState("");
  const [results, setResults]     = useState([]);
  const [suggested, setSuggested] = useState([]);
  const [skinMatches, setSkinMatches] = useState([]);
  const [followed, setFollowed]   = useState(new Set());
  const [loading, setLoading]     = useState(false);
  const [following, setFollowing] = useState(profile?.following || []);

  // Load suggestions on mount
  useEffect(() => {
    if (!user?.uid) return;
    (async () => {
      try {
        const allSnap = await getDocs(query(collection(db,"users"), limit(40)));
        const allUsers = allSnap.docs.map(d=>({uid:d.id,...d.data()})).filter(u=>u.uid!==user.uid);
        const followingSet = new Set(profile?.following||[]);
        const mySkinTypes = Array.isArray(profile?.skinType)?profile.skinType:profile?.skinType?[profile.skinType]:[];
        const notFollowing = allUsers.filter(u=>!followingSet.has(u.uid));
        const sug = notFollowing.filter(u=>(u.followers||[]).some(f=>followingSet.has(f))).slice(0,10);
        const fallback = notFollowing.filter(u=>!sug.find(s=>s.uid===u.uid)).sort((a,b)=>(b.followers||[]).length-(a.followers||[]).length).slice(0,10-sug.length);
        setSuggested([...sug,...fallback].slice(0,10));
        setSkinMatches(notFollowing.filter(u=>{ const t=Array.isArray(u.skinType)?u.skinType:u.skinType?[u.skinType]:[]; return t.some(s=>mySkinTypes.includes(s)); }).slice(0,8));
      } catch {}
    })();
  }, [user?.uid]);

  // Search
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    setLoading(true);
    const q = search.toLowerCase();
    getDocs(query(collection(db,"users"), limit(50)))
      .then(snap => {
        const res = snap.docs.map(d=>({uid:d.id,...d.data()}))
          .filter(u => u.uid!==user.uid && (
            (u.displayName||"").toLowerCase().includes(q) ||
            (u.email||"").toLowerCase().includes(q)
          )).slice(0,15);
        setResults(res);
        setLoading(false);
      }).catch(()=>setLoading(false));
  }, [search]);

  const doFollow = async (uid, displayName, photoURL) => {
    await followUser(user.uid, uid, profile?.displayName||"Someone", profile?.photoURL||"");
    setFollowed(prev => new Set([...prev, uid]));
    const newFollowing = [...(profile?.following||[]), uid];
    onUpdate(p => ({...p, following: newFollowing}));
    setFollowing(newFollowing);
  };

  const UserRow = ({ u }) => {
    const isFollowed = followed.has(u.uid) || (profile?.following||[]).includes(u.uid);
    const shared = (u.followers||[]).filter(f=>(profile?.following||[]).includes(f)).length;
    const mySkinTypes = Array.isArray(profile?.skinType)?profile.skinType:profile?.skinType?[profile.skinType]:[];
    const theirTypes = Array.isArray(u.skinType)?u.skinType:u.skinType?[u.skinType]:[];
    const skinMatch = theirTypes.some(t=>mySkinTypes.includes(t));
    return (
      <div style={{background:T.surface,borderRadius:"0.85rem",border:`1px solid ${isFollowed?T.sage:T.border}`,padding:"0.75rem",display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"0.5rem",transition:"border-color 0.2s"}}>
        <button onClick={()=>onUserTap(u.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0}}><Avatar photoURL={u.photoURL} name={u.displayName} size={42}/></button>
        <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUserTap(u.uid)}>
          <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.displayName}</div>
          <div style={{fontSize:"0.68rem",color:T.textLight,marginTop:"2px",display:"flex",alignItems:"center",gap:"0.4rem",flexWrap:"wrap"}}>
            {shared>0&&<span style={{color:T.accent,fontWeight:"600"}}>{shared} mutual</span>}
            {skinMatch&&<span style={{background:T.sage+"18",color:T.sage,padding:"0.1rem 0.4rem",borderRadius:"999px",fontWeight:"600",fontSize:"0.6rem"}}>Same skin type</span>}
            <span>{(u.followers||[]).length} followers</span>
          </div>
        </div>
        <button onClick={()=>!isFollowed&&doFollow(u.uid,u.displayName,u.photoURL)}
          style={{padding:"0.35rem 0.85rem",background:isFollowed?T.sage+"22":"transparent",color:isFollowed?T.sage:T.navy,border:`1.5px solid ${isFollowed?T.sage:T.navy}`,borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",cursor:isFollowed?"default":"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0,transition:"all 0.2s"}}>
          {isFollowed?"✓ Following":"Follow"}
        </button>
      </div>
    );
  };

  return (
    <div style={{paddingTop:"0.5rem"}}>
      {/* Search */}
      <div style={{position:"relative",marginBottom:"1.25rem"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{position:"absolute",left:"0.85rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name…"
          style={{width:"100%",padding:"0.65rem 1rem 0.65rem 2.25rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
        {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textLight,padding:"2px"}}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>}
      </div>

      {/* Search results */}
      {search.trim()&&(
        <div style={{marginBottom:"1.5rem"}}>
          {loading&&<div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.8rem"}}>Searching…</div>}
          {!loading&&results.length===0&&<div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.8rem"}}>No users found for "{search}"</div>}
          {!loading&&results.map(u=><UserRow key={u.uid} u={u}/>)}
        </div>
      )}

      {/* Following list */}
      {!search.trim()&&(profile?.following||[]).length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>
            Following · {(profile?.following||[]).length}
          </div>
          <FollowingList uids={profile?.following||[]} currentUid={user.uid} onUserTap={onUserTap}
            onUnfollow={async uid=>{ await unfollowUser(user.uid,uid); onUpdate(p=>({...p,following:(p.following||[]).filter(f=>f!==uid)})); }}/>
        </div>
      )}

      {/* Suggestions */}
      {!search.trim()&&suggested.length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>
            {(profile?.following||[]).length>0?"People you might know":"Top members"}
          </div>
          {suggested.map(u=><UserRow key={u.uid} u={u}/>)}
        </div>
      )}

      {/* Same skin type */}
      {!search.trim()&&skinMatches.length>0&&(
        <div style={{marginBottom:"1.5rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>Same skin type as you</div>
          <div style={{display:"flex",gap:"0.65rem",overflowX:"auto",paddingBottom:"0.5rem",scrollbarWidth:"none"}}>
            {skinMatches.map(u=>{
              const isFollowed = followed.has(u.uid)||(profile?.following||[]).includes(u.uid);
              return (
                <div key={u.uid} onClick={()=>onUserTap(u.uid)} style={{flexShrink:0,width:"130px",background:T.surface,borderRadius:"1rem",border:`1px solid ${isFollowed?T.sage:T.border}`,padding:"0.85rem 0.5rem 0.65rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.4rem",cursor:"pointer"}}>
                  <Avatar photoURL={u.photoURL} name={u.displayName} size={44}/>
                  <div style={{fontSize:"0.75rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",textAlign:"center",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",width:"100%",padding:"0 0.25rem"}}>{u.displayName}</div>
                  <div style={{fontSize:"0.6rem",color:T.textLight,textAlign:"center"}}>{Array.isArray(u.skinType)?u.skinType.join(", "):u.skinType||"Skincare lover"}</div>
                  <button onClick={e=>{e.stopPropagation();!isFollowed&&doFollow(u.uid,u.displayName,u.photoURL);}}
                    style={{marginTop:"0.15rem",padding:"0.3rem 0.75rem",background:isFollowed?T.sage+"22":T.accent,color:isFollowed?T.sage:"#fff",border:`1.5px solid ${isFollowed?T.sage:T.accent}`,borderRadius:"999px",fontSize:"0.68rem",fontWeight:"700",cursor:isFollowed?"default":"pointer",fontFamily:"'Inter',sans-serif"}}>
                    {isFollowed?"✓":"Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Invite CTA */}
      <div style={{background:`linear-gradient(135deg,${T.accent}12,${T.sage}10)`,borderRadius:"1rem",border:`1px solid ${T.accent}22`,padding:"1.1rem",textAlign:"center",marginBottom:"1rem"}}>
        <div style={{fontSize:"1.4rem",marginBottom:"0.35rem"}}>💌</div>
        <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>Invite your friends to Ralli</div>
        <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.75rem",lineHeight:1.4}}>Skincare is better with friends. Share your pore-clogging scores together.</div>
        <button onClick={()=>{ if(navigator.share){navigator.share({title:"Join me on Ralli!",text:"I use Ralli to check if my skincare products clog pores. Check it out!",url:window.location.href});}else{navigator.clipboard?.writeText(window.location.href);alert("Link copied! Share it with your friends.");}}}
          style={{padding:"0.6rem 1.5rem",background:T.accent,color:"#fff",border:"none",borderRadius:"999px",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
          Invite Friends
        </button>
      </div>
    </div>
  );
}

function MyProfilePage({user, profile, onUpdate, onUserTap, onAdminTap=()=>{}}) {
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [posts, setPosts]               = useState([]);
  const [shopProducts, setShopProducts] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [activeTab, setActiveTab]       = useState("lists");
  const [editing, setEditing]           = useState(false);
  const [bio, setBio]                   = useState(profile?.bio||"");
  const [skinTypes2, setSkinTypes2]     = useState(
    Array.isArray(profile?.skinType) ? profile.skinType : profile?.skinType ? [profile.skinType] : []
  );
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [userListModal, setUserListModal]     = useState(null);
  const [userListData, setUserListData]       = useState([]);
  const [userListLoading, setUserListLoading] = useState(false);
  const [photoUploading, setPhotoUploading]   = useState(false);
  const [phoneEdit, setPhoneEdit]             = useState(profile?.phone||"");

  // Guard must come AFTER all hooks
  if (!profile) return <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>;

  const skinTypeOptions = ["Normal","Dry","Oily","Combination","Sensitive","Acne-prone"];
  const routine    = profile.routine    || [];
  const brokeout   = profile.brokeout   || [];
  const wantToTry  = profile.wantToTry  || [];
  const privacy    = profile.listPrivacy || {};

  async function openUserList(type) {
    setUserListModal(type);
    setUserListLoading(true);
    const ids = type === "followers" ? (profile.followers||[]) : (profile.following||[]);
    try {
      const users = await Promise.all(ids.map(async uid => {
        const snap = await getDoc(doc(db,"users",uid));
        return snap.exists() ? {uid, ...snap.data()} : null;
      }));
      setUserListData(users.filter(Boolean));
    } catch {}
    setUserListLoading(false);
  }

  async function handlePhotoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const size = 300;
        const canvas = document.createElement("canvas");
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d");
        // Center-crop the image into a square
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        try {
          await updateDoc(doc(db,"users",user.uid), { photoURL: dataUrl });
          onUpdate(p => ({...p, photoURL: dataUrl}));
        } catch(err) { console.error(err); }
        setPhotoUploading(false);
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  async function togglePrivacy(field) {
    const newPrivacy = {...privacy, [field]: !privacy[field]};
    try {
      await updateDoc(doc(db,"users",user.uid),{listPrivacy: newPrivacy});
      onUpdate(p=>({...p, listPrivacy: newPrivacy}));
    } catch {}
  }

  function toggleSkinType(t) {
    setSkinTypes2(prev => prev.includes(t) ? prev.filter(x=>x!==t) : [...prev, t]);
  }

  function reloadPosts() {
    setLoading(true);
    Promise.all([
      getUserPosts(user.uid),
      getDocs(query(collection(db,"ratings"), where("uid","==",user.uid), orderBy("createdAt","desc"), limit(50)))
        .then(snap => { console.log("ratings fetched:", snap.docs.length); return snap.docs.map(d=>({id:d.id,...d.data(),_fromRatings:true})); })
        .catch(() =>
          // Fallback: query without orderBy (no index needed)
          getDocs(query(collection(db,"ratings"), where("uid","==",user.uid), limit(50)))
            .then(snap => { console.log("ratings fallback:", snap.docs.length); return snap.docs.map(d=>({id:d.id,...d.data(),_fromRatings:true})); })
            .catch(e => { console.error("ratings fetch error:", e); return []; })
        ),
    ]).then(([postsData, ratingsData]) => {
      const merged = [...postsData];
      ratingsData.forEach(r => {
        if (!merged.some(p => p.productName===r.productName && Number(p.communityRating)===Number(r.communityRating))) {
          merged.push(r);
        }
      });
      console.log("merged posts:", merged.length, "rated:", merged.filter(p=>Number(p.communityRating)>0).length);
      setPosts(merged);
      setLoading(false);
    });
  }

  async function openProductFromPost(post) {
    try {
      const q = query(collection(db,"products"), where("productName","==", post.productName||post.name||""), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = {id:snap.docs[0].id, ...snap.docs[0].data()};
        const ingA = (p.ingredients||"").trim();
        const ingB = (post.ingredients||"").trim();
        const ing = ingA.length >= ingB.length ? (ingA||ingB) : (ingB||ingA);
        const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
        setSelectedProduct({ productName: p.productName||post.productName, brand: p.brand||post.brand, image: p.adminImage||p.image||post.productImage||post.image||"", poreScore: liveScore ?? p.poreScore ?? post.poreScore ?? 0, communityRating: p.communityRating||post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: p.buyUrl||post.buyUrl||amazonUrl(p.productName||post.productName, p.brand||post.brand, p.barcode||post.barcode, p.asin||post.asin, p.buyUrl||post.buyUrl) });
        return;
      }
    } catch(e) {}
    const pName = post.productName||post.name||"";
    const ing = (post.ingredients||"").trim();
    const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
    setSelectedProduct({ productName: pName, brand: post.brand, image: post.adminImage||post.image||post.productImage||"", poreScore: liveScore ?? post.poreScore ?? 0, communityRating: post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: post.buyUrl||amazonUrl(pName, post.brand, post.barcode, post.asin, post.buyUrl) });
  }

  useEffect(()=>{
    reloadPosts();
    getShopProducts().then(p=>setShopProducts(p));
  },[]);

  // Reload posts when ratings tab opened OR after a new rating is submitted
  useEffect(()=>{
    if (activeTab === "ratings") reloadPosts();
  },[activeTab]);

  useEffect(()=>{
    if (profile?._ratingsRefresh) reloadPosts();
  },[profile?._ratingsRefresh]);

  async function saveProfile() {
    try {
      const phoneClean = phoneEdit.replace(/[^0-9]/g,"");
      const phoneUpdate = phoneClean.length >= 10 ? {phone: phoneClean} : {};
      await updateDoc(doc(db,"users",user.uid),{bio, skinType: skinTypes2, ...phoneUpdate});
      onUpdate(p=>({...p, bio, skinType: skinTypes2, ...phoneUpdate}));
    } catch {}
    setEditing(false);
  }

  async function addToList(field, value) {
    try {
      await updateDoc(doc(db,"users",user.uid),{[field]:arrayUnion(value)});
      onUpdate(p=>({...p,[field]:[...(p[field]||[]),value]}));
    } catch {}
  }

  async function removeFromList(field, value) {
    try {
      await updateDoc(doc(db,"users",user.uid),{[field]:arrayRemove(value)});
      onUpdate(p=>({...p,[field]:(p[field]||[]).filter(v=>v!==value)}));
    } catch {}
  }

  const tabs = [
    {id:"lists",   label:"My Lists"},
    {id:"scans",   label:"Scans"},
    {id:"ratings", label:"Ratings"},
    {id:"people",  label:"People"},
  ];

  useEffect(() => {
    const handler = (e) => setActiveTab(e.detail || "people");
    window.addEventListener("ralli_profile_tab", handler);
    return () => window.removeEventListener("ralli_profile_tab", handler);
  }, []);

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",paddingBottom:"6rem"}}>
      <div style={{padding:"1rem 1rem 0"}}>

      {/* Followers/Following modal — rendered via portal to escape CSS transform stacking context */}
      {userListModal&&ReactDOM.createPortal(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(28,28,26,0.45)",zIndex:9000,display:"flex",flexDirection:"column",justifyContent:"flex-end",alignItems:"center"}} onClick={()=>setUserListModal(null)}>
          <div style={{width:"100%",maxWidth:"480px",background:T.surface,borderRadius:"1.5rem 1.5rem 0 0",padding:"1.25rem 1rem 0",height:"70vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem",flexShrink:0}}>
              <span style={{fontSize:"1rem",fontWeight:"700",fontFamily:"'Inter',sans-serif",color:T.text,textTransform:"capitalize"}}>
                {userListModal}
                <span style={{fontSize:"0.72rem",fontWeight:"400",color:T.textLight,marginLeft:"0.5rem"}}>{userListData.length}</span>
              </span>
              <button onClick={()=>setUserListModal(null)} style={{background:T.surfaceAlt,border:"none",cursor:"pointer",color:T.textMid,width:"28px",height:"28px",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={{overflowY:"auto",flex:1,paddingBottom:"calc(1.5rem + env(safe-area-inset-bottom))"}}>
              {userListLoading
                ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight}}>Loading…</div>
                : userListData.length===0
                  ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.85rem"}}>Nobody here yet</div>
                  : userListData
                      .filter(u => {
                        const GENERIC = ["skincare lover","anonymous","user","undefined","null",""];
                        return !GENERIC.includes((u.displayName||"").toLowerCase().trim());
                      })
                      .map(u=>(
                        <div key={u.uid} onClick={()=>{setUserListModal(null);onUserTap(u.uid);}}
                          style={{display:"flex",alignItems:"center",gap:"0.75rem",padding:"0.65rem 0.25rem",cursor:"pointer",borderBottom:`1px solid ${T.border}`}}
                          onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                          <Avatar photoURL={u.photoURL} name={u.displayName} size={40}/>
                          <div style={{flex:1}}>
                            <div style={{fontSize:"0.88rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif"}}>{u.displayName}</div>
                            <div style={{fontSize:"0.72rem",color:T.textLight}}>{(u.followers||[]).length} followers</div>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                        </div>
                      ))
              }
            </div>
          </div>
        </div>
      , document.body)}

      {/* ── Profile Header ── */}
      <div style={{marginBottom:"1.25rem",paddingTop:"0.5rem"}}>

        {/* No photo prompt */}
        {!profile.photoURL && !user.photoURL && (
          <div style={{marginBottom:"0.85rem",padding:"0.75rem 1rem",background:`linear-gradient(135deg,${T.accent}12,${T.blush}20)`,borderRadius:"1rem",border:`1px solid ${T.accent}25`,display:"flex",alignItems:"center",gap:"0.75rem"}}>
            <span style={{fontSize:"1.25rem",flexShrink:0}}>📸</span>
            <div style={{flex:1}}>
              <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,marginBottom:"1px"}}>Add a profile photo</div>
              <div style={{fontSize:"0.68rem",color:T.textMid}}>Tap the camera icon on your avatar below</div>
            </div>
          </div>
        )}

        {/* Top row: avatar + stats + edit */}
        <div style={{display:"flex",alignItems:"center",gap:"1.25rem",marginBottom:"1rem"}}>

          {/* Avatar */}
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:"76px",height:"76px",borderRadius:"50%",overflow:"hidden",
              border:`2.5px solid ${T.surface}`,
              boxShadow:`0 0 0 2px ${T.accent}`,
            }}>
              {profile.photoURL||user.photoURL
                ? <img src={profile.photoURL||user.photoURL} style={{width:"100%",height:"100%",objectFit:"cover"}} alt=""/>
                : <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${T.accent}cc,${T.navy})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    <span style={{fontSize:"1.75rem",fontWeight:"700",color:"#fff",fontFamily:"'Inter',sans-serif"}}>{(profile.displayName||"?")[0].toUpperCase()}</span>
                  </div>
              }
            </div>
            <label style={{position:"absolute",bottom:"1px",right:"1px",width:"22px",height:"22px",borderRadius:"50%",
              background:T.navy,border:`2px solid ${T.bg}`,cursor:"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",zIndex:2}}>
              {photoUploading
                ? <div style={{width:"7px",height:"7px",borderRadius:"50%",border:"1.5px solid #fff",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
                : <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              }
              <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{display:"none"}}/>
            </label>
          </div>

          {/* Stats */}
          <div style={{flex:1,display:"flex",justifyContent:"space-around"}}>
            {[
              {label:"Scans",     value:posts.filter(p=>!p._fromRatings).length,                   onClick:null},
              {label:"Followers", value:(profile.followers||[]).length,  onClick:()=>openUserList("followers")},
              {label:"Following", value:(profile.following||[]).length,  onClick:()=>openUserList("following")},
            ].map(({label,value,onClick})=>(
              <button key={label} onClick={onClick||undefined} disabled={!onClick}
                style={{textAlign:"center",background:"none",border:"none",cursor:onClick?"pointer":"default",padding:"0.15rem 0.5rem",lineHeight:1}}>
                <div style={{fontSize:"1.25rem",fontWeight:"800",color:T.navy,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.03em"}}>{value}</div>
                <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"3px",fontFamily:"'Inter',sans-serif",letterSpacing:"0.02em"}}>{label}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Name + bio */}
        <div style={{marginBottom:"0.75rem"}}>
          <div style={{fontSize:"1.05rem",fontWeight:"700",color:T.navy,fontFamily:"'Inter',sans-serif",letterSpacing:"-0.02em",lineHeight:1.2}}>{profile.displayName}</div>
          {!editing&&(
            <div style={{fontSize:"0.82rem",color:T.textMid,marginTop:"0.3rem",lineHeight:1.5}}>
              {profile.bio||<span style={{color:T.textLight,fontStyle:"italic",fontSize:"0.78rem"}}>No bio yet — tap Edit to add one</span>}
            </div>
          )}
        </div>

        {/* Skin type pills */}
        {!editing&&(Array.isArray(profile.skinType)?profile.skinType:[profile.skinType].filter(Boolean)).length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem",marginBottom:"0.75rem"}}>
            {(Array.isArray(profile.skinType)?profile.skinType:[profile.skinType]).filter(Boolean).map(t=>(
              <span key={t} style={{padding:"0.22rem 0.7rem",background:T.accentSoft,color:T.accent,borderRadius:"999px",fontSize:"0.68rem",fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>{t}</span>
            ))}
          </div>
        )}

        {/* Edit Profile button */}
        <button onClick={()=>editing?saveProfile():setEditing(true)}
          style={{width:"100%",padding:"0.5rem",background:editing?T.accent:"transparent",
            color:editing?"#fff":T.navy,
            border:`1.5px solid ${editing?T.accent:T.navy}22`,
            borderRadius:"0.6rem",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",
            fontFamily:"'Inter',sans-serif",letterSpacing:"-0.01em",
            background: editing ? T.accent : T.surfaceAlt,
          }}>
          {editing ? "Save Profile" : "Edit Profile"}
        </button>
      </div>

      {/* Compact Routine Score badge */}
      {!editing&&routine.length>0&&(
        <RoutineScore routine={routine} shopProducts={shopProducts} compact />
      )}

      {/* Edit fields */}
      {editing&&(
        <div style={{background:T.surface,borderRadius:"0.75rem",border:`1px solid ${T.border}`,padding:"1rem",marginBottom:"1rem"}} className="fu">
          <input value={bio} onChange={e=>setBio(e.target.value)} placeholder="Add a bio…" style={{width:"100%",padding:"0.65rem 0.9rem",borderRadius:"0.5rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",marginBottom:"0.6rem"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.25rem",fontFamily:"'Inter',sans-serif"}}>Phone <span style={{fontStyle:"italic"}}>(so contacts can find you)</span></div>
          <input value={phoneEdit} onChange={e=>setPhoneEdit(e.target.value)} placeholder="+1 (555) 000-0000" type="tel" style={{width:"100%",padding:"0.65rem 0.9rem",borderRadius:"0.5rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem",boxSizing:"border-box"}} onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.4rem"}}>Skin type <span style={{color:T.textLight,fontStyle:"italic"}}>(select all that apply)</span></div>
          <div style={{display:"flex",flexWrap:"wrap",gap:"0.35rem"}}>
            {skinTypeOptions.map(t=>{
              const on = skinTypes2.includes(t);
              return <button key={t} onClick={()=>toggleSkinType(t)} style={{padding:"0.3rem 0.75rem",borderRadius:"999px",fontSize:"0.75rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",background:on?T.accent:T.surfaceAlt,color:on?"#FFFFFF":T.textMid,border:`1px solid ${on?T.accent:T.border}`,transition:"all 0.15s"}}>{t}</button>;
            })}
          </div>
        </div>
      )}


      {/* Invite friends — prominent banner above tabs */}
      <button onClick={async()=>{
        const txt = "I've been using Ralli by GoodSisters to decode my skincare — it checks every ingredient for pore-clogging risk. Come join me!";
        const url = window.location.href;
        if (navigator.share) { try { await navigator.share({title:"Ralli by GoodSisters",text:txt,url}); } catch(e){} }
        else { await navigator.clipboard.writeText(url); alert("Link copied! Share it with your friends."); }
      }} style={{width:"100%",marginBottom:"1rem",padding:"0.8rem 1rem",background:`linear-gradient(135deg,${T.iceBlue},#E8F4FF)`,color:T.navy,border:`1px solid ${T.iceBlue}`,borderRadius:"0.85rem",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600",display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.75rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.6rem"}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          <div style={{textAlign:"left"}}>
            <div style={{fontWeight:"700",fontSize:"0.82rem",lineHeight:1.2}}>Invite friends to Ralli</div>
            <div style={{fontWeight:"400",fontSize:"0.68rem",color:T.textMid,marginTop:"2px"}}>Skincare is better together</div>
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.navy} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
      </button>

      {/* Tab switcher */}
      <div style={{display:"flex",borderBottom:`2px solid ${T.border}`,marginBottom:"1.25rem",gap:0}}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setActiveTab(t.id)}
            style={{flex:1,padding:"0.65rem 0.5rem",background:"transparent",border:"none",
              borderBottom:`2px solid ${activeTab===t.id?T.navy:"transparent"}`,marginBottom:"-2px",
              fontSize:"0.82rem",fontWeight:activeTab===t.id?"700":"400",
              color:activeTab===t.id?T.navy:T.textLight,cursor:"pointer",
              fontFamily:"'Inter',sans-serif",transition:"all 0.15s",letterSpacing:"-0.01em"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Scans tab */}
      {activeTab==="scans"&&(
        loading
          ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight}}>Loading…</div>
          : posts.filter(p=>!p._fromRatings).length===0
            ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.85rem"}}>No scans yet — use the Scan tab to get started.</div>
            : <>{posts.filter(p=>!p._fromRatings).map((p,i)=><CardReveal key={p.id} delay={i*40}><PostCard post={p} currentUid={user.uid} currentUserName={profile?.displayName||""} currentUserPhoto={profile?.photoURL||""} onUserTap={onUserTap} onProductTap={openProductFromPost} productImageMap={productImageMap}/></CardReveal>)}</>
      )}

      {/* Ratings tab */}
      {activeTab==="ratings"&&(
        loading
          ? <div style={{textAlign:"center",padding:"2rem",color:T.textLight}}>Loading…</div>
          : (() => {
              const ratedPosts = posts.filter(p => {
                const r = Number(p.communityRating);
                return !isNaN(r) && r > 0;
              });
              if (ratedPosts.length === 0) {
                // Empty state — suggest products to rate
                const suggestions = [];
                return (
                  <div>
                    <div style={{textAlign:"center",padding:"1.5rem 1rem 1rem",color:T.textLight,fontSize:"0.85rem"}}>
                      <div style={{fontSize:"1.5rem",marginBottom:"0.4rem"}}>⭐</div>
                      <div style={{fontWeight:"600",color:T.textMid,marginBottom:"0.25rem"}}>No ratings yet</div>
                      <div style={{fontSize:"0.75rem"}}>Rate products after scanning them</div>
                    </div>
                    <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdate} onUserTap={onUserTap}/>
                  </div>
                );
              }
              return (
                <div>
                  {ratedPosts.map(p=>(
                    <button key={p.id}
                      onClick={()=>openProductFromPost(p)}
                      style={{width:"100%",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"0.9rem 1rem",marginBottom:"0.6rem",display:"flex",alignItems:"center",gap:"0.85rem",cursor:"pointer",textAlign:"left",transition:"border-color 0.15s"}}
                      onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                      onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                      {(p.productImage||(p.adminImage||p.image))&&(
                        <div style={{width:"40px",height:"40px",flexShrink:0,borderRadius:"0.5rem",overflow:"hidden",background:"#ffffff",border:`1px solid ${T.border}`}}>
                          <img src={p.productImage||p.adminImage||p.image} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"3px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.opacity="0"}/>
                        </div>
                      )}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.88rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                        {p.brand&&<div style={{fontSize:"0.7rem",color:T.textLight,marginTop:"1px"}}>{p.brand}</div>}
                      </div>
                      <div style={{display:"flex",gap:"0.5rem",flexShrink:0}}>
                        <div style={{textAlign:"center",padding:"0.35rem 0.6rem",background:communityColor(p.communityRating)+"15",borderRadius:"0.6rem",border:`1px solid ${communityColor(p.communityRating)}25`}}>
                          <div style={{fontSize:"1rem",fontWeight:"700",color:communityColor(p.communityRating),lineHeight:1}}>{p.communityRating}</div>
                          <div style={{fontSize:"0.52rem",color:T.textLight,marginTop:"1px"}}>/10</div>
                        </div>
                        <div style={{textAlign:"center",padding:"0.35rem 0.6rem",background:poreStyle(p.poreScore??0).color+"15",borderRadius:"0.6rem",border:`1px solid ${poreStyle(p.poreScore??0).color}25`}}>
                          <div style={{fontSize:"1rem",fontWeight:"700",color:poreStyle(p.poreScore??0).color,lineHeight:1}}>{p.poreScore??0}</div>
                          <div style={{fontSize:"0.52rem",color:T.textLight,marginTop:"1px"}}>/5 pore</div>
                        </div>
                      </div>
                    </button>
                  ))}
                  <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdate} onUserTap={onUserTap}/>
                </div>
              );
            })()
      )}

      {/* Lists tab */}
      {activeTab==="lists"&&(
        <div className="fu">
          {(()=>{
            const allProds = [...shopProducts, ...posts];
            function openListItem(name) {
              const found = allProds.find(p=>(p.productName||p.name||"").toLowerCase()===name.toLowerCase());
              setSelectedProduct({
                productName: name,
                brand: found?.brand||"",
                poreScore: found?.poreScore??0,
                communityRating: found?.communityRating||null,
                image: found?.adminImage||found?.image||found?.productImage||"",
                ingredients: found?.ingredients||"",
                flaggedIngredients: found?.flaggedIngredients||[],
                buyUrl: found?.buyUrl||"",
                id: found?.id||"",
              });
            }
            return (<>
          <ListSection
            title="My Routine" icon="✦" color={T.sage}
            items={routine} isPrivate={!!privacy.routine}
            readOnly={false}
            onTogglePrivacy={()=>togglePrivacy("routine")}
            onAdd={v=>addToList("routine",v)}
            onRemove={v=>removeFromList("routine",v)}
            allProducts={allProds}
            onItemTap={openListItem}
          />
          <ListSection
            title="Broke Me Out" icon="!" color={T.rose}
            items={brokeout} isPrivate={!!privacy.brokeout}
            readOnly={false}
            onTogglePrivacy={()=>togglePrivacy("brokeout")}
            onAdd={v=>addToList("brokeout",v)}
            onRemove={v=>removeFromList("brokeout",v)}
            allProducts={allProds}
            onItemTap={openListItem}
          />
          <ListSection
            title="Want to Try" icon="→" color={T.amber}
            items={wantToTry} isPrivate={!!privacy.wantToTry}
            readOnly={false}
            onTogglePrivacy={()=>togglePrivacy("wantToTry")}
            onAdd={v=>addToList("wantToTry",v)}
            onRemove={v=>removeFromList("wantToTry",v)}
            allProducts={allProds}
            onItemTap={openListItem}
          />
          <ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdate} onUserTap={onUserTap}/>
            </>);
          })()}
        </div>
      )}



      {/* People tab — Find Friends */}
      {activeTab==="people"&&(
        <PeopleFinder user={user} profile={profile} onUpdate={onUpdate} onUserTap={onUserTap}/>
      )}

      {/* Legal links */}
      <div style={{marginTop:"1.25rem",display:"flex",gap:"1rem",justifyContent:"center",flexWrap:"wrap"}}>
        <a href="https://theralliapp.com/privacy.html" target="_blank" rel="noopener noreferrer"
          style={{fontSize:"0.72rem",color:T.textLight,textDecoration:"underline",textDecorationColor:T.border,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
          Privacy Policy
        </a>
        <span style={{fontSize:"0.72rem",color:T.border}}>·</span>
        <a href="https://theralliapp.com/terms.html" target="_blank" rel="noopener noreferrer"
          style={{fontSize:"0.72rem",color:T.textLight,textDecoration:"underline",textDecorationColor:T.border,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
          Terms of Service
        </a>
        <span style={{fontSize:"0.72rem",color:T.border}}>·</span>
        <a href="mailto:theralliapp@gmail.com?subject=Ralli by GoodSisters Feedback"
          style={{fontSize:"0.72rem",color:T.textLight,textDecoration:"underline",textDecorationColor:T.border,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
          Contact Us
        </a>
      </div>

      {/* Feedback card */}
      <div style={{marginTop:"0.75rem",padding:"0.85rem 1rem",background:T.accentSoft,borderRadius:"0.85rem",border:`1px solid ${T.border}`}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
          <div style={{fontSize:"1.1rem",flexShrink:0}}>💬</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.navy,fontFamily:"'Inter',sans-serif",marginBottom:"2px"}}>Share feedback</div>
            <div style={{fontSize:"0.7rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>Found a bug? Want a feature? We read everything.</div>
          </div>
          <a href="mailto:theralliapp@gmail.com?subject=Ralli by GoodSisters Feedback"
            style={{padding:"0.4rem 0.75rem",background:T.accent,color:"#fff",borderRadius:"999px",fontSize:"0.7rem",fontWeight:"600",fontFamily:"'Inter',sans-serif",textDecoration:"none",flexShrink:0}}>
            Email us
          </a>
        </div>
      </div>

      <button onClick={()=>signOut(auth)} style={{width:"100%",marginTop:"0.75rem",padding:"0.7rem",background:"transparent",color:T.textLight,border:`1px solid ${T.border}`,borderRadius:"0.65rem",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        Sign out
      </button>
      <button onClick={()=>setShowDeleteModal(true)}
        style={{width:"100%",marginTop:"0.5rem",padding:"0.6rem",background:"transparent",color:T.rose,border:`1px solid ${T.rose}30`,borderRadius:"0.65rem",fontSize:"0.78rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
        Delete account
      </button>
      {showDeleteModal && (
        <DeleteAccountModal
          user={user}
          onClose={()=>setShowDeleteModal(false)}
          onDeleted={()=>{ signOut(auth); }}
        />
      )}

      {/* UID display — for adding to ADMIN_UIDS */}
      <div style={{marginTop:"0.75rem",padding:"0.6rem 0.75rem",background:T.surfaceAlt,borderRadius:"0.65rem",border:`1px solid ${T.border}`}}>
        <div style={{fontSize:"0.55rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.2rem",fontFamily:"'Inter',sans-serif"}}>Your account UID</div>
        <div style={{fontSize:"0.65rem",color:T.textMid,fontFamily:"monospace",wordBreak:"break-all",userSelect:"all"}}>{user?.uid}</div>
      </div>

      {isAdmin(user)&&(
        <button onClick={onAdminTap} style={{width:"100%",marginTop:"0.5rem",padding:"0.7rem",background:T.text,color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.82rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Admin Dashboard
        </button>
      )}

      {/* Founders section moved to the feed — see AboutRalliCard */}
      </div>
    </div>
  );
}


// ── INGDB enriched for glossary ───────────────────────────────
const INGDB_META = {
  // Pore-cloggers
  "coconut oil":         {category:"Oil",      benefit:"Moisturizing",      concern:"Can clog pores"},
  "wheat germ oil":      {category:"Oil",      benefit:"Vitamin E rich",    concern:"Very likely to clog pores"},
  "cocoa butter":        {category:"Butter",   benefit:"Deep moisturizing", concern:"Can clog pores"},
  "isopropyl myristate": {category:"Emollient",benefit:"Makes skin feel silky smooth", concern:"Very likely to clog pores"},
  "lanolin":             {category:"Emollient",benefit:"Barrier repair",    concern:"May clog pores for some"},
  "petrolatum":          {category:"Emollient",benefit:"Occlusive barrier", concern:"None known"},
  "mineral oil":         {category:"Oil",      benefit:"Occlusive, gentle", concern:"None known"},
  "dimethicone":         {category:"Silicone", benefit:"Smoothing, fills pores", concern:"Very unlikely to cause issues"},
  "shea butter":         {category:"Butter",   benefit:"Nourishing",        concern:"Slightly risky for very oily skin"},
  "jojoba oil":          {category:"Wax",      benefit:"Balancing, skin-identical", concern:"Slightly risky for very oily skin"},
  "argan oil":           {category:"Oil",      benefit:"Antioxidant, nourishing", concern:"None known"},
  "squalane":            {category:"Emollient",benefit:"Lightweight, feels just like your own skin", concern:"None known"},
  "hemp seed oil":       {category:"Oil",      benefit:"Packed with healthy fatty acids", concern:"None known"},
  "rosehip oil":         {category:"Oil",      benefit:"Vitamin A, brightening", concern:"Very unlikely to cause issues"},
  // Hydration
  "glycerin":            {category:"Hydration",benefit:"Pulls water into your skin to keep it hydrated", concern:"None known"},
  "hyaluronic acid":     {category:"Hydration",benefit:"Holds 1000x its weight in water — deeply hydrating", concern:"None known"},
  // Actives
  "niacinamide":         {category:"Active",   benefit:"Visibly minimizes pores and evens skin tone", concern:"None known"},
  "retinol":             {category:"Active",   benefit:"Speeds up skin renewal for fewer wrinkles", concern:"None known"},
  "salicylic acid":      {category:"Exfoliant",benefit:"Goes inside pores to clear them out", concern:"None known"},
  "vitamin c":           {category:"Antioxidant",benefit:"Fades dark spots and helps build collagen", concern:"None known"},

  "lactic acid":         {category:"Exfoliant",benefit:"Exfoliates gently while keeping skin moist", concern:"None known"},
  "glycolic acid":       {category:"Exfoliant",benefit:"Strong exfoliator — clears dead skin fast",  concern:"None known"},
  "panthenol":           {category:"Vitamin",  benefit:"Soothes irritation and locks in moisture", concern:"None known"},
  "allantoin":           {category:"Soother",  benefit:"Calms flare-ups and helps skin heal",  concern:"None known"},
  "centella asiatica":   {category:"Botanical",benefit:"Heals skin and reduces inflammation", concern:"None known"},
  "ceramide":            {category:"Lipid",    benefit:"Repairs your skin barrier and stops moisture escaping", concern:"None known"},
  "zinc oxide":          {category:"Sunscreen",benefit:"Blocks both UVA and UVB rays", concern:"None known"},
  "titanium dioxide":    {category:"Sunscreen",benefit:"Gentle sunscreen — great for sensitive skin", concern:"None known"},
  "kaolin":              {category:"Clay",     benefit:"Soaks up excess oil and clears congestion", concern:"None known"},
  "cetyl alcohol":       {category:"Emollient",benefit:"Softens and smooths skin texture", concern:"Slightly risky for very oily skin"},
  "stearic acid":        {category:"Fatty acid",benefit:"Helps ingredients mix and softens skin", concern:"Slightly risky for very oily skin"},
  "tocopherol":          {category:"Antioxidant",benefit:"Vitamin E — protects skin from damage", concern:"Slightly risky for very oily skin"},
  "xanthan gum":         {category:"Thickener",benefit:"Keeps product texture smooth and stable",  concern:"None known"},
  "carbomer":            {category:"Polymer",  benefit:"Gives products their gel consistency", concern:"None known"},
  // Irritants & Sensitizers
  "fragrance":           {category:"Irritant", benefit:"Added scent", concern:"Top skin sensitizer — hides undisclosed chemicals"},
  "parfum":              {category:"Irritant", benefit:"Added scent", concern:"Synthetic scent blend — common cause of contact dermatitis"},
  "denatured alcohol":   {category:"Irritant", benefit:"Quick-dry texture, feels weightless", concern:"Strips skin barrier — causes dryness and irritation"},
  "alcohol denat":       {category:"Irritant", benefit:"Quick-dry, antimicrobial", concern:"Disrupts skin barrier — avoid if sensitive or dry"},
  "isopropyl alcohol":   {category:"Irritant", benefit:"Antiseptic, fast-drying", concern:"Harsh — can damage barrier and cause redness"},
  "ethanol":             {category:"Irritant", benefit:"Lightweight feel, preservative", concern:"Drying in high concentrations — weakens barrier"},
  "linalool":            {category:"Irritant", benefit:"Floral scent", concern:"EU-listed allergen — frequent cause of skin reactions"},
  "limonene":            {category:"Irritant", benefit:"Citrus scent", concern:"EU-listed allergen — oxidizes to become more irritating"},
  "geraniol":            {category:"Irritant", benefit:"Rose-like scent", concern:"EU-listed allergen — sensitizes with repeated use"},
  "eugenol":             {category:"Irritant", benefit:"Spice/clove scent", concern:"EU-listed allergen — high sensitization rate"},
  "cinnamal":            {category:"Irritant", benefit:"Cinnamon scent", concern:"Strong allergen and skin sensitizer"},
  "citronellol":         {category:"Irritant", benefit:"Floral scent", concern:"EU-listed fragrance allergen"},
  "coumarin":            {category:"Irritant", benefit:"Vanilla-like scent", concern:"EU-listed allergen — restricted in cosmetics"},
  "benzyl alcohol":      {category:"Irritant", benefit:"Preservative, light fragrance", concern:"Can irritate sensitive skin — also a fragrance allergen"},
  "sodium lauryl sulfate":{category:"Irritant",benefit:"Creates rich lather", concern:"Harsh surfactant — strips oils, damages barrier"},
  "sodium laureth sulfate":{category:"Irritant",benefit:"Gentler lather than SLS", concern:"Can irritate — depends on concentration and skin type"},
  "methylisothiazolinone":{category:"Irritant",benefit:"Effective preservative", concern:"Potent allergen — banned in leave-on EU products"},
  "methylchloroisothiazolinone":{category:"Irritant",benefit:"Preservative", concern:"Strong sensitizer — causes contact allergy"},
  "formaldehyde":        {category:"Irritant", benefit:"Preservative", concern:"Known carcinogen and allergen — rare but still used"},
  "propylene glycol":    {category:"Irritant", benefit:"Humectant, helps absorption", concern:"Can irritate sensitive skin in high concentrations"},
  "essential oils":      {category:"Irritant", benefit:"Natural fragrance and actives", concern:"Natural does not mean safe — can sensitize and irritate"},
  "tea tree oil":        {category:"Irritant", benefit:"Antimicrobial, acne-fighting", concern:"Can cause allergic reactions with repeated use"},
  "lavender oil":        {category:"Irritant", benefit:"Calming scent, antimicrobial", concern:"Contains linalool and linalyl acetate — known sensitizers"},
  "peppermint oil":      {category:"Irritant", benefit:"Cooling sensation", concern:"High menthol content — irritating to mucous membranes"},
  "citrus oils":         {category:"Irritant", benefit:"Brightening, fresh scent", concern:"Phototoxic — can cause sun damage on skin"},
  "menthol":             {category:"Irritant", benefit:"Cooling sensation", concern:"Irritating to sensitive and damaged skin"},
  "witch hazel":         {category:"Irritant", benefit:"Astringent, pore-tightening", concern:"High alcohol content in most forms — drying"},
  "phenoxyethanol":      {category:"Irritant", benefit:"Widely used gentle preservative", concern:"Generally safe — can irritate at high concentrations"},
  "retinyl palmitate":   {category:"Irritant", benefit:"Mild retinoid activity", concern:"May cause irritation — some photocarcinogenicity concerns"},

  // ── Additional Oils ───────────────────────────────────────────
  "macadamia oil":       {category:"Oil",      benefit:"Rich in palmitoleic acid — skin-compatible", concern:"Moderate pore-clogging risk"},
  "neem oil":            {category:"Oil",      benefit:"Antimicrobial, acne-fighting", concern:"Moderate pore-clogging risk"},
  "rice bran oil":       {category:"Oil",      benefit:"Rich in antioxidants and vitamin E", concern:"Moderate risk — mixed fatty acid profile"},
  "moringa oil":         {category:"Oil",      benefit:"High in oleic acid, antioxidant", concern:"Moderate pore-clogging risk"},
  "baobab oil":          {category:"Oil",      benefit:"Rich in vitamins A, D, E, F", concern:"Moderate risk — high oleic acid"},
  "acai oil":            {category:"Oil",      benefit:"Antioxidant-rich, omega-rich", concern:"Moderate pore-clogging — high oleic acid"},
  "marula oil":          {category:"Oil",      benefit:"Antioxidant, nourishing", concern:"May clog pores in some people"},
  "meadowfoam seed oil": {category:"Oil",      benefit:"Very stable, skin-compatible", concern:"Very unlikely to cause issues"},
  "watermelon seed oil": {category:"Oil",      benefit:"Lightweight, high linoleic acid", concern:"None known"},
  "prickly pear seed oil":{category:"Oil",     benefit:"Very high linoleic acid, vitamin E", concern:"None known"},
  "passion fruit oil":   {category:"Oil",      benefit:"High in linoleic acid", concern:"Very unlikely to cause issues"},
  "pomegranate seed oil":{category:"Oil",      benefit:"Unique punicic acid — anti-inflammatory", concern:"Very unlikely to cause issues"},
  "broccoli seed oil":   {category:"Oil",      benefit:"Silicone-like slip, rich in fatty acids", concern:"Very unlikely to cause issues"},
  "chia seed oil":       {category:"Oil",      benefit:"Very high alpha-linolenic acid", concern:"None known"},
  "black currant seed oil":{category:"Oil",    benefit:"High in GLA — anti-inflammatory", concern:"Very unlikely to cause issues"},
  "sea buckthorn seed oil":{category:"Oil",    benefit:"Rich in omega-7 fatty acids", concern:"Very unlikely to cause issues"},
  "hemp oil":            {category:"Oil",      benefit:"Balanced omega-3 and omega-6 ratio", concern:"None known"},
  "rose hip seed oil":   {category:"Oil",      benefit:"High linoleic acid, vitamin A", concern:"Very unlikely to cause issues"},
  "avocado oil":         {category:"Oil",      benefit:"Rich in vitamins and oleic acid", concern:"Moderate risk — may clog pores for some"},
  "olive oil":           {category:"Oil",      benefit:"Antioxidant-rich, softening", concern:"Moderate risk — high oleic acid"},
  "sweet almond oil":    {category:"Oil",      benefit:"Softening, vitamin E rich", concern:"Moderate risk — may clog pores for some"},
  "evening primrose oil":{category:"Oil",      benefit:"High GLA content, anti-inflammatory", concern:"Moderate risk — may clog pores for some"},
  "sesame oil":          {category:"Oil",      benefit:"Antioxidant, anti-inflammatory", concern:"Moderate pore-clogging risk"},
  "hazelnut oil":        {category:"Oil",      benefit:"Astringent, skin-tightening", concern:"Moderate risk of clogging pores"},
  "borage oil":          {category:"Oil",      benefit:"Highest GLA content of any oil", concern:"Moderate risk — may clog pores for some"},
  "apricot kernel oil":  {category:"Oil",      benefit:"Lightweight, skin-softening", concern:"Moderate risk — may clog pores for some"},
  "tamanu oil":          {category:"Oil",      benefit:"Healing, anti-inflammatory", concern:"Moderate risk — may clog pores for some"},
  "black seed oil":      {category:"Oil",      benefit:"Antimicrobial, anti-inflammatory", concern:"Moderate risk for acne-prone skin"},
  "pumpkin seed oil":    {category:"Oil",      benefit:"Zinc-rich, anti-inflammatory", concern:"Moderate risk — may clog pores for some"},
  "grape seed oil":      {category:"Oil",      benefit:"Antioxidant-rich, lightweight", concern:"Can clog pores despite being light"},
  "flaxseed oil":        {category:"Oil",      benefit:"High omega-3 fatty acids", concern:"Can clog pores — oxidizes quickly"},
  "wheat germ oil":      {category:"Oil",      benefit:"Very high vitamin E content", concern:"Very likely to clog pores"},
  "soybean oil":         {category:"Oil",      benefit:"Rich in linoleic acid", concern:"May clog pores in acne-prone skin"},
  "corn oil":            {category:"Oil",      benefit:"Emollient, vitamin E", concern:"May clog pores in some people"},
  "cottonseed oil":      {category:"Oil",      benefit:"Emollient", concern:"May clog pores in some people"},
  "palm oil":            {category:"Oil",      benefit:"Emollient, rich lather", concern:"Clogs pores and triggers breakouts"},
  "coconut oil":         {category:"Oil",      benefit:"Antimicrobial, moisturizing", concern:"High pore-clogging risk — especially for acne-prone skin"},

  // ── Waxes & Butters ───────────────────────────────────────────
  "mango butter":        {category:"Butter",   benefit:"Nourishing, skin-softening", concern:"Moderate pore-clogging risk"},
  "beeswax":             {category:"Wax",      benefit:"Natural occlusive, protective", concern:"Moderate to high pore-clogging risk"},
  "carnauba wax":        {category:"Wax",      benefit:"Vegan wax, protective", concern:"Very unlikely to cause issues"},
  "candelilla wax":      {category:"Wax",      benefit:"Vegan wax, gives texture", concern:"Very unlikely to cause issues"},
  "microcrystalline wax":{category:"Wax",      benefit:"Thickener, texture agent", concern:"Moderate pore-clogging risk"},
  "paraffin wax":        {category:"Wax",      benefit:"Occlusive, seals moisture", concern:"Low to moderate pore-clogging risk"},
  "ozokerite":           {category:"Wax",      benefit:"Mineral thickener", concern:"Moderate pore-clogging risk"},
  "ceresin":             {category:"Wax",      benefit:"Mineral wax, texture agent", concern:"Moderate pore-clogging risk"},
  "lanolin":             {category:"Emollient",benefit:"Barrier repair, deeply conditioning", concern:"Moderately pore-clogging"},
  "acetylated lanolin":  {category:"Emollient",benefit:"Skin softening", concern:"High pore-clogging risk"},

  // ── Fatty Alcohols & Esters ───────────────────────────────────
  "cetyl alcohol":       {category:"Emollient",benefit:"Smooths skin texture, thickens formula", concern:"Moderately pore-clogging — risky for acne-prone skin"},
  "cetearyl alcohol":    {category:"Emollient",benefit:"Emollient and emulsifier", concern:"Moderately pore-clogging"},
  "stearyl alcohol":     {category:"Emollient",benefit:"Skin softener, formula stabilizer", concern:"May clog pores for some"},
  "stearic acid":        {category:"Fatty acid",benefit:"Skin-softening, helps emulsification", concern:"Slightly risky for very oily skin"},
  "isopropyl myristate": {category:"Emollient",benefit:"Makes products feel silky", concern:"One of the most pore-clogging ingredients known"},
  "isopropyl palmitate": {category:"Emollient",benefit:"Lightweight skin softener", concern:"High pore-clogging risk"},
  "octyl palmitate":     {category:"Emollient",benefit:"Skin-softening ester", concern:"Can clog pores — moderate to high risk"},
  "myristyl myristate":  {category:"Emollient",benefit:"Skin softener", concern:"Very likely to cause breakouts"},
  "decyl oleate":        {category:"Emollient",benefit:"Light skin-softening ester", concern:"Moderate pore-clogging risk"},
  "butyl stearate":      {category:"Emollient",benefit:"Skin conditioner", concern:"May clog pores in some people"},
  "isostearyl isostearate":{category:"Emollient",benefit:"Skin conditioner", concern:"Very high pore-clogging risk"},
  "lauryl alcohol":      {category:"Emollient",benefit:"Fatty alcohol, skin softener", concern:"High pore-clogging risk"},
  "octyl stearate":      {category:"Emollient",benefit:"Emollient ester", concern:"High pore-clogging risk"},
  "myristyl lactate":    {category:"Emollient",benefit:"Skin softener", concern:"High pore-clogging risk"},
  "laureth-4":           {category:"Surfactant",benefit:"Cleansing and emulsifying", concern:"One of the most comedogenic surfactants"},
  "steareth-2":          {category:"Emulsifier",benefit:"Keeps formula stable", concern:"Moderate pore-clogging risk"},
  "caprylic/capric triglyceride":{category:"Emollient",benefit:"Lightweight MCT — skin-compatible", concern:"Very unlikely to cause issues"},

  // ── Makeup-specific ───────────────────────────────────────────
  "bismuth oxychloride": {category:"Mineral",  benefit:"Gives a pearly shimmer finish", concern:"Can cause itching and pore congestion"},
  "talc":                {category:"Mineral",  benefit:"Oil-absorbing, silky texture", concern:"Can block pores in heavy amounts"},
  "zinc stearate":       {category:"Mineral",  benefit:"Adhesion, silky feel in makeup", concern:"Moderate pore-clogging risk"},
  "magnesium stearate":  {category:"Mineral",  benefit:"Improves flow in pressed powders", concern:"Moderate pore-clogging risk"},
  "mica":                {category:"Mineral",  benefit:"Natural shimmer and glow", concern:"None known"},
  "iron oxides":         {category:"Mineral",  benefit:"Natural colorants — non-reactive", concern:"None known"},
  "silica":              {category:"Mineral",  benefit:"Mattifying, oil-absorbing", concern:"None known"},

  // ── Preservatives (more) ──────────────────────────────────────
  "methylisothiazolinone":{category:"Irritant",benefit:"Highly effective preservative", concern:"Potent allergen — banned in EU leave-on products"},
  "methylchloroisothiazolinone":{category:"Irritant",benefit:"Preservative", concern:"One of the most sensitizing — banned in EU leave-ons"},
  "iodopropynyl butylcarbamate":{category:"Irritant",benefit:"Antifungal preservative", concern:"Skin sensitizer — restricted in children's products"},
  "dmdm hydantoin":      {category:"Irritant", benefit:"Broad-spectrum preservative", concern:"Releases formaldehyde — can cause irritation and allergy"},
  "imidazolidinyl urea": {category:"Irritant", benefit:"Preservative", concern:"Formaldehyde-releasing — skin sensitizer"},
  "quaternium-15":       {category:"Irritant", benefit:"Preservative", concern:"Formaldehyde-releasing — high sensitization rate"},
  "methylparaben":       {category:"Irritant", benefit:"Very effective preservative", concern:"Paraben — potential hormone disruptor at high levels"},
  "propylparaben":       {category:"Irritant", benefit:"Preservative", concern:"Paraben — potential hormone disruptor"},
  "butylparaben":        {category:"Irritant", benefit:"Preservative", concern:"Most controversial paraben — potential endocrine disruptor"},
  "ethylparaben":        {category:"Irritant", benefit:"Preservative", concern:"Paraben — potential hormone disruptor"},
  "phenoxyethanol":      {category:"Preservative",benefit:"Widely used gentle preservative", concern:"Generally safe — can irritate at high concentrations"},

  // ── Fragrance allergens (more) ────────────────────────────────
  "hydroxycitronellal":  {category:"Irritant", benefit:"Floral fragrance note", concern:"EU-listed allergen — can cause contact allergy"},
  "isoeugenol":          {category:"Irritant", benefit:"Spice fragrance", concern:"Frequently causes contact allergy"},
  "benzyl salicylate":   {category:"Irritant", benefit:"Fragrance fixative", concern:"EU-listed allergen"},
  "benzyl benzoate":     {category:"Irritant", benefit:"Fragrance solvent", concern:"EU-listed allergen"},
  "amyl cinnamal":       {category:"Irritant", benefit:"Floral fragrance", concern:"EU-listed allergen"},
  "hexyl cinnamal":      {category:"Irritant", benefit:"Chamomile-like fragrance", concern:"EU-listed allergen — common sensitizer"},
  "farnesol":            {category:"Irritant", benefit:"Floral fragrance", concern:"EU-listed allergen"},
  "cinnamyl alcohol":    {category:"Irritant", benefit:"Cinnamon-like fragrance", concern:"EU-listed allergen"},
  "citral":              {category:"Irritant", benefit:"Lemon fragrance", concern:"EU-listed allergen — sensitizes with repeated use"},
  "alpha isomethyl ionone":{category:"Irritant",benefit:"Violet fragrance", concern:"EU-listed allergen"},
  "lilial":              {category:"Irritant", benefit:"Lily-of-the-valley fragrance", concern:"Banned in EU — high allergen rate"},
  "lyral":               {category:"Irritant", benefit:"Floral fragrance", concern:"Banned in EU — very high contact allergy rate"},
  "camphor":             {category:"Irritant", benefit:"Cooling sensation", concern:"Skin irritant and sensitizer"},
  "oxybenzone":          {category:"Irritant", benefit:"Chemical UVA filter", concern:"Potential hormone disruptor — reef-damaging"},

  // ── Essential oils (more) ─────────────────────────────────────
  "eucalyptus oil":      {category:"Irritant", benefit:"Antimicrobial, cooling", concern:"Can cause irritation and sensitization"},
  "bergamot oil":        {category:"Irritant", benefit:"Fresh citrus scent", concern:"Photosensitizing — contains EU allergens"},
  "clove oil":           {category:"Irritant", benefit:"Antimicrobial", concern:"High eugenol content — potent irritant"},
  "cinnamon oil":        {category:"Irritant", benefit:"Warming, antimicrobial", concern:"Potent sensitizer — cinnamal content"},

  // ── Surfactants (more) ────────────────────────────────────────
  "ammonium lauryl sulfate":{category:"Irritant",benefit:"Creates lather", concern:"Harsh — strips skin barrier similar to SLS"},
  "cocamide DEA":        {category:"Irritant", benefit:"Foam booster, thickener", concern:"Potential carcinogen and skin sensitizer"},
  "sodium C14-16 olefin sulfonate":{category:"Surfactant",benefit:"Cleansing, lather", concern:"Can irritate sensitive skin"},

  // ── Silicones ─────────────────────────────────────────────────
  "cyclopentasiloxane":  {category:"Silicone", benefit:"Lightweight, volatile — evaporates cleanly", concern:"Very unlikely to cause issues"},
  "cyclomethicone":      {category:"Silicone", benefit:"Lightweight, silky feel", concern:"Very unlikely to cause issues"},
  "cyclohexasiloxane":   {category:"Silicone", benefit:"Lightweight silicone base", concern:"Very unlikely to cause issues"},
  "phenyl trimethicone": {category:"Silicone", benefit:"Adds shine and slip", concern:"Very unlikely to cause issues"},
  "amodimethicone":      {category:"Silicone", benefit:"Conditioning, lightweight", concern:"None known"},
  "trimethylsiloxysilicate":{category:"Silicone",benefit:"Long-wear film former", concern:"Very unlikely to cause issues"},

  // ── Sunscreen filters (more) ──────────────────────────────────
  "octocrylene":         {category:"Sunscreen",benefit:"Stabilizes avobenzone, UVB filter", concern:"Low pore risk — may sensitize some"},
  "octinoxate":          {category:"Sunscreen",benefit:"UVB filter", concern:"Potential hormone disruptor — reef-harmful"},
  "octisalate":          {category:"Sunscreen",benefit:"UVB filter", concern:"Also acts as fragrance — low risk"},
  "avobenzone":          {category:"Sunscreen",benefit:"Broad UVA protection", concern:"None known — unstable without stabilizer"},
  "homosalate":          {category:"Sunscreen",benefit:"UVB filter", concern:"Potential hormone disruptor at high concentrations"},

  // ── Humectants & hydration ────────────────────────────────────
  "sodium hyaluronate":  {category:"Hydration",benefit:"Smaller HA molecule — penetrates deeper", concern:"None known"},
  "butylene glycol":     {category:"Hydration",benefit:"Humectant, helps absorption", concern:"Very unlikely to cause issues"},
  "pentylene glycol":    {category:"Hydration",benefit:"Gentle humectant with mild antimicrobial effect", concern:"None known"},
  "sorbitol":            {category:"Hydration",benefit:"Sugar-derived humectant", concern:"None known"},
  "urea":                {category:"Hydration",benefit:"Softens and deeply hydrates skin", concern:"None known"},
  "sodium PCA":          {category:"Hydration",benefit:"Natural moisturizing factor in skin", concern:"None known"},
  "polyglutamic acid":   {category:"Hydration",benefit:"Humectant 4x stronger than HA", concern:"None known"},
  "beta glucan":         {category:"Hydration",benefit:"Soothing humectant from oats", concern:"None known"},
  "trehalose":           {category:"Hydration",benefit:"Protective sugar humectant", concern:"None known"},

  // ── Actives (more) ───────────────────────────────────────────
  "retinal":             {category:"Active",   benefit:"11x more potent than retinol", concern:"None known — less irritating than tretinoin"},
  "tretinoin":           {category:"Active",   benefit:"Gold standard prescription retinoid", concern:"Prescription only — can cause purging and irritation"},
  "mandelic acid":       {category:"Exfoliant",benefit:"Gentle AHA — great for sensitive and acne-prone skin", concern:"None known"},
  "tranexamic acid":     {category:"Active",   benefit:"Fades dark spots and hyperpigmentation", concern:"None known"},
  "kojic acid":          {category:"Active",   benefit:"Brightening — inhibits melanin production", concern:"None known"},
  "arbutin":             {category:"Active",   benefit:"Gentle brightener safe for all skin types", concern:"None known"},
  "alpha-arbutin":       {category:"Active",   benefit:"More effective form of arbutin", concern:"None known"},
  "azelaic acid":        {category:"Active",   benefit:"Anti-inflammatory — great for rosacea and PIH", concern:"None known"},
  "benzoyl peroxide":    {category:"Active",   benefit:"Kills acne bacteria directly", concern:"None known — bleaches fabric"},
  "resveratrol":         {category:"Antioxidant",benefit:"Antioxidant from grapes — anti-aging", concern:"None known"},
  "coenzyme q10":        {category:"Antioxidant",benefit:"Anti-aging, energizing antioxidant", concern:"None known"},
  "ferulic acid":        {category:"Antioxidant",benefit:"Boosts vitamin C stability and effectiveness", concern:"None known"},
  "caffeine":            {category:"Active",   benefit:"De-puffing, antioxidant", concern:"None known"},
  "copper peptide":      {category:"Peptide",  benefit:"Healing, anti-aging, collagen-boosting", concern:"None known"},
  "zinc pca":            {category:"Active",   benefit:"Oil control and anti-acne", concern:"None known"},
  "sulfur":              {category:"Active",   benefit:"Anti-acne and antimicrobial", concern:"Drying at high concentrations"},
  "gluconolactone":      {category:"Exfoliant",benefit:"Gentle PHA — also an antioxidant", concern:"None known"},
  "malic acid":          {category:"Exfoliant",benefit:"Mild AHA from fruit", concern:"None known"},

  // ── Peptides ──────────────────────────────────────────────────
  "palmitoyl pentapeptide-4":{category:"Peptide",benefit:"Matrixyl — boosts collagen production", concern:"None known"},
  "acetyl hexapeptide-3":{category:"Peptide",  benefit:"Argireline — relaxes expression lines", concern:"None known"},
  "palmitoyl tripeptide-1":{category:"Peptide",benefit:"Collagen-boosting", concern:"None known"},

  // ── Barrier & Soothing ────────────────────────────────────────
  "ceramide np":         {category:"Lipid",    benefit:"Key skin barrier ceramide", concern:"None known"},
  "ceramide ap":         {category:"Lipid",    benefit:"Key skin barrier ceramide", concern:"None known"},
  "ceramide eop":        {category:"Lipid",    benefit:"Key skin barrier ceramide", concern:"None known"},
  "cholesterol":         {category:"Lipid",    benefit:"Barrier lipid — works with ceramides", concern:"None known"},
  "bisabolol":           {category:"Soother",  benefit:"Anti-inflammatory from chamomile", concern:"None known"},
  "madecassoside":       {category:"Botanical",benefit:"Active centella compound — healing", concern:"None known"},
  "asiaticoside":        {category:"Botanical",benefit:"Active centella compound — soothing", concern:"None known"},
  "oat extract":         {category:"Soother",  benefit:"Reduces redness and itch", concern:"None known"},
  "colloidal oatmeal":   {category:"Soother",  benefit:"FDA-approved skin protectant", concern:"None known"},
  "ectoin":              {category:"Soother",  benefit:"Protects skin from environmental stress", concern:"None known"},
  "aloe vera":           {category:"Soother",  benefit:"Soothing and deeply hydrating", concern:"None known"},
};

// ── Pore Clog Score Explainer ─────────────────────────────────────
function PoreScoreInfo({ score, inline=false }) {
  const [open, setOpen] = React.useState(false);
  const ps = poreStyle(score ?? 0);

  const levels = [
    { range:"0", label:"Clear", color:"#22C55E", desc:"No known pore-cloggers. Safe for all skin types including acne-prone." },
    { range:"1", label:"Mild",  color:"#84CC16", desc:"One or two mildly comedogenic ingredients. Unlikely to cause breakouts for most people." },
    { range:"2", label:"Low",   color:"#EAB308", desc:"Some moderate pore-cloggers present. Fine for normal skin, use cautiously if acne-prone." },
    { range:"3", label:"Medium",color:"#F97316", desc:"Notable pore-clogging potential. Patch test first if your skin breaks out easily." },
    { range:"4", label:"High",  color:"#EF4444", desc:"Multiple high-risk ingredients. Likely to cause breakouts for acne-prone or oily skin." },
    { range:"5", label:"Avoid", color:"#DC2626", desc:"Highly comedogenic formula. Most dermatologists would not recommend for acne-prone skin." },
  ];

  return (
    <span style={{position:"relative",display:inline?"inline-flex":"flex",alignItems:"center",gap:"0.3rem"}}>
      <button onClick={e=>{e.stopPropagation();setOpen(v=>!v);}}
        style={{background:"none",border:"none",cursor:"pointer",padding:"0",display:"flex",alignItems:"center",gap:"0.25rem",color:T.textLight}}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      </button>
      {open && (
        <>
          <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9998}} onClick={()=>setOpen(false)}/>
          <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",zIndex:9999,
            background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",
            padding:"1rem",width:"260px",boxShadow:"0 8px 32px rgba(0,0,0,0.15)"}}>
            <div style={{fontSize:"0.7rem",fontWeight:"700",color:T.text,marginBottom:"0.6rem",fontFamily:"'Inter',sans-serif",letterSpacing:"0.02em"}}>
              What is the Pore Clog Score?
            </div>
            <div style={{fontSize:"0.68rem",color:T.textMid,lineHeight:1.5,marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>
              We score each product 0–5 based on how comedogenic (pore-clogging) its ingredients are,
              using a database of known ingredient ratings. Lower is better for acne-prone skin.
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
              {levels.map(l=>(
                <div key={l.range} style={{display:"flex",alignItems:"flex-start",gap:"0.5rem"}}>
                  <div style={{minWidth:"42px",padding:"0.1rem 0.35rem",background:l.color+"18",border:`1px solid ${l.color}33`,borderRadius:"0.3rem",textAlign:"center",flexShrink:0}}>
                    <span style={{fontSize:"0.6rem",fontWeight:"800",color:l.color,fontFamily:"'Inter',sans-serif"}}>{l.range} — {l.label}</span>
                  </div>
                  <span style={{fontSize:"0.62rem",color:T.textMid,lineHeight:1.4}}>{l.desc}</span>
                </div>
              ))}
            </div>
            <div style={{marginTop:"0.75rem",padding:"0.5rem 0.65rem",background:T.accentSoft,borderRadius:"0.5rem"}}>
              <div style={{fontSize:"0.62rem",color:T.navy,lineHeight:1.4,fontFamily:"'Inter',sans-serif",marginBottom:"0.45rem"}}><strong>Note:</strong> Comedogenicity varies by person. These ratings are guidelines, not guarantees.</div>
              <div style={{fontSize:"0.58rem",color:T.textLight,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>
                <span style={{fontWeight:"600",color:T.textMid,display:"block",marginBottom:"0.2rem"}}>Sources</span>
                <a href="https://www.paulaschoice.com/ingredient-dictionary" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· Paula's Choice Ingredient Dictionary</a>
                <a href="https://cosdna.com" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· CosDNA Ingredient Analysis</a>
                <a href="https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2835894/" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· Draelos &amp; DiNardo, <em>J Cosmet Dermatol</em> (2006)</a>
                <a href="https://incidecoder.com" target="_blank" rel="noopener noreferrer" style={{color:T.navy,opacity:0.7,textDecoration:"none",display:"block"}}>· INCIDecoder</a>
              </div>
            </div>
          </div>
        </>
      )}
    </span>
  );
}

// ── Trending Page ─────────────────────────────────────────────
function TrendingPage({user, profile, onProductTap}) {
  const [trending, setTrending] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selectedProduct, setSelectedProduct] = useState(null);

  useEffect(()=>{
    getTrendingProducts(15).then(t=>{ setTrending(t); setLoading(false); });
  },[]);

  function openProduct(p) {
    setSelectedProduct({
      productName: p.productName,
      brand: p.brand||"",
      image: p.adminImage||p.image||null,
      barcode: p.barcode||"",
      ingredients: p.ingredients||"",
      flaggedIngredients: p.flaggedIngredients||[],
      poreScore: p.poreScore||0,
      communityRating: p.avgCommunity||p.communityRating||null,
      buyUrl: amazonUrl(p.productName, p.brand, p.barcode, p.asin, p.buyUrl),
      scanCount: p.scanCount,
    });
  }

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"1rem 1rem 6rem"}}>
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1.1rem",color:T.text,letterSpacing:"-0.02em",marginBottom:"0.2rem"}}>Trending</div>
        <div style={{fontSize:"0.75rem",color:T.textLight}}>Most checked products in the community</div>
      </div>

      {loading&&(
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          {[1,2,3,4,5].map(i=>(
            <div key={i} style={{height:"72px",background:T.surface,borderRadius:"0.75rem",border:`1px solid ${T.border}`,opacity:0.5+i*0.05}}/>
          ))}
        </div>
      )}

      {!loading&&trending.length===0&&(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:T.textLight}}>
          
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"600",marginBottom:"0.4rem",color:T.textMid}}>No trending data yet</div>
          <div style={{fontSize:"0.8rem"}}>Be the first to check some products!</div>
        </div>
      )}

      {!loading&&trending.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
          {trending.map((p,i)=>{
            const livePs = (p.ingredients&&p.ingredients.trim().length>10) ? Math.round(analyzeIngredients(p.ingredients).avgScore||0) : (p.poreScore||0); const ps = poreStyle(livePs);
            return (
              <button key={p.id||i} onClick={()=>openProduct(p)}
                style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"0.75rem",display:"flex",alignItems:"center",gap:"0.85rem",cursor:"pointer",textAlign:"left",transition:"all 0.15s",width:"100%"}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.transform="translateX(2px)";}}
                onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="none";}}>
                {/* Rank */}
                <div style={{width:"28px",height:"28px",borderRadius:"50%",background:i<3?[T.amber,T.textLight,T.accent][i]+"22":T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{fontSize:"0.75rem",fontWeight:"800",color:i<3?[T.amber,T.textMid,T.accent][i]:T.textLight,fontFamily:"'Inter',sans-serif"}}>#{i+1}</span>
                </div>
                {/* Image */}
                <div style={{width:"44px",height:"44px",background:"#fff",borderRadius:"0.5rem",overflow:"hidden",flexShrink:0,border:`1px solid ${T.border}`}}>
                  <ProductImage src={p.adminImage||p.image||null} name={p.productName} brand={p.brand||""} barcode={p.barcode||""} size="full"/>
                </div>
                {/* Info */}
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                  {p.brand&&<div style={{fontSize:"0.72rem",fontWeight:"400",color:T.textMid,marginTop:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand}</div>}
                  <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>{p.scanCount} check{p.scanCount!==1?"s":""}{p.avgCommunity?` · ${p.avgCommunity}/10 Rallier score`:""}</div>
                </div>
                {/* Pore badge */}
                <div style={{padding:"0.25rem 0.5rem",background:ps.color+"18",borderRadius:"0.4rem",border:`1px solid ${ps.color}30`,flexShrink:0,textAlign:"center"}}>
                  <div style={{fontSize:"0.65rem",fontWeight:"700",color:ps.color,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{livePs}<span style={{fontSize:"0.5rem",opacity:0.7}}>/5</span></div>
                  <div style={{fontSize:"0.48rem",color:ps.color,fontWeight:"600",opacity:0.8}}>{ps.label}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
            );
          })}
        </div>
      )}

      {selectedProduct&&<ProductModal product={selectedProduct} onClose={()=>setSelectedProduct(null)} user={user} profile={profile} onUpdateProfile={onUpdateProfile||(() => {})} onUserTap={onUserTap}/>}
      {showAddModal&&<AddProductModal
        user={user}
        prefillBarcode={addPrefillBarcode}
        prefillName={addPrefillName}
        onClose={()=>{setShowAddModal(false);setAddPrefillBarcode("");setAddPrefillName("");}}
        onAdded={(p)=>{
          setIngredients(p.ingredients);
          setProductName(p.productName);
          setBrand(p.brand);
          setInputMode("type");
          setShowAddModal(false);
          setAddPrefillBarcode("");
          setAddPrefillName("");
        }}
      />}
    </div>
  );
}


// ── Shop Page — browse best non-pore-clogging products by type ─
// When you get your Amazon tag, replace all instances of "YOURTAG-20" with your actual tag
const AMZN = (asin) => `https://www.amazon.com/dp/${asin}`;

const SHOP_CATEGORIES = [
  { id:"face-wash", label:"Face Wash", emoji:"🫧", products:[
    {productName:"Hydrating Facial Cleanser", brand:"CeraVe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=CeraVe%20Hydrating%20Facial%20Cleanser&i=beauty", skinTypes:["Dry","Normal","Sensitive"], reason:"Ceramide-rich, fragrance-free, zero pore-cloggers", ingredients:"water, glycerin, behentrimonium methosulfate, ceramide np, ceramide ap, ceramide eop, cholesterol, niacinamide, panthenol, hyaluronic acid"},
    {productName:"Foaming Facial Cleanser", brand:"CeraVe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=CeraVe%20Foaming%20Facial%20Cleanser&i=beauty", skinTypes:["Oily","Normal","Acne-prone"], reason:"Removes excess oil without stripping — niacinamide + 3 ceramides", ingredients:"water, glycerin, niacinamide, ceramide np, ceramide ap, ceramide eop, panthenol, tocopherol"},
    {productName:"Toleriane Hydrating Gentle Cleanser", brand:"La Roche-Posay", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=La%20Roche-Posay%20Toleriane%20Hydrating%20Gentle%20Cleanser&i=beauty", skinTypes:["Dry","Sensitive"], reason:"Fragrance-free, microbiome-friendly", ingredients:"water, glycerin, niacinamide, ceramide np, panthenol, sodium hyaluronate, allantoin"},
    {productName:"Gentle Skin Cleanser", brand:"Cetaphil", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Cetaphil%20Gentle%20Skin%20Cleanser&i=beauty", skinTypes:["All","Sensitive"], reason:"Dermatologist #1 recommended, fragrance-free", ingredients:"water, glycerin, panthenol, niacinamide, sodium cocoamphoacetate, allantoin, tocopherol"},
    {productName:"Low pH Good Morning Gel Cleanser", brand:"COSRX", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=COSRX%20Low%20pH%20Good%20Morning%20Gel%20Cleanser&i=beauty", skinTypes:["All","Acne-prone"], reason:"pH 5.0 preserves acid mantle, willow bark BHA", ingredients:"water, cocamidopropyl betaine, sodium lauroyl methyl isethionate, willow bark extract, panthenol, allantoin, niacinamide"},
    {productName:"Ultra Gentle Cleanser", brand:"Face Reality", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Face+Reality+Ultra+Gentle+Cleanser", skinTypes:["Sensitive","Acne-prone"], reason:"Professional acne-safe cleanser, no pore-cloggers", ingredients:"water, glycerin, sodium cocoyl isethionate, panthenol, allantoin, niacinamide, sodium pca"},
    {productName:"Renewing SA Cleanser", brand:"CeraVe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=CeraVe%20Renewing%20SA%20Cleanser&i=beauty", skinTypes:["Acne-prone","Rough"], reason:"Salicylic acid + ceramides — exfoliating without stripping", ingredients:"water, salicylic acid, glycerin, ceramide np, ceramide ap, ceramide eop, niacinamide, panthenol, allantoin"},
    {productName:"Creamy Skin Cleanser", brand:"Vanicream", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Vanicream%20Creamy%20Skin%20Cleanser&i=beauty", skinTypes:["Sensitive","Dry","Eczema"], reason:"Free of all common irritants", ingredients:"water, glycerin, sodium lauroyl methyl isethionate, allantoin, panthenol"},
    {productName:"GENTLECLEAN Hydrating Barrier Cleanser", brand:"Clearstem", poreScore:0, image:"https://clearstem.com/cdn/shop/files/GENTLECLEAN_NEW_Packaging_Front.png?v=1724443257&width=400", buyUrl:"https://www.amazon.com/s?k=Clearstem+GENTLECLEAN", skinTypes:["All","Acne-prone","Sensitive"], reason:"100% acne-safe ingredients while rebuilding the skin barrier", ingredients:"water, aloe barbadensis leaf juice, glycerin, niacinamide, allantoin, sodium pca, panthenol, sodium hyaluronate"},
    {productName:"AHA BHA PHA 30 Days Miracle Foam Cleanser", brand:"Some By Mi", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Some+By+Mi+AHA+BHA+PHA+Miracle+Foam+Cleanser", skinTypes:["Oily","Acne-prone","Combination"], reason:"Triple acid cleanser — clears congestion gently", ingredients:"water, glycolic acid, salicylic acid, gluconolactone, tea tree extract, niacinamide, panthenol, allantoin"},
  ]},
  { id:"moisturizer", label:"Moisturizer", emoji:"💧", products:[
    {productName:"Moisturizing Cream", brand:"CeraVe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=CeraVe%20Moisturizing%20Cream&i=beauty", skinTypes:["Dry","Normal","Sensitive"], reason:"Non-pore-clogging, ceramide-rich, 24hr hydration", ingredients:"water, glycerin, behentrimonium methosulfate, cetearyl alcohol, cetyl alcohol, panthenol, niacinamide, ceramide np, ceramide ap, ceramide eop, carbomer, xanthan gum, tocopherol, hyaluronic acid, cholesterol, dimethicone"},
    {productName:"Toleriane Double Repair Moisturizer", brand:"La Roche-Posay", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=La%20Roche-Posay%20Toleriane%20Double%20Repair%20Moisturizer&i=beauty", skinTypes:["Sensitive","Dry","Acne-prone"], reason:"Restores skin barrier within 1 hour", ingredients:"water, glycerin, niacinamide, panthenol, ceramide np, dimethicone, carbomer, stearyl alcohol, cetyl alcohol, xanthan gum, tocopherol, allantoin"},
    {productName:"Hydro Boost Water Gel", brand:"Neutrogena", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Neutrogena%20Hydro%20Boost%20Water%20Gel&i=beauty", skinTypes:["Oily","Combination","Normal"], reason:"Lightweight, oil-free, hyaluronic acid gel", ingredients:"water, hyaluronic acid, glycerin, dimethicone, cetearyl alcohol, sodium hyaluronate, carbomer, xanthan gum, tocopherol, panthenol"},
    {productName:"Moisturizing Cream", brand:"Cetaphil", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Cetaphil%20Moisturizing%20Cream&i=beauty", skinTypes:["Dry","Sensitive","All"], reason:"Rich, non-greasy, fragrance-free barrier cream", ingredients:"water, glycerin, petrolatum, niacinamide, panthenol, allantoin, tocopherol, carbomer"},
    {productName:"Hydrabalance Hydrating Gel", brand:"Face Reality", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Face+Reality+Hydrabalance", skinTypes:["Oily","Acne-prone","Combination"], reason:"Oil-free acne-safe hydrating gel", ingredients:"water, glycerin, niacinamide, sodium hyaluronate, panthenol, allantoin, xanthan gum"},
    {productName:"The Water Cream", brand:"Tatcha", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Tatcha%20The%20Water%20Cream&i=beauty", skinTypes:["Oily","Combination","Normal"], reason:"Oil-free water-burst moisturizer, Japanese botanicals", ingredients:"water, glycerin, sodium hyaluronate, niacinamide, hadasei-3 complex, panthenol, allantoin, tocopherol"},
    {productName:"Protini Polypeptide Cream", brand:"Drunk Elephant", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Drunk%20Elephant%20Protini%20Polypeptide%20Cream&i=beauty", skinTypes:["All","Mature"], reason:"Signal peptides + growth factors, zero pore-cloggers", ingredients:"water, glycerin, peptides, amino acids, pygmy waterlily stem cell extract, niacinamide, panthenol, allantoin"},
    {productName:"Calm + Restore Oat Gel Moisturizer", brand:"Aveeno", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Aveeno%20Calm%20%2B%20Restore%20Oat%20Gel%20Moisturizer&i=beauty", skinTypes:["Sensitive","Normal","Dry"], reason:"Oat + feverfew, fragrance-free, non-comedogenic", ingredients:"water, glycerin, panthenol, allantoin, niacinamide, dimethicone, hyaluronic acid, xanthan gum, carbomer, tocopherol"},
    {productName:"Priming Moisturizer", brand:"Glossier", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Glossier%20Priming%20Moisturizer&i=beauty", skinTypes:["All","Normal","Combination"], reason:"Skin-blurring lightweight daily moisturizer", ingredients:"water, glycerin, sodium hyaluronate, niacinamide, allantoin, panthenol, squalane"},
    {productName:"Aqua Bomb", brand:"Belif", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Belif%20Aqua%20Bomb&i=beauty", skinTypes:["Oily","Combination","Normal"], reason:"Lady's mantle herb water-burst gel, no pore-cloggers", ingredients:"water, glycerin, lady's mantle extract, niacinamide, sodium hyaluronate, allantoin, panthenol"},
  ]},
  { id:"serum", label:"Serum", emoji:"✨", products:[
    {productName:"Niacinamide 10% + Zinc 1%", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The%20Ordinary%20Niacinamide%2010%25%20%2B%20Zinc%201%25&i=beauty", skinTypes:["Oily","Combination","Acne-prone"], reason:"Pore-minimizing, oil control, blemish reduction", ingredients:"water, niacinamide, zinc pca, panthenol, glycerin, hyaluronic acid, allantoin, dimethicone"},
    {productName:"Hyaluronic Acid 2% + B5", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The%20Ordinary%20Hyaluronic%20Acid%202%25%20%2B%20B5&i=beauty", skinTypes:["All","Dry","Dehydrated"], reason:"Multi-weight HA complex, deep and surface hydration", ingredients:"water, hyaluronic acid, sodium hyaluronate, panthenol, glycerin, allantoin, carbomer"},
    {productName:"Advanced Snail 96 Mucin Power Essence", brand:"COSRX", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=COSRX%20Advanced%20Snail%2096%20Mucin%20Power%20Essence&i=beauty", skinTypes:["All","Dry","Damaged"], reason:"96% snail mucin repairs skin barrier and fades scars", ingredients:"snail secretion filtrate 96%, betaine, niacinamide, sodium hyaluronate, panthenol, allantoin"},
    {productName:"Mandelic Acid Serum 8%", brand:"Face Reality", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Face+Reality+Mandelic+Serum", skinTypes:["Acne-prone","Sensitive"], reason:"Professional-grade mandelic acid — gentler than glycolic", ingredients:"water, mandelic acid, niacinamide, glycerin, panthenol, allantoin, sodium hyaluronate"},
    {productName:"Vitamin C Serum", brand:"Clearstem", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Clearstem+vitamin+c+serum", skinTypes:["All","Dull","Acne-prone"], reason:"Acne-safe vitamin C — brightens without pore-cloggers", ingredients:"water, ascorbic acid, niacinamide, glycerin, ferulic acid, tocopherol, panthenol, allantoin"},
    {productName:"C E Ferulic", brand:"SkinCeuticals", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=SkinCeuticals%20C%20E%20Ferulic&i=beauty", skinTypes:["All","Mature","Dull"], reason:"Gold standard vitamin C serum, 15% L-ascorbic acid", ingredients:"water, ascorbic acid, ethanolamine, ferulic acid, tocopherol, glycerin, panthenol, allantoin"},
    {productName:"C.E.O. 15% Vitamin C Serum", brand:"Sunday Riley", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Sunday%20Riley%20C.E.O.%2015%25%20Vitamin%20C%20Serum&i=beauty", skinTypes:["All","Dull","Mature"], reason:"THD vitamin C + turmeric, brightens and firms", ingredients:"water, thd ascorbate, glycerin, turmeric extract, panthenol, allantoin, niacinamide, ferulic acid"},
    {productName:"Buffet Peptide Serum", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The%20Ordinary%20Buffet%20Peptide%20Serum&i=beauty", skinTypes:["All","Mature"], reason:"Multi-peptide anti-aging serum, no pore-cloggers", ingredients:"water, glycerin, peptides, amino acids, hyaluronic acid, panthenol, allantoin, niacinamide"},
    {productName:"Plum Plump Hyaluronic Serum", brand:"Glow Recipe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Glow%20Recipe%20Plum%20Plump%20Hyaluronic%20Serum&i=beauty", skinTypes:["All","Dry","Dehydrated"], reason:"5 types of HA + plum extract for mega hydration", ingredients:"water, glycerin, sodium hyaluronate, plum extract, niacinamide, panthenol, allantoin"},
    {productName:"Good Genes Lactic Acid Treatment", brand:"Sunday Riley", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Sunday%20Riley%20Good%20Genes%20Lactic%20Acid%20Treatment&i=beauty", skinTypes:["All","Dull","Uneven"], reason:"Lactic acid exfoliant with licorice, instant glow", ingredients:"water, lactic acid, glycerin, licorice root extract, panthenol, allantoin, niacinamide, tocopherol"},
  ]},
  { id:"exfoliant", label:"Exfoliant", emoji:"🌀", products:[
    {productName:"Skin Perfecting 2% BHA Liquid Exfoliant", brand:"Paula's Choice", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Paula%27s%20Choice%20Skin%20Perfecting%202%25%20BHA%20Liquid%20Exfoliant&i=beauty", skinTypes:["Oily","Acne-prone","Combination"], reason:"Unclogs pores, smooths texture, reduces blackheads", ingredients:"water, methylpropanediol, butylene glycol, salicylic acid, polysorbate 80, panthenol, allantoin, glycerin"},
    {productName:"AHA 30% + BHA 2% Peeling Solution", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The%20Ordinary%20AHA%2030%25%20%2B%20BHA%202%25%20Peeling%20Solution&i=beauty", skinTypes:["Oily","Acne-prone","Dull"], reason:"10min weekly peel — resurfaces and unclogs in one step", ingredients:"water, glycolic acid, salicylic acid, lactic acid, tartaric acid, glycerin, panthenol, allantoin"},
    {productName:"Glycolic Acid 7% Toning Solution", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The%20Ordinary%20Glycolic%20Acid%207%25%20Toning%20Solution&i=beauty", skinTypes:["All","Dull","Rough"], reason:"Daily glycolic toner improves texture and brightness", ingredients:"water, glycolic acid, glycerin, panthenol, allantoin, niacinamide, sodium hyaluronate"},
    {productName:"10% Azelaic Acid Booster", brand:"Paula's Choice", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Paula%27s%20Choice%2010%25%20Azelaic%20Acid%20Booster&i=beauty", skinTypes:["Acne-prone","Redness"], reason:"Azelaic acid fades marks and reduces redness", ingredients:"water, azelaic acid, c12-15 alkyl benzoate, glycerin, cetearyl alcohol, dimethicone, salicylic acid, allantoin, panthenol"},
    {productName:"T.L.C. Sukari Babyfacial", brand:"Drunk Elephant", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Drunk%20Elephant%20T.L.C.%20Sukari%20Babyfacial&i=beauty", skinTypes:["All","Dull","Uneven"], reason:"25% AHA + 2% BHA weekly treatment, resurfaces skin", ingredients:"water, glycolic acid, tartaric acid, lactic acid, citric acid, salicylic acid, glycerin, panthenol, allantoin"},
    {productName:"AHA BHA PHA 30 Days Miracle Toner", brand:"Some By Mi", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Some%20By%20Mi%20AHA%20BHA%20PHA%2030%20Days%20Miracle%20Toner&i=beauty", skinTypes:["Acne-prone","Oily"], reason:"Triple acid toner clears pores and refines texture", ingredients:"water, glycolic acid, salicylic acid, gluconolactone, niacinamide, allantoin, panthenol, tea tree extract"},
  ]},
  { id:"spf", label:"SPF", emoji:"☀️", products:[
    {productName:"UV Clear Broad-Spectrum SPF 46", brand:"EltaMD", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=EltaMD%20UV%20Clear%20Broad-Spectrum%20SPF%2046&i=beauty", skinTypes:["Acne-prone","Sensitive","Oily"], reason:"Niacinamide + zinc oxide — dermatologist favourite for acne-prone", ingredients:"water, zinc oxide, octinoxate, niacinamide, hyaluronic acid, lactic acid, tocopherol, panthenol"},
    {productName:"Sunforgettable Total Protection SPF 50", brand:"Colorescience", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Colorescience+Sunforgettable+SPF+50", skinTypes:["All","Sensitive","Acne-prone"], reason:"100% mineral, reef-safe, acne-safe powder SPF", ingredients:"titanium dioxide, zinc oxide, mica, silica, niacinamide, tocopherol, panthenol"},
    {productName:"Anthelios Melt-in Milk SPF 60", brand:"La Roche-Posay", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=La%20Roche-Posay%20Anthelios%20Melt-in%20Milk%20SPF%2060&i=beauty", skinTypes:["All","Sensitive"], reason:"Broad spectrum SPF 60, fragrance-free", ingredients:"water, homosalate, octocrylene, octisalate, avobenzone, glycerin, niacinamide, panthenol, allantoin"},
    {productName:"Ultra Sheer Dry-Touch Sunscreen SPF 55", brand:"Neutrogena", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Neutrogena%20Ultra%20Sheer%20Dry-Touch%20Sunscreen%20SPF%2055&i=beauty", skinTypes:["All","Oily"], reason:"Lightweight, non-greasy, non-comedogenic SPF 55", ingredients:"water, homosalate, octisalate, octocrylene, avobenzone, glycerin, dimethicone, niacinamide, panthenol"},
    {productName:"Invisible Shield Daily Sunscreen SPF 35", brand:"Glossier", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Glossier%20Invisible%20Shield%20Daily%20Sunscreen%20SPF%2035&i=beauty", skinTypes:["All","Oily","Combination"], reason:"Water-gel texture, no white cast, non-comedogenic", ingredients:"water, homosalate, octisalate, octocrylene, avobenzone, glycerin, niacinamide, allantoin, panthenol"},
    {productName:"Mineral Eye Cream SPF 35", brand:"Colorescience", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Colorescience+Total+Eye+SPF+35", skinTypes:["All","Sensitive"], reason:"Mineral SPF + peptides for the eye area, no pore-cloggers", ingredients:"zinc oxide, titanium dioxide, glycerin, niacinamide, peptides, panthenol, allantoin"},
    {productName:"Daily Sun Defense SPF 30", brand:"Face Reality", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Face+Reality+Daily+Sun+Defense+SPF+30", skinTypes:["Acne-prone","Oily"], reason:"Acne-safe mineral SPF for oily skin", ingredients:"zinc oxide, water, glycerin, niacinamide, dimethicone, panthenol, allantoin"},
  ]},
  { id:"acne", label:"Acne Treatment", emoji:"🎯", products:[
    {productName:"Acne Med 5%", brand:"Face Reality", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Face+Reality+Acne+Med", skinTypes:["Acne-prone","Oily"], reason:"Professional-grade benzoyl peroxide treatment", ingredients:"water, benzoyl peroxide 5%, glycerin, niacinamide, panthenol, allantoin, carbomer"},
    {productName:"CLEARSTEM CLARIFY Acne Serum", brand:"Clearstem", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Clearstem+CLARIFY", skinTypes:["Acne-prone","All"], reason:"Stem cell + salicylic acid — targets acne without drying", ingredients:"water, salicylic acid, stem cell extract, niacinamide, glycerin, panthenol, allantoin, sodium hyaluronate"},
    {productName:"Snail Mucin 92% Repair Cream", brand:"COSRX", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=COSRX%20Snail%20Mucin%2092%25%20Repair%20Cream&i=beauty", skinTypes:["All","Acne-prone","Damaged"], reason:"92% snail mucin repairs acne scars and strengthens barrier", ingredients:"snail secretion filtrate 92%, betaine, sodium hyaluronate, niacinamide, panthenol, allantoin"},
    {productName:"Retinol 0.5% in Squalane", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The%20Ordinary%20Retinol%200.5%25%20in%20Squalane&i=beauty", skinTypes:["Acne-prone","Mature"], reason:"Stable retinol in squalane — anti-acne and anti-aging", ingredients:"squalane, retinol, tocopherol, glycerin, panthenol"},
    {productName:"Drying Lotion", brand:"Mario Badescu", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Mario%20Badescu%20Drying%20Lotion&i=beauty", skinTypes:["Acne-prone","Oily"], reason:"Cult overnight spot treatment, dries blemishes fast", ingredients:"water, salicylic acid, calamine, zinc oxide, isopropyl alcohol, camphor, allantoin"},
    {productName:"Acne Foaming Cream Cleanser", brand:"CeraVe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=CeraVe%20Acne%20Foaming%20Cream%20Cleanser&i=beauty", skinTypes:["Acne-prone","Oily"], reason:"4% benzoyl peroxide + ceramides, gentle on skin barrier", ingredients:"water, benzoyl peroxide, glycerin, ceramide np, ceramide ap, ceramide eop, niacinamide, panthenol, allantoin"},
  ]},
  { id:"toner", label:"Toner", emoji:"💦", products:[
    {productName:"Calendula Herbal-Extract Toner", brand:"Kiehl's", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Kiehl%27s%20Calendula%20Herbal-Extract%20Toner&i=beauty", skinTypes:["All","Sensitive"], reason:"Alcohol-free calendula toner, soothes and balances", ingredients:"water, calendula extract, allantoin, panthenol, glycerin, niacinamide"},
    {productName:"Sensibio H2O Micellar Water", brand:"Bioderma", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Bioderma%20Sensibio%20H2O%20Micellar%20Water&i=beauty", skinTypes:["Sensitive","All"], reason:"Cult micellar water, removes makeup without rinsing", ingredients:"water, hexylene glycol, glycerin, disodium cocoamphodiacetate, poloxamer 184, allantoin, panthenol"},
    {productName:"Facial Spray with Aloe", brand:"Mario Badescu", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Mario%20Badescu%20Facial%20Spray%20with%20Aloe&i=beauty", skinTypes:["All","Dry"], reason:"Refreshing aloe mist, sets makeup and hydrates", ingredients:"water, aloe barbadensis leaf juice, glycerin, allantoin, panthenol, niacinamide"},
  ]},
  { id:"eye", label:"Eye Cream", emoji:"👁️", products:[
    {productName:"Eye Repair Cream", brand:"CeraVe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=CeraVe%20Eye%20Repair%20Cream&i=beauty", skinTypes:["All","Sensitive"], reason:"Ceramides + niacinamide, reduces dark circles and puffiness", ingredients:"water, glycerin, niacinamide, ceramide np, ceramide ap, ceramide eop, panthenol, allantoin, tocopherol"},
    {productName:"Total Eye 3-in-1 Renewal Therapy SPF 35", brand:"Colorescience", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Colorescience+Total+Eye+3+in+1", skinTypes:["All","Mature"], reason:"Mineral SPF + peptides + colour correction for eyes", ingredients:"zinc oxide, titanium dioxide, glycerin, niacinamide, peptides, panthenol, allantoin, tocopherol"},
    {productName:"Hydro Boost Eye Gel Cream", brand:"Neutrogena", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Neutrogena%20Hydro%20Boost%20Eye%20Gel%20Cream&i=beauty", skinTypes:["All","Oily"], reason:"Lightweight hyaluronic gel, non-comedogenic eye cream", ingredients:"water, hyaluronic acid, glycerin, dimethicone, sodium hyaluronate, niacinamide, panthenol, allantoin"},
  ]},
  { id:"mask", label:"Face Mask", emoji:"🎭", products:[
    {productName:"Watermelon Glow Sleeping Mask", brand:"Glow Recipe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Glow%20Recipe%20Watermelon%20Glow%20Sleeping%20Mask&i=beauty", skinTypes:["All","Oily","Dull"], reason:"Overnight watermelon + AHA brightening sleep mask", ingredients:"water, watermelon fruit extract, glycolic acid, glycerin, niacinamide, panthenol, allantoin, tocopherol"},
    {productName:"Cucumber Gel Mask", brand:"Peter Thomas Roth", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Peter%20Thomas%20Roth%20Cucumber%20Gel%20Mask&i=beauty", skinTypes:["All","Sensitive","Oily"], reason:"Cooling cucumber gel mask soothes and hydrates", ingredients:"water, cucumber extract, glycerin, aloe barbadensis, allantoin, panthenol, niacinamide"},
    {productName:"Water Sleeping Mask", brand:"Laneige", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Laneige%20Water%20Sleeping%20Mask&i=beauty", skinTypes:["All","Dry","Normal"], reason:"Overnight hydration boost, SLEEPSCENT technology", ingredients:"water, glycerin, sodium hyaluronate, niacinamide, panthenol, allantoin, tocopherol"},
  ]},
  { id:"body", label:"Body Care", emoji:"🧴", products:[
    {productName:"Ultra Repair Cream", brand:"First Aid Beauty", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=First%20Aid%20Beauty%20Ultra%20Repair%20Cream&i=beauty", skinTypes:["Dry","Sensitive","Eczema"], reason:"Colloidal oatmeal + ceramides, instant relief for dry skin", ingredients:"water, glycerin, colloidal oatmeal, ceramide np, niacinamide, panthenol, allantoin, tocopherol"},
    {productName:"Skin Relief Moisture Repair Cream", brand:"Aveeno", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Aveeno%20Skin%20Relief%20Moisture%20Repair%20Cream&i=beauty", skinTypes:["Dry","Sensitive","Eczema"], reason:"Oat + ceramides, fragrance-free body cream", ingredients:"water, glycerin, oat extract, ceramide np, niacinamide, panthenol, allantoin, dimethicone"},
    {productName:"Creamy Skin Cleanser Body Wash", brand:"Vanicream", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Vanicream+body+wash", skinTypes:["Sensitive","Dry","Eczema"], reason:"Free of all common irritants, gentle daily body wash", ingredients:"water, glycerin, sodium lauroyl methyl isethionate, allantoin, panthenol"},
  ]},
  { id:"makeup", label:"Makeup", emoji:"💄", products:[
    {productName:"Flush Balm Cream Blush", brand:"Merit", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Merit+Flush+Balm+Cream+Blush", skinTypes:["All"], reason:"Clean, non-comedogenic cream blush", ingredients:"dimethicone, cyclopentasiloxane, mica, glycerin, niacinamide, tocopherol, panthenol"},
    {productName:"The Minimalist Weightless Foundation", brand:"Merit", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Merit+Minimalist+Foundation", skinTypes:["All","Oily","Combination"], reason:"Buildable, non-comedogenic, clean formula foundation", ingredients:"water, dimethicone, glycerin, titanium dioxide, niacinamide, panthenol, allantoin"},
    {productName:"Soft Matte Complete Concealer", brand:"NARS", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=NARS+Soft+Matte+Complete+Concealer", skinTypes:["All","Oily"], reason:"Full coverage, non-comedogenic, long-wearing concealer", ingredients:"water, dimethicone, glycerin, titanium dioxide, niacinamide, panthenol, allantoin"},
    {productName:"Radiant Longwear Foundation", brand:"NARS", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=NARS+Radiant+Longwear+Foundation", skinTypes:["All","Normal","Dry"], reason:"Buildable coverage, non-comedogenic, 16hr wear", ingredients:"water, dimethicone, glycerin, titanium dioxide, niacinamide, panthenol, allantoin"},
    {productName:"Serum Skin Tint SPF 40", brand:"Ilia", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Ilia+Serum+Skin+Tint+SPF+40", skinTypes:["All","Dry","Normal"], reason:"Clean, buildable tinted SPF serum — skincare meets makeup", ingredients:"water, zinc oxide, glycerin, niacinamide, sodium hyaluronate, panthenol, allantoin, tocopherol"},
    {productName:"Slip Tint Moisturizing Tinted Primer", brand:"Tower 28", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Tower+28+Slip+Tint", skinTypes:["Sensitive","Acne-prone","All"], reason:"Fragrance-free, non-comedogenic, SkinSafe certified", ingredients:"water, glycerin, niacinamide, dimethicone, sodium hyaluronate, panthenol, allantoin"},
    {productName:"Kush High Volume Mascara", brand:"Milk Makeup", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Milk+Makeup+Kush+Mascara", skinTypes:["All"], reason:"Hemp-derived formula, no pore-clogging waxes", ingredients:"water, beeswax, carnauba wax, hemp seed oil, panthenol, tocopherol"},
  ]},
  { id:"face-wash", label:"Face Wash", emoji:"🫧", products:[
    {productName:"Superfood Cleanser", brand:"Youth To The People", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Youth+To+The+People+Superfood+Cleanser&i=beauty", skinTypes:["All","Acne-prone","Oily"], reason:"Kale + spinach + green tea — antioxidant-rich, oil-free, zero comedogenic ingredients", ingredients:"water, glycerin, spinacia oleracea leaf extract, kale extract, green tea extract, vitamin c, niacinamide, allantoin, panthenol, sodium pca"},
    {productName:"Jelly Cleanser", brand:"Versed", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Versed+Jelly+Cleanser&i=beauty", skinTypes:["All","Acne-prone","Sensitive"], reason:"Clean, fragrance-free, pore-safe jelly formula", ingredients:"water, glycerin, sodium lauroyl methyl isethionate, niacinamide, allantoin, panthenol, sodium hyaluronate"},
    {productName:"Milky Jelly Cleanser", brand:"Glossier", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Glossier+Milky+Jelly+Cleanser&i=beauty", skinTypes:["All","Sensitive","Dry"], reason:"pH-balanced, polysorbate-20 free, gentle daily cleanser", ingredients:"water, glycerin, allantoin, niacinamide, panthenol, sodium pca, sodium hyaluronate"},
    {productName:"Squalane + Antioxidant Cleansing Oil", brand:"Biossance", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Biossance+Squalane+Antioxidant+Cleansing+Oil&i=beauty", skinTypes:["Dry","Normal","Sensitive"], reason:"Squalane-based cleansing oil — no mineral oil, no coconut oil", ingredients:"squalane, caprylic/capric triglyceride, tocopherol, rosehip seed oil, vitamin e, allantoin"},
    {productName:"Salicylic Acid Cleanser", brand:"Alpyn Beauty", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Alpyn+Beauty+Salicylic+Acid+Cleanser&i=beauty", skinTypes:["Acne-prone","Oily","Combination"], reason:"Wild-harvested botanicals + 0.5% salicylic acid, acne-safe", ingredients:"water, salicylic acid, glycerin, niacinamide, allantoin, panthenol, sodium hyaluronate, arnica montana extract"},
    {productName:"Acne Cleanser", brand:"Murad", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Murad+Acne+Cleanser&i=beauty", skinTypes:["Acne-prone","Oily"], reason:"1.5% salicylic acid + glycolic acid, dermatologist developed", ingredients:"water, salicylic acid, glycolic acid, glycerin, niacinamide, allantoin, panthenol, sodium hyaluronate"},
    {productName:"Daily Microfoliant", brand:"Dermalogica", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Dermalogica+Daily+Microfoliant&i=beauty", skinTypes:["All","Sensitive","Acne-prone"], reason:"Rice-based enzyme powder exfoliant — brightens without irritating", ingredients:"rice starch, salicylic acid, papain, allantoin, panthenol, niacinamide, sodium hyaluronate"},
  ]},
  { id:"moisturizer", label:"Moisturizer", emoji:"💧", products:[
    {productName:"Superfluid UV Defense SPF 50+ Moisturizer", brand:"Youth To The People", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Youth+To+The+People+Superfluid+UV+Defense&i=beauty", skinTypes:["Oily","Combination","Acne-prone"], reason:"100% mineral SPF moisturizer — kale + adaptogen complex, zero pore-cloggers", ingredients:"water, zinc oxide, titanium dioxide, glycerin, kale extract, ashwagandha extract, niacinamide, allantoin, panthenol"},
    {productName:"Squalane + Probiotic Moisturizer", brand:"Biossance", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Biossance+Squalane+Probiotic+Moisturizer&i=beauty", skinTypes:["All","Acne-prone","Sensitive"], reason:"Sugarcane-derived squalane, zero pore-cloggers, microbiome-friendly", ingredients:"water, squalane, glycerin, niacinamide, lactobacillus ferment, panthenol, allantoin, sodium hyaluronate"},
    {productName:"Stressed? Balancing Gel Cream", brand:"Versed", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Versed+Stressed+Balancing+Gel+Cream&i=beauty", skinTypes:["Oily","Combination","Acne-prone"], reason:"Oil-free, non-comedogenic, niacinamide-forward", ingredients:"water, glycerin, niacinamide, sodium hyaluronate, allantoin, panthenol, xanthan gum"},
    {productName:"Omega Rich Rescue Cream", brand:"Alpyn Beauty", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Alpyn+Beauty+Omega+Rich+Rescue+Cream&i=beauty", skinTypes:["Dry","Sensitive","Acne-prone"], reason:"Wild-harvested cloudberry + omegas, no pore-clogging oils", ingredients:"water, glycerin, squalane, cloudberry seed oil, niacinamide, panthenol, allantoin, sodium hyaluronate"},
    {productName:"Ultra Repair Face Moisturizer", brand:"First Aid Beauty", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=First+Aid+Beauty+Ultra+Repair+Face+Moisturizer&i=beauty", skinTypes:["Sensitive","Dry","Acne-prone"], reason:"Colloidal oatmeal + ceramides, fragrance-free, acne-safe", ingredients:"water, glycerin, colloidal oatmeal, ceramide np, niacinamide, allantoin, panthenol, tocopherol"},
    {productName:"Supercharged Moisture Cream", brand:"Murad", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Murad+Supercharged+Moisture+Cream&i=beauty", skinTypes:["All","Dry","Mature"], reason:"Hyaluronic acid trilogy + retinol alternative, acne-safe formula", ingredients:"water, glycerin, sodium hyaluronate, niacinamide, bakuchiol, panthenol, allantoin, tocopherol"},
    {productName:"Cicapair Tiger Grass Color Correcting Treatment", brand:"Dr. Jart+", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Dr+Jart+Cicapair+Tiger+Grass+Color+Correcting&i=beauty", skinTypes:["Sensitive","Redness","All"], reason:"Centella asiatica calms redness, SPF 30, non-comedogenic", ingredients:"water, titanium dioxide, zinc oxide, centella asiatica extract, niacinamide, allantoin, panthenol, glycerin"},
  ]},
  { id:"serum", label:"Serum", emoji:"✨", products:[
    {productName:"Adaptogen Deep Moisture Serum", brand:"Youth To The People", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Youth+To+The+People+Adaptogen+Deep+Moisture+Serum&i=beauty", skinTypes:["All","Stressed","Acne-prone"], reason:"Ashwagandha + reishi mushroom + hyaluronic acid — zero pore-cloggers", ingredients:"water, glycerin, ashwagandha extract, reishi mushroom extract, hyaluronic acid, niacinamide, panthenol, allantoin"},
    {productName:"Squalane + Phyto-Retinol Serum", brand:"Biossance", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Biossance+Squalane+Phyto-Retinol+Serum&i=beauty", skinTypes:["All","Mature","Acne-prone"], reason:"Bakuchiol (plant retinol) + squalane — retinol benefits without irritation", ingredients:"water, squalane, bakuchiol, glycerin, niacinamide, panthenol, allantoin, sodium hyaluronate"},
    {productName:"Press Restart Gentle Retinol Serum", brand:"Versed", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Versed+Press+Restart+Gentle+Retinol+Serum&i=beauty", skinTypes:["All","Acne-prone","Mature"], reason:"0.1% retinol encapsulated for slow release — acne-safe, gentle", ingredients:"water, retinol, glycerin, niacinamide, squalane, panthenol, allantoin, sodium hyaluronate"},
    {productName:"10% Niacinamide Booster", brand:"Paula's Choice", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Paula%27s+Choice+10%25+Niacinamide+Booster&i=beauty", skinTypes:["Oily","Acne-prone","Combination"], reason:"Pure 10% niacinamide serum — pore-minimizing, oil control", ingredients:"water, niacinamide, glycerin, panthenol, allantoin, sodium hyaluronate, dimethicone"},
    {productName:"Clearly Corrective Dark Spot Corrector", brand:"Kiehl's", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Kiehl%27s+Clearly+Corrective+Dark+Spot+Corrector&i=beauty", skinTypes:["All","Dull","Post-acne"], reason:"White birch + peony extract fades post-acne marks, non-comedogenic", ingredients:"water, niacinamide, white birch extract, peony extract, glycerin, panthenol, allantoin, tocopherol"},
    {productName:"Brightening Serum", brand:"Clearstem", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Clearstem+Brightening+Serum&i=beauty", skinTypes:["All","Dull","Post-acne","Acne-prone"], reason:"100% acne-safe brightening serum — fades marks without clogging", ingredients:"water, ascorbic acid, niacinamide, glycerin, ferulic acid, kojic acid, allantoin, panthenol"},
    {productName:"Future Dew Serum", brand:"Glow Recipe", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Glow+Recipe+Future+Dew+Serum&i=beauty", skinTypes:["Oily","Combination","Normal"], reason:"Hyaluronic + niacinamide + bakuchiol, weightless glass-skin serum", ingredients:"water, glycerin, sodium hyaluronate, niacinamide, bakuchiol, panthenol, allantoin, watermelon extract"},
    {productName:"Retinal 0.2% Eye Cream", brand:"The Ordinary", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=The+Ordinary+Retinal+0.2%25&i=beauty", skinTypes:["All","Mature","Acne-prone"], reason:"Retinaldehyde — 11x more potent than retinol, stable formula", ingredients:"water, retinaldehyde, glycerin, squalane, niacinamide, panthenol, allantoin"},
  ]},
  { id:"acne", label:"Acne Treatment", emoji:"🎯", products:[
    {productName:"Acne Body Wash", brand:"Clearstem", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Clearstem+Acne+Body+Wash&i=beauty", skinTypes:["Acne-prone","Body"], reason:"Acne-safe body wash — salicylic acid + stem cells, no pore-cloggers", ingredients:"water, salicylic acid, stem cell extract, glycerin, niacinamide, allantoin, panthenol, sodium hyaluronate"},
    {productName:"Acne Spot Treatment", brand:"Murad", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Murad+Acne+Spot+Treatment&i=beauty", skinTypes:["Acne-prone","Oily"], reason:"2% salicylic acid + sulfur, dries blemishes overnight", ingredients:"water, salicylic acid, sulfur, zinc oxide, glycerin, allantoin, panthenol, niacinamide"},
    {productName:"Invisible Pimple Patches", brand:"Hero Cosmetics", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Hero+Cosmetics+Mighty+Patch+Original&i=beauty", skinTypes:["Acne-prone","All"], reason:"Hydrocolloid patches absorb pus, protect from bacteria, no ingredients to worry about", ingredients:"hydrocolloid"},
    {productName:"Naturium Azelaic Acid Emulsion 10%", brand:"Naturium", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Naturium+Azelaic+Acid+10%25&i=beauty", skinTypes:["Acne-prone","Redness","Sensitive"], reason:"10% azelaic acid fades marks and calms redness, acne-safe base", ingredients:"water, azelaic acid, glycerin, niacinamide, allantoin, panthenol, sodium hyaluronate, squalane"},
    {productName:"BHA Blackhead Power Liquid", brand:"COSRX", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=COSRX+BHA+Blackhead+Power+Liquid&i=beauty", skinTypes:["Oily","Acne-prone","Combination"], reason:"4% betaine salicylate — clears blackheads, gentler than traditional BHA", ingredients:"water, betaine salicylate, niacinamide, glycerin, willow bark extract, panthenol, allantoin"},
    {productName:"AcneFree Terminator 10 Acne Spot Treatment", brand:"AcneFree", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=AcneFree+Terminator+10+Spot+Treatment&i=beauty", skinTypes:["Acne-prone","Oily"], reason:"Maximum strength 10% benzoyl peroxide spot treatment", ingredients:"water, benzoyl peroxide 10%, glycerin, allantoin, panthenol, niacinamide"},
  ]},
  { id:"mask", label:"Face Mask", emoji:"🎭", products:[
    {productName:"Supergreens Facial Mask", brand:"Youth To The People", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Youth+To+The+People+Supergreens+Facial+Mask&i=beauty", skinTypes:["All","Oily","Acne-prone"], reason:"Kale + spirulina + hyaluronic acid — detoxifying without stripping", ingredients:"water, kale extract, spirulina extract, hyaluronic acid, glycerin, niacinamide, allantoin, panthenol"},
    {productName:"Cica Repair Cream Mask", brand:"Dr. Jart+", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Dr+Jart+Cica+Repair+Cream+Mask&i=beauty", skinTypes:["Sensitive","Acne-prone","Irritated"], reason:"Centella asiatica repairs and calms — no pore-cloggers", ingredients:"water, centella asiatica extract, glycerin, niacinamide, allantoin, panthenol, sodium hyaluronate"},
    {productName:"Clearing + Live Kombucha Tonic", brand:"Youth To The People", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Youth+To+The+People+Kombucha+Tonic&i=beauty", skinTypes:["Acne-prone","Oily","Combination"], reason:"Live kombucha + niacinamide + willow bark, microbiome-balancing toner", ingredients:"water, kombucha filtrate, niacinamide, willow bark extract, glycerin, allantoin, panthenol"},
    {productName:"Bright On Mask Vitamin C", brand:"Versed", poreScore:0, image:"", buyUrl:"https://www.amazon.com/s?k=Versed+Bright+On+Mask+Vitamin+C&i=beauty", skinTypes:["All","Dull","Acne-prone"], reason:"Vitamin C + niacinamide glow mask — clean, acne-safe formula", ingredients:"water, ascorbic acid, niacinamide, glycerin, kaolin, allantoin, panthenol"},
  ]},
];


const CAT_EMOJI = {"face-wash":"🫧","moisturizer":"💧","serum":"✨","exfoliant":"🌀","spf":"☀️","eye":"👁️","body":"🧴","acne":"🎯","toner":"💦","lip":"💋","mask":"🎭","hair":"💇","makeup":"💄","other":"🛍"};
const CAT_LABEL = {"face-wash":"Face Wash","moisturizer":"Moisturizer","serum":"Serum","exfoliant":"Exfoliant","spf":"SPF","eye":"Eye Cream","body":"Body Care","acne":"Acne Treatment","toner":"Toner","lip":"Lip Care","mask":"Face Mask","hair":"Hair & Scalp","makeup":"Makeup","other":"Other"};
const CAT_ORDER = ["face-wash","moisturizer","serum","exfoliant","spf","eye","body","acne","toner","lip","mask","hair","makeup","other"];

// ── Explore page recommended products carousel ────────────────
function ExploreRecsCarousel({products, profile, friendScans={}, onTap, productImageMap={}}) {
  const skinType = Array.isArray(profile?.skinType) ? profile.skinType : profile?.skinType ? [profile.skinType] : [];
  const concerns = profile?.concerns || [];

  // Filter by skin type if available — prefer matching, fallback to all
  // Only include products with real ingredient data and a safe live score
  const getLiveScore = p => {
    if (!p.ingredients || p.ingredients.trim().length < 10) return 99; // no data = exclude
    const r = analyzeIngredients(p.ingredients);
    return r.avgScore != null ? Math.round(r.avgScore) : 99;
  };
  const hasImg = p => { const img = (p.adminImage||p.image||p.productImage||"").trim(); return img.startsWith("http"); };
  const skinMatched = skinType.length
    ? (products||[]).filter(p => getLiveScore(p) <= 1 && hasImg(p) && p.skinTypes?.some(s => skinType.includes(s) || s === "All"))
    : [];
  const recs = (skinMatched.length >= 4 ? skinMatched : [...(products||[])].filter(p => getLiveScore(p) <= 1 && hasImg(p)))
    .sort((a,b) => (a.poreScore??99)-(b.poreScore??99) || (b.communityRating||0)-(a.communityRating||0))
    .slice(0, 10);

  if (!recs.length) return null;

  const skinLabel = skinType.length ? skinType.join(" · ") : null;

  return (
    <div style={{marginBottom:"1.1rem"}}>
      <div style={{fontSize:"0.6rem",letterSpacing:"0.1em",textTransform:"uppercase",color:T.textLight,fontWeight:"600",fontFamily:"'Inter',sans-serif",marginBottom:"0.6rem"}}>
        Recommended for you{skinLabel ? " · "+skinLabel : ""}
      </div>
      <div style={{display:"flex",gap:"0.55rem",overflowX:"auto",paddingBottom:"0.4rem",marginLeft:"-1rem",paddingLeft:"1rem",marginRight:"-1rem",paddingRight:"1rem",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        {recs.map(rec => {
          const liveRecScore = (rec.ingredients && rec.ingredients.trim().length >= 10) ? (() => { const r = analyzeIngredients(rec.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : null; })() : null;
          const ps = poreStyle(liveRecScore??0);
          const img = (rec.adminImage||rec.image||rec.productImage||productImageMap[(rec.productName||"").toLowerCase().trim()]||"").trim();
          const recFriends = getFriendRoutineUsers(friendScans, rec.productName, rec.id);
          return (
            <button key={rec.id} onClick={()=>onTap(rec)}
              style={{flexShrink:0,width:"120px",background:T.surface,borderRadius:"0.85rem",border:`1px solid ${T.border}`,padding:0,cursor:"pointer",textAlign:"left",overflow:"hidden",display:"flex",flexDirection:"column",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.transform="translateY(-2px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.transform="";}}>
              <div style={{width:"100%",height:"100px",background:"#ffffff",overflow:"hidden",position:"relative",borderBottom:`1px solid ${T.border}`}}>
                {img ? <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"8px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.opacity="0"}/> : <PlaceholderCard name={rec.productName} brand={rec.brand||""}/>}
                <div style={{position:"absolute",top:"5px",right:"5px",background:ps.color,borderRadius:"0.35rem",padding:"2px 5px"}}>
                  {liveRecScore != null
                    ? <span style={{fontSize:"0.6rem",fontWeight:"800",color:"#fff"}}>{liveRecScore}/5</span>
                    : <span style={{fontSize:"0.55rem",fontWeight:"600",color:"#fff",opacity:0.8}}>—</span>
                  }
                </div>
                <FriendRoutinePill friends={recFriends}/>
              </div>
              <div style={{padding:"0.45rem 0.55rem 0.5rem"}}>
                {rec.brand&&<div style={{fontSize:"0.5rem",color:T.accent,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"1px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{rec.brand}</div>}
                <div style={{fontSize:"0.7rem",fontWeight:"600",color:T.text,lineHeight:1.2,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden"}}>{rec.productName}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Our Story popup (shown for first 5 logins) ─────────────────
function OurStoryPopup({onClose, onUserTap}) {
  return (
    <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1.5rem"}}
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(28,28,26,0.55)",backdropFilter:"blur(6px)",pointerEvents:"none"}}/>
      <div style={{position:"relative",width:"100%",maxWidth:"420px",background:T.accentSoft,borderRadius:"1.5rem",padding:"1.75rem 1.5rem 1.5rem",boxShadow:"0 20px 60px rgba(28,28,26,0.2)",overflow:"hidden"}}>
        <div style={{position:"absolute",right:"-1.5rem",bottom:"-1.5rem",opacity:0.07,pointerEvents:"none"}}>
          {RalliIcons.flask(T.navy,130)}
        </div>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:"0.5rem",color:T.navy,letterSpacing:"0.2em",textTransform:"uppercase",fontFamily:"'Inter',sans-serif",fontWeight:"700",marginBottom:"0.5rem",opacity:0.6}}>Our Story</div>
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1.25rem",color:T.navy,lineHeight:1.2,marginBottom:"0.75rem",letterSpacing:"-0.02em"}}>
            Built out of necessity.
          </div>
          <p style={{fontSize:"0.78rem",color:T.navy,fontFamily:"'Inter',sans-serif",lineHeight:1.65,margin:"0 0 0.6rem",opacity:0.8}}>
            Ralli was born from the same frustration we know you've felt — spending hours deciphering ingredient labels, second-guessing whether a glowing review was paid for, and never quite trusting that the "dermatologist recommended" label meant anything real.
          </p>
          <p style={{fontSize:"0.78rem",color:T.navy,fontFamily:"'Inter',sans-serif",lineHeight:1.65,margin:"0 0 1rem",opacity:0.8}}>
            As sisters, we kept sending each other screenshots asking "is this pore-clogging?" We realized our most trusted source was each other — not ads, not influencers. So we built the tool we always wished existed.
          </p>
          <FounderByline onUserTap={onUserTap}/>
          <button onClick={onClose}
            style={{width:"100%",marginTop:"1rem",padding:"0.7rem",background:T.navy,color:"#FFFFFF",border:"none",borderRadius:"0.75rem",fontSize:"0.85rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",letterSpacing:"-0.01em"}}>
            Let's go →
          </button>
        </div>
      </div>
    </div>
  );
}


// ── What We're Loving — admin-curated picks ───────────────────
// ── Founder Picks — editorial 2-col grid ────────────────────
// Firestore collection: founder_picks
// Fields: productName, brand, image, poreScore, buyUrl, ingredients,
//         founderName ("McKenzie" | "Morgan"), founderPhoto, note, order
// Admin can add/edit/remove via AdminFounderPicks component below.

const FOUNDER_AVATARS = {
  McKenzie: "", // Upload a profile photo in the app to populate this
  Morgan: "",   // Upload a profile photo in the app to populate this
};

const FOUNDER_EMAILS = {
  McKenzie: "mckenzierichard77@gmail.com",
  Morgan: "morganrichard777@gmail.com",
};

function useFounderAvatars() {
  const [avatars, setAvatars] = useState({ McKenzie: "", Morgan: "" });
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("email", "in", [FOUNDER_EMAILS.McKenzie, FOUNDER_EMAILS.Morgan])));
        const updated = { McKenzie: "", Morgan: "" };
        snap.docs.forEach(d => {
          const data = d.data();
          if (data.email === FOUNDER_EMAILS.McKenzie) updated.McKenzie = data.photoURL || "";
          if (data.email === FOUNDER_EMAILS.Morgan) updated.Morgan = data.photoURL || "";
        });
        setAvatars(updated);
      } catch {}
    }
    load();
  }, []);
  return avatars;
}

// Compact "About Ralli" banner — shown in feed before People you might know
function AboutRalliCard({onFounderTap}) {
  const avatars = useFounderAvatars();
  return (
    <div style={{marginBottom:"0.9rem",padding:"0.85rem 1rem",background:`linear-gradient(135deg,${T.blush}30,${T.surface})`,borderRadius:"1.25rem",border:`1px solid ${T.blush}99`,boxShadow:"0 1px 4px rgba(0,0,0,0.04)",display:"flex",gap:"0.75rem",alignItems:"center"}}>
      {/* Founder avatars stacked */}
      <div style={{display:"flex",flexShrink:0}}>
        {["McKenzie","Morgan"].map((name,i)=>(
          <button key={name} onClick={()=>onFounderTap&&onFounderTap(name)}
            style={{width:"36px",height:"36px",borderRadius:"50%",overflow:"hidden",border:"2px solid #fff",marginLeft:i>0?"-10px":"0",cursor:"pointer",background:T.accent,padding:0,display:"inline-flex",alignItems:"center",justifyContent:"center",boxShadow:"0 1px 4px rgba(0,0,0,0.12)"}}>
            {avatars[name]
              ? <img src={avatars[name]} alt={name} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              : <span style={{fontSize:"0.6rem",fontWeight:"700",color:"#fff",fontFamily:"'Inter',sans-serif"}}>{name[0]}</span>
            }
          </button>
        ))}
      </div>
      {/* Text */}
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.rose,textTransform:"uppercase",letterSpacing:"0.12em",marginBottom:"0.15rem",fontFamily:"'Inter',sans-serif"}}>From the founders</div>
        <div style={{fontSize:"0.78rem",fontWeight:"500",color:T.text,lineHeight:1.4,fontFamily:"'Inter',sans-serif"}}>We broke out from products we trusted. So we built the app we wish we had — every ingredient, scored.</div>
      </div>
      {/* Chevron */}
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}><polyline points="9 18 15 12 9 6"/></svg>
    </div>
  );
}



// Hardcoded fallback picks shown until Firestore has real data
// What We're Loving section — picks are managed via Admin → Content → What We're Loving
// Products are sourced from the product database via wwl_picks Firestore collection

function FounderPicksSection({onTap, friendScans={}}) {
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);
  const founderAvatars = useFounderAvatars();

  useEffect(()=>{
    async function load() {
      try {
        // founder_picks sourced from product database via AdminFounderPicks
        let snap;
        try {
          snap = await getDocs(query(collection(db,"founder_picks"), orderBy("order","asc"), limit(12)));
        } catch {
          snap = await getDocs(query(collection(db,"founder_picks"), limit(12)));
        }
        if (!snap.empty) {
          // Enrich with latest product data from database
          const pickData = snap.docs.map(d=>({id:d.id,...d.data()}));
          const productIds = pickData.map(p=>p.productId).filter(Boolean);
          let productMap = {};
          if (productIds.length) {
            // Fetch product docs in chunks of 10
            for (let i=0; i<productIds.length; i+=10) {
              const chunk = productIds.slice(i,i+10);
              const pSnap = await getDocs(query(collection(db,"products"), where("__name__","in",chunk)));
              pSnap.docs.forEach(d => { productMap[d.id] = {id:d.id,...d.data()}; });
            }
          }
          setPicks(pickData.map(pick => {
            const p = productMap[pick.productId] || {};
            return {
              ...pick,
              image: p.adminImage||p.image||pick.image||"",
              poreScore: p.poreScore??pick.poreScore??0,
              ingredients: p.ingredients||pick.ingredients||"",
              buyUrl: p.buyUrl||pick.buyUrl||"",
              communityRating: p.communityRating||pick.communityRating||null,
            };
          }));
        }
        // If no picks configured, show nothing (not fake defaults)
      } catch(e) { console.error("WWL load error", e); }
      setLoading(false);
    }
    load();
  },[]);

  if (loading) return (
    <div style={{marginBottom:"1.75rem"}}>
      <div style={{height:"13px",width:"180px",background:T.surfaceAlt,borderRadius:"4px",marginBottom:"0.5rem"}}/>
      <div style={{height:"11px",width:"140px",background:T.surfaceAlt,borderRadius:"4px",marginBottom:"1rem",opacity:0.6}}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.65rem"}}>
        {[1,2,3,4].map(i=><div key={i} style={{height:"260px",background:T.surface,borderRadius:"1rem",border:`1px solid ${T.border}`}}/>)}
      </div>
    </div>
  );
  if (!picks.length) return null;

  return (
    <div style={{marginBottom:"1.75rem"}}>
      {/* Header */}
      <div style={{marginBottom:"0.85rem"}}>
        <div style={{display:"flex",alignItems:"center",gap:"0.4rem",marginBottom:"2px"}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill={T.rose}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <span style={{fontSize:"0.62rem",letterSpacing:"0.1em",textTransform:"uppercase",color:T.rose,fontWeight:"700",fontFamily:"'Inter',sans-serif"}}>What We're Loving</span>
        </div>
        <div style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Personally curated by the Co-Founders</div>
      </div>

      {/* 2-col grid */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.65rem"}}>
        {picks.map(pick=>{
          const ps = poreStyle(pick.poreScore||0);
          const img = (pick.adminImage||pick.image||"").trim();
          const founderPhoto = pick.founderPhoto || founderAvatars[pick.founderName] || "";
          const pickFriends = getFriendRoutineUsers(friendScans, pick.productName, pick.id);
          return (
            <button key={pick.id} onClick={()=>onTap({...pick,productImage:img})}
              style={{background:T.surface,borderRadius:"1rem",border:`1px solid ${T.border}`,padding:0,cursor:"pointer",textAlign:"left",overflow:"hidden",transition:"all 0.18s",display:"flex",flexDirection:"column"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=T.rose+"80";e.currentTarget.style.boxShadow=`0 6px 20px ${T.rose}18`;e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="none";}}>

              {/* Product image */}
              <div style={{width:"100%",aspectRatio:"4/3",background:"#ffffff",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                {img
                  ? <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"12px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.display="none"}/>
                  : <PlaceholderCard name={pick.productName} brand={pick.brand||""}/>
                }
                {/* Pore clog score chip — only if we have real ingredient data */}
                {pick.ingredients && pick.ingredients.trim().length >= 10 && pick.poreScore != null && pick.poreScore > 0 && (
                  <div style={{position:"absolute",top:"8px",left:"8px",background:ps.color,borderRadius:"0.4rem",padding:"2px 7px",display:"flex",alignItems:"center",gap:"3px"}}>
                    <span style={{fontSize:"0.6rem",fontWeight:"700",color:"#fff"}}>{pick.poreScore}/5</span>
                  </div>
                )}
                {/* Founder avatar — only show if no friend pill */}
                {founderPhoto && !pickFriends.length && (
                  <div style={{position:"absolute",bottom:"8px",right:"8px",borderRadius:"50%",border:`2px solid ${T.surface}`,overflow:"hidden",width:"26px",height:"26px",boxShadow:"0 1px 6px rgba(0,0,0,0.15)"}}>
                    <img src={founderPhoto} alt={pick.founderName||""} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                  </div>
                )}
                {founderPhoto && pickFriends.length > 0 && (
                  <div style={{position:"absolute",bottom:"8px",right:"8px",borderRadius:"50%",border:`2px solid ${T.surface}`,overflow:"hidden",width:"26px",height:"26px",boxShadow:"0 1px 6px rgba(0,0,0,0.15)",opacity:0.5}}>
                    <img src={founderPhoto} alt={pick.founderName||""} style={{width:"100%",height:"100%",objectFit:"cover"}} onError={e=>e.target.style.display="none"}/>
                  </div>
                )}
                <FriendRoutinePill friends={pickFriends}/>
              </div>

              {/* Info */}
              <div style={{padding:"0.65rem 0.7rem 0.75rem",flex:1,display:"flex",flexDirection:"column"}}>
                {pick.brand && <div style={{fontSize:"0.53rem",color:T.accent,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pick.brand}</div>}
                <div style={{fontSize:"0.78rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.25,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",marginBottom:"0.45rem"}}>{pick.productName}</div>
                {pick.note && (
                  <div style={{fontSize:"0.65rem",color:T.textMid,lineHeight:1.4,fontStyle:"italic",display:"-webkit-box",WebkitLineClamp:3,WebkitBoxOrient:"vertical",overflow:"hidden",flex:1,marginBottom:"0.45rem"}}>
                    "{pick.note}"
                  </div>
                )}
                {pick.founderName && (
                  <div style={{fontSize:"0.58rem",color:T.textLight,fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
                    — {pick.founderName}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Admin: manage founder picks ───────────────────────────────
function AdminFounderPicks() {
  const [picks, setPicks]       = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState("");
  const [msg, setMsg]           = useState("");

  useEffect(()=>{
    async function load() {
      setLoading(true);
      // Load products first — this must succeed
      try {
        const prodSnap = await getDocs(collection(db,"products"));
        setProducts(prodSnap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.approved));
      } catch(e) { console.error("AdminFounderPicks products error:", e); }
      // Load picks separately
      try {
        const pickSnap = await getDocs(query(collection(db,"founder_picks"), orderBy("order","asc")));
        setPicks(pickSnap.docs.map(d=>({id:d.id,...d.data()})));
      } catch {
        try {
          const pickSnap = await getDocs(collection(db,"founder_picks"));
          setPicks(pickSnap.docs.map(d=>({id:d.id,...d.data()})));
        } catch(e) { console.error("AdminFounderPicks picks error:", e); }
      }
      setLoading(false);
    }
    load();
  },[]);

  async function addPick(product) {
    if (picks.find(p=>p.productId===product.id||p.productName===product.productName)) {
      setMsg("Already in picks"); setTimeout(()=>setMsg(""),2000); return;
    }
    setMsg("Adding…");
    try {
      const newPick = {
        productId: product.id,
        productName: product.productName,
        brand: product.brand||"",
        image: product.adminImage||product.image||"",
        poreScore: product.poreScore||0,
        buyUrl: product.buyUrl||"",
        note: "",
        founderName: "McKenzie",
        order: picks.length,
        createdAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db,"founder_picks"), newPick);
      setPicks(p=>[...p, {id:ref.id,...newPick}]);
      setSearch("");
      setMsg("✓ Added!"); setTimeout(()=>setMsg(""),2000);
    } catch(e) {
      setMsg("Error: "+e.message); setTimeout(()=>setMsg(""),4000);
    }
  }

  async function updateNote(id, note) {
    await updateDoc(doc(db,"founder_picks",id),{note});
    setPicks(p=>p.map(x=>x.id===id?{...x,note}:x));
  }

  async function updateFounder(id, founderName) {
    await updateDoc(doc(db,"founder_picks",id),{founderName});
    setPicks(p=>p.map(x=>x.id===id?{...x,founderName}:x));
  }

  async function remove(id) {
    if (!confirm("Remove this pick?")) return;
    await deleteDoc(doc(db,"founder_picks",id));
    setPicks(p=>p.filter(x=>x.id!==id));
  }

  const filtered = search.trim().length > 0
    ? products.filter(p=>(p.productName+" "+p.brand).toLowerCase().includes(search.toLowerCase())).slice(0,8)
    : [];

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight}}>Loading…</div>;

  return (
    <div style={{padding:"1rem"}}>
      <div style={{fontWeight:"700",fontFamily:"'Inter',sans-serif",fontSize:"1rem",color:T.text,marginBottom:"0.35rem"}}>
        What We're Loving
      </div>
      <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"1.25rem"}}>
        Search your product database and add picks. These appear on the Explore page.
      </div>

      {/* Search */}
      <div style={{marginBottom:"0.75rem"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder={`Search ${products.length} products…`}
          style={{width:"100%",padding:"0.65rem 1rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none",boxSizing:"border-box"}}/>
      </div>

      {/* Results — inline, not a dropdown */}
      {filtered.length > 0 && (
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.65rem",overflow:"hidden",marginBottom:"0.75rem"}}>
          {filtered.map(p=>(
            <button key={p.id} onClick={()=>{document.activeElement?.blur();addPick(p);}}
              style={{width:"100%",padding:"0.85rem 1rem",background:"none",border:"none",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.75rem",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"rgba(0,0,0,0.05)"}}>
              {(p.adminImage||p.image) && <img src={p.adminImage||p.image} alt="" style={{width:"40px",height:"40px",objectFit:"contain",borderRadius:"0.35rem",background:"#ffffff",flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                <div style={{fontSize:"0.68rem",color:T.textLight}}>{p.brand} · Pore {p.poreScore||0}/5</div>
              </div>
              <div style={{flexShrink:0,background:T.sage,color:"#fff",borderRadius:"0.5rem",padding:"0.35rem 0.75rem",fontSize:"0.75rem",fontWeight:"700"}}>+ Add</div>
            </button>
          ))}
        </div>
      )}

      {msg && <div style={{fontSize:"0.75rem",color:T.sage,fontWeight:"600",marginBottom:"0.5rem"}}>{msg}</div>}

      {/* Current picks */}
      <div style={{fontSize:"0.62rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:"600",marginBottom:"0.5rem"}}>{picks.length} / 10 picks</div>
      {picks.length === 0 && (
        <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.8rem",background:T.surfaceAlt,borderRadius:"0.75rem"}}>
          No picks yet — search and add products above
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:"0.65rem"}}>
        {picks.map(pick=>(
          <div key={pick.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"0.75rem",display:"flex",gap:"0.65rem",alignItems:"flex-start"}}>
            <div style={{width:"44px",height:"44px",flexShrink:0,borderRadius:"0.4rem",overflow:"hidden",background:"#fff",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {pick.image?<img src={pick.image} style={{width:"100%",height:"100%",objectFit:"contain",padding:"3px"}} alt=""/>:<span style={{fontSize:"1rem"}}>📦</span>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pick.productName}</div>
              <div style={{fontSize:"0.65rem",color:T.textLight,marginBottom:"0.4rem"}}>{pick.brand} · Pore {pick.poreScore||0}/5</div>
              <select value={pick.founderName||"McKenzie"} onChange={e=>updateFounder(pick.id,e.target.value)}
                style={{fontSize:"0.68rem",padding:"0.2rem 0.4rem",borderRadius:"0.3rem",border:`1px solid ${T.border}`,background:T.surface,color:T.textMid,marginBottom:"0.35rem",fontFamily:"'Inter',sans-serif"}}>
                <option>McKenzie</option>
                <option>Morgan</option>
              </select>
              <input value={pick.note||""} onChange={e=>updateNote(pick.id,e.target.value)}
                placeholder="Add a short note (e.g. 'My go-to SPF')"
                style={{width:"100%",padding:"0.35rem 0.55rem",borderRadius:"0.4rem",border:`1px solid ${T.border}`,fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.bg,outline:"none",boxSizing:"border-box"}}/>
            </div>
            <button onClick={()=>remove(pick.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.rose,padding:"0.2rem",flexShrink:0}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// Legacy alias — existing code still uses WhatWereLovingSection in ShopPage
function WhatWereLovingSection({onTap, friendScans={}}) {
  return <FounderPicksSection onTap={onTap} friendScans={friendScans}/>;
}

// ── FriendsUsingSection — "What Your Friends Are Using" on Explore ──
const MOCK_FRIEND_PRODUCTS = [];

function FriendsUsingSection({ friendScans, products, onTap, profile }) {
  // Build list from real friendScans if available, else use mock
  const friendProducts = React.useMemo(() => {
    const entries = Object.entries(friendScans || {});
    if (entries.length >= 1) {
      const productMap = {};
      products.forEach(p => { productMap[(p.productName||"").toLowerCase().trim()] = p; });
      return entries
        .filter(([, friends]) => friends.length >= 1)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 6)
        .map(([key, friends]) => {
          const p = productMap[key];
          if (!p) return null;
          const img = (p.adminImage||p.image||"").trim();
          if (!img || !img.startsWith("http")) return null;
          return { ...p, friends };
        })
        .filter(Boolean);
    }
    return [];
  }, [friendScans, products]);

  if (!friendProducts.length) return null;

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: "0.75rem", fontFamily: "'Inter',sans-serif" }}>
        What your friends are using
      </div>
      <div style={{ display: "flex", gap: "0.75rem", overflowX: "auto", paddingBottom: "0.5rem", scrollbarWidth: "none" }}>
        {friendProducts.map((p, i) => {
          const score = p.poreScore ?? 0;
          const ps = poreStyle(score);
          const friendNames = p.friends || [];
          const label = friendNames.length === 1
            ? `${friendNames[0].displayName.split(" ")[0]} uses this`
            : friendNames.length === 2
              ? `${friendNames[0].displayName.split(" ")[0]} & ${friendNames[1].displayName.split(" ")[0]} use this`
              : `${friendNames[0].displayName.split(" ")[0]}, ${friendNames[1].displayName.split(" ")[0]} & ${friendNames.length - 2} more`;

          return (
            <button key={i} onClick={() => onTap(p)}
              style={{ flexShrink: 0, width: "148px", background: T.surface, borderRadius: "1.1rem", border: `1px solid ${T.border}`, padding: 0, cursor: "pointer", textAlign: "left", overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
              {/* Product image */}
              <div style={{ position: "relative", background: T.surfaceAlt, height: "120px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {(p.adminImage || p.image || null) ? (
                  <img
                    src={p.adminImage || p.image || null}
                    alt={p.productName}
                    style={{ width: "80px", height: "80px", objectFit: "contain", mixBlendMode: "multiply" }}
                    onError={e => { e.target.style.display="none"; }}
                  />
                ) : (
                  <div style={{ fontSize: "1.4rem", fontWeight: "800", color: T.textLight, opacity: 0.3 }}>{(p.brand||"?").slice(0,2).toUpperCase()}</div>
                )}
                {/* Pore clog score badge */}
                <div style={{ position: "absolute", top: "0.5rem", right: "0.5rem", background: ps.color, borderRadius: "0.5rem", padding: "2px 6px", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "0.55rem", fontWeight: "700", color: "#fff", lineHeight: 1 }}>PORE</span>
                  <span style={{ fontSize: "0.75rem", fontWeight: "800", color: "#fff", lineHeight: 1.1 }}>{score}<span style={{ fontSize: "0.5rem" }}>/5</span></span>
                </div>
              </div>
              {/* Info */}
              <div style={{ padding: "0.6rem 0.65rem 0.7rem" }}>
                <div style={{ fontSize: "0.55rem", fontWeight: "700", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "2px" }}>{p.brand}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: "700", color: T.text, fontFamily: "'Inter',sans-serif", lineHeight: 1.3, marginBottom: "0.45rem", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.productName}</div>
                {/* Friend avatars + label */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <div style={{ display: "flex" }}>
                    {friendNames.slice(0, 3).map((f, j) => (
                      <div key={j} style={{ width: "18px", height: "18px", borderRadius: "50%", border: `1.5px solid ${T.surface}`, marginLeft: j > 0 ? "-5px" : "0", background: T.accent, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        {f.photoURL
                          ? <img src={f.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                          : <span style={{ fontSize: "0.38rem", fontWeight: "700", color: "#fff" }}>{(f.displayName||"?")[0]}</span>
                        }
                      </div>
                    ))}
                  </div>
                  <span style={{ fontSize: "0.58rem", color: T.textLight, fontFamily: "'Inter',sans-serif", lineHeight: 1.2 }}>{label}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ShopPage({user, profile, onUpdateProfile}) {
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [activeCat, setActiveCat]   = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [brandFilter, setBrandFilter] = useState(null);
  const [expandedCats, setExpandedCats] = useState(new Set());
  const [friendScans, setFriendScans] = useState({}); // productId -> [{displayName, photoURL}]
  const [searchQuery, setSearchQuery] = useState("");
  const [requestSent, setRequestSent] = useState("");

  async function openProductFromPost(post) {
    try {
      const q = query(collection(db,"products"), where("productName","==", post.productName||post.name||""), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const p = {id:snap.docs[0].id, ...snap.docs[0].data()};
        const ingA = (p.ingredients||"").trim();
        const ingB = (post.ingredients||"").trim();
        const ing = ingA.length >= ingB.length ? (ingA||ingB) : (ingB||ingA);
        const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
        setSelectedProduct({ productName: p.productName||post.productName, brand: p.brand||post.brand, image: p.adminImage||p.image||post.productImage||post.image||"", poreScore: liveScore ?? p.poreScore ?? post.poreScore ?? 0, communityRating: p.communityRating||post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: p.buyUrl||post.buyUrl||amazonUrl(p.productName||post.productName, p.brand||post.brand, p.barcode||post.barcode, p.asin||post.asin, p.buyUrl||post.buyUrl) });
        return;
      }
    } catch(e) {}
    const pName = post.productName||post.name||"";
    const ing = (post.ingredients||"").trim();
    const liveScore = ing.length > 10 ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : (r.poreCloggers?.length ? 1 : 0); })() : null;
    setSelectedProduct({ productName: pName, brand: post.brand, image: post.adminImage||post.image||post.productImage||"", poreScore: liveScore ?? post.poreScore ?? 0, communityRating: post.communityRating, ingredients: ing, flaggedIngredients: ing ? analyzeIngredients(ing).found : [], buyUrl: post.buyUrl||amazonUrl(pName, post.brand, post.barcode, post.asin, post.buyUrl) });
  }

  useEffect(()=>{
    getShopProducts().then(ps=>{
      setProducts(ps);
      setLoading(false);
    });
    // Load friends' routines to show social proof on product cards
    async function loadFriendScans() {
      const following = profile?.following||[];
      if (!following.length) return;
      try {
        // Fetch user docs for everyone we follow (batch in chunks of 10)
        const chunks = [];
        for (let i=0; i<Math.min(following.length,30); i+=10)
          chunks.push(following.slice(i,i+10));
        const map = {};
        await Promise.all(chunks.map(async chunk => {
          const snap = await getDocs(query(collection(db,"users"), where("__name__","in",chunk)));
          snap.docs.forEach(d => {
            const u = d.data();
            const routine = u.routine||[];
            const displayName = u.displayName||"";
            const photoURL = u.photoURL||"";
            const uid = d.id;
            routine.forEach(productName => {
              if (!productName) return;
              const key = productName.toLowerCase().trim();
              if (!map[key]) map[key]=[];
              if (!map[key].find(f=>f.uid===uid))
                map[key].push({displayName,photoURL,uid,productName});
            });
          });
        }));
        setFriendScans(map);
      } catch(e) { console.error("friendScans",e); }
    }
    loadFriendScans();
  },[]);

  // Only show products with a verified real image, buy link, and ingredients
  function hasRealImage(p) {
    return hasValidImage(p);
  }
  const completeProducts = products.filter(p => {
    if (!p.approved) return false;
    if (!hasRealImage(p)) return false;
    if (!(p.buyUrl||"").trim().startsWith("http")) return false;
    if ((p.ingredients||"").trim().length <= 10) return false;
    const liveScore = (() => { const r = analyzeIngredients(p.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : (p.poreScore??99); })();
    return liveScore <= 1;
  });

  // Global top 100: rank by poreScore asc, communityRating desc, scanCount desc
  const rankedProducts = [...completeProducts].sort((a,b) =>
    (a.poreScore??99)-(b.poreScore??99) ||
    (b.communityRating||0)-(a.communityRating||0) ||
    (b.scanCount||0)-(a.scanCount||0)
  ).slice(0, 100);

  const filteredProducts = brandFilter
    ? rankedProducts.filter(p => (p.brand||"").toLowerCase() === brandFilter.toLowerCase())
    : rankedProducts;
  const grouped = {};
  filteredProducts.forEach(p=>{
    const cat = p.category||"other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });
  const categories = CAT_ORDER
    .filter(c => grouped[c]?.length > 0)
    .map(c => {
      const all = (grouped[c]||[]).filter(p=>{ const img=(p.adminImage||p.image||p.productImage||"").trim(); return img.startsWith("http"); }).sort((a,b)=>(a.poreScore??99)-(b.poreScore??99)||(b.scanCount||0)-(a.scanCount||0));
      const isExpanded = expandedCats.has(c) || activeCat === c;
      return {
        id: c,
        label: CAT_LABEL[c]||c,
        emoji: CAT_EMOJI[c]||"🛍",
        products: isExpanded ? all : all.slice(0, 5),
        total: all.length,
        isExpanded,
      };
    });

  const searchFiltered = searchQuery.trim().length > 1
    ? completeProducts.filter(p=>(p.productName+" "+p.brand).toLowerCase().includes(searchQuery.toLowerCase()))
    : null;
  const displayCats = searchFiltered
    ? [{id:"search",label:`Results for "${searchQuery}"`,emoji:"🔍",products:searchFiltered.slice(0,20),total:searchFiltered.length,isExpanded:true}]
    : activeCat ? categories.filter(c=>c.id===activeCat) : categories;

  if (loading) return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"3rem 1rem",textAlign:"center"}}>
      <div style={{width:"24px",height:"24px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite",margin:"0 auto 0.75rem"}}/>
      <div style={{color:T.textLight,fontSize:"0.82rem"}}>Loading…</div>
    </div>
  );

  async function requestProduct(name) {
    if (requestSent === name) return; // already triggered
    setRequestSent(name + "_loading");
    try {
      // Check if already exists as pending
      const existing = await getDocs(query(
        collection(db, "products"),
        where("productName", "==", name.trim())
      ));
      if (!existing.empty) { setRequestSent(name); return; }

      // Search OBF for product data
      let productData = { productName: name.trim(), brand: "", barcode: "", ingredients: "" };
      try {
        const q = encodeURIComponent(name.trim());
        const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,code,ingredients_text,ingredients_text_en`, { signal: AbortSignal.timeout(5000) });
        const d = await r.json();
        const hit = (d.products||[])[0];
        if (hit) {
          productData.productName = hit.product_name || name.trim();
          productData.brand = hit.brands?.split(",")[0]?.trim() || "";
          productData.barcode = hit.code || "";
          productData.ingredients = hit.ingredients_text_en || hit.ingredients_text || "";
        }
      } catch {}

      // Calculate pore clog score if we have ingredients
      let poreScore = 0;
      if (productData.ingredients) {
        try {
          const a = analyzeIngredients(productData.ingredients);
          if (a?.avgScore != null) poreScore = Math.round(a.avgScore);
        } catch {}
      }

      // Auto-create as pending product — bot will fill image overnight
      await addDoc(collection(db, "products"), {
        productName: productData.productName,
        brand: productData.brand,
        barcode: productData.barcode,
        ingredients: productData.ingredients,
        poreScore,
        image: "",
        adminImage: "",
        approved: false,
        hidden: false,
        source: "user_request",
        requestedBy: user?.uid || "anon",
        scanCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: Date.now(),
      });

      setRequestSent(name);
    } catch(e) { console.error(e); setRequestSent(""); }
  }

  if (!products.length) return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"3rem 1rem",textAlign:"center",color:T.textLight}}>
      <div style={{fontSize:"2rem",marginBottom:"0.75rem"}}>🛍</div>
      <div style={{fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.4rem"}}>No products yet</div>
      <div style={{fontSize:"0.8rem"}}>Ask an admin to seed the product catalog.</div>
    </div>
  );

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",paddingBottom:"6rem"}}>
      <div style={{padding:"0.85rem 1rem 0"}}>

      {/* Brand of the Week */}
      <BrandOfTheWeek onBrandTap={b=>{
        setBrandFilter(b);
        setActiveCat(null);
        setTimeout(()=>{
          const el = document.getElementById("shop-products-list");
          if (el) el.scrollIntoView({behavior:"smooth", block:"start"});
        }, 100);
      }}/>

      {/* What We're Loving */}
      <WhatWereLovingSection friendScans={friendScans} onTap={openProductFromPost}/>

      {/* Brand filter banner */}
      <div id="shop-products-list"/>
      {brandFilter && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0.5rem 0.75rem",background:T.navy,borderRadius:"0.65rem",marginBottom:"0.75rem"}}>
          <span style={{fontSize:"0.72rem",color:"#fff",fontFamily:"'Inter',sans-serif",fontWeight:"500"}}>
            Showing: <strong>{brandFilter}</strong>
          </span>
          <button onClick={()=>setBrandFilter(null)} style={{background:"none",border:"none",color:T.iceBlue,cursor:"pointer",fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",padding:"0"}}>
            Clear ✕
          </button>
        </div>
      )}


      {/* Search + request */}
      <div style={{position:"relative",marginBottom:"0.75rem"}}>
        <input
          value={searchQuery}
          onChange={e=>{ setSearchQuery(e.target.value); setRequestSent(""); }}
          placeholder="Search products…"
          style={{width:"100%",padding:"0.65rem 1rem 0.65rem 2.2rem",borderRadius:"0.75rem",border:`1px solid ${T.border}`,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none",boxSizing:"border-box"}}
        />
        <svg style={{position:"absolute",left:"0.75rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        {searchQuery&&<button onClick={()=>setSearchQuery("")} style={{position:"absolute",right:"0.75rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textLight,fontSize:"1rem",padding:0,lineHeight:1}}>×</button>}
      </div>
      {searchQuery.trim().length>1&&completeProducts.filter(p=>(p.productName+" "+p.brand).toLowerCase().includes(searchQuery.toLowerCase())).length===0&&(
        <div style={{background:T.surfaceAlt,borderRadius:"0.75rem",padding:"0.9rem 1rem",marginBottom:"0.75rem",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.75rem"}}
          ref={el => { if (el && requestSent !== searchQuery.trim() && requestSent !== searchQuery.trim()+"_loading") requestProduct(searchQuery.trim()); }}>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.78rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>
              No results for <strong>"{searchQuery}"</strong>
            </div>
            <div style={{fontSize:"0.68rem",color:T.textLight,marginTop:"2px"}}>
              {requestSent === searchQuery.trim()+"_loading"
                ? "Adding to our database…"
                : requestSent === searchQuery.trim()
                ? "✓ Added — we'll find an image overnight"
                : "Searching database…"
              }
            </div>
          </div>
          <div style={{fontSize:"1.2rem"}}>
            {requestSent === searchQuery.trim() ? "✓" : "⏳"}
          </div>
        </div>
      )}

      {/* Category filter pills */}
      <div style={{display:"flex",gap:"0.4rem",overflowX:"auto",paddingBottom:"0.5rem",marginBottom:"1rem",scrollbarWidth:"none"}}>
        <button onClick={()=>setActiveCat(null)}
          style={{padding:"0.3rem 0.9rem",borderRadius:"999px",border:`1px solid ${!activeCat?T.navy:T.border}`,background:!activeCat?T.navy:"transparent",color:!activeCat?"#FFFFFF":T.textMid,fontSize:"0.68rem",fontWeight:"500",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif",flexShrink:0,letterSpacing:"0.03em",transition:"all 0.15s"}}>
          All
        </button>
        {categories.map(cat=>(
          <button key={cat.id} onClick={()=>setActiveCat(activeCat===cat.id?null:cat.id)}
            style={{padding:"0.3rem 0.9rem",borderRadius:"999px",border:`1px solid ${activeCat===cat.id?T.navy:T.border}`,background:activeCat===cat.id?T.navy:"transparent",color:activeCat===cat.id?"#FFFFFF":T.textMid,fontSize:"0.68rem",fontWeight:"500",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'Inter',sans-serif",flexShrink:0,letterSpacing:"0.03em",transition:"all 0.15s"}}>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Sephora-style horizontal shelves */}
      {displayCats.map(cat=>(
        <div key={cat.id} style={{marginBottom:"2rem"}}>
          {/* Shelf header */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.85rem",paddingRight:"0.25rem"}}>
            <div>
              <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1rem",color:T.text,letterSpacing:"-0.02em"}}>{cat.label}</div>
              <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"1px"}}>{cat.total} products · sorted by pore safety</div>
            </div>
            <button onClick={()=>setActiveCat(activeCat===cat.id?null:cat.id)}
              style={{fontSize:"0.68rem",color:T.accent,background:"none",border:`1px solid ${T.accent}33`,borderRadius:"999px",padding:"0.25rem 0.75rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600",whiteSpace:"nowrap"}}>
              {activeCat===cat.id?"↑ Less":"See all →"}
            </button>
          </div>

          {/* Horizontal scroll shelf */}
          <div style={{display:"flex",gap:"0.7rem",overflowX:"auto",paddingBottom:"0.75rem",scrollbarWidth:"none",WebkitOverflowScrolling:"touch",marginLeft:"-1rem",paddingLeft:"1rem",marginRight:"-1rem",paddingRight:"1rem"}}>
            {cat.products.map((p,i)=>{
              const liveCardScore = (p.ingredients && p.ingredients.trim().length >= 10) ? (() => { const r = analyzeIngredients(p.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : null; })() : null;
              const ps = poreStyle(liveCardScore??0);
              const img = (p.adminImage||p.image||"").trim();
              const friends = getFriendRoutineUsers(friendScans, p.productName, p.id);
              return (
                <button key={p.id} onClick={()=>setSelectedProduct(p)}
                  style={{flexShrink:0,width:"148px",background:T.surface,borderRadius:"1.1rem",border:`1px solid ${T.border}`,padding:0,cursor:"pointer",textAlign:"left",overflow:"hidden",transition:"all 0.18s",display:"flex",flexDirection:"column",boxShadow:"0 1px 6px rgba(17,24,39,0.04)"}}
                  onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 8px 24px rgba(17,24,39,0.12)`;e.currentTarget.style.borderColor=T.accent;}}
                  onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 1px 6px rgba(17,24,39,0.04)";e.currentTarget.style.borderColor=T.border;}}>

                  {/* Big image area */}
                  <div style={{width:"100%",height:"148px",background:"#ffffff",position:"relative",overflow:"hidden"}}>
                    {img
                      ? <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"12px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.opacity="0"}/>
                      : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center"}}>
                          <div style={{width:"44px",height:"44px",borderRadius:"50%",background:T.accent+"18",display:"flex",alignItems:"center",justifyContent:"center"}}>
                            <span style={{fontSize:"1rem",fontWeight:"800",color:T.accent}}>{(p.brand||"?")[0].toUpperCase()}</span>
                          </div>
                        </div>
                    }
                    {/* Pore badge — top right, only when we have real data */}
                    {liveCardScore != null && (
                      <div style={{position:"absolute",top:"7px",right:"7px",background:ps.color,borderRadius:"0.45rem",padding:"3px 6px",boxShadow:"0 1px 4px rgba(0,0,0,0.15)"}}>
                        <div style={{fontSize:"0.7rem",fontWeight:"800",color:"#fff",lineHeight:1}}>{liveCardScore}<span style={{fontSize:"0.42rem",opacity:0.85}}>/5</span></div>
                      </div>
                    )}
                    {/* Rank — top left */}
                    {i<3&&<div style={{position:"absolute",top:"6px",left:"6px",background:"rgba(17,24,39,0.65)",backdropFilter:"blur(4px)",borderRadius:"999px",padding:"2px 6px"}}>
                      <span style={{fontSize:"0.5rem",fontWeight:"700",color:"#fff",letterSpacing:"0.03em",fontFamily:"'Inter',sans-serif"}}>{i===0?"#1":i===1?"#2":"#3"}</span>
                    </div>}
                    {/* Friend routine pill */}
                    <FriendRoutinePill friends={friends}/>
                  </div>

                  {/* Info below image */}
                  <div style={{padding:"0.6rem 0.7rem 0.75rem",flex:1,display:"flex",flexDirection:"column",gap:"2px",borderTop:`1px solid ${T.border}`}}>
                    {p.brand&&<div style={{fontSize:"0.52rem",color:T.accent,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.07em",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand}</div>}
                    <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",lineHeight:1.25,display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",minHeight:"2.4em"}}>{p.productName}</div>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:"4px"}}>
                      <span style={{fontSize:"0.58rem",fontWeight:"600",color:ps.color,background:ps.color+"12",padding:"2px 6px",borderRadius:"999px"}}>{ps.label}</span>
                      {p.buyUrl&&(
                        <a href={p.buyUrl} target="_blank" rel="noopener noreferrer" onClick={e=>{e.stopPropagation();trackProductClick(p.id||null,p.productName||"");}}
                          style={{fontSize:"0.6rem",color:T.accent,textDecoration:"none",fontWeight:"700"}}>Shop →</a>
                      )}
                    </div>
                    {p.scanCount>0&&<div style={{fontSize:"0.55rem",color:"#6366f1",fontWeight:"600",marginTop:"1px"}}>🔥 {p.scanCount} scans</div>}
                    {(()=>{
                      const fr = getFriendRoutineUsers(friendScans, p.productName, p.id);
                      if (fr.length > 0) return null; // pill on image already handles this
                      const st = profile?.skinType;
                      const skinLabel = Array.isArray(st) ? st[0] : st;
                      if (skinLabel && p.skinTypes?.some(s=>s.toLowerCase().includes(skinLabel.toLowerCase()))) {
                        return <div style={{fontSize:"0.55rem",color:"#6366f1",fontWeight:"600",marginTop:"1px"}}>✨ Popular with {skinLabel.toLowerCase()} skin</div>;
                      }
                      if ((p.communityRating||0) >= 8 && (p.ratingCount||p.scanCount||0) >= 3) return <div style={{fontSize:"0.55rem",color:T.rose,fontWeight:"600",marginTop:"1px"}}>⭐ Top rated this week</div>;
                      return null;
                    })()}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {selectedProduct&&(
        <ProductModal
          product={{
            productName: selectedProduct.productName,
            brand: selectedProduct.brand,
            image: selectedProduct.image,
            barcode: selectedProduct.barcode||selectedProduct.id,
            ingredients: selectedProduct.ingredients||"",
            poreScore: selectedProduct.poreScore??0,
            flaggedIngredients: selectedProduct.ingredients ? analyzeIngredients(selectedProduct.ingredients).found : [],
            communityRating: selectedProduct.communityRating||null,
            buyUrl: selectedProduct.buyUrl||"",
          }}
          onClose={()=>setSelectedProduct(null)}
          user={user}
          profile={profile}
          onUpdateProfile={onUpdateProfile}
        />
      )}
      </div>
    </div>
  );
}


function ShopImageCell({p}) {
  const [status, setStatus] = useState("loading"); // loading | loaded | failed
  const [imgSrc, setImgSrc] = useState(p.adminImage||p.image||"");

  // Sync if product data changes (cache refresh)
  React.useEffect(() => {
    const newSrc = p.adminImage||p.image||"";
    if (newSrc !== imgSrc) { setImgSrc(newSrc); setStatus("loading"); }
  }, [p.adminImage, p.image]);
  const bc = BRAND_COLORS[p.brand] || {bg:"#F5F5F5", accent:"#555", text:"#333"};
  const initials = (p.brand||"").split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  const words = (p.productName||"").split(" ");
  const shortLabel = words.slice(0,3).join(" ");

  const showFallback = !imgSrc || status==="failed";
  const showImg = !!imgSrc && status!=="failed";

  function handleError() {
    // OBF revision fallback: try rev 1-6 then give up
    const revMatch = imgSrc.match(/front_en\.(\d+)\.400\.jpg/);
    if (revMatch) {
      const nextRev = parseInt(revMatch[1]) + 1;
      if (nextRev <= 6) {
        setImgSrc(imgSrc.replace(`front_en.${revMatch[1]}.400.jpg`, `front_en.${nextRev}.400.jpg`));
        return;
      }
    }
    setStatus("failed");
  }

  return (
    <div style={{width:"100%",height:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"center"}}>
      {showImg&&(
        <img src={imgSrc} alt={p.productName}
          style={{width:"82%",height:"82%",objectFit:"contain",display:status==="loaded"?"block":"none",position:"relative",zIndex:2,mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}}
          onLoad={()=>setStatus("loaded")}
          onError={handleError}/>
      )}
      {/* Fallback shown while loading or on error */}
      {(showFallback || status==="loading")&&(
        <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",flexDirection:"column",
          alignItems:"center",justifyContent:"center",gap:"5px",padding:"12px",
          opacity: status==="loaded" ? 0 : 1, transition:"opacity 0.2s"}}>
          <div style={{width:"42px",height:"42px",borderRadius:"50%",background:bc.accent,
            display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
            <span style={{fontSize:"0.95rem",fontWeight:"800",color:"#fff",letterSpacing:"-0.02em"}}>{initials}</span>
          </div>
          <span style={{fontSize:"0.46rem",fontWeight:"700",color:bc.text,textTransform:"uppercase",
            letterSpacing:"0.07em",textAlign:"center",lineHeight:1.35,maxWidth:"72px"}}>{shortLabel}</span>
        </div>
      )}
    </div>
  );
}

function ShopCard({p, onTap, currentUid}) {
  const ps = poreStyle(p.poreScore||0);
  const bc = BRAND_COLORS[p.brand] || {bg:"#F5F5F5", accent:"#444", text:"#222"};
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <>
    <button onClick={onTap}
      style={{width:"100%",background:T.surface,borderRadius:"0.75rem",border:`1px solid ${T.border}`,
        padding:0,cursor:"pointer",textAlign:"left",display:"flex",flexDirection:"column",
        overflow:"hidden",transition:"transform 0.15s,box-shadow 0.15s",boxShadow:"0 1px 4px rgba(0,0,0,0.04)"}}
      onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.1)";}}
      onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";}}>
      {/* Image area — tall with brand gradient bg */}
      <div style={{width:"100%",aspectRatio:"4/5",background:`linear-gradient(160deg, ${bc.bg} 0%, ${bc.accent}14 100%)`,
        display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden",position:"relative"}}>
        <ShopImageCell p={p}/>
        {/* Score badge top-right */}
        <div style={{position:"absolute",top:"8px",right:"8px",background:"rgba(255,255,255,0.92)",
          backdropFilter:"blur(4px)",borderRadius:"999px",padding:"0.18rem 0.5rem",
          fontSize:"0.6rem",fontWeight:"700",color:ps.color,border:`1px solid ${ps.color}22`}}>
          {p.poreScore}/5
        </div>
      </div>
      {/* Info */}
      <div style={{padding:"0.7rem 0.75rem 0.8rem",borderTop:`1px solid ${T.border}`}}>
        <div style={{fontSize:"0.52rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",
          letterSpacing:"0.08em",marginBottom:"0.2rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.brand}</div>
        <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text,lineHeight:1.3,
          display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",overflow:"hidden",
          marginBottom:"0.45rem",minHeight:"2em"}}>{p.productName}</div>
        {p.scanCount>0 && p.communityRating
          ? <span style={{fontSize:"0.6rem",padding:"0.15rem 0.45rem",background:T.sage+"14",color:T.sage,borderRadius:"999px",fontWeight:"600"}}>
              ★ {p.communityRating}/10 Rallier · {p.scanCount} {p.scanCount===1?"check":"checks"}
            </span>
          : null
        }
        {currentUid&&(
          <button onClick={e=>{e.stopPropagation();setShareOpen(true);}} style={{marginTop:"0.5rem",display:"flex",alignItems:"center",gap:"0.35rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"999px",padding:"0.2rem 0.6rem",cursor:"pointer",color:T.textLight,fontSize:"0.62rem",fontFamily:"'Inter',sans-serif",fontWeight:"500"}}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Share
          </button>
        )}
      </div>
    </button>
    {shareOpen&&<ShareProductModal user={{uid:currentUid}} product={p} onClose={()=>setShareOpen(false)}/>}
    </>
  );
}


// ── Ingredient Glossary ───────────────────────────────────────
function GlossaryPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [liveResult, setLiveResult] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const searchTimer = useRef(null);

  const allIngredients = Object.entries(INGDB).map(([name, data])=>({
    name, ...data, ...(INGDB_META[name]||{})
  }));

  const categories = ["all", "Irritant", ...new Set(allIngredients.map(i=>i.category).filter(c=>c&&c!=="Irritant"))];

  const filtered = allIngredients.filter(ing=>{
    const matchSearch = !search || ing.name.toLowerCase().includes(search.toLowerCase()) ||
      (ing.aliases||[]).some(a=>a.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filter==="all" || ing.category===filter;
    return matchSearch && matchCat;
  }).sort((a,b)=>a.name.localeCompare(b.name));

  // Live OBF lookup when local results are empty
  useEffect(()=>{
    if (!search.trim() || filtered.length > 0) { setLiveResult(null); return; }
    clearTimeout(searchTimer.current);
    setLiveLoading(true);
    searchTimer.current = setTimeout(async ()=>{
      try {
        const r = await fetch(`https://world.openbeautyfacts.org/api/v2/ingredients?search_terms=${encodeURIComponent(search)}&fields=id,name,vegan,vegetarian,from_palm_oil,description&page_size=5`);
        const d = await r.json();
        if (d.ingredients?.length > 0) {
          setLiveResult(d.ingredients.map(i=>({
            name: i.name || i.id?.replace(/-/g," ") || search,
            id: i.id,
            description: i.description || null,
            vegan: i.vegan,
            vegetarian: i.vegetarian,
            fromPalmOil: i.from_palm_oil,
            score: null, // unknown pore clog score
            isLive: true,
          })));
        } else {
          setLiveResult([]);
        }
      } catch { setLiveResult([]); }
      setLiveLoading(false);
    }, 500);
    return ()=>clearTimeout(searchTimer.current);
  },[search, filtered.length]);

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"1rem 1rem 6rem"}}>
      <div style={{marginBottom:"1rem"}}>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1.1rem",color:T.text,letterSpacing:"-0.02em",marginBottom:"0.2rem"}}>Ingredient Glossary</div>
        <div style={{fontSize:"0.75rem",color:T.textLight}}>Tap any ingredient to learn more</div>
      </div>

      {/* Search */}
      <div style={{position:"relative",marginBottom:"0.75rem"}}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{position:"absolute",left:"0.75rem",top:"50%",transform:"translateY(-50%)"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ingredients…"
          style={{width:"100%",padding:"0.65rem 0.75rem 0.65rem 2.25rem",borderRadius:"2rem",border:`1px solid ${T.border}`,fontSize:"0.85rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
      </div>



      {/* Category filter pills */}
      <div style={{display:"flex",gap:"0.4rem",overflowX:"auto",paddingBottom:"0.5rem",marginBottom:"1rem",scrollbarWidth:"none"}}>
        {categories.map(cat=>(
          <button key={cat} onClick={()=>setFilter(cat)}
            style={{flexShrink:0,padding:"0.3rem 0.75rem",borderRadius:"999px",border:`1px solid ${filter===cat?T.accent:T.border}`,background:filter===cat?T.accent:"transparent",color:filter===cat?"#FFFFFF":T.textMid,fontSize:"0.72rem",fontWeight:"500",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s",whiteSpace:"nowrap"}}>
            {cat==="all"?"All":cat==="Irritant"?"⚠ Irritants":cat}
          </button>
        ))}
      </div>

      {/* Ingredients list */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
        {filtered.map(ing=>{
          const ps = poreStyle(ing.score);
          return (
            <button key={ing.name} onClick={()=>setSelected(selected?.name===ing.name?null:ing)}
              style={{background:T.surface,border:`1px solid ${selected?.name===ing.name?T.accent:T.border}`,borderRadius:"0.85rem",padding:"0.75rem 1rem",textAlign:"left",cursor:"pointer",width:"100%",transition:"all 0.15s"}}
              onMouseEnter={e=>{if(selected?.name!==ing.name)e.currentTarget.style.borderColor=T.accent+"88";}}
              onMouseLeave={e=>{if(selected?.name!==ing.name)e.currentTarget.style.borderColor=T.border;}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
                    <span style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",textTransform:"capitalize"}}>{ing.name}</span>
                    {ing.category&&<span style={{fontSize:"0.6rem",color:T.textLight,background:T.surfaceAlt,padding:"0.1rem 0.4rem",borderRadius:"999px",border:`1px solid ${T.border}`}}>{ing.category}</span>}
                  </div>
                  {!(selected?.name===ing.name)&&ing.benefit&&<div style={{fontSize:"0.72rem",color:T.textLight,marginTop:"2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ing.benefit}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"0.5rem",flexShrink:0,marginLeft:"0.5rem"}}>
                  <div style={{padding:"0.2rem 0.5rem",background:ps.color+"18",borderRadius:"0.35rem",border:`1px solid ${ps.color}30`}}>
                    <span style={{fontSize:"0.65rem",fontWeight:"700",color:ps.color,fontFamily:"'Inter',sans-serif"}}>{ing.score}/5</span>
                  </div>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{transform:selected?.name===ing.name?"rotate(90deg)":"none",transition:"transform 0.2s"}}><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              </div>
              {/* Expanded detail */}
              {selected?.name===ing.name&&(
                <div style={{marginTop:"0.75rem",paddingTop:"0.75rem",borderTop:`1px solid ${T.border}`,display:"flex",flexDirection:"column",gap:"0.6rem",animation:"fadeUp 0.18s ease"}}>
                  {/* Pore risk + irritant badges */}
                  <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                    <div style={{padding:"0.2rem 0.6rem",background:ps.color+"18",borderRadius:"999px",border:`1px solid ${ps.color}30`,display:"inline-flex",alignItems:"center",gap:"0.3rem"}}>
                      <span style={{fontSize:"0.6rem",fontWeight:"700",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.05em"}}>Pore risk</span>
                      <span style={{fontSize:"0.72rem",fontWeight:"800",color:ps.color}}>{ps.label} · {ing.score}/5</span>
                    </div>
                    {ing.irritant&&<div style={{padding:"0.2rem 0.6rem",background:T.amber+"18",borderRadius:"999px",border:`1px solid ${T.amber}30`,display:"inline-flex",alignItems:"center",gap:"0.3rem"}}>
                      <span style={{fontSize:"0.65rem",fontWeight:"700",color:T.amber}}>⚠ Potential irritant</span>
                    </div>}
                    {ing.score===0&&!ing.irritant&&<div style={{padding:"0.2rem 0.6rem",background:T.sage+"18",borderRadius:"999px",border:`1px solid ${T.sage}30`,display:"inline-flex",alignItems:"center",gap:"0.3rem"}}>
                      <span style={{fontSize:"0.65rem",fontWeight:"700",color:T.sage}}>✓ Generally safe</span>
                    </div>}
                  </div>
                  {/* Benefit */}
                  {ing.benefit&&(
                    <div>
                      <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.sage,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"3px"}}>What it does</div>
                      <div style={{fontSize:"0.78rem",color:T.text,lineHeight:1.55}}>{ing.benefit}</div>
                    </div>
                  )}
                  {/* Note / mechanism */}
                  {ing.note&&ing.note!==ing.benefit&&(
                    <div>
                      <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"3px"}}>Why it matters</div>
                      <div style={{fontSize:"0.75rem",color:T.textMid,lineHeight:1.55}}>{ing.note}</div>
                    </div>
                  )}
                  {/* Watch out */}
                  {ing.concern&&ing.concern!=="None known"&&(
                    <div style={{padding:"0.5rem 0.65rem",background:T.rose+"08",borderRadius:"0.5rem",border:`1px solid ${T.rose}20`}}>
                      <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.rose,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"3px"}}>Watch out</div>
                      <div style={{fontSize:"0.75rem",color:T.textMid,lineHeight:1.5}}>{ing.concern}</div>
                    </div>
                  )}
                  {/* Aliases */}
                  {(ing.aliases||[]).length>0&&(
                    <div>
                      <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textMid,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"3px"}}>Also listed as</div>
                      <div style={{fontSize:"0.72rem",color:T.textLight,lineHeight:1.5}}>{ing.aliases.join(" · ")}</div>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {/* Live OBF results when nothing found locally */}
      {filtered.length===0&&search.trim()&&(
        <div>
          {liveLoading&&(
            <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.82rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
              <div style={{width:"14px",height:"14px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>
              Looking up product...
            </div>
          )}
          {!liveLoading&&liveResult&&liveResult.length>0&&(
            <div>
              
              <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
                {liveResult.map((ing,i)=>(
                  <div key={i}
                    style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"0.85rem 1rem"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.4rem"}}>
                      <span style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",textTransform:"capitalize"}}>{ing.name}</span>
                      <span style={{fontSize:"0.65rem",color:T.textLight,background:T.surfaceAlt,padding:"0.15rem 0.5rem",borderRadius:"999px",border:`1px solid ${T.border}`}}>Not in local DB</span>
                    </div>
                    {ing.description&&<p style={{fontSize:"0.78rem",color:T.textMid,margin:"0 0 0.4rem",lineHeight:1.5}}>{ing.description}</p>}
                    <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
                      {ing.vegan==="yes"&&<span style={{fontSize:"0.62rem",padding:"0.15rem 0.5rem",background:T.sage+"15",color:T.sage,borderRadius:"999px",border:`1px solid ${T.sage}30`}}>Vegan</span>}
                      {ing.vegetarian==="yes"&&<span style={{fontSize:"0.62rem",padding:"0.15rem 0.5rem",background:T.sage+"15",color:T.sage,borderRadius:"999px",border:`1px solid ${T.sage}30`}}>Vegetarian</span>}
                      {ing.fromPalmOil==="yes"&&<span style={{fontSize:"0.62rem",padding:"0.15rem 0.5rem",background:T.amber+"15",color:T.amber,borderRadius:"999px",border:`1px solid ${T.amber}30`}}>Palm oil derived</span>}
                      <span style={{fontSize:"0.62rem",padding:"0.15rem 0.5rem",background:T.textLight+"15",color:T.textLight,borderRadius:"999px",border:`1px solid ${T.border}`}}>Pore clog score unknown</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!liveLoading&&liveResult&&liveResult.length===0&&(
            <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.82rem"}}>
              
              No results found for "{search}" — try a different spelling or the INCI name
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Notifications Page ────────────────────────────────────────

// ── NotifDropdown — compact bell panel ────────────────────────
function NotifDropdown({user, onUserTap}) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (!user) return;
    getNotifications(user.uid).then(n=>{ setNotifs(n); setLoading(false); });
  },[user]);

  function timeAgo(ts) {
    if (!ts) return "";
    const secs = Math.floor((Date.now()-(ts.seconds?ts.seconds*1000:ts))/1000);
    if (secs<60) return "just now";
    if (secs<3600) return `${Math.floor(secs/60)}m ago`;
    if (secs<86400) return `${Math.floor(secs/3600)}h ago`;
    return `${Math.floor(secs/86400)}d ago`;
  }

  function notifIcon(type) {
    if (type==="like")   return <div style={{width:"28px",height:"28px",borderRadius:"50%",background:T.rose+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill={T.rose} stroke={T.rose} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>;
    if (type==="follow") return <div style={{width:"28px",height:"28px",borderRadius:"50%",background:T.sage+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></div>;
    return <div style={{width:"28px",height:"28px",borderRadius:"50%",background:T.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>;
  }

  function notifText(n) {
    if (n.type==="like")   return <><strong>{n.fromName}</strong> liked your post</>;
    if (n.type==="follow") return <><strong>{n.fromName}</strong> followed you</>;
    if (n.type==="scan")   return <><strong>{n.fromName}</strong> checked {n.payload?.productName||"a product"}</>;
    return <><strong>{n.fromName}</strong> sent a notification</>;
  }

  return (
    <div>
      <div style={{padding:"0.85rem 1rem 0.6rem",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:"0.8rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>Notifications</span>
        {notifs.length>0&&<span style={{fontSize:"0.65rem",color:T.textLight}}>{notifs.length} total</span>}
      </div>
      <div style={{maxHeight:"320px",overflowY:"auto"}}>
        {loading&&(
          <div style={{padding:"1.5rem",textAlign:"center"}}>
            <div style={{width:"18px",height:"18px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite",margin:"0 auto"}}/>
          </div>
        )}
        {!loading&&notifs.length===0&&(
          <div style={{padding:"2rem 1rem",textAlign:"center",color:T.textLight,fontSize:"0.78rem"}}>
            <div style={{fontSize:"1.5rem",marginBottom:"0.5rem"}}>🔔</div>
            All caught up!
          </div>
        )}
        {!loading&&notifs.map(n=>(
          <div key={n.id}
            style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.75rem 1rem",borderBottom:`1px solid ${T.border}`,background:n.read?"transparent":T.accent+"06",cursor:n.fromUid?"pointer":"default",transition:"background 0.1s"}}
            onClick={()=>n.fromUid&&onUserTap(n.fromUid)}
            onMouseEnter={e=>e.currentTarget.style.background=T.surfaceAlt}
            onMouseLeave={e=>e.currentTarget.style.background=n.read?"transparent":T.accent+"06"}>
            {notifIcon(n.type)}
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:"0.75rem",color:T.text,lineHeight:1.4}}>{notifText(n)}</div>
              <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"2px"}}>{timeAgo(n.createdAt)}</div>
            </div>
            {!n.read&&<div style={{width:"6px",height:"6px",borderRadius:"50%",background:T.accent,flexShrink:0}}/>}
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsPage({user, onUserTap}) {
  const [notifs, setNotifs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    if (!user) return;
    getNotifications(user.uid).then(n=>{ setNotifs(n); setLoading(false); });
    markAllRead(user.uid);
  },[user]);

  function timeAgo(ts) {
    if (!ts) return "";
    const secs = Math.floor((Date.now() - (ts.seconds?ts.seconds*1000:ts))/1000);
    if (secs < 60)   return "just now";
    if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
    if (secs < 86400)return `${Math.floor(secs/3600)}h ago`;
    return `${Math.floor(secs/86400)}d ago`;
  }

  function notifIcon(type) {
    if (type==="like")   return <div style={{width:"32px",height:"32px",borderRadius:"50%",background:T.rose+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill={T.rose} stroke={T.rose} strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg></div>;
    if (type==="follow") return <div style={{width:"32px",height:"32px",borderRadius:"50%",background:T.sage+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.sage} strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg></div>;
    if (type==="scan")   return <div style={{width:"32px",height:"32px",borderRadius:"50%",background:T.amber+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.amber} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></div>;
    return <div style={{width:"32px",height:"32px",borderRadius:"50%",background:T.accent+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></div>;
  }

  function notifText(n) {
    if (n.type==="like")   return <><strong>{n.fromName}</strong> liked your post on <em>{n.payload?.productName||"a product"}</em></>;
    if (n.type==="follow") return <><strong>{n.fromName}</strong> started following you</>;
    if (n.type==="scan")   return <><strong>{n.fromName}</strong> also checked <em>{n.payload?.productName||"a product"}</em></>;
    return <><strong>{n.fromName}</strong> sent you a notification</>;
  }

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"1rem 1rem 6rem"}}>
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1.1rem",color:T.text,letterSpacing:"-0.02em",marginBottom:"0.2rem"}}>Notifications</div>
        <div style={{fontSize:"0.75rem",color:T.textLight}}>Likes, follows, and activity</div>
      </div>

      {loading&&(
        <div style={{display:"flex",flexDirection:"column",gap:"0.6rem"}}>
          {[1,2,3].map(i=><div key={i} style={{height:"60px",background:T.surface,borderRadius:"0.75rem",border:`1px solid ${T.border}`,opacity:0.6}}/>)}
        </div>
      )}

      {!loading&&notifs.length===0&&(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:T.textLight}}>
          
          <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"600",color:T.textMid,marginBottom:"0.4rem"}}>All caught up</div>
          <div style={{fontSize:"0.8rem"}}>Notifications for likes and follows will appear here</div>
        </div>
      )}

      {!loading&&notifs.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
          {notifs.map(n=>(
            <div key={n.id}
              style={{background:n.read?T.surface:T.accent+"08",border:`1px solid ${n.read?T.border:T.accent+"33"}`,borderRadius:"1rem",padding:"0.85rem",display:"flex",alignItems:"center",gap:"0.75rem",cursor:n.fromUid?"pointer":"default",transition:"all 0.15s"}}
              onClick={()=>n.fromUid&&onUserTap&&onUserTap(n.fromUid)}>
              {notifIcon(n.type)}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.8rem",color:T.text,lineHeight:1.4}}>{notifText(n)}</div>
                <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"2px"}}>{timeAgo(n.createdAt)}</div>
              </div>
              {!n.read&&<div style={{width:"7px",height:"7px",borderRadius:"50%",background:T.accent,flexShrink:0}}/>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ── Admin Dashboard ───────────────────────────────────────────
// Set your Firebase UID here to enable the admin tab
const ADMIN_UIDS = []; // add your UID here once you see it in Profile
const ADMIN_EMAILS = ["mckenzierichard77@gmail.com", "morganrichard777@gmail.com"];
function isAdmin(user) {
  return ADMIN_UIDS.includes(user?.uid) || ADMIN_EMAILS.includes(user?.email);
}


// ── Product catalog CRUD ──────────────────────────────────────
// All products live in products/{barcode} — single source of truth

async function getShopProducts() {
  // Auto-selects top 15 per category from all products that have image + ingredients + buyUrl
  // Ranked by: live pore clog score (lower = better) + Rallier score
  // No manual approval needed — just needs complete data
  try {
    const snap = await getDocs(collection(db,"products"));
    const CAT_LIMIT = 15;

    // Score and filter all candidates
    const candidates = snap.docs
      .map(d => {
        const p = {id:d.id,...d.data()};
        // Compute live pore clog score from ingredients
        if (p.ingredients && p.ingredients.trim().length > 10) {
          const live = analyzeIngredients(p.ingredients).avgScore;
          if (live != null) p.poreScore = Math.round(live);
        }
        return p;
      })
      .filter(p => {
        if (p.shopOverride) return true; // manual override always shows
        const ing = (p.ingredients||"").trim();
        const buy = (p.buyUrl||"").trim();
        if (!hasValidImage(p)) return false;
        if (ing.length <= 10) return false;
        if (!buy.startsWith("http")) return false;
        return true;
      });

    // Group by category, pick top 15 per category
    const grouped = {};
    candidates.forEach(p => {
      const cat = p.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });

    const selected = [];
    Object.values(grouped).forEach(arr => {
      const sorted = arr.sort((a,b) => { const d=(a.poreScore??99)-(b.poreScore??99); return d!==0?d:(b.communityRating||0)-(a.communityRating||0); });
      selected.push(...sorted.slice(0, CAT_LIMIT));
    });
    const seen=new Map(),deduped=[];
    for(const p of selected){const key=(p.productName||"").toLowerCase().replace(/[^a-z0-9]/g,"").trim();if(!key){deduped.push(p);continue;}if(!seen.has(key)){seen.set(key,p);deduped.push(p);}else{const ex=seen.get(key);if((p.scanCount||0)>(ex.scanCount||0)){deduped[deduped.indexOf(ex)]=p;seen.set(key,p);}}}
    return deduped;
  } catch { return []; }
}

async function getShopCandidates() {
  // Returns ALL products for admin review, grouped by category
  try {
    const snap = await getDocs(collection(db,"products"));
    const all = snap.docs.map(d=>({id:d.id,...d.data()}));
    const approvalMap = {};
    const grouped = {};
    all.forEach(p=>{
      approvalMap[p.id] = p;
      const cat = p.category || "other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(p);
    });
    // Sort each category by scanCount desc
    Object.values(grouped).forEach(arr=>arr.sort((a,b)=>(b.scanCount||0)-(a.scanCount||0)));
    return {grouped, approvalMap};
  } catch { return {grouped:{}, approvalMap:{}}; }
}

async function saveProductField(productId, updates) {
  // Strip undefined values — Firestore rejects them
  const clean = Object.fromEntries(Object.entries({...updates, updatedAt:serverTimestamp()}).filter(([,v]) => v !== undefined));
  await updateDoc(doc(db,"products",productId), clean);
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 183;

function needsReverification(product) {
  const lv = product.lastVerified || product.approvedAt || product.createdAt || 0;
  const ts = typeof lv === "object" && lv?.seconds ? lv.seconds * 1000 : lv;
  return Date.now() - ts > SIX_MONTHS_MS;
}

async function approveProduct(productId, approved) {
  await updateDoc(doc(db,"products",productId), {
    approved,
    approvedAt: approved ? serverTimestamp() : null,
    lastVerified: approved ? serverTimestamp() : null,
  });
}

// Legacy aliases — keep AdminShopManager working
const setShopApproval = approveProduct;
async function saveShopProductApproval(data, id=null) {
  if (id) {
    await setDoc(doc(db,"products",id), {...data, updatedAt:serverTimestamp()}, {merge:true});
    return id;
  } else {
    const newId = data.barcode || ("manual_" + Date.now());
    await setDoc(doc(db,"products",newId), {...data, createdAt:serverTimestamp()}, {merge:true});
    return newId;
  }
}


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

async function getAdminStats() {
  const [postsResult, usersResult, productsResult] = await Promise.allSettled([
    getDocs(query(collection(db,"posts"), orderBy("createdAt","desc"), limit(500))).catch(()=>
      getDocs(query(collection(db,"posts"), limit(500)))
    ),
    getDocs(collection(db,"users")),
    getDocs(collection(db,"products")),
  ]);
  const postsSnap   = postsResult.status==="fulfilled"   ? postsResult.value   : {docs:[]};
  const usersSnap   = usersResult.status==="fulfilled"   ? usersResult.value   : {docs:[]};
  const productsSnap= productsResult.status==="fulfilled"? productsResult.value: {docs:[],size:0};
  const totalProducts = productsSnap.size || productsSnap.docs.length;
  const approvedProducts = productsSnap.docs.filter(d=>d.data().approved).length;
  const posts = postsSnap.docs.map(d=>({id:d.id,...d.data()}));
  const users = usersSnap.docs.map(d=>({id:d.id,...d.data()}));

  // Product stats
  const productMap = {};
  posts.forEach(p=>{
    const key = `${p.brand||""} ${p.productName||""}`.trim().toLowerCase();
    if (!key) return;
    if (!productMap[key]) productMap[key] = {name:p.productName, brand:p.brand||"", scans:0, ratings:[], poreScores:[], likes:0};
    productMap[key].scans++;
    if (p.communityRating) productMap[key].ratings.push(p.communityRating);
    if (p.poreScore != null) productMap[key].poreScores.push(p.poreScore);
    productMap[key].likes += (p.likes||[]).length;
  });
  const products = Object.values(productMap)
    .map(p=>({...p,
      avgRating: p.ratings.length ? (p.ratings.reduce((a,b)=>a+b,0)/p.ratings.length).toFixed(1) : null,
      avgPore:   p.poreScores.length ? (p.poreScores.reduce((a,b)=>a+b,0)/p.poreScores.length).toFixed(1) : null,
    }))
    .sort((a,b)=>b.scans-a.scans);

  // Daily activity (last 14 days)
  const daily = {};
  const now = Date.now();
  for (let i=13; i>=0; i--) {
    const d = new Date(now - i*86400000);
    daily[d.toLocaleDateString("en-US",{month:"short",day:"numeric"})] = 0;
  }
  posts.forEach(p=>{
    if (!p.createdAt) return;
    const d = new Date(p.createdAt.seconds*1000);
    const key = d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    if (daily[key] != null) daily[key]++;
  });

  // Hourly activity (0-23)
  const hourly = Array(24).fill(0);
  posts.forEach(p => {
    if (!p.createdAt) return;
    const h = new Date(p.createdAt.seconds * 1000).getHours();
    hourly[h]++;
  });

  // Demographics from user profiles
  const skinTypeCounts = {};
  const concernCounts = {};
  const pronounCounts = {};
  let withSkinType = 0, withConcerns = 0, withPronoun = 0;
  users.forEach(u => {
    const types = Array.isArray(u.skinType) ? u.skinType : u.skinType ? [u.skinType] : [];
    if (types.length) { withSkinType++; types.forEach(t => { skinTypeCounts[t] = (skinTypeCounts[t]||0) + 1; }); }
    const concerns = Array.isArray(u.concerns) ? u.concerns : u.concerns ? [u.concerns] : [];
    if (concerns.length) { withConcerns++; concerns.forEach(c => { concernCounts[c] = (concernCounts[c]||0) + 1; }); }
    if (u.pronoun && u.pronoun !== "skip") { withPronoun++; pronounCounts[u.pronoun] = (pronounCounts[u.pronoun]||0) + 1; }
  });

  return {
    totalPosts: posts.length,
    totalUsers: users.length,
    totalLikes: posts.reduce((a,p)=>a+(p.likes||[]).length,0),
    avgRating: posts.filter(p=>p.communityRating).length
      ? (posts.filter(p=>p.communityRating).reduce((a,p)=>a+p.communityRating,0)/posts.filter(p=>p.communityRating).length).toFixed(1)
      : "—",
    topProducts: products.slice(0,20),
    daily: Object.entries(daily),
    recentPosts: posts.slice(0,10),
    hourly,
    skinTypeCounts,
    concernCounts,
    withSkinType,
    withConcerns,
    pronounCounts,
    withPronoun,
    totalUsersCount: users.length,
  };
}

// ── Admin: Manage Products (set imageUrl per product) ─────────
function obfImageUrl(barcode, rev=1) {
  if (!barcode) return null;
  const b = String(barcode).replace(/\D/g,"").padStart(13,"0");
  return `https://images.openbeautyfacts.org/images/products/${b.slice(0,3)}/${b.slice(3,6)}/${b.slice(6,9)}/${b.slice(9)}/front_en.${rev}.400.jpg`;
}

// ── Auto-fix Database ─────────────────────────────────────────
// ── Inline image picker for admin triage/edit ─────────────────
function ImagePicker({ brand, productName, currentImg, onSelect }) {
  const [query, setQuery] = React.useState(`${brand||""} ${productName||""}`.trim());
  const [results, setResults] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [searched, setSearched] = React.useState(false);
  const [pasteMode, setPasteMode] = React.useState(false);
  const [pasteUrl, setPasteUrl] = React.useState(currentImg||"");

  React.useEffect(() => { if(query) doSearch(query); }, []);

  async function doSearch(q) {
    if (!q.trim()) return;
    setLoading(true); setSearched(false);
    const results = []; const seen = new Set();

    // Search via Cloudflare Worker (Google Custom Search)
    try {
      const workerUrl = `https://raspy-math-6c02ralli-image-proxy.mckenzierichard77.workers.dev?q=${encodeURIComponent(q)}`;
      const r = await fetch(workerUrl, {signal:AbortSignal.timeout(8000)});
      const d = await r.json();
      if (d?.url && !seen.has(d.url)) {
        seen.add(d.url);
        results.push({url:d.url, label:d.source||"Google", source:d.source||"google"});
      }
    } catch {}

    setResults(results.slice(0,16)); setLoading(false); setSearched(true);
  }

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      <div style={{display:"flex",gap:"0.4rem"}}>
        <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();doSearch(query);}}}
          placeholder="Search for product image…"
          style={{flex:1,padding:"0.5rem 0.65rem",border:`1.5px solid ${T.border}`,borderRadius:"0.55rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.bg,color:T.text,outline:"none"}}/>
        <button onClick={()=>doSearch(query)} style={{padding:"0.5rem 0.75rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.78rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>{loading?"…":"🔍"}</button>
        <button onClick={()=>setPasteMode(v=>!v)} style={{padding:"0.5rem 0.65rem",background:pasteMode?T.accent+"22":T.surfaceAlt,color:pasteMode?T.accent:T.textMid,border:`1px solid ${pasteMode?T.accent+"44":T.border}`,borderRadius:"0.55rem",fontSize:"0.75rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>📋</button>
      </div>
      {pasteMode && (
        <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
          <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
            <input value={pasteUrl} onChange={e=>setPasteUrl(e.target.value)} placeholder="Paste image URL directly…" autoFocus
              style={{flex:1,padding:"0.5rem 0.65rem",border:`1.5px solid ${T.accent}44`,borderRadius:"0.55rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.bg,color:T.text,outline:"none"}}/>
            <button onClick={()=>{if(pasteUrl.trim()){onSelect(pasteUrl.trim());setPasteMode(false);}}}
              style={{padding:"0.5rem 0.75rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.75rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>Use</button>
          </div>
          {pasteUrl.trim() && (
            <div style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.4rem",background:T.surfaceAlt,borderRadius:"0.55rem",border:`1px solid ${T.border}`}}>
              <img src={pasteUrl.trim()} alt="preview" style={{width:"48px",height:"48px",objectFit:"contain",borderRadius:"0.35rem",background:"#fff",padding:"2px"}} onError={e=>{e.target.style.opacity="0.2";}}/>
              <span style={{fontSize:"0.68rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>Preview</span>
            </div>
          )}
        </div>
      )}
      {loading && <div style={{textAlign:"center",padding:"1.5rem",color:T.textLight,fontSize:"0.78rem"}}>Searching Sephora, ULTA, Amazon…</div>}
      {!loading && searched && results.length===0 && (
        <div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.78rem"}}>
          No images found — try a shorter search or paste a URL
          <div style={{marginTop:"0.5rem"}}><a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(query)}`} target="_blank" rel="noopener noreferrer" style={{fontSize:"0.72rem",color:T.accent,textDecoration:"none",fontWeight:"600"}}>🌐 Search Google Images →</a></div>
        </div>
      )}
      {!loading && results.length>0 && (
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.4rem"}}>
          {results.map((r,i) => (
            <button key={i} onClick={()=>onSelect(r.url)}
              style={{border:currentImg===r.url?`2.5px solid ${T.sage}`:`1.5px solid ${T.border}`,borderRadius:"0.55rem",background:T.surfaceAlt,cursor:"pointer",padding:0,aspectRatio:"1",overflow:"hidden",position:"relative",transition:"border-color 0.15s"}}>
              <img src={r.url} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"3px"}} onError={e=>{e.target.parentElement.style.opacity="0.3";}}/>
              {currentImg===r.url && <div style={{position:"absolute",top:"3px",right:"3px",width:"14px",height:"14px",borderRadius:"50%",background:T.sage,display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{fontSize:"9px",color:"#fff"}}>✓</span></div>}
              <div style={{position:"absolute",bottom:0,left:0,right:0,background:"rgba(0,0,0,0.5)",padding:"1px 3px"}}><span style={{fontSize:"0.45rem",color:"rgba(255,255,255,0.7)"}}>{r.source.toUpperCase()}</span></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Shared image-fetch helpers (used by AutoFixDatabase + AdminCleanup triage) ──

function AutoFixDatabase({ products, onRefresh, onOpenTriage, afRunning, afLog, afDone, setAfRunning, setAfLog, setAfDone, setAfProducts, afAddLog }) {
  const running = afRunning ?? false;
  const setRunning = setAfRunning ?? (()=>{});
  const log = afLog ?? [];
  const setLog = setAfLog ?? (()=>{});
  const done = afDone ?? false;
  const setDone = setAfDone ?? (()=>{});
  const [counts, setCounts] = useState({sephora:0, ulta:0, amazon:0, noImg:0});
  const [progress, setProgress] = useState({current:0, total:0});
  const [paused, setPaused] = useState(false);
  const pausedRef = React.useRef(false);
  function addLog(type, msg) { if(afAddLog) afAddLog(type, msg); }
  const noImg = products.filter(p => !hasValidImage(p)).length;

  // Validate an image URL actually loads
  async function validateImg(url) {
    if (!url || !url.startsWith("http")) return false;
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = url;
      setTimeout(() => resolve(false), 6000);
    });
  }

  // Claude web search — finds real product image URLs using web search
  async function tryClaude(p) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true"
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 400,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: "Find direct product image URLs for a skincare product from Sephora, Ulta, or the brand website. Return ONLY a JSON object with an array: {\"urls\": [\"https://...\", \"https://...\"]} — up to 4 direct image URLs (.jpg, .png, .webp). No explanation. No nulls in the array.",
          messages: [{ role: "user", content: `Find product image URLs for: ${p.brand} ${p.productName}` }]
        })
      });
      const data = await res.json();
      if (data.error) return null;
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json|```/g,"").trim();
      const match = text.match(/\{[\s\S]*?\}/);
      if (!match) return null;
      const result = JSON.parse(match[0]);
      // Return first valid URL for auto-fix, but also expose all for manual picker
      const urls = (result.urls||[result.url]).filter(u=>u&&u.startsWith("http"));
      for (const url of urls) {
        if (await validateImg(url)) return { img: url, urls, buyUrl: "", source: "Claude" };
      }
    } catch {}
    return null;
  }

  async function fixProduct(p) {
    // Try OBF only for real numeric barcodes (8-14 digits) — not seed_ fake IDs
    const barcode = p.barcode || "";
    const isRealBarcode = /^\d{8,14}$/.test(barcode);
    if (isRealBarcode) {
      try {
        const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${barcode}.json`, {signal:AbortSignal.timeout(6000)});
        const d = await r.json();
        const product = d?.product;
        // Verify it's actually the right product by checking brand/name match
        const obfName = (product?.product_name||"").toLowerCase();
        const obfBrand = (product?.brands||"").toLowerCase();
        const ourName = (p.productName||"").toLowerCase().split(" ")[0];
        const ourBrand = (p.brand||"").toLowerCase().split(" ")[0];
        const isMatch = product?.product_name && (
          obfName.includes(ourName) || obfBrand.includes(ourBrand)
        );
        if (isMatch) {
          const img = product.image_front_url || product.image_url || null;
          const ingredients = product.ingredients_text_en || product.ingredients_text || null;
          const validImg = img && await validateImg(img);
          if (validImg || ingredients) {
            return {
              img: validImg ? img : null,
              ingredients: ingredients ? ingredients.replace(/\n/g," ").trim() : null,
              buyUrl: "",
              source: "OBF"
            };
          }
        }
      } catch {}
    }
    // Fall back to Claude web search for image only
    return await tryClaude(p);
  }

  async function runFix() {
    setRunning(true); setLog([]); setDone(false); setPaused(false);
    pausedRef.current = false;
    if (setAfProducts) setAfProducts(products);
    let sepFixed=0, ultaFixed=0, amzFixed=0, stillMissing=0;
    const BATCH = 6;

    const queue = products.filter(p => !hasValidImage(p) || (!p.ingredients || p.ingredients.trim().length < 10));

    if (!queue.length) {
      addLog("info", "✓ All products already have images and ingredients!");
      setRunning(false); setDone(true); return;
    }

    const missingImg = queue.filter(p => !hasValidImage(p)).length;
    const missingIng = queue.filter(p => !p.ingredients || p.ingredients.trim().length < 10).length;
    setProgress({current:0, total:queue.length});
    addLog("info", `${queue.length} products need work: ${missingImg} missing images, ${missingIng} missing ingredients…`);

    for (let i = 0; i < queue.length; i += BATCH) {
      // Pause support — wait while paused
      while (pausedRef.current) {
        await new Promise(r => setTimeout(r, 500));
      }

      const batch = queue.slice(i, i + BATCH);
      const results = await Promise.allSettled(batch.map(fixProduct));

      for (let j = 0; j < results.length; j++) {
        const p = batch[j];
        setProgress(prev => ({...prev, current: Math.min(i + j + 1, queue.length)}));
        if (results[j].status !== "fulfilled" || !results[j].value) {
          addLog("x", `${p.brand||""} ${p.productName} — not found`);
          stillMissing++;
          continue;
        }
        const {img, ingredients, buyUrl, source} = results[j].value;
        try {
          const updates = { updatedAt: Date.now() };
          if (img) { updates.adminImage = img; updates.image = img; }
          if (buyUrl && !p.buyUrl) updates.buyUrl = buyUrl;
          if (ingredients && (!p.ingredients || p.ingredients.trim().length < 10)) {
            updates.ingredients = ingredients;
          }
          await updateDoc(doc(db, "products", p.id), updates);
          const gotImg = !!img;
          const gotIng = !!(ingredients && (!p.ingredients || p.ingredients.trim().length < 10));
          addLog("ok", `${p.brand||""} ${p.productName} — ✓ ${source}${gotImg?" img":""}${gotIng?" + ingredients":""}`);
          if (source==="Sephora") sepFixed++;
          else if (source==="ULTA") ultaFixed++;
          else amzFixed++;
        } catch(e) { addLog("error", `${p.productName} — save failed: ${e.message}`); stillMissing++; }
      }

      if (i + BATCH < queue.length) await new Promise(r => setTimeout(r, 300));
    }

    const total = sepFixed + ultaFixed + amzFixed;
    setCounts({sephora:sepFixed, ulta:ultaFixed, amazon:amzFixed, noImg:stillMissing});
    addLog("info", `Done! ${total} images added (${sepFixed} Sephora · ${ultaFixed} ULTA · ${amzFixed} Amazon). ${stillMissing} still missing.`);
    setRunning(false); setDone(true); setPaused(false); pausedRef.current = false;
    setProgress({current:0, total:0});
    if (total > 0) onRefresh();
  }

  function togglePause() {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
  }

  return (
    <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem",marginBottom:"1rem"}}>
      {/* Header */}
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"0.75rem",marginBottom:"0.85rem"}}>
        <div>
          <div style={{fontSize:"0.88rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>✨ Auto-fix Database</div>
          <div style={{fontSize:"0.68rem",color:T.textLight,marginTop:"2px"}}>Finds images on Sephora, ULTA and Amazon — no API keys needed</div>
        </div>
        <div style={{display:"flex",gap:"0.35rem",flexShrink:0}}>
          {[
            {label:"Sephora", val:done?counts.sephora:products.filter(p=>hasValidImage(p)&&(p.adminImage||p.image||"").includes("sephora")).length, color:"#e879a0"},
            {label:"ULTA",    val:done?counts.ulta:products.filter(p=>hasValidImage(p)&&(p.adminImage||p.image||"").includes("ulta")).length,    color:"#7c3aed"},
            {label:"Amazon",  val:done?counts.amazon:products.filter(p=>hasValidImage(p)&&(p.adminImage||p.image||"").includes("amazon")).length, color:"#f59e0b"},
            {label:"No Image",val:noImg, color:T.rose},
          ].map(c => (
            <div key={c.label} style={{textAlign:"center",minWidth:"46px",padding:"0.3rem 0.4rem",border:`1px solid ${T.border}`,borderRadius:"0.5rem",background:T.bg}}>
              <div style={{fontSize:"1rem",fontWeight:"800",color:c.color,lineHeight:1}}>{c.val}</div>
              <div style={{fontSize:"0.46rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.04em",marginTop:"1px"}}>{c.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Source cards */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.4rem",marginBottom:"0.85rem"}}>
        {[
          {label:"Step 1", name:"Open Beauty Facts", desc:"For barcoded products — pulls image + ingredients in one call.", color:"#4ade80", bg:"#f0fdf4", border:"#bbf7d0"},
          {label:"Step 2", name:"Claude Web Search", desc:"For seed products — searches Sephora/Ulta via AI web search.", color:"#818cf8", bg:"#f5f3ff", border:"#c4b5fd"},
          {label:"Validated", name:"Image check", desc:"Every URL is tested before saving — broken links are never stored.", color:T.sage, bg:"#f0fdf4", border:"#bbf7d0"},
        ].map(s => (
          <div key={s.label} style={{background:s.bg,border:`1px solid ${s.border}`,borderRadius:"0.6rem",padding:"0.6rem 0.7rem"}}>
            <div style={{fontSize:"0.58rem",fontWeight:"700",color:s.color,marginBottom:"0.15rem",textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.label}</div>
            <div style={{fontSize:"0.68rem",fontWeight:"600",color:T.text,marginBottom:"0.2rem"}}>{s.name}</div>
            <div style={{fontSize:"0.62rem",color:T.textMid,lineHeight:1.45}}>{s.desc}</div>
          </div>
        ))}
      </div>

      {/* API key warning */}
      {!ANTHROPIC_KEY && (
        <div style={{padding:"0.65rem 0.85rem",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:"0.6rem",marginBottom:"0.85rem",fontSize:"0.72rem",color:"#dc2626",fontWeight:"600"}}>
          ⚠️ No Anthropic API key found. Set VITE_ANTHROPIC_KEY in your environment — Claude web search won't work without it.
        </div>
      )}

      {/* Progress bar */}
      {running && progress.total > 0 && (
        <div style={{marginBottom:"0.85rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"0.35rem"}}>
            <span style={{fontSize:"0.68rem",color:T.textMid,fontFamily:"'Inter',sans-serif"}}>
              {paused ? "⏸ Paused" : "⏳ Running…"} {progress.current} / {progress.total}
            </span>
            <span style={{fontSize:"0.68rem",fontWeight:"700",color:T.textMid}}>
              {Math.round((progress.current/progress.total)*100)}%
            </span>
          </div>
          <div style={{height:"6px",background:T.surfaceAlt,borderRadius:"999px",overflow:"hidden"}}>
            <div style={{height:"100%",background:paused?T.amber:T.sage,borderRadius:"999px",width:`${(progress.current/progress.total)*100}%`,transition:"width 0.4s ease"}}/>
          </div>
        </div>
      )}

      {/* Status */}
      {!done && !running && (
        <div style={{display:"flex",gap:"0.75rem",padding:"0.6rem 0.85rem",background:T.bg,border:`1px solid ${T.border}`,borderRadius:"0.6rem",marginBottom:"0.85rem"}}>
          <span style={{fontSize:"0.72rem",color:noImg>0?T.rose:T.sage,fontWeight:"600"}}>{noImg>0?`${noImg} missing images`:"✓ All images present"}</span>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div style={{background:"#0d1117",borderRadius:"0.65rem",padding:"0.75rem 0.85rem",marginBottom:"0.85rem",fontFamily:"monospace",fontSize:"0.68rem",maxHeight:"180px",overflowY:"auto",lineHeight:1.6}}>
          {log.map((l,i) => (
            <div key={i} style={{color:l.type==="ok"?"#4ade80":l.type==="error"||l.type==="x"?"#f87171":"#64748b"}}>
              {l.type==="ok"?"✓":l.type==="x"?"✗":"ℹ"} {l.msg}
            </div>
          ))}
          {running && <div style={{color:"#475569"}}>…</div>}
        </div>
      )}

      {/* Buttons */}
      <div style={{display:"flex",gap:"0.5rem"}}>
        <button onClick={runFix} disabled={running && !paused}
          style={{flex:1,padding:"0.65rem",background:done?T.sage:T.text,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.82rem",fontWeight:"700",cursor:(running&&!paused)?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",opacity:(running&&!paused)?0.5:1}}>
          {running && !paused ? "⏳ Running…" : done ? "↺ Run Again" : `▶ Run Auto-fix (${noImg} missing)`}
        </button>
        {running && (
          <button onClick={togglePause}
            style={{padding:"0.65rem 1rem",background:paused?T.sage:T.amber,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.82rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
      </div>

      {done && (
        <div style={{textAlign:"center",fontSize:"0.68rem",color:T.textLight,marginTop:"0.6rem"}}>
          Fixed <strong style={{color:T.text}}>{counts.sephora+counts.ulta+counts.amazon}</strong> products
          {counts.sephora>0&&<span style={{color:"#e879a0"}}> · {counts.sephora} Sephora</span>}
          {counts.ulta>0&&<span style={{color:"#7c3aed"}}> · {counts.ulta} ULTA</span>}
          {counts.amazon>0&&<span style={{color:"#f59e0b"}}> · {counts.amazon} Amazon</span>}
          {counts.noImg>0&&<span style={{color:T.rose}}> · {counts.noImg} still missing</span>}
        </div>
      )}
    </div>
  );
}

function AdminManageProducts({afRunning, afLog, afDone, afProducts, setAfRunning, setAfLog, setAfDone, setAfProducts, afAddLog, autoOpenTriage=false}) {
  // ── Product list state ──
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const [saved, setSaved]       = useState(null);
  const [editIngId, setEditIngId] = useState(null);
  const [editIngText, setEditIngText] = useState("");
  const [editIngSaving, setEditIngSaving] = useState(false);
  const [search, setSearch]     = useState("");
  const [filter, setFilter]     = useState("pending");
  const [activeCat, setActiveCat] = useState(null);

  // ── Toolbar state (Add, Triage, Import, Seed) ──
  const [seeding, setSeeding] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showImporter, setShowImporter]     = useState(false);
  const [importCat, setImportCat]           = useState("moisturizers");
  const [importResults, setImportResults]   = useState([]);
  const [importLoading, setImportLoading]   = useState(false);
  const [importError, setImportError]       = useState("");
  const [importSelected, setImportSelected] = useState(new Set());
  const [importSaving, setImportSaving]     = useState(false);
  const [importDone, setImportDone]         = useState(0);
  const [triageMode, setTriageMode]         = useState(false);
  const [triageIdx, setTriageIdx]           = useState(0);
  const [triageImg, setTriageImg]           = useState("");
  const [triageLink, setTriageLink]         = useState("");
  const [triageIng, setTriageIng]           = useState("");
  const [triageName, setTriageName]         = useState("");
  const [triageSaving, setTriageSaving]     = useState(false);
  const [triageSaved, setTriageSaved]       = useState(false);
  const [triageDone, setTriageDone]         = useState(new Set());
  const [triageSkipped, setTriageSkipped]   = useState(new Set());
  const triageImgRef = React.useRef(null);
  const triageLinkRef = React.useRef(null);
  const [seedPassword, setSeedPassword] = useState("");
  const [seedPasswordErr, setSeedPasswordErr] = useState(false);
  const SEED_PASSWORD = "ralli-reseed";
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState({productName:"",brand:"",category:"face-wash",poreScore:0,image:"",buyUrl:"",ingredients:"",reason:""});
  const [addingSave, setAddingSave] = useState(false);

  useEffect(()=>{ load(); },[]);
  // Auto-open triage when navigated from AdminCleanup's "Review Images" button
  useEffect(()=>{
    if (autoOpenTriage && !loading && products.length > 0) {
      const queue = products.filter(p => (!p.image || !p.buyUrl));
      if (queue.length > 0) {
        setFilter("noimage");
        const p = queue[0];
        setTriageIdx(0);
        setTriageImg(p.adminImage||p.image||"");
        setTriageLink(p.buyUrl||"");
        setTriageMode(true);
        setTimeout(()=>triageImgRef.current?.focus(), 150);
      }
    }
  },[autoOpenTriage, loading]);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db,"products"), orderBy("createdAt","desc")));
      setProducts(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function saveIngredients(pid) {
    setEditIngSaving(true);
    try {
      const updates = { ingredients: editIngText.trim(), approved: true, updatedAt: Date.now(), lastVerified: Date.now() };
      await updateDoc(doc(db,"products",pid), updates);
      setProducts(ps=>ps.map(p=>p.id===pid?{...p,...updates}:p));
      setEditIngId(null); setEditIngText("");
    } catch(e) { alert("Save failed: "+e.message); }
    setEditIngSaving(false);
  }

  // Also called after imports/seed
  async function loadData() { await load(); }

  async function saveEdits() {
    if (!editing) return;
    setEditSaving(true);
    try {
      const updates = {
        productName: editing.productName.trim(),
        brand: editing.brand.trim(),
        category: editing.category,
        image: editing.image||"",
        adminImage: editing.image||"",
        buyUrl: editing.buyUrl||"",
        approved: true,
        lastVerified: Date.now(),
      };
      await updateDoc(doc(db,"products",editing.id), updates);
      const postsSnap = await getDocs(query(collection(db,"posts"), where("productId","==",editing.id)));
      if (!postsSnap.empty) {
        const batch = writeBatch(db);
        postsSnap.docs.forEach(d=>batch.update(d.ref,{productName:updates.productName, brand:updates.brand}));
        await batch.commit();
      }
      setProducts(ps=>ps.map(p=>p.id===editing.id?{...p,...updates}:p));
      setSaved(editing.id); setTimeout(()=>setSaved(null),2500);
      setEditing(null);
    } catch(e) { alert("Save failed: "+e.message); }
    setEditSaving(false);
  }

  async function toggleApproved(p) {
    const newVal = !p.approved;
    await updateDoc(doc(db,"products",p.id),{approved:newVal, approvedAt: newVal ? Date.now() : null, lastVerified: newVal ? Date.now() : null});
    setProducts(ps=>ps.map(q=>q.id===p.id?{...q,approved:newVal,hidden:false}:q));
  }

  async function hideProduct(p) {
    await updateDoc(doc(db,"products",p.id),{approved:false, hidden:true});
    setProducts(ps=>ps.map(q=>q.id===p.id?{...q,approved:false,hidden:true}:q));
  }

  async function markReverified(p) {
    await updateDoc(doc(db,"products",p.id),{lastVerified:Date.now()});
    setProducts(ps=>ps.map(q=>q.id===p.id?{...q,lastVerified:Date.now()}:q));
  }

  async function deleteProduct(p) {
    if (!confirm(`Permanently delete "${p.productName}"?\n\nThis also removes all scan records. Cannot be undone.`)) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db,"products",p.id));
      const postsSnap = await getDocs(query(collection(db,"posts"), where("productId","==",p.id)));
      postsSnap.docs.forEach(d=>batch.delete(d.ref));
      const scansSnap = await getDocs(query(collection(db,"scans"), where("productId","==",p.id)));
      scansSnap.docs.forEach(d=>batch.delete(d.ref));
      await batch.commit();
      setProducts(ps=>ps.filter(q=>q.id!==p.id));
    } catch(e) { alert("Delete failed: "+e.message); }
  }

  async function handleAddProduct() {
    if (!addForm.productName.trim() || !addForm.brand.trim()) return;
    setAddingSave(true);
    try {
      await addDoc(collection(db,"products"), {
        productName: addForm.productName.trim(),
        brand: addForm.brand.trim(),
        category: addForm.category,
        poreScore: Number(addForm.poreScore)||0,
        communityRating: null,
        image: addForm.image.trim(),
        buyUrl: addForm.buyUrl.trim(),
        ingredients: addForm.ingredients.trim(),
        reason: addForm.reason.trim(),
        skinTypes: [],
        approved: false,
        seeded: false,
        adminAdded: true,
        createdAt: Date.now(),
      });
      setAddForm({productName:"",brand:"",category:"face-wash",poreScore:0,image:"",buyUrl:"",ingredients:"",reason:""});
      setShowAddForm(false);
      await load();
    } catch(e) { alert("Failed to add: "+e.message); }
    setAddingSave(false);
  }

  const [migrating, setMigrating] = useState(false);
  const [deletingDupes, setDeletingDupes] = useState(false);

  async function migrateToFirestore() {
    if (!confirm("This will push curated product data and image URLs into Firestore.\n\nIt won't overwrite existing images. Safe to run multiple times. Continue?")) return;
    setMigrating(true);
    let count = 0;
    try {
      // 1. Mark CURATED_RECS_FALLBACK products as featured in Firestore
      for (const rec of CURATED_RECS_FALLBACK) {
        const q = query(collection(db,"products"),
          where("barcode","==",rec.barcode), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          const d = snap.docs[0];
          const updates = { featured: true };
          if (!d.data().adminImage && !d.data().image) {
            updates.adminImage = rec.image;
            updates.image = rec.image;
          }
          if (!d.data().buyUrl) updates.buyUrl = rec.buyUrl;
          if (!d.data().description) updates.description = rec.description;
          updates.communityRating = rec.communityRating;
          updates.reason = rec.reason;
          await updateDoc(d.ref, updates);
          count++;
        } else {
          // Product not in Firestore yet — create it
          await addDoc(collection(db,"products"), {
            ...rec, featured: true, approved: true,
            adminImage: rec.image, source: "curated",
            createdAt: Date.now(), updatedAt: Date.now(),
          });
          count++;
        }
      }
      // 2. Write ASIN data as asin field on matching products
      const ASIN_DATA = [
        {barcode:"301762112006", asin:"B00TTD9BRC"}, {barcode:"301762113003", asin:"B01MSSDEPK"},
        {barcode:"301762162001", asin:"B01N1LL62W"}, {barcode:"3337875545082", asin:"B01N9SPQHQ"},
        {barcode:"769915190109", asin:"B07L8MK5J7"}, {barcode:"769915357006", asin:"B07K3KNWK9"},
        {barcode:"769915190208", asin:"B074NGBGQM"}, {barcode:"070501109906", asin:"B00NR1YQK4"},
        {barcode:"763474298071", asin:"B00949CTQQ"}, {barcode:"381370043651", asin:"B082372MKT"},
        {barcode:"302993914037", asin:"B07T8KF5RB"}, {barcode:"302993040016", asin:"B000052YOB"},
        {barcode:"635494263006", asin:"B000OZV5FM"}, {barcode:"810067390161", asin:"B07D83QBVC"},
        {barcode:"851459007270", asin:"B00PMHXJBY"}, {barcode:"851459007218", asin:"B00PMHXJ7Q"},
        {barcode:"851459007287", asin:"B07GXMYVDY"}, {barcode:"012853502022", asin:"B01N0Q9AKN"},
        {barcode:"022400430933", asin:"B000S929ZS"}, {barcode:"075609032975", asin:"B00210JW4G"},
      ];
      for (const {barcode, asin} of ASIN_DATA) {
        const q = query(collection(db,"products"), where("barcode","==",barcode), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(snap.docs[0].ref, { asin, buyUrl: `https://www.amazon.com/dp/${asin}` });
        }
      }
      alert(`✓ Migration complete! ${count} curated products updated in Firestore. ASIN data written. You can now remove hardcoded data from the code.`);
      await load();
    } catch(e) { alert("Migration failed: "+e.message); console.error(e); }
    setMigrating(false);
  }

  async function deleteDuplicates() {
    const seen = new Map();
    const toDelete = [];
    // Group by brand+productName (lowercased), keep the one with most data
    products.forEach(p => {
      const key = `${(p.brand||"").toLowerCase().trim()}|${(p.productName||"").toLowerCase().trim()}`;
      if (!seen.has(key)) {
        seen.set(key, p);
      } else {
        const existing = seen.get(key);
        // Keep whichever has more data (image > ingredients > approved > newer)
        const existingScore = (existing.image?2:0)+(existing.ingredients?2:0)+(existing.approved?1:0);
        const newScore = (p.image?2:0)+(p.ingredients?2:0)+(p.approved?1:0);
        if (newScore > existingScore) {
          toDelete.push(existing.id);
          seen.set(key, p);
        } else {
          toDelete.push(p.id);
        }
      }
    });
    if (!toDelete.length) { alert("✓ No duplicates found!"); return; }
    if (!confirm(`Found ${toDelete.length} duplicate products. Delete them?\n\nThe copy with the most data (image, ingredients, approved status) will be kept.`)) return;
    setDeletingDupes(true);
    try {
      const batch = writeBatch(db);
      toDelete.forEach(id => batch.delete(doc(db,"products",id)));
      await batch.commit();
      setProducts(ps => ps.filter(p => !toDelete.includes(p.id)));
      alert(`✓ Deleted ${toDelete.length} duplicates.`);
    } catch(e) { alert("Delete failed: "+e.message); }
    setDeletingDupes(false);
  }

  async function clearBadImages() {

    const bad = products.filter(p => {
      const url = (p.adminImage || p.image || "").trim();
      return url && (!url.startsWith("http") || url.startsWith("data:"));
    });
    if (!bad.length) { alert("✓ No bad image URLs found!"); return; }
    if (!confirm(`Found ${bad.length} products with bad image URLs (base64 or non-http).\n\nClear them so they can be properly triaged?`)) return;
    const batch = writeBatch(db);
    bad.forEach(p => batch.update(doc(db,"products",p.id), {image:"", adminImage:"", updatedAt:Date.now()}));
    await batch.commit();
    setProducts(ps => ps.map(p => bad.find(b=>b.id===p.id) ? {...p,image:"",adminImage:""} : p));
    alert(`✓ Cleared ${bad.length} bad image URLs. Run triage to fix them.`);
  }


  async function cleanBuyUrls() {
    setSeeding(true);
    try {
      const snap = await getDocs(collection(db,"products"));
      const toFix = snap.docs.filter(d=>{
        const url = d.data().buyUrl||"";
        return url.includes("YOURTAG") || url.includes("tag=") || url.match(/amazon\.com\/dp\/[A-Z0-9]+$/);
      });
      if (!toFix.length) { alert("✓ All URLs look good!"); setSeeding(false); return; }
      const batch = writeBatch(db);
      toFix.forEach(d=>{
        const p = d.data();
        const search = ((p.brand||"")+" "+(p.productName||"")).trim().replace(/\s+/g,"+");
        batch.update(d.ref, {buyUrl: `https://www.amazon.com/s?k=${search}`});
      });
      await batch.commit();
      alert(`✓ Fixed ${toFix.length} buy URLs → Amazon search links`);
      await load();
    } catch(e) { alert("Fix failed: "+e.message); }
    setSeeding(false);
  }

    function handleSeedClick() {
    setShowSeedConfirm(true);
    setSeedPassword("");
    setSeedPasswordErr(false);
  }

  async function confirmSeed() {
    if (seedPassword !== SEED_PASSWORD) {
      setSeedPasswordErr(true);
      return;
    }
    setShowSeedConfirm(false);
    setSeedPassword("");
    await seedFromCurated();
  }

  // ── Open Beauty Facts importer ─────────────────────────────
    const OBF_CATS = [
    {id:"moisturizers",      label:"Moisturizers"},
    {id:"face-creams",       label:"Face Creams"},
    {id:"serums",            label:"Serums"},
    {id:"cleansers",         label:"Cleansers"},
    {id:"face-washes",       label:"Face Washes"},
    {id:"sunscreens",        label:"Sunscreens"},
    {id:"toners",            label:"Toners"},
    {id:"eye-creams",        label:"Eye Creams"},
    {id:"exfoliants",        label:"Exfoliants"},
    {id:"face-masks",        label:"Face Masks"},
    {id:"foundations",       label:"Foundations"},
    {id:"concealers",        label:"Concealers"},
  ];

  async function fetchOBF() {
    setImportLoading(true); setImportError(""); setImportResults([]); setImportSelected(new Set()); setImportDone(0);
    try {
      const url = `https://world.openbeautyfacts.org/cgi/search.pl?action=process&tagtype_0=categories&tag_contains_0=contains&tag_0=${encodeURIComponent(importCat)}&page_size=60&json=1&fields=code,product_name,brands,ingredients_text,image_front_url,categories_tags`;
      const res = await fetch(url);
      const data = await res.json();
      const existingIds = new Set(products.map(p=>p.id));

      const importedProducts = (data.products||[])
        .filter(p => p.product_name && p.brands && p.ingredients_text && p.ingredients_text.length > 20)
        .map(p => {
          const brand = p.brands.split(",")[0].trim();
          const name = p.product_name.trim();
          const id = "obf_" + (p.code || Math.random().toString(36).slice(2));
          const analysis = analyzeIngredients(p.ingredients_text);
          const poreScore = analysis.avgScore != null ? Math.round(analysis.avgScore) : 0;
          return {
            id, barcode: p.code||id, productName: name, brand,
            ingredients: p.ingredients_text,
            image: p.image_front_url||"",
            buyUrl: `https://www.amazon.com/s?k=${encodeURIComponent(brand+"+" +name)}`,
            poreScore, approved: false, source: "obf",
            category: importCat,
            analysis,
          };
        })
        .filter(p => !existingIds.has(p.id))
        .slice(0, 50);

      if (!importedProducts.length) setImportError("No new products found for this category. Try another.");
      setImportResults(importedProducts);
      // Auto-select all with poreScore <= 2
      setImportSelected(new Set(importedProducts.filter(p=>p.poreScore<=2).map(p=>p.id)));
    } catch(e) {
      setImportError("Failed to fetch from Open Beauty Facts. Check your connection.");
      console.error(e);
    }
    setImportLoading(false);
  }

  async function importSelected_fn() {
    if (!importSelected.size) return;
    setImportSaving(true);
    const toImport = importResults.filter(p=>importSelected.has(p.id));
    let done = 0;
    for (const p of toImport) {
      try {
        const {analysis, ...clean} = p;
        await setDoc(doc(db,"products",p.id), {
          ...clean, approved: false, scanCount: 0, uniqueScanners: [],
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        done++;
        setImportDone(done);
      } catch(e) { console.error("Import error:", e); }
    }
    setImportSaving(false);
    setImportResults([]);
    setImportSelected(new Set());
    setImportDone(0);
    await loadData();
    alert(`✓ Imported ${done} products as Pending. Review and approve in the Database tab.`);
  }

  async function seedFromCurated() {
    setSeeding(true);
    try {
      // Get all existing product IDs
      const existing = await getDocs(collection(db,"products"));
      const existingIds = new Set(existing.docs.map(d => d.id));
      const userProducts = existing.docs.filter(d => !d.data().seeded && d.data().source !== "seed").length;

      // Collect all seed products
      const allProducts = [];
      for (const cat of SHOP_CATEGORIES) {
        for (const p of cat.products) {
          allProducts.push({cat, p});
        }
      }

      // Only write products that don't already exist
      const toWrite = allProducts.filter(({cat, p}) => {
        const stableId = "seed_" + (p.brand||"").toLowerCase().replace(/[^a-z0-9]/g,"_") + "_" + (p.productName||"").toLowerCase().replace(/[^a-z0-9]/g,"_");
        return !existingIds.has(stableId);
      });

      if (!toWrite.length) {
        alert(`✓ All ${allProducts.length} products already exist. Nothing to add.\n\n${userProducts} user products preserved.`);
        setSeeding(false); return;
      }

      if (!confirm(`This will ADD ${toWrite.length} new products to your catalogue.\n\nExisting products (including your manual fixes) will NOT be touched.\n${userProducts} user products preserved.\n\nContinue?`)) {
        setSeeding(false); return;
      }

      let written = 0;
      for (let i = 0; i < toWrite.length; i += 25) {
        const batch = writeBatch(db);
        for (const {cat, p} of toWrite.slice(i, i+25)) {
          const stableId = "seed_" + (p.brand||"").toLowerCase().replace(/[^a-z0-9]/g,"_") + "_" + (p.productName||"").toLowerCase().replace(/[^a-z0-9]/g,"_");
          const ref = doc(db, "products", stableId);
          batch.set(ref, {
            barcode: p.barcode || stableId,
            productName: p.productName,
            brand: p.brand,
            category: cat.id,
            poreScore: p.poreScore ?? 0,
            communityRating: null,
            image: p.image || "",
            adminImage: p.image || "",
            asin: p.asin || "",
            buyUrl: p.buyUrl || "",
            ingredients: p.ingredients || "",
            skinTypes: p.skinTypes || [],
            reason: p.reason || "",
            approved: true,
            seeded: true,
            scanCount: 0,
            uniqueScanners: [],
            source: "seed",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
          written++;
        }
        await batch.commit();
        await new Promise(r => setTimeout(r, 300));
      }
      await load();
      alert(`✓ Added ${written} new products! ${existingIds.size} existing products untouched.`);
    } catch(e) { alert("Seed failed: "+e.message); console.error(e); }
    setSeeding(false);
  }

  // Triage queue — skipped items go to the back, done/hidden items excluded
  const triageQueue = React.useMemo(()=>{
    const base = products
      .filter(p => !triageDone.has(p.id) && !p.hidden && !p.lastVerified)
      .sort((a,b)=>{
        const aSkipped = triageSkipped.has(a.id) ? 1 : 0;
        const bSkipped = triageSkipped.has(b.id) ? 1 : 0;
        if (aSkipped !== bSkipped) return aSkipped - bSkipped;
        const aHasImg = !!(a.adminImage||a.image);
        const bHasImg = !!(b.adminImage||b.image);
        if (!aHasImg && bHasImg) return -1;
        if (aHasImg && !bHasImg) return 1;
        return (b.scanCount||0)-(a.scanCount||0);
      });
    return base;
  }, [products, triageDone, triageSkipped]);

  // Always sync form fields when the current triage product changes
  React.useEffect(() => {
    const p = triageQueue[triageIdx];
    if (!p) return;
    setTriageName(p.productName||"");
    setTriageImg(p.adminImage||p.image||"");
    setTriageIng(p.ingredients||"");
    const eu = p.buyUrl||"";
    setTriageLink(eu.startsWith("http") ? eu
      : `https://www.amazon.com/s?k=${encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim())}&i=beauty`);
    setTriageSaved(false);
  }, [triageIdx, triageQueue.map(p=>p.id).join(",")]);

  function openTriage() {
    setTriageIdx(0);
    const p = triageQueue[0];
    const existingUrl = p?.buyUrl||"";
    const cleanBuyUrl = existingUrl.startsWith("http") ? existingUrl
      : `https://www.amazon.com/s?k=${encodeURIComponent((p?.brand||"")+" "+(p?.productName||"")).trim()}&i=beauty`;
    setTriageImg(p?.adminImage||p?.image||"");
    setTriageLink(cleanBuyUrl);
    setTriageIng(p?.ingredients||"");
    setTriageName(p?.productName||"");
    setTriageMode(true); setTriageSaved(false);
    setTimeout(()=>triageImgRef.current?.focus(), 100);
  }

  // Keyboard shortcuts for quick review
  React.useEffect(() => {
    if (!triageMode) return;
    function onKey(e) {
      // Don't fire if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); triageNav(1); }
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   { e.preventDefault(); triageNav(-1); }
      if (e.key === "Enter")   { e.preventDefault(); triageSave(true); }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const p = triageQueue[triageIdx];
        if (!p) return;
        updateDoc(doc(db,"products",p.id),{hidden:true,approved:false,updatedAt:Date.now()});
        setProducts(ps=>ps.map(q=>q.id===p.id?{...q,hidden:true,approved:false}:q));
        setTriageDone(d=>new Set([...d,p.id]));
        triageNav(1);
      }
      if (e.key === "Escape") { setTriageMode(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [triageMode, triageIdx, triageQueue, triageSave]);

  function triageNav(dir) {
    const next = triageIdx + dir;
    if (next < 0 || next >= triageQueue.length) return;
    setTriageImg(""); setTriageLink(""); setTriageIng(""); setTriageName(""); setTriageSaved(false);
    setTriageIdx(next);
    const p = triageQueue[next];
    setTimeout(()=>triageImgRef.current?.focus(), 100);
  }

  async function triageSave(andNext=false) {
    const p = triageQueue[triageIdx];
    if (!p) return;

    // Validate image URL — reject base64 and non-http URLs
    const imgUrl = triageImg.trim();
    if (imgUrl) {
      if (imgUrl.startsWith("data:")) {
        alert("❌ That's a base64 image — it won't work in the app.\n\nInstead:\n1. Open the image in a new browser tab\n2. Copy the URL from the address bar\n3. Paste that URL here");
        return;
      }
      if (!imgUrl.startsWith("http")) {
        alert("❌ Image URL must start with https://");
        return;
      }
    }

    setTriageSaving(true);
    try {
      const updates = { approved: true, updatedAt: Date.now(), lastVerified: Date.now() };
      if (imgUrl) { updates.image = imgUrl; updates.adminImage = imgUrl; }
      if (triageLink.trim()) updates.buyUrl = triageLink.trim();
      if (triageIng.trim()) updates.ingredients = triageIng.trim();
      if (triageName.trim() && triageName.trim() !== p.productName) updates.productName = triageName.trim();
      await updateDoc(doc(db,"products",p.id), updates);
      // Update local state immediately
      setProducts(ps=>ps.map(q=>q.id===p.id?{...q,...updates}:q));
      setTriageDone(d => new Set([...d, p.id]));
      setTriageSaved(true);
      // Reload from Firestore to confirm persistence
      await load();
      if (andNext) {
        const nextIdx = triageIdx + 1;
        setTriageImg(""); setTriageLink(""); setTriageIng(""); setTriageName(""); setTriageSaved(false);
        if (nextIdx < triageQueue.length) {
          setTriageIdx(nextIdx);
          const p2 = triageQueue[nextIdx];
          setTimeout(()=>triageImgRef.current?.focus(), 100);
        }
      }
    } catch(e) { alert("Save failed: "+e.message); }
    setTriageSaving(false);
  }

  const inp = {width:"100%",padding:"0.45rem 0.6rem",borderRadius:"0.4rem",border:`1px solid ${T.border}`,fontSize:"0.78rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box"};

  const allCats = [...new Set(products.map(p=>p.category).filter(Boolean))].sort();

  // Compute which products appear in the user-facing Top 100
  // Must be complete (image + buyUrl + ingredients) — same as shop filter
  const top100Ids = new Set(
    [...products]
      .filter(p =>
        p.approved &&
        !needsReverification(p) &&
        hasValidImage(p) &&
        p.buyUrl && p.buyUrl.trim() !== "" &&
        p.ingredients && p.ingredients.trim() !== ""
      )
      .sort((a,b) =>
        (a.poreScore??99)-(b.poreScore??99) ||
        (b.communityRating||0)-(a.communityRating||0) ||
        (b.scanCount||0)-(a.scanCount||0)
      )
      .slice(0, 100)
      .map(p => p.id)
  );

  const filtered = products.filter(p=>{
    const q = search.toLowerCase();
    const matchSearch = !q || (p.productName||"").toLowerCase().includes(q)||(p.brand||"").toLowerCase().includes(q)||(p.id||"").includes(q);
    const matchCat = !activeCat || p.category===activeCat;
    const stale = needsReverification(p);
    const matchFilter =
      filter==="all"      ? true :
      filter==="pending"  ? (!p.approved && !p.hidden) :
      filter==="userscans"? (p.source==="user-scan" || p.isRequest) :
      filter==="reviewed" ? (!!(p.lastVerified)) :
      filter==="hidden"   ? (!p.approved && p.hidden) :
      filter==="noimage"  ? !hasValidImage(p) :
      filter==="noingred" ? (!p.ingredients || p.ingredients.trim() === "") :
      filter==="approved" ? (p.approved && !stale) :
      filter==="top100"   ? top100Ids.has(p.id) :
      filter==="topclicks"? ((p.clickCount||0) > 0) :
      filter==="recheck"  ? (p.approved && stale) : true;
    return matchSearch && matchCat && matchFilter;
  });

  // Sort topclicks by clickCount desc
  const sortedFiltered = filter === "topclicks"
    ? [...filtered].sort((a,b) => (b.clickCount||0) - (a.clickCount||0))
    : filtered;

  const counts = {
    pending:  products.filter(p=>!p.approved&&!p.hidden).length,
    userscans: products.filter(p=>p.source==="user-scan"||p.isRequest).length,
    reviewed: products.filter(p=>!!(p.lastVerified)).length,
    hidden:   products.filter(p=>!p.approved&&p.hidden).length,
    approved: products.filter(p=>p.approved&&!needsReverification(p)).length,
    top100:   top100Ids.size,
    noimage:  products.filter(p => !hasValidImage(p)).length,
    noingred: products.filter(p => !p.ingredients || p.ingredients.trim() === "").length,
    recheck:  products.filter(p=>p.approved&&needsReverification(p)).length,
    topclicks: products.filter(p=>(p.clickCount||0)>0).length,
    all:      products.length,
  };

  const TABS = [
    {id:"all",       label:"All",             color:T.textMid},
    {id:"approved",  label:"✓ In App",        color:T.sage},
    {id:"pending",   label:"⏳ Pending",       color:T.amber},
    {id:"hidden",    label:"🚫 Rejected",      color:T.rose},
    {id:"userscans", label:"👤 User Scans",    color:"#6366f1"},
    {id:"reviewed",  label:"✋ Reviewed",      color:"#0891b2"},
    {id:"noimage",   label:"🖼 No Image",      color:T.textMid},
    {id:"noingred",  label:"🧪 No Ingredients",color:T.textMid},
    {id:"top100",    label:"⭐ Top 100",        color:T.accent},
    {id:"topclicks", label:"🔥 Top Clicks",    color:"#e44d26"},
  ];

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight}}>Loading…</div>;

  return (
    <div>
      {/* ── Auto-fix panel — always visible at top ── */}
      <AutoFixDatabase
        products={products}
        onRefresh={load}
        onOpenTriage={()=>{ setFilter("noimage"); openTriage(); }}
        afRunning={afRunning} afLog={afLog} afDone={afDone}
        setAfRunning={setAfRunning} setAfLog={setAfLog} setAfDone={setAfDone}
        setAfProducts={setAfProducts} afAddLog={afAddLog}
      />

      {/* ── Toolbar ── */}
      <div style={{marginBottom:"0.65rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"0.5rem",flexWrap:"wrap"}}>
        <div style={{fontSize:"0.68rem",color:T.textLight,flexShrink:0}}>{products.length} total · {allCats.length} categories</div>
        <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
          <button onClick={()=>setShowAddForm(v=>!v)}
            style={{padding:"0.35rem 0.75rem",background:showAddForm?T.accent:"none",color:showAddForm?"#FFFFFF":T.textMid,border:`1px solid ${showAddForm?T.accent:T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
            + Add Product
          </button>
          <button onClick={openTriage} disabled={triageQueue.length===0}
            style={{padding:"0.35rem 0.75rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",color:triageQueue.length?T.textMid:T.textLight,cursor:triageQueue.length?"pointer":"not-allowed",fontFamily:"'Inter',sans-serif",fontWeight:"600",position:"relative"}}>
            ⚡ Triage
            {triageQueue.filter(p=>!p.image||!p.buyUrl).length>0&&<span style={{marginLeft:"0.25rem",fontSize:"0.55rem",background:T.amber,color:"#fff",borderRadius:"999px",padding:"0.05rem 0.3rem",fontWeight:"700"}}>{triageQueue.filter(p=>!p.image||!p.buyUrl).length}</span>}
          </button>
          <button onClick={deleteDuplicates} disabled={deletingDupes}
            style={{padding:"0.35rem 0.75rem",background:"none",border:`1px solid ${T.rose}66`,borderRadius:"0.5rem",fontSize:"0.68rem",color:T.rose,cursor:deletingDupes?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600",opacity:deletingDupes?0.5:1}}>
            {deletingDupes?"Deleting…":"🗑 Dupes"}
          </button>
          <button onClick={clearBadImages}
            style={{padding:"0.35rem 0.75rem",background:"none",border:`1px solid ${T.amber}66`,borderRadius:"0.5rem",fontSize:"0.68rem",color:T.amber,cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
            🧹 Clear Bad Imgs
          </button>
          <button onClick={handleSeedClick} disabled={seeding}
            style={{padding:"0.35rem 0.75rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",color:T.textMid,cursor:seeding?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600",opacity:seeding?0.5:1}}>
            {seeding?"🌱 Seeding…":"🌱 Re-seed"}
          </button>
        </div>
      </div>

      {/* ── Add Product Form ── */}
      {showAddForm&&(
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"1rem",marginBottom:"0.85rem"}}>
          <div style={{fontSize:"0.82rem",fontWeight:"700",color:T.text,marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>Add Product</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.5rem"}}>
            {[["productName","Product Name"],["brand","Brand"]].map(([field,label])=>(
              <div key={field}>
                <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>{label}</div>
                <input value={addForm[field]} onChange={e=>setAddForm(f=>({...f,[field]:e.target.value}))}
                  placeholder={label} style={{width:"100%",padding:"0.4rem 0.5rem",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,boxSizing:"border-box"}}/>
              </div>
            ))}
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.5rem"}}>
            <div>
              <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>Category</div>
              <select value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value}))}
                style={{width:"100%",padding:"0.4rem 0.5rem",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text}}>
                {CAT_ORDER.map(c=>(<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div>
              <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>Image URL</div>
              <input value={addForm.image} onChange={e=>setAddForm(f=>({...f,image:e.target.value}))} placeholder="https://…"
                style={{width:"100%",padding:"0.4rem 0.5rem",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,boxSizing:"border-box"}}/>
            </div>
          </div>
          <div style={{marginBottom:"0.5rem"}}>
            <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>Buy URL</div>
            <input value={addForm.buyUrl} onChange={e=>setAddForm(f=>({...f,buyUrl:e.target.value}))} placeholder="https://amazon.com/dp/…"
              style={{width:"100%",padding:"0.4rem 0.5rem",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,boxSizing:"border-box"}}/>
          </div>
          <div style={{marginBottom:"0.5rem"}}>
            <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"3px"}}>Ingredients (optional)</div>
            <textarea value={addForm.ingredients} onChange={e=>setAddForm(f=>({...f,ingredients:e.target.value}))} rows={3}
              style={{width:"100%",padding:"0.4rem 0.5rem",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,boxSizing:"border-box",resize:"vertical"}}/>
          </div>
          <div style={{display:"flex",gap:"0.4rem"}}>
            <button onClick={handleAddProduct} disabled={addingSave||!addForm.productName.trim()||!addForm.brand.trim()}
              style={{flex:1,padding:"0.5rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",opacity:(addingSave||!addForm.productName.trim()||!addForm.brand.trim())?0.5:1}}>
              {addingSave?"Saving…":"Add Product"}
            </button>
            <button onClick={()=>setShowAddForm(false)}
              style={{padding:"0.5rem 0.85rem",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.8rem",color:T.textMid,cursor:"pointer"}}>
              Cancel
            </button>
          </div>
        </div>
      )}


      {/* ── Category pills ── */}
      {allCats.length>0&&(
        <div style={{display:"flex",gap:"0.4rem",overflowX:"auto",paddingBottom:"0.4rem",marginBottom:"0.75rem",scrollbarWidth:"none"}}>
          <button onClick={()=>setActiveCat(null)} style={{flexShrink:0,padding:"0.28rem 0.7rem",borderRadius:"999px",border:`1px solid ${!activeCat?T.navy:T.border}`,background:!activeCat?T.navy:"transparent",color:!activeCat?"#fff":T.textMid,fontSize:"0.68rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap"}}>
            All
          </button>
          {allCats.map(c=>(
            <button key={c} onClick={()=>setActiveCat(activeCat===c?null:c)}
              style={{flexShrink:0,padding:"0.28rem 0.7rem",borderRadius:"999px",border:`1px solid ${activeCat===c?T.navy:T.border}`,background:activeCat===c?T.navy:"transparent",color:activeCat===c?"#fff":T.textMid,fontSize:"0.68rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",whiteSpace:"nowrap",textTransform:"capitalize"}}>
              {c}
            </button>
          ))}
        </div>
      )}

      {/* ── Status filter tabs ── */}
      <div style={{display:"flex",gap:"0.35rem",marginBottom:"0.65rem",overflowX:"auto",scrollbarWidth:"none"}}>
        {TABS.map(({id,label,color})=>(
          <button key={id} onClick={()=>setFilter(id)}
            style={{flexShrink:0,padding:"0.45rem 0.75rem",borderRadius:"0.5rem",border:`1px solid ${filter===id?color:T.border}`,background:filter===id?color+"18":"transparent",cursor:"pointer",fontFamily:"'Inter',sans-serif",textAlign:"center",minWidth:"60px"}}>
            <div style={{fontSize:"0.7rem",fontWeight:filter===id?"700":"500",color:filter===id?color:T.textMid}}>{label}</div>
            <div style={{fontSize:"0.82rem",fontWeight:"700",color:filter===id?color:T.text,lineHeight:1.1}}>{counts[id]}</div>
          </button>
        ))}
      </div>

      {/* ── Search ── */}
      <div style={{position:"relative",marginBottom:"0.65rem"}}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{position:"absolute",left:"0.65rem",top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, brand or barcode…"
          style={{...inp, paddingLeft:"2rem", paddingRight: search ? "2rem" : "0.6rem", marginBottom:0}}/>
        {search && (
          <button onClick={()=>setSearch("")} style={{position:"absolute",right:"0.5rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:T.textLight,display:"flex",padding:"2px"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>
      {search && (
        <div style={{fontSize:"0.68rem",color:T.textLight,marginBottom:"0.5rem",fontFamily:"'Inter',sans-serif"}}>
          {sortedFiltered.length} result{sortedFiltered.length!==1?"s":""} for <strong style={{color:T.text}}>"{search}"</strong>
        </div>
      )}

      {/* ── Product list ── */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
        {sortedFiltered.map(p=>{
          const stale = needsReverification(p);
          const lvTs = p.lastVerified?.seconds ? p.lastVerified.seconds*1000 : (p.lastVerified||0);
          const lvLabel = lvTs ? new Date(lvTs).toLocaleDateString("en-US",{month:"short",year:"numeric"}) : "Never";
          return (
            <div key={p.id} style={{background:T.surface,borderRadius:"0.85rem",border:`2px solid ${saved===p.id?T.sage:stale&&p.approved?T.rose+"66":p.approved?T.sage+"44":T.border}`,padding:"0.75rem",transition:"border-color 0.3s"}}>
              {editing?.id===p.id ? (
                <div>
                  <div style={{fontSize:"0.65rem",fontWeight:"700",color:T.accent,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:"0.5rem"}}>Editing: {p.id}</div>
                  <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.4rem"}}>
                    <div style={{flex:2}}>
                      <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",marginBottom:"2px"}}>Product Name</div>
                      <input style={inp} value={editing.productName} onChange={e=>setEditing(v=>({...v,productName:e.target.value}))}/>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",marginBottom:"2px"}}>Brand</div>
                      <input style={inp} value={editing.brand} onChange={e=>setEditing(v=>({...v,brand:e.target.value}))}/>
                    </div>
                  </div>
                  <div style={{marginBottom:"0.4rem"}}>
                    <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",marginBottom:"2px"}}>Category</div>
                    <select style={{...inp,background:T.surface}} value={editing.category} onChange={e=>setEditing(v=>({...v,category:e.target.value}))}>
                      {["face-wash","moisturizer","serum","exfoliant","spf","eye","body","acne","toner","lip","mask","hair","makeup","other"].map(c=>(
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{marginBottom:"0.4rem"}}>
                    <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",marginBottom:"6px",display:"flex",alignItems:"center",gap:"0.4rem"}}>
                      Image {editing.image&&<span style={{color:T.sage,fontWeight:"600",textTransform:"none"}}>✓</span>}
                    </div>
                    <ImagePicker
                      brand={editing.brand}
                      productName={editing.productName}
                      currentImg={editing.image||""}
                      onSelect={url=>setEditing(v=>({...v,image:url}))}
                    />
                  </div>
                  <div style={{marginBottom:"0.65rem"}}>
                    <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",marginBottom:"2px"}}>Buy URL</div>
                    <input style={inp} value={editing.buyUrl||""} onChange={e=>setEditing(v=>({...v,buyUrl:e.target.value}))} placeholder="https://amazon.com/dp/…"/>
                  </div>
                  <div style={{display:"flex",gap:"0.4rem"}}>
                    <button onClick={saveEdits} disabled={editSaving} title="Save changes and mark product as approved for the shop"
                      style={{flex:1,padding:"0.5rem",background:T.accent,color:"#FFFFFF",border:"none",borderRadius:"0.5rem",fontSize:"0.8rem",fontWeight:"700",cursor:"pointer",opacity:editSaving?0.6:1}}>
                      {editSaving?"Saving…":"💾 Save & Approve"}
                    </button>
                    <button onClick={()=>setEditing(null)} title="Discard changes"
                      style={{padding:"0.5rem 0.85rem",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.8rem",color:T.textMid,cursor:"pointer"}}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:"0.65rem"}}>
                  <div style={{width:"48px",height:"48px",borderRadius:"0.5rem",overflow:"hidden",flexShrink:0,background:"#ffffff",border:`1px solid ${T.border}`}}>
                    {p.image
                      ? <img src={p.image} alt="" style={{width:"100%",height:"100%",objectFit:"contain",padding:"4px",mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)"}} onError={e=>e.target.style.display="none"}/>
                      : <div style={{width:"100%",height:"100%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem"}}>📷</div>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:"flex",alignItems:"center",gap:"0.3rem",flexWrap:"wrap",marginBottom:"1px"}}>
                      <span style={{fontSize:"0.58rem",color:T.accent,fontWeight:"700",textTransform:"uppercase",letterSpacing:"0.05em"}}>{p.brand}</span>
                      {p.approved&&!stale&&<span style={{fontSize:"0.5rem",fontWeight:"700",color:T.sage,background:T.sage+"18",padding:"0.07rem 0.3rem",borderRadius:"999px"}}>{top100Ids.has(p.id)?"⭐ Top 100":"✓ In App"}</span>}
                      {p.approved&&stale&&<span style={{fontSize:"0.5rem",fontWeight:"700",color:T.rose,background:T.rose+"18",padding:"0.07rem 0.3rem",borderRadius:"999px"}}>Re-check</span>}
                      {!p.approved&&!p.hidden&&<span style={{fontSize:"0.5rem",fontWeight:"700",color:T.amber,background:T.amber+"18",padding:"0.07rem 0.3rem",borderRadius:"999px"}}>{p.isRequest?"👤 Requested":"⏳ Pending"}</span>}
                      {p.hidden&&<span style={{fontSize:"0.5rem",fontWeight:"700",color:T.textLight,background:T.border,padding:"0.07rem 0.3rem",borderRadius:"999px"}}>Hidden</span>}
                      {p.scanCount>0&&<span style={{fontSize:"0.5rem",color:"#6366f1",background:"#6366f118",fontWeight:"700",padding:"0.07rem 0.3rem",borderRadius:"999px"}}>{p.scanCount} scans</span>}
                    </div>
                    <div style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                    <div style={{fontSize:"0.6rem",color:T.textLight,display:"flex",gap:"0.35rem",marginTop:"1px",flexWrap:"wrap"}}>
                      <span style={{textTransform:"capitalize"}}>{p.category||"uncategorized"}</span>
                      <span>·</span>
                      <AdminImageStatus p={p}/>
                      <span>·</span>
                      <span style={{color:p.buyUrl?T.sage:T.rose}}>{p.buyUrl?"✓ link":"no link"}</span>
                      <span>·</span>
                      <span
                        onClick={()=>{setEditIngId(editIngId===p.id?null:p.id); setEditIngText(p.ingredients||"");}}
                        style={{color:p.ingredients?T.sage:T.rose,cursor:"pointer",textDecoration:"underline",textDecorationStyle:"dotted"}}>
                        {p.ingredients?"✓ ingredients":"+ add ingredients"}
                      </span>
                      {p.approved&&<><span>·</span><span style={{color:stale?T.rose:T.sage}}>verified {lvLabel}</span></>}
                    </div>
                    {editIngId===p.id&&(
                      <div style={{marginTop:"0.4rem",display:"flex",gap:"0.3rem",alignItems:"flex-start"}}>
                        <textarea
                          autoFocus
                          value={editIngText}
                          onChange={e=>setEditIngText(e.target.value)}
                          placeholder="Paste ingredient list here (comma-separated INCI names)..."
                          style={{flex:1,padding:"0.4rem 0.5rem",borderRadius:"0.4rem",border:`1px solid ${T.accent}`,fontSize:"0.68rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",resize:"vertical",minHeight:"60px",lineHeight:1.4}}
                        />
                        <div style={{display:"flex",flexDirection:"column",gap:"0.2rem"}}>
                          <button onClick={()=>saveIngredients(p.id)} disabled={editIngSaving||!editIngText.trim()}
                            style={{padding:"0.3rem 0.6rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",fontWeight:"700",whiteSpace:"nowrap"}}>
                            {editIngSaving?"…":"✓ Save"}
                          </button>
                          <button onClick={()=>setEditIngId(null)}
                            style={{padding:"0.3rem 0.6rem",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",color:T.textMid}}>
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:"0.25rem",flexShrink:0}}>
                    {!p.approved
                      ? <button onClick={()=>toggleApproved(p)} style={{padding:"0.3rem 0.55rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",fontWeight:"700",whiteSpace:"nowrap"}}>+ Explore</button>
                      : <button onClick={()=>toggleApproved(p)} style={{padding:"0.3rem 0.55rem",background:"transparent",color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer"}}>Remove</button>
                    }
                    <div style={{display:"flex",gap:"0.2rem"}}>
                      <button onClick={()=>setEditing({...p,image:p.image||"",buyUrl:p.buyUrl||""})}
                        style={{flex:1,padding:"0.28rem 0.45rem",background:T.accentSoft,border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",color:T.text}}>
                        Edit
                      </button>
                      {!p.hidden
                        ? <button onClick={()=>hideProduct(p)} style={{padding:"0.28rem 0.45rem",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",color:T.textLight}}>
                            Hide
                          </button>
                        : <button onClick={()=>toggleApproved(p)} style={{padding:"0.28rem 0.45rem",background:"transparent",border:`1px solid ${T.sage}`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",color:T.sage}}>
                            Restore
                          </button>
                      }
                      <button onClick={()=>deleteProduct(p)}
                        style={{padding:"0.28rem 0.45rem",background:"transparent",border:`1px solid ${T.rose}44`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",color:T.rose}}>
                        🗑
                      </button>
                    </div>
                    {p.approved&&stale&&(
                      <button onClick={()=>markReverified(p)}
                        style={{padding:"0.25rem 0.4rem",background:T.sage+"18",border:`1px solid ${T.sage}44`,borderRadius:"0.4rem",fontSize:"0.58rem",cursor:"pointer",color:T.sage,fontWeight:"600",whiteSpace:"nowrap"}}>
                        ✓ Re-verified
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {sortedFiltered.length===0&&(
          <div style={{textAlign:"center",padding:"2.5rem 1rem",color:T.textLight,fontSize:"0.85rem"}}>
            {search?"No products match your search.":filter==="pending"?"All caught up — nothing pending!":"No products in this filter."}
          </div>
        )}
      </div>

      {/* ── Triage Modal ── */}
      {triageMode&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:400,background:"rgba(0,0,0,0.88)",backdropFilter:"blur(6px)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
          <div style={{background:T.surface,borderRadius:"1.25rem 1.25rem 0 0",width:"100%",maxWidth:"520px",boxShadow:"0 -8px 40px rgba(0,0,0,0.25)",height:"88vh",overflowY:"auto"}}>

            {/* Header */}
            <div style={{background:T.navy,padding:"0.85rem 1.25rem",display:"flex",alignItems:"center",justifyContent:"space-between",borderRadius:"1.25rem 1.25rem 0 0",position:"sticky",top:0,zIndex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
                <span style={{fontSize:"0.78rem",fontWeight:"700",color:"#fff",fontFamily:"'Inter',sans-serif"}}>⚡ Quick Triage</span>
                <span style={{fontSize:"0.68rem",color:"rgba(255,255,255,0.5)"}}>{triageIdx+1} / {triageQueue.length}</span>
              </div>
              <button onClick={()=>setTriageMode(false)}
                style={{background:"rgba(255,255,255,0.1)",border:"none",color:"#fff",cursor:"pointer",borderRadius:"0.35rem",padding:"0.3rem 0.55rem",fontSize:"0.75rem"}}>✕</button>
            </div>

            {triageQueue[triageIdx] ? (()=>{
              const p = triageQueue[triageIdx];
              const status = p.approved ? "approved" : (p.hidden ? "hidden" : "pending");
              const searchQ = encodeURIComponent(`${p.brand||""} ${p.productName||""}`);
              return (
                <div style={{padding:"1rem"}}>
                  {/* Progress bar */}
                  <div style={{height:"3px",background:T.surfaceAlt,borderRadius:"999px",marginBottom:"1rem",overflow:"hidden"}}>
                    <div style={{height:"100%",background:T.sage,borderRadius:"999px",width:`${((triageIdx)/Math.max(triageQueue.length-1,1))*100}%`,transition:"width 0.3s"}}/>
                  </div>

                  {/* Product + image preview */}
                  <div style={{display:"flex",gap:"0.85rem",marginBottom:"1rem",alignItems:"flex-start"}}>
                    <div style={{width:"90px",height:"90px",borderRadius:"0.75rem",background:T.surfaceAlt,border:`1.5px solid ${T.border}`,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {triageImg
                        ? <img src={triageImg} style={{width:"100%",height:"100%",objectFit:"contain",padding:"4px"}} onError={e=>{e.target.style.opacity="0.15";}}/>
                        : <span style={{fontSize:"2rem"}}>📷</span>
                      }
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.accent,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.15rem"}}>{p.brand}</div>
                      <div style={{fontSize:"0.95rem",fontWeight:"700",color:T.text,lineHeight:1.3,marginBottom:"0.35rem"}}>{p.productName}</div>
                      <div style={{display:"flex",gap:"0.35rem",flexWrap:"wrap"}}>
                        <span style={{fontSize:"0.58rem",padding:"0.12rem 0.45rem",borderRadius:"999px",background:status==="approved"?T.sage+"15":T.amber+"15",color:status==="approved"?T.sage:T.amber,fontWeight:"600"}}>{status==="approved"?"✓ In App":"Pending"}</span>
                        {!triageImg&&<span style={{fontSize:"0.58rem",padding:"0.12rem 0.45rem",borderRadius:"999px",background:T.rose+"12",color:T.rose,fontWeight:"600"}}>No image</span>}
                        {!p.buyUrl&&<span style={{fontSize:"0.58rem",padding:"0.12rem 0.45rem",borderRadius:"999px",background:T.rose+"12",color:T.rose,fontWeight:"600"}}>No link</span>}
                        {!p.ingredients&&<span style={{fontSize:"0.58rem",padding:"0.12rem 0.45rem",borderRadius:"999px",background:T.rose+"12",color:T.rose,fontWeight:"600"}}>No ingredients</span>}
                        {p.ingredients&&p.ingredients.split(",").length<8&&<span style={{fontSize:"0.58rem",padding:"0.12rem 0.45rem",borderRadius:"999px",background:T.amber+"15",color:T.amber,fontWeight:"600"}}>⚠ Low confidence</span>}
                        {p.scanCount>0&&<span style={{fontSize:"0.58rem",padding:"0.12rem 0.45rem",borderRadius:"999px",background:T.accent+"12",color:T.accent,fontWeight:"600"}}>{p.scanCount} scans</span>}
                      </div>
                    </div>
                  </div>

                  {/* Quick search links */}
                  <div style={{display:"flex",gap:"0.4rem",marginBottom:"0.85rem",flexWrap:"wrap"}}>
                    {[
                      {label:"🔍 Google Images", url:`https://www.google.com/search?q=${searchQ}+product&tbm=isch`},
                      {label:"Sephora", url:`https://www.sephora.com/search?keyword=${searchQ}`},
                      {label:"Ulta", url:`https://www.ulta.com/search?search=${searchQ}`},
                      {label:"Amazon", url:`https://www.amazon.com/s?k=${searchQ}&i=beauty`},
                    ].map(({label,url})=>(
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                        style={{padding:"0.3rem 0.65rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.68rem",color:T.textMid,textDecoration:"none",fontFamily:"'Inter',sans-serif",fontWeight:"600",whiteSpace:"nowrap"}}>
                        {label}
                      </a>
                    ))}
                  </div>

                  {/* Product Name */}
                  <div style={{marginBottom:"0.6rem"}}>
                    <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>Product Name</div>
                    <input
                      value={triageName}
                      onChange={e=>{setTriageName(e.target.value);setTriageSaved(false);}}
                      placeholder="Product name…"
                      style={{width:"100%",padding:"0.5rem 0.65rem",border:`1.5px solid ${triageName?T.sage:T.border}`,borderRadius:"0.5rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,outline:"none",boxSizing:"border-box"}}
                    />
                  </div>

                  {/* Image URL */}
                  <div style={{marginBottom:"0.6rem"}}>
                    <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"4px"}}>Image URL</div>
                    <div style={{display:"flex",gap:"0.4rem"}}>
                      <input
                        ref={triageImgRef}
                        value={triageImg}
                        onChange={e=>{setTriageImg(e.target.value);setTriageSaved(false);}}
                        placeholder="Paste https:// image URL (not base64)…"
                        style={{flex:1,padding:"0.5rem 0.65rem",border:`1.5px solid ${triageImg?T.sage:T.border}`,borderRadius:"0.5rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,outline:"none"}}
                      />
                      {triageImg&&<button onClick={()=>{setTriageImg("");setTriageSaved(false);}} style={{padding:"0.5rem 0.65rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.75rem",cursor:"pointer",color:T.rose}}>✕</button>}
                    </div>
                  </div>

                  {/* Buy Link URL */}
                  <div style={{marginBottom:"1rem"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
                      <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em"}}>Buy Link</div>
                      <button onClick={()=>{
                        const p = triageQueue[triageIdx];
                        if (!p) return;
                        const name = triageName.trim() || p.productName || "";
                        const brand = p.brand || "";
                        const q = encodeURIComponent(`${brand} ${name}`.trim());
                        setTriageLink(`https://www.amazon.com/s?k=${q}&i=beauty`);
                        setTriageSaved(false);
                      }} style={{fontSize:"0.58rem",color:T.accent,background:"none",border:"none",cursor:"pointer",fontWeight:"600",padding:0}}>
                        ↺ Reset to correct product
                      </button>
                    </div>
                    <div style={{display:"flex",gap:"0.4rem"}}>
                      <input
                        value={triageLink}
                        onChange={e=>{setTriageLink(e.target.value);setTriageSaved(false);}}
                        placeholder="Paste product buy URL here…"
                        style={{flex:1,padding:"0.5rem 0.65rem",border:`1.5px solid ${triageLink?T.sage:T.border}`,borderRadius:"0.5rem",fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,outline:"none"}}
                      />
                      {triageLink&&<a href={triageLink} target="_blank" rel="noopener noreferrer" style={{padding:"0.5rem 0.65rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.75rem",color:T.accent,textDecoration:"none",display:"flex",alignItems:"center"}}>↗</a>}
                    </div>
                  </div>

                  {/* Ingredients */}
                  <div style={{marginBottom:"1rem"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"4px"}}>
                      <div style={{fontSize:"0.58rem",fontWeight:"700",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em"}}>Ingredients</div>
                      {!triageIng && <span style={{fontSize:"0.58rem",color:T.rose,fontWeight:"600"}}>Missing</span>}
                      {triageIng && <span style={{fontSize:"0.58rem",color:T.sage,fontWeight:"600"}}>✓ {triageIng.split(",").length} ingredients</span>}
                    </div>
                    <textarea
                      value={triageIng}
                      onChange={e=>{setTriageIng(e.target.value);setTriageSaved(false);}}
                      placeholder="water, glycerin, niacinamide, ceramide np…"
                      rows={3}
                      style={{width:"100%",padding:"0.5rem 0.65rem",border:`1.5px solid ${triageIng?T.sage:T.border}`,borderRadius:"0.5rem",fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",background:T.surface,color:T.text,outline:"none",resize:"vertical",boxSizing:"border-box"}}
                    />
                  </div>

                  {/* Action buttons */}
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:"0.5rem",marginBottom:"0.75rem"}}>
                    <button onClick={()=>triageNav(-1)} disabled={triageIdx===0}
                      style={{padding:"0.7rem 0",background:"transparent",border:`1.5px solid ${T.border}`,borderRadius:"0.65rem",fontSize:"0.78rem",cursor:triageIdx>0?"pointer":"not-allowed",color:T.textMid,opacity:triageIdx===0?0.3:1,fontWeight:"600"}}>
                      ← Back
                    </button>
                    <button onClick={async()=>{
                      await updateDoc(doc(db,"products",p.id),{hidden:true,approved:false,updatedAt:Date.now()});
                      setProducts(ps=>ps.map(q=>q.id===p.id?{...q,hidden:true,approved:false}:q));
                      setTriageDone(d=>new Set([...d,p.id]));
                      triageNav(1);
                    }} style={{padding:"0.7rem 0",background:T.rose+"15",border:`1.5px solid ${T.rose}33`,borderRadius:"0.65rem",fontSize:"0.78rem",cursor:"pointer",color:T.rose,fontWeight:"700"}}>
                      🚫 Hide
                    </button>
                    <button onClick={()=>{
                      setTriageSkipped(s=>new Set([...s, p.id]));
                      // Reset to index 0 so skipped items go to back
                      const nextIdx = triageIdx + 1 < triageQueue.length ? triageIdx + 1 : 0;
                      setTriageImg(""); setTriageLink(""); setTriageIng(""); setTriageName(""); setTriageSaved(false);
                      setTriageIdx(nextIdx);
                      const p2 = triageQueue[nextIdx];
                      if (p2 && p2.id !== p.id) {
                        setTimeout(()=>triageImgRef.current?.focus(), 100);
                      }
                    }}
                      style={{padding:"0.7rem 0",background:T.amber+"10",border:`1.5px solid ${T.amber}33`,borderRadius:"0.65rem",fontSize:"0.78rem",cursor:"pointer",color:T.amber,fontWeight:"700"}}>
                      Skip →
                    </button>
                    <button onClick={()=>triageSave(true)} disabled={triageSaving}
                      style={{padding:"0.7rem 0",background:triageSaved?T.sage:T.navy,color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.78rem",fontWeight:"700",cursor:"pointer",transition:"all 0.15s"}}>
                      {triageSaving?"…":triageSaved?"✓ Saved":"✓ Save →"}
                    </button>
                  </div>

                  <div style={{fontSize:"0.58rem",color:T.textLight,textAlign:"center",display:"flex",gap:"1rem",justifyContent:"center"}}>
                    <span><kbd style={{background:T.surfaceAlt,padding:"0.1rem 0.3rem",borderRadius:"0.2rem",border:`1px solid ${T.border}`}}>Enter</kbd> save & next</span>
                    <span><kbd style={{background:T.surfaceAlt,padding:"0.1rem 0.3rem",borderRadius:"0.2rem",border:`1px solid ${T.border}`}}>Del</kbd> hide</span>
                    <span><kbd style={{background:T.surfaceAlt,padding:"0.1rem 0.3rem",borderRadius:"0.2rem",border:`1px solid ${T.border}`}}>Esc</kbd> close</span>
                  </div>
                </div>
              );
            })() : (
              <div style={{padding:"2rem",textAlign:"center"}}>
                <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>🎉</div>
                <div style={{fontWeight:"700",fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem",color:T.text}}>All done!</div>
                <div style={{fontSize:"0.8rem",color:T.textLight,marginBottom:"1rem"}}>Every product has been reviewed.</div>
                <button onClick={()=>setTriageMode(false)} style={{padding:"0.6rem 1.5rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.6rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Re-seed password confirmation modal ── */}
      {showSeedConfirm&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,background:"rgba(28,28,26,0.65)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div style={{background:T.surface,borderRadius:"1.25rem",padding:"1.5rem",width:"100%",maxWidth:"360px",boxShadow:"0 8px 40px rgba(0,0,0,0.18)"}}>
            <div style={{fontSize:"1.5rem",textAlign:"center",marginBottom:"0.5rem"}}>⚠️</div>
            <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1rem",color:T.text,textAlign:"center",marginBottom:"0.25rem"}}>Confirm Re-seed</div>
            <div style={{fontSize:"0.78rem",color:T.rose,textAlign:"center",marginBottom:"1.25rem",lineHeight:1.5}}>
              This will <strong>delete all existing products</strong> and replace them with the 200 curated ones.<br/>All user scan records will be lost.
            </div>
            <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.35rem",fontWeight:"600"}}>Enter password to confirm:</div>
            <input
              type="password"
              value={seedPassword}
              onChange={e=>{setSeedPassword(e.target.value); setSeedPasswordErr(false);}}
              onKeyDown={e=>e.key==="Enter"&&confirmSeed()}
              placeholder="Password"
              autoFocus
              style={{width:"100%",padding:"0.6rem 0.75rem",borderRadius:"0.6rem",border:`1.5px solid ${seedPasswordErr?T.rose:T.border}`,fontSize:"0.85rem",color:T.text,background:"#FFFFFF",outline:"none",fontFamily:"'Inter',sans-serif",boxSizing:"border-box",marginBottom:"0.3rem"}}
            />
            {seedPasswordErr&&<div style={{fontSize:"0.7rem",color:T.rose,marginBottom:"0.5rem"}}>Incorrect password</div>}
            <div style={{display:"flex",gap:"0.5rem",marginTop:"0.75rem"}}>
              <button onClick={()=>setShowSeedConfirm(false)}
                style={{flex:1,padding:"0.6rem",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.82rem",color:T.textMid,cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                Cancel
              </button>
              <button onClick={confirmSeed}
                style={{flex:1,padding:"0.6rem",background:T.rose,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.82rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                🌱 Yes, Re-seed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function ProductRequestsPanel() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(()=>{
    async function load() {
      try {
        const snap = await getDocs(query(collection(db,"product_requests"), orderBy("requestedAt","desc"), limit(100)));
        setRequests(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch(e) { console.error(e); }
      setLoading(false);
    }
    load();
  },[]);

  async function markDone(id) {
    await updateDoc(doc(db,"product_requests",id),{status:"done"});
    setRequests(rs=>rs.map(r=>r.id===id?{...r,status:"done"}:r));
  }
  async function dismiss(id) {
    await updateDoc(doc(db,"product_requests",id),{status:"dismissed"});
    setRequests(rs=>rs.map(r=>r.id===id?{...r,status:"dismissed"}:r));
  }

  const pending   = requests.filter(r=>r.status==="pending");
  const done      = requests.filter(r=>r.status==="done");
  const dismissed = requests.filter(r=>r.status==="dismissed");

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.82rem"}}>Loading…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"0.25rem"}}>
        <strong style={{color:T.text}}>{pending.length}</strong> pending · {done.length} added · {dismissed.length} dismissed
      </div>
      {requests.length===0&&(
        <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.82rem",background:T.surface,borderRadius:"1rem",border:`1px solid ${T.border}`}}>
          No product requests yet
        </div>
      )}
      {requests.map(r=>(
        <div key={r.id} style={{background:T.surface,border:`1px solid ${r.status==="pending"?T.amber+"55":T.border}`,borderRadius:"0.75rem",padding:"0.75rem 0.9rem",display:"flex",alignItems:"center",gap:"0.65rem",opacity:r.status!=="pending"?0.55:1}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.82rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>"{r.query}"</div>
            <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"2px",display:"flex",gap:"0.4rem",alignItems:"center"}}>
              <span>{new Date(r.requestedAt).toLocaleDateString()}</span>
              {r.status!=="pending"&&<span style={{color:r.status==="done"?T.sage:T.textLight,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.04em",fontSize:"0.55rem"}}>{r.status==="done"?"✓ Added":"Dismissed"}</span>}
            </div>
          </div>
          {r.status==="pending"&&(
            <div style={{display:"flex",gap:"0.3rem",flexShrink:0}}>
              <button onClick={()=>markDone(r.id)}
                style={{padding:"0.28rem 0.55rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.4rem",fontSize:"0.65rem",fontWeight:"700",cursor:"pointer"}}>
                ✓ Added
              </button>
              <button onClick={()=>dismiss(r.id)}
                style={{padding:"0.28rem 0.45rem",background:"transparent",border:`1px solid ${T.border}`,borderRadius:"0.4rem",fontSize:"0.65rem",cursor:"pointer",color:T.textLight}}>
                ✕
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminShopManager() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState({});
  const [search, setSearch]     = useState("");
  const [view, setView]         = useState("all"); // all | in | out

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db,"products"), orderBy("createdAt","desc")));
      setProducts(snap.docs.map(d=>({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  async function toggle(p) {
    setSaving(s=>({...s,[p.id]:true}));
    const newVal = !p.approved;
    try {
      await updateDoc(doc(db,"products",p.id), { approved: newVal, updatedAt: Date.now() });
      setProducts(ps=>ps.map(q=>q.id===p.id?{...q,approved:newVal}:q));
    } catch(e) { console.error(e); }
    setSaving(s=>({...s,[p.id]:false}));
  }

  async function toggleOverride(p) {
    setSaving(s=>({...s,[p.id]:true}));
    const newVal = !p.shopOverride;
    try {
      await updateDoc(doc(db,"products",p.id), { shopOverride: newVal, updatedAt: Date.now() });
      setProducts(ps=>ps.map(q=>q.id===p.id?{...q,shopOverride:newVal}:q));
    } catch(e) { console.error(e); }
    setSaving(s=>({...s,[p.id]:false}));
  }

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.productName||"").toLowerCase().includes(q) || (p.brand||"").toLowerCase().includes(q);
    const hasImg = hasValidImage(p);
    const matchView = view==="all" ? true : view==="in" ? qualifies(p) : !qualifies(p);
    return matchSearch && matchView;
  });

  const qualifies = p => {
    const img = (p.adminImage||p.image||"").trim();
    const ing = (p.ingredients||"").trim();
    const buy = (p.buyUrl||"").trim();
    return (hasValidImage(p) && ing.length > 10 && buy.startsWith("http")) || p.shopOverride;
  };
  const inCount  = products.filter(p=>qualifies(p)).length;
  const outCount = products.filter(p=>!qualifies(p)).length;

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>;

  return (
    <div style={{fontFamily:"'Inter',sans-serif"}}>
      {/* Header stats */}
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"1rem"}}>
        {[
          {label:"In Explore", val:inCount, color:T.sage},
          {label:"Not in Explore", val:outCount, color:T.textMid},
          {label:"Total", val:products.length, color:T.accent},
        ].map(s=>(
          <div key={s.label} style={{flex:1,textAlign:"center",padding:"0.6rem",background:T.surfaceAlt,borderRadius:"0.6rem",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:"1.2rem",fontWeight:"800",color:s.color}}>{s.val}</div>
            <div style={{fontSize:"0.55rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
          style={{flex:1,padding:"0.5rem 0.75rem",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.78rem",background:T.surface,color:T.text,outline:"none",fontFamily:"'Inter',sans-serif"}}/>
        <div style={{display:"flex",background:T.surfaceAlt,borderRadius:"0.5rem",border:`1px solid ${T.border}`,overflow:"hidden"}}>
          {[["all","All"],["in","✓ In Explore"],["out","Out"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setView(id)}
              style={{padding:"0.4rem 0.65rem",background:view===id?T.text:"transparent",color:view===id?"#fff":T.textMid,border:"none",fontSize:"0.68rem",cursor:"pointer",fontWeight:view===id?"600":"400",fontFamily:"'Inter',sans-serif"}}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Product list */}
      <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
        {filtered.map(p => {
          const img = p.adminImage || p.image || p.productImage || "";
          const hasImg = img.startsWith("http");
          const hasIng = (p.ingredients||"").trim().length > 5;
          const hasBuy = (p.buyUrl||"").startsWith("http");
          const ready  = hasImg && hasIng && hasBuy;
          return (
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:"0.6rem",padding:"0.5rem 0.65rem",background:T.surface,borderRadius:"0.65rem",border:`1px solid ${qualifies(p)?T.sage+"44":T.border}`}}>
              {/* Thumbnail */}
              <div style={{width:"36px",height:"36px",borderRadius:"0.4rem",background:T.surfaceAlt,flexShrink:0,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
                {hasImg
                  ? <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                  : <span style={{fontSize:"0.55rem",color:T.textLight}}>No img</span>}
              </div>
              {/* Info */}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.productName}</div>
                <div style={{fontSize:"0.6rem",color:T.textLight}}>{p.brand||"—"}</div>
                {/* Status badges */}
                <div style={{display:"flex",gap:"0.25rem",marginTop:"2px",flexWrap:"wrap"}}>
                  {p.shopOverride&&<span style={{fontSize:"0.5rem",background:T.accent+"22",color:T.accent,padding:"0.05rem 0.25rem",borderRadius:"999px",fontWeight:"600"}}>forced</span>}
                  {!ready&&[!hasImg&&"no img",!hasIng&&"no ingr.",!hasBuy&&"no link"].filter(Boolean).map(w=>(
                    <span key={w} style={{fontSize:"0.5rem",background:T.amber+"22",color:T.amber,padding:"0.05rem 0.25rem",borderRadius:"999px"}}>{w}</span>
                  ))}
                </div>
              </div>
              {/* Manual override checkbox */}
              <label title="Force into Explore regardless of missing fields" style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",cursor:"pointer",flexShrink:0}}>
                <input type="checkbox" checked={!!p.shopOverride} onChange={()=>toggleOverride(p)}
                  style={{width:"15px",height:"15px",cursor:"pointer",accentColor:T.accent}}/>
                <span style={{fontSize:"0.45rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.04em"}}>Force</span>
              </label>
              {/* Approved toggle */}
              <button onClick={()=>toggle(p)} disabled={saving[p.id]}
                style={{flexShrink:0,padding:"0.3rem 0.6rem",background:qualifies(p)?T.sage:T.surfaceAlt,color:qualifies(p)?"#fff":T.textMid,border:`1px solid ${qualifies(p)?T.sage:T.border}`,borderRadius:"0.4rem",fontSize:"0.65rem",fontWeight:"600",cursor:qualifies(p)?"default":"pointer",minWidth:"54px"}}>
                {saving[p.id]?"Saving…":qualifies(p)?"✓ In Explore":"Needs data"}
              </button>
            </div>
          );
        })}
        {filtered.length===0&&<div style={{textAlign:"center",color:T.textLight,padding:"2rem",fontSize:"0.8rem"}}>No products found</div>}
      </div>
    </div>
  );
}


// ── Admin: What We're Loving manager ─────────────────────────
function AdminWWLManager() {
  const [picks, setPicks]       = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState("");
  const [msg, setMsg]           = useState("");

  useEffect(()=>{
    async function load() {
      // Load products first
      try {
        const prodSnap = await getDocs(collection(db,"products"));
        setProducts(prodSnap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.approved).sort((a,b)=>(a.productName||"").localeCompare(b.productName||"")));
      } catch(e) { console.error("WWL products error:", e); }
      // Load picks separately
      try {
        const pickSnap = await getDocs(query(collection(db,"founder_picks"), orderBy("order","asc")));
        setPicks(pickSnap.docs.map(d=>({id:d.id,...d.data()})));
      } catch {
        try {
          const pickSnap = await getDocs(collection(db,"founder_picks"));
          setPicks(pickSnap.docs.map(d=>({id:d.id,...d.data()})));
        } catch {}
      }
      setLoading(false);
    }
    load();
  },[]);

  async function addPick(product) {
    if (picks.find(p=>p.productId===product.id)) { setMsg("Already in picks"); setTimeout(()=>setMsg(""),2000); return; }
    setSaving(true);
    const newPick = { productId:product.id, productName:product.productName, brand:product.brand||"", image:product.adminImage||product.image||"", poreScore:product.poreScore||0, buyUrl:product.buyUrl||"", note:"", order:picks.length };
    const ref = await addDoc(collection(db,"founder_picks"), newPick);
    setPicks(p=>[...p, {id:ref.id,...newPick}]);
    setSearch(""); setSaving(false);
    setMsg("Added!"); setTimeout(()=>setMsg(""),2000);
  }

  async function removePick(id) {
    await deleteDoc(doc(db,"founder_picks",id));
    setPicks(p=>p.filter(x=>x.id!==id));
  }

  async function updateNote(id, note) {
    await updateDoc(doc(db,"founder_picks",id),{note});
    setPicks(p=>p.map(x=>x.id===id?{...x,note}:x));
  }

  const filtered = search.trim().length > 0
    ? products.filter(p=>(p.productName+" "+p.brand).toLowerCase().includes(search.toLowerCase())).slice(0,8)
    : [];

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight}}>Loading…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
      <div style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif",lineHeight:1.5}}>
        These products appear in the "What We're Loving" carousel on the Explore page. Add up to 10.
      </div>

      {/* Search to add */}
      <div>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${products.length} products…`}
          style={{width:"100%",padding:"0.65rem 1rem",borderRadius:"0.65rem",border:`1px solid ${T.border}`,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none",boxSizing:"border-box"}}/>
      </div>

      {/* Results — inline buttons, not a dropdown */}
      {filtered.length > 0 && (
        <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.65rem",overflow:"hidden"}}>
          {filtered.map(p=>(
            <button key={p.id} onClick={()=>{document.activeElement?.blur();addPick(p);}}
              style={{width:"100%",padding:"0.85rem 1rem",background:"none",border:"none",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.6rem",cursor:"pointer",textAlign:"left",WebkitTapHighlightColor:"rgba(0,0,0,0.05)"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text}}>{p.productName}</div>
                <div style={{fontSize:"0.68rem",color:T.textLight}}>{p.brand}</div>
              </div>
              <div style={{flexShrink:0,background:T.sage,color:"#fff",borderRadius:"0.5rem",padding:"0.35rem 0.75rem",fontSize:"0.75rem",fontWeight:"700"}}>+ Add</div>
            </button>
          ))}
        </div>
      )}

      {msg&&<div style={{fontSize:"0.75rem",color:T.sage,fontWeight:"600"}}>{msg}</div>}

      {/* Current picks */}
      <div style={{fontSize:"0.62rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:"600"}}>{picks.length} / 10 picks</div>
      {picks.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.8rem",background:T.surfaceAlt,borderRadius:"0.75rem"}}>No picks yet — search and add products above</div>
      )}
      {picks.map((pick,i)=>(
        <div key={pick.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"0.75rem",display:"flex",gap:"0.65rem",alignItems:"flex-start"}}>
          <div style={{width:"40px",height:"40px",flexShrink:0,borderRadius:"0.4rem",overflow:"hidden",background:"#fff",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {pick.image?<img src={pick.image} style={{width:"100%",height:"100%",objectFit:"contain",padding:"3px"}} alt=""/>:<span style={{fontSize:"1rem"}}>📦</span>}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pick.productName}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginBottom:"0.35rem"}}>{pick.brand}</div>
            <input value={pick.note||""} onChange={e=>updateNote(pick.id,e.target.value)}
              placeholder="Add a short note (e.g. 'Great for dry skin')"
              style={{width:"100%",padding:"0.4rem 0.6rem",borderRadius:"0.4rem",border:`1px solid ${T.border}`,fontSize:"0.72rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.bg,outline:"none",boxSizing:"border-box"}}/>
          </div>
          <button onClick={()=>removePick(pick.id)} style={{background:"none",border:"none",cursor:"pointer",color:T.rose,padding:"0.2rem",flexShrink:0}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      ))}
    </div>
  );
}



// ── Admin: AI Nightly Triage Bot ──────────────────────────────


// ── Admin: AutoFix only (used in Clean Up tab) ────────────────
function AdminAutoFixOnly({afRunning, afLog, afDone, afProducts, setAfRunning, setAfLog, setAfDone, setAfProducts, afAddLog}) {
  const [products, setProducts] = React.useState([]);
  React.useEffect(() => {
    getDocs(collection(db, "products")).then(snap => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }).catch(() => {});
  }, []);
  return <AutoFixDatabase products={products} onRefresh={async () => {
    const snap = await getDocs(collection(db, "products"));
    setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }} onOpenTriage={() => {}} afRunning={afRunning} afLog={afLog} afDone={afDone} setAfRunning={setAfRunning} setAfLog={setAfLog} setAfDone={setAfDone} setAfProducts={setAfProducts} afAddLog={afAddLog}/>;
}

// ── Admin: Clean Up (Ingredients Auto-fetch + Manual Image Triage + Fill Ingredients) ──

// ── One-time Amazon URL fixer ──────────────────────────────────
function FixAmazonUrls({ products, onFixed }) {
  const [fixing, setFixing] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [count, setCount] = React.useState(0);

  async function fixUrls() {
    setFixing(true);
    let fixed = 0;
    const broken = products.filter(p => {
      const img = p.adminImage || "";
      return img.includes("media-amazon") || img.includes("ssl-images-amazon");
    });
    for (const p of broken) {
      const img = p.adminImage || "";
      // Normalize: extract image ID and use _AC_SL400_
      const match = img.match(/\/images\/I\/([A-Za-z0-9%+_-]+?)(?:\._[^/]+_)?\.(?:jpg|jpeg|png|webp)/i);
      if (match) {
        const newUrl = "https://m.media-amazon.com/images/I/" + match[1] + "._AC_SL400_.jpg";
        try {
          await updateDoc(doc(db, "products", p.id), { adminImage: newUrl, updatedAt: Date.now() });
          fixed++;
        } catch(e) { console.error(e); }
      }
    }
    setCount(fixed);
    setDone(true);
    setFixing(false);
    if (fixed > 0) onFixed();
  }

  if (done) return null;

  return (
    <div style={{background:T.amber+"15",border:`1px solid ${T.amber}44`,borderRadius:"0.75rem",padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
      <div style={{flex:1}}>
        <div style={{fontSize:"0.72rem",fontWeight:"600",color:T.amber,fontFamily:"'Inter',sans-serif"}}>⚠ Amazon image URLs need fixing</div>
        <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"1px"}}>{products.filter(p=>(p.adminImage||"").includes("amazon")).length} products have broken Amazon URLs — one-time fix</div>
      </div>
      <button onClick={fixUrls} disabled={fixing}
        style={{padding:"0.4rem 0.85rem",background:T.amber,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.68rem",fontWeight:"700",cursor:fixing?"default":"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
        {fixing ? "Fixing…" : "Fix now"}
      </button>
    </div>
  );
}


async function tryClaudeCandidates(p) {
  if (!ANTHROPIC_KEY) return [];
  try {
    // Use proxy to avoid CORS issues
    const res = await fetch("/api/anthropic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        tools: [{ type: "web_search_20250305", name: "web_search" }],
        system: "Find skincare product images. Search Sephora and Ulta for the product. Return ONLY a JSON object: {\"urls\": [\"https://...\", \"https://...\"]}. Include up to 4 direct image URLs ending in .jpg, .png, or .webp. No explanation.",
        messages: [{ role: "user", content: `Find product image URLs for: ${(p.brand||"").trim()} ${(p.productName||"").trim()}` }]
      })
    });
    const data = await res.json();
    if (data.error) { console.error("Claude error:", data.error); return []; }
    const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json|```/g,"").trim();
    console.log("[ImagePicker] Response:", text.slice(0,400));
    // Try JSON object with urls array
    const objMatch = text.match(/\{[\s\S]*?\}/);
    if (objMatch) {
      try {
        const r = JSON.parse(objMatch[0]);
        const urls = (r.urls||r.url?[r.url]:[]).filter(u=>u&&u.startsWith("http"));
        if (urls.length) return urls.map(u=>({url:u,source:"Web"}));
      } catch {}
    }
    // Try JSON array
    const arrMatch = text.match(/\[[\s\S]*?\]/);
    if (arrMatch) {
      try {
        const r = JSON.parse(arrMatch[0]);
        const valid = r.filter(x=>x&&(x.url||x).startsWith("http")).map(x=>({url:x.url||x,source:x.source||"Web"}));
        if (valid.length) return valid;
      } catch {}
    }
    // Fallback: extract image URLs from raw text
    const matches = [...text.matchAll(/https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|webp|avif)[^\s"'<>)]*/gi)];
    if (matches.length) return matches.slice(0,4).map(m=>({url:m[0],source:"Web"}));
    return [];
  } catch(e) { console.error("[ImagePicker] Error:", e); return []; }
}

// ── AdminImagePicker ─────────────────────────────────────────
function AdminImagePicker({products, setProducts, onBack}) {
  const noImg = products.filter(p => !hasValidImage(p));
  const [idx, setIdx] = React.useState(0);
  const [candidates, setCandidates] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [customUrl, setCustomUrl] = React.useState("");
  const [searchStatus, setSearchStatus] = React.useState("");

  const product = noImg[idx];

  async function search() {
    if (!product) return;
    if (!ANTHROPIC_KEY) { setSearchStatus("No API key — check VITE_ANTHROPIC_KEY in Vercel"); return; }
    setLoading(true); setCandidates([]); setSaved(false); setCustomUrl(""); setSearchStatus("Searching…");
    try {
      const results = await tryClaudeCandidates(product);
      setCandidates(results);
      if (!results.length) setSearchStatus("No images found — try pasting a URL below or skip");
      else setSearchStatus("");
    } catch(e) {
      setSearchStatus("Error: " + e.message);
    }
    setLoading(false);
  }

  async function pickImage(url) {
    if (!product || !url) return;
    await updateDoc(doc(db, "products", product.id), { adminImage: url, image: url, updatedAt: Date.now() });
    setProducts(ps => ps.map(p => p.id === product.id ? {...p, adminImage: url, image: url} : p));
    setSaved(true);
    setTimeout(() => { setIdx(i => i+1); setSaved(false); setCandidates([]); }, 600);
  }

  async function saveCustom() {
    if (!customUrl.trim().startsWith("http")) return;
    await pickImage(customUrl.trim());
  }

  function skip() { setIdx(i => i+1); setCandidates([]); setSaved(false); setCustomUrl(""); }

  if (!product) return (
    <div style={{padding:"2rem",textAlign:"center"}}>
      <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>✓</div>
      <div style={{fontWeight:"600",color:T.text}}>All products have images!</div>
      <button onClick={onBack} style={{marginTop:"1rem",padding:"0.5rem 1rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.5rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back</button>
    </div>
  );

  return (
    <div style={{maxWidth:"480px",margin:"0 auto"}}>
      <div style={{display:"flex",alignItems:"center",gap:"0.75rem",marginBottom:"1rem"}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back</button>
        <span style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>{idx+1} of {noImg.length} missing images</span>
      </div>

      {/* Product info */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"0.85rem 1rem",marginBottom:"0.85rem"}}>
        <div style={{fontSize:"0.6rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'Inter',sans-serif"}}>{product.brand}</div>
        <div style={{fontWeight:"600",color:T.text,fontSize:"0.95rem",fontFamily:"'Inter',sans-serif",marginTop:"2px"}}>{product.productName}</div>
        <div style={{fontSize:"0.7rem",color:T.textLight,marginTop:"3px",fontFamily:"'Inter',sans-serif"}}>{product.category} · pore score {product.poreScore??0}/5</div>
      </div>

      {/* Search buttons */}
      {!loading && candidates.length === 0 && !saved && (
        <div style={{display:"flex",flexDirection:"column",gap:"0.5rem",marginBottom:"0.75rem"}}>
          <button onClick={search}
            style={{width:"100%",padding:"0.85rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.85rem",cursor:"pointer",fontWeight:"600",fontSize:"0.9rem",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            Find images with AI
          </button>
          <a href={`https://www.google.com/search?q=${encodeURIComponent((product.brand||"")+" "+(product.productName||"")+" product")}&tbm=isch`} target="_blank" rel="noopener noreferrer"
            style={{width:"100%",padding:"0.75rem",background:"none",border:`1.5px solid ${T.border}`,borderRadius:"0.85rem",cursor:"pointer",fontWeight:"600",fontSize:"0.85rem",fontFamily:"'Inter',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem",color:T.text,textDecoration:"none",boxSizing:"border-box"}}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            Google it → copy image URL and paste below
          </a>
        </div>
      )}

      {loading && (
        <div style={{textAlign:"center",padding:"1.5rem",color:T.textLight,fontFamily:"'Inter',sans-serif",fontSize:"0.85rem"}}>
          <div style={{width:"20px",height:"20px",border:`2px solid ${T.border}`,borderTopColor:T.accent,borderRadius:"50%",animation:"spin 0.8s linear infinite",margin:"0 auto 0.5rem"}}/>
          Searching Sephora, ULTA & brand sites…
        </div>
      )}
      {!loading && searchStatus && (
        <div style={{padding:"0.75rem 1rem",background:candidates.length===0?T.rose+"12":T.sage+"12",border:`1px solid ${candidates.length===0?T.rose:T.sage}33`,borderRadius:"0.65rem",fontSize:"0.78rem",color:candidates.length===0?T.rose:T.sage,fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem"}}>
          {searchStatus}
        </div>
      )}

      {saved && (
        <div style={{textAlign:"center",padding:"1rem",color:T.sage,fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>✓ Saved! Moving to next…</div>
      )}

      {/* Candidate grid */}
      {candidates.length > 0 && !saved && (
        <div>
          <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'Inter',sans-serif",marginBottom:"0.5rem"}}>Tap to select the best image</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem",marginBottom:"0.75rem"}}>
            {candidates.map((c,i) => (
              <button key={i} onClick={()=>pickImage(c.url)}
                style={{background:T.surface,border:`1.5px solid ${T.border}`,borderRadius:"0.75rem",overflow:"hidden",cursor:"pointer",padding:0,display:"flex",flexDirection:"column",textAlign:"left",transition:"border-color 0.15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.border}>
                <div style={{width:"100%",aspectRatio:"1/1",background:T.surfaceAlt,display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
                  <img src={c.url} alt="" style={{width:"90%",height:"90%",objectFit:"contain",mixBlendMode:"multiply"}} onError={e=>{e.target.style.display="none";}}/>
                </div>
                <div style={{padding:"0.4rem 0.6rem",fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",borderTop:`1px solid ${T.border}`}}>{c.source||"Web"}</div>
              </button>
            ))}
          </div>
          {candidates.length === 0 && <div style={{fontSize:"0.78rem",color:T.textLight,textAlign:"center",padding:"0.5rem",fontFamily:"'Inter',sans-serif"}}>No images found — try pasting a URL below</div>}
        </div>
      )}

      {/* Manual URL paste */}
      <div style={{marginBottom:"0.6rem"}}>
        <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:"'Inter',sans-serif",marginBottom:"0.4rem"}}>Or paste an image URL</div>
        <div style={{display:"flex",gap:"0.5rem"}}>
          <input value={customUrl} onChange={e=>setCustomUrl(e.target.value)} placeholder="https://..."
            style={{flex:1,padding:"0.6rem 0.75rem",border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.82rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif"}}/>
          <button onClick={saveCustom} disabled={!customUrl.trim().startsWith("http")}
            style={{padding:"0.6rem 0.85rem",background:customUrl.trim().startsWith("http")?T.sage:"#ccc",color:"#fff",border:"none",borderRadius:"0.6rem",cursor:customUrl.trim().startsWith("http")?"pointer":"not-allowed",fontWeight:"600",fontFamily:"'Inter',sans-serif",fontSize:"0.8rem"}}>
            Save
          </button>
        </div>
      </div>

      {/* Skip */}
      <button onClick={skip}
        style={{width:"100%",padding:"0.65rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:"pointer",color:T.textLight,fontSize:"0.78rem",fontFamily:"'Inter',sans-serif"}}>
        Skip this product →
      </button>
    </div>
  );
}


// ── AdminProductHub ───────────────────────────────────────────
// Simple, focused product management — stats → fix ingredients → fix images → approve

// ── AdminProductEditInline ────────────────────────────────────
function AdminProductEditInline({product, onSave, onBack}) {
  const [name, setName] = React.useState(product.productName||"");
  const [brand, setBrand] = React.useState(product.brand||"");
  const [category, setCategory] = React.useState(product.category||"");
  const [ingredients, setIngredients] = React.useState(product.ingredients||"");
  const [imageUrl, setImageUrl] = React.useState(product.adminImage||product.image||"");
  const [buyUrl, setBuyUrl] = React.useState(product.buyUrl||"");
  const [approved, setApproved] = React.useState(!!product.approved);
  const [saving, setSaving] = React.useState(false);

  const liveScore = ingredients.trim().length > 10
    ? (() => { try { const r = analyzeIngredients(ingredients); return r.avgScore!=null ? Math.round(r.avgScore) : null; } catch { return null; } })()
    : null;
  const ps = liveScore != null ? poreStyle(liveScore) : null;

  const cats = ["face-wash","moisturizer","serum","spf","toner","eye","body","acne","exfoliant","mask","lip","hair","makeup","other"];

  async function save() {
    setSaving(true);
    await onSave({
      productName: name.trim(),
      brand: brand.trim(),
      category: category||"other",
      ingredients: ingredients.trim(),
      adminImage: imageUrl.trim(),
      image: imageUrl.trim(),
      buyUrl: buyUrl.trim(),
      approved,
      poreScore: liveScore ?? product.poreScore ?? 0,
    });
    setSaving(false);
  }

  const inp = {width:"100%",padding:"0.6rem 0.75rem",border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.82rem",color:T.text,background:T.surface,outline:"none",fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem"};
  const lbl = {fontSize:"0.62rem",fontWeight:"600",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif",marginBottom:"0.3rem",display:"block"};

  return (
    <div style={{maxWidth:"480px",margin:"0 auto"}}>
      <button onClick={onBack} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"1rem"}}>← Back</button>

      {/* Image preview */}
      {imageUrl && (
        <div style={{width:"100%",height:"180px",background:T.surfaceAlt,borderRadius:"0.85rem",marginBottom:"0.75rem",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
          <img src={imageUrl} alt="" style={{maxWidth:"100%",maxHeight:"100%",objectFit:"contain",mixBlendMode:"multiply"}} onError={e=>e.target.style.opacity="0"}/>
        </div>
      )}

      <label style={lbl}>Product name</label>
      <input value={name} onChange={e=>setName(e.target.value)} style={inp}/>

      <label style={lbl}>Brand</label>
      <input value={brand} onChange={e=>setBrand(e.target.value)} style={inp}/>

      <label style={lbl}>Category</label>
      <select value={category} onChange={e=>setCategory(e.target.value)} style={{...inp,marginBottom:"0.75rem"}}>
        {cats.map(c=><option key={c} value={c}>{c}</option>)}
      </select>

      <label style={lbl}>Image URL</label>
      <input value={imageUrl} onChange={e=>setImageUrl(e.target.value)} placeholder="https://..." style={inp}/>

      <label style={lbl}>Buy URL</label>
      <input value={buyUrl} onChange={e=>setBuyUrl(e.target.value)} placeholder="https://..." style={inp}/>

      <label style={lbl}>
        Ingredients
        {liveScore!=null && <span style={{marginLeft:"0.5rem",color:ps.color,fontWeight:"600"}}> · Pore score: {liveScore}/5 ({ps.label})</span>}
      </label>
      <textarea value={ingredients} onChange={e=>setIngredients(e.target.value)} rows={5}
        placeholder="Water, Glycerin, Niacinamide…"
        style={{...inp,resize:"vertical",lineHeight:1.6,marginBottom:"0.75rem"}}/>

      <div style={{display:"flex",alignItems:"center",gap:"0.5rem",marginBottom:"1rem"}}>
        <input type="checkbox" id="approved-cb" checked={approved} onChange={e=>setApproved(e.target.checked)} style={{width:16,height:16,cursor:"pointer"}}/>
        <label htmlFor="approved-cb" style={{fontSize:"0.82rem",color:T.text,fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>Approved — show in Explore</label>
      </div>

      <button onClick={save} disabled={saving}
        style={{width:"100%",padding:"0.85rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.75rem",cursor:"pointer",fontWeight:"600",fontSize:"0.9rem",fontFamily:"'Inter',sans-serif"}}>
        {saving ? "Saving…" : "Save changes"}
      </button>
    </div>
  );
}

function AdminProductHub() {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState("home"); // home | ingredients | images | approve | requests | reports | edit
  const [editProduct, setEditProduct] = React.useState(null);
  const [searchQ, setSearchQ] = React.useState("");
  const [obfRunning, setObfRunning] = React.useState(false);
  const [obfStatus, setObfStatus] = React.useState("");
  const [obfDone, setObfDone] = React.useState(0);
  const stopRef = React.useRef(false);

  React.useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map(d => ({id:d.id,...d.data()})));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  const hasImg = p => hasValidImage(p);
  const hasIng = p => (p.ingredients||"").trim().length > 10;
  const isReady = p => hasImg(p) && hasIng(p) && p.approved;
  const needsImg = p => !hasImg(p);
  const needsIng = p => !hasIng(p);
  const needsApproval = p => hasImg(p) && hasIng(p) && !p.approved && !p.hidden;

  const readyCount = products.filter(isReady).length;
  const imgCount = products.filter(needsImg).length;
  const ingCount = products.filter(needsIng).length;
  const approveCount = products.filter(needsApproval).length;

  async function runOBFSweep() {
    setObfRunning(true); setObfDone(0); stopRef.current = false;
    const needIng = products.filter(needsIng);
    setObfStatus(`Fetching ingredients for ${needIng.length} products…`);
    let found = 0;
    for (let i = 0; i < needIng.length; i++) {
      if (stopRef.current) break;
      const p = needIng[i];
      setObfStatus(`[${i+1}/${needIng.length}] ${p.productName}…`);
      try {
        let ing = "";
        if (p.barcode && !/^seed_/.test(p.barcode)) {
          const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${p.barcode}.json`, {signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          if (d.status===1) ing = d.product?.ingredients_text_en || d.product?.ingredients_text || "";
        }
        if (!ing) {
          const q = encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim());
          const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,ingredients_text,ingredients_text_en,code`, {signal:AbortSignal.timeout(5000)});
          const d = await r.json();
          const brandLow = (p.brand||"").toLowerCase().split(" ")[0];
          const hit = (d.products||[]).find(x=>(x.brands||"").toLowerCase().includes(brandLow)) || (d.products||[])[0];
          ing = hit?.ingredients_text_en || hit?.ingredients_text || "";
        }
        if (ing && ing.trim().length > 10) {
          let poreScore = p.poreScore;
          try { const a = analyzeIngredients(ing); if (a?.avgScore!=null) poreScore=Math.round(a.avgScore); } catch {}
          await updateDoc(doc(db,"products",p.id), {ingredients:ing, poreScore, updatedAt:Date.now()});
          setProducts(ps => ps.map(x => x.id===p.id ? {...x,ingredients:ing,poreScore} : x));
          found++; setObfDone(found);
        }
      } catch(e) { console.error(p.productName, e); }
    }
    setObfStatus(`Done — ${found} ingredients added.`);
    setObfRunning(false);
  }

  async function approveProduct(p) {
    await updateDoc(doc(db,"products",p.id), {approved:true, approvedAt:Date.now(), lastVerified:Date.now()});
    setProducts(ps => ps.map(x => x.id===p.id ? {...x,approved:true} : x));
  }

  async function hideProduct(p) {
    await updateDoc(doc(db,"products",p.id), {approved:false, hidden:true});
    setProducts(ps => ps.map(x => x.id===p.id ? {...x,approved:false,hidden:true} : x));
  }

  if (loading) return <div style={{textAlign:"center",padding:"3rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>;

  // ── Image Picker view ──
  if (view === "images") return <AdminImagePicker products={products} setProducts={setProducts} onBack={()=>setView("home")}/>;

  // ── Approve view ──
  if (view === "approve") {
    const queue = products.filter(needsApproval);
    return (
      <div>
        <button onClick={()=>setView("home")} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"1rem"}}>← Back</button>
        <div style={{fontSize:"0.75rem",color:T.textLight,marginBottom:"1rem",fontFamily:"'Inter',sans-serif"}}>{queue.length} products ready to approve</div>
        {queue.length === 0 && <div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>All done! ✓</div>}
        {queue.map(p => {
          const img = p.adminImage || p.image || "";
          return (
            <div key={p.id} style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.85rem",padding:"0.75rem",marginBottom:"0.6rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
              <div style={{width:44,height:44,borderRadius:"0.55rem",overflow:"hidden",background:T.surfaceAlt,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {img ? <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain",mixBlendMode:"multiply"}} onError={e=>e.target.style.opacity="0"}/> : <span style={{fontSize:"0.6rem",color:T.textLight}}>no img</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",fontFamily:"'Inter',sans-serif"}}>{p.brand}</div>
                <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"2px",fontFamily:"'Inter',sans-serif"}}>{p.category} · pore {p.poreScore??0}/5</div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:"0.35rem",flexShrink:0}}>
                <button onClick={()=>approveProduct(p)} style={{padding:"0.35rem 0.85rem",background:T.sage,color:"#fff",border:"none",borderRadius:"999px",cursor:"pointer",fontSize:"0.72rem",fontWeight:"600",fontFamily:"'Inter',sans-serif"}}>✓ Approve</button>
                <button onClick={()=>hideProduct(p)} style={{padding:"0.35rem 0.85rem",background:"none",color:T.textLight,border:`1px solid ${T.border}`,borderRadius:"999px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"'Inter',sans-serif"}}>Hide</button>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ── Edit view ──
  if (view === "edit" && editProduct) {
    return <AdminProductEditInline product={editProduct} onSave={async (updates) => {
      try {
        const clean = Object.fromEntries(Object.entries({...updates, updatedAt:serverTimestamp()}).filter(([,v])=>v!==undefined));
        await updateDoc(doc(db,"products",editProduct.id), clean);
        setProducts(ps => ps.map(p => p.id===editProduct.id ? {...p,...updates} : p));
        setView("home");
      } catch(e) { alert("Save failed: " + e.message); }
    }} onBack={()=>setView("home")}/>;
  }

  // ── Requests view ──
  if (view === "requests") return (
    <div>
      <button onClick={()=>setView("home")} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"1rem"}}>← Back</button>
      <AdminRequestsTab/>
    </div>
  );

  // ── Reports view ──
  if (view === "reports") return (
    <div>
      <button onClick={()=>setView("home")} style={{background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"1rem"}}>← Back</button>
      <AdminIngredientReports/>
    </div>
  );

  // ── Home view ──
  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>

      {/* Status bar */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem",display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <div style={{textAlign:"center",padding:"0.5rem",background:T.sage+"12",borderRadius:"0.6rem"}}>
          <div style={{fontSize:"1.4rem",fontWeight:"700",color:T.sage,fontFamily:"'Inter',sans-serif"}}>{readyCount}</div>
          <div style={{fontSize:"0.6rem",color:T.sage,fontFamily:"'Inter',sans-serif",marginTop:"1px"}}>Live in Explore</div>
        </div>
        <div style={{textAlign:"center",padding:"0.5rem",background:approveCount>0?T.amber+"12":T.surfaceAlt,borderRadius:"0.6rem"}}>
          <div style={{fontSize:"1.4rem",fontWeight:"700",color:approveCount>0?T.amber:T.textLight,fontFamily:"'Inter',sans-serif"}}>{approveCount}</div>
          <div style={{fontSize:"0.6rem",color:approveCount>0?T.amber:T.textLight,fontFamily:"'Inter',sans-serif",marginTop:"1px"}}>Ready to approve</div>
        </div>
        <div style={{textAlign:"center",padding:"0.5rem",background:T.rose+"10",borderRadius:"0.6rem"}}>
          <div style={{fontSize:"1.4rem",fontWeight:"700",color:T.rose,fontFamily:"'Inter',sans-serif"}}>{imgCount}</div>
          <div style={{fontSize:"0.6rem",color:T.rose,fontFamily:"'Inter',sans-serif",marginTop:"1px"}}>Missing images</div>
        </div>
        <div style={{textAlign:"center",padding:"0.5rem",background:T.rose+"10",borderRadius:"0.6rem"}}>
          <div style={{fontSize:"1.4rem",fontWeight:"700",color:T.rose,fontFamily:"'Inter',sans-serif"}}>{ingCount}</div>
          <div style={{fontSize:"0.6rem",color:T.rose,fontFamily:"'Inter',sans-serif",marginTop:"1px"}}>Missing ingredients</div>
        </div>
      </div>

      {/* Step 1 — Fix ingredients */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem"}}>
        <div style={{fontWeight:"600",color:T.text,fontSize:"0.88rem",fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>Step 1 — Fill missing ingredients</div>
        <div style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem"}}>Searches Open Beauty Facts automatically for {ingCount} products</div>
        {obfRunning ? (
          <div>
            <div style={{fontSize:"0.75rem",color:T.accent,fontFamily:"'Inter',sans-serif",marginBottom:"0.5rem"}}>{obfStatus}</div>
            <div style={{height:"4px",background:T.border,borderRadius:"2px",overflow:"hidden"}}>
              <div style={{height:"100%",background:T.accent,borderRadius:"2px",width:`${products.filter(needsIng).length>0?(obfDone/products.filter(needsIng).length*100):100}%`,transition:"width 0.3s"}}/>
            </div>
            <button onClick={()=>{stopRef.current=true;}} style={{marginTop:"0.5rem",padding:"0.4rem 0.85rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"999px",cursor:"pointer",fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Stop</button>
          </div>
        ) : (
          <div>
            {obfStatus && <div style={{fontSize:"0.72rem",color:T.sage,fontFamily:"'Inter',sans-serif",marginBottom:"0.5rem"}}>{obfStatus}</div>}
            <button onClick={runOBFSweep} disabled={ingCount===0}
              style={{width:"100%",padding:"0.75rem",background:ingCount>0?T.navy:"#ccc",color:"#fff",border:"none",borderRadius:"0.75rem",cursor:ingCount>0?"pointer":"not-allowed",fontWeight:"600",fontSize:"0.85rem",fontFamily:"'Inter',sans-serif"}}>
              {ingCount>0 ? `Run OBF Sweep (${ingCount} missing)` : "✓ All ingredients filled"}
            </button>
          </div>
        )}
      </div>

      {/* Step 2 — Fix images */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem"}}>
        <div style={{fontWeight:"600",color:T.text,fontSize:"0.88rem",fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>Step 2 — Find missing images</div>
        <div style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem"}}>Claude searches Sephora & ULTA — you pick the best photo</div>
        <button onClick={()=>setView("images")} disabled={imgCount===0}
          style={{width:"100%",padding:"0.75rem",background:imgCount>0?T.navy:"#ccc",color:"#fff",border:"none",borderRadius:"0.75rem",cursor:imgCount>0?"pointer":"not-allowed",fontWeight:"600",fontSize:"0.85rem",fontFamily:"'Inter',sans-serif"}}>
          {imgCount>0 ? `Open Image Picker (${imgCount} missing)` : "✓ All images filled"}
        </button>
      </div>

      {/* Step 3 — Approve */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",padding:"1rem"}}>
        <div style={{fontWeight:"600",color:T.text,fontSize:"0.88rem",fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>Step 3 — Approve for Explore</div>
        <div style={{fontSize:"0.72rem",color:T.textLight,fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem"}}>Products with both image + ingredients, waiting for your sign-off</div>
        <button onClick={()=>setView("approve")} disabled={approveCount===0}
          style={{width:"100%",padding:"0.75rem",background:approveCount>0?T.sage:"#ccc",color:"#fff",border:"none",borderRadius:"0.75rem",cursor:approveCount>0?"pointer":"not-allowed",fontWeight:"600",fontSize:"0.85rem",fontFamily:"'Inter',sans-serif"}}>
          {approveCount>0 ? `Review & Approve (${approveCount} ready)` : "✓ Nothing to approve"}
        </button>
      </div>

      {/* Other tools */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <button onClick={()=>setView("requests")}
          style={{padding:"0.7rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
          <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text}}>📬 Requests</div>
          <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"2px"}}>User product requests</div>
        </button>
        <button onClick={()=>setView("reports")}
          style={{padding:"0.7rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
          <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text}}>⚠️ Reports</div>
          <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"2px"}}>Ingredient corrections</div>
        </button>
      </div>

      {/* All products — searchable list */}
      <div style={{background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",overflow:"hidden"}}>
        <div style={{padding:"0.75rem 1rem",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={searchQ} onChange={e=>setSearchQ(e.target.value)} placeholder="Search all products…"
            style={{flex:1,border:"none",outline:"none",fontSize:"0.82rem",color:T.text,background:"transparent",fontFamily:"'Inter',sans-serif"}}/>
          {searchQ&&<button onClick={()=>setSearchQ("")} style={{background:"none",border:"none",cursor:"pointer",color:T.textLight,fontSize:"0.8rem"}}>✕</button>}
        </div>
        <div style={{maxHeight:"400px",overflowY:"auto"}}>
          {products
            .filter(p => searchQ.trim().length < 2 ? true : (p.productName+" "+p.brand).toLowerCase().includes(searchQ.toLowerCase()))
            .sort((a,b) => (a.productName||"").localeCompare(b.productName||""))
            .slice(0, searchQ.trim().length >= 2 ? 50 : 20)
            .map(p => {
              const img = p.adminImage||p.image||"";
              const ready = hasImg(p) && hasIng(p);
              return (
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:"0.65rem",padding:"0.6rem 1rem",borderBottom:`1px solid ${T.border}40`}}>
                  <div style={{width:36,height:36,borderRadius:"0.45rem",overflow:"hidden",background:T.surfaceAlt,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {img ? <img src={img} alt="" style={{width:"100%",height:"100%",objectFit:"contain",mixBlendMode:"multiply"}} onError={e=>e.target.style.opacity="0"}/> : <span style={{fontSize:"0.5rem",color:T.textLight}}>no img</span>}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:"0.8rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                    <div style={{display:"flex",alignItems:"center",gap:"0.35rem",marginTop:"2px"}}>
                      {p.approved ? <span style={{fontSize:"0.55rem",background:T.sage+"20",color:T.sage,padding:"1px 5px",borderRadius:"999px",fontWeight:"600"}}>✓ Live</span>
                        : p.hidden ? <span style={{fontSize:"0.55rem",background:T.rose+"15",color:T.rose,padding:"1px 5px",borderRadius:"999px"}}>Hidden</span>
                        : <span style={{fontSize:"0.55rem",background:T.amber+"20",color:T.amber,padding:"1px 5px",borderRadius:"999px"}}>Pending</span>}
                      {!hasImg(p)&&<span style={{fontSize:"0.55rem",color:T.rose,fontFamily:"'Inter',sans-serif"}}>no img</span>}
                      {!hasIng(p)&&<span style={{fontSize:"0.55rem",color:T.rose,fontFamily:"'Inter',sans-serif"}}>no ing</span>}
                    </div>
                  </div>
                  <button onClick={()=>{setEditProduct(p);setView("edit");}}
                    style={{padding:"0.3rem 0.75rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"999px",cursor:"pointer",fontSize:"0.7rem",color:T.textMid,fontFamily:"'Inter',sans-serif",flexShrink:0}}>
                    Edit
                  </button>
                </div>
              );
          })}
          {searchQ.trim().length < 2 && <div style={{padding:"0.6rem 1rem",fontSize:"0.65rem",color:T.textLight,fontFamily:"'Inter',sans-serif",textAlign:"center"}}>Search to find any product</div>}
        </div>
      </div>

    </div>
  );
}

function AdminCleanup({afRunning, afLog, afDone, afProducts, setAfRunning, setAfLog, setAfDone, setAfProducts, afAddLog}) {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [triageRunning, setTriageRunning] = React.useState(false);
  const [triageStatus, setTriageStatus] = React.useState("");
  const [lastRun, setLastRun] = React.useState(null);
  const [section, setSection] = React.useState(null); // null | "fill" | "review"
  const stopRef = React.useRef(false);

  React.useEffect(() => { loadProducts(); }, []);

  async function loadProducts() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "products"));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
      all.sort((a, b) => {
        const aHas = (a.adminImage||a.image||"").startsWith("http") ? 1 : 0;
        const bHas = (b.adminImage||b.image||"").startsWith("http") ? 1 : 0;
        return aHas - bHas || (b.scanCount||0) - (a.scanCount||0);
      });
      setProducts(all);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  const hasImg = p => (p.adminImage||p.image||"").startsWith("http");
  const hasIng = p => !!(p.ingredients && p.ingredients.trim().length > 10);
  const withImg = products.filter(hasImg).length;
  const withIng = products.filter(hasIng).length;
  const noImg = products.filter(p => !hasImg(p)).length;
  const total = products.length;

  // What to do next recommendation
  const noIng = products.filter(p => !hasIng(p)).length;
  const recommendation = (noImg > 0 || noIng > 0)
    ? { icon: "📷", title: `${noImg} need images · ${noIng} need ingredients`, sub: "Fetch ingredients automatically, then triage images manually", action: "triage" }
    : { icon: "✓", title: "All complete!", sub: `All ${total} products have images and ingredients.`, action: null };

  // Triage bot (inline, no sub-component needed for running)
  async function runTriage() {
    if (triageRunning) return;
    stopRef.current = false;
    setTriageRunning(true);

    // Queue: anything missing image OR ingredients
    const queue = products.filter(p => !hasImg(p) || !hasIng(p));
    if (!queue.length) { setTriageStatus("✓ All products complete!"); setTriageRunning(false); return; }

    let imgAdded = 0, ingAdded = 0;
    const total = queue.length;

    // ── Step 1: OBF sweep for ingredients (free, no AI) ──
    setTriageStatus(`Step 1/2: Fetching ingredients from Open Beauty Facts for ${queue.filter(p=>!hasIng(p)).length} products…`);
    const needIng = queue.filter(p => !hasIng(p));

    for (let i = 0; i < needIng.length; i++) {
      if (stopRef.current) break;
      const p = needIng[i];
      try {
        // Try barcode first, then name search
        let ing = "";
        if (p.barcode && !/^seed_/.test(p.barcode)) {
          const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${p.barcode}.json`, { signal: AbortSignal.timeout(5000) });
          const d = await r.json();
          if (d.status === 1) ing = d.product?.ingredients_text_en || d.product?.ingredients_text || "";
        }
        if (!ing) {
          const q = encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim());
          const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=3&fields=product_name,brands,ingredients_text,ingredients_text_en,code`, { signal: AbortSignal.timeout(5000) });
          const d = await r.json();
          const brandLow = (p.brand||"").toLowerCase().split(" ")[0];
          const hit = (d.products||[]).find(x => (x.brands||"").toLowerCase().includes(brandLow)) || (d.products||[])[0];
          ing = hit?.ingredients_text_en || hit?.ingredients_text || "";
        }
        if (ing && ing.trim().length > 10) {
          let poreScore = p.poreScore;
          try { const a = analyzeIngredients(ing); if (a?.avgScore != null) poreScore = Math.round(a.avgScore); } catch {}
          // OBF: ingredients only — never write image from OBF (quality is too low)
          await updateDoc(doc(db, "products", p.id), { ingredients: ing, poreScore, updatedAt: Date.now() });
          setProducts(ps => ps.map(x => x.id === p.id ? { ...x, ingredients: ing, poreScore } : x));
          ingAdded++;
          setTriageStatus(`Step 1/2: OBF ingredients… ${ingAdded} found (${i+1}/${needIng.length})`);
        }
      } catch(e) { console.error("OBF failed for", p.productName, e); }
    }

    if (stopRef.current) { setTriageStatus(`Stopped. ${ingAdded} ingredients + ${imgAdded} images added.`); setTriageRunning(false); return; }

    // ── Step 2: Direct image search (OBF → Sephora → ULTA → Amazon) ──
    const needImg = products.filter(p => !hasImg(p)); // re-check after OBF step may have updated
    setTriageStatus(`Step 2/2: Finding images for ${needImg.length} products… (${ingAdded} ingredients already added)`);

    for (let i = 0; i < needImg.length; i++) {
      if (stopRef.current) break;
      const p = needImg[i];
      setTriageStatus(`Step 2/2: [${i+1}/${needImg.length}] "${p.productName}"… (${imgAdded} images added)`);
      try {
        const found = await tryClaude(p);
        if (found) {
          const updates = { adminImage: found.img, image: found.img, updatedAt: Date.now() };
          if (found.buyUrl && !p.buyUrl) updates.buyUrl = found.buyUrl;
          await updateDoc(doc(db, "products", p.id), updates);
          setProducts(ps => ps.map(x => x.id === p.id ? { ...x, ...updates } : x));
          imgAdded++;
          console.log(`[triage] "${p.productName}" → ✓ ${found.source}`);
        } else {
          console.warn(`[triage] No image found for "${p.productName}"`);
        }
      } catch(e) { console.error(`[triage] Failed for "${p.productName}":`, e.message); }
    }

    setTriageStatus(`Done! ${imgAdded} images + ${ingAdded} ingredients added.`);
    setLastRun(new Date().toLocaleTimeString());
    setTriageRunning(false);
  }

  if (section === "fill")    return <div><button onClick={()=>setSection(null)} style={{marginBottom:"0.75rem",background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back</button><AdminIngredientFiller/></div>;
  if (section === "review")  return <div><button onClick={()=>setSection(null)} style={{marginBottom:"0.75rem",background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back</button><AdminImageReview/></div>;
  if (section === "products") return <div><button onClick={()=>setSection(null)} style={{marginBottom:"0.75rem",background:"none",border:"none",color:T.accent,fontSize:"0.72rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>← Back to Cleanup</button><AdminManageProducts afRunning={afRunning} afLog={afLog} afDone={afDone} afProducts={afProducts} setAfRunning={setAfRunning} setAfLog={setAfLog} setAfDone={setAfDone} setAfProducts={setAfProducts} afAddLog={afAddLog} autoOpenTriage={true}/></div>;
  if (section === "imagepicker") return <AdminImagePicker products={products} setProducts={setProducts} onBack={()=>setSection(null)}/>;


  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>

      {/* ── What to do next banner ── */}
      <div style={{background:`linear-gradient(135deg,${T.accent}18,${T.accent}08)`,border:`1px solid ${T.accent}33`,borderRadius:"1rem",padding:"0.85rem 1rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
        <div style={{fontSize:"1.5rem",flexShrink:0}}>{recommendation.icon}</div>
        <div style={{flex:1}}>
          <div style={{fontSize:"0.82rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>{recommendation.title}</div>
          <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>{recommendation.sub}</div>
        </div>
        {recommendation.action === "triage" && (
          <button onClick={()=>setSection("products")} style={{padding:"0.45rem 1rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.72rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>📷 Triage Images</button>
        )}
        {recommendation.action === "review" && (
          <button onClick={()=>setSection("review")} style={{padding:"0.45rem 1rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.72rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>Review →</button>
        )}
      </div>

      {/* ── Stats row ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.5rem"}}>
        {[
          {label:"Have image",  val:withImg, color:T.sage,  pct:Math.round(withImg/Math.max(total,1)*100)},
          {label:"No image",    val:noImg,   color:T.rose,  pct:Math.round(noImg/Math.max(total,1)*100)},
          {label:"No ingredients", val:noIng, color:T.amber, pct:Math.round(noIng/Math.max(total,1)*100)},
        ].map(s=>(
          <div key={s.label} style={{background:T.surface,borderRadius:"0.75rem",padding:"0.65rem 0.75rem",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:"1.1rem",fontWeight:"800",color:s.color,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{s.val}</div>
            <div style={{fontSize:"0.55rem",color:T.textLight,marginTop:"2px"}}>{s.label}</div>
            <div style={{marginTop:"0.35rem",height:"3px",background:T.surfaceAlt,borderRadius:"999px"}}>
              <div style={{height:"100%",width:`${s.pct}%`,background:s.color,borderRadius:"999px",transition:"width 0.5s"}}/>
            </div>
          </div>
        ))}
      </div>

      {/* ── Manual image triage button ── */}
      {noImg > 0 && (
        <button onClick={()=>setSection("products")}
          style={{background:T.surface,borderRadius:"0.85rem",padding:"0.75rem 1rem",border:`1.5px solid ${T.accent}33`,cursor:"pointer",textAlign:"left",width:"100%",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div style={{width:"36px",height:"36px",borderRadius:"0.6rem",background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>📷</div>
          <div style={{flex:1}}>
            <div style={{fontSize:"0.78rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>Review Images — {noImg} missing</div>
            <div style={{fontSize:"0.62rem",color:T.textLight,marginTop:"1px"}}>Open triage mode to manually set each product image</div>
          </div>
          <div style={{fontSize:"0.72rem",color:T.textMid,flexShrink:0}}>→</div>
        </button>
      )}

      {/* ── Fix Amazon URLs (one-time cleanup) ── */}
      {products.some(p => (p.adminImage||"").includes("media-amazon") || (p.adminImage||"").includes("ssl-images-amazon")) && (
        <FixAmazonUrls products={products} onFixed={loadProducts}/>
      )}

      {/* ── Quick action buttons ── */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem"}}>
        <button onClick={()=>setSection("imagepicker")}
          style={{padding:"0.7rem",background:T.navy,border:"none",borderRadius:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
          <div style={{fontSize:"0.75rem",fontWeight:"600",color:"#fff"}}>🔍 AI Image Picker</div>
          <div style={{fontSize:"0.6rem",color:"rgba(255,255,255,0.6)",marginTop:"2px"}}>Claude finds images, you pick</div>
        </button>
        <button onClick={()=>setSection("fill")}
          style={{padding:"0.7rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
          <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text}}>🧪 Fill Ingredients</div>
          <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"2px"}}>Paste ingredient lists</div>
        </button>
        <button onClick={()=>setSection("review")}
          style={{padding:"0.7rem",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"0.75rem",cursor:"pointer",textAlign:"left",fontFamily:"'Inter',sans-serif"}}>
          <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text}}>🖼 Image Review</div>
          <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"2px"}}>Check & replace manually</div>
        </button>
      </div>

      {/* ── Product grid ── */}
      <div style={{background:T.surface,borderRadius:"1rem",border:`1px solid ${T.border}`,overflow:"hidden"}}>
        <div style={{padding:"0.65rem 0.85rem",borderBottom:`1px solid ${T.border}`,fontSize:"0.62rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif"}}>
          All products · image status
        </div>
        {loading
          ? <div style={{padding:"1.5rem",textAlign:"center",color:T.textLight,fontSize:"0.75rem"}}>Loading…</div>
          : <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"1px",background:T.border}}>
              {[...products].sort((a,b) => {
                // Show images that were recently fixed first, then no-image
                const aHas = (a.adminImage||a.image||"").startsWith("http");
                const bHas = (b.adminImage||b.image||"").startsWith("http");
                if (aHas && !bHas) return -1;
                if (!aHas && bHas) return 1;
                return (b.updatedAt||0) - (a.updatedAt||0);
              }).slice(0,80).map(p => {
                const img = (p.adminImage||p.image||"").trim();
                const good = img.startsWith("http");
                return (
                  <div key={p.id} style={{background:"#ffffff",position:"relative",aspectRatio:"1",overflow:"hidden"}}>
                    {good
                      ? <img src={img} alt=""
                          style={{width:"100%",height:"100%",objectFit:"contain",background:"#ffffff"}}
                          onLoad={e=>{
                            // Hide if image is tiny (placeholder/pixel) or has no real size
                            if (e.target.naturalWidth < 10 || e.target.naturalHeight < 10) {
                              e.target.style.display="none";
                              e.target.nextSibling.style.display="flex";
                            }
                          }}
                          onError={e=>{e.target.style.display="none"; e.target.nextSibling.style.display="flex";}}
                        />
                      : null
                    }
                    <div style={{width:"100%",height:"100%",background:T.surfaceAlt,display:good?"none":"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",position:"absolute",inset:0}}>📦</div>
                    {!good && <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)"}}/>}
                    {!hasIng(p) && good && <div style={{position:"absolute",bottom:0,right:0,width:"6px",height:"6px",background:T.amber,borderRadius:"999px",margin:"2px"}}/>}
                  </div>
                );
              })}
            </div>
        }
        {products.length > 80 && <div style={{padding:"0.5rem",textAlign:"center",fontSize:"0.6rem",color:T.textLight,borderTop:`1px solid ${T.border}`}}>Showing first 80 of {products.length}</div>}
      </div>

    </div>
  );
}


// ── Admin: Explore Top 100 Auto-manager ───────────────────────
function AdminExploreTop100() {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [running, setRunning] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [results, setResults] = React.useState(null); // { added, already, skipped }

  React.useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "products"));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  // Score each product — lower pore + higher community + has image + has ingredients = better
  function scoreProduct(p) {
    const hasImg = !!(p.adminImage || p.image);
    const hasIng = !!(p.ingredients && p.ingredients.trim().length > 10);
    const hasBuy = !!(p.buyUrl && p.buyUrl.startsWith("http"));
    if (!hasImg || !hasBuy) return -1; // must have image + buy link
    const pore = p.poreScore ?? 5;
    const rating = p.communityRating || 0;
    const scans = p.scanCount || 0;
    const ingBonus = hasIng ? 10 : 0;
    return (5 - pore) * 8 + rating * 3 + Math.min(scans, 20) * 2 + ingBonus;
  }

  async function runAutoExplore() {
    setRunning(true);
    setResults(null);
    setStatus("Scoring all products…");

    const scored = products
      .map(p => ({ ...p, _score: scoreProduct(p) }))
      .filter(p => p._score >= 0)
      .sort((a, b) => b._score - a._score);

    const top100 = scored.slice(0, 100);
    const top100Ids = new Set(top100.map(p => p.id));

    let added = 0, already = 0, skipped = 0;

    setStatus(`Found ${top100.length} qualifying products. Updating Explore…`);

    // Approve top 100, remove anything outside top 100 that was auto-approved
    const batch = [];
    for (const p of products) {
      const inTop = top100Ids.has(p.id);
      if (inTop && !p.approved) {
        batch.push({ id: p.id, approved: true });
        added++;
      } else if (inTop && p.approved) {
        already++;
      } else if (!inTop && p.approved && p.autoApproved) {
        // Only remove if it was auto-approved, never remove manually approved
        batch.push({ id: p.id, approved: false });
        skipped++;
      }
    }

    // Write in chunks of 10
    for (let i = 0; i < batch.length; i += 10) {
      const chunk = batch.slice(i, i + 10);
      await Promise.all(chunk.map(({ id, approved }) =>
        updateDoc(doc(db, "products", id), { approved, autoApproved: approved, updatedAt: Date.now() })
      ));
      setStatus(`Updating… ${Math.min(i + 10, batch.length)}/${batch.length}`);
    }

    await load();
    setResults({ added, already, skipped, total: top100.length });
    setStatus("");
    setRunning(false);
  }

  const currentExplore = products.filter(p => p.approved).length;
  const eligible = products.filter(p => scoreProduct(p) >= 0).length;
  const missingImg = products.filter(p => !(p.adminImage || p.image)).length;
  const missingBuy = products.filter(p => !(p.buyUrl && p.buyUrl.startsWith("http"))).length;

  if (loading) return <div style={{ padding: "2rem", textAlign: "center", color: T.textLight, fontSize: "0.8rem" }}>Loading…</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0F172A, #1a2744)", borderRadius: "1rem", padding: "1.1rem", border: `1px solid ${T.accent}33` }}>
        <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "0.95rem", color: "#fff", marginBottom: "0.3rem" }}>
          🛍 Auto-manage Explore
        </div>
        <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.55)", marginBottom: "0.85rem", lineHeight: 1.5 }}>
          Automatically selects the top 100 products to show on Explore — scored by pore rating, community score, and scan count. Only products with an image + buy link qualify.
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          {[
            { label: "Currently on Explore", val: currentExplore, color: T.sage },
            { label: "Eligible products", val: eligible, color: T.accent },
            { label: "Missing image", val: missingImg, color: T.rose },
            { label: "Missing buy link", val: missingBuy, color: T.amber },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.07)", borderRadius: "0.5rem", padding: "0.4rem 0.65rem" }}>
              <div style={{ fontSize: "1rem", fontWeight: "800", color: s.color, fontFamily: "'Inter',sans-serif", lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: "0.55rem", color: "rgba(255,255,255,0.4)", marginTop: "2px" }}>{s.label}</div>
            </div>
          ))}
        </div>
        <button onClick={runAutoExplore} disabled={running}
          style={{ width: "100%", padding: "0.6rem", background: running ? "rgba(255,255,255,0.1)" : T.accent, color: "#fff", border: "none", borderRadius: "0.6rem", fontSize: "0.75rem", fontWeight: "700", cursor: running ? "default" : "pointer", fontFamily: "'Inter',sans-serif" }}>
          {running ? status || "Running…" : `▶ Auto-select Top 100 for Explore`}
        </button>
      </div>

      {/* Results */}
      {results && (
        <div style={{ background: T.surface, borderRadius: "1rem", padding: "1rem", border: `1px solid ${T.sage}44` }}>
          <div style={{ fontSize: "0.78rem", fontWeight: "700", color: T.sage, marginBottom: "0.6rem" }}>✓ Done!</div>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            {[
              { label: "Newly added", val: results.added, color: T.sage },
              { label: "Already on", val: results.already, color: T.accent },
              { label: "Rotated out", val: results.skipped, color: T.textLight },
              { label: "Total on Explore", val: results.total, color: T.text },
            ].map(s => (
              <div key={s.label} style={{ flex: 1, background: T.surfaceAlt, borderRadius: "0.5rem", padding: "0.5rem 0.65rem", textAlign: "center" }}>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: s.color, fontFamily: "'Inter',sans-serif" }}>{s.val}</div>
                <div style={{ fontSize: "0.55rem", color: T.textLight, marginTop: "2px" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scoring criteria */}
      <div style={{ background: T.surface, borderRadius: "1rem", padding: "1rem", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: "0.65rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.6rem", fontFamily: "'Inter',sans-serif" }}>How products are ranked</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {[
            ["🔴 Requires", "Image + buy link (no exceptions)"],
            ["🟢 +40 pts", "Pore clog score 0/5 (lower = better)"],
            ["🟡 +30 pts", "Rallier score 10/10"],
            ["🔵 +40 pts", "Scan count (capped at 20 scans)"],
            ["⚪ +10 pts", "Has ingredient list"],
          ].map(([badge, desc]) => (
            <div key={badge} style={{ display: "flex", gap: "0.6rem", alignItems: "baseline" }}>
              <span style={{ fontSize: "0.65rem", fontWeight: "700", color: T.text, flexShrink: 0, fontFamily: "'Inter',sans-serif", minWidth: "70px" }}>{badge}</span>
              <span style={{ fontSize: "0.65rem", color: T.textMid }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top 10 preview */}
      <div style={{ background: T.surface, borderRadius: "1rem", padding: "1rem", border: `1px solid ${T.border}` }}>
        <div style={{ fontSize: "0.65rem", color: T.textLight, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.6rem", fontFamily: "'Inter',sans-serif" }}>Current top 10</div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {products
            .map(p => ({ ...p, _score: scoreProduct(p) }))
            .filter(p => p._score >= 0)
            .sort((a, b) => b._score - a._score)
            .slice(0, 10)
            .map((p, i) => {
              const img = (p.adminImage || p.image || "").trim();
              const ps = poreStyle(p.poreScore ?? 0);
              return (
                <div key={p.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <div style={{ fontSize: "0.58rem", color: T.textLight, width: "14px", textAlign: "right", flexShrink: 0 }}>#{i+1}</div>
                  {img
                    ? <img src={img} alt="" style={{ width: "32px", height: "32px", objectFit: "contain", borderRadius: "0.3rem", background: "#F7F8FA", flexShrink: 0 }}/>
                    : <div style={{ width: "32px", height: "32px", borderRadius: "0.3rem", background: T.surfaceAlt, flexShrink: 0 }}/>
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.7rem", fontWeight: "600", color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.productName}</div>
                    <div style={{ fontSize: "0.58rem", color: T.textLight }}>{p.brand}</div>
                  </div>
                  <div style={{ fontSize: "0.58rem", color: ps.color, fontWeight: "700", flexShrink: 0 }}>{p.poreScore ?? "?"}/5</div>
                  <div style={{ fontSize: "0.58rem", color: T.textLight, flexShrink: 0 }}>score {p._score}</div>
                  {p.approved && <div style={{ fontSize: "0.55rem", background: T.sage+"20", color: T.sage, padding: "0.1rem 0.3rem", borderRadius: "999px", flexShrink: 0 }}>live</div>}
                </div>
              );
            })
          }
        </div>
      </div>
    </div>
  );
}


// ── Admin: Image Review (swipe-style) ─────────────────────────
function AdminImageReview() {
  const [products, setProducts] = React.useState([]);
  const [idx, setIdx] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [pasteUrl, setPasteUrl] = React.useState("");
  const [imgBroken, setImgBroken] = React.useState(false);
  const [done, setDone] = React.useState(0);
  const [skipped, setSkipped] = React.useState(0);
  const [filter, setFilter] = React.useState("all"); // all | hasimage | noimage
  const [wiping, setWiping] = React.useState(false);
  const [wiped, setWiped] = React.useState(null);

  React.useEffect(() => { load(); }, [filter]);

  async function wipeAllImages() {
    if (!confirm("This will remove ALL images from every product in the database. The triage bot will re-find them. Are you sure?")) return;
    setWiping(true);
    setWiped(null);
    try {
      const snap = await getDocs(collection(db, "products"));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const withImg = all.filter(p => (p.adminImage||p.image||"").startsWith("http"));
      // Process in chunks of 20
      let count = 0;
      for (let i = 0; i < withImg.length; i += 20) {
        const chunk = withImg.slice(i, i + 20);
        await Promise.all(chunk.map(p => updateDoc(doc(db, "products", p.id), { adminImage: "", image: "", updatedAt: Date.now() })));
        count += chunk.length;
        setWiped(`Clearing… ${count}/${withImg.length}`);
      }
      setWiped(`✓ Cleared ${withImg.length} images. Run the triage bot to re-fetch.`);
      load();
    } catch(e) { alert("Failed: " + e.message); }
    setWiping(false);
  }

  async function load() {
    setLoading(true);
    setIdx(0); setDone(0); setSkipped(0);
    try {
      const snap = await getDocs(collection(db, "products"));
      let all = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => !p.hidden);
      if (filter === "hasimage") all = all.filter(p => (p.adminImage||p.image||"").startsWith("http"));
      if (filter === "noimage")  all = all.filter(p => !(p.adminImage||p.image||"").startsWith("http"));
      // Sort: no image first, then by scan count desc
      all.sort((a,b) => {
        const aHas = (a.adminImage||a.image||"").startsWith("http") ? 1 : 0;
        const bHas = (b.adminImage||b.image||"").startsWith("http") ? 1 : 0;
        return aHas - bHas || (b.scanCount||0) - (a.scanCount||0);
      });
      setProducts(all);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  const p = products[idx];
  const img = p ? (p.adminImage||p.image||"").trim() : "";
  const hasImg = img.startsWith("http");
  const total = products.length;

  function next() {
    setImgBroken(false);
    setPasteUrl("");
    setIdx(i => Math.min(i + 1, total - 1));
  }
  function prev() {
    setImgBroken(false);
    setPasteUrl("");
    setIdx(i => Math.max(i - 1, 0));
  }

  async function keepImage() {
    setDone(d => d + 1);
    next();
  }

  async function removeImage() {
    if (!p) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "products", p.id), { adminImage: "", image: "", updatedAt: Date.now() });
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, adminImage: "", image: "" } : x));
      setDone(d => d + 1);
      next();
    } catch(e) { alert("Failed: " + e.message); }
    setSaving(false);
  }

  async function applyPaste() {
    const url = pasteUrl.trim();
    if (!url.startsWith("http")) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, "products", p.id), { adminImage: url, updatedAt: Date.now() });
      setProducts(ps => ps.map(x => x.id === p.id ? { ...x, adminImage: url } : x));
      setPasteUrl("");
      setDone(d => d + 1);
      next();
    } catch(e) { alert("Failed: " + e.message); }
    setSaving(false);
  }

  function searchLink(site) {
    const q = encodeURIComponent(`${p.productName} ${p.brand}`);
    if (site === "sephora") return `https://www.sephora.com/search?keyword=${q}`;
    if (site === "ulta")    return `https://www.ulta.com/search?search=${q}`;
    if (site === "google")  return `https://www.google.com/search?tbm=isch&q=${q}+skincare+product`;
    if (site === "amazon")  return `https://www.amazon.com/s?k=${q}+skincare`;
    return "#";
  }

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.8rem"}}>Loading…</div>;
  if (!total)  return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.8rem"}}>No products found.</div>;
  if (idx >= total) return (
    <div style={{padding:"2rem",textAlign:"center"}}>
      <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>✓</div>
      <div style={{fontSize:"0.9rem",fontWeight:"700",color:T.text}}>All done!</div>
      <div style={{fontSize:"0.7rem",color:T.textLight,marginTop:"0.25rem"}}>{done} reviewed · {skipped} skipped</div>
      <button onClick={load} style={{marginTop:"1rem",padding:"0.5rem 1.2rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.6rem",fontSize:"0.75rem",fontWeight:"700",cursor:"pointer"}}>Start over</button>
    </div>
  );

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>

      {/* Wipe all images */}
      <div style={{background:T.surface,borderRadius:"0.85rem",padding:"0.75rem 0.85rem",border:`1px solid ${T.rose}33`,display:"flex",alignItems:"center",gap:"0.75rem"}}>
        <div style={{flex:1}}>
          <div style={{fontSize:"0.72rem",fontWeight:"700",color:T.rose,fontFamily:"'Inter',sans-serif"}}>🗑 Reset all images</div>
          <div style={{fontSize:"0.6rem",color:T.textLight,marginTop:"1px"}}>Wipes every image so the triage bot can re-fetch clean ones</div>
          {wiped && <div style={{fontSize:"0.62rem",color:wiped.startsWith("✓")?T.sage:T.amber,marginTop:"0.3rem"}}>{wiped}</div>}
        </div>
        <button onClick={wipeAllImages} disabled={wiping}
          style={{padding:"0.4rem 0.85rem",background:T.rose,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.68rem",fontWeight:"700",cursor:wiping?"default":"pointer",fontFamily:"'Inter',sans-serif",opacity:wiping?0.6:1,flexShrink:0}}>
          {wiping ? "Clearing…" : "Reset all"}
        </button>
      </div>

      {/* Filter + progress */}
      <div style={{display:"flex",gap:"0.4rem",alignItems:"center"}}>
        {["all","noimage","hasimage"].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{padding:"0.3rem 0.65rem",borderRadius:"999px",fontSize:"0.62rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",background:filter===f?T.accent:T.surface,color:filter===f?"#fff":T.textMid,border:`1px solid ${filter===f?T.accent:T.border}`}}>
            {f==="all"?"All":f==="noimage"?"No image":"Has image"}
          </button>
        ))}
        <div style={{marginLeft:"auto",fontSize:"0.62rem",color:T.textLight}}>{idx+1} / {total}</div>
      </div>

      {/* Progress bar */}
      <div style={{height:"3px",background:T.surfaceAlt,borderRadius:"999px",overflow:"hidden"}}>
        <div style={{height:"100%",width:`${((idx)/total)*100}%`,background:T.accent,borderRadius:"999px",transition:"width 0.3s"}}/>
      </div>

      {/* Main card */}
      <div style={{background:T.surface,borderRadius:"1.25rem",border:`1px solid ${T.border}`,overflow:"hidden"}}>

        {/* Image area */}
        <div style={{position:"relative",background:"#ffffff",height:"220px",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {hasImg && !imgBroken
            ? <img src={img} alt="" onError={() => setImgBroken(true)}
                style={{maxHeight:"200px",maxWidth:"100%",objectFit:"contain",padding:"1rem"}}/>
            : <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:"0.5rem",color:T.textLight}}>
                <div style={{fontSize:"2.5rem"}}>📦</div>
                <div style={{fontSize:"0.7rem"}}>{imgBroken ? "Image failed to load" : "No image"}</div>
              </div>
          }
          {/* Source badge */}
          {p.adminImage?.startsWith("http") && <div style={{position:"absolute",top:"0.5rem",right:"0.5rem",background:"rgba(0,0,0,0.5)",color:"#fff",fontSize:"0.55rem",padding:"0.15rem 0.4rem",borderRadius:"999px"}}>admin img</div>}
          {!p.adminImage && p.image?.startsWith("http") && <div style={{position:"absolute",top:"0.5rem",right:"0.5rem",background:"rgba(0,0,0,0.5)",color:"#fff",fontSize:"0.55rem",padding:"0.15rem 0.4rem",borderRadius:"999px"}}>auto img</div>}
        </div>

        {/* Product info */}
        <div style={{padding:"0.85rem 1rem 0"}}>
          <div style={{fontSize:"0.88rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.15rem"}}>{p.productName}</div>
          <div style={{fontSize:"0.65rem",color:T.textLight}}>{p.brand}{p.category ? ` · ${p.category}` : ""}{p.scanCount ? ` · ${p.scanCount} scans` : ""}</div>
        </div>

        {/* Search links */}
        <div style={{padding:"0.6rem 1rem 0",display:"flex",gap:"0.4rem",flexWrap:"wrap"}}>
          {[
            {site:"sephora", label:"Sephora", emoji:"🛍"},
            {site:"ulta",    label:"ULTA",    emoji:"💛"},
            {site:"google",  label:"Google Images", emoji:"🔍"},
            {site:"amazon",  label:"Amazon",  emoji:"📦"},
          ].map(({site,label,emoji}) => (
            <a key={site} href={searchLink(site)} target="_blank" rel="noopener noreferrer"
              style={{display:"inline-flex",alignItems:"center",gap:"0.25rem",padding:"0.3rem 0.6rem",background:T.surfaceAlt,border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.62rem",color:T.textMid,textDecoration:"none",fontFamily:"'Inter',sans-serif",fontWeight:"500"}}>
              {emoji} {label} ↗
            </a>
          ))}
        </div>

        {/* Paste URL */}
        <div style={{padding:"0.6rem 1rem",display:"flex",gap:"0.4rem"}}>
          <input value={pasteUrl} onChange={e => setPasteUrl(e.target.value)}
            placeholder="Paste image URL here → press Use"
            style={{flex:1,padding:"0.45rem 0.65rem",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",background:T.bg,color:T.text,fontFamily:"'Inter',sans-serif",outline:"none"}}
            onKeyDown={e => e.key === "Enter" && applyPaste()}
          />
          <button onClick={applyPaste} disabled={!pasteUrl.trim().startsWith("http")||saving}
            style={{padding:"0.45rem 0.75rem",background:pasteUrl.trim().startsWith("http")?T.accent:T.surfaceAlt,color:pasteUrl.trim().startsWith("http")?"#fff":T.textLight,border:"none",borderRadius:"0.5rem",fontSize:"0.68rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Use ✓
          </button>
        </div>

        {/* Action buttons */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0",borderTop:`1px solid ${T.border}`}}>
          <button onClick={() => { setSkipped(s=>s+1); next(); }}
            style={{padding:"0.85rem",background:"none",border:"none",borderRight:`1px solid ${T.border}`,cursor:"pointer",fontSize:"0.72rem",color:T.textMid,fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
            Skip →
          </button>
          <button onClick={keepImage} disabled={saving}
            style={{padding:"0.85rem",background:"none",border:"none",borderRight:`1px solid ${T.border}`,cursor:"pointer",fontSize:"0.72rem",color:T.sage,fontFamily:"'Inter',sans-serif",fontWeight:"700"}}>
            ✓ Keep
          </button>
          <button onClick={removeImage} disabled={saving}
            style={{padding:"0.85rem",background:"none",border:"none",cursor:"pointer",fontSize:"0.72rem",color:T.rose,fontFamily:"'Inter',sans-serif",fontWeight:"700"}}>
            ✕ Remove
          </button>
        </div>
      </div>

      {/* Prev/next nav */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <button onClick={prev} disabled={idx===0}
          style={{padding:"0.35rem 0.75rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",color:idx===0?T.textLight:T.textMid,cursor:idx===0?"default":"pointer",fontFamily:"'Inter',sans-serif"}}>
          ← Prev
        </button>
        <div style={{fontSize:"0.62rem",color:T.textLight}}>{done} reviewed · {skipped} skipped</div>
        <button onClick={next} disabled={idx>=total-1}
          style={{padding:"0.35rem 0.75rem",background:"none",border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.68rem",color:idx>=total-1?T.textLight:T.textMid,cursor:idx>=total-1?"default":"pointer",fontFamily:"'Inter',sans-serif"}}>
          Next →
        </button>
      </div>

    </div>
  );
}

function AdminIngredientFiller() {
  const [products, setProducts] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [drafts, setDrafts] = React.useState({});
  const [saving, setSaving] = React.useState({});
  const [saved, setSaved] = React.useState({});
  const [filter, setFilter] = React.useState("missing");
  const [search, setSearch] = React.useState("");
  const [bulkSaving, setBulkSaving] = React.useState(false);
  const [bulkDone, setBulkDone] = React.useState(null);

  // Auto-fill state
  const [autoRunning, setAutoRunning] = React.useState(false);
  const [autoStatus, setAutoStatus] = React.useState("");
  const [autoStats, setAutoStats] = React.useState(null);
  const stopAutoRef = React.useRef(false);

  React.useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "products"), orderBy("scanCount", "desc")));
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  // ── Source 1: OBF by barcode ──────────────────────────────────
  async function tryOBFBarcode(p) {
    if (!p.barcode || /^seed_/.test(p.barcode)) return null;
    try {
      const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${p.barcode}.json`, { signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      if (d.status === 1 && d.product) {
        const ing = d.product.ingredients_text_en || d.product.ingredients_text || "";
        if (ing.trim().length > 10) return { ingredients: ing.trim(), source: "OBF barcode" };
      }
    } catch {}
    return null;
  }

  // ── Source 2: OBF by name ─────────────────────────────────────
  async function tryOBFName(p) {
    try {
      const q = encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim());
      const r = await fetch(`https://world.openbeautyfacts.org/cgi/search.pl?search_terms=${q}&search_simple=1&action=process&json=1&page_size=5&fields=product_name,brands,ingredients_text,ingredients_text_en,code`, { signal: AbortSignal.timeout(6000) });
      const d = await r.json();
      const brandLow = (p.brand||"").toLowerCase().split(" ")[0];
      const hit = (d.products||[]).find(x => (x.brands||"").toLowerCase().includes(brandLow)) || (d.products||[])[0];
      if (hit) {
        const ing = hit.ingredients_text_en || hit.ingredients_text || "";
        if (ing.trim().length > 10) return { ingredients: ing.trim(), source: "OBF name" };
      }
    } catch {}
    return null;
  }

  // ── Source 3: Sephora ─────────────────────────────────────────
  async function trySephora(p) {
    try {
      const q = encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim());
      const url = `https://www.sephora.com/api/catalog/search?q=${q}&currentPage=1&pageSize=3&content=true`;
      throw new Error("disabled");
      const d = await r.json();
      const items = d?.products || d?.data?.products || d?.searchResults?.products || [];
      const brandLow = (p.brand||"").toLowerCase().split(" ")[0];
      const hit = items.find(x => (x.brandName||"").toLowerCase().includes(brandLow)) || items[0];
      if (hit?.productId) {
        // Fetch product detail page for ingredients
        const detailUrl = `https://www.sephora.com/api/catalog/product/${hit.productId}?includeIngredients=true`;
        throw new Error("disabled");
        const dd = await dr.json();
        const ing = dd?.ingredients || dd?.productIngredients || dd?.ingredientDesc || "";
        if (ing.trim().length > 10) return { ingredients: ing.trim(), source: "Sephora" };
      }
    } catch {}
    return null;
  }

  // ── Source 4: ULTA ────────────────────────────────────────────
  async function tryUlta(p) {
    try {
      const q = encodeURIComponent(`${p.brand||""} ${p.productName||""}`.trim());
      const url = `https://www.ulta.com/api/catalog/search?keyword=${q}&Nrpp=3`;
      throw new Error("disabled");
      const d = await r.json();
      const items = d?.searchResult?.products || d?.products || d?.results || [];
      const hit = items[0];
      if (hit?.productId || hit?.sku) {
        const pid = hit.productId || hit.sku;
        const detailUrl = `https://www.ulta.com/api/product/${pid}`;
        throw new Error("disabled");
        const dd = await dr.json();
        const ing = dd?.ingredients || dd?.ingredientList || "";
        if (ing.trim().length > 10) return { ingredients: ing.trim(), source: "ULTA" };
      }
    } catch {}
    return null;
  }

  // ── Source 5: Amazon scrape ───────────────────────────────────
  async function tryAmazon(p) {
    try {
      const q = encodeURIComponent(`${p.brand||""} ${p.productName||""} skincare ingredients`);
      const url = `https://www.amazon.com/s?k=${q}&i=beauty`;
      throw new Error("disabled");
      const html = await r.text();
      // Look for ingredients in the HTML
      const match = html.match(/Ingredients[:\s]*<[^>]+>([^<]{50,})</i);
      if (match?.[1] && match[1].trim().length > 10) return { ingredients: match[1].trim(), source: "Amazon" };
    } catch {}
    return null;
  }

  // ── Source 6: AI (haiku) — last resort ───────────────────────
  async function tryAI(p) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 800,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          system: "Find the full ingredient list for a skincare product. Search Sephora or the brand website. Return ONLY JSON: {ingredients: \"full INCI list comma-separated\" or null, source: \"where you found it\"}. No markdown, no explanation.",
          messages: [{ role: "user", content: "Find ingredients for: " + p.productName + " by " + p.brand + ". Return ONLY the JSON object." }]
        })
      });
      const data = await res.json();
      if (data.error) return null;
      const text = (data.content||[]).filter(b=>b.type==="text").map(b=>b.text).join("").replace(/```json|```/g,"").trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const result = JSON.parse(match[0]);
      if (result.ingredients && result.ingredients.trim().length > 10) {
        return { ingredients: result.ingredients.trim(), source: "AI" };
      }
    } catch {}
    return null;
  }

  // ── Waterfall: try all sources in order ──────────────────────
  async function findIngredients(p) {
    const result =
      await tryOBFBarcode(p) ||
      await tryOBFName(p) ||
      await trySephora(p) ||
      await tryUlta(p) ||
      await tryAmazon(p) ||
      await tryAI(p);
    return result;
  }

  async function runAutoFill() {
    stopAutoRef.current = false;
    setAutoRunning(true);
    setAutoStatus("Loading…");
    setAutoStats(null);

    const snap = await getDocs(query(collection(db, "products"), orderBy("scanCount", "desc")));
    const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const queue = all.filter(p => !p.ingredients || p.ingredients.trim().length < 10);

    if (!queue.length) {
      setAutoStatus("✓ All products already have ingredients!");
      setAutoRunning(false);
      return;
    }

    const stats = { obf: 0, sephora: 0, ulta: 0, amazon: 0, ai: 0, failed: 0 };
    let done = 0;

    for (let i = 0; i < queue.length; i++) {
      if (stopAutoRef.current) {
        setAutoStatus(`Stopped at ${i}/${queue.length}. ${done} filled.`);
        break;
      }

      const p = queue[i];
      setAutoStatus(`[${i+1}/${queue.length}] "${p.productName}"… (${done} filled)`);

      const result = await findIngredients(p);

      if (result) {
        try {
          const analysis = analyzeIngredients(result.ingredients);
          const poreScore = analysis?.avgScore != null ? Math.round(analysis.avgScore) : p.poreScore;
          await updateDoc(doc(db, "products", p.id), {
            ingredients: result.ingredients,
            poreScore,
            updatedAt: Date.now(),
          });
          setProducts(ps => ps.map(x => x.id === p.id ? { ...x, ingredients: result.ingredients, poreScore } : x));
          done++;
          const src = result.source.toLowerCase();
          if (src.includes("obf")) stats.obf++;
          else if (src.includes("sephora")) stats.sephora++;
          else if (src.includes("ulta")) stats.ulta++;
          else if (src.includes("amazon")) stats.amazon++;
          else if (src.includes("ai")) stats.ai++;
        } catch(e) { stats.failed++; }
      } else {
        stats.failed++;
      }
    }

    setAutoStats({ ...stats, total: done, queued: queue.length });
    if (!stopAutoRef.current) setAutoStatus(`Done! ${done}/${queue.length} filled.`);
    setAutoRunning(false);
  }

  // ── Manual filler (existing) ──────────────────────────────────
  async function saveDraft(pid) {
    const text = (drafts[pid]||"").trim();
    if (!text) return;
    setSaving(s=>({...s,[pid]:true}));
    try {
      const analysis = analyzeIngredients(text);
      const poreScore = analysis?.avgScore != null ? Math.round(analysis.avgScore) : null;
      const updates = { ingredients: text, updatedAt: Date.now() };
      if (poreScore !== null) updates.poreScore = poreScore;
      await updateDoc(doc(db,"products",pid), updates);
      setProducts(ps=>ps.map(p=>p.id===pid?{...p,...updates}:p));
      setSaved(s=>({...s,[pid]:true}));
      setDrafts(d=>({...d,[pid]:""}));
      setTimeout(()=>setSaved(s=>({...s,[pid]:false})),2000);
    } catch(e){alert("Failed: "+e.message);}
    setSaving(s=>({...s,[pid]:false}));
  }

  async function saveAll() {
    const toSave = Object.entries(drafts).filter(([,v])=>v.trim().length>10);
    if (!toSave.length) return;
    setBulkSaving(true);
    let count = 0;
    for (const [pid, text] of toSave) {
      try {
        const analysis = analyzeIngredients(text.trim());
        const poreScore = analysis?.avgScore != null ? Math.round(analysis.avgScore) : null;
        const updates = { ingredients: text.trim(), updatedAt: Date.now() };
        if (poreScore !== null) updates.poreScore = poreScore;
        await updateDoc(doc(db,"products",pid), updates);
        setProducts(ps=>ps.map(p=>p.id===pid?{...p,...updates}:p));
        count++;
      } catch {}
    }
    setDrafts({});
    setBulkDone(count);
    setBulkSaving(false);
    setTimeout(()=>setBulkDone(null),3000);
  }

  const missing = products.filter(p => !p.ingredients||p.ingredients.trim().length<10);
  const displayed = (filter==="missing" ? missing : products)
    .filter(p => !search || (p.productName+p.brand).toLowerCase().includes(search.toLowerCase()));
  const pendingDrafts = Object.values(drafts).filter(v=>v.trim().length>10).length;

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.8rem"}}>Loading…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>

      {/* ── Auto-fill card ── */}
      <div style={{background:"linear-gradient(135deg,#0F172A,#1a2744)",borderRadius:"1rem",padding:"1rem",border:`1px solid ${T.accent}33`}}>
        <div style={{fontSize:"0.82rem",fontWeight:"700",color:"#fff",fontFamily:"'Inter',sans-serif",marginBottom:"0.25rem"}}>🧪 Auto-fill Ingredients</div>
        <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.45)",marginBottom:"0.75rem"}}>
          Waterfall: OBF barcode → OBF name → Sephora → ULTA → Amazon → AI (last resort)
        </div>

        {/* Source pills */}
        <div style={{display:"flex",gap:"0.3rem",flexWrap:"wrap",marginBottom:"0.75rem"}}>
          {[
            {label:"OBF",     color:"#4ade80", free:true},
            {label:"Sephora", color:"#e879a0", free:true},
            {label:"ULTA",    color:"#a78bfa", free:true},
            {label:"Amazon",  color:"#fbbf24", free:true},
            {label:"AI",      color:"#60a5fa", free:false},
          ].map(s=>(
            <div key={s.label} style={{display:"flex",alignItems:"center",gap:"0.25rem",padding:"0.2rem 0.5rem",background:"rgba(255,255,255,0.08)",borderRadius:"999px",fontSize:"0.58rem",color:s.color,fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
              {s.label} {s.free&&<span style={{color:"rgba(255,255,255,0.3)",fontSize:"0.52rem"}}>free</span>}
            </div>
          ))}
        </div>

        <div style={{display:"flex",gap:"0.5rem",alignItems:"center",marginBottom:autoStatus?"0.4rem":"0"}}>
          <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.4)",flex:1}}>{missing.length} products missing ingredients</div>
          {autoRunning
            ? <button onClick={()=>stopAutoRef.current=true} style={{padding:"0.4rem 0.85rem",background:"#ef4444",color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.68rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>⏹ Stop</button>
            : <button onClick={runAutoFill} style={{padding:"0.4rem 0.85rem",background:T.accent,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.68rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>▶ Run All ({missing.length})</button>
          }
        </div>
        {autoRunning && <div style={{height:"3px",background:"rgba(255,255,255,0.1)",borderRadius:"999px",overflow:"hidden",marginBottom:"0.3rem"}}><div style={{height:"100%",width:"35%",background:T.accent,borderRadius:"999px",animation:"pulse 1.5s infinite"}}/></div>}
        {autoStatus && <div style={{fontSize:"0.62rem",color:autoRunning?T.amber:autoStatus.startsWith("Done")||autoStatus.startsWith("✓")?"#4ade80":"rgba(255,255,255,0.4)",fontFamily:"'Inter',sans-serif"}}>{autoStatus}</div>}

        {autoStats && (
          <div style={{display:"flex",gap:"0.4rem",flexWrap:"wrap",marginTop:"0.6rem"}}>
            {[
              {label:"OBF",    val:autoStats.obf,     color:"#4ade80"},
              {label:"Sephora",val:autoStats.sephora,  color:"#e879a0"},
              {label:"ULTA",   val:autoStats.ulta,     color:"#a78bfa"},
              {label:"Amazon", val:autoStats.amazon,   color:"#fbbf24"},
              {label:"AI",     val:autoStats.ai,       color:"#60a5fa"},
              {label:"Failed", val:autoStats.failed,   color:"#f87171"},
            ].filter(s=>s.val>0).map(s=>(
              <div key={s.label} style={{background:"rgba(255,255,255,0.07)",borderRadius:"0.4rem",padding:"0.25rem 0.5rem",textAlign:"center"}}>
                <div style={{fontSize:"0.8rem",fontWeight:"700",color:s.color}}>{s.val}</div>
                <div style={{fontSize:"0.5rem",color:"rgba(255,255,255,0.4)"}}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Manual filler ── */}
      <div style={{display:"flex",gap:"0.5rem",alignItems:"center"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
          style={{flex:1,padding:"0.5rem 0.75rem",border:`1px solid ${T.border}`,borderRadius:"0.6rem",fontSize:"0.72rem",background:T.bg,color:T.text,outline:"none",fontFamily:"'Inter',sans-serif"}}/>
        {["missing","all"].map(f=>(
          <button key={f} onClick={()=>setFilter(f)}
            style={{padding:"0.4rem 0.75rem",borderRadius:"0.5rem",fontSize:"0.65rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",background:filter===f?T.accent:T.surface,color:filter===f?"#fff":T.textMid,border:`1px solid ${filter===f?T.accent:T.border}`}}>
            {f==="missing"?`Missing (${missing.length})`:"All"}
          </button>
        ))}
        {pendingDrafts>0&&(
          <button onClick={saveAll} disabled={bulkSaving}
            style={{padding:"0.4rem 0.75rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.65rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
            {bulkSaving?"Saving…":bulkDone!=null?`✓ Saved ${bulkDone}`:`Save all (${pendingDrafts})`}
          </button>
        )}
      </div>

      {displayed.length===0&&<div style={{textAlign:"center",color:T.textLight,padding:"2rem",fontSize:"0.8rem"}}>{filter==="missing"?"🎉 All products have ingredients!":"No products found."}</div>}

      {displayed.slice(0,50).map(p=>{
        const ing = p.ingredients||"";
        const hasDraft = !!(drafts[p.id]||"").trim();
        const ps = ing.trim().length>10 ? poreStyle(p.poreScore??0) : null;
        return (
          <div key={p.id} style={{background:T.surface,borderRadius:"0.85rem",padding:"0.75rem 0.85rem",border:`1px solid ${hasDraft?T.accent+"44":T.border}`}}>
            <div style={{display:"flex",gap:"0.5rem",alignItems:"flex-start",marginBottom:"0.5rem"}}>
              {(p.adminImage||p.image)&&<img src={p.adminImage||p.image} alt="" style={{width:"36px",height:"36px",objectFit:"contain",borderRadius:"0.3rem",background:"#ffffff",flexShrink:0}}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                <div style={{fontSize:"0.62rem",color:T.textLight}}>{p.brand}{p.scanCount?` · ${p.scanCount} scans`:""}</div>
              </div>
              {ps&&<span style={{fontSize:"0.6rem",padding:"0.15rem 0.4rem",background:ps.color+"18",color:ps.color,borderRadius:"999px",flexShrink:0,fontWeight:"700"}}>Pore {p.poreScore}/5</span>}
            </div>
            {ing.trim().length>10
              ? <div style={{fontSize:"0.6rem",color:T.textLight,lineHeight:1.5,maxHeight:"2.8em",overflow:"hidden"}}>{ing}</div>
              : <>
                  <textarea value={drafts[p.id]||""} onChange={e=>setDrafts(d=>({...d,[p.id]:e.target.value}))}
                    placeholder="Paste full ingredient list here…"
                    rows={2}
                    style={{width:"100%",padding:"0.45rem 0.6rem",border:`1px solid ${hasDraft?T.accent+"66":T.border}`,borderRadius:"0.5rem",fontSize:"0.65rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.bg,resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
                  {hasDraft&&(
                    <button onClick={()=>saveDraft(p.id)} disabled={saving[p.id]}
                      style={{marginTop:"0.35rem",padding:"0.3rem 0.75rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.4rem",fontSize:"0.65rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                      {saving[p.id]?"Saving…":saved[p.id]?"✓ Saved":"Save"}
                    </button>
                  )}
                </>
            }
          </div>
        );
      })}
      {displayed.length>50&&<div style={{textAlign:"center",fontSize:"0.65rem",color:T.textLight,padding:"0.5rem"}}>Showing 50 of {displayed.length} — use search to find specific products</div>}
    </div>
  );
}


// ── AdminIngredientReports — review user-submitted corrections + run full audit ──
function AdminIngredientReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [auditResults, setAuditResults] = useState([]);
  const [auditRunning, setAuditRunning] = useState(false);
  const [auditProgress, setAuditProgress] = useState("");
  const [auditTab, setAuditTab] = useState("reports"); // reports | audit

  useEffect(() => {
    getDocs(query(collection(db, "ingredientReports"), orderBy("createdAt","desc"), limit(50)))
      .then(snap => { setReports(snap.docs.map(d => ({id:d.id,...d.data()}))); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function runAudit() {
    setAuditRunning(true);
    setAuditResults([]);
    setAuditProgress("Loading all products…");
    try {
      const snap = await getDocs(query(collection(db,"products"), limit(500)));
      const products = snap.docs.map(d => ({id:d.id,...d.data()}));
      setAuditProgress(`Checking ${products.length} products…`);

      const issues = [];
      for (let i = 0; i < products.length; i++) {
        const p = products[i];
        if (!p.productName) continue;
        setAuditProgress(`Checking ${i+1}/${products.length}: ${p.productName}`);

        const ingCount = p.ingredients ? p.ingredients.split(",").filter(s=>s.trim()).length : 0;

        // Flag: no ingredients
        if (!p.ingredients || ingCount === 0) {
          issues.push({ id:p.id, name:p.productName, brand:p.brand||"", issue:"No ingredients", severity:"high", current:"", barcode:p.barcode||"" });
          continue;
        }

        // Flag: suspiciously few ingredients (<8)
        if (ingCount < 8) {
          issues.push({ id:p.id, name:p.productName, brand:p.brand||"", issue:`Only ${ingCount} ingredients`, severity:"medium", current:p.ingredients, barcode:p.barcode||"" });
        }

        // Check OBF for this product if it has a barcode
        if (p.barcode && ingCount > 0) {
          try {
            const r = await fetch(`https://world.openbeautyfacts.org/api/v0/product/${p.barcode}.json`, {signal:AbortSignal.timeout(5000)});
            const d = await r.json();
            if (d.status === 1) {
              const obfIng = (d.product?.ingredients_text_en || d.product?.ingredients_text || "").trim();
              if (obfIng) {
                const obfCount = obfIng.split(",").filter(s=>s.trim()).length;
                const diff = Math.abs(obfCount - ingCount);
                // Flag if OBF has significantly more ingredients (>5 more)
                if (obfCount > ingCount + 5) {
                  issues.push({ id:p.id, name:p.productName, brand:p.brand||"", issue:`Missing ~${diff} ingredients (OBF has ${obfCount}, we have ${ingCount})`, severity:"high", current:p.ingredients, suggested:obfIng, barcode:p.barcode });
                }
              }
            }
          } catch {}
        }

        // Small delay to avoid rate limiting
        if (i % 10 === 0) await new Promise(r => setTimeout(r, 200));
      }

      setAuditResults(issues);
      setAuditProgress(`Done — ${issues.length} issue${issues.length!==1?"s":""} found across ${products.length} products`);
    } catch(e) {
      setAuditProgress("Error: " + e.message);
    }
    setAuditRunning(false);
  }

  async function applyOBFIngredients(result) {
    if (!result.suggested) return;
    try {
      await updateDoc(doc(db,"products",result.id), {
        ingredients: result.suggested,
        updatedAt: serverTimestamp(),
        lastVerified: serverTimestamp(),
      });
      setAuditResults(r => r.filter(x => x.id !== result.id));
    } catch(e) { alert("Error: " + e.message); }
  }

  async function resolveReport(report, action) {
    try {
      if (action === "apply") {
        const q = query(collection(db,"products"), where("productName","==",report.productName), limit(1));
        const snap = await getDocs(q);
        if (!snap.empty) {
          await updateDoc(doc(db,"products",snap.docs[0].id), {
            ingredients: report.reportText,
            updatedAt: serverTimestamp(),
            lastVerified: serverTimestamp(),
          });
        }
      }
      await updateDoc(doc(db,"ingredientReports",report.id), {
        status: action==="apply" ? "applied" : "dismissed",
        resolvedAt: serverTimestamp(),
      });
      setReports(r => r.map(x => x.id===report.id ? {...x, status:action==="apply"?"applied":"dismissed"} : x));
    } catch(e) { alert("Error: " + e.message); }
  }

  const pending = reports.filter(r => r.status==="pending");
  const resolved = reports.filter(r => r.status!=="pending");
  const highIssues = auditResults.filter(r => r.severity==="high");
  const medIssues = auditResults.filter(r => r.severity==="medium");

  return (
    <div style={{padding:"0.5rem 0"}}>
      {/* Sub-tabs */}
      <div style={{display:"flex",gap:"0.35rem",marginBottom:"1rem",padding:"0.2rem",background:T.surfaceAlt,borderRadius:"0.5rem"}}>
        {[["reports",`User Reports ${pending.length>0?`(${pending.length})`:""}`,],["audit","Full Audit"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setAuditTab(id)}
            style={{flex:1,padding:"0.45rem",background:auditTab===id?T.surface:"transparent",color:auditTab===id?T.accent:T.textMid,border:auditTab===id?`1px solid ${T.border}`:"1px solid transparent",borderRadius:"0.4rem",fontSize:"0.7rem",fontWeight:auditTab===id?"700":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            {lbl}
          </button>
        ))}
      </div>

      {/* User reports tab */}
      {auditTab==="reports"&&(
        <div>
          {loading && <div style={{textAlign:"center",padding:"2rem",color:T.textLight}}>Loading…</div>}
          {!loading&&pending.length===0&&<div style={{textAlign:"center",padding:"2rem",color:T.textLight,fontSize:"0.82rem"}}>No pending reports ✓</div>}
          {pending.map(r=>(
            <div key={r.id} style={{background:T.surface,borderRadius:"0.85rem",border:`1px solid ${T.amber}44`,padding:"0.85rem",marginBottom:"0.75rem"}}>
              <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.5rem"}}>
                <div>
                  <div style={{fontSize:"0.85rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>{r.productName}</div>
                  <div style={{fontSize:"0.65rem",color:T.textLight}}>{r.brand} · by {r.reporterName||"unknown"}</div>
                </div>
                <span style={{fontSize:"0.55rem",color:T.amber,background:T.amber+"15",padding:"0.15rem 0.45rem",borderRadius:"999px",border:`1px solid ${T.amber}30`,fontWeight:"700",flexShrink:0,marginLeft:"0.5rem"}}>Pending</span>
              </div>
              <div style={{marginBottom:"0.5rem"}}>
                <div style={{fontSize:"0.6rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.25rem"}}>Current</div>
                <div style={{fontSize:"0.68rem",color:T.textMid,background:T.surfaceAlt,padding:"0.5rem",borderRadius:"0.4rem",lineHeight:1.5,maxHeight:"60px",overflowY:"auto"}}>{r.currentIngredients||"None"}</div>
              </div>
              <div style={{marginBottom:"0.75rem"}}>
                <div style={{fontSize:"0.6rem",color:T.sage,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.25rem"}}>Suggested</div>
                <div style={{fontSize:"0.68rem",color:T.text,background:T.sage+"08",padding:"0.5rem",borderRadius:"0.4rem",border:`1px solid ${T.sage}20`,lineHeight:1.5,maxHeight:"80px",overflowY:"auto"}}>{r.reportText}</div>
              </div>
              <div style={{display:"flex",gap:"0.5rem"}}>
                <button onClick={()=>resolveReport(r,"apply")} style={{flex:1,padding:"0.55rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.55rem",fontSize:"0.75rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✓ Apply</button>
                <button onClick={()=>resolveReport(r,"dismiss")} style={{flex:1,padding:"0.55rem",background:T.surfaceAlt,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.55rem",fontSize:"0.75rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Dismiss</button>
              </div>
            </div>
          ))}
          {resolved.length>0&&(
            <div style={{marginTop:"1rem"}}>
              <div style={{fontSize:"0.62rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.5rem"}}>Resolved ({resolved.length})</div>
              {resolved.map(r=>(
                <div key={r.id} style={{display:"flex",alignItems:"center",gap:"0.5rem",padding:"0.5rem 0.65rem",background:T.surfaceAlt,borderRadius:"0.55rem",marginBottom:"0.35rem"}}>
                  <span style={{fontSize:"0.65rem",fontWeight:"700",color:r.status==="applied"?T.sage:T.textLight}}>{r.status==="applied"?"✓ Applied":"Dismissed"}</span>
                  <span style={{fontSize:"0.72rem",color:T.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.productName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Full audit tab */}
      {auditTab==="audit"&&(
        <div>
          <button onClick={runAudit} disabled={auditRunning}
            style={{width:"100%",padding:"0.75rem",background:auditRunning?T.surfaceAlt:T.navy,color:auditRunning?T.textLight:"#fff",border:"none",borderRadius:"0.75rem",fontSize:"0.85rem",fontWeight:"700",cursor:auditRunning?"not-allowed":"pointer",fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem",display:"flex",alignItems:"center",justifyContent:"center",gap:"0.5rem"}}>
            {auditRunning&&<div style={{width:"12px",height:"12px",borderRadius:"50%",border:"2px solid #fff",borderTopColor:"transparent",animation:"spin 0.7s linear infinite"}}/>}
            {auditRunning?"Running audit…":"Run Full Ingredient Audit"}
          </button>

          {auditProgress&&(
            <div style={{fontSize:"0.72rem",color:T.textLight,textAlign:"center",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>{auditProgress}</div>
          )}

          {auditResults.length>0&&(
            <div>
              <div style={{display:"flex",gap:"0.5rem",marginBottom:"0.75rem"}}>
                <div style={{flex:1,padding:"0.65rem",background:T.rose+"10",borderRadius:"0.65rem",border:`1px solid ${T.rose}25`,textAlign:"center"}}>
                  <div style={{fontSize:"1.4rem",fontWeight:"800",color:T.rose,fontFamily:"'Inter',sans-serif"}}>{highIssues.length}</div>
                  <div style={{fontSize:"0.6rem",color:T.rose,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>High priority</div>
                </div>
                <div style={{flex:1,padding:"0.65rem",background:T.amber+"10",borderRadius:"0.65rem",border:`1px solid ${T.amber}25`,textAlign:"center"}}>
                  <div style={{fontSize:"1.4rem",fontWeight:"800",color:T.amber,fontFamily:"'Inter',sans-serif"}}>{medIssues.length}</div>
                  <div style={{fontSize:"0.6rem",color:T.amber,fontWeight:"600",textTransform:"uppercase",letterSpacing:"0.05em"}}>Low confidence</div>
                </div>
              </div>

              {[["high","🔴 High Priority — Missing or mismatched ingredients",T.rose],["medium","🟡 Low Confidence — Fewer than 8 ingredients",T.amber]].map(([sev,label,color])=>{
                const items = auditResults.filter(r=>r.severity===sev);
                if (!items.length) return null;
                return (
                  <div key={sev} style={{marginBottom:"1rem"}}>
                    <div style={{fontSize:"0.65rem",fontWeight:"700",color,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:"0.5rem",fontFamily:"'Inter',sans-serif"}}>{label}</div>
                    {items.map(r=>(
                      <div key={r.id} style={{background:T.surface,borderRadius:"0.75rem",border:`1px solid ${color}33`,padding:"0.75rem",marginBottom:"0.5rem"}}>
                        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:"0.4rem"}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:"0.82rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
                            <div style={{fontSize:"0.62rem",color:T.textLight}}>{r.brand}</div>
                          </div>
                          <span style={{fontSize:"0.58rem",color,background:color+"12",padding:"0.12rem 0.45rem",borderRadius:"999px",border:`1px solid ${color}30`,fontWeight:"700",flexShrink:0,marginLeft:"0.5rem"}}>{r.issue}</span>
                        </div>
                        {r.current&&(
                          <div style={{fontSize:"0.65rem",color:T.textMid,background:T.surfaceAlt,padding:"0.35rem 0.5rem",borderRadius:"0.4rem",marginBottom:"0.4rem",lineHeight:1.4,maxHeight:"45px",overflowY:"auto"}}>{r.current}</div>
                        )}
                        {r.suggested&&(
                          <>
                            <div style={{fontSize:"0.6rem",color:T.sage,fontWeight:"600",marginBottom:"0.2rem"}}>OBF suggests ({r.suggested.split(",").length} ingredients):</div>
                            <div style={{fontSize:"0.65rem",color:T.text,background:T.sage+"08",padding:"0.35rem 0.5rem",borderRadius:"0.4rem",border:`1px solid ${T.sage}20`,marginBottom:"0.5rem",lineHeight:1.4,maxHeight:"55px",overflowY:"auto"}}>{r.suggested}</div>
                            <button onClick={()=>applyOBFIngredients(r)}
                              style={{width:"100%",padding:"0.5rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.75rem",fontWeight:"700",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
                              Apply OBF ingredients
                            </button>
                          </>
                        )}
                        {!r.suggested&&(
                          <div style={{fontSize:"0.65rem",color:T.textLight,fontStyle:"italic"}}>No OBF data available — update manually in All Products</div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AdminDashboard({user, afRunning, afLog, afDone, afProducts, setAfRunning, setAfLog, setAfDone, setAfProducts, afAddLog}) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(()=>{
    getAdminStats().then(s=>{ setStats(s); setLoading(false); }).catch(e=>{ console.error("getAdminStats error:",e); setLoading(false); });
  },[]);

  if (!isAdmin(user)) return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"3rem 1rem",textAlign:"center"}}>
      
      <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"600",color:T.textMid,marginBottom:"0.5rem"}}>Admin only</div>
      <div style={{fontSize:"0.78rem",color:T.textLight,marginBottom:"1rem"}}>Add your UID to ADMIN_UIDS in the code to access this.</div>
      <div style={{fontSize:"0.68rem",color:T.textLight,background:T.surface,padding:"0.5rem 0.75rem",borderRadius:"0.5rem",border:`1px solid ${T.border}`,fontFamily:"monospace",wordBreak:"break-all"}}>{user?.uid}</div>
    </div>
  );

  if (loading) return <div style={{padding:"3rem",textAlign:"center",color:T.textLight}}>Loading stats…</div>;
  if (!stats) return <div style={{padding:"3rem",textAlign:"center",color:T.textLight}}>Could not load stats — check console for errors.</div>;

  const maxDay = Math.max(...(stats.daily.map(([,v])=>v)||[1]),1);

  return (
    <div style={{maxWidth:"480px",margin:"0 auto",padding:"1rem 1rem 6rem"}}>
      <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"700",fontSize:"1.1rem",color:T.text,letterSpacing:"-0.02em",marginBottom:"0.25rem"}}>Admin Dashboard</div>
      <div style={{fontSize:"0.72rem",color:T.textLight,marginBottom:"1.25rem"}}>Ralli analytics</div>

      {/* Tab switcher — Row 1: main sections */}
      <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.3rem",background:T.surfaceAlt,padding:"0.25rem",borderRadius:"0.6rem"}}>
        {[["overview","📊 Overview"],["products","🏪 Products"],["content","✏️ Content"]].map(([id,lbl])=>(
          <button key={id} onClick={()=>setActiveTab(id)}
            style={{flex:1,padding:"0.5rem 0.25rem",background:activeTab===id?T.accent:"transparent",color:activeTab===id?"#FFFFFF":T.textMid,border:"none",borderRadius:"0.4rem",fontSize:"0.68rem",fontWeight:activeTab===id?"600":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>
            {lbl}
          </button>
        ))}
      </div>
      {/* Row 2: sub-tabs that change based on active section */}

      {activeTab==="content"&&(
        <div style={{display:"flex",gap:"0.25rem",marginBottom:"0.9rem",padding:"0.2rem",background:T.surfaceAlt+"80",borderRadius:"0.5rem"}}>
          {[["schedule","📅 Schedule"],["picks","💛 Founder Picks"]].map(([id,lbl])=>(
            <button key={id} onClick={()=>setActiveTab(id)}
              style={{flex:1,padding:"0.38rem 0.2rem",background:activeTab===id?T.surface:"transparent",color:activeTab===id?T.accent:T.textMid,border:activeTab===id?`1px solid ${T.border}`:"1px solid transparent",borderRadius:"0.4rem",fontSize:"0.6rem",fontWeight:activeTab===id?"600":"400",cursor:"pointer",fontFamily:"'Inter',sans-serif",boxShadow:activeTab===id?"0 1px 3px rgba(0,0,0,0.06)":"none"}}>
              {lbl}
            </button>
          ))}
        </div>
      )}
      {activeTab==="overview"&&<div style={{marginBottom:"0.9rem"}}/>}

      {/* Products — single hub */}
      {activeTab==="products"&&<AdminProductHub/>}
      {/* Content sub-tabs */}
      {activeTab==="schedule"&&<EditorialCalendar/>}
      {activeTab==="picks"&&<AdminFounderPicks/>}

      {activeTab==="overview"&&(
        <div style={{display:"flex",flexDirection:"column",gap:"0.75rem"}}>
          {/* Stat cards */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.6rem"}}>
            {[
              {label:"Total Checks", value:stats.totalPosts, color:T.sage, icon:""},
              {label:"Users", value:stats.totalUsers, color:T.accent, icon:""},
              {label:"Total Likes", value:stats.totalLikes, color:T.rose, icon:""},
              {label:"Avg Rating", value:stats.avgRating+"/10", color:T.amber, icon:""},
            ].map(s=>(
              <div key={s.label} style={{background:T.surface,borderRadius:"1rem",padding:"1rem",border:`1px solid ${T.border}`}}>
                <div style={{fontSize:"1.25rem",marginBottom:"0.35rem"}}>{s.icon}</div>
                <div style={{fontSize:"1.5rem",fontWeight:"800",color:s.color,fontFamily:"'Inter',sans-serif",lineHeight:1}}>{s.value}</div>
                <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"0.2rem",textTransform:"uppercase",letterSpacing:"0.05em"}}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Activity bar chart */}
          <div style={{background:T.surface,borderRadius:"1rem",padding:"1rem",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>Checks — last 14 days</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:"3px",height:"60px"}}>
              {stats.daily.map(([date,count])=>(
                <div key={date} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"3px"}}>
                  <div style={{width:"100%",background:count>0?T.accent:T.surfaceAlt,borderRadius:"2px 2px 0 0",height:`${Math.max((count/maxDay)*52,count>0?4:2)}px`,transition:"height 0.3s"}}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:"4px"}}>
              <span style={{fontSize:"0.5rem",color:T.textLight}}>{stats.daily[0]?.[0]}</span>
              <span style={{fontSize:"0.5rem",color:T.textLight}}>{stats.daily[stats.daily.length-1]?.[0]}</span>
            </div>
          </div>

          {/* Hourly activity heatmap */}
          {stats.hourly&&(
          <div style={{background:T.surface,borderRadius:"1rem",padding:"1rem",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>When your users are active — by hour</div>
            <div style={{display:"flex",alignItems:"flex-end",gap:"2px",height:"52px"}}>
              {stats.hourly.map((count,h)=>{
                const maxH = Math.max(...stats.hourly, 1);
                const pct = count/maxH;
                const isNight = h < 6 || h >= 22;
                const isMorning = h >= 6 && h < 12;
                const isAfternoon = h >= 12 && h < 17;
                const isEvening = h >= 17 && h < 22;
                const color = isNight?T.navy:isMorning?T.amber:isAfternoon?T.accent:T.rose;
                return (
                  <div key={h} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:"2px",cursor:"default"}} title={`${h}:00 — ${count} scans`}>
                    <div style={{width:"100%",background:count>0?color:T.surfaceAlt,borderRadius:"2px 2px 0 0",height:`${Math.max(pct*46,count>0?3:2)}px`,transition:"height 0.4s",opacity:count>0?0.85+pct*0.15:0.3}}/>
                    {h%6===0&&<div style={{fontSize:"0.42rem",color:T.textLight,marginTop:"1px"}}>{h===0?"12am":h===6?"6am":h===12?"12pm":"6pm"}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{display:"flex",gap:"0.75rem",marginTop:"0.6rem",flexWrap:"wrap"}}>
              {[["🌙 Night (10pm–6am)",T.navy],["🌅 Morning (6–12pm)",T.amber],["☀️ Afternoon (12–5pm)",T.accent],["🌆 Evening (5–10pm)",T.rose]].map(([lbl,col])=>(
                <div key={lbl} style={{display:"flex",alignItems:"center",gap:"0.25rem"}}>
                  <div style={{width:"7px",height:"7px",borderRadius:"2px",background:col}}/>
                  <span style={{fontSize:"0.55rem",color:T.textLight}}>{lbl}</span>
                </div>
              ))}
            </div>
          </div>
          )}

          {/* Demographics */}
          {stats.totalUsersCount > 0 &&(
          <div style={{background:T.surface,borderRadius:"1rem",padding:"1rem",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.75rem",fontFamily:"'Inter',sans-serif"}}>User demographics</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.75rem"}}>
              {/* Skin types */}
              <div>
                <div style={{fontSize:"0.6rem",color:T.textMid,fontWeight:"600",marginBottom:"0.45rem",fontFamily:"'Inter',sans-serif"}}>Skin types <span style={{fontWeight:"400",color:T.textLight}}>({stats.withSkinType}/{stats.totalUsersCount} users)</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                  {Object.keys(stats.skinTypeCounts||{}).length === 0
                    ? <div style={{fontSize:"0.65rem",color:T.textLight,fontStyle:"italic"}}>No data yet — collected during onboarding</div>
                    : Object.entries(stats.skinTypeCounts).sort((a,b)=>b[1]-a[1]).map(([type,count])=>{
                    const total = Math.max(stats.withSkinType,1);
                    const pct = Math.round(count/total*100);
                    return (
                      <div key={type}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}>
                          <span style={{fontSize:"0.62rem",color:T.text,fontFamily:"'Inter',sans-serif"}}>{type}</span>
                          <span style={{fontSize:"0.6rem",color:T.textLight}}>{pct}%</span>
                        </div>
                        <div style={{height:"4px",background:T.surfaceAlt,borderRadius:"999px",overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:T.accent,borderRadius:"999px",transition:"width 0.6s"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Concerns */}
              <div>
                <div style={{fontSize:"0.6rem",color:T.textMid,fontWeight:"600",marginBottom:"0.45rem",fontFamily:"'Inter',sans-serif"}}>Top concerns <span style={{fontWeight:"400",color:T.textLight}}>({stats.withConcerns}/{stats.totalUsersCount} users)</span></div>
                <div style={{display:"flex",flexDirection:"column",gap:"0.3rem"}}>
                  {Object.keys(stats.concernCounts||{}).length === 0
                    ? <div style={{fontSize:"0.65rem",color:T.textLight,fontStyle:"italic"}}>No data yet — collected during onboarding</div>
                    : Object.entries(stats.concernCounts).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([concern,count])=>{
                    const total = Math.max(stats.withConcerns,1);
                    const pct = Math.round(count/total*100);
                    return (
                      <div key={concern}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"2px"}}>
                          <span style={{fontSize:"0.62rem",color:T.text,fontFamily:"'Inter',sans-serif"}}>{concern}</span>
                          <span style={{fontSize:"0.6rem",color:T.textLight}}>{pct}%</span>
                        </div>
                        <div style={{height:"4px",background:T.surfaceAlt,borderRadius:"999px",overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:T.rose,borderRadius:"999px",transition:"width 0.6s"}}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {/* Pronouns row */}
            {stats.withPronoun > 0 && (
              <div style={{marginTop:"0.75rem",paddingTop:"0.75rem",borderTop:`1px solid ${T.border}`}}>
                <div style={{fontSize:"0.6rem",color:T.textMid,fontWeight:"600",marginBottom:"0.45rem",fontFamily:"'Inter',sans-serif"}}>
                  Pronouns <span style={{fontWeight:"400",color:T.textLight}}>({stats.withPronoun}/{stats.totalUsersCount} shared)</span>
                </div>
                <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                  {Object.entries(stats.pronounCounts||{}).sort((a,b)=>b[1]-a[1]).map(([p,count])=>{
                    const pct = Math.round(count/Math.max(stats.withPronoun,1)*100);
                    const emoji = p==="she/her"?"🌸":p==="he/him"?"🌊":"🌿";
                    return (
                      <div key={p} style={{background:T.surfaceAlt,borderRadius:"0.6rem",padding:"0.45rem 0.75rem",textAlign:"center",border:`1px solid ${T.border}`,flex:1}}>
                        <div style={{fontSize:"1.1rem",marginBottom:"2px"}}>{emoji}</div>
                        <div style={{fontSize:"0.8rem",fontWeight:"700",color:T.text,fontFamily:"'Inter',sans-serif"}}>{pct}%</div>
                        <div style={{fontSize:"0.58rem",color:T.textLight}}>{p} · {count}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          )}

          {/* Top scanned products */}
          <div style={{background:T.surface,borderRadius:"1rem",padding:"1rem",border:`1px solid ${T.border}`}}>
            <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"0.65rem",fontFamily:"'Inter',sans-serif"}}>Top scanned products</div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.35rem"}}>
              {stats.topProducts.slice(0,8).map((p,i)=>{
                const ps=poreStyle(Math.round(p.avgPore||0));
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:"0.5rem"}}>
                    <div style={{fontSize:"0.58rem",color:T.textLight,width:"14px",flexShrink:0,textAlign:"right"}}>#{i+1}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:"0.7rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                      <div style={{fontSize:"0.58rem",color:T.textLight}}>{p.brand}</div>
                    </div>
                    <div style={{fontSize:"0.6rem",color:T.textMid,flexShrink:0}}>{p.scans} scans</div>
                    {p.avgPore!=null&&<span style={{fontSize:"0.58rem",padding:"0.1rem 0.35rem",background:ps.color+"18",color:ps.color,borderRadius:"999px",flexShrink:0}}>{p.avgPore}/5</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent posts */}
          <div style={{background:T.surface,borderRadius:"0.75rem",border:`1px solid ${T.border}`,overflow:"hidden"}}>
            <div style={{padding:"0.75rem 1rem",borderBottom:`1px solid ${T.border}`,fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif"}}>Recent activity</div>
            {stats.recentPosts.map((p,i)=>(
              <div key={p.id} style={{padding:"0.6rem 1rem",borderBottom:i<stats.recentPosts.length-1?`1px solid ${T.border}`:"none",display:"flex",alignItems:"center",gap:"0.6rem"}}>
                <div style={{width:"6px",height:"6px",borderRadius:"50%",background:poreStyle(p.poreScore||0).color,flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"0.75rem",fontWeight:"600",color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.productName}</div>
                  <div style={{fontSize:"0.62rem",color:T.textLight}}>{p.displayName} · pore {p.poreScore||0}/5{p.communityRating?` · rated ${p.communityRating}/10`:""}</div>
                </div>
                <button onClick={async()=>{
                  if(!confirm(`Delete "${p.productName}" by ${p.displayName}?`)) return;
                  try {
                    await deleteDoc(doc(db,"posts",p.id));
                    setStats(s=>({...s, recentPosts: s.recentPosts.filter(x=>x.id!==p.id)}));
                  } catch(e){ alert("Delete failed: "+e.message); }
                }}
                  style={{flexShrink:0,background:"none",border:`1px solid ${T.border}`,borderRadius:"0.4rem",padding:"0.2rem 0.45rem",cursor:"pointer",color:T.rose,fontSize:"0.65rem",fontFamily:"'Inter',sans-serif",lineHeight:1}}>
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}





    </div>
  );
}

// ── Admin: Product Requests Tab ────────────────────────────────
function AdminRequestsTab() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(()=>{
    async function load() {
      try {
        const snap = await getDocs(query(collection(db,"product_requests"), orderBy("createdAt","desc"), limit(100)));
        setRequests(snap.docs.map(d=>({id:d.id,...d.data()})));
      } catch(e) { console.error(e); }
      setLoading(false);
    }
    load();
  },[]);

  async function dismiss(id) {
    try {
      await deleteDoc(doc(db,"product_requests",id));
      setDismissed(s=>new Set([...s,id]));
    } catch(e) { alert("Failed to dismiss."); }
  }

  const visible = requests.filter(r=>!dismissed.has(r.id));

  if (loading) return <div style={{padding:"2rem",textAlign:"center",color:T.textLight,fontSize:"0.82rem"}}>Loading…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.25rem"}}>
        <div style={{fontSize:"0.65rem",color:T.textLight,textTransform:"uppercase",letterSpacing:"0.07em",fontFamily:"'Inter',sans-serif"}}>Product requests from users</div>
        <div style={{fontSize:"0.65rem",color:T.textMid,fontWeight:"600"}}>{visible.length} pending</div>
      </div>

      {visible.length===0&&(
        <div style={{background:T.surface,borderRadius:"1rem",padding:"2rem",border:`1px solid ${T.border}`,textAlign:"center",color:T.textLight,fontSize:"0.82rem"}}>
          No pending requests 🎉
        </div>
      )}

      {visible.map(r=>(
        <div key={r.id} style={{background:T.surface,borderRadius:"1rem",padding:"0.9rem 1rem",border:`1px solid ${T.border}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:"0.75rem"}}>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.name}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"2px"}}>
              {r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : "Recently"}
              {r.uid&&<span style={{marginLeft:"0.5rem",fontFamily:"monospace"}}>{r.uid.slice(0,8)}…</span>}
            </div>
          </div>
          <div style={{display:"flex",gap:"0.4rem",flexShrink:0}}>
            <a href={`https://www.google.com/search?q=${encodeURIComponent(r.name+" skincare ingredients")}`}
              target="_blank" rel="noopener noreferrer"
              style={{fontSize:"0.68rem",padding:"0.35rem 0.65rem",background:T.iceBlue,color:T.navy,borderRadius:"0.5rem",fontWeight:"600",fontFamily:"'Inter',sans-serif",textDecoration:"none",border:"none",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:"0.25rem"}}>
              Search →
            </a>
            <button onClick={()=>dismiss(r.id)}
              style={{fontSize:"0.68rem",padding:"0.35rem 0.65rem",background:T.surfaceAlt,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontWeight:"600",fontFamily:"'Inter',sans-serif",cursor:"pointer"}}>
              Dismiss
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Contacts-based follow suggestions ─────────────────────────
function ContactSuggestions({currentUid, currentProfile, onFollow, onUserTap}) {
  const [suggestions, setSuggestions] = useState([]);
  const [followed, setFollowed] = useState(new Set());

  useEffect(()=>{
    async function load() {
      try {
        const snap = await getDocs(collection(db,"users"));
        const already = new Set([...(currentProfile?.following||[]), currentUid]);
        const all = snap.docs
          .map(d=>({uid:d.id,...d.data()}))
          .filter(u=> u.uid && !already.has(u.uid) && u.displayName)
          .map(u=>({...u, followerCount:(u.followers||[]).length}))
          .sort((a,b)=>b.followerCount-a.followerCount)
          .slice(0,8);
        setSuggestions(all);
      } catch(e) { console.error("suggestions",e); }
    }
    load();
  },[currentUid]);

  async function handleFollow(uid) {
    await onFollow(uid);
    setFollowed(prev=>new Set([...prev,uid]));
  }

  if (!suggestions.length) return null;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      {suggestions.map(u=>(
        <div key={u.uid} style={{background:T.surface,borderRadius:"0.85rem",border:`1px solid ${followed.has(u.uid)?T.sage:T.border}`,padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.75rem",transition:"border-color 0.2s"}}>
          <button onClick={()=>onUserTap(u.uid)} style={{background:"none",border:"none",padding:0,cursor:"pointer",flexShrink:0}}>
            <Avatar photoURL={u.photoURL} name={u.displayName} size={38}/>
          </button>
          <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUserTap(u.uid)}>
            <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.displayName}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>
              {u.followerCount>0?`${u.followerCount} follower${u.followerCount!==1?"s":""}` : "New to Ralli"}
            </div>
          </div>
          <button onClick={()=>!followed.has(u.uid)&&handleFollow(u.uid)}
            style={{padding:"0.35rem 0.85rem",background:followed.has(u.uid)?T.sage+"22":"transparent",color:followed.has(u.uid)?T.sage:T.navy,border:`1.5px solid ${followed.has(u.uid)?T.sage:T.navy}`,borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",cursor:followed.has(u.uid)?"default":"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0,transition:"all 0.2s"}}>
            {followed.has(u.uid)?"✓ Following":"Follow"}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Following list ─────────────────────────────────────────────
function FollowingList({uids, currentUid, onUserTap, onUnfollow}) {
  const [users, setUsers] = useState([]);
  const [unfollowed, setUnfollowed] = useState(new Set());

  useEffect(()=>{
    if (!uids.length) return;
    Promise.all(uids.map(uid=>
      getDoc(doc(db,"users",uid)).then(d=>d.exists()?{uid:d.id,...d.data()}:null).catch(()=>null)
    )).then(results=>setUsers(results.filter(Boolean)));
  },[uids.join(",")]);

  if (!users.length) return <div style={{textAlign:"center",padding:"1rem",color:T.textLight,fontSize:"0.78rem"}}>Loading…</div>;

  return (
    <div style={{display:"flex",flexDirection:"column",gap:"0.5rem"}}>
      {users.filter(u=>!unfollowed.has(u.uid)).map(u=>(
        <div key={u.uid} style={{background:T.surface,borderRadius:"0.85rem",border:`1px solid ${T.border}`,padding:"0.65rem 0.85rem",display:"flex",alignItems:"center",gap:"0.75rem"}}>
          <div onClick={()=>onUserTap(u.uid)} style={{cursor:"pointer",flexShrink:0}}>
            <Avatar photoURL={u.photoURL} name={u.displayName} size={40}/>
          </div>
          <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>onUserTap(u.uid)}>
            <div style={{fontSize:"0.85rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{u.displayName}</div>
            <div style={{fontSize:"0.65rem",color:T.textLight,marginTop:"1px"}}>{(u.followers||[]).length} followers</div>
          </div>
          <button onClick={async()=>{ await onUnfollow(u.uid); setUnfollowed(prev=>new Set([...prev,u.uid])); }}
            style={{padding:"0.35rem 0.75rem",background:"transparent",color:T.textLight,border:`1px solid ${T.border}`,borderRadius:"999px",fontSize:"0.7rem",fontWeight:"500",cursor:"pointer",fontFamily:"'Inter',sans-serif",flexShrink:0}}>
            Unfollow
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Bottom Nav ────────────────────────────────────────────────
// ── Daily rotating brand message ─────────────────────────────
const DAILY_MESSAGES = [
  "Real people. Real skin. Real insights.",
  "Know what's really in your routine.",
  "Your skin deserves the truth.",
  "Data-driven. Community-powered.",
  "Ingredients don't lie.",
  "Clarity starts with the label.",
  "Smarter skin starts here.",
  "Decode before you apply.",
  "Real people. Real results.",
  "Science, not marketing.",
  "Your routine. Your rules.",
  "Know before you glow.",
  "Less guessing. More glowing.",
  "The community that checks ingredients.",
  "Together we decode skincare.",
  "Transparent beauty starts here.",
  "Read the label. Love your skin.",
  "Built by skincare obsessives.",
  "No fluff. Just facts.",
  "Skincare intelligence for everyone.",
  "What works. What doesn't.",
  "Formulated for the curious.",
  "Trust your skin, not the hype.",
  "Beauty backed by data.",
  "Your daily ingredient check.",
  "Clean formulas. Clear skin.",
  "Scan it. Know it. Love it.",
  "The honest skincare community.",
];

function getDailyMessage() {
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  return DAILY_MESSAGES[dayOfYear % DAILY_MESSAGES.length];
}

function getDayIndex() {
  return Math.floor(Date.now() / 86400000);
}

function getWeekIndex() {
  return Math.floor(Date.now() / (86400000 * 7));
}

// Brand taglines — shown under the brand name
// ── Brand blurbs — why each brand is pore-safe ───────────────
const BRAND_BLURBS = {
  "cerave":            {blurb:"Every formula built around ceramides, hyaluronic acid, and niacinamide. Developed with dermatologists and free of pore-clogging fillers — the gold standard for acne-prone skin.", founder:"Founded by dermatologists who wanted effective skincare accessible to everyone."},
  "la roche-posay":    {blurb:"French pharmacy staple backed by 90,000+ dermatologists. Their Effaclar line is one of the most clinically studied for acne and congestion — minimal ingredients, maximum results.", founder:"Born from a natural thermal spring in France, trusted by dermatologists for sensitive skin."},
  "the ordinary":      {blurb:"Stripped-back formulas that list every active ingredient front and centre. No fillers, no hidden comedogenics — just science at a price that doesn't punish you for caring about your skin.", founder:"Launched by Brandon Truaxe to democratise clinical skincare. Changed the industry forever."},
  "paula's choice":    {blurb:"Paula Begoun spent decades exposing misleading beauty claims. Her products are fragrance-free, tested non-comedogenic, and backed by peer-reviewed research — rare in this industry.", founder:"Paula Begoun — the 'Cosmetics Cop' — built this brand to prove skincare doesn't need gimmicks."},
  "cosrx":             {blurb:"Korean brand that popularised low-pH cleansing and snail mucin. Every product is formulated to be gentle on the barrier while targeting real concerns. A community favourite for acne-prone skin.", founder:"South Korean brand founded on the principle that effective skincare should be gentle, not harsh."},
  "vanicream":         {blurb:"The strictest no-list in skincare — no dyes, no fragrance, no parabens, no formaldehyde releasers. Created for patients with the most reactive skin. If your skin reacts to everything, start here.", founder:"Developed by pharmacists for patients with severe skin sensitivities and eczema."},
  "neutrogena":        {blurb:"The dermatologist's drugstore recommendation for over 60 years. Their oil-free and non-comedogenic formulas are clinically tested and consistently deliver clean labels at accessible prices.", founder:"Originally a soap company, Neutrogena became America's #1 dermatologist-recommended skincare brand."},
  "elta md":           {blurb:"The #1 sunscreen brand recommended by US dermatologists. Their UV Clear SPF 46 combines zinc oxide with niacinamide — the most prescribed SPF for acne-prone and post-procedure skin.", founder:"Professional-grade formulas originally developed for post-procedure skin recovery in clinics."},
  "drunk elephant":    {blurb:"Biocompatible philosophy — every ingredient either directly benefits the skin or supports the formula. They exclude the 'Suspicious 6' — essential oils, drying alcohols, silicones, fragrance, SLS, and chemical sunscreens.", founder:"Founded by Tiffany Masterson, who reformulated her own skincare after struggling with reactive skin."},
  "skinceuticals":     {blurb:"The brand that pioneered vitamin C serums with the Ferulic patent. Their formulas are developed alongside dermatology researchers — sold in clinics because they actually work at the ingredient level.", founder:"Founded by scientist Sheldon Pinnell, whose research on antioxidants in skincare became industry standard."},
  "cetaphil":          {blurb:"Formulated specifically for sensitive skin since 1947. Minimal ingredients, no unnecessary actives, no fragrance — ideal as a base routine for anyone building back a compromised barrier.", founder:"Created by a pharmacist in Texas as a gentle alternative to harsh medical skin preparations."},
  "avène":             {blurb:"Built around Avène thermal spring water — clinically shown to reduce skin sensitivity and irritation. The go-to brand for reactive, rosacea-prone, and post-procedure skin in French dermatology.", founder:"French thermal spa brand turned dermatological skincare, trusted in European clinics for decades."},
  "bioderma":          {blurb:"Invented micellar water. Their Sensibio line is formulated to mimic the skin's own natural composition — used in hospitals and by dermatologists across Europe for the gentlest possible cleansing.", founder:"French lab founded on the principle of biological dermatology — working with skin, not against it."},
  "naturium":          {blurb:"Honest labelling, clinical actives, drugstore prices. Susan Yara built this brand to prove you don't need to spend more to get proven ingredients like niacinamide, retinol, and vitamin C.", founder:"Founded by beauty journalist Susan Yara and entrepreneur Nick Axelrod to make effective skincare affordable."},
  "the inkey list":    {blurb:"UK brand that matches The Ordinary's transparency but adds a layer of education. Every product tells you exactly what it does and why — perfect for building a non-comedogenic routine from scratch.", founder:"Founded by Mark Curry and Colette Laxton to educate consumers about ingredients, not just sell products."},
  "purito":            {blurb:"Korean brand with a hypoallergenic-first philosophy. Everything is tested for irritation and designed to strengthen the barrier — their centella range is among the best for sensitive, breakout-prone skin.", founder:"South Korean brand dedicated to creating clean, minimalist formulas free from common irritants."},
  "round lab":         {blurb:"Uses Dokdo Island deep-sea water and minimal ingredient lists. Their barrier-strengthening approach is gentle enough for the most sensitive skin while still being genuinely effective.", founder:"K-beauty brand built on the pure mineral water of Dokdo Island, South Korea."},
  "some by mi":        {blurb:"The '30 Days Miracle' line uses a rare trio of AHA, BHA, and PHA together — exfoliating while maintaining the barrier. Cult K-beauty brand for clearing congestion gently over time.", founder:"South Korean brand that went viral for their visible results-focused formulations."},
  "beauty of joseon":  {blurb:"Revives traditional Korean hanbang (herbal medicine) ingredients in modern formulas. Their rice and ginseng serums are non-comedogenic and genuinely effective — a quieter alternative to trendy K-beauty.", founder:"Korean brand inspired by the skincare rituals of Joseon Dynasty court women."},
  "first aid beauty":  {blurb:"Clean beauty with colloidal oatmeal at the centre. FAB Ultra Repair Cream is one of the most recommended products for damaged, eczema-prone skin — and their formulas avoid the usual irritant suspects.", founder:"Founded by Lilli Gordon for people with sensitive, reactive skin who couldn't find clean products that worked."},
  "innisfree":         {blurb:"Jeju Island ingredients — green tea, volcanic clusters, orchid — in lightweight formulas that rarely clog. Their green tea line has been a non-comedogenic favourite for combination skin for over a decade.", founder:"South Korean brand born from the natural ecosystem of Jeju Island, sustainability-focused from day one."},
};


const BRAND_PALETTE={"cerave":{bg:"linear-gradient(135deg,#1a3a5c,#0f2236)",accent:"#7EC8E3"},"la roche-posay":{bg:"linear-gradient(135deg,#1B3F6E,#0d2440)",accent:"#A8C8F0"},"the ordinary":{bg:"linear-gradient(135deg,#1a1a1a,#2d2d2d)",accent:"#BBBBBB"},"paula's choice":{bg:"linear-gradient(135deg,#2C1810,#4a2818)",accent:"#E8A87C"},"cosrx":{bg:"linear-gradient(135deg,#1a3320,#0f2015)",accent:"#7EC89A"},"drunk elephant":{bg:"linear-gradient(135deg,#5C2D0E,#3a1a08)",accent:"#F4A460"},"neutrogena":{bg:"linear-gradient(135deg,#003366,#001833)",accent:"#66A3CC"},"elta md":{bg:"linear-gradient(135deg,#1a4a3a,#0d2520)",accent:"#7EC8A8"},"clearstem":{bg:"linear-gradient(135deg,#2a1a3a,#1a0d28)",accent:"#C8A8E8"},"tatcha":{bg:"linear-gradient(135deg,#3D1A3A,#210d20)",accent:"#D4A8C8"},"naturium":{bg:"linear-gradient(135deg,#1a3a1a,#0d200d)",accent:"#88C888"}};
function getBrandPalette(brand){const k=(brand||"").toLowerCase().trim();return BRAND_PALETTE[k]||{bg:"linear-gradient(135deg,#111827,#0C1220)",accent:"#CFE8FF"};}
function getBrandBlurb(brand) {
  const key = (brand || "").toLowerCase().trim();
  return BRAND_BLURBS[key] || null;
}

function getBrandTagline(brand) {
  const blurb = getBrandBlurb(brand);
  if (blurb) return blurb.blurb;
  const key = (brand || "").toLowerCase().trim();
  const legacy = {
    "tatcha":"Japanese skincare rituals, modernized.",
    "olay":"Decades of skin science. Millions of fans.",
    "aveeno":"Powered by nature. Proven by science.",
    "kiehl's":"Formulated with the finest natural ingredients.",
    "origins":"High-performance natural ingredients.",
    "belif":"Honest ingredients. Honest results.",
  };
  return legacy[key] || "Community-verified skincare.";
}

// ── Brand of the Week ─────────────────────────────────────────
function BrandOfTheWeek({onBrandTap}) {
  const [brandData, setBrandData] = useState(null); // {name, safeCount, totalCount, pct, products}
  const [editorial, setEditorial] = useState(null); // manual override from admin

  useEffect(() => {
    const now = Date.now();
    // Check for admin editorial override first
    Promise.all([
      getDocs(collection(db,"config","editorial","entries")).catch(()=>({docs:[]})),
      getDoc(doc(db,"config","brandOfTheWeek")).catch(()=>({exists:()=>false})),
    ]).then(([calSnap, configSnap]) => {
      const calEntries = calSnap.docs
        .map(d=>({id:d.id,...d.data()}))
        .filter(e=>e.type==="brand" && e.scheduledFor<=now)
        .sort((a,b)=>b.scheduledFor-a.scheduledFor);
      if (calEntries[0]) { setEditorial(calEntries[0].value); return; }
      if (configSnap.exists?.()) {
        const d = configSnap.data();
        if (!d.scheduledFor || d.scheduledFor<=now) { setEditorial(d.brand); return; }
      }
    }).catch(()=>{});

    // Always compute the data-driven ranking
    getShopProducts().then(products => {
      if (!products.length) return;

      // Group by brand, compute pore safety %
      const brandMap = {};
      products.forEach(p => {
        const b = (p.brand||"").trim();
        if (!b) return;
        if (!brandMap[b]) brandMap[b] = { total:0, safe:0, products:[] };
        // Only count products with real ingredient data
        if (!p.ingredients || p.ingredients.trim().length < 10) return;
        const liveScore = (() => { const r = analyzeIngredients(p.ingredients); return r.avgScore != null ? Math.round(r.avgScore) : 99; })();
        brandMap[b].total++;
        if (liveScore <= 1) brandMap[b].safe++;
        brandMap[b].products.push(p);
      });

      // Only brands with 3+ products and 80%+ pore safety
      const eligible = Object.entries(brandMap)
        .filter(([,v]) => v.total >= 3 && (v.safe/v.total) >= 0.8)
        .sort(([,a],[,b]) => {
          const pctDiff = (b.safe/b.total) - (a.safe/a.total);
          if (Math.abs(pctDiff) > 0.05) return pctDiff;
          return b.total - a.total; // tie-break: more products = better
        });

      if (!eligible.length) return;

      // Rotate weekly through eligible brands
      const weekIdx = getWeekIndex() % eligible.length;
      const [name, data] = eligible[weekIdx];
      setBrandData({ name, safeCount: data.safe, totalCount: data.total, pct: Math.round((data.safe/data.total)*100), products: data.products });
    });
  }, []);

  const activeBrand = editorial || brandData?.name;
  const blurbData = activeBrand ? getBrandBlurb(activeBrand) : null;
  const pct = brandData?.pct ?? null;
  const safeCount = brandData?.safeCount ?? null;
  const totalCount = brandData?.totalCount ?? null;

  if (!activeBrand) return null;

  return (
    <button onClick={() => onBrandTap && onBrandTap(activeBrand)}
      style={{width:"100%",textAlign:"left",background:getBrandPalette(activeBrand).bg,borderRadius:"1rem",overflow:"hidden",marginBottom:"1.1rem",cursor:"pointer",border:"none",position:"relative",transition:"opacity 0.15s"}}
      onMouseEnter={e=>e.currentTarget.style.opacity="0.92"}
      onMouseLeave={e=>e.currentTarget.style.opacity="1"}>

      {/* Decorative watermark */}
      <div style={{position:"absolute",right:"-1rem",top:"-1rem",opacity:0.05,pointerEvents:"none"}}>
        {RalliIcons.flask("#FFFFFF", 130)}
      </div>

      <div style={{position:"relative",zIndex:1,padding:"1.1rem 1.25rem"}}>
        {/* Label row */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"0.5rem"}}>
          <div style={{fontSize:"0.5rem",color:T.iceBlue,letterSpacing:"0.22em",textTransform:"uppercase",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>
            Brand of the Week
          </div>
          {pct !== null && (
            <div style={{display:"flex",alignItems:"center",gap:"0.3rem",background:"rgba(255,255,255,0.1)",borderRadius:"999px",padding:"0.15rem 0.55rem"}}>
              <span style={{fontSize:"0.72rem",fontWeight:"800",color:T.sage,fontFamily:"'Inter',sans-serif"}}>{pct}%</span>
              <span style={{fontSize:"0.55rem",color:"rgba(255,255,255,0.55)",fontFamily:"'Inter',sans-serif"}}>pore safe</span>
            </div>
          )}
        </div>

        {/* Brand name */}
        <div style={{fontFamily:"'Inter',sans-serif",fontWeight:"800",fontSize:"1.6rem",color:"#FFFFFF",letterSpacing:"-0.03em",lineHeight:1,marginBottom:"0.6rem"}}>
          {activeBrand}
        </div>

        {/* Blurb */}
        <div style={{fontSize:"0.78rem",color:"rgba(255,255,255,0.7)",fontFamily:"'Inter',sans-serif",fontWeight:"400",lineHeight:1.55,marginBottom:"0.75rem"}}>
          {blurbData?.blurb || getBrandTagline(activeBrand)}
        </div>

        {/* Founder note */}
        {blurbData?.founder && (
          <div style={{fontSize:"0.67rem",color:"rgba(255,255,255,0.4)",fontFamily:"'Inter',sans-serif",fontStyle:"italic",lineHeight:1.4,marginBottom:"0.75rem",borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:"0.6rem"}}>
            {blurbData.founder}
          </div>
        )}

        {/* Stats row */}
        <div style={{display:"flex",alignItems:"center",gap:"0.75rem"}}>
          {safeCount !== null && (
            <div style={{fontSize:"0.62rem",color:"rgba(255,255,255,0.5)",fontFamily:"'Inter',sans-serif"}}>
              <span style={{color:T.sage,fontWeight:"700"}}>{safeCount}</span> of {totalCount} products score 0–1
            </div>
          )}
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:"0.3rem"}}>
            <span style={{fontSize:"0.62rem",color:T.iceBlue,fontFamily:"'Inter',sans-serif",fontWeight:"500"}}>See products</span>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={T.iceBlue} strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Brand of the Week Admin Picker ───────────────────────────
// ── Editorial Calendar ────────────────────────────────────────
function EditorialCalendar() {
  const [brands, setBrands]       = useState([]);
  const [entries, setEntries]     = useState([]); // [{id, type, value, tagline, scheduledFor, setAt}]
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [formType, setFormType]       = useState("brand"); // "brand" | "quote"
  const [formBrand, setFormBrand]     = useState("");
  const [formTagline, setFormTagline] = useState("");
  const [formQuote, setFormQuote]     = useState("");
  const [formDate, setFormDate]       = useState("");
  const [formTime, setFormTime]       = useState("09:00");
  const [saving, setSaving]           = useState(false);

  const QUOTES = DAILY_MESSAGES; // reuse existing quote list as suggestions

  useEffect(() => {
    getShopProducts().then(ps => {
      setBrands([...new Set(ps.map(p=>(p.brand||"").trim()).filter(Boolean))].sort());
    });
    loadEntries();
  }, []);

  async function loadEntries() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "config", "editorial", "entries"));
      const loaded = snap.docs.map(d=>({id:d.id,...d.data()}));
      loaded.sort((a,b)=>a.scheduledFor - b.scheduledFor);
      setEntries(loaded);
    } catch(e) { console.error(e); }
    setLoading(false);
  }

  function openNew(type="brand") {
    setEditingId(null);
    setFormType(type);
    setFormBrand(""); setFormTagline(""); setFormQuote("");
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate()+1);
    setFormDate(tomorrow.toISOString().slice(0,10));
    setFormTime("09:00");
    setShowForm(true);
  }

  function openEdit(entry) {
    setEditingId(entry.id);
    setFormType(entry.type);
    setFormBrand(entry.type==="brand" ? entry.value : "");
    setFormTagline(entry.tagline || "");
    setFormQuote(entry.type==="quote" ? entry.value : "");
    const d = new Date(entry.scheduledFor);
    const pstStr = d.toLocaleString("en-US",{timeZone:"America/Los_Angeles",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});
    // pstStr like "03/09/2026, 14:30" → reformat to "2026-03-09" and "14:30"
    const [datePart, timePart] = pstStr.split(", ");
    const [m,dd,yyyy] = datePart.split("/");
    setFormDate(`${yyyy}-${m}-${dd}`);
    setFormTime(timePart.replace("24:","00:"));
    setShowForm(true);
  }

  async function handleSave() {
    const value = formType==="brand" ? formBrand : formQuote.trim();
    if (!value) return;
    setSaving(true);
    try {
      // Parse date+time in PST/PDT (America/Los_Angeles)
      const localDateStr = `${formDate}T${formTime}:00`;
      const naiveMs = new Date(localDateStr).getTime();
      const laOffset = new Date(naiveMs).toLocaleString("en-US", {timeZone:"America/Los_Angeles",timeZoneName:"shortOffset"}).match(/GMT([+-]\d+(?::\d+)?)/)?.[1];
      const offsetHours = laOffset ? parseInt(laOffset) : -8;
      const ts = naiveMs - (new Date(localDateStr).getTimezoneOffset() + offsetHours * 60) * 60000;
      const data = {
        type: formType,
        value,
        tagline: formType==="brand" ? (formTagline.trim()||getBrandTagline(formBrand)) : "",
        scheduledFor: ts,
        setAt: Date.now(),
      };
      const entryId = editingId || `${formType}_${ts}`;
      await setDoc(doc(db,"config","editorial","entries",entryId), data);

      if (formType==="brand") {
        const now = Date.now();
        const upcomingBrands = [...entries.filter(e=>e.type==="brand"&&e.scheduledFor>now), {...data,id:entryId}]
          .sort((a,b)=>a.scheduledFor-b.scheduledFor);
        if (upcomingBrands[0]?.id===entryId || ts<=now) {
          await setDoc(doc(db,"config","brandOfTheWeek"),{brand:value,tagline:data.tagline,setAt:Date.now(),scheduledFor:ts});
        }
      }

      const newEntry = {...data, id:entryId};
      setEntries(prev => {
        const filtered = prev.filter(e=>e.id!==entryId);
        return [...filtered, newEntry].sort((a,b)=>a.scheduledFor-b.scheduledFor);
      });
      setShowForm(false);
    } catch(e) {
      console.error("Save failed:", e);
      alert("Save failed: " + e.message);
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    await deleteDoc(doc(db,"config","editorial","entries",id));
    setEntries(e=>e.filter(x=>x.id!==id));
  }

  async function handleActivateNow(entry) {
    if (entry.type==="brand") {
      await setDoc(doc(db,"config","brandOfTheWeek"),{brand:entry.value,tagline:entry.tagline,setAt:Date.now(),scheduledFor:Date.now()});
    }
    // Update entry scheduledFor to now
    await setDoc(doc(db,"config","editorial","entries",entry.id),{...entry,scheduledFor:Date.now()});
    await loadEntries();
  }

  const now = Date.now();
  const live    = entries.filter(e=>e.scheduledFor<=now);
  const upcoming= entries.filter(e=>e.scheduledFor>now);

  const inp = {width:"100%",padding:"0.5rem 0.7rem",borderRadius:"0.5rem",border:`1px solid ${T.border}`,fontSize:"0.78rem",fontFamily:"'Inter',sans-serif",color:T.text,background:T.surface,outline:"none",boxSizing:"border-box"};

  function EntryRow({entry}) {
    const isPast = entry.scheduledFor <= now;
    const d = new Date(entry.scheduledFor);
    const label = d.toLocaleString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZone:"America/Los_Angeles",timeZoneName:"short"});
    return (
      <div style={{display:"flex",alignItems:"flex-start",gap:"0.6rem",padding:"0.65rem 0.75rem",background:T.surface,borderRadius:"0.65rem",border:`1px solid ${isPast?T.sage+"40":T.border}`}}>
        <div style={{width:"28px",height:"28px",borderRadius:"0.4rem",background:entry.type==="brand"?T.navy:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:"0.1rem"}}>
          <span style={{fontSize:"0.7rem"}}>{entry.type==="brand"?"🏷":"💬"}</span>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:"0.78rem",fontWeight:"600",color:T.text,fontFamily:"'Inter',sans-serif",marginBottom:"0.1rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {entry.value}
          </div>
          {entry.tagline&&<div style={{fontSize:"0.65rem",color:T.textLight,fontFamily:"'Inter',sans-serif",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",marginBottom:"0.15rem"}}>{entry.tagline}</div>}
          <div style={{fontSize:"0.6rem",color:isPast?T.sage:T.amber,fontFamily:"'Inter',sans-serif",fontWeight:"500"}}>
            {isPast?"✓ Live · ":"⏰ "}{label}
          </div>
        </div>
        <div style={{display:"flex",gap:"0.3rem",flexShrink:0}}>
          {!isPast&&<button onClick={()=>handleActivateNow(entry)} style={{fontSize:"0.6rem",padding:"0.2rem 0.45rem",background:T.sage,color:"#fff",border:"none",borderRadius:"0.3rem",cursor:"pointer",fontFamily:"'Inter',sans-serif",fontWeight:"600"}}>Now</button>}
          <button onClick={()=>openEdit(entry)} style={{fontSize:"0.6rem",padding:"0.2rem 0.45rem",background:T.surfaceAlt,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.3rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Edit</button>
          <button onClick={()=>handleDelete(entry.id)} style={{fontSize:"0.6rem",padding:"0.2rem 0.45rem",background:"#fdeaea",color:T.rose,border:"none",borderRadius:"0.3rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>✕</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:"2rem"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1rem"}}>
        <div>
          <div style={{fontSize:"0.75rem",fontWeight:"700",color:T.navy,fontFamily:"'Inter',sans-serif"}}>Editorial Calendar</div>
          <div style={{fontSize:"0.65rem",color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Schedule brand features in advance</div>
        </div>
        <div style={{display:"flex",gap:"0.4rem"}}>
          <button onClick={()=>openNew("brand")} style={{padding:"0.4rem 0.7rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.68rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>+ Brand</button>

        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm&&(
        <div style={{background:T.surfaceAlt,borderRadius:"0.85rem",border:`1px solid ${T.border}`,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:"0.65rem",fontWeight:"700",color:T.navy,letterSpacing:"0.1em",textTransform:"uppercase",fontFamily:"'Inter',sans-serif",marginBottom:"0.75rem"}}>
            {editingId?"Edit entry":"New entry"}
          </div>

          {/* Type toggle */}
          <div style={{display:"flex",gap:"0.3rem",marginBottom:"0.75rem",background:T.surface,padding:"0.2rem",borderRadius:"0.5rem"}}>
            {[["brand","🏷 Brand"]].map(([t,lbl])=>(
              <button key={t} onClick={()=>setFormType(t)}
                style={{flex:1,padding:"0.4rem",background:formType===t?T.navy:"transparent",color:formType===t?"#fff":T.textMid,border:"none",borderRadius:"0.35rem",fontSize:"0.72rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",transition:"all 0.15s"}}>
                {lbl}
              </button>
            ))}
          </div>

          {formType==="brand"&&(
            <>
              <div style={{marginBottom:"0.5rem"}}>
                <label style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:"0.25rem"}}>Brand</label>
                <select value={formBrand} onChange={e=>{setFormBrand(e.target.value);setFormTagline("");}} style={inp}>
                  <option value="">— Select brand —</option>
                  {brands.map(b=><option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div style={{marginBottom:"0.5rem"}}>
                <label style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:"0.25rem"}}>Tagline (optional)</label>
                <input value={formTagline} onChange={e=>setFormTagline(e.target.value)} placeholder={formBrand?getBrandTagline(formBrand):"Tagline…"} style={inp}/>
              </div>
            </>
          )}



          {/* Date + Time */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.5rem",marginBottom:"0.65rem"}}>
            <div>
              <label style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:"0.25rem"}}>Date</label>
              <input type="date" value={formDate} onChange={e=>setFormDate(e.target.value)} style={inp}/>
            </div>
            <div>
              <label style={{fontSize:"0.6rem",color:T.textLight,fontFamily:"'Inter',sans-serif",display:"block",marginBottom:"0.25rem"}}>Time</label>
              <input type="time" value={formTime} onChange={e=>setFormTime(e.target.value)} style={inp}/>
            </div>
          </div>

          <div style={{display:"flex",gap:"0.4rem"}}>
            <button onClick={()=>setShowForm(false)} style={{flex:1,padding:"0.5rem",background:T.surfaceAlt,color:T.textMid,border:`1px solid ${T.border}`,borderRadius:"0.5rem",fontSize:"0.75rem",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>Cancel</button>
            <button onClick={handleSave} disabled={saving||!(formType==="brand"?formBrand:formQuote.trim())}
              style={{flex:2,padding:"0.5rem",background:T.navy,color:"#fff",border:"none",borderRadius:"0.5rem",fontSize:"0.75rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif",opacity:saving?0.6:1}}>
              {saving?"Saving…":editingId?"Save changes":"Schedule"}
            </button>
          </div>
        </div>
      )}

      {loading&&<div style={{textAlign:"center",color:T.textLight,fontSize:"0.78rem",padding:"2rem"}}>Loading…</div>}

      {/* Upcoming */}
      {upcoming.length>0&&(
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.amber,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Inter',sans-serif",marginBottom:"0.5rem"}}>
            ⏰ Upcoming — {upcoming.length}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
            {upcoming.map(e=><EntryRow key={e.id} entry={e}/>)}
          </div>
        </div>
      )}

      {/* Live / Past */}
      {live.length>0&&(
        <div>
          <div style={{fontSize:"0.6rem",fontWeight:"700",color:T.sage,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:"'Inter',sans-serif",marginBottom:"0.5rem"}}>
            ✓ Live / Past — {live.length}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:"0.4rem"}}>
            {[...live].reverse().slice(0,10).map(e=><EntryRow key={e.id} entry={e}/>)}
          </div>
        </div>
      )}

      {!loading&&entries.length===0&&(
        <div style={{textAlign:"center",padding:"3rem 1rem",color:T.textLight}}>
          <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📅</div>
          <div style={{fontSize:"0.8rem",fontWeight:"600",color:T.textMid,marginBottom:"0.25rem"}}>No entries yet</div>
          <div style={{fontSize:"0.72rem"}}>Add your first brand or quote above</div>
        </div>
      )}
    </div>
  );
}

function PageHero({pageTitle, pageIcon, fixed, rightAction}) {
  const [msg, setMsg] = useState(fixed || getDailyMessage());

  useEffect(()=>{
    if (fixed) return;
    const now = Date.now();
    getDocs(collection(db,"config","editorial","entries"))
      .then(snap=>{
        const quotes = snap.docs
          .map(d=>({...d.data()}))
          .filter(e=>e.type==="quote" && e.scheduledFor<=now)
          .sort((a,b)=>b.scheduledFor-a.scheduledFor);
        if (quotes[0]) setMsg(quotes[0].value);
      }).catch(()=>{});
  },[]);

  return (
    <div style={{padding:"0.6rem 1rem 0.25rem", display:"flex", alignItems:"center", justifyContent:"space-between"}}>
      <div style={{fontSize:"0.52rem", color:T.textLight, letterSpacing:"0.06em", textTransform:"uppercase", fontFamily:"'Inter',sans-serif", fontWeight:"500", flex:1, minWidth:0}}>
        {msg}
      </div>
      {rightAction && <div style={{flexShrink:0, marginLeft:"0.5rem"}}>{rightAction}</div>}
    </div>
  );
}

// Brand board icons — thin stroke, exact shapes from the spec
// ── Firestore helpers for messaging ──────────────────────────
function convId(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}
async function sendMessage(fromUid, toUid, msg) {
  if (!fromUid || !toUid) throw new Error("Missing uid: fromUid=" + fromUid + " toUid=" + toUid);
  const cid = convId(fromUid, toUid);
  const convRef = doc(db, "conversations", cid);
  const msgRef = collection(db, "conversations", cid, "messages");
  const ts = serverTimestamp();
  // Clean undefined values — Firestore rejects them
  const cleanMsg = Object.fromEntries(Object.entries({ ...msg, fromUid, createdAt: ts }).filter(([,v]) => v !== undefined));
  await addDoc(msgRef, cleanMsg);
  await setDoc(convRef, {
    participants: [fromUid, toUid],
    lastMessage: msg.type === "text" ? msg.text : msg.type === "product" ? `📦 ${msg.productName}` : "📷 Photo",
    lastAt: ts,
    [`unread_${toUid}`]: increment(1),
    [`unread_${fromUid}`]: 0,
  }, { merge: true });
  // In-app notification for recipient
  addDoc(collection(db, "notifications"), {
    toUid,
    fromUid,
    type: "message",
    text: msg.type === "text" ? msg.text : msg.type === "product" ? `Shared a product: ${msg.productName}` : "Sent you a photo",
    read: false,
    createdAt: ts,
  }).catch(() => {});
}

// ── MessagesPage ──────────────────────────────────────────────
function MessagesPage({ user, profile, onUserTap, onUnreadChange, onChatOpen, chatCloseRef }) {
  const [convos, setConvos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openConvo, setOpenConvo] = useState(null);

  // Register close fn so AppInner nav can close the chat from outside
  React.useEffect(() => {
    if (chatCloseRef) chatCloseRef.current = () => { setOpenConvo(null); onChatOpen?.(false); };
    return () => { if (chatCloseRef) chatCloseRef.current = null; };
  }, []);
  const [chatProduct, setChatProduct] = useState(null);
  const [chatProductLoading, setChatProductLoading] = useState(false);

  function openChat(other) { setOpenConvo(other); onChatOpen?.(true); }

  async function openChatProduct(snap) {
    setChatProductLoading(true);
    try {
      const q = query(collection(db, "products"), where("productName", "==", snap.productName), limit(1));
      const res = await getDocs(q);
      if (!res.empty) {
        const p = { id: res.docs[0].id, ...res.docs[0].data() };
        const ing = p.ingredients || "";
        const liveScore = ing.trim().length > 10
          ? (() => { const r = analyzeIngredients(ing); return r.avgScore != null ? Math.round(r.avgScore) : null; })()
          : null;
        setChatProduct({
          productName: p.productName || snap.productName,
          brand: p.brand || snap.brand,
          image: p.adminImage || p.image || snap.productImage || "",
          poreScore: liveScore ?? p.poreScore ?? snap.poreScore ?? 0,
          communityRating: p.communityRating || null,
          ingredients: ing,
          flaggedIngredients: ing ? analyzeIngredients(ing).found : [],
          buyUrl: p.buyUrl || amazonUrl(snap.productName, snap.brand, snap.barcode, snap.asin, snap.buyUrl),
        });
      } else {
        // Fall back to snapshot data
        setChatProduct({ productName: snap.productName, brand: snap.brand, image: snap.productImage, poreScore: snap.poreScore ?? 0, ingredients: "", flaggedIngredients: [] });
      }
    } catch {
      setChatProduct({ productName: snap.productName, brand: snap.brand, image: snap.productImage, poreScore: snap.poreScore ?? 0, ingredients: "", flaggedIngredients: [] });
    }
    setChatProductLoading(false);
  }
  const [searchQ, setSearchQ] = useState("");
  const [searchRes, setSearchRes] = useState([]);
  const [connections, setConnections] = useState([]); // followers + following
  const searchRef = React.useRef(null);
  const [showSearch, setShowSearch] = useState(false);

  // Load followers + following for the "People" list
  useEffect(() => {
    if (!user?.uid) return;
    async function loadConnections() {
      const snap = await getDoc(doc(db, "users", user.uid)).catch(() => null);
      const data = snap?.data() || {};
      const followingIds = data.following || [];
      const followerIds = data.followers || [];
      const allIds = [...new Set([...followingIds, ...followerIds])].filter(id => id !== user.uid);
      if (!allIds.length) return;
      const chunks = [];
      for (let i = 0; i < allIds.length; i += 10) chunks.push(allIds.slice(i, i + 10));
      const users = [];
      for (const chunk of chunks) {
        const s = await getDocs(query(collection(db, "users"), where("__name__", "in", chunk))).catch(() => null);
        if (s) s.docs.forEach(d => users.push({ uid: d.id, ...d.data() }));
      }
      setConnections(users);
    }
    loadConnections();
  }, [user?.uid]);

  // Listen to conversations
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setConvos(list);
      const total = list.reduce((sum, c) => sum + (c[`unread_${user.uid}`] || 0), 0);
      onUnreadChange?.(total);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [user?.uid]);

  // Search users
  useEffect(() => {
    if (!searchQ.trim()) { setSearchRes([]); return; }
    getDocs(query(collection(db, "users"),
      where("displayName", ">=", searchQ),
      where("displayName", "<=", searchQ + "\uf8ff"),
      limit(10)
    )).then(snap => {
      setSearchRes(snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(u => u.uid !== user.uid));
    }).catch(() => {});
  }, [searchQ]);

  if (openConvo) {
    return (
      <>
        <div style={{position:"fixed", top:0, left:0, right:0, bottom:0, zIndex:60, background:T.bg, display:"flex", flexDirection:"column", height:"100%", maxHeight:"-webkit-fill-available"}}>
          <ChatView user={user} profile={profile} other={openConvo} onBack={() => { setOpenConvo(null); onChatOpen?.(false); }} onUserTap={onUserTap} onProductTap={openChatProduct}/>
        </div>
        {chatProduct && <ProductModal product={chatProduct} user={user} profile={profile} onUpdateProfile={()=>{}} onClose={() => setChatProduct(null)} onUserTap={onUserTap}/>}
      </>
    );
  }

  // Connections who don't have an existing convo yet
  const existingConvoUids = new Set(convos.map(c => c.participants?.find(p => p !== user.uid)).filter(Boolean));
  const newConnections = connections.filter(u => !existingConvoUids.has(u.uid));

  const activeList = searchQ.trim() ? searchRes : null;

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", paddingBottom: "6rem", minHeight: "100dvh" }}>
      {/* Header */}
      <div style={{ padding: "1rem 1rem 0.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: T.bg, zIndex: 10, borderBottom: `1px solid ${T.border}`, marginBottom: "0.5rem" }}>
        <div>
          <div style={{ fontSize: "1.1rem", fontWeight: "700", color: T.navy, fontFamily: "'Inter',sans-serif", letterSpacing: "-0.02em", lineHeight: 1 }}>Messages</div>
        </div>
        {convos.length > 0 && (
          <div style={{ fontSize: "0.65rem", color: T.textLight, fontFamily: "'Inter',sans-serif" }}>
            {convos.length} conversation{convos.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
      <div style={{ padding: "0 1rem 0.75rem" }}>
        {/* Search bar with + button */}
        <div style={{ position: "relative", marginBottom: "1rem", display:"flex", gap:"0.5rem", alignItems:"center" }}>
          <div style={{ position:"relative", flex:1 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2" style={{ position:"absolute", left:"0.8rem", top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              ref={searchRef}
              id="msg-search"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              onFocus={e => { e.target.style.borderColor = T.accent; setTimeout(()=>e.target.scrollIntoView({behavior:"smooth",block:"center"}),100); }}
              onBlur={e => e.target.style.borderColor = T.border}
              placeholder="Search people…"
              style={{ width:"100%", padding:"0.6rem 1rem 0.6rem 2.2rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"0.82rem", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surface, outline:"none", boxSizing:"border-box", transition:"border-color 0.15s" }}
            />
            {searchQ && <button onClick={() => setSearchQ("")} style={{ position:"absolute", right:"0.8rem", top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:T.textLight, padding:"2px" }}>✕</button>}
          </div>

        </div>

        {/* Search results */}
        {activeList && (
          <div style={{ marginBottom:"1rem" }}>
            {activeList.length === 0
              ? <div style={{ textAlign:"center", color:T.textLight, fontSize:"0.78rem", padding:"1rem" }}>No users found</div>
              : activeList.map((u, i) => (
                  <ConnectionRow key={u.uid} u={u} i={i} onClick={() => { setSearchQ(""); openChat({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL }); }}/>
                ))
            }
          </div>
        )}

        {!activeList && (
          <>
            {/* Existing conversations */}
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.75rem 0" }}>
                  <div className="skeleton" style={{ width:"44px", height:"44px", borderRadius:"50%", flexShrink:0 }}/>
                  <div style={{ flex:1 }}>
                    <div className="skeleton" style={{ height:"11px", width:"55%", marginBottom:"6px" }}/>
                    <div className="skeleton" style={{ height:"9px", width:"75%" }}/>
                  </div>
                </div>
              ))
            ) : convos.length > 0 && (
              <>
                <div style={{ fontSize:"0.6rem", fontWeight:"700", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.12em", marginBottom:"0.5rem", fontFamily:"'Inter',sans-serif" }}>Recent</div>
                {convos.map(c => {
                  const otherUid = c.participants?.find(p => p !== user.uid);
                  const unread = c[`unread_${user.uid}`] || 0;
                  return <ConvoRow key={c.id} convoId={c.id} otherUid={otherUid} lastMessage={c.lastMessage} lastAt={c.lastAt} unread={unread} onOpen={openChat} currentUid={user.uid}/>;
                })}
              </>
            )}

            {/* Followers + Following who you haven't messaged yet */}
            {newConnections.length > 0 && (
              <>
                <div style={{ fontSize:"0.6rem", fontWeight:"700", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.12em", margin:"1.1rem 0 0.5rem", fontFamily:"'Inter',sans-serif" }}>
                  {convos.length > 0 ? "People you can message" : "👋 Start a conversation"}
                </div>
                {newConnections.map((u, i) => (
                  <ConnectionRow key={u.uid} u={u} i={i} onClick={() => openChat({ uid: u.uid, displayName: u.displayName, photoURL: u.photoURL })}/>
                ))}
              </>
            )}

            {!loading && convos.length === 0 && newConnections.length === 0 && (
              <div style={{ textAlign:"center", padding:"3rem 1rem", color:T.textLight }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.border} strokeWidth="1.5" style={{ marginBottom:"0.75rem" }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <div style={{ fontSize:"0.85rem", fontFamily:"'Inter',sans-serif", fontWeight:"600", color:T.text }}>No conversations yet</div>
                <div style={{ fontSize:"0.72rem", marginTop:"0.35rem", lineHeight:1.5 }}>Search a name above to send your first message</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ConnectionRow({ u, i, onClick }) {
  return (
    <button onClick={onClick}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.65rem 0", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}40` : "none", cursor:"pointer", textAlign:"left" }}>
      <Avatar photoURL={u.photoURL} name={u.displayName} size={42}/>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:"0.85rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif" }}>{u.displayName}</div>
        <div style={{ fontSize:"0.68rem", color:T.textLight }}>{(u.followers||[]).length} followers</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </button>
  );
}


function ConvoRow({ convoId, otherUid, lastMessage, lastAt, unread, onOpen, currentUid }) {
  const [other, setOther] = useState(null);
  useEffect(() => {
    if (!otherUid) return;
    getDoc(doc(db, "users", otherUid)).then(d => { if (d.exists()) setOther({ uid: d.id, ...d.data() }); }).catch(() => {});
  }, [otherUid]);
  if (!other) return null;
  const ts = lastAt?.seconds ? timeAgo({ seconds: lastAt.seconds }) : "";
  return (
    <button onClick={() => onOpen(other)}
      style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.85rem 0", background:"none", border:"none", borderBottom:`1px solid ${T.border}40`, cursor:"pointer", textAlign:"left" }}>
      <div style={{ position:"relative", flexShrink:0 }}>
        <Avatar photoURL={other.photoURL} name={other.displayName} size={44}/>
        {unread > 0 && <div style={{ position:"absolute", top:0, right:0, width:"10px", height:"10px", borderRadius:"50%", background:T.rose, border:`2px solid ${T.bg}` }}/>}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
          <span style={{ fontSize:"0.85rem", fontWeight: unread > 0 ? "700" : "600", color:T.text, fontFamily:"'Inter',sans-serif" }}>{other.displayName}</span>
          <span style={{ fontSize:"0.62rem", color:T.textLight, flexShrink:0 }}>{ts}</span>
        </div>
        <div style={{ fontSize:"0.75rem", color: unread > 0 ? T.text : T.textLight, fontWeight: unread > 0 ? "500" : "400", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", marginTop:"1px", fontFamily:"'Inter',sans-serif" }}>
          {lastMessage || "Say hi!"}
        </div>
      </div>
    </button>
  );
}

// ── ChatView ──────────────────────────────────────────────────
function ChatView({ user, profile, other, onBack, onUserTap, onProductTap }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [longPressMsg, setLongPressMsg] = useState(null); // {id, isMe}
  const bottomRef = React.useRef(null);
  const fileInputRef = React.useRef(null);
  const typingTimerRef = React.useRef(null);
  const cid = convId(user.uid, other.uid);

  // Listen to messages + mark read
  useEffect(() => {
    const q = query(collection(db, "conversations", cid, "messages"), orderBy("createdAt", "asc"), limit(100));
    const unsub = onSnapshot(q, snap => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    });
    // Mark as read
    updateDoc(doc(db, "conversations", cid), { [`unread_${user.uid}`]: 0 }).catch(() => {});
    return unsub;
  }, [cid]);

  // Listen for other user typing
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "conversations", cid), snap => {
      const data = snap.data() || {};
      setOtherTyping(!!(data[`typing_${other.uid}`]));
    }, () => {});
    return unsub;
  }, [cid, other.uid]);

  // Broadcast typing indicator
  function onTextChange(val) {
    setText(val);
    if (!val.trim()) {
      updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: false }).catch(() => {});
      return;
    }
    updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: true }).catch(() => {});
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: false }).catch(() => {});
    }, 2500);
  }

  // Clear typing on unmount
  useEffect(() => () => {
    updateDoc(doc(db, "conversations", cid), { [`typing_${user.uid}`]: false }).catch(() => {});
    clearTimeout(typingTimerRef.current);
  }, [cid]);

  async function deleteMessage(msgId) {
    setLongPressMsg(null);
    await deleteDoc(doc(db, "conversations", cid, "messages", msgId)).catch(() => {});
  }

  async function send() {
    if (!text.trim()) return;
    setSending(true);
    await sendMessage(user.uid, other.uid, { type: "text", text: text.trim() });
    setText("");
    setSending(false);
  }

  async function sendPhoto(file) {
    if (!file) return;
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target.result;
        await sendMessage(user.uid, other.uid, { type: "photo", photoData: base64 });
        setPhotoUploading(false);
      };
      reader.readAsDataURL(file);
    } catch { setPhotoUploading(false); }
  }

  async function sendProduct(product) {
    setShowProductPicker(false);
    const ing = product.ingredients || "";
    const liveScore = ing.trim().length > 10
      ? (() => { try { const r = analyzeIngredients(ing); return r.avgScore!=null ? Math.round(r.avgScore) : null; } catch { return null; } })()
      : null;
    await sendMessage(user.uid, other.uid, {
      type: "product",
      productName: product.productName || product.name || "",
      brand: product.brand || "",
      productImage: product.adminImage || product.productImage || product.image || "",
      poreScore: liveScore ?? product.poreScore ?? null,
      hasScore: true,
      ingredients: ing,
      buyUrl: product.buyUrl || "",
    });
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100dvh", maxHeight:"-webkit-fill-available", overflow:"hidden" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem", padding:"0.85rem 1rem", borderBottom:`1px solid ${T.border}`, background:T.surface, flexShrink:0 }}>
        <button onClick={onBack} style={{ background:"none", border:"none", cursor:"pointer", padding:"0.2rem", color:T.textLight, display:"flex" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button onClick={() => onUserTap(other.uid)} style={{ background:"none", border:"none", padding:0, cursor:"pointer", display:"flex", alignItems:"center", gap:"0.6rem" }}>
          <Avatar photoURL={other.photoURL} name={other.displayName} size={36}/>
          <span style={{ fontSize:"0.9rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif" }}>{other.displayName}</span>
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"1rem", paddingBottom:"1.5rem", display:"flex", flexDirection:"column", gap:"0.6rem" }}>
        {messages.map(m => {
          const isMe = m.fromUid === user.uid;
          return (
            <div key={m.id} style={{ display:"flex", justifyContent: isMe ? "flex-end" : "flex-start" }}>
              {m.type === "text" && (
                <div
                  onContextMenu={e => { e.preventDefault(); setLongPressMsg({id:m.id, isMe}); }}
                  onTouchStart={(() => { let t; return () => { t = setTimeout(() => setLongPressMsg({id:m.id, isMe}), 500); return () => clearTimeout(t); }; })()}
                  style={{ maxWidth:"75%", padding:"0.55rem 0.9rem", borderRadius: isMe ? "1.1rem 1.1rem 0.2rem 1.1rem" : "1.1rem 1.1rem 1.1rem 0.2rem", background: isMe ? T.navy : T.surfaceAlt, color: isMe ? "#fff" : T.text, fontSize:"0.85rem", fontFamily:"'Inter',sans-serif", lineHeight:1.45, cursor:"default", userSelect:"none" }}>
                  {m.text}
                </div>
              )}
              {m.type === "photo" && m.photoData && (
                <div style={{ maxWidth:"65%", borderRadius:"0.85rem", overflow:"hidden", border:`1px solid ${T.border}` }}>
                  <img src={m.photoData} alt="Skin photo" style={{ width:"100%", display:"block", maxHeight:"280px", objectFit:"cover" }}/>
                </div>
              )}
              {m.type === "product" && (
                <button onClick={() => onProductTap?.({ productName: m.productName, brand: m.brand, productImage: m.productImage, poreScore: m.poreScore })}
                  style={{ maxWidth:"75%", background: T.surfaceAlt, border:`1px solid ${T.border}`, borderRadius:"0.85rem", overflow:"hidden", cursor:"pointer", textAlign:"left", padding:0 }}>
                  <div style={{ display:"flex", gap:"0.6rem", alignItems:"center", padding:"0.65rem 0.75rem" }}>
                    {m.productImage && (
                      <div style={{ width:"44px", height:"44px", flexShrink:0, borderRadius:"0.5rem", overflow:"hidden", background:T.surface }}>
                        <img src={m.productImage} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", padding:"3px", mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)" }}/>
                      </div>
                    )}
                    <div style={{ flex:1, minWidth:0 }}>
                      {m.brand && <div style={{ fontSize:"0.58rem", fontWeight:"600", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.09em" }}>{m.brand}</div>}
                      <div style={{ fontSize:"0.82rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{m.productName}</div>
                      {m.hasScore && m.poreScore !== null && m.poreScore !== undefined
                        ? <div style={{ fontSize:"0.68rem", fontWeight:"700", color:poreStyle(m.poreScore).color, marginTop:"2px" }}>{m.poreScore}/5 · {poreStyle(m.poreScore).label}</div>
                        : <div style={{ fontSize:"0.68rem", color:T.textLight, marginTop:"2px" }}>Tap to view details</div>
                      }
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  </div>
                </button>
              )}
            </div>
          );
        })}
        {photoUploading && (
          <div style={{ display:"flex", justifyContent:"flex-end" }}>
            <div style={{ padding:"0.55rem 0.9rem", borderRadius:"1.1rem", background:T.surfaceAlt, fontSize:"0.78rem", color:T.textLight }}>Sending photo…</div>
          </div>
        )}
        {otherTyping && (
          <div style={{ display:"flex", justifyContent:"flex-start", alignItems:"center", gap:"0.4rem" }}>
            <Avatar photoURL={other.photoURL} name={other.displayName} size={22}/>
            <div style={{ padding:"0.5rem 0.8rem", borderRadius:"1.1rem 1.1rem 1.1rem 0.2rem", background:T.surfaceAlt, display:"flex", gap:"4px", alignItems:"center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:T.textLight, animation:`typingDot 1.2s ${i*0.2}s infinite ease-in-out` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* Long-press delete sheet */}
      {longPressMsg && (
        <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0, zIndex:200, background:"rgba(0,0,0,0.4)" }} onClick={() => setLongPressMsg(null)}>
          <div style={{ position:"absolute", bottom:0, left:0, right:0, background:T.surface, borderRadius:"1.25rem 1.25rem 0 0", padding:"1rem", paddingBottom:"calc(1rem + env(safe-area-inset-bottom))" }} onClick={e => e.stopPropagation()}>
            <div style={{ width:"36px", height:"4px", borderRadius:"2px", background:T.border, margin:"0 auto 1rem" }}/>
            {longPressMsg.isMe ? (
              <>
                <button onClick={() => deleteMessage(longPressMsg.id)}
                  style={{ width:"100%", padding:"0.85rem 1rem", background:"none", border:"none", cursor:"pointer", textAlign:"left", display:"flex", alignItems:"center", gap:"0.75rem", color:T.rose, fontFamily:"'Inter',sans-serif", fontSize:"0.9rem", fontWeight:"500" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                  Delete message
                </button>
              </>
            ) : (
              <div style={{ padding:"0.85rem 1rem", color:T.textLight, fontFamily:"'Inter',sans-serif", fontSize:"0.85rem" }}>You can only delete your own messages</div>
            )}
            <button onClick={() => setLongPressMsg(null)}
              style={{ width:"100%", padding:"0.75rem", background:T.surfaceAlt, border:"none", borderRadius:"0.85rem", cursor:"pointer", fontFamily:"'Inter',sans-serif", fontSize:"0.85rem", color:T.text, marginTop:"0.5rem" }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Product picker modal */}
      {showProductPicker && (
        <ProductPickerModal user={user} onSelect={sendProduct} onClose={() => setShowProductPicker(false)}/>
      )}



      {/* Input bar */}
      <div style={{ padding:"0.65rem 1rem", paddingBottom:"calc(4.5rem + env(safe-area-inset-bottom))", borderTop:`1px solid ${T.border}`, background:T.surface, display:"flex", alignItems:"center", gap:"0.5rem", flexShrink:0, zIndex:61, position:"relative" }}>
        {/* Photo button */}
        <button onClick={() => fileInputRef.current?.click()} style={{ background:"none", border:"none", cursor:"pointer", padding:"0.3rem", color:T.textLight, display:"flex", flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display:"none" }} onChange={e => { if(e.target.files[0]) sendPhoto(e.target.files[0]); e.target.value=""; }}/>
        {/* Product share button */}
        <button onClick={() => setShowProductPicker(true)} style={{ background:"none", border:"none", cursor:"pointer", padding:"0.3rem", color:T.textLight, display:"flex", flexShrink:0 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
        </button>
        {/* Text input */}
        <input
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCorrect="on"
          autoCapitalize="sentences"
          value={text}
          onChange={e => onTextChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && !sending && send()}
          placeholder="Message…"
          style={{ flex:1, padding:"0.5rem 0.85rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"16px", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surfaceAlt, outline:"none" }}
        />
        {/* Send */}
        <button onClick={send} disabled={!text.trim() || sending}
          style={{ width:"34px", height:"34px", borderRadius:"50%", background: text.trim() ? T.navy : T.surfaceAlt, border:"none", cursor: text.trim() ? "pointer" : "default", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={text.trim() ? "#fff" : T.textLight} strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
        </button>
      </div>
    </div>
  );
}

// ── ProductPickerModal — lets user pick a product to share ────
function ProductPickerModal({ user, onSelect, onClose }) {
  const [q, setQ] = useState("");
  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load all approved products once then filter client-side — no index needed
    getDocs(query(collection(db, "products"), where("approved", "==", true), limit(200)))
      .then(snap => {
        setAllProducts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }).catch(() => setLoading(false));
  }, []);

  const results = q.trim().length < 2 ? [] : allProducts.filter(p =>
    (p.productName||"").toLowerCase().includes(q.toLowerCase()) ||
    (p.brand||"").toLowerCase().includes(q.toLowerCase())
  ).slice(0, 15);

  return (
    <div style={{ position:"fixed",top:0,left:0,right:0,bottom:0, zIndex:200, background:"rgba(0,0,0,0.45)", display:"flex", alignItems:"flex-end" }} onClick={onClose}>
      <div style={{ width:"100%", maxWidth:"480px", margin:"0 auto", background:T.surface, borderRadius:"1.25rem 1.25rem 0 0", padding:"1rem", maxHeight:"70vh", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.85rem" }}>
          <span style={{ fontSize:"0.95rem", fontWeight:"700", color:T.text, fontFamily:"'Inter',sans-serif" }}>Share a product</span>
          <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:T.textLight }}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search products…" autoFocus
          style={{ padding:"0.6rem 0.9rem", borderRadius:"999px", border:`1px solid ${T.border}`, fontSize:"0.82rem", fontFamily:"'Inter',sans-serif", color:T.text, background:T.surfaceAlt, outline:"none", marginBottom:"0.75rem" }}/>
        <div style={{ overflowY:"auto", flex:1 }}>
          {loading && <div style={{ textAlign:"center", color:T.textLight, padding:"1rem", fontSize:"0.78rem" }}>Searching…</div>}
          {results.map((p, i) => {
            const ps = poreStyle(p.poreScore ?? 0);
            return (
              <button key={p.id} onClick={() => onSelect({...p, image: p.adminImage||p.image||""})}
                style={{ width:"100%", display:"flex", alignItems:"center", gap:"0.65rem", padding:"0.7rem 0", background:"none", border:"none", borderTop: i > 0 ? `1px solid ${T.border}40` : "none", cursor:"pointer", textAlign:"left" }}>
                <div style={{ width:"44px", height:"44px", flexShrink:0, borderRadius:"0.6rem", overflow:"hidden", background:T.surfaceAlt }}>
                  {p.image ? <img src={p.image} alt="" style={{ width:"100%", height:"100%", objectFit:"contain", padding:"4px", mixBlendMode:"multiply",filter:"brightness(1.05) contrast(1.05)" }}/> : null}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  {p.brand && <div style={{ fontSize:"0.6rem", color:T.textLight, textTransform:"uppercase", letterSpacing:"0.09em" }}>{p.brand}</div>}
                  <div style={{ fontSize:"0.82rem", fontWeight:"600", color:T.text, fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{p.productName}</div>
                </div>
                {p.poreScore != null && <span style={{ fontSize:"0.72rem", fontWeight:"700", color:ps.color, flexShrink:0 }}>{p.poreScore}/5</span>}
              </button>
            );
          })}
          {!loading && q.trim().length < 2 && (
            <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>Type to search your products…</div>
          )}
          {!loading && q.trim().length >= 2 && results.length === 0 && (
            <div style={{ textAlign:"center", color:T.textLight, padding:"1.5rem", fontSize:"0.78rem" }}>No products found</div>
          )}
        </div>
      </div>
    </div>
  );
}


const RalliIcons = {
  scan: (color="#111827", size=22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  community: (color="#111827", size=22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="7" r="3"/>
      <path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      <path d="M21 21v-2a4 4 0 0 0-3-3.85"/>
    </svg>
  ),
  bookmark: (color="#111827", size=22, filled=false) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? color : "none"} stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  compass: (color="#111827", size=22, filled=false) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={filled ? color : "none"}/>
    </svg>
  ),
  flask: (color="#111827", size=22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 2v7.31l-3.24 4.65A3 3 0 0 0 9.24 19H14.76a3 3 0 0 0 2.48-5.04L14 9.31V2"/>
      <line x1="8.5" y1="2" x2="15.5" y2="2"/>
    </svg>
  ),
  person: (color="#111827", size=22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  chat: (color="#111827", size=22) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  ),
};

function BottomNav({tab, onChange, unreadCount=0, msgUnread=0, currentUid="", isAdmin=false}) {
  const items = [
    {id:"feed",     label:"Feed",     icon:(a) => RalliIcons.community(a ? T.navy : T.textLight)},
    {id:"check",    label:"Scan",     icon:(a) => RalliIcons.scan(a ? T.navy : T.textLight)},
    {id:"shop",     label:"Explore",  icon:(a) => RalliIcons.compass(a ? T.navy : T.textLight, 22, a)},
    {id:"messages", label:"Messages", icon:(a) => RalliIcons.chat(a ? T.navy : T.textLight)},
    {id:"profile",  label:"Profile",  icon:(a) => RalliIcons.person(a ? T.navy : T.textLight)},
    ...(isAdmin ? [{id:"admin", label:"Admin", icon:(a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a ? T.navy : T.textLight} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      </svg>
    )}] : []),
  ];
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(255,255,255,0.97)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderTop:`1px solid ${T.border}`,display:"flex",zIndex:50,paddingBottom:"env(safe-area-inset-bottom)"}}>
      {items.map(item=>{
        const active = tab===item.id;
        return (
          <button key={item.id} onClick={()=>onChange(item.id)}
            style={{flex:1,padding:"0.7rem 0.25rem 0.55rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.2rem",background:"none",border:"none",cursor:"pointer",transition:"all 0.2s",position:"relative"}}>
            {active && <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"32px",height:"3px",background:T.iceBlue,borderRadius:"0 0 3px 3px",boxShadow:`0 0 8px ${T.iceBlue}`}}/>}
            <div style={{position:"relative",display:"inline-flex"}}>
              {item.icon(active)}
              {item.id==="notifs" && unreadCount>0 && (
                <div style={{position:"absolute",top:"-3px",right:"-5px",minWidth:"15px",height:"15px",borderRadius:"999px",background:T.rose,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
                  <span style={{fontSize:"0.45rem",fontWeight:"800",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1}}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </div>
              )}
              {item.id==="messages" && msgUnread>0 && (
                <div style={{position:"absolute",top:"-3px",right:"-5px",minWidth:"15px",height:"15px",borderRadius:"999px",background:T.rose,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
                  <span style={{fontSize:"0.45rem",fontWeight:"800",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1}}>
                    {msgUnread > 9 ? "9+" : msgUnread}
                  </span>
                </div>
              )}
            </div>
            <span style={{fontSize:"0.55rem",fontFamily:"'Inter',sans-serif",fontWeight:active?"600":"400",letterSpacing:"0.14em",textTransform:"uppercase",color:active?T.navy:T.textLight}}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Root App ──────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = {error:null, info:null}; }
  static getDerivedStateFromError(e) { return {error:e}; }
  componentDidCatch(error, info) { this.setState({info}); console.error("App error:", error, info); }
  render() {
    if (this.state.error) {
      const isFirebase = this.state.error?.message?.includes("Firebase") || this.state.error?.message?.includes("network") || this.state.error?.message?.includes("fetch");
      return (
        <div style={{minHeight:"100vh",background:"#F8F9FB",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:"'Inter',sans-serif"}}>
          <div style={{width:"56px",height:"56px",borderRadius:"50%",background:"#FBF0EE",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:"1.25rem"}}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#AA4F57" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div style={{fontSize:"1rem",fontWeight:"700",color:"#111827",marginBottom:"0.4rem",textAlign:"center"}}>
            {isFirebase ? "Connection issue" : "Something went wrong"}
          </div>
          <div style={{fontSize:"0.8rem",color:"#9AACBC",marginBottom:"1.5rem",textAlign:"center",maxWidth:"280px",lineHeight:1.6}}>
            {isFirebase
              ? "Couldn't reach the server. Check your connection and try again."
              : "An unexpected error occurred. Tapping retry usually fixes it."}
          </div>
          <button onClick={()=>this.setState({error:null,info:null})}
            style={{padding:"0.75rem 2rem",background:"#111827",color:"#fff",border:"none",borderRadius:"0.65rem",fontSize:"0.85rem",fontWeight:"600",cursor:"pointer",fontFamily:"'Inter',sans-serif"}}>
            Try again
          </button>
          {process.env.NODE_ENV==="development"&&(
            <pre style={{marginTop:"1.5rem",fontSize:"0.6rem",color:"#9AACBC",maxWidth:"360px",whiteSpace:"pre-wrap",wordBreak:"break-all",background:"#F0F3F7",padding:"0.75rem",borderRadius:"0.5rem"}}>
              {this.state.error?.message}\n{this.state.error?.stack?.slice(0,400)}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
// Set page title
if (typeof document !== "undefined") {
  document.title = "Ralli by GoodSisters — Real people. Real skin. Real insights.";

  // Remove any existing favicons and set the Ralli R icon
  document.querySelectorAll("link[rel~='icon'], link[rel='apple-touch-icon']").forEach(el => el.remove());
  const iconSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='22' fill='%23111827'/%3E%3Ctext y='82' x='8' font-family='Arial Black,sans-serif' font-weight='900' font-size='80' fill='%23CFE8FF'%3ER%3C/text%3E%3C/svg%3E";
  const favLink = document.createElement('link'); favLink.rel = 'icon'; favLink.type = 'image/svg+xml'; favLink.href = iconSvg; document.head.appendChild(favLink);
  const appleLink = document.createElement('link'); appleLink.rel = 'apple-touch-icon'; appleLink.href = iconSvg; document.head.appendChild(appleLink);
}

// ── Debug Panel — admin-only floating log viewer ─────────────
const debugLogs = { entries: [], listeners: [] };
function debugLog(type, msg, data) {
  const entry = { type, msg, data, ts: Date.now() };
  debugLogs.entries.unshift(entry);
  if (debugLogs.entries.length > 80) debugLogs.entries.pop();
  debugLogs.listeners.forEach(fn => fn([...debugLogs.entries]));
}
// Intercept console.error and console.warn globally
const _origError = console.error;
const _origWarn  = console.warn;
console.error = (...args) => { _origError(...args); debugLog("error", args.map(a=>typeof a==="object"?JSON.stringify(a):String(a)).join(" ")); };
console.warn  = (...args) => { _origWarn(...args);  debugLog("warn",  args.map(a=>typeof a==="object"?JSON.stringify(a):String(a)).join(" ")); };

function DebugPanel({ user }) {
  const [open, setOpen] = React.useState(false);
  const [logs, setLogs] = React.useState([...debugLogs.entries]);
  const [filter, setFilter] = React.useState("all");
  const [testStatus, setTestStatus] = React.useState("");

  React.useEffect(() => {
    debugLogs.listeners.push(setLogs);
    return () => { debugLogs.listeners = debugLogs.listeners.filter(fn => fn !== setLogs); };
  }, []);

  if (!isAdmin(user)) return null;

  const filtered = filter === "all" ? logs : logs.filter(l => l.type === filter);
  const errorCount = logs.filter(l => l.type === "error").length;

  const typeColor = { error:"#f87171", warn:"#fbbf24", info:"#60a5fa", ok:"#4ade80", network:"#c084fc" };

  async function testAnthropicKey() {
    setTestStatus("Testing…");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
        body: JSON.stringify({ model:"claude-haiku-4-5-20251001", max_tokens:10, messages:[{role:"user",content:"hi"}] })
      });
      const d = await res.json();
      if (d.error) { setTestStatus("❌ " + d.error.message); debugLog("error", "API key test failed: " + d.error.message); }
      else { setTestStatus("✅ API key works"); debugLog("ok", "API key test passed"); }
    } catch(e) { setTestStatus("❌ " + e.message); debugLog("error", "API key test error: " + e.message); }
  }

  async function testOBF() {
    setTestStatus("Testing OBF…");
    try {
      const r = await fetch("https://world.openbeautyfacts.org/api/v0/product/3337875545082.json", {signal:AbortSignal.timeout(8000)});
      const d = await r.json();
      if (d.status === 1) { setTestStatus("✅ OBF reachable"); debugLog("ok", "OBF test passed: " + d.product?.product_name); }
      else { setTestStatus("❌ OBF: product not found"); }
    } catch(e) { setTestStatus("❌ OBF unreachable: " + e.message); debugLog("error", "OBF test failed: " + e.message); }
  }

  function addManualLog() {
    debugLog("info", "Manual test entry — " + new Date().toLocaleTimeString());
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position:"fixed", bottom:"calc(5.5rem + env(safe-area-inset-bottom))", right:"1rem",
          zIndex:9998, width:"40px", height:"40px", borderRadius:"50%",
          background: errorCount > 0 ? "#ef4444" : "#111827",
          border:"2px solid rgba(255,255,255,0.2)",
          color:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center",
          boxShadow:"0 2px 12px rgba(0,0,0,0.4)", fontSize:"1rem",
          fontFamily:"'Inter',sans-serif",
        }}>
        {open ? "✕" : errorCount > 0 ? <span style={{fontSize:"0.65rem",fontWeight:"800"}}>{errorCount > 9 ? "9+" : errorCount}!</span> : "🐛"}
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          position:"fixed", bottom:"calc(7.5rem + env(safe-area-inset-bottom))", right:"0.75rem", left:"0.75rem",
          maxWidth:"480px", margin:"0 auto",
          zIndex:9997, background:"#0d1117", borderRadius:"1rem",
          border:"1px solid rgba(255,255,255,0.1)", boxShadow:"0 8px 40px rgba(0,0,0,0.6)",
          maxHeight:"60vh", display:"flex", flexDirection:"column", overflow:"hidden",
          fontFamily:"monospace",
        }}>
          {/* Header */}
          <div style={{padding:"0.65rem 0.85rem", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0}}>
            <span style={{fontSize:"0.75rem", fontWeight:"700", color:"#fff"}}>🐛 Debug Console</span>
            <div style={{display:"flex", gap:"0.35rem"}}>
              {["all","error","warn","info","ok"].map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{fontSize:"0.55rem", padding:"0.15rem 0.4rem", borderRadius:"4px", border:"none", cursor:"pointer", background: filter===f ? typeColor[f]||"#fff" : "rgba(255,255,255,0.1)", color: filter===f ? "#000" : "#aaa", fontFamily:"monospace", fontWeight:"600"}}>
                  {f}
                </button>
              ))}
              <button onClick={() => { debugLogs.entries = []; setLogs([]); }}
                style={{fontSize:"0.55rem", padding:"0.15rem 0.4rem", borderRadius:"4px", border:"none", cursor:"pointer", background:"rgba(239,68,68,0.3)", color:"#f87171", fontFamily:"monospace"}}>
                clr
              </button>
            </div>
          </div>

          {/* Quick tests */}
          <div style={{padding:"0.5rem 0.85rem", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", gap:"0.4rem", alignItems:"center", flexShrink:0, flexWrap:"wrap"}}>
            <button onClick={testAnthropicKey} style={{fontSize:"0.6rem", padding:"0.2rem 0.55rem", borderRadius:"4px", border:"none", cursor:"pointer", background:"rgba(99,102,241,0.3)", color:"#a5b4fc", fontFamily:"monospace"}}>Test AI Key</button>
            <button onClick={testOBF} style={{fontSize:"0.6rem", padding:"0.2rem 0.55rem", borderRadius:"4px", border:"none", cursor:"pointer", background:"rgba(34,197,94,0.2)", color:"#86efac", fontFamily:"monospace"}}>Test OBF</button>
            <button onClick={addManualLog} style={{fontSize:"0.6rem", padding:"0.2rem 0.55rem", borderRadius:"4px", border:"none", cursor:"pointer", background:"rgba(255,255,255,0.1)", color:"#aaa", fontFamily:"monospace"}}>Ping</button>
            <span style={{fontSize:"0.6rem", color: ANTHROPIC_KEY ? "#4ade80" : "#f87171", marginLeft:"auto"}}>
              {ANTHROPIC_KEY ? `✓ Key: …${ANTHROPIC_KEY.slice(-6)}` : "✗ No API key"}
            </span>
          </div>
          {testStatus && (
            <div style={{padding:"0.3rem 0.85rem", background:"rgba(255,255,255,0.05)", fontSize:"0.65rem", color:"#e2e8f0", borderBottom:"1px solid rgba(255,255,255,0.08)", flexShrink:0}}>
              {testStatus}
            </div>
          )}

          {/* Log entries */}
          <div style={{overflowY:"auto", flex:1, padding:"0.4rem 0"}}>
            {filtered.length === 0 && (
              <div style={{textAlign:"center", padding:"1.5rem", color:"#4b5563", fontSize:"0.7rem"}}>No logs yet</div>
            )}
            {filtered.map((entry, i) => (
              <div key={i} style={{padding:"0.25rem 0.85rem", borderBottom:"1px solid rgba(255,255,255,0.04)", display:"flex", gap:"0.5rem", alignItems:"flex-start"}}>
                <span style={{fontSize:"0.55rem", color: typeColor[entry.type] || "#9ca3af", flexShrink:0, marginTop:"2px", fontWeight:"700", textTransform:"uppercase", minWidth:"36px"}}>
                  {entry.type}
                </span>
                <span style={{fontSize:"0.65rem", color: entry.type==="error" ? "#fca5a5" : entry.type==="warn" ? "#fde68a" : "#d1d5db", lineHeight:1.45, wordBreak:"break-all"}}>
                  {entry.msg}
                </span>
                <span style={{fontSize:"0.5rem", color:"#374151", flexShrink:0, marginTop:"2px"}}>
                  {new Date(entry.ts).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>

          {/* Device info footer */}
          <div style={{padding:"0.4rem 0.85rem", borderTop:"1px solid rgba(255,255,255,0.08)", flexShrink:0}}>
            <div style={{fontSize:"0.55rem", color:"#4b5563", lineHeight:1.6}}>
              {navigator.userAgent.slice(0, 80)} · {window.innerWidth}×{window.innerHeight}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function App() {
  return <ErrorBoundary><AppInner/></ErrorBoundary>;
}

function AppInner() {
  // ── Global autofix runner state (persists across all navigation) ──
  const [afRunning, setAfRunning]   = useState(false);
  const [afLog, setAfLog]           = useState([]);
  const [afDone, setAfDone]         = useState(false);
  const [afProducts, setAfProducts] = useState([]);
  const afLogRef = React.useRef([]);

  function afAddLog(type, msg) {
    const entry = { type, msg };
    afLogRef.current = [...afLogRef.current, entry];
    setAfLog([...afLogRef.current]);
  }

  const [user, setUser]         = useState(null);
  const [profile, setProfile]   = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [tab, setTab]           = useState(()=>{
    try { return sessionStorage.getItem('ralli_tab')||'feed'; } catch { return 'feed'; }
  });
  const [tabDir, setTabDir]     = useState("tab-fade");
  const prevTabRef              = React.useRef("feed");
  const TAB_ORDER               = ["feed","check","messages","shop","notifs","profile","admin","glossary"];
  function switchTab(t) {
    const prev = prevTabRef.current;
    const prevIdx = TAB_ORDER.indexOf(prev);
    const nextIdx = TAB_ORDER.indexOf(t);
    if (prevIdx === -1 || nextIdx === -1 || prevIdx === nextIdx) {
      setTabDir("tab-fade");
    } else {
      setTabDir(nextIdx > prevIdx ? "tab-slide-left" : "tab-slide-right");
    }
    prevTabRef.current = t;
    setTab(t);
    try { sessionStorage.setItem('ralli_tab', t); } catch {}
  }
  const [viewingUid, setViewingUid] = useState(null);
  const [feedRefresh, setFeedRefresh] = useState(0);
  const [msgUnread, setMsgUnread] = useState(0);
  const [chatOpen, setChatOpen] = useState(false);
  const chatCloseRef = React.useRef(null); // MessagesPage registers its close fn here
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showOurStory, setShowOurStory] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [msgBanner, setMsgBanner] = useState(null); // {senderName, senderPhoto, text, uid}
  const msgBannerTimer = React.useRef(null);
  const prevConvosRef = React.useRef({}); // convoId -> lastAt to detect new messages

  // Listen for new incoming messages and show banner when not on messages tab
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "conversations"),
      where("participants", "array-contains", user.uid),
      orderBy("lastAt", "desc"),
      limit(20)
    );
    const unsub = onSnapshot(q, async snap => {
      const prev = prevConvosRef.current;
      const newBanners = [];
      for (const d of snap.docs) {
        const data = d.data();
        const cid = d.id;
        const lastAt = data.lastAt?.seconds || 0;
        const unread = data[`unread_${user.uid}`] || 0;
        const otherUid = data.participants?.find(p => p !== user.uid);
        // New message if lastAt changed, unread > 0, and sender is not current user
        if (prev[cid] && prev[cid] < lastAt && unread > 0 && otherUid) {
          newBanners.push({ cid, otherUid, lastMessage: data.lastMessage || "Sent you a message" });
        }
        prev[cid] = lastAt;
      }
      prevConvosRef.current = prev;
      if (newBanners.length > 0 && tab !== "messages") {
        const b = newBanners[0];
        try {
          const usnap = await getDoc(doc(db, "users", b.otherUid));
          const udata = usnap.data() || {};
          setMsgBanner({ senderName: udata.displayName || "Someone", senderPhoto: udata.photoURL || "", text: b.lastMessage, uid: b.otherUid });
          clearTimeout(msgBannerTimer.current);
          msgBannerTimer.current = setTimeout(() => setMsgBanner(null), 4000);
        } catch {}
      }
    }, () => {});
    return () => { unsub(); clearTimeout(msgBannerTimer.current); };
  }, [user?.uid, tab]);

  // Real-time unread notifications count
  useEffect(()=>{
    if (!user) return;
    const q = query(collection(db,"notifications"), where("toUid","==",user.uid), where("read","==",false), limit(20));
    const unsub = onSnapshot(q, snap => setUnreadCount(snap.size), () => {});
    return unsub;
  },[user]);

  useEffect(()=>{
    return onAuthStateChanged(auth, async u=>{
      if (u) {
        const p=await getOrCreateProfile(u);
        setUser(u); setProfile(p);
        if (p.isNew) setShowOnboarding(true);
        // Show Our Story popup for first 5 logins
        const key = `goodsistersStoryCount_${u.uid}`;
        const count = parseInt(localStorage.getItem(key)||"0");
        if (count < 5) {
          localStorage.setItem(key, String(count+1));
          setTimeout(()=>setShowOurStory(true), 1200);
        }
      }
      else { setUser(null); setProfile(null); }
      setAuthLoading(false);
    });
  },[]);

  useEffect(()=>{
    if (tab==="profile" && user && !profile) {
      getOrCreateProfile(user).then(p=>setProfile(p));
    }
  },[tab, user]);

  function handleUserTap(uid) { setViewingUid(uid); }
  function handleBack()       { setViewingUid(null); }

  // Global user tap event — fired by ProductModal when onUserTap isn't passed
  React.useEffect(() => {
    const handler = (e) => { if(e.detail) { setViewingUid(e.detail); switchTab("feed"); } };
    window.addEventListener("ralli_view_user", handler);
    return () => window.removeEventListener("ralli_view_user", handler);
  }, []);

  if (authLoading) return (
    <><style>{GS}</style>
    <div style={{minHeight:"100vh",background:T.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:T.textLight,fontFamily:"'Inter',sans-serif"}}>Loading…</div>
    </div></>
  );

  if (!user) return <><style>{GS}</style><AuthPage/></>;

  if (showOnboarding) return (
    <><style>{GS}</style>
    <OnboardingFlow
      user={user} profile={profile}
      onComplete={async (updates)=>{
        try {
          await updateDoc(doc(db,"users",user.uid),{...updates, isNew:false});
          setProfile(p=>({...p,...updates,isNew:false}));
        } catch {}
        setShowOnboarding(false);
      }}
    /></>
  );

  return (
    <><style>{GS}</style>
    <div style={{minHeight:"100vh",background:T.bg}}>
      {/* Top bar */}
      <div style={{background:T.bg+"FA",backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderBottom:`1px solid ${T.border}`,padding:"0.9rem 1.5rem",position:"sticky",top:0,zIndex:40}}>
        <div style={{maxWidth:"480px",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"'Poppins',sans-serif",fontWeight:"900",fontSize:"1.1rem",color:T.text,letterSpacing:"-0.04em"}}>
              <span style={{display:'block',fontFamily:"'Poppins',sans-serif",fontWeight:'900',fontSize:'1.2rem',letterSpacing:'-0.04em',lineHeight:1}}>Ralli</span>
              <span style={{display:'block',fontFamily:"'Inter',sans-serif",fontWeight:'300',fontSize:'0.55rem',letterSpacing:'0.18em',textTransform:'uppercase',color:T.textLight,marginTop:'2px'}}>by GoodSisters</span>
            </span>
          <div style={{position:"relative"}}>
            <button onClick={()=>{setShowNotifPanel(p=>!p);if(!showNotifPanel){setUnreadCount(0);markAllRead(user.uid);}}}
              style={{background:showNotifPanel?T.surfaceAlt:"none",border:"none",cursor:"pointer",padding:"0.4rem",position:"relative",color:showNotifPanel?T.text:T.textMid,display:"flex",alignItems:"center",borderRadius:"50%",transition:"all 0.15s"}}
              onMouseEnter={e=>{e.currentTarget.style.background=T.surfaceAlt;e.currentTarget.style.color=T.text;}}
              onMouseLeave={e=>{if(!showNotifPanel){e.currentTarget.style.background="none";e.currentTarget.style.color=T.textMid;}}}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unreadCount>0&&(
                <div style={{position:"absolute",top:"-1px",right:"-1px",minWidth:"16px",height:"16px",borderRadius:"999px",background:T.rose,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
                  <span style={{fontSize:"0.5rem",fontWeight:"800",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1}}>{unreadCount>9?"9+":unreadCount}</span>
                </div>
              )}
            </button>
            {/* Notification dropdown panel */}
            {showNotifPanel&&(
              <>
                <div onClick={()=>setShowNotifPanel(false)} style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:44}}/>
                <div style={{position:"absolute",right:0,top:"calc(100% + 8px)",width:"min(340px,90vw)",background:T.surface,border:`1px solid ${T.border}`,borderRadius:"1rem",boxShadow:"0 8px 32px rgba(17,24,39,0.12)",zIndex:45,overflow:"hidden",animation:"slideDown 0.18s ease"}}>
                  <NotifDropdown user={user} onUserTap={uid=>{setShowNotifPanel(false);setViewingUid(uid);switchTab("feed");}}/>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Pages */}
      <div key={viewingUid||tab} className={viewingUid ? "tab-fade" : tabDir} style={{minHeight:"60vh", ...(tab==="messages" && !viewingUid ? {height:"calc(100vh - 3.5rem)",display:"flex",flexDirection:"column",overflow:"hidden"} : {})}}>
      {viewingUid
        ? <UserPage uid={viewingUid} currentUid={user.uid} currentProfile={profile} onUpdateProfile={setProfile} onBack={handleBack} onUserTap={handleUserTap}/>
        : tab==="feed"
          ? <FeedPage user={user} profile={profile} refreshKey={feedRefresh} onUserTap={handleUserTap} onUpdateProfile={(updates)=>{
              if (updates?._navigateTo === "profile_people") { switchTab("profile"); setTimeout(()=>window.dispatchEvent(new CustomEvent("ralli_profile_tab", {detail:"people"})), 100); return; }
              setProfile(updates);
            }}/>
          : tab==="check"
            ? <ScanPage user={user} profile={profile} onPosted={()=>{setFeedRefresh(r=>r+1);switchTab("feed");}} onUpdateProfile={setProfile}/>
            : tab==="messages"
              ? <MessagesPage user={user} profile={profile} onUserTap={handleUserTap} onUnreadChange={setMsgUnread} onChatOpen={setChatOpen} chatCloseRef={chatCloseRef}/>
            : tab==="shop"
              ? <ShopPage user={user} profile={profile} onUpdateProfile={setProfile}/>
            : tab==="admin"
              ? <AdminDashboard user={user} afRunning={afRunning} afLog={afLog} afDone={afDone} afProducts={afProducts} setAfRunning={setAfRunning} setAfLog={setAfLog} setAfDone={setAfDone} setAfProducts={setAfProducts} afAddLog={afAddLog}/>
              : tab==="glossary"
                ? <GlossaryPage/>
                : tab==="notifs"
                  ? <NotificationsPage user={user} onUserTap={uid=>{setViewingUid(uid);switchTab("feed");}}/>
                    : profile
                      ? <MyProfilePage user={user} profile={profile} onUpdate={setProfile} onUserTap={handleUserTap} onAdminTap={()=>switchTab("admin")}/>
                      : <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:"0.75rem"}}>
                          <div style={{width:"28px",height:"28px",borderRadius:"50%",border:`2px solid ${T.accent}`,borderTopColor:"transparent",animation:"spin 0.8s linear infinite"}}/>
                          <div style={{color:T.textLight,fontSize:"0.82rem",fontFamily:"'Inter',sans-serif"}}>Loading profile…</div>
                        </div>
      }

      </div>
      {/* Message notification banner */}
      {msgBanner && (
        <div onClick={() => { setMsgBanner(null); switchTab("messages"); }}
          style={{ position:"fixed", top:"env(safe-area-inset-top, 0px)", left:0, right:0, zIndex:200, display:"flex", justifyContent:"center", padding:"0.5rem 1rem", pointerEvents:"none" }}>
          <div style={{ pointerEvents:"all", maxWidth:"420px", width:"100%", background:"rgba(20,20,30,0.92)", backdropFilter:"blur(16px)", WebkitBackdropFilter:"blur(16px)", borderRadius:"1rem", padding:"0.7rem 1rem", display:"flex", alignItems:"center", gap:"0.75rem", boxShadow:"0 4px 24px rgba(0,0,0,0.25)", animation:"slideDown 0.3s ease", cursor:"pointer" }}>
            <div style={{ width:"36px", height:"36px", borderRadius:"50%", overflow:"hidden", flexShrink:0, background:T.accent, display:"flex", alignItems:"center", justifyContent:"center" }}>
              {msgBanner.senderPhoto
                ? <img src={msgBanner.senderPhoto} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/>
                : <span style={{ fontSize:"0.7rem", fontWeight:"700", color:"#fff" }}>{msgBanner.senderName[0]}</span>
              }
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:"0.75rem", fontWeight:"700", color:"#fff", fontFamily:"'Inter',sans-serif" }}>{msgBanner.senderName}</div>
              <div style={{ fontSize:"0.72rem", color:"rgba(255,255,255,0.7)", fontFamily:"'Inter',sans-serif", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{msgBanner.text}</div>
            </div>
            <button onClick={e => { e.stopPropagation(); setMsgBanner(null); }} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.5)", cursor:"pointer", padding:"2px", flexShrink:0, fontSize:"1rem", lineHeight:1 }}>✕</button>
          </div>
        </div>
      )}

      <BottomNav tab={tab} onChange={t=>{
        // Close any open chat first
        if(chatCloseRef.current) chatCloseRef.current();
        setChatOpen(false);
        switchTab(t);
        setViewingUid(null);
        if(t==="notifs")setUnreadCount(0);
        if(t==="messages")setMsgUnread(0);
      }} unreadCount={unreadCount} msgUnread={msgUnread} currentUid={user?.uid||""} isAdmin={isAdmin(user)}/>
      {showOurStory&&!showOnboarding&&(
        <OurStoryPopup onClose={()=>setShowOurStory(false)} onUserTap={handleUserTap}/>
      )}
      {afRunning&&(
        <div style={{position:"fixed",bottom:"5.5rem",left:"50%",transform:"translateX(-50%)",zIndex:9999,background:T.text,color:"#fff",padding:"0.45rem 1rem",borderRadius:"999px",fontSize:"0.72rem",fontWeight:"700",fontFamily:"'Inter',sans-serif",boxShadow:"0 4px 20px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",gap:"0.5rem",whiteSpace:"nowrap",pointerEvents:"none"}}>
          <span style={{display:"inline-block",width:"8px",height:"8px",borderRadius:"50%",background:"#4ade80",animation:"pulse 1s infinite"}}/>
          Auto-fix running… {afLog.filter(l=>l.type==="ok").length} fixed
        </div>
      )}
      <DebugPanel user={user}/>
    </div></>
  );
}
