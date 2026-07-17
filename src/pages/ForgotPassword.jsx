import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ForgotPassword() {
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    setBusy(true);
    const { error: err } = await sendPasswordReset(email);
    setBusy(false);
    if (err) { setError(err); return; }
    setSent(true);
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" />
          <div><div className="t1">Pranab Gold</div><div className="t2">Jewellery Suite</div></div>
        </div>
        <h2>Reset your password</h2>
        <p className="sub">Enter your account email — we'll send a secure reset link (handled entirely by Supabase, not our own code).</p>

        {error && <div className="auth-error">{error}</div>}
        {sent ? (
          <div className="auth-success">If an account exists for {email}, a reset link has been sent.</div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="username" placeholder="you@gmail.com"
                value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="auth-btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}
        <p className="auth-foot-link"><Link to="/login" className="auth-link">Back to Login</Link></p>
      </div>
    </div>
  );
}
