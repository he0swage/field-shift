// Who is signed in. "Remember me" keeps the session in localStorage, otherwise sessionStorage
// (cleared when the browser closes). Guests can use the app without an account.
//
// Local mode: when the backend is not running, sign-in is checked in the browser against the demo
// account(s) below, so the app works with no server at all (data then comes from the samples).
// This is a convenience for local demos, not security — the real check is POST /api/v1/auth/login.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as api from '../api/client';

const KEY = 'pcra.v1.session';

// Same format as DEMO_USERS in backend/.env: "email:password:Name,email2:password2:Name 2"
const LOCAL_ACCOUNTS = (import.meta.env.VITE_DEMO_USERS || 'demo@fieldshift.app:fieldshift2026:Demo Farmer')
  .split(',')
  .map(entry => { const [email, password, name] = entry.split(':').map(s => (s || '').trim()); return { email: email.toLowerCase(), password, name: name || email }; })
  .filter(a => a.email && a.password);

function localSignIn(email, password) {
  const account = LOCAL_ACCOUNTS.find(a => a.email === email.trim().toLowerCase() && a.password === password);
  if (!account) { const e = new Error('Wrong email or password'); e.code = 'INVALID_CREDENTIALS'; throw e; }
  return { email: account.email, name: account.name };
}

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
    let s;
    try {
      const { token, user } = await api.login(email, password);
      s = { token, user };
    } catch (err) {
      if (err.code !== 'OFFLINE') throw err;     // wrong password, too many attempts…
      s = { user: localSignIn(email, password), local: true }; // no server → local demo login
    }
    write(s, remember); setSession(s);
    return s.user;
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
