// ============================================================
// Auth Store — Domain: auth + user-management
// DB tables: users, userPermissions
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { dexieStorage } from '@/lib/persist-storage';
import { db } from '@/db/database';
import bcrypt from 'bcryptjs';
import type { User, UserPermission } from '@/types';
import { notifySync } from '@/sync/sync-trigger';

export interface AuthState {
  // State
  currentUser: User | null;
  sessionToken: string | null;
  isAuthenticated: boolean;
  users: User[];
  userPermissions: UserPermission[];
  loading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  verifyPin: (userId: string, pin: string) => Promise<boolean>;
  checkSession: () => Promise<void>;
  loadUsers: () => Promise<void>;
  loadPermissions: (userId: string) => Promise<void>;
  updatePermissions: (userId: string, permissions: UserPermission[]) => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      sessionToken: null,
      isAuthenticated: false,
      users: [],
      userPermissions: [],
      loading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ loading: true, error: null });
        try {
          const user = await db.users.where('username').equals(username).first();

          if (!user) {
            set({ loading: false, error: 'Username atau password salah' });
            return;
          }

          if (!user.isActive) {
            set({ loading: false, error: 'Akun telah dinonaktifkan' });
            return;
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            set({ loading: false, error: 'Username atau password salah' });
            return;
          }

          // Generate session token
          const sessionToken = crypto.randomUUID();

          // Update last login time
          await db.users.update(user.id, {
            lastLoginAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          // Load permissions for the user
          const permissions = await db.userPermissions
            .where('userId')
            .equals(user.id)
            .toArray();

          set({
            currentUser: { ...user, lastLoginAt: new Date().toISOString() },
            sessionToken,
            isAuthenticated: true,
            userPermissions: permissions,
            loading: false,
            error: null,
          });
          notifySync();
        } catch {
          set({ loading: false, error: 'Gagal melakukan login' });
        }
      },

      logout: async () => {
        set({
          currentUser: null,
          sessionToken: null,
          isAuthenticated: false,
          users: [],
          userPermissions: [],
          error: null,
        });
      },

      verifyPin: async (userId: string, pin: string) => {
        const user = await db.users.get(userId);
        if (!user || !user.pinHash) return false;
        return bcrypt.compare(pin, user.pinHash);
      },

      checkSession: async () => {
        const { currentUser, sessionToken } = get();
        if (!currentUser || !sessionToken) {
          set({ isAuthenticated: false, currentUser: null, sessionToken: null });
          return;
        }

        // Verify user still exists and is active in DB
        const user = await db.users.get(currentUser.id);
        if (!user || !user.isActive) {
          set({ isAuthenticated: false, currentUser: null, sessionToken: null });
          return;
        }

        // Refresh permissions
        const permissions = await db.userPermissions
          .where('userId')
          .equals(currentUser.id)
          .toArray();

        set({
          currentUser: user,
          userPermissions: permissions,
          isAuthenticated: true,
        });
      },

      loadUsers: async () => {
        set({ loading: true, error: null });
        try {
          const users = await db.users.toArray();
          set({ users, loading: false });
        } catch {
          set({ loading: false, error: 'Gagal memuat daftar pengguna' });
        }
      },

      loadPermissions: async (userId: string) => {
        try {
          const permissions = await db.userPermissions
            .where('userId')
            .equals(userId)
            .toArray();
          set({ userPermissions: permissions });
        } catch {
          set({ error: 'Gagal memuat izin pengguna' });
        }
      },

      updatePermissions: async (userId: string, permissions: UserPermission[]) => {
        try {
          await db.userPermissions.bulkPut(permissions);
          // Reload permissions if they belong to the current user
          const { currentUser } = get();
          if (currentUser && currentUser.id === userId) {
            const updated = await db.userPermissions
              .where('userId')
              .equals(userId)
              .toArray();
            set({ userPermissions: updated });
          }
          notifySync();
        } catch {
          set({ error: 'Gagal memperbarui izin pengguna' });
        }
      },
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => dexieStorage),
      partialize: (state) => ({
        currentUser: state.currentUser,
        sessionToken: state.sessionToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
