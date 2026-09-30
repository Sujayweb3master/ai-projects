import { create } from 'zustand';

let nextId = 1;

/**
 * Transient, non-blocking feedback. Primary feedback is always shown next to the control
 * that triggered it; toasts are a secondary summary (see CLAUDE.md "Interaction rules").
 * toast: { id, message, tone: 'success' | 'error' | 'info', action?: { label, onAction } }
 */
export const useToastStore = create((set) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set((state) => ({ toasts: [...state.toasts.slice(-3), { tone: 'success', ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message, options = {}) =>
  useToastStore.getState().push({ message, ...options });
