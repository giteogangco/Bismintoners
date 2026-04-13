// ── BISMINTONERS — Main Entry Point ─────────────────────────────
// All modules are imported here. Firebase vars and app functions
// are attached to window so HTML onclick handlers can reach them.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, setDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
// ── CONFIGURE YOUR FIREBASE PROJECT BELOW ──────────────────────
// 1. Go to https://console.firebase.google.com
// 2. Create a project → Add a web app → copy the firebaseConfig here
// 3. Enable Firestore Database (start in production mode)
// 4. Add your domain to Firestore security rules or use test mode
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "YOUR_API_KEY",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "YOUR_PROJECT_ID",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "YOUR_PROJECT_ID.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID|| "YOUR_SENDER_ID",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "YOUR_APP_ID",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     || "YOUR_MEASUREMENT_ID",
};
// ────────────────────────────────────────────────────────────────

const CONFIGURED = firebaseConfig.apiKey !== "YOUR_API_KEY";
let db = null;

if (CONFIGURED) {
  const app = initializeApp(firebaseConfig);
  getAnalytics(app);
  db = getFirestore(app);
} else {
  document.getElementById("cfgBanner").style.display = "block";
}

// ============ STATE ============
let STATE = {
  role: null, memberDoc: null,
  members: [], sessions: [], projects: [],
  passcodes: { superadmin:'9999', admin:'2222', member:'1111' },
  editingMemberId: null, editingProjectId: null,
  currentSessionId: null, editingExpenseId: null,
};

// ============ HELPERS ============
const COLORS=['#00d4ff','#ffc433','#00e899','#ff4466','#ff8c00','#c084fc','#38bdf8','#fb923c'];
function avatarColor(n){ let h=0;for(let c of(n||'?'))h=(h*31+c.charCodeAt(0))&0xffffffff;return COLORS[Math.abs(h)%COLORS.length]; }
function initials(n){ return(n||'?').split(' ').map(w=>w[0]||'').join('').toUpperCase().slice(0,2); }
function skillBadge(s){
  if(s?.toLowerCase()==='advanced') return '<span class="badge badge-adv">ADV</span>';
  if(s?.toLowerCase()==='intermediate') return '<span class="badge badge-int">INT</span>';
  return '<span class="badge badge-beg">BEG</span>';
}
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function fmtDate(d){ if(!d)return'—'; try{const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('en-AE',{year:'numeric',month:'short',day:'numeric'});}catch{return d;} }
function fmtMoney(n){ return 'AED '+(parseFloat(n)||0).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function canAdmin(){ return ['superadmin','admin'].includes(STATE.role); }
function uid(){ return 'm'+Date.now()+Math.floor(Math.random()*10000); }

const EXP_CATS = { court:'▣ Court', shuttle:'▶ Shuttle', food:'◆ Food', equipment:'◈ Equipment', other:'◇ Other' };
const EXP_COLORS = { court:'var(--primary)', shuttle:'var(--gold)', food:'var(--green)', equipment:'var(--orange)', other:'var(--text2)' };

const CAL_PER_MATCH_PER_KG = 5.1 / 3;
function calcCalories(weightKg, numMatches){
  const w = parseFloat(weightKg) || 65;
  return Math.round(w * CAL_PER_MATCH_PER_KG * numMatches);
}

// ============ TOAST ============
function toast(msg, type='info', dur=3000){
  const el=document.createElement('div');
  el.className=`t-item t-${type}`;
  el.innerHTML=`<span>${type==='success'?'✔':type==='error'?'✕':'▶'}</span>${esc(msg)}`;
  const wrap=document.getElementById('toast');
  wrap.appendChild(el);
  setTimeout(()=>el.remove(),dur);
}

// ============ MODALS ============
function openModal(id){ document.getElementById(id).classList.add('open'); }
function closeModal(id){ document.getElementById(id).classList.remove('open'); }

// ============ LOGIN ============
let selectedRole = null;

function selectRole(el){
  document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('selected'));
  el.classList.add('selected');
  selectedRole = el.dataset.role;
  const mw=document.getElementById('memberSelectWrap');
  const pg=document.getElementById('pinGroup');
  if(selectedRole==='member'){
    populateMemberLoginSelect();
    mw.style.display='block';
    pg.style.display='none';
  } else if(selectedRole==='guest'){
    mw.style.display='none';
    pg.style.display='none';
  } else {
    mw.style.display='none';
    pg.style.display='block';
    document.getElementById('p0').focus();
  }
  document.getElementById('loginError').textContent='';
}

function populateMemberLoginSelect(){
  const sel=document.getElementById('memberLoginSelect');
  sel.innerHTML='<option value="">— choose —</option>';
  STATE.members.filter(m=>!m.inactive).forEach(m=>{
    const o=document.createElement('option');
    o.value=m.id; o.textContent=m.name+(m.nickname?` (${m.nickname})`:'');
    sel.appendChild(o);
  });
  const pg=document.getElementById('pinGroup');
  sel.onchange=()=>{
    pg.style.display=sel.value?'block':'none';
    if(sel.value) document.getElementById('p0').focus();
  };
}

function pinNext(idx){
  const v=document.getElementById(`p${idx}`).value;
  if(v&&idx<3) document.getElementById(`p${idx+1}`).focus();
  if(idx===3&&v) doLogin();
}

function getPin(){ return [0,1,2,3].map(i=>document.getElementById(`p${i}`).value).join(''); }

function doLogin(){
  const err=document.getElementById('loginError');
  if(!selectedRole){ err.textContent='Select a role first.'; return; }
  if(selectedRole==='guest'){
    enterApp('guest',null); return;
  }
  if(selectedRole==='member'){
    const mid=document.getElementById('memberLoginSelect').value;
    if(!mid){ err.textContent='Select your name.'; return; }
    const pin=getPin();
    if(pin.length<4){ err.textContent='Enter 4-digit passcode.'; return; }
    if(pin!==STATE.passcodes.member){ err.textContent='Incorrect passcode.'; return; }
    const m=STATE.members.find(x=>x.id===mid);
    enterApp('member',m); return;
  }
  const pin=getPin();
  if(pin.length<4){ err.textContent='Enter 4-digit passcode.'; return; }
  if(pin!==STATE.passcodes[selectedRole]){ err.textContent='Incorrect passcode.'; return; }
  enterApp(selectedRole,null);
}

function enterApp(role, memberDoc){
  STATE.role=role; STATE.memberDoc=memberDoc;
  document.getElementById('loginScreen').style.display='none';
  document.getElementById('appWrap').style.display='block';
  document.getElementById('bottomNav').style.display='flex';
  const roleEl=document.getElementById('hRole');
  roleEl.textContent=role.toUpperCase();
  roleEl.className='header-role '+role;
  document.getElementById('hUser').textContent=memberDoc?memberDoc.name:'';
  buildNav();
  navigateTo(getDefaultPage());
  initListeners();
}

function doLogout(){
  STATE.role=null; STATE.memberDoc=null;
  document.getElementById('appWrap').style.display='none';
  document.getElementById('bottomNav').style.display='none';
  document.getElementById('loginScreen').style.display='flex';
  selectedRole=null;
  document.querySelectorAll('.role-btn').forEach(b=>b.classList.remove('selected'));
  [0,1,2,3].forEach(i=>{ const el=document.getElementById(`p${i}`); if(el) el.value=''; });
  document.getElementById('loginError').textContent='';
  document.getElementById('memberSelectWrap').style.display='none';
  document.getElementById('pinGroup').style.display='none';
}

// ============ NAV ============
const ALL_PAGES = {
  dashboard:{ label:'Home',  icon:'si-dashboard', roles:['superadmin','admin','member','guest'] },
  queue:    { label:'Queue', icon:'si-queue',     roles:['superadmin','admin','member','guest'] },
  expenses: { label:'Costs', icon:'si-costs',     roles:['superadmin','admin','member','guest'] },
  chipin:   { label:'Pay',   icon:'si-pay',       roles:['superadmin','admin','member','guest'] },
  stats:    { label:'Stats', icon:'si-stats',     roles:['superadmin','admin','member','guest'] },
  members:  { label:'Squad', icon:'si-members',   roles:['superadmin','admin','guest'] },
  projects: { label:'Cups',  icon:'si-projects',  roles:['superadmin','admin','member','guest'] },
  history:  { label:'Log',   icon:'si-history',   roles:['superadmin','admin','member','guest'] },
  settings: { label:'Config',icon:'si-settings',  roles:['superadmin'] },
};
const BOTTOM_NAV_PAGES = ['dashboard','queue','expenses','chipin','stats'];

function buildNav(){
  const role=STATE.role;
  const visiblePages=Object.entries(ALL_PAGES).filter(([,p])=>p.roles.includes(role));
  const bottomPages=visiblePages.filter(([k])=>BOTTOM_NAV_PAGES.includes(k));
  const morePages=visiblePages.filter(([k])=>!BOTTOM_NAV_PAGES.includes(k));
  const bn=document.getElementById('bottomNav');
  bn.innerHTML=bottomPages.map(([key,p])=>`
    <div class="bn-item" data-page="${key}" onclick="navigateTo('${key}')">
      <div class="bn-icon-wrap"><span class="bn-icon"><svg width="18" height="18"><use href="#${p.icon}"/></svg></span></div>
      <span>${p.label}</span>
    </div>`).join('');
  if(morePages.length){
    bn.innerHTML+=`
    <div class="bn-item" id="moreBtn" onclick="toggleMoreMenu()">
      <div class="bn-icon-wrap"><span class="bn-icon"><svg width="18" height="18"><use href="#si-more"/></svg></span></div>
      <span>More</span>
    </div>`;
    const mm=document.getElementById('moreMenu');
    mm.innerHTML=morePages.map(([key,p])=>`
    <div class="more-item" data-page="${key}" onclick="navigateTo('${key}');closeMoreMenu()">
      <svg width="16" height="16" style="opacity:0.7"><use href="#${p.icon}"/></svg> ${p.label}
    </div>`).join('');
  }
}

function navigateTo(page){
  renderPage(page);
  document.querySelectorAll('.bn-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));
  document.querySelectorAll('.more-item').forEach(n=>n.classList.toggle('active',n.dataset.page===page));
  closeMoreMenu();
}

function toggleMoreMenu(){
  document.getElementById('moreMenu').classList.toggle('open');
  document.getElementById('moreOverlay').style.display=
    document.getElementById('moreMenu').classList.contains('open')?'block':'none';
}
function closeMoreMenu(){
  document.getElementById('moreMenu').classList.remove('open');
  document.getElementById('moreOverlay').style.display='none';
}

function getDefaultPage(){ return 'dashboard'; }

// ============ PAGE RENDERER ============
function renderPage(page){
  const main=document.getElementById('appMain');
  main.innerHTML=`<div class="page active" id="page-${page}"></div>`;
  const el=document.getElementById(`page-${page}`);
  const renderers={
    dashboard: renderDashboard,
    members:   renderMembers,
    queue:     renderQueue,
    expenses:  renderExpenses,
    chipin:    renderChipin,
    stats:     renderStats,
    projects:  renderProjects,
    history:   renderHistory,
    settings:  renderSettings,
  };
  if(renderers[page]) renderers[page](el);
}

function refreshCurrentPage(){
  const active=document.querySelector('.bn-item.active, .more-item.active');
  if(active&&active.dataset.page) renderPage(active.dataset.page);
}

// ═══════════════════════════════════════
// MODULE: dashboard.js
// ═══════════════════════════════════════
// ============ DASHBOARD ============
function renderDashboard(el){
  const lastSession = STATE.sessions[0];
  const outstanding = gatherOutstanding();
  const debtors = outstanding.filter(o=>o.netDebt>0.005);
  const creditHolders = outstanding.filter(o=>o.netCredit>0.05);
  const totalOutstanding = debtors.reduce((s,o)=>s+o.netDebt,0);
  const totalExcess = creditHolders.reduce((s,o)=>s+o.netCredit,0);
  // The difference (Credit - Outstanding) = total net cash overpaid by members.
  // This is mathematically correct: group holds that extra cash for the overpayer(s).
  const netOverpay = totalExcess - totalOutstanding;
  el.innerHTML = `
    <div class="sec-header">
      <div><div class="sec-title">Dashboard</div><div class="sec-sub">⚡ Overview</div></div>
      ${canAdmin()?`<button class="btn btn-primary btn-sm" onclick="openSessionModal()">+ Session</button>`:''}
    </div>
    <div class="grid4" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-label">Members</div><div class="stat-val">${STATE.members.length}</div></div>
      <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-val">${STATE.sessions.length}</div></div>
      <div class="stat-card"><div class="stat-label">Unpaid</div><div class="stat-val" style="color:var(--red)">${debtors.length}</div></div>
      <div class="stat-card"><div class="stat-label">Excess Credit</div><div class="stat-val" style="color:var(--green)">${creditHolders.length}</div></div>
    </div>
    ${debtors.length||creditHolders.length?`
    <div class="card" style="margin-bottom:12px">
      <div class="card-title" style="margin-bottom:10px">◈ Balance Summary</div>
      <div class="grid2" style="margin-bottom:10px">
        <div class="stat-card"><div class="stat-label">Total Outstanding</div><div class="stat-val" style="font-size:18px;color:var(--red)">${fmtMoney(totalOutstanding)}</div></div>
        <div class="stat-card"><div class="stat-label">Total Excess Credit</div><div class="stat-val" style="font-size:18px;color:var(--green)">${fmtMoney(totalExcess)}</div></div>
      </div>
      ${netOverpay>0.05?`
      <div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:var(--radius2);padding:8px 12px;font-size:11px;color:var(--text2)">
        <span style="color:var(--primary);font-weight:600">▶ Difference: ${fmtMoney(netOverpay)}</span>
        = net cash overpaid by members that the group is holding.
        Excess credit exceeds outstanding because someone paid more than their share.
        Once they offset or receive that back, both totals will match.
      </div>`:netOverpay<-0.05?`
      <div style="background:rgba(255,68,102,0.06);border:1px solid rgba(255,68,102,0.2);border-radius:var(--radius2);padding:8px 12px;font-size:11px;color:var(--text2)">
        <span style="color:var(--red);font-weight:600">▲ Difference: ${fmtMoney(Math.abs(netOverpay))}</span>
        = outstanding exceeds credits — some debts are not yet covered by any credit.
      </div>`:`
      <div style="background:rgba(0,232,153,0.06);border:1px solid rgba(0,232,153,0.2);border-radius:var(--radius2);padding:8px 12px;font-size:11px;color:var(--green)">
        ✓ Outstanding and excess credit are balanced — no net overpayments.
      </div>`}
    </div>`:''}
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">▶ Latest Session</div>
      ${lastSession ? renderLatestSessionCard(lastSession) : '<div class="empty" style="padding:16px"><div class="empty-text">No sessions yet.</div></div>'}
    </div>
    <div class="card" style="margin-bottom:12px">
      <div class="card-title">▲ Outstanding Balances</div>
      ${renderOutstandingList(debtors)}
    </div>
    ${creditHolders.length?`
    <div class="card">
      <div class="card-title">◈ Excess Credits — To Return or Offset</div>
      ${renderCreditList(creditHolders)}
    </div>`:''}
  `;
}

function renderLatestSessionCard(s){
  const matches = (s.matches||[]).filter(m=>m.result).length;
  const att = s.attendees||[];
  return `
    <div style="font-family:'Bebas Neue',sans-serif;font-size:18px;letter-spacing:1px">${fmtDate(s.date)}</div>
    <div style="font-size:11px;color:var(--text3);margin:3px 0 10px;font-family:'Barlow Condensed',sans-serif">${esc(s.venue||'No venue')}${s.notes?' · '+esc(s.notes):''} · ${att.length} players · ${matches} matches</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">
      ${att.slice(0,10).map(aid=>{ const m=STATE.members.find(x=>x.id===aid);const nm=m?m.name:'?';
        return `<div style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);padding:3px 8px;border-radius:99px;font-size:11px;border:1px solid var(--border)">
          <div style="width:16px;height:16px;border-radius:50%;background:${avatarColor(nm)}22;color:${avatarColor(nm)};display:flex;align-items:center;justify-content:center;font-size:8px;font-family:'Bebas Neue',sans-serif">${initials(nm)}</div>
          ${esc(m?.nickname||nm.split(' ')[0])}
        </div>`;}).join('')}
      ${att.length>10?`<div style="font-size:11px;color:var(--text3);align-self:center">+${att.length-10} more</div>`:''}
    </div>
    <button class="btn btn-ghost btn-sm" onclick="showSessionDetail('${s.id}')">View Details →</button>
  `;
}

function gatherOutstanding(){
  // Compute net balance per member across ALL sessions using rolling carry-over.
  // This matches _buildPayDebts logic: process sessions oldest→newest, carry credit/debt forward.
  // Result: each member's TRUE net position (positive = owes, negative = net credit).
  const memberNames={};
  STATE.members.forEach(m=>{ memberNames[m.id]=m.name; });

  // Track rolling carry per member across sessions (negative=credit, positive=debt)
  const memberCarry={}; // memberId -> running carry after each session

  // Also track non-attendee creditOffsetApplied (stored on sessions they didn't attend)
  const memberNonAttendeeCredit={}; // memberId -> total creditOffsetApplied from non-attended sessions

  const sortedSessions=[...STATE.sessions].sort((a,b)=>new Date(a.date)-new Date(b.date));

  sortedSessions.forEach(s=>{
    const att=s.attendees||[];
    const expenses=s.expenses||[];
    const expPayerTotals={};
    expenses.forEach(e=>{ if(e.paidBy) expPayerTotals[e.paidBy]=(expPayerTotals[e.paidBy]||0)+(parseFloat(e.amount)||0); });

    att.forEach(aid=>{
      const carry=memberCarry[aid]||0; // rolling carry into this session
      const myShare=(()=>{
        if(!expenses.length) return parseFloat(s.perHead)||0;
        const fs=expenses.reduce((sum,e)=>{
          const amt=parseFloat(e.amount)||0; if(!amt) return sum;
          const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:att;
          if(!incl.includes(aid)) return sum;
          return sum+Math.round((amt/incl.length)*100)/100;
        },0);
        return fs; // 0 if excluded from all expenses, perHead otherwise
      })();
      if(!myShare&&!expPayerTotals[aid]){ return; }

      const pay=(s.payments||[]).find(p=>p.memberId===aid);
      const paid=pay?parseFloat(pay.amountPaid)||0:0;
      const expPaid=expPayerTotals[aid]||0;
      const refundApplied=pay?parseFloat(pay.refundApplied)||0:0;
      const creditOffsetApplied=pay?parseFloat(pay.creditOffsetApplied)||0:0;
      const netRefund=expPaid-myShare;

      let newCarry;
      if(netRefund>0){
        // Expense payer: their credit = unrecovered refund
        const unrecovered=Math.max(0,netRefund-refundApplied);
        newCarry=carry-unrecovered; // credit reduces carry
        // creditOffsetApplied reduces their credit
        if(creditOffsetApplied>0.005) newCarry+=creditOffsetApplied;
      } else {
        // Normal player: rawOwed = share + carry (carry can be negative = credit)
        const sOwed=Math.max(0,myShare-expPaid);
        const rawOwed=sOwed+carry; // negative = credit covers this session + leftover
        const effectiveOwed=Math.max(0,rawOwed);
        const sBal=effectiveOwed-paid;
        if(sBal>0.005){
          // Still owes cash after carry
          const settledThisSession=Math.min(paid,effectiveOwed);
          newCarry=rawOwed-settledThisSession;
        } else {
          // Fully settled (cash or credit)
          newCarry=rawOwed-paid; // may be negative (leftover credit from overpay)
          // If overpaid beyond carry: reduce credit by refundApplied (offsets already applied)
          if(newCarry<-0.005){
            const totalCredit=Math.abs(newCarry);
            newCarry=-Math.max(0,totalCredit-refundApplied);
          }
        }
        // creditOffsetApplied on this session reduces their carry credit
        if(creditOffsetApplied>0.005) newCarry+=creditOffsetApplied;
      }
      memberCarry[aid]=newCarry;
    });

    // Non-attendee creditOffsetApplied: stored on this session but member not attending
    (s.payments||[]).forEach(pay=>{
      const aid=pay.memberId;
      if(att.includes(aid)) return; // handled above
      const coa=parseFloat(pay.creditOffsetApplied)||0;
      if(coa>0.005){
        memberNonAttendeeCredit[aid]=(memberNonAttendeeCredit[aid]||0)+coa;
      }
    });
  });

  // Apply non-attendee creditOffsetApplied to final carry
  Object.entries(memberNonAttendeeCredit).forEach(([aid,coa])=>{
    memberCarry[aid]=(memberCarry[aid]||0)+coa;
  });

  // Build member totals from final carry values
  const memberTotals={};
  Object.entries(memberCarry).forEach(([aid,netBal])=>{
    const nm=memberNames[aid]||'?';
    if(netBal>0.005){
      if(!memberTotals[aid]) memberTotals[aid]={name:nm,sessionBal:0,projectBal:0,creditBal:0};
      memberTotals[aid].sessionBal=netBal;
    } else if(netBal<-0.05){
      if(!memberTotals[aid]) memberTotals[aid]={name:nm,sessionBal:0,projectBal:0,creditBal:0};
      memberTotals[aid].creditBal=Math.abs(netBal);
    }
  });

  STATE.projects.forEach(p=>{
    (p.members||[]).forEach(pm=>{
      const m=STATE.members.find(x=>x.id===pm.memberId);const nm=m?m.name:'?';
      const due=parseFloat(pm.fixedAmount||p.fixedAmount)||0;
      const paid=parseFloat(pm.amountPaid)||0;
      const bal=due-paid;
      if(bal>0.005){
        if(!memberTotals[pm.memberId]) memberTotals[pm.memberId]={name:nm,sessionBal:0,projectBal:0,creditBal:0};
        memberTotals[pm.memberId].projectBal+=bal;
      }
    });
  });

  return Object.entries(memberTotals).map(([id,d])=>{
    const balance=d.sessionBal+d.projectBal;
    const creditBal=d.creditBal||0;
    const netCredit=Math.max(0,creditBal-balance);
    const netDebt=Math.max(0,balance-creditBal);
    return {memberId:id,name:d.name,sessionBal:d.sessionBal,projectBal:d.projectBal,
      creditBal,balance,netCredit,netDebt};
  }).filter(o=>o.netDebt>0.005||o.netCredit>0.05)
    .sort((a,b)=>(b.netDebt+b.netCredit)-(a.netDebt+a.netCredit));
}

function renderOutstandingList(list){
  if(!list.length) return '<div class="empty" style="padding:16px"><div class="empty-icon">✔</div><div class="empty-text">All settled!</div></div>';
  return list.map(o=>`
    <div class="chipin-row unpaid" style="margin-bottom:5px;cursor:pointer" onclick="showOutstandingBreakdown('${o.memberId}','${esc(o.name)}')">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <div class="m-avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(o.name)}22;color:${avatarColor(o.name)}">${initials(o.name)}</div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--primary);text-decoration:underline dotted">${esc(o.name)}</div>
          <div style="font-size:10px;color:var(--text3)">
            ${o.sessionBal>0.005?`<span>$ Sessions: ${fmtMoney(o.sessionBal)}</span>`:''}
            ${o.sessionBal>0.005&&o.projectBal>0.005?' · ':''}
            ${o.projectBal>0.005?`<span>▣ Projects: ${fmtMoney(o.projectBal)}</span>`:''}
            ${o.creditBal>0.05?`<span style="color:var(--green)"> · −${fmtMoney(o.creditBal)} credit applied</span>`:''}
            <span style="color:var(--text3);margin-left:4px">· tap for details</span>
          </div>
        </div>
      </div>
      <span style="font-family:'Barlow Condensed',sans-serif;color:var(--red);font-size:14px;font-weight:700;flex-shrink:0">${fmtMoney(o.netDebt)}</span>
    </div>
  `).join('');
}

function renderCreditList(list){
  if(!list.length) return '';
  return list.map(o=>`
    <div class="chipin-row" style="margin-bottom:5px;cursor:pointer;border-color:rgba(0,232,153,0.3);background:rgba(0,232,153,0.04)" onclick="showOutstandingBreakdown('${o.memberId}','${esc(o.name)}')">
      <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
        <div class="m-avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(o.name)}22;color:${avatarColor(o.name)}">${initials(o.name)}</div>
        <div style="min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--green)">${esc(o.name)}</div>
          <div style="font-size:10px;color:var(--text3)">
            ◈ Net excess credit · <span style="color:var(--green)">${fmtMoney(o.netCredit)} to return or offset</span>
            ${o.balance>0.005?`<span style="color:var(--text3)"> · (${fmtMoney(o.creditBal)} credit − ${fmtMoney(o.balance)} debt)</span>`:''}
            <span style="color:var(--text3);margin-left:4px">· tap for details</span>
          </div>
        </div>
      </div>
      <span style="font-family:'Barlow Condensed',sans-serif;color:var(--green);font-size:14px;font-weight:700;flex-shrink:0">↩ ${fmtMoney(o.netCredit)}</span>
    </div>
  `).join('');
}

