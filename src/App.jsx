import React, { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, LogIn, LogOut, Plus, Pencil, Trash2, X, Monitor, Tag, CalendarDays, RefreshCw } from "lucide-react";
import { isSupabaseConfigured, supabase } from "./lib/supabase";

const emptyProduct = {
  brand: "Dell", name: "", model: "", category: "Desktop", sku: "",
  billing_price: "", offer_price: "", srp: "", effective_srp: "",
  offer_start: "", offer_end: "", notes: "", is_active: true
};

const money = (value) => value === null || value === "" || value === undefined
  ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value));

function offerStatus(p) {
  if (!p.offer_price || Number(p.offer_price) <= 0) return "No offer";
  const today = new Date().toISOString().slice(0, 10);
  if (p.offer_start && today < p.offer_start) return "Upcoming";
  if (p.offer_end && today > p.offer_end) return "Expired";
  return "Offer live";
}

function discount(p) {
  const base = Number(p.srp || 0);
  const offer = Number(p.offer_price || 0);
  if (!base || !offer || offer >= base) return null;
  return Math.round((1 - offer / base) * 100);
}

function Price({ label, value, highlight = false }) {
  return <div className={`price-cell ${highlight ? "price-highlight" : ""}`}>
    <span>{label}</span><strong>{money(value)}</strong>
  </div>;
}

function ProductCard({ product, isAdmin, onEdit, onDelete }) {
  const status = offerStatus(product);
  const pct = discount(product);
  return <article className="product-card">
    <div className="product-top">
      <div className={`brand-mark ${product.brand.toLowerCase()}`}>{product.brand}</div>
      <span className={`status status-${status.toLowerCase().replaceAll(" ", "-")}`}>{status}</span>
    </div>
    <div className="product-heading">
      <div className="category">{product.category || "Product"}{product.model ? ` · ${product.model}` : ""}</div>
      <h3>{product.name}</h3>
      {product.sku && <p className="sku">SKU: {product.sku}</p>}
    </div>
    <div className="prices">
      <Price label="Billing price" value={product.billing_price} />
      <Price label="Offer price" value={product.offer_price} highlight />
      <Price label="SRP" value={product.srp} />
      <Price label="Effective SRP" value={product.effective_srp} />
    </div>
    <div className="offer-footer">
      <div className="offer-dates"><CalendarDays size={15} />
        <span>{product.offer_start || "Start date"} → {product.offer_end || "End date"}</span>
      </div>
      {pct !== null && <span className="discount">{pct}% off SRP</span>}
    </div>
    {product.notes && <p className="notes">{product.notes}</p>}
    {isAdmin && <div className="card-actions">
      <button className="button button-light button-small" onClick={() => onEdit(product)}><Pencil size={14} /> Edit</button>
      <button className="button button-danger button-small" onClick={() => onDelete(product)}><Trash2 size={14} /> Delete</button>
    </div>}
  </article>;
}

function ProductForm({ initial, onClose, onSave, saving }) {
  const [form, setForm] = useState({ ...emptyProduct, ...initial });
  const [error, setError] = useState("");
  const change = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) return setError("Product name is required.");
    if (form.offer_start && form.offer_end && form.offer_end < form.offer_start) {
      return setError("Offer end date must be on or after the start date.");
    }
    const numeric = ["billing_price", "offer_price", "srp", "effective_srp"];
    const payload = { ...form };
    for (const key of numeric) payload[key] = form[key] === "" ? null : Number(form[key]);
    for (const key of ["offer_start", "offer_end"]) payload[key] = form[key] || null;
    const result = await onSave(payload);
    if (result?.error) setError(result.error);
    else onClose();
  }
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="modal-header"><div><span className="eyebrow">PRODUCT MANAGEMENT</span><h2 id="form-title">{initial?.id ? "Edit product" : "Add product"}</h2></div>
        <button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <label>Brand<select value={form.brand} onChange={e => change("brand", e.target.value)}><option>Dell</option><option>HP</option></select></label>
          <label>Category<select value={form.category} onChange={e => change("category", e.target.value)}>{["Desktop","Laptop","Monitor","Workstation","Server","Accessory","Other"].map(x => <option key={x}>{x}</option>)}</select></label>
          <label className="span-2">Product name *<input required value={form.name} onChange={e => change("name", e.target.value)} placeholder="e.g. OptiPlex Desktop" /></label>
          <label>Model<input value={form.model || ""} onChange={e => change("model", e.target.value)} placeholder="e.g. 7020" /></label>
          <label>SKU / Product code<input value={form.sku || ""} onChange={e => change("sku", e.target.value)} placeholder="Optional" /></label>
          <label>Billing price (₹)<input type="number" min="0" step="0.01" value={form.billing_price ?? ""} onChange={e => change("billing_price", e.target.value)} /></label>
          <label>Offer price (₹)<input type="number" min="0" step="0.01" value={form.offer_price ?? ""} onChange={e => change("offer_price", e.target.value)} /></label>
          <label>SRP (₹)<input type="number" min="0" step="0.01" value={form.srp ?? ""} onChange={e => change("srp", e.target.value)} /></label>
          <label>Effective SRP (₹)<input type="number" min="0" step="0.01" value={form.effective_srp ?? ""} onChange={e => change("effective_srp", e.target.value)} /></label>
          <label>Offer start date<input type="date" value={form.offer_start || ""} onChange={e => change("offer_start", e.target.value)} /></label>
          <label>Offer end date<input type="date" value={form.offer_end || ""} onChange={e => change("offer_end", e.target.value)} /></label>
          <label className="span-2">Notes<textarea rows="2" value={form.notes || ""} onChange={e => change("notes", e.target.value)} placeholder="Optional product details or offer terms" /></label>
          <label className="checkbox-label span-2"><input type="checkbox" checked={Boolean(form.is_active)} onChange={e => change("is_active", e.target.checked)} /> Product is active and visible publicly</label>
        </div>
        {error && <div className="error-message">{error}</div>}
        <div className="modal-actions"><button type="button" className="button button-light" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save product"}</button></div>
      </form>
    </section>
  </div>;
}

