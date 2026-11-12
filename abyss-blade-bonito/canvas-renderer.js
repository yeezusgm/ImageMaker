// Orthographic Canvas 2D backend for systems where WebGL 2 is unavailable.
// Both backends consume the same Three.js scene graph and simulation.
export function createCanvasRenderer(THREE) {
  const domElement=document.createElement('canvas');
  const c=domElement.getContext('2d',{alpha:false});
  if(!c) throw new Error('Canvas 2D is unavailable');
  const tintCache=new WeakMap();
  let cssWidth=1,cssHeight=1,ratio=1;
  const maxOpacity=(n)=>Math.max(0,Math.min(1,n));
  const color=new THREE.Color(), point=new THREE.Vector3();
  const keyFor=t=>{
    const val=t.getHex();
    if(val===0xffffff)return val;
    const step=n=>Math.min(255,Math.round(n/12)*12);
    return (step(val>>16)<<16)|(step((val>>8)&255)<<8)|step(val&255);
  };
  const hex=n=>'#'+n.toString(16).padStart(6,'0');
  function resize() {
    const width=Math.max(1,Math.round(cssWidth*ratio)),height=Math.max(1,Math.round(cssHeight*ratio));
    if(domElement.width!==width||domElement.height!==height){domElement.width=width;domElement.height=height;}
    domElement.style.width=cssWidth+'px';domElement.style.height=cssHeight+'px';
  }
  function tinted(image,material){
    const key=keyFor(material.color);
    if(key===0xffffff||!image.width||!image.height)return image;
    let entry=tintCache.get(image);
    if(entry?.key===key)return entry.canvas;
    if(!entry){
      const canvas=document.createElement('canvas');
      canvas.width=image.width;canvas.height=image.height;
      entry={canvas,ctx:canvas.getContext('2d')};
      tintCache.set(image,entry);
    }
    const {canvas,ctx}=entry;
    entry.key=key;
    ctx.globalCompositeOperation='copy';
    ctx.drawImage(image,0,0);
    ctx.globalCompositeOperation='multiply';ctx.fillStyle=hex(key);ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.globalCompositeOperation='destination-in';ctx.drawImage(image,0,0);
    return canvas;
  }
  function uvSegments(offset,repeat,wrap){
    const list=[];
    if(repeat<=0)return list;
    if(wrap===THREE.ClampToEdgeWrapping){
      list.push([0,1,Math.max(0,offset),Math.min(1,offset+repeat),false]);
      return list;
    }
    for(let tile=Math.floor(offset);tile<offset+repeat;tile++){
      const lo=Math.max(offset,tile),hi=Math.min(offset+repeat,tile+1);
      if(hi-lo<.00001)continue;
      const a=lo-tile,b=hi-tile,flip=wrap===THREE.MirroredRepeatWrapping&&Math.abs(tile%2)===1;
      list.push([(lo-offset)/repeat,(hi-offset)/repeat,flip?1-b:a,flip?1-a:b,flip]);
    }
    return list;
  }
  function mapped(map,img,w,h){
    c.imageSmoothingEnabled=map.magFilter!==THREE.NearestFilter;
    if(map.offset.x===0&&map.offset.y===0&&map.repeat.x===1&&map.repeat.y===1){
      c.drawImage(img,-w/2,-h/2,w,h);
      return;
    }
    const width=img.width,height=img.height;
    const xs=uvSegments(map.offset.x,map.repeat.x,map.wrapS);
    const ys=uvSegments(1-map.offset.y-map.repeat.y,map.repeat.y,map.wrapT);
    for(const [x0,x1,u0,u1,flipX] of xs)for(const [y0,y1,v0,v1,flipY] of ys){
      const dx=(x0-.5)*w,dy=(y0-.5)*h,dw=(x1-x0)*w,dh=(y1-y0)*h;
      if(u1<=u0||v1<=v0)continue;
      if(flipX||flipY){
        c.save();c.translate(dx+(flipX?dw:0),dy+(flipY?dh:0));c.scale(flipX?-1:1,flipY?-1:1);
        c.drawImage(img,u0*width,v0*height,(u1-u0)*width,(v1-v0)*height,0,0,dw+.001,dh);
        c.restore();
      }else c.drawImage(img,u0*width,v0*height,(u1-u0)*width,(v1-v0)*height,dx,dy,dw+.001,dh);
    }
  }
  function shape(type,radius,fill) {
    const grad=c.createLinearGradient(0,-radius,0,radius);
    grad.addColorStop(0,'#fff2eb');grad.addColorStop(.4,fill);grad.addColorStop(1,type==='IcosahedronGeometry'?'#6c323f':'#714694');
    c.fillStyle=grad;
    c.beginPath();
    if(type==='IcosahedronGeometry'){
      c.moveTo(0,-radius*.58);c.bezierCurveTo(-radius*1.25,-radius*1.28,-radius*1.21,radius*.4,-radius*.42,radius*.86);c.quadraticCurveTo(0,radius*.71,radius*.39,radius*.86);
      c.bezierCurveTo(radius*1.12,radius*.52,radius*1.24,-radius*1.34,0,-radius*.58);c.fill();
      c.strokeStyle='#bbaf73';c.lineWidth=radius*.11;c.beginPath();c.moveTo(0,-radius*.58);c.lineTo(radius*.15,-radius*.96);c.stroke();
      c.fillStyle='#9ea065';c.beginPath();c.ellipse(radius*.33,-radius*.88,radius*.29,radius*.13,-.45,0,Math.PI*2);c.fill();
    }else{
      c.moveTo(0,-radius);c.lineTo(radius*.82,-radius*.1);c.lineTo(radius*.55,radius*.53);c.lineTo(0,radius);c.lineTo(-radius*.84,.05*radius);c.closePath();c.fill();
      c.fillStyle='rgba(253,237,255,.55)';c.beginPath();c.moveTo(0,-radius);c.lineTo(-radius*.16,.25*radius);c.lineTo(-radius*.84,.05*radius);c.closePath();c.fill();
    }
  }
  function render(scene,camera){
    scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    const sw=domElement.width,sh=domElement.height;
    const sx=sw*camera.zoom/(camera.right-camera.left),sy=sh*camera.zoom/(camera.top-camera.bottom);
    const ox=sw/2-(camera.position.x+(camera.left+camera.right)/2)*sx;
    const oy=sh/2+(camera.position.y+(camera.top+camera.bottom)/2)*sy;
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='source-over';
    c.fillStyle=scene.background?.isColor?'#'+scene.background.getHexString():'#101020';
    c.fillRect(0,0,sw,sh);
    const draw=[];
    scene.traverseVisible(o=>{if((o.isMesh||o.isPoints)&&o.material?.visible)draw.push(o);});
    draw.sort((a,b)=>a.matrixWorld.elements[14]-b.matrixWorld.elements[14]||a.renderOrder-b.renderOrder);
    for(const o of draw){
      const material=o.material, geo=o.geometry, m=o.matrixWorld.elements, p=geo.parameters;
      const opacity=maxOpacity(material.opacity??1);
      if(opacity<.002)continue;
      c.globalAlpha=opacity;
      c.globalCompositeOperation=material.blending===THREE.AdditiveBlending?'lighter':'source-over';
      if(o.isPoints){
        c.setTransform(1,0,0,1,0,0);
        const {position:pos,color:cols}=geo.attributes;
        const start=geo.drawRange.start, end=Math.min(pos.count,start+geo.drawRange.count);
        const size=Math.max(.9,material.size*ratio*.76);
        for(let i=start;i<end;i++){
          point.fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld);
          const x=ox+point.x*sx,y=oy-point.y*sy;
          if(x<-size||y<-size||x>sw+size||y>sh+size)continue;
          if(cols)color.fromBufferAttribute(cols,i);else color.copy(material.color);
          c.fillStyle='#'+color.getHexString();
          c.fillRect(x-size/2,y-size/2,size,size);
        }
        continue;
      }
      const x=ox+m[12]*sx,y=oy-m[13]*sy;
      const extentX=(Math.abs(m[0])+Math.abs(m[4]))*(p?.width||2*(p?.radius??1))*sx*.5;
      const extentY=(Math.abs(m[1])+Math.abs(m[5]))*(p?.height||2*(p?.radius??1))*sy*.5;
      if(x+extentX<0||x-extentX>sw||y+extentY<0||y-extentY>sh)continue;
      if(!p)continue;
      c.setTransform(m[0]*sx,-m[1]*sy,-m[4]*sx,m[5]*sy,x,y);
      if(geo.type==='PlaneGeometry'){
        const img=material.map?.image;
        if(img?.width&&img?.height) mapped(material.map,tinted(img,material),p.width,p.height);
        else {c.fillStyle='#'+material.color.getHexString();c.fillRect(-p.width/2,-p.height/2,p.width,p.height);}
      } else if(geo.type==='CircleGeometry'){
        const fill='#'+material.color.getHexString();
        const g=c.createRadialGradient(0,0,0,0,0,p.radius);
        g.addColorStop(0,fill);g.addColorStop(1,fill+'00');
        c.fillStyle=g;c.beginPath();c.arc(0,0,p.radius,0,Math.PI*2);c.fill();
      } else if(geo.type==='IcosahedronGeometry'||geo.type==='OctahedronGeometry'){
        shape(geo.type,p.radius,'#'+material.color.getHexString());
      }
    }
  }
  return {domElement,setSize(w,h){cssWidth=w;cssHeight=h;resize();},setPixelRatio(next){ratio=Math.min(next||1,1.6);resize();},render,outputColorSpace:THREE.SRGBColorSpace};
}
