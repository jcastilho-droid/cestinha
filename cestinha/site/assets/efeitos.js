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

// ---------- Preferências do visitante (ficam só neste navegador) ----------
(() => {
  const ler = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const gravar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
  const raiz = (document.querySelector('.marca')?.getAttribute('href') || './index.html').replace(/index\.html$/, '');

  // Modo sem spoiler
  const botao = document.querySelector('.botao-spoiler');
  const aviso = document.querySelector('.aviso-spoiler');
  const aplicarSpoiler = (on) => {
    document.body.classList.toggle('sem-spoiler', on);
    botao?.setAttribute('aria-pressed', String(on));
    if (aviso) aviso.hidden = !on;
  };
  aplicarSpoiler(ler('cestinha-sem-spoiler') === '1');
  botao?.addEventListener('click', () => {
    const on = !document.body.classList.contains('sem-spoiler');
    gravar('cestinha-sem-spoiler', on ? '1' : null);
    document.querySelectorAll('.revelado').forEach((el) => el.classList.remove('revelado'));
    aplicarSpoiler(on);
  });
  const SEL = '.pontos, .fx-time b, .ep-placar, .card-titulo, .hero h1, .hero .subtitulo, .em-30s ul, .resumo-rodada .texto, .carta-stats, .carta-gs, .lider-valor, .dn-numeros, .numeros, .resenha, .tags, .comparativo, .box, .parciais, .grafico-jogo .gj-caixa, .paineis-arremessos, .jt-placar, .jt-res, .card-epico p, .mini-destaques, .pontos-ag';
  document.addEventListener('click', (ev) => {
    if (!document.body.classList.contains('sem-spoiler')) return;
    const el = ev.target.closest(SEL);
    if (el && !el.classList.contains('revelado')) { ev.preventDefault(); el.classList.add('revelado'); }
  }, true);

  // Meu time
  const meu = (() => { try { return JSON.parse(ler('cestinha-meu-time') || 'null'); } catch { return null; } })();
  const atalho = document.querySelector('.meu-time-atalho');
  if (meu && atalho) {
    atalho.hidden = false;
    atalho.href = `${raiz}times/${meu.href}`;
    atalho.title = `Meu time: ${meu.nome}`;
    atalho.innerHTML = `<img src="${meu.logo}" alt="${meu.nome}">`;
  }
  if (meu) {
    document.querySelectorAll('[data-times]').forEach((el) => {
      if (!el.dataset.times.split(' ').includes(meu.sigla)) return;
      el.classList.add('meu-time');
      const grade = el.parentElement;
      if (grade && (grade.classList.contains('grade-jogos') || grade.classList.contains('trilho-hoje'))) grade.prepend(el);
    });
  }
  const bMeu = document.querySelector('.botao-meu-time');
  if (bMeu) {
    const marcar = (on) => { bMeu.setAttribute('aria-pressed', String(on)); bMeu.querySelector('span').textContent = on ? 'Meu time (toque para deixar de seguir)' : 'Seguir como meu time'; };
    marcar(meu?.sigla === bMeu.dataset.sigla);
    bMeu.addEventListener('click', () => {
      const on = bMeu.getAttribute('aria-pressed') !== 'true';
      gravar('cestinha-meu-time', on ? JSON.stringify({ sigla: bMeu.dataset.sigla, logo: bMeu.dataset.logo, href: bMeu.dataset.href, nome: bMeu.dataset.nome }) : null);
      marcar(on);
    });
  }

  // Contagem regressiva (agenda e "hoje à noite")
  const contar = () => {
    const agora = Date.now();
    document.querySelectorAll('.contagem[data-inicio]').forEach((el) => {
      const ms = Date.parse(el.dataset.inicio) - agora;
      if (ms <= 0) { el.textContent = ms > -3 * 3600e3 ? 'em andamento' : ''; return; }
      const h = Math.floor(ms / 3600e3); const m = Math.floor((ms % 3600e3) / 60e3);
      el.textContent = h >= 24 ? '' : `começa em ${h ? `${h}h ` : ''}${m}min`;
    });
  };
  contar();
  setInterval(contar, 30000);
})();

// ---------- Compartilhar ----------
document.querySelectorAll('.btn-compartilhar').forEach((b) => {
  b.addEventListener('click', async () => {
    const dados = { title: b.dataset.titulo, text: `${b.dataset.titulo} | Cestinha`, url: b.dataset.url };
    try {
      if (navigator.share) { await navigator.share(dados); return; }
      await navigator.clipboard.writeText(b.dataset.url);
      const antes = b.innerHTML; b.textContent = 'Link copiado!'; setTimeout(() => { b.innerHTML = antes; }, 2000);
    } catch { /* usuário cancelou */ }
  });
});
