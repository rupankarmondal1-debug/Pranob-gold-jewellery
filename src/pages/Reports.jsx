import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const STATUSES = ["Pending", "In Progress", "Delivered", "Cancelled"];
const CARATS = ["18", "21", "22", "24"];

export default function Reports() {
  const [data, setData] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: orders }, { data: items }, { data: ledger }, { data: stones }, { data: diamonds }] = await Promise.all([
      supabase.from("orders").select("id, status, advance"),
      supabase.from("order_items").select("id, carat, total_gold"),
      supabase.from("gold_ledger").select("*, clients(name)").order("created_at", { ascending: false }).limit(10),
      supabase.from("stones").select("quantity, certificate_number, rate, rate_type, weight_ct, stone_status"),
      supabase.from("diamonds").select("quantity, certificate_number, rate, rate_type, weight_ct, stone_status"),
    ]);
    const allOrders = orders || [];
    const allItems = items || [];
    const totalGoldUsed = allItems.reduce((s, i) => s + Number(i.total_gold || 0), 0);
    const byCarat = {};
    CARATS.forEach((c) => { byCarat[c] = allItems.filter((i) => i.carat === c).reduce((s, i) => s + Number(i.total_gold || 0), 0); });
    const byStatus = {};
    STATUSES.forEach((s) => { byStatus[s] = allOrders.filter((o) => o.status === s).length; });
    const allStones = [...(stones || []), ...(diamonds || [])];
    const totalStonePcs = allStones.reduce((s, x) => s + (x.quantity || 0), 0);
    const certifiedCount = allStones.filter((x) => x.certificate_number).length;
    const shopStoneValue = allStones.filter((x) => x.stone_status === "Shop Stone")
      .reduce((s, x) => s + (x.rate_type === "per_piece" ? x.quantity : x.weight_ct) * (x.rate || 0), 0);
    const pendingReturn = allStones.filter((x) => x.stone_status === "Customer Stone" && !x.returned).length;

    setData({
      totalOrders: allOrders.length,
      pendingOrders: allOrders.filter((o) => o.status === "Pending").length,
      totalGoldUsed, byCarat, byStatus, ledger: ledger || [],
      totalStonePcs, stoneEntries: allStones.length, certifiedCount, shopStoneValue, pendingReturn,
    });
  }

  if (!data) return <p className="muted">Loading…</p>;

  return (
    <>
      <div className="page-head"><div><h1 className="serif">Reports</h1><p className="muted">Summary of sales and gold usage</p></div></div>

      <div className="kpi-grid">
        <div className="kpi"><div className="lbl">Total Revenue</div><div className="val">₹ 0</div></div>
        <div className="kpi"><div className="lbl">Total Gold Used</div><div className="val">{data.totalGoldUsed.toFixed(2)} g</div></div>
        <div className="kpi"><div className="lbl">Total Orders</div><div className="val">{data.totalOrders}</div></div>
        <div className="kpi"><div className="lbl">Pending Orders</div><div className="val">{data.pendingOrders}</div></div>
      </div>

      <div className="panel">
        <h3>Orders by Status</h3>
        {STATUSES.map((s) => (
          <div key={s} className="list-row">
            <span className="who">{s}</span>
            <span className="meta">{data.byStatus[s]} orders ({data.totalOrders ? Math.round(data.byStatus[s] / data.totalOrders * 100) : 0}%)</span>
          </div>
        ))}
      </div>

      <div className="panel">
        <h3>Gold Used by Carat</h3>
        {CARATS.map((c) => (
          <div key={c} className="list-row"><span className="who">{c}K</span><span className="meta">{data.byCarat[c].toFixed(2)} g used</span></div>
        ))}
      </div>

      <div className="panel">
        <h3>Recent Gold Transactions</h3>
        {data.ledger.length ? data.ledger.map((l) => (
          <div key={l.id} className="list-row">
            <span className="row-flex">
              <span className={`badge ${l.type === "in" ? "delivered" : "overdue"}`}>{l.type === "in" ? "Gold In" : "Gold Out"}</span>
              <span className="who">{l.clients?.name} · {Number(l.amount).toFixed(3)} g</span>
            </span>
            <span className="meta">{l.created_at?.slice(0, 10)}</span>
          </div>
        )) : <p className="muted">No transactions yet.</p>}
      </div>

      <div className="panel">
        <h3>💎 Gemstone Overview</h3>
        <div className="list-row"><span className="who">Total Stones Tracked</span><span className="meta">{data.totalStonePcs} pcs across {data.stoneEntries} entries</span></div>
        <div className="list-row"><span className="who">Certified Stones</span><span className="meta">{data.certifiedCount} with certificate number</span></div>
        <div className="list-row"><span className="who">Total Shop Stone Value</span><span className="meta">₹ {Math.round(data.shopStoneValue)}</span></div>
        <div className="list-row"><span className="who">Customer Stones Pending Return</span><span className="meta">{data.pendingReturn ? `⚠️ ${data.pendingReturn} stone(s)` : "None ✓"}</span></div>
      </div>
    </>
  );
}

