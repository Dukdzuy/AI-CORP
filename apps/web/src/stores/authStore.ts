import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { queryClient } from '../lib/queryClient';
import { useMeetingStore } from './meetingStore';

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  /** resolved by the API from the role (Phase 5); refreshed from /auth/me on start-up */
  permissions?: string[];
}

interface AuthState {
  token: string | null;
  user: UserInfo | null;
  isAuthenticated: boolean;
  /** Signed out because the token expired; the sign-in page says so and returns to `returnTo` */
  sessionExpired: boolean;
  returnTo: string | null;
  setAuth: (token: string, user: UserInfo) => void;
  setUser: (user: UserInfo) => void;
  logout: () => void;
  expireSession: (returnTo?: string) => void;
  clearReturnTo: () => void;
}

/** What one user leaves in this browser: cached API data and the Meeting Room messages */
function clearUserData() {
  queryClient.clear();
  useMeetingStore.getState().clearMessages();
}

function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      sessionExpired: false,
      returnTo: null,
      setAuth: (token, user) => {
        // Another account signing in on this browser must not see the previous one's data
        if (get().user?.id && get().user?.id !== user.id) clearUserData();
        set({ token, user, isAuthenticated: true, sessionExpired: false });
      },
      setUser: (user) => set({ user }),
      logout: () => {
        clearUserData();
        set({ token: null, user: null, isAuthenticated: false, sessionExpired: false, returnTo: null });
      },
      // Keeps the user's data: the same person usually signs in again
      expireSession: (returnTo) => {
        if (!get().isAuthenticated) return;
        set({ token: null, isAuthenticated: false, sessionExpired: true, returnTo: returnTo ?? null });
      },
      clearReturnTo: () => set({ returnTo: null, sessionExpired: false }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ token: state.token, user: state.user, isAuthenticated: state.isAuthenticated, returnTo: state.returnTo }),
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.expireSession();
        }
      },
    }
  )
);
