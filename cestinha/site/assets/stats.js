// Cestinha Stats V1. Sem bibliotecas externas; SVGs acessiveis e sem projecoes inventadas.
(() => {
  const root=document.querySelector('.stats-page'), dataEl=document.getElementById('stats-dados');
  if(!root||!dataEl)return;
  let d;try{d=JSON.parse(dataEl.textContent)}catch{return}
  const $=s=>root.querySelector(s);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=x=>Number.isFinite(Number(x))?Number(x):0;
  const dec=(v,k=1)=>Number(v).toLocaleString('pt-BR',{maximumFractionDigits:k,minimumFractionDigits:k});
  const nfmt=x=>Number.isFinite(Number(x))?dec(x):'—';
  const team=id=>d.equipes.find(t=>t.id===id)||null;
  const current=()=>d.partidas.find(g=>g.id===$('#stats-partida').value)||d.partidas[0];
  const requested=new URLSearchParams(location.search).get('jogo');
  if(requested && d.partidas.some(g=>g.id===requested)) $('#stats-partida').value=requested;
  let tab='confronto',metric='pts',index=0,historyPeriod=15,historyShowL5=true,selectedHistoryGameId=null;

  // Explorador de jogos: selecao centralizada no <select> oculto para manter
  // os graficos, os links, a URL ?jogo e as abas sincronizados.
  let explorerLimit=6;
  const sortedGames=[...d.partidas].sort((a,b)=>String(b.data).localeCompare(String(a.data)));
  const shortDate=iso=>{
    const stamp=String(iso||'').slice(0,10);
    const [y,m,day]=stamp.split('-');
    return y&&m&&day ? day+'/'+m+'/'+y : stamp;
  };
  const matchesPeriod=(g,period)=>{
    if(period==='todos'||period==='recentes')return true;
    const days=Number(period),newest=Date.parse(sortedGames[0]?.data||'');
    const value=Date.parse(g.data||'');
    return Number.isFinite(newest)&&Number.isFinite(value)&&(newest-value)<=(days-1)*86400000;
  };
  const normalizeSearch=t=>String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  function prepareExplorer(){
    const select=$('#stats-time-filtro');
    if(!select)return;
    const ids=new Set(sortedGames.flatMap(g=>g.times.map(t=>String(t.id))));
    const available=d.equipes.filter(t=>ids.has(String(t.id))).sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
    select.insertAdjacentHTML('beforeend',available.map(t=>'<option value="'+esc(t.id)+'">'+esc(t.nome)+'</option>').join(''));
  }
  function renderExplorer(){
    const grid=$('#stats-explorer-grid');if(!grid)return;
    const q=normalizeSearch($('#stats-busca')?.value);
    const teamId=$('#stats-time-filtro')?.value||'';
    const period=$('#stats-periodo-filtro')?.value||'recentes';
    let filtered=sortedGames.filter(g=>{
      if(teamId&&!g.times.some(t=>String(t.id)===teamId))return false;
      if(!matchesPeriod(g,period))return false;
      if(!q)return true;
      const haystack=normalizeSearch([g.id,g.local,...g.times.flatMap(t=>[t.sigla,t.nome,team(t.id)?.nome||''])].join(' '));
      return haystack.includes(q);
    });
    // O periodo "Mais recentes" conserva somente as seis ultimas partidas no
    // primeiro bloco, enquanto filtros e pesquisa permitem explorar tudo.
    if(period==='recentes'&&!q&&!teamId){
      filtered=filtered.slice(0,18);
      // Uma URL compartilhada com ?jogo= deve manter a partida escolhida nos cards.
      const deepLinked=sortedGames.find(g=>String(g.id)===String($('#stats-partida')?.value));
      if(deepLinked){
        filtered=filtered.filter(g=>String(g.id)!==String(deepLinked.id));
        filtered.unshift(deepLinked);
      }
    }
    const visible=filtered.slice(0,explorerLimit);
    const selected=$('#stats-partida')?.value;
    grid.innerHTML=visible.length?visible.map(g=>{
      const a=g.times[0],b=g.times[1],picked=String(g.id)===String(selected);
      return '<button type="button" class="stats-explorer-card" data-game-id="'+esc(g.id)+'" aria-pressed="'+picked+'"'+
        ' aria-label="'+esc(a.nome)+' '+a.pts+' a '+b.pts+' '+esc(b.nome)+', '+shortDate(g.data)+'">'+
        '<span class="stats-explorer-card-top"><span>'+shortDate(g.data)+'</span><span class="stats-explorer-status">FINAL</span></span>'+
        '<span class="stats-explorer-teams"><span class="stats-explorer-team">'+logo(a,42)+'<b>'+esc(a.sigla)+'</b></span>'+
        '<strong class="stats-explorer-score">'+a.pts+' <i>×</i> '+b.pts+'</strong>'+
        '<span class="stats-explorer-team">'+logo(b,42)+'<b>'+esc(b.sigla)+'</b></span></span>'+
        '<span class="stats-explorer-card-foot">'+esc(a.nome)+' × '+esc(b.nome)+'</span>'+
        '</button>';
    }).join(''):'<p class="stats-explorer-empty">Nenhuma partida encontrada. Tente outro time, período ou termo.</p>';
    const more=$('#stats-ver-mais');
    if(more){more.hidden=filtered.length<=explorerLimit;more.textContent='Mostrar mais partidas ('+(filtered.length-explorerLimit)+') ↓';}
    const summary=$('#stats-explorer-summary');
    if(summary)summary.textContent=filtered.length?filtered.length+' partidas encontradas · '+visible.length+' visíveis':'Nenhuma partida encontrada';
  }
  function selectGame(id){
    const select=$('#stats-partida');
    if(!select||!d.partidas.some(g=>String(g.id)===String(id)))return;
    select.value=String(id);
    index=0;selectedHistoryGameId=null;
    paint();
    const url=new URL(location.href);
    url.searchParams.set('jogo',String(id));
    history.replaceState(null,'',url.pathname+url.search+url.hash);
    renderExplorer();
  }

  const metricMap={pts:'Pontos',reb:'Rebotes',ast:'Assistências',rb:'Roubos',toco:'Tocos',min:'Minutos'};
  const logo=(t,size=35)=>t?.logo?'<img src="'+esc(t.logo)+'" alt="" width="'+size+'" height="'+size+'" loading="lazy">':'';
  const head=(name,note)=>'<div><h2>'+esc(name)+'</h2>'+(note?'<p class="stats-note">'+esc(note)+'</p>':'')+'</div>';
  const panel=(name,content,note='')=>'<section class="stats-panel"><h2>'+esc(name)+'</h2>'+content+(note?'<p class="stats-note">'+esc(note)+'</p>':'')+'</section>';
  const val=x=>Number.isFinite(Number(x))?dec(Number(x),1):'—';
  const state=s=>({Out:'Fora',Questionable:'Dúvida',Doubtful:'Provável desfalque',Probable:'Provável','Day-To-Day':'Dia a dia'}[s]||s);
  function barChart(arr,field,label,color){
    const points=arr.map(a=>num(a[field]));
    const max=Math.max(1,...points)*1.15,w=800,h=270,left=44,top=18,base=225,gap=(w-left-12)/Math.max(1,points.length),barW=Math.min(40,gap*.6);
    let svg='<svg class="stats-chart" role="img" aria-label="'+esc(label)+'" viewBox="0 0 '+w+' '+h+'">';
    for(let k=0;k<=4;k++){let y=base-(base-top)*k/4;svg+='<line class="gridline" x1="'+left+'" x2="'+(w-10)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(left-10)+'" y="'+(y+4)+'" text-anchor="end">'+Math.round(max*k/4)+'</text>';}
    points.forEach((v,i)=>{const x=left+i*gap+gap/2-barW/2,y=base-(v/max)*(base-top);svg+='<rect class="bar" x="'+x+'" y="'+y+'" width="'+barW+'" height="'+Math.max(0,base-y)+'" rx="4"><title>'+esc(label)+' · '+esc(arr[i].adversario||i+1)+': '+v+'</title></rect>';if(points.length<=15)svg+='<text x="'+(x+barW/2)+'" y="'+(base+17)+'" text-anchor="middle">'+esc(arr[i].adversario||i+1)+'</text>';});
    return svg+'</svg>';
  }
  function lineChart(arr,field,label){
    const points=arr.map(x=>num(x[field])),max=Math.max(1,...points)*1.12,w=800,h=270,left=40,top=18,base=225,gap=(w-left-20)/Math.max(1,points.length-1);
    let svg='<svg class="stats-chart" role="img" aria-label="'+esc(label)+'" viewBox="0 0 '+w+' '+h+'">';
    for(let k=0;k<=4;k++){let y=base-(base-top)*k/4;svg+='<line class="gridline" x1="'+left+'" x2="'+(w-10)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(left-8)+'" y="'+(y+4)+'" text-anchor="end">'+Math.round(max*k/4)+'</text>';}
    const coords=points.map((v,i)=>[left+i*gap,base-(v/max)*(base-top)]);
    if(coords.length)svg+='<polyline class="line" points="'+coords.map(x=>x.join(',')).join(' ')+'"/>';
    let rolling=[];for(let i=0;i<points.length;i++){const chunk=points.slice(Math.max(0,i-4),i+1);rolling.push(chunk.reduce((a,b)=>a+b,0)/chunk.length)}
    svg+='<polyline class="line2" points="'+rolling.map((v,i)=>[left+i*gap,base-v/max*(base-top)].join(',')).join(' ')+'"/>';
    points.forEach((v,i)=>{const [x,y]=coords[i];svg+='<circle cx="'+x+'" cy="'+y+'" r="4"><title>'+esc(arr[i].adversario||i+1)+': '+v+'</title></circle>';});
    return svg+'</svg><p class="stats-note">Laranja: valor do jogo · Azul: média móvel de até 5 jogos.</p>';
  }
  function matchup(){
    const g=current();if(!g)return;
    const a=g.times[0],b=g.times[1],ta=team(a.id),tb=team(b.id);
    const box=$('#stats-matchup');box.style.setProperty('--sc1',ta?.cor||'#64314a');box.style.setProperty('--sc2',tb?.cor||'#344d6e');
    box.innerHTML='<div class="stats-team">'+logo(a,65)+'<div><strong>'+esc(a.nome)+'</strong><small>'+esc(ta?.campanha||'')+'</small></div></div><div class="stats-score"><b>'+a.pts+' × '+b.pts+'</b><span>FINAL · '+esc(g.data?.slice(0,10)||'')+'</span></div><div class="stats-team">'+logo(b,65)+'<div><strong>'+esc(b.nome)+'</strong><small>'+esc(tb?.campanha||'')+'</small></div></div>';
    $('#stats-ver-jogo').href='./jogo/'+encodeURIComponent(g.id)+'.html';
  }
  function tableMatch(a,b){
    const ks=[['pts','Pontos/jogo'],['reb','Rebotes'],['ast','Assistências'],['fg_pct','FG %'],['tres_pct','3PT %'],['rb','Roubos'],['toco','Tocos'],['err','Erros']];
    return '<table class="stats-table"><thead><tr><th>Métrica</th><th>'+esc(a.sigla)+'</th><th>'+esc(b.sigla)+'</th></tr></thead><tbody>'+ks.map(([key,lab])=>'<tr><td>'+lab+'</td><td>'+val(a.stats[key])+'</td><td>'+val(b.stats[key])+'</td></tr>').join('')+'</tbody></table>';
  }
  function injuries(a,b){
    const rows=[...a.lesoes.map(x=>({...x,equipe:a.sigla})),...b.lesoes.map(x=>({...x,equipe:b.sigla}))];
    if(!rows.length)return '<p class="stats-note">Nenhum desfalque sinalizado nos dados atuais dos elencos. Isso não significa ausência confirmada de lesões.</p>';
    return '<table class="stats-table"><thead><tr><th>Jogador</th><th>Time</th><th>Status</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.nome)+'</td><td>'+esc(x.equipe)+'</td><td>'+esc(state(x.status))+'</td></tr>').join('')+'</tbody></table>';
  }
  function showConfronto(){
    const g=current(),a=team(g.times[0].id),b=team(g.times[1].id);
    if(!a||!b)return '<p>Dados indisponíveis.</p>';
    const compare=[['pts','Pontos por jogo'],['reb','Rebotes por jogo'],['ast','Assistências por jogo'],['rb','Roubos por jogo'],['toco','Tocos por jogo']];
    const comparison='<div class="stats-match-legend"><span><i class="stats-team-dot" style="background:#f28d52"></i>'+esc(a.sigla)+'</span><span><i class="stats-team-dot" style="background:#8da9ee"></i>'+esc(b.sigla)+'</span></div>'+
      compare.map(([key,label])=>{
        const v1=Number(a.stats[key]),v2=Number(b.stats[key]);
        const has1=a.stats[key]!=null&&Number.isFinite(v1),has2=b.stats[key]!=null&&Number.isFinite(v2);
        const max=Math.max(1,has1?v1:0,has2?v2:0);
        const percent=v=>Math.max(0,Math.min(100,v/max*100));
        return '<div class="stats-match-row"><div class="stats-match-row-head"><strong>'+esc(label)+'</strong><small>Média por jogo</small></div>'+
          '<div class="stats-match-series"><span class="stats-match-team">'+esc(a.sigla)+'</span>'+
          '<div class="stats-match-track"><i class="stats-match-fill first" style="width:'+(has1?percent(v1):0)+'%"></i></div>'+
          '<b>'+ (has1?dec(v1):'—')+'</b></div>'+
          '<div class="stats-match-series"><span class="stats-match-team">'+esc(b.sigla)+'</span>'+
          '<div class="stats-match-track"><i class="stats-match-fill second" style="width:'+(has2?percent(v2):0)+'%"></i></div>'+
          '<b>'+(has2?dec(v2):'—')+'</b></div></div>';
      }).join('');
    return '<div class="stats-grid">'+panel('Comparativo do confronto',comparison,'As duas barras de cada estatística usam a mesma escala. São médias por jogo, não números da partida.')+
      panel('Números lado a lado',tableMatch(a,b))+'</div><div class="stats-grid half">'+
      panel('Relatório de desfalques',injuries(a,b),'Status da última coleta; sem estimativas inventadas de impacto.')+
      panel('Forma recente',tableMatchRecent(a,b))+'</div>';
  }
  function tableMatchRecent(a,b){return '<table class="stats-table"><thead><tr><th>Indicador</th><th>'+esc(a.sigla)+'</th><th>'+esc(b.sigla)+'</th></tr></thead><tbody>'+[['Últimos jogos',t=>t.recentes.length],['Vitórias no recorte',t=>t.recentes.filter(x=>x.resultado==='V').length],['Média de pontos',t=>t.recentes.length?dec(t.recentes.reduce((s,x)=>s+x.pts,0)/t.recentes.length):'—'],['Média sofrida',t=>t.recentes.length?dec(t.recentes.reduce((s,x)=>s+x.sofridos,0)/t.recentes.length):'—']].map(([name,fn])=>'<tr><td>'+name+'</td><td>'+fn(a)+'</td><td>'+fn(b)+'</td></tr>').join('')+'</tbody></table>'}
  function showJogadores(){
    const jogo=current(),all=jogo.times.flatMap(t=>t.jogadores.map(p=>({...p,equipe:t.sigla,equipeId:t.id})));
    if(!all.length)return '<div class="stats-empty">Box score indisponível.</div>';
    if(index>=all.length)index=0;
    const p=all[index];
    const equipe=d.equipes.find(t=>t.id===p.equipeId);
    const roster=(equipe?.jogadores||[]).find(x=>String(x.id)===String(p.id)&&p.id)||
      (equipe?.jogadores||[]).find(x=>x.nome===p.nome);
    const avg=roster?.medias||{};
    const allHistory=d.historicoJogadores?.[p.historico_chave]||[];
    const metricDefs={
      pts:{label:'Pontos',key:'pts',official:()=>official('pts')},
      reb:{label:'Rebotes',key:'reb',official:()=>official('reb')},
      ast:{label:'Assistências',key:'ast',official:()=>official('ast')},
      tres_convertidas:{label:'Bolas de 3',key:'tres_convertidas',official:()=>null},
      min:{label:'Minutos',key:'min',official:()=>official('min')},
      pr:{label:'PTS+REB',key:'pr',official:()=>combo(['pts','reb'])},
      pa:{label:'PTS+AST',key:'pa',official:()=>combo(['pts','ast'])},
      ra:{label:'REB+AST',key:'ra',official:()=>combo(['reb','ast'])},
      pra:{label:'PTS+REB+AST',key:'pra',official:()=>combo(['pts','reb','ast'])},
      rb:{label:'Roubos',key:'rb',official:()=>official('rb')},
      toco:{label:'Tocos',key:'toco',official:()=>official('toco')}
    };
    const official=k=>avg[k]!==null&&avg[k]!==undefined&&avg[k]!==''&&Number.isFinite(Number(avg[k]))?Number(avg[k]):null;
    const combo=keys=>keys.every(k=>official(k)!==null)?keys.reduce((sum,k)=>sum+official(k),0):null;
    if(!metricDefs[metric])metric='pts';
    const def=metricDefs[metric];
    const metricValue=(game,k)=>{
      if(k==='pr')return num(game.pts)+num(game.reb);
      if(k==='pa')return num(game.pts)+num(game.ast);
      if(k==='ra')return num(game.reb)+num(game.ast);
      if(k==='pra')return num(game.pts)+num(game.reb)+num(game.ast);
      const raw=game[k];return raw===null||raw===undefined||raw===''?null:Number(raw);
    };
    const validHistory=allHistory.filter(g=>Number.isFinite(metricValue(g,metric)));
    const windowGames=validHistory.slice(-historyPeriod);
    // Seleção permanece enquanto o jogo estiver visível no intervalo filtrado.
    const chosen=windowGames.find(g=>g.jogo_id===selectedHistoryGameId)||windowGames.at(-1)||null;
    selectedHistoryGameId=chosen?.jogo_id||null;
    const valueList=(arr)=>arr.map(g=>metricValue(g,metric)).filter(v=>v!==null&&Number.isFinite(v));
    const average=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:null;
    const officialAverage=def.official();
    const last5=average(valueList(validHistory.slice(-5)));
    const last10=average(valueList(validHistory.slice(-10)));
    const last15=average(valueList(validHistory.slice(-15)));
    const max=validHistory.length?Math.max(...valueList(validHistory)):null;
    const min=validHistory.length?Math.min(...valueList(validHistory)):null;
    const currentValue=metricValue({...p,tres_convertidas:(String(p.tres||'').match(/^\s*(\d+)\s*-\s*(\d+)\s*$/)||[])[1]},metric);
    const photo=p.id?'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(p.id)+'.png':'';
    const chooser='<div class="stats-filter"><label for="stats-jogador">Atleta</label><select id="stats-jogador" class="stats-player-select">'+all.map((x,i)=>'<option value="'+i+'" '+(i===index?'selected':'')+'>'+esc(x.nome)+' · '+esc(x.equipe)+'</option>').join('')+'</select></div>';
    const stats=[['Temporada',officialAverage,'Média oficial'],['Últimos 5',last5,'Média disponível'],['Últimos 10',last10,'Média disponível'],['Últimos 15',last15,'Média disponível'],['Último jogo',validHistory.length?metricValue(validHistory.at(-1),metric):null,'Último registro'],['Máxima',max,'Histórico coletado']];
    const cards='<div class="stats-season-kpis">'+stats.map(([label,value,info])=>'<div class="stats-season-kpi"><small>'+label+'</small><strong>'+(value===null?'—':dec(value))+'</strong><span>'+info+'</span></div>').join('')+'</div>';
    const hero='<div class="stats-player-hero stats-season-hero">'+(photo?'<img src="'+photo+'" alt="Retrato de '+esc(p.nome)+'" onerror="this.remove()">':'')+'<div><p class="stats-kicker">TEMPORADA · '+esc(p.equipe)+'</p><h2>'+esc(p.nome)+'</h2><p class="stats-note">'+esc(p.posicao)+' · '+esc(roster?.numero||'')+'</p><div class="stats-bigmetric"><div><span class="stats-number">'+(currentValue===null?'—':dec(currentValue))+'</span><div class="stats-caption">'+esc(def.label.toUpperCase())+' NA PARTIDA</div></div><div><span class="stats-number">'+(officialAverage===null?'—':dec(officialAverage))+'</span><div class="stats-caption">MÉDIA OFICIAL</div></div></div></div></div>';
    const metricButtons='<div class="stats-buttons stats-season-metrics">'+Object.entries(metricDefs).map(([key,entry])=>'<button type="button" data-season-metric="'+key+'" aria-pressed="'+(key===metric)+'">'+esc(entry.label)+'</button>').join('')+'</div>';
    const periods='<div class="stats-season-periods" role="group" aria-label="Quantidade de partidas">'+[5,10,15,99999].map(n=>'<button type="button" data-period="'+n+'" aria-pressed="'+(historyPeriod===n)+'">'+(n===99999?'Todos':'L'+n)+'</button>').join('')+'</div>';
    let chart='';
    if(!windowGames.length){
      chart='<div class="stats-empty">Ainda não há jogos suficientes com esta métrica no histórico coletado. Experimente outra métrica.</div>';
    }else{
      const points=valueList(windowGames),base=226,top=30,w=880,left=48,gap=790/Math.max(1,points.length),bw=Math.max(8,Math.min(42,gap*.68));
      const maxScale=Math.max(1,...points,officialAverage||0,last5||0)*1.16;
      const y=v=>base-(v/maxScale)*(base-top);
      chart='<svg class="stats-chart stats-season-chart" role="img" aria-label="Gráfico dos últimos '+windowGames.length+' jogos de '+esc(p.nome)+' em '+esc(def.label)+'" viewBox="0 0 880 275">';
      for(let k=0;k<=4;k++){const v=maxScale*k/4;chart+='<line class="gridline" x1="'+left+'" x2="858" y1="'+y(v)+'" y2="'+y(v)+'"/><text x="39" y="'+(y(v)+4)+'" text-anchor="end">'+Math.round(v)+'</text>';}
      windowGames.forEach((g,i)=>{
        const v=points[i],x=left+i*gap+(gap-bw)/2;
        const selected=String(g.jogo_id)===String(selectedHistoryGameId);
        // SVG clicável também por teclado (Enter/Espaço), sem depender de hover.
        chart+='<rect class="bar stats-season-bar'+(selected?' stats-bar-current':'')+'" data-history-id="'+esc(g.jogo_id)+'" role="button" tabindex="0" aria-label="'+esc(g.data?.slice(0,10))+' contra '+esc(g.adversario)+': '+dec(v)+' '+esc(def.label)+'; ver detalhes" x="'+x+'" y="'+y(v)+'" width="'+bw+'" height="'+Math.max(2,base-y(v))+'" rx="4"><title>'+esc(g.data?.slice(0,10))+' · '+esc(g.em_casa?'vs ':'@ ')+esc(g.adversario)+' · '+v+' '+esc(def.label)+'</title></rect>';
        if(windowGames.length<=15)chart+='<text x="'+(x+bw/2)+'" y="244" text-anchor="middle">'+esc(g.adversario)+'</text>';
      });
      if(officialAverage!==null)chart+='<line class="stats-average-line" x1="'+left+'" x2="858" y1="'+y(officialAverage)+'" y2="'+y(officialAverage)+'"><title>Média oficial da temporada: '+dec(officialAverage)+'</title></line>';
      if(historyShowL5&&last5!==null)chart+='<line class="stats-l5-line" x1="'+left+'" x2="858" y1="'+y(last5)+'" y2="'+y(last5)+'"><title>Média dos últimos 5 jogos: '+dec(last5)+'</title></line>';
      chart+='</svg>';
    }
    const selectedValue=chosen?metricValue(chosen,metric):null;
    const selectedDelta=(selectedValue!==null&&officialAverage!==null)?selectedValue-officialAverage:null;
    const selectedDetail=chosen?'<div class="stats-season-detail" aria-live="polite"><div><span class="stats-kicker">PARTIDA SELECIONADA</span><h3>'+dec(selectedValue)+' <small>'+esc(def.label)+'</small></h3><p>'+esc(chosen.data?.slice(0,10))+' · '+(chosen.em_casa?'Casa':'Fora')+' · '+esc(chosen.adversario)+' · '+(chosen.venceu?'Vitória':'Derrota')+'</p></div><div class="stats-detail-delta"><strong class="'+(selectedDelta!==null&&selectedDelta>=0?'stats-positive':'stats-negative')+'">'+(selectedDelta===null?'—':(selectedDelta>=0?'+':'')+dec(selectedDelta))+'</strong><span>'+ (officialAverage===null?'Sem média oficial':'vs. média da temporada') +'</span></div><a href="./jogo/'+encodeURIComponent(chosen.jogo_id)+'.html">Abrir jogo ↗</a></div>':'<div class="stats-empty">Nenhuma partida disponível neste período.</div>';
    const meanLine='<div class="stats-season-legend"><span><i class="stats-legend-bar"></i> Jogos</span><span><i class="stats-legend-season"></i> Média oficial'+(officialAverage!==null?' '+dec(officialAverage):' indisponível')+'</span><label><input type="checkbox" id="stats-l5-line" '+(historyShowL5?'checked':'')+'> Média L5'+(last5!==null?' '+dec(last5):'')+'</label></div>';
    const sampleCount='<p class="stats-note">Amostra: '+validHistory.length+' partida(s) coletada(s). '+(validHistory.length<15?'Ainda não há 15 registros válidos para esta métrica. ':'')+'A média oficial pode considerar jogos que não estão no histórico local.</p>';
    const splits=[
      ['Todos',validHistory],['Em casa',validHistory.filter(g=>g.em_casa)],['Fora',validHistory.filter(g=>!g.em_casa)],
      ['Vitórias',validHistory.filter(g=>g.venceu)],['Derrotas',validHistory.filter(g=>!g.venceu)]
    ];
    const splitTable='<table class="stats-table"><thead><tr><th>Recorte</th><th>Jogos</th><th>Média</th></tr></thead><tbody>'+splits.map(([label,arr])=>'<tr><td>'+label+'</td><td>'+arr.length+'</td><td>'+(arr.length?dec(average(valueList(arr))):'—')+'</td></tr>').join('')+'</tbody></table>';
    const played=validHistory.slice(-15).reverse();
    const gameTable='<div class="stats-history-scroll"><table class="stats-table"><thead><tr><th>Data</th><th>Adversário</th><th>Local</th><th>Resultado</th><th>'+esc(def.label)+'</th></tr></thead><tbody>'+played.map(g=>'<tr><td>'+esc(g.data?.slice(0,10))+'</td><td>'+esc(g.adversario)+'</td><td>'+(g.em_casa?'Casa':'Fora')+'</td><td class="'+(g.venceu?'stats-positive':'stats-negative')+'">'+(g.venceu?'Vitória':'Derrota')+'</td><td>'+dec(metricValue(g,metric))+'</td></tr>').join('')+'</tbody></table></div>';
    const difference=currentValue!==null&&officialAverage!==null?currentValue-officialAverage:null;
    const diffText=difference===null?'Média oficial indisponível para esta métrica.':(difference>=0?'+':'')+dec(difference)+' em relação à média oficial ('+(officialAverage===0?'variação percentual indisponível':(difference>=0?'+':'')+dec(difference/officialAverage*100)+'%')+').';
    const insight='<p class="stats-season-insight">'+esc(diffText)+'</p>';
    return chooser+panel('Desempenho na temporada',hero+cards+insight)+
      panel('Histórico por partida',metricButtons+'<div class="stats-season-chart-head">'+periods+meanLine+'</div>'+chart+selectedDetail+sampleCount,'Cada barra é uma partida real. Passe o mouse ou toque na barra para conferir adversário e valor.')+
      '<div class="stats-grid half">'+panel('Casa, fora e resultados',splitTable,'Médias calculadas apenas com partidas presentes na amostra local.')+
      panel('Histórico recente',gameTable,'Últimas 15 partidas disponíveis com esta estatística.')+'</div>';
  }
  function panelCompact(arr){return '<div class="stats-bigmetric">'+arr.map(([k,v])=>'<div><span class="stats-number">'+v+'</span><p class="stats-caption">'+esc(k)+'</p></div>').join('')+'</div>'}
  function showTendencias(){
    const g=current(),a=team(g.times[0].id),b=team(g.times[1].id);if(!a||!b)return '';
    return '<div class="stats-grid half">'+[a,b].map(t=>panel('Ataque · '+t.nome,lineChart(t.recentes,'pts','Pontos recentes do '+t.nome),'Últimos '+t.recentes.length+' jogos disponíveis no calendário da equipe.')).join('')+'</div><div class="stats-grid half">'+[a,b].map(t=>panel('Defesa · '+t.nome,lineChart(t.recentes,'sofridos','Pontos sofridos por '+t.nome),'Quanto menor a pontuação sofrida, melhor o resultado defensivo bruto.')).join('')+'</div>';
  }
  function showQuintetos(){
    const g=current(),a=g.times[0],b=g.times[1];
    const posNames={PG:'Armador',SG:'Ala-armador',SF:'Ala',PF:'Ala-pivô',C:'Pivô'};
    const asCode=value=>{
      const raw=String(value||'').toUpperCase().trim().replace(/[^A-Z/]/g,'');
      if(['PG','SG','SF','PF','C'].includes(raw))return raw;
      if(raw==='G'||raw==='F'||raw==='G/F'||raw==='F/G'||raw==='F/C'||raw==='C/F')return raw;
      return '';
    };
    // A ESPN frequentemente informa apenas G/F/C. A distribuicao em cinco
    // papeis e visual e estimada: nao afirma ser a funcao oficial na partida.
    const formation=t=>{
      const arr=t.jogadores.filter(p=>p.titular).slice(0,5);
      const slots=['C','PF','SF','SG','PG'],assigned=new Map(),taken=new Set();
      const put=(slot,p)=>{assigned.set(slot,p);taken.add(p)};
      const role=p=>asCode(p.posicao);
      // Primeiro os titulares com funcoes especificas, depois as categorias amplas.
      for(const slot of slots){
        const p=arr.find(x=>!taken.has(x)&&role(x)===slot);
        if(p)put(slot,p);
      }
      const possibilities={
        C:['C','PF'], 'F/C':['C','PF','SF'],'C/F':['C','PF','SF'],
        F:['PF','SF','C'],'G/F':['SF','SG','PG','PF'],'F/G':['SF','SG','PG','PF'],
        G:['SG','PG','SF'], PG:['PG','SG'],SG:['SG','PG'],SF:['SF','PF'],PF:['PF','C']
      };
      for(const p of arr){
        if(taken.has(p))continue;
        const target=(possibilities[role(p)]||slots).find(slot=>!assigned.has(slot));
        if(target)put(target,p);
      }
      return {slots,assigned,arr};
    };
    const draw=t=>{
      const {slots,assigned,arr}=formation(t);
      if(!arr.length)return '<div class="stats-empty">Não há titulares identificados no box score.</div>';
      return '<div class="stats-position-formation" style="--teamcolor:'+esc(t.cor||'#f3853e')+'">'+
        slots.map(slot=>{
          const p=assigned.get(slot);if(!p)return '<div class="stats-position-slot stats-position-'+slot.toLowerCase()+'"><span class="stats-role">'+slot+' · '+posNames[slot]+'</span><p>Não identificado</p></div>';
          const original=asCode(p.posicao)||'—';
          const accurate=original===slot;
          const note=accurate?'Posição informada':'Organização ilustrativa · ESPN: '+original;
          return '<article class="stats-position-slot stats-position-'+slot.toLowerCase()+'" aria-label="'+esc(posNames[slot])+': '+esc(p.nome)+'">'+
            '<div class="stats-role"><b>'+slot+'</b><span>'+posNames[slot]+'</span></div>'+
            (p.id?'<img src="https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(p.id)+'.png" alt="" loading="lazy" onerror="this.remove()">':'')+
            '<strong>'+esc(p.nome)+'</strong><span class="stats-position-numbers">'+p.pts+' PTS · '+p.reb+' REB · '+p.ast+' AST</span>'+
            '<small title="'+esc(note)+'">'+esc(accurate?'Posição registrada':'Função visual estimada')+'</small></article>';
        }).join('')+'</div>';
    };
    return '<div class="stats-position-head"><div><h2>Quintetos na quadra</h2><p>Da cesta ao perímetro: C → PF/SF → PG/SG</p></div><div class="stats-position-key"><span>PG Armador</span><span>SG Ala-armador</span><span>SF Ala</span><span>PF Ala-pivô</span><span>C Pivô</span></div></div>'+
      '<div class="stats-court-scroll" role="region" aria-label="Quadra com escalações dos dois times" tabindex="0"><div class="stats-court stats-court-positions">'+
        '<svg class="stats-court-lines" viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true"><rect x="12" y="12" width="1176" height="536" rx="4" fill="none" stroke="#718196" stroke-width="3"/><line x1="600" x2="600" y1="12" y2="548" stroke="#718196" stroke-width="3"/><circle cx="600" cy="280" r="75" stroke="#718196" stroke-width="3" fill="none"/><rect x="12" y="140" width="175" height="280" stroke="#718196" stroke-width="3" fill="none"/><rect x="1013" y="140" width="175" height="280" stroke="#718196" stroke-width="3" fill="none"/><circle cx="187" cy="280" r="55" stroke="#718196" stroke-width="3" fill="none"/><circle cx="1013" cy="280" r="55" stroke="#718196" stroke-width="3" fill="none"/><path d="M12 74 A260 260 0 0 1 12 486 M1188 74 A260 260 0 0 0 1188 486" stroke="#718196" stroke-width="3" fill="none"/><line x1="42" x2="42" y1="252" y2="308" stroke="#ffb47e" stroke-width="7"/><line x1="1158" x2="1158" y1="252" y2="308" stroke="#ffb47e" stroke-width="7"/><circle cx="68" cy="280" r="15" stroke="#ffb47e" stroke-width="3" fill="none"/><circle cx="1132" cy="280" r="15" stroke="#ffb47e" stroke-width="3" fill="none"/></svg>'+
        '<div class="stats-court-sides"><section class="stats-court-team stats-team-left"><h3>'+logo(a,25)+' '+esc(a.nome)+' <small>Ataca a cesta à esquerda</small></h3>'+draw(a)+'</section>'+
        '<section class="stats-court-team stats-team-right"><h3>'+logo(b,25)+' '+esc(b.nome)+' <small>Ataca a cesta à direita</small></h3>'+draw(b)+'</section></div></div></div>'+
        '<p class="stats-note">As posições representam uma organização ofensiva ilustrativa: o pivô (C) aparece junto ao garrafão, alas em posições intermediárias e armadores no perímetro. Os titulares vêm do box score, mas a ESPN pode informar apenas G/F/C; nessas situações, PG/SG/SF/PF são aproximações. Não é rastreamento real de quadra.</p>';
  }
  function paint(){
    matchup();
    root.querySelectorAll('[data-tab]').forEach(btn=>btn.setAttribute('aria-selected',String(btn.dataset.tab===tab)));
    const host=$('#stats-content');
    host.innerHTML=tab==='confronto'?showConfronto():tab==='jogadores'?showJogadores():tab==='tendencias'?showTendencias():showQuintetos();
  }
  prepareExplorer();
  renderExplorer();
  $('#stats-partida')?.addEventListener('change',()=>{
    index=0;selectedHistoryGameId=null;paint();renderExplorer();
  });
  $('#stats-busca')?.addEventListener('input',()=>{explorerLimit=6;renderExplorer()});
  $('#stats-time-filtro')?.addEventListener('change',()=>{explorerLimit=6;renderExplorer()});
  $('#stats-periodo-filtro')?.addEventListener('change',()=>{explorerLimit=6;renderExplorer()});
  $('#stats-ver-mais')?.addEventListener('click',()=>{explorerLimit+=6;renderExplorer()});
  $('#stats-explorer-grid')?.addEventListener('click',e=>{
    const card=e.target.closest('[data-game-id]');
    if(card)selectGame(card.dataset.gameId);
  });
  root.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{tab=btn.dataset.tab;paint()}));
  root.addEventListener('change',e=>{if(e.target.id==='stats-jogador'){index=Number(e.target.value);selectedHistoryGameId=null;paint()}});
  root.addEventListener('click',e=>{
    const bar=e.target.closest('[data-history-id]');if(bar){selectedHistoryGameId=bar.dataset.historyId;paint();return;}
    const met=e.target.closest('[data-season-metric]');if(met){metric=met.dataset.seasonMetric;paint();return;}
    const period=e.target.closest('[data-period]');if(period){historyPeriod=Number(period.dataset.period);paint();return;}
  });
  root.addEventListener('keydown',e=>{const bar=e.target.closest('[data-history-id]');if(bar&&(e.key==='Enter'||e.key===' ')){e.preventDefault();selectedHistoryGameId=bar.dataset.historyId;paint();const same=[...root.querySelectorAll('[data-history-id]')].find(x=>x.dataset.historyId===selectedHistoryGameId);same?.focus();}});
  root.addEventListener('change',e=>{if(e.target.id==='stats-l5-line'){historyShowL5=e.target.checked;paint()}});
  if(!d.partidas.length){$('#stats-content').innerHTML='<div class="stats-empty">Aguardando partidas com box score completo.</div>';return}
  paint();
})();