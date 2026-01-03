import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserProfile = {
  id?: number
  login: string
  fullName?: string
  email?: string
  phone?: string
  registeredAt?: string
}

type AuthState = {
  user: UserProfile | null
  roles: string[]
  token: string | null
  setAuth: (user: UserProfile | null, roles: string[], token?: string | null) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      roles: [],
      token: null,
      setAuth: (user, roles, token) =>
        set({ user, roles, token: token ?? null }),
      clear: () => set({ user: null, roles: [], token: null }),
    }),
    {
      name: 'ct-auth',
      partialize: (state) => ({
        user: state.user,
        roles: state.roles,
        token: state.token,
      }),
    },
  ),
)
