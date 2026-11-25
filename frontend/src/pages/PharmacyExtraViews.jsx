import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../services/api";

const inputClass = "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-medical-500";
const labelClass = "grid gap-1.5 text-sm font-semibold text-slate-700";

export function ProcurementView() {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", contactName: "", email: "" });
  const [orderForm, setOrderForm] = useState({ supplierId: "", medicineId: "", orderedQuantity: 1, unitCost: "", expectedDeliveryAt: "" });
  const [receiving, setReceiving] = useState(null);
  const [receipt, setReceipt] = useState({ quantity: 1, batchNumber: "", expiryDate: "", sellingPrice: "", reorderLevel: 10 });
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [supplierResult, orderResult, medicineResult] = await Promise.all([
        api.get("/procurement/suppliers"),
        api.get("/procurement/orders"),
        api.get("/medicines", { params: { limit: 50 } })
      ]);
      setSuppliers(supplierResult.data.data);
      setOrders(orderResult.data.data);
      setMedicines(medicineResult.data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to load procurement data");
    }
  }
  useEffect(() => { load(); }, []);

  async function addSupplier(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/procurement/suppliers", supplierForm);
      setSupplierForm({ name: "", phone: "", contactName: "", email: "" });
      toast.success("Supplier added");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to add supplier");
    } finally { setBusy(false); }
  }

  async function createOrder(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/procurement/orders", {
        supplierId: orderForm.supplierId,
        expectedDeliveryAt: orderForm.expectedDeliveryAt || undefined,
        lines: [{ medicineId: orderForm.medicineId, orderedQuantity: Number(orderForm.orderedQuantity), unitCost: Number(orderForm.unitCost) }]
      });
      toast.success("Purchase order created");
      setOrderForm({ supplierId: "", medicineId: "", orderedQuantity: 1, unitCost: "", expectedDeliveryAt: "" });
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create purchase order");
    } finally { setBusy(false); }
  }

  async function setOrderStatus(order, status) {
    try {
      await api.patch(`/procurement/orders/${order._id}/status`, { status });
      toast.success(`Purchase order marked ${status.toLowerCase()}`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update purchase order");
    }
  }

  function openReceive(order, previousReceipt) {
    const line = previousReceipt
      ? order.lines.find((item) => String(item.medicineId?._id || item.medicineId) === String(previousReceipt.medicineId?._id || previousReceipt.medicineId))
      : order.lines.find((item) => item.receivedQuantity + (item.pendingQuantity || 0) < item.orderedQuantity);
    if (!line) return toast.error("There are no outstanding order lines");
    setReceiving({ order, line, receiptId: previousReceipt?.receiptId || globalThis.crypto?.randomUUID?.() || `receipt-${Date.now()}-${Math.random()}` });
    setReceipt({
      quantity: previousReceipt?.quantity || line.orderedQuantity - line.receivedQuantity - (line.pendingQuantity || 0),
      batchNumber: previousReceipt?.batchNumber || "",
      expiryDate: previousReceipt?.expiryDate ? new Date(previousReceipt.expiryDate).toISOString().slice(0, 10) : "",
      sellingPrice: previousReceipt?.sellingPrice ?? "",
      reorderLevel: previousReceipt?.reorderLevel ?? 10
    });
  }

  async function receive(event) {
    event.preventDefault();
    if (!receiving) return;
    setBusy(true);
    try {
      await api.post(`/procurement/orders/${receiving.order._id}/receive`, {
        receiptId: receiving.receiptId,
        items: [{
          medicineId: receiving.line.medicineId._id || receiving.line.medicineId,
          quantity: Number(receipt.quantity),
          batchNumber: receipt.batchNumber,
          expiryDate: receipt.expiryDate,
          sellingPrice: Number(receipt.sellingPrice),
          reorderLevel: Number(receipt.reorderLevel)
        }]
      });
      toast.success("Received stock added to batch inventory");
      setReceiving(null);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to receive stock");
    } finally { setBusy(false); }
  }

  async function toggleSupplier(supplier) {
    try {
      await api.put(`/procurement/suppliers/${supplier._id}`, { isActive: !supplier.isActive });
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update supplier");
    }
  }

  return <div className="grid gap-6">
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <h2 className="font-bold">Suppliers</h2>
      <form onSubmit={addSupplier} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>Supplier name<input required value={supplierForm.name} onChange={(e) => setSupplierForm({ ...supplierForm, name: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Contact person<input value={supplierForm.contactName} onChange={(e) => setSupplierForm({ ...supplierForm, contactName: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Phone<input required type="tel" value={supplierForm.phone} onChange={(e) => setSupplierForm({ ...supplierForm, phone: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Email<input type="email" value={supplierForm.email} onChange={(e) => setSupplierForm({ ...supplierForm, email: e.target.value })} className={inputClass} /></label>
        <button disabled={busy} className="w-fit rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">Add supplier</button>
      </form>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">{suppliers.map((supplier) => <div key={supplier._id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3">
        <div><p className="font-semibold">{supplier.name}</p><p className="text-xs text-slate-500">{supplier.contactName || supplier.phone} · {supplier.isActive ? "Active" : "Inactive"}</p></div>
        <button onClick={() => toggleSupplier(supplier)} className="text-xs font-semibold text-medical-700">{supplier.isActive ? "Deactivate" : "Activate"}</button>
      </div>)}</div>
    </section>

    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <h2 className="font-bold">Create purchase order</h2>
      <form onSubmit={createOrder} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>Supplier<select required value={orderForm.supplierId} onChange={(e) => setOrderForm({ ...orderForm, supplierId: e.target.value })} className={inputClass}><option value="">Select supplier</option>{suppliers.filter((s) => s.isActive).map((supplier) => <option key={supplier._id} value={supplier._id}>{supplier.name}</option>)}</select></label>
        <label className={labelClass}>Medicine<select required value={orderForm.medicineId} onChange={(e) => setOrderForm({ ...orderForm, medicineId: e.target.value })} className={inputClass}><option value="">Select medicine</option>{medicines.map((medicine) => <option key={medicine._id} value={medicine._id}>{medicine.medicineName} · {medicine.strength || "—"}</option>)}</select></label>
        <label className={labelClass}>Order quantity<input required type="number" min="1" step="1" value={orderForm.orderedQuantity} onChange={(e) => setOrderForm({ ...orderForm, orderedQuantity: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Unit cost<input required type="number" min="0" step="0.01" value={orderForm.unitCost} onChange={(e) => setOrderForm({ ...orderForm, unitCost: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Expected delivery<input type="date" value={orderForm.expectedDeliveryAt} onChange={(e) => setOrderForm({ ...orderForm, expectedDeliveryAt: e.target.value })} className={inputClass} /></label>
        <button disabled={busy || !suppliers.some((supplier) => supplier.isActive)} className="mt-auto w-fit rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Create draft order</button>
      </form>
    </section>

    <section className="grid gap-3">
      <h2 className="font-bold">Purchase orders</h2>
      {orders.length ? orders.map((order) => <article key={order._id} className="rounded-2xl bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="font-bold">{order.orderNumber} · {order.supplierId?.name}</p>          <p className="mt-1 text-sm text-slate-600">{order.lines.map((line) => `${line.medicineId?.medicineName || "Medicine"}: ${line.receivedQuantity}/${line.orderedQuantity} received${line.pendingQuantity ? ` · ${line.pendingQuantity} processing` : ""}`).join(" · ")}</p><p className="mt-1 text-xs text-slate-500">Created {new Date(order.createdAt).toLocaleDateString()} · {order.status}</p></div>
          <div className="flex flex-wrap gap-2">
            {order.status === "DRAFT" && <button onClick={() => setOrderStatus(order, "ORDERED")} className="rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Mark ordered</button>}
            {order.receipts?.some((receipt) => receipt.status === "PROCESSING") && <button onClick={() => openReceive(order, order.receipts.find((receipt) => receipt.status === "PROCESSING"))} className="rounded-lg border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800">Resume receipt</button>}
            {["ORDERED", "PARTIALLY_RECEIVED"].includes(order.status) && <button onClick={() => openReceive(order)} className="rounded-lg bg-medical-600 px-3 py-2 text-sm font-semibold text-white">Receive stock</button>}
            {["DRAFT", "ORDERED"].includes(order.status) && <button onClick={() => setOrderStatus(order, "CANCELLED")} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700">Cancel</button>}
          </div>
        </div>
      </article>) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No purchase orders yet.</p>}
    </section>

    {receiving && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
      <form onSubmit={receive} className="grid w-full max-w-lg gap-4 rounded-2xl bg-white p-6 shadow-xl">
        <div><h2 className="text-lg font-bold">Receive {receiving.line.medicineId?.medicineName || "medicine"}</h2><p className="mt-1 text-sm text-slate-500">{receiving.order.orderNumber} · {receiving.line.orderedQuantity - receiving.line.receivedQuantity} unit(s) outstanding</p></div>
        <label className={labelClass}>Quantity received<input required type="number" min="1" max={receiving.line.orderedQuantity - receiving.line.receivedQuantity} value={receipt.quantity} onChange={(e) => setReceipt({ ...receipt, quantity: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Batch number<input required value={receipt.batchNumber} onChange={(e) => setReceipt({ ...receipt, batchNumber: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Expiry date<input required type="date" value={receipt.expiryDate} onChange={(e) => setReceipt({ ...receipt, expiryDate: e.target.value })} className={inputClass} /></label>
        <label className={labelClass}>Selling unit price<input required type="number" min="0" step="0.01" value={receipt.sellingPrice} onChange={(e) => setReceipt({ ...receipt, sellingPrice: e.target.value })} className={inputClass} /></label>
        <div className="flex gap-2"><button disabled={busy} className="rounded-xl bg-medical-600 px-4 py-2.5 font-semibold text-white">Receive stock</button><button type="button" onClick={() => setReceiving(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-semibold">Cancel</button></div>
      </form>
    </div>}
  </div>;
}

export function POSView() {
  const [inventory, setInventory] = useState([]);
  const [sales, setSales] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [busy, setBusy] = useState(false);
  const [invoice, setInvoice] = useState(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => globalThis.crypto?.randomUUID?.() || `sale-${Date.now()}-${Math.random()}`);

  async function load() {
    try {
      const [stockResponse, salesResponse] = await Promise.all([api.get("/inventory/my"), api.get("/pos/sales")]);
      setInventory(stockResponse.data.data);
      setSales(salesResponse.data.data);
    } catch (error) { toast.error(error.response?.data?.message || "Unable to load counter sales"); }
  }
  useEffect(() => { load(); }, []);

  const sellable = useMemo(() => inventory.filter((item) => Number(item.quantity) > 0 && new Date(item.expiryDate) > new Date()), [inventory]);
  const total = cart.reduce((sum, line) => sum + line.quantity * line.price, 0);

  function addToCart() {
    const item = sellable.find((entry) => entry._id === selectedId);
    const amount = Number(quantity);
    if (!item || !Number.isInteger(amount) || amount < 1) return toast.error("Select an available batch and quantity");
    const existing = cart.find((line) => line.inventoryId === item._id);
    const combined = (existing?.quantity || 0) + amount;
    if (combined > item.quantity) return toast.error("Quantity exceeds this batch's available stock");
    setCart(existing
      ? cart.map((line) => line.inventoryId === item._id ? { ...line, quantity: combined } : line)
      : [...cart, { inventoryId: item._id, name: item.medicineId?.medicineName, batchNumber: item.batchNumber, price: item.price, available: item.quantity, quantity: amount }]);
  }

  async function checkout(event) {
    event.preventDefault();
    if (!cart.length) return toast.error("Add at least one item to the sale");
    setBusy(true);
    try {
      const result = await api.post("/pos/sales", {
        customerName,
        customerPhone,
        paymentMethod,
        idempotencyKey,
        items: cart.map((line) => ({ inventoryId: line.inventoryId, quantity: line.quantity }))
      });
      setInvoice(result.data.data);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setIdempotencyKey(globalThis.crypto?.randomUUID?.() || `sale-${Date.now()}-${Math.random()}`);
      toast.success(`Invoice ${result.data.data.invoiceNumber} recorded`);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Sale was not completed");
      if (error.response?.status === 409) setIdempotencyKey(globalThis.crypto?.randomUUID?.() || `sale-${Date.now()}-${Math.random()}`);
    } finally { setBusy(false); }
  }

  return <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)]">
    <section className="rounded-2xl bg-white p-5 shadow-soft">
      <h2 className="font-bold">Counter sale</h2>
      <p className="mt-1 text-xs text-slate-500">Records an invoice and deducts the selected unexpired batch. No payment is processed and no card details are stored.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_110px_auto]">
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className={inputClass}><option value="">Select medicine batch</option>{sellable.map((item) => <option key={item._id} value={item._id}>{item.medicineId?.medicineName} · {item.batchNumber} · {item.quantity} available · ₹{item.price}</option>)}</select>
        <input aria-label="Sale quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
        <button type="button" onClick={addToCart} className="rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white">Add item</button>
      </div>
      <div className="mt-4 grid gap-2">{cart.map((line) => <div key={line.inventoryId} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3">
        <div><p className="font-semibold">{line.name}</p><p className="text-xs text-slate-500">Batch {line.batchNumber} · {line.quantity} × ₹{Number(line.price).toFixed(2)}</p></div>
        <div className="flex items-center gap-3"><strong>₹{(line.quantity * line.price).toFixed(2)}</strong><button onClick={() => setCart(cart.filter((item) => item.inventoryId !== line.inventoryId))} className="text-xs font-semibold text-red-600">Remove</button></div>
      </div>)}</div>
      <form onSubmit={checkout} className="mt-5 grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <label className={labelClass}>Customer name (optional)<input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Customer phone (optional)<input type="tel" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} /></label>
        <label className={labelClass}>Tender type<select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputClass}><option value="CASH">Cash</option><option value="CARD">Card (record only)</option><option value="UPI">UPI (record only)</option><option value="OTHER">Other</option></select></label>
        <div className="flex items-end justify-between gap-3"><div><p className="text-sm text-slate-500">Invoice total</p><p className="text-xl font-bold">₹{total.toFixed(2)}</p></div><button disabled={busy || !cart.length} className="rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Recording…" : "Complete sale"}</button></div>
      </form>
    </section>
    <div className="grid content-start gap-5">
      {invoice && <section className="rounded-2xl border border-medical-100 bg-white p-5 shadow-soft">
        <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-medical-700">Sale recorded</p><h2 className="mt-1 font-bold">{invoice.invoiceNumber}</h2></div><button onClick={() => window.print()} className="text-sm font-semibold text-medical-700">Print</button></div>
        <p className="mt-3 text-sm text-slate-500">{new Date(invoice.createdAt).toLocaleString()} · {invoice.paymentMethod} tender recorded</p>
        <div className="mt-3 border-t border-slate-100 pt-3">{invoice.lines.map((line) => <div key={line.inventoryId} className="flex justify-between gap-2 py-1 text-sm"><span>{line.medicineId?.medicineName} × {line.quantity}</span><span>₹{Number(line.lineTotal).toFixed(2)}</span></div>)}</div>
        <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 font-bold"><span>Total</span><span>₹{Number(invoice.subtotal).toFixed(2)}</span></div>
      </section>}
      <section className="rounded-2xl bg-white p-5 shadow-soft">
        <h2 className="font-bold">Recent invoices</h2>
        <div className="mt-3 grid gap-2">{sales.slice(0, 8).map((sale) => <button key={sale._id} onClick={() => setInvoice(sale)} className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 p-3 text-left hover:bg-slate-50"><span><span className="block font-semibold">{sale.invoiceNumber}</span><span className="text-xs text-slate-500">{new Date(sale.createdAt).toLocaleString()}</span></span><strong>₹{Number(sale.subtotal).toFixed(2)}</strong></button>)}</div>
      </section>
    </div>
  </div>;
}

const prescriptionTransitions = {
  RECEIVED: ["UNDER_REVIEW", "CANCELLED"],
  UNDER_REVIEW: ["READY_FOR_PICKUP", "REJECTED", "CANCELLED"],
  READY_FOR_PICKUP: ["COMPLETED", "CANCELLED"]
};

export function PrescriptionView() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ customerName: "", customerPhone: "" });
  const [busy, setBusy] = useState(false);
  async function load() {
    try { setItems((await api.get("/prescriptions")).data.data); }
    catch (error) { toast.error(error.response?.data?.message || "Unable to load prescription workflow"); }
  }
  useEffect(() => { load(); }, []);

  async function create(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/prescriptions", form);
      setForm({ customerName: "", customerPhone: "" });
      toast.success("Prescription handover logged");
      await load();
    } catch (error) { toast.error(error.response?.data?.message || "Unable to log intake"); }
    finally { setBusy(false); }
  }

  async function changeStatus(item, status) {
    try {
      await api.patch(`/prescriptions/${item._id}/status`, { status });
      toast.success(`Workflow moved to ${status.toLowerCase().replaceAll("_", " ")}`);
      await load();
    } catch (error) { toast.error(error.response?.data?.message || "Unable to update workflow"); }
  }

  return <div className="grid gap-5">
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Workflow tracking only: Medifind does not upload or store prescription images, record medication details, verify clinical appropriateness, or make dispensing decisions. Follow your pharmacy’s approved procedures.</div>
    <form onSubmit={create} className="grid gap-3 rounded-2xl bg-white p-5 shadow-soft sm:grid-cols-[1fr_1fr_auto]">
      <label className={labelClass}>Customer name<input required maxLength={120} value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className={inputClass} /></label>
      <label className={labelClass}>Customer phone<input required type="tel" maxLength={20} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} className={inputClass} /></label>
      <button disabled={busy} className="mt-auto rounded-xl bg-medical-600 px-4 py-2.5 text-sm font-semibold text-white">{busy ? "Saving…" : "Log prescription handover"}</button>
    </form>
    <div className="grid gap-3">{items.length ? items.map((item) => <article key={item._id} className="rounded-2xl bg-white p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{item.customerName} · {item.reference}</p><p className="mt-1 text-sm text-slate-500">{item.customerPhone} · Received {new Date(item.createdAt).toLocaleString()}</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{item.status.replaceAll("_", " ")}</span></div>
      {item.statusHistory?.length > 1 && <p className="mt-2 text-xs text-slate-500">Last update {new Date(item.statusHistory.at(-1).changedAt).toLocaleString()}</p>}
      <div className="mt-4 flex flex-wrap gap-2">{(prescriptionTransitions[item.status] || []).map((status) => <button key={status} onClick={() => changeStatus(item, status)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${status === "REJECTED" || status === "CANCELLED" ? "border border-red-200 text-red-700" : "bg-medical-600 text-white"}`}>{status.replaceAll("_", " ")}</button>)}</div>
    </article>) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No prescription handovers have been recorded.</p>}</div>
  </div>;
}

const staffPermissions = [
  ["inventory", "Inventory"],
  ["requests", "Availability requests"],
  ["procurement", "Suppliers & purchasing"],
  ["sales", "Counter sales"],
  ["prescriptions", "Prescription workflow"]
];

export function StaffView() {
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", permissions: ["inventory"] });
  const [busy, setBusy] = useState(false);
  async function load() {
    try { setStaff((await api.get("/pharmacies/staff")).data.data); }
    catch (error) { toast.error(error.response?.data?.message || "Unable to load staff"); }
  }
  useEffect(() => { load(); }, []);
  function togglePermission(permission) {
    setForm((current) => ({ ...current, permissions: current.permissions.includes(permission) ? current.permissions.filter((item) => item !== permission) : [...current.permissions, permission] }));
  }
  async function create(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post("/pharmacies/staff", form);
      setForm({ name: "", email: "", phone: "", password: "", permissions: ["inventory"] });
      toast.success("Staff account created");
      await load();
    } catch (error) { toast.error(error.response?.data?.message || "Unable to create staff account"); }
    finally { setBusy(false); }
  }
  async function update(item, patch) {
    try {
      await api.patch(`/pharmacies/staff/${item.id}`, patch);
      toast.success("Staff permissions updated");
      await load();
    } catch (error) { toast.error(error.response?.data?.message || "Unable to update staff account"); }
  }

  return <div className="grid gap-5">
    <form onSubmit={create} className="grid gap-4 rounded-2xl bg-white p-5 shadow-soft md:grid-cols-2">
      <div className="md:col-span-2"><h2 className="font-bold">Create staff account</h2><p className="mt-1 text-sm text-slate-500">Staff get their own login and only the selected pharmacy permissions.</p></div>
      <label className={labelClass}>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} /></label>
      <label className={labelClass}>Email<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} /></label>
      <label className={labelClass}>Phone<input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} /></label>
      <label className={labelClass}>Temporary password<input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={inputClass} /></label>
      <fieldset className="grid gap-2 sm:grid-cols-2 md:col-span-2"><legend className="mb-2 text-sm font-semibold text-slate-700">Permissions</legend>{staffPermissions.map(([permission, label]) => <label key={permission} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />{label}</label>)}</fieldset>
      <button disabled={busy} className="w-fit rounded-xl bg-medical-600 px-4 py-2.5 font-semibold text-white md:col-span-2">{busy ? "Creating…" : "Create account"}</button>
    </form>
    <section className="grid gap-3">
      <h2 className="font-bold">Team members</h2>
      {staff.length ? staff.map((item) => <StaffCard key={item.id} item={item} update={update} />) : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">No staff accounts yet.</p>}
    </section>
  </div>;
}

function StaffCard({ item, update }) {
  const [permissions, setPermissions] = useState(item.permissions.filter((permission) => permission !== "dashboard"));
  return <article className="rounded-2xl bg-white p-5 shadow-soft">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{item.name}</p><p className="text-sm text-slate-500">{item.email} · {item.isActive ? "Active" : "Suspended"}</p></div><button onClick={() => update(item, { isActive: !item.isActive })} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${item.isActive ? "border-red-200 text-red-700" : "border-medical-200 text-medical-700"}`}>{item.isActive ? "Suspend" : "Activate"}</button></div>
    <fieldset className="mt-4 grid gap-2 sm:grid-cols-3">{staffPermissions.map(([permission, label]) => <label key={permission} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={permissions.includes(permission)} onChange={() => setPermissions((current) => current.includes(permission) ? current.filter((value) => value !== permission) : [...current, permission])} />{label}</label>)}</fieldset>
    <button onClick={() => update(item, { permissions })} className="mt-3 rounded-lg bg-medical-50 px-3 py-2 text-sm font-semibold text-medical-700">Save permissions</button>
  </article>;
}
