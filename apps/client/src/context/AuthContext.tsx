import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { load, save, remove } from "../services/storage";
import { api } from "../services/api";

export type Role = "guest" | "user" | "admin" | "developer";

const GUEST_PERMISSIONS = ["game:play", "leaderboard:view"];

const TOKEN_KEY = "auth:token";

export interface User {
  id: number;
  username: string;
  email: string;
  role: Role;
  permissions: string[];
  createdAt: string;
}

interface AuthPayload {
  user: User;
  token: string;
}

interface AuthCtx {
  user: User | null;
  token: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  hasPermission: (permission: string) => boolean;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  token: null,
  login: async () => {},
  register: async () => {},
  logout: () => {},
  loading: true,
  hasPermission: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => load<string | null>(TOKEN_KEY, null));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api<{ user: User }>("/api/auth/me", { token })
        .then((res) => setUser(res.user))
        .catch(() => { remove(TOKEN_KEY); setToken(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const data = await api<AuthPayload>("/api/auth/login", {
      method: "POST",
      body: { identifier, password },
    });
    save(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const data = await api<AuthPayload>("/api/auth/register", {
      method: "POST",
      body: { username, email, password },
    });
    save(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    remove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const hasPermission = useCallback(
    (permission: string) => (user?.permissions ?? GUEST_PERMISSIONS).includes(permission),
    [user?.permissions],
  );

  return (
    <Ctx.Provider value={{ user, token, login, register, logout, loading, hasPermission }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  return useContext(Ctx);
}
