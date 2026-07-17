import { useAuth } from "../context/AuthContext";

export default function DisabledAccount() {
  const { signOut } = useAuth();
  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" />
          <div><div className="t1">Pranab Gold</div><div className="t2">Jewellery Suite</div></div>
        </div>
        <h2>Account disabled</h2>
        <div className="auth-error">
          Your account has been disabled by an administrator. Please contact your shop admin
          if you believe this is a mistake.
        </div>
        <button className="auth-btn" onClick={signOut}>Sign out</button>
      </div>
    </div>
  );
}
