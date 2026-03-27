import React, { useState, useRef, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'

const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

export default function AiChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hi! I'm EduSync AI. Ask me anything about your courses, grades, or tasks. Try:\n\n• \"What's due this week?\"\n• \"How am I doing in marketing?\"\n• \"What do I need on the final to get an A?\"" }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const res = await fetch(`${API}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: userMsg }),
      })
      const data = await res.json()
      if (data.ok) {
        setMessages(prev => [...prev, { role: 'ai', text: data.response }])
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: data.error || 'Something went wrong. Try again.' }])
      }
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Connection error. Please try again.' }])
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-500 hover:bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
        title="Ask EduSync AI"
      >
        <Sparkles size={24} />
      </button>
    )
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-500 text-white">
        <div className="flex items-center gap-2">
          <Sparkles size={18} />
          <span className="font-semibold text-sm">EduSync AI</span>
        </div>
        <button onClick={() => setOpen(false)} className="hover:bg-blue-600 rounded p-1">
          <X size={16} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-blue-500 text-white rounded-br-sm'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-700 rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Ask about grades, tasks, courses..."
            className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            disabled={loading}
          />
          <button
            onClick={send}
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
