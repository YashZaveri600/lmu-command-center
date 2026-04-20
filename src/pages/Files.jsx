import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronRight, ChevronDown, Folder, FileText, Link as LinkIcon,
  Video, Image as ImageIcon, BookOpen, ClipboardCheck, MessageSquare, HelpCircle,
  RefreshCw, Search, ExternalLink, Download, Star, CheckCircle2, AlertCircle,
  Presentation, Sheet, Music, Archive,
} from 'lucide-react'

// API base — mirrors the convention used elsewhere in the app.
const API = import.meta.env.DEV
  ? `http://${window.location.hostname}:3001/api`
  : '/api'

// "2m ago" / "1h ago" / "Yesterday" / date
function formatRelative(d) {
  if (!d) return null
  const now = Date.now()
  const diffMs = now - d.getTime()
  const sec = Math.round(diffMs / 1000)
  if (sec < 60) return 'Just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`
  const day = Math.round(hr / 24)
  if (day === 1) return 'Yesterday'
  if (day < 7) return `${day} days ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Color tokens for the file-type badge (match the icon colors from Step 1).
const BADGE_COLORS = {
  pdf: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  pptx: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  docx: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  xlsx: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  video: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  image: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  audio: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  archive: 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
  link: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  page: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  quiz: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  discussion: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  dropbox: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  scorm: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  unknown: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

// Short fallback labels for kinds that don't have a file extension.
const KIND_LABELS = {
  link: 'LINK',
  page: 'PAGE',
  quiz: 'QUIZ',
  discussion: 'FORUM',
  dropbox: 'ASSIGN',
  scorm: 'SCORM',
}

// Compute { label, color } for the trailing badge next to a leaf filename.
// Prefers the real file extension (PDF, PPTX, MP4...) when present.
// Returns null when nothing meaningful to show (e.g., unknown + no url).
function getBadge(url, kind) {
  if (url) {
    const clean = url.split('?')[0].split('#')[0].toLowerCase()
    const m = clean.match(/\.([a-z0-9]{2,5})$/)
    if (m) {
      const label = m[1].toUpperCase()
      const color = BADGE_COLORS[kind] || BADGE_COLORS.unknown
      return { label, color }
    }
  }
  if (KIND_LABELS[kind]) {
    return { label: KIND_LABELS[kind], color: BADGE_COLORS[kind] || BADGE_COLORS.unknown }
  }
  return null
}

// Compute the display breakdown "X files · Y folders · Z links" for a course.
// Modules count as folders; precise file kinds count as files; everything else
// (link, page, quiz, discussion, dropbox, scorm, unknown) counts as links.
function breakdownCounts(items) {
  let folders = 0, files = 0, links = 0
  for (const item of items) {
    if (item.type === 'module') { folders++; continue }
    const kind = detectFileType(item.url, item.type)
    if (['pdf', 'pptx', 'docx', 'xlsx', 'video', 'image', 'audio', 'archive'].includes(kind)) {
      files++
    } else {
      links++
    }
  }
  return { folders, files, links }
}

function countsLabel(counts) {
  const parts = []
  if (counts.files) parts.push(`${counts.files} file${counts.files === 1 ? '' : 's'}`)
  if (counts.folders) parts.push(`${counts.folders} folder${counts.folders === 1 ? '' : 's'}`)
  if (counts.links) parts.push(`${counts.links} link${counts.links === 1 ? '' : 's'}`)
  return parts.join(' · ')
}

// Collect every module bsId in the items list — used for "Expand all".
function collectModuleIds(items) {
  const out = new Set()
  for (const item of items) if (item.type === 'module') out.add(item.bsId)
  return out
}

// Pick the best "syllabus" item for a course from the content tree.
// Prefer a leaf file/page/link whose title contains "syllabus"; fall back
// to any item (including a module) whose title contains "syllabus".
function findSyllabus(items) {
  if (!items || items.length === 0) return null
  const leaf = items.find(
    c =>
      /syllabus/i.test(c.title) &&
      ['file', 'page', 'link', 'pdf', 'pptx', 'docx'].includes(c.type)
  )
  if (leaf) return leaf
  return items.find(c => /syllabus/i.test(c.title)) || null
}

// Detect a precise file kind from the URL extension.
// Falls back to the Brightspace content type if no extension match.
function detectFileType(url, type) {
  if (url) {
    // Strip query string and fragment, lowercase for matching
    const clean = url.split('?')[0].split('#')[0].toLowerCase()
    // Extract extension (handles paths with dots in dirnames)
    const m = clean.match(/\.([a-z0-9]{2,5})$/)
    if (m) {
      const ext = m[1]
      if (ext === 'pdf') return 'pdf'
      if (ext === 'pptx' || ext === 'ppt') return 'pptx'
      if (ext === 'docx' || ext === 'doc' || ext === 'rtf') return 'docx'
      if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') return 'xlsx'
      if (['mp4', 'mov', 'webm', 'm4v', 'mkv', 'avi'].includes(ext)) return 'video'
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
      if (['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext)) return 'audio'
      if (['zip', 'rar', '7z', 'tar', 'gz', 'tgz'].includes(ext)) return 'archive'
    }
  }
  // Fall back to the high-level type the sync stored
  if (type && ['quiz', 'discussion', 'dropbox', 'scorm', 'page', 'link', 'module'].includes(type)) {
    return type
  }
  return 'unknown'
}

// True for file kinds that browsers can't preview inline — clicking will download.
function isDownloadType(kind) {
  return ['pptx', 'docx', 'xlsx', 'archive'].includes(kind)
}

// Human-friendly label for tooltips, using the real extension when available.
function actionLabel(url, kind) {
  if (isDownloadType(kind)) {
    const m = (url || '').split('?')[0].match(/\.([a-zA-Z0-9]{2,5})$/)
    const ext = m ? m[1].toLowerCase() : kind
    return `Downloads .${ext} file`
  }
  return 'Opens in new tab'
}

// Map the detected kind to a distinct icon + color.
function IconFor({ kind, className = '' }) {
  const map = {
    module: <Folder size={14} className={`text-yellow-500 ${className}`} />,
    pdf: <FileText size={14} className={`text-red-500 ${className}`} />,
    pptx: <Presentation size={14} className={`text-orange-500 ${className}`} />,
    docx: <FileText size={14} className={`text-blue-500 ${className}`} />,
    xlsx: <Sheet size={14} className={`text-green-500 ${className}`} />,
    video: <Video size={14} className={`text-red-500 ${className}`} />,
    image: <ImageIcon size={14} className={`text-pink-500 ${className}`} />,
    audio: <Music size={14} className={`text-purple-500 ${className}`} />,
    archive: <Archive size={14} className={`text-gray-500 ${className}`} />,
    link: <LinkIcon size={14} className={`text-purple-500 ${className}`} />,
    page: <BookOpen size={14} className={`text-gray-500 ${className}`} />,
    quiz: <HelpCircle size={14} className={`text-orange-500 ${className}`} />,
    discussion: <MessageSquare size={14} className={`text-pink-500 ${className}`} />,
    dropbox: <ClipboardCheck size={14} className={`text-green-500 ${className}`} />,
    scorm: <BookOpen size={14} className={`text-indigo-500 ${className}`} />,
    file: <FileText size={14} className={`text-blue-500 ${className}`} />,
  }
  return map[kind] || <FileText size={14} className={`text-gray-400 ${className}`} />
}

export default function Files({ courses, courseContent, setCourses }) {
  const [query, setQuery] = useState('')
  const [lastSync, setLastSync] = useState(null)
  const [syncing, setSyncing] = useState(false)
  const [syncChip, setSyncChip] = useState(null) // { type: 'success'|'error', message }
  // Tick every 30s so the "X min ago" text stays fresh without needing interaction.
  const [, setTick] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  // Fetch last-sync time from backend on mount.
  const refreshStatus = useCallback(() => {
    fetch(`${API}/brightspace/status`, { credentials: 'include' })
      .then(r => r.json())
      .then(data => { if (data.lastSync) setLastSync(new Date(data.lastSync)) })
      .catch(() => {})
  }, [])
  useEffect(() => { refreshStatus() }, [refreshStatus])

  // Trigger a full Brightspace sync.
  const handleResync = async () => {
    if (syncing) return
    setSyncing(true)
    setSyncChip(null)
    try {
      const res = await fetch(`${API}/sync`, { method: 'POST', credentials: 'include' })
      const data = await res.json()
      if (data.ok) {
        setLastSync(new Date())
        setSyncChip({ type: 'success', message: 'Synced' })
      } else {
        setSyncChip({ type: 'error', message: data.error || 'Sync failed' })
      }
    } catch (e) {
      setSyncChip({ type: 'error', message: 'Sync failed' })
    }
    setSyncing(false)
    // Hide the chip after 3s
    setTimeout(() => setSyncChip(null), 3000)
  }

  // Group content by course (safe if courseContent is null)
  const byCourse = useMemo(() => {
    const map = {}
    for (const item of (courseContent || [])) {
      if (!map[item.course]) map[item.course] = []
      map[item.course].push(item)
    }
    return map
  }, [courseContent])

  if (!courses || !courseContent) {
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Course Files</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading content from Brightspace...</p>
      </div>
    )
  }

  // Filter to only courses that have content
  const coursesWithContent = courses.filter(c => (byCourse[c.id] || []).length > 0)

  const total = courseContent.length
  const q = query.trim().toLowerCase()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Course Files</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {total} items synced from Brightspace across {coursesWithContent.length} courses
          </p>
        </div>
      </div>

      {/* Sync status + Resync button */}
      <div className="flex items-center justify-between flex-wrap gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span>
            {lastSync
              ? <>Last synced <span className="text-gray-700 dark:text-gray-200">{formatRelative(lastSync)}</span></>
              : 'Not synced yet'}
          </span>
          {syncChip && (
            <span
              className={`ml-2 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                syncChip.type === 'success'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                  : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
              }`}
            >
              {syncChip.type === 'success' ? <CheckCircle2 size={11} /> : <AlertCircle size={11} />}
              {syncChip.message}
            </span>
          )}
        </div>
        <button
          onClick={handleResync}
          disabled={syncing}
          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'Syncing...' : 'Resync'}
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search files, modules, links..."
          className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {coursesWithContent.length === 0 && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center">
          <Folder size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No course content yet. Run a sync from Settings to pull your Brightspace files.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {coursesWithContent.map(course => (
          <CourseBlock
            key={course.id}
            course={course}
            items={byCourse[course.id] || []}
            query={q}
          />
        ))}
      </div>
    </div>
  )
}

function CourseBlock({ course, items, query }) {
  const [open, setOpen] = useState(query.length > 0)
  // Lifted expansion state — a Set of module bsIds currently expanded.
  const [expandedSet, setExpandedSet] = useState(() => new Set())

  // Build tree
  const tree = useMemo(() => buildTree(items), [items])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query) return tree
    return filterTree(tree, query)
  }, [tree, query])

  // Syllabus pinned to the top (also still visible in the tree below)
  const syllabus = useMemo(() => findSyllabus(items), [items])

  // Counts breakdown
  const counts = useMemo(() => breakdownCounts(items), [items])
  const label = countsLabel(counts)

  const isOpen = open || query.length > 0

  const toggleNode = (bsId) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      if (next.has(bsId)) next.delete(bsId)
      else next.add(bsId)
      return next
    })
  }

  const handleExpandAll = (e) => {
    e.stopPropagation()
    setExpandedSet(collectModuleIds(items))
    setOpen(true)
  }
  const handleCollapseAll = (e) => {
    e.stopPropagation()
    setExpandedSet(new Set())
  }

  if (query && filtered.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div
        onClick={() => setOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
      >
        {isOpen
          ? <ChevronDown size={18} className="text-gray-400" />
          : <ChevronRight size={18} className="text-gray-400" />}
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
        <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 text-left">
          {course.name}
        </span>
        {/* Expand/Collapse all — stop propagation so they don't toggle the course header */}
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <button
            onClick={handleExpandAll}
            className="hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Expand all
          </button>
          <span className="text-gray-300 dark:text-gray-600">|</span>
          <button
            onClick={handleCollapseAll}
            className="hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Collapse all
          </button>
        </div>
        <span className="text-xs text-gray-400 ml-2">{label}</span>
      </div>
      {isOpen && (
        <>
          {syllabus && <PinnedSyllabus item={syllabus} />}
          <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
            {filtered.length === 0
              ? <p className="text-sm text-gray-400 italic py-3 px-3">No items.</p>
              : filtered.map(node => (
                  <TreeNode
                    key={node.bsId}
                    node={node}
                    depth={0}
                    forceOpen={query.length > 0}
                    expandedSet={expandedSet}
                    onToggle={toggleNode}
                  />
                ))}
          </div>
        </>
      )}
    </div>
  )
}

// Pinned syllabus shortcut — shown above the tree when detected.
function PinnedSyllabus({ item }) {
  const kind = detectFileType(item.url, item.type)
  const willDownload = isDownloadType(kind)
  const badge = getBadge(item.url, kind)
  const hasUrl = Boolean(item.url)
  const Tag = hasUrl ? 'a' : 'div'
  const linkProps = hasUrl
    ? {
        href: item.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: actionLabel(item.url, kind),
      }
    : {}
  return (
    <Tag
      {...linkProps}
      className={`flex items-center gap-3 px-4 py-3 border-t border-gray-100 dark:border-gray-700 bg-indigo-50 dark:bg-indigo-900/20 group ${
        hasUrl ? 'hover:bg-indigo-100 dark:hover:bg-indigo-900/30 cursor-pointer' : ''
      }`}
    >
      <Star size={14} className="text-indigo-500 fill-indigo-500 flex-shrink-0" />
      <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 flex-shrink-0">
        Syllabus
      </span>
      <span className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
        {item.title}
      </span>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide flex-shrink-0 ${badge.color}`}>
          {badge.label}
        </span>
      )}
      {hasUrl && (
        willDownload
          ? <Download size={13} className="text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-200 flex-shrink-0" />
          : <ExternalLink size={13} className="text-indigo-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-200 flex-shrink-0" />
      )}
    </Tag>
  )
}

