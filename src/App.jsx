import { useState, useEffect, useRef, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { supabase, loadUserData, saveUserData } from './lib/supabase.js'

// ── Constants ──────────────────────────────────────────────────────────────
const CARD_COLORS = ['#378ADD','#1D9E75','#D85A30','#D4537E','#7F77DD','#BA7517','#E24B4A']
const CATS = ['餐飲','購物','交通','娛樂','日用','旅遊','其他']
const CAT_COLOR = {餐飲:'#D85A30',購物:'#D4537E',交通:'#378ADD',娛樂:'#7F77DD',日用:'#1D9E75',旅遊:'#7F77DD',訂閱:'#BA7517',其他:'#888780'}
const SUB_CATS = ['串流','音樂','健身','雲端','遊戲','工具','其他']
const SUB_ICONS = {串流:'▶',音樂:'♪',健身:'◈',雲端:'☁',遊戲:'⊛',工具:'⚙',其他:'◉'}

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = n => Math.abs(Math.round(n)).toLocaleString('zh-TW')
const uid = () => Math.random().toString(36).slice(2,9)
const nowDate = () => new Date().toISOString().slice(0,10)
const TM = () => new Date().toISOString().slice(0,7)
const addM = (ym,n) => { const d=new Date(ym+'-01'); d.setMonth(d.getMonth()+n); return d.toISOString().slice(0,7) }
const mLabel = ym => { const[y,m]=ym.split('-'); return `${y}/${m}` }
const calcPmt = (total,months,annualPct) => {
  if(!total||!months) return 0
  const p=+total,n=+months,r=+annualPct/100/12
  if(r<0.00001) return Math.round(p/n)
  return Math.round(p*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1))
}

// ── Initial Data ───────────────────────────────────────────────────────────
const INIT = {
  cards: [{id:'c1',name:'匯豐 Live+',lastFour:'9579',color:'#D85A30',limit:65000,billingDate:14}],
  txs: [],
  inst: [
    {id:'i1',cardId:'c1',name:'蝦皮 etuoh3',monthly:479,first:null,totalM:24,paidM:6,rate:0,start:'2024-10',bMode:'none',bCat:'購物'},
    {id:'i2',cardId:'c1',name:'蝦皮 264740Ka',monthly:304,first:null,totalM:24,paidM:6,rate:0,start:'2024-10',bMode:'none',bCat:'購物'},
    {id:'i3',cardId:'c1',name:'91APP TheN',monthly:1166,first:null,totalM:6,paidM:5,rate:0,start:'2024-11',bMode:'none',bCat:'購物'},
    {id:'i4',cardId:'c1',name:'富邦momo',monthly:318,first:null,totalM:12,paidM:8,rate:0,start:'2024-08',bMode:'none',bCat:'購物'},
    {id:'i5',cardId:'c1',name:'漁拓企業 12期',monthly:506,first:null,totalM:12,paidM:4,rate:0,start:'2024-12',bMode:'none',bCat:'購物'},
    {id:'i6',cardId:'c1',name:'漁拓企業 3期',monthly:453,first:null,totalM:3,paidM:1,rate:0,start:'2025-03',bMode:'none',bCat:'購物'},
  ],
  budgets: [],
  subs: [
    {id:'s1',name:'Netflix',amount:390,cardId:'c1',cat:'串流',day:15},
    {id:'s2',name:'Spotify',amount:169,cardId:'c1',cat:'音樂',day:20},
  ],
  assets: [
    {id:'a1',name:'台新銀行',type:'bank',balance:0,color:'#378ADD'},
    {id:'a2',name:'錢包現金',type:'cash',balance:0,color:'#1D9E75'},
  ],
  geminiKey: '',
}

// ── Style helpers ──────────────────────────────────────────────────────────
const s = {
  card: { background:'var(--bg)', border:'0.5px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'12px 14px', marginBottom:10 },
  met: { background:'var(--bg2)', borderRadius:'var(--radius)', padding:'10px 12px' },
  sec: { fontSize:11, fontWeight:500, color:'var(--text2)', marginBottom:8, marginTop:16, textTransform:'uppercase', letterSpacing:'0.06em' },
  pbar: { height:6, borderRadius:3, background:'var(--border)', position:'relative', overflow:'hidden', marginTop:8 },
  pill: c => ({ display:'inline-block', fontSize:11, padding:'2px 7px', borderRadius:99, background:c+'22', color:c, fontWeight:500 }),
  pfill: (pct,color) => ({ position:'absolute', left:0, top:0, height:'100%', width:Math.min(pct,100)+'%', background:pct>100?'#E24B4A':pct>80?'#BA7517':color, borderRadius:3 }),
  inputRow: { width:'100%', marginBottom:10 },
  btn: (bg,color) => ({ width:'100%', padding:'11px', borderRadius:'var(--radius)', border:'none', background:bg, color, fontWeight:500, cursor:'pointer', fontSize:14, marginTop:4 }),
  dashed: { width:'100%', padding:'10px', border:'0.5px dashed var(--border2)', borderRadius:'var(--radius)', background:'none', cursor:'pointer', color:'var(--text2)', fontSize:13, marginTop:4 },
  navBtn: active => ({ flex:1, padding:'9px 2px 8px', border:'none', background:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:2, fontSize:10, color:active?'var(--info)':'var(--text2)', borderTop:active?'2px solid var(--info)':'2px solid transparent' }),
  tab: active => ({ padding:'6px 14px', border:'none', borderRadius:99, background:active?'var(--info-bg)':'none', color:active?'var(--info)':'var(--text2)', fontWeight:active?500:400, cursor:'pointer', fontSize:13 }),
}

// ── InstFields shared component ────────────────────────────────────────────
function InstFields({ f, set }) {
  const monthly = f.iMode==='total' ? calcPmt(f.iTotal,f.iMonths,f.iRate) : (+f.iMonthly||0)
  const u = p => set(prev=>({...prev,...p}))
  return (
    <div>
      <div style={{display:'flex',gap:6,marginBottom:10}}>
        {[['total','輸入總金額'],['monthly','輸入每月金額']].map(([v,l])=>(
          <button key={v} type="button" onClick={()=>u({iMode:v})}
            style={{flex:1,padding:'7px',border:`0.5px solid ${f.iMode===v?'var(--info)':'var(--border2)'}`,borderRadius:'var(--radius)',background:f.iMode===v?'var(--info-bg)':'none',color:f.iMode===v?'var(--info)':'var(--text2)',cursor:'pointer',fontSize:12}}>
            {l}
          </button>
        ))}
      </div>
      {f.iMode==='total' ? (
        <>
          <input style={s.inputRow} type="number" placeholder="商品總金額 NT$" value={f.iTotal} onChange={e=>u({iTotal:e.target.value})} />
          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8,marginBottom:10}}>
            <div><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>期數</div>
              <select style={{...s.inputRow,marginBottom:0}} value={f.iMonths} onChange={e=>u({iMonths:e.target.value})}>
                {[3,6,12,18,24,30,36,48,60].map(n=><option key={n} value={n}>{n} 期</option>)}
              </select>
            </div>
            <div><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>年利率 %</div>
              <input style={{...s.inputRow,marginBottom:0}} type="number" min="0" max="99" step="0.1" placeholder="0" value={f.iRate} onChange={e=>u({iRate:e.target.value})} />
            </div>
          </div>
        </>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8,marginBottom:10}}>
          <div><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>每月金額</div>
            <input style={{...s.inputRow,marginBottom:0}} type="number" placeholder="NT$" value={f.iMonthly} onChange={e=>u({iMonthly:e.target.value})} />
          </div>
          <div><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>期數</div>
            <select style={{...s.inputRow,marginBottom:0}} value={f.iMonths} onChange={e=>u({iMonths:e.target.value})}>
              {[3,6,12,18,24,30,36,48,60].map(n=><option key={n} value={n}>{n} 期</option>)}
            </select>
          </div>
        </div>
      )}
      {monthly>0 && (
        <div style={{fontSize:12,background:'var(--bg2)',padding:'7px 10px',borderRadius:'var(--radius)',marginBottom:10,color:'var(--text2)'}}>
          每月 <b style={{color:'var(--text)'}}>NT${fmt(monthly)}</b>
          {+f.iRate>0 && <span> · 總利息 NT${fmt(Math.max(0,monthly*+f.iMonths-(+f.iTotal||0)))}</span>}
        </div>
      )}
      <label style={{display:'flex',alignItems:'center',gap:8,fontSize:13,cursor:'pointer',marginBottom:10}}>
        <input type="checkbox" checked={f.iFirst} onChange={e=>u({iFirst:e.target.checked})} />首期金額不同
      </label>
      {f.iFirst && <input style={s.inputRow} type="number" placeholder="首期金額 NT$" value={f.iFirstAmt} onChange={e=>u({iFirstAmt:e.target.value})} />}
      <input style={s.inputRow} type="number" placeholder="已繳期數（期中加入時填）" min="0" value={f.iPaid} onChange={e=>u({iPaid:e.target.value})} />
      <div style={{fontSize:11,fontWeight:500,color:'var(--text2)',marginBottom:6}}>計入預算方式</div>
      {[['none','不計入預算'],['monthly',`每月分攤 NT$${monthly?fmt(monthly):'—'}`],['once','一次計入全額']].map(([v,l])=>(
        <label key={v} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,cursor:'pointer',marginBottom:6}}>
          <input type="radio" name="bmode" value={v} checked={f.iBMode===v} onChange={()=>u({iBMode:v})} />{l}
        </label>
      ))}
      {f.iBMode!=='none' && (
        <select style={s.inputRow} value={f.iBCat} onChange={e=>u({iBCat:e.target.value})}>
          {CATS.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
      )}
    </div>
  )
}

