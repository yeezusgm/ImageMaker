import * as THREE from './vendor/three.module.js';
import {createSimulation} from './physics.js';
import {createWorld} from './world.js';
import {createActors} from './actors.js';
import {createCanvasRenderer} from './canvas-renderer.js';
import {createPostFX} from './postfx.js';
import {level} from './level.js';
import {createJourney} from './journey.js';
import {caveLight,createCaves} from './caves.js';
import {createLandmarks} from './landmarks.js';
import {charms,capacity,charmById,createPurse} from './charms.js';
import {charmMarkup,inventoryTabs,merchantMarkup,iconApple,iconCrystal,mapMarkup,ornament,safeText} from './interface.js';
const $=s=>document.querySelector(s), overlay=$('#overlay'), hud=$('#hud'), hint=$('#hint');
const touch=matchMedia('(pointer:coarse)').matches;
const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
const surface=document.createElement('canvas');
const gl=surface.getContext('webgl2',{antialias:true,alpha:false});
const renderer=gl?new THREE.WebGLRenderer({canvas:surface,context:gl,antialias:true}):createCanvasRenderer(THREE);
renderer.domElement.setAttribute('aria-label','Escenario de Abyss Blade');
renderer.setPixelRatio(Math.min(devicePixelRatio,gl?(touch?1.35:1.8):Math.min(1,1100/innerWidth)));
renderer.outputColorSpace=THREE.SRGBColorSpace;$('#view').append(renderer.domElement);
const post=gl&&!location.search.includes('nopost')?createPostFX(THREE,renderer):null;
const scene=new THREE.Scene(), camera=new THREE.OrthographicCamera(-10,10,5,-5,.1,100);
const sim=createSimulation({...level,health:6,hasSword:false});
const world=createWorld(THREE,scene,{...level,swordX:level.sword.x,gateX:level.exit.x});
const actors=createActors(THREE,scene,sim);
const journey=createJourney(level,sim), landmarks=createLandmarks(THREE,scene,level), caves=createCaves(THREE,scene);
const veil=$('#cave-veil'),purse=createPurse();
let inventoryTab='objects',charmChoice='seed',wareChoice='seed',notice='';
const discoveredCheckpoints=new Set();
let slot=0, station=null, cinema=null, optionReturn='title', slotsMode='continue', complete=false;
const saveKey=i=>'abyss-blade-slot-'+i;
function readSave(i){try{return JSON.parse(localStorage.getItem(saveKey(i))||'null');}catch{return null;}}
function storeSave(){if(!slot)return;try{localStorage.setItem(saveKey(slot),JSON.stringify({
 version:1,sword,rank,apples,crystals,complete,finishAt:complete?level.exit.x:null,elapsed,checkpoint:checkpoint??level.spawn,
 economy:purse.snapshot(),journey:journey.snapshot(),seenCheckpoints:[...discoveredCheckpoints],items:pickups.filter(p=>p.taken).map(p=>p.id),
 defeated:sim.enemies.filter(e=>!e.hp).map(e=>e.sourceId),
}));}catch{}}
const opt=(()=>{try{return JSON.parse(localStorage.getItem('abyss-blade-options')||'{}');}catch{return {};}})();
let volume=Number.isFinite(opt.volume)?THREE.MathUtils.clamp(opt.volume,0,1):.7;
let lowMotion=opt.motion===true;
const quiet=()=>reduce||lowMotion;
function saveOptions(){try{localStorage.setItem('abyss-blade-options',JSON.stringify({volume,motion:lowMotion}));}catch{}}
let mode='title', apples=0, crystals=0, rank=1, sword=false, corruption=0, elapsed=0, fx=0, flash=0, toast=0, acc=0, last=performance.now(), camX=level.spawn.x+4,camY=2.6, vw=20,vh=10, sequence=null, checkpoint=null, selected='heal';
const held={},prev={},pressed=new Set(),touchMap=new Map();
const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',KeyW:'jump',ArrowUp:'jump',KeyJ:'attack',KeyK:'dash',ShiftLeft:'dash',KeyE:'interact',KeyI:'inventory',KeyM:'map',Escape:'pause'};
function msg(text){$('#toast').textContent=text;toast=2;}
const audio={};
for(const k of ['attack','awakening','echo','fragment','heal','hit','hurt','jump'])audio[k]=new Audio('./assets/'+k+'.wav');
function play(k,gain=.26){if(volume>0&&audio[k]){const a=audio[k].cloneNode();a.volume=gain*volume;a.play().catch(()=>{});}}
function crystalMesh(type){
 const group=new THREE.Group();
 const col=type==='apple'?0xff8872:0xeab5ff;
 const mesh=new THREE.Mesh(type==='apple'?new THREE.IcosahedronGeometry(.19,0):new THREE.OctahedronGeometry(.22),new THREE.MeshBasicMaterial({color:col}));
 mesh.scale.y=type==='apple'?1:1.45;group.add(mesh);
 const halo=new THREE.Mesh(new THREE.CircleGeometry(.34,22),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.14,depthWrite:false}));
 halo.position.z=-.1;group.add(halo);scene.add(group);return group;
}
const shotMeshes=Array.from({length:16},()=>{
 const m=new THREE.Mesh(new THREE.OctahedronGeometry(.15),new THREE.MeshBasicMaterial({color:0xf7a56a}));scene.add(m);m.visible=false;return m;
});
const pickups=level.pickups.map((p,i)=>({...p,mesh:crystalMesh(p.type),i,taken:false}));

