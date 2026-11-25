import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Building2, ClipboardList, FileText, LayoutDashboard, MapPin, Package, Pencil, Plus, Receipt, RefreshCw, ShieldAlert, Trash2, Truck, Users } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { POSView, PrescriptionView, ProcurementView, StaffView } from "./PharmacyExtraViews";

const navigation = [
  { to: "/pharmacy", label: "Overview", icon: LayoutDashboard, permission: "dashboard" },
  { to: "/pharmacy/inventory", label: "Inventory", icon: Package, permission: "inventory" },
  { to: "/pharmacy/stock-alerts", label: "Low stock & expiry", icon: ShieldAlert, permission: "inventory" },
  { to: "/pharmacy/requests", label: "Customer requests", icon: ClipboardList, permission: "requests" },
  { to: "/pharmacy/procurement", label: "Suppliers & orders", icon: Truck, permission: "procurement" },
  { to: "/pharmacy/pos", label: "Counter sales", icon: Receipt, permission: "sales" },
  { to: "/pharmacy/prescriptions", label: "Prescription workflow", icon: FileText, permission: "prescriptions" },
  { to: "/pharmacy/reports", label: "Reports", icon: LayoutDashboard, permission: "dashboard" },
  { to: "/pharmacy/notifications", label: "Notifications", icon: Bell, permission: "dashboard" },
  { to: "/pharmacy/profile", label: "Pharmacy profile", icon: Building2, ownerOnly: true },
  { to: "/pharmacy/staff", label: "Staff & permissions", icon: Users, ownerOnly: true }
];

const emptyInventory = {
  medicineId: "", quantity: 0, reorderLevel: 10, price: "", batchNumber: "", expiryDate: ""
};

