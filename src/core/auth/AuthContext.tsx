// =====================================================================
// PREI | Auth context
// Holds the authenticated user, restores the session from a stored token
// on load, and exposes login/logout. Token persistence lives in the API
// client (tokenStore) so every request is automatically authenticated.
// =====================================================================
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { UserDTO } from '../types';
import { authApi } from '../api/resources';
import { tokenStore } from '../api/client';

interface AuthContextValue {
  user: UserDTO | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  // Token yoksa oturum geri yüklenmeyecek — loading hiç başlamaz (efekt içinde
  // senkron setState'e gerek kalmaz).
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  // Restore session on first load if a token is present.
  useEffect(() => {
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const { token, user: authedUser } = await authApi.login(email, password);
    tokenStore.set(token);
    setUser(authedUser);
  };

  const logout = () => {
    tokenStore.clear();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
