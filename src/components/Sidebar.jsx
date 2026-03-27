import React from 'react'
import { LayoutDashboard, Sunrise, Bell, CheckSquare, Mail, Calendar, CalendarDays, FolderOpen, Zap, Target, GraduationCap, StickyNote, Timer, Moon, Sun, Flame, LogOut, Settings } from 'lucide-react'

const navItems = [
  { id: 'briefing', label: 'Daily Briefing', icon: Sunrise },
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'focus', label: 'Focus Mode', icon: Target },
  { id: 'updates', label: 'Brightspace Updates', icon: Bell },
  { id: 'todos', label: 'Weekly To-Do', icon: CheckSquare },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'grades', label: 'Grades & GPA', icon: GraduationCap },
  { id: 'study', label: 'Study Timer', icon: Timer },
  { id: 'notes', label: 'Quick Notes', icon: StickyNote },
  { id: 'emails', label: 'Professor Emails', icon: Mail },
  { id: 'schedule', label: 'Class Schedule', icon: Calendar },
  { id: 'files', label: 'Course Files', icon: FolderOpen },
  { id: 'automations', label: 'Automations', icon: Zap },
  { id: 'settings', label: 'Settings', icon: Settings },
]

export default function Sidebar({ active, onNavigate, dark, toggleDark, urgentCount, streak, semesterProgress, user, onLogout }) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen sticky top-0">
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">EduSync</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Spring 2026</p>
        {semesterProgress != null && (
          <div className="mt-2">
            <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mb-1">
              <span>Semester</span>
              <span>{Math.round(semesterProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${semesterProgress}%` }} />
            </div>
          </div>
        )}
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-2 text-sm transition-colors ${
                isActive
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <Icon size={17} />
              <span>{item.label}</span>
              {item.id === 'updates' && urgentCount > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {urgentCount}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
        {streak > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-500">
            <Flame size={16} />
            <span>{streak} day streak</span>
          </div>
        )}
        <button
          onClick={toggleDark}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>

        {user && (
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{user.displayName}</div>
            <div className="text-xs text-gray-400 truncate mb-2">{user.email}</div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
