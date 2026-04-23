import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

// Simple toast context. Wrap the app in <ToastProvider> and call
// useToast().show('message', 'success' | 'error' | 'info', durationMs?)
// anywhere inside. Toasts stack from the bottom-right.

const ToastContext = createContext(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Safe no-op if the provider is missing — avoid crashing if a toast is
    // fired from a code path that renders outside the provider.
    return { show: () => {} }
  }
  return ctx
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, type = 'info', durationMs = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    if (durationMs > 0) {
      setTimeout(() => dismiss(id), durationMs)
    }
    return id
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ show, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={() => onDismiss(t.id)} />)}
    </div>
  )
}

function ToastCard({ toast, onDismiss }) {
  const [entering, setEntering] = useState(true)
  useEffect(() => {
    const id = requestAnimationFrame(() => setEntering(false))
    return () => cancelAnimationFrame(id)
  }, [])

  const styles = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/30',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-200',
      icon: <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />,
    },
    error: {
      bg: 'bg-red-50 dark:bg-red-900/30',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-200',
      icon: <AlertCircle size={16} className="text-red-500 flex-shrink-0" />,
    },
    info: {
      bg: 'bg-white dark:bg-gray-800',
      border: 'border-gray-200 dark:border-gray-700',
      text: 'text-gray-700 dark:text-gray-200',
      icon: <Info size={16} className="text-blue-500 flex-shrink-0" />,
    },
  }
  const s = styles[toast.type] || styles.info

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 ${s.bg} ${s.border} border rounded-lg shadow-lg px-3 py-2 min-w-[240px] max-w-[360px] transform transition-all duration-200 ${
        entering ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
    >
      {s.icon}
      <span className={`text-sm flex-1 ${s.text}`}>{toast.message}</span>
      <button
        onClick={onDismiss}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  )
}
