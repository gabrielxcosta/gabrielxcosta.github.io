(()=>{'use strict';
/* "A living network" — fragments (communities) rise slowly while new nodes are born from
   existing ones (hubs attract most newcomers) and old nodes fade away. Nodes of the same
   fragment link at a short distance; nodes of different fragments only link below a
   stricter threshold. */
const host=document.querySelector('#network-canvas');
if(!host)return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- tuning (distances in px at the 800 px reference width) ---------- */
const CFG={
  areaPerNode:2500, minNodes:36, maxNodes:150,  /* node count follows the canvas area */
  spare:5,                                      /* extra slots per fragment for newborns */
  reachSame:50,                                 /* link threshold inside a fragment */
  reachCross:42,                                /* link threshold between different fragments */
  alphaSame:.42, alphaCross:.24,                /* maximum line opacity */
  grabReach:150,                                /* cursor links */
  rise:[5,10],                                  /* fragment speed, px/s */
  birthEvery:.5,                                /* average seconds between one death and one birth */
  grow:1.2,                                     /* seconds a node takes to appear / fade out */
  hubBirth:.5,                                  /* chance that a newborn attaches to a hub */
  grey:'120,120,120', hub:'181,39,53'
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
/* Nodes live in fixed slots (M in total). ST: 0 free, 1 alive, 2 fading out. */
let W=0,H=0,S=1,N=0,F=0,M=0,dpr=1,evT=0;
let X,Y,VX,VY,HX,HY,FR,HUB,ST,R0,PH,AGE,LF,LE,frags=[],segs=[],segN=new Int32Array(B);
const mouse={x:-9e3,y:-9e3,tx:-9e3,ty:-9e3,on:false};
let seed=941;
const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const targets=(w,h)=>({
  n:clamp(Math.round(w*h/CFG.areaPerNode),CFG.minNodes,CFG.maxNodes),
  f:clamp(Math.round(w/125),4,9)
});
const nodeR=hub=>hub?5+rand()*1.4:2.3+rand()*1.5;

function build(n,f){
  seed=941;N=n;F=f;
  /* uneven fragment sizes, at least five nodes each */
  const wts=Array.from({length:F},()=>.7+rand()*.8),tot=wts.reduce((a,b)=>a+b,0);
  const counts=wts.map(w=>Math.max(5,Math.round(w/tot*N)));
  let diff=N-counts.reduce((a,b)=>a+b,0);
  for(let k=0;diff!==0;k=(k+1)%F){if(diff>0){counts[k]++;diff--}else if(counts[k]>5){counts[k]--;diff++}}
  M=counts.reduce((a,b)=>a+b+CFG.spare,0);
  X=new Float32Array(M);Y=new Float32Array(M);VX=new Float32Array(M);VY=new Float32Array(M);
  HX=new Float32Array(M);HY=new Float32Array(M);R0=new Float32Array(M);PH=new Float32Array(M);
  AGE=new Float32Array(M);LF=new Float32Array(M);LE=new Float32Array(M);
  FR=new Uint8Array(M);HUB=new Uint8Array(M);ST=new Uint8Array(M);
  const pairs=M*(M-1)/2;segs=Array.from({length:B},()=>new Float32Array(pairs*4));
  const slot=Array.from({length:F},(_,i)=>i);
  for(let i=F-1;i>0;i--){const j=Math.floor(rand()*(i+1));[slot[i],slot[j]]=[slot[j],slot[i]]}
  frags=[];let idx=0;const col=W/F;
  for(let c=0;c<F;c++){
    const R=(48+rand()*36)*S,ext=R*1.15+10,cap=counts[c]+CFG.spare;
    const wph=rand()*6.28,fr={home:(c+.5)*col,amp:col*.5,wph,wsp:.05+rand()*.04,cx:(c+.5)*col+Math.sin(wph)*col*.5,
      cy:-ext+((slot[c]+.15+rand()*.7)/F)*(H+2*ext),R,
      vy:(CFG.rise[0]+rand()*(CFG.rise[1]-CFG.rise[0]))*S,sway:rand()*6.28,
      first:idx,cap,target:counts[c],alive:counts[c]};
    frags.push(fr);
    for(let j=0;j<cap;j++,idx++){
      FR[idx]=c;PH[idx]=rand()*6.28;
      if(j>=counts[c])continue;                       /* spare slot: free until a birth */
      ST[idx]=1;LF[idx]=LE[idx]=1;AGE[idx]=6+rand()*50;
      HUB[idx]=j===0||(j===1&&counts[c]>=12&&rand()<.5)?1:0;
      R0[idx]=nodeR(HUB[idx]);
      /* best-candidate sampling: nodes spread evenly instead of clumping */
      let bx=0,by=0,bd=-1;
      for(let k=0;k<(j?8:1);k++){
        const a=rand()*Math.PI*2,r=Math.sqrt(rand())*R*(HUB[idx]?.45:1),cx=Math.cos(a)*r,cy=Math.sin(a)*r;
        let md=1e9;
        for(let q=fr.first;q<idx;q++)md=Math.min(md,(HX[q]-cx)**2+(HY[q]-cy)**2);
        if(md>bd){bd=md;bx=cx;by=cy}
      }
      HX[idx]=bx;HY[idx]=by;X[idx]=fr.cx+bx;Y[idx]=fr.cy+by
    }
  }
  if(!reduced)for(let i=-300;i<0;i++)step(i/60,1/60,false);   /* settle before the first paint */
  evT=CFG.birthEvery
}

/* Resizing keeps the same network: it is rescaled, and only rebuilt on a real layout change. */
function fit(w,h){
  const first=!M,oldW=W,oldH=H,oldS=S;
  W=w;H=h;S=clamp(w/800,.62,1.1);
  const t=targets(w,h);
  if(first||t.f!==F||Math.abs(t.n-N)>N*.25){build(t.n,t.f);return}
  const fx=w/oldW,fy=h/oldH,fs=S/oldS;
  for(const c of frags){c.cx*=fx;c.cy*=fy;c.R*=fs;c.vy*=fs;c.home*=fx;c.amp*=fx}
  for(let i=0;i<M;i++){X[i]*=fx;Y[i]*=fy;HX[i]*=fs;HY[i]*=fs}
}

/* A fragment leaves through the top as a whole and re-enters below as a whole, as soon as its
   last node is out of sight, so the panel stays evenly populated. */
function recycle(c){
  let lo=1e9,hi=-1e9;
  for(let i=c.first;i<c.first+c.cap;i++)if(ST[i]){if(Y[i]<lo)lo=Y[i];if(Y[i]>hi)hi=Y[i]}
  if(hi>-24)return;
  const shift=H+24-lo;
  c.cy+=shift;
  for(let i=c.first;i<c.first+c.cap;i++)Y[i]+=shift
}

/* ---------- births and deaths ---------- */
function birth(c){
  let slot=-1;
  for(let i=c.first;i<c.first+c.cap;i++)if(ST[i]===0){slot=i;break}
  if(slot<0)return;
  /* preferential attachment: hubs attract most newcomers */
  let parent=-1,seen=0;
  const wantHub=rand()<CFG.hubBirth;
  for(let i=c.first;i<c.first+c.cap;i++){
    if(ST[i]!==1||LF[i]<.6||(wantHub&&!HUB[i]))continue;
    if(rand()*++seen<1)parent=i
  }
  if(parent<0)for(let i=c.first;i<c.first+c.cap;i++)if(ST[i]===1&&LF[i]>=.6){parent=i;break}
  if(parent<0)return;
  let bx=HX[parent],by=HY[parent],bd=-1;
  for(let k=0;k<7;k++){
    const a=rand()*Math.PI*2,d=(20+rand()*22)*S;
    let hx=HX[parent]+Math.cos(a)*d,hy=HY[parent]+Math.sin(a)*d;
    const m=Math.hypot(hx,hy),lim=c.R*1.05;
    if(m>lim){hx*=lim/m;hy*=lim/m}
    let md=1e9;
    for(let q=c.first;q<c.first+c.cap;q++)if(ST[q]&&q!==slot)md=Math.min(md,(HX[q]-hx)**2+(HY[q]-hy)**2);
    if(md>bd){bd=md;bx=hx;by=hy}
  }
  HX[slot]=bx;HY[slot]=by;X[slot]=X[parent];Y[slot]=Y[parent];   /* the newborn buds from its parent */
  VX[slot]=VY[slot]=0;ST[slot]=1;AGE[slot]=0;LF[slot]=LE[slot]=0;
  HUB[slot]=0;R0[slot]=nodeR(0);PH[slot]=rand()*6.28;c.alive++
}
function death(c){
  let pick=-1,seen=0;
  for(let i=c.first;i<c.first+c.cap;i++){
    if(ST[i]!==1||HUB[i]||AGE[i]<5||LF[i]<1)continue;
    if(rand()*++seen<1)pick=i
  }
  if(pick>=0){ST[pick]=2;c.alive--}
}
function lifeEvent(){
  let need=null;                                   /* fragment missing the most nodes */
  for(const c of frags)if(c.alive<c.target&&(!need||c.target-c.alive>need.target-need.alive))need=c;
  if(need){birth(need);return}
  death(frags[Math.floor(rand()*F)])
}

function step(t,dt,live){
  const k=dt*60,damp=Math.pow(.955,k),ease=1-Math.pow(.955,k),grow=dt/CFG.grow;
  mouse.x+=(mouse.tx-mouse.x)*ease;mouse.y+=(mouse.ty-mouse.y)*ease;
  for(const c of frags){
    c.cy-=c.vy*dt;
    /* each fragment wanders slowly around its own column, so the panel stays evenly covered */
    c.cx+=(c.home+Math.sin(t*c.wsp+c.wph)*c.amp-c.cx)*Math.min(1,dt*2)+Math.sin(t*.17+c.sway)*.04*S*k;
    if(c.cy<c.R*.5)recycle(c)
  }
  /* fragments may touch at their borders but never merge */
  for(let a=0;a<F;a++)for(let b=a+1;b<F;b++){
    const A=frags[a],Bf=frags[b],dx=Bf.cx-A.cx,dy=Bf.cy-A.cy,d=Math.hypot(dx,dy),min=(A.R+Bf.R)*1.05;
    if(d<min){
      const push=(min-d)/min*28*S*dt,sg=Math.abs(dx)<1?(a%2?1:-1):Math.sign(dx);
      A.cx-=sg*push;Bf.cx+=sg*push
    }
  }
  const reach=CFG.grabReach*clamp(S,.8,1.1),amp=5*S;
  for(let i=0;i<M;i++){
    const s=ST[i];if(!s)continue;
    AGE[i]+=dt;
    if(s===1){if(LF[i]<1)LF[i]=Math.min(1,LF[i]+grow)}
    else{LF[i]-=grow;if(LF[i]<=0){LF[i]=0;ST[i]=0}}
    const l=1-LF[i];LE[i]=1-l*l*l;                             /* ease-out */
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
  if(live&&t>=evT){lifeEvent();evT=t+CFG.birthEvery*(.6+rand()*.8)}
}

function draw(){
  ctx.clearRect(0,0,W,H);
  const rs=clamp(S,.8,1.1),Ls=CFG.reachSame*rs,Lc=CFG.reachCross*rs,Ls2=Ls*Ls,Lc2=Lc*Lc;
  segN.fill(0);
  for(let i=0;i<M;i++){
    if(LE[i]<.05)continue;
    const xi=X[i],yi=Y[i],fi=FR[i],li=LE[i];
    for(let j=i+1;j<M;j++){
      if(LE[j]<.05)continue;
      const dx=X[j]-xi,dy=Y[j]-yi,d2=dx*dx+dy*dy,same=FR[j]===fi;
      if(d2>=(same?Ls2:Lc2))continue;
      const L=same?Ls:Lc,w=li<LE[j]?li:LE[j];
      const a=(same?CFG.alphaSame:CFG.alphaCross)*(1-Math.sqrt(d2)/L)*w;
      if(a<.02)continue;
      const b=Math.min(B-1,(a/CFG.alphaSame*B)|0),s=segs[b],o=segN[b]++*4;
      s[o]=xi;s[o+1]=yi;s[o+2]=X[j];s[o+3]=Y[j]
    }
  }
  ctx.lineWidth=1.05;
  for(let b=0;b<B;b++){
    const n=segN[b];if(!n)continue;
    const s=segs[b];ctx.strokeStyle=ALPHAS[b];ctx.beginPath();
    for(let o=0;o<n*4;o+=4){ctx.moveTo(s[o],s[o+1]);ctx.lineTo(s[o+2],s[o+3])}
    ctx.stroke()
  }
  if(mouse.on){                                              /* cursor links */
    const reach=CFG.grabReach*rs;
    for(let i=0;i<M;i++){
      if(LE[i]<.3)continue;
      const d=Math.hypot(X[i]-mouse.x,Y[i]-mouse.y);
      if(d<reach){ctx.strokeStyle=`rgba(${CFG.hub},${(.55*(1-d/reach)).toFixed(3)})`;
        ctx.beginPath();ctx.moveTo(mouse.x,mouse.y);ctx.lineTo(X[i],Y[i]);ctx.stroke()}
    }
  }
  for(let pass=0;pass<2;pass++){                              /* grey nodes, then hubs on top */
    ctx.fillStyle=pass?`rgba(${CFG.hub},.88)`:`rgba(${CFG.grey},.68)`;ctx.beginPath();
    for(let i=0;i<M;i++){
      if(LE[i]<.02||HUB[i]!==pass)continue;
      const r=R0[i]*rs*LE[i];ctx.moveTo(X[i]+r,Y[i]);ctx.arc(X[i],Y[i],r,0,6.2832)
    }
    ctx.fill()
  }
  ctx.lineWidth=1.2;                                          /* birth pulse */
  for(let i=0;i<M;i++){
    if(ST[i]!==1||AGE[i]>=1)continue;
    const p=AGE[i];
    ctx.strokeStyle=`rgba(${CFG.hub},${(.4*(1-p)).toFixed(3)})`;
    ctx.beginPath();ctx.arc(X[i],Y[i],(5+p*20)*rs,0,6.2832);ctx.stroke()
  }
}

/* ---------- loop: runs only while visible ---------- */
let raf=0,last=0,t=0,visible=false;
function loop(now){
  raf=requestAnimationFrame(loop);
  const dt=last?Math.min(.04,(now-last)/1000):0;last=now;
  if(dt>0){t+=dt;step(t,dt,true)}
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
  fit(r.width,r.height);
  if(t>0)evT=t+CFG.birthEvery;
  draw()
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
