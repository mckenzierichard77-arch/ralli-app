import React, { useState } from "react";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, signInWithPopup, sendPasswordResetEmail,
} from "firebase/auth";
import { T } from "../../data/tokens.js";
import { auth, gProvider } from "../../lib/firebase.js";

export function AuthPage() {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function sendReset() {
    if (!email.trim()) { setError("Enter your email address first."); return; }
    setLoading(true); setError("");
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetSent(true);
    } catch (e) {
      setError(e.code === "auth/user-not-found" ? "No account found with that email." : "Could not send reset email. Try again.");
    }
    setLoading(false);
  }

  const inp = { width: "100%", padding: "0.85rem 1rem", borderRadius: "0.65rem", border: `1px solid ${T.border}`, fontSize: "0.9rem", fontFamily: "'Inter',sans-serif", color: T.text, background: "#FFFFFF", outline: "none", transition: "border-color 0.15s" };

  function friendly(code) {
    if (code === "auth/email-already-in-use") return "An account with this email already exists.";
    if (code === "auth/invalid-email") return "Please enter a valid email address.";
    if (code === "auth/weak-password") return "Password must be at least 6 characters.";
    if (code === "auth/invalid-credential") return "Incorrect email or password.";
    return "Something went wrong. Please try again.";
  }

  async function submit() {
    setError(""); setLoading(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) { setError("Please enter your name."); setLoading(false); return; }
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name.trim() });
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e) { setError(friendly(e.code)); }
    finally { setLoading(false); }
  }

  async function google() {
    setError(""); setLoading(true);
    try { await signInWithPopup(auth, gProvider); }
    catch (e) { if (e.code !== "auth/popup-closed-by-user") setError("Google sign-in failed."); }
    finally { setLoading(false); }
  }

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "2.5rem 2rem 1.5rem", textAlign: "center", borderBottom: `1px solid ${T.border}` }}>
        <div style={{ lineHeight: 1 }}>
          <div style={{ fontFamily: "'Poppins',sans-serif", fontWeight: "900", fontSize: "3rem", color: T.navy, letterSpacing: "-0.04em", lineHeight: 1 }}>Ralli</div>
          <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "300", fontSize: "0.72rem", color: T.textLight, letterSpacing: "0.22em", textTransform: "uppercase", marginTop: "0.4rem" }}>by GoodSisters</div>
        </div>
        <div style={{ width: "32px", height: "1px", background: T.border, margin: "0.75rem auto" }} />
        <div style={{ fontSize: "0.58rem", color: T.textLight, letterSpacing: "0.04em", textTransform: "uppercase", fontFamily: "'Inter',sans-serif", fontWeight: "400" }}>
          Real people. Real skin. Real insights.
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "2rem 1.5rem" }}>
        <div style={{ width: "100%", maxWidth: "380px", background: T.surface, borderRadius: "1rem", border: `1px solid ${T.border}`, padding: "1.75rem", boxShadow: "0 4px 24px rgba(17,24,39,0.06)" }}>
          <div style={{ display: "flex", gap: "0", marginBottom: "1.75rem", borderBottom: `1px solid ${T.border}` }}>
            {["login", "signup"].map(m => (
              <button key={m} onClick={() => { setMode(m); setError(""); }} style={{ flex: 1, padding: "0.65rem 0.5rem", background: "transparent", color: mode === m ? T.navy : T.textLight, border: "none", borderBottom: `2px solid ${mode === m ? T.navy : "transparent"}`, fontSize: "0.8rem", fontFamily: "'Inter',sans-serif", cursor: "pointer", fontWeight: mode === m ? "600" : "400", transition: "all 0.15s", letterSpacing: "0.02em", marginBottom: "-1px" }}>
                {m === "login" ? "Log in" : "Create account"}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {mode === "signup" && <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" style={inp} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />}
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" style={inp} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" style={inp} onKeyDown={e => e.key === "Enter" && submit()} onFocus={e => e.target.style.borderColor = T.accent} onBlur={e => e.target.style.borderColor = T.border} />
          </div>
          {mode === "login" && (
            <div style={{ textAlign: "right", marginTop: "0.4rem" }}>
              {resetSent
                ? <span style={{ fontSize: "0.72rem", color: T.sage }}>✓ Reset email sent — check your inbox</span>
                : <button onClick={sendReset} disabled={loading} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.72rem", color: T.textLight, fontFamily: "'Inter',sans-serif", padding: 0, textDecoration: "underline", textDecorationColor: T.border }}>Forgot password?</button>
              }
            </div>
          )}
          {error && <div style={{ marginTop: "0.75rem", padding: "0.65rem 0.9rem", background: "#FBF0EE", border: `1px solid ${T.rose}44`, borderRadius: "0.5rem", fontSize: "0.78rem", color: T.rose }}>{error}</div>}
          <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: "1.25rem", padding: "0.85rem", background: T.navy, color: "#FFFFFF", border: "none", borderRadius: "0.65rem", fontSize: "0.88rem", fontWeight: "500", cursor: "pointer", fontFamily: "'Inter',sans-serif", letterSpacing: "0.03em", opacity: loading ? 0.7 : 1, transition: "opacity 0.15s" }}>
            {loading ? "Please wait…" : mode === "login" ? "Log in →" : "Create account →"}
          </button>
          {mode === "signup" && (
            <div style={{ marginTop: "0.9rem", fontSize: "0.72rem", color: T.textLight, textAlign: "center", lineHeight: 1.6 }}>
              By creating an account, you agree to our{" "}
              <a href="https://theralliapp.com/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: T.textMid, textDecoration: "underline", textDecorationColor: T.border, cursor: "pointer" }}>Terms of Service</a>
              {" "}and{" "}
              <a href="https://theralliapp.com/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: T.textMid, textDecoration: "underline", textDecorationColor: T.border, cursor: "pointer" }}>Privacy Policy</a>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", margin: "1.25rem 0" }}>
            <div style={{ flex: 1, height: "1px", background: T.border }} /><span style={{ fontSize: "0.72rem", color: T.textLight }}>or</span><div style={{ flex: 1, height: "1px", background: T.border }} />
          </div>
          <button onClick={google} disabled={loading} style={{ width: "100%", padding: "0.8rem", background: T.surface, color: T.text, border: `1px solid ${T.border}`, borderRadius: "0.65rem", fontSize: "0.85rem", fontWeight: "500", cursor: "pointer", fontFamily: "'Inter',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.6rem" }}
            onMouseEnter={e => e.currentTarget.style.borderColor = T.accent} onMouseLeave={e => e.currentTarget.style.borderColor = T.border}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
            </svg>
            Continue with Google
          </button>
        </div>
      </div>
    </div>
  );
}
