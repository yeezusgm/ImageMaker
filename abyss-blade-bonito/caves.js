const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const p=clamp(x);return p*p*(3-2*p);};
export function caveLight(zones,x){
  let cave=0,cyan=0,darkness=0;
  for(const zone of zones){
    const a=smooth((x-zone.x)/zone.fadeIn)*smooth((zone.end-x)/zone.fadeOut);
    if(zone.palette==='cave')cave=Math.max(cave,a);else cyan=Math.max(cyan,a);
    darkness=Math.max(darkness,a*zone.darkness);
  }
  return {cave,cyan,darkness};
}
export function createCaves(T,scene){
  const random=seed=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function texture(paint,w=480,h=248){
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const c=canvas.getContext('2d');paint(c,w,h);
    const map=new T.CanvasTexture(canvas);map.colorSpace=T.SRGBColorSpace;map.magFilter=T.NearestFilter;map.minFilter=T.LinearFilter;map.wrapS=T.MirroredRepeatWrapping;map.generateMipmaps=false;
    return map;
  }
  function plane(map,z,order,blend=T.NormalBlending){
    const m=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,blending:blend}));
    m.position.z=z;m.renderOrder=order;scene.add(m);return m;
  }
  function polygon(c,color,points){c.fillStyle=color;c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill();}
  function walls(c,w,h,teal){
    const r=random(teal?499:5831);
    const sky=c.createLinearGradient(0,0,0,h);
    const colors=teal?['#1e414f','#447685','#214950']:['#191a29','#252239','#151525'];
    colors.forEach((col,i)=>sky.addColorStop(i/2,col));c.fillStyle=sky;c.fillRect(0,0,w,h);
    for(let pass=0;pass<3;pass++){
      for(let x=-10;x<w;x+=14+Math.floor(r()*28)){
        const top=24+Math.floor(r()*35)+pass*31, sw=9+Math.floor(r()*23);
        c.fillStyle=teal?['#6c939d32','#1a445c48','#284c5a74'][pass]:['#66557823','#1c172c65','#100f2080'][pass];
        c.fillRect(x,top,sw,h-top);c.fillRect(x+3,top-8,Math.max(2,sw-5),9);
      }
    }
    const shade=c.createLinearGradient(0,h*.45,0,h);shade.addColorStop(0,'#081a2b00');shade.addColorStop(1,teal?'#123a4668':'#0b0915bd');c.fillStyle=shade;c.fillRect(0,0,w,h);
    for(let i=0;i<260;i++){c.fillStyle=teal?'#c3f1e923':'#b39abd23';c.fillRect(Math.floor(r()*w),Math.floor(r()*h),1,i%7===0?2:1);}
  }
  const dark=plane(texture((c,w,h)=>walls(c,w,h,false)),-11,-110);
  const cyan=plane(texture((c,w,h)=>{
    walls(c,w,h,true);
    // Stepped, broken skylight and a soft cyan bloom, behind the play space.
    const shaft=[[177,0],[296,0],[296,13],[278,13],[278,26],[262,26],[262,42],[246,42],[246,59],[222,59],[222,75],[211,75],[211,90],[193,90],[193,106],[178,106],[178,125],[159,125],[159,145],[141,145],[141,157],[121,157],[121,144],[130,144],[130,126],[143,126],[143,108],[155,108],[155,90],[168,90],[168,71],[187,71],[187,51],[192,51],[192,37],[177,37]];
    const mist=c.createRadialGradient(202,70,14,202,70,137);
    mist.addColorStop(0,'#cef8f7b5');mist.addColorStop(.52,'#8fcfdf58');mist.addColorStop(1,'#8fcfdf00');c.fillStyle=mist;c.fillRect(0,0,w,h);
    c.save();c.shadowColor='#c4faff';c.shadowBlur=17;polygon(c,'#b6eef2',shaft);c.restore();
    c.save();c.globalAlpha=.65;c.translate(10,2);c.scale(.95,.95);polygon(c,'#e7ffff',shaft);c.restore();
    polygon(c,'#b3e0e61b',[[222,47],[250,42],[367,218],[302,218]]);
    polygon(c,'#c4eced22',[[188,71],[206,58],[155,240],[91,240]]);
    polygon(c,'#9bdbe51a',[[248,17],[268,16],[431,212],[386,214]]);
  }),-10,-109);
  const near=plane(texture((c,w,h)=>{
    polygon(c,'#132b3b',[[0,0],[118,0],[115,13],[85,16],[77,29],[58,30],[54,43],[31,52],[0,55]]);
    polygon(c,'#152e41',[[315,0],[w,0],[w,77],[449,60],[423,57],[421,44],[393,40],[394,31],[368,26],[355,11]]);
    polygon(c,'#1a3548',[[0,92],[92,118],[113,119],[125,110],[104,135],[0,112]]);
    polygon(c,'#112c3e',[[w,111],[418,104],[380,84],[357,84],[371,99],[419,124],[w,140]]);
    polygon(c,'#26435794',[[44,0],[63,0],[55,24],[53,64],[45,85],[43,112],[39,122],[34,99],[36,60],[34,41]]);
    polygon(c,'#284b5c9b',[[374,0],[389,0],[395,42],[390,72],[398,107],[394,143],[388,156],[382,113],[381,89],[374,62]]);
  }),-8,-108);
  const halo=plane(texture((c,w,h)=>{
    const g=c.createRadialGradient(w/2,h/2,1,w/2,h/2,w/2);
    [[0,'#fff2ca66'],[.29,'#ffe5b744'],[.57,'#a6e8ee20'],[1,'#c5ebff00']].forEach(([at,col])=>g.addColorStop(at,col));
    c.fillStyle=g;c.fillRect(0,0,w,h);
  },128,128),2.55,54,T.AdditiveBlending);
  function frame(m,alpha,x,y,vw,vh,shift,speed){
    m.visible=alpha>.001;if(!m.visible)return;
    m.material.opacity=alpha;m.position.x=x;m.position.y=y;
    m.scale.set(vw*1.08,vh*1.10,1);
    m.material.map.repeat.x=Math.min(.95,(vw/vh)/(480/248));m.material.map.offset.x=shift+x*speed;
  }
  function update(t,region,cameraX,cameraY,vw,vh,p,quiet){
    frame(dark,region.cave,cameraX,cameraY,vw,vh,.20,.009);
    frame(cyan,region.cyan,cameraX,cameraY,vw,vh,-1.707,.0068);
    frame(near,region.cyan*.76,cameraX,cameraY,vw,vh,-3.68,.016);
    halo.visible=region.darkness>.015;
    if(halo.visible){
      const size=4.25+(quiet?0:Math.sin(t*2.2)*.14);
      halo.position.x=p.x;halo.position.y=p.y+.68;halo.scale.set(size,size,1);
      halo.material.opacity=clamp(region.darkness*1.12);
    }
  }
  return {update};
}
