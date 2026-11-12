/* Орбита: service worker. Offline cache for the app files + gentle "come back and play" reminders. */
const CACHE='orbita-v1';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','badge-96.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('orbita-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
// network first, so updates arrive right away; the cache keeps the game working offline
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==location.origin)return;
  e.respondWith(fetch(req).then(r=>{if(r.ok){const cp=r.clone();caches.open(CACHE).then(c=>c.put(req,cp))}return r}).catch(()=>caches.match(req).then(r=>r||caches.match('index.html'))));
});
const MESSAGES=[
  ['Твой корабль заждался 🚀','Двигатели прогреты, туннель открыт. Полетели?'],
  ['Басы скучают без тебя','В туннеле слишком тихо. Поймай пару басов!'],
  ['Пилот, ты где?','Астероиды уже думают, что победили. Докажи им обратное.'],
  ['В ангаре ждут улучшения','Пара полётов, и корабль станет быстрее и прочнее.'],
  ['Три звезды ещё свободны','Рекорд на «Сложно» сам себя не поставит.'],
  ['Туннель снова открыт','Медиатека ждёт: выбери трек, который ещё не проходил.'],
];
const DAY=24*3600*1000,stateKey=n=>new URL(n,self.registration.scope).href;
async function remind(){
  const c=await caches.open('orbita-state');
  const num=async k=>{const r=await c.match(stateKey(k));return r?+(await r.text())||0:0};
  const now=Date.now();if(now-await num('__last-play')<DAY*.8||now-await num('__last-remind')<DAY*.8)return; // only if they have not played or been reminded today
  const[title,body]=MESSAGES[Math.floor(Math.random()*MESSAGES.length)];
  await self.registration.showNotification(title,{body,icon:'icon-192.png',badge:'badge-96.png',tag:'orbita-remind',data:{url:'./'}});
  await c.put(stateKey('__last-remind'),new Response(String(now)));
}
// Android Chrome, installed app: the phone wakes this up in the background, about once a day
self.addEventListener('periodicsync',e=>{if(e.tag==='orbita-remind')e.waitUntil(remind())});
// Push from a server (needed for iPhone). Payload: {"title":"…","body":"…"}; without a payload a random reminder is shown.
self.addEventListener('push',e=>{
  let d=null;try{d=e.data&&e.data.json()}catch(_){}
  const[t,b]=d&&d.title?[d.title,d.body||'']:MESSAGES[Math.floor(Math.random()*MESSAGES.length)];
  e.waitUntil(self.registration.showNotification(t,{body:b,icon:'icon-192.png',badge:'badge-96.png',tag:'orbita-remind',data:{url:'./'}}));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus' in w)return w.focus()}return self.clients.openWindow('./')}));
});
