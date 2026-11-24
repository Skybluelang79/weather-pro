import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { AuthContext } from './auth';
import type { AuthContextValue } from './auth';
import type { AuthUser } from '../types';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const result = await api.getAuthMe();
      setUser(result.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signup = useCallback(async (data: { name: string; email: string; password: string }) => {
    const result = await api.signup(data);
    setUser(result.user);
  }, []);

  const login = useCallback(async (data: { email: string; password: string }) => {
    const result = await api.login(data);
    setUser(result.user);
  }, []);

  const logout = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signup,
    login,
    logout,
    refresh,
  }), [user, loading, signup, login, logout, refresh]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
