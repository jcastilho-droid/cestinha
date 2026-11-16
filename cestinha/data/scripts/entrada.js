// Monta a ENTRADA que o Cestinha lê antes de escrever (formato do prompt: tipo, dados, contexto).
// Uso: node scripts/entrada.js jogo 401909990
//      node scripts/entrada.js rodada 2026-11-15
import { acharJogo, entradaJogo, entradaRodada, lerRodada } from './lib/dados.js';

const [modo, ref] = process.argv.slice(2);
let entrada;
if (modo === 'jogo') {
  const jogo = acharJogo(ref);
  if (!jogo) throw new Error(`Jogo ${ref} não encontrado em data/raw/`);
  entrada = entradaJogo(jogo);
} else if (modo === 'rodada') {
  if (!lerRodada(ref)) throw new Error(`Rodada ${ref} não encontrada em data/raw/`);
  entrada = entradaRodada(ref);
} else {
  console.error('Uso: node scripts/entrada.js jogo <id> | rodada <AAAA-MM-DD>');
  process.exit(1);
}
console.log(JSON.stringify(entrada, null, 2));
