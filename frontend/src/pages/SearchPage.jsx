import { useState } from "react";
import toast from "react-hot-toast";
import { MapPin, Search, Pill } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

const emptyAddress = { line1: "", line2: "", city: "", state: "", pincode: "", instructions: "" };

export default function SearchPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [query, setQuery] = useState(() => searchParams.get("q") || "");
  const [sort, setSort] = useState("nearest");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [locationAvailable, setLocationAvailable] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [address, setAddress] = useState(emptyAddress);
  const [prescription, setPrescription] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function search(event) {
    event?.preventDefault();
    if (!query.trim()) return toast.error("Enter a medicine name");
    setLoading(true);
    setSearched(true);
    try {
      const params = { q: query.trim(), sort };
      if (navigator.geolocation) {
        const position = await new Promise((resolve) => navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), { timeout: 5000 }));
        if (position) {
          params.latitude = position.coords.latitude;
          params.longitude = position.coords.longitude;
          setLocationAvailable(true);
        } else {
          setLocationAvailable(false);
        }
      }
      const { data } = await api.get("/medicines/search", { params });
      setResults(data.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Search failed");
    } finally {
      setLoading(false);
    }
  }

  function startOrder(item) {
    if (user?.role !== "CUSTOMER") {
      toast.error("Log in with a customer account to place an order");
      return;
    }
    setSelectedOrder(item);
    setQuantity(1);
    setAddress(emptyAddress);
    setPrescription(null);
  }

  async function submitOrder(event) {
    event.preventDefault();
    if (!selectedOrder) return;
    if (quantity > selectedOrder.quantity) return toast.error("The requested quantity exceeds the available stock");
    if (selectedOrder.medicine.prescriptionRequired && !prescription) return toast.error("Upload a valid prescription for this medicine");

    const formData = new FormData();
    formData.append("medicineId", selectedOrder.medicine._id);
    formData.append("pharmacyId", selectedOrder.pharmacy.id);
    formData.append("inventoryId", selectedOrder.inventoryId);
    formData.append("requestedQuantity", String(quantity));
    formData.append("fulfillmentType", "DELIVERY");
    formData.append("deliveryAddress", JSON.stringify(address));
    if (prescription) formData.append("prescription", prescription);

    setSubmitting(true);
    try {
      const { data } = await api.post("/requests", formData, { headers: { "Content-Type": "multipart/form-data" } });
      if (data.warning) toast.error(data.warning);
      else toast.success("Delivery order sent to the pharmacy");
      setSelectedOrder(null);
      navigate("/customer/orders");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to place delivery order");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-100/70 via-slate-50 to-cyan-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <header className="relative mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-700 via-teal-700 to-cyan-800 p-6 text-white shadow-xl shadow-emerald-900/15 sm:p-8">
          <div className="relative max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-100">Availability finder</p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Find the right medicine, close to home.</h1>
            <p className="mt-3 text-sm leading-6 text-emerald-50">Compare verified local pharmacy stock and prices, then send a delivery request directly to your chosen pharmacy.</p>
          </div>
          <Pill className="absolute -bottom-6 -right-2 h-36 w-36 rotate-[-25deg] text-white/10 sm:h-44 sm:w-44" />
        </header>
        <form onSubmit={search} className="flex flex-col gap-3 rounded-2xl border border-white/80 bg-white/90 p-4 shadow-soft backdrop-blur md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Medicine, generic or brand name" className="w-full rounded-xl border border-slate-200 py-3 pl-12 pr-4 outline-none focus:border-medical-500" />
          </div>
          <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3">
            <option value="nearest">Nearest pharmacy</option>
            <option value="price">Lowest price</option>
            <option value="stock">Highest stock</option>
          </select>
          <button disabled={loading} className="rounded-xl bg-medical-600 px-6 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Searching..." : "Search"}</button>
        </form>
        {searched && sort === "nearest" && !locationAvailable && <p className="mt-3 text-sm text-amber-700">Location was unavailable. Search results cannot be sorted by distance until you allow location access.</p>}

        <section className="mt-8">
          {loading && <div className="rounded-2xl bg-white p-8 text-center text-slate-500">Searching approved pharmacy inventory...</div>}
          {!loading && searched && results.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <Pill className="mx-auto h-10 w-10 text-slate-300" />
              <h2 className="mt-3 font-bold text-slate-800">No confirmed stock found</h2>
              <p className="mt-2 text-sm text-slate-500">Try a generic or brand name and check spelling. Demo inventory may be limited.</p>
            </div>
          )}
          {!loading && results.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((item, index) => (
                <article key={`${item.pharmacy.id}-${item.medicine._id}-${index}`} className="rounded-2xl border border-white/80 bg-white p-6 shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{item.medicine.medicineName}</h2>
                      <p className="text-sm text-slate-500">{item.medicine.brandName} · {item.medicine.strength} · {item.medicine.dosageForm}</p>
                    </div>
                    <p className="text-xl font-bold text-medical-700">₹{item.price}<span className="block text-xs font-medium text-slate-500">per unit</span></p>
                  </div>
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h3 className="font-bold text-slate-800">{item.pharmacy.name}</h3>
                    <p className="mt-1 flex gap-1 text-sm text-slate-500"><MapPin className="h-4 w-4 shrink-0" />{item.pharmacy.address}, {item.pharmacy.city}</p>
                    <div className="mt-3 flex justify-between text-sm">
                      <span className="font-semibold text-medical-700">{item.quantity} in stock</span>
                      {item.distance != null && <span>{item.distance} km away</span>}
                    </div>
                    <button onClick={() => startOrder(item)} className="mt-4 w-full rounded-xl bg-medical-600 px-4 py-3 font-semibold text-white hover:bg-medical-700">Order for home delivery</button>
                    {selectedOrder?.inventoryId === item.inventoryId && (
                      <form onSubmit={submitOrder} className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4">
                        <div>
                          <h4 className="font-bold text-slate-800">Delivery details</h4>
                          <p className="text-xs text-slate-500">The pharmacy will review and accept this order before preparing it.</p>
                        </div>
                        <label className="grid gap-1 text-sm font-medium text-slate-700">Quantity
                          <input type="number" min="1" max={item.quantity} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-slate-700">Address
                          <input value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} required maxLength={200} placeholder="House/building and street" className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-slate-700">Address line 2 (optional)
                          <input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} maxLength={200} placeholder="Apartment, landmark" className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label className="grid gap-1 text-sm font-medium text-slate-700">City
                            <input value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} required maxLength={100} className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                          </label>
                          <label className="grid gap-1 text-sm font-medium text-slate-700">State
                            <input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} required maxLength={100} className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                          </label>
                          <label className="grid gap-1 text-sm font-medium text-slate-700">Postal code
                            <input value={address.pincode} onChange={(event) => setAddress({ ...address, pincode: event.target.value })} required maxLength={12} className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                          </label>
                        </div>
                        <label className="grid gap-1 text-sm font-medium text-slate-700">Delivery instructions (optional)
                          <textarea value={address.instructions} onChange={(event) => setAddress({ ...address, instructions: event.target.value })} maxLength={500} className="rounded-lg border border-slate-200 bg-white px-3 py-2" />
                        </label>
                        <label className="grid gap-1 text-sm font-medium text-slate-700">
                          Doctor prescription {item.medicine.prescriptionRequired ? "(required)" : "(optional)"}
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required={item.medicine.prescriptionRequired} onChange={(event) => setPrescription(event.target.files?.[0] || null)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
                          <span className="text-xs font-normal text-slate-500">PDF, JPEG or PNG; maximum 5 MB. Only this pharmacy can access the uploaded file.</span>
                        </label>
                        <p className="text-sm font-semibold text-slate-700">Estimated medicine total: ₹{(Number(item.price) * quantity).toFixed(2)}</p>
                        <div className="flex gap-2">
                          <button disabled={submitting} className="flex-1 rounded-lg bg-medical-600 px-3 py-2 font-semibold text-white disabled:opacity-60">{submitting ? "Sending..." : "Place delivery order"}</button>
                          <button type="button" onClick={() => setSelectedOrder(null)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">Cancel</button>
                        </div>
                      </form>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
