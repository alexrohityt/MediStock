import { useEffect, useMemo, useState } from "react";
import { Activity, ArrowRight, BarChart3, Bell, Building2, Check, ClipboardList, Clock3, LayoutDashboard, MapPin, PackageCheck, Pill, RefreshCw, Search, ShieldCheck, Sparkles, Truck, Users, XCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import toast from "react-hot-toast";
import Navbar from "../components/Navbar";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";

function Shell({ title, links, children }) {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-100/70 via-slate-50 to-cyan-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-[220px_1fr]">
          <aside className="h-fit rounded-2xl border border-white/80 bg-white/80 p-3 shadow-soft backdrop-blur">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-400">Your space</p>
            {links.map((link) => (
              <Link key={link.to} to={link.to} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${location.pathname === link.to ? "bg-gradient-to-r from-medical-600 to-teal-500 text-white shadow-md shadow-emerald-900/15" : "text-slate-600 hover:bg-medical-50 hover:text-medical-700"}`}>
                {link.icon}<span>{link.label}</span>
              </Link>
            ))}
          </aside>
          <section>
            <h1 className="mb-6 text-2xl font-bold text-slate-900">{title}</h1>
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCards({ items }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{items.map((item) => (
    <div key={item.label} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-soft">
      <p className="text-sm text-slate-500">{item.label}</p>
      <p className="mt-2 text-3xl font-bold text-slate-900">{item.value ?? "-"}</p>
    </div>
  ))}</div>;
}

const deliveryStages = [
  { status: "PENDING", label: "Order placed", icon: Clock3 },
  { status: "ACCEPTED", label: "Pharmacy accepted", icon: Check },
  { status: "PREPARING", label: "Preparing order", icon: Pill },
  { status: "OUT_FOR_DELIVERY", label: "On the way", icon: Truck },
  { status: "DELIVERED", label: "Delivered", icon: PackageCheck }
];

function DeliveryProgress({ status }) {
  const currentStage = deliveryStages.findIndex((stage) => stage.status === status);
  return (
    <ol className="mt-5 grid grid-cols-5 gap-1" aria-label={`Delivery progress: ${status.replaceAll("_", " ").toLowerCase()}`}>
      {deliveryStages.map((stage, index) => {
        const Icon = stage.icon;
        const complete = currentStage >= 0 && index <= currentStage;
        return (
          <li key={stage.status} className="relative text-center">
            {index < deliveryStages.length - 1 && <span className={`absolute left-1/2 top-4 h-0.5 w-full ${complete && index < currentStage ? "bg-emerald-400" : "bg-slate-200"}`} aria-hidden="true" />}
            <span className={`relative mx-auto grid h-8 w-8 place-items-center rounded-full ${complete ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"}`}><Icon className="h-4 w-4" /></span>
            <span className={`mt-2 block text-[10px] font-semibold leading-tight sm:text-xs ${complete ? "text-emerald-800" : "text-slate-400"}`}>{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function OrderCard({ item, onCancel, tracked = false }) {
  const medicineName = item.medicineId?.medicineName || "Medicine request";
  const pharmacyName = item.pharmacyId?.pharmacyName || item.pharmacyId?.name || "Pharmacy";
  const total = item.unitPrice == null ? null : Number(item.unitPrice) * Number(item.requestedQuantity);
  const isDelivery = item.fulfillmentType === "DELIVERY";
  const statusColor = item.status === "DELIVERED" || item.status === "FULFILLED"
    ? "bg-emerald-100 text-emerald-800"
    : ["REJECTED", "CANCELLED"].includes(item.status) ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800";
  return (
    <article className="rounded-2xl border border-white/80 bg-white p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-100 to-cyan-100 text-medical-700"><Pill className="h-5 w-5" /></span>
          <div>
            <h2 className="font-bold text-slate-900">{medicineName} <span className="font-medium text-slate-500">· Qty {item.requestedQuantity}</span></h2>
            <p className="mt-1 text-sm text-slate-500">{pharmacyName} · {isDelivery ? "Home delivery" : "Pickup"}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${statusColor}`}>{item.status?.replaceAll("_", " ").toLowerCase()}</span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
        <span>Placed {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "—"}</span>
        {total != null && <span>Medicine total ₹{total.toFixed(2)} <span className="text-xs">(delivery fee not included)</span></span>}
      </div>
      {isDelivery && item.deliveryAddress && <p className="mt-3 flex items-start gap-2 text-sm text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-medical-600" />{item.deliveryAddress.line1}{item.deliveryAddress.line2 ? `, ${item.deliveryAddress.line2}` : ""}, {item.deliveryAddress.city}, {item.deliveryAddress.state} {item.deliveryAddress.pincode}</p>}
      {tracked && isDelivery && ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(item.status) && <DeliveryProgress status={item.status} />}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
        {isDelivery && <Link to="/customer/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-medical-700 hover:text-medical-600">Track order <ArrowRight className="h-4 w-4" /></Link>}
        <Link to={`/search?q=${encodeURIComponent(medicineName)}`} className="inline-flex items-center gap-1 text-sm font-semibold text-slate-600 hover:text-medical-700"><RefreshCw className="h-3.5 w-3.5" /> Find again</Link>
        {["PENDING", "ACCEPTED"].includes(item.status) && <button onClick={() => onCancel(item._id)} className="ml-auto inline-flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-700"><XCircle className="h-4 w-4" /> Cancel request</button>}
      </div>
    </article>
  );
}

export function CustomerDashboard() {
  const location = useLocation();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  async function loadDashboard() {
    setLoading(true);
    try {
      const [requestResponse, notificationResponse] = await Promise.all([api.get("/requests/my"), api.get("/notifications")]);
      setRequests(requestResponse.data.data);
      setNotifications(notificationResponse.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load your customer dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboard(); }, []);

  const filteredRequests = useMemo(() => requests.filter((item) => {
    const active = ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"].includes(item.status);
    const completed = ["DELIVERED", "FULFILLED"].includes(item.status);
    const matchesFilter = filter === "ALL" || (filter === "ACTIVE" && active) || (filter === "COMPLETED" && completed) || (filter === "CLOSED" && !active && !completed);
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || [item.medicineId?.medicineName, item.pharmacyId?.pharmacyName, item.pharmacyId?.name, item.status].some((value) => value?.toLowerCase().includes(query));
    return matchesFilter && matchesSearch;
  }), [requests, filter, search]);

  const activeOrders = requests.filter((item) => ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY"].includes(item.status));
  const trackedDeliveries = requests.filter((item) => item.fulfillmentType === "DELIVERY" && ["PENDING", "ACCEPTED", "PREPARING", "OUT_FOR_DELIVERY", "DELIVERED"].includes(item.status));
  const section = location.pathname.includes("notifications") ? "notifications"
    : location.pathname.includes("requests") ? "requests"
      : location.pathname.includes("orders") ? "orders" : "overview";
  const title = { overview: "Your health, made simpler", requests: "Your requests", orders: "Track your orders", notifications: "Notifications" }[section];

  async function cancelRequest(id) {
    try {
      await api.patch(`/requests/${id}/cancel`);
      setRequests((items) => items.map((item) => item._id === id ? { ...item, status: "CANCELLED" } : item));
      toast.success("Request cancelled");
    } catch (error) { toast.error(error.response?.data?.message || "Unable to cancel request"); }
  }

  async function markRead(id) {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((items) => items.map((item) => item._id === id ? { ...item, isRead: true } : item));
    } catch (error) { toast.error(error.response?.data?.message || "Unable to update notification"); }
  }

  return (
    <Shell title={title} links={[
      { to: "/customer", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      { to: "/customer/orders", label: "Track orders", icon: <Truck className="h-4 w-4" /> },
      { to: "/customer/requests", label: "My requests", icon: <ClipboardList className="h-4 w-4" /> },
      { to: "/customer/notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> }
    ]}>
      {section === "overview" && <>
        <section className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 p-6 text-white shadow-xl shadow-emerald-900/15 sm:p-8">
          <Sparkles className="absolute -right-4 -top-5 h-40 w-40 text-white/10" />
          <div className="relative max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-100">Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : " back"}</p>
            <h2 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Your wellness journey, all in one place.</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50">Find trusted local pharmacies, keep an eye on delivery progress, and stay on top of your medicine requests.</p>
            <Link to="/search" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-emerald-800 shadow-lg transition hover:bg-emerald-50">Find medicine <Search className="h-4 w-4" /></Link>
          </div>
        </section>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Active requests", value: activeOrders.length, icon: <Activity className="h-5 w-5" />, color: "from-violet-500 to-indigo-500" },
            { label: "Orders to track", value: trackedDeliveries.filter((item) => item.status !== "DELIVERED").length, icon: <Truck className="h-5 w-5" />, color: "from-cyan-500 to-blue-500" },
            { label: "Unread updates", value: notifications.filter((item) => !item.isRead).length, icon: <Bell className="h-5 w-5" />, color: "from-amber-500 to-orange-500" }
          ].map((item) => <article key={item.label} className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white p-4 shadow-soft">
            <span className={`grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br ${item.color} text-white shadow-lg`}>{item.icon}</span>
            <div><p className="text-sm text-slate-500">{item.label}</p><p className="text-2xl font-bold text-slate-900">{item.value}</p></div>
          </article>)}
        </div>
        <section className="mb-6 grid gap-3 sm:grid-cols-2">
          <Link to="/customer/orders" className="group flex items-center justify-between rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-blue-50 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
            <span className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-600 text-white"><Truck className="h-5 w-5" /></span><span><strong className="block text-slate-900">Track a delivery</strong><span className="text-sm text-slate-500">See each order’s latest status</span></span></span><ArrowRight className="h-5 w-5 text-cyan-700 transition group-hover:translate-x-1" />
          </Link>
          <Link to="/customer/notifications" className="group flex items-center justify-between rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 p-5 transition hover:-translate-y-0.5 hover:shadow-soft">
            <span className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-orange-500 text-white"><Bell className="h-5 w-5" /></span><span><strong className="block text-slate-900">Your updates</strong><span className="text-sm text-slate-500">{notifications.filter((item) => !item.isRead).length} new notification{notifications.filter((item) => !item.isRead).length === 1 ? "" : "s"}</span></span></span><ArrowRight className="h-5 w-5 text-orange-700 transition group-hover:translate-x-1" />
          </Link>
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">Recent activity</h2><Link to="/customer/requests" className="text-sm font-semibold text-medical-700 hover:underline">View all requests</Link></div>
          {loading ? <div className="rounded-2xl bg-white p-6 text-sm text-slate-500">Loading your requests…</div>
            : requests.length ? <div className="grid gap-3">{requests.slice(0, 3).map((item) => <OrderCard key={item._id} item={item} onCancel={cancelRequest} />)}</div>
              : <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/80 p-8 text-center"><Pill className="mx-auto h-8 w-8 text-emerald-500" /><p className="mt-3 font-semibold text-slate-800">Your medicine journey starts here</p><p className="mt-1 text-sm text-slate-500">Search local pharmacy stock and place your first request.</p><Link to="/search" className="mt-4 inline-flex rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white">Explore medicines</Link></div>}
        </section>
      </>}
      {section === "notifications" && <div className="grid gap-3">
        {notifications.map((item) => <article key={item._id} className={`rounded-2xl border bg-white p-5 shadow-soft ${item.isRead ? "border-slate-100" : "border-emerald-200"}`}>
          <div className="flex items-start justify-between"><div><h2 className="font-bold">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.message}</p></div>{!item.isRead && <button onClick={() => markRead(item._id)} className="text-sm font-semibold text-medical-700">Mark read</button>}</div>
          <p className="mt-3 text-xs text-slate-400">{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</p>
        </article>)}
        {!notifications.length && !loading && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center"><Bell className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">You’re all caught up</p><p className="mt-1 text-sm text-slate-500">Order and pharmacy updates will show up here.</p></div>}
      </div>}
      {(section === "requests" || section === "orders") && <>
        {section === "orders" && <div className="mb-5 rounded-2xl border border-cyan-100 bg-gradient-to-r from-cyan-50 to-emerald-50 p-5"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-600 text-white"><Truck className="h-5 w-5" /></span><div><h2 className="font-bold text-slate-900">Order progress</h2><p className="text-sm text-slate-600">See the latest status shared by your pharmacy. Refresh to check for updates.</p></div></div></div>}
        {section === "requests" && <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-white/80 bg-white p-4 shadow-soft sm:flex-row">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search medicine or pharmacy" className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-medical-500" /></label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)} aria-label="Filter requests" className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"><option value="ALL">All requests</option><option value="ACTIVE">In progress</option><option value="COMPLETED">Completed</option><option value="CLOSED">Cancelled or declined</option></select>
          <button onClick={loadDashboard} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>}
        {section === "orders" && <div className="mb-5 flex justify-end"><button onClick={loadDashboard} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh tracking</button></div>}
        {loading ? <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">Loading your requests…</div>
          : <div className="grid gap-3">{(section === "orders" ? trackedDeliveries : filteredRequests).map((item) => <OrderCard key={item._id} item={item} onCancel={cancelRequest} tracked={section === "orders"} />)}
            {(section === "orders" ? trackedDeliveries : filteredRequests).length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center"><ClipboardList className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold text-slate-800">{section === "orders" ? "No delivery orders to track yet" : "No requests match your search"}</p><p className="mt-1 text-sm text-slate-500">{section === "orders" ? "Choose home delivery when ordering to see progress here." : "Try another search or filter, or browse nearby medicine stock."}</p><Link to="/search" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white">Find medicine <ArrowRight className="h-4 w-4" /></Link></div>}
          </div>}
      </>}
    </Shell>
  );
}

export function AdminDashboard() {
  const location = useLocation();
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [pharmacies, setPharmacies] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [reports, setReports] = useState({});
  const [userQuery, setUserQuery] = useState("");
  const [userRole, setUserRole] = useState("");
  const [userStatus, setUserStatus] = useState("");
  const [adminForm, setAdminForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [pharmacyQuery, setPharmacyQuery] = useState("");
  const [pharmacyStatus, setPharmacyStatus] = useState("");
  const [medicineQuery, setMedicineQuery] = useState("");
  const [medicineForm, setMedicineForm] = useState({
    medicineName: "", genericName: "", brandName: "", strength: "", dosageForm: "",
    manufacturer: "", description: "", prescriptionRequired: false
  });
  const [editingMedicineId, setEditingMedicineId] = useState(null);

  async function loadUsers() {
    const params = new URLSearchParams();
    if (userQuery) params.set("q", userQuery);
    if (userRole) params.set("role", userRole);
    if (userStatus) params.set("status", userStatus);
    try {
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load users");
    }
  }

  async function loadPharmacies() {
    const params = new URLSearchParams();
    if (pharmacyQuery) params.set("q", pharmacyQuery);
    if (pharmacyStatus) params.set("status", pharmacyStatus);
    try {
      const { data } = await api.get(`/admin/pharmacies?${params}`);
      setPharmacies(data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load pharmacies");
    }
  }

  async function loadMedicines() {
    try {
      const { data } = await api.get(`/medicines?limit=50${medicineQuery ? `&q=${encodeURIComponent(medicineQuery)}` : ""}`);
      setMedicines(data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load medicines");
    }
  }

  useEffect(() => {
    api.get("/admin/dashboard").then(({ data }) => setStats(data.data)).catch(() => {});
    if (location.pathname.includes("/users")) loadUsers();
    if (location.pathname.includes("/pharmacies")) loadPharmacies();
    if (location.pathname.includes("/medicines")) loadMedicines();
    if (location.pathname.includes("/reports")) api.get("/admin/reports").then(({ data }) => setReports(data.data)).catch(() => {});
  }, [location.pathname]);

  async function verify(id, verificationStatus) {
    try {
      await api.patch(`/pharmacies/${id}/verify`, { verificationStatus });
      setPharmacies((items) => items.map((item) => item._id === id ? { ...item, verificationStatus } : item));
      toast.success(`Pharmacy ${verificationStatus.toLowerCase()}`);
    } catch (error) { toast.error(error.response?.data?.message || "Unable to verify pharmacy"); }
  }

  async function setUserStatusAction(id, isActive) {
    try {
      await api.patch(`/admin/users/${id}/status`, { isActive });
      setUsers((items) => items.map((item) => item._id === id ? { ...item, isActive } : item));
      toast.success(isActive ? "User activated" : "User suspended");
    } catch (error) { toast.error(error.response?.data?.message || "Unable to update user"); }
  }

  async function createAdmin(event) {
    event.preventDefault();
    try {
      await api.post("/admin/users/admin", adminForm);
      setAdminForm({ name: "", email: "", phone: "", password: "" });
      toast.success("Administrator account created");
      loadUsers();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create administrator");
    }
  }

  function editMedicine(item) {
    setEditingMedicineId(item._id);
    setMedicineForm({
      medicineName: item.medicineName || "", genericName: item.genericName || "",
      brandName: item.brandName || "", strength: item.strength || "",
      dosageForm: item.dosageForm || "", manufacturer: item.manufacturer || "",
      description: item.description || "", prescriptionRequired: Boolean(item.prescriptionRequired)
    });
  }

  function resetMedicineForm() {
    setEditingMedicineId(null);
    setMedicineForm({
      medicineName: "", genericName: "", brandName: "", strength: "", dosageForm: "",
      manufacturer: "", description: "", prescriptionRequired: false
    });
  }

  async function saveMedicine(event) {
    event.preventDefault();
    try {
      if (editingMedicineId) {
        await api.put(`/medicines/${editingMedicineId}`, medicineForm);
        toast.success("Medicine updated");
      } else {
        await api.post("/medicines", medicineForm);
        toast.success("Medicine added");
      }
      resetMedicineForm();
      loadMedicines();
    } catch (error) { toast.error(error.response?.data?.message || "Unable to save medicine"); }
  }

  async function deleteMedicine(id) {
    if (!window.confirm("Delete this medicine?")) return;
    try {
      await api.delete(`/medicines/${id}`);
      setMedicines((items) => items.filter((item) => item._id !== id));
      toast.success("Medicine deleted");
    } catch (error) { toast.error(error.response?.data?.message || "Unable to delete medicine"); }
  }

  const title = location.pathname.includes("/users") ? "User management"
    : location.pathname.includes("/pharmacies") ? "Pharmacy verification"
      : location.pathname.includes("/medicines") ? "Medicine catalogue"
        : location.pathname.includes("/reports") ? "Reports and analytics"
          : "Admin dashboard";

  return (
    <Shell title={title} links={[
      { to: "/admin", label: "Overview", icon: <LayoutDashboard className="h-4 w-4" /> },
      { to: "/admin/users", label: "Users", icon: <Users className="h-4 w-4" /> },
      { to: "/admin/pharmacies", label: "Pharmacies", icon: <Building2 className="h-4 w-4" /> },
      { to: "/admin/medicines", label: "Medicine catalogue", icon: <Pill className="h-4 w-4" /> },
      { to: "/admin/reports", label: "Reports", icon: <BarChart3 className="h-4 w-4" /> }
    ]}>
      {location.pathname.includes("/users") ? (
        <div className="space-y-4">
          <form onSubmit={createAdmin} className="rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="font-bold">Create administrator</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Grant another person full access to the admin panel.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <input required maxLength={100} value={adminForm.name} onChange={(e) => setAdminForm((form) => ({ ...form, name: e.target.value }))} placeholder="Full name" className="rounded-lg border border-slate-200 px-3 py-2" />
              <input required type="email" value={adminForm.email} onChange={(e) => setAdminForm((form) => ({ ...form, email: e.target.value }))} placeholder="Email address" className="rounded-lg border border-slate-200 px-3 py-2" />
              <input maxLength={20} value={adminForm.phone} onChange={(e) => setAdminForm((form) => ({ ...form, phone: e.target.value }))} placeholder="Phone (optional)" className="rounded-lg border border-slate-200 px-3 py-2" />
              <input required type="password" minLength={8} autoComplete="new-password" value={adminForm.password} onChange={(e) => setAdminForm((form) => ({ ...form, password: e.target.value }))} placeholder="Temporary password (8+ chars)" className="rounded-lg border border-slate-200 px-3 py-2" />
            </div>
            <button type="submit" className="mt-4 rounded-lg bg-medical-600 px-4 py-2 text-sm font-bold text-white">Create admin account</button>
          </form>
          <div className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={userQuery} onChange={(e) => setUserQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadUsers()} placeholder="Search name or email" className="w-full py-2 outline-none" /></div>
            <select value={userRole} onChange={(e) => setUserRole(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2"><option value="">All roles</option><option>CUSTOMER</option><option>PHARMACY</option><option>STAFF</option><option>ADMIN</option></select>
            <select value={userStatus} onChange={(e) => setUserStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2"><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
            <button onClick={loadUsers} className="rounded-lg bg-medical-600 px-4 py-2 text-sm font-bold text-white">Filter</button>
          </div>
          <div className="overflow-hidden rounded-2xl bg-white shadow-soft">
            {users.map((item) => (
              <article key={item._id} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 last:border-0">
                <div><h2 className="font-bold">{item.name}</h2><p className="text-sm text-slate-500">{item.email}</p></div>
                <div className="flex items-center gap-3"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{item.role}</span><span className={`text-sm font-bold ${item.isActive ? "text-medical-700" : "text-red-600"}`}>{item.isActive ? "Active" : "Suspended"}</span>{item.role !== "ADMIN" && <button onClick={() => setUserStatusAction(item._id, !item.isActive)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${item.isActive ? "border border-red-200 text-red-600" : "border border-medical-200 text-medical-700"}`}>{item.isActive ? "Suspend" : "Activate"}</button>}</div>
              </article>
            ))}
            {!users.length && <p className="p-8 text-center text-slate-500">No users match the selected filters.</p>}
          </div>
        </div>
      ) : location.pathname.includes("/pharmacies") ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex min-w-52 flex-1 items-center gap-2 rounded-lg border border-slate-200 px-3"><Search className="h-4 w-4 text-slate-400" /><input value={pharmacyQuery} onChange={(e) => setPharmacyQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadPharmacies()} placeholder="Search pharmacy, city or licence" className="w-full py-2 outline-none" /></div>
            <select value={pharmacyStatus} onChange={(e) => setPharmacyStatus(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2"><option value="">All statuses</option><option>PENDING</option><option>APPROVED</option><option>REJECTED</option></select>
            <button onClick={loadPharmacies} className="rounded-lg bg-medical-600 px-4 py-2 text-sm font-bold text-white">Filter</button>
          </div>
          <div className="grid gap-3">{pharmacies.map((item) => (
            <article key={item._id} className="rounded-2xl bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-bold">{item.pharmacyName}</h2><p className="mt-1 text-sm text-slate-500">{item.address}, {item.city} · License: {item.licenseNumber}</p><p className="mt-1 text-sm text-slate-500">Owner: {item.ownerId?.name || "Not linked"} · {item.ownerId?.email || ""}</p></div><span className={`rounded-full px-3 py-1 text-xs font-bold ${item.verificationStatus === "APPROVED" ? "bg-medical-100 text-medical-700" : item.verificationStatus === "REJECTED" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{item.verificationStatus}</span></div>
              <div className="mt-4 flex gap-2">{item.verificationStatus !== "APPROVED" && <button onClick={() => verify(item._id, "APPROVED")} className="rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Approve</button>}{item.verificationStatus !== "REJECTED" && <button onClick={() => verify(item._id, "REJECTED")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600">Reject</button>}</div>
            </article>
          ))}{!pharmacies.length && <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-soft">No pharmacies match the selected filters.</p>}</div>
        </div>
      ) : location.pathname.includes("/medicines") ? (
        <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
          <form onSubmit={saveMedicine} className="h-fit rounded-2xl bg-white p-5 shadow-soft">
            <h2 className="mb-4 font-bold">{editingMedicineId ? "Edit medicine" : "Add medicine"}</h2>
            <div className="grid gap-3">
              {[["medicineName","Medicine name *"],["genericName","Generic name *"],["brandName","Brand name"],["strength","Strength"],["dosageForm","Dosage form"],["manufacturer","Manufacturer"]].map(([field,label]) => <input key={field} required={field==="medicineName" || field==="genericName"} value={medicineForm[field]} onChange={(e) => setMedicineForm((old) => ({...old,[field]:e.target.value}))} placeholder={label} className="rounded-lg border border-slate-200 px-3 py-2" />)}
              <textarea value={medicineForm.description} onChange={(e) => setMedicineForm((old) => ({...old,description:e.target.value}))} placeholder="Description" className="min-h-20 rounded-lg border border-slate-200 px-3 py-2" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={medicineForm.prescriptionRequired} onChange={(e) => setMedicineForm((old) => ({...old,prescriptionRequired:e.target.checked}))} /> Prescription required</label>
              <div className="flex gap-2"><button type="submit" className="rounded-lg bg-medical-600 px-4 py-2 text-sm font-bold text-white">{editingMedicineId ? "Update" : "Add"}</button>{editingMedicineId && <button type="button" onClick={resetMedicineForm} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold">Cancel</button>}</div>
            </div>
          </form>
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 shadow-soft"><Search className="h-4 w-4 text-slate-400" /><input value={medicineQuery} onChange={(e) => setMedicineQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadMedicines()} placeholder="Search medicines" className="w-full py-3 outline-none" /><button onClick={loadMedicines} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">Search</button></div>
            <div className="grid gap-3 md:grid-cols-2">{medicines.map((item) => <article key={item._id} className="rounded-2xl bg-white p-5 shadow-soft"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold">{item.medicineName}</h2><p className="mt-1 text-sm text-slate-500">{item.genericName} · {item.brandName || "No brand"} · {item.strength || "No strength"}</p>{item.prescriptionRequired && <span className="mt-2 inline-block rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">Prescription required</span>}</div><div className="flex gap-2"><button onClick={() => editMedicine(item)} className="text-sm font-bold text-medical-700">Edit</button><button onClick={() => deleteMedicine(item._id)} className="text-sm font-bold text-red-600">Delete</button></div></div></article>)}</div>
          </div>
        </div>
      ) : location.pathname.includes("/reports") ? (
        <div className="space-y-5">
          <StatCards items={[
            { label: "Inventory value", value: `₹${Number(reports.inventoryValue || 0).toFixed(2)}` },
            { label: "Low stock batches", value: reports.lowStock },
            { label: "Near expiry", value: reports.nearExpiryStock },
            { label: "Expired batches", value: reports.expired }
          ]} />
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-3 font-bold">Users by role</h2>{(reports.usersByRole || []).map((item) => <div key={item._id} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{item._id}</span><b>{item.count}</b></div>)}</div>
            <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-3 font-bold">Pharmacy status</h2>{(reports.pharmaciesByStatus || []).map((item) => <div key={item._id} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{item._id}</span><b>{item.count}</b></div>)}</div>
            <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-3 font-bold">Requests by status</h2>{(reports.requestsByStatus || []).map((item) => <div key={item._id} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{item._id}</span><b>{item.count}</b></div>)}</div>
            <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-3 font-bold">Sales by status</h2>{(reports.salesByStatus || []).map((item) => <div key={item._id} className="flex justify-between border-b border-slate-100 py-2 text-sm"><span>{item._id}</span><b>{item.count}</b></div>)}</div>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-3 font-bold">Recent users</h2>{(reports.recentUsers || []).map((item) => <div key={item._id} className="border-b border-slate-100 py-2 text-sm"><b>{item.name}</b><span className="ml-2 text-slate-500">{item.email} · {item.role}</span></div>)}</div>
            <div className="rounded-2xl bg-white p-5 shadow-soft"><h2 className="mb-3 font-bold">Recent pharmacies</h2>{(reports.recentPharmacies || []).map((item) => <div key={item._id} className="border-b border-slate-100 py-2 text-sm"><b>{item.pharmacyName}</b><span className="ml-2 text-slate-500">{item.city} · {item.verificationStatus}</span></div>)}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          <StatCards items={[
            { label: "Registered users", value: stats.users },
            { label: "Active users", value: stats.activeUsers },
            { label: "Suspended users", value: stats.suspendedUsers },
            { label: "Pharmacies", value: stats.pharmacies },
            { label: "Approved pharmacies", value: stats.approvedPharmacies },
            { label: "Pending approvals", value: stats.pendingPharmacies },
            { label: "Medicines", value: stats.medicines },
            { label: "Inventory batches", value: stats.inventory },
            { label: "Requests", value: stats.requests },
            { label: "Pending requests", value: stats.pendingRequests },
            { label: "Out-of-stock batches", value: stats.outOfStock },
            { label: "Expired batches", value: stats.expired }
          ]} />
          <div className="grid gap-4 md:grid-cols-2">
            <Link to="/admin/pharmacies" className="rounded-2xl bg-white p-5 shadow-soft"><ShieldCheck className="mb-3 h-6 w-6 text-medical-600" /><h2 className="font-bold">Pharmacy verification</h2><p className="mt-1 text-sm text-slate-500">{stats.pendingPharmacies ?? 0} pharmacies awaiting approval.</p></Link>
            <Link to="/admin/medicines" className="rounded-2xl bg-white p-5 shadow-soft"><Pill className="mb-3 h-6 w-6 text-medical-600" /><h2 className="font-bold">Medicine catalogue</h2><p className="mt-1 text-sm text-slate-500">Add, edit or remove catalogue records.</p></Link>
          </div>
        </div>
      )}
    </Shell>
  );
}
