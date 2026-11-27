import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const home = fs.readFileSync('_site/index.html','utf8');
const agenda = fs.readFileSync('_site/agenda.html','utf8');
assert.ok(!agenda.includes('<b>Brasil:</b>'),'Remover prefixo Brasil da agenda');
assert.ok(!agenda.includes('(EUA)'),'Nao exibir TV americana');
for(const asset of ['carrossel-home.css','carrossel-home.js']){
  assert.ok(fs.statSync(path.join('_site','assets',asset)).size>300,asset+' ausente ou vazio');
}
const match = home.match(/<section class="noticias-home"[\s\S]*?<\/section>/);
if (match) {
  const html = match[0];
  assert.ok(html.includes('class="noticia-pontos"'),'Navegacao com dots ausente');
  assert.ok(!html.includes('data-noticia-prev'),'Setas antigas ainda presentes');
  assert.ok(!html.includes('data-noticia-status'),'Contador antigo ainda presente');
  assert.ok(html.includes('data-cestinha-carrossel'),'Carrossel nao inicializado');
  const slides = [...html.matchAll(/class="noticia-slide(?:\s|\")/g)].length;
  assert.ok(slides>0&&slides<=5,'Quantidade de slides incorreta: '+slides);
  const links = [...html.matchAll(/href="([^"]+\/(?:jogo|rodada)\/[^"]+\.html)"/g)].map(m=>m[1]);
  assert.ok(links.length>=slides,'Slides sem destino valido');
  for(const link of links){
    const relative=link.replace(/^\.\//,'');
    assert.ok(fs.existsSync(path.join('_site',relative)),'Link interno quebrado: '+link);
  }
  assert.ok(html.includes('noticia-galeria-main') && html.includes('noticia-galeria-colagem'),'Colagem editorial do destaque ausente');
  assert.ok(!html.includes('class="noticia-jogador"'),'Retrato sobreposto ainda presente');
  assert.ok(html.includes('noticia-galeria-aviso') || html.includes('a.espncdn.com'),'Imagem editorial sem origem identificada');
  assert.ok(html.includes('noticia-creditos'),'Creditos editoriais ausentes');
  if(slides>1)assert.ok(html.includes('data-noticia-indice'),'Carrossel sem dots');
  console.log('Carrossel validado: '+slides+' noticias, '+links.length+' links internos existentes.');
} else {
  // Pode ocorrer em uma coleta inicial sem resenhas nem jogos.
  console.log('Sem conteudo editorial suficiente nesta coleta: fallback da home preservado.');
}
console.log('Agenda validada: prefixo Brasil e canais americanos ausentes.');

const js=fs.readFileSync('_site/assets/carrossel-home.js','utf8');
assert.ok(js.includes('INTERVALO = 6000'),'Autoplay deveria ocorrer a cada 6 segundos');
const css=fs.readFileSync('_site/assets/carrossel-home.css','utf8');
assert.ok(css.includes('Refinamento editorial'),'CSS de legibilidade nao aplicado');

// Verificacoes de identidade editorial: sem mencao corporativa e modulo progressivo.
for(const file of ['index.html','agenda.html','classificacao.html']){
  const html=fs.readFileSync('_site/'+file,'utf8');
  assert.ok(!html.includes('LiveMode'),'Rodape ainda contem LiveMode em '+file);
}
const visual=fs.readFileSync('_site/assets/visual-v6.js','utf8');
assert.ok(visual.includes('zone.append(section)'),'Modulo Explore nao esta no final da rodada');
assert.ok(visual.includes('v6-pick-photo'),'Mini-cards de exploracao sem area de foto');
assert.ok(!visual.includes("$('.sec-jogos',zone)?.before(section)"),'Modulo Explore ainda precede jogos');
console.log('Rodape e modulo Explore validados.');

assert.ok(css.includes('.noticia-galeria-colagem'),'Layout de colagem editorial nao incluido no CSS');
assert.ok(css.includes('@media(max-width:720px)'),'Layout mobile da galeria nao encontrado');
