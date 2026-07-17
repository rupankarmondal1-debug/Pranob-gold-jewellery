import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function AdminPanel() {
  const { user, logActivity } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: u }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at"),
      supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(30),
    ]);
    setUsers(u || []);
    setLogs(l || []);
  }

  async function createAccount() {
    setError("");
    if (!form.email || !form.password) return setError("Email and password required.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    try {
      // A throwaway secondary Supabase client instance signs up the new
      // user, so it never touches the admin's own session/localStorage
      // key on the primary client.
      const secondary = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error: signUpErr } = await secondary.auth.signUp({ email: form.email, password: form.password });
      if (signUpErr) throw signUpErr;
      // The DB trigger already created a 'staff' profile row; update role
      // + must_change_password as the admin specified.
      if (data.user) {
        await supabase.from("profiles").update({
          role: form.role, must_change_password: true, created_by: user.id,
        }).eq("id", data.user.id);
      }
      await logActivity("user_created", { email: form.email, role: form.role });
      setForm(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleRole(u) {
    const newRole = u.role === "admin" ? "staff" : "admin";
    if (!confirm(`Change ${u.email}'s role to ${newRole}?`)) return;
    const { error } = await supabase.from("profiles").update({ role: newRole }).eq("id", u.id);
    if (error) return alert(error.message);
    await logActivity("role_changed", { uid: u.id, newRole });
    load();
  }

  async function toggleStatus(u) {
    const newStatus = u.status === "enabled" ? "disabled" : "enabled";
    if (!confirm(`${newStatus === "disabled" ? "Disable" : "Enable"} ${u.email}?`)) return;
    const { error } = await supabase.from("profiles").update({ status: newStatus }).eq("id", u.id);
    if (error) return alert(error.message);
    await logActivity("status_changed", { uid: u.id, newStatus });
    load();
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return alert(error.message);
    await logActivity("password_reset_sent", { email });
    alert(`Reset link sent to ${email}`);
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div><h1 className="serif">Admin Panel</h1><p className="muted">Manage accounts &amp; view activity</p></div>
        <button className="btn gold" onClick={() => setForm({ email: "", password: "", role: "staff" })}>+ Create Account</button>
      </div>

      <div className="panel">
        <h3>Accounts</h3>
        <table>
          <thead><tr><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.email}{u.id === user.id && <span className="muted"> (you)</span>}</td>
                <td><span className={`role-pill ${u.role}`}>{u.role}</span></td>
                <td><span className={`status-pill ${u.status}`}>{u.status}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {u.id !== user.id && (
                    <>
                      <button className="btn ghost" onClick={() => toggleRole(u)}>🔁 Role</button>{" "}
                      <button className="btn ghost" onClick={() => toggleStatus(u)}>{u.status === "enabled" ? "🚫 Disable" : "✅ Enable"}</button>{" "}
                    </>
                  )}
                  <button className="btn ghost" onClick={() => resetPassword(u.email)}>✉️ Reset PW</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3>Activity Log</h3>
        {logs.map((l) => (
          <div key={l.id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
            <b>{l.action}</b> — {l.actor_email} <span className="muted">· {new Date(l.created_at).toLocaleString()}</span>
          </div>
        ))}
        {!logs.length && <p className="muted">No activity yet.</p>}
      </div>

      {form && (
        <div className="panel" style={{ position: "fixed", top: 60, right: 30, width: 360, zIndex: 50 }}>
          <h3>Create Account</h3>
          {error && <div className="auth-error">{error}</div>}
          <div style={{ display: "grid", gap: 10 }}>
            <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Temporary password (8+ chars)" type="password" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 8 }}>
            The new user must change this password on first login.
          </p>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn gold" onClick={createAccount}>Create</button>
          </div>
        </div>
      )}
    </>
  );
}