function PharmacyShell({ title, children }) {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isOwner = user?.role === "PHARMACY";
  const can = (permission) => isOwner || user?.permissions?.includes(permission);
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-100 bg-white p-3 shadow-soft">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">Pharmacy workspace</p>
            <nav className="grid grid-cols-2 gap-1 lg:grid-cols-1">
              {navigation.filter((item) => item.ownerOnly ? isOwner : can(item.permission)).map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${pathname === to ? "bg-medical-50 text-medical-700" : "text-slate-600 hover:bg-slate-50"}`}>
                  <Icon className="h-4 w-4 shrink-0" />{label}
                </Link>
              ))}
            </nav>
          </aside>
          <section className="min-w-0">
            <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, note, tone = "green" }) {
  const color = tone === "red" ? "text-red-700 bg-red-50" : tone === "amber" ? "text-amber-700 bg-amber-50" : "text-medical-700 bg-medical-50";
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{value ?? "—"}</p>
      {note && <p className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>{note}</p>}
    </article>
  );
}

function EmptyState({ title, message }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
    <Package className="mx-auto h-9 w-9 text-slate-300" />
    <h2 className="mt-3 font-bold text-slate-800">{title}</h2>
    <p className="mt-1 text-sm text-slate-500">{message}</p>
  </div>;
}

export default function PharmacyDashboard() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const isOwner = user?.role === "PHARMACY";
  const can = (permission) => isOwner || user?.permissions?.includes(permission);
  const [summary, setSummary] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [pharmacy, setPharmacy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [summaryResponse, inventoryResponse, requestResponse, notificationResponse, medicineResponse] = await Promise.all([
        api.get("/pharmacies/mine/summary"),
        can("inventory") ? api.get("/inventory/my") : Promise.resolve({ data: { data: [] } }),
        can("requests") ? api.get("/requests/pharmacy") : Promise.resolve({ data: { data: [] } }),
        api.get("/notifications"),
        api.get("/medicines", { params: { limit: 50 } })
      ]);
      setSummary(summaryResponse.data.data);
      setPharmacy(summaryResponse.data.data.pharmacy);
      setInventory(inventoryResponse.data.data);
      setRequests(requestResponse.data.data);
      setNotifications(notificationResponse.data.data);
      setMedicines(medicineResponse.data.data);
    } catch (requestError) {
      const message = requestError.response?.data?.message || "Could not load pharmacy information";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [isOwner, user?.permissions]);

  useEffect(() => { refresh(); }, [refresh]);

  const alerts = useMemo(() => {
    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    return inventory.filter((item) =>
      Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderLevel ?? 10) ||
      new Date(item.expiryDate) <= soon
    );
  }, [inventory]);

  async function updateRequest(id, status) {
    try {
      await api.patch(`/requests/${id}/status`, { status });
      toast.success(`Request ${status.toLowerCase()}`);
      await refresh();
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to update request");
    }
  }

  async function downloadPrescription(id) {
    try {
      const { data, headers } = await api.get(`/requests/${id}/prescription`, { responseType: "blob" });
      const mimeType = headers["content-type"] || data.type;
      const extension = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg";
      const url = URL.createObjectURL(new Blob([data], { type: mimeType }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `prescription.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to download prescription");
    }
  }

  async function markNotificationRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, isRead: true } : item));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || "Unable to update notification");
    }
  }

  const title = pathname.includes("/inventory") ? "Inventory management"
    : pathname.includes("/stock-alerts") ? "Low stock & expiry"
      : pathname.includes("/requests") ? "Customer requests"
        : pathname.includes("/procurement") ? "Suppliers & purchase orders"
          : pathname.includes("/pos") ? "Counter sales & invoices"
            : pathname.includes("/prescriptions") ? "Prescription workflow"
              : pathname.includes("/staff") ? "Staff & permissions"
        : pathname.includes("/reports") ? "Inventory reports"
          : pathname.includes("/notifications") ? "Notifications"
            : pathname.includes("/profile") ? "Pharmacy profile"
              : "Pharmacy overview";

  if (loading && !summary && !error) {
    return <PharmacyShell title={title}><div className="rounded-2xl bg-white p-8 text-slate-500 shadow-soft">Loading your pharmacy workspace…</div></PharmacyShell>;
  }

  const protectedPermission = pathname.includes("/inventory") || pathname.includes("/stock-alerts") ? "inventory"
    : pathname.includes("/requests") ? "requests"
      : pathname.includes("/procurement") ? "procurement"
        : pathname.includes("/pos") ? "sales"
          : pathname.includes("/prescriptions") ? "prescriptions"
            : pathname.includes("/reports") || pathname.includes("/notifications") ? "dashboard"
              : null;
  const isOwnerOnlyPage = pathname.includes("/profile") || pathname.includes("/staff");

  return (
    <PharmacyShell title={title}>
      {error && <div role="alert" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <span>{error}</span><button onClick={refresh} className="inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button>
      </div>}
      {((protectedPermission && !can(protectedPermission)) || (isOwnerOnlyPage && !isOwner)) && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Your pharmacy account does not have permission to access this section.</div>}
      {can("inventory") && pathname.includes("/inventory") && <InventoryView inventory={inventory} medicines={medicines} refresh={refresh} />}
      {can("inventory") && pathname.includes("/stock-alerts") && <AlertsView inventory={alerts} />}
      {can("requests") && pathname.includes("/requests") && <RequestsView requests={requests} updateRequest={updateRequest} downloadPrescription={downloadPrescription} />}
      {can("procurement") && pathname.includes("/procurement") && <ProcurementView />}
      {can("sales") && pathname.includes("/pos") && <POSView />}
      {can("prescriptions") && pathname.includes("/prescriptions") && <PrescriptionView />}
      {isOwner && pathname.includes("/staff") && <StaffView />}
      {can("dashboard") && pathname.includes("/reports") && <ReportsView summary={summary} inventory={inventory} requests={requests} />}
      {can("dashboard") && pathname.includes("/notifications") && <NotificationsView items={notifications} markRead={markNotificationRead} />}
      {isOwner && pathname.includes("/profile") && <ProfileView pharmacy={pharmacy} saved={refresh} />}
      {pathname === "/pharmacy" && <Overview summary={summary} inventory={inventory} requests={requests} refresh={refresh} />}
    </PharmacyShell>
  );
}

