(function(){
  'use strict';
  var root=document.documentElement;
  var reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine=window.matchMedia('(pointer: fine)').matches;
  var toastTimer=null;
  function toast(text){var el=document.getElementById('toast');if(!el)return;el.textContent=text;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(function(){el.classList.remove('show')},1600)}
  function copyText(text,button){
    function done(){toast('已复制');if(button){var old=button.textContent;button.textContent='已复制';button.classList.add('copied');setTimeout(function(){button.textContent=old;button.classList.remove('copied')},1400)}}
    if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(done,done)}else{var ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();try{document.execCommand('copy')}catch(e){}document.body.removeChild(ta);done()}
  }
  function applyEco(key){
    document.querySelectorAll('.eco-tab').forEach(function(tab){var active=tab.getAttribute('data-eco')===key;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',active?'true':'false')});
    document.querySelectorAll('.eco-pane').forEach(function(pane){pane.classList.toggle('active',pane.id==='pane-'+key)});
    if(history.replaceState)history.replaceState(null,'','#'+key);
  }
  function switchEco(key){if(reduced||!document.startViewTransition){applyEco(key);return}document.startViewTransition(function(){applyEco(key)})}
  function initTheme(){
    var saved=null;try{saved=localStorage.getItem('site-theme')}catch(e){}
    var dark=saved?saved==='dark':true;
    root.setAttribute('data-theme',dark?'dark':'light');
    var button=document.getElementById('theme-toggle');
    if(button){button.textContent=dark?'☀':'☾';button.setAttribute('aria-label',dark?'切换浅色模式':'切换深色模式');button.addEventListener('click',function(){var next=root.getAttribute('data-theme')==='dark'?'light':'dark';root.setAttribute('data-theme',next);try{localStorage.setItem('site-theme',next)}catch(e){}button.textContent=next==='dark'?'☀':'☾';button.setAttribute('aria-label',next==='dark'?'切换浅色模式':'切换深色模式')})}
  }
  function initTabs(){
    var nav=document.getElementById('eco-nav');if(!nav)return;
    nav.addEventListener('click',function(e){var tab=e.target.closest('.eco-tab');if(tab)switchEco(tab.getAttribute('data-eco'))});
    nav.addEventListener('keydown',function(e){if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;var tabs=[].slice.call(nav.querySelectorAll('.eco-tab'));var i=tabs.indexOf(document.activeElement);if(i<0)return;e.preventDefault();var n=(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[n].focus();switchEco(tabs[n].getAttribute('data-eco'))});
    var initial=location.hash.replace('#','');if(['mf','ceru','baka','lx'].indexOf(initial)>=0)applyEco(initial);
  }
  function initCopy(){document.addEventListener('click',function(e){var button=e.target.closest('[data-copy]');if(!button)return;var value=button.getAttribute('data-copy');if(window.COPY_URLS&&window.COPY_URLS[value])value=window.COPY_URLS[value];else if(value&&value.indexOf('url:')===0)value=value.slice(4);copyText(value||'',button)})}
  function initSearch(){
    document.addEventListener('input',function(e){if(e.target.closest('.search'))e.target.closest('.search').classList.toggle('has-text',!!e.target.value)});
    document.addEventListener('click',function(e){var button=e.target.closest('.search button');if(!button)return;var input=button.parentNode.querySelector('input');input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));input.focus()});
  }
  function initPointer(){
    if(reduced||!fine)return;
    var cards=[].slice.call(document.querySelectorAll('.sub-card,.hero-note,.lx-card,.package,.feature'));
    cards.forEach(function(card){card.addEventListener('pointermove',function(e){var r=card.getBoundingClientRect();card.style.setProperty('--mx',(e.clientX-r.left)+'px');card.style.setProperty('--my',(e.clientY-r.top)+'px')},{passive:true})});
    document.querySelectorAll('.btn').forEach(function(button){button.addEventListener('pointermove',function(e){var r=button.getBoundingClientRect();var x=(e.clientX-r.left-r.width/2)/r.width;var y=(e.clientY-r.top-r.height/2)/r.height;button.style.transform='translate('+(x*4).toFixed(2)+'px,'+(y*3-2).toFixed(2)+'px)'},{passive:true});button.addEventListener('pointerleave',function(){button.style.transform=''})});
  }
  function initCounters(){
    if(reduced||!('IntersectionObserver' in window))return;
    var observer=new IntersectionObserver(function(entries){entries.forEach(function(entry){if(!entry.isIntersecting)return;observer.unobserve(entry.target);var el=entry.target;var text=el.textContent.trim();var target=Number(text.replace(/[^\d.]/g,''));if(!isFinite(target)||text.indexOf('—')>=0)return;var start=performance.now(),dur=900;function tick(now){var p=Math.min(1,(now-start)/dur);var eased=1-Math.pow(1-p,3);el.textContent=text.indexOf('.')>=0?(target*eased).toFixed(1):String(Math.round(target*eased));if(p<1)requestAnimationFrame(tick);else el.textContent=text}requestAnimationFrame(tick)})},{threshold:.4});
    document.querySelectorAll('.stat b').forEach(function(el){observer.observe(el)});
  }
  function initProgress(){
    if(reduced)return;var bar=document.createElement('div');bar.className='scroll-progress';document.body.appendChild(bar);var scheduled=false;
    function update(){scheduled=false;var h=document.documentElement.scrollHeight-window.innerHeight;bar.style.transform='scaleX('+(h>0?Math.min(1,window.scrollY/h):0)+')'}
    window.addEventListener('scroll',function(){if(!scheduled){scheduled=true;requestAnimationFrame(update)}},{passive:true});update();
  }
  function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn()}
  window.Site={toast:toast,copy:copyText,switchEco:switchEco,ready:ready};
  ready(function(){initTheme();initTabs();initCopy();initSearch();initPointer();initCounters();initProgress()});
})();