function LoginModal({ onClose, onLogin, loading }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault(); setError("");
    const result = await onLogin(email, password);
    if (result?.error) setError(result.error);
    else onClose();
  }
  return <div className="modal-backdrop">
    <section className="modal login-modal" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="modal-header"><div className="login-icon"><ShieldCheck size={23} /></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
      <span className="eyebrow">RESTRICTED ACCESS</span><h2 id="login-title">Admin sign in</h2><p className="muted">Sign in with an authorized administrator account.</p>
      <form onSubmit={submit} className="login-form">
        <label>Email address<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="error-message">{error}</div>}
        <button className="button button-primary full-width" disabled={loading}>{loading ? "Signing in…" : "Sign in securely"}</button>
      </form>
    </section>
  </div>;
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [session, setSession] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [query, setQuery] = useState("");
  const [brand, setBrand] = useState("All");
  const [category, setCategory] = useState("All");
  const [showLogin, setShowLogin] = useState(false);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [loadError, setLoadError] = useState("");

  async function refreshProducts() {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    setLoadError("");
    const { data, error } = await supabase.from("products").select("*").order("brand").order("name");
    if (error) setLoadError(error.message);
    else setProducts(data || []);
    setLoading(false);
  }

  function updateAdmin(currentSession) {
    const user = currentSession?.user ?? null;
    setSession(currentSession);
    setAdmin(user?.app_metadata?.role === "admin");
  }

  useEffect(() => {
    if (!isSupabaseConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => updateAdmin(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, current) => updateAdmin(current));
    refreshProducts();
    return () => listener.subscription.unsubscribe();
  }, []);

  const categories = useMemo(() => ["All", ...new Set(products.filter(p => brand === "All" || p.brand === brand).map(p => p.category).filter(Boolean))], [products, brand]);
  const visibleProducts = useMemo(() => products.filter(p => {
    if (!p.is_active) return false;
    if (brand !== "All" && p.brand !== brand) return false;
    if (category !== "All" && p.category !== category) return false;
    const haystack = [p.name, p.model, p.sku, p.brand, p.category].join(" ").toLowerCase();
    return haystack.includes(query.toLowerCase().trim());
  }), [products, brand, category, query]);

  async function login(email, password) {
    if (!supabase) return { error: "Supabase is not configured. Follow the README setup instructions." };
    setLoginLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoginLoading(false);
    if (error) return { error: "Sign-in failed. Check your credentials and admin access." };
    if (data.user?.app_metadata?.role !== "admin") {
      await supabase.auth.signOut();
      return { error: "This account is not authorized as an admin." };
    }
    setNotice("Admin signed in successfully.");
    return {};
  }

  async function saveProduct(payload) {
    setSaving(true);
    const { id, created_at, updated_at, ...clean } = payload;
    let result;
    if (payload.id) result = await supabase.from("products").update(clean).eq("id", payload.id);
    else result = await supabase.from("products").insert(clean);
    setSaving(false);
    if (result.error) return { error: "Could not save product. Check admin role and database policies." };
    setEditing(null); setNotice("Product saved."); await refreshProducts(); return {};
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}" permanently? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", product.id);
    if (error) setNotice("Delete failed. Check your admin access.");
    else { setNotice("Product deleted."); await refreshProducts(); }
  }

  async function logout() {
    await supabase.auth.signOut(); setNotice("You have signed out.");
  }

  return <div className="app-shell">
    <header className="site-header">
      <a className="wordmark" href="#" aria-label="Dell and HP Price List home"><span className="logo-box"><Monitor size={22} /></span><span><strong>ACTIVATION</strong><small>PRICE LIST</small></span></a>
      <nav className="header-nav"><span className="live-indicator"><i /> Price catalog</span>
        {admin ? <><span className="admin-label"><ShieldCheck size={15} /> Admin mode</span><button className="button button-light button-small" onClick={logout}><LogOut size={15} /> Sign out</button></>
          : <button className="button button-outline button-small" onClick={() => setShowLogin(true)}><LogIn size={15} /> Admin login</button>}
      </nav>
    </header>

    <main>
      <section className="hero">
        <div className="hero-content">
          <span className="eyebrow"><span className="eyebrow-dot" /> OFFICIAL PRICE WORKSPACE</span>
          <h1>Dell & HP<br /><span>Activation Price List.</span></h1>
          <p>One place for current billing prices, offer pricing, SRP and promotional validity.</p>
          <div className="hero-tags"><span><ShieldCheck size={15} /> Verified catalog</span><span><Tag size={15} /> Offer tracking</span></div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><div className="art-device"><div className="device-screen"><span>PRICE<br />LIST<span className="device-dot">.</span></span><div className="device-lines"><i /><i /><i /></div></div><div className="device-base" /></div><div className="floating-chip chip-dell">DELL</div><div className="floating-chip chip-hp">hp</div></div>
      </section>

      {!isSupabaseConfigured && <div className="setup-alert"><strong>Setup required</strong><span>Add your Supabase project URL and publishable/anon key to the local <code>.env</code> file, then redeploy. See README.md.</span></div>}
      {notice && <div className="notice"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
      {loadError && <div className="error-banner">Could not load products: {loadError}. Check the database setup and public read policy.</div>}

      <section className="catalog-section">
        <div className="section-heading"><div><span className="eyebrow">PRODUCT DIRECTORY</span><h2>Current price list</h2><p>Search models, compare prices, and check offer validity.</p></div>
          {admin && <button className="button button-primary" onClick={() => setEditing({ ...emptyProduct })}><Plus size={17} /> Add product</button>}
        </div>
        <div className="filters">
          <div className="search-box"><Search size={18} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search product, model or SKU…" aria-label="Search products" />{query && <button onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}</div>
          <div className="filter-group" aria-label="Filter by brand">{["All", "Dell", "HP"].map(b => <button key={b} className={`filter-pill ${brand === b ? "selected" : ""}`} onClick={() => { setBrand(b); setCategory("All"); }}>{b === "All" ? "All brands" : b}</button>)}</div>
          <select className="category-select" value={category} onChange={e => setCategory(e.target.value)} aria-label="Filter by category">{categories.map(c => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="results-line"><span>{loading ? "Loading products…" : `${visibleProducts.length} product${visibleProducts.length === 1 ? "" : "s"} found`}</span><button className="refresh-button" onClick={refreshProducts}><RefreshCw size={14} /> Refresh</button></div>
        {loading ? <div className="empty-state"><div className="spinner" /><p>Loading price list…</p></div> :
          visibleProducts.length ? <div className="product-grid">{visibleProducts.map(p => <ProductCard key={p.id} product={p} isAdmin={admin} onEdit={setEditing} onDelete={deleteProduct} />)}</div> :
          <div className="empty-state"><div className="empty-icon"><Search size={23} /></div><h3>{products.length ? "No matching products" : "Your price list starts here"}</h3><p>{products.length ? "Try another search term or clear your filters." : admin ? "Add your first Dell or HP product to get started." : "Products will appear here once they have been added by an administrator."}</p>{admin && !products.length && <button className="button button-primary" onClick={() => setEditing({ ...emptyProduct })}><Plus size={16} /> Add first product</button>}</div>}
      </section>
    </main>
    <footer className="site-footer"><div className="footer-brand"><span className="logo-box small"><Monitor size={16} /></span><span>ACTIVATION PRICE LIST</span></div><p>Prices and offers are subject to the validity dates shown. Confirm final pricing before billing.</p><span className="footer-lock"><ShieldCheck size={14} /> Secure admin access</span></footer>
    {editing && admin && <ProductForm initial={editing} onClose={() => setEditing(null)} onSave={saveProduct} saving={saving} />}
    {showLogin && <LoginModal onClose={() => setShowLogin(false)} onLogin={login} loading={loginLoading} />}
  </div>;
}