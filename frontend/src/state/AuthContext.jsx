// Who is signed in. "Remember me" keeps the session in localStorage, otherwise sessionStorage
// (cleared when the browser closes). Guests can use the app without an account.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';

const KEY = 'pcra.v1.session';

const read = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
const write = (session, remember) => {
  try {
    localStorage.removeItem(KEY); sessionStorage.removeItem(KEY);
    if (session) (remember ? localStorage : sessionStorage).setItem(KEY, JSON.stringify(session));
  } catch { /* private mode */ }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(read); // { token?, user: { email, name } | { guest: true } }

  // Re-check a stored session with the backend (expired → back to the login page)
  useEffect(() => {
    if (!session?.token) return;
    api.me(session.token).then(user => {
      if (user === null) { write(null); setSession(null); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signIn = useCallback(async (email, password, remember) => {
    const { token, user } = await api.login(email, password);
    const s = { token, user };
    write(s, remember); setSession(s);
    return user;
  }, []);

  const continueAsGuest = useCallback(() => {
    const s = { user: { guest: true } };
    write(s, false); setSession(s);
  }, []);

  const signOut = useCallback(async () => {
    if (session?.token) await api.logout(session.token);
    write(null); setSession(null);
  }, [session]);

  const value = useMemo(() => ({ user: session?.user || null, signIn, signOut, continueAsGuest }), [session, signIn, signOut, continueAsGuest]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
