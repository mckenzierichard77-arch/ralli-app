import React from "react";
import { T } from "../../data/tokens.js";

function initials(name = "") {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
}

export function Avatar({ photoURL, name, size = 36 }) {
  if (!photoURL) return (
    <div style={{width:size,height:size,borderRadius:"50%",background:T.accentSoft,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:"700",color:T.accent,fontFamily:"'Inter',sans-serif",flexShrink:0}}>{initials(name)}</div>
  );
  return (
    <div style={{width:size,height:size,borderRadius:"50%",overflow:"hidden",flexShrink:0,background:T.surfaceAlt}}>
      <img src={photoURL} alt="" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
    </div>
  );
}
