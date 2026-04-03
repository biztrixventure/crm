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
          
          return { success: true };
        } catch (error) {
          const message = error.response?.data?.error || 'Login failed';
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
