import { createContext, useContext, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Link, useParams, useSearchParams } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { supabase, configured, ensureSession, photoUrl } from './supabase'
import { T, Lang } from './i18n'

const Ctx = createContext<{ l: Lang; t: (k: string) => string; set: (l: Lang) => void }>(null as any)
const useT = () => useContext(Ctx)
const THEMES = ['cute', 'elegant', 'cinematic', 'minimal']
const CREDIT = 'Made by Hady Hesham'

export function embedUrl(u: string): string | null {
  try {
    const x = new URL(u); if (x.protocol !== 'https:') return null
    const h = x.hostname.replace(/^www\./, ''), yt = /^[\w-]{11}$/
    if (h === 'youtu.be') { const v = x.pathname.slice(1); return yt.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null }
    if (h === 'youtube.com' || h === 'm.youtube.com') { const v = x.searchParams.get('v'); return v && yt.test(v) ? `https://www.youtube-nocookie.com/embed/${v}` : null }
    if (h === 'open.spotify.com') { const m = x.pathname.match(/^\/(track|album|playlist|episode)\/(\w+)/); return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null }
  } catch {}
  return null
}
const newSlug = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => 'abcdefghijkmnpqrstuvwxyz23456789ABCDEFGHJKLMNPQRSTUVWXYZ'[b % 56]).join('')

function Hearts() {
  return <div className="hearts" aria-hidden>{Array.from({ length: 14 }).map((_, i) =>
    <span key={i} style={{ insetInlineStart: `${(i * 7 + 3) % 100}%`, animationDelay: `${i * 0.9}s`, animationDuration: `${9 + (i % 5) * 2}s` }}>♥</span>)}</div>
}

function Layout({ children }: { children: any }) {
  const { l, t, set } = useT(); const [open, setOpen] = useState(false)
  return <>
    <Hearts />
    <header><div className="wrap nav">
      <Link to="/" className="logo">LoveLink ♥</Link>
      <button className="burger" aria-label="menu" onClick={() => setOpen(!open)}>☰</button>
      <nav className={'links' + (open ? ' open' : '')} onClick={() => setOpen(false)}>
        <Link to="/">{t('home')}</Link><Link to="/mine">{t('mine')}</Link><Link to="/about">{t('about')}</Link>
        <button className="btn ghost" onClick={e => { e.stopPropagation(); set(l === 'ar' ? 'en' : 'ar') }}>{l === 'ar' ? 'English' : 'العربية'}</button>
        <Link className="btn" to="/create">{t('create')}</Link>
      </nav></div></header>
    <main className="wrap">{!configured && <div className="msg err" style={{ marginTop: 16 }}>{t('setup')}</div>}{children}</main>
    <footer><div className="wrap"><Link to="/privacy">{t('privacy')}</Link> · <Link to="/terms">{t('terms')}</Link><br /><b>{CREDIT}</b></div></footer>
  </>
}

function Surprise({ d, photos }: { d: any; photos: string[] }) {
  const { t } = useT(); const [play, setPlay] = useState(false), [rev, setRev] = useState(false)
  const song = d.song_url ? embedUrl(d.song_url) : null, vid = d.video_url ? embedUrl(d.video_url) : null
  const days = d.special_date ? Math.max(0, Math.floor((Date.now() - new Date(d.special_date).getTime()) / 864e5)) : null
  return <div className={`surprise th-${d.theme}`}>
    <h2>{d.title || `${d.name_a || '…'} ♥ ${d.name_b || '…'}`}</h2>
    <div className="names">{d.name_a} ♥ {d.name_b}</div>
    {days !== null && <div><b style={{ fontSize: '1.6rem' }}>{days}</b> {t('days')}</div>}
    {d.message && <div className="letter">{d.message}</div>}
    {photos.length > 0 && <div className="gal">{photos.map((p, i) => <img key={i} src={p} alt="" />)}</div>}
    {d.song_url && (song
      ? (play ? <iframe src={song} allow="encrypted-media" title="song" /> : <button className="btn" onClick={() => setPlay(true)}>{t('play')}</button>)
      : <p><a href={/^https:/.test(d.song_url) ? d.song_url : '#'} target="_blank" rel="noopener noreferrer">{t('noembed')}</a></p>)}
    {vid && <iframe src={vid} allowFullScreen title="video" style={{ minHeight: 220 }} />}
    {d.final_message && <div style={{ marginTop: 18 }}>{rev
      ? <div className="letter" style={{ textAlign: 'center', fontSize: '1.2rem' }}>{d.final_message}</div>
      : <button className="btn" onClick={() => setRev(true)}>{t('reveal')}</button>}</div>}
  </div>
}

function Home() {
  const { t } = useT()
  return <><section className="hero"><h1>{t('hero_t')}</h1><p>{t('hero_d')}</p><Link className="btn" to="/create">{t('create')}</Link></section>
    <h3>{t('ex_t')}</h3>
    <div className="grid">{THEMES.map(th => <Link key={th} to={`/create?theme=${th}`}>
      <Surprise d={{ theme: th, name_a: 'Hady', name_b: '♥', title: t(th), message: '' }} photos={[]} /></Link>)}</div></>
}

