/**
 * Session state: the signed-in user, login, signup and logout. The token lives
 * in localStorage and is attached by the api client.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, type User } from '@/lib/api';
import { getToken, setToken, clearToken, decodeToken } from '@/lib/authToken';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (email: string, username: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    try {
      setUser(await auth.me());
    } catch {
      clearToken();
      setUser(null);
    }
  };

  useEffect(() => {
    const token = getToken();
    // Decoding locally first avoids a guaranteed-401 round trip on every cold
    // load with an expired token.
    if (!token || !decodeToken(token)) {
      clearToken();
      setLoading(false);
      return;
    }
    refreshUser().finally(() => setLoading(false));
  }, []);

  const signIn = async (username: string, password: string) => {
    const { token, user: loggedIn } = await auth.login(username, password);
    setToken(token);
    setUser(loggedIn);
  };

  const signUp = async (email: string, username: string, password: string, displayName?: string) => {
    const { token, user: created } = await auth.signup(email, username, password, displayName);
    setToken(token);
    setUser(created);
  };

  const signOut = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