const points=new Float32Array(160*3), colors=new Float32Array(160*3);
const buffer=new THREE.BufferGeometry();buffer.setAttribute('position',new THREE.BufferAttribute(points,3));buffer.setAttribute('color',new THREE.BufferAttribute(colors,3));buffer.setDrawRange(0,0);
const sparks=new THREE.Points(buffer,new THREE.PointsMaterial({size:4,vertexColors:true,transparent:true,opacity:.9,depthWrite:false,blending:THREE.AdditiveBlending}));sparks.frustumCulled=false;scene.add(sparks);
const bits=[];
function burst(x,y,color,n=12){if(quiet())n=Math.min(5,n);for(let i=0;i<n;i++){if(bits.length>=160)bits.shift();const a=Math.random()*6.283,v=1+Math.random()*5;bits.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,t:.28+Math.random()*.52,c:new THREE.Color(color)});}}
function fxUpdate(dt){for(let i=bits.length-1;i>=0;i--){let b=bits[i];b.t-=dt;if(b.t<=0){bits.splice(i,1);continue;}b.x+=b.vx*dt;b.y+=b.vy*dt;b.vy-=7*dt;}
 bits.forEach((b,i)=>{points.set([b.x,b.y,4],i*3);colors.set([b.c.r,b.c.g,b.c.b].map(v=>v*Math.min(1,b.t*3)),i*3);});buffer.attributes.position.needsUpdate=true;buffer.attributes.color.needsUpdate=true;buffer.setDrawRange(0,bits.length);}
