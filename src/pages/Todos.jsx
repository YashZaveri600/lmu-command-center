import React, { useState } from 'react'
import { Plus, Trash2, Zap, Bot, BookOpen, ChevronDown, ChevronRight, ClipboardList } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'
import { SkelPage } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { CheckCircle2 } from 'lucide-react'
import { patchTodo, createTodo, deleteTodo } from '../hooks/useData'

export default function Todos({ todos, courses, setTodos }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newCourse, setNewCourse] = useState('managing')
  const [newDue, setNewDue] = useState('')
  const [newPriority, setNewPriority] = useState('medium')
  const [expandedId, setExpandedId] = useState(null)

  if (!todos || !courses) return <SkelPage rows={5} />


  const toggle = async (id) => {
    const todo = todos.find(t => t.id === id)
    if (!todo) return
    await patchTodo(id, { done: !todo.done })
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t))
  }

  const handleAdd = async () => {
    if (!newTask.trim()) return
    const created = await createTodo({ task: newTask, course: newCourse, due: newDue, priority: newPriority })
    setTodos([...todos, created])
    setNewTask('')
    setNewDue('')
    setShowAdd(false)
  }

  const handleDelete = async (id) => {
    await deleteTodo(id)
    setTodos(todos.filter(t => t.id !== id))
  }

  const priorityOrder = { high: 0, medium: 1, low: 2 }
  const pending = todos.filter(t => !t.done).sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
  const completed = todos.filter(t => t.done)

  const priorityColors = {
    high: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    medium: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20',
    low: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20',
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Weekly To-Do</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {pending.length} remaining
          </span>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1 px-3 py-1.5 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus size={14} /> Add Task
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
          <input
            type="text"
            value={newTask}
            onChange={e => setNewTask(e.target.value)}
            placeholder="What do you need to do?"
            className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex flex-wrap gap-3">
            <select value={newCourse} onChange={e => setNewCourse(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="date" value={newDue} onChange={e => setNewDue(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300" />
            <select value={newPriority} onChange={e => setNewPriority(e.target.value)} className="text-xs border border-gray-200 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300">
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <button onClick={handleAdd} className="text-xs bg-blue-500 text-white px-4 py-1.5 rounded hover:bg-blue-600">Save</button>
            <button onClick={() => setShowAdd(false)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1.5">Cancel</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={22} />}
            title="All caught up"
            message="No pending tasks. Add one above or wait for Brightspace to sync something."
          />
        ) : (
          pending.map(item => (
            <TodoItem
              key={item.id} item={item} courses={courses}
              onToggle={toggle} onDelete={handleDelete}
              priorityColors={priorityColors}
              expanded={expandedId === item.id}
              onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
            />
          ))
        )}
      </div>

      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-2">
            Completed ({completed.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {completed.map(item => (
              <TodoItem
                key={item.id} item={item} courses={courses}
                onToggle={toggle} onDelete={handleDelete}
                priorityColors={priorityColors}
                expanded={expandedId === item.id}
                onExpand={() => setExpandedId(expandedId === item.id ? null : item.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TodoItem({ item, courses, onToggle, onDelete, priorityColors, expanded, onExpand }) {
  const isOverdue = !item.done && item.due && new Date(item.due + 'T23:59:59') < new Date()
  const hasRubric = Array.isArray(item.rubric) && item.rubric.length > 0

  const borderClass = isOverdue
    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
    : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'

  return (
    <div className={`border rounded-lg overflow-hidden ${borderClass}`}>
      <div className="p-3 flex items-center gap-3 group">
        <input
          type="checkbox"
          checked={item.done}
          onChange={() => onToggle(item.id)}
          className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
        />
        <CourseBadge courseId={item.course} courses={courses} />
        <span className={`flex-1 text-sm ${item.done ? 'line-through text-gray-400' : isOverdue ? 'text-red-700 dark:text-red-400 font-medium' : 'text-gray-900 dark:text-white'}`}>
          {item.task}
        </span>
        {hasRubric && (
          <button
            onClick={onExpand}
            title={expanded ? 'Hide grading rubric' : 'Show grading rubric'}
            className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors"
          >
            <ClipboardList size={10} /> RUBRIC
            {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
          </button>
        )}
        {item.source && item.source !== 'manual' && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center gap-1" title={
            item.source === 'brightspace' ? 'Synced from Brightspace' :
            item.source?.startsWith('ai') ? 'Detected by AI' : item.source
          }>
            {item.source === 'brightspace' ? <BookOpen size={10} /> : <Bot size={10} />}
            {item.source === 'brightspace' ? 'BS' : 'AI'}
          </span>
        )}
        {isOverdue ? (
          <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
            OVERDUE
          </span>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityColors[item.priority]}`}>
            {item.priority}
          </span>
        )}
        <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>{item.due ? formatDate(item.due) : ''}</span>
        <button
          onClick={() => onDelete(item.id)}
          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {hasRubric && expanded && (
        <RubricPanel rubrics={item.rubric} />
      )}
    </div>
  )
}

// Grading rubric detail panel — renders each rubric as a criteria × levels grid.
function RubricPanel({ rubrics }) {
  return (
    <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 px-4 py-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
        <ClipboardList size={12} /> How you'll be graded
      </p>
      {rubrics.map((rubric, ri) => (
        <div key={rubric.id || ri} className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white">{rubric.name}</h4>
            {rubric.description && (
              <p
                className="text-xs text-gray-500 dark:text-gray-400 mt-1"
                dangerouslySetInnerHTML={{ __html: stripLinks(rubric.description) }}
              />
            )}
          </div>
          {Array.isArray(rubric.criteria) && rubric.criteria.length > 0 ? (
            <div className="space-y-3">
              {rubric.criteria.map((c, ci) => (
                <div key={ci} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                    {c.description && (
                      <p
                        className="text-xs text-gray-500 dark:text-gray-400 mt-0.5"
                        dangerouslySetInnerHTML={{ __html: stripLinks(c.description) }}
                      />
                    )}
                  </div>
                  {Array.isArray(c.levels) && c.levels.length > 0 && (
                    <div className="grid gap-px bg-gray-100 dark:bg-gray-700"
                         style={{ gridTemplateColumns: `repeat(${c.levels.length}, minmax(0, 1fr))` }}>
                      {c.levels.map((l, li) => (
                        <div key={li} className="bg-white dark:bg-gray-800 p-2.5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">{l.name || `Level ${li + 1}`}</span>
                            {typeof l.points === 'number' && (
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded flex-shrink-0 ml-1">
                                {l.points} pts
                              </span>
                            )}
                          </div>
                          {l.description && (
                            <p
                              className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug"
                              dangerouslySetInnerHTML={{ __html: stripLinks(l.description) }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 italic">No criteria details available.</p>
          )}
        </div>
      ))}
    </div>
  )
}

// Strip anchor tags from Brightspace rubric HTML so they can't hijack clicks
// or render as broken links on our domain — same safety approach as Updates.
function stripLinks(html) {
  if (!html) return ''
  return html.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
