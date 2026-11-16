import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'

const actions = [
  { id: 'travel', icon: '↗', title: 'Choose a lower-carbon trip', text: 'Walk, cycle, share a ride, or use public transport when it works for you.' },
  { id: 'food', icon: '✳', title: 'Make food choices count', text: 'Try a plant-rich meal and plan portions to reduce food waste.' },
  { id: 'energy', icon: '⌁', title: 'Use energy thoughtfully', text: 'Save energy where you can and choose efficient appliances when replacing them.' },
  { id: 'nature', icon: '❋', title: 'Care for local nature', text: 'Support healthy trees, wetlands, and green spaces in your community.' },
]
const blankForm = { email: '', password: '', name: '', phone: '' }
function getLocalPledges() { try { const x = JSON.parse(localStorage.getItem('climate-actions')); return Array.isArray(x) ? x : [] } catch { return [] } }

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pledged, setPledged] = useState(getLocalPledges)
  const [adminOpen, setAdminOpen] = useState(false)
  const [adminData, setAdminData] = useState({ profiles: [], pledges: [] })
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState('login')
  const [form, setForm] = useState(blankForm)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [distance, setDistance] = useState('')
  const [transport, setTransport] = useState('car')
  const [meals, setMeals] = useState('')
  const estimate = useMemo(() => Math.round(((Number(distance || 0) * ({ car: .192, bus: .105, walk: 0, cycle: 0 }[transport])) + Number(meals || 0) * .8) * 10) / 10, [distance, transport, meals])

  useEffect(() => {
    if (!supabase) return undefined
    let live = true
    supabase.auth.getSession().then(({ data, error: e }) => { if (live) { if (e) setError(e.message); setUser(data.session?.user || null) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (live) setUser(session?.user || null) })
    return () => { live = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setProfile(null); setPledged(getLocalPledges()); return undefined }
    let live = true
    ;(async () => {
      const p = await supabase.from('profiles').select('user_id,display_name,phone,role,created_at').eq('user_id', user.id).maybeSingle()
      if (!live) return
      if (p.error) { setError(p.error.message); return }
      setProfile(p.data)
      const a = await supabase.from('climate_pledges').select('action_id').eq('user_id', user.id)
      if (!live) return
      if (a.error) { setError(a.error.message); return }
      const ids = (a.data || []).map((row) => row.action_id)
      setPledged(ids); localStorage.setItem('climate-actions', JSON.stringify(ids)); setError('')
    })()
    return () => { live = false }
  }, [user])

  useEffect(() => {
    if (!supabase || !user || profile?.role !== 'admin' || !adminOpen) { setAdminData({ profiles: [], pledges: [] }); return undefined }
    let live = true
    Promise.all([
      supabase.from('profiles').select('user_id,display_name,phone,role,created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('climate_pledges').select('id,user_id,action_id,created_at').order('created_at', { ascending: false }).limit(500),
    ]).then(([p, a]) => { if (!live) return; if (p.error || a.error) setError((p.error || a.error).message); else setAdminData({ profiles: p.data || [], pledges: a.data || [] }) })
    return () => { live = false }
  }, [user, profile?.role, adminOpen])

  async function toggleAction(id) {
    const exists = pledged.includes(id), next = exists ? pledged.filter((x) => x !== id) : [...pledged, id]
    setPledged(next); setError(''); setNotice('')
    if (!user || !supabase) { localStorage.setItem('climate-actions', JSON.stringify(next)); if (isSupabaseConfigured) setNotice('Saved on this device. Sign in to sync your actions.'); return }
    const result = exists ? await supabase.from('climate_pledges').delete().eq('user_id', user.id).eq('action_id', id) : await supabase.from('climate_pledges').upsert({ user_id: user.id, action_id: id }, { onConflict: 'user_id,action_id' })
    if (result.error) { setPledged(pledged); setError(result.error.message) } else { localStorage.setItem('climate-actions', JSON.stringify(next)); setNotice('Your action synced to your account.') }
  }
  async function clearActions() {
    const old = pledged; setPledged([]); setError('')
    if (user && supabase) { const { error: e } = await supabase.from('climate_pledges').delete().eq('user_id', user.id); if (e) { setPledged(old); setError(e.message); return } }
    localStorage.removeItem('climate-actions'); setNotice('Saved actions cleared.')
  }
  async function submitAuth(event) {
    event.preventDefault(); if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (authMode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { display_name: form.name.trim(), phone: form.phone.trim() } } })
        if (e) throw e
        setNotice(data.session ? 'Account created.' : 'Account created. Check your email to confirm, then sign in.')
        if (data.session) setAuthOpen(false)
      } else {
        const { error: e } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password })
        if (e) throw e
        setAuthOpen(false); setNotice('Signed in successfully.')
      }
      setForm(blankForm)
    } catch (e) { setError(e.message || 'Authentication failed.') } finally { setBusy(false) }
  }
  async function signOut() { const { error: e } = await supabase.auth.signOut(); if (e) setError(e.message); else { setAdminOpen(false); setProfile(null); setNotice('Signed out.') } }
  const counts = adminData.pledges.reduce((out, row) => ({ ...out, [row.action_id]: (out[row.action_id] || 0) + 1 }), {})

  return <main>
    <header className="nav wrap"><a className="brand" href="#home"><span className="mark">C</span>CLIMATE<span className="light">FORWARD</span></a><nav aria-label="Main navigation"><a href="#learn">Learn</a><a href="#calculator">Explore</a><a href="#actions">Take action</a></nav><div className="account">{user ? <><span>{profile?.display_name || user.email}</span>{profile?.role === 'admin' && <button className="admin-button" onClick={() => setAdminOpen(!adminOpen)} type="button">{adminOpen ? 'View site' : 'Admin dashboard'}</button>}<button onClick={signOut} type="button">Sign out</button></> : <button onClick={() => { setAuthMode('login'); setForm(blankForm); setAuthOpen(true) }} type="button">Sign in / Register</button>}</div></header>
    {!isSupabaseConfigured && <div className="banner wrap"><b>Supabase setup needed:</b> copy <code>.env.example</code> to <code>.env.local</code>, add URL and publishable key, then restart Vite.</div>}
    {(notice || error) && <div className={`banner wrap ${error ? 'error' : ''}`} role="status">{error || notice}</div>}
    {adminOpen && profile?.role === 'admin' ? <section className="admin wrap section"><div className="section-head"><div><span className="eyebrow">Admin / Climate Forward</span><h1>Dashboard</h1><p>Role-protected overview. Admin permissions are checked in the database with row-level security.</p></div><button onClick={() => setAdminOpen(false)} type="button">View site</button></div><div className="stats"><article><small>ACCOUNTS LOADED</small><strong>{adminData.profiles.length}</strong><span>Recent 200 accounts</span></article><article><small>RECENT PLEDGES</small><strong>{adminData.pledges.length}</strong><span>Recent 500 entries</span></article><article><small>ADMIN USERS</small><strong>{adminData.profiles.filter((x) => x.role === 'admin').length}</strong><span>Within loaded accounts</span></article></div><div className="admin-grid"><article className="panel"><h2>Action totals</h2>{actions.map((a) => <p className="row" key={a.id}>{a.title}<b>{counts[a.id] || 0}</b></p>)}</article><article className="panel"><h2>Latest pledges</h2>{adminData.pledges.slice(0, 15).map((a) => <p className="row" key={a.id}>{actions.find((x) => x.id === a.action_id)?.title}<small>{a.user_id.slice(0, 8)}… · {new Date(a.created_at).toLocaleDateString()}</small></p>)}{!adminData.pledges.length && <p>No pledges yet.</p>}</article></div><article className="panel"><h2>Recent accounts</h2><div className="table-scroll"><table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead><tbody>{adminData.profiles.map((p) => <tr key={p.user_id}><td>{p.display_name || '—'}</td><td>{p.phone || '—'}</td><td>{p.role}</td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></article></section> : <>
      <section id="home" className="hero wrap"><div><span className="eyebrow">● A practical guide to climate action</span><h1>A better future<br/>is <em>built together.</em></h1><p>Understand the changing climate, discover everyday choices that can help, and find a first step that feels possible.</p><div className="buttons"><a className="btn lime" href="#learn">Explore the guide ↓</a><a href="#calculator">Try the simple estimator ↗</a></div><small>Knowledge, community, and action matter.</small></div><div className="landscape" aria-label="Illustration of a green landscape"><div className="sun"/><span>OUR SHARED HOME</span><div className="hill h1"/><div className="hill h2"/><b className="tree t1">♣</b><b className="tree t2">♣</b><div className="caption">Small steps.<br/><strong>Lasting change.</strong></div></div></section>
      <div className="ticker">ACT LOCALLY　 ✳　 THINK LONG TERM　 ✳　 MAKE ROOM FOR EVERY VOICE</div>
      <section id="learn" className="learn wrap section"><div><span className="eyebrow">01 / Understand</span><h2>Climate change,<br/><em>made clearer.</em></h2></div><div><p className="lead">Earth’s climate is changing, largely because human activities release heat-trapping greenhouse gases. Impacts are felt differently in different places and communities.</p><p>There is no single solution. Cutting pollution, preparing for local risks, protecting nature, and making fair choices all contribute to a more resilient future.</p><a href="https://www.ipcc.ch/" target="_blank" rel="noreferrer">Explore climate science from the IPCC ↗</a></div></section>
      <section className="facts"><div className="wrap fact-grid"><h2>Climate action is<br/><em>many things.</em></h2><article><h3>Reduce emissions</h3><p>Cleaner energy and thoughtful transport can reduce greenhouse gas pollution.</p></article><article><h3>Prepare together</h3><p>Communities can plan for heat, heavy rain, drought, and local climate risks.</p></article><article><h3>Protect nature</h3><p>Healthy ecosystems support people and wildlife.</p></article></div></section>
      <section id="calculator" className="wrap section"><div className="section-head"><div><span className="eyebrow">02 / Explore</span><h2>A small snapshot<br/><em>of everyday choices.</em></h2></div><p>Illustrative estimate only, not a complete footprint or official measurement.</p></div><div className="calculator"><div className="calc-form"><label>Weekly travel distance (km)<input type="number" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="e.g. 40"/></label><label>Usual travel mode<select value={transport} onChange={(e) => setTransport(e.target.value)}><option value="car">Car</option><option value="bus">Bus</option><option value="walk">Walking</option><option value="cycle">Cycling</option></select></label><label>Plant-rich meals this week<input type="number" min="0" value={meals} onChange={(e) => setMeals(e.target.value)} placeholder="e.g. 3"/></label></div><div className="result"><small>ILLUSTRATIVE WEEKLY ESTIMATE</small><strong>{estimate.toFixed(1)} <small>kg CO₂e</small></strong><p>Actual impacts vary by location, vehicle, energy mix, and food choices.</p><a href="https://www.un.org/en/climatechange" target="_blank" rel="noreferrer">Learn more ↗</a></div></div></section>
      <section id="actions" className="actions"><div className="wrap section"><div className="section-head"><div><span className="eyebrow">03 / Take action</span><h2>Pick a step.<br/><em>Make it yours.</em></h2></div><p>Choose practical steps that fit your circumstances.</p></div><div className="action-grid">{actions.map((a, i) => <article className="action-card" key={a.id}><span>{a.icon}　0{i + 1}</span><h3>{a.title}</h3><p>{a.text}</p><button className={pledged.includes(a.id) ? 'pledge selected' : 'pledge'} type="button" onClick={() => toggleAction(a.id)}>{pledged.includes(a.id) ? 'Added to my steps ✓' : 'I’ll try this'} ↗</button></article>)}</div><div className="summary">{pledged.length ? `You chose ${pledged.length} ${pledged.length === 1 ? 'step' : 'steps'}.` : 'Selections are saved on this device only.'}<button type="button" onClick={clearActions} disabled={!pledged.length}>Clear selections</button></div></div></section>
      <section className="closing wrap section"><div><span className="eyebrow">Keep learning</span><h2>Hope is a practice.<br/><em>So is action.</em></h2></div><div><p>Learn from trusted climate science and people in your community.</p><a className="btn dark" href="https://www.un.org/en/climatechange" target="_blank" rel="noreferrer">Visit the UN climate guide ↗</a><p>WhatsApp: <a href="https://wa.me/250796365450" target="_blank" rel="noreferrer">+250 796 365 450</a></p></div></section>
      <footer><div className="wrap footer"><a className="brand" href="#home">CLIMATE<span className="light">FORWARD</span></a><span>Climate awareness project. Estimator is illustrative.</span><a href="#home">Back to top ↑</a></div></footer>
    </>}
    {authOpen && <div className="overlay" onClick={() => setAuthOpen(false)}><section className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}><button className="close" type="button" onClick={() => setAuthOpen(false)} aria-label="Close">×</button><span className="eyebrow">Your climate account</span><h2>{authMode === 'login' ? 'Welcome back.' : 'Join Climate Forward.'}</h2><p>Sign in to sync your climate actions across devices.</p><div className="tabs"><button type="button" className={authMode === 'login' ? 'active' : ''} onClick={() => setAuthMode('login')}>Sign in</button><button type="button" className={authMode === 'signup' ? 'active' : ''} onClick={() => setAuthMode('signup')}>Register</button></div><form onSubmit={submitAuth}>{authMode === 'signup' && <><label>Name<input required maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>Phone<input type="tel" maxLength="24" placeholder="0796365450" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/></label></>}<label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label><label>Password<input type="password" minLength="8" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/></label><button className="btn lime submit" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>{!isSupabaseConfigured && <small>Configure Supabase environment variables first.</small>}</form></section></div>}
  </main>
}
