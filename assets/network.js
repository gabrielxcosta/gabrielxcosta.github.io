(()=>{'use strict';
/* "A living network" — soft stochastic communities drift upward, nearby nodes link with
   translucent edges, and the cursor gently reshapes the neighbourhoods. */
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
const mouse={x:-900,y:-900,tx:-900,ty:-900,active:false};
let lastT=0,seed=941;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sizes=[16,9,23,12,7,18,10,14];
const key=(i,j)=>i<j?i+','+j:j+','+i;
const clusterCount=w=>w<500?4:6;

/* Edge reach follows the canvas scale so narrow screens are not overcrowded. */
const limitFor=e=>S*(e.dynamic?125:(nodes[e.i].c===nodes[e.j].c?170:110));
const targetAlpha=(e,d)=>{const L=limitFor(e);return d<L?.29*(1-d/L):0};

function create(){
  seed=941;nodes=[];edges=[];clusters=[];keys=new Set();
  for(let c=0;c<clusterCount(W);c++){
    const R=(45+rand()*53)*S,cl={cx:(.09+.82*rand())*W,cy:rand()*H,R,vy:(5+rand()*6)*S,sway:rand()*6.28,list:[]};
    clusters.push(cl);
    for(let j=0;j<sizes[c];j++){
      const ang=rand()*Math.PI*2,rad=Math.sqrt(rand())*R;
      cl.list.push(nodes.length);
      nodes.push({c,hub:j===0||(j===1&&rand()<.55),x:cl.cx+Math.cos(ang)*rad,y:cl.cy+Math.sin(ang)*rad,vx:0,vy:0,degree:0,phase:rand()*6.28})
    }
  }
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j],same=a.c===b.c;
    if(rand()<(same?((a.hub||b.hub)?.78:.22):.005)){edges.push({i,j,alpha:0});keys.add(key(i,j));a.degree++;b.degree++}
  }
  /* settle the random start so the cloud does not rush inward on first paint */
  if(!reduced)for(let i=-300;i<0;i++)step(i/60,1/60);
  for(const e of edges)e.alpha=targetAlpha(e,Math.hypot(nodes[e.i].x-nodes[e.j].x,nodes[e.i].y-nodes[e.j].y))
}

/* Resizing keeps the same network: positions are rescaled instead of re-seeded. */
function resize(w,h){
  const first=!nodes.length,oldW=W,oldH=H,oldS=S;
  W=w;H=h;S=clamp(w/800,.6,1.1);
  if(first||clusterCount(w)!==clusters.length){create();return}
  const fx=w/oldW,fy=h/oldH,fs=S/oldS;
  for(const c of clusters){c.cx*=fx;c.cy*=fy;c.R*=fs;c.vy*=fs}
  for(const n of nodes){n.x*=fx;n.y*=fy}
}

/* A community leaves through the top as a whole and re-enters below the canvas as a whole,
   keeping its shape, so no node ever falls from top to bottom across the screen. */
function recycle(c){
  const ext=c.R*1.5+12,shift=(H+ext)-c.cy;
  c.cy+=shift;
  const inC=new Set(c.list);
  for(const i of c.list)nodes[i].y+=shift;
  for(let k=edges.length-1;k>=0;k--){
    const e=edges[k];
    if(inC.has(e.i)||inC.has(e.j)){if(e.dynamic){keys.delete(key(e.i,e.j));edges.splice(k,1)}else e.alpha=0}
  }
}

