(()=>{'use strict';
/* "A living network" — built with particles.js, the same library behind the home page of
   networksciencebook.com: slow particles rising upward, linked by thin lines when close,
   reacting to the cursor. All the look-and-feel lives in the `config` object below. */
const host=document.querySelector('#network-canvas');
if(!host)return;

/* particles.js needs a container element (not a <canvas>) with a real height. */
let el=host;
if(host.tagName==='CANVAS'){
  el=document.createElement('div');
  el.id=host.id;el.className=host.className;
  for(const a of ['role','aria-label'])if(host.hasAttribute(a))el.setAttribute(a,host.getAttribute(a));
  host.replaceWith(el)
}
if(el.getBoundingClientRect().height<50){
  el.style.height='clamp(260px,38vw,380px)';el.style.position='relative';el.style.overflow='hidden'
}

const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const config={
  particles:{
    number:{value:80,density:{enable:true,value_area:800}},
    color:{value:'#828282'},
    shape:{type:'circle',stroke:{width:0,color:'#000000'}},
    opacity:{value:.5,random:false,anim:{enable:false}},
    size:{value:3,random:true,anim:{enable:false}},
    line_linked:{enable:true,distance:150,color:'#828282',opacity:.4,width:1},
    move:{enable:!reduced,speed:1,direction:'top',random:false,straight:false,out_mode:'out',bounce:false,
          attract:{enable:false}}
  },
  interactivity:{
    detect_on:'canvas',
    events:{onhover:{enable:true,mode:'grab'},onclick:{enable:false},resize:true},
    modes:{grab:{distance:140,line_linked:{opacity:.8}}}
  },
  retina_detect:true
};

const start=()=>{if(typeof particlesJS==='function')particlesJS(el.id,config)};
if(typeof particlesJS==='function')start();
else{
  const s=document.createElement('script');
  s.src='https://cdnjs.cloudflare.com/ajax/libs/particles.js/2.0.0/particles.min.js';
  s.async=true;s.onload=start;document.head.appendChild(s)
}
})();
