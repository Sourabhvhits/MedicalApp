'use client';

import { create } from 'zustand';
import { post, tokenStore } from '@/lib/api-client';
import type { AuthProfile, AuthTokens, UserType } from '@/lib/types';

interface AuthState {
  user: AuthProfile | null;
  /** False until the first /auth/me resolve, so guards don't redirect too early. */
  initialised: boolean;
  setUser: (user: AuthProfile | null) => void;
  setSession: (payload: { user: AuthProfile; tokens: AuthTokens }) => void;
  setInitialised: (value: boolean) => void;
  logout: () => Promise<void>;
  can: (permission: string) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  initialised: false,

  setUser: (user) => set({ user, initialised: true }),

  setSession: ({ user, tokens }) => {
    tokenStore.set(tokens);
    set({ user, initialised: true });
  },

  setInitialised: (value) => set({ initialised: value }),

  logout: async () => {
    try {
      await post('/auth/logout');
    } catch {
      // A failed logout call must never trap the user in the app.
    }
    tokenStore.clear();
    set({ user: null, initialised: true });
  },

  // Super admin implicitly holds every permission, matching the API's RBAC.
  can: (permission) => {
    const user = get().user;
    if (!user) return false;
    if (user.userType === 'SUPER_ADMIN') return true;
    return user.permissions.includes(permission);
  },
}));

/** Landing route for each account type after signing in. */
export const HOME_ROUTE: Record<UserType, string> = {
  SUPER_ADMIN: '/admin',
  ADMIN_STAFF: '/admin',
  VENDOR: '/vendor',
  RETAILER: '/retailer',
  CUSTOMER: '/stores',
};
