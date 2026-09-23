import React, { useEffect } from 'react'
import { ArrowUpRight, ArrowRight, Check, Layers, CalendarDays, TrendingUp, Plus, BookOpen } from 'lucide-react'
import Brand from '../components/Brand'
import '../showcase.css'

export default function LoginPage({ error }) {
  useEffect(() => { document.title = 'EduSync — Less catching up. More moving forward.' }, [])
  return <div className="showcase es-landing">
    <a className="es-skip" href="#main">Skip to content</a>
    <header className="es-header"><Brand/><nav aria-label="Main navigation"><a href="#how-it-works">How it works</a><a href="#the-project">The project</a><a href="/case-study/">Case study</a><a className="es-signin" href="/auth/microsoft">Student sign in <ArrowUpRight size={16}/></a></nav></header>
    <main id="main">
      <section className="es-hero">
        <div className="es-hero-copy">
          <div className="es-eyebrow"><span className="es-live-dot"/> A LITTLE LESS CAMPUS CHAOS</div>
          <h1>Less catching up.<br/>More <em>moving<br className="es-desktop-break"/> forward.</em></h1>
          <p className="es-hero-description">Classes, deadlines, and grades. One clear view of what matters next. Meet your calmer corner of student life.</p>
          <div className="es-hero-actions"><a className="es-button es-button-dark" href="/?demo=1">Explore the demo <ArrowUpRight size={19}/></a><a className="es-text-link" href="/auth/microsoft">Connect your classes <ArrowRight size={16}/></a></div>
          <p className="es-small-note">No account needed for the demo. Just a little curiosity.</p>
          {error && <p role="alert" className="es-error">We couldn’t finish signing you in. Try Microsoft sign-in again, or explore the demo.</p>}
          <div className="es-hero-footnote"><span className="es-mini-avatars" aria-hidden="true"><span>Y</span><span>↗</span></span><span>Built by a student.<br/><strong>For the in-between-everything days.</strong></span></div>
        </div>
        <div className="es-preview-stage" aria-label="Preview with fictional student data">
          <div className="es-preview-label"><span>YOUR DAY, AT A GLANCE</span><span>SAMPLE WORKSPACE</span></div>
          <div className="es-preview-window">
            <div className="es-window-bar"><span className="es-window-dots">● ● ●</span><span>edusync / today</span><span className="es-tag">SAMPLE DAY</span></div>
            <div className="es-preview-body"><div className="es-eyebrow">LET’S MAKE ROOM FOR THE GOOD STUFF</div><h2>You’ve got this, Alex.</h2><p>One priority. A clear place to start.</p>
              <div className="es-preview-stats"><div><strong>04</strong><span>classes, together</span></div><div><strong>01</strong><span>due today</span></div><div><strong>✓</strong><span>a little more clarity</span></div></div>
              <div className="es-preview-task"><span className="es-check-circle"><Check size={16}/></span><div><span className="es-course-label">BRAND STRATEGY</span><h3>Finish your positioning brief</h3><p>Today · Your next small win</p></div><ArrowUpRight size={18}/></div>
              <div className="es-preview-line"><span style={{background:'#a599d3'}}/><div><strong>Consumer Behavior</strong><small>Customer journey workshop</small></div><span>11:30</span></div>
              <div className="es-preview-line"><span style={{background:'#74a99a'}}/><div><strong>Marketing Analytics</strong><small>Campaign performance review</small></div><span>13:00</span></div>
            </div>
          </div>
          <div className="es-floating-note"><span className="es-note-star">✳</span><span>Less tab hopping.<br/><strong>More headspace.</strong></span></div>
          <div className="es-preview-caption"><span>Real product. Fictional data.</span><a href="/?demo=1">Take a look around <ArrowRight size={14}/></a></div>
        </div>
      </section>
      <section className="es-value-strip" aria-label="Product benefits"><span><Layers size={18}/> Everything in one place</span><span><CalendarDays size={18}/> A clearer next step</span><span><TrendingUp size={18}/> Progress you can understand</span></section>
      <section className="es-section" id="how-it-works"><div className="es-section-heading"><div><p className="es-eyebrow">FROM SCATTERED TO SORTED</p><h2>Your semester.<br/><em>With a little more perspective.</em></h2></div><p>A student dashboard built around three everyday questions.</p></div>
        <div className="es-feature-grid">{[
          ['01', CalendarDays, 'What needs me next?', 'See assignments and deadlines together, so the next step is easier to find.'],
          ['02', BookOpen, 'Where did that go?', 'Bring course files and announcements into the same space as your plan.'],
          ['03', TrendingUp, 'How am I doing?', 'Explore grade estimates and what-if scenarios, with the assumptions visible.'],
        ].map(([n, Icon, title, body]) => <article key={n} className="es-feature"><div><span>{n}</span><Icon size={23}/></div><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>
      <section className="es-project" id="the-project"><div><p className="es-eyebrow">A STUDENT PROBLEM. A PERSONAL PROJECT.</p><h2>Built from the<br/><em>other side of the desk.</em></h2><p>EduSync started with a familiar frustration: useful course information scattered across too many places. Yash Zaveri built it to turn that information into a clearer daily plan.</p><a className="es-text-link" href="https://github.com/YashZaveri600/lmu-command-center" target="_blank" rel="noreferrer">Explore the project on GitHub <ArrowUpRight size={17}/></a></div><div className="es-project-notes"><article><span>THE AUDIENCE</span><p>Students balancing coursework, deadlines, and everything outside class.</p></article><article><span>THE PRODUCT IDEA</span><p>Make the next useful action easier to find. Lead with a daily plan, then offer the detail.</p></article><article><span>THE NEXT QUESTION</span><p>Can a clearer overview help students plan their week? That’s a hypothesis to test, not a result we’ve claimed.</p></article></div></section>
      <section className="es-faq es-section"><p className="es-eyebrow">A FEW THINGS TO KNOW</p><h2>Before you jump in.</h2>{[
        ['Can I try it without a university account?', 'Yes. The interactive demo uses fictional classes and assignments. You can complete tasks and try grade scenarios without signing in. Demo changes stay in the current browser session and reset on reload.'],
        ['How does the real connection work?', 'Students sign in with Microsoft, then connect Brightspace in Settings using their session cookies. Those sessions expire and need reconnecting. Official one-click Brightspace login is not available yet.'],
        ['Are the grades official?', 'No. Calculated grades and what-if results are estimates based on available scores and category weights. Check your instructor’s grading rules and Brightspace for the official record.'],
        ['What happens to student data?', 'The signed-in app stores imported course information in its database. AI features send relevant course content to Anthropic for processing. The public demo uses only fictional data and makes no AI requests.'],
        ['Is this an official university product?', 'EduSync is an independent student project by Yash Zaveri. It is not an official university service or an endorsed product.'],
      ].map(([q,a]) => <details key={q}><summary>{q}<Plus size={19}/></summary><p>{a}</p></details>)}</section>
      <section className="es-bottom-cta"><span className="es-note-star">✳</span><h2>A little clarity goes a long way.</h2><a className="es-button es-button-dark" href="/?demo=1">Make yourself at home <ArrowUpRight size={19}/></a></section>
    </main><footer className="es-footer"><Brand/><span>An independent project by Yash Zaveri.</span><a href="/case-study/">Case study <ArrowUpRight size={15}/></a><a href="/?demo=1">Explore the demo <ArrowUpRight size={15}/></a></footer>
  </div>
}