// ── Bottom Sheet Modal ─────────────────────────────────────────────────────
function Sheet({ onClose, children }) {
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'flex-end',zIndex:100}} onClick={onClose}>
      <div style={{background:'var(--bg)',borderRadius:'var(--radius-lg) var(--radius-lg) 0 0',padding:'20px 16px 32px',width:'100%',maxHeight:'88vh',overflowY:'auto'}} onClick={e=>e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

function BackBtn({ onClick }) {
  return <button onClick={onClick} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text2)',fontSize:13,paddingLeft:0,marginRight:8}}>‹</button>
}

// ── Auth Screen ────────────────────────────────────────────────────────────
function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const submit = async () => {
    if (!email || !pass) { setErr('請填寫 Email 和密碼'); return }
    setLoading(true); setErr(''); setMsg('')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password: pass })
        if (error) throw error
        setMsg('已發送確認信，請查收 Email 後再登入')
        setMode('login'); setLoading(false); return
      }
    } catch(e) {
      setErr(e.message || '操作失敗')
    }
    setLoading(false)
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'32px 24px',gap:0}}>
      <div style={{textAlign:'center',marginBottom:40}}>
        <div style={{fontSize:52,marginBottom:12}}>◎</div>
        <div style={{fontSize:24,fontWeight:500}}>財務管家</div>
        <div style={{fontSize:13,color:'var(--text2)',marginTop:6}}>個人財務追蹤・分期・AI 分析</div>
      </div>

      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg2)',borderRadius:'var(--radius)',padding:4}}>
        {[['login','登入'],['signup','註冊']].map(([v,l])=>(
          <button key={v} onClick={()=>{setMode(v);setErr('');setMsg('')}}
            style={{flex:1,padding:'8px',border:'none',borderRadius:'var(--radius)',background:mode===v?'var(--bg)':'none',color:mode===v?'var(--text)':'var(--text2)',fontWeight:mode===v?500:400,cursor:'pointer',fontSize:14}}>
            {l}
          </button>
        ))}
      </div>

      <input style={{...s.inputRow,marginBottom:10}} type="email" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />
      <input style={{...s.inputRow,marginBottom:10}} type="password" placeholder="密碼（至少 6 位）" value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} />

      {err && <div style={{fontSize:12,color:'#E24B4A',marginBottom:8,padding:'8px 10px',background:'#E24B4A15',borderRadius:'var(--radius)'}}>{err}</div>}
      {msg && <div style={{fontSize:12,color:'#1D9E75',marginBottom:8,padding:'8px 10px',background:'#1D9E7515',borderRadius:'var(--radius)'}}>{msg}</div>}

      <button onClick={submit} disabled={loading}
        style={s.btn(loading?'var(--bg2)':'var(--info-bg)', loading?'var(--text2)':'var(--info)')}>
        {loading ? '處理中...' : mode==='login' ? '登入' : '建立帳號'}
      </button>
    </div>
  )
}

// ── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncErr, setSyncErr] = useState('')

  // App data
  const [cards, setCards] = useState(INIT.cards)
  const [txs, setTxs] = useState(INIT.txs)
  const [inst, setInst] = useState(INIT.inst)
  const [budgets, setBudgets] = useState(INIT.budgets)
  const [subs, setSubs] = useState(INIT.subs)
  const [assets, setAssets] = useState(INIT.assets)
  const [geminiKey, setGeminiKey] = useState(INIT.geminiKey)
  const [dataLoaded, setDataLoaded] = useState(false)

  // UI state
  const [page, setPage] = useState('home')
  const [hTab, setHTab] = useState('budget')
  const [modal, setModal] = useState(null)
  const [flowM, setFlowM] = useState(TM())

  // AI state
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState('')
  const [chatMsgs, setChatMsgs] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [scanLoading, setScanLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanPreview, setScanPreview] = useState(null)
  const [scanSelected, setScanSelected] = useState([])
  const [aiTab, setAiTab] = useState('analysis')
  const imgRef = useRef()
  const chatEndRef = useRef()
  const saveTimer = useRef(null)

  // Forms
  const ef = () => ({cid:cards[0]?.id||'',amt:'',bAmt:'',sameBudget:true,cat:'餐飲',desc:'',date:nowDate(),isInst:false,iMode:'total',iTotal:'',iMonthly:'',iMonths:'6',iRate:'0',iFirst:false,iFirstAmt:'',iPaid:'0',iBMode:'monthly',iBCat:'購物'})
  const [eF, setEF] = useState(ef())
  const [incF, setIncF] = useState({aid:'',amt:'',desc:'',date:nowDate()})
  const [xfF, setXfF] = useState({fid:'',tid:'',amt:'',desc:'',date:nowDate()})
  const iF0 = () => ({cid:cards[0]?.id||'',name:'',iMode:'total',iTotal:'',iMonthly:'',iMonths:'12',iRate:'0',iFirst:false,iFirstAmt:'',iPaid:'0',iBMode:'monthly',iBCat:'購物',start:TM()})
  const [instF, setInstF] = useState(iF0())
  const [budF, setBudF] = useState({cat:'餐飲',limit:''})
  const [subF, setSubF] = useState({name:'',amt:'',cid:'',cat:'串流',day:'1'})
  const [crdF, setCrdF] = useState({name:'',last:'',color:CARD_COLORS[0],limit:'',bDate:'14'})
  const [astF, setAstF] = useState({name:'',type:'bank',balance:'',color:'#378ADD'})
  const [keyInput, setKeyInput] = useState('')
  const [confirmClear, setConfirmClear] = useState(false)

  // ── Auth ──
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setAuthChecked(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Load data when user logs in
  useEffect(() => {
    if (!user || dataLoaded) return
    ;(async () => {
      try {
        const d = await loadUserData(user.id)
        if (d) {
          if (d.cards?.length) setCards(d.cards)
          if (d.txs) setTxs(d.txs)
          if (d.inst?.length) setInst(d.inst)
          if (d.budgets) setBudgets(d.budgets)
          if (d.subs?.length) setSubs(d.subs)
          if (d.assets?.length) setAssets(d.assets)
          if (d.geminiKey) setGeminiKey(d.geminiKey)
        }
        setDataLoaded(true)
      } catch(e) {
        console.error('Load error:', e)
        setDataLoaded(true)
      }
    })()
  }, [user])

  // Debounced cloud sync
  const scheduleSync = useCallback((data) => {
    if (!user) return
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSyncing(true); setSyncErr('')
      try { await saveUserData(user.id, data) }
      catch(e) { setSyncErr('雲端同步失敗') }
      setSyncing(false)
    }, 1200)
  }, [user])

  const getData = () => ({ cards, txs, inst, budgets, subs, assets, geminiKey })

  // Sync helpers
  const updCards = v => { setCards(v); scheduleSync({...getData(), cards:v}) }
  const updTxs = v => { setTxs(v); scheduleSync({...getData(), txs:v}) }
  const updInst = v => { setInst(v); scheduleSync({...getData(), inst:v}) }
  const updBudgets = v => { setBudgets(v); scheduleSync({...getData(), budgets:v}) }
  const updSubs = v => { setSubs(v); scheduleSync({...getData(), subs:v}) }
  const updAssets = v => { setAssets(v); scheduleSync({...getData(), assets:v}) }
  const updKey = v => { setGeminiKey(v); scheduleSync({...getData(), geminiKey:v}) }

  // ── Derived ──
  const tm = TM()
  const tmExpTxs = txs.filter(t => t.date?.startsWith(tm) && t.type==='expense')
  const tmSpend = tmExpTxs.reduce((s,t)=>s+t.amt, 0)
  const activeInst = inst.filter(i => i.paidM < i.totalM)
  const mInstTotal = activeInst.reduce((s,i)=>s+i.monthly, 0)
  const mSubTotal = subs.reduce((s,sub)=>s+sub.amount, 0)
  const netWorth = assets.reduce((s,a)=>s+a.balance, 0)
  const cName = id => cards.find(c=>c.id===id)?.name||'未知'
  const cColor = id => cards.find(c=>c.id===id)?.color||'#888'
  const aName = id => assets.find(a=>a.id===id)?.name||'未知'

  const getBudgetSpent = (cat, month) => {
    const tA = txs.filter(t=>t.type==='expense'&&t.date?.startsWith(month)&&t.cat===cat).reduce((s,t)=>s+(t.bAmt??t.amt), 0)
    const iA = activeInst.filter(i=>i.bMode==='monthly'&&i.bCat===cat).reduce((s,i)=>s+i.monthly, 0)
    return tA + iA
  }

  // ── CRUD ──
  const addExpense = () => {
    if (!eF.amt) return
    const totalAmt = +eF.amt, budAmt = eF.sameBudget ? totalAmt : (+eF.bAmt||0)
    if (eF.isInst) {
      const monthly = eF.iMode==='total' ? calcPmt(eF.iTotal,eF.iMonths,eF.iRate) : (+eF.iMonthly||0)
      if (!monthly) return
      updInst([...inst, {id:uid(),cardId:eF.cid,name:eF.desc||eF.cat,monthly,first:eF.iFirst?(+eF.iFirstAmt||null):null,totalM:+eF.iMonths,paidM:+eF.iPaid,rate:+eF.iRate,start:eF.date.slice(0,7),bMode:eF.iBMode,bCat:eF.iBCat}])
    } else {
      updTxs([{id:uid(),type:'expense',cid:eF.cid,amt:totalAmt,bAmt:budAmt,cat:eF.cat,desc:eF.desc,date:eF.date}, ...txs])
    }
    setEF(ef()); setModal(null)
  }

  const addIncome = () => {
    if (!incF.amt) return
    const amt = +incF.amt
    updAssets(assets.map(a => a.id===incF.aid ? {...a,balance:a.balance+amt} : a))
    updTxs([{id:uid(),type:'income',aid:incF.aid,amt,desc:incF.desc||'收入',date:incF.date}, ...txs])
    setIncF(f=>({...f,amt:'',desc:''})); setModal(null)
  }

  const addTransfer = () => {
    if (!xfF.amt || xfF.fid===xfF.tid) return
    const amt = +xfF.amt
    updAssets(assets.map(a => a.id===xfF.fid ? {...a,balance:a.balance-amt} : a.id===xfF.tid ? {...a,balance:a.balance+amt} : a))
    updTxs([{id:uid(),type:'transfer',fid:xfF.fid,tid:xfF.tid,amt,desc:xfF.desc||'轉帳',date:xfF.date}, ...txs])
    setXfF(f=>({...f,amt:'',desc:''})); setModal(null)
  }

  const addInst = () => {
    if (!instF.name) return
    const monthly = instF.iMode==='total' ? calcPmt(instF.iTotal,instF.iMonths,instF.iRate) : (+instF.iMonthly||0)
    if (!monthly) return
    updInst([...inst, {id:uid(),cardId:instF.cid,name:instF.name,monthly,first:instF.iFirst?(+instF.iFirstAmt||null):null,totalM:+instF.iMonths,paidM:+instF.iPaid,rate:+instF.iRate,start:instF.start,bMode:instF.iBMode,bCat:instF.iBCat}])
    setInstF(iF0()); setModal(null)
  }

  const addBudget = () => {
    if (!budF.limit) return
    const ex = budgets.find(b=>b.cat===budF.cat)
    if (ex) updBudgets(budgets.map(b=>b.cat===budF.cat?{...b,limit:+budF.limit}:b))
    else updBudgets([...budgets, {id:uid(),cat:budF.cat,limit:+budF.limit}])
    setBudF({cat:'餐飲',limit:''}); setModal(null)
  }

  const addSub = () => {
    if (!subF.name||!subF.amt) return
    updSubs([...subs, {id:uid(),name:subF.name,amount:+subF.amt,cardId:subF.cid,cat:subF.cat,day:+subF.day||1}])
    setSubF({name:'',amt:'',cid:cards[0]?.id||'',cat:'串流',day:'1'}); setModal(null)
  }

  const addCard = () => {
    if (!crdF.name||!crdF.limit) return
    updCards([...cards, {id:uid(),name:crdF.name,lastFour:crdF.last,color:crdF.color,limit:+crdF.limit,billingDate:+crdF.bDate||14}])
    setCrdF({name:'',last:'',color:CARD_COLORS[0],limit:'',bDate:'14'}); setModal(null)
  }

  const addAsset = () => {
    if (!astF.name) return
    updAssets([...assets, {id:uid(),name:astF.name,type:astF.type,balance:+astF.balance||0,color:astF.color}])
    setAstF({name:'',type:'bank',balance:'',color:'#378ADD'}); setModal(null)
  }

  const payInst = id => updInst(inst.map(i=>i.id===id?{...i,paidM:Math.min(i.paidM+1,i.totalM)}:i))
  const delCard = id => updCards(cards.filter(c=>c.id!==id))
  const delInst = id => updInst(inst.filter(i=>i.id!==id))
  const delBudget = id => updBudgets(budgets.filter(b=>b.id!==id))
  const delSub = id => updSubs(subs.filter(x=>x.id!==id))
  const delAsset = id => updAssets(assets.filter(a=>a.id!==id))
  const delTx = id => updTxs(txs.filter(t=>t.id!==id))

  const clearAllData = () => {
    updCards([]); updTxs([]); updInst([]); updBudgets([]); updSubs([]); updAssets([])
    setConfirmClear(false); setModal(null)
  }

  // ── Gemini ──
  const callGemini = async (prompt, imgBase64=null, mime='image/jpeg') => {
    const parts = [{text:prompt}]
    if (imgBase64) parts.unshift({inline_data:{mime_type:mime,data:imgBase64}})
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({contents:[{parts}]})
    })
    if (!res.ok) throw new Error(`API 錯誤 ${res.status}`)
    const d = await res.json()
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text
    if (!text) throw new Error('無回應')
    return text
  }

  const buildSummary = () => {
    const catSpend = CATS.map(c=>({cat:c,amt:getBudgetSpent(c,tm)})).filter(x=>x.amt>0)
    return `【本月 ${tm}】\n消費: ${catSpend.map(x=>`${x.cat} NT$${fmt(x.amt)}`).join('、') || '無'}\n\n【預算】\n${budgets.map(b=>{const sp=getBudgetSpent(b.cat,tm);return`${b.cat}: NT$${fmt(sp)}/${fmt(b.limit)} (${Math.round(b.limit>0?sp/b.limit*100:0)}%)`;}).join('\n') || '未設定'}\n\n【分期 ${activeInst.length}筆，每月 NT$${fmt(mInstTotal)}】\n${activeInst.slice(0,8).map(i=>`${i.name} NT$${fmt(i.monthly)}/月 剩${i.totalM-i.paidM}期`).join('\n')}\n\n【訂閱 NT$${fmt(mSubTotal)}/月】\n${subs.map(s=>`${s.name} NT$${fmt(s.amount)}`).join('、') || '無'}\n\n【資產 淨資產 NT$${fmt(netWorth)}】\n${assets.map(a=>`${a.name}: NT$${fmt(a.balance)}`).join('\n')}`
  }

  const runAnalysis = async () => {
    if (!geminiKey) { setModal('setKey'); return }
    setAiLoading(true); setAiResult('')
    try {
      const r = await callGemini(`你是親切的個人財務顧問。請用繁體中文分析以下財務數據，給具體建議。\n\n${buildSummary()}\n\n請用以下格式（用 emoji）：\n📊 整體評估（2-3句）\n⚠️ 需注意項目\n💡 節省建議（3-5個具體建議）\n📅 分期管理建議\n🎯 本月目標（一個可達成的目標）\n\n語氣像朋友，不要學術。`)
      setAiResult(r)
    } catch(e) { setAiResult(`❌ 分析失敗：${e.message}`) }
    setAiLoading(false)
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    if (!geminiKey) { setModal('setKey'); return }
    const userMsg = {role:'user', text:chatInput.trim()}
    const newMsgs = [...chatMsgs, userMsg]
    setChatMsgs(newMsgs); setChatInput(''); setChatLoading(true)
    setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:'smooth'}), 100)
    try {
      const history = newMsgs.slice(-8).map(m=>`${m.role==='user'?'用戶':'AI'}: ${m.text}`).join('\n')
      const r = await callGemini(`你是「財務分析師小幫手」，是用戶的專屬財務顧問。用繁體中文回答，語氣親切、具體實用。\n\n【用戶財務概況】\n${buildSummary()}\n\n【對話紀錄】\n${history}\n\n請針對最後一個問題回答，100-200字為佳。`)
      setChatMsgs(p=>[...p, {role:'ai',text:r}])
    } catch(e) { setChatMsgs(p=>[...p, {role:'ai',text:`❌ 錯誤：${e.message}`}]) }
    setChatLoading(false)
    setTimeout(() => chatEndRef.current?.scrollIntoView({behavior:'smooth'}), 100)
  }

  const handleImageScan = async (file) => {
    if (!file) return
    if (!geminiKey) { setModal('setKey'); return }
    setScanLoading(true); setScanResult(null); setScanSelected([])
    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1]
      setScanPreview(e.target.result)
      try {
        const raw = await callGemini(`分析截圖（帳單/訂閱/消費記錄），提取消費項目。只回傳 JSON 陣列，不要其他文字：\n[{"desc":"名稱","amount":數字,"cat":"餐飲/購物/交通/娛樂/日用/旅遊/訂閱/其他","type":"expense","date":"${nowDate()}","isRecurring":false,"billingDay":null}]\n若是每月訂閱設 isRecurring:true 並填 billingDay。金額用台幣。無項目回傳 [].`, base64, file.type||'image/jpeg')
        const clean = raw.replace(/```json|```/g,'').trim()
        const parsed = JSON.parse(clean)
        setScanResult(Array.isArray(parsed)?parsed:[])
        setScanSelected(parsed.map((_,i)=>i))
      } catch(err) { setScanResult([]); }
      setScanLoading(false)
    }
    reader.readAsDataURL(file)
  }

  const importScanned = () => {
    if (!scanResult) return
    const toImp = scanResult.filter((_,i)=>scanSelected.includes(i))
    const newTxs = toImp.filter(r=>!r.isRecurring).map(r=>({id:uid(),type:'expense',cid:cards[0]?.id||'',amt:r.amount,bAmt:r.amount,cat:r.cat,desc:r.desc,date:r.date}))
    const newSubs = toImp.filter(r=>r.isRecurring).map(r=>({id:uid(),name:r.desc,amount:r.amount,cardId:cards[0]?.id||'',cat:'串流',day:r.billingDay||1}))
    if (newTxs.length) updTxs([...newTxs,...txs])
    if (newSubs.length) updSubs([...subs,...newSubs])
    setScanResult(null); setScanPreview(null); setScanSelected([])
    setPage('home')
  }

  // ── Loading / Auth gate ──
  if (!authChecked) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontSize:40}}>◎</div><div style={{color:'var(--text2)'}}>載入中...</div>
    </div>
  )
  if (!user) return <div style={{flex:1,display:'flex',flexDirection:'column'}}><AuthScreen onAuth={setUser}/></div>
  if (!dataLoaded) return (
    <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{fontSize:40}}>◎</div><div style={{color:'var(--text2)'}}>同步資料中...</div>
    </div>
  )

  // ── Page Components ────────────────────────────────────────────────────────

  const BudgetTab = () => (
    <div>
      {budgets.length===0 ? (
        <div style={{textAlign:'center',padding:'28px 20px',borderBottom:'0.5px solid var(--border)',marginBottom:16}}>
          <div style={{fontSize:28,marginBottom:10}}>◎</div>
          <div style={{fontWeight:500,marginBottom:6}}>尚未設定預算</div>
          <div style={{fontSize:13,color:'var(--text2)',marginBottom:16}}>設定後這裡會顯示各類別使用狀況</div>
          <button onClick={()=>setModal('addBudget')} style={{padding:'9px 20px',border:'0.5px solid var(--info)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:13,color:'var(--info)'}}>
            來新增第一筆預算吧 →
          </button>
        </div>
      ) : (
        <>
          {budgets.map(b => {
            const spent=getBudgetSpent(b.cat,tm), pct=b.limit>0?(spent/b.limit)*100:0, color=CAT_COLOR[b.cat]||'#888', over=pct>100
            const iA=activeInst.filter(i=>i.bMode==='monthly'&&i.bCat===b.cat).reduce((s,i)=>s+i.monthly,0)
            return (
              <div key={b.id} style={{...s.card,borderLeft:`3px solid ${over?'#E24B4A':pct>80?'#BA7517':color}`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                  <span style={{fontWeight:500,fontSize:14}}>{b.cat}{over&&<span style={{fontSize:11,marginLeft:6,color:'#E24B4A'}}>超出</span>}</span>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div><span style={{fontSize:15,fontWeight:500,color:over?'#E24B4A':pct>80?'#BA7517':'var(--text)'}}>NT${fmt(spent)}</span><span style={{fontSize:12,color:'var(--text2)'}}> / {fmt(b.limit)}</span></div>
                    <button onClick={()=>delBudget(b.id)} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:16,lineHeight:1}}>×</button>
                  </div>
                </div>
                <div style={s.pbar}><div style={s.pfill(pct,color)}></div></div>
                <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:11,color:'var(--text2)'}}>
                  <span>{Math.round(pct)}%{iA>0&&` （含分期 ${fmt(iA)}）`}</span>
                  {over?<span style={{color:'#E24B4A'}}>超出 NT${fmt(spent-b.limit)}</span>:<span>剩 NT${fmt(b.limit-spent)}</span>}
                </div>
              </div>
            )
          })}
          <button style={s.dashed} onClick={()=>setModal('addBudget')}>+ 新增 / 修改預算</button>
        </>
      )}

      <div style={{...s.sec,display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:20}}>
        <span>資產概況</span>
        <span style={{fontSize:12,fontWeight:500,color:'var(--text)'}}>淨資產 {netWorth<0&&'-'}NT${fmt(netWorth)}</span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:4}}>
        {assets.map(a=>(
          <div key={a.id} style={{...s.met,borderLeft:`3px solid ${a.color}`,position:'relative'}}>
            <div style={{fontSize:11,color:'var(--text2)',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</div>
            <div style={{fontSize:16,fontWeight:500,color:a.balance<0?'#E24B4A':'var(--text)'}}>{a.balance<0&&'- '}NT${fmt(a.balance)}</div>
            <button onClick={()=>delAsset(a.id)} style={{position:'absolute',top:6,right:8,border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:14,lineHeight:1}}>×</button>
          </div>
        ))}
      </div>
      <button style={s.dashed} onClick={()=>setModal('addAsset')}>+ 新增帳戶</button>

      <div style={s.sec}>最近記錄</div>
      {txs.length===0 && <div style={{color:'var(--text2)',fontSize:13,textAlign:'center',padding:'20px 0'}}>尚無記錄，點右上角「+ 記帳」開始</div>}
      {txs.slice(0,10).map(t=>{
        const isExp=t.type==='expense', isInc=t.type==='income'
        const dotColor=isExp?'#E24B4A':isInc?'#1D9E75':'#378ADD'
        const label=isExp?(t.desc||t.cat):isInc?(t.desc||'收入'):(t.desc||aName(t.fid)+' → '+aName(t.tid))
        const diff=isExp&&t.bAmt!==undefined&&t.bAmt!==t.amt
        return (
          <div key={t.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flex:1,minWidth:0}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:dotColor,flexShrink:0}}></div>
              <div style={{minWidth:0}}>
                <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{label}</div>
                <div style={{fontSize:11,color:'var(--text2)',marginTop:1,display:'flex',alignItems:'center',gap:4}}>
                  <span>{t.date}</span>
                  {isExp&&<span style={s.pill(CAT_COLOR[t.cat]||'#888')}>{t.cat}</span>}
                </div>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0,marginLeft:8}}>
              <div style={{textAlign:'right'}}>
                <div style={{fontWeight:500,color:dotColor,fontSize:13}}>{isExp?'-':isInc?'+':''}NT${fmt(t.amt)}</div>
                {diff&&<div style={{fontSize:10,color:'var(--text2)'}}>計入 {fmt(t.bAmt)}</div>}
              </div>
              <button onClick={()=>delTx(t.id)} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:16,lineHeight:1}}>×</button>
            </div>
          </div>
        )
      })}
    </div>
  )

  const InstTab = () => {
    const done = inst.filter(i=>i.paidM>=i.totalM)
    return (
      <div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
          <div style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>每月固定分期</div><div style={{fontSize:18,fontWeight:500}}>NT${fmt(mInstTotal)}</div></div>
          <div style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>進行中</div><div style={{fontSize:18,fontWeight:500}}>{activeInst.length} 筆</div></div>
        </div>
        {activeInst.length===0 && <div style={{color:'var(--text2)',fontSize:13,textAlign:'center',padding:'16px 0'}}>沒有進行中的分期</div>}
        {activeInst.map(i=>{
          const rem=i.totalM-i.paidM, pct=(i.paidM/i.totalM)*100
          const bLabel=i.bMode==='monthly'?`每月計入${i.bCat}`:i.bMode==='once'?`一次計入${i.bCat}`:'不計入預算'
          return (
            <div key={i.id} style={s.card}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:500,fontSize:14,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{i.name}</div>
                  <div style={{fontSize:11,color:'var(--text2)',marginTop:1}}>{cName(i.cardId)}{i.rate>0&&` · ${i.rate}%/年`} · <span style={{color:'#BA7517'}}>{bLabel}</span></div>
                </div>
                <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                  <div style={{fontSize:16,fontWeight:500}}>NT${fmt(i.monthly)}<span style={{fontSize:11,fontWeight:400,color:'var(--text2)'}}>/月</span></div>
                  <div style={{fontSize:11,color:'var(--text2)'}}>剩 {rem} 期</div>
                </div>
              </div>
              <div style={s.pbar}><div style={s.pfill(pct,cColor(i.cardId))}></div></div>
              <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:11,color:'var(--text2)'}}><span>{i.paidM}/{i.totalM}</span><span>尚欠 NT${fmt(rem*i.monthly)}</span></div>
              <div style={{display:'flex',gap:8,marginTop:8}}>
                <button onClick={()=>payInst(i.id)} style={{flex:1,padding:'5px 0',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:12,color:'var(--text2)'}}>已繳 +1</button>
                <button onClick={()=>delInst(i.id)} style={{padding:'5px 10px',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:12,color:'var(--text2)'}}>刪除</button>
              </div>
            </div>
          )
        })}
        <button style={s.dashed} onClick={()=>{setInstF(iF0());setModal('addInst')}}>+ 手動新增分期</button>
        {done.length>0&&<><div style={s.sec}>已完成</div>{done.map(i=><div key={i.id} style={{...s.card,opacity:0.4}}><div style={{display:'flex',justifyContent:'space-between',fontSize:13}}><span>{i.name}</span><span style={{color:'var(--text2)'}}>NT${fmt(i.monthly)}/月 · {i.totalM}期 ✓</span></div></div>)}</>}
      </div>
    )
  }

  const SubsTab = () => (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>每月訂閱</div><div style={{fontSize:18,fontWeight:500}}>NT${fmt(mSubTotal)}</div></div>
        <div style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>訂閱項目</div><div style={{fontSize:18,fontWeight:500}}>{subs.length} 項</div></div>
      </div>
      {subs.length===0&&<div style={{color:'var(--text2)',fontSize:13,textAlign:'center',padding:'20px 0'}}>尚無訂閱</div>}
      {subs.map(s2=>(
        <div key={s2.id} style={s.card}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:'#BA751722',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#BA7517',flexShrink:0}}>{SUB_ICONS[s2.cat]||'◉'}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500}}>{s2.name}</div><div style={{fontSize:11,color:'var(--text2)',marginTop:1}}>每月 {s2.day} 日 · {s2.cat} · {cName(s2.cardId)}</div></div>
            <div style={{fontWeight:500,marginRight:8}}>NT${fmt(s2.amount)}</div>
            <button onClick={()=>delSub(s2.id)} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:18,lineHeight:1}}>×</button>
          </div>
        </div>
      ))}
      <button style={s.dashed} onClick={()=>setModal('addSub')}>+ 新增訂閱</button>
    </div>
  )

  // ── Pages ──
  const HomePage = () => (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
        <div>
          <div style={{fontSize:11,color:'var(--text2)'}}>本月消費</div>
          <div style={{fontSize:26,fontWeight:500,lineHeight:1.2}}>NT${fmt(tmSpend)}</div>
          <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>固定 NT${fmt(mInstTotal+mSubTotal)}</div>
        </div>
        <button onClick={()=>setModal('typeSelect')} style={{padding:'9px 16px',border:'none',borderRadius:'var(--radius)',background:'var(--info-bg)',color:'var(--info)',cursor:'pointer',fontSize:13,fontWeight:500,marginTop:4}}>
          + 記帳
        </button>
      </div>
      <div style={{display:'flex',gap:4,marginBottom:14,borderBottom:'0.5px solid var(--border)',paddingBottom:8}}>
        {[['budget','預算'],['inst','分期'],['subs_tab','訂閱']].map(([id,l])=>(
          <button key={id} style={s.tab(hTab===id)} onClick={()=>setHTab(id)}>{l}</button>
        ))}
      </div>
      {hTab==='budget'&&<BudgetTab/>}
      {hTab==='inst'&&<InstTab/>}
      {hTab==='subs_tab'&&<SubsTab/>}
    </div>
  )

  const CardsPage = () => (
    <div>
      <div style={s.sec}>我的信用卡</div>
      {cards.length===0&&<div style={{color:'var(--text2)',fontSize:13,textAlign:'center',padding:'20px 0'}}>尚無信用卡，點下方按鈕新增</div>}
      {cards.map(c=>{
        const spent=tmExpTxs.filter(t=>t.cid===c.id).reduce((s,t)=>s+t.amt,0)
        const instT=activeInst.filter(i=>i.cardId===c.id).reduce((s,i)=>s+i.monthly,0)
        const subT=subs.filter(x=>x.cardId===c.id).reduce((s,x)=>s+x.amount,0)
        const pct=c.limit>0?((spent+instT)/c.limit)*100:0
        return (
          <div key={c.id} style={{...s.card,borderLeft:`3px solid ${c.color}`}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
              <div><div style={{fontWeight:500,fontSize:15}}>{c.name}</div>{c.lastFour&&<div style={{fontSize:11,color:'var(--text2)'}}>**** {c.lastFour} · 帳單日 {c.billingDate} 日</div>}</div>
              <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                <div style={{textAlign:'right'}}><div style={{fontSize:11,color:'var(--text2)'}}>額度</div><div style={{fontWeight:500}}>NT${fmt(c.limit)}</div></div>
                <button onClick={()=>delCard(c.id)} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:16,lineHeight:1,marginTop:2}}>×</button>
              </div>
            </div>
            <div style={{display:'flex',gap:10,fontSize:12,flexWrap:'wrap',marginBottom:6}}>
              <span><span style={{color:'var(--text2)'}}>消費 </span><b>NT${fmt(spent)}</b></span>
              <span><span style={{color:'var(--text2)'}}>分期 </span><b>NT${fmt(instT)}</b></span>
              <span><span style={{color:'var(--text2)'}}>訂閱 </span><b>NT${fmt(subT)}</b></span>
            </div>
            <div style={s.pbar}><div style={s.pfill(pct,c.color)}></div></div>
            <div style={{fontSize:11,color:'var(--text2)',marginTop:3,textAlign:'right'}}>{Math.round(pct)}% 使用</div>
          </div>
        )
      })}
      <button style={s.dashed} onClick={()=>setModal('addCard')}>+ 新增信用卡</button>
    </div>
  )

  const SubsPage = () => (
    <div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:14}}>
        <div style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>每月合計</div><div style={{fontSize:18,fontWeight:500}}>NT${fmt(mSubTotal)}</div></div>
        <div style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>訂閱數</div><div style={{fontSize:18,fontWeight:500}}>{subs.length} 項</div></div>
      </div>
      {subs.length===0&&<div style={{color:'var(--text2)',fontSize:13,textAlign:'center',padding:'24px 0'}}><div style={{fontSize:28,marginBottom:8}}>↻</div>尚無訂閱</div>}
      {subs.map(x=>(
        <div key={x.id} style={s.card}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:38,height:38,borderRadius:10,background:'#BA751722',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,color:'#BA7517',flexShrink:0}}>{SUB_ICONS[x.cat]||'◉'}</div>
            <div style={{flex:1,minWidth:0}}><div style={{fontWeight:500}}>{x.name}</div><div style={{fontSize:11,color:'var(--text2)',marginTop:1}}>每月 {x.day} 日 · {x.cat} · {cName(x.cardId)}</div></div>
            <div style={{textAlign:'right',flexShrink:0,marginRight:4}}><div style={{fontSize:16,fontWeight:500}}>NT${fmt(x.amount)}</div><div style={{fontSize:11,color:'var(--text2)'}}>每月</div></div>
            <button onClick={()=>delSub(x.id)} style={{border:'none',background:'none',cursor:'pointer',color:'var(--text3)',fontSize:18,lineHeight:1}}>×</button>
          </div>
        </div>
      ))}
      <button style={s.dashed} onClick={()=>setModal('addSub')}>+ 新增訂閱</button>
      <div style={s.sec}>年度試算</div>
      <div style={{...s.card,borderLeft:'3px solid #BA7517'}}>
        {[['每月',1],['每季',3],['每年',12]].map(([l,n])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',fontSize:13,marginBottom:6,fontWeight:n===12?500:400}}>
            <span>{l}</span><span style={{color:n===12?'#D85A30':'inherit'}}>NT${fmt(mSubTotal*n)}</span>
          </div>
        ))}
      </div>
    </div>
  )

  const AiPage = () => (
    <div>
      {[['analysis','分析'],['chat','問財務師'],['scan','掃描匯入']].map(([id,l])=>(
        null // handled below
      ))}
      <div style={{display:'flex',gap:4,marginBottom:16,borderBottom:'0.5px solid var(--border)',paddingBottom:8}}>
        {[['analysis','AI 分析'],['chat','問財務師'],['scan','掃描匯入']].map(([id,l])=>(
          <button key={id} style={s.tab(aiTab===id)} onClick={()=>setAiTab(id)}>{l}</button>
        ))}
      </div>

      {aiTab==='analysis'&&(
        <div>
          <div style={{...s.card,borderLeft:'3px solid #7F77DD'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div>
                <div style={{fontWeight:500,fontSize:15}}>財務健康分析</div>
                <div style={{fontSize:11,color:'var(--text2)',marginTop:2}}>Gemini AI 分析你的消費習慣</div>
              </div>
              <button onClick={runAnalysis} disabled={aiLoading}
                style={{padding:'8px 14px',border:'none',borderRadius:'var(--radius)',background:geminiKey?'#7F77DD':'var(--bg2)',color:geminiKey?'#fff':'var(--text2)',cursor:geminiKey?'pointer':'not-allowed',fontSize:13,fontWeight:500,minWidth:70}}>
                {aiLoading?'分析中...':'開始分析'}
              </button>
            </div>
            {aiLoading && <div style={{textAlign:'center',padding:'20px 0',color:'var(--text2)',fontSize:13}}>Gemini 分析中...</div>}
            {aiResult&&!aiLoading && <div style={{fontSize:13,lineHeight:1.8,borderTop:'0.5px solid var(--border)',paddingTop:12,whiteSpace:'pre-wrap'}}>{aiResult}</div>}
            {!aiResult&&!aiLoading && <div style={{fontSize:12,color:'var(--text2)',background:'var(--bg2)',borderRadius:'var(--radius)',padding:'10px 12px'}}>按「開始分析」，AI 會評估預算、分期、訂閱費用，給出具體建議</div>}
          </div>
          {!geminiKey&&<div style={{...s.card,borderLeft:'3px solid #7F77DD',marginTop:4}}><div style={{fontSize:13,marginBottom:8}}>尚未設定 Gemini API Key</div><button onClick={()=>setModal('setKey')} style={{padding:'8px 16px',border:'0.5px solid #7F77DD',borderRadius:'var(--radius)',background:'none',color:'#7F77DD',cursor:'pointer',fontSize:13}}>前往設定 →</button></div>}
        </div>
      )}

      {aiTab==='chat'&&(
        <div style={{display:'flex',flexDirection:'column',height:'calc(100vh - 280px)'}}>
          <div style={{...s.card,background:'#7F77DD15',borderLeft:'3px solid #7F77DD',marginBottom:8}}>
            <div style={{fontWeight:500,fontSize:14}}>專屬財務分析師</div>
            <div style={{fontSize:12,color:'var(--text2)',marginTop:2}}>有任何財務問題都可以問我，我了解你的完整財務狀況</div>
          </div>
          <div style={{flex:1,overflowY:'auto',marginBottom:8}}>
            {chatMsgs.length===0&&(
              <div style={{color:'var(--text2)',fontSize:13,textAlign:'center',padding:'20px 0'}}>
                {[['💰','本月我應該削減哪個開銷？'],['📊','我的分期壓力大嗎？'],['💡','有什麼省錢建議？']].map(([e,q])=>(
                  <div key={q} onClick={()=>setChatInput(q)} style={{background:'var(--bg2)',borderRadius:'var(--radius)',padding:'8px 12px',marginBottom:8,cursor:'pointer',textAlign:'left',fontSize:12}}>
                    {e} {q}
                  </div>
                ))}
              </div>
            )}
            {chatMsgs.map((m,i)=>(
              <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',marginBottom:8}}>
                <div style={{maxWidth:'80%',background:m.role==='user'?'var(--info-bg)':'var(--bg2)',borderRadius:m.role==='user'?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'10px 12px',fontSize:13,lineHeight:1.6,color:m.role==='user'?'var(--info)':'var(--text)',whiteSpace:'pre-wrap'}}>
                  {m.text}
                </div>
              </div>
            ))}
            {chatLoading&&<div style={{textAlign:'left',padding:'8px 0'}}><span style={{background:'var(--bg2)',borderRadius:12,padding:'8px 14px',fontSize:13,color:'var(--text2)'}}>思考中...</span></div>}
            <div ref={chatEndRef}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendChat()} placeholder="問任何財務問題..." style={{flex:1,borderRadius:99}} />
            <button onClick={sendChat} disabled={!chatInput.trim()||chatLoading} style={{padding:'10px 16px',border:'none',borderRadius:99,background:chatInput.trim()?'var(--info-bg)':'var(--bg2)',color:chatInput.trim()?'var(--info)':'var(--text2)',cursor:chatInput.trim()?'pointer':'default',fontWeight:500,fontSize:14,flexShrink:0}}>送出</button>
          </div>
        </div>
      )}

      {aiTab==='scan'&&(
        <div>
          <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>handleImageScan(e.target.files[0])}/>
          {!scanResult&&!scanLoading&&(
            <div>
              <button onClick={()=>imgRef.current?.click()} disabled={!geminiKey}
                style={{width:'100%',padding:'24px',border:'0.5px dashed var(--border2)',borderRadius:'var(--radius-lg)',background:'var(--bg2)',cursor:geminiKey?'pointer':'not-allowed',display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
                <span style={{fontSize:36,color:'#1D9E75'}}>⊕</span>
                <span style={{fontSize:14,color:'var(--text2)'}}>點擊上傳截圖</span>
                <span style={{fontSize:11,color:'var(--text3)'}}>支援信用卡帳單、訂閱頁面、消費截圖</span>
              </button>
              <div style={{fontSize:12,color:'var(--text2)',marginTop:10,textAlign:'center'}}>推薦：信用卡帳單明細 · App Store 訂閱 · Netflix 帳號頁面</div>
              {!geminiKey&&<div style={{marginTop:12,fontSize:13,color:'var(--text2)',textAlign:'center'}}>需先設定 Gemini API Key <button onClick={()=>setModal('setKey')} style={{border:'none',background:'none',color:'var(--info)',cursor:'pointer',fontSize:13}}>點此設定</button></div>}
            </div>
          )}
          {scanLoading&&(
            <div style={{textAlign:'center',padding:'24px 0'}}>
              {scanPreview&&<img src={scanPreview} style={{width:'100%',maxHeight:120,objectFit:'cover',borderRadius:'var(--radius)',marginBottom:12,opacity:0.5}} alt=""/>}
              <div style={{fontSize:13,color:'var(--text2)'}}>Gemini 辨識中...</div>
            </div>
          )}
          {scanResult&&!scanLoading&&(
            <div>
              {scanPreview&&<img src={scanPreview} style={{width:'100%',maxHeight:80,objectFit:'cover',borderRadius:'var(--radius)',marginBottom:10,opacity:0.7}} alt=""/>}
              {scanResult.length===0?(
                <div style={{fontSize:13,color:'var(--text2)',textAlign:'center',padding:'16px 0'}}>無法辨識，請嘗試更清晰的截圖</div>
              ):(
                <>
                  <div style={{fontSize:12,color:'var(--text2)',marginBottom:8}}>辨識到 {scanResult.length} 筆，勾選要匯入的：</div>
                  {scanResult.map((r,i)=>(
                    <div key={i} onClick={()=>setScanSelected(p=>p.includes(i)?p.filter(x=>x!==i):[...p,i])}
                      style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:'var(--radius)',background:scanSelected.includes(i)?'var(--info-bg)':'var(--bg2)',marginBottom:6,cursor:'pointer',border:`0.5px solid ${scanSelected.includes(i)?'var(--info)':'transparent'}`}}>
                      <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${scanSelected.includes(i)?'var(--info)':'var(--border2)'}`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        {scanSelected.includes(i)&&<span style={{fontSize:11,color:'var(--info)'}}>✓</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.desc}</div>
                        <div style={{fontSize:11,color:'var(--text2)',marginTop:1,display:'flex',gap:6}}>
                          <span style={s.pill(CAT_COLOR[r.cat]||'#888')}>{r.cat}</span>
                          {r.isRecurring&&<span style={s.pill('#BA7517')}>每月訂閱</span>}
                          <span>{r.date}</span>
                        </div>
                      </div>
                      <div style={{fontWeight:500,flexShrink:0}}>NT${fmt(r.amount)}</div>
                    </div>
                  ))}
                  <div style={{display:'flex',gap:8,marginTop:8}}>
                    <button onClick={()=>{setScanResult(null);setScanPreview(null);setScanSelected([])}} style={{flex:1,padding:'9px',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:13,color:'var(--text2)'}}>重新掃描</button>
                    <button onClick={importScanned} disabled={scanSelected.length===0} style={{flex:2,padding:'9px',border:'none',borderRadius:'var(--radius)',background:scanSelected.length>0?'#1D9E75':'var(--bg2)',color:scanSelected.length>0?'#fff':'var(--text2)',cursor:scanSelected.length>0?'pointer':'not-allowed',fontSize:13,fontWeight:500}}>
                      匯入 {scanSelected.length} 筆
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const FlowPage = () => {
    const months = Array.from({length:6},(_,i)=>addM(flowM,i-1))
    const getI = ym => activeInst.filter(i=>{const s2=i.start||tm;return ym>=s2&&ym<=addM(s2,i.totalM-i.paidM-1)})
    const fData = months.map(ym=>{
      const iA=getI(ym).reduce((s,i)=>s+i.monthly,0), sA=subs.reduce((s,x)=>s+x.amount,0)
      const tA=txs.filter(t=>t.type==='expense'&&t.date?.startsWith(ym)).reduce((s,t)=>s+t.amt,0)
      return {ym,iA,sA,tA,total:iA+sA+tA}
    })
    const sel = fData.find(f=>f.ym===flowM)||fData[1]
    return (
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
          <button onClick={()=>setFlowM(p=>addM(p,-1))} style={{padding:'6px 14px',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:18,color:'var(--text)'}}>‹</button>
          <div style={{textAlign:'center'}}>
            <div style={{fontWeight:500,fontSize:18}}>{mLabel(flowM)}</div>
            <div style={{fontSize:11,color:'var(--text2)'}}>{flowM<tm?'過去':flowM===tm?'本月':'預測'}</div>
          </div>
          <button onClick={()=>setFlowM(p=>addM(p,1))} style={{padding:'6px 14px',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:18,color:'var(--text)'}}>›</button>
        </div>
        <div style={{height:130,marginBottom:6}}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fData} margin={{top:4,right:0,left:-30,bottom:0}}>
              <XAxis dataKey="ym" tick={{fontSize:10}} tickFormatter={v=>v.slice(5)}/>
              <YAxis tick={{fontSize:10}} tickFormatter={v=>v>=1000?Math.round(v/1000)+'k':v}/>
              <Tooltip formatter={(v,n)=>['NT$'+fmt(v),n==='iA'?'分期':n==='sA'?'訂閱':'消費']} contentStyle={{fontSize:11}} labelFormatter={mLabel}/>
              <Bar dataKey="tA" stackId="a" fill="#378ADD"/>
              <Bar dataKey="sA" stackId="a" fill="#BA7517"/>
              <Bar dataKey="iA" stackId="a" fill="#D85A30" radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{display:'flex',gap:12,fontSize:11,color:'var(--text2)',marginBottom:14,justifyContent:'center'}}>
          {[['#378ADD','消費'],['#BA7517','訂閱'],['#D85A30','分期']].map(([c,l])=><span key={l} style={{display:'flex',alignItems:'center',gap:4}}><span style={{width:10,height:10,borderRadius:2,background:c}}></span>{l}</span>)}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
          {[['消費',sel?.tA],['訂閱',sel?.sA],['分期',sel?.iA]].map(([l,v])=><div key={l} style={s.met}><div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>{l}</div><div style={{fontSize:15,fontWeight:500}}>NT${fmt(v||0)}</div></div>)}
        </div>
        <div style={{...s.card,borderLeft:'3px solid #378ADD',marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:13,color:'var(--text2)'}}>預估總支出</span>
            <span style={{fontWeight:500,fontSize:22}}>NT${fmt(sel?.total||0)}</span>
          </div>
        </div>
        {getI(flowM).length>0&&<><div style={s.sec}>分期明細</div>{getI(flowM).map(i=><div key={i.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}><div><div style={{fontSize:13,fontWeight:500}}>{i.name}</div><div style={{fontSize:11,color:'var(--text2)'}}>剩 {i.totalM-i.paidM} 期 · {cName(i.cardId)}</div></div><span style={{fontWeight:500}}>NT${fmt(i.monthly)}</span></div>)}</>}
        {subs.length>0&&<><div style={s.sec}>訂閱明細</div>{subs.map(x=><div key={x.id} style={{display:'flex',justifyContent:'space-between',padding:'8px 0',borderBottom:'0.5px solid var(--border)'}}><div><div style={{fontSize:13,fontWeight:500}}>{x.name}</div><div style={{fontSize:11,color:'var(--text2)'}}>{x.day} 日 · {cName(x.cardId)}</div></div><span style={{fontWeight:500}}>NT${fmt(x.amount)}</span></div>)}</>}
        <div style={s.sec}>6 個月總表</div>
        {fData.map(f=><div key={f.ym} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 10px',borderRadius:'var(--radius)',background:f.ym===flowM?'var(--bg2)':'transparent',marginBottom:2}}><div style={{fontSize:13,fontWeight:f.ym===flowM?500:400}}>{mLabel(f.ym)}{f.ym===tm?' 本月':''}</div><div style={{display:'flex',gap:10,fontSize:12}}><span style={{color:'var(--text2)'}}>分{fmt(f.iA)} 訂{fmt(f.sA)}</span><span style={{fontWeight:500,minWidth:80,textAlign:'right'}}>NT${fmt(f.total)}</span></div></div>)}
      </div>
    )
  }

  const NAV = [
    {id:'home',label:'總覽',icon:'◉'},
    {id:'cards',label:'信用卡',icon:'▣'},
    {id:'subs',label:'訂閱',icon:'↻'},
    {id:'ai',label:'AI',icon:'✦'},
    {id:'flow',label:'收支',icon:'≋'},
  ]

  // ── Modals ──
  const renderModal = () => {
    if (!modal) return null
    const close = () => setModal(null)
    const mTitle = (title, back=null) => (
      <div style={{display:'flex',alignItems:'center',marginBottom:14}}>
        {back&&<BackBtn onClick={()=>setModal(back)}/>}
        <span style={{fontWeight:500,fontSize:15}}>{title}</span>
      </div>
    )
    return (
      <Sheet onClose={close}>
        {modal==='settings'&&(
          <div>
            {mTitle('設定')}
            <div style={{...s.sec,marginTop:0}}>帳號</div>
            <div style={{...s.card,marginBottom:6}}>
              <div style={{fontSize:13,color:'var(--text2)',marginBottom:4}}>登入帳號</div>
              <div style={{fontWeight:500,marginBottom:10}}>{user.email}</div>
              <button onClick={()=>supabase.auth.signOut()} style={{padding:'8px 16px',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:13,color:'var(--text2)'}}>登出</button>
            </div>

            <div style={s.sec}>Gemini API Key</div>
            <div style={s.card}>
              <div style={{fontSize:12,color:'var(--text2)',marginBottom:8,lineHeight:1.6}}>前往 aistudio.google.com → Get API Key → Create API Key<br/>免費額度每天 1500 次，個人使用完全夠</div>
              {geminiKey&&<div style={{fontSize:11,background:'var(--bg2)',padding:'6px 10px',borderRadius:'var(--radius)',marginBottom:8,color:'var(--text2)'}}>已設定 · {geminiKey.slice(0,8)}...</div>}
              <input type="password" placeholder="貼上 Gemini API Key" value={keyInput} onChange={e=>setKeyInput(e.target.value)} style={{...s.inputRow,marginBottom:8}} />
              <button onClick={()=>{if(keyInput.trim()){updKey(keyInput.trim());setKeyInput('');alert('✅ API Key 已儲存')}}} style={{...s.btn('var(--info-bg)','var(--info)'),marginTop:0}}>儲存 API Key</button>
              {geminiKey&&<button onClick={()=>{updKey('');}} style={{...s.dashed,color:'#E24B4A',borderColor:'#E24B4A',marginTop:6}}>清除 API Key</button>}
            </div>

            <div style={s.sec}>危險操作</div>
            <div style={s.card}>
              {!confirmClear ? (
                <div>
                  <div style={{fontSize:13,color:'var(--text2)',marginBottom:8}}>清空所有本機資料（雲端同步後亦會清除）</div>
                  <button onClick={()=>setConfirmClear(true)} style={{padding:'8px 16px',border:'0.5px solid #E24B4A',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:13,color:'#E24B4A'}}>清空所有資料</button>
                </div>
              ) : (
                <div>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:8,color:'#E24B4A'}}>確定清空所有資料？此操作無法復原</div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>setConfirmClear(false)} style={{flex:1,padding:'9px',border:'0.5px solid var(--border2)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:13}}>取消</button>
                    <button onClick={clearAllData} style={{flex:1,padding:'9px',border:'none',borderRadius:'var(--radius)',background:'#E24B4A',color:'#fff',cursor:'pointer',fontSize:13,fontWeight:500}}>確定清空</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {modal==='setKey'&&(
          <div>
            {mTitle('設定 Gemini API Key')}
            <div style={{fontSize:12,color:'var(--text2)',marginBottom:14,lineHeight:1.7}}>
              1. 前往 <span style={{color:'var(--info)'}}>aistudio.google.com</span><br/>
              2. 登入 Google 帳號<br/>
              3. 點「Get API Key」→「Create API Key」<br/>
              4. 複製貼到下方（免費，每天 1500 次）
            </div>
            <input type="password" placeholder="貼上 API Key" value={keyInput} onChange={e=>setKeyInput(e.target.value)} style={s.inputRow}/>
            <button onClick={()=>{if(keyInput.trim()){updKey(keyInput.trim());setKeyInput('');}setModal(null)}} style={s.btn('var(--info-bg)','var(--info)')}>儲存</button>
          </div>
        )}

        {modal==='typeSelect'&&(
          <div>
            {mTitle('選擇類型')}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10}}>
              {[['消費','▽','addExpense','#E24B4A'],['收入','△','addIncome','#1D9E75'],['轉帳','⇄','addTransfer','#378ADD']].map(([l,icon,m,color])=>(
                <button key={m} onClick={()=>{if(m==='addExpense'){setEF(ef());setIncF(f=>({...f,aid:assets[0]?.id||''}));setXfF(f=>({...f,fid:assets[0]?.id||'',tid:assets[1]?.id||''}))}setModal(m)}}
                  style={{padding:'18px 6px',border:'0.5px solid var(--border)',borderRadius:'var(--radius-lg)',background:'none',cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                  <span style={{width:40,height:40,borderRadius:20,background:color+'22',color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{icon}</span>
                  <span style={{fontSize:13,fontWeight:500}}>{l}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {modal==='addExpense'&&(
          <div>
            {mTitle('新增消費','typeSelect')}
            <select style={s.inputRow} value={eF.cid} onChange={e=>setEF(f=>({...f,cid:e.target.value}))}>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input style={s.inputRow} type="number" placeholder="金額（NT$）" value={eF.amt} onChange={e=>setEF(f=>({...f,amt:e.target.value,bAmt:f.sameBudget?e.target.value:f.bAmt}))}/>
            <input style={s.inputRow} placeholder="備註" value={eF.desc} onChange={e=>setEF(f=>({...f,desc:e.target.value}))}/>
            <select style={s.inputRow} value={eF.cat} onChange={e=>setEF(f=>({...f,cat:e.target.value}))}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <input style={s.inputRow} type="date" value={eF.date} onChange={e=>setEF(f=>({...f,date:e.target.value}))}/>
            {!eF.isInst&&(
              <div style={{border:'0.5px solid var(--border)',borderRadius:'var(--radius)',padding:'12px',marginBottom:10}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,marginBottom:eF.sameBudget?0:8}}>
                  <input type="checkbox" checked={eF.sameBudget} onChange={e=>setEF(f=>({...f,sameBudget:e.target.checked,bAmt:e.target.checked?f.amt:''}))}/>計入預算與消費相同
                </label>
                {!eF.sameBudget&&<input style={{...s.inputRow,marginBottom:0}} type="number" placeholder="實際計入預算金額（代墊時填自己的份）" value={eF.bAmt} onChange={e=>setEF(f=>({...f,bAmt:e.target.value}))}/>}
              </div>
            )}
            <div style={{border:'0.5px solid var(--border)',borderRadius:'var(--radius)',padding:'12px',marginBottom:10}}>
              <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,marginBottom:eF.isInst?12:0}}>
                <input type="checkbox" checked={eF.isInst} onChange={e=>setEF(f=>({...f,isInst:e.target.checked}))}/><span style={{fontWeight:500}}>這筆是分期付款</span>
              </label>
              {eF.isInst&&<InstFields f={eF} set={setEF}/>}
            </div>
            <button onClick={addExpense} style={s.btn('var(--info-bg)','var(--info)')}>{eF.isInst?'建立分期紀錄':'新增消費'}</button>
          </div>
        )}

        {modal==='addIncome'&&(
          <div>
            {mTitle('新增收入','typeSelect')}
            <div style={{fontSize:12,color:'var(--text2)',marginBottom:6}}>存入帳戶</div>
            <select style={s.inputRow} value={incF.aid} onChange={e=>setIncF(f=>({...f,aid:e.target.value}))}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}（NT${fmt(a.balance)}）</option>)}</select>
            <input style={s.inputRow} type="number" placeholder="金額 NT$" value={incF.amt} onChange={e=>setIncF(f=>({...f,amt:e.target.value}))}/>
            <input style={s.inputRow} placeholder="備註（薪水、兼職...）" value={incF.desc} onChange={e=>setIncF(f=>({...f,desc:e.target.value}))}/>
            <input style={s.inputRow} type="date" value={incF.date} onChange={e=>setIncF(f=>({...f,date:e.target.value}))}/>
            <button onClick={addIncome} style={s.btn('#1D9E7522','#1D9E75')}>+ 確認收入</button>
          </div>
        )}

        {modal==='addTransfer'&&(
          <div>
            {mTitle('轉帳 / 提領','typeSelect')}
            <div style={{fontSize:12,color:'var(--text2)',marginBottom:6}}>從（扣款）</div>
            <select style={s.inputRow} value={xfF.fid} onChange={e=>setXfF(f=>({...f,fid:e.target.value}))}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}（NT${fmt(a.balance)}）</option>)}</select>
            <div style={{fontSize:12,color:'var(--text2)',marginBottom:6}}>轉入</div>
            <select style={s.inputRow} value={xfF.tid} onChange={e=>setXfF(f=>({...f,tid:e.target.value}))}>{assets.map(a=><option key={a.id} value={a.id}>{a.name}（NT${fmt(a.balance)}）</option>)}</select>
            <input style={s.inputRow} type="number" placeholder="金額 NT$" value={xfF.amt} onChange={e=>setXfF(f=>({...f,amt:e.target.value}))}/>
            <input style={s.inputRow} placeholder="備註" value={xfF.desc} onChange={e=>setXfF(f=>({...f,desc:e.target.value}))}/>
            <input style={s.inputRow} type="date" value={xfF.date} onChange={e=>setXfF(f=>({...f,date:e.target.value}))}/>
            <button onClick={addTransfer} style={s.btn('var(--info-bg)','var(--info)')}>確認轉帳</button>
          </div>
        )}

        {modal==='addInst'&&(
          <div>
            {mTitle('手動新增分期')}
            <select style={s.inputRow} value={instF.cid} onChange={e=>setInstF(f=>({...f,cid:e.target.value}))}>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <input style={s.inputRow} placeholder="分期名稱（如：iPhone 16）" value={instF.name} onChange={e=>setInstF(f=>({...f,name:e.target.value}))}/>
            <InstFields f={instF} set={setInstF}/>
            <div style={{fontSize:11,color:'var(--text2)',marginBottom:4,marginTop:6}}>開始月份</div>
            <input style={s.inputRow} type="month" value={instF.start} onChange={e=>setInstF(f=>({...f,start:e.target.value}))}/>
            <button onClick={addInst} style={s.btn('var(--info-bg)','var(--info)')}>新增分期</button>
          </div>
        )}

        {modal==='addBudget'&&(
          <div>
            {mTitle('設定月預算')}
            <select style={s.inputRow} value={budF.cat} onChange={e=>setBudF(f=>({...f,cat:e.target.value}))}>{CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <input style={s.inputRow} type="number" placeholder="每月上限 NT$" value={budF.limit} onChange={e=>setBudF(f=>({...f,limit:e.target.value}))}/>
            <div style={{fontSize:11,color:'var(--text2)',marginBottom:10}}>已有該類別預算時自動覆蓋</div>
            <button onClick={addBudget} style={s.btn('var(--info-bg)','var(--info)')}>儲存預算</button>
          </div>
        )}

        {modal==='addSub'&&(
          <div>
            {mTitle('新增訂閱')}
            <input style={s.inputRow} placeholder="服務名稱（如：Netflix）" value={subF.name} onChange={e=>setSubF(f=>({...f,name:e.target.value}))}/>
            <input style={s.inputRow} type="number" placeholder="每月金額 NT$" value={subF.amt} onChange={e=>setSubF(f=>({...f,amt:e.target.value}))}/>
            <select style={s.inputRow} value={subF.cid} onChange={e=>setSubF(f=>({...f,cid:e.target.value}))}>{cards.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select style={s.inputRow} value={subF.cat} onChange={e=>setSubF(f=>({...f,cat:e.target.value}))}>{SUB_CATS.map(c=><option key={c} value={c}>{c}</option>)}</select>
            <div style={{fontSize:11,color:'var(--text2)',marginBottom:4}}>每月扣款日</div>
            <input style={s.inputRow} type="number" min="1" max="31" placeholder="幾號" value={subF.day} onChange={e=>setSubF(f=>({...f,day:e.target.value}))}/>
            <button onClick={addSub} style={s.btn('var(--info-bg)','var(--info)')}>新增訂閱</button>
          </div>
        )}

        {modal==='addCard'&&(
          <div>
            {mTitle('新增信用卡')}
            <input style={s.inputRow} placeholder="卡片名稱" value={crdF.name} onChange={e=>setCrdF(f=>({...f,name:e.target.value}))}/>
            <input style={s.inputRow} placeholder="末四碼（可選）" maxLength={4} value={crdF.last} onChange={e=>setCrdF(f=>({...f,last:e.target.value}))}/>
            <input style={s.inputRow} type="number" placeholder="信用額度" value={crdF.limit} onChange={e=>setCrdF(f=>({...f,limit:e.target.value}))}/>
            <input style={s.inputRow} type="number" min="1" max="31" placeholder="帳單日（幾號）" value={crdF.bDate} onChange={e=>setCrdF(f=>({...f,bDate:e.target.value}))}/>
            <div style={{marginBottom:12}}><div style={{fontSize:11,color:'var(--text2)',marginBottom:6}}>顏色</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{CARD_COLORS.map(c=><div key={c} onClick={()=>setCrdF(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:13,background:c,cursor:'pointer',outline:crdF.color===c?`2.5px solid ${c}`:'2.5px solid transparent',outlineOffset:2}}></div>)}</div></div>
            <button onClick={addCard} style={s.btn('var(--info-bg)','var(--info)')}>新增信用卡</button>
          </div>
        )}

        {modal==='addAsset'&&(
          <div>
            {mTitle('新增帳戶')}
            <input style={s.inputRow} placeholder="帳戶名稱（如：台新銀行）" value={astF.name} onChange={e=>setAstF(f=>({...f,name:e.target.value}))}/>
            <select style={s.inputRow} value={astF.type} onChange={e=>setAstF(f=>({...f,type:e.target.value}))}>
              {[['bank','銀行帳戶'],['cash','現金錢包'],['invest','投資帳戶'],['other','其他']].map(([v,l])=><option key={v} value={v}>{l}</option>)}
            </select>
            <input style={s.inputRow} type="number" placeholder="目前餘額 NT$" value={astF.balance} onChange={e=>setAstF(f=>({...f,balance:e.target.value}))}/>
            <div style={{marginBottom:12}}><div style={{fontSize:11,color:'var(--text2)',marginBottom:6}}>顏色</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{CARD_COLORS.map(c=><div key={c} onClick={()=>setAstF(f=>({...f,color:c}))} style={{width:26,height:26,borderRadius:13,background:c,cursor:'pointer',outline:astF.color===c?`2.5px solid ${c}`:'2.5px solid transparent',outlineOffset:2}}></div>)}</div></div>
            <button onClick={addAsset} style={s.btn('var(--info-bg)','var(--info)')}>新增帳戶</button>
          </div>
        )}
      </Sheet>
    )
  }

  // ── Page header ──
  const pageTitle = {home:'總覽',cards:'信用卡',subs:'訂閱',ai:'AI 助理',flow:'每月收支'}

  return (
    <>
      <div style={{flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch'}}>
        {/* Header */}
        <div style={{position:'sticky',top:0,zIndex:10,background:'var(--bg)',borderBottom:'0.5px solid var(--border)',padding:'12px 16px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontWeight:500,fontSize:16}}>{pageTitle[page]}</div>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            {syncing&&<span style={{fontSize:11,color:'var(--text3)'}}>同步中...</span>}
            {syncErr&&<span style={{fontSize:11,color:'#E24B4A'}}>{syncErr}</span>}
            {page==='flow'&&(
              <button onClick={()=>{setConfirmClear(false);setModal('settings')}}
                style={{padding:'6px 10px',border:'0.5px solid var(--border)',borderRadius:'var(--radius)',background:'none',cursor:'pointer',fontSize:16,color:'var(--text2)'}}>
                ⚙
              </button>
            )}
          </div>
        </div>

        <div style={{padding:'12px 16px 100px'}}>
          {page==='home'&&<HomePage/>}
          {page==='cards'&&<CardsPage/>}
          {page==='subs'&&<SubsPage/>}
          {page==='ai'&&<AiPage/>}
          {page==='flow'&&<FlowPage/>}
        </div>
      </div>

      {/* Nav */}
      <nav style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:480,display:'flex',borderTop:'0.5px solid var(--border)',background:'var(--bg)',paddingBottom:'env(safe-area-inset-bottom)'}}>
        {NAV.map(n=>(
          <button key={n.id} style={s.navBtn(page===n.id)} onClick={()=>setPage(n.id)}>
            <span style={{fontSize:14,color:n.id==='ai'&&page!==n.id?'#7F77DD':undefined}}>{n.icon}</span>
            <span style={{color:n.id==='ai'&&page!==n.id?'#7F77DD':undefined}}>{n.label}</span>
          </button>
        ))}
      </nav>

      {renderModal()}
    </>
  )
}
