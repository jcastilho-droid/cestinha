// Aprova um texto que estava em content/revisao/ e manda para o site.
// Uso: node scripts/aprovar.js jogo-401909990.json
//      node scripts/aprovar.js rodada-2026-11-15.json
// Os alertas antigos ficam guardados em "alertas_resolvidos".
import fs from 'node:fs';
import path from 'node:path';
import { P, lerJson, gravarJson, agoraIso } from './lib/util.js';

const nome = path.basename(process.argv[2] || '');
const m = nome.match(/^(jogo|rodada|power)-(.+)\.json$/);
const origem = path.join(P.revisao, nome);
if (!m || !fs.existsSync(origem)) {
  console.error('Uso: node scripts/aprovar.js <arquivo que está em content/revisao/>');
  process.exit(1);
}
const t = lerJson(origem);
t.alertas_resolvidos = t.alertas;
t.alertas = [];
t.aprovado_em = agoraIso();
const destino = m[1] === 'power' ? path.join(P.content, 'power-ranking', `${m[2]}.json`) : path.join(m[1] === 'jogo' ? P.jogos : P.rodadas, `${m[2]}.json`);
gravarJson(destino, t);
fs.unlinkSync(origem);
const feito = lerJson(P.processados, { jogos: {}, rodadas: {} });
if (m[1] === 'power') { feito.power = feito.power || {}; feito.power[m[2]] = { em: t.aprovado_em, destino: 'publicado' }; } else (m[1] === 'jogo' ? feito.jogos : feito.rodadas)[m[2]] = { em: t.aprovado_em, destino: 'publicado' };
gravarJson(P.processados, feito);
console.log(`Aprovado: ${path.relative(P.content, destino)}`);