window.showOutstandingBreakdown = function(memberId, memberName){
  // Uses same rolling carry logic as gatherOutstanding for consistent numbers
  const sessionRows = [];
  let carry = 0; // rolling carry (negative=credit, positive=debt)
  const sortedSessions=[...STATE.sessions].sort((a,b)=>new Date(a.date)-new Date(b.date));
  let latestSid = null;

  sortedSessions.forEach(s=>{
    const att=s.attendees||[];
    if(!att.includes(memberId)){
      // Non-attendee: check for creditOffsetApplied
      const pay=(s.payments||[]).find(p=>p.memberId===memberId);
      const coa=pay?parseFloat(pay.creditOffsetApplied)||0:0;
      if(coa>0.005){
        carry+=coa; // reduces credit
        sessionRows.push({
          label:fmtDate(s.date)+(s.venue?' · '+esc(s.venue):''),
          owed:0, paid:0, delta:coa, perHead:0, expPaid:0,
          refundApplied:0, creditOffsetApplied:coa, date:s.date,
          isCredit:false, netRefund:0, isCreditOffsetOnly:true
        });
      }
      return;
    }

    const expenses=s.expenses||[];
    const expPayerTotals={};
    expenses.forEach(e=>{ if(e.paidBy) expPayerTotals[e.paidBy]=(expPayerTotals[e.paidBy]||0)+(parseFloat(e.amount)||0); });
    const expPaid=expPayerTotals[memberId]||0;
    const myShare=(()=>{
      if(!expenses.length) return parseFloat(s.perHead)||0;
      const fs=expenses.reduce((sum,e)=>{
        const amt=parseFloat(e.amount)||0; if(!amt) return sum;
        const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:att;
        if(!incl.includes(memberId)) return sum;
        return sum+Math.round((amt/incl.length)*100)/100;
      },0);
      return fs; // 0 if member excluded from all expenses
    })();
    const pay=(s.payments||[]).find(p=>p.memberId===memberId);
    const paid=pay?parseFloat(pay.amountPaid)||0:0;
    const refundApplied=pay?parseFloat(pay.refundApplied)||0:0;
    const creditOffsetApplied=pay?parseFloat(pay.creditOffsetApplied)||0:0;
    const netRefund=expPaid-myShare;

    let delta; // change in carry this session (for display)
    let newCarry;
    if(netRefund>0){
      const unrecovered=Math.max(0,netRefund-refundApplied);
      newCarry=carry-unrecovered;
      if(creditOffsetApplied>0.005) newCarry+=creditOffsetApplied;
      delta=newCarry-carry; // negative = credit gained
    } else {
      const sOwed=Math.max(0,myShare-expPaid);
      const rawOwed=sOwed+carry;
      const effectiveOwed=Math.max(0,rawOwed);
      const sBal=effectiveOwed-paid;
      if(sBal>0.005){
        const settled=Math.min(paid,effectiveOwed);
        newCarry=rawOwed-settled;
      } else {
        newCarry=rawOwed-paid;
        if(newCarry<-0.005){
          const totalCredit=Math.abs(newCarry);
          newCarry=-Math.max(0,totalCredit-refundApplied);
        }
      }
      if(creditOffsetApplied>0.005) newCarry+=creditOffsetApplied;
      delta=newCarry-carry;
    }

    carry=newCarry;
    latestSid=s.id;
    const owed=Math.max(0,myShare-expPaid);

    if(Math.abs(delta)>0.005){
      sessionRows.push({
        label:fmtDate(s.date)+(s.venue?' · '+esc(s.venue):''),
        owed, paid, delta, perHead:myShare, expPaid,
        refundApplied, creditOffsetApplied, date:s.date,
        isCredit:delta<0, netRefund
      });
    }
  });

  // Final carry = member's net position (negative=credit, positive=debt)
  const sessionNetBal=carry;

  const projectRows = [];
  STATE.projects.forEach(p=>{
    const pm=(p.members||[]).find(x=>x.memberId===memberId);
    if(!pm) return;
    const due=parseFloat(pm.fixedAmount||p.fixedAmount)||0;
    const paid=parseFloat(pm.amountPaid)||0;
    const bal=due-paid;
    if(bal>0.005) projectRows.push({name:esc(p.name||'Project'), due, paid, bal});
  });

  const projectTotal=projectRows.reduce((s,r)=>s+r.bal,0);
  const grandTotal=Math.max(0,sessionNetBal)+projectTotal;
  // Net credit = absolute value of negative sessionNetBal minus any project debt
  const netCredit=sessionNetBal<-0.005?Math.max(0,Math.abs(sessionNetBal)-projectTotal):0;
  const isCreditor=netCredit>0.05;

  document.getElementById('detailModalBody').innerHTML=`
    <div class="modal-handle"></div>
    <div class="modal-header">
      <div class="modal-title">▶ ${esc(memberName)}</div>
      <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:14px">${isCreditor?'Excess credit breakdown':'Outstanding balance breakdown'}</div>
    ${sessionRows.length?`
      <div class="card-title" style="margin-bottom:8px">$ Session Balances</div>
      ${sessionRows.map(r=>`
        <div style="background:${r.isCreditOffsetOnly?'rgba(255,196,51,0.05)':r.isCredit?'rgba(0,232,153,0.06)':'var(--surface2)'};border:1px solid ${r.isCreditOffsetOnly?'rgba(255,196,51,0.25)':r.isCredit?'rgba(0,232,153,0.2)':'var(--border)'};border-radius:var(--radius2);padding:9px 12px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:12px;font-weight:600">${r.label}${r.isCreditOffsetOnly?'<span style="font-size:10px;color:var(--gold);margin-left:6px">(not attended)</span>':''}</span>
            <span style="font-family:'Barlow Condensed',sans-serif;color:${r.isCredit?'var(--green)':r.isCreditOffsetOnly?'var(--gold)':'var(--red)'};font-size:13px;font-weight:700">
              ${r.isCredit?'−':'+'}${fmtMoney(Math.abs(r.delta))}
            </span>
          </div>
          <div style="font-size:10px;color:var(--text3);display:flex;flex-wrap:wrap;gap:6px">
            ${r.isCreditOffsetOnly
              ?`<span style="color:var(--gold)">↩ ${fmtMoney(r.creditOffsetApplied)} carry-over credit used for offset here</span>`
              :`<span>Per head: <span style="color:var(--gold)">${fmtMoney(r.perHead)}</span></span>
              ${r.expPaid>0?`<span>· Exp paid: <span style="color:var(--primary)">${fmtMoney(r.expPaid)}</span></span>`:''}
              <span>· Owed: <span style="color:var(--text)">${fmtMoney(r.owed)}</span></span>
              <span>· Paid: <span style="color:var(--green)">${fmtMoney(r.paid)}</span></span>
              ${r.refundApplied>0.005?`<span>· Refund offset: <span style="color:var(--text2)">${fmtMoney(r.refundApplied)}</span></span>`:''}
              ${r.creditOffsetApplied>0.005?`<span>· Credit offset used: <span style="color:var(--text2)">${fmtMoney(r.creditOffsetApplied)}</span></span>`:''}
              ${r.isCredit?`<span style="color:var(--green)">✓ Unrecovered refund (offsets other debts)</span>`:''}`
            }
          </div>
        </div>
      `).join('')}
      ${sessionNetBal<-0.005?`
        <div style="background:rgba(0,232,153,0.08);border:1px solid rgba(0,232,153,0.25);border-radius:var(--radius2);padding:7px 12px;margin-bottom:6px;font-size:11px;color:var(--green)">
          ✓ Net session credit of ${fmtMoney(Math.abs(sessionNetBal))} — fully offsets all debts
        </div>
      `:''}
    `:''}
    ${projectRows.length?`
      <div class="card-title" style="margin-top:10px;margin-bottom:8px">▣ Project Balances</div>
      ${projectRows.map(r=>`
        <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius2);padding:9px 12px;margin-bottom:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
            <span style="font-size:12px;font-weight:600">${r.name}</span>
            <span style="font-family:'Barlow Condensed',sans-serif;color:var(--red);font-size:13px;font-weight:700">${fmtMoney(r.bal)}</span>
          </div>
          <div style="font-size:10px;color:var(--text3)">Due: ${fmtMoney(r.due)} · Paid: <span style="color:var(--green)">${fmtMoney(r.paid)}</span></div>
        </div>
      `).join('')}
    `:''}
    ${grandTotal>0.005?`
    <div style="margin-top:14px;background:var(--red-dim);border:1px solid rgba(255,68,102,0.25);border-radius:var(--radius2);padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--text2)">Total Outstanding</span>
      <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--red)">${fmtMoney(grandTotal)}</span>
    </div>`:`
    <div style="margin-top:14px;background:var(--green-dim);border:1px solid rgba(0,232,153,0.25);border-radius:var(--radius2);padding:10px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center${isCreditor?';margin-bottom:10px':''}">
        <span style="font-family:'Barlow Condensed',sans-serif;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--text2)">Net Excess Credit</span>
        <span style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--green)">↩ ${fmtMoney(netCredit)}</span>
      </div>
      ${isCreditor&&canAdmin()&&latestSid?`
        <button class="btn btn-primary btn-block" style="margin-top:2px"
          onclick="closeModal('detailModal');openOverpayOffsetModal('${latestSid}','${memberId}','${esc(memberName)}',${netCredit},true)">
          ◈ Offset Credit →
        </button>`:''}
    </div>`}
  `;
  openModal('detailModal');
};



// ═══════════════════════════════════════
// MODULE: members.js
// ═══════════════════════════════════════
// ============ MEMBERS ============
function renderMembers(el){
  const canEdit = canAdmin();
  const search = `<input class="form-input" id="memberSearch" placeholder="▶ Search members…" oninput="filterMembers()" style="margin-bottom:12px"/>`;
  el.innerHTML = `
    <div class="sec-header">
      <div><div class="sec-title">Members</div><div class="sec-sub">${STATE.members.length} players</div></div>
      ${canEdit?`<button class="btn btn-primary btn-sm" onclick="openMemberModal()">+ Add</button>`:''}
    </div>
    ${search}
    <div id="membersListDiv">
      ${STATE.members.length ? STATE.members.map(m=>renderMemberCard(m,canEdit)).join('') :
        '<div class="empty"><div class="empty-icon">◈</div><div class="empty-text">No members yet.</div></div>'}
    </div>
  `;
}

window.filterMembers = function(){
  const q = document.getElementById('memberSearch')?.value.toLowerCase()||'';
  const filtered = STATE.members.filter(m=>(m.name||'').toLowerCase().includes(q)||(m.nickname||'').toLowerCase().includes(q));
  document.getElementById('membersListDiv').innerHTML = filtered.length ?
    filtered.map(m=>renderMemberCard(m,canAdmin())).join('') :
    '<div class="empty"><div class="empty-text">No results.</div></div>';
};

function renderMemberCard(m, canEdit){
  return `
    <div class="member-card">
      <div class="m-info">
        <div class="m-avatar" style="background:${avatarColor(m.name)}22;color:${avatarColor(m.name)}">${initials(m.name)}</div>
        <div>
          <div class="m-name">${esc(m.name)}${m.nickname?` <span style="color:var(--text3);font-weight:400;font-size:12px">(${esc(m.nickname)})</span>`:''}</div>
          <div class="m-meta">${skillBadge(m.skill||'Beginner')} ${m.contact?'· '+esc(m.contact):''} ${m.weight?'· '+m.weight+'kg':''}</div>
        </div>
      </div>
      ${canEdit?`<div class="m-actions">
        <button class="btn btn-ghost btn-xs" onclick="openMemberModal('${m.id}')">Edit</button>
        <button class="btn btn-red btn-xs" onclick="deleteMember('${m.id}','${esc(m.name)}')">Del</button>
      </div>`:''}
    </div>
  `;
}

window.openMemberModal = function(id=null){
  STATE.editingMemberId=id;
  document.getElementById('memberModalTitle').textContent = id ? 'Edit Member' : 'Add Member';
  if(id){
    const m=STATE.members.find(x=>x.id===id);
    document.getElementById('mfName').value=m.name||'';
    document.getElementById('mfNick').value=m.nickname||'';
    document.getElementById('mfSkill').value=m.skill||'Beginner';
    document.getElementById('mfContact').value=m.contact||'';
    document.getElementById('mfWeight').value=m.weight||'';
  } else {
    ['mfName','mfNick','mfContact','mfWeight'].forEach(id=>document.getElementById(id).value='');
    document.getElementById('mfSkill').value='Beginner';
  }
  openModal('memberModal');
};

window.saveMember = async function(){
  const name=document.getElementById('mfName').value.trim();
  if(!name){ toast('Name required','error'); return; }
  const data={name,nickname:document.getElementById('mfNick').value.trim(),
    skill:document.getElementById('mfSkill').value,contact:document.getElementById('mfContact').value.trim(),
    weight:parseFloat(document.getElementById('mfWeight').value)||null};
  if(!CONFIGURED){ toast('Firebase not configured','error'); return; }
  try{
    if(STATE.editingMemberId){
      await updateDoc(doc(db,'members',STATE.editingMemberId),data);
      toast('Member updated','success');
    } else {
      await addDoc(collection(db,'members'),{...data,createdAt:serverTimestamp()});
      toast('Member added','success');
    }
    closeModal('memberModal');
  }catch(e){ toast('Error: '+e.message,'error'); }
};

window.deleteMember = function(id,name){
  if(!CONFIGURED){toast('Firebase not configured','error');return;}
  if(!confirm(`Delete "${name}"?`)) return;
  deleteDoc(doc(db,'members',id)).then(()=>toast('Deleted','success')).catch(e=>toast(e.message,'error'));
};



// ═══════════════════════════════════════
// MODULE: queue.js
// ═══════════════════════════════════════
// ============ QUEUE ============
function renderQueue(el){
  if(STATE.role==='guest'){
    el.innerHTML=`<div class="sec-header"><div><div class="sec-title">Queue</div><div class="sec-sub">View only</div></div></div>
      <div class="form-group"><label class="form-label">Select Session</label>
        <select class="form-select" id="qSessionPicker" onchange="loadQueueSession()">
          <option value="">— select session —</option>
          ${STATE.sessions.map(s=>`<option value="${s.id}">${fmtDate(s.date)}${s.venue?' · '+esc(s.venue):''}</option>`).join('')}
        </select></div>
      <div id="queueBody"></div>`;
    return;
  }

  el.innerHTML = `
    <div class="sec-header">
      <div><div class="sec-title">Queue</div><div class="sec-sub">Match generator · Multi-court</div></div>
      ${canAdmin()?`<button class="btn btn-primary btn-sm" onclick="openSessionModal()">+ Session</button>`:''}
    </div>
    <div class="form-group">
      <label class="form-label">Active Session</label>
      <select class="form-select" id="qSessionPicker" onchange="loadQueueSession()">
        <option value="">— select session —</option>
        ${STATE.sessions.map(s=>`<option value="${s.id}"${s.id===STATE.currentSessionId?' selected':''}>${fmtDate(s.date)}${s.venue?' · '+esc(s.venue):''}</option>`).join('')}
      </select>
    </div>
    <div id="queueBody"></div>
  `;
  if(STATE.currentSessionId) loadQueueSession();
}

window.loadQueueSession = function(){
  const sid = document.getElementById('qSessionPicker')?.value;
  STATE.currentSessionId = sid||null;
  if(!sid){ document.getElementById('queueBody').innerHTML=''; return; }
  const s = STATE.sessions.find(x=>x.id===sid);
  if(s) renderQueueBody(s);
};

