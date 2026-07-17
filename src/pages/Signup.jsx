import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { friendlyAuthError } from "../context/AuthContext";

export default function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }

    setBusy(true);
    const { error: signUpError } = await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (signUpError) { setError(friendlyAuthError(signUpError)); return; }
    setOk(true);
  }

  if (ok) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">
            <div className="brand-mark" />
            <div><div className="t1">Pranab Gold</div><div className="t2">Jewellery Suite</div></div>
          </div>
          <h2>Check your email</h2>
          <div className="auth-success">
            We sent a confirmation link to <b>{email}</b>. Click it, then come back and log in.
            The very first account to sign up automatically becomes Admin.
          </div>
          <button className="auth-btn" onClick={() => navigate("/login")}>Back to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" />
          <div><div className="t1">Pranab Gold</div><div className="t2">Jewellery Suite</div></div>
        </div>
        <h2>Create the first Admin</h2>
        <p className="sub">
          There's no hardcoded default account — a known default password is a
          security risk in itself. Instead, create your own real Admin login here.
          Every account after this one defaults to Staff (promote them later
          from the Admin Panel).
        </p>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="username" placeholder="you@gmail.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="pw-wrap">
              <input id="password" type={showPw ? "text" : "password"} autoComplete="new-password"
                value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create Admin Account"}
          </button>
        </form>
        <p className="auth-foot-link"><Link to="/login" className="auth-link">Back to Login</Link></p>
      </div>
    </div>
  );
}
