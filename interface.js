const text=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const ornament='<div class="ornament" aria-hidden="true"><span></span><b>◇</b><span></span></div>';
export const iconApple='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 7C3 2 1 10 5 17c3 5 4 3 7 3s4 2 7-3c4-7 2-15-6-10Z" fill="#b5546b"/><path d="M12 7q0-5 5-5q0 4-5 5M10 6l-1-3" stroke="#c0c98c" fill="none" stroke-width="2"/><path d="M6 11q0-3 3-2" fill="none" stroke="#ffc4c5"/></svg>';
export const iconCrystal='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 1 7 7-2 9-5 6-6-6-1-9Z" fill="#b377d1"/><path d="M12 1v22l-6-6-1-9Z" fill="#e8b9ef"/><path d="m12 1 2 8-2 14 7-15Z" fill="#7e509a"/></svg>';
export function mapMarkup(level,journey,playerX){
  const index=x=>Math.max(0,level.zones.findLastIndex(z=>x>=z.x));
  const ys=[115,103,114,87,114,140,118,96,144,120];
  const network=[[482,112,58],[548,67,66],[548,163,66],[656,112,65]];
  const start=level.zones.findIndex(z=>z.network);
  const routeEnd=level.zones[start].x;
  const oldX=x=>26+x/routeEnd*455;
  const segs=level.zones.map((z,i)=>{
    const end=level.zones[i+1]?.x??level.width;
    const [x,y,w]=z.network?network[i-start]:[oldX(z.x),ys[i],oldX(end)-oldX(z.x)];
    return {x,y,w,end,known:journey.seen.has(i),z,i};
  });
  const xs=x=>{const s=segs[index(x)];return s.x+5+Math.max(0,Math.min(1,(x-s.z.x)/(s.end-s.z.x)))*(s.w-10);};
  const row=x=>segs[index(x)].y;
  const rooms=segs.map(({x,y,w,known,z,i})=>{
    const label=known?text(z.name):'Por descubrir';
    const branch=z.branch&&known?`<path class="corridor" d="M${x+w*.42} ${y-10}v-24h${w*.37}"/><path class="branch" d="M${x+w*.78} ${y-42}h18v16h-18z"/>`:'';
    const cy=z.network?y+4:y+((i%2===0)?30:39);
    return `<g class="${known?'known':'unknown'}"><title>${label}</title>${branch}<path d="M${x+3} ${y-10}H${x+w-4}v20H${x+3}z"/><text x="${x+w/2}" y="${cy}" text-anchor="middle">${known?i+1:'?'}</text></g>`;
  }).join('');
  const lines=segs.slice(1,start+1).map((s,i)=>`<path class="corridor" d="M${s.x-8} ${segs[i].y}h8V${s.y}h8"/>`).join('')+
    '<path class="corridor" d="M540 112H545V67H551 M540 112H545V163H551 M538 112H657"/>';

  const stations=level.stations.filter(s=>journey.unlocked.has(s.id)).map(s=>`<circle class="beacon-dot" cx="${xs(s.x)}" cy="${row(s.x)-20}" r="4"><title>${text(s.name)}</title></circle>`).join('');
  const gates=level.platforms.filter(p=>p.gateId&&journey.seen.has(index(p.x))).map(p=>`<path class="${journey.cleared.has(p.gateId)?'gate-open':'gate-shut'}" d="M${xs(p.x)} ${row(p.x)-7}v14"/>`).join('');
  const x=xs(playerX),y=row(playerX);
  const list=segs.filter(s=>s.known).map(s=>`<span><b>${s.i+1}</b> ${text(s.z.name)}</span>`).join('');
  const notes=level.puzzles.filter(p=>journey.clues.has(p.id)).map(p=>`<li><b>${text(p.name)}</b> · ${text(p.clue.lines.at(-1).split(' — ').at(-1))}</li>`).join('');
  return `<svg class="route-map" role="img" aria-label="Mapa del mundo y posición de Tom" viewBox="0 37 740 179">${lines}${rooms}${stations}${gates}<path class="tom-marker" d="M${x} ${y-6}l6 6-6 6-6-6z"/></svg><div class="map-legend"><span>◆ Tom</span><span>● Faro activo</span><span>│ Compuerta</span><span>${journey.seen.size} de ${level.zones.length} zonas</span><span>Sellos: ${journey.relics.size} / ${level.relics.length}</span></div><div class="map-zones">${list}</div>${notes?'<ul class="journal">'+notes+'</ul>':''}`;
}
export function safeText(s){return text(s);}

export function inventoryTabs(tab){
  return '<nav class="equip-tabs" aria-label="Inventario"><button data-inv="objects" aria-pressed="'+(tab==='objects')+'">Objetos</button><button data-inv="charms" aria-pressed="'+(tab==='charms')+'">Amuletos</button></nav>';
}
export const charmIcon=c=>'<span class="charm-icon" style="--charm:'+c.color+'" aria-hidden="true">'+c.icon+'</span>';
const nuxLabel=n=>'<span class="nux"><b aria-hidden="true">⬢</b> '+n+' Nux</span>';
export function merchantMarkup(charms,purse,selected){
  const rows=charms.map(c=>'<button class="wares-row" data-ware="'+c.id+'" aria-pressed="'+(selected===c.id)+'">'+charmIcon(c)+'<span>'+text(c.name)+'</span><small>'+(purse.owned.has(c.id)?'Comprado':nuxLabel(c.price))+'</small></button>').join('');
  const c=charms.find(c=>c.id===selected);
  return '<div class="merchant-grid"><div class="wares" aria-label="Amuletos en venta">'+rows+'</div><div class="ware-detail">'+charmIcon(c)+'<h3>'+text(c.name)+'</h3><p>'+text(c.description)+'</p><strong>'+text(c.effect)+'</strong><small>Espacios: '+c.slots+'</small></div></div><p class="purse">En tu bolsa: '+nuxLabel(purse.nux)+'</p>';
}
export function charmMarkup(charms,purse,selected,capacity){
  const c=charms.find(c=>c.id===selected);
  const row=charms.map(c=>'<button data-charm="'+c.id+'" aria-pressed="'+(c.id===selected)+'" class="charm-socket '+(purse.equipped.has(c.id)?'equipped ':'')+(purse.owned.has(c.id)?'':'locked')+'" title="'+text(c.name)+'" aria-label="'+text(c.name+(purse.equipped.has(c.id)?', equipado':purse.owned.has(c.id)?', disponible':', sin comprar'))+'">'+charmIcon(c)+'</button>').join('');
  const sockets=Array.from({length:capacity},(_,i)=>'<i class="'+(i<purse.used()?'used':'')+'"></i>').join('');
  return '<div class="charm-grid"><div class="charm-case"><div class="charm-row">'+row+'</div><div class="capacity">Espacios <b>'+purse.used()+' / '+capacity+'</b><div class="notches" aria-hidden="true">'+sockets+'</div></div></div><div class="ware-detail"><h3>'+text(c.name)+'</h3><p>'+text(c.description)+'</p><strong>'+text(c.effect)+'</strong><small>'+c.slots+' '+(c.slots===1?'espacio':'espacios')+' · '+(purse.equipped.has(c.id)?'Equipado':purse.owned.has(c.id)?'Sin equipar':'Consíguelo con Nara')+'</small></div></div>';
}