function renderQueueBody(s){
  const el = document.getElementById('queueBody');
  if(!el) return;
  const att = s.attendees||[];
  const matches = s.matches||[];
  const queue = s.queueOrder||[...att];
  const numCourts = parseInt(s.numCourts)||1;
  const advInterval = parseInt(s.advInterval)||0;
  const isAdmin = canAdmin();
  const completedMatches = matches.filter(m=>m.result);
  const activeMatches = matches.filter(m=>!m.result && !m.scheduled);
  const scheduledQueue = matches.filter(m=>!m.result && m.scheduled);

  let html = '';

  // ---- Session Info Bar ----
  html += `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="font-size:12px;color:var(--text2)">
        <span class="badge badge-primary">${att.length} players</span>
        <span class="badge badge-ghost" style="margin-left:4px">▣ ${numCourts} court${numCourts>1?'s':''}</span>
        ${advInterval>0?`<span class="badge badge-adv" style="margin-left:4px">⚡ ADV every ${advInterval}</span>`:''}
        <span class="badge badge-ghost" style="margin-left:4px">▶ ${completedMatches.length} played</span>
        ${scheduledQueue.length>0?`<span class="badge badge-primary" style="margin-left:4px">▣ ${scheduledQueue.length} queued</span>`:''}
      </div>
      ${isAdmin?`<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <button class="btn btn-ghost btn-sm" onclick="openLatePlayerModal('${s.id}')">+ Late Player</button>
        <button class="btn btn-ghost btn-sm" onclick="shuffleQueue('${s.id}')">⇄</button>
        <div style="display:flex;align-items:center;gap:4px;background:var(--surface2);border-radius:6px;padding:3px 8px">
          <span style="font-size:10px;color:var(--text3)">▣</span>
          <button onclick="changeCourts('${s.id}',${numCourts-1})" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" ${numCourts<=1?'disabled':''}">−</button>
          <span style="font-size:12px;font-weight:700;min-width:14px;text-align:center">${numCourts}</span>
          <button onclick="changeCourts('${s.id}',${numCourts+1})" style="background:none;border:none;color:var(--text2);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" ${numCourts>=6?'disabled':''}">+</button>
        </div>
      </div>`:''}
    </div>
  </div>`;

  // ---- Active Courts ----
  if(activeMatches.length > 0){
    html += `<div class="card" style="margin-bottom:12px"><div class="card-title">▶ Active Courts</div>`;
    activeMatches.forEach((match,ci)=>{
      const isAdv = match.matchType==='advanced';
      html += `<div class="court-card ${isAdv?'adv-mode':''}" style="margin-bottom:10px">
        <div class="court-label" style="${isAdv?'color:var(--red)':''}">COURT ${match.courtNum||ci+1} · MATCH #${match.matchNum}</div>
        ${isAdv?`<div class="adv-battle-banner"><span class="adv-fire">🔥</span><span class="adv-battle-label">⚡ ADVANCED BATTLE</span></div>`:''}
        <div style="text-align:center;margin-bottom:8px">
          <span class="match-type-tag ${isAdv?'adv':'regular'}">${isAdv?'⚡ Advanced Battle':'▶ Regular Match'}</span>
        </div>
        <div class="court-teams">
          <div class="court-team">
            <div class="team-label">Team A</div>
            <div class="team-players">
              ${(match.team1||[]).map(pid=>{const m=STATE.members.find(x=>x.id===pid);return `<div class="team-player">
                <div class="m-avatar" style="width:24px;height:24px;font-size:10px;background:${avatarColor(m?.name||'?')}22;color:${avatarColor(m?.name||'?')}">${initials(m?.name||'?')}</div>
                <span style="flex:1;font-size:12px">${esc(m?.nickname||m?.name?.split(' ')[0]||'?')}</span>
                ${skillBadge(m?.skill||'Beginner')}
              </div>`;}).join('')}
            </div>
          </div>
          <div class="vs-badge" style="${isAdv?'color:var(--red)':''}">VS</div>
          <div class="court-team">
            <div class="team-label">Team B</div>
            <div class="team-players">
              ${(match.team2||[]).map(pid=>{const m=STATE.members.find(x=>x.id===pid);return `<div class="team-player">
                <div class="m-avatar" style="width:24px;height:24px;font-size:10px;background:${avatarColor(m?.name||'?')}22;color:${avatarColor(m?.name||'?')}">${initials(m?.name||'?')}</div>
                <span style="flex:1;font-size:12px">${esc(m?.nickname||m?.name?.split(' ')[0]||'?')}</span>
                ${skillBadge(m?.skill||'Beginner')}
              </div>`;}).join('')}
            </div>
          </div>
        </div>
        ${isAdmin?`<div style="display:flex;gap:6px;justify-content:center;margin-top:12px;flex-wrap:wrap">
          <button class="btn btn-green btn-sm" onclick="recordResult('${s.id}','${match.id}','teamA')">Team A Wins</button>
          <button class="btn btn-ghost btn-sm" onclick="recordResult('${s.id}','${match.id}','draw')">Draw</button>
          <button class="btn btn-green btn-sm" onclick="recordResult('${s.id}','${match.id}','teamB')">Team B Wins</button>
        </div>`:''}
      </div>`;
    });
    html += `</div>`;
  }

  // ---- Generate Matches Button ----
  if(isAdmin){
    const onCourtNow = activeMatches.flatMap(m=>(m.team1||[]).concat(m.team2||[]));
    const availableForNext = queue.filter(id=>!onCourtNow.includes(id));
    // Can start next match if: a court is free AND (there's a scheduled match queued OR 4+ free players)
    const canGenerate = activeMatches.length < numCourts && (scheduledQueue.length > 0 || availableForNext.length >= 4);
    const canSchedule = availableForNext.length >= 4 && scheduledQueue.length === 0;

    const nextMatchNum = completedMatches.length + activeMatches.length + scheduledQueue.length + 1;
    const isNextAdv = advInterval>0 && nextMatchNum % advInterval === 0;
    const advPlayersAvail = att.filter(id=>{const m=STATE.members.find(x=>x.id===id);return m?.skill?.toLowerCase()==='advanced';}).length;

    html += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn btn-gold btn-sm" onclick="generateMatchup('${s.id}')" ${canGenerate?'':'disabled'}>
        ⚡ ${scheduledQueue.length>0?'Start Next Match':'Next Match'}
        ${scheduledQueue.length>0?`<span class="badge badge-primary" style="margin-left:4px">${scheduledQueue.length} ready</span>`:''}
        ${scheduledQueue.length===0&&isNextAdv?`<span class="badge badge-adv" style="margin-left:4px">${advPlayersAvail>=4?'⚡ ADV':'skip'}</span>`:''}
      </button>
      <button class="btn btn-primary btn-sm" onclick="generate10Matches('${s.id}')" ${canSchedule?'':'disabled'} title="${scheduledQueue.length>0?'Clear current schedule first to regenerate':''}">
        ▣ ${scheduledQueue.length>0?'Reschedule 10':'Schedule 10 Matches'}
      </button>
      <button class="btn btn-ghost btn-sm" onclick="openCustomMatchModal('${s.id}')">
        ◈ Custom Match
      </button>
    </div>`;
  }

  // ---- Queue ----
  const onCourtIds = activeMatches.flatMap(m=>(m.team1||[]).concat(m.team2||[]));
  html += `<div class="card" style="margin-bottom:12px">
    <div class="card-title">▣ Queue (${queue.length})</div>
    ${queue.map((pid,i)=>{
      const m=STATE.members.find(x=>x.id===pid);const nm=m?m.name:'?';
      const onCourt=onCourtIds.includes(pid);
      return `<div class="queue-list-item" style="${onCourt?'border-color:var(--primary);background:var(--primary-dim)':''}">
        <div class="queue-num">${i+1}</div>
        <div class="m-avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(nm)}22;color:${avatarColor(nm)}">${initials(nm)}</div>
        <span style="flex:1;font-size:13px">${esc(m?.nickname||nm.split(' ')[0])}</span>
        ${skillBadge(m?.skill||'Beginner')}
        ${onCourt?'<span class="badge badge-primary" style="font-size:9px">COURT</span>':''}
      </div>`;
    }).join('')}
    ${!queue.length?'<div class="empty" style="padding:16px"><div class="empty-text">No players in queue.</div></div>':''}
  </div>`;

  // ---- Scheduled (Upcoming) Matches ----
  const scheduledMatches = matches.filter(m=>!m.result && m.scheduled && !activeMatches.find(a=>a.id===m.id));
  if(scheduledMatches.length){
    html += `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div class="card-title" style="margin:0">▣ Upcoming Schedule (${scheduledMatches.length})</div>
        ${isAdmin?`<button class="btn btn-ghost btn-xs" onclick="clearSchedule('${s.id}')" style="font-size:10px;color:var(--red)">✕ Clear</button>`:''}
      </div>
      ${scheduledMatches.map((m,i)=>{
        const t1n=(m.team1||[]).map(id=>{const p=STATE.members.find(x=>x.id===id);return p?.nickname||p?.name?.split(' ')[0]||'?';}).join(' & ');
        const t2n=(m.team2||[]).map(id=>{const p=STATE.members.find(x=>x.id===id);return p?.nickname||p?.name?.split(' ')[0]||'?';}).join(' & ');
        const isAdv=m.matchType==='advanced';
        return `<div style="padding:7px 6px;border-bottom:1px solid var(--border);font-size:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;background:${i===0?'var(--primary-dim)':''}; border-radius:${i===0?'6px':''};margin-bottom:${i===0?'4px':''}">
          <span style="font-family:'Bebas Neue',sans-serif;color:${i===0?'var(--primary)':'var(--text3)'};font-size:14px;min-width:28px">#${m.matchNum}</span>
          ${isAdv?'<span class="badge badge-adv" style="font-size:9px">⚡</span>':''}
          <span class="badge badge-ghost" style="font-size:9px">C${m.courtNum}</span>
          <span style="font-weight:${i===0?'700':'400'}">${esc(t1n)}</span>
          <span style="color:var(--gold);font-family:'Bebas Neue',sans-serif">VS</span>
          <span style="font-weight:${i===0?'700':'400'}">${esc(t2n)}</span>
          ${i===0?'<span class="badge badge-primary" style="margin-left:auto;font-size:9px">NEXT UP</span>':''}
        </div>`;
      }).join('')}
    </div>`;
  }

  // ---- Match History ----
  if(completedMatches.length){
    html += `<div class="card">
      <div class="card-title">▣ Completed (${completedMatches.length})</div>
      ${completedMatches.map(m=>{
        const t1n=(m.team1||[]).map(id=>{const p=STATE.members.find(x=>x.id===id);return p?.nickname||p?.name?.split(' ')[0]||'?';}).join(' & ');
        const t2n=(m.team2||[]).map(id=>{const p=STATE.members.find(x=>x.id===id);return p?.nickname||p?.name?.split(' ')[0]||'?';}).join(' & ');
        const wA=m.result==='teamA',wB=m.result==='teamB';
        return `<div style="padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-family:'Bebas Neue',sans-serif;color:var(--text3);font-size:14px;min-width:20px">#${m.matchNum}</span>
          ${m.matchType==='advanced'?'<span class="badge badge-adv" style="font-size:9px">⚡</span>':''}
          ${m.custom?'<span class="badge badge-ghost" style="font-size:9px">custom</span>':''}
          <span style="${wA?'color:var(--green);font-weight:700':''}">${esc(t1n)}</span>
          <span style="color:var(--gold);font-family:'Bebas Neue',sans-serif">VS</span>
          <span style="${wB?'color:var(--green);font-weight:700':''}">${esc(t2n)}</span>
          <span class="badge ${m.result==='draw'?'badge-ghost':'badge-green'}" style="font-size:9px">${m.result==='draw'?'Draw':wA?'A Wins':'B Wins'}</span>
          ${isAdmin?`<button onclick="deleteMatch('${s.id}','${m.id}')" style="margin-left:auto;background:none;border:1px solid var(--red);color:var(--red);border-radius:4px;padding:2px 6px;font-size:9px;cursor:pointer;line-height:1.4">✕</button>`:''}
        </div>`;
      }).join('')}
    </div>`;
  }

  el.innerHTML = html;
}

// ============ SESSION MODAL ============
window.openSessionModal = function(){
  document.getElementById('sessionModalTitle').textContent = 'New Queue Session';
  document.getElementById('sfDate').value = new Date().toISOString().split('T')[0];
  document.getElementById('sfVenue').value='';
  document.getElementById('sfNotes').value='';
  document.getElementById('sfCourts').value='1';
  document.getElementById('sfAdvInterval').value='0';
  document.getElementById('sfAttendees').innerHTML = STATE.members.map(m=>`
    <div class="chip" data-id="${m.id}" onclick="this.classList.toggle('on')">
      ${esc(m.nickname||m.name.split(' ')[0])} ${skillBadge(m.skill||'Beginner')}
    </div>
  `).join('');
  openModal('sessionModal');
};

window.sessionSelectAll = function(sel){
  document.querySelectorAll('#sfAttendees .chip').forEach(c=>{ if(sel)c.classList.add('on'); else c.classList.remove('on'); });
};

window.saveSession = async function(){
  const date = document.getElementById('sfDate').value;
  if(!date){ toast('Date required','error'); return; }
  const attendees = [...document.querySelectorAll('#sfAttendees .chip.on')].map(c=>c.dataset.id);
  const numCourts = parseInt(document.getElementById('sfCourts').value)||1;
  const advInterval = parseInt(document.getElementById('sfAdvInterval').value)||0;
  const data = {
    date, venue:document.getElementById('sfVenue').value.trim(),
    notes:document.getElementById('sfNotes').value.trim(),
    numCourts, advInterval,
    perHead:0, attendees,
    queueOrder:[...attendees],
    matches:[], payments:[], expenses:[],
    createdAt:serverTimestamp()
  };
  try{
    const ref = await addDoc(collection(db,'sessions'),data);
    STATE.currentSessionId = ref.id;
    closeModal('sessionModal');
    toast('Session created!','success');
    setTimeout(()=>navigateTo('queue'),300);
  }catch(e){ toast('Error: '+e.message,'error'); }
};

// ============ LATE PLAYERS ============
window.openLatePlayerModal = function(sid){
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  const existing = new Set(s.attendees||[]);
  const notYetIn = STATE.members.filter(m=>!existing.has(m.id));
  if(!notYetIn.length){ toast('All members are already in this session','info'); return; }
  document.getElementById('lpChips').innerHTML = notYetIn.map(m=>`
    <div class="chip" data-id="${m.id}" onclick="this.classList.toggle('on')">
      ${esc(m.nickname||m.name.split(' ')[0])} ${skillBadge(m.skill||'Beginner')}
    </div>
  `).join('');
  window._latePlayerSessionId = sid;
  openModal('latePlayerModal');
};

window.saveLatePlayers = async function(){
  const sid = window._latePlayerSessionId;
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  const newIds = [...document.querySelectorAll('#lpChips .chip.on')].map(c=>c.dataset.id);
  if(!newIds.length){ closeModal('latePlayerModal'); return; }
  const att = [...(s.attendees||[]), ...newIds];
  const queue = [...(s.queueOrder||s.attendees||[]), ...newIds];
  // Only add a payment stub if not already present — avoid overwriting existing records
  const existingPayments = [...(s.payments||[])];
  newIds.forEach(function(id){
    if(!existingPayments.find(function(p){return p.memberId===id;})){
      existingPayments.push({memberId:id,amountPaid:0,status:'unpaid'});
    }
  });
  // Recalculate perHead: if expenses exist, spread over new att count
  const expenses = s.expenses||[];
  const expTotal = expenses.reduce(function(sum,e){return sum+(parseFloat(e.amount)||0);},0);
  const perHead = att.length>0 && expTotal>0 ? Math.round((expTotal/att.length)*100)/100 : (parseFloat(s.perHead)||0);
  try{
    await updateDoc(doc(db,'sessions',sid),{attendees:att,queueOrder:queue,payments:existingPayments,perHead:perHead});
    closeModal('latePlayerModal');
    toast(newIds.length+' player(s) added to queue!','success');
  }catch(e){ toast(e.message,'error'); }
};

// ============ GENERATE MATCHUP ============
window.generateMatchup = async function(sid){
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  const allMatches = [...(s.matches||[])];
  const activeMatches = allMatches.filter(m=>!m.result && !m.scheduled);
  const completedMatches = allMatches.filter(m=>m.result);
  const scheduledMatches = allMatches.filter(m=>!m.result && m.scheduled);
  const numCourts = parseInt(s.numCourts)||1;
  if(activeMatches.length >= numCourts){ toast('All courts occupied','error'); return; }

  const nextCourtNum = (activeMatches.map(m=>m.courtNum||1).sort().pop()||0)+1;

  // If there are pre-scheduled matches, activate the next one
  if(scheduledMatches.length > 0){
    const nextScheduled = scheduledMatches[0];
    const updatedMatches = allMatches.map(m=>
      m.id===nextScheduled.id ? {...m, scheduled:false, courtNum:nextCourtNum, activatedAt:new Date().toISOString()} : m
    );
    try{
      await updateDoc(doc(db,'sessions',sid),{matches:updatedMatches});
      toast(`Match #${nextScheduled.matchNum} started on Court ${nextCourtNum}!`,'success');
    }catch(e){ toast(e.message,'error'); }
    return;
  }

  // No schedule — generate a fresh match on the fly
  const onCourtIds = activeMatches.flatMap(m=>(m.team1||[]).concat(m.team2||[]));
  const availableInQueue = (s.queueOrder||[]).filter(id=>!onCourtIds.includes(id));
  if(availableInQueue.length < 4){ toast('Need 4+ players in queue','error'); return; }

  const nextMatchNum = completedMatches.length + activeMatches.length + 1;
  const advInterval = parseInt(s.advInterval)||0;
  const isAdvSlot = advInterval>0 && nextMatchNum % advInterval === 0;
  const usedPairings = buildUsedPairings(s.matches||[]);

  let team1, team2, matchType;
  if(isAdvSlot){
    const advPlayers = (s.attendees||[]).filter(id=>{const m=STATE.members.find(x=>x.id===id);return m?.skill?.toLowerCase()==='advanced';});
    if(advPlayers.length>=4){
      const shuffled=[...advPlayers].sort(()=>Math.random()-0.5);
      team1=[shuffled[0],shuffled[1]];team2=[shuffled[2],shuffled[3]];
      matchType='advanced';
      toast('⚡ Advanced Battle!','success');
    } else {
      toast(`ADV Battle skipped (only ${advPlayers.length} ADV). Regular match.`,'info');
      const res = buildBalancedTeams(availableInQueue.slice(0,4), usedPairings);
      team1=res.team1;team2=res.team2;matchType='regular';
    }
  } else {
    const res = buildBalancedTeams(availableInQueue.slice(0,4), usedPairings);
    team1=res.team1;team2=res.team2;matchType='regular';
  }

  const matches = [...allMatches,{
    id:uid(),matchNum:nextMatchNum,matchType,courtNum:nextCourtNum,
    team1,team2,result:null,createdAt:new Date().toISOString()
  }];
  try{
    await updateDoc(doc(db,'sessions',sid),{matches});
    if(matchType==='regular') toast('Match generated!','success');
  }catch(e){ toast(e.message,'error'); }
};

window.generateAllMatchups = async function(sid){
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  const numCourts = parseInt(s.numCourts)||1;
  const queue = [...(s.queueOrder||[])];
  const existingMatches = [...(s.matches||[])];
  const usedPairings = buildUsedPairings(existingMatches);
  const completedCount = existingMatches.filter(m=>m.result).length;
  const advInterval = parseInt(s.advInterval)||0;

  let newMatches = [...existingMatches];
  let matchNum = completedCount + 1;
  let availableQueue = [...queue];
  let courtsUsed = 0;

  while(availableQueue.length >= 4 && courtsUsed < numCourts){
    const isAdvSlot = advInterval>0 && matchNum % advInterval === 0;
    let team1,team2,matchType;
    if(isAdvSlot){
      const advPlayers=(s.attendees||[]).filter(id=>{const m=STATE.members.find(x=>x.id===id);return m?.skill?.toLowerCase()==='advanced';});
      if(advPlayers.length>=4){
        const sh=[...advPlayers].sort(()=>Math.random()-0.5);
        team1=[sh[0],sh[1]];team2=[sh[2],sh[3]];matchType='advanced';
      } else {
        const res=buildBalancedTeams(availableQueue.slice(0,4),usedPairings);
        team1=res.team1;team2=res.team2;matchType='regular';
      }
    } else {
      const res=buildBalancedTeams(availableQueue.slice(0,4),usedPairings);
      team1=res.team1;team2=res.team2;matchType='regular';
    }
    const usedIds=[...team1,...team2];
    availableQueue=availableQueue.filter(id=>!usedIds.includes(id));
    newMatches.push({id:uid(),matchNum,matchType,courtNum:courtsUsed+1,team1,team2,result:null,createdAt:new Date().toISOString()});
    matchNum++;courtsUsed++;
  }
  try{
    await updateDoc(doc(db,'sessions',sid),{matches:newMatches});
    toast(`${courtsUsed} court(s) filled!`,'success');
  }catch(e){ toast(e.message,'error'); }
};

// ============ GENERATE 10 MATCHES SCHEDULE ============
window.generate10Matches = async function(sid){
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;

  const activeMatches = (s.matches||[]).filter(m=>!m.result);
  const completedMatches = (s.matches||[]).filter(m=>m.result);
  const numCourts = parseInt(s.numCourts)||1;
  const advInterval = parseInt(s.advInterval)||0;
  const onCourtIds = activeMatches.flatMap(m=>(m.team1||[]).concat(m.team2||[]));

  // Start from current queue, excluding players already on court
  let availableQueue = (s.queueOrder||[]).filter(id=>!onCourtIds.includes(id));
  if(availableQueue.length < 4){ toast('Need at least 4 players in queue','error'); return; }

  const usedPairings = buildUsedPairings(s.matches||[]);
  let newMatches = [...(s.matches||[])];
  let matchNum = completedMatches.length + activeMatches.length + 1;
  let generated = 0;
  const TARGET = 10;

  // Simulate queue rotation: after a match is generated, those 4 go to back of queue
  let rotatingQueue = [...availableQueue];

  while(generated < TARGET && rotatingQueue.length >= 4){
    const next4 = rotatingQueue.slice(0,4);
    const isAdvSlot = advInterval>0 && matchNum % advInterval === 0;
    let team1, team2, matchType;

    if(isAdvSlot){
      const advPlayers = (s.attendees||[]).filter(id=>{ const m=STATE.members.find(x=>x.id===id); return m?.skill?.toLowerCase()==='advanced'; });
      if(advPlayers.length>=4){
        const sh=[...advPlayers].sort(()=>Math.random()-0.5);
        team1=[sh[0],sh[1]]; team2=[sh[2],sh[3]]; matchType='advanced';
      } else {
        const res=buildBalancedTeams(next4, usedPairings);
        team1=res.team1; team2=res.team2; matchType='regular';
      }
    } else {
      const res=buildBalancedTeams(next4, usedPairings);
      team1=res.team1; team2=res.team2; matchType='regular';
    }

    // Assign court: cycle through available courts
    const courtNum = (generated % numCourts) + 1;

    newMatches.push({
      id:uid(), matchNum, matchType, courtNum,
      team1, team2, result:null,
      scheduled:true, // mark as pre-scheduled (not yet active)
      createdAt:new Date().toISOString()
    });

    // Rotate queue: played 4 go to end
    const usedIds=[...team1,...team2];
    rotatingQueue = [...rotatingQueue.filter(id=>!usedIds.includes(id)), ...usedIds];
    usedIds.forEach(a=>usedIds.forEach(b=>{ if(a!==b) usedPairings.add([a,b].sort().join('|')); }));

    matchNum++;
    generated++;
  }

  try{
    await updateDoc(doc(db,'sessions',sid),{matches:newMatches});
    toast(`${generated} matches scheduled!`,'success');
  }catch(e){ toast(e.message,'error'); }
};

// ============ CUSTOM MATCH ============
window._cmSelectedPlayers = []; // ordered: [0,1] = Team A, [2,3] = Team B
window._cmSessionId = null;

window.openCustomMatchModal = function(sid){
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  window._cmSessionId = sid;
  window._cmSelectedPlayers = [];
  const att = s.attendees||[];
  const activeOnCourt = (s.matches||[]).filter(m=>!m.result).flatMap(m=>(m.team1||[]).concat(m.team2||[]));

  document.getElementById('cmAvailPlayers').innerHTML = att.map(aid=>{
    const m=STATE.members.find(x=>x.id===aid);
    const nm=m?m.name:'?';
    const onCourt=activeOnCourt.includes(aid);
    return `<div class="chip ${onCourt?'disabled':''}" data-id="${aid}" onclick="cmTogglePlayer('${aid}')" style="${onCourt?'opacity:0.4;pointer-events:none':''}">
      ${esc(m?.nickname||nm.split(' ')[0])} ${skillBadge(m?.skill||'Beginner')}
      ${onCourt?'<span style="font-size:9px;color:var(--orange)">▪on court</span>':''}
    </div>`;
  }).join('');

  document.getElementById('cmType').value='regular';
  cmRefreshTeams();
  openModal('customMatchModal');
};

window.cmTogglePlayer = function(aid){
  const idx = window._cmSelectedPlayers.indexOf(aid);
  if(idx>=0){
    window._cmSelectedPlayers.splice(idx,1);
  } else {
    if(window._cmSelectedPlayers.length>=4){ toast('Only 4 players per match','info'); return; }
    window._cmSelectedPlayers.push(aid);
  }
  // Update chip highlight
  document.querySelectorAll('#cmPlayerChips .chip').forEach(c=>{
    const sel = window._cmSelectedPlayers.indexOf(c.dataset.id);
    c.classList.toggle('on', sel>=0);
    if(sel>=0){
      const team = sel<2?'A':'B';
      c.style.borderColor = team==='A'?'var(--primary)':'var(--gold)';
      c.style.color = team==='A'?'var(--primary)':'var(--gold)';
    } else {
      c.style.borderColor=''; c.style.color='';
    }
  });
  cmRefreshTeams();
};

