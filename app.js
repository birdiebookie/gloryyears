// Glory Years – archive app
const STATES={AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming'};
const SPORTS={FB:'Football',BB:'Boys Basketball',GBB:'Girls Basketball','Girls Soccer':'Girls Soccer',Soccer:'Soccer',Baseball:'Baseball'};
const HELP_EMAIL='';  // set to your email to turn on "Tell us" links
let SCHOOLS={},GAMES=[],NAME={},BYSCHOOL={};
const $app=document.getElementById('app');
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>n.toLocaleString('en-US');
const sKey=(st,k)=>st+'|'+k;
const schoolLink=(st,k)=>'#/school/'+encodeURIComponent(st)+'/'+encodeURIComponent(k);
const nameOf=(st,k)=>NAME[sKey(st,k)]||k;
const thumb=id=>'https://i.ytimg.com/vi/'+id+'/mqdefault.jpg';

async function load(){
  const [s,g]=await Promise.all([fetch('data/schools.json').then(r=>r.json()),fetch('data/games.json').then(r=>r.json())]);
  SCHOOLS=s;GAMES=g;
  for(const st in SCHOOLS) for(const [k,n] of SCHOOLS[st]) NAME[sKey(st,k)]=n;
  GAMES.forEach((g,i)=>{const [st,k1,ost,k2]=g;
    (BYSCHOOL[sKey(st,k1)] ??= []).push(i);
    if(sKey(ost,k2)!==sKey(st,k1)) (BYSCHOOL[sKey(ost,k2)] ??= []).push(i);});
  route();
}
function stateGames(st){let n=0;for(const g of GAMES) if(g[0]===st||g[2]===st) n++;return n;}

function home(){
  const total=GAMES.length, videos=GAMES.reduce((a,g)=>a+g[8].reduce((b,v)=>b+v.length,0),0);
  const withGames=Object.keys(BYSCHOOL).length;
  const tiles=Object.keys(STATES).sort((a,b)=>STATES[a].localeCompare(STATES[b])).map(st=>{
    const n=stateGames(st);
    return `<a class="state${n?'':' none'}" href="#/state/${st}"><span class="ab">${st}</span>${esc(STATES[st])}<br><span class="n">${n?fmt(n)+' games':'No games yet'}</span></a>`;}).join('');
  $app.innerHTML=`
  <section class="hero">
    <h1>Relive the glory years.</h1>
    <p class="big">Classic high school football and basketball games, filmed in gyms and stadiums across America and saved for good. Find your school, then hit play.</p>
    <div class="stats"><div><b>${fmt(total)}</b>games</div><div><b>${fmt(videos)}</b>videos</div><div><b>${fmt(withGames)}</b>schools with games</div></div>
    <label for="q" class="sub">Search for a school</label>
    <input id="q" class="search" type="search" placeholder="Type a school name, like LaSalle or Tri West" autocomplete="off">
    <ul id="res" class="results" hidden></ul>
  </section>
  <h2>Browse by state</h2>
  <div class="states">${tiles}</div>`;
  const q=document.getElementById('q'),res=document.getElementById('res');
  q.addEventListener('input',()=>{
    const t=q.value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g,'');
    if(t.length<2){res.hidden=true;return;}
    const out=[];
    for(const st in SCHOOLS) for(const [k,n] of SCHOOLS[st]) if(k.includes(t)&&k!=='UNK') out.push([st,k,n,(BYSCHOOL[sKey(st,k)]||[]).length]);
    out.sort((a,b)=>b[3]-a[3]||a[2].localeCompare(b[2]));
    res.innerHTML=out.slice(0,40).map(([st,k,n,c])=>`<li><a href="${schoolLink(st,k)}"><span>${esc(n)}, ${st}</span><span class="count">${c?fmt(c)+' games':''}</span></a></li>`).join('')||'<li><a>No schools found</a></li>';
    res.hidden=false;});
}

