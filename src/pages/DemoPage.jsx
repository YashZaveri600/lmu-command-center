import React, { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, ArrowRight, Check, CheckCheck, LayoutDashboard, ListTodo, BookOpen, TrendingUp, RotateCcw, X, Menu, Search, Sparkles, ChevronRight } from 'lucide-react'
import Brand from '../components/Brand'
import { demoCourses, initialTasks, demoAnnouncements, projectedGrade } from '../demo/data'
import '../showcase.css'

const tabs = [{ id:'today', label:'My day', icon:LayoutDashboard }, { id:'tasks', label:'Assignments', icon:ListTodo }, { id:'courses', label:'My classes', icon:BookOpen }, { id:'grades', label:'Grade explorer', icon:TrendingUp }]
function getCourse(id) { return demoCourses.find(c => c.id === id) }
function dueLabel(offset) { return offset < 0 ? 'Completed' : offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : new Date(Date.now() + offset * 86400000).toLocaleDateString('en-US',{weekday:'short', month:'short',day:'numeric'}) }
function CoursePill({id}) { const c=getCourse(id); return <span className="es-course-pill"><i style={{background:c.color}}/>{c.name}</span> }

function TaskRow({task, onToggle, onOpen}) { return <div className={`es-task-row ${task.done?'is-done':''}`}><button className="es-task-check" aria-label={`${task.done?'Reopen':'Complete'} ${task.title}`} aria-pressed={task.done} onClick={()=>onToggle(task.id)}>{task.done&&<Check size={16}/>}</button><button className="es-task-title" onClick={()=>onOpen(task.id)}><strong>{task.title}</strong><CoursePill id={task.course}/></button><span className={`es-due ${task.offset===0&&!task.done?'is-today':''}`}>{task.done?'Done':dueLabel(task.offset)}</span></div> }

