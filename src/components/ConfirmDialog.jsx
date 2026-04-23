import React, { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

// Simple confirm dialog. Usage:
//   const [confirm, setConfirm] = useState(null)
//   setConfirm({ title, message, onConfirm, variant: 'danger' | 'default' })
//   <ConfirmDialog data={confirm} onDismiss={() => setConfirm(null)} />
export default function ConfirmDialog({ data, onDismiss }) {
  useEffect(() => {
    if (!data) return
    const handler = (e) => { if (e.key === 'Escape') onDismiss() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [data, onDismiss])

  if (!data) return null
  const { title, message, onConfirm, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default' } = data
  const isDanger = variant === 'danger'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onDismiss}
    >
      <div
        className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-5 w-full max-w-sm shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          {isDanger && (
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex-shrink-0">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
            {message && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{message}</p>}
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onDismiss}
            className="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={() => { onConfirm(); onDismiss() }}
            className={`px-3 py-1.5 text-sm text-white rounded-lg transition-colors ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
