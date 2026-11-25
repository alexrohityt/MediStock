import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const dashboard = user ? user.role === "STAFF" ? "/pharmacy" : `/${user.role.toLowerCase()}` : null;

  function signOut() {
    logout();
    navigate("/");
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-white/70 bg-white/85 px-6 py-4 shadow-sm backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link to="/" className="flex h-12 items-center" aria-label="Medifind home">
          <img
            src="/medifind-logo.png"
            alt="Medifind"
            className="h-12 w-auto max-w-[220px] object-contain"
          />
        </Link>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <Link to="/search" className="text-slate-600 transition hover:text-medical-700">Search</Link>
          {user ? (
            <>
              <Link to={dashboard} className="text-slate-600 hover:text-medical-700">Dashboard</Link>
              <button onClick={signOut} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 transition hover:border-medical-200 hover:bg-medical-50 hover:text-medical-700">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-slate-600">Sign in</Link>
              <Link to="/register" className="rounded-lg bg-gradient-to-r from-medical-600 to-teal-500 px-4 py-2 text-white shadow-sm transition hover:from-medical-700 hover:to-teal-600">Create account</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
