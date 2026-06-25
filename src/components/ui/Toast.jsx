import React from "react";
import ReactDOM from "react-dom";

export function ToastViewport({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  const styles = {
    success: { bg: "#2C7A5C", icon: "✓" },
    error:   { bg: "#AA4F57", icon: "!" },
    warning: { bg: "#8B6914", icon: "⚠" },
    info:    { bg: "#111827", icon: "" },
  };
  return ReactDOM.createPortal(
    <div style={{position:"fixed",bottom:"5.5rem",left:"50%",transform:"translateX(-50%)",zIndex:99999,display:"flex",flexDirection:"column-reverse",gap:"0.5rem",pointerEvents:"none",maxWidth:"calc(100% - 2rem)",width:"max-content"}}>
      {toasts.map(t => {
        const s = styles[t.kind] || styles.info;
        return (
          <div key={t.id} onClick={() => onDismiss(t.id)}
            style={{background:s.bg,color:"#fff",padding:"0.65rem 1rem",borderRadius:"0.65rem",fontSize:"0.78rem",fontWeight:"500",fontFamily:"'Inter',sans-serif",boxShadow:"0 8px 30px rgba(0,0,0,0.25), 0 2px 8px rgba(0,0,0,0.12)",display:"flex",alignItems:"flex-start",gap:"0.55rem",pointerEvents:"auto",cursor:"pointer",lineHeight:1.4,maxWidth:"calc(100vw - 2rem)",width:"max-content",animation:"toastIn 0.18s ease-out"}}>
            {s.icon && <span style={{fontWeight:"800",flexShrink:0,fontSize:"0.85rem",lineHeight:1.3}}>{s.icon}</span>}
            <div style={{whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{t.message}</div>
          </div>
        );
      })}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>,
    document.body
  );
}
