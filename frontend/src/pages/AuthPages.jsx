import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";

function AuthLayout({ title, children }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 shadow-soft">
        <Link to="/" className="mb-8 flex h-14 items-center" aria-label="Medifind home">
          <img
            src="/medifind-logo.png"
            alt="Medifind"
            className="h-14 w-auto max-w-full object-contain"
          />
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await login(values);
      toast.success("Signed in successfully");
      const destination = user.role === "STAFF" ? "/pharmacy" : `/${user.role.toLowerCase()}`;
      navigate(location.state?.from || destination, { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to sign in");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Welcome back">
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Email
          <input required type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-medical-500" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Password
          <input required type="password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-medical-500" />
        </label>
        <div className="text-right">
          <Link to="/forgot-password" className="text-sm font-bold text-medical-700">Forgot password?</Link>
        </div>
        <button disabled={loading} className="mt-2 rounded-xl bg-medical-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Signing in..." : "Sign in"}</button>
      </form>
      <p className="mt-6 text-sm text-slate-600">New to Medifind? <Link to="/register" className="font-bold text-medical-700">Create account</Link></p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: "", email: "", phone: "", password: "", role: "CUSTOMER" });
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    try {
      const user = await register(values);
      toast.success("Account created");
      if (user.role === "PHARMACY") navigate("/pharmacy/profile");
      else navigate("/customer");
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to create account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Create your account">
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Full name
          <input required value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Email
          <input required type="email" value={values.email} onChange={(e) => setValues({ ...values, email: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Phone
          <input value={values.phone} onChange={(e) => setValues({ ...values, phone: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Password
          <input required minLength={8} type="password" value={values.password} onChange={(e) => setValues({ ...values, password: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Account type
          <select value={values.role} onChange={(e) => setValues({ ...values, role: e.target.value })} className="rounded-xl border border-slate-200 px-4 py-3">
            <option value="CUSTOMER">Customer</option>
            <option value="PHARMACY">Pharmacy</option>
          </select>
        </label>
        <button disabled={loading} className="mt-2 rounded-xl bg-medical-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Creating..." : "Create account"}</button>
      </form>
      <p className="mt-6 text-sm text-slate-600">Already registered? <Link to="/login" className="font-bold text-medical-700">Sign in</Link></p>
    </AuthLayout>
  );
}

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetUrl, setResetUrl] = useState("");

  async function submit(event) {
    event.preventDefault();
    setLoading(true);
    setResetUrl("");
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      toast.success(data.message);
      if (data.data?.resetUrl) setResetUrl(data.data.resetUrl);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to process password reset");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Forgot password">
      <p className="mt-3 text-sm leading-6 text-slate-600">Enter your account email. We will generate a password reset link for the account.</p>
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Email
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-medical-500" />
        </label>
        <button disabled={loading} className="mt-2 rounded-xl bg-medical-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Processing..." : "Continue"}</button>
      </form>
      {resetUrl && (
        <a href={resetUrl} className="mt-5 block break-all rounded-xl bg-medical-50 p-4 text-sm font-bold text-medical-700">
          Open development reset link
        </a>
      )}
      <p className="mt-6 text-sm text-slate-600"><Link to="/login" className="font-bold text-medical-700">Back to sign in</Link></p>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post(`/auth/reset-password/${token}`, { password });
      toast.success(data.message);
      navigate("/login", { replace: true });
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout title="Reset password">
      <form onSubmit={submit} className="mt-6 grid gap-4">
        <label className="grid gap-2 text-sm font-semibold text-slate-700">New password
          <input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-medical-500" />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">Confirm password
          <input required minLength={8} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-medical-500" />
        </label>
        <button disabled={loading} className="mt-2 rounded-xl bg-medical-600 px-4 py-3 font-semibold text-white disabled:opacity-60">{loading ? "Resetting..." : "Reset password"}</button>
      </form>
    </AuthLayout>
  );
}
