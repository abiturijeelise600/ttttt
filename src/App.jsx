import { useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase.js'

const actions = [
  { id: 'travel', icon: '↗', title: 'Choose a lower-carbon trip', text: 'Walk, cycle, share a ride, or use public transport when it works for you.' },
  { id: 'food', icon: '✳', title: 'Make food choices count', text: 'Try a plant-rich meal and plan portions to reduce food waste.' },
  { id: 'energy', icon: '⌁', title: 'Use energy thoughtfully', text: 'Switch off unused lights and choose efficient appliances when replacing them.' },
  { id: 'nature', icon: '❋', title: 'Care for local nature', text: 'Support healthy trees, wetlands, and green spaces in your community.' },
]
const blankForm = { email: '', password: '', name: '', phone: '' }
function getLocalPledges() { try { const x = JSON.parse(localStorage.getItem('climate-forward-actions')); return Array.isArray(x) ? x : [] } catch { return [] } }

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [pledged, setPledged] = useState(getLocalPledges)
  const [showAdmin, setShowAdmin] = useState(false)
  const [adminData, setAdminData] = useState({ profiles: [], pledges: [] })
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState(blankForm)
  const [authOpen, setAuthOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [distance, setDistance] = useState('')
  const [transport, setTransport] = useState('car')
  const [meals, setMeals] = useState('')
  const estimate = useMemo(() => Math.round((((Number(distance) || 0) * ({ car: .192, bus: .105, walking: 0, cycling: 0 }[transport])) + (Number(meals) || 0) * .8) * 10) / 10, [distance, transport, meals])

  useEffect(() => {
    if (!supabase) return undefined
    let alive = true
    supabase.auth.getSession().then(({ data, error: e }) => { if (alive) { if (e) setError(e.message); setUser(data.session?.user ?? null) } })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { if (alive) setUser(session?.user ?? null) })
    return () => { alive = false; subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!supabase || !user) { setProfile(null); setPledged(getLocalPledges()); return undefined }
    let alive = true
    async function loadAccount() {
      const { data: profileData, error: profileError } = await supabase.from('profiles').select('user_id,display_name,phone,role,created_at').eq('user_id', user.id).maybeSingle()
      if (!alive) return
      if (profileError) { setError(profileError.message); return }
      setProfile(profileData)
      const { data: rows, error: pledgeError } = await supabase.from('climate_pledges').select('action_id').eq('user_id', user.id)
      if (!alive) return
      if (pledgeError) { setError(pledgeError.message); return }
      const ids = (rows || []).map((r) => r.action_id)
      setPledged(ids); localStorage.setItem('climate-forward-actions', JSON.stringify(ids)); setError('')
    }
    loadAccount()
    return () => { alive = false }
  }, [user])

  useEffect(() => {
    if (!supabase || !user || profile?.role !== 'admin' || !showAdmin) { setAdminData({ profiles: [], pledges: [] }); return undefined }
    let alive = true
    Promise.all([
      supabase.from('profiles').select('user_id,display_name,phone,role,created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('climate_pledges').select('id,user_id,action_id,created_at').order('created_at', { ascending: false }).limit(500),
    ]).then(([p, a]) => { if (!alive) return; if (p.error || a.error) { setError((p.error || a.error).message); return } setAdminData({ profiles: p.data || [], pledges: a.data || [] }) })
    return () => { alive = false }
  }, [user, profile?.role, showAdmin])

  async function toggleAction(id) {
    const selected = pledged.includes(id), next = selected ? pledged.filter((x) => x !== id) : [...pledged, id]
    setPledged(next); setError(''); setNotice('')
    if (!user || !supabase) { localStorage.setItem('climate-forward-actions', JSON.stringify(next)); if (isSupabaseConfigured) setNotice('Saved on this device. Sign in to sync your actions.'); return }
    const result = selected ? await supabase.from('climate_pledges').delete().eq('user_id', user.id).eq('action_id', id) : await supabase.from('climate_pledges').upsert({ user_id: user.id, action_id: id }, { onConflict: 'user_id,action_id' })
    if (result.error) { setPledged(pledged); setError(result.error.message) } else { localStorage.setItem('climate-forward-actions', JSON.stringify(next)); setNotice('Your action synced to your account.') }
  }
  async function clearActions() {
    const previous = pledged; setPledged([]); setError('')
    if (user && supabase) { const { error: e } = await supabase.from('climate_pledges').delete().eq('user_id', user.id); if (e) { setPledged(previous); setError(e.message); return } }
    localStorage.removeItem('climate-forward-actions'); setNotice('Saved actions cleared.')
  }
  async function submitAuth(event) {
    event.preventDefault(); if (!supabase) return
    setBusy(true); setError(''); setNotice('')
    try {
      if (mode === 'signup') {
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
  async function signOut() { const { error: e } = await supabase.auth.signOut(); if (e) setError(e.message); else { setShowAdmin(false); setProfile(null); setNotice('Signed out.') } }
  const counts = adminData.pledges.reduce((out, row) => ({ ...out, [row.action_id]: (out[row.action_id] || 0) + 1 }), {})

  return <main>
    <header className="nav wrap"><a className="brand" href="#home"><span className="brand-mark">C</span><span>CLIMATE<span className="brand-light">FORWARD</span></span></a><nav aria-label="Main navigation"><a href="#learn">Learn</a><a href="#calculator">Explore</a><a href="#actions">Take action</a></nav><div className="account-actions">{user ? <><span className="account-email">{profile?.display_name || user.email}</span>{profile?.role === 'admin' && <button className="account-button admin-link" type="button" onClick={() => setShowAdmin((v) => !v)}>{showAdmin ? 'View site' : 'Admin dashboard'}</button>}<button className="account-button" type="button" onClick={signOut}>Sign out</button></> : <button className="account-button" type="button" onClick={() => { setMode('login'); setAuthOpen(true) }}>Sign in / Register</button>}</div></header>
    {!isSupabaseConfigured && <div className="setup-banner wrap"><b>Supabase setup needed.</b> Create <code>.env.local</code> from <code>.env.example</code>, set the project URL and publishable key, then restart Vite.</div>}
    {(notice || error) && <div className={`status-banner wrap ${error ? 'status-error' : ''}`} role="status">{error || notice}</div>}
    {showAdmin && profile?.role === 'admin' ? <section className="admin-page wrap section-pad"><div className="admin-heading"><div><span className="eyebrow dark">Climate Forward / Admin</span><h1>Dashboard</h1><p>Role-protected overview of accounts and climate pledges.</p></div><button className="account-button" onClick={() => setShowAdmin(false)}>View site</button></div><div className="admin-stats"><article><span>ACCOUNTS LOADED</span><strong>{adminData.profiles.length}</strong><small>Recent 200 accounts</small></article><article><span>RECENT PLEDGES</span><strong>{adminData.pledges.length}</strong><small>Recent 500 entries</small></article><article><span>ADMIN USERS</span><strong>{adminData.profiles.filter((x) => x.role === 'admin').length}</strong><small>In loaded accounts</small></article></div><div className="admin-columns"><section className="admin-panel"><h2>Action totals</h2>{actions.map((a) => <div className="admin-row" key={a.id}><span>{a.title}</span><b>{counts[a.id] || 0}</b></div>)}</section><section className="admin-panel"><h2>Latest pledges</h2>{adminData.pledges.slice(0, 15).map((a) => <div className="admin-row" key={a.id}><span>{actions.find((x) => x.id === a.action_id)?.title}<small>{a.user_id.slice(0, 8)}… · {new Date(a.created_at).toLocaleDateString()}</small></span><b>Saved</b></div>)}{!adminData.pledges.length && <p>No pledges yet.</p>}</section></div><section className="admin-panel"><h2>Recent accounts</h2><div className="table-wrap"><table><thead><tr><th>Name</th><th>Phone</th><th>Role</th><th>Joined</th></tr></thead><tbody>{adminData.profiles.map((p) => <tr key={p.user_id}><td>{p.display_name || '—'}</td><td>{p.phone || '—'}</td><td>{p.role}</td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}</tbody></table></div></section></section> : <>
      <section id="home" className="hero wrap"><div className="hero-copy"><span className="eyebrow"><i/> A practical guide to climate action</span><h1>A better future<br/>is <em>built together.</em></h1><p>Understand the changing climate, discover everyday choices that can help, and find a first step that feels possible.</p><div className="hero-buttons"><a className="button lime" href="#learn">Explore the guide ↓</a><a className="text-link" href="#calculator">Try the simple estimator ↗</a></div><div className="hero-note">Knowledge, community, and action matter.</div></div><div className="hero-art" aria-label="Illustration of a green landscape"><div className="sun"/><div className="art-label">● OUR SHARED HOME</div><div className="hill back"/><div className="hill front"/><div className="tree one">♣</div><div className="tree two">♣</div><div className="art-caption">Small steps.<br/><strong>Lasting change.</strong></div></div></section>
      <div className="ticker">ACT LOCALLY <span>✳</span> THINK LONG TERM <span>✳</span> MAKE ROOM FOR EVERY VOICE <span>✳</span> ACT LOCALLY</div>
      <section id="learn" className="learn wrap section-pad"><div><span className="eyebrow dark">01 / Understand</span><h2>Climate change,<br/><em>made clearer.</em></h2></div><div className="learn-copy"><p className="lead">Earth’s climate is changing, largely because human activities release heat-trapping greenhouse gases. Impacts are felt differently in different places and communities.</p><p>There is no single solution. Cutting pollution, preparing for local risks, protecting nature, and making fair choices all contribute to a more resilient future.</p><a className="inline-link" href="https://www.ipcc.ch/" target="_blank" rel="noreferrer">Explore climate science from the IPCC ↗</a></div></section>
      <section className="fact-band"><div className="wrap fact-grid"><div><span className="eyebrow">A useful reminder</span><h2>Climate action is<br/><em>many things.</em></h2></div><article><span>01</span><h3>Reduce emissions</h3><p>Cleaner energy, efficient buildings, and thoughtful transport choices can reduce greenhouse gas pollution.</p></article><article><span>02</span><h3>Prepare together</h3><p>Communities can plan for heat, heavy rain, drought, and other local climate risks.</p></article><article><span>03</span><h3>Protect nature</h3><p>Healthy ecosystems support people and wildlife. Local knowledge helps guide good decisions.</p></article></div></section>
      <section id="calculator" className="wrap section-pad"><div className="calc-heading"><div><span className="eyebrow dark">02 / Explore</span><h2>A small snapshot<br/><em>of everyday choices.</em></h2></div><p>This illustrative estimate is not a full personal carbon footprint and should not be used for comparisons or official reporting.</p></div><div className="calculator"><div className="calc-form"><label>Weekly travel distance <small>kilometres</small><input type="number" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} placeholder="e.g. 40"/></label><label>Usual travel mode<select value={transport} onChange={(e) => setTransport(e.target.value)}><option value="car">Car</option><option value="bus">Bus</option><option value="walking">Walking</option><option value="cycling">Cycling</option></select></label><label>Plant-rich meals this week <small>meals</small><input type="number" min="0" value={meals} onChange={(e) => setMeals(e.target.value)} placeholder="e.g. 3"/></label></div><div className="result"><span>ILLUSTRATIVE WEEKLY ESTIMATE</span><strong>{estimate.toFixed(1)} <small>kg CO₂e</small></strong><p>Based only on travel and meal inputs; actual impacts vary.</p><a href="https://www.un.org/en/climatechange" target="_blank" rel="noreferrer">Learn more ↗</a></div></div></section>
      <section id="actions" className="actions"><div className="wrap section-pad"><div className="actions-heading"><div><span className="eyebrow">03 / Take action</span><h2>Pick a step.<br/><em>Make it yours.</em></h2></div><p>Progress is personal and collective. Choose actions that fit your circumstances.</p></div><div className="action-grid">{actions.map((a, i) => <article className="action-card" key={a.id}><div className="action-top"><span>{a.icon}</span><small>0{i + 1}</small></div><h3>{a.title}</h3><p>{a.text}</p><button className={pledged.includes(a.id) ? 'pledge selected' : 'pledge'} type="button" onClick={() => toggleAction(a.id)}>{pledged.includes(a.id) ? 'Added to my steps ✓' : 'I’ll try this'}<span>↗</span></button></article>)}</div><div className="pledge-summary"><span>●</span>{pledged.length ? `You chose ${pledged.length} ${pledged.length === 1 ? 'step' : 'steps'}.` : 'Your selected steps are saved on this device only.'}<button type="button" onClick={clearActions} disabled={!pledged.length}>Clear selections</button></div></div></section>
      <section className="closing wrap"><div><span className="eyebrow dark">Keep learning</span><h2>Hope is a practice.<br/><em>So is action.</em></h2></div><div><p>Start with curiosity. Learn from trusted climate science and people in your community.</p><a className="button dark-button" href="https://www.un.org/en/climatechange" target="_blank" rel="noreferrer">Visit the UN climate guide ↗</a><p className="contact-line">WhatsApp: <a href="https://wa.me/250796365450" target="_blank" rel="noreferrer">+250 796 365 450</a></p></div></section>
      <footer><div className="wrap footer-inner"><a className="brand" href="#home"><span className="brand-mark">C</span><span>CLIMATE<span className="brand-light">FORWARD</span></span></a><p>Climate awareness project. Estimator is illustrative.</p><a href="#home">Back to top ↑</a></div></footer>
    </>}
    {authOpen && <div className="modal-backdrop" onClick={() => setAuthOpen(false)}><section className="auth-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}><button className="modal-close" type="button" aria-label="Close" onClick={() => setAuthOpen(false)}>×</button><span className="eyebrow dark">Your climate account</span><h2>{mode === 'login' ? 'Welcome back.' : 'Join Climate Forward.'}</h2><p>Sign in to sync actions across devices.</p><div className="auth-tabs"><button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button><button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => setMode('signup')}>Register</button></div><form onSubmit={submitAuth}>{mode === 'signup' && <><label>Name<input required maxLength="80" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}/></label><label>Phone<input type="tel" maxLength="24" placeholder="0796365450" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}/></label></>}<label>Email<input type="email" autoComplete="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}/></label><label>Password<input type="password" minLength="8" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}/></label><button className="button lime auth-submit" type="submit" disabled={busy || !isSupabaseConfigured}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>{!isSupabaseConfigured && <small>Set Supabase environment variables before using accounts.</small>}</form></section></div>}
  </main>
}
