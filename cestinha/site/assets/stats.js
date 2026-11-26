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
  let tab='confronto',metric='pts',index=0;
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
    const g=current(),a=team(g.times[0].id),b=team(g.times[1].id);if(!a||!b)return '<p>Dados indisponíveis.</p>';
    const comparison=[['pts','Pontos'],['reb','Rebotes'],['ast','Assistências'],['rb','Roubos'],['toco','Tocos']].map(([k,label])=>{let va=num(a.stats[k]),vb=num(b.stats[k]),mx=Math.max(va,vb,1);return '<div class="stats-barline"><b>'+esc(a.sigla)+' '+val(va)+'</b><div class="stats-bar"><i style="width:'+(va/mx*100)+'%"></i></div><span>'+esc(label)+'</span><div class="stats-bar right"><i style="width:'+(vb/mx*100)+'%"></i></div><b>'+val(vb)+' '+esc(b.sigla)+'</b></div>'}).join('');
    return '<div class="stats-grid">'+panel('Comparativo do confronto',comparison,'Médias da temporada registradas no último levantamento dos times.')+panel('Médias lado a lado',tableMatch(a,b))+'</div><div class="stats-grid half">'+panel('Relatório de desfalques',injuries(a,b),'Status da última coleta; sem estimativas inventadas de impacto.')+panel('Forma recente',tableMatchRecent(a,b))+'</div>';
  }
  function tableMatchRecent(a,b){return '<table class="stats-table"><thead><tr><th>Indicador</th><th>'+esc(a.sigla)+'</th><th>'+esc(b.sigla)+'</th></tr></thead><tbody>'+[['Últimos jogos',t=>t.recentes.length],['Vitórias no recorte',t=>t.recentes.filter(x=>x.resultado==='V').length],['Média de pontos',t=>t.recentes.length?dec(t.recentes.reduce((s,x)=>s+x.pts,0)/t.recentes.length):'—'],['Média sofrida',t=>t.recentes.length?dec(t.recentes.reduce((s,x)=>s+x.sofridos,0)/t.recentes.length):'—']].map(([name,fn])=>'<tr><td>'+name+'</td><td>'+fn(a)+'</td><td>'+fn(b)+'</td></tr>').join('')+'</tbody></table>'}
  function showJogadores(){
    const g=current(),all=g.times.flatMap(t=>t.jogadores.map(p=>({...p,equipe:t.sigla})));
    if(!all.length)return '<div class="stats-empty">Box score indisponível.</div>';
    if(index>=all.length)index=0;
    const p=all[index],roster=d.equipes.flatMap(t=>t.jogadores).find(x=>x.nome===p.nome);
    const photo=p.id?'https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(p.id)+'.png':'';
    const chooser='<div class="stats-filter"><label for="stats-jogador">Atleta</label><select id="stats-jogador" class="stats-player-select">'+all.map((x,i)=>'<option value="'+i+'" '+(i===index?'selected':'')+'>'+esc(x.nome)+' · '+esc(x.equipe)+'</option>').join('')+'</select></div>';
    const sums=[['Pontos',p.pts],['Rebotes',p.reb],['Assistências',p.ast],['Roubos',p.rb],['Tocos',p.toco],['Minutos',p.min]];
    const hero='<div class="stats-player-hero">'+(photo?'<img src="'+photo+'" alt="Retrato de '+esc(p.nome)+'" onerror="this.remove()">':'')+'<div><h2>'+esc(p.nome)+'</h2><p class="stats-note">'+esc(p.equipe)+' · '+esc(p.posicao)+'</p><div class="stats-bigmetric">'+sums.slice(0,3).map(([l,v])=>'<div><span class="stats-number">'+v+'</span><div class="stats-caption">'+l.toUpperCase()+'</div></div>').join('')+'</div></div></div>';
    const minmax=Math.max(...all.map(x=>num(x[metric])),1);
    const row=all.filter(x=>x.min>0).sort((a,b)=>num(b[metric])-num(a[metric])).slice(0,12);
    const chart=barChart(row.map(x=>({adversario:x.nome.split(' ').at(-1),valor:x[metric]})),'valor',metricMap[metric]);
    const buttons='<div class="stats-buttons">'+Object.entries(metricMap).map(([k,v])=>'<button type="button" data-metric="'+k+'" aria-pressed="'+(metric===k)+'">'+v+'</button>').join('')+'</div>';
    const avg=roster?.medias||{};
    const recent='<table class="stats-table"><thead><tr><th>Estatística</th><th>Partida</th><th>Média da temporada</th></tr></thead><tbody>'+[['pts','Pontos'],['reb','Rebotes'],['ast','Assistências'],['min','Minutos'],['rb','Roubos'],['toco','Tocos']].map(([k,l])=>'<tr><td>'+l+'</td><td>'+p[k]+'</td><td>'+val(avg[k])+'</td></tr>').join('')+'</tbody></table>';
    return chooser+'<div class="stats-grid">'+panel('Jogador em destaque',hero+recent,'Os números da partida são diferentes das médias sazonais.')+panel('Resumo da partida',panelCompact(sums))+'</div>'+panel('Ranking de atletas neste confronto',buttons+chart,'Clique em uma métrica para atualizar o gráfico. Não representa histórico dos últimos 15 jogos.');
  }
  function panelCompact(arr){return '<div class="stats-bigmetric">'+arr.map(([k,v])=>'<div><span class="stats-number">'+v+'</span><p class="stats-caption">'+esc(k)+'</p></div>').join('')+'</div>'}
  function showTendencias(){
    const g=current(),a=team(g.times[0].id),b=team(g.times[1].id);if(!a||!b)return '';
    return '<div class="stats-grid half">'+[a,b].map(t=>panel('Ataque · '+t.nome,lineChart(t.recentes,'pts','Pontos recentes do '+t.nome),'Últimos '+t.recentes.length+' jogos disponíveis no calendário da equipe.')).join('')+'</div><div class="stats-grid half">'+[a,b].map(t=>panel('Defesa · '+t.nome,lineChart(t.recentes,'sofridos','Pontos sofridos por '+t.nome),'Quanto menor a pontuação sofrida, melhor o resultado defensivo bruto.')).join('')+'</div>';
  }
  function showQuintetos(){
    const g=current(),a=g.times[0],b=g.times[1];const starters=t=>t.jogadores.filter(p=>p.titular).slice(0,5);
    const draw=t=>{const arr=starters(t);if(!arr.length)return '<p>Não há titulares identificados no box score.</p>';return '<div class="stats-lineup">'+arr.map(p=>'<div class="stats-athlete" style="--teamcolor:'+esc(t.cor||'#f3853e')+'">'+(p.id?'<img src="https://a.espncdn.com/i/headshots/nba/players/full/'+encodeURIComponent(p.id)+'.png" alt="" loading="lazy" onerror="this.remove()">':'')+'<strong>'+esc(p.nome)+'</strong><span>'+p.pts+' PTS · '+p.reb+' REB · '+p.ast+' AST</span></div>').join('')+'</div>'};
    return '<div class="stats-court"><svg class="stats-court-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true"><rect x="15" y="15" width="970" height="570" fill="none" stroke="#728092" stroke-width="3"/><line x1="500" y1="15" x2="500" y2="585" stroke="#728092" stroke-width="3"/><circle cx="500" cy="300" r="70" stroke="#728092" stroke-width="3" fill="none"/><rect x="15" y="185" width="160" height="230" stroke="#728092" stroke-width="3" fill="none"/><rect x="825" y="185" width="160" height="230" stroke="#728092" stroke-width="3" fill="none"/></svg><h2 class="stats-court-title">Titulares identificados no box score</h2><div class="stats-lineups"><div><h3>'+logo(a,22)+' '+esc(a.nome)+'</h3>'+draw(a)+'</div><div><h3>'+logo(b,22)+' '+esc(b.nome)+'</h3>'+draw(b)+'</div></div></div><p class="stats-note">Posicionamento ilustrativo. São titulares registrados na partida concluída, não uma escalação futura ou uma projeção tática.</p>';
  }
  function paint(){
    matchup();
    root.querySelectorAll('[data-tab]').forEach(btn=>btn.setAttribute('aria-selected',String(btn.dataset.tab===tab)));
    const host=$('#stats-content');
    host.innerHTML=tab==='confronto'?showConfronto():tab==='jogadores'?showJogadores():tab==='tendencias'?showTendencias():showQuintetos();
  }
  $('#stats-partida')?.addEventListener('change',()=>{index=0;paint()});
  root.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{tab=btn.dataset.tab;paint()}));
  root.addEventListener('change',e=>{if(e.target.id==='stats-jogador'){index=Number(e.target.value);paint()}});
  root.addEventListener('click',e=>{const btn=e.target.closest('[data-metric]');if(btn){metric=btn.dataset.metric;paint()}});
  if(!d.partidas.length){$('#stats-content').innerHTML='<div class="stats-empty">Aguardando partidas com box score completo.</div>';return}
  paint();
})();