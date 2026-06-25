import React from "react";
import { T } from "../../data/tokens.js";
import { RalliIcons } from "../../data/icons.jsx";

export function BottomNav({ tab, onChange, unreadCount = 0, msgUnread = 0, currentUid = "", isAdmin = false }) {
  const items = [
    {id:"check",    label:"Explore",  icon:(a) => RalliIcons.scan(a ? T.navy : T.textLight)},
    {id:"shop",     label:"Shop",     icon:(a) => RalliIcons.compass(a ? T.navy : T.textLight, 22, a)},
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
      {items.map(item => {
        const active = tab === item.id;
        return (
          <button key={item.id} onClick={() => onChange(item.id)}
            style={{flex:1,padding:"0.7rem 0.25rem 0.55rem",display:"flex",flexDirection:"column",alignItems:"center",gap:"0.2rem",background:"none",border:"none",cursor:"pointer",transition:"all 0.2s",position:"relative"}}>
            {active && <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",width:"32px",height:"3px",background:T.iceBlue,borderRadius:"0 0 3px 3px",boxShadow:`0 0 8px ${T.iceBlue}`}}/>}
            <div style={{position:"relative",display:"inline-flex"}}>
              {item.icon(active)}
              {item.id === "notifs" && unreadCount > 0 && (
                <div style={{position:"absolute",top:"-3px",right:"-5px",minWidth:"15px",height:"15px",borderRadius:"999px",background:T.rose,border:`2px solid ${T.bg}`,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
                  <span style={{fontSize:"0.45rem",fontWeight:"800",color:"#fff",fontFamily:"'Inter',sans-serif",lineHeight:1}}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                </div>
              )}
              {item.id === "messages" && msgUnread > 0 && (
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
