
const $=id=>document.getElementById(id);
const KEY="pvault.v2";
let state={positions:[],movements:[],snapshots:[]}, sessionKey=null;

const euro=n=>new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(Number(n)||0);
const pct=n=>(Number(n)||0).toFixed(1)+"%";
const uid=()=>crypto.randomUUID();
const categories=["PAC / ETF","Obbligazioni","Crowdfunding","Azioni","Crypto","Liquidità","Altro"];
const movementTypes=["Versamento","Prelievo","Cedola","Dividendo","Interesse","Rimborso"];

async function derive(pin,salt){
 const enc=new TextEncoder();
 const base=await crypto.subtle.importKey("raw",enc.encode(pin),"PBKDF2",false,["deriveKey"]);
 return crypto.subtle.deriveKey({name:"PBKDF2",salt,iterations:250000,hash:"SHA-256"},base,{name:"AES-GCM",length:256},false,["encrypt","decrypt"]);
}
function b64(a){return btoa(String.fromCharCode(...new Uint8Array(a)))}
function unb64(s){return Uint8Array.from(atob(s),c=>c.charCodeAt(0))}
async function encryptData(obj,key){
 const iv=crypto.getRandomValues(new Uint8Array(12)), data=new TextEncoder().encode(JSON.stringify(obj));
 const ct=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data);
 return {iv:b64(iv),data:b64(ct)}
}
async function decryptData(blob,key){
 const pt=await crypto.subtle.decrypt({name:"AES-GCM",iv:unb64(blob.iv)},key,unb64(blob.data));
 return JSON.parse(new TextDecoder().decode(pt));
}
async function save(){
 const salt=unb64(localStorage.getItem("pvault.salt"));
 const blob=await encryptData(state,sessionKey);
 localStorage.setItem(KEY,JSON.stringify(blob));
}
function showApp(){ $("lock").style.display="none";$("app").style.display="block";$("nav").style.display="flex";renderAll() }
function lock(){ sessionKey=null; state={positions:[],movements:[],snapshots:[]}; $("app").style.display="none";$("nav").style.display="none";$("lock").style.display="flex";$("pin").value=""}
$("unlock").onclick=async()=>{
 const pin=$("pin").value;
 if(pin.length<6){alert("Usa almeno 6 cifre.");return}
 let salt=localStorage.getItem("pvault.salt");
 try{
  if(!salt){
   const s=crypto.getRandomValues(new Uint8Array(16));salt=b64(s);localStorage.setItem("pvault.salt",salt);
   sessionKey=await derive(pin,s);
   await save(); showApp(); return;
  }
  sessionKey=await derive(pin,unb64(salt));
  const stored=localStorage.getItem(KEY);
  if(stored) state=await decryptData(JSON.parse(stored),sessionKey);
  else await save();
  showApp();
 }catch(e){sessionKey=null;alert("PIN errato o vault non leggibile.")}
};
$("lockBtn").onclick=lock;
document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));$(b.dataset.v).classList.add("active");document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));b.classList.add("active");renderAll()});

