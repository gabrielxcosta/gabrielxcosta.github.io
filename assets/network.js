(()=>{'use strict';
/* "A living network" — a handful of fragments (communities) rise slowly, like the particles on
   networksciencebook.com. Nodes of the same fragment link at a short distance; nodes of
   different fragments only link when they come closer than a stricter threshold. */
const host=document.querySelector('#network-canvas');
if(!host)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- tuning (distances in px at the 800 px reference width) ---------- */
const CFG={
  areaPerNode:7200, minNodes:22, maxNodes:56,   /* node count follows the canvas area */
  reachSame:66,                                 /* link threshold inside a fragment */
  reachCross:56,                                /* link threshold between different fragments */
  alphaSame:.38, alphaCross:.22,                /* maximum line opacity */
  grabReach:140,                                /* cursor links */
  rise:[5,10],                                  /* fragment speed, px/s */
  drift:5,                                      /* sideways wander of fragments, px/s */
  grey:'130,130,130', hub:'181,39,53'
};
const B=5;                                      /* line opacity buckets: one stroke per bucket */
const ALPHAS=Array.from({length:B},(_,b)=>`rgba(${CFG.grey},${((b+.5)/B*CFG.alphaSame).toFixed(3)})`);

/* ---------- canvas ---------- */
let canvas=host;
if(host.tagName!=='CANVAS'){
  canvas=document.createElement('canvas');
  canvas.style.cssText='display:block;width:100%;height:100%';
  host.appendChild(canvas);
  if(host.getBoundingClientRect().height<50)host.style.height='clamp(260px,38vw,380px)';
  host.style.position=host.style.position||'relative';host.style.overflow='hidden'
}
const ctx=canvas.getContext('2d');
if(!ctx)return;

/* ---------- model ---------- */
let W=0,H=0,S=1,N=0,F=0,dpr=1;
let X,Y,VX,VY,HX,HY,FR,HUB,R0,PH,frags=[],segs=[],segN=new Int32Array(B);
const mouse={x:-9e3,y:-9e3,tx:-9e3,ty:-9e3,on:false};
let seed=941;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const targets=(w,h)=>({
  n:clamp(Math.round(w*h/CFG.areaPerNode),CFG.minNodes,CFG.maxNodes),
  f:clamp(Math.round(w/210),3,5)
});

function build(n,f){
  seed=941;N=n;F=f;
  X=new Float32Array(N);Y=new Float32Array(N);VX=new Float32Array(N);VY=new Float32Array(N);HX=new Float32Array(N);HY=new Float32Array(N);
  FR=new Uint8Array(N);HUB=new Uint8Array(N);R0=new Float32Array(N);PH=new Float32Array(N);
  const pairs=N*(N-1)/2;segs=Array.from({length:B},()=>new Float32Array(pairs*4));
  /* uneven fragment sizes, at least four nodes each */
  const wts=Array.from({length:F},()=>.7+rand()*.8),tot=wts.reduce((a,b)=>a+b,0);
  const counts=wts.map(w=>Math.max(4,Math.round(w/tot*N)));
  let diff=N-counts.reduce((a,b)=>a+b,0);
  for(let k=0;diff!==0;k=(k+1)%F){if(diff>0){counts[k]++;diff--}else if(counts[k]>4){counts[k]--;diff++}}
  frags=[];let idx=0;
  const col=W/F,slot=Array.from({length:F},(_,i)=>i);
  for(let i=F-1;i>0;i--){const j=Math.floor(rand()*(i+1));[slot[i],slot[j]]=[slot[j],slot[i]]}
  for(let c=0;c<F;c++){
    const R=(58+rand()*44)*S;
    const fr={cx:clamp((c+.5)*col+(rand()-.5)*col*.5,R*.5,W-R*.5),cy:-(R*1.5+12)+((slot[c]+.15+rand()*.7)/F)*(H+2*(R*1.5+12)),R,
      vy:(CFG.rise[0]+rand()*(CFG.rise[1]-CFG.rise[0]))*S,vx:(rand()*2-1)*CFG.drift*S,sway:rand()*6.28,first:idx,count:counts[c]};
    frags.push(fr);
    const first=idx;
    for(let j=0;j<counts[c];j++,idx++){
      FR[idx]=c;PH[idx]=rand()*6.28;
      HUB[idx]=j===0||(j===1&&counts[c]>=10&&rand()<.5)?1:0;
      R0[idx]=HUB[idx]?3.4+rand()*1:1.5+rand()*1.2;
      /* best-candidate sampling: nodes spread evenly instead of clumping */
      let bx=0,by=0,bd=-1;
      for(let k=0;k<(j?8:1);k++){
        const a=rand()*Math.PI*2,r=Math.sqrt(rand())*R*(HUB[idx]?.45:1),cx=Math.cos(a)*r,cy=Math.sin(a)*r;
        let md=1e9;
        for(let q=first;q<idx;q++)md=Math.min(md,(HX[q]-cx)**2+(HY[q]-cy)**2);
        if(md>bd){bd=md;bx=cx;by=cy}
      }
      HX[idx]=bx;HY[idx]=by;X[idx]=fr.cx+bx;Y[idx]=fr.cy+by
    }
  }
  if(!reduced)for(let i=-300;i<0;i++)step(i/60,1/60)   /* settle before the first paint */
}

/* Resizing keeps the same network: it is rescaled, and only rebuilt on a real layout change. */
function fit(w,h){
  const first=!N,oldW=W,oldH=H,oldS=S;
  W=w;H=h;S=clamp(w/800,.62,1.1);
  const t=targets(w,h);
  if(first||t.f!==F||Math.abs(t.n-N)>N*.25){build(t.n,t.f);return}
  const fx=w/oldW,fy=h/oldH,fs=S/oldS;
  for(const c of frags){c.cx*=fx;c.cy*=fy;c.R*=fs;c.vy*=fs;c.vx*=fs}
  for(let i=0;i<N;i++){X[i]*=fx;Y[i]*=fy;HX[i]*=fs;HY[i]*=fs}
}

/* A fragment leaves through the top as a whole and re-enters below as a whole. */
function recycle(c){
  const ext=c.R*1.5+12,shift=H+ext-c.cy;
  c.cy+=shift;
  for(let i=c.first;i<c.first+c.count;i++)Y[i]+=shift
}

function step(t,dt){
  const k=dt*60,damp=Math.pow(.955,k),ease=1-Math.pow(.955,k);
  mouse.x+=(mouse.tx-mouse.x)*ease;mouse.y+=(mouse.ty-mouse.y)*ease;
  for(const c of frags){
    c.cy-=c.vy*dt;c.cx+=c.vx*dt+Math.sin(t*.17+c.sway)*.04*S*k;
    if(c.cx<W*.1&&c.vx<0||c.cx>W*.9&&c.vx>0)c.vx=-c.vx;     /* wander, but stay in view */
    if(c.cy<-(c.R*1.5+12))recycle(c)
  }
  /* fragments may touch at their borders but never merge */
  for(let a=0;a<F;a++)for(let b=a+1;b<F;b++){
    const A=frags[a],Bf=frags[b],dx=Bf.cx-A.cx,dy=Bf.cy-A.cy,d=Math.hypot(dx,dy),min=(A.R+Bf.R)*.95;
    if(d<min){
      const push=(min-d)/min*28*S*dt,sg=Math.abs(dx)<1?(a%2?1:-1):Math.sign(dx);
      A.cx-=sg*push;Bf.cx+=sg*push
    }
  }
  const reach=CFG.grabReach*clamp(S,.8,1.1),amp=5*S;
  for(let i=0;i<N;i++){
    const c=frags[FR[i]],ph=PH[i];
    const tx=c.cx+HX[i]+Math.sin(t*.45+ph)*amp,ty=c.cy+HY[i]+Math.cos(t*.38+ph)*amp;
    const kk=HUB[i]?.004:.002;                                  /* hubs hold their place more firmly */
    let ax=(tx-X[i])*kk,ay=(ty-Y[i])*kk;
    if(mouse.on){
      const mx=X[i]-mouse.x,my=Y[i]-mouse.y,d=Math.hypot(mx,my)||1,f=1-d/reach;
      if(f>0){ax+=mx/d*f*.03;ay+=my/d*f*.03}
    }
    let vx=(VX[i]+ax*k)*damp,vy=(VY[i]+ay*k)*damp;
    const sp=Math.hypot(vx,vy);if(sp>1.4){vx*=1.4/sp;vy*=1.4/sp}
    VX[i]=vx;VY[i]=vy;X[i]+=vx*k;Y[i]+=vy*k
  }
}

function draw(){
  ctx.clearRect(0,0,W,H);
  const rs=clamp(S,.8,1.1),Ls=CFG.reachSame*rs,Lc=CFG.reachCross*rs,Ls2=Ls*Ls,Lc2=Lc*Lc;
  segN.fill(0);
  for(let i=0;i<N;i++){
    const xi=X[i],yi=Y[i],fi=FR[i];
    for(let j=i+1;j<N;j++){
      const dx=X[j]-xi,dy=Y[j]-yi,d2=dx*dx+dy*dy,same=FR[j]===fi;
      if(d2>=(same?Ls2:Lc2))continue;
      const L=same?Ls:Lc,a=(same?CFG.alphaSame:CFG.alphaCross)*(1-Math.sqrt(d2)/L);
      if(a<.02)continue;
      const b=Math.min(B-1,(a/CFG.alphaSame*B)|0),s=segs[b],o=segN[b]++*4;
      s[o]=xi;s[o+1]=yi;s[o+2]=X[j];s[o+3]=Y[j]
    }
  }
  ctx.lineWidth=.9;
  for(let b=0;b<B;b++){
    const n=segN[b];if(!n)continue;
    const s=segs[b];ctx.strokeStyle=ALPHAS[b];ctx.beginPath();
    for(let o=0;o<n*4;o+=4){ctx.moveTo(s[o],s[o+1]);ctx.lineTo(s[o+2],s[o+3])}
    ctx.stroke()
  }
  if(mouse.on){                                              /* cursor links */
    const reach=CFG.grabReach*clamp(S,.8,1.1);
    for(let i=0;i<N;i++){
      const d=Math.hypot(X[i]-mouse.x,Y[i]-mouse.y);
      if(d<reach){ctx.strokeStyle=`rgba(${CFG.hub},${(.5*(1-d/reach)).toFixed(3)})`;
        ctx.beginPath();ctx.moveTo(mouse.x,mouse.y);ctx.lineTo(X[i],Y[i]);ctx.stroke()}
    }
  }
  const sc=clamp(S,.8,1.1);
  for(let pass=0;pass<2;pass++){                              /* grey nodes, then hubs on top */
    ctx.fillStyle=pass?`rgba(${CFG.hub},.8)`:`rgba(${CFG.grey},.6)`;ctx.beginPath();
    for(let i=0;i<N;i++){
      if(HUB[i]!==pass)continue;
      const r=R0[i]*sc;ctx.moveTo(X[i]+r,Y[i]);ctx.arc(X[i],Y[i],r,0,6.2832)
    }
    ctx.fill()
  }
}

/* ---------- loop: runs only while visible ---------- */
let raf=0,last=0,t=0,visible=false;
function loop(now){
  raf=requestAnimationFrame(loop);
  const dt=last?Math.min(.04,(now-last)/1000):0;last=now;
  if(dt>0){t+=dt;step(t,dt)}
  draw()
}
function update(){
  const run=visible&&!document.hidden&&!reduced;
  if(run&&!raf){last=0;raf=requestAnimationFrame(loop)}
  else if(!run&&raf){cancelAnimationFrame(raf);raf=0}
}
new IntersectionObserver(e=>{visible=e[0].isIntersecting;update()},{rootMargin:'80px'}).observe(canvas);
document.addEventListener('visibilitychange',update);

/* ---------- responsive sizing ---------- */
new ResizeObserver(entries=>{
  const r=entries[0].contentRect;if(r.width<20||r.height<20)return;
  dpr=Math.min(devicePixelRatio||1,2);
  const pw=Math.round(r.width*dpr),ph=Math.round(r.height*dpr);
  if(canvas.width!==pw||canvas.height!==ph){canvas.width=pw;canvas.height=ph}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  fit(r.width,r.height);draw()
}).observe(canvas);

/* ---------- pointer ---------- */
canvas.addEventListener('pointermove',e=>{
  mouse.tx=e.offsetX;mouse.ty=e.offsetY;
  if(!mouse.on){mouse.x=mouse.tx;mouse.y=mouse.ty;mouse.on=true}
},{passive:true});
const off=()=>{mouse.on=false;mouse.tx=mouse.ty=-9e3};
canvas.addEventListener('pointerleave',off);
canvas.addEventListener('pointercancel',off);
canvas.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse')off()});
})();
