const SITE='rajatkbanerjee07gmailcom-ojuie.wordpress.com';
const API=`https://public-api.wordpress.com/rest/v1.1/sites/${SITE}`;
const FOLLOW=`https://wordpress.com/reader/feeds/lookup?url=https://${SITE}`;
const app=document.getElementById('app');
const st={cat:'',q:'',page:1,posts:[],found:0};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const strip=h=>{const d=document.createElement('div');d.innerHTML=h;return d.textContent||''};
const fmt=d=>new Date(d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
const mins=p=>Math.max(1,Math.round(strip(p.content||p.excerpt).split(/\s+/).length/220));
function img(p){
  if(p.featured_image)return p.featured_image;
  if(p.post_thumbnail&&p.post_thumbnail.URL)return p.post_thumbnail.URL;
  const atts=p.attachments?(Array.isArray(p.attachments)?p.attachments:Object.values(p.attachments)):[];
  const images=atts.filter(a=>a&&a.URL&&(!a.mime_type||String(a.mime_type).startsWith('image/')));
  const byId={};images.forEach(a=>{byId[String(a.ID)]=a.URL});
  const tag=(p.content||'').match(/<img\b[^>]*>/i);
  if(tag){
    const id=(tag[0].match(/data-attachment-id=["'](\d+)["']/i)||[])[1];
    if(id&&byId[id])return byId[id];
    const src=(tag[0].match(/\bsrc=["']([^"']+)["']/i)||[])[1];
    if(src){
      const bare=src.split('?')[0];
      const hit=images.find(a=>a.URL===bare||src.startsWith(a.URL));
      return hit?hit.URL:src;
    }
  }
  return images.length?images[0].URL:'';
}
const thumb=u=>u+(u.includes('?')?'&':'?')+'w=200';
const get=u=>fetch(u).then(r=>{if(!r.ok)throw r.status;return r.json()});
// theme
const th=localStorage.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
document.documentElement.classList.toggle('dark',th==='dark');
document.getElementById('theme').onclick=()=>{const d=document.documentElement.classList.toggle('dark');localStorage.theme=d?'dark':'light'};
const subBox=()=>`<div class="cta"><h3 style="font-family:Georgia,serif;margin-top:0">Enjoyed this?</h3><p class="muted">Get new essays on history & geopolitics in your inbox.</p><a class="sub" href="${FOLLOW}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block">Subscribe for free</a></div>`;

async function home(){
  app.innerHTML=`<section class="hero"><h1>The Monk Who Loved History</h1><p>History, Geopolitics &amp; Global Faultlines in the 21st Century</p></section>
  <div class="tools"><input id="q" type="search" placeholder="Search posts…" value="${esc(st.q)}"><div class="chips" id="chips"></div></div><div id="list"><p class="muted">Loading posts…</p></div>`;
  const q=document.getElementById('q');let t;q.oninput=()=>{clearTimeout(t);t=setTimeout(()=>{st.q=q.value;load(true)},350)};
  get(`${API}/categories?number=100`).then(d=>{
    const cats=d.categories.filter(c=>c.post_count>0).sort((a,b)=>b.post_count-a.post_count);
    const ch=document.getElementById('chips');if(!ch)return;
    ch.innerHTML=[{slug:'',name:'All'},...cats].map(c=>`<button class="chip ${c.slug===st.cat?'on':''}" data-s="${c.slug}">${c.name}</button>`).join('');
    ch.onclick=e=>{const s=e.target.dataset.s;if(s===undefined)return;st.cat=s;ch.querySelectorAll('.chip').forEach(b=>b.classList.toggle('on',b.dataset.s===s));load(true)};
  }).catch(()=>{});
  load(true);
}
async function load(reset){
  if(reset){st.page=1;st.posts=[]}
  const p=new URLSearchParams({number:10,page:st.page,fields:'ID,slug,title,date,excerpt,featured_image,post_thumbnail,attachments,content'});
  if(st.cat)p.set('category',st.cat);if(st.q)p.set('search',st.q);
  const list=document.getElementById('list');
  try{const d=await get(`${API}/posts/?${p}`);st.posts.push(...d.posts);st.found=d.found}
  catch(e){list.innerHTML='<p class="muted">Could not load posts. You may be offline.</p>';return}
  if(!document.getElementById('list'))return;
  list.innerHTML=st.posts.length?st.posts.map(x=>`<a class="card" href="#/post/${x.ID}"><div class="t"><h2>${x.title}</h2><p>${esc(strip(x.excerpt))}</p><div class="meta">${fmt(x.date)} · ${mins(x)} min read</div></div>${img(x)?`<img loading="lazy" src="${esc(thumb(img(x)))}" alt="">`:''}</a>`).join(''):'<p class="muted">No posts found.</p>';
  if(st.posts.length<st.found){const b=document.createElement('button');b.className='more';b.textContent='Load more';b.onclick=()=>{st.page++;load()};list.append(b)}
}
async function post(id){
  app.innerHTML='<p class="muted">Loading…</p>';window.scrollTo(0,0);
  try{const p=await get(`${API}/posts/${id}`);
    document.title=strip(p.title)+' – The Monk Who Loved History';
    app.innerHTML=`<a class="back" href="#/">← All posts</a><article><h1>${p.title}</h1><div class="meta">Rajat Banerjee · ${fmt(p.date)} · ${mins(p)} min read</div>${img(p)?`<img class="cover" src="${esc(img(p))}" alt="">`:''}<div class="body">${p.content}</div></article>${subBox()}<p><a class="back" href="${p.URL}" target="_blank">View on WordPress ↗</a></p>`;
  }catch(e){app.innerHTML='<p class="muted">Could not load this post. You may be offline.</p><a href="#/">Back</a>'}
}
function about(){
  document.title='About – The Monk Who Loved History';
  app.innerHTML=`<article><h1>About</h1><div class="body">
  <p><strong>The Monk Who Loved History</strong> is the work of Rajat Banerjee, writing on history, geopolitics and the global faultlines shaping the 21st century, from the Türkiye Files and India &amp; World War 1 to Durga Puja as resistance and the Great Trigonometrical Survey.</p>
  <h3>Services</h3><ul><li>Historical research &amp; fact-checking</li><li>Long-form writing and essays on history &amp; geopolitics</li><li>Scripts and storytelling for video / YouTube</li><li>Talks, collaborations and guest posts</li></ul>
  <h3>Contact</h3><p>Email: <a href="mailto:rajatkbanerjee07@gmail.com">rajatkbanerjee07@gmail.com</a></p>
  <p>Blog: <a href="https://${SITE}/" target="_blank">${SITE}</a></p></div></article>${subBox()}`;
}
function route(){const h=location.hash;let m;
  if(m=h.match(/^#\/post\/(\d+)/))post(m[1]);else if(h==='#/about')about();else{document.title='The Monk Who Loved History';home()}}
addEventListener('hashchange',route);route();
if('serviceWorker'in navigator)navigator.serviceWorker.register('/monk-reader/sw.js',{scope:'/monk-reader/'});
