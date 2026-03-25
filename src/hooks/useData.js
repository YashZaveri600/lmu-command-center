import { useState, useEffect, useCallback } from 'react'

const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

export function useAPI(endpoint) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(() => {
    fetch(`${API}/${endpoint}`)
      .then(res => res.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [endpoint])

  useEffect(() => { refresh() }, [refresh])

  return { data, loading, setData, refresh }
}

export function useSSE(onMessage) {
  useEffect(() => {
    const es = new EventSource(`${API}/events`)
    es.onmessage = () => {}
    es.addEventListener('updates', e => onMessage('updates', JSON.parse(e.data)))
    es.addEventListener('todos', e => onMessage('todos', JSON.parse(e.data)))
    es.addEventListener('emails', e => onMessage('emails', JSON.parse(e.data)))
    es.addEventListener('courses', e => onMessage('courses', JSON.parse(e.data)))
    es.addEventListener('automations', e => onMessage('automations', JSON.parse(e.data)))
    es.addEventListener('grades', e => onMessage('grades', JSON.parse(e.data)))
    es.addEventListener('notes', e => onMessage('notes', JSON.parse(e.data)))
    es.addEventListener('study-sessions', e => onMessage('study-sessions', JSON.parse(e.data)))
    return () => es.close()
  }, [onMessage])
}

export async function patchTodo(id, updates) {
  return fetch(`${API}/todos/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }).then(r => r.json())
}

export async function createTodo(todo) {
  return fetch(`${API}/todos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(todo),
  }).then(r => r.json())
}

export async function deleteTodo(id) {
  return fetch(`${API}/todos/${id}`, { method: 'DELETE' }).then(r => r.json())
}

export async function searchAll(query) {
  return fetch(`${API}/search?q=${encodeURIComponent(query)}`).then(r => r.json())
}

export async function syncFiles() {
  return fetch(`${API}/sync-files`, { method: 'POST' }).then(r => r.json())
}

export function getCourseInfo(courses, courseId) {
  if (!courses) return { name: courseId, shortCode: courseId, color: '#666' }
  return courses.find(c => c.id === courseId) || { name: courseId, shortCode: courseId, color: '#666' }
}