function step(t,dt){
  const k=dt*60;                                    /* physics tuned per 60 Hz frame */
  const damp=Math.pow(.977,k);
  mouse.x+=(mouse.tx-mouse.x)*(1-Math.pow(1-.045,k));
  mouse.y+=(mouse.ty-mouse.y)*(1-Math.pow(1-.045,k));
  for(const c of clusters){
    c.cy-=c.vy*dt;
    c.cx+=Math.sin(t*.17+c.sway)*.025*k;
    if(c.cy<-(c.R*1.5+12))recycle(c)
  }
  const reach=150*S;
  for(const n of nodes){
    const c=clusters[n.c],dx=c.cx-n.x,dy=c.cy-n.y,dist0=Math.hypot(dx,dy)||1;
    const spring=n.hub?.0018:.0006;                  /* hubs stay closer to their community */
    let ax=dx*spring,ay=dy*spring-.005*S;
    const lim=c.R*1.35;                              /* soft tether: nothing wanders off alone */
    if(dist0>lim){const pull=(dist0-lim)*.004;ax+=dx/dist0*pull;ay+=dy/dist0*pull}
    if(mouse.active){
      const mx=n.x-mouse.x,my=n.y-mouse.y,d=Math.hypot(mx,my)||1,f=Math.max(0,1-d/reach);
      ax+=mx/d*f*.04;ay+=my/d*f*.04
    }
    n.vx=(n.vx+ax*k)*damp;n.vy=(n.vy+ay*k)*damp;
    const sp=Math.hypot(n.vx,n.vy);if(sp>1.6){n.vx*=1.6/sp;n.vy*=1.6/sp}
    n.x+=n.vx*k;n.y+=n.vy*k
  }
  if(Math.floor(t*8)!==Math.floor((t-dt)*8)){
    for(let tries=0;tries<25;tries++){
      const i=Math.floor(rand()*nodes.length),j=Math.floor(rand()*nodes.length);
      if(i===j)continue;
      const a=Math.min(i,j),b=Math.max(i,j),kk=a+','+b;
      if(keys.has(kk))continue;
      if(Math.hypot(nodes[a].x-nodes[b].x,nodes[a].y-nodes[b].y)<105*S&&rand()<.25){edges.push({i:a,j:b,alpha:0,dynamic:true});keys.add(kk)}
    }
  }
}

function draw(ctx,t,fromResize){
  if(!W||!H)return;
  const dt=fromResize?0:clamp(t-lastT,.005,.04);
  lastT=t;
  if(!reduced&&dt>0)step(t,dt);
  const ease=1-Math.pow(.94,Math.max(dt,.001)*60);
  ctx.clearRect(0,0,W,H);
  for(let k=edges.length-1;k>=0;k--){
    const e=edges[k],a=nodes[e.i],b=nodes[e.j],d=Math.hypot(a.x-b.x,a.y-b.y);
    e.alpha+=(targetAlpha(e,d)-e.alpha)*ease;
    if(e.dynamic&&d>limitFor(e)+45*S){keys.delete(key(e.i,e.j));edges.splice(k,1);continue}
    if(e.alpha<.006)continue;
    ctx.strokeStyle=`rgba(130,130,130,${e.alpha})`;ctx.lineWidth=.9;
    ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke()
  }
  /* hubs stay modest in scale so the smaller nodes are never crushed */
  const sc=clamp(S,.8,1.1);
  for(const n of nodes){
    const r=(n.hub?2.6+Math.min(3.6,Math.sqrt(n.degree)*.9):1.6+Math.min(1.4,Math.sqrt(n.degree)*.3))*sc;
    ctx.fillStyle=n.hub?'rgba(181,39,53,.77)':'rgba(130,130,130,.57)';
    ctx.beginPath();ctx.arc(n.x,n.y,r,0,Math.PI*2);ctx.fill()
  }
}

setupCanvas(canvas,draw,resize);
const pos=e=>{const r=canvas.getBoundingClientRect();mouse.tx=e.clientX-r.left;mouse.ty=e.clientY-r.top;if(!mouse.active){mouse.x=mouse.tx;mouse.y=mouse.ty}mouse.active=true};
const off=()=>{mouse.active=false;mouse.tx=-900;mouse.ty=-900};
canvas.addEventListener('pointermove',pos,{passive:true});
canvas.addEventListener('pointerleave',off);
canvas.addEventListener('pointercancel',off);
canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')off()});
})();
