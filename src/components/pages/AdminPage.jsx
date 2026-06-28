import React from "react";
import { T } from "../../data/tokens.js";

/**
 * AdminPage — placeholder stub.
 * Full extraction from RalliGoodSisters_v8.jsx is pending.
 * This stub keeps the app buildable in the meantime.
 */
export function AdminDashboard(props) {
  const { user } = props;
  return (
    <div style={{ maxWidth: "480px", margin: "0 auto", padding: "2rem 1rem", textAlign: "center" }}>
      <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>🔧</div>
      <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: "700", fontSize: "1rem", color: T.text, marginBottom: "0.4rem" }}>
        Admin Dashboard
      </div>
      <div style={{ fontSize: "0.8rem", color: T.textLight }}>
        Coming soon — full admin tools are being extracted from the monolith.
      </div>
    </div>
  );
}

export default AdminDashboard;
