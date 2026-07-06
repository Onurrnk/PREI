// =====================================================================
// PREI | Auth context — çift yol (feature flag: VITE_USE_REAL_API)
//   flag YOK/false → legacy mock auth (FAZ T demo, MSW /api/auth/login)
//   flag = 'true'  → gerçek Supabase Auth (signInWithPassword → JWT →
//                    Bearer olarak backend'e; rol GET /api/me'den)
// Token persistence api client'ta (tokenStore) — her istek Bearer taşır.
// =====================================================================
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDTO } from '../types';
import { authApi } from '../api/resources';
import { tokenStore } from '../api/client';
import { supabase } from './supabaseClient';

const REAL_AUTH = import.meta.env.VITE_USE_REAL_API === 'true';

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(() => (REAL_AUTH ? true : Boolean(tokenStore.get())));

  // Oturum geri yükleme (ilk yüklemede).
  useEffect(() => {
    if (REAL_AUTH) {
      // Supabase oturumunu geri yükle, backend'den rolü çöz.
      supabase.auth
        .getSession()
        .then(async ({ data }) => {
          const token = data.session?.access_token;
          if (!token) return;
          tokenStore.set(token);
          const me = await authApi.realMe();
          setUser({ id: me.id, name: me.name, role: me.role, email: me.email, avatar: '' });
        })
        .catch(() => tokenStore.clear())
        .finally(() => setLoading(false));
      return;
    }
    // --- Legacy mock ---
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    if (REAL_AUTH) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error || !data.session) throw error ?? new Error('Oturum alınamadı');
      tokenStore.set(data.session.access_token);
      const me = await authApi.realMe();
      setUser({ id: me.id, name: me.name, role: me.role, email: me.email, avatar: '' });
      return;
    }
    // --- Legacy mock ---
    const { token, user: authedUser } = await authApi.login(email, password);
    tokenStore.set(token);
    setUser(authedUser);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
    if (REAL_AUTH) void supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components -- context + hook aynı dosyada (proje deseni)
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
