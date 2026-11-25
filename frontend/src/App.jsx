import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import { ForgotPasswordPage, LoginPage, RegisterPage, ResetPasswordPage } from "./pages/AuthPages";
import SearchPage from "./pages/SearchPage";
import { CustomerDashboard, AdminDashboard } from "./pages/DashboardPages";
import PharmacyDashboard from "./pages/PharmacyDashboard";

function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-medical-50 via-white to-slate-50">
      <Navbar />
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 md:grid-cols-2">
        <div>
          <p className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-medical-600">Smart medicine availability</p>
          <h1 className="text-4xl font-bold leading-tight text-slate-900 md:text-6xl">
            Find medicines at pharmacies near you.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Search verified pharmacy inventory, compare prices and manage availability requests in one secure platform.
          </p>
          <a href="/search" className="mt-8 inline-flex rounded-xl bg-medical-600 px-6 py-3 font-semibold text-white shadow-soft">
            Search medicines
          </a>
        </div>
        <div className="rounded-3xl border border-medical-100 bg-white p-8 shadow-soft">
          <div className="grid gap-4">
            {["Search by medicine or generic name", "Compare nearby pharmacy prices", "Request and track availability"].map((item) => (
              <div key={item} className="rounded-2xl bg-medical-50 p-5 font-semibold text-medical-700">{item}</div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function Placeholder({ title }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <div className="rounded-2xl bg-white p-8 shadow-soft">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-slate-600">Foundation route ready for module implementation.</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
          <Route path="/about" element={<Placeholder title="About Medifind" />} />
          <Route path="/customer/*" element={<ProtectedRoute roles={["CUSTOMER"]}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/pharmacy/*" element={<ProtectedRoute roles={["PHARMACY", "STAFF"]}><PharmacyDashboard /></ProtectedRoute>} />
          <Route path="/admin/*" element={<ProtectedRoute roles={["ADMIN"]}><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
