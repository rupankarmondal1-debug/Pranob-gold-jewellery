import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export default function Dashboard() {
  const [data, setData] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    const today = new Date().toISOString().slice(0, 10);
    const [{ count: totalClients }, { data: clients }, { data: orders }, { data: rates }] = await Promise.all([
      supabase.from("clients").select("*", { count: "exact", head: true }),
      supabase.from("clients").select("gold_available"),
      supabase.from("orders").select("id, order_number, status, order_date, delivery_date, advance, clients(name), order_items(item_name, total_gold)"),
      supabase.from("gold_rates").select("carat, rate_per_gram, effective_date").order("effective_date", { ascending: false }).limit(4),
    ]);
    const list = orders || [];
    const pending = list.filter((o) => o.status === "Pending").length;
    const inProgress = list.filter((o) => o.status === "In Progress").length;
    const delivered = list.filter((o) => o.status === "Delivered").length;
    const overdue = list.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled" && o.delivery_date < today);
    const rate22 = rates?.find((r) => r.carat === "22")?.rate_per_gram ?? 0;
    const goldBalance = (clients || []).reduce((s, c) => s + Number(c.gold_available || 0), 0);

    setData({
      totalClients: totalClients ?? 0, totalOrders: list.length, pending, inProgress, delivered,
      overdue, rate22, goldBalance,
      todaysOrders: list.filter((o) => o.order_date === today).length,
      recent: [...list].sort((a, b) => (b.order_date || "").localeCompare(a.order_date || "")).slice(0, 5),
      watchlist: list.filter((o) => o.status !== "Delivered" && o.status !== "Cancelled")
        .sort((a, b) => (a.delivery_date || "").localeCompare(b.delivery_date || "")).slice(0, 5),
    });
  }

  if (!data) return <p className="muted">Loading…</p>;

  function daysLeft(dateStr) {
    const diff = Math.round((new Date(dateStr) - new Date(new Date().toISOString().slice(0, 10))) / 86400000);
    if (diff < 0) return `${Math.abs(diff)} days overdue`;
    if (diff === 0) return "Due today";
    return `${diff} days left`;
  }

  const cards = [
    { label: "Today's Orders", value: data.todaysOrders, sub: `Total ${data.totalOrders} orders` },
    { label: "Pending", value: data.pending, sub: `${data.inProgress} in progress` },
    { label: "Delivered", value: data.delivered, sub: "0 today" },
    { label: "Overdue", value: data.overdue.length, sub: data.overdue.length ? "Needs attention" : "All good ✓" },
    { label: "Total Clients", value: data.totalClients, sub: "active accounts" },
    { label: "Gold in Client Balance", value: `${data.goldBalance.toFixed(2)}g`, sub: "outstanding" },
    { label: "Total Revenue", value: `₹ 0`, sub: "all orders (incl. advance)" },
    { label: "22K Rate", value: `₹ ${data.rate22}`, sub: "per gram" },
  ];

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 className="serif">Good Morning, Pranab Gold 👋</h1>
          <p className="muted">Today is {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <button className="btn gold">+ New Order</button>
      </div>

      <div className="kpi-grid">
        {cards.map((c) => (
          <div key={c.label} className="kpi">
            <div className="lbl">{c.label}</div>
            <div className="val">{c.value}</div>
            <div className="sub">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="panel-flex" style={{ marginTop: 20 }}>
        <div className="panel">
          <h3>Recent Orders</h3>
          {data.recent.length ? data.recent.map((o) => (
            <div key={o.id} className="list-row">
              <span className="row-flex"><span className="who">{o.order_items?.[0]?.item_name || o.order_number}</span> <span className="meta">· {o.clients?.name}</span></span>
              <span className={`badge ${o.status === "Delivered" ? "delivered" : o.status === "Cancelled" ? "cancelled" : o.status === "In Progress" ? "progress" : "pending"}`}>{o.status}</span>
            </div>
          )) : <p className="muted">No orders yet.</p>}
        </div>
        <div className="panel">
          <h3>⚠️ Delivery Watch</h3>
          {data.watchlist.length ? data.watchlist.map((o) => (
            <div key={o.id} className="list-row">
              <span className="row-flex"><span className="who">{o.order_number}</span> <span className="meta">· {o.order_items?.[0]?.item_name}</span></span>
              <span className="badge pending">{daysLeft(o.delivery_date)}</span>
            </div>
          )) : <p className="muted">No pending deliveries.</p>}
        </div>
      </div>
    </>
  );
}

