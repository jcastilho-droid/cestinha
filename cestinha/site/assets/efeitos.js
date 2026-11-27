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
  const SEL = '.pontos, .fx-time b, .ep-placar, .card-titulo, .hero h1, .hero .subtitulo, .em-30s ul, .resumo-rodada .texto, .carta-stats, .carta-gs, .lider-valor, .dn-numeros, .numeros, .resenha, .tags, .comparativo, .box, .parciais, .grafico-jogo .gj-caixa, .paineis-arremessos, .jt-placar, .jt-res, .card-epico p, .mini-destaques, .pontos-ag, .mc-placar, .mc-res, .mc-textos';
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

  // Meu Cestinha: a home começa pelo time favorito
  const caixa = document.querySelector('.meu-cestinha');
  if (caixa) {
    const h = (x) => String(x ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    const tz = { timeZone: 'America/Sao_Paulo' };
    const diaTxt = (iso) => {
      const f = (d) => new Intl.DateTimeFormat('en-CA', tz).format(d);
      const d = new Date(iso);
      if (f(d) === f(new Date())) return 'Hoje';
      if (f(d) === f(new Date(Date.now() + 864e5))) return 'Amanhã';
      return new Intl.DateTimeFormat('pt-BR', { ...tz, weekday: 'short', day: '2-digit', month: '2-digit' }).format(d).replace('.', '');
    };
    const horaTxt = (iso) => new Intl.DateTimeFormat('pt-BR', { ...tz, hour: '2-digit', minute: '2-digit' }).format(new Date(iso)).replace(':', 'h');
    const img = (src, alt, tam) => (src ? `<img src="${h(src)}" alt="${h(alt)}" width="${tam}" height="${tam}" loading="lazy">` : `<span class="mc-sigla">${h(alt)}</span>`);
    const seletor = (dados, comCancelar) => {
      const lista = Object.values(dados).sort((a, b) => a.nome_curto.localeCompare(b.nome_curto));
      return `<details class="mc-escolha"${comCancelar ? ' open' : ''}>
        <summary><span class="mc-estrela">★</span><b>Monte o seu Cestinha</b><small>Escolha seu time e a página inicial passa a começar por ele.</small></summary>
        <div class="mc-escudos">${lista.map((t) => `<button type="button" class="mc-escudo" data-escolher="${h(t.sigla)}" style="--t1:${h(t.cor || '#ff7a1a')}" title="${h(t.nome)}">${img(t.logo, t.sigla, 40)}<span>${h(t.nome_curto)}</span></button>`).join('')}</div>
        <p class="mc-aviso">Fica salvo só neste navegador. Não precisa de cadastro.${comCancelar ? ' <button type="button" class="mc-link" data-cancelar>Cancelar</button>' : ''}</p>
      </details>`;
    };
    const cartao = (t) => {
      const u = t.ultimo; const p = t.proximo;
      const colocacao = [t.posicao ? `${t.posicao}º no ${h(t.conferencia)}` : '', t.campanha, t.sequencia].filter(Boolean).join(' · ');
      const blocoUlt = u ? `<div class="mc-bloco">
          <p class="mc-rot">Último jogo · ${h(u.data)}</p>
          <div class="mc-jogo"><span class="mc-res ${u.resultado === 'V' ? 'v' : 'd'}">${u.resultado === 'V' ? 'Vitória' : 'Derrota'}</span>
          <span class="mc-placar">${u.pts} a ${u.pts_adv}</span></div>
          <p class="mc-adv">${u.em_casa ? 'contra' : 'na casa do'} ${img(u.logo, u.sigla, 22)} <b>${h(u.nome)}</b></p>
          ${u.jogo ? `<a class="mc-link" href="${raiz}${h(u.jogo)}">Ler a resenha do Cestinha →</a>` : ''}
        </div>` : '';
      const blocoProx = p ? `<div class="mc-bloco">
          <p class="mc-rot">Próximo jogo</p>
          <div class="mc-jogo"><span class="mc-quando">${h(diaTxt(p.inicio_utc))}</span><span class="mc-hora">${h(horaTxt(p.inicio_utc))}</span></div>
          <p class="mc-adv">${p.em_casa ? 'recebe o' : 'visita o'} ${img(p.logo, p.sigla, 22)} <b>${h(p.nome)}</b></p>
          <small class="contagem" data-inicio="${h(p.inicio_utc)}"></small>
          ${t.recomendado ? '<p class="mc-rec">★ É o jogo recomendado pelo Cestinha hoje!</p>' : ''}
        </div>` : '';
      const blocoJog = t.destaques.length ? `<div class="mc-bloco">
          <p class="mc-rot">Quem carrega o time</p>
          <ol class="mc-jogadores">${t.destaques.map((d) => `<li><span class="mc-num">${h(d.numero)}</span><div><b>${h(d.nome)}</b>${d.lesao ? ` <em class="mc-lesao">${h(d.lesao)}</em>` : ''}<small>${h(d.linha)} por jogo</small></div></li>`).join('')}</ol>
        </div>` : '';
      const textos = t.textos.length ? `<div class="mc-textos"><p class="mc-rot">O Cestinha escreveu</p><ul>${t.textos.map((x) => `<li><a href="${raiz}${h(x.href)}"><small>${h(x.data)}</small> ${h(x.titulo)}</a></li>`).join('')}</ul></div>` : '';
      return `<div class="mc-cartao" style="--t1:${h(t.cor || '#ff7a1a')};--t2:${h(t.cor2 || t.cor || '#ff7a1a')};--acento:${h(t.acento || '#ff7a1a')}">
        <img class="mc-marca" src="${h(t.logo)}" alt="" aria-hidden="true">
        <header class="mc-topo">${img(t.logo, t.sigla, 64)}
          <div><p class="mc-sobre">★ Meu Cestinha</p><h2>${h(t.nome)}</h2><p class="mc-col">${colocacao}${t.divisao ? ` · ${t.divisao.posicao}º na divisão ${h(t.divisao.nome)}` : ''}</p></div>
          <div class="mc-acoes"><a class="mc-botao" href="${raiz}${h(t.href)}">Página do time</a><button type="button" class="mc-link" data-trocar>Trocar de time</button></div>
        </header>
        <div class="mc-grade">${blocoUlt}${blocoProx}${blocoJog}</div>
        ${textos}
      </div>`;
    };
    fetch(`${raiz}assets/meu-time.json?v=${caixa.dataset.v || ''}`).then((r) => r.json()).then((dados) => {
      const desenhar = (trocando) => {
        const atual = (() => { try { return JSON.parse(ler('cestinha-meu-time') || 'null'); } catch { return null; } })();
        caixa.innerHTML = !trocando && atual && dados[atual.sigla] ? cartao(dados[atual.sigla]) : seletor(dados, trocando);
        caixa.hidden = false;
        contar();
      };
      caixa.addEventListener('click', (ev) => {
        const esc1 = ev.target.closest('[data-escolher]');
        if (esc1) {
          const t = dados[esc1.dataset.escolher];
          gravar('cestinha-meu-time', JSON.stringify({ sigla: t.sigla, logo: t.logo, href: t.href.replace(/^times\//, ''), nome: t.nome_curto }));
          location.reload();
          return;
        }
        if (ev.target.closest('[data-trocar]')) desenhar(true);
        if (ev.target.closest('[data-cancelar]')) desenhar(false);
      });
      desenhar(false);
    }).catch(() => { /* sem dados: a home segue normal */ });
  }

  // Contagem regressiva (agenda e "hoje à noite")
  function contar() {
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

// ---------- Me explica essa NBA: busca e filtro ----------
(() => {
  const busca = document.getElementById('busca-verbete');
  if (!busca) return;
  const verbetes = [...document.querySelectorAll('.verbete')];
  const grupos = [...document.querySelectorAll('.ap-grupo')];
  const vazio = document.querySelector('.ap-vazio');
  let cat = '';
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const filtrar = () => {
    const q = norm(busca.value.trim());
    let n = 0;
    verbetes.forEach((v) => {
      const ok = (!cat || v.dataset.cat === cat) && (!q || norm(v.dataset.busca).includes(q));
      v.hidden = !ok;
      if (ok) n++;
    });
    grupos.forEach((g) => { g.hidden = !g.querySelector('.verbete:not([hidden])'); });
    vazio.hidden = n > 0;
  };
  busca.addEventListener('input', filtrar);
  document.querySelectorAll('.ap-cat').forEach((b) => b.addEventListener('click', () => {
    cat = b.dataset.cat;
    document.querySelectorAll('.ap-cat').forEach((x) => x.classList.toggle('ativo', x === b));
    filtrar();
  }));
})();

// ---------- Barra do celular: painel "Mais" e barra que se esconde ao rolar ----------
(() => {
  const barra = document.querySelector('.barra-inferior.barra-v2');
  const botao = barra?.querySelector('.bi-mais');
  const painel = document.getElementById('painel-mais');
  const veu = document.querySelector('.painel-mais-veu');
  if (!barra || !botao || !painel || !veu) return;
  // "Meu time": vai direto para a página do time salvo, se houver
  try {
    const meu = JSON.parse(localStorage.getItem('cestinha-meu-time') || 'null');
    const link = painel.querySelector('[data-meu-time-link]');
    if (meu?.href && link) {
      link.href = link.getAttribute('href').replace(/index\.html$/, meu.href);
      const sub = link.querySelector('small'); if (sub) sub.textContent = meu.nome || 'seu time';
    }
  } catch { /* sem armazenamento */ }
  const abrir = (on) => {
    painel.classList.toggle('aberto', on);
    painel.setAttribute('aria-hidden', String(!on));
    botao.setAttribute('aria-expanded', String(on));
    if (on) { veu.hidden = false; requestAnimationFrame(() => veu.classList.add('aberto')); barra.classList.remove('escondida'); }
    else { veu.classList.remove('aberto'); setTimeout(() => { if (!painel.classList.contains('aberto')) veu.hidden = true; }, 260); }
  };
  botao.addEventListener('click', () => abrir(!painel.classList.contains('aberto')));
  veu.addEventListener('click', () => abrir(false));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && painel.classList.contains('aberto')) { abrir(false); botao.focus(); } });
  // esconde ao rolar para baixo, mostra ao rolar para cima
  let ultimo = window.scrollY; let pendente = false;
  window.addEventListener('scroll', () => {
    if (pendente) return; pendente = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (!painel.classList.contains('aberto')) {
        if (y > ultimo + 8 && y > 120) barra.classList.add('escondida');
        else if (y < ultimo - 8 || y < 120) barra.classList.remove('escondida');
      }
      ultimo = y; pendente = false;
    });
  }, { passive: true });
})();
