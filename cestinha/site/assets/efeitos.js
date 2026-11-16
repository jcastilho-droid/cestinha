// Efeitos visuais do Cestinha. Tudo é opcional: sem JavaScript o site funciona igual.
(() => {
  const semMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const temMouse = window.matchMedia('(hover: hover)').matches;

  // 1) Entrada suave dos blocos ao rolar a página
  const blocos = document.querySelectorAll('.titulo-secao, .card-jogo, .card-epico, .lider, .escudo-time, .linha-classif, .atleta, .jogo-time, .numeros-time > div, .lider-time, .box, .comparativo, .resumo-rodada, .destaque-noite, .mini-destaque');
  if (!semMovimento && 'IntersectionObserver' in window) {
    blocos.forEach((el) => el.classList.add('revelar'));
    const obs = new IntersectionObserver((entradas) => {
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        const irmaos = [...e.target.parentElement.children].filter((x) => x.classList.contains('revelar'));
        e.target.style.transitionDelay = `${Math.min(irmaos.indexOf(e.target), 8) * 45}ms`;
        e.target.classList.add('visivel');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -40px 0px' });
    blocos.forEach((el) => obs.observe(el));
  }

  // 2) Números que "sobem" até o valor final
  if (!semMovimento) {
    const contar = (el) => {
      const fim = Number(el.dataset.contar);
      if (!Number.isFinite(fim) || fim === 0) return;
      const t0 = performance.now();
      const dur = 900;
      const passo = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(fim * (1 - (1 - p) ** 3));
        if (p < 1) requestAnimationFrame(passo);
      };
      requestAnimationFrame(passo);
    };
    const obsN = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { contar(e.target); obsN.unobserve(e.target); } }));
    document.querySelectorAll('[data-contar]').forEach((el) => obsN.observe(el));
  }

  if (!temMouse || semMovimento) return;

  // 3) Luz que acompanha o mouse dentro dos cards
  document.addEventListener('pointermove', (ev) => {
    const el = ev.target.closest('[data-luz], [data-tilt]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`);
    el.style.setProperty('--my', `${ev.clientY - r.top}px`);
  }, { passive: true });

  // 4) Inclinação 3D leve nos escudos e destaques
  document.querySelectorAll('[data-tilt]').forEach((el) => {
    el.addEventListener('pointermove', (ev) => {
      const r = el.getBoundingClientRect();
      const x = (ev.clientX - r.left) / r.width - 0.5;
      const y = (ev.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(700px) rotateX(${(-y * 8).toFixed(2)}deg) rotateY(${(x * 10).toFixed(2)}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
})();