function statePage(st){
  if(!STATES[st]&&st!=='??') return notFound();
  const list=(SCHOOLS[st]||[]).map(([k,n])=>[k,n,(BYSCHOOL[sKey(st,k)]||[]).length]);
  const total=stateGames(st), withG=list.filter(x=>x[2]).length;
  $app.innerHTML=`
  <div class="crumbs"><a href="#/">All states</a></div>
  <h1>${esc(STATES[st])}</h1>
  <p class="sub">${fmt(total)} games · ${fmt(list.length)} schools · ${fmt(withG)} with games</p>
  <div class="tools">
    <input id="f" class="search" type="search" placeholder="Filter schools in ${esc(STATES[st])}" autocomplete="off">
    <label class="check"><input id="only" type="checkbox"> Only schools with games</label>
  </div>
  <div id="letters" class="letters"></div>
  <ul id="list" class="schools"></ul>`;
  const f=document.getElementById('f'),only=document.getElementById('only');
  const draw=()=>{
    const t=f.value.trim().toUpperCase().replace(/[^A-Z0-9 ]/g,'');
    const rows=list.filter(([k,,c])=>(!t||k.includes(t))&&(!only.checked||c));
    const seen=new Set();let html='';
    for(const [k,n,c] of rows){
      const L=k==='UNK'?'?':(k[0]||'#');let id='';
      if(!seen.has(L)){seen.add(L);id=` id="L-${L}"`;}
      html+=`<li${id} class="${k==='UNK'?'unk ':''}${c?'':'zero'}"><a href="${schoolLink(st,k)}"><span>${esc(n)}</span><span class="count">${c?fmt(c):'0'}</span></a></li>`;}
    document.getElementById('list').innerHTML=html||'<li class="empty">No schools match.</li>';
    document.getElementById('letters').innerHTML=[...seen].filter(x=>x!=='?').map(L=>`<a href="#" data-l="${L}">${L}</a>`).join('');};
  f.addEventListener('input',draw);only.addEventListener('change',draw);
  document.getElementById('letters').addEventListener('click',e=>{const l=e.target.dataset.l;if(l){e.preventDefault();document.getElementById('L-'+l)?.scrollIntoView();}});
  draw();
}

function gameRow(i,st,k){
  const g=GAMES[i];const [s1,k1,s2,k2,yr,sp,a,b,vers]=g;
  const mine=(s1===st&&k1===k);const [ost,ok]=mine?[s2,k2]:[s1,k1];
  const sc=a&&b?(mine?`${a}–${b}`:`${b}–${a}`):'';
  const parts=vers[0].length;
  return `<li><a href="#/game/${i}"><span class="yr">${yr||'—'}</span><img class="thumb" loading="lazy" alt="" src="${thumb(vers[0][0])}">
  <span><span class="vs">vs ${esc(nameOf(ost,ok))}${ost!==st?', '+ost:''}</span><br><span class="meta">${sp?`<span class="tag">${esc(SPORTS[sp]||sp)}</span>`:''}${parts>1?parts+' parts':'1 video'}${vers.length>1?' · '+vers.length+' versions':''}</span></span>
  <span class="sc">${sc}</span></a></li>`;
}
function schoolPage(st,k){
  const ids=(BYSCHOOL[sKey(st,k)]||[]).slice().sort((x,y)=>(GAMES[y][4]||'0').localeCompare(GAMES[x][4]||'0'));
  const name=nameOf(st,k);
  const sports=[...new Set(ids.map(i=>GAMES[i][5]).filter(Boolean))];
  const unk=k==='UNK';
  $app.innerHTML=`
  <div class="crumbs"><a href="#/">All states</a> › <a href="#/state/${st}">${esc(STATES[st]||'Unknown state')}</a></div>
  <h1>${esc(name)}</h1>
  <p class="sub">${fmt(ids.length)} game${ids.length===1?'':'s'}${unk?' where one school hasn’t been identified yet. Recognize a team? Open the game and tell us.':''}</p>
  ${sports.length>1?`<div class="tabs" id="tabs"><button aria-pressed="true" data-s="">All</button>${sports.map(s=>`<button aria-pressed="false" data-s="${esc(s)}">${esc(SPORTS[s]||s)}</button>`).join('')}</div>`:''}
  <ul class="games" id="g"></ul>
  ${ids.length?'':`<p class="empty">No games for ${esc(name)} yet. Have old game film? It may belong here.</p>`}`;
  const draw=s=>{document.getElementById('g').innerHTML=ids.filter(i=>!s||GAMES[i][5]===s).map(i=>gameRow(i,st,k)).join('');};
  document.getElementById('tabs')?.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    document.querySelectorAll('#tabs button').forEach(x=>x.setAttribute('aria-pressed',x===b));draw(b.dataset.s);});
  draw('');
}

