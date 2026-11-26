/* Cestinha — carrossel editorial: dots, swipe e reprodução automática 6s. */
(() => {
  const INTERVALO = 6000;
  document.querySelectorAll('[data-cestinha-carrossel]').forEach(carousel => {
    const slides = [...carousel.querySelectorAll('.noticia-slide')];
    const dots = [...carousel.querySelectorAll('[data-noticia-indice]')];
    if (!slides.length) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0, timer = null, startX = null, visible = true;
    let hovering = false, focused = false, touching = false;
    const pause = () => { if (timer !== null) { clearTimeout(timer); timer = null; } };
    const render = () => {
      slides.forEach((s,i) => { s.hidden = i !== index; s.setAttribute('aria-hidden',String(i!==index)); });
      dots.forEach((dot,i) => {
        dot.setAttribute('aria-current',i===index?'true':'false');
        dot.setAttribute('aria-label','Mostrar destaque '+(i+1)+' de '+slides.length);
      });
    };
    const allowed = () => slides.length>1 && visible && !document.hidden &&
      !hovering && !focused && !touching && !reduced.matches;
    const schedule = () => {
      pause();
      if (allowed()) timer = setTimeout(() => {
        index = (index + 1) % slides.length;
        render();
        schedule();
      }, INTERVALO);
    };
    const go = i => { index = (i+slides.length)%slides.length; render(); schedule(); };
    dots.forEach((dot,i) => dot.addEventListener('click', () => {
      go(i);
      // O proximo ciclo recomeça quando o usuário sai dos controles.
      if (document.activeElement === dot && !dot.matches(':focus-visible')) dot.blur();
    }));
    carousel.addEventListener('keydown',e => {
      if (!e.target.closest('.noticia-pontos')) return;
      if (e.key==='ArrowLeft'||e.key==='ArrowRight') {
        e.preventDefault();
        const next=(index+(e.key==='ArrowRight'?1:-1)+slides.length)%slides.length;
        go(next); dots[next]?.focus();
      }
    });
    carousel.addEventListener('touchstart',e => {
      if (e.touches.length!==1)return;
      startX=e.touches[0].clientX; touching=true; schedule();
    },{passive:true});
    carousel.addEventListener('touchend',e => {
      if(startX!==null&&e.changedTouches.length){
        const dx=e.changedTouches[0].clientX-startX;
        if(Math.abs(dx)>=55) go(index+(dx<0?1:-1));
      }
      startX=null;touching=false;schedule();
    },{passive:true});
    carousel.addEventListener('touchcancel',() => {startX=null;touching=false;schedule()},{passive:true});
    carousel.addEventListener('mouseenter',()=>{hovering=true;schedule()});
    carousel.addEventListener('mouseleave',()=>{hovering=false;schedule()});
    carousel.addEventListener('focusin',()=>{focused=true;schedule()});
    carousel.addEventListener('focusout',e=>{
      if(e.relatedTarget&&carousel.contains(e.relatedTarget))return;
      focused=false;schedule();
    });
    document.addEventListener('visibilitychange',schedule);
    reduced.addEventListener?.('change',schedule);
    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(entries=>{
        visible=!!entries[0]?.isIntersecting;
        schedule();
      },{threshold:.2});io.observe(carousel);
    }
    render();schedule();
  });
})();