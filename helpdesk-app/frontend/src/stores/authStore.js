import { create } from 'zustand';

/**
 * Auth state lives in memory only: the access token is never written to localStorage or
 * sessionStorage (XSS can't read what isn't stored). The refresh token is an httpOnly
 * cookie the browser manages; a page reload restores the session via POST /auth/refresh.
 *
 * status: 'unknown' (booting) | 'authenticated' | 'anonymous'
 */
export const useAuthStore = create((set) => ({
  status: 'unknown',
  user: null,
  accessToken: null,
  /** Why the user was signed out, shown on the login page ('expired' | null). */
  signOutReason: null,

  setSession: ({ user, accessToken }) =>
    set({ status: 'authenticated', user, accessToken, signOutReason: null }),
  setUser: (user) => set({ user }),
  clear: (signOutReason = null) =>
    set({ status: 'anonymous', user: null, accessToken: null, signOutReason }),
}));

export const selectIsAdmin = (state) => state.user?.role === 'ADMIN';