function TreeNode({ node, depth, forceOpen, expandedSet, onToggle }) {
  const isOpen = forceOpen || expandedSet.has(node.bsId)
  const hasChildren = node.children && node.children.length > 0
  const indent = { paddingLeft: `${depth * 18 + 8}px` }

  if (node.type === 'module' || hasChildren) {
    return (
      <div>
        <button
          onClick={() => onToggle(node.bsId)}
          className="flex items-center gap-2 py-1.5 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 rounded"
          style={indent}
        >
          {isOpen
            ? <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
            : <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
          <IconFor kind="module" />
          <span className="text-sm text-gray-700 dark:text-gray-200 truncate">{node.title}</span>
          {hasChildren && (
            <span className="text-xs text-gray-400 ml-1 flex-shrink-0">({node.children.length})</span>
          )}
        </button>
        {isOpen && hasChildren && (
          <div>
            {node.children.map(child => (
              <TreeNode
                key={child.bsId}
                node={child}
                depth={depth + 1}
                forceOpen={forceOpen}
                expandedSet={expandedSet}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Leaf (topic/file/link/etc.)
  const kind = detectFileType(node.url, node.type)
  const willDownload = isDownloadType(kind)
  const badge = getBadge(node.url, kind)
  const Tag = node.url ? 'a' : 'div'
  const linkProps = node.url
    ? {
        href: node.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: actionLabel(node.url, kind),
      }
    : {}
  return (
    <Tag
      {...linkProps}
      className={`flex items-center gap-2 py-1.5 group ${node.url ? 'hover:bg-gray-50 dark:hover:bg-gray-700/30 cursor-pointer' : ''} rounded`}
      style={{ paddingLeft: `${depth * 18 + 22}px`, paddingRight: '8px' }}
    >
      <IconFor kind={kind} />
      <span className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 group-hover:text-gray-900 dark:group-hover:text-white">
        {node.title}
      </span>
      {badge && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wide flex-shrink-0 ${badge.color}`}>
          {badge.label}
        </span>
      )}
      {node.url && (
        willDownload
          ? <Download size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300 flex-shrink-0" />
          : <ExternalLink size={12} className="text-gray-300 dark:text-gray-600 group-hover:text-gray-500 dark:group-hover:text-gray-300 flex-shrink-0" />
      )}
    </Tag>
  )
}

// Build a tree from flat items using bsId / parentBsId
function buildTree(items) {
  const byId = new Map()
  for (const item of items) {
    byId.set(item.bsId, { ...item, children: [] })
  }
  const roots = []
  for (const item of items) {
    const node = byId.get(item.bsId)
    if (item.parentBsId && byId.has(item.parentBsId)) {
      byId.get(item.parentBsId).children.push(node)
    } else {
      roots.push(node)
    }
  }
  return roots
}

// Filter tree — keeps ancestors of any matching node
function filterTree(nodes, query) {
  const out = []
  for (const node of nodes) {
    const titleMatches = node.title.toLowerCase().includes(query)
    const filteredChildren = node.children ? filterTree(node.children, query) : []
    if (titleMatches || filteredChildren.length > 0) {
      out.push({ ...node, children: filteredChildren })
    }
  }
  return out
}
