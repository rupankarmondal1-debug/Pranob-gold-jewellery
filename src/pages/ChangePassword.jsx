import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * Used for two flows sharing the same form:
 *  1. /reset-password — landed here from the emailed reset link
 *     (Supabase already signed the user into a temporary recovery session).
 *  2. /change-password — a signed-in user with must_change_password=true
 *     (e.g. right after an admin created their account) is redirected
 *     here by ProtectedRoute and can't reach anything else until done.
 */
export default function ChangePassword({ forced = false }) {
  const { updateMyPassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    const { error: err } = await updateMyPassword(password);
    setBusy(false);
    if (err) { setError(err); return; }
    navigate("/", { replace: true });
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark" />
          <div><div className="t1">Pranab Gold</div><div className="t2">Jewellery Suite</div></div>
        </div>
        <h2>{forced ? "Set a new password to continue" : "Choose a new password"}</h2>
        {forced && (
          <p className="sub">
            This account was just created (or had its password reset) by an admin.
            For security, you must set your own password before continuing.
          </p>
        )}
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="newpw">New password</label>
            <input id="newpw" type="password" autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="auth-field">
            <label htmlFor="confirmpw">Confirm new password</label>
            <input id="confirmpw" type="password" autoComplete="new-password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <button className="auth-btn" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save password"}
          </button>
        </form>
        {forced && (
          <p className="auth-foot-link">
            <button className="auth-link" onClick={signOut}>Sign out instead</button>
          </p>
        )}
      </div>
    </div>
  );
}
