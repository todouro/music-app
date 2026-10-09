import { create } from 'zustand'

export type ToastType = 'success' | 'info' | 'warning' | 'error'

export type Toast = {
  id: string
  title?: string
  message: string
  type?: ToastType
  duration?: number
  timestamp: number
}

type ToastState = {
  toasts: Toast[]
  addToast: (toast: {
    message: string
    title?: string
    type?: ToastType
    duration?: number
  }) => string
  removeToast: (id: string) => void
  clearToasts: () => void
}

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newToast: Toast = {
      id,
      message: toast.message,
      title: toast.title,
      type: toast.type ?? 'success',
      duration: toast.duration ?? 4200,
      timestamp: Date.now(),
    }
    // Keep max 3 concurrent visible toasts to prevent screen clutter
    set((state) => ({
      toasts: [...state.toasts.slice(-2), newToast],
    }))
    return id
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
  clearToasts: () => set({ toasts: [] }),
}))

export function showToast(
  message: string,
  options?: { title?: string; type?: ToastType; duration?: number },
) {
  return useToastStore.getState().addToast({
    message,
    title: options?.title,
    type: options?.type,
    duration: options?.duration,
  })
}
