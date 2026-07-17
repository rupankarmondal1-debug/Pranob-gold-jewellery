import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { uploadPhoto } from "../lib/storage";

const CARATS = ["18", "21", "22", "24"];
const STATUSES = ["Pending", "In Progress", "Delivered", "Cancelled"];
const CATEGORIES = ["Ring", "Chain", "Necklace", "Bangle", "Earring", "Other"];
const STONE_TYPES = ["Diamond", "CZ", "Ruby", "Emerald", "Sapphire", "Pearl", "Other"];
const PHOTO_CAPTIONS = ["Front", "Back", "Side", "Finished Product", "Hallmark"];

const BLANK_ORDER = { client_id: "", delivery_date: "", advance: 0, notes: "", order_date: new Date().toISOString().slice(0, 10), status: "Pending" };
const BLANK_ITEM = {
  item_name: "", category: "Ring", carat: "22", net_weight: 0, wastage_percent: 8,
  deduct_gold: 0, making_type: "per_gram", making_charge: 0,
};

export default function Orders() {
  const { isAdmin, user, logActivity } = useAuth();
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [rates, setRates] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [orderForm, setOrderForm] = useState(BLANK_ORDER);
  const [itemForm, setItemForm] = useState(BLANK_ITEM);
  const [statusFilter, setStatusFilter] = useState("");
  const [stonesDraft, setStonesDraft] = useState([]);
  const [photosDraft, setPhotosDraft] = useState([]);
  const [photoCaption, setPhotoCaption] = useState("Front");
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    const [{ data: o }, { data: c }, { data: r }] = await Promise.all([
      supabase.from("orders").select("*, clients(name, phone), order_items(*)").order("created_at", { ascending: false }),
      supabase.from("clients").select("id, name, phone").order("name"),
      supabase.from("gold_rates").select("carat, rate_per_gram").order("effective_date", { ascending: false }),
    ]);
    setOrders(o || []);
    setClients(c || []);
    const latestByCarat = {};
    (r || []).forEach((row) => { if (!(row.carat in latestByCarat)) latestByCarat[row.carat] = row.rate_per_gram; });
    setRates(latestByCarat);
  }

  function computeTotalGold(item) {
    const wastageGold = item.net_weight * (item.wastage_percent / 100);
    return item.net_weight + wastageGold - item.deduct_gold;
  }
  function stoneValue(s) {
    const basis = s.rate_type === "per_piece" ? s.quantity : s.weight_ct;
    return (basis || 0) * (s.rate || 0);
  }

  function openNewOrderForm() {
    setOrderForm(BLANK_ORDER);
    setItemForm(BLANK_ITEM);
    setStonesDraft([]);
    setPhotosDraft([]);
    setShowForm(true);
  }

  function addStone() {
    setStonesDraft((s) => [...s, {
      stone_type: "Diamond", stone_name: "", quantity: 1, weight_ct: 0, size_mm: "", shape: "Round",
      color: "", certificate_number: "", rate_type: "per_carat", rate: 0, stone_status: "Shop Stone", returned: false,
    }]);
  }
  function updateStone(i, field, value) {
    setStonesDraft((arr) => arr.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  }
  function removeStone(i) {
    setStonesDraft((arr) => arr.filter((_, idx) => idx !== i));
  }

  async function handleAddPhoto(e) {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      setPhotosDraft((p) => [...p, { file, caption: photoCaption, previewUrl: URL.createObjectURL(file) }]);
    }
    e.target.value = "";
  }
  function removePhoto(i) {
    setPhotosDraft((p) => p.filter((_, idx) => idx !== i));
  }

  async function createOrder() {
    if (!orderForm.client_id) return alert("Select a client.");
    if (!itemForm.item_name.trim()) return alert("Item name is required.");
    if (!orderForm.delivery_date) return alert("Delivery date is required.");
    setSaving(true);

    const { data: orderNumberData } = await supabase.rpc("next_order_number", { prefix: "PGJ" });
    const orderNumber = orderNumberData || `PGJ-${Date.now()}`;

    const { data: order, error: orderErr } = await supabase.from("orders").insert({
      order_number: orderNumber, client_id: orderForm.client_id, delivery_date: orderForm.delivery_date,
      order_date: orderForm.order_date, status: orderForm.status,
      advance: orderForm.advance || 0, notes: orderForm.notes, created_by: user.id,
    }).select().single();
    if (orderErr) { setSaving(false); return alert(orderErr.message); }

    const { data: item, error: itemErr } = await supabase.from("order_items").insert({
      order_id: order.id, ...itemForm,
    }).select().single();
    if (itemErr) { setSaving(false); return alert(itemErr.message); }
    // gold_ledger + clients.gold_available are updated automatically by
    // the DB trigger (reconcile_gold_deduction) — no manual JS needed.

    if (stonesDraft.length) {
      const isDiamondOnly = stonesDraft.every((s) => s.stone_type === "Diamond");
      const table = isDiamondOnly ? "diamonds" : "stones";
      await supabase.from(table).insert(stonesDraft.map((s) => ({ order_item_id: item.id, ...s })));
    }

    if (photosDraft.length) {
      const urls = [];
      const captions = [];
      for (const p of photosDraft) {
        try {
          const { url } = await uploadPhoto(`order-items/${item.id}`, p.file);
          urls.push(url); captions.push(p.caption);
        } catch (e) { /* skip failed upload, don't block order creation */ }
      }
      if (urls.length) await supabase.from("order_items").update({ photo_urls: urls, photo_captions: captions }).eq("id", item.id);
    }

    await logActivity("order_created", { order_number: orderNumber });
    setSaving(false);
    setShowForm(false);
    load();
  }

  async function setStatus(orderId, status) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) return alert(error.message);
    await logActivity("order_status_changed", { order_id: orderId, status });
    load();
  }

  async function removeOrder(orderId) {
    if (!confirm("Delete this order? Any gold held against it will be returned to the client.")) return;
    const { error } = await supabase.from("orders").delete().eq("id", orderId);
    if (error) return alert(error.message);
    await logActivity("order_deleted", { order_id: orderId });
    load();
  }

  const previewTotalGold = computeTotalGold(itemForm);
  const previewGoldPrice = previewTotalGold * (rates[itemForm.carat] || 0);
  const previewMaking = itemForm.making_type === "flat" ? itemForm.making_charge : previewTotalGold * itemForm.making_charge;
  const shopStoneValue = stonesDraft.filter((s) => s.stone_status === "Shop Stone").reduce((sum, s) => sum + stoneValue(s), 0);
  const previewGrandTotal = previewGoldPrice + shopStoneValue + previewMaking - (orderForm.advance || 0);

  const filteredOrders = statusFilter ? orders.filter((o) => o.status === statusFilter) : orders;

  return (
    <>
      <div className="page-head">
        <div><h1 className="serif">Orders / Items</h1><p className="muted">Status and calculations for all orders</p></div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All Status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="btn gold" onClick={openNewOrderForm}>+ New Order</button>
        </div>
      </div>

      <div className="panel">
        <table>
          <thead><tr><th>Order #</th><th>Client</th><th>Item</th><th>Carat / Weight</th><th>Grand Total</th><th>Delivery</th><th>Status</th><th /></tr></thead>
          <tbody>
            {filteredOrders.map((o) => {
              const item = o.order_items?.[0];
              return (
                <tr key={o.id}>
                  <td><b>{o.order_number}</b></td>
                  <td>{o.clients?.name}</td>
                  <td>{item?.item_name}<div className="muted" style={{ fontSize: 11 }}>{item?.category}</div></td>
                  <td>{item?.carat}K · {Number(item?.total_gold || 0).toFixed(3)}g</td>
                  <td><b>₹ {Math.round((item?.total_gold || 0) * (rates[item?.carat] || 0))}</b></td>
                  <td>{o.delivery_date}</td>
                  <td>
                    <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value)}>
                      {STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <button className="btn ghost">📋</button>{" "}
                    <button className="btn ghost">✏️</button>{" "}
                    {isAdmin && <button className="btn danger" onClick={() => removeOrder(o.id)}>🗑️</button>}
                  </td>
                </tr>
              );
            })}
            {!filteredOrders.length && <tr><td colSpan={8} className="muted" style={{ textAlign: "center", padding: 30 }}>No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-head"><h2>New Order / Item</h2><button className="close-x" onClick={() => setShowForm(false)}>✕</button></div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="field span2">
                  <label>Client *</label>
                  <select value={orderForm.client_id} onChange={(e) => setOrderForm({ ...orderForm, client_id: e.target.value })}>
                    <option value="">Select client…</option>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Item Name *</label>
                  <input placeholder="e.g. Gold Ring" value={itemForm.item_name} onChange={(e) => setItemForm({ ...itemForm, item_name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Category</label>
                  <select value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Gold Carat *</label>
                  <select value={itemForm.carat} onChange={(e) => setItemForm({ ...itemForm, carat: e.target.value })}>
                    {CARATS.map((c) => <option key={c} value={c}>{c}K</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Net Gold Weight (g) *</label>
                  <input type="number" value={itemForm.net_weight} onChange={(e) => setItemForm({ ...itemForm, net_weight: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="field">
                  <label>Wastage (%) *</label>
                  <input type="number" value={itemForm.wastage_percent} onChange={(e) => setItemForm({ ...itemForm, wastage_percent: parseFloat(e.target.value) || 0 })} />
                </div>
                <div className="field">
                  <label>Deduct Gold (g)</label>
                  <input type="number" value={itemForm.deduct_gold} onChange={(e) => setItemForm({ ...itemForm, deduct_gold: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 6px" }}>
                <b style={{ fontSize: 14 }}>💎 Diamond &amp; Gemstone Module</b>
                <button className="btn ghost" type="button" onClick={addStone}>+ Add Stone</button>
              </div>
              {!stonesDraft.length && <p className="muted" style={{ fontSize: 12.5 }}>No stones added yet — click "+ Add Stone" for diamonds, gemstones, or other stones set in this item.</p>}
              {stonesDraft.map((s, i) => (
                <div key={i} className="panel" style={{ marginBottom: 10, padding: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <b style={{ fontSize: 13 }}>Stone #{i + 1}</b>
                    <button className="btn ghost" type="button" onClick={() => removeStone(i)}>✕</button>
                  </div>
                  <div className="form-grid">
                    <div className="field">
                      <label>Type</label>
                      <select value={s.stone_type} onChange={(e) => updateStone(i, "stone_type", e.target.value)}>
                        {STONE_TYPES.map((t) => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="field"><label>Quantity (pcs)</label><input type="number" value={s.quantity} onChange={(e) => updateStone(i, "quantity", parseInt(e.target.value) || 0)} /></div>
                    <div className="field"><label>Weight (ct)</label><input type="number" value={s.weight_ct} onChange={(e) => updateStone(i, "weight_ct", parseFloat(e.target.value) || 0)} /></div>
                    <div className="field"><label>Certificate #</label><input value={s.certificate_number} onChange={(e) => updateStone(i, "certificate_number", e.target.value)} /></div>
                    <div className="field">
                      <label>Rate Type</label>
                      <select value={s.rate_type} onChange={(e) => updateStone(i, "rate_type", e.target.value)}>
                        <option value="per_carat">Per Carat</option><option value="per_piece">Per Piece</option>
                      </select>
                    </div>
                    <div className="field"><label>Rate (₹)</label><input type="number" value={s.rate} onChange={(e) => updateStone(i, "rate", parseFloat(e.target.value) || 0)} /></div>
                    <div className="field">
                      <label>Ownership</label>
                      <select value={s.stone_status} onChange={(e) => updateStone(i, "stone_status", e.target.value)}>
                        <option>Shop Stone</option><option>Customer Stone</option>
                      </select>
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Value: <b>₹ {Math.round(stoneValue(s))}</b> {s.stone_status === "Customer Stone" && "(not billed)"}
                  </div>
                </div>
              ))}

              <div className="form-grid" style={{ marginTop: 14 }}>
                <div className="field">
                  <label>Making Charge Type</label>
                  <select value={itemForm.making_type} onChange={(e) => setItemForm({ ...itemForm, making_type: e.target.value })}>
                    <option value="per_gram">Per Gram</option><option value="flat">Flat Amount</option>
                  </select>
                </div>
                <div className="field"><label>Making Charge (₹)</label><input type="number" value={itemForm.making_charge} onChange={(e) => setItemForm({ ...itemForm, making_charge: parseFloat(e.target.value) || 0 })} /></div>
                <div className="field"><label>Advance Payment (₹)</label><input type="number" value={orderForm.advance} onChange={(e) => setOrderForm({ ...orderForm, advance: parseFloat(e.target.value) || 0 })} /></div>
                <div className="field"><label>Order Date</label><input type="date" value={orderForm.order_date} onChange={(e) => setOrderForm({ ...orderForm, order_date: e.target.value })} /></div>
                <div className="field"><label>Delivery Date *</label><input type="date" value={orderForm.delivery_date} onChange={(e) => setOrderForm({ ...orderForm, delivery_date: e.target.value })} /></div>
                <div className="field">
                  <label>Status</label>
                  <select value={orderForm.status} onChange={(e) => setOrderForm({ ...orderForm, status: e.target.value })}>
                    {STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field span2"><label>Notes</label><textarea placeholder="Any special instructions…" value={orderForm.notes} onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} /></div>

                <div className="field span2">
                  <label>Photos (optional) — add multiple angles</label>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                    <select value={photoCaption} onChange={(e) => setPhotoCaption(e.target.value)}>
                      {PHOTO_CAPTIONS.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <label className="btn ghost" style={{ cursor: "pointer" }}>
                      📷 Add Photo
                      <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleAddPhoto} />
                    </label>
                  </div>
                  {!photosDraft.length ? <p className="muted" style={{ fontSize: 12.5 }}>No photos added yet.</p> : (
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {photosDraft.map((p, i) => (
                        <div key={i} style={{ textAlign: "center" }}>
                          <img src={p.previewUrl} alt={p.caption} style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
                          <div className="muted" style={{ fontSize: 10.5 }}>{p.caption}</div>
                          <button className="btn ghost" style={{ padding: "2px 6px", fontSize: 10 }} onClick={() => removePhoto(i)}>✕</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="calc-box">
                <div className="row"><span>Total Gold (Net + Wastage − Deduct)</span><b>{previewTotalGold.toFixed(3)} g</b></div>
                <div className="row"><span>Gold Price (Total Gold × Rate)</span><b>₹ {Math.round(previewGoldPrice)}</b></div>
                <div className="row"><span>Stone Value — Shop-owned (billed)</span><b>₹ {Math.round(shopStoneValue)}</b></div>
                <div className="row"><span>Making Charge</span><b>₹ {Math.round(previewMaking)}</b></div>
                <div className="row"><span>Advance Paid</span><b>− ₹ {orderForm.advance || 0}</b></div>
                <div className="total"><span className="lbl">Grand Total (Due)</span><span className="amt">₹ {Math.round(previewGrandTotal)}</span></div>
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn ghost" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="btn gold" disabled={saving} onClick={createOrder}>{saving ? "Saving…" : "Save Order"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