export default function DemoPage() {
  const [tab,setTab] = useState('today')
  const [tasks,setTasks] = useState(() => initialTasks.map(t=>({...t})))
  const [filter,setFilter] = useState('all')
  const [query,setQuery] = useState('')
  const [courseFilter,setCourseFilter] = useState('all')
  const [selectedCourse,setSelectedCourse] = useState('brand')
  const [finalScore,setFinalScore] = useState(90)
  const [mobileOpen,setMobileOpen] = useState(false)
  const [notice,setNotice] = useState('')
  const [detail,setDetail] = useState(null)
  const pending=tasks.filter(t=>!t.done)
  const completed=tasks.length-pending.length
  const current=demoCourses.find(c=>c.id===selectedCourse)
  const projection=projectedGrade(current.completed,current.finalWeight,finalScore)
  const visible=useMemo(()=>tasks.filter(t=>(filter==='all'||(filter==='completed'?t.done:!t.done))&&(courseFilter==='all'||t.course===courseFilter)&&`${t.title} ${getCourse(t.course).name}`.toLowerCase().includes(query.toLowerCase())),[tasks,filter,query,courseFilter])
  useEffect(()=>{document.title='EduSync — Interactive demo'},[])
  useEffect(()=>{ if(!notice) return; const timer=setTimeout(()=>setNotice(''),3500); return()=>clearTimeout(timer)},[notice])
  useEffect(()=>{const close=e=>{if(e.key==='Escape'){setDetail(null);setMobileOpen(false)}}; window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close)},[])
  function navigate(id) { setTab(id); setMobileOpen(false); setDetail(null) }
  function toggle(id) { setTasks(prev=>prev.map(t=>t.id===id?{...t,done:!t.done}:t));setNotice(tasks.find(t=>t.id===id).done?'Assignment moved back to your plan.':'One less thing on your list. Nicely done.') }
  function reset() {setTasks(initialTasks.map(t=>({...t})));setFilter('all');setQuery('');setCourseFilter('all');setSelectedCourse('brand');setFinalScore(90);setDetail(null);setNotice('Demo reset. A fresh start.');}

  return <div className="showcase es-demo">
    <a className="es-skip" href="#demo-main">Skip to content</a>
    <div className="es-demo-banner"><span><span className="es-live-dot"/> A look inside EduSync <span className="es-banner-detail">· Fictional data. No account required.</span></span><a href="/?welcome=1">About the project <ArrowUpRight size={14}/></a></div>
    <div className="es-demo-layout">
      <aside className={`es-demo-sidebar ${mobileOpen?'is-open':''}`}><Brand/><div className="es-workspace"><span className="es-avatar">A</span><div><strong>Alex’s workspace</strong><small>Sample student account</small></div><button className="es-mobile-close" aria-label="Close navigation" onClick={()=>setMobileOpen(false)}><X size={20}/></button></div><p className="es-nav-label">YOUR SPACE</p><nav aria-label="Demo navigation">{tabs.map(({id,label,icon:Icon})=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>navigate(id)} className={tab===id?'is-active':''}><Icon size={18}/>{label}{id==='tasks'&&<span>{pending.length}</span>}</button>)}</nav><div className="es-sidebar-bottom"><div className="es-demo-tip"><Sparkles size={19}/><h3>Try a small what-if.</h3><p>Move the slider in Grade explorer to see how a final could change your result.</p><button onClick={()=>navigate('grades')}>Try it <ArrowRight size={15}/></button></div><button className="es-reset" onClick={reset}><RotateCcw size={15}/> Reset demo</button><a className="es-exit" href="/?welcome=1">Back to EduSync <ArrowUpRight size={15}/></a></div></aside>
      {mobileOpen&&<button className="es-mobile-overlay" aria-label="Close menu" onClick={()=>setMobileOpen(false)}/>}
      <main id="demo-main" className="es-demo-main"><header className="es-demo-top"><div><button className="es-menu-button" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={()=>setMobileOpen(true)}><Menu size={21}/></button><span>Workspace <ChevronRight size={13}/> {tabs.find(t=>t.id===tab).label}</span></div><span className="es-sample-badge">INTERACTIVE DEMO</span></header>
      <div className="es-demo-content">
        {tab==='today'&&<>
          <div className="es-day-heading"><div><p className="es-eyebrow">{new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}).toUpperCase()}</p><h1>A little focus.<br/><em>A lot more headspace.</em></h1><p>Welcome back, Alex. Let’s make today feel manageable.</p></div><div className="es-day-sun" aria-hidden="true">✳</div></div>
          <div className="es-demo-stats"><div><span>Your classes</span><strong>04<small>All in one place</small></strong></div><div><span>Up next</span><strong>{String(pending.length).padStart(2,'0')}<small>Open assignments</small></strong></div><div><span>Small wins</span><strong>{String(completed).padStart(2,'0')}<small>Assignments complete</small></strong></div></div>
          <div className="es-demo-columns"><div>
            <section className="es-focus-card"><div className="es-card-eyebrow"><span><Sparkles size={15}/> YOUR NEXT MOVE</span><span>Sample suggestion</span></div>{pending.length?<><h2>{pending[0].title}</h2><p>{pending[0].detail}</p><div><CoursePill id={pending[0].course}/><button onClick={()=>setDetail(pending[0].id)}>View assignment <ArrowUpRight size={17}/></button></div></>:<><h2>Room to breathe.</h2><p>You’ve completed every assignment in this sample plan.</p><button className="es-text-link" onClick={reset}>Start fresh <RotateCcw size={15}/></button></>}</section>
            <section className="es-panel"><div className="es-panel-heading"><h2>On your radar</h2><button onClick={()=>navigate('tasks')}>View all <ArrowRight size={15}/></button></div>{tasks.slice(0,4).map(t=><TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setDetail}/>)}</section>
          </div><div><section className="es-panel es-progress-panel"><div className="es-panel-heading"><h2>A little momentum</h2><CheckCheck size={19}/></div><div className="es-progress-ring" style={{background:`conic-gradient(#c6db9b ${completed/tasks.length*360}deg, #eeede6 0deg)`}}><div><strong>{completed}/{tasks.length}</strong><span>small wins</span></div></div><p>Your plan gets lighter<br/>one checkmark at a time.</p></section><section className="es-panel es-announcements"><div className="es-panel-heading"><h2>From your classes</h2></div>{demoAnnouncements.map(a=><article key={a.title}><CoursePill id={a.course}/><h3>{a.title}</h3><p>{a.body}</p><small>{a.when} · Sample announcement</small></article>)}</section></div></div>
        </>}
        {tab==='tasks'&&<><div className="es-page-heading"><p className="es-eyebrow">ONE THING AT A TIME</p><h1>Your next small wins.</h1><p>Complete an assignment, narrow your view, or open the details.</p></div><section className="es-panel"><div className="es-task-tools"><div className="es-tabs" role="group" aria-label="Assignment status">{['all','open','completed'].map(f=><button key={f} aria-pressed={filter===f} className={filter===f?'is-active':''} onClick={()=>setFilter(f)}>{f==='all'?'All assignments':f==='open'?'Open':'Completed'}</button>)}</div><label className="es-search"><Search size={16}/><input aria-label="Search assignments" placeholder="Find an assignment…" value={query} onChange={e=>setQuery(e.target.value)}/></label><select aria-label="Filter by class" value={courseFilter} onChange={e=>setCourseFilter(e.target.value)}><option value="all">Every class</option>{demoCourses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>{visible.length?visible.map(t=><TaskRow task={t} key={t.id} onToggle={toggle} onOpen={setDetail}/>):<div className="es-empty"><Search size={28}/><h2>A little too specific?</h2><p>No assignments match this view.</p><button className="es-text-link" onClick={()=>{setQuery('');setFilter('all');setCourseFilter('all')}}>Clear filters <ArrowRight size={15}/></button></div>}</section></>}
        {tab==='courses'&&<><div className="es-page-heading"><p className="es-eyebrow">THE BIGGER PICTURE</p><h1>Four classes. One home.</h1><p>Fictional courses that bring this demo semester to life.</p></div><div className="es-course-grid">{demoCourses.map(c=><article className="es-panel es-course-card" key={c.id}><div className="es-course-card-top"><span style={{background:c.color}}><BookOpen size={23}/></span><small>{c.code} · {c.credits} credits</small></div><h2>{c.name}</h2><p>{c.professor}</p><dl><div><dt>Meets</dt><dd>{c.time}</dd></div><div><dt>Location</dt><dd>{c.room}</dd></div><div><dt>Open assignments</dt><dd>{pending.filter(t=>t.course===c.id).length}</dd></div></dl><button className="es-text-link" onClick={()=>{setCourseFilter(c.id);setFilter('all');setQuery('');navigate('tasks')}}>View assignments <ArrowUpRight size={17}/></button></article>)}</div></>}
        {tab==='grades'&&<><div className="es-page-heading"><p className="es-eyebrow">A LITTLE PERSPECTIVE</p><h1>Make room for “what if.”</h1><p>Explore a simple final-exam scenario. These are sample estimates, not official grades.</p></div><div className="es-grade-layout"><section className="es-panel es-calculator"><label htmlFor="demo-course">Choose a class</label><select id="demo-course" value={selectedCourse} onChange={e=>setSelectedCourse(e.target.value)}>{demoCourses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><div className="es-grade-facts"><div><span>Completed coursework</span><strong>{current.completed}%</strong></div><div><span>Final exam weight</span><strong>{current.finalWeight}%</strong></div></div><div className="es-slider-label"><label htmlFor="final-score">What if I score…</label><output htmlFor="final-score">{finalScore}%</output></div><input id="final-score" aria-label="Final exam score" type="range" min="0" max="100" step="1" value={finalScore} onChange={e=>setFinalScore(Number(e.target.value))}/><div className="es-slider-scale"><span>0%</span><span>50%</span><span>100%</span></div><p className="es-method-note">Assumes all other coursework is complete and the final is the only remaining assessment. No dropped scores or extra credit.</p></section><section className="es-projection"><p className="es-eyebrow">YOUR PROJECTED RESULT</p><strong aria-live="polite">{projection.toFixed(1)}<span>%</span></strong><h2>A scenario, not a prediction.</h2><p>Change the final score to see how much room you have to move.</p><div className="es-formula">{current.completed}% × {100-current.finalWeight}% + {finalScore}% × {current.finalWeight}%</div></section></div></>}
        <footer className="es-demo-footer"><span>Sample data, real possibilities.</span><a href="/?welcome=1#the-project">The thinking behind EduSync <ArrowUpRight size={14}/></a></footer>
      </div></main>
    </div>
    {notice&&<div className="es-toast" role="status"><Check size={17}/>{notice}</div>}
    {detail!==null&&<TaskDialog task={tasks.find(t=>t.id===detail)} onClose={()=>setDetail(null)} onToggle={()=>toggle(detail)}/>}
  </div>
}
function TaskDialog({task,onClose,onToggle}) {
  const ref=React.useRef(null)
  useEffect(()=>{ const previous=document.activeElement; ref.current?.showModal(); return()=>{previous?.focus()} },[])
  return <dialog ref={ref} className="es-task-dialog" onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}} aria-labelledby="assignment-title"><button className="es-dialog-close" aria-label="Close assignment" onClick={onClose}><X size={21}/></button><p className="es-eyebrow">SAMPLE ASSIGNMENT</p><h2 id="assignment-title">{task.title}</h2><CoursePill id={task.course}/><p>{task.detail}</p><div className="es-dialog-meta"><span>Due: {dueLabel(task.offset)}</span><span>Priority: {task.priority}</span></div><button className="es-button es-button-dark" onClick={onToggle}>{task.done?'Mark as open':'Mark as complete'}<Check size={17}/></button></dialog>
}
