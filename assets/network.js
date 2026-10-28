(()=>{'use strict';
/* "A living network" — communities that rise slowly, nearby nodes link with faint edges,
   the cursor gently pushes nodes away and they spring back to their community. */
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const host=document.querySelector('#network-canvas');
if(!host)return;
let canvas=host;
if(host.tagName!=='CANVAS'){canvas=document.createElement('canvas');host.appendChild(canvas)}

function setupCanvas(canvas,render,resize){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  let active=false,frame=0,t=0,last=0;
  function measure(){
    const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
    const d=Math.min(devicePixelRatio||1,2);
    canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);
    ctx.setTransform(d,0,0,d,0,0);resize(r.width,r.height);render(ctx,t,true)
  }
  new ResizeObserver(measure).observe(canvas);
  function loop(now){
    if(!active)return;
    const dt=Math.min(40,now-(last||now));last=now;t+=dt/1000;
    render(ctx,t,false);frame=requestAnimationFrame(loop)
  }
  new IntersectionObserver(entries=>{
    active=entries[0].isIntersecting&&!reduced;
    if(active){last=0;frame=requestAnimationFrame(loop)}else cancelAnimationFrame(frame)
  }).observe(canvas);
  measure()
}

let W=0,H=0,S=1,nodes=[],edges=[],clusters=[],keys=new Set();
const mouse={x:-999,y:-999,tx:-999,ty:-999,active:false};
let lastT=0,seed=941;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sizes=[16,9,23,12,7,18,10,14];
const key=(i,j)=>i<j?i+','+j:j+','+i;

/* Edge reach scales with the canvas so small screens do not get overcrowded. */
function limitFor(e){
  const a=nodes[e.i],b=nodes[e.j];
  return S*(e.dynamic?125:(a.c===b.c?170:110))
}
function targetAlpha(e){
  const a=nodes[e.i],b=nodes[e.j],d=Math.hypot(a.x-b.x,a.y-b.y),L=limitFor(e);
  return d<L?.29*(1-d/L):0
}

function create(){
  seed=941;nodes=[];edges=[];clusters=[];keys=new Set();
  const C=clamp(Math.round(W/150),3,7);
  for(let c=0;c<C;c++){
    const R=(45+rand()*53)*S,cl={
      cx:(.09+.82*rand())*W,cy:rand()*H,R,vy:(5+rand()*6)*S,sway:rand()*6.28,list:[]
    };
    clusters.push(cl);
    for(let j=0;j<sizes[c];j++){
      const hub=j===0||(j===1&&rand()<.55),ang=rand()*Math.PI*2;
      /* hubs sit close to the community centre; the rest spread over the full radius */
      const rad=hub?R*(.12+.28*rand()):Math.sqrt(rand())*R;
      const n={c,hub,hx:Math.cos(ang)*rad,hy:Math.sin(ang)*rad,x:0,y:0,vx:0,vy:0,degree:0,phase:rand()*6.28};
      n.x=cl.cx+n.hx;n.y=cl.cy+n.hy;cl.list.push(nodes.length);nodes.push(n)
    }
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],same=a.c===b.c;
    const p=same?((a.hub||b.hub)?.78:.22):.005;
    if(rand()<p){edges.push({i,j,alpha:0});keys.add(key(i,j));a.degree++;b.degree++}
  }
  for(const e of edges)e.alpha=targetAlpha(e)
}

/* Resize keeps the same network: positions are rescaled instead of re-seeded. */
function resize(w,h){
  const C=clamp(Math.round(w/150),3,7),first=!nodes.length;
  const oldW=W,oldH=H,oldS=S;
  W=w;H=h;S=clamp(w/800,.55,1.1);
  if(first||C!==clusters.length){create();return}
  const fx=w/oldW,fy=h/oldH,fs=S/oldS;
  for(const c of clusters){c.cx*=fx;c.cy*=fy;c.R*=fs;c.vy*=fs}
  for(const n of nodes){n.x*=fx;n.y*=fy;n.hx*=fs;n.hy*=fs}
}

/* A whole community leaves through the top and re-enters below the canvas,
   so no single node ever jumps from top to bottom on screen. */