function updateHUD(){
 const p=sim.player;
 const lives=Array.from({length:p.maxHp},(_,i)=>'<i class="'+(i>=p.hp?'empty':'')+'"></i>').join('');
 if($('#life').dataset.value!==lives){$('#life').innerHTML=lives;$('#life').dataset.value=lives;}
 $('#life').setAttribute('aria-label',p.hp+' de '+p.maxHp+' de vida');const energy=Math.round(100*(p.energy||0)/(p.maxEnergy||1));$('#energy').style.setProperty('--energy',energy+'%');$('#energy').setAttribute('aria-valuenow',String(energy));
 const stock='⬢ '+purse.nux+' Nux  ·  ✦ '+crystals+'  ·  '+apples+' manz.';if($('#stock').textContent!==stock)$('#stock').textContent=stock;$('#stock').setAttribute('aria-label',purse.nux+' Nux, '+crystals+' cristales y '+apples+' manzanas');
 const index=journey.visit(p.x);const zone=level.zones[Math.max(0,index)].name;if($('#zone').textContent!==zone)$('#zone').textContent=zone;
}
function panel(title,body,buttons,tag='ABYSS BLADE'){
 overlay.className=mode==='title'?'title':'';overlay.hidden=false;
 overlay.innerHTML='<div class="panel"><div class="eyebrow">'+tag+'</div>'+title+ornament+body+'<div class="actions">'+buttons+'</div></div>';
}
function clearInput(){pressed.clear();for(const k in held)held[k]=false;for(const k in prev)delete prev[k];touchMap.clear();document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));}
const action=(id,label,cls='')=>'<button id="'+id+'" '+(cls?'class="'+cls+'"':'')+'>'+label+'</button>';
const back=()=>action('back','Volver');
const resume=()=>action('resume','Volver');
function show(next){
 mode=next;clearInput();hud.hidden=next!=='play';$('#touch').hidden=!touch||next!=='play';hint.hidden=next!=='play';overlay.hidden=next==='play'||next==='cinema';
 $('#cinematic').hidden=next!=='cinema';
 if(next==='play'){document.activeElement?.blur();updateHUD();return;}
 if(next==='title'){
   const available=[1,2,3].some(i=>readSave(i));
   panel('<h1>Abyss Blade</h1>','<div class="subtitle">El umbral</div><p>El bosque recuerda lo que la espada olvida.</p>',(available?action('continue','Continuar','primary'):'')+action('start','Nueva partida',available?'':'primary')+action('options','Opciones')+action('help','Controles')+action('credits','Créditos'),'AVENTURA DE FANTASÍA OSCURA');
 }
 if(next==='slots'){
   const rows=[1,2,3].map(i=>{const d=readSave(i),x=d?.checkpoint?.x??0;
     const zone=level.zones.findLast(z=>x>=z.x)?.name??level.zones[0].name;
     const detail=d?(d.complete?'Capítulo completado':safeText(zone))+' · '+(d.journey?.seen?.length??0)+'/'+level.zones.length+' zonas':'Ranura vacía';
     return '<button class="slot" data-slot="'+i+'" '+((slotsMode==='continue')!==!!d?'disabled':'')+'><b>0'+i+'</b><span><strong>'+(d?'Partida guardada':'Nueva partida')+'</strong><small>'+detail+'</small></span></button>';
   }).join('');
   panel('<h2>Seleccionar partida</h2>','<div class="slots">'+rows+'</div>',back(),'ARCHIVO DEL VIAJERO');
 }
 if(next==='help')panel('<h2>Controles</h2>','<p>A/D o flechas: moverte · Espacio: saltar<br>J: atacar · K: esquivar · E: interactuar<br>I: inventario · M: mapa · Esc: pausa</p><p>Con mando táctil, usa los botones del juego.</p>',back());
 if(next==='credits')panel('<h2>Créditos</h2>','<p>Abyss Blade · Proyecto de titulación de Javier.<br>Sprite de Tom y sonidos del proyecto original.<br>Versión web realizada en Three.js.</p>',back());
 if(next==='options')panel('<h2>Opciones</h2>','<div class="settings"><label for="volume">Volumen general <output id="vol-value">'+Math.round(volume*100)+' %</output></label><input id="volume" type="range" min="0" max="100" value="'+Math.round(volume*100)+'"><label class="check"><input id="motion" type="checkbox" '+(lowMotion?'checked':'')+'> Reducir destellos y sacudidas</label></div>',back(),'PREFERENCIAS');
 if(next==='pause')panel('<h2>Pausa</h2>','<p>El bosque puede esperar.</p>',action('resume','Continuar','primary')+action('openmap','Mapa')+action('options','Opciones')+action('totitle','Guardar y salir'));
 if(next==='map'){
   panel('<h2>Mapa del mundo</h2>',mapMarkup(level,journey,sim.player.x),resume(),'CARTOGRAFÍA DEL UMBRAL');overlay.className='wide';
 }
 if(next==='travel'){
   const options=level.stations.map(s=>'<button class="slot" data-travel="'+s.id+'" '+(!journey.unlocked.has(s.id)||s.id===station.id?'disabled':'')+'><b>✦</b><span><strong>'+safeText(s.name)+'</strong><small>'+(s.id===station.id?'Ubicación actual':journey.unlocked.has(s.id)?'Destino disponible':'Faro sin activar')+'</small></span></button>').join('');
   panel('<h2>Faros del Eco</h2>','<p>Viaja entre los faros que ya despertaste.</p><div class="slots">'+options+'</div>',(station.id==='shrine'?action('barter','Trueque'):'')+resume(),'VIAJE RÁPIDO');
 }
 if(next==='barter'){
   panel('<h2>Trueque del Eco</h2>','<div class="trade"><div class="item-icon">'+iconApple+'</div><p><b>Manzana del santuario</b><br>Recupera dos puntos de vida. Precio: 1 cristal.</p></div><p>Disponibles: '+crystals+' cristales.</p>','<button id="buyapple" class="primary" '+(crystals>0?'':'disabled')+'>Cambiar 1 cristal</button>'+action('travelback','Volver al faro'),'SANTUARIO DEL ECO');
 }
 if(next==='shop'){
   const c=charmById(wareChoice),owned=purse.owned.has(c.id);
   const buy='<button id="buycharm" class="primary" '+(owned||purse.nux<c.price?'disabled':'')+'>'+(owned?'Ya comprado':purse.nux<c.price?'Nux insuficientes':'Comprar · '+c.price+' Nux')+'</button>';
   panel('<h2>Tienda de Nara</h2>',merchantMarkup(charms,purse,wareChoice)+(notice?'<p class="equip-notice" role="status">'+safeText(notice)+'</p>':''),buy+resume(),'MERCADER DE LINTERNAS');
   overlay.className='wide merchant';
 }
 if(next==='inventory'){
   const items='<button data-item="heal" aria-pressed="'+(selected==='heal')+'" title="Clic derecho para usar"><span class="item-icon">'+iconApple+'</span><b>Manzanas</b><span>× '+apples+'</span></button><button data-item="forge" aria-pressed="'+(selected==='forge')+'" title="Doble clic para mejorar"><span class="item-icon">'+iconCrystal+'</span><b>Cristales</b><span>× '+crystals+'</span></button>';
   if(inventoryTab==='charms'){
     const c=charmById(charmChoice);
     const eq='<button id="equipcharm" class="primary" '+(!purse.owned.has(c.id)?'disabled':'')+'>'+(purse.equipped.has(c.id)?'Desequipar':'Equipar')+'</button>';
     panel('<h2>Amuletos</h2>',inventoryTabs(inventoryTab)+charmMarkup(charms,purse,charmChoice,capacity)+(notice?'<p class="equip-notice" role="status">'+safeText(notice)+'</p>':''),eq+resume(),'EQUIPO DE TOM');
     overlay.className='wide merchant';return;
   }
   panel('<h2>Inventario</h2>',inventoryTabs(inventoryTab)+'<div class="inventory"><div class="bag" aria-label="Objetos">'+items+'</div><div id="item-info" class="item-info"></div></div>',action('use','Usar','primary')+resume(),'EQUIPO DE TOM');
   updateInventory();
 }
 if(next==='dead')panel('<h2>Has caído</h2>','<p>El Eco te espera en el último refugio.</p>',action('retry','Volver al refugio','primary')+action('totitle','Menú principal'),'ABYSS BLADE');
 if(next==='complete')panel('<h2>El último eco</h2>','<p>Tom ha devuelto la espada. Su eco permanece mientras el bosque recupera la voz.</p>',action('resume','Seguir explorando','primary')+action('totitle','Menú principal'),'FIN DEL CAPÍTULO');
}
function updateInventory(){
 for(const b of overlay.querySelectorAll('[data-item]'))b.setAttribute('aria-pressed',String(b.dataset.item===selected));
 const heal=selected==='heal',name=heal?'Manzana del bosque':'Cristales del abismo';
 $('#item-info').innerHTML='<strong>'+name+'</strong><p>'+(heal?'Recupera dos puntos de vida. Clic derecho para usar.':'Gasta '+3*rank+' cristales para subir el daño. Doble clic para mejorar.')+'</p><small>Espada: '+(sword?'nivel '+rank:'aún no la tienes')+'</small>';
 const btn=$('#use');btn.disabled=heal?(!apples||sim.player.hp>=sim.player.maxHp):(!sword||crystals<3*rank);
 btn.textContent=heal?'Usar manzana':'Mejorar espada';
}
function relocate(dest,restore=false){
 if(!sim.teleport(dest.x,dest.y,{checkpoint:true,restore}))return false;
 checkpoint={x:dest.x,y:dest.y};camX=dest.x;camY=dest.y+2;clearInput();bits.length=0;return true;
}
function reset(data){
 sim.reset();journey.reset();purse.restore();inventoryTab='objects';notice='';discoveredCheckpoints.clear();selected='heal';apples=crystals=0;rank=1;sword=false;checkpoint={...level.spawn};corruption=0;elapsed=0;complete=false;station=null;cinema=null;sequence=null;bits.length=0;
 pickups.forEach(p=>p.taken=false);
 if(data?.version===1){
  apples=data.apples;crystals=data.crystals;rank=data.rank;sword=!!data.sword;complete=!!data.complete&&data.finishAt===level.exit.x;elapsed=data.elapsed||0;
  journey.restore(data.journey);for(const id of data.seenCheckpoints??[])discoveredCheckpoints.add(id);
  if(sword){sim.equipSword();corruption=1;}
  purse.restore(data.economy);sim.setLoadout(rank,purse.stats());
  pickups.forEach(p=>p.taken=data.items?.includes(p.id)??false);
  for(const e of sim.enemies)if(data.defeated?.includes(e.sourceId)){e.hp=0;e.state='dead';if(!data.economy)purse.reward(e.type);}
  relocate(data.checkpoint??level.spawn,true);
 }
 camX=sim.player.x+2;camY=sim.player.y+2;show('play');storeSave();
}
function retry(){if(!relocate(checkpoint??level.spawn,true)){reset(readSave(slot));return;}show('play');}
function speak(lines,onDone=()=>show('play')){clearInput();sequence={lines,i:0,onDone};nextLine();}
function nextLine(){
 mode='dialogue';hint.hidden=true;hud.hidden=true;$('#touch').hidden=true;
 if(sequence.i===sequence.lines.length){const f=sequence.onDone;sequence=null;f();return;}
 const line=sequence.lines[sequence.i++], parts=line.split(' — '),who=parts.length>1?parts.shift():'EL ECO';
 panel('<h2>'+safeText(who)+'</h2>','<p>'+safeText(parts.join(' — '))+'</p>',action('next','Continuar ↓','primary'),'DIÁLOGO · '+sequence.i+' / '+sequence.lines.length);
 overlay.className='dialogue';$('#next').focus({preventScroll:true});
}
function useItem(id){
 if(id==='heal'&&apples&&sim.player.hp<sim.player.maxHp){apples--;sim.heal(2);play('heal');updateHUD();storeSave();show('inventory');}
 if(id==='forge'&&sword&&crystals>=3*rank){crystals-=3*rank;rank++;sim.setLoadout(rank,purse.stats());play('fragment');updateHUD();storeSave();show('inventory');}
}
overlay.addEventListener('click',e=>{
 const btn=e.target.closest('button'),id=btn?.id;
 if(btn?.dataset.inv){inventoryTab=btn.dataset.inv;notice='';show('inventory');overlay.querySelector('[data-inv="'+inventoryTab+'"]')?.focus();return;}
 if(btn?.dataset.charm){charmChoice=btn.dataset.charm;notice='';show('inventory');overlay.querySelector('[data-charm="'+charmChoice+'"]')?.focus();return;}
 if(btn?.dataset.ware){wareChoice=btn.dataset.ware;notice='';show('shop');overlay.querySelector('[data-ware="'+wareChoice+'"]')?.focus();return;}
 if(btn?.dataset.item){selected=btn.dataset.item;updateInventory();return;}
 if(btn?.dataset.slot){slot=Number(btn.dataset.slot);reset(readSave(slot));return;}
 if(btn?.dataset.travel){const dest=level.stations.find(s=>s.id===btn.dataset.travel);if(dest&&station&&journey.unlocked.has(dest.id)&&relocate(dest)){play('echo');show('play');storeSave();msg('Faro · '+dest.name);}return;}
 if(id==='start'||id==='continue'){slotsMode=id==='start'?'new':'continue';show('slots');}
 if(id==='retry')retry();if(id==='help')show('help');if(id==='credits')show('credits');
 if(id==='back')show(mode==='options'?optionReturn:'title');
 if(id==='resume')show('play');if(id==='next')nextLine();if(id==='openmap')show('map');
 if(id==='options'){optionReturn=mode;show('options');}
 if(id==='totitle'){storeSave();show('title');}
 if(id==='barter')show('barter');if(id==='travelback')show('travel');
 if(id==='buyapple'&&crystals>0){crystals--;apples++;play('fragment');storeSave();show('barter');}
 if(id==='buycharm'&&mode==='shop'&&purse.buy(wareChoice)){notice='Añadido a tu inventario. Equípalo en Amuletos.';charmChoice=wareChoice;play('fragment');storeSave();show('shop');}
 if(id==='equipcharm'&&mode==='inventory'){
   const result=purse.equip(charmChoice);
   notice=result==='full'?'Te faltan espacios. Desequipa otro amuleto.':result==='equipped'?'Amuleto equipado.':result==='removed'?'Amuleto desequipado.':'Nara vende este amuleto.';
   sim.setLoadout(rank,purse.stats());storeSave();show('inventory');
 }
 if(id==='use')useItem(selected);
});
overlay.addEventListener('input',e=>{
 if(e.target.id==='volume'){volume=Number(e.target.value)/100;$('#vol-value').value=e.target.value+' %';saveOptions();}
 if(e.target.id==='motion'){lowMotion=e.target.checked;saveOptions();}
});
overlay.addEventListener('contextmenu',e=>{if(mode==='inventory'&&e.target.closest('[data-item="heal"]')){e.preventDefault();if(apples&&sim.player.hp<sim.player.maxHp){selected='heal';useItem('heal');}}});
overlay.addEventListener('dblclick',e=>{if(mode==='inventory'&&e.target.closest('[data-item="forge"]'))useItem('forge');});
$('#pause').onclick=()=>{if(mode==='play')show('pause');};$('#inv').onclick=()=>{if(mode==='play')show('inventory');};
$('#map').onclick=()=>{if(mode==='play')show('map');};
addEventListener('keydown',e=>{
 const k=keys[e.code];if(!k)return;
 if(e.target instanceof HTMLInputElement&&k!=='pause')return;
 if(e.target instanceof HTMLButtonElement&&e.code==='Space')return;
 if(mode==='play'||['pause','inventory','map','interact'].includes(k))e.preventDefault();
 if(e.repeat)return;
 if(k==='pause'){
  if(mode==='play')show('pause');else if(['pause','inventory','travel','shop','barter','map'].includes(mode))show('play');
  else if(mode==='options')show(optionReturn);else if(['help','credits','slots'].includes(mode))show('title');
  return;
 }
 if(k==='map'||k==='inventory'){if(mode==='play')show(k);else if(mode===k)show('play');return;}
 if(mode==='dialogue'&&k==='interact'){nextLine();return;}
 if(mode==='play'){held[k]=true;pressed.add(k);}
});
addEventListener('keyup',e=>{if(keys[e.code])held[keys[e.code]]=false;});
addEventListener('blur',()=>{Object.keys(held).forEach(k=>held[k]=false);touchMap.clear();document.querySelectorAll('.held').forEach(b=>b.classList.remove('held'));if(mode==='play')show('pause');});
$('#touch').addEventListener('pointerdown',e=>{const b=e.target.closest('[data-act]');if(!b)return;e.preventDefault();b.setPointerCapture(e.pointerId);touchMap.set(e.pointerId,b.dataset.act);pressed.add(b.dataset.act);b.classList.add('held');});
for(const event of ['pointerup','pointercancel','lostpointercapture'])$('#touch').addEventListener(event,e=>{touchMap.delete(e.pointerId);e.target.classList?.remove('held');});
function nearby(){
 const p=sim.player, all=[];
 const item=(type,s,label,data)=>{const dx=Math.abs(p.x-s.x),dy=Math.abs(p.y-s.y);if(dx<1.48&&dy<.9)all.push({type,s,label,data,d:dx+dy*2});};
 if(!sword)item('sword',level.sword,'Tomar la espada');
 for(const m of level.merchants)if(sword)item('merchant',m,'Hablar con '+m.name,m);
 for(const d of level.portals)if(sword)item('portal',d,d.name,d);
 for(const r of level.relics)if(sword&&!journey.relics.has(r.id))item('relic',r,'Recoger '+r.name,r);
 for(const s of level.stations)item('station',s,journey.unlocked.has(s.id)?'Usar faro · '+s.name:'Activar faro',s);
 if(sword){
  for(const e of level.echoes)item('echo',e,'Hablar con el Eco',e.lines);
  for(const p of level.puzzles){
   item('clue',p.clue,'Leer inscripción',p);
   for(const s of p.switches)item('switch',s,(journey.cleared.has(p.id)?'Runa encendida · ':'Activar · ')+s.name,p);
  }
  if(!complete)item('exit',level.exit,'Devolver la espada');
 }
 return all.sort((a,b)=>a.d-b.d)[0];
}
function interact(){
 const a=nearby();if(!a)return;
 if(a.type==='sword'){
  cinema={t:0,facing:sim.player.x>level.sword.x?-1:1,x:sim.player.x};play('awakening',.54);show('cinema');return;
 }
 if(a.type==='merchant'){notice='';play('echo',.23);show('shop');return;}
 if(a.type==='portal'){
   const d=a.data;
   if(d.requires?.some(id=>!journey.relics.has(id))){msg(d.requires.length>1?'El Archivo requiere los dos sellos del cruce.':'Este atajo requiere el sello de la región.');return;}
   if(relocate(d.to)){show('play');storeSave();play('echo',.23);}
   return;
 }
 if(a.type==='relic'){journey.relics.add(a.data.id);play('fragment');burst(a.data.x,a.data.y+.7,0xf7d39e,24);msg(a.data.name+' · '+journey.relics.size+' / '+level.relics.length);storeSave();return;}
 if(a.type==='station'){
  station=a.data;
  if(!journey.unlocked.has(station.id)){
   journey.unlocked.add(station.id);sim.heal(sim.player.maxHp);play('echo');
   checkpoint={x:station.x,y:station.y};sim.setCheckpoint(station.x,station.y);storeSave();msg('Faro despertado · '+station.name);
  }
  show('travel');return;
 }
 if(a.type==='echo'){play('echo');speak(a.data);return;}
 if(a.type==='clue'){journey.clues.add(a.data.id);storeSave();play('echo');speak(a.data.clue.lines);return;}
 if(a.type==='switch'){
  const puzzle=a.data,result=journey.activate(puzzle,a.s.id);
  if(result==='done')msg('El mecanismo ya está abierto');
  if(result==='wrong'){play('hurt',.17);msg('Las runas se apagaron. Revisa la inscripción.');}
  if(result==='next'){play('fragment');burst(a.s.x,a.s.y+.7,0xeec1ff);msg('Runa encendida · '+journey.progress.get(puzzle.id)+' / '+puzzle.order.length);}
  if(result==='open'){play('awakening',.35);burst(a.s.x,a.s.y+.7,0xffd5a0,25);msg('Se abrió · '+puzzle.name);storeSave();}
  return;
 }
 if(a.type==='exit'){
  if(journey.cleared.size<level.puzzles.length){msg('Aún queda un sello por abrir');return;}
  if(journey.relics.size<level.relics.length||sim.enemies.some(e=>e.sourceId===level.keeper&&e.hp>0)){msg('Reúne los sellos y derrota al Custodio.');return;}
  play('echo');speak(level.ending,()=>{complete=true;storeSave();show('complete');});
 }
}
function cinematicUpdate(dt){
 cinema.t+=dt;
 const time=cinema.t, panel=$('#cinematic');
 panel.dataset.phase=time<.75?'approach':time<1.75?'awaken':'dark';
 const label=time<.75?'Santuario del Eco':time<1.75?'La Espada del Abismo':'El bosque enmudece';
 if($('#cine-caption').textContent!==label)$('#cine-caption').textContent=label;
 if(time>=.95&&!cinema.burst){cinema.burst=true;flash=.65;fx=.20;burst(level.sword.x,level.sword.y+1.5,0xedbcff,44);}
 if(time>=2.85){
  sword=true;sim.equipSword();checkpoint={...level.checkpoints[0]};sim.setCheckpoint(checkpoint.x,checkpoint.y);corruption=1;cinema=null;storeSave();
  $('#cinematic').hidden=true;play('echo');speak(level.dialogue);
 }
}
function resize(){
 const w=innerWidth,h=$('#stage').clientHeight,ar=w/Math.max(1,h);
 vh=Math.max(9.4,12/ar);vw=ar*vh;
 camera.left=-vw/2;camera.right=vw/2;camera.top=vh/2;camera.bottom=-vh/2;camera.updateProjectionMatrix();renderer.setSize(w,h);post?.resize();
}
addEventListener('resize',resize);resize();show('title');
const step=1/120;
function events(){
 const p=sim.player;
 for(const e of sim.events){
  const x=e.x??p.x,y=e.y??(p.y+.65);
  if(e.type==='jump')play('jump',.15);
  if(e.type==='attack')play('attack',.22);
  if(e.type==='hit'||e.type==='defeat'){burst(x,y,0xe8a4ff,e.type==='defeat'?28:12);play('hit');fx=.12;if(e.type==='defeat'){crystals++;const earned=purse.reward(e.enemyType);burst(x,y,0xffcb88,10);msg('+'+earned+' Nux');storeSave();}}
  if(e.type==='enemyShot')play('attack',.17);
  if(e.type==='hurt'){burst(x,y,0xff8f6e);play('hurt');fx=.24;flash=.25;}
  if(e.type==='block'){burst(x,y,0xffd99d,8);play('hit',.18);msg('Esquiva y golpea cuando baje la guardia');}
  if(e.type==='land')burst(x,p.y+.05,caveLight(level.lighting,p.x).cyan>.5?0xb7e9e3:0xbda483,Math.min(12,5+Math.floor((e.speed??0)*.4)));
  if(e.type==='dash')burst(x,y,0xbea3ff,8);
  if(e.type==='death')show('dead');
 }
}
$('#skip').onclick=()=>{if(cinema){cinema.t=3;cinematicUpdate(0);}};
function frame(now){
 const realDt=(now-last)/1000,dt=Math.min(.1,realDt);last=now;
 if(mode==='cinema')cinematicUpdate(Math.min(.4,realDt));
 if(mode==='play'){
  elapsed+=dt;
  const input={...held};for(const k of pressed)input[k]=true;for(const k of touchMap.values())input[k]=true;
  if(input.interact&&!prev.interact)interact();prev.interact=input.interact;
  if(mode==='play'){
   acc+=dt;while(acc>=step&&mode==='play'){sim.step(step,input);pressed.clear();events();acc-=step;}
   const p=sim.player;
   if(!sword&&p.x>44.4){p.x=44.4;p.vx=0;}
   if(p.hp<=0&&mode==='play')show('dead');
   for(const item of pickups)if(!item.taken&&Math.abs(item.x-p.x)<.55&&Math.abs(item.y-(p.y+.6))<.82){item.taken=true;if(item.type==='apple')apples++;else crystals++;play('fragment',.18);burst(item.x,item.y,item.type==='apple'?0xff926f:0xde9dff,9);}
   if(sword&&p.grounded)for(const [id,c] of level.checkpoints.entries()){
    if(!discoveredCheckpoints.has(id)&&Math.abs(p.x-c.x)<.7&&Math.abs(p.y-c.y)<.15){discoveredCheckpoints.add(id);checkpoint={...c};storeSave();}
   }
   const near=nearby();
   const tip=near?(touch?'Toca E':'E')+' · '+near.label:!sword&&p.x>44.3?'Regresa al altar. La espada te llama.':(!touch&&sword&&p.x>=42&&p.x<49?'J · Atacar  /  K · Esquivar  /  M · Mapa':p.x<8?(touch?'Usa los botones para moverte y saltar.':'A/D o ← → para moverte · Espacio para saltar'):level.tutorials.findLast(x=>p.x>=x.x)?.text||'');
   if(hint.textContent!==tip)hint.textContent=tip;
   updateHUD();
  }
 }else acc=0;
 const p=sim.player,t=now/1000;
 if(mode==='play'||mode==='dialogue'){const follow=1-Math.exp(-dt*6.8);camX+=(THREE.MathUtils.clamp(p.x+1.6*(p.facing||1),vw*.35,level.width-vw*.36)-camX)*follow;camY+=((p.x>=284?p.y+2:Math.max(2.25,p.y+2))-camY)*follow;}
 if(['title','slots','help','credits'].includes(mode)){camX=level.spawn.x+4.8+Math.sin(t*.18)*1.4;camY=2.65;}
 if(cinema){const q=1-Math.exp(-dt*3);camX+=(level.sword.x-camX)*q;camY+=(level.sword.y+1.7-camY)*q;}
 corruption+=((cinema?THREE.MathUtils.smoothstep(cinema.t,.85,2.4):Number(sword))-corruption)*(1-Math.exp(-dt*1.35));
 fx=Math.max(0,fx-dt);flash=Math.max(0,flash-dt*2.2);toast=Math.max(0,toast-dt);
 $('#flash').style.opacity=quiet()?0:flash*.35;$('#toast').style.opacity=Math.min(1,toast*2);
 camera.position.set(camX+(quiet()?0:Math.sin(t*90)*fx*.38),camY+(quiet()?0:Math.cos(t*72)*fx*.3),24);
 const zoom=cinema&&!quiet()?1+Math.min(.30,cinema.t*.23):1;
 if(camera.zoom!==zoom){camera.zoom=zoom;camera.updateProjectionMatrix();}
 world.update(t,camX,camY,corruption,vw/zoom,vh/zoom);
 const region=caveLight(level.lighting,p.x);
 caves.update(t,region,camera.position.x,camera.position.y,vw/zoom,vh/zoom,p,quiet());
 veil.hidden=region.darkness<.006||mode==='title'||mode==='slots'||mode==='help'||mode==='credits';
 if(!veil.hidden){
  const size=100/(vh/zoom);
  veil.style.setProperty('--light-x',(50+(p.x-camera.position.x)/(vw/zoom)*100).toFixed(2)+'%');
  veil.style.setProperty('--light-y',(50-(p.y+.69-camera.position.y)/(vh/zoom)*100).toFixed(2)+'%');
  veil.style.setProperty('--light-radius',(size*(region.cyan>.4?3.65:2.95)).toFixed(2)+'dvh');
  veil.style.opacity=(region.darkness*(1-.40*region.cyan*(1-region.cave))).toFixed(3);
 }
 landmarks.update(t,journey,sword,cinema,sim);
 actors.update(elapsed,cinema?{pose:cinema.t<.65?'kneel':cinema.t<1.7?'reach':'raise',facing:cinema.facing,x:THREE.MathUtils.lerp(cinema.x,level.sword.x-cinema.facing*.58,Math.min(1,cinema.t*2.6))}:null,quiet());
 for(const [i,m] of shotMeshes.entries()){const q=sim.shots[i];m.visible=!!q;if(q){m.position.set(q.x,q.y,2.8);m.scale.x=1.6;m.rotation.z=t*7;}}
 for(const item of pickups){item.mesh.visible=!item.taken;item.mesh.position.set(item.x,item.y+Math.sin(t*3+item.i)*.09,1.5);item.mesh.rotation.y=t+item.i;}

 fxUpdate(dt);
 if(post)post.render(scene,camera,{t,fx,flash,calm:quiet(),lx:.5+(p.x-camera.position.x)/(vw/zoom),ly:.5+(p.y+.69-camera.position.y)/(vh/zoom)});else renderer.render(scene,camera);
 requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