type Form = { name_a: string; name_b: string; title: string; message: string; theme: string; song_url: string; video_url: string; special_date: string; final_message: string; password: string }
function Create() {
  const { t } = useT(); const [sp] = useSearchParams()
  const [step, setStep] = useState(0), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState<any>(null)
  const [f, setF] = useState<Form>({ name_a: '', name_b: '', title: '', message: '', theme: THEMES.includes(sp.get('theme') || '') ? sp.get('theme')! : 'elegant', song_url: '', video_url: '', special_date: '', final_message: '', password: '' })
  const [files, setFiles] = useState<File[]>([]), [prev, setPrev] = useState<string[]>([])
  useEffect(() => { const u = files.map(x => URL.createObjectURL(x)); setPrev(u); return () => u.forEach(URL.revokeObjectURL) }, [files])
  const up = (k: keyof Form) => (e: any) => setF({ ...f, [k]: e.target.value })
  function validate(): string {
    if (!f.name_a.trim() || !f.name_b.trim()) return t('e_names')
    if (!f.message.trim() || f.message.length > 5000) return t('e_msg')
    if (f.song_url && !embedUrl(f.song_url)) return t('e_song')
    if (f.video_url && !/youtu/.test(f.video_url) || (f.video_url && !embedUrl(f.video_url))) return t('e_video')
    if (f.password && f.password.length < 6) return t('e_pass')
    return ''
  }
  function pick(e: any) {
    const a: File[] = Array.from(e.target.files || [])
    if (a.length > 6 || a.some(x => !['image/jpeg', 'image/png', 'image/webp'].includes(x.type) || x.size > 5 * 1024 * 1024)) { setErr(t('e_file')); return }
    setErr(''); setFiles(a)
  }
  async function save(status: 'draft' | 'published') {
    const v = validate(); if (v) { setErr(v); return }
    if (!configured) { setErr(t('setup')); return }
    setBusy(true); setErr('')
    try {
      const user = await ensureSession(), slug = newSlug()
      const { password, ...rest } = f
      const { data, error } = await supabase.from('surprises').insert({
        ...rest, slug, status, special_date: f.special_date || null, song_url: f.song_url || null, video_url: f.video_url || null,
        final_message: f.final_message || null, title: f.title || null, password_plain: password || null }).select('id').single()
      if (error) throw error
      const rows: any[] = []
      for (let i = 0; i < files.length; i++) {
        const ext = files[i].type === 'image/png' ? 'png' : files[i].type === 'image/webp' ? 'webp' : 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const r = await supabase.storage.from('photos').upload(path, files[i], { contentType: files[i].type })
        if (r.error) throw r.error
        rows.push({ surprise_id: data.id, path, position: i })
      }
      if (rows.length) { const r = await supabase.from('photos').insert(rows); if (r.error) throw r.error }
      setDone({ status, url: `${location.origin}/s/${slug}` })
    } catch { setErr(t('e_gen')) }
    setBusy(false)
  }
  if (done) return <Done url={done.url} draft={done.status === 'draft'} />
  const fld = (k: keyof Form, type = 'text') => <input type={type} value={f[k]} onChange={up(k)} maxLength={k === 'message' ? 5000 : 300} />
  return <div className="two" style={{ marginTop: 24 }}>
    <div className="card">
      <div className="steps">{[0, 1, 2].map(i => <i key={i} className={i <= step ? 'on' : ''} />)}</div>
      <h3>{t('s' + (step + 1))}</h3>
      {step === 0 && <><label>{t('name_a')}</label>{fld('name_a')}<label>{t('name_b')}</label>{fld('name_b')}<label>{t('title')}</label>{fld('title')}
        <label>{t('message')}</label><textarea rows={6} maxLength={5000} value={f.message} onChange={up('message')} /><label>{t('date')}</label>{fld('special_date', 'date')}</>}
      {step === 1 && <><label>{t('photos')}</label><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={pick} />
        <label>{t('song')}</label>{fld('song_url', 'url')}<label>{t('video')}</label>{fld('video_url', 'url')}<label>{t('final')}</label><textarea rows={3} maxLength={1000} value={f.final_message} onChange={up('final_message')} /></>}
      {step === 2 && <><label>{t('theme')}</label><select value={f.theme} onChange={up('theme')}>{THEMES.map(x => <option key={x} value={x}>{t(x)}</option>)}</select>
        <label>{t('password')}</label>{fld('password', 'password')}</>}
      {err && <div className="msg err" role="alert">{err}</div>}
      <div className="row">
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>{t('back')}</button>}
        {step < 2 ? <button className="btn" onClick={() => setStep(step + 1)}>{t('next')}</button> : <>
          <button className="btn ghost" disabled={busy} onClick={() => save('draft')}>{t('draft')}</button>
          <button className="btn" disabled={busy} onClick={() => save('published')}>{busy ? t('loading') : t('publish')}</button></>}
      </div></div>
    <div><h3 style={{ marginTop: 0 }}>{t('preview')}</h3><Surprise d={f} photos={prev} /></div></div>
}

