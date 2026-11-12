export function createLandmarks(T,scene,level){
  const all=[];
  function prop(kind,x,y,name,w,h){
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=96;
    const c=canvas.getContext('2d'),t=new T.CanvasTexture(canvas);
    t.colorSpace=T.SRGBColorSpace;t.magFilter=t.minFilter=T.NearestFilter;t.generateMipmaps=false;
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),new T.MeshBasicMaterial({map:t,transparent:true,depthWrite:false}));
    mesh.position.set(x,y+h/2,kind==='gate'?1.1:1.15);mesh.renderOrder=9;scene.add(mesh);
    const o={kind,x,y,name,mesh,c,t,state:null};all.push(o);return o;
  }
  function pixel(c,col,x,y,w,h){c.fillStyle=col;c.fillRect(x,y,w,h);}
  function paint(o,on){
    const c=o.c;c.clearRect(0,0,64,96);
    const light=on?'#ffe3ab':'#9b72bc', dim=on?'#cfa16c':'#5d4b83';
    if(o.kind==='gate'){
      pixel(c,'#2d2439',2,0,60,96);
      for(let i=0;i<5;i++){pixel(c,'#524261',4+i*12,0,7,96);pixel(c,'#887195',5+i*12,0,1,96);}
      for(let i=8;i<96;i+=16){pixel(c,'#1b1529',0,i,64,3);pixel(c,dim,20,i+3,24,1);}
      pixel(c,light,27,84,10,3);
    }else if(o.kind==='altar'){
      pixel(c,'#242034',3,86,58,10);pixel(c,'#5a4562',10,78,44,11);pixel(c,'#8a6c8e',7,77,50,4);
      pixel(c,'#382840',17,81,30,4);
    }else if(o.kind==='station'){
      const glow=c.createRadialGradient(32,26,2,32,26,28);glow.addColorStop(0,on?'#ffd2909c':'#a67bd184');glow.addColorStop(1,'#aa86d000');c.fillStyle=glow;c.fillRect(0,0,64,63);
      pixel(c,'#302640',10,90,44,6);pixel(c,'#685575',16,83,32,9);pixel(c,'#362b49',24,50,16,34);
      pixel(c,'#786089',27,48,4,34);pixel(c,dim,16,27,32,25);pixel(c,'#221a34',21,21,22,27);
      pixel(c,light,28,19,8,24);pixel(c,light,24,27,16,8);pixel(c,'#fbe7f5',30,26,4,8);
    }else if(o.kind==='merchant'){
      pixel(c,'#2f223f',5,78,54,16);pixel(c,'#896359',6,78,52,6);
      pixel(c,'#594263',17,42,26,37);pixel(c,'#2b213e',19,32,24,21);
      pixel(c,'#a17cb1',16,24,31,13);pixel(c,'#dcc7b2',25,40,16,10);
      pixel(c,'#211827',29,42,3,2);pixel(c,'#211827',36,42,3,2);
      pixel(c,'#a287ae',22,49,22,6);pixel(c,'#ddbe8c',8,57,9,14);
      pixel(c,'#f8db8e',11,59,4,8);pixel(c,'#bd85c9',48,64,7,8);
    }else if(o.kind==='portal'){
      pixel(c,'#2a223d',6,34,52,62);pixel(c,'#2a223d',13,23,38,15);pixel(c,'#2a223d',21,15,22,14);
      pixel(c,'#6b567f',12,38,4,55);pixel(c,'#6b567f',48,38,4,55);pixel(c,'#856c93',20,30,24,6);
      pixel(c,on?'#30274d':'#181827',18,39,28,54);
      pixel(c,light,28,48,8,2);pixel(c,light,30,46,4,6);pixel(c,'#69577c',7,92,50,4);
    }else if(o.kind==='echo'){
      const glow=c.createRadialGradient(32,43,4,32,43,28);glow.addColorStop(0,'#c8a0e0a0');glow.addColorStop(1,'#8760aa00');c.fillStyle=glow;c.fillRect(0,12,64,76);
      pixel(c,'#6b50879c',21,31,22,34);pixel(c,'#cba4e8',25,25,14,17);pixel(c,'#f3dffb',26,33,4,3);pixel(c,'#f3dffb',35,33,4,3);
      pixel(c,'#9676b8a0',24,64,16,12);pixel(c,'#ae8dc7a0',27,80,10,4);
    }else{
      pixel(c,'#292039',12,84,40,12);pixel(c,'#6d537d',16,54,32,33);pixel(c,'#9b7da9',14,51,36,5);
      pixel(c,'#3d2d53',19,22,26,32);pixel(c,dim,17,19,30,4);
      c.font='bold 22px sans-serif';c.textAlign='center';c.fillStyle=light;c.fillText(o.name,32,46);
    }
    o.t.needsUpdate=true;o.state=on;
  }
  const stations=level.stations.map(s=>({...s,o:prop('station',s.x,s.y,s.name,1.26,2.05)}));
  const puzzles=level.puzzles.flatMap(p=>[...p.switches.map((s,i)=>({...s,p,i,o:prop('switch',s.x,s.y,s.icon,.80,1.30)})),{p,i:-1,o:prop('clue',p.clue.x,p.clue.y,'≋',.95,1.25)}]);
  const routes=level.portals.map(d=>({d,o:prop('portal',d.x,d.y,'',1.95,2.55)}));
  const relics=level.relics.map(r=>({r,o:prop('relic',r.x,r.y,r.icon,.9,1.38)}));
  const merchants=level.merchants.map(m=>prop('merchant',m.x,m.y,'',1.85,2.12));
  const gates=level.platforms.filter(g=>g.gateId).map(g=>({...g,o:prop('gate',g.x+g.w/2,g.y,'',g.w,g.h)}));
  const echoes=[...level.echoes,level.exit].map(e=>prop('echo',e.x,e.y,'',1.05,1.7));
  const altar=prop('altar',level.sword.x,level.sword.y,'',1.45,.64);
  const sword=prop('sword',level.sword.x,level.sword.y+.45,'',.85,1.8);
  const c=sword.c;c.clearRect(0,0,64,96);pixel(c,'#35223d',27,10,10,20);pixel(c,'#c6a28e',13,30,39,7);pixel(c,'#8c5da5',22,37,22,35);pixel(c,'#dcbde7',27,36,13,42);pixel(c,'#f9d8f7',29,77,7,9);sword.t.needsUpdate=true;
  function update(t,journey,hasSword,cinema,sim){
    for(const {d,o} of routes){const on=!d.requires?.some(id=>!journey.relics.has(id));if(o.state!==on)paint(o,on);}
    for(const {r,o} of relics){o.mesh.visible=!journey.relics.has(r.id);if(o.state===null)paint(o,true);}
    for(const o of merchants)if(o.state===null)paint(o,true);
    for(const s of stations){const on=journey.unlocked.has(s.id);if(s.o.state!==on)paint(s.o,on);}
    for(const a of puzzles){const on=a.i<0?journey.clues.has(a.p.id):(journey.progress.get(a.p.id)||0)>a.p.order.indexOf(a.id);if(a.o.state!==on)paint(a.o,on);}
    for(const g of gates){g.o.mesh.visible=!sim.isGateOpen(g.gateId);if(g.o.state===null)paint(g.o,false);}
    for(const e of echoes){e.mesh.position.y=e.y+.92+Math.sin(t*2+e.x)*.07;e.mesh.visible=hasSword;if(e.state===null)paint(e,true);}
    if(altar.state===null)paint(altar,false);
    sword.mesh.visible=!hasSword&&(!cinema||cinema.t<1.7);sword.mesh.rotation.z=cinema?Math.sin(cinema.t*2.1)*.08:-.09;
    sword.mesh.position.y=sword.y+.9+(cinema?Math.min(.76,Math.max(0,cinema.t-.55)*.8):0);
  }
  return {update};
}
