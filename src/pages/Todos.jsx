import React, { useState } from 'react'
import { Plus, Trash2, Zap, Bot, BookOpen } from 'lucide-react'
import CourseBadge from '../components/CourseBadge'
import { patchTodo, createTodo, deleteTodo } from '../hooks/useData'

export default function Todos({ todos, courses, setTodos }) {
  const [showAdd, setShowAdd] = useState(false)
  const [newTask, setNewTask] = useState('')
  const [newCourse, setNewCourse] = useState('managing')
  const [newDue, setNewDue] = useState('')
  const [newPriority, setNewPriority] = useState('medium')

  if (!todos || !courses) return null

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
        {pending.map(item => (
          <TodoItem key={item.id} item={item} courses={courses} onToggle={toggle} onDelete={handleDelete} priorityColors={priorityColors} />
        ))}
      </div>

      {completed.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 dark:text-gray-500 mb-2">
            Completed ({completed.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {completed.map(item => (
              <TodoItem key={item.id} item={item} courses={courses} onToggle={toggle} onDelete={handleDelete} priorityColors={priorityColors} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function TodoItem({ item, courses, onToggle, onDelete, priorityColors }) {
  const isOverdue = !item.done && item.due && new Date(item.due + 'T23:59:59') < new Date()

  return (
    <div className={`border rounded-lg p-3 flex items-center gap-3 group ${
      isOverdue
        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
        : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
    }`}>
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
  )
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
