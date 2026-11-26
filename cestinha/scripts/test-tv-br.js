import assert from 'node:assert/strict';
import fs from 'node:fs';
const dados=JSON.parse(fs.readFileSync('data/transmissoes-br.json','utf8'));
const agenda=JSON.parse(fs.readFileSync('data/agenda.json','utf8'));
const diaBR=iso=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo'}).format(new Date(iso));
const key=times=>times.map(x=>String(x).toUpperCase()).sort().join('/');
const keys=new Set();
for(const item of dados.registros){
  assert.match(item.dia_br,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(item.times.length,2);
  assert.ok(item.canais.length>=1);
  assert.match(item.fonte,/^https:\/\//);
  const k=item.dia_br+'/'+key(item.times);
  assert.ok(!keys.has(k),'Transmissao duplicada: '+k);
  keys.add(k);
}
const matched=agenda.jogos.filter(j=>keys.has(diaBR(j.inicio_utc)+'/'+key([j.casa.sigla,j.visitante.sigla])));
assert.ok(matched.length>0,'Nenhuma transmissao brasileira verificada corresponde a agenda atual');
for(const j of matched){
  const k=diaBR(j.inicio_utc)+'/'+key([j.casa.sigla,j.visitante.sigla]);
  const tv=dados.registros.find(x=>x.dia_br+'/'+key(x.times)===k);
  assert.ok(tv.canais.length>0);
}
const html=fs.readFileSync('_site/agenda.html','utf8');
assert.ok(html.includes('NBA League Pass'),'Deve apresentar alternativa brasileira');
assert.ok(!html.includes('(EUA)'),'Nao exibir grade americana');
assert.ok(html.includes('Mais estatísticas')===false,'Detalhes da tabela nao pertencem a agenda');
const classificacao=fs.readFileSync('_site/classificacao.html','utf8');
assert.ok(classificacao.includes('classif-expansivel'),'Tabela deve ter detalhes recolhidos no mobile');
console.log('Transmissoes BR validadas; '+matched.length+' confronto(s) da agenda com grade especifica.');
