import React from 'react'
import { Zap, Clock, CheckCircle, XCircle } from 'lucide-react'
import { SkelPage } from '../components/Skeleton'

export default function Automations({ automations }) {
  if (!automations) return <SkelPage rows={3} kind="card" />


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Automations</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Status of your scheduled Claude Cowork tasks.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.map(auto => (
          <div key={auto.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Zap size={18} className="text-yellow-500" />
              <h3 className="font-medium text-sm text-gray-900 dark:text-white flex-1">{auto.name}</h3>
              {auto.status === 'active' ? (
                <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                  <CheckCircle size={14} /> Active
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-red-500">
                  <XCircle size={14} /> Inactive
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{auto.description}</p>
            <div className="flex items-center gap-4 text-xs text-gray-400 dark:text-gray-500">
              <span className="flex items-center gap-1">
                <Clock size={12} /> {auto.schedule}
              </span>
              <span>Last: {new Date(auto.lastRun).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
