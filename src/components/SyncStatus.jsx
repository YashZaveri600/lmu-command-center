import React, { useState, useEffect, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import { useToast } from './Toast'

const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

function formatRelative(d) {
  if (!d) return null
  const now = Date.now()
  const diffMs = now - d.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 7) return `${day}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Small persistent sync-status pill. Shows last-synced time with a live
// green dot, and a Resync button to trigger a manual sync.
// Meant to sit in the top-right of the main header, visible on every page.
export default function SyncStatus() {
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)
  // Bump a tick counter every 30s to keep the relative time fresh
  const [, setTick] = useState(0)
  const toast = useToast()

  const refresh = useCallback(() => {
    fetch(`${API}/brightspace/status`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.lastSync) setLastSync(new Date(data.lastSync)) })
      .catch(() => {})
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  const handleResync = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const res = await fetch(`${API}/sync`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.ok) {
        setLastSync(new Date())
        const n = data.results
        toast.show(
          n ? `Synced: ${n.grades || 0} grades, ${n.tasks || 0} tasks` : 'Synced',
          'success'
        )
      } else {
        toast.show(data.error || 'Sync failed', 'error', 5000)
      }
    } catch {
      toast.show('Sync failed', 'error', 5000)
    }
    setSyncing(false)
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
      <span className="hidden sm:inline">
        {lastSync ? (
          <>Synced <span className="text-gray-700 dark:text-gray-200">{formatRelative(lastSync)}</span></>
        ) : 'Not synced'}
      </span>
      <button
        onClick={handleResync}
        disabled={syncing}
        title="Resync now"
        className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors disabled:opacity-50"
      >
        <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
      </button>
    </div>
  )
}
