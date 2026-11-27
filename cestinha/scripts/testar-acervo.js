import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {RAIZ,lerJson} from './lib/util.js';
import {SIGLAS,PASTA_ACERVO,escolherDestaque,caminhosDestaque,montarAcervo} from './lib/acervo.js';

assert.equal(SIGLAS.length,30,'O acervo deve listar todos os 30 times da NBA');
const mapa=new Map();
let logos=0, jogadores=0;
for(const sigla of SIGLAS){
  const time=lerJson(path.join(RAIZ,'data','times',sigla+'.json'));
  assert.ok(time && time.sigla===sigla,'Dados ausentes para '+sigla);
  mapa.set(String(time.id),time);
  const jogador=escolherDestaque(time);
  assert.ok(jogador,'Sem jogador para '+sigla);
  assert.ok(time.elenco.some(p=>String(p.id)===String(jogador.id)),
    'Jogador escolhido nao esta no elenco do '+sigla);
  const caminho=caminhosDestaque(sigla,jogador.id);
  assert.ok(caminho,'Caminho invalido do '+sigla);
  if(fs.existsSync(caminho.escudo)){
    const texto=fs.readFileSync(caminho.escudo,'utf8');
    assert.ok(texto.includes('data:image/')&&texto.includes('<svg'),'Logo sem imagem embutida: '+sigla);
    assert.ok(!/<text\b/i.test(texto),'Arte de escudo ganhou texto: '+sigla);
    logos++;
  }
  if(fs.existsSync(caminho.jogador)){
    const texto=fs.readFileSync(caminho.jogador,'utf8');
    assert.ok(texto.includes('data:image/')&&texto.includes('<svg'),'Jogador sem imagem embutida: '+sigla);
    assert.ok(!/<text\b/i.test(texto),'Arte de jogador ganhou texto: '+sigla);
    jogadores++;
  }
}
assert.equal(mapa.size,30,'IDs de time repetidos');
const ny=[...mapa.values()].find(t=>t.sigla==='NY');
const mi=[...mapa.values()].find(t=>t.sigla==='MIA');
assert.ok(ny&&mi);
const noticia={tipo:'NA RODADA',arteId:'jogo-teste-123',titulo:'Jalen Brunson decide diante do Heat',
  visitante:{id:ny.id,sigla:ny.sigla,cor:ny.cor,logo:ny.logo},
  casa:{id:mi.id,sigla:mi.sigla,cor:mi.cor,logo:mi.logo}};
const montagem=montarAcervo({noticia,raiz:'.',timesPorId:mapa});
assert.ok(montagem.includes('acervo-composicao')&&montagem.includes('acervo-equipe-a'));
assert.ok(montagem.includes('acervo-equipe-b'));
assert.ok(montagem.includes('acervo-escudo'));
assert.ok(!montagem.includes('assets/colagens/'),'Montagem ainda depende de arte paga');
assert.ok(!montagem.includes('gpt-image'),'Montagem solicita API paga');
const outro={...noticia,titulo:'Jose Alvarado resolve o jogo',arteId:'jogo-teste-456'};
const montOutro=montarAcervo({noticia:outro,raiz:'.',timesPorId:mapa});
if(fs.existsSync(caminhosDestaque('NY',escolherDestaque(ny).id).jogador)){
  assert.ok(!montOutro.includes('jogadores/NY-'),
    'Nao deve ilustrar Jose Alvarado com arte de Brunson');
}
console.log('30 times cadastrados e validos | artes disponiveis: '+logos+'/30 escudos e '+jogadores+'/30 atletas.');
if(logos<30||jogadores<30)console.warn('AVISO: alguns arquivos ainda dependem do CDN, serao tentados nas proximas atualizacoes.');
