(()=>{'use strict';
/* "A living network" — particles.js, same engine used on networksciencebook.com.
   Nodes drift slowly upward, nearby nodes connect with faint edges, hover repels. */
const el=document.getElementById('network-canvas');
if(!el||typeof particlesJS!=='function')return;
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
particlesJS('network-canvas',{
  particles:{
    number:{value:80,density:{enable:true,value_area:350}},
    color:{value:['#828282','#828282','#828282','#9a9a9a','#b52735']},
    shape:{type:'circle'},
    opacity:{value:.6,random:true,anim:{enable:false}},
    size:{value:3,random:true,anim:{enable:false}},
    line_linked:{enable:true,distance:120,color:'#828282',opacity:.28,width:1},
    move:{enable:!reduced,speed:.7,direction:'top',random:true,straight:false,out_mode:'out',bounce:false}
  },
  interactivity:{
    detect_on:'canvas',
    events:{onhover:{enable:true,mode:'repulse'},onclick:{enable:false},resize:true},
    modes:{repulse:{distance:90,duration:.4}}
  },
  retina_detect:true
});
})();
