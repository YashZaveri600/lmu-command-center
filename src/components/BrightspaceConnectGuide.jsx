import React, { useState } from 'react'
import { Copy, Check, ExternalLink, Apple, Monitor, PlayCircle } from 'lucide-react'

// Illustrated step-by-step guide for connecting a Brightspace account via
// session cookie paste. Designed to be impossible to get wrong.
export default function BrightspaceConnectGuide() {
  const [os, setOs] = useState(detectOs())
  const [copied, setCopied] = useState('')

  const shortcut = os === 'mac' ? '\u2325 \u2318 I' : 'F12  (or  Ctrl + Shift + I)'

  function copy(text, key) {
    navigator.clipboard?.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Connect your Brightspace account</h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">5 steps, ~90 seconds. Cookies are stored encrypted and only used to sync your own data.</p>
        </div>

        {/* OS switcher */}
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
          <button
            onClick={() => setOs('mac')}
            className={`flex items-center gap-1.5 px-3 py-1.5 ${os === 'mac' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Apple size={12} /> Mac
          </button>
          <button
            onClick={() => setOs('pc')}
            className={`flex items-center gap-1.5 px-3 py-1.5 ${os === 'pc' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <Monitor size={12} /> Windows / Linux
          </button>
        </div>
      </div>

      {/* Optional video slot — drop a <video> or Loom embed here when you record one */}
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border border-dashed border-blue-300 dark:border-blue-800 rounded-lg p-3 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white dark:bg-gray-800 flex items-center justify-center">
          <PlayCircle size={20} className="text-blue-500" />
        </div>
        <div className="flex-1 text-xs">
          <p className="font-medium text-gray-900 dark:text-white">Watch a 60-second walkthrough (optional)</p>
          <p className="text-gray-500 dark:text-gray-400">Video coming soon — the steps below work perfectly on their own.</p>
        </div>
      </div>

      {/* Steps */}
      <Step
        num={1}
        title="Open Brightspace and log in"
        description="You need to already be signed in so your session is active."
        action={
          <a
            href="https://brightspace.lmu.edu"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            Open brightspace.lmu.edu <ExternalLink size={12} />
          </a>
        }
      >
        <BrowserMockup url="brightspace.lmu.edu" />
      </Step>

      <Step
        num={2}
        title="Open Developer Tools"
        description={
          <>Press <Kbd>{shortcut}</Kbd> while you're on the Brightspace tab. A panel opens on the right or bottom of the browser.</>
        }
      >
        <ShortcutVisual os={os} />
      </Step>

      <Step
        num={3}
        title={<>Click <span className="text-blue-600 dark:text-blue-400">Application</span> tab, then open <span className="text-blue-600 dark:text-blue-400">Cookies</span> &rarr; brightspace.lmu.edu</>}
        description="If you don't see Application, click the >> icon at the top of the DevTools tabs to reveal more."
      >
        <DevToolsMockup />
      </Step>

      <Step
        num={4}
        title="Copy the Value of BOTH cookies"
        description="Find the two rows named below. Click each cookie, then copy its Value (NOT the Name — the long random-looking string)."
      >
        <div className="space-y-2">
          <CookieRow
            name="d2lSessionVal"
            onCopy={() => copy('d2lSessionVal', 'name1')}
            copied={copied === 'name1'}
          />
          <CookieRow
            name="d2lSecureSessionVal"
            onCopy={() => copy('d2lSecureSessionVal', 'name2')}
            copied={copied === 'name2'}
          />
          <p className="text-[11px] text-gray-500 dark:text-gray-400 pt-1">
            Tip: click the cookie row, then copy the <span className="font-mono font-medium">Value</span> field from the details panel below (not the row itself).
          </p>
        </div>
      </Step>

      <Step
        num={5}
        title="Paste both into the fields below"
        description="Session values are long random strings. After you paste, click Connect Brightspace."
        isLast
      />
    </div>
  )
}

// ─── Subcomponents ───

function Step({ num, title, description, action, children, isLast }) {
  return (
    <div className="relative">
      {!isLast && <span className="absolute left-[14px] top-8 bottom-0 w-px bg-gray-200 dark:bg-gray-700" />}
      <div className="flex gap-3">
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
          {num}
        </div>
        <div className="flex-1 pb-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
          {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
          {action && <div className="mt-1.5">{action}</div>}
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </div>
  )
}

function Kbd({ children }) {
  return (
    <kbd className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-mono text-[10px] shadow-sm">
      {children}
    </kbd>
  )
}

// A mini mock of a browser address bar showing the URL
function BrowserMockup({ url }) {
  return (
    <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden max-w-md">
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-200 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <div className="flex-1 ml-2 mr-2 bg-white dark:bg-gray-700 rounded-md px-2 py-0.5 text-[11px] font-mono text-gray-600 dark:text-gray-300 truncate">
          🔒 {url}
        </div>
      </div>
      <div className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500">
        (your Brightspace home page)
      </div>
    </div>
  )
}

// Visual showing DevTools shortcut
function ShortcutVisual({ os }) {
  const keys = os === 'mac' ? ['⌥', '⌘', 'I'] : ['F12']
  return (
    <div className="bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md p-3 inline-flex items-center gap-2">
      <span className="text-[11px] text-gray-500 dark:text-gray-400 mr-1">Press:</span>
      {keys.map((k, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-xs text-gray-400">+</span>}
          <kbd className="inline-flex items-center justify-center px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-mono text-xs shadow-sm min-w-[24px]">
            {k}
          </kbd>
        </React.Fragment>
      ))}
      {os === 'pc' && (
        <>
          <span className="text-xs text-gray-400 ml-2">or</span>
          <kbd className="inline-flex items-center px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-mono text-[10px] shadow-sm">Ctrl</kbd>
          <span className="text-xs text-gray-400">+</span>
          <kbd className="inline-flex items-center px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-mono text-[10px] shadow-sm">Shift</kbd>
          <span className="text-xs text-gray-400">+</span>
          <kbd className="inline-flex items-center px-1.5 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-mono text-[10px] shadow-sm">I</kbd>
        </>
      )}
    </div>
  )
}

// Visual mockup of Chrome DevTools Application → Cookies layout
function DevToolsMockup() {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden max-w-xl">
      {/* DevTools tab bar */}
      <div className="flex items-center gap-1 px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[11px]">
        <span className="px-2 py-0.5 text-gray-400">Elements</span>
        <span className="px-2 py-0.5 text-gray-400">Console</span>
        <span className="px-2 py-0.5 text-gray-400">Sources</span>
        <span className="px-2 py-0.5 text-gray-400">Network</span>
        <span className="px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium">Application</span>
        <span className="px-2 py-0.5 text-gray-400">Security</span>
      </div>
      <div className="flex">
        {/* Sidebar */}
        <div className="w-40 bg-gray-50 dark:bg-gray-800/50 border-r border-gray-200 dark:border-gray-700 py-2 text-[11px]">
          <div className="px-2 text-gray-400 uppercase text-[9px] tracking-wide mb-1">Storage</div>
          <div className="px-3 py-0.5 text-gray-500 dark:text-gray-400">Local Storage</div>
          <div className="px-3 py-0.5 text-gray-500 dark:text-gray-400">Session Storage</div>
          <div className="px-3 py-0.5 font-semibold text-blue-700 dark:text-blue-300">▼ Cookies</div>
          <div className="px-6 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-medium">brightspace.lmu.edu</div>
          <div className="px-3 py-0.5 text-gray-500 dark:text-gray-400">IndexedDB</div>
        </div>
        {/* Cookie table */}
        <div className="flex-1 text-[11px]">
          <div className="flex px-2 py-1 border-b border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 font-medium text-gray-600 dark:text-gray-300">
            <div className="w-40">Name</div>
            <div className="flex-1">Value</div>
          </div>
          <div className="flex px-2 py-1 border-b border-gray-100 dark:border-gray-700/50 text-gray-500 dark:text-gray-400">
            <div className="w-40 font-mono">some_other_cookie</div>
            <div className="flex-1 truncate font-mono">abc123...</div>
          </div>
          <div className="flex px-2 py-1 border-b border-gray-100 dark:border-gray-700/50 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 font-semibold">
            <div className="w-40 font-mono">d2lSessionVal</div>
            <div className="flex-1 truncate font-mono">← copy this value</div>
          </div>
          <div className="flex px-2 py-1 border-b border-gray-100 dark:border-gray-700/50 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-900 dark:text-yellow-200 font-semibold">
            <div className="w-40 font-mono">d2lSecureSessionVal</div>
            <div className="flex-1 truncate font-mono">← and this one</div>
          </div>
          <div className="flex px-2 py-1 text-gray-500 dark:text-gray-400">
            <div className="w-40 font-mono">d2lSomethingElse</div>
            <div className="flex-1 truncate font-mono">xyz789...</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CookieRow({ name, onCopy, copied }) {
  return (
    <div className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2">
      <code className="text-xs font-mono text-gray-800 dark:text-gray-200">{name}</code>
      <button
        onClick={onCopy}
        className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        {copied ? <><Check size={11} className="text-green-500" /> Copied name</> : <><Copy size={11} /> Copy name</>}
      </button>
    </div>
  )
}

function detectOs() {
  if (typeof navigator === 'undefined') return 'mac'
  const ua = navigator.userAgent || ''
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return 'mac'
  return 'pc'
}
