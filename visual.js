// A restrained, pointer-reactive graph confined to the About section.
(() => {
  const css=document.createElement('link');css.rel='stylesheet';css.href='visual.css';document.head.appendChild(css);
  const overrides=document.createElement('link');overrides.rel='stylesheet';overrides.href='visual-overrides.css';document.head.appendChild(overrides);
  const section=document.querySelector('#about');if(!section)return;
  const content=section.querySelector('.section-content');
  const hero=document.createElement('div');hero.className='about-intro';
  hero.innerHTML='<div class="portrait-ring"><img src="gabriel-portrait.png" alt="Portrait of Gabriel Ferreira da Costa" width="350" height="470" loading="lazy"></div><p class="intro-copy" data-i18n="aboutIntro">A physicist by training, a computer scientist by curiosity — exploring the patterns that connect complex systems.</p>';
  content.querySelector('h2').after(hero);
  const caption=document.createElement('p');caption.className='graph-caption';caption.dataset.i18n='graphHint';caption.innerHTML='An interactive network · move your cursor here';hero.after(caption);
  originals.aboutIntro='A physicist by training, a computer scientist by curiosity — exploring the patterns that connect complex systems.';
  translations.pt.aboutIntro='Físico de formação, cientista da computação por curiosidade — explorando os padrões que conectam sistemas complexos.';
  originals.graphHint='An interactive network · move your cursor here';translations.pt.graphHint='Uma rede interativa · mova o cursor por aqui';
  if(current==='pt')setLanguage('pt');
  const canvas=document.createElement('canvas');canvas.className='about-graph';canvas.setAttribute('aria-hidden','true');section.prepend(canvas);
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width=0,height=0,ratio=1,nodes=[],groups=[],edges=[],raf=0,visible=true;
  const mouse={x:-1000,y:-1000,active:false};
  const seeded=i=>{const n=Math.sin(i*127.1+91.37)*43758.5453;return n-Math.floor(n)};
  const wrap=(value,span)=>((value%span)+span)%span;
  function resize(){
    const bounds=section.getBoundingClientRect();width=bounds.width;height=bounds.height;
    ratio=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);ctx.setTransform(ratio,0,0,ratio,0,0);
    // A small stochastic block model: heterogeneous communities, p_in >> p_out.
    const clusterCount=width<700?4:7;
    groups=Array.from({length:clusterCount},(_,g)=>({x:(.15+.7*seeded(30+g))*width,y:(.10+.84*seeded(84+g))*height,phase:seeded(110+g)*6.28,speed:10+seeded(130+g)*7,size:(width<700?5:6)+Math.floor(seeded(170+g)*(width<700?5:9))}));
    nodes=[];
    for(let g=0;g<groups.length;g++)for(let local=0;local<groups[g].size;local++){
      const i=nodes.length,hub=local===0,angle=local*2.39996+seeded(200+i)*.45;
      const spread=Math.sqrt(local/groups[g].size)*(width<700?73:102);
      nodes.push({group:g,hub,degree:0,angle,radius:hub?0:24+spread+seeded(500+i)*13,phase:seeded(300+i)*6.28,drift:4+seeded(400+i)*5});
    }
    edges=[];
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
      const a=nodes[i],b=nodes[j],inside=a.group===b.group;
      // Hub affinity creates degree heterogeneity without assigning equal-size circles.
      const chance=inside?((a.hub||b.hub)?0.88:0.49):0.025;
      if(seeded(1200+i*131+j*17)<chance){edges.push([i,j]);a.degree++;b.degree++;}
    }
    draw(0);
  }
  function pointSegmentDistance(px,py,ax,ay,bx,by){
    const vx=bx-ax,vy=by-ay,den=vx*vx+vy*vy||1,t=Math.max(0,Math.min(1,((px-ax)*vx+(py-ay)*vy)/den));
    return Math.hypot(px-(ax+t*vx),py-(ay+t*vy));
  }
  function draw(time){
    ctx.clearRect(0,0,width,height);
    const seconds=reduced?0:time/1000,span=height+300;
    const centers=groups.map((g,i)=>{
      let x=g.x+Math.sin(seconds*.17+g.phase)*18;
      let y=wrap(g.y-seconds*g.speed+150,span)-150; // Continuous bottom-to-top drift.
      if(mouse.active){
        const dx=x-mouse.x,dy=y-mouse.y,d=Math.hypot(dx,dy)||1,pressure=Math.max(0,1-d/265);
        // Moving the whole neighborhood splits nearby groups without scattering every node.
        x+=dx/d*pressure*65;y+=dy/d*pressure*50;
      }
      return{x,y,group:i};
    });
    const points=nodes.map(n=>{
      const center=centers[n.group],sway=reduced?0:Math.sin(seconds*.55+n.phase)*n.drift;
      let x=center.x+Math.cos(n.angle)*(n.radius+sway),y=center.y+Math.sin(n.angle)*(n.radius+sway);
      if(mouse.active){
        const dx=x-mouse.x,dy=y-mouse.y,d=Math.hypot(dx,dy)||1,force=Math.max(0,1-d/120);
        x+=dx/d*force*34;y+=dy/d*force*34;
      }
      return{x,y,hub:n.hub,group:n.group};
    });
    for(const [i,j] of edges){
      const a=points[i],b=points[j],distance=Math.hypot(a.x-b.x,a.y-b.y);
      const sameGroup=a.group===b.group;
      const limit=sameGroup&&(a.hub||b.hub)?180:(sameGroup?138:96);
      if(distance>=limit)continue;
      if(mouse.active&&pointSegmentDistance(mouse.x,mouse.y,a.x,a.y,b.x,b.y)<72)continue;
      const opacity=(sameGroup?.34:.12)*(1-distance/limit);
      ctx.strokeStyle=`rgba(${a.hub||b.hub?'174,65,75':'117,117,117'},${opacity})`;
      ctx.lineWidth=a.hub||b.hub?1.05:.7;
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
    }
    for(let i=0;i<points.length;i++){
      const p=points[i],n=nodes[i];
      const radius=n.hub?4.4+Math.min(5,n.degree*.53):2.05+Math.min(1.4,n.degree*.17);
      ctx.beginPath();ctx.arc(p.x,p.y,radius,0,Math.PI*2);
      ctx.fillStyle=p.hub?'rgba(185,43,58,.82)':'rgba(126,126,126,.54)';ctx.fill();
    }
  }
  function tick(time){if(!visible)return;draw(time);raf=requestAnimationFrame(tick)}
  section.addEventListener('pointermove',event=>{if(event.pointerType==='touch')return;const r=section.getBoundingClientRect();mouse.x=event.clientX-r.left;mouse.y=event.clientY-r.top;mouse.active=true;if(reduced)draw(0)},{passive:true});
  section.addEventListener('pointerleave',()=>{mouse.active=false;if(reduced)draw(0)});
  const ro=new ResizeObserver(resize);ro.observe(section);
  const io=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&!reduced){cancelAnimationFrame(raf);raf=requestAnimationFrame(tick)}else cancelAnimationFrame(raf)},{threshold:0});io.observe(section);
  resize();
})();
