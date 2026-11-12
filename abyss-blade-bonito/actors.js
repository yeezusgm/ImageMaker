// The Tom atlas is copied unchanged from the Godot project. Nearest-neighbor
// sampling keeps its original pixels; enemies and effects have their own art.
const frames={idle:[0,2,1,3,4,5,6,7,8],run:[9,10,11,12,13,14],jump:[15],hurt:[16,17],dead:[18,19,20,21,22],attack:[23,24,25,26,27]};
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
function imagePlane(T,scene,px,size,z){
  const image=document.createElement('canvas');image.width=image.height=px;
  const c=image.getContext('2d');c.imageSmoothingEnabled=false;
  const tex=new T.CanvasTexture(image);tex.colorSpace=T.SRGBColorSpace;tex.magFilter=tex.minFilter=T.NearestFilter;tex.generateMipmaps=false;
  const mesh=new T.Mesh(new T.PlaneGeometry(size,size),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:T.DoubleSide,alphaTest:.005}));
  mesh.position.z=z;mesh.renderOrder=30+Math.round(z*10);scene.add(mesh);
  return {mesh,c,tex,px,size};
}
function place(a,x,y,facing,foot){a.mesh.scale.x=facing<0?-1:1;a.mesh.position.x=x;a.mesh.position.y=y+(foot/a.px-.5)*a.size;}
function box(c,color,x,y,w,h){c.fillStyle=color;c.fillRect(x,y,w,h);}
function poly(c,color,points){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
function shadow(c,x,y,w){box(c,'#19132188',x-w/2,y,w,1);box(c,'#19132150',x-w/2-2,y+1,w+4,1);}
// Draw the weapon on its own layer, behind the body. The sheath stays on
// Tom's back; swings pivot from the hand, beyond the hood.
function drawSword(c,x,y,angle,len=15){
  const dx=Math.cos(angle),dy=Math.sin(angle);
  const at=(u,v)=>[Math.round(x+dx*u-dy*v),Math.round(y+dy*u+dx*v)];
  poly(c,'#271a39',[at(-4,-1),at(-4,2),at(3,2),at(3,-1)]);
  poly(c,'#bf87b6',[at(1,-4),at(3,-4),at(4,3),at(1,3)]);
  poly(c,'#47295d',[at(3,-3),at(len-2,-4),at(len,0),at(len-2,3),at(3,3)]);
  poly(c,'#9b57bf',[at(4,-2),at(len-2,-3),at(len,0),at(4,1)]);
  poly(c,'#dfb6ec',[at(4,-2),at(len-2,-3),at(len,0),at(len-3,-1),at(5,0)]);
  const gem=at(2,0);box(c,'#ffd2f8',gem[0],gem[1],1,1);
}
function drawEnemy(c,e,t){
  const phase=e.state==='windup',flash=phase?'#ffe1ae':'#d1edf3';
  if(['moth','hopper','sentry'].includes(e.type)){
    if(e.type==='moth'){
      const w=Math.floor(t*13+e.id)%2?6:0;
      poly(c,'#463b69',[[24,31],[5,13+w],[3,21+w],[11,32],[22,36],[33,34],[44,22+w],[38,13+w],[28,25]]);
      poly(c,'#8e9bc7',[[23,30],[7,16+w],[10,23+w],[18,31],[33,30],[41,21+w],[38,16+w],[31,25]]);
      poly(c,'#312747',[[21,21],[30,21],[34,27],[30,37],[23,41],[18,36],[18,27]]);
      box(c,flash,27,27,4,2);box(c,'#e5b4d3',23,34,4,3);
    }else if(e.type==='hopper'){
      const j=e.grounded&&phase?4:0;
      poly(c,'#273a39',[[4,39],[11,30],[13,24+j],[19,17+j],[32,16+j],[37,24+j],[42,33],[38,41],[28,41],[25,37],[16,41]]);
      poly(c,'#6e9d78',[[12,33],[17,24+j],[22,20+j],[31,20+j],[36,26+j],[33,34],[23,36],[16,35]]);
      box(c,phase?'#ffd79f':'#ddf3ae',29,24+j,6,3);box(c,'#2d5046',16,33,10,4);box(c,'#a6c593',11,37,9,2);
    }else{
      poly(c,'#392a4d',[[8,42],[13,29],[17,20],[17,9],[24,3],[31,7],[35,16],[32,24],[37,31],[42,42]]);
      poly(c,'#826084',[[13,40],[18,25],[20,17],[22,8],[28,9],[33,16],[28,26],[35,34],[37,40]]);
      box(c,'#302139',20,15,14,7);box(c,phase?'#ffe49d':'#e2a4b9',24,17,7,2);
      poly(c,'#594568',[[25,28],[37,25],[43,29],[43,33],[35,35],[25,32]]);
      box(c,phase?'#ffdb88':'#ce87a4',39,27,5,5);
    }
    if(phase)box(c,'#ffd2a0',14,2,Math.ceil(20*clamp(1-e.timer/e.windup,0,1)),2);
    if(e.hurt>0)box(c,'#ffd6dc',20,23,5,2);
    return;
  }
  const large=['warden','guardian','brute','curator'].includes(e.type),swift=e.type==='stalker';
  const wind=e.state==='windup',strike=e.state==='strike';
  const pace=Math.floor(t*(strike?15:9)+e.id*2), walk=Math.abs(e.vx)>.15;
  const j=walk?(pace%4===1||pace%4===3?1:0):Math.floor(t*3+e.id)%3===1?1:0;
  const n=strike?3:wind?-2:0;
  const core=large?'#654665':swift?'#365566':'#413151', rim=large?'#ab758f':swift?'#6f9ba3':'#786c99';
  const light=wind?'#ffd6a1':swift?'#9ef7de':'#ff9eab', dark='#1d142a';
  shadow(c,23,42,large?25:18);
  c.save();c.translate(n, -j);
  if(!large)c.translate(2,5);
  poly(c,dark,[[7,29],[13,22],[20,21],[30,22],[36,28],[37,35],[33,39],[27,40],[24,37],[15,40],[9,38],[4,39],[7,35]]);
  poly(c,core,[[9,30],[15,25],[28,23],[33,27],[34,34],[30,36],[25,34],[18,37],[11,37],[9,34],[6,37]]);
  box(c,rim,11,28,3,3);box(c,rim,15,26,5,2);box(c,core,7,34,4,2);
  for(let i=0;i<3;i++){const k=walk?(pace+i*2)%4-2:0;box(c,dark,12+i*7+k,37,5,4);box(c,core,13+i*7+k,37,3,3);}
  const top=large?5:10;
  poly(c,dark,[[12,23],[11,top],[15,top+3],[18,top+9],[26,top+7],[30,top+8],[34,top],[36,top+4],[36,19],[33,24],[32,28],[18,30],[14,27]]);
  poly(c,core,[[13,top+2],[16,top+10],[19,top+11],[26,top+9],[32,top+11],[34,top+3],[34,19],[31,23],[30,26],[19,28],[15,25]]);
  box(c,rim,15,top+9,2,4);box(c,rim,18,top+11,7,2);box(c,rim,31,top+9,2,4);
  box(c,dark,19,21,13,4);box(c,light,20,21,4,2);box(c,light,27,21,4,2);
  if(e.type==='curator'){
    poly(c,'#d4ad91',[[12,14],[14,4],[19,12],[23,3],[28,11],[34,4],[35,15],[30,17],[18,17]]);
    box(c,e.hp<=e.maxHp/2?'#ff7664':'#f5cc8f',22,10,5,3);
  }
  if(large){
    poly(c,dark,[[27,27],[34,24],[40,27],[41,35],[37,40],[31,38],[28,35]]);
    poly(c,rim,[[30,28],[34,26],[39,28],[39,34],[36,38],[31,36]]);
    poly(c,core,[[32,29],[35,28],[37,30],[37,34],[35,36],[32,34]]);
    box(c,wind||e.guarded?'#ffd69d':'#e6a0bb',34,30,2,4);
  } else {
    const l=strike?7:0;box(c,dark,31,28,7+l,5);box(c,rim,33,29,5+l,2);box(c,light,36+l,29,2,1);
  }
  if(e.hurt>0){box(c,'#f49fbe',15,19,2,5);box(c,'#ffcee3',24,15,3,1);}
  c.restore();
  if(wind){
    const f=clamp(1-e.timer/e.windup,0,1);
    box(c,'#6c4356',15,2,18,2);box(c,light,15,2,Math.ceil(18*f),2);
    box(c,light,21,0,2,1);box(c,light,25,0,2,1);
  }
  if(strike){poly(c,'#f3a6af',[[34,24],[44,25],[47,29],[44,33],[36,35],[44,29]]);}
}
export function createActors(T,scene,sim){
  const tom=new Image();tom.src='./art/tom-original.png';
  const player=imagePlane(T,scene,48,2.88,2.7);
  const trail=imagePlane(T,scene,48,2.88,2.45);
  const attack=imagePlane(T,scene,48,3.35,2.9);
  const shades=new Map();
  let clock=0,last=0,wasGrounded=true,land=0,launch=0,lastFacing=1,turn=0,pace=0;
  function tomFrame(a,index,weapon=null){
    const c=a.c;c.clearRect(0,0,48,48);
    if(weapon)drawSword(c,...weapon);
    if(tom.complete&&tom.naturalWidth){
      // The final three original attack frames also contain the old swipe.
      // Keep the body pixels, leaving room for the replacement blade.
      const bodyWidth=index>=25?21:32;
      c.drawImage(tom,index*32,0,bodyWidth,32,11,14,bodyWidth,32);
    }
    a.tex.needsUpdate=true;
  }
  function update(t,cinema,quiet=false){
    const p=sim.player,dt=Math.max(0,Math.min(.10,t-last));clock+=dt;last=t;
    const phase=cinema?.pose;
    let state=p.hp<=0?'dead':p.hurt?'hurt':p.attack?'attack':!p.grounded?'jump':Math.abs(p.vx)>.12?'run':'idle';
    const facing=cinema?.facing??(p.attack?p.attackDirection:p.dash?p.dashDirection:p.facing);
    if(dt){
      if(p.grounded&&!wasGrounded)land=.17;
      if(!p.grounded&&wasGrounded&&p.vy>0)launch=.15;
      if(facing!==lastFacing)turn=.09;
      wasGrounded=p.grounded;lastFacing=facing;
      pace+=dt*Math.abs(p.vx??0)*1.77;
    }
    const list=frames[state],cycle=state==='run'?pace:clock*(state==='idle'?3:5);
    let index=list[Math.floor(cycle)%list.length],weapon=null;
    if(state==='attack'){
      const at=clamp(Math.floor((1-p.attack/p.attackDuration)*list.length),0,list.length-1);
      index=list[at];
      if(p.hasSword)weapon=at===1?[20,36,-2.35,13]:[30,35,[-.62,-2.35,-.44,.02,.38][at],17];
    } else if(p.hasSword&&state!=='dead')weapon=[20,37,-2.08,13];
    if(phase){index=phase==='reach'?23:phase==='raise'?15:1;weapon=phase==='raise'?[31,36,-.95,16]:null;}
    place(player,cinema?.x??p.x,cinema?.y??p.y,facing,40);
    let sx=1,sy=1;
    if(!quiet&&!phase&&state!=='attack'&&state!=='dead'){
      const settle=land/.17, lift=launch/.15;
      sx+=settle*.15-lift*.06+turn*.3;sy-=settle*.14-lift*.09;
      if(state==='idle')sy+=Math.sin(clock*3.8)*.025;
      if(state==='jump'&&Math.abs(p.vy)<1.5)sy+=.032;
    }
    player.mesh.scale.x*=sx;player.mesh.scale.y=sy;
    player.mesh.position.y+=(sy-1)*(40/48-.5)*player.size;
    land=Math.max(0,land-dt);launch=Math.max(0,launch-dt);turn=Math.max(0,turn-dt);
    tomFrame(player,index,weapon);
    player.mesh.material.opacity=!cinema&&p.invulnerable>0&&Math.sin(t*44)<-.34?.64:1;
    trail.mesh.visible=!!p.dash&&!cinema&&!quiet;
    if(trail.mesh.visible){place(trail,p.x-(facing||1)*.35,p.y,facing,40);tomFrame(trail,index,weapon);trail.mesh.material.opacity=.29;}
    attack.mesh.visible=p.attackPhase==='active'&&!cinema;
    if(attack.mesh.visible){
      place(attack,p.x+.56*facing,p.y,facing,40);const c=attack.c;c.clearRect(0,0,48,48);
      const b=p.combo===2?7:0;
      poly(c,'#9d5adca0',[[21,9+b],[34,11+b],[43,18+b],[42,24+b],[35,33],[25,35],[34,27],[37,20+b],[31,15+b]]);
      poly(c,'#f1baff',[[30,12+b],[39,15+b],[43,19+b],[41,24+b],[36,29],[38,23+b],[38,19+b]]);
      box(c,'#f5d7ff',42,18+b,3,2);box(c,'#b672d4',35,12+b,2,1);attack.tex.needsUpdate=true;
    }
    for(const [e,a] of shades)if(!sim.enemies.includes(e)){scene.remove(a.mesh);a.mesh.geometry.dispose();a.mesh.material.dispose();a.tex.dispose();shades.delete(e);}
    for(const e of sim.enemies){
      let a=shades.get(e);if(!a){a=imagePlane(T,scene,48,e.type==='curator'?2.86:e.type==='warden'?2.46:1.97,2.4);shades.set(e,a);}
      a.mesh.visible=e.active!==false&&e.hp>0;
      if(!a.mesh.visible||Math.abs(e.x-p.x)>27)continue;
      place(a,e.x,e.y,e.facing,42);a.c.clearRect(0,0,48,48);drawEnemy(a.c,e,clock);a.tex.needsUpdate=true;
    }
  }
  return {update};
}
