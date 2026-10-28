(()=>{'use strict';
const langButton=document.querySelector('.lang-toggle'),menu=document.querySelector('.mobile-menu'),nav=document.querySelector('.site-nav');
let lang=sessionStorage.getItem('gfc-lang')==='pt'?'pt':'en';
function setLang(v){lang=v;sessionStorage.setItem('gfc-lang',v);document.documentElement.lang=v;document.querySelectorAll('[data-en][data-pt]').forEach(el=>{el.textContent=el.dataset[v]});langButton.textContent=v==='en'?'PT ↗':'EN ↗'}setLang(lang);
langButton.addEventListener('click',()=>setLang(lang==='en'?'pt':'en'));if(menu)menu.addEventListener('click',()=>{const on=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(on))});const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target)}}),{threshold:.12});document.querySelectorAll('.reveal').forEach(e=>{if(reduced)e.classList.add('visible');else observer.observe(e)});
// Project cover icons: custom vector symbols, using red and gray only.
const I={red:'#b52735',gray:'#909090',light:'#d0d0d0'};
function paintIcon(el){let s='';const l=(a,b,c,d,col=I.gray)=>`<path d="M${a} ${b}L${c} ${d}" stroke="${col}" stroke-width="2" fill="none"/>`;const dot=(x,y,r=5,col=I.red)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${col}"/>`;const path=(d,col=I.red,w=2)=>`<path d="${d}" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
switch(el.dataset.icon){
case 'stgnn':{let pts=[[26,31],[78,21],[127,46],[42,95],[96,105],[133,100]];[[0,1],[1,2],[0,3],[1,4],[2,5],[3,4],[4,5],[1,3]].forEach(([a,b])=>s+=l(...pts[a],...pts[b],I.light));pts.forEach(([x,y],i)=>{s+=dot(x,y,i===1?8:5,i===1?I.red:I.gray);s+=path(`M${x-11} ${y-11}l5 -5 4 3 5 -8`,I.red,1.3)});break;}
case 'epidemic':s+=`<circle cx="80" cy="67" r="39" fill="none" stroke="${I.gray}" stroke-width="3"/>`+dot(66,58,4)+dot(94,58,4)+path('M60 82Q80 67 100 82')+path('M54 35l-6 -9 M112 35l6 -9',I.gray)+`<rect x="67" y="78" width="26" height="15" rx="3" fill="${I.red}" opacity=".35"/>`;break;
case 'network':{let pts=[[80,15],[36,52],[125,53],[57,105],[105,114],[18,100]];[[0,1],[0,2],[1,3],[1,5],[2,4],[3,4],[4,5],[0,4]].forEach(([a,b])=>s+=l(...pts[a],...pts[b]));pts.forEach(([x,y],i)=>s+=dot(x,y,i===0?10:5,i===0?I.red:I.gray));break;}
case 'brain':s+=path('M75 108C40 117 35 94 41 80C22 62 43 39 58 43C57 23 80 19 80 38C89 21 111 27 111 44C138 49 139 76 119 85C125 105 98 114 82 106M80 38L80 105M51 65L70 76M105 59L91 81',I.red,3);break;
case 'data':s+=path('M26 111L26 24M26 111L139 111',I.gray,2);[22,42,61,33,79].forEach((h,i)=>s+=`<rect x="${38+i*20}" y="${111-h}" width="11" height="${h}" rx="2" fill="${i%2?I.gray:I.red}" opacity=".77"/>`);break;
case 'image':s+=`<rect x="33" y="23" width="94" height="94" rx="6" fill="none" stroke="${I.gray}" stroke-width="3"/>`+path('M39 101L65 72L82 87L103 56L122 102')+dot(61,51,8);break;
case 'algorithm':s+=`<rect x="61" y="16" width="40" height="27" rx="4" fill="none" stroke="${I.red}" stroke-width="2"/><rect x="30" y="84" width="41" height="29" rx="4" fill="none" stroke="${I.gray}" stroke-width="2"/><rect x="90" y="84" width="41" height="29" rx="4" fill="none" stroke="${I.gray}" stroke-width="2"/>`+path('M80 43V62H51V84M80 62H110V84',I.red);break;
case 'optimize':s+=path('M28 110L28 24M28 110L140 110',I.gray)+path('M38 96Q65 24 91 55T135 34',I.red,3)+dot(103,51,9);break;
case 'atom':s+=`<ellipse cx="80" cy="70" rx="64" ry="24" fill="none" stroke="${I.gray}" stroke-width="2" transform="rotate(-38 80 70)"/><ellipse cx="80" cy="70" rx="64" ry="24" fill="none" stroke="${I.red}" stroke-width="2" transform="rotate(38 80 70)"/><ellipse cx="80" cy="70" rx="64" ry="24" fill="none" stroke="${I.gray}" stroke-width="2" transform="rotate(90 80 70)"/>`+dot(80,70,9)+dot(127,43,5,I.gray);break;
}el.innerHTML=s;}
document.querySelectorAll('.project-icon').forEach(paintIcon);
})();
