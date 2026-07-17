import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes
const ATTEMPTS_KEY = "pgj-login-attempts";

function getAttempts() {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY)) || { count: 0, lockedUntil: 0 }; }
  catch { return { count: 0, lockedUntil: 0 }; }
}
function setAttempts(v) { localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(v)); }

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Client-side rate limiting. This is a UX guard, not a security
    // boundary — Supabase Auth itself also throttles repeated failed
    // sign-ins server-side, which is the part that actually can't be
    // bypassed by clearing localStorage.
    const attempts = getAttempts();
    if (attempts.lockedUntil > Date.now()) {
      const mins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      setError(`Too many failed attempts. Try again in ${mins} minute(s).`);
      return;
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) { setError("Enter a valid email address."); return; }
    if (!password) { setError("Enter your password."); return; }

    setBusy(true);
    const { error: signInError } = await signIn({ email, password, remember });
    setBusy(false);

    if (signInError) {
      const next = { count: attempts.count + 1, lockedUntil: 0 };
      if (next.count >= MAX_ATTEMPTS) next.lockedUntil = Date.now() + LOCKOUT_MS;
      setAttempts(next);
      setError(signInError);
      return;
    }
    setAttempts({ count: 0, lockedUntil: 0 });
    navigate(from, { replace: true });
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" />
          <div><div className="t1">Pranab Gold</div><div className="t2">Jewellery Suite</div></div>
        </div>
        <h2>Sign in</h2>
        <p className="sub">Use your shop email and password to continue.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email" type="email" autoComplete="username" placeholder="you@gmail.com"
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <div className="pw-wrap">
              <input
                id="password" type={showPw ? "text" : "password"} autoComplete="current-password"
                value={password} onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" className="pw-toggle" onClick={() => setShowPw((s) => !s)}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>
          <div className="auth-row">
            <label>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember me
            </label>
            <Link to="/forgot-password" className="auth-link">Forgot password?</Link>
          </div>
          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="auth-foot-link">
          First time setting up this shop?{" "}
          <Link to="/signup" className="auth-link">Create the first Admin account</Link>
        </p>
      </div>
    </div>
  );
}
