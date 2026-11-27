import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pendentes, construirPrompt } from './gerar-colagens.js';

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'cestinha-arte-'));
try {
  const base={
    tipo:'NA RODADA', titulo:'Wembanyama faz 44 e enfrenta Portland',
    subtitulo:'Spurs x Trail Blazers', jogador:'Victor Wembanyama',
    jogadores:['Victor Wembanyama','Deni Avdija'],
    times:['San Antonio Spurs','Portland Trail Blazers'],
    cores:['#141414','#cc2222'], contexto:'44 pontos de Wembanyama e derrota dos Spurs.'
  };
  const dados={noticias:[
    {...base,arteId:'jogo-401909325'},
    {...base,arteId:'jogo-401909325'}, // duplicado nao deve gerar nova arte
    {...base,arteId:'rodada-2026-11-25',tipo:'RESUMO DA RODADA'},
    {...base,arteId:'../../invalido'},
    {...base,arteId:'jogo-401909317',titulo:'LeBron conquista triplo-duplo'}
  ]};
  fs.writeFileSync(path.join(tmp,'jogo-401909325.webp'),'ja existe');
  const fila=pendentes(dados,tmp);
  assert.deepEqual(fila.map(n=>n.arteId),['rodada-2026-11-25','jogo-401909317']);
  const prompt=construirPrompt(fila[1]);
  assert.ok(prompt.includes('LeBron conquista triplo-duplo'));
  assert.ok(prompt.includes('ILUSTRACAO ARTISTICA'));
  assert.ok(prompt.includes('PROIBIDO colocar palavras'));
  assert.ok(prompt.includes('San Antonio Spurs'));
  assert.ok(!prompt.includes('data:image/'));
  const manifest=path.resolve('.cache/artes-home.json');
  if (fs.existsSync(manifest)) {
    const atual=JSON.parse(fs.readFileSync(manifest,'utf8'));
    assert.ok(Array.isArray(atual.noticias) && atual.noticias.length<=5);
    assert.equal(new Set(atual.noticias.map(n=>n.arteId)).size,atual.noticias.length);
    assert.ok(atual.noticias.every(n=>n.titulo && /^(jogo-\d+|rodada-\d{4}-\d{2}-\d{2})$/.test(n.arteId)));
    console.log('Manifesto real validado:',atual.noticias.length,'destaques');
  }
  console.log('Geracao automatica de colagens: planejamento, prompts, identificadores e deduplicacao OK.');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
