// Mostra o que o Cestinha ainda precisa escrever (passo 2 da ROTINA.md).
// Uso: node scripts/pendentes.js
import { P, lerJson, listarDiasRaw, dataEUA } from './lib/util.js';
import { lerRodada, lerJogo } from './lib/dados.js';
import { candidatosDaNoite, hojeBR as hojeNoite } from './lib/noite.js';

const JANELA_DIAS = 3; // só olha rodadas recentes (não escreve sobre jogo velho)
const MAX_JOGOS_POR_EXECUCAO = 15;

const feito = lerJson(P.processados, { jogos: {}, rodadas: {} });
const limite = dataEUA(-JANELA_DIAS);
const jogos = [];
const rodadas = [];
const aguardando = [];

for (const dia of listarDiasRaw().filter((d) => d >= limite)) {
  const rodada = lerRodada(dia);
  if (!rodada) continue;
  let todosFinalizados = true;
  let todosEscritos = true;
  let algumFinal = false;
  for (const base of rodada.jogos) {
    if (base.status === 'adiado') continue;
    if (base.status !== 'final' || !lerJogo(dia, base.id)) {
      todosFinalizados = false;
      continue;
    }
    algumFinal = true;
    if (!feito.jogos[base.id]) {
      todosEscritos = false;
      jogos.push({ id: base.id, data_rodada: dia, partida: `${base.visitante.sigla} ${base.visitante.placar} x ${base.casa.placar} ${base.casa.sigla}` });
    }
  }
  if (feito.rodadas[dia] || !algumFinal) continue;
  if (todosFinalizados && todosEscritos) rodadas.push({ data_rodada: dia });
  else if (todosFinalizados) rodadas.push({ data_rodada: dia, depois_dos_jogos: true });
  else aguardando.push({ data_rodada: dia, motivo: 'ainda há jogo em andamento ou sem box score' });
}

// Power ranking: um por semana (segunda-feira no horário de Brasília, ou se o último tiver mais de 7 dias)
const ultimoPower = Object.keys(feito.power || {}).sort().at(-1);
const hojeBR = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const segunda = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(new Date()) === 'Mon';
const diasDesde = ultimoPower ? (Date.parse(hojeBR) - Date.parse(ultimoPower)) / 86400000 : 99;
const power = (segunda && diasDesde >= 1) || diasDesde >= 7 ? { data: hojeBR } : null;

// Jogo da noite: um por dia, escrito antes do primeiro jogo começar
const diaNoite = hojeNoite();
const candNoite = candidatosDaNoite(diaNoite);
const primeiroJogo = candNoite.map((c) => Date.parse(c.inicio_utc)).sort((a, b) => a - b)[0];
const noite = candNoite.length > 0 && !(feito.jogo_da_noite || {})[diaNoite] && Date.now() < primeiroJogo
  ? { data: diaNoite, jogos: candNoite.length } : null;

const saida = {
  jogos: jogos.slice(0, MAX_JOGOS_POR_EXECUCAO),
  jogos_ficaram_para_depois: Math.max(0, jogos.length - MAX_JOGOS_POR_EXECUCAO),
  rodadas,
  rodadas_aguardando: aguardando,
  power_ranking: power,
  jogo_da_noite: noite,
  nada_novo: jogos.length === 0 && rodadas.length === 0 && !power && !noite,
};
console.log(JSON.stringify(saida, null, 2));
