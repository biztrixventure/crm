import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });

          set({
            user: response.data.user,
            token: response.data.token,
            isLoading: false,
          });

          return { success: true };
        } catch (error) {
          let message = 'Login failed';

          if (error.response?.status === 504) {
            message = 'Server unavailable (Gateway Timeout). Ensure API service is running.';
          } else if (error.response?.status === 401) {
            message = 'Invalid email or password';
          } else if (error.response?.status === 400) {
            message = error.response?.data?.error || 'Invalid request';
          } else if (error.code === 'ECONNREFUSED') {
            message = 'Cannot connect to server. Please check your connection.';
          } else if (error.code === 'ENOTFOUND') {
            message = 'Cannot reach server. DNS resolution failed.';
          } else if (error.message?.includes('timeout')) {
            message = 'Request timeout. Server is slow or unavailable.';
          } else {
            message = error.response?.data?.error || error.message || 'Login failed';
          }

          set({ error: message, isLoading: false });
          return { error: message };
        }
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch (error) {
          console.error('Logout error:', error);
        }
        set({ user: null, token: null });
      },

      checkAuth: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.user });
        } catch (error) {
          set({ user: null, token: null });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'biztrix-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    }
  )
);
