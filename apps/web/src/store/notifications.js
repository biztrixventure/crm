import { create } from 'zustand';

export const useNotificationStore = create((set, get) => ({
  notifications: [],

  addNotification: (notification) => {
    const id = Date.now();
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id, ...notification, createdAt: new Date() },
      ],
    }));

    // Auto-remove after 10 seconds
    setTimeout(() => {
      get().removeNotification(id);
    }, 10000);

    return id;
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearAll: () => set({ notifications: [] }),
}));
