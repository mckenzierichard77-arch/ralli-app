// Miscellaneous hardcoded data constants

export const AMAZON_AFFILIATE_TAG = "ralliapp-20"; // e.g. "ralliapp-20"

export const SKIN_TIPS = [
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

export const FOUNDERS = [
  {email:"mckenzierichard77@gmail.com", name:"McKenzie Richard", initial:"Mk"},
  {email:"morganrichard777@gmail.com",  name:"Morgan Richard",   initial:"Mo"},
];

export const ADMIN_UIDS = []; // add your UID here once you see it in Profile
export const ADMIN_EMAILS = ["mckenzierichard77@gmail.com", "morganrichard777@gmail.com", "angela@theralliapp.com"];
export const VA_EMAILS = [
  "banilaroselyn0628@gmail.com",
];

export const DAILY_MESSAGES = [
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

export const BRAND_BLURBS = {
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

export const BRAND_PALETTE={"cerave":{bg:"linear-gradient(135deg,#1a3a5c,#0f2236)",accent:"#7EC8E3"},"la roche-posay":{bg:"linear-gradient(135deg,#1B3F6E,#0d2440)",accent:"#A8C8F0"},"the ordinary":{bg:"linear-gradient(135deg,#1a1a1a,#2d2d2d)",accent:"#BBBBBB"},"paula's choice":{bg:"linear-gradient(135deg,#2C1810,#4a2818)",accent:"#E8A87C"},"cosrx":{bg:"linear-gradient(135deg,#1a3320,#0f2015)",accent:"#7EC89A"},"drunk elephant":{bg:"linear-gradient(135deg,#5C2D0E,#3a1a08)",accent:"#F4A460"},"neutrogena":{bg:"linear-gradient(135deg,#003366,#001833)",accent:"#66A3CC"},"elta md":{bg:"linear-gradient(135deg,#1a4a3a,#0d2520)",accent:"#7EC8A8"},"clearstem":{bg:"linear-gradient(135deg,#2a1a3a,#1a0d28)",accent:"#C8A8E8"},"tatcha":{bg:"linear-gradient(135deg,#3D1A3A,#210d20)",accent:"#D4A8C8"},"naturium":{bg:"linear-gradient(135deg,#1a3a1a,#0d200d)",accent:"#88C888"}};
