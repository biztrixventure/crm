import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/axios';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      intermediateToken: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });

          if (response.data.totp_required) {
            set({
              intermediateToken: response.data.intermediate_token,
              isLoading: false,
            });
            return { totpRequired: true };
          }

          set({
            user: response.data.user,
            token: response.data.token,
            intermediateToken: null,
            isLoading: false,
          });

          // ✅ Connect socket after successful login
          try {
            const { connectSocket } = await import('../lib/socket.js');
            setTimeout(() => connectSocket(), 500);
          } catch (socketErr) {
            console.warn('Could not connect socket after login:', socketErr);
          }

          return { success: true };
        } catch (error) {
          let message = 'Login failed';

          // ✅ Better error detection for production debugging
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

      verifyTotp: async (code) => {
        const { intermediateToken } = get();
        set({ isLoading: true, error: null });
        
        try {
          const response = await api.post(
            '/auth/totp/verify',
            { token: code },
            { headers: { Authorization: `Bearer ${intermediateToken}` } }
          );

          set({
            user: response.data.user,
            token: response.data.token,
            intermediateToken: null,
            isLoading: false,
          });

          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Verification failed';
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
        set({ user: null, token: null, intermediateToken: null });
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
