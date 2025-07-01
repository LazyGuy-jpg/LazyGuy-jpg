import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { authAPI, userAPI } from '../services/api';
import toast from 'react-hot-toast';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isAdmin: false,
      loading: false,
      error: null,

      // User login
      login: async (apikey) => {
        set({ loading: true, error: null });
        try {
          await authAPI.login(apikey);
          const userData = await userAPI.getUserData();
          set({ 
            user: userData.data, 
            isAuthenticated: true, 
            isAdmin: false,
            loading: false 
          });
          toast.success('Login successful!');
          return true;
        } catch (error) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Login failed' 
          });
          toast.error(error.response?.data?.error || 'Login failed');
          return false;
        }
      },

      // User registration
      register: async (data) => {
        set({ loading: true, error: null });
        try {
          const response = await authAPI.register(data);
          toast.success(response.data.message || 'Registration successful!');
          return response.data;
        } catch (error) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Registration failed' 
          });
          toast.error(error.response?.data?.error || 'Registration failed');
          throw error;
        }
      },

      // Admin login
      adminLogin: async (secret) => {
        set({ loading: true, error: null });
        try {
          await authAPI.adminLogin(secret);
          set({ 
            isAuthenticated: true, 
            isAdmin: true,
            loading: false 
          });
          toast.success('Admin login successful!');
          return true;
        } catch (error) {
          set({ 
            loading: false, 
            error: error.response?.data?.error || 'Admin login failed' 
          });
          toast.error(error.response?.data?.error || 'Invalid admin secret');
          return false;
        }
      },

      // Logout
      logout: async () => {
        set({ loading: true });
        try {
          if (get().isAdmin) {
            await authAPI.adminLogout();
          } else {
            await authAPI.logout();
          }
          set({ 
            user: null, 
            isAuthenticated: false, 
            isAdmin: false,
            loading: false 
          });
          toast.success('Logged out successfully');
          window.location.href = '/';
        } catch (error) {
          set({ loading: false });
          // Force logout even if API fails
          set({ 
            user: null, 
            isAuthenticated: false, 
            isAdmin: false 
          });
          window.location.href = '/';
        }
      },

      // Update user data
      updateUserData: async () => {
        if (!get().isAuthenticated || get().isAdmin) return;
        try {
          const userData = await userAPI.getUserData();
          set({ user: userData.data });
        } catch (error) {
          console.error('Failed to update user data:', error);
        }
      },

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        isAuthenticated: state.isAuthenticated,
        isAdmin: state.isAdmin 
      }),
    }
  )
);

export default useAuthStore;