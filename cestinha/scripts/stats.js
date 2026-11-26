// Cestinha Stats: pagina montada a partir dos dados reais da coleta ESPN.
import fs from 'node:fs';
import path from 'node:path';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const norm=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function gerarCestinhaStats({P,times,dias,jogoDoDia,pagina}){
  const elenco=new Map();
  for(const t of times.values())for(const p of t.elenco||[])elenco.set(norm(p.nome),p);
  const equipes=[...times.values()].map(t=>({
    id:String(t.id),sigla:t.sigla,nome:t.nome_curto,logo:t.logo,cor:t.cor,
    campanha:t.classificacao?t.classificacao.v+'-'+t.classificacao.d:'—',
    posicao:t.classificacao?.posicao??null,
    stats:Object.fromEntries(Object.entries(t.estatisticas||{}).map(([k,v])=>[k,num(v)])),
    recentes:(t.jogos||[]).filter(j=>j.finalizado&&j.placar).slice(-15).map(j=>({
      data:j.data_utc,adversario:j.adversario?.sigla||'—',pts:num(j.placar?.time),
      sofridos:num(j.placar?.adversario),resultado:j.resultado
    })),
    lesoes:(t.elenco||[]).filter(p=>p.lesao?.status).slice(0,15).map(p=>({
      nome:p.nome,status:p.lesao.status,tipo:p.lesao.tipo||null
    })),
    jogadores:(t.elenco||[]).filter(p=>p.medias).map(p=>({
      id:p.id,nome:p.nome,numero:p.numero,posicao:p.posicao_sigla||p.posicao||'—',medias:p.medias
    }))
  }));
  // Historico individual: usa todos os box scores locais, nao apenas os exibidos no seletor.
  // IDs sao associados ao elenco somente com nome unico; sem IDs usamos time + nome.
  const nomes=new Map();
  for(const t of times.values())for(const p of t.elenco||[]){
    const k=norm(p.nome);if(!nomes.has(k))nomes.set(k,new Set());
    if(p.id)nomes.get(k).add(String(p.id));
  }
  const identidade=(p,t)=>{
    const ids=nomes.get(norm(p.nome));
    return ids?.size===1?'espn:'+([...ids][0]):'time:'+String(t.id)+':'+norm(p.nome);
  };
  const historicos=new Map(),vistos=new Map();
  const registro=(p,t,j,adversario,emCasa,venceu)=>{
    // DNP nao deve ser contabilizado na media.
    if(!Number.isFinite(Number(p.min))||num(p.min)<=0)return;
    const key=identidade(p,t), game=String(j.id);
    if(!vistos.has(key))vistos.set(key,new Set());
    if(vistos.get(key).has(game))return;vistos.get(key).add(game);
    const trest=String(p.tres||'').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/);
    if(!historicos.has(key))historicos.set(key,[]);
    historicos.get(key).push({
      jogo_id:game,data:j.inicio_utc,adversario,em_casa:emCasa,venceu:!!venceu,
      min:num(p.min),pts:num(p.pts),reb:num(p.reb),ast:num(p.ast),
      rb:num(p.rb),toco:num(p.toco),tres_convertidas:trest?Number(trest[1]):null
    });
  };
  const jogos=[];
  for(const item of dias.slice(-18))for(const base of item.rodada.jogos||[]){
    const j=jogoDoDia(item.dia,base);
    if(j.status==='final'&&Array.isArray(j.casa?.jogadores)&&Array.isArray(j.visitante?.jogadores))jogos.push(j);
  }
  // A janela de historico e toda a coleta local, enquanto os jogos no menu sao limitados.
  for(const item of dias)for(const base of item.rodada.jogos||[]){
    const j=jogoDoDia(item.dia,base);
    if(j.status!=='final'||!Array.isArray(j.casa?.jogadores)||!Array.isArray(j.visitante?.jogadores))continue;
    for(const [t,adv,casa] of [[j.casa,j.visitante,true],[j.visitante,j.casa,false]]){
      for(const p of t.jogadores)registro(p,t,j,adv.sigla,casa,!!t.vencedor);
    }
  }
  const historicoJogadores=Object.fromEntries([...historicos].map(([k,arr])=>[k,arr.sort((a,b)=>String(a.data).localeCompare(String(b.data)))]));
  jogos.sort((a,b)=>String(b.inicio_utc).localeCompare(String(a.inicio_utc)));
  const partidas=jogos.slice(0,75).map(j=>({
    id:String(j.id),data:j.inicio_utc,local:j.local||j.arena?.nome||'',
    times:[j.visitante,j.casa].map(t=>({
      id:String(t.id),sigla:t.sigla,nome:t.nome_curto,logo:t.logo,cor:t.cor,pts:num(t.placar),
      stats:t.estatisticas||{},jogadores:(t.jogadores||[]).map(p=>({
        nome:p.nome,titular:!!p.titular,min:num(p.min),pts:num(p.pts),reb:num(p.reb),
        ast:num(p.ast),rb:num(p.rb),toco:num(p.toco),err:num(p.err),
        fg:p.fg||'',tres:p.tres||'',ll:p.ll||'',
        id:elenco.get(norm(p.nome))?.id||null,
        historico_chave:identidade(p,t),
        posicao:elenco.get(norm(p.nome))?.posicao_sigla||'—'
      }))
    }))
  }));
  const json=JSON.stringify({atualizado:new Date().toISOString(),equipes,partidas,historicoJogadores}).replace(/</g,'\\u003c');
  const opcoes=partidas.map(j=>'<option value="'+esc(j.id)+'">'+esc(j.times[0].sigla+' × '+j.times[1].sigla)+' · '+esc(j.data?.slice(0,10))+'</option>').join('');
  const corpo=[
    '<section class="stats-page"><header class="stats-heading">',
    '<div><p class="stats-kicker">CESTINHA LAB · DADOS ESPN</p>',
    '<h1>CESTINHA <span>STATS</span></h1>',
    '<p>Explore números reais da NBA: confrontos, jogadores, tendências e quintetos.</p></div>',
    '<div class="stats-status"><span class="stats-live-dot"></span> Atualizado com o build</div>',
    '</header><div class="stats-toolbar"><label for="stats-partida">Escolha a partida</label>',
    '<select id="stats-partida">',opcoes,'</select>',
    '<a id="stats-ver-jogo" href="./index.html">Abrir jogo ↗</a></div>',
    '<div class="stats-matchup" id="stats-matchup" aria-live="polite"></div>',
    '<nav class="stats-tabs" aria-label="Seções de estatísticas">',
    '<button type="button" data-tab="confronto" aria-selected="true">Confronto</button>',
    '<button type="button" data-tab="jogadores" aria-selected="false">Jogadores</button>',
    '<button type="button" data-tab="tendencias" aria-selected="false">Tendências</button>',
    '<button type="button" data-tab="quintetos" aria-selected="false">Quintetos</button></nav>',
    '<div id="stats-content" aria-live="polite"></div>',
    '<p class="stats-disclaimer">Gráficos baseados em resultados e box scores da ESPN. Médias e status de lesões são identificados e podem mudar. Não há probabilidades de apostas ou escalações futuras inventadas.</p>',
    '</section><script id="stats-dados" type="application/json">',json,'</script>'
  ].join('');
  fs.writeFileSync(path.join(P.site,'stats.html'),pagina({
    titulo:'Cestinha Stats | Estatísticas da NBA',
    descricao:'Estatísticas, gráficos, confrontos, jogadores e quintetos da NBA.',
    raiz:'.',ativo:'stats',corpo
  }));
  console.log('[stats] '+partidas.length+' partidas e '+equipes.length+' times.');
}
