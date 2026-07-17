import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function GoldConversion() {
  const { user, logActivity } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientId, setClientId] = useState("");
  const [manualBalance, setManualBalance] = useState(0);
  const [jewelleryWeight, setJewelleryWeight] = useState(0);
  const [carat, setCarat] = useState("22");
  const [stoneWeight, setStoneWeight] = useState(0);
  const [result, setResult] = useState(null);

  useEffect(() => {
    supabase.from("clients").select("id, name, phone, gold_available").order("name").then(({ data }) => setClients(data || []));
  }, []);

  const selectedClient = clients.find((c) => c.id === clientId);
  const currentBalance = selectedClient ? Number(selectedClient.gold_available) : Number(manualBalance) || 0;

  function calculate() {
    const netWeight = Math.max(0, (Number(jewelleryWeight) || 0) - (Number(stoneWeight) || 0));
    const caratNum = Number(carat);
    const fineGoldUsed = netWeight * (caratNum / 24);
    const deduction = fineGoldUsed; // 24K deduction = fine gold used
    const remaining = currentBalance - deduction;
    setResult({ netWeight, fineGoldUsed, deduction, remaining });
  }

  async function applyDeduction() {
    if (!selectedClient) { alert("Select an existing client to post this deduction to their ledger."); return; }
    if (!result) { alert("Calculate first."); return; }
    if (!confirm(`Deduct ${result.deduction.toFixed(3)}g (24K) from ${selectedClient.name}'s balance?`)) return;

    const newBalance = currentBalance - result.deduction;
    const { error: updErr } = await supabase.from("clients").update({ gold_available: newBalance }).eq("id", selectedClient.id);
    if (updErr) return alert(updErr.message);

    const { error: ledgerErr } = await supabase.from("gold_ledger").insert({
      client_id: selectedClient.id, type: "out", amount: result.deduction,
      reason: `Gold conversion: ${jewelleryWeight}g @ ${carat}K jewellery (stone ${stoneWeight || 0}g deducted) → ${result.fineGoldUsed.toFixed(3)}g fine gold`,
      balance_after: newBalance, created_by: user.id,
    });
    if (ledgerErr) return alert(ledgerErr.message);

    await logActivity("gold_conversion_applied", { client_id: selectedClient.id, deduction: result.deduction });
    alert("Deduction posted to client's gold ledger.");
    setClients((cs) => cs.map((c) => (c.id === selectedClient.id ? { ...c, gold_available: newBalance } : c)));
    setResult({ ...result, remaining: newBalance });
  }

  return (
    <>
      <h1 className="serif">Gold Conversion</h1>
      <p className="muted">Convert 22K/18K jewellery weight into 24K fine gold and deduct it from a client's 24K balance.</p>

      <div className="panel" style={{ maxWidth: 480 }}>
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <label className="muted" style={{ fontSize: 12 }}>Client (optional — autofills balance)</label>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value="">— Manual balance entry —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
            </select>
          </div>

          {!clientId && (
            <div>
              <label className="muted" style={{ fontSize: 12 }}>Client 24K Balance (g)</label>
              <input type="number" value={manualBalance} onChange={(e) => setManualBalance(e.target.value)}
                style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }} />
            </div>
          )}
          {clientId && (
            <div className="muted" style={{ fontSize: 12.5 }}>
              Current balance: <b>{currentBalance.toFixed(3)} g</b>
            </div>
          )}

          <div>
            <label className="muted" style={{ fontSize: 12 }}>Jewellery Weight (g)</label>
            <input type="number" value={jewelleryWeight} onChange={(e) => setJewelleryWeight(e.target.value)}
              style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }} />
          </div>

          <div>
            <label className="muted" style={{ fontSize: 12 }}>Carat</label>
            <select value={carat} onChange={(e) => setCarat(e.target.value)} style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }}>
              <option value="22">22K</option>
              <option value="18">18K</option>
            </select>
          </div>

          <div>
            <label className="muted" style={{ fontSize: 12 }}>Stone Weight (optional, g)</label>
            <input type="number" value={stoneWeight} onChange={(e) => setStoneWeight(e.target.value)}
              style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }} />
          </div>
        </div>

        <button className="btn gold" style={{ marginTop: 16 }} onClick={calculate}>Calculate</button>

        {result && (
          <div style={{ background: "var(--ink)", color: "#efe9dc", borderRadius: 10, padding: 14, marginTop: 16, fontSize: 13 }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>Net Jewellery Weight</span><b>{result.netWeight.toFixed(3)} g</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>Fine Gold Used ({carat}K → 24K)</span><b>{result.fineGoldUsed.toFixed(3)} g</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
              <span>24K Deduction</span><b>{result.deduction.toFixed(3)} g</b>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,.15)", marginTop: 8, paddingTop: 8 }}>
              <span style={{ color: "var(--gold)", textTransform: "uppercase", fontSize: 11.5 }}>Remaining 24K Balance</span>
              <b style={{ fontSize: 18 }}>{result.remaining.toFixed(3)} g</b>
            </div>
          </div>
        )}

        {result && clientId && (
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={applyDeduction}>
            Post Deduction to {selectedClient?.name}'s Ledger
          </button>
        )}
      </div>
    </>
  );
}