function totals(){const total=state.positions.reduce((a,p)=>a+p.qty*p.price,0), invested=state.positions.reduce((a,p)=>a+p.qty*p.cost,0), pl=total-invested, income=state.movements.filter(m=>["Cedola","Dividendo","Interesse"].includes(m.type)).reduce((a,m)=>a+m.amount,0);return{total,invested,pl,income}}
function renderDashboard(){
 const t=totals();$("total").textContent=euro(t.total);$("invested").textContent=euro(t.invested);$("pl").textContent=euro(t.pl);$("income").textContent=euro(t.income);$("count").textContent=state.positions.length;
 $("profit").innerHTML=`<span class="${t.pl>=0?"positive":"negative"}">${t.invested?((t.pl/t.invested)*100).toFixed(2):"0.00"}% rispetto al capitale inserito</span>`;
 const map={};state.positions.forEach(p=>map[p.cat]=(map[p.cat]||0)+p.qty*p.price);
 $("allocation").innerHTML=Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div style="margin:12px 0"><div class="row"><span>${esc(k)}</span><span>${euro(v)} · ${pct(t.total?v/t.total*100:0)}</span></div><div class="bar"><i style="width:${t.total?Math.min(100,v/t.total*100):0}%"></i></div></div>`).join("")||'<p class="muted">Aggiungi una posizione.</p>';
}
function renderPositions(){
 $("positionList").innerHTML=state.positions.map(p=>`<div class="card listitem"><div class="row"><div><b>${esc(p.name)}</b><div class="muted">${esc(p.cat)}${p.code?" · "+esc(p.code):""}</div></div><button class="secondary" onclick="removePosition('${p.id}')">Elimina</button></div><div style="margin-top:10px">${euro(p.qty*p.price)} <span class="${p.qty*p.price-p.qty*p.cost>=0?"positive":"negative"}">P/L ${euro(p.qty*p.price-p.qty*p.cost)}</span></div><div class="muted" style="font-size:13px;margin-top:5px">Quantità ${p.qty} · Costo medio ${euro(p.cost)}</div></div>`).join("")||'<div class="card muted">Nessuna posizione.</div>';
}
function renderMovements(){
 $("movementList").innerHTML=state.movements.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(m=>`<div class="card listitem"><div class="row"><div><b>${esc(m.type)}</b><div class="muted">${esc(m.asset||"Portafoglio")} · ${new Date(m.date).toLocaleDateString("it-IT")}</div></div><button class="secondary" onclick="removeMovement('${m.id}')">Elimina</button></div><div style="margin-top:8px">${euro(m.amount)}</div>${m.note?`<div class="muted">${esc(m.note)}</div>`:""}</div>`).join("")||'<div class="card muted">Nessun movimento.</div>';
}
function years(){const ys=new Set([...state.movements.map(m=>new Date(m.date).getFullYear()),...state.snapshots.map(s=>new Date(s.date).getFullYear()),new Date().getFullYear()]);return [...ys].sort((a,b)=>b-a)}
function renderYears(){
 const sel=$("yearSelect"), old=Number(sel.value)||new Date().getFullYear();sel.innerHTML=years().map(y=>`<option>${y}</option>`).join("");sel.value=years().includes(old)?old:years()[0];const y=Number(sel.value);
 const m=state.movements.filter(x=>new Date(x.date).getFullYear()===y);
 const sum=t=>m.filter(x=>x.type===t).reduce((a,x)=>a+x.amount,0);
 const income=m.filter(x=>["Cedola","Dividendo","Interesse"].includes(x.type)).reduce((a,x)=>a+x.amount,0);
 const snaps=state.snapshots.filter(x=>new Date(x.date).getFullYear()===y).sort((a,b)=>a.date.localeCompare(b.date));
 const end=snaps.at(-1)?.value??totals().total;
 $("yearSummary").innerHTML=`<div class="grid"><div class="metric">Versamenti<b>${euro(sum("Versamento"))}</b></div><div class="metric">Prelievi<b>${euro(sum("Prelievo"))}</b></div><div class="metric">Cedole/dividendi/interessi<b>${euro(income)}</b></div><div class="metric">Rimborsi<b>${euro(sum("Rimborso"))}</b></div></div><hr style="border-color:#292930"><div class="row"><b>Patrimonio fine anno</b><b>${euro(end)}</b></div>`;
 $("snapshots").innerHTML=snaps.map(s=>`<div class="row listitem"><span>${new Date(s.date).toLocaleDateString("it-IT")}</span><b>${euro(s.value)}</b></div>`).join("")||'<p class="muted">Nessuno snapshot per quest’anno.</p>';
}
$("yearSelect").onchange=renderYears;

function renderAll(){renderDashboard();renderPositions();renderMovements();renderYears()}
function openPosition(){
 $("modalTitle").textContent="Nuova posizione";
 $("modalBody").innerHTML=`<label>Nome</label><input id="pn" placeholder="es. ETF MSCI World"><label>Categoria</label><select id="pc">${categories.map(x=>`<option>${x}</option>`).join("")}</select><label>ISIN / ticker</label><input id="pi"><label>Quantità</label><input id="pq" type="number" step="any"><label>Prezzo medio</label><input id="pk" type="number" step="any"><label>Prezzo attuale</label><input id="pp" type="number" step="any"><label>Scadenza (opzionale)</label><input id="pm" type="date"><label>Rendimento previsto %</label><input id="pr" type="number" step="any"><label>Note</label><input id="pt"><button class="primary" onclick="addPosition()">Salva posizione</button>`;
 $("modal").classList.add("show")
}
async function addPosition(){state.positions.push({id:uid(),name:$("pn").value||"Senza nome",cat:$("pc").value,code:$("pi").value,qty:+$("pq").value||0,cost:+$("pk").value||0,price:+$("pp").value||0,maturity:$("pm").value,rate:+$("pr").value||0,note:$("pt").value});await save();closeModal();renderAll()}
function removePosition(id){if(confirm("Eliminare questa posizione?")){state.positions=state.positions.filter(x=>x.id!==id);save().then(renderAll)}}
function openMovement(){
 $("modalTitle").textContent="Nuovo movimento";
 $("modalBody").innerHTML=`<label>Data</label><input id="md" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Tipo</label><select id="mt">${movementTypes.map(x=>`<option>${x}</option>`).join("")}</select><label>Strumento / progetto</label><input id="ma" placeholder="es. Trusters / obbligazione"><label>Importo €</label><input id="mm" type="number" step="0.01"><label>Note</label><input id="mn"><button class="primary" onclick="addMovement()">Salva movimento</button>`;
 $("modal").classList.add("show")
}
async function addMovement(){state.movements.push({id:uid(),date:$("md").value,type:$("mt").value,asset:$("ma").value,amount:+$("mm").value||0,note:$("mn").value});await save();closeModal();renderAll()}
function removeMovement(id){if(confirm("Eliminare questo movimento?")){state.movements=state.movements.filter(x=>x.id!==id);save().then(renderAll)}}
async function snapshot(){state.snapshots.push({id:uid(),date:new Date().toISOString(),value:totals().total});await save();renderAll();alert("Snapshot salvato.")}
function closeModal(){$("modal").classList.remove("show")}
function esc(s){return String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}

async function exportBackup(){
 const pin = prompt("Inserisci il PIN del vault per cifrare il backup:");
 if(!pin || pin.length < 6){ alert("PIN non valido."); return; }
 try{
   const salt = crypto.getRandomValues(new Uint8Array(16));
   const key = await derive(pin,salt);
   const encrypted = await encryptData(state,key);
   const backup = {version:2,app:"Portfolio Vault",salt:b64(salt),...encrypted};
   const blob = new Blob([JSON.stringify(backup)],{type:"application/octet-stream"});
   const a=document.createElement("a");
   a.href=URL.createObjectURL(blob);
   a.download="portfolio-vault-backup-encrypted.pvault";
   a.click();
   setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 }catch(e){ alert("Impossibile creare il backup cifrato."); }
}
$("restore").onchange=async e=>{
 const f=e.target.files[0]; if(!f)return;
 try{
   const backup=JSON.parse(await f.text());
   if(backup.version!==2 || backup.app!=="Portfolio Vault" || !backup.salt || !backup.iv || !backup.data) throw 0;
   const pin=prompt("Inserisci il PIN usato per creare questo backup:");
   if(!pin || pin.length<6) throw 0;
   const key=await derive(pin,unb64(backup.salt));
   const restored=await decryptData({iv:backup.iv,data:backup.data},key);
   if(!restored.positions||!restored.movements||!restored.snapshots) throw 0;
   if(!confirm("Il ripristino sostituirà i dati presenti sul dispositivo. Continuare?")) return;
   state=restored; await save(); renderAll(); alert("Backup cifrato ripristinato correttamente.");
 }catch{alert("Backup non valido oppure PIN errato.");}
 e.target.value="";
}
function wipe(){if(confirm("ATTENZIONE: cancella definitivamente il vault da questo browser. Continuare?")){localStorage.removeItem(KEY);localStorage.removeItem("pvault.salt");lock();location.reload()}}

if(!window.crypto?.subtle){$("unlock").disabled=true;alert("Questo browser non supporta la cifratura necessaria. Usa Safari aggiornato su iPhone.")}

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
let lastHidden=0;
document.addEventListener("visibilitychange",()=>{
  if(document.hidden){ lastHidden=Date.now(); }
  else if(lastHidden && Date.now()-lastHidden > 5*60*1000 && sessionKey){ lock(); }
});
