const CATS={Personal:'#c2693f',Work:'#4f7cac',Ideas:'#c9a227',Study:'#5b9a6e',Journal:'#9a6fb0'};
const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={
  get(k,d){try{const v=localStorage.getItem(k);return v?JSON.parse(v):d}catch(e){return d}},
  set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
let mem={}; // fallback if storage is unavailable
const S={user:null,notes:[],cat:'All',q:'',mode:'login',err:'',editing:null,confirmId:null};

async function hash(p){
  try{const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('eno:'+p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  catch(e){return btoa(p)}
}
const users=()=>store.get('eno_users',mem.users||{});
const saveUsers=u=>{mem.users=u;store.set('eno_users',u)};
const saveNotes=()=>store.set('eno_notes_'+S.user.email,S.notes);

function boot(){
  const em=store.get('eno_session',null);
  const u=em&&users()[em];
  if(u){S.user={email:em,name:u.name};S.notes=store.get('eno_notes_'+em,[])}
  render();
}
async function auth(e){
  e.preventDefault();
  const f=new FormData(e.target),email=f.get('email').trim().toLowerCase(),pw=f.get('pw'),name=(f.get('name')||'').trim();
  const all=users(),h=await hash(pw);
  if(S.mode==='signup'){
    if(!name||!email||pw.length<6){S.err='Add your name, an email, and a password of 6+ characters.';return render()}
    if(all[email]){S.err='An account with that email already exists.';return render()}
    all[email]={name,hash:h};saveUsers(all);
  }else if(!all[email]||all[email].hash!==h){S.err='Email or password doesn’t match.';return render()}
  S.err='';S.user={email,name:all[email].name};store.set('eno_session',email);
  S.notes=store.get('eno_notes_'+email,[]);
  if(S.mode==='signup'&&!S.notes.length){
    S.notes=[{id:Date.now(),title:'Welcome to your notebook',cat:'Journal',body:'Create notes, sort them into categories, and find them fast with search. Everything is saved on this device.',updated:Date.now()}];saveNotes();
  }
  render();
}
function logout(){store.set('eno_session',null);S.user=null;S.notes=[];S.cat='All';S.q='';render()}

function saveNote(e){
  e.preventDefault();
  const f=new FormData(e.target),title=f.get('title').trim(),body=f.get('body').trim();
  if(!title&&!body)return;
  const n={title:title||'Untitled',cat:f.get('cat'),body,updated:Date.now()};
  if(S.editing==='new')S.notes.unshift({id:Date.now(),...n});
  else S.notes=S.notes.map(x=>x.id===S.editing?{...x,...n}:x);
  saveNotes();S.editing=null;render();
}
function del(id){S.notes=S.notes.filter(n=>n.id!==id);S.confirmId=null;saveNotes();render()}

function authView(){
  const su=S.mode==='signup';
  return `<main class="min-h-screen flex items-center justify-center p-5">
  <div class="card w-full max-w-md p-8 rise">
    <div class="text-center mb-7">
      <div class="serif text-4xl mb-1">Elegant Notes</div>
      <p class="muted text-sm">A quiet place for your thoughts.</p>
    </div>
    <div class="tabs">
      <button class="tab ${!su?'on':''}" data-mode="login">Log in</button>
      <button class="tab ${su?'on':''}" data-mode="signup">Sign up</button>
    </div>
    <form id="authForm" class="space-y-3" autocomplete="on">
      ${su?'<input class="field" name="name" placeholder="Your name" autocomplete="name">':''}
      <input class="field" type="email" name="email" placeholder="Email" required autocomplete="email">
      <input class="field" type="password" name="pw" placeholder="Password" required autocomplete="${su?'new-password':'current-password'}">
      ${S.err?`<p class="text-sm pop" style="color:#c0463a">${esc(S.err)}</p>`:''}
      <button class="btn w-full mt-2" type="submit">${su?'Create account':'Welcome back'}</button>
    </form>
    <p class="muted text-xs text-center mt-5">Accounts are stored locally in this browser.</p>
  </div></main>`;
}

function filtered(){
  const q=S.q.toLowerCase();
  return S.notes.filter(n=>(S.cat==='All'||n.cat===S.cat)&&(!q||n.title.toLowerCase().includes(q)||n.body.toLowerCase().includes(q)));
}
function dashView(){
  const list=filtered();
  const count=c=>c==='All'?S.notes.length:S.notes.filter(n=>n.cat===c).length;
  const chips=['All',...Object.keys(CATS)].map(c=>`<button class="chip ${S.cat===c?'on':''}" data-cat="${c}">
    <span class="dot" style="background:${c==='All'?'var(--muted)':CATS[c]}"></span><span class="flex-1">${c}</span><span class="text-xs">${count(c)}</span></button>`).join('');
  const cards=list.map((n,i)=>`<article class="card note p-5 rise" style="animation-delay:${Math.min(i,8)*40}ms">
    <div class="flex items-center justify-between mb-3">
      <span class="flex items-center gap-2 text-xs font-semibold muted"><span class="dot" style="background:${CATS[n.cat]||'var(--muted)'}"></span>${esc(n.cat)}</span>
      <span class="text-xs muted">${new Date(n.updated).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</span>
    </div>
    <h3 class="serif text-xl mb-2 leading-snug">${esc(n.title)}</h3>
    <p class="clamp text-sm muted leading-relaxed">${esc(n.body)}</p>
    <div class="flex justify-end gap-1 mt-4">
      ${S.confirmId===n.id
        ?`<span class="text-sm muted self-center mr-1">Delete this note?</span><button class="ghost" data-cancel>Keep</button><button class="ghost" style="color:#c0463a" data-del="${n.id}">Delete</button>`
        :`<button class="ghost text-sm" data-edit="${n.id}">Edit</button><button class="ghost text-sm" data-ask="${n.id}">Delete</button>`}
    </div></article>`).join('');
  const empty=`<div class="col-span-full text-center py-20 rise"><div class="serif text-2xl mb-2">${S.notes.length?'Nothing matches':'A blank page'}</div><p class="muted text-sm">${S.notes.length?'Try another search or category.':'Create your first note to get started.'}</p></div>`;
  return `<div class="max-w-6xl mx-auto px-5 py-6">
    <header class="flex items-center justify-between mb-8 rise">
      <div><div class="serif text-2xl">Elegant Notes</div><div class="muted text-sm">Hello, ${esc(S.user.name)}</div></div>
      <div class="flex items-center gap-2"><button class="btn" data-new>＋ New note</button><button class="ghost" data-logout>Log out</button></div>
    </header>
    <div class="grid md:grid-cols-[220px_1fr] gap-6">
      <aside class="rise"><div class="card p-3 space-y-1 md:sticky md:top-6">${chips}</div></aside>
      <section>
        <input id="search" class="field mb-5" placeholder="Search notes…" value="${esc(S.q)}">
        <div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">${list.length?cards:empty}</div>
      </section>
    </div></div>${S.editing?editor():''}`;
}
function editor(){
  const n=S.editing==='new'?{title:'',body:'',cat:S.cat==='All'?'Personal':S.cat}:S.notes.find(x=>x.id===S.editing);
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4 fade" style="background:rgba(20,14,10,.5);backdrop-filter:blur(4px)" data-backdrop>
    <form id="noteForm" class="card w-full max-w-xl p-6 pop">
      <div class="flex items-center justify-between mb-4"><h2 class="serif text-2xl">${S.editing==='new'?'New note':'Edit note'}</h2>
      <button type="button" class="ghost" data-close aria-label="Close">✕</button></div>
      <input class="field serif text-lg mb-3" name="title" placeholder="Title" value="${esc(n.title)}" autofocus>
      <select class="field mb-3" name="cat" style="background:var(--surface)">${Object.keys(CATS).map(c=>`<option ${c===n.cat?'selected':''}>${c}</option>`).join('')}</select>
      <textarea class="field mb-4" name="body" rows="8" placeholder="Write something…" style="resize:vertical">${esc(n.body)}</textarea>
      <div class="flex justify-end gap-2"><button type="button" class="ghost" data-close>Cancel</button><button class="btn" type="submit">Save note</button></div>
    </form></div>`;
}

function render(){
  const focus=document.activeElement&&document.activeElement.id==='search';
  const pos=focus?document.activeElement.selectionStart:0;
  $('#app').innerHTML=S.user?dashView():authView();
  if(focus){const s=$('#search');s.focus();s.setSelectionRange(pos,pos)}
}

document.addEventListener('click',e=>{
  const t=e.target.closest('[data-mode],[data-cat],[data-new],[data-edit],[data-ask],[data-del],[data-cancel],[data-close],[data-logout]');
  if(e.target.matches('[data-backdrop]')){S.editing=null;return render()}
  if(!t)return;
  const d=t.dataset;
  if(d.mode){S.mode=d.mode;S.err=''}
  else if(d.cat)S.cat=d.cat;
  else if('new' in d)S.editing='new';
  else if(d.edit)S.editing=+d.edit;
  else if(d.ask)S.confirmId=+d.ask;
  else if(d.del)return del(+d.del);
  else if('cancel' in d)S.confirmId=null;
  else if('close' in d)S.editing=null;
  else if('logout' in d)return logout();
  render();
});
document.addEventListener('submit',e=>{
  if(e.target.id==='authForm')auth(e);
  else if(e.target.id==='noteForm')saveNote(e);
});
document.addEventListener('input',e=>{if(e.target.id==='search'){S.q=e.target.value;render()}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.editing){S.editing=null;render()}});
boot();