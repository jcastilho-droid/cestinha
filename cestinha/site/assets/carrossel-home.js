/* Cestinha | destaques editoriais na home, sem dependencias externas */
(() => {
  const carousels = document.querySelectorAll('[data-cestinha-carrossel]');
  for (const carousel of carousels) {
    const slides = [...carousel.querySelectorAll('.noticia-slide')];
    if (slides.length < 2) continue;
    const dots = [...carousel.querySelectorAll('[data-noticia-indice]')];
    const prev = carousel.querySelector('[data-noticia-prev]');
    const next = carousel.querySelector('[data-noticia-next]');
    const status = carousel.querySelector('[data-noticia-status]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let timer = null;
    let initialX = null;
    let onScreen = true;
    let userPaused = false;
    let pointerOver = false;
    let focusInside = false;
    const sync = () => {
      slides.forEach((slide, i) => {
        slide.hidden = i !== index;
        slide.setAttribute('aria-hidden', String(i !== index));
      });
      dots.forEach((dot, i) => {
        dot.setAttribute('aria-current', i === index ? 'true' : 'false');
        dot.setAttribute('aria-label', 'Mostrar destaque ' + (i + 1) + ' de ' + slides.length);
      });
      if (status) status.textContent = (index + 1) + ' de ' + slides.length;
    };
    const stopTimer = () => {
      if (timer !== null) { clearInterval(timer); timer = null; }
    };
    const canPlay = () => !userPaused && !pointerOver && !focusInside &&
      !document.hidden && onScreen && !reducedMotion.matches;
    const startTimer = () => {
      stopTimer();
      if (canPlay()) timer = setInterval(() => { index = (index + 1) % slides.length; sync(); }, 7500);
    };
    const go = (nextIndex, intentional = false) => {
      index = (nextIndex + slides.length) % slides.length;
      if (intentional) userPaused = true;
      sync();
      startTimer();
    };
    prev?.addEventListener('click', () => go(index - 1, true));
    next?.addEventListener('click', () => go(index + 1, true));
    dots.forEach((dot, i) => dot.addEventListener('click', () => go(i, true)));
    carousel.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      // So navegar com setas quando foco estiver nos controles do carrossel.
      if (!(e.target.closest('.noticia-controles'))) return;
      e.preventDefault();
      go(index + (e.key === 'ArrowRight' ? 1 : -1), true);
    });
    carousel.addEventListener('touchstart', e => {
      if (e.touches.length === 1) initialX = e.touches[0].clientX;
    }, { passive:true });
    carousel.addEventListener('touchend', e => {
      if (initialX === null || !e.changedTouches.length) return;
      const dx = e.changedTouches[0].clientX - initialX;
      initialX = null;
      if (Math.abs(dx) >= 55) go(index + (dx < 0 ? 1 : -1), true);
    }, { passive:true });
    carousel.addEventListener('mouseenter', () => { pointerOver = true; startTimer(); });
    carousel.addEventListener('mouseleave', () => { pointerOver = false; startTimer(); });
    carousel.addEventListener('focusin', () => { focusInside = true; startTimer(); });
    carousel.addEventListener('focusout', e => {
      if (e.relatedTarget && carousel.contains(e.relatedTarget)) return;
      focusInside = false; startTimer();
    });
    document.addEventListener('visibilitychange', startTimer);
    reducedMotion.addEventListener?.('change', startTimer);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        onScreen = entries[0]?.isIntersecting ?? false;
        startTimer();
      }, { threshold: .2 });
      observer.observe(carousel);
    }
    sync();
    startTimer();
  }
})();