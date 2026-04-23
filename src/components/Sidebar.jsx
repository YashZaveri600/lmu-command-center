import React from 'react'
import {
  LayoutDashboard, Sunrise, Bell, CheckSquare, Mail, Calendar, CalendarDays,
  FolderOpen, Zap, Target, GraduationCap, StickyNote, Timer,
  Moon, Sun, Flame, LogOut, Settings,
} from 'lucide-react'

// Nav items grouped into sections for visual hierarchy
const NAV_GROUPS = [
  {
    label: 'Today',
    items: [
      { id: 'briefing', label: 'Daily Briefing', icon: Sunrise },
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'focus', label: 'Focus Mode', icon: Target },
    ],
  },
  {
    label: 'Academics',
    items: [
      { id: 'updates', label: 'Brightspace Updates', icon: Bell },
      { id: 'todos', label: 'Weekly To-Do', icon: CheckSquare },
      { id: 'calendar', label: 'Calendar', icon: CalendarDays },
      { id: 'grades', label: 'Grades & GPA', icon: GraduationCap },
      { id: 'files', label: 'Course Files', icon: FolderOpen },
    ],
  },
  {
    label: 'Tools',
    items: [
      { id: 'study', label: 'Study Timer', icon: Timer },
      { id: 'notes', label: 'Quick Notes', icon: StickyNote },
      { id: 'emails', label: 'Professor Emails', icon: Mail },
      { id: 'schedule', label: 'Class Schedule', icon: Calendar },
      { id: 'automations', label: 'Automations', icon: Zap },
    ],
  },
]

export default function Sidebar({ active, activeCourseId, courses = [], onNavigate, dark, toggleDark, urgentCount, streak, semesterProgress, user, onLogout }) {
  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen sticky top-0">
      {/* Brand */}
      <div className="p-5 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onNavigate('briefing')}
          className="flex items-center gap-2.5 w-full text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 10 3 12 0v-5" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">EduSync</h1>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">Spring 2026</p>
          </div>
        </button>
        {semesterProgress != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
              <span>Semester</span>
              <span>{Math.round(semesterProgress)}%</span>
            </div>
            <div className="w-full h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                style={{ width: `${semesterProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi > 0 ? 'mt-3' : ''}>
            <div className="px-5 py-1 text-[10px] uppercase font-semibold tracking-wide text-gray-400 dark:text-gray-500">
              {group.label}
            </div>
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={`relative w-full flex items-center gap-3 pl-5 pr-4 py-2 text-sm transition-colors group ${
                    isActive
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
                  )}
                  <Icon size={17} className={isActive ? 'text-blue-500' : ''} />
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.id === 'updates' && urgentCount > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      {urgentCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}

        {/* My Courses — one entry per enrolled course, click to open its detail page */}
        {courses.length > 0 && (
          <div className="mt-3">
            <div className="px-5 py-1 text-[10px] uppercase font-semibold tracking-wide text-gray-400 dark:text-gray-500">
              My Courses
            </div>
            {courses.map(course => {
              const isActive = active === 'course' && activeCourseId === course.id
              return (
                <button
                  key={course.id}
                  onClick={() => onNavigate({ page: 'course', courseId: course.id })}
                  className={`relative w-full flex items-center gap-3 pl-5 pr-4 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
                  )}
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: course.color }} />
                  <span className="flex-1 text-left truncate">{course.shortCode || course.name}</span>
                </button>
              )
            })}
          </div>
        )}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700 space-y-1">
        {streak > 0 && (
          <div className="flex items-center gap-2 text-sm text-orange-500 px-2 py-1.5">
            <Flame size={16} />
            <span className="font-medium">{streak} day streak</span>
          </div>
        )}

        <button
          onClick={toggleDark}
          className="flex items-center gap-2 w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 rounded-md px-2 py-1.5 transition-colors"
        >
          {dark ? <Sun size={16} /> : <Moon size={16} />}
          {dark ? 'Light Mode' : 'Dark Mode'}
        </button>

        <button
          onClick={() => onNavigate('settings')}
          className={`flex items-center gap-2 w-full text-sm rounded-md px-2 py-1.5 transition-colors ${
            active === 'settings'
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
          }`}
        >
          <Settings size={16} />
          Settings
        </button>

        {user && (
          <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                {(user.displayName || user.email || '?').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{user.displayName}</div>
                <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{user.email}</div>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <LogOut size={12} />
              Sign out
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
