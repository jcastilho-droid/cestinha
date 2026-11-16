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
    if (fs.existsSync(arq)) continue; // já coletado; jogo final não muda
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
