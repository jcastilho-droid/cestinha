// COLETA DOS TIMES (sem IA): lista, classificação, elenco com médias, estatísticas e calendário.
// Salva em data/times/index.json e data/times/<SIGLA>.json.
// Roda junto com a coleta de jogos, mas só de 6 em 6 horas (para não pesar na ESPN).
// Uso: node scripts/coletar-times.js           (respeita o intervalo)
//      node scripts/coletar-times.js --forcar  (coleta agora)
import path from 'node:path';
import * as fonte from './fontes/espn.js'; // para trocar de fonte, troque este import
import { RAIZ, lerJson, gravarJson, agoraIso } from './lib/util.js';

const PASTA = path.join(RAIZ, 'data', 'times');
const INTERVALO_HORAS = 6;
const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function coletarTimes({ forcar = false } = {}) {
  const indice = lerJson(path.join(PASTA, 'index.json'));
  if (!forcar && indice?.atualizado_em && Date.now() - Date.parse(indice.atualizado_em) < INTERVALO_HORAS * 3600e3) {
    console.log(`[times] coletado há menos de ${INTERVALO_HORAS}h, pulando.`);
    return;
  }
  const times = fonte.normalizarListaTimes(await fonte.buscarListaTimes());
  const classif = fonte.normalizarClassificacao(await fonte.buscarClassificacao());
  let stats = {};
  try {
    stats = fonte.normalizarEstatisticasJogadores(await fonte.buscarEstatisticasJogadores());
  } catch (e) {
    console.error(`[times] médias dos jogadores indisponíveis: ${e.message}`);
  }
  let ok = 0;
  for (const base of times) {
    try {
      const completo = fonte.normalizarTime(
        base,
        await fonte.buscarTime(base.id),
        await fonte.buscarElenco(base.id),
        await fonte.buscarCalendario(base.id),
        await fonte.buscarEstatisticasTime(base.id),
        stats,
        classif,
      );
      completo.atualizado_em = agoraIso();
      gravarJson(path.join(PASTA, `${base.sigla}.json`), completo);
      ok++;
    } catch (e) {
      console.error(`[times] ${base.sigla}: ${e.message}`);
    }
    await pausa(250);
  }
  gravarJson(path.join(PASTA, 'index.json'), { atualizado_em: agoraIso(), fonte: 'ESPN', classificacao: classif, times });
  console.log(`[times] ${ok} de ${times.length} times atualizados.`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await coletarTimes({ forcar: process.argv.includes('--forcar') });
}
