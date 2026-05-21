import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api.js';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await api.get('/api/auth/me');
      setUser(r.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onFail = () => setUser(null);
    window.addEventListener('twinland:auth-failure', onFail);
    return () => window.removeEventListener('twinland:auth-failure', onFail);
  }, []);

  const login = useCallback(async (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const r = await api.post('/api/auth/login', form, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const register = useCallback(async (payload) => {
    const r = await api.post('/api/auth/register', payload);
    setUser(r.data.user);
    return r.data.user;
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/api/auth/logout'); } catch {}
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    await load();
  }, [load]);

  const value = useMemo(() => ({ user, loading, login, register, logout, refreshMe }), [user, loading, login, register, logout, refreshMe]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth must be used within <AuthProvider>');
  return v;
}

export const ROLE_ORDER = { guest: 0, investor: 1, admin: 2, superadmin: 3 };

export function canAccessRole(userRole, required) {
  return (ROLE_ORDER[userRole] ?? -1) >= (ROLE_ORDER[required] ?? 99);
}