window.cmRefreshTeams = function(){
  const sel = window._cmSelectedPlayers;
  const teamAIds = sel.slice(0,2);
  const teamBIds = sel.slice(2,4);

  const renderSlot = (aid, slot) => {
    if(!aid) return `<div style="font-size:11px;color:var(--text3);padding:4px">Player ${slot}…</div>`;
    const m=STATE.members.find(x=>x.id===aid);
    const nm=m?m.name:'?';
    return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0">
      <div class="m-avatar" style="width:22px;height:22px;font-size:9px;background:${avatarColor(nm)}22;color:${avatarColor(nm)}">${initials(nm)}</div>
      <span style="font-size:12px;font-weight:600">${esc(m?.nickname||nm.split(' ')[0])}</span>
      <button onclick="cmTogglePlayer('${aid}')" style="margin-left:auto;background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px">✕</button>
    </div>`;
  };

  document.getElementById('cmTeamA').innerHTML = [0,1].map(i=>renderSlot(teamAIds[i], i+1)).join('');
  document.getElementById('cmTeamB').innerHTML = [0,1].map(i=>renderSlot(teamBIds[i], i+1)).join('');
  document.getElementById('cmSaveBtn').disabled = sel.length!==4;
};

window.saveCustomMatch = async function(){
  const sid = window._cmSessionId;
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  const sel = window._cmSelectedPlayers;
  if(sel.length!==4){ toast('Select exactly 4 players','error'); return; }

  const team1 = sel.slice(0,2);
  const team2 = sel.slice(2,4);
  const matchType = document.getElementById('cmType').value;
  const activeMatches = (s.matches||[]).filter(m=>!m.result);
  const completedMatches = (s.matches||[]).filter(m=>m.result);
  const numCourts = parseInt(s.numCourts)||1;

  if(activeMatches.length >= numCourts){ toast('All courts occupied','error'); return; }

  const matchNum = completedMatches.length + activeMatches.length + 1;
  const courtNum = (activeMatches.map(m=>m.courtNum||1).sort().pop()||0)+1;

  const matches = [...(s.matches||[]),{
    id:uid(), matchNum, matchType, courtNum,
    team1, team2, result:null,
    custom:true,
    createdAt:new Date().toISOString()
  }];

  try{
    await updateDoc(doc(db,'sessions',sid),{matches});
    closeModal('customMatchModal');
    toast('Custom match started!','success');
  }catch(e){ toast(e.message,'error'); }
};


window.clearSchedule = async function(sid){
  const s = STATE.sessions.find(x=>x.id===sid);
  if(!s) return;
  if(!confirm('Clear all upcoming scheduled matches?')) return;
  const matches = (s.matches||[]).filter(m=>!m.scheduled);
  try{
    await updateDoc(doc(db,'sessions',sid),{matches});
    toast('Schedule cleared','success');
  }catch(e){ toast(e.message,'error'); }
};

function buildUsedPairings(matches){
  const set = new Set();
  matches.filter(m=>m.result).forEach(m=>{
    const pairs = [...(m.team1||[]),...(m.team2||[])];
    for(let i=0;i<pairs.length;i++) for(let j=i+1;j<pairs.length;j++){
      set.add([pairs[i],pairs[j]].sort().join('|'));
    }
  });
  return set;
}

function buildBalancedTeams(next4, usedPairings=new Set()){
  const sorted = next4.map(id=>{
    const m=STATE.members.find(x=>x.id===id);
    const sv=m?.skill?.toLowerCase()==='advanced'?3:m?.skill?.toLowerCase()==='intermediate'?2:1;
    return {id,sv};
  }).sort((a,b)=>b.sv-a.sv);

  // Try all possible balanced splits and prefer ones not seen before
  const combos = [
    {t1:[sorted[0].id,sorted[3].id],t2:[sorted[1].id,sorted[2].id]},
    {t1:[sorted[0].id,sorted[2].id],t2:[sorted[1].id,sorted[3].id]},
    {t1:[sorted[0].id,sorted[1].id],t2:[sorted[2].id,sorted[3].id]},
  ];
  for(const c of combos){
    const allPairs=[c.t1,c.t2].flatMap(team=>{
      const [a,b]=team;return[[a,b].sort().join('|')];
    });
    if(allPairs.every(p=>!usedPairings.has(p))) return {team1:c.t1,team2:c.t2};
  }
  return {team1:combos[0].t1,team2:combos[0].t2}; // fallback
}

window.recordResult = async function(sid,matchId,result){
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const matches=[...(s.matches||[])];
  const idx=matches.findIndex(m=>m.id===matchId);if(idx<0)return;
  const match=matches[idx];
  matches[idx]={...match,result,recordedAt:new Date().toISOString()};

  // Rotate queue
  let queue=[...(s.queueOrder||s.attendees||[])];
  const on=(match.team1||[]).concat(match.team2||[]);
  const off=queue.filter(id=>!on.includes(id));
  let stayers,leavers;
  if(result==='teamA'){stayers=match.team1;leavers=match.team2;}
  else if(result==='teamB'){stayers=match.team2;leavers=match.team1;}
  else{stayers=[];leavers=[...match.team1,...match.team2];}
  const newQueue=[...stayers,...off,...leavers];

  try{
    await updateDoc(doc(db,'sessions',sid),{matches,queueOrder:newQueue});
    toast('Result recorded!','success');
  }catch(e){ toast(e.message,'error'); }
};

window.shuffleQueue = async function(sid){
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const arr=[...(s.queueOrder||s.attendees||[])];
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  try{ await updateDoc(doc(db,'sessions',sid),{queueOrder:arr}); toast('Shuffled!','success'); }
  catch(e){ toast(e.message,'error'); }
};
// ============ CHANGE COURTS (live) ============
window.changeCourts = async function(sid, newCount){
  if(newCount<1||newCount>6) return;
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  try{
    await updateDoc(doc(db,'sessions',sid),{numCourts:newCount});
    toast(`Courts set to ${newCount}`,'success');
  }catch(e){ toast(e.message,'error'); }
};

// ============ DELETE COMPLETED MATCH (with queue rollback) ============
window.deleteMatch = async function(sid, matchId){
  if(!confirm('Delete this match and roll back stats?')) return;
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;

  const allMatches=[...(s.matches||[])];
  const target=allMatches.find(m=>m.id===matchId);
  if(!target||!target.result){ toast('Match not found or not completed','error'); return; }

  // Remove the match
  const newMatches=allMatches.filter(m=>m.id!==matchId);

  // Rebuild queue by replaying all remaining completed matches from scratch
  // Start: original attendees order
  let queue=[...(s.attendees||[])];
  const remainingCompleted=newMatches.filter(m=>m.result).sort((a,b)=>a.matchNum-b.matchNum);

  remainingCompleted.forEach(m=>{
    const on=(m.team1||[]).concat(m.team2||[]);
    const off=queue.filter(id=>!on.includes(id));
    let stayers,leavers;
    if(m.result==='teamA'){stayers=m.team1;leavers=m.team2;}
    else if(m.result==='teamB'){stayers=m.team2;leavers=m.team1;}
    else{stayers=[];leavers=[...m.team1,...m.team2];}
    queue=[...stayers,...off,...leavers];
  });

  // Re-number remaining matches sequentially to avoid gaps
  let matchNum=1;
  const renumbered=newMatches.map(function(m){ return {...m, matchNum:matchNum++}; });

  try{
    await updateDoc(doc(db,'sessions',sid),{matches:renumbered, queueOrder:queue});
    toast('Match deleted & queue rolled back','success');
  }catch(e){ toast(e.message,'error'); }
};



// ═══════════════════════════════════════
// MODULE: expenses.js
// ═══════════════════════════════════════
// ============ EXPENSES ============
function renderExpenses(el){
  const isAdmin=canAdmin();
  el.innerHTML=`
    <div class="sec-header">
      <div><div class="sec-title">Expenses</div><div class="sec-sub">Session costs & who paid</div></div>
    </div>
    <div class="form-group">
      <label class="form-label">Select Session</label>
      <select class="form-select" id="expSessionPicker" onchange="loadExpenseSession()">
        <option value="">— select session —</option>
        ${STATE.sessions.map(s=>`<option value="${s.id}"${s.id===STATE.currentSessionId?' selected':''}>${fmtDate(s.date)}${s.venue?' · '+esc(s.venue):''}</option>`).join('')}
      </select>
    </div>
    <div id="expenseBody"></div>
  `;
  if(STATE.currentSessionId){document.getElementById('expSessionPicker').value=STATE.currentSessionId;loadExpenseSession();}
}

window.loadExpenseSession = function(){
  const sid=document.getElementById('expSessionPicker').value;
  STATE.currentSessionId=sid||null;
  if(!sid){document.getElementById('expenseBody').innerHTML='';return;}
  const s=STATE.sessions.find(x=>x.id===sid);
  if(s) renderExpenseBody(s);
};

function renderExpenseBody(s){
  const el=document.getElementById('expenseBody');
  if(!el)return;
  const expenses=s.expenses||[];
  const att=s.attendees||[];
  const total=expenses.reduce((sum,e)=>sum+(parseFloat(e.amount)||0),0);
  // Use stored perHead if set; fallback to total/att for display only
  const displayPerHead=parseFloat(s.perHead)||(att.length>0?total/att.length:0);
  const isAdmin=canAdmin();
  const byCategory={};
  expenses.forEach(e=>{byCategory[e.category]=(byCategory[e.category]||0)+(parseFloat(e.amount)||0);});

  el.innerHTML=`
    <div class="card" style="margin-bottom:12px">
      <div class="card-title" style="margin-bottom:10px">
        ▸ Expenses — ${fmtDate(s.date)}
        ${isAdmin?`<button class="btn btn-primary btn-sm" style="margin-left:auto" onclick="openExpenseModal('${s.id}')">+ Add</button>`:''}
      </div>
      <div class="grid3" style="margin-bottom:14px">
        <div class="stat-card"><div class="stat-label">Total Spent</div><div class="stat-val" style="font-size:22px;color:var(--red)">${fmtMoney(total)}</div></div>
        <div class="stat-card"><div class="stat-label">Players</div><div class="stat-val" style="font-size:22px">${att.length}</div></div>
        <div class="stat-card"><div class="stat-label">Per Head</div><div class="stat-val" style="font-size:22px;color:var(--gold)">${fmtMoney(displayPerHead)}</div></div>
      </div>
      ${Object.keys(byCategory).length?`
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px">
          ${Object.entries(byCategory).map(([cat,amt])=>`
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius2);padding:6px 10px;font-size:11px">
              <div style="color:${EXP_COLORS[cat]};font-family:'Barlow Condensed',sans-serif;letter-spacing:1px;font-weight:600">${EXP_CATS[cat]||cat}</div>
              <div style="font-family:'Bebas Neue',sans-serif;font-size:16px">${fmtMoney(amt)}</div>
            </div>
          `).join('')}
        </div>
      `:''}
      ${expenses.length?expenses.map(e=>{
        const paidBy=STATE.members.find(x=>x.id===e.paidBy);
        return `<div class="expense-row">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
            <span style="font-size:18px">${{court:'▣',shuttle:'▶',food:'◆',equipment:'◈',other:'◇'}[e.category]||'◇'}</span>
            <div style="min-width:0">
              <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(e.description||e.category)}</div>
              <div style="font-size:10px;color:var(--text3)">Paid by: ${paidBy?esc(paidBy.nickname||paidBy.name.split(' ')[0]):'—'}${e.date?' · '+fmtDate(e.date):''}</div>
              ${e.includedPlayers&&e.includedPlayers.length>0?`<div style="font-size:10px;color:var(--text3)">Split: ${e.includedPlayers.map(function(id){const m=STATE.members.find(function(x){return x.id===id;});return m?esc(m.nickname||m.name.split(' ')[0]):'?';}).join(', ')}</div>`:''}            </div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
            <span style="font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;color:var(--red)">${fmtMoney(e.amount)}</span>
            ${isAdmin?`<button class="btn btn-ghost btn-xs" style="color:var(--gold);border-color:rgba(255,196,51,0.4)" onclick="openEditExpenseModal('${s.id}','${e.id}')">✎</button>`:''}
            ${isAdmin?`<button class="btn btn-ghost btn-xs" onclick="deleteExpense('${s.id}','${e.id}')">✕</button>`:''}
          </div>
        </div>`;
      }).join(''):'<div class="empty" style="padding:20px"><div class="empty-icon">$</div><div class="empty-text">No expenses logged yet.</div></div>'}
    </div>
  `;
}

window.openExpenseModal = function(sid){
  window._expenseSessionId=sid;
  STATE.editingExpenseId=null;
  document.getElementById('expenseModalTitle').textContent='Log Expense';
  document.getElementById('efCat').value='court';
  document.getElementById('efAmt').value='';
  document.getElementById('efNote').value='';
  // Default expense date to the session date (most common case), allow override
  const _sess=STATE.sessions.find(x=>x.id===sid);
  document.getElementById('efDate').value=(_sess&&_sess.date)||new Date().toISOString().split('T')[0];
  const sel=document.getElementById('efPayer');
  sel.innerHTML='<option value="">— select member —</option>'+
    STATE.members.map(m=>`<option value="${m.id}">${esc(m.name)}</option>`).join('');
  // Populate Split Among checkboxes with session attendees
  const _expSess=STATE.sessions.find(x=>x.id===sid);
  const _expAttendees=(_expSess&&_expSess.attendees)||[];
  const _playersEl=document.getElementById('efPlayers');
  _playersEl.innerHTML=_expAttendees.map(function(mid){
    const m=STATE.members.find(function(x){return x.id===mid;});
    if(!m)return '';
    return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;background:var(--surface2);padding:3px 8px;border-radius:12px;cursor:pointer;"><input type="checkbox" class="ef-player-cb" value="'+mid+'" checked style="cursor:pointer;"> '+esc(m.nickname||m.name.split(' ')[0])+'</label>';
  }).join('');
  openModal('expenseModal');
};

window.openEditExpenseModal = function(sid, eid){
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const e=(s.expenses||[]).find(x=>x.id===eid);if(!e)return;
  window._expenseSessionId=sid;
  STATE.editingExpenseId=eid;
  document.getElementById('expenseModalTitle').textContent='Edit Expense';
  document.getElementById('efCat').value=e.category||'other';
  document.getElementById('efAmt').value=e.amount||'';
  document.getElementById('efNote').value=e.description||'';
  document.getElementById('efDate').value=e.date||s.date||new Date().toISOString().split('T')[0];
  const sel=document.getElementById('efPayer');
  sel.innerHTML='<option value="">— select member —</option>'+
    STATE.members.map(m=>`<option value="${m.id}"${m.id===e.paidBy?' selected':''}>${esc(m.name)}</option>`).join('');
  // Populate Split Among — pre-check players that were in includedPlayers (or all if none set)
  const _expAttendees=(s.attendees)||[];
  const _prevIncluded=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:_expAttendees;
  const _playersEl=document.getElementById('efPlayers');
  _playersEl.innerHTML=_expAttendees.map(function(mid){
    const m=STATE.members.find(function(x){return x.id===mid;});
    if(!m)return '';
    const checked=_prevIncluded.includes(mid);
    return '<label style="display:inline-flex;align-items:center;gap:4px;font-size:12px;background:var(--surface2);padding:3px 8px;border-radius:12px;cursor:pointer;"><input type="checkbox" class="ef-player-cb" value="'+mid+'"'+( checked?' checked':'')+' style="cursor:pointer;"> '+esc(m.nickname||m.name.split(' ')[0])+'</label>';
  }).join('');
  openModal('expenseModal');
};

window.saveExpense = async function(){
  const sid=window._expenseSessionId;
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const amount=parseFloat(document.getElementById('efAmt').value);
  if(!amount||isNaN(amount)||amount<=0){toast('Valid amount required','error');return;}
  const expDate=document.getElementById('efDate').value||s.date||new Date().toISOString().split('T')[0];
  const includedPlayers=Array.from(document.querySelectorAll('.ef-player-cb:checked')).map(function(cb){return cb.value;});
  const att=s.attendees||[];

  let expenses=[...(s.expenses||[])];
  const editingId=STATE.editingExpenseId;

  if(editingId){
    // Edit mode — replace existing expense record
    const idx=expenses.findIndex(e=>e.id===editingId);
    if(idx<0){toast('Expense not found','error');return;}
    expenses[idx]={
      ...expenses[idx],
      category:document.getElementById('efCat').value,
      amount,
      description:document.getElementById('efNote').value.trim(),
      paidBy:document.getElementById('efPayer').value||null,
      date:expDate,
      includedPlayers,
      updatedAt:new Date().toISOString()
    };
  } else {
    // Add mode — append new expense
    expenses.push({
      id:uid(),
      category:document.getElementById('efCat').value,
      amount,
      description:document.getElementById('efNote').value.trim(),
      paidBy:document.getElementById('efPayer').value||null,
      date:expDate,
      includedPlayers,
      createdAt:new Date().toISOString()
    });
  }

  // Recalculate perHead: sum all expenses, divide by attendee count (consistent base for Chip-In)
  const total=expenses.reduce((sum,e)=>sum+(parseFloat(e.amount)||0),0);
  const perHead=att.length>0?Math.round((total/att.length)*100)/100:0;

  try{
    await updateDoc(doc(db,'sessions',sid),{expenses,perHead});
    closeModal('expenseModal');
    STATE.editingExpenseId=null;
    toast(editingId?'Expense updated!':'Expense logged!','success');
    // Firebase onSnapshot will auto-refresh all connected views
    loadExpenseSession();
  }catch(e){toast(e.message,'error');}
};

window.deleteExpense = async function(sid,eid){
  if(!CONFIGURED){toast('Firebase not configured','error');return;}
  if(!confirm('Delete this expense?'))return;
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const expenses=(s.expenses||[]).filter(e=>e.id!==eid);
  const total=expenses.reduce((sum,e)=>sum+(parseFloat(e.amount)||0),0);
  const att=s.attendees||[];
  const perHead=att.length>0?Math.round((total/att.length)*100)/100:0;
  try{
    await updateDoc(doc(db,'sessions',sid),{expenses,perHead});
    toast('Expense deleted','success');
    // Firebase onSnapshot auto-refreshes all connected views
    loadExpenseSession();
  }catch(e){toast(e.message,'error');}
};



// ═══════════════════════════════════════
// MODULE: chipin.js
// ═══════════════════════════════════════
// ============ CHIP-IN ============
function renderChipin(el){
  el.innerHTML=`
    <div class="sec-header">
      <div><div class="sec-title">Chip-In</div><div class="sec-sub">Player payments & balances</div></div>
    </div>
    <div class="form-group">
      <label class="form-label">Select Session</label>
      <select class="form-select" id="cipicker" onchange="loadChipinSession()">
        <option value="">— select session —</option>
        ${STATE.sessions.map(s=>`<option value="${s.id}"${s.id===STATE.currentSessionId?' selected':''}>${fmtDate(s.date)}${s.venue?' · '+esc(s.venue):''}</option>`).join('')}
      </select>
    </div>
    <div id="chipinBody"></div>
  `;
  if(STATE.currentSessionId){document.getElementById('cipicker').value=STATE.currentSessionId;loadChipinSession();}
}

window.loadChipinSession = function(){
  const sid=document.getElementById('cipicker').value;
  STATE.currentSessionId=sid||null;
  if(!sid){document.getElementById('chipinBody').innerHTML='';return;}
  const s=STATE.sessions.find(x=>x.id===sid);
  if(s) renderChipinBody(s);
};

function renderChipinBody(s){
  const el=document.getElementById('chipinBody');if(!el)return;
  const att=s.attendees||[];
  const expenses=s.expenses||[];
  const totalExpenses=expenses.reduce((sum,e)=>sum+(parseFloat(e.amount)||0),0);
  const autoPerHead = att.length>0 ? totalExpenses/att.length : 0;
  const perHead = parseFloat(s.perHead)||autoPerHead;
  const payments=s.payments||[];
  // totalCollected = only cash payments from normal players (not expense payer refund records)
  const totalCollected=payments.reduce((sum,p)=>{
    if(p.status==='refund-offset') return sum; // expense payer offset, no cash in
    return sum+(parseFloat(p.amountPaid)||0);
  },0);
  // normalOwed = sum of what each non-expense-payer actually owes IN CASH for this session
  // Must account for carry-over credits (e.g. Mae's credit covers her share → she owes 0 cash)
  // Computed AFTER getCarryover is defined below, so we defer this to after row computation.
  // Placeholder — will be replaced with accurate value from rows after they're built.
  let normalOwed=0; // set after rows are built
  const isMember=STATE.role==='member';
  const myId=STATE.memberDoc?.id;

  // Who paid expenses and how much per payer
  const expensePayerTotals={};
  expenses.forEach(e=>{
    if(e.paidBy){
      expensePayerTotals[e.paidBy]=(expensePayerTotals[e.paidBy]||0)+(parseFloat(e.amount)||0);
    }
  });

  // Net carry-over from previous sessions:
  // Positive = still owes money (unpaid balance from past session)
  // Negative = has a credit (overpaid, or was an expense payer with unrecovered refund)
  function getCarryover(memberId){
    let carry=0;
    STATE.sessions.filter(x=>x.id!==s.id&&new Date(x.date)<new Date(s.date)).forEach(ps=>{
      const pAtt=ps.attendees||[];if(!pAtt.includes(memberId))return;
      const pExp=ps.expenses||[];
      // ppShare: per-expense share for this member in the past session, fallback to stored perHead
      const ppShare=(()=>{
        if(!pExp.length) return parseFloat(ps.perHead)||0;
        const fromExpenses=pExp.reduce((sum,e)=>{
          const amt=parseFloat(e.amount)||0;if(!amt)return sum;
          const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:pAtt;
          if(!incl.includes(memberId))return sum;
          return sum+Math.round((amt/incl.length)*100)/100;
        },0);
        return fromExpenses>0?fromExpenses:(parseFloat(ps.perHead)||0);
      })();
      if(!ppShare)return;

      // How much did this member pay for expenses in this past session?
      const prevExpPayerTotals={};
      pExp.forEach(e=>{ if(e.paidBy) prevExpPayerTotals[e.paidBy]=(prevExpPayerTotals[e.paidBy]||0)+(parseFloat(e.amount)||0); });
      const prevExpPaid=prevExpPayerTotals[memberId]||0;

      // What they actually owed for that session (their share minus any expenses they covered)
      const prevOwed=Math.max(0,ppShare-prevExpPaid);

      // How much did they pay/record as paid
      const ppay=(ps.payments||[]).find(p=>p.memberId===memberId);
      const ppaid=ppay?parseFloat(ppay.amountPaid)||0:0;

      // How much of their refund was already offset to others (if they were an expense payer)
      const prevRefundApplied=ppay?parseFloat(ppay.refundApplied)||0:0;
      // How much carry-over credit was already offset to others (e.g. via project offset)
      const prevCreditOffsetApplied=ppay?parseFloat(ppay.creditOffsetApplied)||0:0;

      // If they were an expense payer: their net position = -(netRefund - refundApplied)
      // i.e. if they have an unrecovered refund, that's a credit (negative carry-over)
      const prevNetRefund=prevExpPaid-ppShare; // positive = group owes them
      if(prevNetRefund>0){
        // They are/were an expense payer in that session
        const unrecoveredRefund=Math.max(0,prevNetRefund-prevRefundApplied);
        carry -= unrecoveredRefund; // credit — reduces what they owe in future sessions
      } else {
        // Normal player — carry over any unpaid balance OR overpayment credit
        // ppaid > prevOwed means they overpaid — that excess is a credit for future sessions
        const sessionBal = prevOwed - ppaid; // negative = overpayment credit, positive = debt
        if(sessionBal < -0.005){
          // Overpayment: credit carries forward, reduced by any portion already offset to others
          const overpayCredit=Math.abs(sessionBal);
          const alreadyOffset=prevRefundApplied; // how much was offset via ◈ Offset
          carry -= Math.max(0, overpayCredit - alreadyOffset);
        } else {
          // Normal debt or zero — only carry forward positive balances
          carry += Math.max(0, sessionBal);
        }
      }
      // creditOffsetApplied reduces carry-over credit regardless of payer type
      if(prevCreditOffsetApplied>0.005) carry+=prevCreditOffsetApplied;
    });
    return carry; // negative = credit, positive = debt
  }

  let rows=att.map(aid=>{
    const m=STATE.members.find(x=>x.id===aid);const nm=m?m.name:'?';
    const pay=payments.find(p=>p.memberId===aid);
    const paid=pay?parseFloat(pay.amountPaid)||0:0;
    const carryover=getCarryover(aid); // can be negative (credit) or positive (debt)
    const expPaid=expensePayerTotals[aid]||0;

    // Net refund for THIS session = expenses paid out minus their own per-head share
    // myShare: sum of this player's share from each expense (respecting includedPlayers), fallback to stored perHead
    const myShare=(()=>{
      if(!expenses.length) return perHead;
      const fromExpenses=expenses.reduce((sum,e)=>{
        const amt=parseFloat(e.amount)||0;if(!amt)return sum;
        const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:att;
        if(!incl.includes(aid))return sum;
        return sum+Math.round((amt/incl.length)*100)/100;
      },0);
      return fromExpenses>0?fromExpenses:perHead;
    })();
    const netRefund=expPaid-myShare; // positive = group owes them cash back
    const isExpensePayer=expPaid>0&&netRefund>0;

    // Total this player owes for current session:
    // perHead + carryover_debt - expenses_paid_this_session
    // carryover can be negative (credit from prev session) → reduces what they owe
    const rawOwed = myShare + carryover - expPaid; // can be negative if credit > current cost
    const totalOwed = Math.max(0, rawOwed);
    // remainingCredit: leftover carry-over credit after covering this session, minus any already offset to others
    const creditOffsetApplied=pay?parseFloat(pay.creditOffsetApplied)||0:0;
    const rawRemainingCredit = rawOwed < 0 ? Math.abs(rawOwed) : 0;
    const remainingCredit = Math.max(0, rawRemainingCredit - creditOffsetApplied);
    const bal=Math.max(0,totalOwed-paid);

    // For expense payers: their effective refund grows if they have a carry-over credit,
    // or shrinks if they have a carry-over debt
    const effectiveRefund=isExpensePayer?Math.max(0,netRefund-Math.max(0,carryover)):0;

    let status;
    if(!myShare) status='noamt';
    else if(isExpensePayer) status='refund';
    else if(rawOwed<=0.005) status='paid'; // carry-over credit covers this session (even if all leftover credit was offset away)
    else if(bal<0.005&&(totalOwed>0||paid>0)) status='paid'; // bal≈0: paid off via cash (handles float drift)
    else if(paid>0) status='partial';
    else status='unpaid';

    // Overpayment: player paid MORE than they owed — excess is a credit they can offset to others
    // Threshold 0.05 filters floating-point rounding noise (e.g. AED 0.01 differences)
    const payRec=payments.find(p=>p.memberId===aid);
    const overpaymentApplied=payRec?parseFloat(payRec.refundApplied)||0:0;
    const rawOverpay=paid-totalOwed; // positive = paid too much
    const overpayment=rawOverpay>0.05?rawOverpay:0; // ignore sub-5-fils rounding noise
    const overpaymentAvail=Math.max(0,overpayment-overpaymentApplied);
    const hasOverpayment=overpayment>0.05;

    return {aid,nm,m,paid,bal,status,perHead:myShare,carryover,rawOwed,totalOwed,remainingCredit,expPaid,netRefund,effectiveRefund,isExpensePayer,overpayment,overpaymentAvail,overpaymentApplied,hasOverpayment};
  });
  // Compute normalOwed from ALL rows (before member filtering) — carry-over-adjusted
  // Credit-covered players (totalOwed=0) correctly contribute 0, fixing false "Remaining"
  normalOwed=rows.filter(r=>!r.isExpensePayer).reduce((sum,r)=>sum+r.totalOwed,0);

  if(isMember&&myId) rows=rows.filter(r=>r.aid===myId);

  // Separate expense payers (to return) from normal payers
  const expPayerRows=rows.filter(r=>r.isExpensePayer);
  const normalRows=rows.filter(r=>!r.isExpensePayer);

  el.innerHTML=`
    <div class="card">
      <div class="card-title">◈ Chip-In — ${fmtDate(s.date)}</div>
      <div class="grid3" style="margin-bottom:12px">
        <div class="stat-card"><div class="stat-label">Per Head</div><div class="stat-val" style="font-size:20px;color:var(--gold)">${fmtMoney(perHead)}</div>
          ${totalExpenses>0?`<div class="stat-sub">From ${fmtMoney(totalExpenses)} expenses</div>`:''}
        </div>
        <div class="stat-card"><div class="stat-label">Collected</div><div class="stat-val" style="font-size:20px;color:var(--green)">${fmtMoney(totalCollected)}</div></div>
        <div class="stat-card"><div class="stat-label">Remaining</div><div class="stat-val" style="font-size:20px;color:var(--red)">${fmtMoney(Math.max(0,normalOwed-totalCollected))}</div></div>
      </div>
      ${perHead>0?`<div class="progress" style="margin-bottom:14px"><div class="progress-fill" style="width:${Math.min(100,normalOwed>0?totalCollected/normalOwed*100:0)}%;background:var(--green)"></div></div>`:''}
      ${!perHead?`<div class="alert alert-warn">No per-head amount yet. Log expenses to auto-calculate, or <button class="btn btn-ghost btn-xs" onclick="manualSetPerHead('${s.id}')">set manually</button>.</div>`:''}

      ${expPayerRows.length?`
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--primary);margin:12px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--primary-dim)">
          ◈ Expense Payer(s) — To Receive Back
        </div>
        ${expPayerRows.map(r=>{
          const payerPayRec=payments.find(p=>p.memberId===r.aid);
          const alreadyApplied=payerPayRec?parseFloat(payerPayRec.refundApplied)||0:0;
          const baseRefund=r.netRefund; // expPaid - perHead (this session)
          const carryDebt=Math.max(0,r.carryover); // what they still owe from previous sessions
          const carryCredit=Math.max(0,-r.carryover);
          // Net return after clearing their own carry-over debt
          const effectiveTotal=Math.max(0,baseRefund-carryDebt+carryCredit);
          // If every non-expense-payer attendee has bal=0 (settled by cash OR credit),
          // the expense payer is fully settled regardless of how refundApplied was recorded.
          // This handles credit-chain payments (e.g. Mae's carryover credit covering Nikho)
          // that don't directly increment refundApplied but still mean everyone has paid.
          const allNonPayersSettled=rows.filter(rr=>!rr.isExpensePayer).every(rr=>rr.bal<0.005);
          const displayRefund=allNonPayersSettled?0:Math.max(0,effectiveTotal-alreadyApplied);
          const fullySettled=allNonPayersSettled||(alreadyApplied>=effectiveTotal-0.005&&effectiveTotal>0);
          // Carry-over that can be auto-settled from refund (not yet settled)
          const autoSettleable=carryDebt>0.005&&baseRefund>carryDebt;
          return `
          <div class="chipin-row" style="border-color:${fullySettled?'rgba(0,232,153,0.3)':'rgba(0,212,255,0.3)'};background:${fullySettled?'rgba(0,232,153,0.04)':'rgba(0,212,255,0.04)'}">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              <div class="m-avatar" style="width:28px;height:28px;font-size:10px;background:${avatarColor(r.nm)}22;color:${avatarColor(r.nm)}">${initials(r.nm)}</div>
              <div style="min-width:0">
                <div style="font-size:13px;font-weight:600">${esc(r.nm)} <span class="badge badge-primary" style="font-size:9px;vertical-align:middle">Paid Expenses</span></div>
                <div style="font-size:10px;color:var(--text3)">
                  Paid: <span style="color:var(--primary)">${fmtMoney(r.expPaid)}</span>
                  · Share: <span style="color:var(--text2)">${fmtMoney(r.perHead)}</span>
                  · Base refund: <span style="color:var(--text2)">${fmtMoney(baseRefund)}</span>
                </div>
                ${carryDebt>0.005?`<div style="font-size:10px;color:var(--orange);margin-top:2px">
                  ▲ Prev. session debt: ${fmtMoney(carryDebt)}
                  ${autoSettleable?` — <span style="color:var(--gold)">deducted from refund → Net return: <strong>${fmtMoney(effectiveTotal)}</strong></span>`:' — exceeds refund'}
                </div>`:''}
                ${carryCredit>0.005?`<div style="font-size:10px;color:var(--green);margin-top:2px">✓ Carry-over credit: +${fmtMoney(carryCredit)} → Net return: <strong>${fmtMoney(effectiveTotal)}</strong></div>`:''}
                ${alreadyApplied<=0&&displayRefund>0.005?`<div style="font-size:10px;color:var(--text3);margin-top:2px">No offset applied yet · <span style="color:var(--gold)">${fmtMoney(displayRefund)} to return as cash or use ◈ Offset</span></div>`:''}
                ${alreadyApplied>0?`<div style="font-size:10px;color:var(--text3);margin-top:2px">Offset applied: ${fmtMoney(alreadyApplied)}${displayRefund>0.005?' · <span style="color:var(--gold)">'+fmtMoney(displayRefund)+' still to return as cash or future offset</span>':' · Fully covered ✓'}</div>`:''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
              ${fullySettled
                ?'<span class="badge badge-green">Settled</span>'
                :displayRefund>0.005?`<span class="badge badge-gold" style="font-size:9px" title="Still owed to ${esc(r.nm)} — return as cash or use Offset">↩ ${fmtMoney(displayRefund)}</span>`:'<span class="badge badge-green">Settled</span>'}
              ${canAdmin()&&carryDebt>0.005&&!fullySettled?`<button class="btn btn-gold btn-xs" onclick="autoSettleCarryOver('${s.id}','${r.aid}','${esc(r.nm)}',${carryDebt})">✓ Settle Debt</button>`:''}
              ${canAdmin()&&!fullySettled&&displayRefund>0.005?`<button class="btn btn-ghost btn-xs" onclick="openRefundOffsetModal('${s.id}','${r.aid}','${esc(r.nm)}',${displayRefund})">◈ Offset</button>`:''}
            </div>
          </div>`;
        }).join('')}
      `:''}

      ${normalRows.length?`
        <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);margin:12px 0 8px;padding-bottom:5px;border-bottom:1px solid var(--border)">
          Players — To Pay
        </div>
        ${normalRows.map(r=>{
          const carryDebt=Math.max(0,r.carryover);
          const carryCredit=Math.max(0,-r.carryover);
          const creditCovered=r.rawOwed<=0.005; // carry covers full share (may have no remainingCredit if all offset)
          return `
          <div class="chipin-row ${r.status}" style="${(r.remainingCredit>0.005||creditCovered)?'border-color:rgba(0,232,153,0.3);background:rgba(0,232,153,0.04)':r.hasOverpayment&&r.overpaymentAvail>0.005?'border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.04)':''}">
            <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0">
              <div class="m-avatar" style="width:28px;height:28px;font-size:10px;background:${avatarColor(r.nm)}22;color:${avatarColor(r.nm)}">${initials(r.nm)}</div>
              <div style="min-width:0">
                <div style="font-size:13px;font-weight:600">${esc(r.nm)}</div>
                <div style="font-size:10px;color:var(--text3)">
                  ${r.remainingCredit>0.005
                    ? `This session: <span style="color:var(--green)">Fully covered by credit</span> · <span style="color:var(--green);font-weight:600">Leftover credit: ${fmtMoney(r.remainingCredit)}</span>`
                    : creditCovered
                      ? `Paid ${fmtMoney(r.paid)} of ${fmtMoney(r.totalOwed)}<span style="color:var(--green)"> (−${fmtMoney(carryCredit)} credit from prev.)</span> · Bal <span style="color:var(--green)">${fmtMoney(r.bal)}</span>`
                      : `Paid ${fmtMoney(r.paid)} of ${fmtMoney(r.totalOwed)}`
                  }
                  ${!creditCovered&&carryDebt>0.005?`<span style="color:var(--orange)"> (+${fmtMoney(carryDebt)} unpaid prev.)</span>`:''}
                  ${!creditCovered&&carryCredit>0.005&&r.remainingCredit<=0.005?`<span style="color:var(--green)"> (−${fmtMoney(carryCredit)} credit from prev.)</span>`:''}
                  ${!creditCovered&&r.remainingCredit<=0.005?` · Bal <span style="color:${r.bal>0?'var(--red)':'var(--green)'}">${fmtMoney(r.bal)}</span>`:''}
                </div>
                ${r.hasOverpayment?`<div style="font-size:10px;margin-top:3px">
                  <span style="color:var(--primary)">↑ Overpaid by ${fmtMoney(r.overpayment)}</span>
                  ${r.overpaymentApplied>0.005?` · Offset applied: ${fmtMoney(r.overpaymentApplied)}`:''}
                  ${r.overpaymentAvail>0.005?` · <span style="color:var(--gold)">${fmtMoney(r.overpaymentAvail)} available to offset</span>`:' · <span style="color:var(--green)">Fully offset ✓</span>'}
                </div>`:''}
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
              ${r.remainingCredit>0.005
                ? `<span class="badge badge-green" style="font-size:9px">↩ ${fmtMoney(r.remainingCredit)}</span>`
                : r.hasOverpayment&&r.overpaymentAvail<=0.05
                  ? '<span class="badge badge-green">Paid</span>'
                  : r.status==='paid'?'<span class="badge badge-green">Paid</span>':r.status==='partial'?'<span class="badge badge-gold">Partial</span>':r.status==='unpaid'?'<span class="badge badge-red">Unpaid</span>':'<span class="badge badge-ghost">—</span>'
              }
              ${r.hasOverpayment&&r.overpaymentAvail>0.05?`<span class="badge badge-primary" style="font-size:9px">↩ ${fmtMoney(r.overpaymentAvail)}</span>`:''}
              ${(canAdmin()||(isMember&&r.aid===myId))&&r.remainingCredit<=0.005&&!creditCovered?`
                ${r.status!=='paid'?`<button class="btn btn-ghost btn-xs" onclick="openPayModal('${s.id}','${r.aid}','${esc(r.nm)}',${r.paid},${r.totalOwed})">Pay</button>`:''}
                ${canAdmin()?`<button class="btn btn-ghost btn-xs" style="color:var(--gold);border-color:rgba(255,196,51,0.4)" title="Edit amount paid" onclick="openEditPayModal('${s.id}','${r.aid}','${esc(r.nm)}',${r.paid},${r.totalOwed})">✎</button>`:''}
              `:''}
              ${canAdmin()&&r.hasOverpayment&&r.overpaymentAvail>0.05?`<button class="btn btn-ghost btn-xs" onclick="openOverpayOffsetModal('${s.id}','${r.aid}','${esc(r.nm)}',${r.overpaymentAvail},false)">◈ Offset</button>`:''}
              ${canAdmin()&&r.remainingCredit>0.05?`<button class="btn btn-ghost btn-xs" onclick="openOverpayOffsetModal('${s.id}','${r.aid}','${esc(r.nm)}',${r.remainingCredit},true)">◈ Offset</button>`:''}
            </div>
          </div>`;
        }).join('')}
      `:''}
    </div>
  `;
}

// Opens a modal to offset a payer's refund against MULTIPLE players' payments (e.g. couples/friends)
window.openRefundOffsetModal = function(sid, payerId, payerName, refundAmt){
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;

  // Gather eligible players from ALL sessions (anyone with an outstanding balance, excluding the payer)
  // Group by member — show net balance across all sessions
  const memberDebts = {}; // memberId -> {nm, totalBal, sessions:[{sid,label,bal,paid,owed}]}

  // Sort sessions by date to apply carry credits in chronological order
  const sortedSessions = STATE.sessions.slice().sort(function(a,b){return new Date(a.date)-new Date(b.date);});

  // Collect all unique attendee IDs (excluding payer)
  const allAids = {};
  sortedSessions.forEach(function(ss){
    (ss.attendees||[]).forEach(function(aid){ if(aid!==payerId) allAids[aid]=true; });
  });

  // For each member, compute carry-aware balance across sessions
  Object.keys(allAids).forEach(function(aid){
    let carry=0; // accumulated credit from overpayments / refund-offsets / creditOffsetApplied

    sortedSessions.forEach(function(ss){
      const sAtt=ss.attendees||[];
      const sExp=ss.expenses||[];
      const sPay=(ss.payments||[]).find(function(p){return p.memberId===aid;});

      if(!sAtt.includes(aid)){
        // Not an attendee — but may have a non-attendee creditOffsetApplied stored here
        if(sPay){
          const coa=parseFloat(sPay.creditOffsetApplied)||0;
          if(coa>0.005) carry+=coa;
        }
        return;
      }

      if(!sAtt.length) return;
      const sExpPayer={};
      sExp.forEach(function(e){ if(e.paidBy) sExpPayer[e.paidBy]=(sExpPayer[e.paidBy]||0)+(parseFloat(e.amount)||0); });

      // Use includedPlayers-aware share (consistent with renderChipinBody)
      const sMyShare=(function(){
        if(!sExp.length) return parseFloat(ss.perHead)||0;
        const fs=sExp.reduce(function(sum,e){
          const amt=parseFloat(e.amount)||0;if(!amt)return sum;
          const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:sAtt;
          if(!incl.includes(aid))return sum;
          return sum+Math.round((amt/incl.length)*100)/100;
        },0);
        return fs; // if excluded from all expenses, share is 0
      })();
      if(!sMyShare) return;

      const sExpPaid=sExpPayer[aid]||0;
      const sNetRef=sExpPaid-sMyShare;
      if(sNetRef>0){
        // Net expense payer — credit is only the UNRECOVERED portion (netRef minus already-applied refunds)
        const sRefundAlreadyApplied=sPay?parseFloat(sPay.refundApplied)||0:0;
        const sCreditOffset=sPay?parseFloat(sPay.creditOffsetApplied)||0:0;
        carry+=Math.max(0,sNetRef-sRefundAlreadyApplied)+(sCreditOffset>0.005?sCreditOffset:0);
        return;
      }

      const sPaid=sPay?(parseFloat(sPay.amountPaid)||0)+(parseFloat(sPay.creditOffsetApplied)||0):0;
      const sRefund=sPay?parseFloat(sPay.refundApplied)||0:0;
      const sOwed=Math.max(0,sMyShare-sExpPaid);
      const sBalRaw=sOwed-sPaid-sRefund;

      if(sBalRaw<=0){
        // Fully paid directly — any overpayment becomes carry
        carry+=Math.max(0,-sBalRaw);
        return;
      }

      // Apply carry credit to reduce this session's balance
      if(carry>=sBalRaw-0.005){
        // Carry covers this session fully
        carry=Math.max(0,carry-sBalRaw);
        return;
      }

      // Still owes after carry — net balance is sBalRaw minus available carry
      const sBal=sBalRaw-carry;
      carry=0;

      if(sBal>0.005){
        const m=STATE.members.find(function(x){return x.id===aid;});
        if(!memberDebts[aid]) memberDebts[aid]={aid, nm:m?m.name:'?', totalBal:0, sessions:[]};
        memberDebts[aid].totalBal+=sBal;
        memberDebts[aid].sessions.push({sid:ss.id, date:ss.date, label:fmtDate(ss.date)+(ss.venue?' · '+esc(ss.venue):''), bal:sBal, paid:sPaid, owed:sOwed});
      }
    });
  });

  const eligiblePlayers = Object.values(memberDebts).sort(function(a,b){return b.totalBal-a.totalBal;})
    .map(function(d){return Object.assign({},d,{remaining:d.totalBal});});

  // Collect projects where OTHER members have outstanding balances (payer can offset credit here too)
  const eligibleProjects = []; // [{pid, pname, mid, mname, due, paid, bal}]
  STATE.projects.forEach(function(p){
    (p.members||[]).forEach(function(pm){
      if(pm.memberId===payerId) return; // skip payer's own project membership
      const due=parseFloat(pm.fixedAmount||p.fixedAmount)||0;
      const paid=parseFloat(pm.amountPaid)||0;
      const bal=due-paid;
      if(bal>0.005){
        const m=STATE.members.find(function(x){return x.id===pm.memberId;});
        eligibleProjects.push({pid:p.id, pname:p.name||'Project', mid:pm.memberId, mname:m?m.name:'?', due, paid, bal});
      }
    });
  });
  // Sort by project name then member name
  eligibleProjects.sort(function(a,b){ return (a.pname+a.mname).localeCompare(b.pname+b.mname); });

  // _offsetSelections: { aid: { sessionId: amount } } — per-session granular selections
  window._offsetSelections = {};
  window._offsetProjectSelections = {}; // { 'pid__mid': { pid, mid, amount, due, bal, pname, mname } }
  window._offsetRefundTotal = refundAmt;
  window._offsetPayerId = payerId;
  window._offsetPayerName = payerName;
  window._offsetSid = sid;
  window._offsetEligible = eligiblePlayers;
  // Auto-expand single-session players; collapse multi-session by default
  window._offsetExpanded = {};
  eligiblePlayers.forEach(function(p){
    if((p.sessions||[]).length===1) window._offsetExpanded[p.aid]=true;
  });

  function _offsetTotalApplied(){
    let t=0;
    Object.values(window._offsetSelections).forEach(function(sessMap){
      Object.values(sessMap).forEach(function(v){ t+=v; });
    });
    Object.values(window._offsetProjectSelections||{}).forEach(function(proj){
      t+=proj.amount||0;
    });
    return t;
  }

  function _offsetUpdateTotals(){
    const applied=_offsetTotalApplied();
    const rem=refundAmt-applied;
    const remEl=document.getElementById('refundRemainingVal');
    const appEl=document.getElementById('refundAppliedVal');
    const applyBtn=document.getElementById('offsetApplyBtn');
    if(remEl){ remEl.textContent=fmtMoney(Math.max(0,rem)); remEl.style.color=rem>0.005?'var(--gold)':'var(--green)'; }
    if(appEl) appEl.textContent=fmtMoney(applied);
    if(applyBtn){ applyBtn.disabled=applied<0.01; applyBtn.textContent='Apply Offset'+(applied>0.01?' ('+fmtMoney(applied)+')':''); }
    // Status banners
    const fullBanner=document.getElementById('offsetFullBanner');
    const partialBanner=document.getElementById('offsetPartialBanner');
    if(fullBanner) fullBanner.style.display=(applied>0&&rem<0.01)?'block':'none';
    if(partialBanner) partialBanner.style.display=(rem>0.005&&applied>0)?'block':'none';
    if(partialBanner) partialBanner.querySelector('.offset-remaining-amt').textContent=fmtMoney(Math.max(0,rem));
  }

  window._offsetSessChange = function(aid, sessId, maxBal){
    const cb=document.getElementById('ofcb_'+aid+'_'+sessId);
    const amtEl=document.getElementById('ofamt_'+aid+'_'+sessId);
    if(!cb||!amtEl) return;
    if(!window._offsetSelections[aid]) window._offsetSelections[aid]={};
    if(cb.checked){
      amtEl.disabled=false;
      amtEl.closest('div').style.opacity='1';
      // Default: fill up to min(balance, remaining refund)
      const applied=_offsetTotalApplied();
      const rem=refundAmt-applied;
      const cur=parseFloat(amtEl.value)||0;
      const defaultAmt=Math.min(maxBal,Math.max(0,rem));
      amtEl.value=(cur<=0.005?defaultAmt:Math.min(cur,maxBal)).toFixed(2);
      window._offsetSelections[aid][sessId]=parseFloat(amtEl.value)||0;
    } else {
      amtEl.disabled=true;
      amtEl.closest('div').style.opacity='0.4';
      amtEl.value='0.00';
      delete window._offsetSelections[aid][sessId];
      if(!Object.keys(window._offsetSelections[aid]).length) delete window._offsetSelections[aid];
    }
    _offsetUpdateTotals();
  };

  window._offsetAmtChange = function(aid, sessId){
    const amtEl=document.getElementById('ofamt_'+aid+'_'+sessId);
    if(!amtEl) return;
    if(!window._offsetSelections[aid]) window._offsetSelections[aid]={};
    let v=parseFloat(amtEl.value)||0;
    // Clamp to the max attribute (session balance) so display stays accurate
    const maxBal=parseFloat(amtEl.max)||v;
    if(v>maxBal){ v=maxBal; amtEl.value=maxBal.toFixed(2); }
    if(v>0.005) window._offsetSelections[aid][sessId]=v;
    else { delete window._offsetSelections[aid][sessId]; if(!Object.keys(window._offsetSelections[aid]).length) delete window._offsetSelections[aid]; }
    _offsetUpdateTotals();
  };

  window._offsetToggleExpand = function(aid){
    window._offsetExpanded[aid]=!window._offsetExpanded[aid];
    const sessBlock=document.getElementById('offsetSess_'+aid);
    if(!sessBlock) return;
    const expandBtn=document.getElementById('offsetExpandBtn_'+aid);
    if(window._offsetExpanded[aid]){
      sessBlock.style.display='block';
      if(expandBtn) expandBtn.textContent='▲ Collapse';
    } else {
      sessBlock.style.display='none';
      if(expandBtn) expandBtn.textContent='▼ Sessions';
    }
  };

  window._offsetProjChange = function(key, maxBal){
    const cb=document.getElementById('ofpcb_'+key);
    const amtEl=document.getElementById('ofpamt_'+key);
    if(!cb||!amtEl) return;
    if(cb.checked){
      amtEl.disabled=false; amtEl.closest('div').style.opacity='1';
      const applied=_offsetTotalApplied();
      const rem=refundAmt-applied;
      const defaultAmt=Math.min(maxBal, Math.max(0, rem));
      if((parseFloat(amtEl.value)||0)<=0.005) amtEl.value=defaultAmt.toFixed(2);
      // Parse pid and mid from key (format: 'pid__mid')
      const sep=key.indexOf('__');
      const pid=key.slice(0,sep);
      const mid=key.slice(sep+2);
      window._offsetProjectSelections[key]={pid, mid, amount:parseFloat(amtEl.value)||0};
    } else {
      amtEl.disabled=true; amtEl.closest('div').style.opacity='0.4'; amtEl.value='0.00';
      delete window._offsetProjectSelections[key];
    }
    _offsetUpdateTotals();
  };

  window._offsetProjAmtChange = function(key, maxBal){
    const amtEl=document.getElementById('ofpamt_'+key);
    if(!amtEl) return;
    let v=parseFloat(amtEl.value)||0;
    if(v>maxBal){ v=maxBal; amtEl.value=maxBal.toFixed(2); }
    if(v>0.005){
      const existing=window._offsetProjectSelections[key]||{};
      // If pid/mid not yet set (edge case), parse from key
      if(!existing.pid){
        const sep=key.indexOf('__');
        existing.pid=key.slice(0,sep);
        existing.mid=key.slice(sep+2);
      }
      window._offsetProjectSelections[key]={...existing, amount:v};
    } else { delete window._offsetProjectSelections[key]; }
    _offsetUpdateTotals();
  };

  function renderOffsetModal(){
    const applied=_offsetTotalApplied();
    const remaining=refundAmt-applied;

    document.getElementById('payModalBody').innerHTML=`
      <div class="modal-header" style="margin-bottom:14px">
        <div class="modal-title">◈ Offset Refund</div>
        <button class="modal-close" onclick="closeModal('payModal')">✕</button>
      </div>
      <div style="font-size:13px;margin-bottom:6px">
        <strong>${esc(payerName)}</strong> is owed back <span style="color:var(--primary);font-weight:700">${fmtMoney(refundAmt)}</span>.
      </div>
      <div style="font-size:11px;color:var(--text2);margin-bottom:12px">Pick which sessions to offset per player — check a session, set the amount, then Apply.</div>

      <!-- Running totals -->
      <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius2);padding:10px 12px;margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);font-family:'Barlow Condensed',sans-serif;margin-bottom:2px">Refund Remaining</div>
          <div id="refundRemainingVal" style="font-family:'Bebas Neue',sans-serif;font-size:26px;line-height:1;color:${remaining>0.005?'var(--gold)':'var(--green)'}">${fmtMoney(Math.max(0,remaining))}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);font-family:'Barlow Condensed',sans-serif;margin-bottom:2px">Applied So Far</div>
          <div id="refundAppliedVal" style="font-family:'Bebas Neue',sans-serif;font-size:20px;line-height:1;color:var(--green)">${fmtMoney(applied)}</div>
        </div>
      </div>

      <!-- Player rows -->
      <div id="offsetPlayerRows">
        ${eligiblePlayers.map(function(p){
          const playerSel=window._offsetSelections[p.aid]||{};
          const playerApplied=Object.values(playerSel).reduce(function(s,v){return s+v;},0);
          const isExpanded=!!window._offsetExpanded[p.aid];
          const hasSessions=(p.sessions||[]).length>0;
          return `<div style="border:1px solid ${playerApplied>0?'rgba(0,212,255,0.35)':'var(--border)'};border-radius:var(--radius2);margin-bottom:6px;overflow:hidden;background:${playerApplied>0?'rgba(0,212,255,0.04)':'var(--surface2)'}">
            <!-- Player header -->
            <div style="display:flex;align-items:center;gap:8px;padding:9px 10px;">
              <div class="m-avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(p.nm)}22;color:${avatarColor(p.nm)}">${initials(p.nm)}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:12px;font-weight:600">${esc(p.nm)}</div>
                <div style="font-size:10px;color:var(--text3)">
                  Total owes: <span style="color:var(--red)">${fmtMoney(p.totalBal)}</span>
                  <span style="color:var(--text3)"> · ${(p.sessions||[]).length} session${(p.sessions||[]).length!==1?'s':''}</span>
                  ${playerApplied>0.005?` · <span style="color:var(--green)">−${fmtMoney(playerApplied)} selected</span>`:''}
                </div>
              </div>
              ${hasSessions&&(p.sessions||[]).length>1?`<button id="offsetExpandBtn_${p.aid}" class="btn btn-ghost btn-xs" onclick="_offsetToggleExpand('${p.aid}')">${isExpanded?'▲ Collapse':'▼ Sessions'}</button>`:''}
            </div>

            <!-- Per-session rows (shown when expanded) -->
            <div id="offsetSess_${p.aid}" style="display:${isExpanded?'block':'none'};border-top:1px solid var(--border);padding:6px 10px 8px;">
              <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);font-family:'Barlow Condensed',sans-serif;margin-bottom:6px">Select sessions to offset:</div>
              ${(p.sessions||[]).sort(function(a,b){return new Date(a.date)-new Date(b.date);}).map(function(d){
                const isChecked=!!(playerSel[d.sid]>0.005);
                const curAmt=playerSel[d.sid]||0;
                return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border);opacity:${isChecked?'1':'0.6'}">
                  <input type="checkbox" id="ofcb_${p.aid}_${d.sid}" ${isChecked?'checked':''}
                    style="width:15px;height:15px;accent-color:var(--primary);cursor:pointer;flex-shrink:0"
                    onchange="_offsetSessChange('${p.aid}','${d.sid}',${d.bal.toFixed(4)})"/>
                  <div style="flex:1;min-width:0">
                    <div style="font-size:11px;font-weight:600;color:var(--text)">${d.label}</div>
                    <div style="font-size:10px;color:var(--text3)">Balance: <span style="color:var(--orange)">${fmtMoney(d.bal)}</span></div>
                  </div>
                  <input type="number" id="ofamt_${p.aid}_${d.sid}"
                    value="${isChecked?curAmt.toFixed(2):'0.00'}" min="0" max="${d.bal.toFixed(2)}" step="0.01" inputmode="decimal"
                    ${isChecked?'':'disabled'}
                    style="width:88px;text-align:right;background:var(--surface3);border:1px solid var(--border2);border-radius:var(--radius2);color:var(--text);font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;padding:4px 7px;outline:none"
                    oninput="_offsetAmtChange('${p.aid}','${d.sid}')"/>
                </div>`;
              }).join('')}
            </div>
          </div>`;
        }).join('')}
        ${eligiblePlayers.length===0?`<div class="empty" style="padding:16px"><div class="empty-text">No players with outstanding balance.</div></div>`:''}
      </div>

      <div id="offsetFullBanner" style="display:${applied>0&&remaining<0.01?'block':'none'};background:var(--green-dim);border:1px solid rgba(0,232,153,0.25);border-radius:var(--radius2);padding:8px 12px;font-size:12px;color:var(--green);margin-top:6px">✓ Full refund of ${fmtMoney(refundAmt)} is covered!</div>
      <div id="offsetPartialBanner" style="display:${remaining>0.005&&applied>0?'block':'none'};background:var(--gold-dim);border:1px solid rgba(255,196,51,0.2);border-radius:var(--radius2);padding:8px 12px;font-size:12px;color:var(--gold);margin-top:6px">▲ <span class="offset-remaining-amt">${fmtMoney(Math.max(0,remaining))}</span> still needs to be returned as cash to ${esc(payerName)}.</div>

      ${eligibleProjects.length?`
      <!-- Project offset section -->
      <div style="font-family:'Barlow Condensed',sans-serif;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--gold);margin:14px 0 8px;padding-bottom:5px;border-bottom:1px solid rgba(255,196,51,0.25)">▣ Also Offset to Projects</div>
      ${eligibleProjects.map(function(proj){
        const key=proj.pid+'__'+proj.mid;
        const sel=window._offsetProjectSelections[key];
        const isChecked=!!(sel&&sel.amount>0.005);
        const curAmt=sel?sel.amount:0;
        return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid ${isChecked?'rgba(255,196,51,0.35)':'var(--border)'};border-radius:var(--radius2);margin-bottom:5px;opacity:${isChecked?'1':'0.75'}">
          <input type="checkbox" id="ofpcb_${key}" ${isChecked?'checked':''}
            style="width:15px;height:15px;accent-color:var(--gold);cursor:pointer;flex-shrink:0"
            onchange="_offsetProjChange('${key}',${proj.bal.toFixed(4)})"/>
          <div style="flex:1;min-width:0">
            <div style="font-size:11px;font-weight:600;color:var(--gold)">▣ ${esc(proj.pname)}</div>
            <div style="font-size:10px;color:var(--text3)">${esc(proj.mname)} · Balance: <span style="color:var(--orange)">${fmtMoney(proj.bal)}</span></div>
          </div>
          <input type="number" id="ofpamt_${key}"
            value="${isChecked?curAmt.toFixed(2):'0.00'}" min="0" max="${proj.bal.toFixed(2)}" step="0.01" inputmode="decimal"
            ${isChecked?'':'disabled'}
            style="width:88px;text-align:right;background:var(--surface3);border:1px solid var(--border2);border-radius:var(--radius2);color:var(--text);font-family:'Barlow Condensed',sans-serif;font-size:13px;font-weight:700;padding:4px 7px;outline:none"
            oninput="_offsetProjAmtChange('${key}',${proj.bal.toFixed(4)})"/>
        </div>`;
      }).join('')}
      `:''}

      <div class="modal-footer" style="margin-top:12px;padding-bottom:0">
        <button class="btn btn-ghost" onclick="closeModal('payModal')">Cancel</button>
        <button id="offsetApplyBtn" class="btn btn-primary" ${applied<0.01?'disabled':''} onclick="applyRefundOffset()">Apply Offset${applied>0.01?' ('+fmtMoney(applied)+')':''}</button>
      </div>
    `;
  }

  renderOffsetModal();
  openModal('payModal');
};

window.applyRefundOffset = async function(){
  const sid=window._offsetSid;
  const payerId=window._offsetPayerId;
  const payerName=window._offsetPayerName;
  const refundAmt=window._offsetRefundTotal;
  const selections=window._offsetSelections||{}; // { aid: { sessId: amount } }
  const eligiblePlayers=window._offsetEligible||[];

  // Flatten to check anything was selected
  let hasAny=false;
  Object.values(selections).forEach(function(sessMap){
    Object.values(sessMap).forEach(function(v){ if(v>0.005) hasAny=true; });
  });
  Object.values(window._offsetProjectSelections||{}).forEach(function(proj){ if(proj.amount>0.005) hasAny=true; });
  if(!hasAny){ toast('Select at least one session or project to offset','error'); return; }

  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;

  const sessionUpdates={};
  const getSessionPayments=function(ssid){
    if(!sessionUpdates[ssid]){
      const ss=STATE.sessions.find(x=>x.id===ssid);
      sessionUpdates[ssid]=[...(ss?.payments||[])];
    }
    return sessionUpdates[ssid];
  };

  let totalApplied=0;
  let sessionApplied=0; // sessions only — used to update payer's refundApplied/creditOffsetApplied
  const offsetSummaryParts=[];

  for(const [targetId, sessMap] of Object.entries(selections)){
    const nm=(STATE.members.find(x=>x.id===targetId)||{}).name||'?';
    // Find this player's session debt objects to get owed amount for status calc
    const playerEntry=eligiblePlayers.find(p=>p.aid===targetId);
    let playerApplied=0;

    for(const [debtSid, offsetAmt] of Object.entries(sessMap)){
      if(!offsetAmt||offsetAmt<0.01) continue;
      const debtSession=STATE.sessions.find(x=>x.id===debtSid);if(!debtSession) continue;
      const debtInfo=(playerEntry?.sessions||[]).find(d=>d.sid===debtSid);
      const owed=debtInfo?debtInfo.owed:offsetAmt;

      const pmts=getSessionPayments(debtSid);
      const idx=pmts.findIndex(p=>p.memberId===targetId);
      const existing=idx>=0?pmts[idx]:{};
      const curPaid=idx>=0?parseFloat(pmts[idx].amountPaid)||0:0;
      const apply=Math.min(offsetAmt, debtInfo?debtInfo.bal:offsetAmt); // cap at actual balance
      const newPaid=curPaid+apply;
      const newStatus=newPaid>=owed-0.005?'paid':newPaid>0?'partial':'unpaid';
      // Accumulate offsetSources so each offset can be individually reversed
      const prevSources=(existing.offsetSources||[]).filter(os=>os.payerSid!==sid||os.payerId!==payerId);
      const existingSource=existing.offsetSources?.find(os=>os.payerSid===sid&&os.payerId===payerId);
      const newSource={payerId, payerSid:sid, amount:(existingSource?.amount||0)+apply};
      const entry={...existing, memberId:targetId, amountPaid:newPaid, status:newStatus,
        note:'Offset from '+payerName+' refund ('+fmtMoney(apply)+')',
        offsetSources:[...prevSources, newSource],
        updatedAt:new Date().toISOString()};
      if(idx>=0)pmts[idx]=entry;else pmts.push(entry);
      playerApplied+=apply;
    }

    totalApplied+=playerApplied;
    sessionApplied+=playerApplied;
    if(playerApplied>0.005) offsetSummaryParts.push(fmtMoney(playerApplied)+' → '+nm);
  }

  // ---- Process project offsets ----
  const projectUpdates={}; // pid -> members[]
  for(const [key, projSel] of Object.entries(window._offsetProjectSelections||{})){
    if(!projSel.amount||projSel.amount<0.01) continue;
    const {pid, mid:pmid, amount:offsetAmt} = projSel;
    const proj=STATE.projects.find(x=>x.id===pid); if(!proj) continue;
    if(!projectUpdates[pid]) projectUpdates[pid]=[...(proj.members||[])];
    const members=projectUpdates[pid];
    const idx=members.findIndex(m=>m.memberId===pmid);
    if(idx<0) continue;
    const due=parseFloat(members[idx].fixedAmount||proj.fixedAmount)||0;
    const curPaid=parseFloat(members[idx].amountPaid)||0;
    const apply=Math.min(offsetAmt, Math.max(0,due-curPaid));
    const prevProjSources=(members[idx].offsetSources||[]).filter(os=>os.payerSid!==sid||os.payerId!==payerId);
    const existingProjSrc=members[idx].offsetSources?.find(os=>os.payerSid===sid&&os.payerId===payerId);
    members[idx]={...members[idx], amountPaid:curPaid+apply, fixedAmount:due,
      offsetSources:[...prevProjSources,{payerId, payerSid:sid, amount:(existingProjSrc?.amount||0)+apply}],
      updatedAt:new Date().toISOString()};
    const mname=(STATE.members.find(x=>x.id===pmid)||{}).name||'?';
    totalApplied+=apply;
    // Note: project offsets also consume payer's credit — include in sessionApplied for tracking
    sessionApplied+=apply;
    offsetSummaryParts.push(fmtMoney(apply)+' → '+mname+' (▣ '+esc(proj.name||'Project')+')');
  }

  // Mark payer's record — works for both expense refund and overpayment/credit
  const currentPayments=getSessionPayments(sid);
  const prevAppliedRec=currentPayments.find(p=>p.memberId===payerId);
  const prevRefundApplied=prevAppliedRec?parseFloat(prevAppliedRec.refundApplied)||0:0;
  const newRefundApplied=prevRefundApplied+sessionApplied;
  const pidx=currentPayments.findIndex(p=>p.memberId===payerId);
  const isOverpay=window._offsetIsOverpay;
  const isRemainingCredit=window._offsetIsRemainingCredit;

  let pentry;
  if(isOverpay && !isRemainingCredit){
    pentry={
      ...(prevAppliedRec||{memberId:payerId,amountPaid:0,status:'paid'}),
      memberId:payerId,
      refundApplied:newRefundApplied,
      note:'Overpay offsets: '+offsetSummaryParts.join(', '),
      updatedAt:new Date().toISOString()
    };
  } else if(isRemainingCredit){
    const prevCreditOffset=prevAppliedRec?parseFloat(prevAppliedRec.creditOffsetApplied)||0:0;
    pentry={
      ...(prevAppliedRec||{memberId:payerId,amountPaid:0,status:'paid'}),
      memberId:payerId,
      creditOffsetApplied:(prevCreditOffset+sessionApplied),
      note:'Credit offsets: '+offsetSummaryParts.join(', '),
      updatedAt:new Date().toISOString()
    };
  } else {
    pentry={
      memberId:payerId,amountPaid:0,status:'refund-offset',
      refundApplied:newRefundApplied,
      note:'Refund offsets: '+offsetSummaryParts.join(', '),
      updatedAt:new Date().toISOString()
    };
  }
  if(pidx>=0)currentPayments[pidx]=pentry;else currentPayments.push(pentry);
  window._offsetIsOverpay=false;
  window._offsetIsRemainingCredit=false;
  window._offsetProjectSelections={};

  try{
    const writes=Object.entries(sessionUpdates).map(([ssid,pmts])=>updateDoc(doc(db,'sessions',ssid),{payments:pmts}));
    Object.entries(projectUpdates).forEach(([pid,members])=>writes.push(updateDoc(doc(db,'projects',pid),{members})));
    await Promise.all(writes);
    closeModal('payModal');
    toast('Offset applied: '+fmtMoney(totalApplied)+' across '+(Object.keys(sessionUpdates).length+Object.keys(projectUpdates).length)+' record(s)!','success');
    loadChipinSession();
  }catch(e){ toast(e.message,'error'); }
};

// ============ OVERPAYMENT OFFSET ============
window.openOverpayOffsetModal = function(sid, payerId, payerName, overpayAmt, isRemainingCredit){
  window._offsetIsOverpay = true;
  window._offsetIsRemainingCredit = !!isRemainingCredit;
  openRefundOffsetModal(sid, payerId, payerName, overpayAmt);
  setTimeout(function(){
    const titleEl=document.querySelector('#payModalBody .modal-title');
    if(titleEl) titleEl.textContent=isRemainingCredit?'◈ Offset Carry-Over Credit':'◈ Offset Overpayment';
    const descEl=document.querySelector('#payModalBody .modal-header + div');
    if(descEl) descEl.innerHTML='<strong>'+esc(payerName)+'</strong> has '+(isRemainingCredit?'carry-over credit':'overpaid') +' of <span style="color:var(--primary);font-weight:700">'+fmtMoney(overpayAmt)+'</span>. Apply to reduce other players\' balances.';
  }, 0);
};
window.autoSettleCarryOver = async function(sid, payerId, payerName, carryDebt){
  if(!confirm(`Deduct ${payerName}'s carry-over debt (${fmtMoney(carryDebt)}) from their refund and mark previous session(s) as paid?`)) return;

  const curSession=STATE.sessions.find(x=>x.id===sid);if(!curSession)return;

  // Find all previous sessions where this player still has an unpaid balance (oldest first)
  const prevSessions=STATE.sessions
    .filter(x=>x.id!==sid && new Date(x.date)<new Date(curSession.date))
    .sort((a,b)=>new Date(a.date)-new Date(b.date));

  const sessionUpdates={}; // ssid -> payments[]
  const getPayments=(ssid)=>{
    if(!sessionUpdates[ssid]){
      const ss=STATE.sessions.find(x=>x.id===ssid);
      sessionUpdates[ssid]=[...(ss?.payments||[])];
    }
    return sessionUpdates[ssid];
  };

  let remaining=carryDebt;
  const settledSessions=[];

  for(const ps of prevSessions){
    if(remaining<=0.005) break;
    const pAtt=ps.attendees||[];
    if(!pAtt.includes(payerId)) continue;
    const pExp=ps.expenses||[];
    // Use includedPlayers-aware share for consistency
    const pMyShare=(()=>{
      if(!pExp.length) return parseFloat(ps.perHead)||0;
      const fs=pExp.reduce((sum,e)=>{
        const amt=parseFloat(e.amount)||0;if(!amt)return sum;
        const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:pAtt;
        if(!incl.includes(payerId))return sum;
        return sum+Math.round((amt/incl.length)*100)/100;
      return fs; // 0 if excluded from all expenses
    })();
    if(!pMyShare) continue;

    const pExpPayer={};
    pExp.forEach(e=>{ if(e.paidBy) pExpPayer[e.paidBy]=(pExpPayer[e.paidBy]||0)+(parseFloat(e.amount)||0); });
    const pExpPaid=pExpPayer[payerId]||0;
    const pNetRef=pExpPaid-pMyShare;
    if(pNetRef>0) continue; // was an expense payer in that session — skip

    const pOwed=Math.max(0,pMyShare-pExpPaid);
    const pmts=getPayments(ps.id);
    const pPayIdx=pmts.findIndex(p=>p.memberId===payerId);
    const pPaid=pPayIdx>=0?parseFloat(pmts[pPayIdx].amountPaid)||0:0;
    const pBal=pOwed-pPaid;
    if(pBal<=0.005) continue;

    const apply=Math.min(remaining, pBal);
    const newPaid=pPaid+apply;
    const newStatus=newPaid>=pOwed-0.005?'paid':newPaid>0?'partial':'unpaid';
    const existingPay=pPayIdx>=0?pmts[pPayIdx]:{};
    const prevSources=(existingPay.offsetSources||[]).filter(os=>os.payerSid!==sid||os.payerId!==payerId);
    const existingSrc=existingPay.offsetSources?.find(os=>os.payerSid===sid&&os.payerId===payerId);
    const entry={...existingPay, memberId:payerId, amountPaid:newPaid, status:newStatus,
      note:`Auto-settled from ${payerName} expense refund on ${fmtDate(curSession.date)}`,
      offsetSources:[...prevSources,{payerId, payerSid:sid, amount:(existingSrc?.amount||0)+apply}],
      updatedAt:new Date().toISOString()};
    if(pPayIdx>=0)pmts[pPayIdx]=entry;else pmts.push(entry);
    remaining-=apply;
    settledSessions.push(`${fmtDate(ps.date)} (${fmtMoney(apply)})`);
  }

  if(!settledSessions.length){ toast('No previous debts found to settle','info'); return; }

  // Update refundApplied on current session for the payer
  const curPayments=getPayments(sid);
  const curPayIdx=curPayments.findIndex(p=>p.memberId===payerId);
  const prevApplied=curPayIdx>=0?parseFloat(curPayments[curPayIdx].refundApplied)||0:0;
  const deducted=carryDebt-remaining; // how much was actually settled
  const newRefundApplied=prevApplied+deducted;
  const curEntry={memberId:payerId,amountPaid:0,status:'refund-offset',refundApplied:newRefundApplied,
    note:`Carry-over debt settled: ${settledSessions.join(', ')}`,
    updatedAt:new Date().toISOString()};
  if(curPayIdx>=0)curPayments[curPayIdx]=curEntry;else curPayments.push(curEntry);

  try{
    await Promise.all(Object.entries(sessionUpdates).map(([ssid,pmts])=>updateDoc(doc(db,'sessions',ssid),{payments:pmts})));
    toast(`Settled debt across ${settledSessions.length} session(s)!`,'success');
    loadChipinSession();
  }catch(e){ toast(e.message,'error'); }
};

window.manualSetPerHead = async function(sid){
  const amt=prompt('Enter per-head chip-in amount (AED):');
  if(!amt||isNaN(parseFloat(amt)))return;
  try{ await updateDoc(doc(db,'sessions',sid),{perHead:parseFloat(amt)}); toast('Amount set','success'); }
  catch(e){ toast(e.message,'error'); }
};

// ---- helpers used by pay modal ----
function _buildPayDebts(mid){
  const allSessionDebts=[];
  // Process oldest-first so carry-over credits flow forward correctly
  const sortedSessions=[...STATE.sessions].sort((a,b)=>new Date(a.date)-new Date(b.date));

  // Rolling credit carried forward from previous sessions (negative = credit, positive = debt)
  let rollingCarry=0;

  sortedSessions.forEach(s=>{
    const sAtt=s.attendees||[];
    const sExp=s.expenses||[];

    // Compute this member's share for this session
    const sMyShare=(()=>{
      if(!sExp.length)return parseFloat(s.perHead)||0;
      const fs=sExp.reduce((sum,e)=>{
        const amt=parseFloat(e.amount)||0;if(!amt)return sum;
        const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:sAtt;
        if(!incl.includes(mid))return sum;
        return sum+Math.round((amt/incl.length)*100)/100;
        return fs; // 0 if excluded from all expenses
    })();

    if(!sAtt.includes(mid)){
      // Not in this session — carry doesn't change
      return;
    }

    const sExpPayer={};
    sExp.forEach(e=>{if(e.paidBy)sExpPayer[e.paidBy]=(sExpPayer[e.paidBy]||0)+(parseFloat(e.amount)||0);});
    const sExpPaid=sExpPayer[mid]||0;
    const sPay=(s.payments||[]).find(p=>p.memberId===mid);
    const sPaid=sPay?parseFloat(sPay.amountPaid)||0:0;
    const sRefundApplied=sPay?parseFloat(sPay.refundApplied)||0:0;
    const sCreditOffsetApplied=sPay?parseFloat(sPay.creditOffsetApplied)||0:0;

    const netRefund=sExpPaid-sMyShare;

    if(netRefund>0){
      // Expense payer in this session — update rolling carry with their unrecovered refund
      const unrecovered=Math.max(0,netRefund-sRefundApplied);
      rollingCarry-=unrecovered; // credit (reduces future debts)
      // Apply creditOffsetApplied unconditionally — reduces carry credit regardless of payer type
      if(sCreditOffsetApplied>0.005) rollingCarry+=sCreditOffsetApplied;
      return; // expense payers don't owe cash themselves
    }

    // Normal player: rawOwed = share + carry (positive=debt, negative=credit from prev)
    if(!sMyShare) return;
    const sOwed=Math.max(0,sMyShare-sExpPaid);
    const rawOwed=sOwed+rollingCarry; // rollingCarry negative = credit reduces this
    const effectiveOwed=Math.max(0,rawOwed);

    // Cash still needed = effectiveOwed - what they already paid
    const sBal=effectiveOwed-sPaid;

    if(sBal>0.005){
      // Still has a real cash balance due
      allSessionDebts.push({
        sid:s.id,
        label:fmtDate(s.date)+(s.venue?' · '+esc(s.venue):''),
        owed:effectiveOwed,
        paid:sPaid,
        bal:sBal
      });
      // Update rolling carry: any unpaid balance carries forward as debt
      const settledThisSession=Math.min(sPaid, effectiveOwed);
      rollingCarry=rawOwed-settledThisSession; // remaining after payment
    } else {
      // Fully settled (by cash or credit) — update rolling carry
      // Subtract any credit already offset to others via creditOffsetApplied
      rollingCarry=rawOwed-sPaid+sCreditOffsetApplied; // reduce credit by what was already offset
    }
  });
  return allSessionDebts;
}

window._renderPayModalTotal = function(){
  // Sum up all checked session amounts and update the running total display
  let total=0;
  document.querySelectorAll('.pay-sess-row').forEach(row=>{
    if(row.querySelector('.pay-sess-cb')?.checked){
      total+=parseFloat(row.querySelector('.pay-sess-amt')?.value)||0;
    }
  });
  const el=document.getElementById('payTotalDisplay');
  if(el) el.textContent=fmtMoney(total);
};

window.openPayModal = function(sid,mid,mname,currentPaid,perHead){
  const allSessionDebts=_buildPayDebts(mid);
  const totalDue=allSessionDebts.reduce((s,d)=>s+d.bal,0);

  // Store for saveChipinPayment
  window._payMid=mid;
  window._payDebts=allSessionDebts;

  const rowsHtml=allSessionDebts.map((d,i)=>`
    <div class="pay-sess-row" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius2);margin-bottom:6px">
      <input type="checkbox" class="pay-sess-cb" data-idx="${i}" checked
        style="width:16px;height:16px;accent-color:var(--primary);cursor:pointer;flex-shrink:0"
        onchange="_onPaySessCbChange(this)"/>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--text)">${d.label}</div>
        <div style="font-size:10px;color:var(--text3)">Balance: <span style="color:var(--red)">${fmtMoney(d.bal)}</span></div>
      </div>
      <input type="number" class="pay-sess-amt form-input" data-idx="${i}"
        value="${d.bal.toFixed(2)}" min="0" max="${d.bal.toFixed(2)}" step="0.01" inputmode="decimal"
        style="width:100px;text-align:right;font-family:'Barlow Condensed',sans-serif;font-size:14px;font-weight:700;padding:6px 8px"
        oninput="_renderPayModalTotal()"/>
    </div>
  `).join('');

  document.getElementById('payModalBody').innerHTML=`
    <div class="modal-header" style="margin-bottom:12px">
      <div class="modal-title">◈ Record Payment</div>
      <button class="modal-close" onclick="closeModal('payModal')">✕</button>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-size:14px;font-weight:600">${esc(mname)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Total outstanding: <span style="color:var(--red);font-weight:700">${fmtMoney(totalDue)}</span></div>
      </div>
      <div style="display:flex;gap:5px">
        <button class="btn btn-ghost btn-xs" onclick="_paySelectAll(true)">All</button>
        <button class="btn btn-ghost btn-xs" onclick="_paySelectAll(false)">None</button>
      </div>
    </div>
    <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);font-family:'Barlow Condensed',sans-serif;margin-bottom:8px">
      Select sessions to pay — adjust amounts as needed
    </div>
    ${rowsHtml||'<div class="empty" style="padding:16px"><div class="empty-text">No outstanding balances.</div></div>'}
    <div style="background:var(--surface2);border:1px solid var(--border2);border-radius:var(--radius2);padding:10px 12px;margin:10px 0;display:flex;align-items:center;justify-content:space-between">
      <span style="font-family:'Barlow Condensed',sans-serif;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:var(--text3)">Paying Now</span>
      <span id="payTotalDisplay" style="font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--green)">${fmtMoney(totalDue)}</span>
    </div>
    <div class="form-group"><label class="form-label">Note (optional)</label>
      <input class="form-input" id="pNote" placeholder="e.g. Cash, GCash, Bank Transfer" autocomplete="off"/>
    </div>
    <div class="modal-footer" style="margin-top:0;padding-bottom:0">
      <button class="btn btn-ghost" onclick="closeModal('payModal')">Cancel</button>
      <button class="btn btn-primary" onclick="saveChipinPayment('${sid}','${mid}')">Save Payment</button>
    </div>
  `;
  openModal('payModal');
};

window._onPaySessCbChange = function(cb){
  const row=cb.closest('.pay-sess-row');
  const amtInput=row.querySelector('.pay-sess-amt');
  const idx=parseInt(cb.dataset.idx);
  const debt=window._payDebts[idx];
  if(!cb.checked){
    amtInput.value='0.00';
    amtInput.disabled=true;
    row.style.opacity='0.45';
  } else {
    amtInput.value=debt.bal.toFixed(2);
    amtInput.disabled=false;
    row.style.opacity='1';
  }
  _renderPayModalTotal();
};

window._paySelectAll = function(selectAll){
  document.querySelectorAll('.pay-sess-row').forEach((row,i)=>{
    const cb=row.querySelector('.pay-sess-cb');
    const amtInput=row.querySelector('.pay-sess-amt');
    const debt=window._payDebts[i];
    cb.checked=selectAll;
    if(selectAll){
      amtInput.value=debt.bal.toFixed(2);
      amtInput.disabled=false;
      row.style.opacity='1';
    } else {
      amtInput.value='0.00';
      amtInput.disabled=true;
      row.style.opacity='0.45';
    }
  });
  _renderPayModalTotal();
};

// Edit existing payment amount for a specific session
window.openEditPayModal = function(sid,mid,mname,currentPaid,totalOwed){
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const pay=(s.payments||[]).find(p=>p.memberId===mid);
  const existingNote=pay?.note||'';
  const refundApplied=pay?parseFloat(pay.refundApplied)||0:0;
  const creditOffsetApplied=pay?parseFloat(pay.creditOffsetApplied)||0:0;
  const hasOffsets=refundApplied>0.005||creditOffsetApplied>0.005;
  // Check if this player's payment was used to offset others (i.e. they are a beneficiary)
  const offsetSources=pay?.offsetSources||[];
  const isBeneficiary=offsetSources.length>0;

  document.getElementById('payModalBody').innerHTML=`
    <div class="modal-header" style="margin-bottom:12px">
      <div class="modal-title">✎ Edit Payment</div>
      <button class="modal-close" onclick="closeModal('payModal')">✕</button>
    </div>
    <div style="margin-bottom:12px">
      <div style="font-size:14px;font-weight:600">${esc(mname)}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">Session: <strong>${fmtDate(s.date)}</strong>${s.venue?' · '+esc(s.venue):''}</div>
      <div style="font-size:12px;color:var(--text3);margin-top:2px">Amount owed: <span style="color:var(--gold)">${fmtMoney(totalOwed)}</span></div>
    </div>
    ${hasOffsets?`<div class="alert alert-warn" style="font-size:11px;margin-bottom:10px">▲ This payment has active offsets applied (${fmtMoney(refundApplied+creditOffsetApplied)}). Clearing will revert all offsets made from this payment.</div>`:''}
    ${isBeneficiary?`<div style="background:rgba(0,212,255,0.07);border:1px solid rgba(0,212,255,0.25);border-radius:var(--radius2);padding:8px 12px;font-size:11px;color:var(--primary);margin-bottom:10px">↩ This payment was partially covered by an offset (${fmtMoney(offsetSources.reduce((s,o)=>s+o.amount,0))}). Clearing will revert that offset on the source player.</div>`:''}
    <div class="alert alert-warn" style="font-size:11px;margin-bottom:12px">▲ This edits the recorded payment for <strong>this session only</strong>. Use "Pay" to record a new payment.</div>
    <div class="form-group"><label class="form-label">Corrected Amount Paid (AED)</label>
      <input type="number" class="form-input" id="editPamt" value="${currentPaid.toFixed(2)}" min="0" step="0.01" inputmode="decimal"/>
    </div>
    <div class="form-group"><label class="form-label">Note (optional)</label>
      <input class="form-input" id="editPnote" value="${esc(existingNote)}" placeholder="e.g. Correction, Cash" autocomplete="off"/>
    </div>
    <div class="modal-footer" style="margin-top:0;padding-bottom:0">
      <button class="btn btn-red btn-sm" onclick="clearPaymentWithReversal('${sid}','${mid}','${esc(mname)}',${totalOwed})">↺ Clear + Revert</button>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('editPamt').value=0">Zero</button>
      <button class="btn btn-green btn-sm" onclick="document.getElementById('editPamt').value=${totalOwed.toFixed(2)}">Full</button>
      <button class="btn btn-ghost" onclick="closeModal('payModal')">Cancel</button>
      <button class="btn btn-gold" onclick="saveEditPayment('${sid}','${mid}',${totalOwed})">Update</button>
    </div>
  `;
  openModal('payModal');
};

window.saveEditPayment = async function(sid,mid,totalOwed){
  const newAmt=parseFloat(document.getElementById('editPamt').value);
  if(isNaN(newAmt)||newAmt<0){toast('Enter a valid amount','error');return;}
  const note=document.getElementById('editPnote').value.trim();
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  const payments=[...(s.payments||[])];
  const idx=payments.findIndex(p=>p.memberId===mid);
  const existing=idx>=0?payments[idx]:{};
  const newStatus=newAmt>=totalOwed-0.005?'paid':newAmt>0?'partial':'unpaid';
  // Preserve refundApplied so overpayment/expense-refund offset tracking is not lost
  const entry={...existing,memberId:mid,amountPaid:newAmt,status:newStatus,note,updatedAt:new Date().toISOString()};
  if(idx>=0)payments[idx]=entry;else payments.push(entry);
  try{
    await updateDoc(doc(db,'sessions',sid),{payments});
    closeModal('payModal');
    toast('Payment updated!','success');
    loadChipinSession();
  }catch(e){toast(e.message,'error');}
};


// Clear a payment and revert ALL offsets it generated or received
window.clearPaymentWithReversal = async function(sid, mid, mname, totalOwed){
  if(!confirm('Clear '+mname+'\'s payment for this session and revert all related offsets?\n\nThis will:\n\u2022 Reset their payment to AED 0.00\n\u2022 Reverse any offsets they applied to others\n\u2022 Reverse any offsets applied to them from others')) return;

  const s=STATE.sessions.find(x=>x.id===sid); if(!s) return;
  const pay=(s.payments||[]).find(p=>p.memberId===mid);
  const sessionUpdates={};
  const projectUpdates={};

  const getSessionPmts=function(ssid){
    if(!sessionUpdates[ssid]){ const ss=STATE.sessions.find(x=>x.id===ssid); sessionUpdates[ssid]=[...(ss?.payments||[])]; }
    return sessionUpdates[ssid];
  };

  // STEP 1: Revert offsets THIS player applied to others
  const refundApplied=pay?parseFloat(pay.refundApplied)||0:0;
  const creditOffsetApplied=pay?parseFloat(pay.creditOffsetApplied)||0:0;
  if(refundApplied+creditOffsetApplied>0.005){
    STATE.sessions.forEach(function(ss){
      const pmts=getSessionPmts(ss.id);
      pmts.forEach(function(p,i){
        const sources=p.offsetSources||[];
        const src=sources.find(function(os){return os.payerId===mid&&os.payerSid===sid;});
        if(!src) return;
        const reversed=Math.max(0,(parseFloat(p.amountPaid)||0)-src.amount);
        pmts[i]={...p, amountPaid:reversed, status:reversed>0.005?'partial':'unpaid',
          offsetSources:sources.filter(function(os){return !(os.payerId===mid&&os.payerSid===sid);}),
          note:'Offset reverted (source payment cleared)', updatedAt:new Date().toISOString()};
      });
    });
    STATE.projects.forEach(function(proj){
      const members=[...(proj.members||[])];
      let changed=false;
      members.forEach(function(pm,i){
        const sources=pm.offsetSources||[];
        const src=sources.find(function(os){return os.payerId===mid&&os.payerSid===sid;});
        if(!src) return;
        members[i]={...pm, amountPaid:Math.max(0,(parseFloat(pm.amountPaid)||0)-src.amount),
          offsetSources:sources.filter(function(os){return !(os.payerId===mid&&os.payerSid===sid);}),
          updatedAt:new Date().toISOString()};
        changed=true;
      });
      if(changed) projectUpdates[proj.id]=members;
    });
  }

  // STEP 2: Revert offsets applied TO this player from others
  const theirSources=pay?.offsetSources||[];
  theirSources.forEach(function(src){
    const sourcePmts=getSessionPmts(src.payerSid);
    const srcIdx=sourcePmts.findIndex(function(p){return p.memberId===src.payerId;});
    if(srcIdx<0) return;
    const srcPay=sourcePmts[srcIdx];
    const prevRefund=parseFloat(srcPay.refundApplied)||0;
    const prevCredit=parseFloat(srcPay.creditOffsetApplied)||0;
    const revertFromRefund=Math.min(src.amount, prevRefund);
    const revertFromCredit=Math.min(src.amount-revertFromRefund, prevCredit);
    sourcePmts[srcIdx]={...srcPay,
      refundApplied:Math.max(0,prevRefund-revertFromRefund),
      creditOffsetApplied:Math.max(0,prevCredit-revertFromCredit),
      updatedAt:new Date().toISOString()};
  });

  // STEP 3: Clear this player's own payment record
  const ownPmts=getSessionPmts(sid);
  const ownIdx=ownPmts.findIndex(function(p){return p.memberId===mid;});
  const cleared={memberId:mid, amountPaid:0, status:'unpaid',
    refundApplied:0, creditOffsetApplied:0, offsetSources:[],
    note:'Payment cleared + offsets reverted', updatedAt:new Date().toISOString()};
  if(ownIdx>=0) ownPmts[ownIdx]=cleared; else ownPmts.push(cleared);

  // STEP 4: Batch write all changes
  try{
    const writes=Object.entries(sessionUpdates).map(function(e){return updateDoc(doc(db,'sessions',e[0]),{payments:e[1]});});
    Object.entries(projectUpdates).forEach(function(e){writes.push(updateDoc(doc(db,'projects',e[0]),{members:e[1]}));});
    await Promise.all(writes);
    closeModal('payModal');
    const pCount=Object.keys(projectUpdates).length;
    const sCount=Math.max(0,Object.keys(sessionUpdates).length-1);
    toast('Payment cleared. Reverted offsets across '+sCount+' session(s)'+(pCount?' + '+pCount+' project(s)':'')+'.','success');
    loadChipinSession();
  }catch(e){ toast(e.message,'error'); }
};

window.saveChipinPayment = async function(sid,mid){
  const note=document.getElementById('pNote')?.value.trim()||'';
  const debts=window._payDebts||[];

  // Collect selected sessions and their chosen amounts from the modal rows
  const selections=[];
  document.querySelectorAll('.pay-sess-row').forEach((row,i)=>{
    const cb=row.querySelector('.pay-sess-cb');
    if(!cb?.checked)return;
    const amt=parseFloat(row.querySelector('.pay-sess-amt')?.value)||0;
    if(amt<=0.005)return;
    const debt=debts[i];
    if(!debt)return;
    // Cap at actual balance — prevent overpayment
    const apply=Math.min(amt,debt.bal);
    selections.push({debt,apply});
  });

  if(!selections.length){toast('Select at least one session and amount','error');return;}

  // Build per-session Firestore updates
  const updates={}; // sessionId -> payments[]
  for(const {debt,apply} of selections){
    const s=STATE.sessions.find(x=>x.id===debt.sid);if(!s)continue;
    const payments=[...(s.payments||[])];
    const idx=payments.findIndex(p=>p.memberId===mid);
    const existing=idx>=0?payments[idx]:{};
    const newPaid=debt.paid+apply;
    const newStatus=newPaid>=debt.owed-0.005?'paid':newPaid>0?'partial':'unpaid';
    // Spread existing to preserve refundApplied, creditOffsetApplied, offsetSources
    const entry={...existing,memberId:mid,amountPaid:newPaid,status:newStatus,note,updatedAt:new Date().toISOString()};
    if(idx>=0)payments[idx]=entry;else payments.push(entry);
    updates[debt.sid]=payments;
  }

  const totalApplied=selections.reduce((s,x)=>s+x.apply,0);
  try{
    await Promise.all(Object.entries(updates).map(([sesId,pmts])=>updateDoc(doc(db,'sessions',sesId),{payments:pmts})));
    closeModal('payModal');
    toast(`${fmtMoney(totalApplied)} saved across ${Object.keys(updates).length} session(s)!`,'success');
    loadChipinSession();
  }catch(e){toast(e.message,'error');}
};



// ═══════════════════════════════════════
// MODULE: stats.js
// ═══════════════════════════════════════
// ============ STATS ============
function renderStats(el){
  el.innerHTML=`
    <div class="sec-header">
      <div><div class="sec-title">Player Stats</div><div class="sec-sub">Wins, losses & calories burned</div></div>
    </div>
    <div class="form-group">
      <input class="form-input" id="statsSearch" placeholder="▶ Search player…" oninput="filterStatsCards()"/>
    </div>
    <div id="statsGrid"></div>
  `;
  renderStatsGrid(STATE.members);
}

function renderStatsGrid(members){
  const el=document.getElementById('statsGrid');if(!el)return;
  if(!members.length){el.innerHTML='<div class="empty"><div class="empty-icon">▲</div><div class="empty-text">No members yet.</div></div>';return;}
  el.innerHTML=`<div class="grid2">${members.map(m=>{
    const stats=calcPlayerStats(m.id);
    const cal=calcCalories(m.weight||65,stats.matches);
    return `<div class="player-stat-card" onclick="showPlayerStats('${m.id}')">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div class="m-avatar" style="width:34px;height:34px;font-size:13px;background:${avatarColor(m.name)}22;color:${avatarColor(m.name)}">${initials(m.name)}</div>
        <div>
          <div class="psc-name">${esc(m.nickname||m.name.split(' ')[0])}</div>
          ${skillBadge(m.skill||'Beginner')}
        </div>
      </div>
      <div class="psc-stats">
        <span style="color:var(--green)">W${stats.wins}</span>
        <span style="color:var(--red)">L${stats.losses}</span>
        <span style="color:var(--text3)">D${stats.draws}</span>
        <span style="color:var(--orange)">▲${cal}kcal</span>
        <span style="color:var(--text3)">${stats.sessions} sessions</span>
      </div>
    </div>`;
  }).join('')}</div>`;
}

window.filterStatsCards = function(){
  const q=document.getElementById('statsSearch')?.value.toLowerCase()||'';
  renderStatsGrid(STATE.members.filter(m=>(m.name||'').toLowerCase().includes(q)||(m.nickname||'').toLowerCase().includes(q)));
};

function calcPlayerStats(memberId){
  let wins=0,losses=0,draws=0,matches=0,sessions=0;
  STATE.sessions.forEach(s=>{
    if(!(s.attendees||[]).includes(memberId))return;
    sessions++;
    (s.matches||[]).filter(m=>m.result).forEach(m=>{
      const inT1=(m.team1||[]).includes(memberId);
      const inT2=(m.team2||[]).includes(memberId);
      if(!inT1&&!inT2)return;
      matches++;
      if(m.result==='draw'){draws++;return;}
      const wonTeam=m.result==='teamA'?m.team1:m.team2;
      if((wonTeam||[]).includes(memberId))wins++;else losses++;
    });
  });
  const wr=matches>0?Math.round(wins/matches*100):0;
  return {wins,losses,draws,matches,sessions,wr};
}

window.showPlayerStats = function(memberId){
  const m=STATE.members.find(x=>x.id===memberId);if(!m)return;
  const stats=calcPlayerStats(memberId);
  const cal=calcCalories(m.weight||65,stats.matches);

  // Session breakdown
  const sessionRows=STATE.sessions.filter(s=>(s.attendees||[]).includes(memberId)).map(s=>{
    let sw=0,sl=0,sd=0;
    (s.matches||[]).filter(mx=>mx.result).forEach(mx=>{
      const inT1=(mx.team1||[]).includes(memberId),inT2=(mx.team2||[]).includes(memberId);
      if(!inT1&&!inT2)return;
      if(mx.result==='draw'){sd++;return;}
      if((mx.result==='teamA'?mx.team1:mx.team2||[]).includes(memberId))sw++;else sl++;
    });
    const sm=sw+sl+sd;
    const sc=calcCalories(m.weight||65,sm);
    return `<tr>
      <td style="font-size:11px">${fmtDate(s.date)}</td>
      <td style="font-size:11px">${esc(s.venue||'—')}</td>
      <td><span style="color:var(--green);font-family:'Barlow Condensed',sans-serif">${sw}W</span> <span style="color:var(--red)">${sl}L</span></td>
      <td><span style="color:var(--orange);font-family:'Bebas Neue',sans-serif">${sc}</span></td>
    </tr>`;
  }).join('');

  document.getElementById('detailModalBody').innerHTML=`
    <div class="modal-header">
      <div class="modal-title">${esc(m.name)}</div>
      <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
      <div class="m-avatar" style="width:52px;height:52px;font-size:20px;background:${avatarColor(m.name)}22;color:${avatarColor(m.name)}">${initials(m.name)}</div>
      <div>
        <div style="font-size:15px;font-weight:600">${esc(m.name)}${m.nickname?` (${esc(m.nickname)})`:''}</div>
        <div style="margin-top:4px">${skillBadge(m.skill||'Beginner')} ${m.weight?`<span style="font-size:11px;color:var(--text3)">· ${m.weight}kg</span>`:''}</div>
      </div>
    </div>

    <div class="calorie-display">
      <div class="cal-num">${cal.toLocaleString()}</div>
      <div class="cal-label">TOTAL CALORIES BURNED ▲</div>
      <div style="font-size:11px;color:var(--text3);margin-top:4px">${stats.matches} matches · ${m.weight||65}kg body weight estimate</div>
    </div>

    <div class="grid4" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-label">Wins</div><div class="stat-val" style="color:var(--green)">${stats.wins}</div></div>
      <div class="stat-card"><div class="stat-label">Losses</div><div class="stat-val" style="color:var(--red)">${stats.losses}</div></div>
      <div class="stat-card"><div class="stat-label">Draws</div><div class="stat-val" style="color:var(--text2)">${stats.draws}</div></div>
      <div class="stat-card"><div class="stat-label">Win Rate</div><div class="stat-val" style="color:var(--gold)">${stats.wr}%</div></div>
    </div>
    <div class="grid2" style="margin-bottom:14px">
      <div class="stat-card"><div class="stat-label">Total Matches</div><div class="stat-val">${stats.matches}</div></div>
      <div class="stat-card"><div class="stat-label">Sessions Attended</div><div class="stat-val">${stats.sessions}</div></div>
    </div>

    ${sessionRows?`
    <div class="card-title" style="margin-top:14px">Session Breakdown</div>
    <div class="table-wrap"><table>
      <thead><tr><th>Date</th><th>Venue</th><th>W/L</th><th>kcal ▲</th></tr></thead>
      <tbody>${sessionRows}</tbody>
    </table></div>
    `:''}
  `;
  openModal('detailModal');
};



// ═══════════════════════════════════════
// MODULE: projects.js
// ═══════════════════════════════════════
// ============ PROJECTS ============
function renderProjects(el){
  const canEdit=canAdmin();
  el.innerHTML=`
    <div class="sec-header">
      <div><div class="sec-title">Projects</div><div class="sec-sub">Jerseys, equipment & more</div></div>
      ${canEdit?`<button class="btn btn-primary btn-sm" onclick="openProjectModal()">+ New</button>`:''}
    </div>
    <div id="projectsDiv">
      ${STATE.projects.length ? STATE.projects.map(p=>renderProjectCard(p)).join('') :
        '<div class="empty"><div class="empty-icon">▣</div><div class="empty-text">No projects yet.</div></div>'}
    </div>
  `;
}

function renderProjectCard(p){
  const members=p.members||[];
  const totalDue=members.reduce((s,m)=>s+(parseFloat(m.fixedAmount||p.fixedAmount)||0),0);
  const totalPaid=members.reduce((s,m)=>s+(parseFloat(m.amountPaid)||0),0);
  const pct=totalDue?Math.min(100,totalPaid/totalDue*100):0;
  const statusBadge=p.status==='completed'?'<span class="badge badge-green">Done</span>':p.status==='cancelled'?'<span class="badge badge-red">Cancelled</span>':'<span class="badge badge-primary">Active</span>';
  return `<div class="project-card" onclick="showProjectDetail('${p.id}')">
    <div class="project-name">${esc(p.name)}</div>
    <div class="project-meta">${p.targetDate?fmtDate(p.targetDate)+' · ':''}${p.description?esc(p.description):''}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
      <div style="font-size:11px;color:var(--text2)">${members.length} members · ${fmtMoney(totalPaid)} / ${fmtMoney(totalDue)}</div>
      ${statusBadge}
    </div>
    <div class="progress"><div class="progress-fill" style="width:${pct}%;background:var(--green)"></div></div>
  </div>`;
}

window.showProjectDetail = function(pid){
  const p=STATE.projects.find(x=>x.id===pid);if(!p)return;
  const canEdit=canAdmin();const isMember=STATE.role==='member';const myId=STATE.memberDoc?.id;
  let members=p.members||[];
  if(isMember&&myId) members=members.filter(m=>m.memberId===myId);
  const totalDue=members.reduce((s,m)=>s+(parseFloat(m.fixedAmount||p.fixedAmount)||0),0);
  const totalPaid=members.reduce((s,m)=>s+(parseFloat(m.amountPaid)||0),0);
  document.getElementById('detailModalBody').innerHTML=`
    <div class="modal-header">
      <div class="modal-title">${esc(p.name)}</div>
      <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    </div>
    <div style="font-size:12px;color:var(--text3);margin-bottom:12px">${p.description?esc(p.description):''} ${p.targetDate?'· Target: '+fmtDate(p.targetDate):''}</div>
    <div class="grid2" style="margin-bottom:12px">
      <div class="stat-card"><div class="stat-label">Collected</div><div class="stat-val" style="font-size:20px;color:var(--green)">${fmtMoney(totalPaid)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Due</div><div class="stat-val" style="font-size:20px">${fmtMoney(totalDue)}</div></div>
    </div>
    <div class="progress" style="margin-bottom:14px"><div class="progress-fill" style="width:${totalDue?Math.min(100,totalPaid/totalDue*100):0}%;background:var(--green)"></div></div>
    <div class="card-title">Members</div>
    ${members.map(pm=>{
      const m=STATE.members.find(x=>x.id===pm.memberId);const nm=m?m.name:'?';
      const due=parseFloat(pm.fixedAmount||p.fixedAmount)||0;
      const paid=parseFloat(pm.amountPaid)||0;
      const bal=due-paid;
      const status=!due?'noamt':bal<0.005&&(due>0||paid>0)?'paid':paid>0?'partial':'unpaid';

      // Build offset sources info — look up payer name and session date
      const offsetSources=pm.offsetSources||[];
      const totalOffset=offsetSources.reduce((s,os)=>s+(os.amount||0),0);
      const cashPaid=Math.max(0,paid-totalOffset);
      const offsetRows=offsetSources.map(function(os){
        const payer=STATE.members.find(function(x){return x.id===os.payerId;});
        const payerNm=payer?payer.name:'Unknown';
        const sess=STATE.sessions.find(function(x){return x.id===os.payerSid;});
        const sessLabel=sess?(fmtDate(sess.date)+(sess.venue?' · '+esc(sess.venue):'')):'Unknown session';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(0,212,255,0.12);font-size:10px">'
          +'<span style="color:var(--text2)">↩ From <strong style="color:var(--primary)">'+esc(payerNm)+'</strong> · '+sessLabel+'</span>'
          +'<span style="color:var(--primary);font-family:\'Barlow Condensed\',sans-serif;font-weight:700">'+fmtMoney(os.amount)+'</span>'
          +'</div>';
      }).join('');

      const hasOffset=totalOffset>0.005;
      const rowId='proj-src-'+pm.memberId;

      return `<div class="chipin-row ${status}" style="margin-bottom:5px;${hasOffset?'border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.03)':''}">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="m-avatar" style="width:26px;height:26px;font-size:10px;background:${avatarColor(nm)}22;color:${avatarColor(nm)}">${initials(nm)}</div>
            <div style="min-width:0;flex:1">
              <div style="font-size:13px;font-weight:600">${esc(nm)}</div>
              <div style="font-size:10px;color:var(--text3)">
                Due ${fmtMoney(due)}
                ${cashPaid>0.005?` · Cash <span style="color:var(--green)">${fmtMoney(cashPaid)}</span>`:''}
                ${hasOffset?` · Offset <span style="color:var(--primary)">${fmtMoney(totalOffset)}</span>`:''}
                · Bal <span style="color:${bal>0?'var(--red)':'var(--green)'}">${fmtMoney(bal)}</span>
              </div>
              ${hasOffset?`<div style="margin-top:3px">
                <button class="btn btn-ghost btn-xs" style="font-size:9px;color:var(--primary);border-color:rgba(0,212,255,0.3);padding:2px 7px"
                  onclick="(function(){var el=document.getElementById('${rowId}');el.style.display=el.style.display==='none'?'block':'none';})()">
                  ↩ ${offsetSources.length} offset source${offsetSources.length!==1?'s':''} — tap to ${hasOffset?'view':'hide'}
                </button>
              </div>`:''}
            </div>
          </div>
          ${hasOffset?`<div id="${rowId}" style="display:none;margin-top:8px;padding:6px 10px;background:rgba(0,212,255,0.06);border-radius:var(--radius2);border:1px solid rgba(0,212,255,0.15)">
            <div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);font-family:'Barlow Condensed',sans-serif;margin-bottom:5px">Payment Sources</div>
            ${cashPaid>0.005?`<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;border-bottom:1px solid rgba(0,212,255,0.12);font-size:10px"><span style="color:var(--text2)">$ Direct cash payment</span><span style="color:var(--green);font-family:'Barlow Condensed',sans-serif;font-weight:700">${fmtMoney(cashPaid)}</span></div>`:''}
            ${offsetRows}
            <div style="display:flex;justify-content:space-between;align-items:center;padding-top:5px;font-size:11px;font-weight:600">
              <span style="color:var(--text2)">Total paid</span>
              <span style="color:var(--green);font-family:'Barlow Condensed',sans-serif">${fmtMoney(paid)}</span>
            </div>
          </div>`:''}
        </div>
        <div style="display:flex;gap:5px;align-items:center;flex-shrink:0;margin-left:8px">
          ${status==='paid'?'<span class="badge badge-green">Paid</span>':status==='partial'?'<span class="badge badge-gold">Partial</span>':status==='unpaid'?'<span class="badge badge-red">Unpaid</span>':''}
          ${hasOffset?`<span class="badge badge-primary" style="font-size:9px">↩ Offset</span>`:''}
          ${(canEdit||(isMember&&pm.memberId===myId))?`<button class="btn btn-ghost btn-xs" onclick="openProjectPayModal('${p.id}','${pm.memberId}','${esc(nm)}',${paid},${due})">Pay</button>`:''}
        </div>
      </div>`;
    }).join('')}
    ${canEdit?`<hr class="divider"><div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-ghost btn-sm" onclick="closeModal('detailModal');openProjectModal('${p.id}')">Edit</button>
      <button class="btn btn-red btn-sm" onclick="deleteProject('${p.id}','${esc(p.name)}')">Delete</button>
    </div>`:''}
  `;
  openModal('detailModal');
};

window.openProjectPayModal = function(pid,mid,mname,currentPaid,due){
  const p=STATE.projects.find(x=>x.id===pid);
  const pm=p?(p.members||[]).find(x=>x.memberId===mid):null;
  const offsetSources=(pm&&pm.offsetSources)||[];
  const totalOffset=offsetSources.reduce(function(s,os){return s+(os.amount||0);},0);
  const cashPaid=Math.max(0,currentPaid-totalOffset);
  const hasOffset=totalOffset>0.005;

  // Legacy fallback: parse payer name from note (e.g. "Offset from Cheng refund (AED 37.00)")
  const memberNote=pm&&pm.note?pm.note:'';
  const legacyMatch=memberNote.match(/Offset from ([^(]+?)(?:\s+refund|\s+credit|\s+overpay)?\s*\(/i);
  const legacyPayerName=legacyMatch?legacyMatch[1].trim():'';
  const hasLegacyOffset=!hasOffset&&currentPaid>0.005&&legacyPayerName.length>0;

  const offsetRows=offsetSources.map(function(os){
    const payer=STATE.members.find(function(x){return x.id===os.payerId;});
    const payerNm=payer?payer.name:'Unknown';
    const sess=STATE.sessions.find(function(x){return x.id===os.payerSid;});
    const sessLabel=sess?(fmtDate(sess.date)+(sess.venue?' \u00b7 '+esc(sess.venue):'')):'Unknown session';
    return '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(0,212,255,0.12)">'
      +'<div><div style="font-size:11px;color:var(--text2)">'
      +'\u21a9 Offset from <strong style="color:var(--primary)">'+esc(payerNm)+'</strong></div>'
      +'<div style="font-size:10px;color:var(--text3)">'+sessLabel+'</div></div>'
      +'<span style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:var(--primary)">'+fmtMoney(os.amount)+'</span>'
      +'</div>';
  }).join('');

  document.getElementById('payModalBody').innerHTML=
    '<div class="modal-header" style="margin-bottom:12px">'
      +'<div class="modal-title">\ud83d\udcb0 Project Payment</div>'
      +'<button class="modal-close" onclick="closeModal(\'payModal\');document.getElementById(\'payModal\').classList.remove(\'elevated\')">\u2715</button>'
    +'</div>'
    +'<div style="margin-bottom:10px">'
      +'<div style="font-size:14px;font-weight:600">'+esc(mname)+'</div>'
      +'<div style="font-size:12px;color:var(--text3);margin-top:2px">Due: <span style="color:var(--gold)">'+fmtMoney(due)+'</span> \u00b7 Paid so far: <span style="color:var(--green)">'+fmtMoney(currentPaid)+'</span></div>'
    +'</div>'
    +(hasOffset
      ?'<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.25);border-radius:var(--radius2);padding:10px 12px;margin-bottom:12px">'
        +'<div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);font-family:\'Barlow Condensed\',sans-serif;margin-bottom:6px">\ud83d\udcb3 Payment Sources</div>'
        +(cashPaid>0.005?'<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:1px solid rgba(0,212,255,0.12)"><div style="font-size:11px;color:var(--text2)">\ud83d\udcb5 Direct cash</div><span style="font-family:\'Barlow Condensed\',sans-serif;font-size:13px;font-weight:700;color:var(--green)">'+fmtMoney(cashPaid)+'</span></div>':'')
        +offsetRows
        +'<div style="display:flex;justify-content:space-between;align-items:center;padding-top:6px"><span style="font-size:11px;font-weight:600;color:var(--text2)">Total paid</span><span style="font-family:\'Bebas Neue\',sans-serif;font-size:18px;color:var(--green)">'+fmtMoney(currentPaid)+'</span></div>'
      +'</div>'
      :'')
    +(hasLegacyOffset
      ?'<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.25);border-radius:var(--radius2);padding:10px 12px;margin-bottom:12px">'
        +'<div style="font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:var(--primary);font-family:\'Barlow Condensed\',sans-serif;margin-bottom:6px">\ud83d\udcb3 Payment Source</div>'
        +'<div style="font-size:12px;color:var(--text2)">\u21a9 Offset from <strong style="color:var(--primary)">'+esc(legacyPayerName)+'</strong></div>'
        +'<div style="font-size:10px;color:var(--text3);margin-top:3px">Amount: <span style="color:var(--primary);font-family:\'Barlow Condensed\',sans-serif;font-weight:700">'+fmtMoney(currentPaid)+'</span></div>'
      +'</div>'
      :'')
    +(!hasOffset&&!hasLegacyOffset&&currentPaid>0.005
      ?'<div style="background:var(--surface2);border:1px solid var(--border);border-radius:var(--radius2);padding:8px 12px;margin-bottom:12px"><div style="font-size:10px;color:var(--text3)">\ud83d\udcb5 Direct cash: <span style="color:var(--green);font-weight:600">'+fmtMoney(currentPaid)+'</span></div></div>'
      :'')
    +'<div class="form-group"><label class="form-label">Amount Paid (AED)</label>'
      +'<input type="number" class="form-input" id="ppAmt" value="'+currentPaid.toFixed(2)+'" min="0" step="0.01" inputmode="decimal"/></div>'
    +'<div class="form-group"><label class="form-label">Custom Due Amount (override, optional)</label>'
      +'<input type="number" class="form-input" id="ppDue" value="'+due.toFixed(2)+'" min="0" step="0.01" inputmode="decimal"/></div>'
    +'<div class="modal-footer" style="margin-top:0;padding-bottom:0">'
      +(due?'<button class="btn btn-green btn-sm" onclick="document.getElementById(\'ppAmt\').value=\''+due.toFixed(2)+'\'">Full</button>':'')
      +'<button class="btn btn-ghost" onclick="closeModal(\'payModal\');document.getElementById(\'payModal\').classList.remove(\'elevated\')">Cancel</button>'
      +'<button class="btn btn-primary" onclick="saveProjectPayment(\''+pid+'\',\''+mid+'\')">Save</button>'
    +'</div>';

  // Elevate payModal above detailModal (detailModal stays open behind)
  document.getElementById('payModal').classList.add('elevated');
  openModal('payModal');
};

window.saveProjectPayment = async function(pid,mid){
  const amt=parseFloat(document.getElementById('ppAmt').value)||0;
  const due=parseFloat(document.getElementById('ppDue').value)||0;
  const p=STATE.projects.find(x=>x.id===pid);if(!p)return;
  const members=[...(p.members||[])];
  const idx=members.findIndex(m=>m.memberId===mid);
  if(idx>=0) members[idx]={...members[idx],amountPaid:amt,fixedAmount:due,updatedAt:new Date().toISOString()};
  try{
    await updateDoc(doc(db,'projects',pid),{members});
    closeModal('payModal');
    toast('Payment saved!','success');
    showProjectDetail(pid); // refresh detail body
    // detailModal stays open — no need to reopen
  }catch(e){ toast(e.message,'error'); }
};

window.openProjectModal = function(id=null){
  STATE.editingProjectId=id;
  document.getElementById('projModalTitle').textContent=id?'Edit Project':'New Project';
  if(id){
    const p=STATE.projects.find(x=>x.id===id);
    document.getElementById('pfName').value=p.name||'';
    document.getElementById('pfDesc').value=p.description||'';
    document.getElementById('pfDate').value=p.targetDate||'';
    document.getElementById('pfStatus').value=p.status||'active';
    document.getElementById('pfFixed').value=p.fixedAmount||'';
    document.getElementById('pfTotal').value=p.totalCost||'';
    const sel=new Set((p.members||[]).map(m=>m.memberId));
    document.getElementById('pfMembers').innerHTML=STATE.members.map(m=>`<div class="chip ${sel.has(m.id)?'on':''}" data-id="${m.id}" onclick="this.classList.toggle('on')">${esc(m.nickname||m.name.split(' ')[0])}</div>`).join('');
  } else {
    ['pfName','pfDesc','pfFixed','pfTotal'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('pfDate').value='';document.getElementById('pfStatus').value='active';
    document.getElementById('pfMembers').innerHTML=STATE.members.map(m=>`<div class="chip on" data-id="${m.id}" onclick="this.classList.toggle('on')">${esc(m.nickname||m.name.split(' ')[0])}</div>`).join('');
  }
  openModal('projectModal');
};
window.projSelectAll = function(sel){ document.querySelectorAll('#pfMembers .chip').forEach(c=>sel?c.classList.add('on'):c.classList.remove('on')); };

window.saveProject = async function(){
  const name=document.getElementById('pfName').value.trim();
  if(!name){ toast('Name required','error'); return; }
  const selectedIds=[...document.querySelectorAll('#pfMembers .chip.on')].map(c=>c.dataset.id);
  const fixedAmt=parseFloat(document.getElementById('pfFixed').value)||0;
  const p=STATE.editingProjectId?STATE.projects.find(x=>x.id===STATE.editingProjectId):null;
  const existing=p?(p.members||[]):[];
  const members=selectedIds.map(mid=>{ const ex=existing.find(m=>m.memberId===mid); return ex||{memberId:mid,amountPaid:0,fixedAmount:fixedAmt}; });
  const data={name,description:document.getElementById('pfDesc').value.trim(),targetDate:document.getElementById('pfDate').value,status:document.getElementById('pfStatus').value,fixedAmount:fixedAmt,totalCost:parseFloat(document.getElementById('pfTotal').value)||0,members};
  try{
    if(STATE.editingProjectId){
      await updateDoc(doc(db,'projects',STATE.editingProjectId),data);
      toast('Updated','success');
      closeModal('projectModal');
      showProjectDetail(STATE.editingProjectId);
      openModal('detailModal');
    } else {
      await addDoc(collection(db,'projects'),{...data,createdAt:serverTimestamp()});
      toast('Created!','success');
      closeModal('projectModal');
    }
  }catch(e){ toast(e.message,'error'); }
};

window.deleteProject = function(id,name){
  if(!CONFIGURED){toast('Firebase not configured','error');return;}
  if(!confirm(`Delete "${name}"?`))return;
  deleteDoc(doc(db,'projects',id)).then(()=>{toast('Deleted','success');closeModal('detailModal');}).catch(e=>toast(e.message,'error'));
};



// ═══════════════════════════════════════
// MODULE: history.js
// ═══════════════════════════════════════
// ============ HISTORY ============
function renderHistory(el){
  el.innerHTML=`
    <div class="sec-header">
      <div><div class="sec-title">History</div><div class="sec-sub">${STATE.sessions.length} sessions</div></div>
    </div>
    ${STATE.sessions.length ? STATE.sessions.map(s=>renderHistoryCard(s)).join('') :
      '<div class="empty"><div class="empty-icon">▣</div><div class="empty-text">No sessions yet.</div></div>'}
  `;
}

function renderHistoryCard(s){
  const att=s.attendees||[];const payments=s.payments||[];
  const expenses=s.expenses||[];
  const totalExp=expenses.reduce((sum,e)=>sum+(parseFloat(e.amount)||0),0);
  const perHead=parseFloat(s.perHead)||(att.length>0?totalExp/att.length:0);
  const totalPaid=payments.reduce((sum,p)=>sum+(parseFloat(p.amountPaid)||0),0);
  const matches=(s.matches||[]).filter(m=>m.result);

  // Build expense payer totals for history badge logic
  const expPayerTotals={};
  expenses.forEach(e=>{ if(e.paidBy) expPayerTotals[e.paidBy]=(expPayerTotals[e.paidBy]||0)+(parseFloat(e.amount)||0); });

  return `<div class="card" style="margin-bottom:12px">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px">${fmtDate(s.date)}</div>
        <div style="font-size:11px;color:var(--text3);font-family:'Barlow Condensed',sans-serif">${esc(s.venue||'No venue')}${s.notes?' · '+esc(s.notes):''}</div>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">
        <span class="badge badge-primary">▣ ${att.length}</span>
        ${perHead?`<span class="badge badge-gold">${fmtMoney(perHead)}/head</span>`:''}
        ${matches.length?`<span class="badge badge-ghost">▶ ${matches.length}</span>`:''}
        ${canAdmin()?`<button class="btn btn-red btn-xs" style="margin-left:4px" onclick="deleteSession('${s.id}','${esc(fmtDate(s.date))}')">✕</button>`:''}
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Player</th><th>Skill</th>
          ${perHead?'<th>Paid</th><th>Status</th>':''}
          ${matches.length?'<th>W/L</th><th>▲kcal</th>':''}
        </tr></thead>
        <tbody>
        ${STATE.members.filter(m=>att.includes(m.id)).map(m=>{
          const pay=payments.find(p=>p.memberId===m.id);
          const paid=pay?parseFloat(pay.amountPaid)||0:0;
          const expPaid=expPayerTotals[m.id]||0;
          // Per-member share from expenses (respecting includedPlayers)
          const myShare=perHead?(()=>{
            if(!expenses.length)return perHead;
            const fs=expenses.reduce((sum,e)=>{
              const amt=parseFloat(e.amount)||0;if(!amt)return sum;
              const incl=e.includedPlayers&&e.includedPlayers.length>0?e.includedPlayers:att;
      return fs; // 0 if excluded from all expenses
          })():0;
          const isExpPayer=expPaid>0&&expPaid>myShare;
          const owed=isExpPayer?0:Math.max(0,myShare-expPaid);
          const balH=owed-paid;
          let status='';
          if(perHead){
            if(isExpPayer) status='<span class="badge badge-primary">Paid Exp</span>';
            else if(balH<0.005&&(owed>0||paid>0)) status='<span class="badge badge-green">Paid</span>';
            else if(balH<0.005&&owed<=0.005&&paid<=0.005) status='<span class="badge badge-green">Paid</span>'; // carry-credit covered
            else if(paid>0) status='<span class="badge badge-gold">Part</span>';
            else if(owed>0) status='<span class="badge badge-red">Unpaid</span>';
            else status='<span class="badge badge-ghost">—</span>';
          }
          const wins=matches.filter(mx=>((mx.result==='teamA'?mx.team1:mx.result==='teamB'?mx.team2:[])||[]).includes(m.id)).length;
          const losses=matches.filter(mx=>((mx.result==='teamA'?mx.team2:mx.result==='teamB'?mx.team1:[])||[]).includes(m.id)).length;
          const matchesPlayed=matches.filter(mx=>(mx.team1||[]).concat(mx.team2||[]).includes(m.id)).length;
          const cal=calcCalories(m.weight||65,matchesPlayed);
          return `<tr>
            <td><div style="display:flex;align-items:center;gap:5px">
              <div class="m-avatar" style="width:22px;height:22px;font-size:9px;background:${avatarColor(m.name)}22;color:${avatarColor(m.name)}">${initials(m.name)}</div>
              ${esc(m.nickname||m.name.split(' ')[0])}
            </div></td>
            <td>${skillBadge(m.skill||'Beginner')}</td>
            ${perHead?`<td style="font-family:'Barlow Condensed',sans-serif;font-size:11px">${isExpPayer?'<span style="color:var(--primary)">Exp Payer</span>':fmtMoney(paid)}</td><td>${status}</td>`:''}
            ${matches.length?`<td style="font-size:11px"><span style="color:var(--green)">${wins}W</span> <span style="color:var(--red)">${losses}L</span></td><td style="font-size:11px;color:var(--orange);font-family:'Barlow Condensed',sans-serif">${cal}</td>`:''}
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="showSessionDetail('${s.id}')">Full Details →</button>
  </div>`;
}

window.showSessionDetail = function(sid){
  const s=STATE.sessions.find(x=>x.id===sid);if(!s)return;
  document.getElementById('detailModalBody').innerHTML=`
    <div class="modal-header">
      <div class="modal-title">${fmtDate(s.date)}</div>
      <button class="modal-close" onclick="closeModal('detailModal')">✕</button>
    </div>
    <div style="font-size:11px;color:var(--text3);margin-bottom:12px">${esc(s.venue||'—')}${s.notes?' · '+esc(s.notes):''}</div>
    <div class="card-title">Attendees (${(s.attendees||[]).length})</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
      ${(s.attendees||[]).map(aid=>{const m=STATE.members.find(x=>x.id===aid);const nm=m?m.name:'?';
        return `<div style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);padding:4px 8px;border-radius:99px;font-size:11px;border:1px solid var(--border)">
          <div style="width:18px;height:18px;border-radius:50%;background:${avatarColor(nm)}22;color:${avatarColor(nm)};display:flex;align-items:center;justify-content:center;font-size:8px;font-family:'Bebas Neue',sans-serif">${initials(nm)}</div>
          ${esc(m?.nickname||nm.split(' ')[0])} ${skillBadge(m?.skill||'Beginner')}
        </div>`;}).join('')}
    </div>
    ${(s.matches||[]).filter(m=>m.result).length?`
    <div class="card-title">Match Results</div>
    ${(s.matches||[]).filter(m=>m.result).map(m=>{
      const t1n=(m.team1||[]).map(id=>{const p=STATE.members.find(x=>x.id===id);return p?.nickname||p?.name?.split(' ')[0]||'?';}).join(' & ');
      const t2n=(m.team2||[]).map(id=>{const p=STATE.members.find(x=>x.id===id);return p?.nickname||p?.name?.split(' ')[0]||'?';}).join(' & ');
      const wA=m.result==='teamA',wB=m.result==='teamB';
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap">
        <span style="font-family:'Bebas Neue',sans-serif;color:var(--text3);width:22px">#${m.matchNum}</span>
        ${m.matchType==='advanced'?'<span class="badge badge-adv" style="font-size:9px">⚡</span>':''}
        <span style="${wA?'color:var(--green);font-weight:700':''}">${esc(t1n)}</span>
        <span style="color:var(--gold);font-family:'Bebas Neue',sans-serif">VS</span>
        <span style="${wB?'color:var(--green);font-weight:700':''}">${esc(t2n)}</span>
        <span class="badge ${m.result==='draw'?'badge-ghost':'badge-green'}" style="margin-left:auto;font-size:9px">${m.result==='draw'?'Draw':wA?'A Wins':'B Wins'}</span>
      </div>`;}).join('')}
    `:''}
    ${(s.expenses||[]).length?`
    <div class="card-title" style="margin-top:14px">Expenses</div>
    ${(s.expenses||[]).map(e=>{
      const pb=STATE.members.find(x=>x.id===e.paidBy);
      const incl=e.includedPlayers&&e.includedPlayers.length>0
        ?e.includedPlayers.map(id=>{const mm=STATE.members.find(x=>x.id===id);return mm?esc(mm.nickname||mm.name.split(' ')[0]):'?';}).join(', ')
        :'All';
      return `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <span style="font-weight:600">${EXP_CATS[e.category]||e.category}${e.description?' — '+esc(e.description):''}</span>
          <span style="color:var(--red);font-family:'Barlow Condensed',sans-serif;white-space:nowrap;font-weight:700">${fmtMoney(e.amount)}</span>
        </div>
        <div style="color:var(--text3);font-size:10px;margin-top:2px">
          ${pb?`Paid by: <span style="color:var(--primary)">${esc(pb.nickname||pb.name.split(' ')[0])}</span> · `:''}
          ${e.date?`${fmtDate(e.date)} · `:''}
          Split: ${incl}
        </div>
      </div>`;}).join('')}
    `:''}
    ${canAdmin()?`<hr class="divider"><button class="btn btn-red btn-sm btn-block" onclick="deleteSession('${s.id}','${esc(fmtDate(s.date))}')">✕ Delete This Session</button>`:''}
  `;
  openModal('detailModal');
};

window.deleteSession = async function(sid, label){
  if(!confirm(`Delete session "${label}"?\n\nThis will permanently remove all match results, expenses, and payment records for this session. This cannot be undone.`)) return;
  try{
    await deleteDoc(doc(db,'sessions',sid));
    closeModal('detailModal');
    toast('Session deleted','success');
  }catch(e){ toast(e.message,'error'); }
};



// ═══════════════════════════════════════
// MODULE: settings.js
// ═══════════════════════════════════════
// ============ SETTINGS ============
function renderSettings(el){
  el.innerHTML=`
    <div class="sec-header"><div><div class="sec-title">Settings</div><div class="sec-sub">Super Admin only</div></div></div>
    <div class="grid2">
      <div class="card">
        <div class="card-title">◈ Passcodes</div>
        <div class="form-group"><label class="form-label">Member PIN</label><input class="form-input" id="pageSetPinMember" maxlength="4" value="${STATE.passcodes.member||'1111'}" inputmode="numeric"/></div>
        <div class="form-group"><label class="form-label">Admin PIN</label><input class="form-input" id="pageSetPinAdmin" maxlength="4" value="${STATE.passcodes.admin||'2222'}" inputmode="numeric"/></div>
        <div class="form-group"><label class="form-label">Super Admin PIN</label><input class="form-input" id="pageSetPinSuper" maxlength="4" value="${STATE.passcodes.superadmin||'9999'}" inputmode="numeric"/></div>
        <button class="btn btn-primary btn-block" onclick="saveSettingsPage()">Save Passcodes</button>
      </div>
      <div class="card">
        <div class="card-title">▶ Data</div>
        <div style="font-size:13px;color:var(--text2);line-height:2.2">
          <div>Members: <strong>${STATE.members.length}</strong></div>
          <div>Sessions: <strong>${STATE.sessions.length}</strong></div>
          <div>Projects: <strong>${STATE.projects.length}</strong></div>
          <div>Matches: <strong>${STATE.sessions.reduce((s,x)=>s+((x.matches||[]).filter(m=>m.result).length),0)}</strong></div>
        </div>
      </div>
    </div>
  `;
}

window.saveSettings = async function(){
  const m=document.getElementById('setPinMember')?.value||'1111';
  const a=document.getElementById('setPinAdmin')?.value||'2222';
  const s=document.getElementById('setPinSuper')?.value||'9999';
  if([m,a,s].some(p=>p.length!==4||isNaN(parseInt(p)))){ toast('4-digit PINs required','error'); return; }
  try{
    await setDoc(doc(db,'settings','passcodes'),{member:m,admin:a,superadmin:s});
    STATE.passcodes={member:m,admin:a,superadmin:s};
    toast('Passcodes saved!','success');
  }catch(e){ toast(e.message,'error'); }
};

window.saveSettingsPage = async function(){
  const m=document.getElementById('pageSetPinMember')?.value||'1111';
  const a=document.getElementById('pageSetPinAdmin')?.value||'2222';
  const s=document.getElementById('pageSetPinSuper')?.value||'9999';
  if([m,a,s].some(p=>p.length!==4||isNaN(parseInt(p)))){ toast('4-digit PINs required','error'); return; }
  try{
    await setDoc(doc(db,'settings','passcodes'),{member:m,admin:a,superadmin:s});
    STATE.passcodes={member:m,admin:a,superadmin:s};
    toast('Passcodes saved!','success');
  }catch(e){ toast(e.message,'error'); }
};



// ═══════════════════════════════════════
// MODULE: listeners.js
// ═══════════════════════════════════════
// ============ FIREBASE LISTENERS ============
function initListeners(){
  if(!CONFIGURED) return;
  onSnapshot(query(collection(db,'members'),orderBy('name')),snap=>{
    STATE.members=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(STATE.role) refreshCurrentPage();
  });
  onSnapshot(query(collection(db,'sessions'),orderBy('date','desc')),snap=>{
    STATE.sessions=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(STATE.role) refreshCurrentPage();
  });
  onSnapshot(query(collection(db,'projects'),orderBy('createdAt','desc')),snap=>{
    STATE.projects=snap.docs.map(d=>({id:d.id,...d.data()}));
    if(STATE.role) refreshCurrentPage();
  });
  getDoc(doc(db,'settings','passcodes')).then(d=>{
    if(d.exists()) STATE.passcodes={...STATE.passcodes,...d.data()};
  });
}


// initListeners() is called from enterApp()
// ── Expose functions to window for HTML onclick handlers ─────────
window.selectRole       = selectRole;
window.doLogin          = doLogin;
window.doLogout         = doLogout;
window.pinNext          = pinNext;
window.navigateTo       = navigateTo;
window.toggleMoreMenu   = toggleMoreMenu;
window.closeMoreMenu    = closeMoreMenu;
window.openModal        = openModal;
window.closeModal       = closeModal;
window.toast            = toast;
window.STATE            = STATE;

// Page-level functions are already bound via window.X = function(){} declarations above.