function Overview({ summary, inventory, requests, refresh }) {
  const stats = summary?.inventory || {};
  const pending = requests.filter((item) => item.status === "PENDING").length;
  const alerts = Number(stats.lowStock || 0) + Number(stats.expiringSoon || 0) + Number(stats.expired || 0);
  const pharmacy = summary?.pharmacy;
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
        <div><p className="text-sm text-slate-500">Welcome to your pharmacy workspace</p><h2 className="mt-1 text-xl font-bold">{pharmacy?.pharmacyName || "Complete your pharmacy profile"}</h2></div>
        <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${pharmacy?.verificationStatus === "APPROVED" ? "bg-medical-50 text-medical-700" : "bg-amber-50 text-amber-700"}`}>{pharmacy?.verificationStatus || "PROFILE REQUIRED"}</div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Medicine listings" value={stats.listings || 0} />
        <Metric label="Requests to review" value={pending} note={pending ? "Action needed" : "All caught up"} tone={pending ? "amber" : "green"} />
        <Metric label="Low stock" value={stats.lowStock || 0} note="At or below reorder level" tone={stats.lowStock ? "amber" : "green"} />
        <Metric label="Expiring in 30 days" value={stats.expiringSoon || 0} note={stats.expired ? `${stats.expired} expired listing(s)` : "Expiry watch"} tone={stats.expiringSoon || stats.expired ? "red" : "green"} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Inventory snapshot</h2><Link to="/pharmacy/inventory" className="text-sm font-semibold text-medical-700">Manage inventory</Link></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Estimated stock value</p><p className="mt-1 text-xl font-bold">₹{Number(stats.stockValue || 0).toLocaleString("en-IN")}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-sm text-slate-500">Expired listings</p><p className="mt-1 text-xl font-bold">{stats.expired || 0}</p></div>
          </div>
          <p className="mt-4 text-xs text-slate-500">Stock value is an estimate based on entered unit prices and quantities. It is not accounting or sales data.</p>
        </section>
        <section className="rounded-2xl bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Needs attention</h2><Link to="/pharmacy/stock-alerts" className="text-sm font-semibold text-medical-700">View alerts</Link></div>
          {alertsFor(inventory).length ? <div className="grid gap-3">{alertsFor(inventory).slice(0, 4).map((item) => <AlertRow key={item._id} item={item} />)}</div> : <p className="rounded-xl bg-medical-50 p-4 text-sm text-medical-700">No low-stock or upcoming-expiry alerts.</p>}
        </section>
      </div>
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Latest availability requests</h2><Link to="/pharmacy/requests" className="text-sm font-semibold text-medical-700">Manage requests</Link></div>
        {requests.length ? <div className="grid gap-3">{requests.slice(0, 5).map((request) => <div key={request._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4">
          <div><p className="font-semibold">{request.medicineId?.medicineName || "Medicine request"} · Qty {request.requestedQuantity}</p><p className="text-sm text-slate-500">{request.customerId?.name || "Customer"} · {request.status}</p></div>
          {request.status === "PENDING" && <button onClick={() => updateRequest(request._id, "ACCEPTED")} className="rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Accept</button>}
        </div>)}</div> : <EmptyState title="No requests yet" message="Customer availability requests will appear here." />}
        <button onClick={refresh} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-slate-600"><RefreshCw className="h-4 w-4" /> Refresh dashboard</button>
      </section>
    </div>
  );
}

function alertsFor(inventory) {
  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return inventory.filter((item) => {
    const expiry = new Date(item.expiryDate);
    const low = Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderLevel ?? 10);
    return low || expiry <= soon;
  });
}

function AlertRow({ item }) {
  const expiry = new Date(item.expiryDate);
  const expired = expiry <= new Date();
  const low = Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderLevel ?? 10);
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
    <div><p className="font-semibold">{item.medicineId?.medicineName || "Medicine"}</p><p className="text-xs text-slate-500">Batch {item.batchNumber || "—"} · {item.quantity} in stock</p></div>
    <span className={`text-right text-xs font-bold ${expired ? "text-red-700" : low ? "text-amber-700" : "text-slate-500"}`}>{expired ? "Expired" : low ? "Low stock" : `Expires ${expiry.toLocaleDateString()}`}</span>
  </div>;
}

function AlertsView({ inventory }) {
  if (!inventory.length) return <EmptyState title="No stock alerts" message="Low-stock items and items nearing expiry will be listed here." />;
  return <div className="grid gap-3">{inventory.map((item) => <AlertRow key={item._id} item={item} />)}</div>;
}

function InventoryView({ inventory, medicines, refresh }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyInventory);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const filtered = inventory.filter((item) => {
    const name = item.medicineId?.medicineName || "";
    const matchesText = name.toLowerCase().includes(query.toLowerCase()) || String(item.batchNumber || "").toLowerCase().includes(query.toLowerCase());
    const status = filter === "low" ? Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderLevel ?? 10)
      : filter === "out" ? Number(item.quantity) === 0
        : filter === "expired" ? new Date(item.expiryDate) <= new Date()
          : filter === "expiring" ? new Date(item.expiryDate) > new Date() && new Date(item.expiryDate) <= new Date(Date.now() + 30 * 86400000)
            : true;
    return matchesText && status;
  });

  function startCreate() {
    setEditing(null);
    setForm(emptyInventory);
    setShowForm(true);
  }

  function startEdit(item) {
    setEditing(item);
    setForm({
      medicineId: item.medicineId?._id || "",
      quantity: item.quantity,
      reorderLevel: item.reorderLevel ?? 10,
      price: item.price,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate ? new Date(item.expiryDate).toISOString().slice(0, 10) : ""
    });
    setShowForm(true);
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        quantity: Number(form.quantity),
        reorderLevel: Number(form.reorderLevel),
        price: Number(form.price),
        expiryDate: new Date(`${form.expiryDate}T23:59:59`)
      };
      if (editing) {
        await api.put(`/inventory/${editing._id}`, payload);
        toast.success("Inventory updated");
      } else {
        await api.post("/inventory", payload);
        toast.success("Medicine added to inventory");
      }
      setShowForm(false);
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save inventory");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item) {
    if (!window.confirm(`Delete ${item.medicineId?.medicineName || "this medicine"} from inventory?`)) return;
    try {
      await api.delete(`/inventory/${item._id}`);
      toast.success("Inventory item deleted");
      await refresh();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to delete inventory");
    }
  }

  return <div className="grid gap-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-slate-500">{inventory.length} medicine listing(s)</p>
      <button onClick={startCreate} className="inline-flex items-center gap-2 rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" /> Add medicine</button>
    </div>
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-soft sm:flex-row">
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search medicine or batch" className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-2.5 outline-none focus:border-medical-500" />
      <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-2.5">
        <option value="all">All stock</option><option value="low">Low stock</option><option value="out">Out of stock</option><option value="expiring">Expiring in 30 days</option><option value="expired">Expired</option>
      </select>
    </div>
    {showForm && <form onSubmit={save} className="grid gap-4 rounded-2xl border border-medical-100 bg-white p-5 shadow-soft md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="font-bold">{editing ? "Update inventory" : "Add medicine to inventory"}</h2><p className="mt-1 text-sm text-slate-500">Use accurate batch and expiry details. A listing is maintained per medicine.</p></div>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Medicine
        <select required disabled={Boolean(editing)} value={form.medicineId} onChange={(event) => setForm({ ...form, medicineId: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5">
          <option value="">Select a catalogue medicine</option>{medicines.map((medicine) => <option key={medicine._id} value={medicine._id}>{medicine.medicineName} · {medicine.strength || "—"}</option>)}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Unit price (₹)
        <input required min="0" step="0.01" type="number" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Quantity
        <input required min="0" type="number" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Low-stock alert threshold
        <input required min="0" type="number" value={form.reorderLevel} onChange={(event) => setForm({ ...form, reorderLevel: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Batch number
        <input required maxLength={100} value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5" />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Expiry date
        <input required type="date" value={form.expiryDate} onChange={(event) => setForm({ ...form, expiryDate: event.target.value })} className="rounded-xl border border-slate-200 px-3 py-2.5" />
      </label>
      <div className="flex gap-2 md:col-span-2"><button disabled={saving} className="rounded-xl bg-medical-600 px-4 py-2.5 font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : editing ? "Save changes" : "Add to inventory"}</button><button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold text-slate-600">Cancel</button></div>
    </form>}
    {filtered.length ? <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Medicine / batch</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Unit price</th><th className="px-4 py-3">Expiry</th><th className="px-4 py-3">Last updated</th><th className="px-4 py-3">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-100">{filtered.map((item) => {
          const expired = new Date(item.expiryDate) <= new Date();
          const low = Number(item.quantity) > 0 && Number(item.quantity) <= Number(item.reorderLevel ?? 10);
          return <tr key={item._id}>
            <td className="px-4 py-4"><p className="font-semibold text-slate-800">{item.medicineId?.medicineName}</p><p className="text-xs text-slate-500">Batch {item.batchNumber}</p></td>
            <td className="px-4 py-4"><span className={`font-semibold ${item.quantity === 0 || expired ? "text-red-700" : low ? "text-amber-700" : "text-medical-700"}`}>{item.quantity}</span><span className="text-xs text-slate-500"> / alert at {item.reorderLevel ?? 10}</span></td>
            <td className="px-4 py-4">₹{Number(item.price).toFixed(2)}</td>
            <td className={`px-4 py-4 ${expired ? "font-bold text-red-700" : "text-slate-600"}`}>{new Date(item.expiryDate).toLocaleDateString()}</td>
            <td className="px-4 py-4 text-slate-500">{new Date(item.lastUpdated).toLocaleDateString()}</td>
            <td className="px-4 py-4"><div className="flex gap-2"><button title="Edit item" onClick={() => startEdit(item)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-medical-700"><Pencil className="h-4 w-4" /></button><button title="Delete item" onClick={() => remove(item)} className="rounded-lg border border-slate-200 p-2 text-red-600"><Trash2 className="h-4 w-4" /></button></div></td>
          </tr>;
        })}</tbody>
      </table></div>
    </div> : <EmptyState title={inventory.length ? "No matching inventory" : "Your inventory is empty"} message={inventory.length ? "Try a different search or filter." : "Add catalogue medicines to track price, batch, expiry and availability."} />}
  </div>;
}

function RequestsView({ requests, updateRequest, downloadPrescription }) {
  const [filter, setFilter] = useState("ALL");
  const visible = requests.filter((request) => filter === "ALL" || request.status === filter);
  return <div className="grid gap-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{requests.length} total request(s)</p><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5"><option value="ALL">ALL</option>{["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED", "REJECTED", "FULFILLED", "CANCELLED"].map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div>
    {visible.length ? visible.map((item) => <article key={item._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{item.medicineId?.medicineName || "Medicine request"} · Quantity {item.requestedQuantity}</h2><p className="mt-1 text-sm text-slate-500">{item.customerId?.name || "Customer"} · {item.customerId?.phone || "No phone provided"}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p>{item.fulfillmentType === "DELIVERY" && <><p className="mt-2 text-sm font-semibold text-slate-700">Home delivery · ₹{(Number(item.unitPrice || 0) * item.requestedQuantity).toFixed(2)} (delivery fee not included)</p>{item.deliveryAddress && <p className="mt-1 text-sm text-slate-600">{item.deliveryAddress.line1}{item.deliveryAddress.line2 ? `, ${item.deliveryAddress.line2}` : ""}, {item.deliveryAddress.city}, {item.deliveryAddress.state} {item.deliveryAddress.pincode}{item.deliveryAddress.instructions ? ` · ${item.deliveryAddress.instructions}` : ""}</p>}</>}{item.remarks && <p className="mt-2 text-sm text-slate-600">Note: {item.remarks}</p>}{item.prescription?.mimeType && <button onClick={() => downloadPrescription(item._id)} className="mt-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-medical-700">Download prescription</button>}</div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status.replaceAll("_", " ")}</span></div>
      {item.status === "PENDING" && <div className="mt-4 flex gap-2"><button onClick={() => updateRequest(item._id, "ACCEPTED")} className="rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Accept request</button><button onClick={() => updateRequest(item._id, "REJECTED")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Reject</button></div>}
      {item.status === "ACCEPTED" && item.fulfillmentType === "PICKUP" && <button onClick={() => updateRequest(item._id, "FULFILLED")} className="mt-4 rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Mark fulfilled (deducts stock)</button>}
      {item.fulfillmentType === "DELIVERY" && item.status === "ACCEPTED" && <button onClick={() => updateRequest(item._id, "PREPARING")} className="mt-4 rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Start preparing</button>}
      {item.fulfillmentType === "DELIVERY" && item.status === "PREPARING" && <button onClick={() => updateRequest(item._id, "OUT_FOR_DELIVERY")} className="mt-4 rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Mark out for delivery</button>}
      {item.fulfillmentType === "DELIVERY" && item.status === "OUT_FOR_DELIVERY" && <button onClick={() => updateRequest(item._id, "DELIVERED")} className="mt-4 rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Mark delivered (deducts stock)</button>}
    </article>) : <EmptyState title="No requests in this view" message="Customer requests will show here when they are submitted." />}
  </div>;
}

function ReportsView({ summary, inventory, requests }) {
  const stats = summary?.inventory || {};
  const groups = [
    { label: "Available listings", value: inventory.filter((item) => item.quantity > 0 && new Date(item.expiryDate) > new Date()).length },
    { label: "Out of stock", value: inventory.filter((item) => item.quantity === 0).length },
    { label: "Below reorder level", value: stats.lowStock || 0 },
    { label: "Expiring within 30 days", value: stats.expiringSoon || 0 },
    { label: "Expired", value: stats.expired || 0 },
    { label: "Pending customer requests", value: requests.filter((item) => item.status === "PENDING").length }
  ];
  return <div className="grid gap-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{groups.map((item) => <Metric key={item.label} label={item.label} value={item.value} tone={item.value ? "amber" : "green"} />)}</div>
    <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="font-bold">Stock by expiry window</h2><div className="mt-4 grid gap-3 sm:grid-cols-3">
      {[{ label: "Expired", count: stats.expired || 0, tone: "bg-red-500" }, { label: "Next 30 days", count: stats.expiringSoon || 0, tone: "bg-amber-500" }, { label: "Later", count: Math.max(0, inventory.length - (stats.expired || 0) - (stats.expiringSoon || 0)), tone: "bg-medical-500" }].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-600">{item.label}</span><strong>{item.count}</strong></div><div className="mt-3 h-2 rounded-full bg-slate-200"><div className={`h-2 rounded-full ${item.tone}`} style={{ width: `${inventory.length ? Math.min(100, item.count / inventory.length * 100) : 0}%` }} /></div></div>)}
    </div><p className="mt-4 text-xs text-slate-500">Operational inventory summary, not a financial or dispensing report.</p></div>
    <button onClick={() => window.print()} className="w-fit rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Print this report</button>
  </div>;
}

function NotificationsView({ items, markRead }) {
  if (!items.length) return <EmptyState title="You're all caught up" message="Request updates and stock notifications will appear here." />;
  return <div className="grid gap-3">{items.map((item) => <article key={item._id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
    <div className="flex items-start justify-between gap-4"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.message}</p><p className="mt-2 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</p></div>{!item.isRead && <button onClick={() => markRead(item._id)} className="shrink-0 text-sm font-semibold text-medical-700">Mark read</button>}</div>
  </article>)}</div>;
}

function ProfileView({ pharmacy, saved }) {
  const [form, setForm] = useState({
    pharmacyName: pharmacy?.pharmacyName || "",
    address: pharmacy?.address || "",
    city: pharmacy?.city || "",
    state: pharmacy?.state || "",
    pincode: pharmacy?.pincode || "",
    phone: pharmacy?.phone || "",
    licenseNumber: pharmacy?.licenseNumber || "",
    openingTime: pharmacy?.openingTime || "09:00",
    closingTime: pharmacy?.closingTime || "21:00",
    longitude: pharmacy?.location?.coordinates?.[0] ?? "",
    latitude: pharmacy?.location?.coordinates?.[1] ?? ""
  });
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  useEffect(() => {
    setForm({
      pharmacyName: pharmacy?.pharmacyName || "", address: pharmacy?.address || "", city: pharmacy?.city || "",
      state: pharmacy?.state || "", pincode: pharmacy?.pincode || "", phone: pharmacy?.phone || "",
      licenseNumber: pharmacy?.licenseNumber || "", openingTime: pharmacy?.openingTime || "09:00",
      closingTime: pharmacy?.closingTime || "21:00", longitude: pharmacy?.location?.coordinates?.[0] ?? "",
      latitude: pharmacy?.location?.coordinates?.[1] ?? ""
    });
  }, [pharmacy]);
  function field(name, value) { setForm((current) => ({ ...current, [name]: value })); }
  function useLocation() {
    if (!navigator.geolocation) return toast.error("Geolocation is not available in this browser");
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setForm((current) => ({ ...current, longitude: coords.longitude, latitude: coords.latitude })); setLocating(false); },
      () => { setLocating(false); toast.error("Could not read location. Enter coordinates manually."); },
      { timeout: 10000 }
    );
  }
  async function submit(event) {
    event.preventDefault();
    if (!Number.isFinite(Number(form.longitude)) || !Number.isFinite(Number(form.latitude)) || Number(form.longitude) < -180 || Number(form.longitude) > 180 || Number(form.latitude) < -90 || Number(form.latitude) > 90) {
      return toast.error("Enter valid longitude and latitude coordinates");
    }
    setSaving(true);
    const payload = {
      pharmacyName: form.pharmacyName, address: form.address, city: form.city, state: form.state, pincode: form.pincode,
      phone: form.phone, openingTime: form.openingTime, closingTime: form.closingTime,
      coordinates: [Number(form.longitude), Number(form.latitude)]
    };
    try {
      if (pharmacy) {
        await api.put(`/pharmacies/${pharmacy._id}`, payload);
        toast.success("Pharmacy profile updated");
      } else {
        await api.post("/pharmacies/register", { ...payload, licenseNumber: form.licenseNumber });
        toast.success("Profile submitted for administrator verification");
      }
      await saved();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to save pharmacy profile");
    } finally {
      setSaving(false);
    }
  }
  const fields = [
    ["pharmacyName", "Pharmacy name", "text"], ["phone", "Contact phone", "tel"], ["address", "Street address", "text"],
    ["city", "City", "text"], ["state", "State", "text"], ["pincode", "PIN code", "text"],
    ["openingTime", "Opening time", "time"], ["closingTime", "Closing time", "time"]
  ];
  return <form onSubmit={submit} className="grid gap-4 rounded-2xl bg-white p-5 shadow-soft sm:grid-cols-2">
    <div className="sm:col-span-2"><p className="text-sm text-slate-600">{pharmacy ? "Keep your public pharmacy information and opening hours current." : "Create your pharmacy profile. It will remain hidden from customers until an administrator approves it."}</p>{pharmacy && <p className="mt-2 inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Verification: {pharmacy.verificationStatus}</p>}</div>
    {fields.map(([name, label, type]) => <label key={name} className="grid gap-1.5 text-sm font-semibold text-slate-700">{label}<input required type={type} value={form[name]} onChange={(event) => field(name, event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" /></label>)}
    {!pharmacy && <label className="grid gap-1.5 text-sm font-semibold text-slate-700 sm:col-span-2">Pharmacy license number<input required value={form.licenseNumber} onChange={(event) => field("licenseNumber", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" /></label>}
    <div className="grid gap-3 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto]">
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Longitude<input required type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(event) => field("longitude", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" /></label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">Latitude<input required type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(event) => field("latitude", event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5" /></label>
      <button type="button" onClick={useLocation} disabled={locating} className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700"><MapPin className="h-4 w-4" />{locating ? "Locating…" : "Use my location"}</button>
    </div>
    <div className="sm:col-span-2"><button disabled={saving} className="rounded-xl bg-medical-600 px-5 py-3 font-semibold text-white disabled:opacity-60">{saving ? "Saving…" : pharmacy ? "Save profile" : "Submit for approval"}</button></div>
  </form>;
}
