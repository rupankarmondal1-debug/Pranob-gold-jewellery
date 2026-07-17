import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const BLANK = { id: null, name: "", phone: "", address: "", nid: "", gold_available: 0 };

export default function Clients() {
  const { isAdmin, user, logActivity } = useAuth();
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(null);
  const [ledgerClient, setLedgerClient] = useState(null);
  const [ledger, setLedger] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
    if (!error) setClients(data);
  }

  async function save() {
    if (!form.name.trim() || !form.phone.trim()) { alert("Name and phone are required."); return; }
    if (form.id) {
      const { error } = await supabase.from("clients")
        .update({ name: form.name, phone: form.phone, address: form.address, nid: form.nid })
        .eq("id", form.id);
      if (error) return alert(error.message);
    } else {
      const { data, error } = await supabase.from("clients").insert({
        name: form.name, phone: form.phone, address: form.address, nid: form.nid,
        gold_available: form.gold_available || 0, created_by: user.id,
      }).select().single();
      if (error) return alert(error.message);
      if (form.gold_available) {
        await supabase.from("gold_ledger").insert({
          client_id: data.id, type: "in", amount: form.gold_available,
          reason: "Initial gold deposit", balance_after: form.gold_available, created_by: user.id,
        });
      }
      await logActivity("client_created", { client_id: data.id, name: data.name });
    }
    setForm(null);
    load();
  }

  async function remove(id) {
    if (!confirm("Delete this client? Related orders may be affected.")) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return alert(error.message);
    await logActivity("client_deleted", { client_id: id });
    load();
  }

  async function openLedger(client) {
    setLedgerClient(client);
    const { data } = await supabase.from("gold_ledger").select("*").eq("client_id", client.id).order("created_at", { ascending: false });
    setLedger(data || []);
  }

  const filtered = clients.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h1 className="serif">Clients</h1>
          <p className="muted">All clients and their gold balance</p>
        </div>
        <button className="btn gold" onClick={() => setForm({ ...BLANK })}>+ New Client</button>
      </div>

      <input
        placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)}
        style={{ padding: 10, borderRadius: 9, border: "1px solid var(--border)", width: 320, marginBottom: 16 }}
      />

      <div className="panel">
        <table>
          <thead><tr><th>Client</th><th>Phone</th><th>Gold Balance</th><th /></tr></thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.name}<div className="muted" style={{ fontSize: 11.5 }}>{c.address}</div></td>
                <td>{c.phone}</td>
                <td>{Number(c.gold_available).toFixed(2)} g</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="btn ghost" onClick={() => openLedger(c)}>📜</button>{" "}
                  <button className="btn ghost" onClick={() => setForm({ ...c })}>✏️</button>{" "}
                  {isAdmin && <button className="btn danger" onClick={() => remove(c.id)}>🗑️</button>}
                </td>
              </tr>
            ))}
            {!filtered.length && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 30 }}>No clients found.</td></tr>}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="panel" style={{ position: "fixed", top: 60, right: 30, width: 360, zIndex: 50 }}>
          <h3>{form.id ? "Edit Client" : "New Client"}</h3>
          <div style={{ display: "grid", gap: 10 }}>
            <input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Address" value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <input placeholder="NID (optional)" value={form.nid || ""} onChange={(e) => setForm({ ...form, nid: e.target.value })} />
            {!form.id && (
              <input type="number" placeholder="Gold Available (g)" value={form.gold_available}
                onChange={(e) => setForm({ ...form, gold_available: parseFloat(e.target.value) || 0 })} />
            )}
          </div>
          <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
            <button className="btn ghost" onClick={() => setForm(null)}>Cancel</button>
            <button className="btn gold" onClick={save}>Save</button>
          </div>
        </div>
      )}

      {ledgerClient && (
        <div className="panel" style={{ position: "fixed", top: 60, right: 30, width: 380, zIndex: 50, maxHeight: "70vh", overflowY: "auto" }}>
          <h3>Gold Ledger — {ledgerClient.name}</h3>
          <p><b>{Number(ledgerClient.gold_available).toFixed(3)} g</b> current balance</p>
          {ledger.map((l) => (
            <div key={l.id} style={{ borderBottom: "1px dashed var(--border)", padding: "8px 0", fontSize: 12.5 }}>
              <span className={`status-pill ${l.type === "in" ? "enabled" : "disabled"}`}>{l.type === "in" ? "Gold In" : "Gold Out"}</span>
              {" "}{Number(l.amount).toFixed(3)} g — {l.reason}
              <div className="muted">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          ))}
          {!ledger.length && <p className="muted">No transactions yet.</p>}
          <button className="btn ghost" style={{ marginTop: 10 }} onClick={() => setLedgerClient(null)}>Close</button>
        </div>
      )}
    </>
  );
}
