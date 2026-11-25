// Cestinha V6: controles de jogos, foco de jogador e comparador.
// Melhorias progressivas: o site e seus links continuam utilizaveis sem JS.
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const zone = $('.rodada');
  if (!zone) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const get = (el, s) => $(s, el)?.textContent.trim() || '';
  const cards = $$('.grade-jogos .card-jogo[href]', zone);
  const decisivos = $$('.grade-cartas .carta[href]', zone);
  const jogadores = decisivos.map(card => ({
    nome: get(card, '.carta-nome'),
    time: get(card, '.carta-time'),
    foto: $('.v6-carta-foto', card)?.getAttribute('src') || '',
    link: card.getAttribute('href'),
    pts: parseFloat(get(card, '.carta-stats > div:nth-child(1) b')) || 0,
    reb: parseFloat(get(card, '.carta-stats > div:nth-child(2) b')) || 0,
    ast: parseFloat(get(card, '.carta-stats > div:nth-child(3) b')) || 0,
    gs: get(card, '.carta-gs b'),
  })).filter(x => x.nome);

  const lideres = $('.sec-lideres', zone);
  if (lideres && jogadores.length) {
    const focus = document.createElement('section');
    focus.className = 'v6-focus';
    focus.setAttribute('aria-label', 'Jogador em foco');
    focus.innerHTML = '<div class="v6-focus-content"><span class="v6-eyebrow">JOGADOR EM FOCO</span><h2>Os nomes da rodada.</h2><strong class="v6-focus-name"></strong><p class="v6-focus-team"></p><div class="v6-focus-stats"></div><div class="v6-focus-picks"></div><a class="v6-focus-link" href="#">Ver partida</a></div><img class="v6-focus-image" alt="">';
    lideres.prepend(focus);
    let ativo = 0;
    const render = () => {
      const p = jogadores[ativo];
      $('.v6-focus-name', focus).textContent = p.nome;
      $('.v6-focus-team', focus).textContent = p.time;
      $('.v6-focus-stats', focus).innerHTML = '<span>'+p.pts+' PTS</span><span>'+p.reb+' REB</span><span>'+p.ast+' AST</span><span>GS '+esc(p.gs)+'</span>';
      const img = $('.v6-focus-image', focus);
      if (p.foto) {img.src = p.foto; img.hidden = false;} else {img.hidden = true;img.removeAttribute('src');}
      img.alt = 'Retrato de ' + p.nome;
      $('.v6-focus-link', focus).href = p.link;
      $('.v6-focus-picks', focus).innerHTML = jogadores.map((j,i) => '<button type="button" data-i="'+i+'" aria-label="Selecionar '+esc(j.nome)+'" aria-pressed="'+(i===ativo)+'">'+(i+1)+'</button>').join('');
    };
    focus.addEventListener('click', e => {const b=e.target.closest('button[data-i]');if(!b)return;ativo=Number(b.dataset.i);render();});
    render();
  }

  if (cards.length) {
    const container = $('.grade-jogos', zone);
    const controls = document.createElement('div');
    controls.className = 'v6-controls';
    controls.innerHTML = '<p>Veja os jogos e seus protagonistas.</p><div><button type="button" data-filter="todos" aria-pressed="true">Todos os jogos</button> <button type="button" data-filter="protagonistas" aria-pressed="false">Com protagonistas</button></div>';
    container.before(controls);
    controls.addEventListener('click', e => {
      const b=e.target.closest('button[data-filter]');if(!b)return;
      $$('button[data-filter]',controls).forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
      cards.forEach(card=>card.classList.toggle('v6-hidden',b.dataset.filter==='protagonistas'&&!$('.v6-jogo-foto',card)));
    });
  }

  if (!cards.length || !jogadores.length) return;
  const section = document.createElement('section');
  section.className='v6-zone';
  section.innerHTML='<span class="v6-eyebrow">EXPLORE A RODADA</span><h2>A NBA do seu jeito.</h2><p>Descubra quais partidas foram mais disputadas e compare os destaques da noite.</p><div class="v6-tabs" role="tablist"><button type="button" role="tab" data-tab="watch" aria-controls="v6-watch" aria-selected="true">🔥 Vale assistir?</button><button type="button" role="tab" data-tab="compare" aria-controls="v6-compare" aria-selected="false">⚔ Comparar jogadores</button></div><div id="v6-watch" class="v6-pane" role="tabpanel"></div><div id="v6-compare" class="v6-pane" role="tabpanel" hidden></div>';
  $('.sec-jogos',zone)?.before(section);
  $$('button[data-tab]',section).forEach(b=>b.addEventListener('click',()=>{
    $$('button[data-tab]',section).forEach(x=>x.setAttribute('aria-selected',String(x===b)));
    $('#v6-watch',section).hidden=b.dataset.tab!=='watch';
    $('#v6-compare',section).hidden=b.dataset.tab!=='compare';
  }));
  const partidas = cards.map(c => {
    const pontos=$$('.linha-time .pontos',c).map(el=>Number(el.textContent.trim()));
    if(pontos.length!==2||pontos.some(x=>!Number.isFinite(x))) return null;
    const diferenca=Math.abs(pontos[0]-pontos[1]);
    const extra=/prorroga/i.test(get(c,'.situacao'));
    const indice=Math.max(1,Math.min(100,Math.round(85-diferenca*2+(extra?18:0))));
    const nomes=$$('.linha-time .nome',c).map(el=>el.childNodes[0]?.textContent.trim()).filter(Boolean);
    return {titulo:get(c,'.card-titulo')||'Resumo da partida',nome:nomes.join(' × ')||'Confronto da rodada',indice,href:c.getAttribute('href')};
  }).filter(Boolean).sort((a,b)=>b.indice-a.indice);

  const watch=$('#v6-watch',section);
  if(partidas.length){
    watch.innerHTML='<div class="v6-watch"><article class="v6-feature" aria-live="polite"><span class="v6-eyebrow">ÍNDICE EXPERIMENTAL DE EMOÇÃO</span><strong></strong><p></p><a href="#">Ver partida</a></article><div class="v6-picks"></div></div><p style="font-size:11px;color:#97a8bb">Índice ilustrativo: considera diferença final e prorrogação; não é uma avaliação oficial.</p>';
    let atual=0;
    const paint=()=>{
      const p=partidas[atual];
      $('.v6-feature strong',watch).textContent=p.nome+' · '+p.indice+'/100';
      $('.v6-feature p',watch).textContent=p.titulo;
      $('.v6-feature a',watch).href=p.href;
      $('.v6-picks',watch).innerHTML=partidas.map((g,i)=>'<button type="button" data-i="'+i+'" aria-pressed="'+(i===atual)+'"><span>'+esc(g.nome)+'<small>'+esc(g.titulo)+'</small></span><b>'+g.indice+'</b></button>').join('');
    };
    watch.addEventListener('click',e=>{const b=e.target.closest('button[data-i]');if(!b)return;atual=Number(b.dataset.i);paint();});
    paint();
  }else watch.innerHTML='<p>O índice aparecerá quando os placares finais estiverem disponíveis.</p>';

  const compare=$('#v6-compare',section);
  compare.innerHTML='<div class="v6-selects"><label>Jogador 1<select data-jogador="1"></select></label><b class="v6-versus">VS</b><label>Jogador 2<select data-jogador="2"></select></label></div><div class="v6-duel"></div><p style="font-size:11px">São os números da rodada exibida, não médias da temporada.</p>';
  const options=jogadores.map((p,i)=>'<option value="'+i+'">'+esc(p.nome)+'</option>').join('');
  const select=$$('select',compare);
  select.forEach(el=>el.innerHTML=options);
  select[1].value=String(Math.min(1,jogadores.length-1));
  const renderDuel=()=>{
    const a=jogadores[Number(select[0].value)],b=jogadores[Number(select[1].value)];
    if(!a||!b)return;
    const card=p=>'<article class="v6-duel-card"><strong>'+esc(p.nome)+'</strong><span>'+esc(p.time)+'</span>'+(p.foto?'<img src="'+p.foto+'" loading="lazy" alt="Retrato de '+esc(p.nome)+'" onerror="this.remove()">':'')+'</article>';
    const rows=[['PTS','pts'],['REB','reb'],['AST','ast']].map(([rot,key])=>{
      const maior=Math.max(1,a[key],b[key]);
      return '<div class="v6-barrow"><b>'+a[key]+'</b><div class="v6-bar"><i style="width:'+(a[key]/maior*100)+'%"></i></div><label>'+rot+'</label><div class="v6-bar right"><i style="width:'+(b[key]/maior*100)+'%"></i></div><b>'+b[key]+'</b></div>';
    }).join('');
    $('.v6-duel',compare).innerHTML=card(a)+card(b)+'<div class="v6-bars">'+rows+'</div>';
  };
  select.forEach(el=>el.addEventListener('change',renderDuel));
  renderDuel();
})();