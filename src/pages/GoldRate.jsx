import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

const CARATS = ["18", "21", "22", "24"];

export default function GoldRate() {
  const { isAdmin, user, logActivity } = useAuth();
  const [rates, setRates] = useState({});
  const [history, setHistory] = useState([]);

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await supabase.from("gold_rates").select("*").order("effective_date", { ascending: false }).order("created_at", { ascending: false }).limit(40);
    setHistory(data || []);
    const latest = {};
    (data || []).forEach((r) => { if (!(r.carat in latest)) latest[r.carat] = r.rate_per_gram; });
    setRates(latest);
  }

  async function saveRates() {
    if (!isAdmin) return;
    const today = new Date().toISOString().slice(0, 10);
    const rows = CARATS.map((c) => ({
      carat: c, rate_per_gram: rates[c] || 0, effective_date: today, created_by: user.id,
    }));
    const { error } = await supabase.from("gold_rates").insert(rows);
    if (error) return alert(error.message);
    await logActivity("gold_rate_updated", { rates });
    load();
  }

  return (
    <>
      <h1 className="serif">Gold Rate</h1>
      <p className="muted">Update today's rate — automatically applies to all new/edited orders via the DB trigger.</p>
      <div className="panel">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {CARATS.map((c) => (
            <div key={c}>
              <label className="muted" style={{ fontSize: 12 }}>{c}K (₹/gram)</label>
              <input type="number" value={rates[c] || 0} disabled={!isAdmin}
                onChange={(e) => setRates({ ...rates, [c]: parseFloat(e.target.value) || 0 })}
                style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }} />
            </div>
          ))}
        </div>
        {isAdmin && <button className="btn gold" style={{ marginTop: 16 }} onClick={saveRates}>Save Rate</button>}
      </div>
      <div className="panel">
        <h3>Rate History</h3>
        {history.map((h) => (
          <div key={h.id} style={{ fontSize: 12.5, padding: "6px 0", borderBottom: "1px dashed var(--border)" }}>
            {h.effective_date} — {h.carat}K: ₹ {h.rate_per_gram}/g
          </div>
        ))}
      </div>
    </>
  );
}
