import React, { useState, useMemo } from 'react'
import {
  ChevronRight, ChevronDown, Folder, FileText, Link as LinkIcon,
  Video, Image as ImageIcon, BookOpen, ClipboardCheck, MessageSquare, HelpCircle,
  RefreshCw, Search, ExternalLink, Download,
  Presentation, Sheet, Music, Archive,
} from 'lucide-react'

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

  // Build tree
  const tree = useMemo(() => buildTree(items), [items])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query) return tree
    return filterTree(tree, query)
  }, [tree, query])

  const total = items.length
  const isOpen = open || query.length > 0

  if (query && filtered.length === 0) return null

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!isOpen)}
        className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
      >
        {isOpen
          ? <ChevronDown size={18} className="text-gray-400" />
          : <ChevronRight size={18} className="text-gray-400" />}
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: course.color }} />
        <span className="font-medium text-sm text-gray-900 dark:text-white flex-1 text-left">
          {course.name}
        </span>
        <span className="text-xs text-gray-400">{total} items</span>
      </button>
      {isOpen && (
        <div className="border-t border-gray-100 dark:border-gray-700 px-3 py-2">
          {filtered.length === 0
            ? <p className="text-sm text-gray-400 italic py-3 px-3">No items.</p>
            : filtered.map(node => (
                <TreeNode key={node.bsId} node={node} depth={0} forceOpen={query.length > 0} />
              ))}
        </div>
      )}
    </div>
  )
}

function TreeNode({ node, depth, forceOpen }) {
  const [open, setOpen] = useState(forceOpen)
  const isOpen = open || forceOpen
  const hasChildren = node.children && node.children.length > 0
  const indent = { paddingLeft: `${depth * 18 + 8}px` }

  if (node.type === 'module' || hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!isOpen)}
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
              <TreeNode key={child.bsId} node={child} depth={depth + 1} forceOpen={forceOpen} />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Leaf (topic/file/link/etc.)
  const kind = detectFileType(node.url, node.type)
  const willDownload = isDownloadType(kind)
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