function Done({ url, draft }: { url: string; draft: boolean }) {
  const { t } = useT(); const [c, setC] = useState(false)
  return <div className="card center" style={{ marginTop: 30 }}><h2>{draft ? t('saved') : t('published')}</h2>
    {!draft && <><input readOnly value={url} onFocus={e => e.target.select()} style={{ direction: 'ltr', textAlign: 'center' }} />
      <div className="row" style={{ justifyContent: 'center' }}>
        <button className="btn" onClick={async () => { await navigator.clipboard.writeText(url); setC(true) }}>{c ? t('copied') : t('copy')}</button>
        {'share' in navigator && <button className="btn ghost" onClick={() => navigator.share({ url, title: 'LoveLink' })}>{t('share')}</button>}</div>
      <p><span className="qr"><QRCodeSVG value={url} size={160} /></span></p></>}
    <Link className="btn ghost" to="/mine">{t('mine')}</Link></div>
}

function Public() {
  const { slug } = useParams(); const { t } = useT()
  const [d, setD] = useState<any>(undefined), [pw, setPw] = useState(''), [bad, setBad] = useState(false)
  async function load(p?: string) {
    const { data, error } = await supabase.rpc('get_surprise', { p_slug: slug, p_password: p ?? null })
    if (p && data?.locked) setBad(true); setD(error ? null : data)
  }
  useEffect(() => { configured ? load() : setD(null) }, [slug])
  if (d === undefined) return <p className="center">{t('loading')}</p>
  if (d === null) return <NotFound />
  if (d.locked) return <div className="card center" style={{ marginTop: 30 }}><h3>{t('locked')}</h3>
    <input type="password" value={pw} onChange={e => setPw(e.target.value)} />{bad && <div className="msg err">{t('wrong')}</div>}
    <div className="row" style={{ justifyContent: 'center' }}><button className="btn" onClick={() => load(pw)}>{t('unlock')}</button></div></div>
  return <div style={{ marginTop: 24 }}><Surprise d={d} photos={(d.photos || []).map(photoUrl)} /></div>
}

function Mine() {
  const { t } = useT(); const [rows, setRows] = useState<any[] | null>(null)
  async function load() {
    if (!configured) { setRows([]); return }
    const { data: s } = await supabase.auth.getSession(); if (!s.session) { setRows([]); return }
    const { data } = await supabase.from('surprises').select('id,slug,name_a,name_b,status,created_at,photos(path)').order('created_at', { ascending: false })
    setRows(data || [])
  }
  useEffect(() => { load() }, [])
  async function del(r: any) {
    if (!confirm(t('confirm_del'))) return
    const paths = (r.photos || []).map((p: any) => p.path); if (paths.length) await supabase.storage.from('photos').remove(paths)
    await supabase.from('surprises').delete().eq('id', r.id); load()
  }
  async function pub(r: any) { await supabase.from('surprises').update({ status: 'published' }).eq('id', r.id); load() }
  if (!rows) return <p className="center">{t('loading')}</p>
  if (!rows.length) return <div className="card center" style={{ marginTop: 30 }}><p>{t('empty')}</p><Link className="btn" to="/create">{t('create')}</Link></div>
  return <div style={{ marginTop: 24, display: 'grid', gap: 12 }}>{rows.map(r => <div key={r.id} className="card">
    <b>{r.name_a} ♥ {r.name_b}</b> <small>({r.status})</small>
    <div className="row">{r.status === 'published' ? <Link className="btn ghost" to={`/s/${r.slug}`}>{t('open')}</Link> : <button className="btn" onClick={() => pub(r)}>{t('publish')}</button>}
      <button className="btn ghost" onClick={() => del(r)}>{t('del')}</button></div></div>)}</div>
}

function Text({ k, extra }: { k: string; extra?: boolean }) {
  const { t } = useT()
  return <div className="card" style={{ marginTop: 30 }}><h2>{t(k)}</h2><p>{t(k === 'about' ? 'about_d' : k + '_b')}</p>{extra && <p><b>{CREDIT}</b></p>}</div>
}
function NotFound() { const { t } = useT(); return <div className="hero"><h1>404 ♥</h1><h2>{t('nf_t')}</h2><p>{t('nf_d')}</p><Link className="btn" to="/">{t('back_home')}</Link></div> }

export default function App() {
  const [l, setL] = useState<Lang>((localStorage.getItem('lang') as Lang) || 'ar')
  useEffect(() => { document.documentElement.lang = l; document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr'; localStorage.setItem('lang', l) }, [l])
  return <Ctx.Provider value={{ l, t: k => T[l][k] ?? k, set: setL }}><BrowserRouter><Layout><Routes>
    <Route path="/" element={<Home />} /><Route path="/create" element={<Create />} /><Route path="/s/:slug" element={<Public />} />
    <Route path="/mine" element={<Mine />} /><Route path="/about" element={<Text k="about" extra />} />
    <Route path="/privacy" element={<Text k="privacy" />} /><Route path="/terms" element={<Text k="terms" />} /><Route path="*" element={<NotFound />} />
  </Routes></Layout></BrowserRouter></Ctx.Provider>
}
