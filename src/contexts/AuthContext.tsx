/**
 * Session state: the signed-in user, login, signup and logout - backed by the
 * shared ecosystem session (single sign-on). The surface is unchanged; the
 * LifeOS profile (its own fields) is read from the gateway once authenticated.
 */
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, type User } from '@/lib/api';
import { session } from '@/lib/session';

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
      setUser(null);
    }
  };

  useEffect(() => {
    // Restore a session from the shared cookie, if there is one. Arriving from
    // another ecosystem app already signed in lands here signed in too.
    session.init()
      .then((s) => (s.status === 'authenticated' ? refreshUser() : setUser(null)))
      .finally(() => setLoading(false));
    const unsubscribe = session.subscribe((s) => {
      if (s.status === 'anonymous') setUser(null);
    });
    return unsubscribe;
  }, []);

  const signIn = async (username: string, password: string) => {
    await session.login(username, password);
    await refreshUser();
  };

  const signUp = async (email: string, username: string, password: string, displayName?: string) => {
    await session.signup({ email, username, password, display_name: displayName });
    await refreshUser();
  };

  const signOut = () => {
    void session.logout();
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
