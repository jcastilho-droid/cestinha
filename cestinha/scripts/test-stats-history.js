// Contrato dos dados de temporada, usando o site realmente gerado.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const html=fs.readFileSync('_site/stats.html','utf8');
const match=html.match(/<script id="stats-dados" type="application\/json">([\s\S]*?)<\/script>/);
assert.ok(match,'Cestinha Stats deve ter JSON embutido');
const d=JSON.parse(match[1]);
assert.ok(Array.isArray(d.partidas),'Partidas devem estar disponíveis');
assert.ok(d.historicoJogadores&&typeof d.historicoJogadores==='object','Histórico individual ausente');
const entries=Object.entries(d.historicoJogadores);
assert.ok(entries.length>0,'Nenhum histórico de atleta consolidado');
let count=0;
for(const [key,history] of entries){
  assert.ok(key.startsWith('espn:')||key.startsWith('time:'),'Identificador inválido');
  assert.ok(Array.isArray(history),'Histórico inválido');
  let prev='',games=new Set();
  for(const game of history){
    assert.ok(game.jogo_id,'Jogo sem identificador');
    assert.ok(!games.has(game.jogo_id),'Jogo duplicado no histórico');
    games.add(game.jogo_id);
    assert.ok(game.data>=prev,'Histórico não está em ordem cronológica');
    prev=game.data;
    assert.ok(game.min>0,'DNP entrou no histórico');
    for(const metric of ['pts','reb','ast','rb','toco']){
      assert.ok(Number.isFinite(game[metric]),metric+' inválido');
    }
    if(game.tres_convertidas!==null)assert.ok(Number.isInteger(game.tres_convertidas),'3PM inválido');
    count++;
  }
}
assert.ok(count>0,'Nenhum registro de estatística encontrado');
console.log('Histórico validado: '+entries.length+' jogadores; '+count+' registros; '+d.partidas.length+' confrontos no seletor.');
