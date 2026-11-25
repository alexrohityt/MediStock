import { createContext, useContext, useMemo, useState } from "react";
import api from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("medistock_user")); } catch { return null; }
  });

  async function login(values) {
    const { data } = await api.post("/auth/login", values);
    localStorage.setItem("medistock_token", data.data.token);
    localStorage.setItem("medistock_user", JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }

  async function register(values) {
    const { data } = await api.post("/auth/register", values);
    localStorage.setItem("medistock_token", data.data.token);
    localStorage.setItem("medistock_user", JSON.stringify(data.data.user));
    setUser(data.data.user);
    return data.data.user;
  }

  function logout() {
    localStorage.removeItem("medistock_token");
    localStorage.removeItem("medistock_user");
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, register, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
