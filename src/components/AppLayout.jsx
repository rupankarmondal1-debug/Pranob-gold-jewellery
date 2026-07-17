import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/clients", label: "Clients" },
  { to: "/orders", label: "Orders / Items" },
  { to: "/gold-rate", label: "Gold Rate" },
  { to: "/gold-conversion", label: "Gold Conversion" },
  { to: "/reports", label: "Reports" },
  { to: "/settings", label: "Settings" },
  { to: "/admin", label: "Admin Panel", adminOnly: true },
];

export default function AppLayout() {
  const { profile, isAdmin, signOut } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingBottom: 22, marginBottom: 18, borderBottom: "1px solid rgba(239,233,220,0.12)" }}>
          <div className="brand-mark" />
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 19, color: "#fff" }}>Pranab Gold</div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.8, textTransform: "uppercase", color: "var(--gold)" }}>Jewellery Suite</div>
          </div>
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {NAV_ITEMS.filter((n) => !n.adminOnly || isAdmin).map((n) => (
            <NavLink
              key={n.to} to={n.to} end={n.end}
              className={({ isActive }) => "navitem" + (isActive ? " active" : "")}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div style={{ marginTop: "auto", paddingTop: 16, borderTop: "1px solid rgba(239,233,220,0.12)" }}>
          <div style={{ fontSize: 12.5, color: "#efe9dc", marginBottom: 4 }}>{profile?.email}</div>
          <span className={`role-pill ${profile?.role}`}>{profile?.role}</span>
          <button className="btn ghost" style={{ width: "100%", marginTop: 12, color: "#efe9dc", borderColor: "rgba(239,233,220,0.25)" }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </aside>
      <div className="main">
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
