// Central do Mercado. Exclusiva da nova pagina; nao muda o layout da home.
import fs from 'node:fs';
import path from 'node:path';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const allowed=new Set(['trocas','draft','agencia','contratos','rumores']);
function portrait(nome,times){
  const p=[...times.values()].flatMap(t=>t.elenco||[]).filter(p=>normalize(p.nome)===normalize(nome)&&/^\d+$/.test(String(p.id)));
  if(p.length!==1)return '';
  return 'https://a.espncdn.com/i/headshots/nba/players/full/'+p[0].id+'.png';
}
function logo(sigla,times){
  const t=[...times.values()].find(t=>String(t.sigla).toUpperCase()===String(sigla).toUpperCase());
  if(!t?.logo)return '<b class="mercado-logo-texto">'+esc(sigla)+'</b>';
  return '<img src="'+esc(t.logo)+'" alt="'+esc(t.nome_curto||sigla)+'" loading="lazy" onerror="this.replaceWith(document.createTextNode(this.alt))">';
}
function dataBR(d){const [y,m,day]=String(d||'').split('-');return day&&m&&y?day+'/'+m+'/'+y:String(d||'');}
const categories={trocas:'Trocas',draft:'Draft',agencia:'Agência livre',contratos:'Contratos',rumores:'Rumores'};
function blockVisual(item,times,small=false){
  const photos=(item.jogadores||[]).map(p=>({nome:p,url:portrait(p,times)})).filter(p=>p.url).slice(0,2);
  const badges=(item.times||[]).slice(0,2).map(sigla=>logo(sigla,times)).join('<span class="mercado-swap" aria-hidden="true">↔</span>');
  return '<div class="mercado-art'+(small?' small':'')+'" aria-hidden="true">'+
    '<div class="mercado-art-glow"></div>'+
    (photos.length?'<div class="mercado-portraits">'+photos.map((p,i)=>'<div class="mercado-photo"><img src="'+esc(p.url)+'" alt="" loading="lazy" onerror="this.parentElement.remove()"></div>').join('')+'</div>':
      '<div class="mercado-ball">🏀</div>')+
    '<div class="mercado-team-logos">'+badges+'</div></div>';
}
function card(item,times,featured=false){
  return '<article class="mercado-card'+(featured?' destaque':'')+'" data-market-category="'+esc(item.categoria)+'" data-market-search="'+esc(normalize([item.titulo,item.resumo,...item.times,...item.jogadores].join(' ')))+'">'+
    blockVisual(item,times,featured)+
    '<div class="mercado-card-body"><div class="mercado-meta"><span class="mercado-tag">'+esc(item.selo)+'</span><time datetime="'+esc(item.data)+'">'+dataBR(item.data)+'</time></div>'+
    '<h3>'+esc(item.titulo)+'</h3><p>'+esc(item.resumo)+'</p>'+
    '<details class="mercado-more"><summary>Entenda a movimentação <span aria-hidden="true">⌄</span></summary><p>'+esc(item.detalhe||item.resumo)+'</p></details>'+
    '<a class="mercado-source" href="'+esc(item.url)+'" target="_blank" rel="noopener noreferrer">Ler na fonte · '+esc(item.fonte)+' ↗</a>'+
    '</div></article>';
}
export function gerarMercado({P,times,pagina}){
 const file=path.join(path.dirname(P.site),'data','mercado.json');
 const data=JSON.parse(fs.readFileSync(file,'utf8'));
 const items=(data.items||[]).filter(i=>allowed.has(i.categoria)&&/^https:\/\/(www\.)?nba\.com\//.test(i.url)&&i.titulo&&i.data)
    .sort((a,b)=>b.data.localeCompare(a.data));
 const featured=items.find(i=>i.id==='tor-kawhi-2026')||items[0];
 const main=items;
 const counts=Object.fromEntries(Object.keys(categories).map(k=>[k,items.filter(i=>i.categoria===k).length]));
 const filters='<div class="mercado-filtros" role="group" aria-label="Filtrar notícias do mercado">'+
  '<button type="button" data-mercado-filtro="todos" aria-pressed="true">Tudo <b>'+items.length+'</b></button>'+
  Object.entries(categories).map(([k,v])=>'<button type="button" data-mercado-filtro="'+k+'" aria-pressed="false">'+v+' <b>'+counts[k]+'</b></button>').join('')+'</div>';
 const hero='<header class="mercado-heading"><div><p class="mercado-kicker">CESTINHA · BASTIDORES DA NBA</p><h1>CENTRAL DO <span>MERCADO</span></h1>'+
  '<p>Trocas, Draft, agência livre e contratos. Uma cobertura direta, visual e com fonte identificada.</p></div>'+
  '<div class="mercado-curadoria"><span class="mercado-dot"></span> Curadoria conferida em '+dataBR(data.revisado_em)+'</div></header>';
 const feature='<section class="mercado-feature" aria-label="Movimentação em destaque"><div class="mercado-feature-copy">'+
   '<span class="mercado-tag">EM DESTAQUE · '+esc(featured.selo)+'</span>'+
   '<h2>'+esc(featured.titulo)+'</h2><p>'+esc(featured.resumo)+'</p>'+
   '<a href="#mercado-feed" class="mercado-action">Explorar movimentações ↗</a></div>'+blockVisual(featured,times,false)+'</section>';
 const body='<section class="mercado-pagina">'+hero+feature+
   '<section id="mercado-feed" class="mercado-feed" aria-label="Movimentações da NBA">'+
   '<div class="mercado-section-title"><div><span>ACOMPANHE CADA MOVIMENTO</span><h2>O que acontece fora da quadra</h2></div>'+
   '<p>Oficial é oficial. Rumor só entra com fonte e sinalização.</p></div>'+
   '<div class="mercado-filtro-area">'+filters+
   '<label class="mercado-busca"><span class="mercado-sr">Buscar notícia</span><input id="mercado-pesquisa" type="search" placeholder="Buscar jogador ou time…" autocomplete="off"></label></div>'+
   '<p class="mercado-contagem" id="mercado-contagem" aria-live="polite">'+main.length+' notícias</p>'+
   '<div id="mercado-grid" class="mercado-grid">'+main.map(i=>card(i,times)).join('')+'</div>'+
   '<div id="mercado-vazio" class="mercado-empty" hidden>Nenhum resultado com esses filtros. Rumores não confirmados não são publicados como notícia.</div>'+
   '</section>'+
   '<section class="mercado-nota"><strong>Sobre as informações</strong><p>Esta seção utiliza uma seleção editorial de fontes oficiais, não uma atualização em tempo real. As datas mostram a data da movimentação, salvo quando explicitamente indicam o balanço da fonte. A ausência de rumores verificados não significa que não existam conversas entre equipes.</p>'+
   '<div><a href="https://www.nba.com/news/2026-offseason-trade-tracker" target="_blank" rel="noopener noreferrer">Trocas oficiais ↗</a>'+
   '<a href="https://www.nba.com/draft/2026" target="_blank" rel="noopener noreferrer">Draft 2026 ↗</a>'+
   '<a href="https://www.nba.com/news/nba-offseason-deals-2026" target="_blank" rel="noopener noreferrer">Agência livre ↗</a></div></section>'+
   '</section>';
 fs.writeFileSync(path.join(P.site,'mercado.html'),pagina({titulo:'Mercado NBA | Cestinha',descricao:'Central do Mercado NBA: trocas, Draft, contratações e contratos, com links para fontes oficiais.',raiz:'.',canonical:'/mercado.html',ativo:'mercado',corpo:body}));
 console.log('[mercado] '+items.length+' movimentações verificadas; '+(items.length-1)+' cards e destaque.');
}