function gamePage(i){
  const g=GAMES[i];if(!g) return notFound();
  const [s1,k1,s2,k2,yr,sp,a,b,vers]=g;
  const n1=nameOf(s1,k1),n2=nameOf(s2,k2);
  const label=(n,len)=>len===4?'Q'+(n+1):'Part '+(n+1);
  $app.innerHTML=`
  <div class="crumbs"><a href="#/">All states</a> › <a href="#/state/${s1}">${esc(STATES[s1]||'Mystery games')}</a></div>
  <h1>${esc(n1)} vs ${esc(n2)}</h1>
  <p class="sub">${[yr,SPORTS[sp]||sp,STATES[s1]].filter(Boolean).map(esc).join(' · ')}</p>
  ${a&&b?`<p class="scoreline">${esc(n1)} ${esc(a)}, ${esc(n2)} ${esc(b)}</p>`:''}
  <div class="player"><iframe id="yt" title="Game video" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>
  ${vers.length>1?`<p class="versions"><label>Version <select id="ver">${vers.map((v,j)=>`<option value="${j}">Version ${j+1} (${v.length} part${v.length>1?'s':''})</option>`).join('')}</select></label></p>`:''}
  <div class="parts" id="parts"></div>
  <div class="teams"><a href="${schoolLink(s1,k1)}">All ${esc(n1)} games</a><a href="${schoolLink(s2,k2)}">All ${esc(n2)} games</a></div>
  ${(k1==='UNK'||k2==='UNK'||s1==='??')?`<div class="help"><h2>Know this ${s1==='??'?'game':'school'}?</h2><p>Part of this game hasn’t been identified. Watch a few minutes. If you spot the uniforms, the gym or the field, let us know.</p>${HELP_EMAIL?`<p><a href="mailto:${HELP_EMAIL}?subject=${encodeURIComponent('Glory Years game #'+i+' identified')}">Tell us who it is</a></p>`:''}</div>`:''}`;
  let v=0;
  const play=(p,auto)=>{document.getElementById('yt').src='https://www.youtube-nocookie.com/embed/'+vers[v][p]+'?rel=0&modestbranding=1'+(auto?'&autoplay=1':'');
    document.querySelectorAll('#parts button').forEach((x,j)=>x.setAttribute('aria-pressed',j===p));};
  const drawParts=()=>{const len=vers[v].length;
    document.getElementById('parts').innerHTML=len>1?vers[v].map((_,j)=>`<button data-p="${j}" aria-pressed="false">${label(j,len)}</button>`).join(''):'';play(0,false);};
  document.getElementById('parts').addEventListener('click',e=>{const b=e.target.closest('button');if(b) play(+b.dataset.p,true);});
  document.getElementById('ver')?.addEventListener('change',e=>{v=+e.target.value;drawParts();});
  drawParts();
}

function mystery(){
  const ids=GAMES.map((g,i)=>i).filter(i=>GAMES[i][0]==='??'||GAMES[i][1]==='UNK'&&GAMES[i][3]==='UNK');
  $app.innerHTML=`<h1>Mystery Games</h1><p class="sub">${fmt(ids.length)} games we can’t place yet. No state, no schools, just football and basketball. Can you solve one?</p><ul class="games">${ids.map(i=>gameRow(i,'','')).join('')}</ul>`;
}
function notFound(){$app.innerHTML=`<h1>Page not found</h1><p class="sub">That page isn’t in the archive. <a href="#/">Go to all states</a>.</p>`;}

function route(){
  const p=location.hash.replace(/^#\/?/,'').split('/').map(decodeURIComponent);
  window.scrollTo(0,0);
  if(!p[0]) home();
  else if(p[0]==='state') statePage(p[1]);
  else if(p[0]==='school') schoolPage(p[1],p[2]);
  else if(p[0]==='game') gamePage(+p[1]);
  else if(p[0]==='mystery') mystery();
  else notFound();
  const h=document.querySelector('h1'); if(h) document.title=h.textContent+' – Glory Years';
}
addEventListener('hashchange',route);
load().catch(()=>{$app.innerHTML='<h1>Couldn’t load the archive</h1><p class="sub">Refresh the page to try again.</p>';});
