// Shop page data: categories, product seeds, category maps

export const AMZN = (asin) => `https://www.amazon.com/dp/${asin}`;

export const SHOP_CATEGORIES = [
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

export const CLEAN_BRANDS_SEED = [
  // ── Merit ──────────────────────────────────────────────
  {brand:"Merit", productName:"The Minimalist Perfecting Complexion Stick", category:"makeup"},
  {brand:"Merit", productName:"Flush Balm Cream Blush", category:"makeup"},
  {brand:"Merit", productName:"Signature Lip Lightweight Lipstick", category:"lip"},
  {brand:"Merit", productName:"Great Skin Instant Glow Serum", category:"serum"},
  {brand:"Merit", productName:"Solo Shadow Single Eyeshadow", category:"makeup"},
  {brand:"Merit", productName:"Brush No. 1 Cheek & Complexion Brush", category:"other"},
  {brand:"Merit", productName:"Clean Lash Lengthening Mascara", category:"makeup"},
  {brand:"Merit", productName:"Day Glow Highlighting Balm", category:"makeup"},
  {brand:"Merit", productName:"Bronze Balm Cream Bronzer", category:"makeup"},
  {brand:"Merit", productName:"Shade Slick Tinted Lip Oil", category:"lip"},
  {brand:"Merit", productName:"Fountain Skin Tint Hydrating Serum Tint", category:"makeup"},
  {brand:"Merit", productName:"Brow 1980 Volumizing Tinted Brow Gel", category:"makeup"},
  {brand:"Merit", productName:"The Minimalist Concealer", category:"makeup"},

  // ── Tower 28 ───────────────────────────────────────────
  {brand:"Tower 28", productName:"SOS Daily Rescue Facial Spray", category:"toner"},
  {brand:"Tower 28", productName:"SOS Intensive Redness Relief Serum", category:"serum"},
  {brand:"Tower 28", productName:"SOS Daily Barrier Cream", category:"moisturizer"},
  {brand:"Tower 28", productName:"BeachPlease Tinted Lip + Cheek Balm", category:"makeup"},
  {brand:"Tower 28", productName:"SuperDew Highlight Balm", category:"makeup"},
  {brand:"Tower 28", productName:"Swipe Serum Concealer", category:"makeup"},
  {brand:"Tower 28", productName:"OneShot Adaptive Foundation Stick", category:"makeup"},
  {brand:"Tower 28", productName:"LipSoftie Hydrating Tinted Lip Treatment", category:"lip"},
  {brand:"Tower 28", productName:"MakeWaves Lengthening + Volumizing Mascara", category:"makeup"},
  {brand:"Tower 28", productName:"ShineOn Lip Jelly", category:"lip"},
  {brand:"Tower 28", productName:"JuiceBalm Vegan Tinted Lip Balm", category:"lip"},
  {brand:"Tower 28", productName:"Bronzino Illuminating Cream Bronzer", category:"makeup"},
  {brand:"Tower 28", productName:"GetSet Setting Powder", category:"makeup"},

  // ── Cetaphil ───────────────────────────────────────────
  {brand:"Cetaphil", productName:"Daily Facial Cleanser", category:"face-wash"},
  {brand:"Cetaphil", productName:"Gentle Foaming Cleanser", category:"face-wash"},
  {brand:"Cetaphil", productName:"PRO Oil Removing Foam Wash", category:"face-wash"},
  {brand:"Cetaphil", productName:"Daily Facial Moisturizer SPF 35", category:"spf"},
  {brand:"Cetaphil", productName:"Healthy Radiance Brightening Day Cream SPF 15", category:"moisturizer"},
  {brand:"Cetaphil", productName:"Healthy Radiance Eye Cream", category:"eye"},
  {brand:"Cetaphil", productName:"Healthy Radiance Brightness Reveal Serum", category:"serum"},
  {brand:"Cetaphil", productName:"Soothing Gel Cream with Aloe", category:"moisturizer"},
  {brand:"Cetaphil", productName:"Deep Hydration Healthy Glow Daily Cream", category:"moisturizer"},
  {brand:"Cetaphil", productName:"Deep Hydration 48 Hour Activation Serum", category:"serum"},
  {brand:"Cetaphil", productName:"Gentle Skin Cleansing Cloths", category:"face-wash"},
  {brand:"Cetaphil", productName:"Pro Acne Control Foam Wash", category:"acne"},
  {brand:"Cetaphil", productName:"Eczema Soothing Moisturizer", category:"body"},

  // ── Youth To The People ────────────────────────────────
  {brand:"Youth To The People", productName:"Kale + Green Tea Spinach Vitamins Superfood Cleanser", category:"face-wash"},
  {brand:"Youth To The People", productName:"Polypeptide-121 Future Cream Firm + Bright Moisturizer", category:"moisturizer"},
  {brand:"Youth To The People", productName:"Yerba Mate Resveratrol Eye Cream", category:"eye"},
  {brand:"Youth To The People", productName:"Triple Peptide + Cactus Oasis Serum", category:"serum"},
  {brand:"Youth To The People", productName:"Mineral Glow Sunscreen SPF 30", category:"spf"},
  {brand:"Youth To The People", productName:"Dream Eye Cream with Vitamin C", category:"eye"},
  {brand:"Youth To The People", productName:"Superberry Hydrate + Glow Dream Mask", category:"mask"},
  {brand:"Youth To The People", productName:"Yerba Mate Resveratrol Cleansing Balm", category:"face-wash"},
  {brand:"Youth To The People", productName:"15% Vitamin C + Clean Caffeine Energy Serum", category:"serum"},
  {brand:"Youth To The People", productName:"10% Niacinamide + Tranexamic Acid Brightening Serum", category:"serum"},
  {brand:"Youth To The People", productName:"Adaptogen Soothe + Hydrate Activated Mist", category:"toner"},
  {brand:"Youth To The People", productName:"Superfood Antioxidant Eye Cream", category:"eye"},

  // ── Clearstem ──────────────────────────────────────────
  {brand:"Clearstem", productName:"GENTLECLEAN Acne-Safe Cleanser", category:"face-wash"},
  {brand:"Clearstem", productName:"VITAMINSCRUB Acne-Safe Exfoliating Cleanser", category:"face-wash"},
  {brand:"Clearstem", productName:"HYDRAGLOW Hyaluronic Acid Moisturizer", category:"moisturizer"},
  {brand:"Clearstem", productName:"PRO-ACT Pre-Vitamin A Brightening Serum", category:"serum"},
  {brand:"Clearstem", productName:"BRIGHTEYES Acne-Safe Eye Cream", category:"eye"},
  {brand:"Clearstem", productName:"CLEARITY Anti-Acne + Anti-Aging Serum", category:"acne"},
  {brand:"Clearstem", productName:"MINDBODYSKIN Hormonal Acne Supplement", category:"other"},
  {brand:"Clearstem", productName:"BODYCLEAR Acne-Safe Body Wash", category:"body"},
  {brand:"Clearstem", productName:"SKIN PREBIOTIC Pro-Microbiome Powder", category:"other"},
  {brand:"Clearstem", productName:"GROWTH Lash + Brow Serum", category:"other"},

  // ── Naturium ───────────────────────────────────────────
  {brand:"Naturium", productName:"The Glow Getter Multi-Oil Hydrating Body Wash", category:"body"},
  {brand:"Naturium", productName:"Niacinamide Cleansing Gel 3%", category:"face-wash"},
  {brand:"Naturium", productName:"Niacinamide Serum 12% Plus Zinc 2%", category:"serum"},
  {brand:"Naturium", productName:"Salicylic Acid Cleansing Gel 2%", category:"face-wash"},
  {brand:"Naturium", productName:"BHA Liquid Exfoliant 2%", category:"exfoliant"},
  {brand:"Naturium", productName:"Vitamin C Complex Serum", category:"serum"},
  {brand:"Naturium", productName:"Phyto-Glow Lip Balm", category:"lip"},
  {brand:"Naturium", productName:"Mineral Sunscreen SPF 50", category:"spf"},
  {brand:"Naturium", productName:"Dew-Glow Moisturizer SPF 50", category:"spf"},
  {brand:"Naturium", productName:"Plant Ceramide Rich Moisture Cream", category:"moisturizer"},
  {brand:"Naturium", productName:"Multi-Bright Tranexamic Acid Treatment 5%", category:"serum"},
  {brand:"Naturium", productName:"Quadruple Hyaluronic Acid Serum 5%", category:"serum"},
  {brand:"Naturium", productName:"Multi-Peptide Eye Cream", category:"eye"},
  {brand:"Naturium", productName:"Body Wash Glow Getter", category:"body"},
  {brand:"Naturium", productName:"Mandelic Topical Acid 12%", category:"exfoliant"},
  {brand:"Naturium", productName:"Retinol Complex Serum 1%", category:"serum"},
  {brand:"Naturium", productName:"Glycolic Acid Cleansing Gel 5%", category:"face-wash"},

  // ── NARS ───────────────────────────────────────────────
  {brand:"NARS", productName:"Light Reflecting Foundation", category:"makeup"},
  {brand:"NARS", productName:"Soft Matte Complete Foundation", category:"makeup"},
  {brand:"NARS", productName:"Radiant Creamy Concealer", category:"makeup"},
  {brand:"NARS", productName:"Soft Matte Complete Concealer", category:"makeup"},
  {brand:"NARS", productName:"Blush in Orgasm", category:"makeup"},
  {brand:"NARS", productName:"Air Matte Blush", category:"makeup"},
  {brand:"NARS", productName:"Air Matte Lip Color", category:"lip"},
  {brand:"NARS", productName:"Powermatte Lip Pigment", category:"lip"},
  {brand:"NARS", productName:"Afterglow Lip Balm", category:"lip"},
  {brand:"NARS", productName:"Climax Mascara", category:"makeup"},
  {brand:"NARS", productName:"Light Reflecting Setting Powder", category:"makeup"},
  {brand:"NARS", productName:"Sheer Glow Foundation", category:"makeup"},
  {brand:"NARS", productName:"Tinted Moisturizer SPF 30", category:"makeup"},

  // ── Innisfree ──────────────────────────────────────────
  {brand:"Innisfree", productName:"Green Tea Hyaluronic Serum", category:"serum"},
  {brand:"Innisfree", productName:"Green Tea Seed Hyaluronic Cream", category:"moisturizer"},
  {brand:"Innisfree", productName:"Daily UV Defense Sunscreen SPF 36", category:"spf"},
  {brand:"Innisfree", productName:"Volcanic Clay Pore Mask", category:"mask"},
  {brand:"Innisfree", productName:"Retinol Cica Repair Ampoule", category:"serum"},
  {brand:"Innisfree", productName:"Cherry Blossom Glow Cream", category:"moisturizer"},
  {brand:"Innisfree", productName:"Bija Trouble Spot Essence", category:"acne"},
  {brand:"Innisfree", productName:"Pore Clearing Foam Cleanser with Volcanic Cluster", category:"face-wash"},

  // ── ILIA ───────────────────────────────────────────────
  {brand:"ILIA", productName:"Super Serum Skin Tint SPF 40", category:"makeup"},
  {brand:"ILIA", productName:"True Skin Serum Foundation", category:"makeup"},
  {brand:"ILIA", productName:"True Skin Serum Concealer", category:"makeup"},
  {brand:"ILIA", productName:"Multi-Stick Cream Blush + Lip + Cheek", category:"makeup"},
  {brand:"ILIA", productName:"Limitless Lash Mascara", category:"makeup"},
  {brand:"ILIA", productName:"Liquid Light Serum Highlighter", category:"makeup"},
  {brand:"ILIA", productName:"Color Haze Multi-Use Pigment", category:"makeup"},
  {brand:"ILIA", productName:"Balmy Tint Hydrating Lip Balm", category:"lip"},
  {brand:"ILIA", productName:"Soft Focus Finishing Powder", category:"makeup"},
  {brand:"ILIA", productName:"The Necessary Eyeshadow Palette", category:"makeup"},

  // ── Saie ───────────────────────────────────────────────
  {brand:"Saie", productName:"Glowy Super Gel Lightweight Dewy Highlighter", category:"makeup"},
  {brand:"Saie", productName:"Sunvisor Radiant Moisturizing Face Sunscreen SPF 35", category:"spf"},
  {brand:"Saie", productName:"Slip Tint Dewy Tinted Moisturizer SPF 35", category:"makeup"},
  {brand:"Saie", productName:"Dew Blush Liquid Cheek Blush", category:"makeup"},
  {brand:"Saie", productName:"Lip Blur Soft-Matte Hydrating Lip Treatment", category:"lip"},
  {brand:"Saie", productName:"Mascara 101 Lengthening + Lifting", category:"makeup"},
  {brand:"Saie", productName:"Brow Butter Conditioning Brow Pomade", category:"makeup"},
  {brand:"Saie", productName:"Glossybounce Hydrating Lip Gloss Oil", category:"lip"},
  {brand:"Saie", productName:"Sun Melt Cream Bronzer", category:"makeup"},

  // ── Westman Atelier ────────────────────────────────────
  {brand:"Westman Atelier", productName:"Vital Skincare Complexion Drops", category:"makeup"},
  {brand:"Westman Atelier", productName:"Vital Pressed Skincare Foundation", category:"makeup"},
  {brand:"Westman Atelier", productName:"Baby Cheeks Blush Stick", category:"makeup"},
  {brand:"Westman Atelier", productName:"Lit Up Highlight Stick", category:"makeup"},
  {brand:"Westman Atelier", productName:"Lip Suede Hydrating Matte Lipstick", category:"lip"},
  {brand:"Westman Atelier", productName:"Eye Pods Cream Eyeshadow Duo", category:"makeup"},
  {brand:"Westman Atelier", productName:"Beauty Butter Powder Bronzer", category:"makeup"},

  // ── Kosas ──────────────────────────────────────────────
  {brand:"Kosas", productName:"Revealer Concealer Super Creamy + Brightening", category:"makeup"},
  {brand:"Kosas", productName:"Revealer Skin-Improving Foundation SPF 25", category:"makeup"},
  {brand:"Kosas", productName:"DreamBeam Silicone-Free Mineral Sunscreen SPF 40", category:"spf"},
  {brand:"Kosas", productName:"Cloud Set Baked Setting + Smoothing Talc-Free Powder", category:"makeup"},
  {brand:"Kosas", productName:"BB Burst Tinted Moisturizer Gel Cream", category:"makeup"},
  {brand:"Kosas", productName:"Plump + Juicy Lip Booster Buttery Treatment", category:"lip"},
  {brand:"Kosas", productName:"Wet Lip Oil Plumping Treatment Gloss", category:"lip"},
  {brand:"Kosas", productName:"The Big Clean Volumizing + Lash Care Mascara", category:"makeup"},
  {brand:"Kosas", productName:"Stick Foundation Cream Concealer", category:"makeup"},

  // ── Krave Beauty ───────────────────────────────────────
  {brand:"Krave Beauty", productName:"Matcha Hemp Hydrating Cleanser", category:"face-wash"},
  {brand:"Krave Beauty", productName:"Great Barrier Relief Soothing Repair Serum", category:"serum"},
  {brand:"Krave Beauty", productName:"Oat So Simple Water Cream", category:"moisturizer"},
  {brand:"Krave Beauty", productName:"Kale-Lalu-yAHA Mild Resurfacing Serum", category:"exfoliant"},
  {brand:"Krave Beauty", productName:"Beet The Sun SPF 40 PA++++", category:"spf"},

  // ── Glossier ───────────────────────────────────────────
  {brand:"Glossier", productName:"Milky Jelly Cleanser", category:"face-wash"},
  {brand:"Glossier", productName:"Super Bounce Hydrating Serum", category:"serum"},
  {brand:"Glossier", productName:"Super Pure Niacinamide + Zinc Serum", category:"serum"},
  {brand:"Glossier", productName:"Super Glow Vitamin C + Magnesium Serum", category:"serum"},
  {brand:"Glossier", productName:"Invisible Shield Daily Sunscreen SPF 35", category:"spf"},
  {brand:"Glossier", productName:"Balm Dotcom Universal Skin Salve", category:"lip"},
  {brand:"Glossier", productName:"Futuredew Oil-Serum Hybrid", category:"serum"},
  {brand:"Glossier", productName:"Solution Exfoliating Skin Perfector", category:"exfoliant"},
  {brand:"Glossier", productName:"After Baume Moisture Barrier Recovery Cream", category:"moisturizer"},

  // ── Versed ─────────────────────────────────────────────
  {brand:"Versed", productName:"Day Dissolve Cleansing Balm", category:"face-wash"},
  {brand:"Versed", productName:"Weekend Glow Daily Brightening Solution", category:"serum"},
  {brand:"Versed", productName:"Press Restart Gentle Retinol Serum", category:"serum"},
  {brand:"Versed", productName:"Skin Soak Rich Moisture Cream", category:"moisturizer"},
  {brand:"Versed", productName:"Dew Point Moisturizing Gel-Cream", category:"moisturizer"},
  {brand:"Versed", productName:"Guards Up Daily Mineral Sunscreen", category:"spf"},
  {brand:"Versed", productName:"Just Breathe Clarifying Serum", category:"acne"},
  {brand:"Versed", productName:"Doctor's Visit Instant Resurfacing Mask", category:"mask"},

  // ── Bubble Skincare ────────────────────────────────────
  {brand:"Bubble Skincare", productName:"Fresh Start Gel Cleanser", category:"face-wash"},
  {brand:"Bubble Skincare", productName:"Slam Dunk Hydrating Moisturizer", category:"moisturizer"},
  {brand:"Bubble Skincare", productName:"Day Dream Hydrating Toner", category:"toner"},
  {brand:"Bubble Skincare", productName:"Level Up Daily Moisturizer SPF 30", category:"spf"},
  {brand:"Bubble Skincare", productName:"Solo Act Hyaluronic Acid Serum", category:"serum"},
  {brand:"Bubble Skincare", productName:"Break Even Salicylic Acid Cleanser", category:"face-wash"},

  // ── Bliss ──────────────────────────────────────────────
  {brand:"Bliss", productName:"Clear Genius Clarifying Toner", category:"toner"},
  {brand:"Bliss", productName:"Bright Idea Vitamin C Brightening Serum", category:"serum"},
  {brand:"Bliss", productName:"Block Star Mineral Sunscreen SPF 30", category:"spf"},
  {brand:"Bliss", productName:"Drench & Quench Moisturizer", category:"moisturizer"},

  // ── Dermalogica ────────────────────────────────────────
  {brand:"Dermalogica", productName:"Special Cleansing Gel", category:"face-wash"},
  {brand:"Dermalogica", productName:"Daily Microfoliant", category:"exfoliant"},
  {brand:"Dermalogica", productName:"Active Moist", category:"moisturizer"},
  {brand:"Dermalogica", productName:"Skin Smoothing Cream", category:"moisturizer"},
  {brand:"Dermalogica", productName:"Multi Vitamin Power Recovery Masque", category:"mask"},

  // ── REN ────────────────────────────────────────────────
  {brand:"REN Clean Skincare", productName:"Ready Steady Glow Daily AHA Tonic", category:"toner"},
  {brand:"REN Clean Skincare", productName:"Evercalm Gentle Cleansing Gel", category:"face-wash"},
  {brand:"REN Clean Skincare", productName:"Clearcalm Clarifying Clay Cleanser", category:"face-wash"},
  {brand:"REN Clean Skincare", productName:"Vita-Mineral Daily Supplement Moisturising Cream", category:"moisturizer"},
];

export const CAT_EMOJI = {"face-wash":"🫧","moisturizer":"💧","serum":"✨","exfoliant":"🌀","spf":"☀️","eye":"👁️","body":"🧴","acne":"🎯","toner":"💦","lip":"💋","mask":"🎭","hair":"💇","makeup":"💄","other":"🛍"};
export const CAT_LABEL = {"face-wash":"Face Wash","moisturizer":"Moisturizer","serum":"Serum","exfoliant":"Exfoliant","spf":"SPF","eye":"Eye Cream","body":"Body Care","acne":"Acne Treatment","toner":"Toner","lip":"Lip Care","mask":"Face Mask","hair":"Hair & Scalp","makeup":"Makeup","other":"Other"};
export const CAT_ORDER = ["face-wash","moisturizer","serum","exfoliant","spf","eye","body","acne","toner","lip","mask","hair","makeup","other"];

export const FOUNDER_AVATARS = {
  McKenzie: "", // Upload a profile photo in the app to populate this
  Morgan: "",   // Upload a profile photo in the app to populate this
};

export const FOUNDER_EMAILS = {
  McKenzie: "mckenzierichard77@gmail.com",
  Morgan: "morganrichard777@gmail.com",
};