function recycle(c){
  const pad=c.R+30,newCy=H+pad,shift=newCy-c.cy;
  c.cy=newCy;
  const inC=new Set(c.list);
  for(const i of c.list){nodes[i].y+=shift;nodes[i].vy=0;nodes[i].vx=0}
  for(let k=edges.length-1;k>=0;k--){
    const e=edges[k];
    if(inC.has(e.i)||inC.has(e.j)){
      if(e.dynamic){keys.delete(key(e.i,e.j));edges.splice(k,1)}else e.alpha=0
    }
  }
}

function step(t,dt){
  mouse.x+=(mouse.tx-mouse.x)*Math.min(1,dt*3);
  mouse.y+=(mouse.ty-mouse.y)*Math.min(1,dt*3);
  const reach=130*S;
  for(const c of clusters){
    c.cy-=c.vy*dt;
    c.cx+=Math.sin(t*.17+c.sway)*1.5*S*dt;
    if(c.cy<-(c.R+30))recycle(c)
  }
  for(const n of nodes){
    const c=clusters[n.c];
    const tx=c.cx+n.hx+Math.sin(t*.45+n.phase)*3*S,ty=c.cy+n.hy+Math.cos(t*.38+n.phase)*3*S;
    const k=n.hub?26:16;                       /* hubs hold their place more firmly */
    let ax=(tx-n.x)*k,ay=(ty-n.y)*k;
    if(mouse.active){
      const mx=n.x-mouse.x,my=n.y-mouse.y,dist=Math.hypot(mx,my)||1,f=Math.max(0,1-dist/reach);
      ax+=mx/dist*f*f*520;ay+=my/dist*f*f*520
    }
    n.vx+=(ax-n.vx*8)*dt;n.vy+=(ay-n.vy*8)*dt;
    const sp=Math.hypot(n.vx,n.vy);
    if(sp>260){n.vx*=260/sp;n.vy*=260/sp}
    n.x+=n.vx*dt;n.y+=n.vy*dt
  }
  if(Math.floor(t*8)!==Math.floor((t-dt)*8)){
    for(let tries=0;tries<25;tries++){
      const i=Math.floor(rand()*nodes.length),j=Math.floor(rand()*nodes.length);
      if(i===j)continue;
      const a=Math.min(i,j),b=Math.max(i,j),kk=a+','+b;
      if(keys.has(kk))continue;
      const n=nodes[a],m=nodes[b];
      if(Math.hypot(n.x-m.x,n.y-m.y)<105*S&&rand()<.25){edges.push({i:a,j:b,alpha:0,dynamic:true});keys.add(kk)}
    }
  }
}

function draw(ctx,t,fromResize){
  if(!W||!H)return;
  const dt=fromResize?0:clamp(t-lastT,.005,.04);
  lastT=t;
  if(!reduced&&dt>0)step(t,dt);
  ctx.clearRect(0,0,W,H);
  for(let k=edges.length-1;k>=0;k--){
    const e=edges[k],a=nodes[e.i],b=nodes[e.j];
    const d=Math.hypot(a.x-b.x,a.y-b.y),L=limitFor(e);
    e.alpha+=((d<L?.29*(1-d/L):0)-e.alpha)*.06;
    if(e.dynamic&&d>L+45*S){keys.delete(key(e.i,e.j));edges.splice(k,1);continue}
    if(e.alpha<.006)continue;
    ctx.strokeStyle=`rgba(130,130,130,${e.alpha})`;ctx.lineWidth=.9;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()
  }
  /* node sizes: hubs stay modest so small nodes remain readable at every scale */
  const sc=clamp(S,.8,1.1);
  for(const n of nodes){
    const r=n.hub?(2.8+Math.min(3.4,Math.sqrt(n.degree)*.85))*sc:(1.5+Math.min(1.1,Math.sqrt(n.degree)*.3))*sc;
    ctx.fillStyle=n.hub?'rgba(181,39,53,.77)':'rgba(130,130,130,.57)';
    ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fill()
  }
}

setupCanvas(canvas,draw,resize);
const pos=e=>{const r=canvas.getBoundingClientRect();mouse.tx=e.clientX-r.left;mouse.ty=e.clientY-r.top;if(!mouse.active){mouse.x=mouse.tx;mouse.y=mouse.ty}mouse.active=true};
const off=()=>{mouse.active=false;mouse.tx=-999;mouse.ty=-999};
canvas.addEventListener('pointermove',pos,{passive:true});
canvas.addEventListener('pointerleave',off);
canvas.addEventListener('pointercancel',off);
canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')off()});
})();
