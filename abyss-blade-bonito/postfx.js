// Post-procesado para el backend WebGL: bloom, aberración cromática, luz del jugador, grade y grano.
// El render de Canvas 2D (sin WebGL 2) no pasa por aquí y queda igual.
export function createPostFX(THREE,renderer){
  const rt=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,samples:4});
  const mat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,
    uniforms:{t:{value:rt.texture},px:{value:new THREE.Vector2(1,1)},L:{value:new THREE.Vector2(.5,.4)},tm:{value:0},ca:{value:.012},as:{value:1.7},calm:{value:0},hit:{value:0}},
    vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader:`uniform sampler2D t;uniform vec2 px,L;uniform float tm,ca,as,calm,hit;varying vec2 v;
float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.,1.);}
void main(){
 vec2 c=v-.5;float d=dot(c,c);
 vec3 col=vec3(texture2D(t,v+c*d*ca).r,texture2D(t,v).g,texture2D(t,v-c*d*ca).b);
 vec3 b=vec3(0.);
 for(int i=0;i<16;i++){float a=float(i)*.3927;float r=i<8?9.:24.;b+=max(texture2D(t,v+vec2(cos(a),sin(a))*px*r).rgb-.7,0.);}
 col+=b/16.*1.1;
 float ld=length((v-L)*vec2(as,1.));float lit=smoothstep(.72,0.,ld);
 col*=mix(vec3(.88,.9,1.),vec3(1.1,1.03,.95),lit);
 col*=1.-smoothstep(.12,.5,d)*.34;
 float lu=dot(col,vec3(.3,.59,.11));col=mix(vec3(lu),col,1.0)+vec3(0.,.008,.022)*(1.-lu);
 col=mix(col,aces(col*1.08),.2);
 col+=(h(v/px*.01+tm*(1.-calm))-.5)*.02;
 col+=hit*vec3(.3,.03,.05);

 gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
}`});
  const ps=new THREE.Scene(),pc=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
  ps.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat));
  const s=new THREE.Vector2();
  function resize(){renderer.getDrawingBufferSize(s);rt.setSize(s.x,s.y);mat.uniforms.px.value.set(1/s.x,1/s.y);mat.uniforms.as.value=s.x/s.y}
  function render(scene,camera,o){
    const u=mat.uniforms;u.L.value.set(o.lx,o.ly);u.tm.value=o.t%10;u.calm.value=o.calm?1:0;u.ca.value=o.calm?.006:.012+Math.min(.03,o.fx*.03);u.hit.value=o.calm?0:Math.min(.5,o.flash||0);
    renderer.setRenderTarget(rt);renderer.render(scene,camera);renderer.setRenderTarget(null);renderer.render(ps,pc);
  }
  resize();return {render,resize};
}
