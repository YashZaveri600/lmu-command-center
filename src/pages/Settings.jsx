import React, { useState, useEffect } from 'react'
import { RefreshCw, Link2, CheckCircle, AlertCircle, XCircle, ExternalLink, Clock, Shield } from 'lucide-react'

const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

export default function Settings({ user }) {
  const [bsCookie, setBsCookie] = useState('')
  const [connectionStatus, setConnectionStatus] = useState('unknown') // unknown, connected, disconnected, checking
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [saving, setSaving] = useState(false)

  // Check Brightspace connection status on mount
  useEffect(() => {
    checkConnection()
  }, [])

  async function checkConnection() {
    setConnectionStatus('checking')
    try {
      const res = await fetch(`${API}/brightspace/status`, { credentials: 'include' })
      const data = await res.json()
      setConnectionStatus(data.connected ? 'connected' : 'disconnected')
      if (data.lastSync) setLastSync(new Date(data.lastSync))
    } catch {
      setConnectionStatus('disconnected')
    }
  }

  async function saveCookie() {
    if (!bsCookie.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/brightspace/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: bsCookie.trim() }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.ok) {
        setConnectionStatus('connected')
        setBsCookie('')
        setSyncResult({ type: 'success', message: `Connected! Found ${data.userName || 'your account'} on Brightspace.` })
      } else {
        setSyncResult({ type: 'error', message: data.error || 'Failed to connect' })
      }
    } catch (e) {
      setSyncResult({ type: 'error', message: 'Failed to connect to Brightspace' })
    }
    setSaving(false)
  }

  async function triggerSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch(`${API}/sync`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json()
      if (data.ok) {
        setSyncResult({
          type: 'success',
          message: `Synced ${data.results.grades} grades from ${data.results.courses} courses. ${data.results.announcements} new announcements.${data.results.errors.length > 0 ? ` (${data.results.errors.length} warnings)` : ''}`,
        })
        setLastSync(new Date())
      } else {
        setSyncResult({ type: 'error', message: data.error || 'Sync failed' })
      }
    } catch (e) {
      setSyncResult({ type: 'error', message: 'Sync request failed' })
    }
    setSyncing(false)
  }

  async function disconnect() {
    try {
      await fetch(`${API}/brightspace/disconnect`, { method: 'POST', credentials: 'include' })
      setConnectionStatus('disconnected')
      setSyncResult(null)
      setLastSync(null)
    } catch {}
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Manage your connected accounts and sync preferences</p>
      </div>

      {/* Account Info */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Shield size={20} />
          Account
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Name</span>
            <span className="font-medium">{user?.displayName || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Email</span>
            <span className="font-medium">{user?.email || 'Unknown'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500 dark:text-gray-400">Microsoft SSO</span>
            <span className="text-green-500 flex items-center gap-1"><CheckCircle size={14} /> Connected</span>
          </div>
        </div>
      </div>

      {/* Brightspace Connection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
          <Link2 size={20} />
          Brightspace Connection
        </h3>

        {/* Status */}
        <div className="flex items-center gap-2 mb-4">
          {connectionStatus === 'checking' && (
            <span className="text-gray-400 text-sm flex items-center gap-1">
              <RefreshCw size={14} className="animate-spin" /> Checking...
            </span>
          )}
          {connectionStatus === 'connected' && (
            <span className="text-green-500 text-sm flex items-center gap-1">
              <CheckCircle size={14} /> Connected
            </span>
          )}
          {connectionStatus === 'disconnected' && (
            <span className="text-red-400 text-sm flex items-center gap-1">
              <XCircle size={14} /> Not connected
            </span>
          )}
          {lastSync && (
            <span className="text-gray-400 text-xs flex items-center gap-1 ml-auto">
              <Clock size={12} /> Last sync: {lastSync.toLocaleString()}
            </span>
          )}
        </div>

        {connectionStatus === 'connected' ? (
          <div className="space-y-4">
            {/* Sync button */}
            <button
              onClick={triggerSync}
              disabled={syncing}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <RefreshCw size={18} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync Now'}
            </button>

            {/* Disconnect */}
            <button
              onClick={disconnect}
              className="w-full py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-500 hover:text-red-500 hover:border-red-400 text-sm transition-colors"
            >
              Disconnect Brightspace
            </button>
          </div>
        ) : connectionStatus !== 'checking' ? (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-700 dark:text-blue-300 mb-2">How to connect:</p>
              <ol className="list-decimal list-inside space-y-1 text-blue-600 dark:text-blue-400">
                <li>Open <a href="https://brightspace.lmu.edu" target="_blank" rel="noreferrer" className="underline hover:text-blue-800 dark:hover:text-blue-200">brightspace.lmu.edu</a> and log in</li>
                <li>Open DevTools (F12 or Cmd+Opt+I)</li>
                <li>Go to <strong>Application</strong> → <strong>Cookies</strong> → brightspace.lmu.edu</li>
                <li>Find <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">d2lSessionVal</code> and copy the <strong>Value</strong></li>
                <li>Paste it below</li>
              </ol>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                Brightspace Session Cookie
              </label>
              <input
                type="password"
                value={bsCookie}
                onChange={e => setBsCookie(e.target.value)}
                placeholder="Paste d2lSessionVal value here..."
                className="w-full px-4 py-3 rounded-lg bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
              />
              <p className="text-xs text-gray-400 mt-1">
                Your session cookie is stored securely and only used to sync your Brightspace data. It expires after a few hours — you may need to reconnect periodically.
              </p>
            </div>

            <button
              onClick={saveCookie}
              disabled={!bsCookie.trim() || saving}
              className="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Link2 size={18} />
              {saving ? 'Connecting...' : 'Connect Brightspace'}
            </button>
          </div>
        ) : null}

        {/* Sync result */}
        {syncResult && (
          <div className={`mt-4 p-3 rounded-lg text-sm ${
            syncResult.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
              : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-start gap-2">
              {syncResult.type === 'success' ? <CheckCircle size={16} className="mt-0.5" /> : <AlertCircle size={16} className="mt-0.5" />}
              <span>{syncResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* Future: Brightspace OAuth */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-dashed border-gray-300 dark:border-gray-600">
        <h3 className="font-semibold text-gray-500 dark:text-gray-400 mb-2">Coming Soon: One-Click Brightspace Login</h3>
        <p className="text-sm text-gray-400 dark:text-gray-500">
          We're working on official Brightspace OAuth integration so you can connect with a single click — no cookie pasting needed.
          This requires university IT approval.
        </p>
      </div>

      {/* App Info */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-600 py-4">
        <p>EduSync v1.0 — Built for students, by students</p>
      </div>
    </div>
  )
}
