import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import api from '../api/axios';
import type { UserData } from '../types';

interface AuthContextProps {
  user: UserData | null;
  loading: boolean;
  login: (apikey: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (data: { email: string; password: string; confirmPassword: string; telegramUsername?: string }) => Promise<boolean>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps>({
  user: null,
  loading: true,
  login: async () => false,
  logout: async () => {},
  register: async () => false,
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      setLoading(true);
      const res = await api.get('/user/data');
      if (res.data.success) {
        setUser(res.data as unknown as UserData); // data shape matches interface
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (apikey: string) => {
    try {
      const res = await api.post('/login', { apikey });
      if (res.data.success) {
        await refreshUser();
        return true;
      }
      return false;
    } catch (error) {
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.get('/logout');
    } catch {}
    setUser(null);
  };

  const register = async (data: { email: string; password: string; confirmPassword: string; telegramUsername?: string }) => {
    try {
      const res = await api.post('/register', data);
      return res.data.success;
    } catch {
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);