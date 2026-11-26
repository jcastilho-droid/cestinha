import assert from 'node:assert/strict';
import fs from 'node:fs';

const page=fs.readFileSync('_site/stats.html','utf8');
const js=fs.readFileSync('_site/assets/stats.js','utf8');
const css=fs.readFileSync('_site/assets/stats.css','utf8');
const m=page.match(/<script id="stats-dados" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(m,'Dados do Stats ausentes');
const data=JSON.parse(m[1]);
assert.ok(Array.isArray(data.partidas));
assert.ok(page.includes('id="stats-explorer-grid"'),'Grade de cards nao gerada');
assert.ok(page.includes('id="stats-busca"'),'Campo de busca ausente');
assert.ok(page.includes('id="stats-time-filtro"'),'Filtro de time ausente');
assert.ok(page.includes('id="stats-periodo-filtro"'),'Filtro de periodo ausente');
assert.ok(page.includes('id="stats-ver-mais"'),'Paginacao ausente');
assert.ok(page.includes('id="stats-partida"'),'Controle de compatibilidade das abas ausente');
assert.ok(page.includes('class="stats-sr-only"'),'Seletor longo deve estar oculto');
assert.ok(js.includes("history.replaceState"),'Selecao deve atualizar URL do jogo');
assert.ok(js.includes("index=0;selectedHistoryGameId=null"),'Selecao deve resetar historico do atleta');
assert.ok(js.includes('data-game-id'),'Cards de jogo sem selecao');
assert.ok(js.includes('prepareExplorer();')&&js.includes('renderExplorer();'),'Explorador nao inicializado');
assert.ok(css.includes('.stats-explorer-grid'),'Sem estilos dos cards');
const ids=data.partidas.map(g=>String(g.id));
assert.equal(new Set(ids).size,ids.length,'Jogos duplicados');
for(const g of data.partidas){
  assert.equal(g.times.length,2,'Cada confronto deve ter duas equipes');
  assert.ok(g.times.every(t=>t.logo&&t.sigla),'Confronto incompleto');
}
console.log('Explorador validado: '+data.partidas.length+' jogos, filtros e navegacao por cards.');
