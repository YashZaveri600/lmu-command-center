import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

// React error boundary. Wrap each page-level component so one
// runtime error never brings the whole app down.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log for dev + Railway logs
    console.error('[ErrorBoundary]', this.props.label || 'unknown', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    // A hard reload is usually the cleanest recovery
    if (typeof window !== 'undefined') window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const msg = this.state.error?.message || 'Unknown error'
    return (
      <div className="flex items-start justify-center py-12">
        <div className="max-w-lg w-full bg-white dark:bg-gray-800 border border-red-200 dark:border-red-900 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertTriangle size={22} className="text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Something went wrong</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {this.props.label
                  ? <>The <span className="font-medium">{this.props.label}</span> page hit an error and couldn't render.</>
                  : "This page hit an error and couldn't render."}
              </p>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded px-3 py-2">
            <p className="text-xs font-mono text-gray-600 dark:text-gray-300 break-words">{msg}</p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={this.handleReload}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <RefreshCw size={14} /> Reload page
            </button>
            <button
              onClick={this.handleReset}
              className="px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    )
  }
}
