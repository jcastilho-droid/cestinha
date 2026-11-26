// COLETA (sem IA). Roda no GitHub Actions de hora em hora.
// Busca os jogos de ontem e de hoje (data dos EUA) e salva em data/raw/AAAA-MM-DD/.
//   rodada.json      -> lista de todos os jogos do dia, com status e placar
//   <idDoJogo>.json  -> jogo finalizado completo (box score, parciais, contexto)
// Uso: node scripts/coletar.js              (ontem e hoje)
//      node scripts/coletar.js 2026-11-15   (um dia específico)
import path from 'node:path';
import fs from 'node:fs';
import * as fonte from './fontes/espn.js'; // para trocar de fonte, troque este import
import { P, lerJson, gravarJson, dataEUA, agoraIso } from './lib/util.js';

const dias = process.argv.slice(2).length ? process.argv.slice(2) : [dataEUA(-1), dataEUA(0)];
let erros = 0;

for (const dia of dias) {
  const pasta = path.join(P.raw, dia);
  let jogos;
  try {
    jogos = fonte.listarJogos(await fonte.buscarPlacar(dia));
  } catch (e) {
    console.error(`[${dia}] falha ao buscar placar: ${e.message}`);
    erros++;
    continue;
  }
  if (jogos.length === 0) {
    console.log(`[${dia}] sem jogos.`);
    continue;
  }

  // Só regrava rodada.json se algo mudou (evita commits inúteis)
  const arqRodada = path.join(pasta, 'rodada.json');
  const antigo = lerJson(arqRodada);
  if (!antigo || JSON.stringify(antigo.jogos) !== JSON.stringify(jogos)) {
    gravarJson(arqRodada, { data_rodada: dia, coletado_em: agoraIso(), fonte: 'ESPN', jogos });
    console.log(`[${dia}] rodada.json atualizado (${jogos.length} jogos).`);
  }

  for (const j of jogos.filter((x) => x.status === 'final')) {
    const arq = path.join(pasta, `${j.id}.json`);
    // já coletado: jogo final não muda (só recoleta se faltar algum campo novo, como o fluxo do placar)
    if (fs.existsSync(arq) && lerJson(arq)?.fluxo && lerJson(arq)?.foto_jogo_verificada) continue;
    try {
      const completo = fonte.normalizarJogo(j, await fonte.buscarDetalhe(j.id), dia);
      if (!completo.casa.jogadores.length) throw new Error('box score vazio, tento de novo na próxima');
      gravarJson(arq, completo);
      console.log(`[${dia}] jogo ${j.id} salvo: ${j.visitante.sigla} ${j.visitante.placar} x ${j.casa.placar} ${j.casa.sigla}`);
    } catch (e) {
      console.error(`[${dia}] jogo ${j.id}: ${e.message}`);
      erros++;
    }
  }
}

if (erros) console.error(`Terminou com ${erros} erro(s).`);
// Não falha o workflow por erro de uma fonte: o site continua sendo publicado.

// Agenda: próximos 7 dias (data dos EUA), mostrada em horário de Brasília
try {
  const pares = [];
  for (let i = 0; i < 7; i++) {
    const dia = dataEUA(i);
    try { pares.push([dia, await fonte.buscarPlacar(dia)]); } catch (e) { console.error(`[agenda] ${dia}: ${e.message}`); }
  }
  const agenda = fonte.normalizarAgenda(pares);
  const arqAg = path.join(P.raw, '..', 'agenda.json');
  const antiga = lerJson(arqAg);
  if (!antiga || JSON.stringify(antiga.jogos) !== JSON.stringify(agenda)) {
    gravarJson(arqAg, { atualizado_em: agoraIso(), fonte: 'ESPN', jogos: agenda });
    console.log(`[agenda] ${agenda.length} jogos nos próximos 7 dias.`);
  }
} catch (e) {
  console.error(`[agenda] falha: ${e.message}`);
}

// Dados dos times (elenco, estatísticas, calendário): no máximo de 6 em 6 horas.
try {
  const { coletarTimes } = await import('./coletar-times.js');
  await coletarTimes();
} catch (e) {
  console.error(`[times] falha: ${e.message}`);
}
