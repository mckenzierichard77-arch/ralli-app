// Design tokens and global styles

export const T = {
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

export const GS = `
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
