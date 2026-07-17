import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

export default function Settings() {
  const { isAdmin, logActivity } = useAuth();
  const [settings, setSettings] = useState(null);

  useEffect(() => { load(); }, []);
  async function load() {
    const { data } = await supabase.from("settings").select("*").eq("id", 1).single();
    setSettings(data);
  }
  async function save() {
    if (!isAdmin) return;
    const { error } = await supabase.from("settings").update({
      shop_name: settings.shop_name, phone: settings.phone, address: settings.address,
      gst: settings.gst, currency: settings.currency, invoice_prefix: settings.invoice_prefix,
      default_wastage: settings.default_wastage,
    }).eq("id", 1);
    if (error) return alert(error.message);
    await logActivity("settings_updated", {});
    alert("Settings saved.");
  }

  if (!settings) return <p className="muted">Loading…</p>;

  const field = (key, label, type = "text") => (
    <div>
      <label className="muted" style={{ fontSize: 12 }}>{label}</label>
      <input type={type} value={settings[key] || ""} disabled={!isAdmin}
        onChange={(e) => setSettings({ ...settings, [key]: e.target.value })}
        style={{ width: "100%", padding: 9, borderRadius: 8, border: "1px solid var(--border)" }} />
    </div>
  );

  return (
    <>
      <h1 className="serif">Settings</h1>
      <div className="panel">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {field("shop_name", "Shop Name")}
          {field("phone", "Phone")}
          {field("address", "Address")}
          {field("gst", "GST / Tax Number")}
          {field("currency", "Currency Symbol")}
          {field("invoice_prefix", "Invoice Prefix")}
          {field("default_wastage", "Default Wastage %", "number")}
        </div>
        {isAdmin && <button className="btn gold" style={{ marginTop: 16 }} onClick={save}>Save Settings</button>}
      </div>
    </>
  );
}
