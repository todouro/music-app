import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckFilled, CloseFilled, DiscFilled } from './icons'
import { useToastStore, type Toast } from '../store/useToastStore'

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((state) => state.removeToast)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (isPaused) return
    const timer = setTimeout(() => {
      removeToast(toast.id)
    }, toast.duration ?? 4200)

    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, isPaused, removeToast])

  return (
    <motion.div
      layout
      className={`toast-item toast-${toast.type ?? 'success'}`}
      initial={{ opacity: 0, y: -24, scale: 0.9, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -16, scale: 0.92, filter: 'blur(4px)' }}
      transition={{ type: 'spring', stiffness: 480, damping: 28 }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      role="status"
      aria-live="polite"
    >
      <div className="toast-icon-badge">
        {toast.type === 'error' ? (
          <CloseFilled size={15} />
        ) : toast.type === 'info' ? (
          <DiscFilled size={15} />
        ) : (
          <CheckFilled size={15} />
        )}
      </div>

      <div className="toast-content">
        {toast.title && <strong className="toast-title">{toast.title}</strong>}
        <span className="toast-message">{toast.message}</span>
      </div>

      <button
        type="button"
        className="toast-close-btn"
        onClick={() => removeToast(toast.id)}
        aria-label="Dismiss notification"
      >
        <CloseFilled size={13} />
      </button>

      <motion.div
        className="toast-progress-bar"
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{
          duration: (toast.duration ?? 4200) / 1000,
          ease: 'linear',
        }}
      />
    </motion.div>
  )
}

export function NotificationToast() {
  const toasts = useToastStore((state) => state.toasts)

  return (
    <aside className="toast-viewport" aria-label="Notifications">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </aside>
  )
}

export default NotificationToast
