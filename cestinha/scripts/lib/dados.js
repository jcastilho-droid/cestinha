// Leitura dos dados brutos e montagem da "entrada" que o Cestinha recebe.
// Tudo aqui é número vindo da fonte; nada é inventado.
import path from 'node:path';
import fs from 'node:fs';
import { P, RAIZ, lerJson, listarDiasRaw, listarArquivos, horaBrasilia, dataPorExtenso } from './util.js';

const BRASILEIROS = lerJson(path.join(RAIZ, 'config', 'brasileiros.json'), { jogadores: [] }).jogadores;

export function lerRodada(dia) {
  return lerJson(path.join(P.raw, dia, 'rodada.json'));
}
export function lerJogo(dia, id) {
  return lerJson(path.join(P.raw, dia, `${id}.json`));
}
export function acharJogo(id) {
  for (const dia of listarDiasRaw().reverse()) {
    const j = lerJogo(dia, id);
    if (j) return j;
  }
  return null;
}
export function todasRodadas() {
  return listarDiasRaw().map(lerRodada).filter(Boolean);
}

export function linhaEstatistica(j) {
  const partes = [`${j.pts} pts`, `${j.reb} reb`, `${j.ast} ast`];
  if (j.rb >= 3) partes.push(`${j.rb} rb`);
  if (j.toco >= 3) partes.push(`${j.toco} tocos`);
  return partes.join(', ');
}

function duploDuplo(j) {
  return [j.pts, j.reb, j.ast, j.rb, j.toco].filter((x) => x >= 10).length;
}

function destaques(time, n = 5) {
  return [...(time.jogadores || [])]
    .sort((a, b) => b.pts - a.pts || b.reb + b.ast - (a.reb + a.ast))
    .slice(0, n)
    .map((j) => ({
      nome: j.nome,
      linha: linhaEstatistica(j),
      min: j.min, pts: j.pts, reb: j.reb, ast: j.ast, rb: j.rb, toco: j.toco,
      arremessos: j.fg, bolas_de_tres: j.tres, lances_livres: j.ll, mais_menos: j.mais_menos,
      ...(duploDuplo(j) >= 3 ? { triplo_duplo: true } : duploDuplo(j) === 2 ? { duplo_duplo: true } : {}),
    }));
}

export function brasileirosNoJogo(jogo) {
  const nomes = [...jogo.casa.jogadores, ...jogo.visitante.jogadores, ...jogo.casa.nao_jogaram, ...jogo.visitante.nao_jogaram].map((j) => j.nome);
  return BRASILEIROS.filter((b) => nomes.includes(b));
}

function resumoTime(t) {
  return {
    time: t.nome_curto, nome_completo: t.nome, sigla: t.sigla, placar: t.placar,
    campanha_apos_jogo: t.campanha, parciais_por_quarto: t.parciais, estatisticas_do_time: t.estatisticas,
    destaques: destaques(t),
    nao_jogaram: (t.nao_jogaram || []).filter((x) => x.motivo && !/COACH/i.test(x.motivo)),
  };
}

export function entradaJogo(jogo) {
  const venc = jogo.casa.vencedor ? jogo.casa : jogo.visitante;
  const perd = jogo.casa.vencedor ? jogo.visitante : jogo.casa;
  return {
    tipo: 'resumo_jogo',
    dados: {
      id_jogo: jogo.id,
      rodada: dataPorExtenso(jogo.data_rodada),
      inicio_horario_brasilia: horaBrasilia(jogo.inicio_utc),
      local: jogo.local,
      resultado: `${venc.nome_curto} ${venc.placar} x ${perd.placar} ${perd.nome_curto}`,
      vencedor: venc.nome_curto,
      diferenca: venc.placar - perd.placar,
      prorrogacoes: jogo.prorrogacoes,
      mandante: resumoTime(jogo.casa),
      visitante: resumoTime(jogo.visitante),
      trocas_de_lideranca: jogo.trocas_de_lideranca,
      ultimas_cestas_em_ingles: jogo.lances_finais,
      fonte: { nome: jogo.fonte, link: jogo.link_fonte, manchete_em_ingles: jogo.materia_fonte?.titulo_en || null, resumo_da_materia_em_ingles: jogo.materia_fonte?.resumo_en || null },
    },
    contexto: {
      serie_na_temporada_em_ingles: jogo.serie?.resumo_en || null,
      classificacao_da_divisao: jogo.classificacao_divisao,
      brasileiros_no_jogo: brasileirosNoJogo(jogo),
      observacao: 'Campanhas e classificação já incluem este jogo.',
    },
  };
}

export function textoPublicado(tipo, ref) {
  const pasta = tipo === 'jogo' ? P.jogos : P.rodadas;
  return lerJson(path.join(pasta, `${ref}.json`));
}

export function entradaRodada(dia) {
  const rodada = lerRodada(dia);
  const jogos = [];
  const candidatos = [];
  for (const base of rodada.jogos) {
    if (base.status !== 'final') {
      jogos.push({ id_jogo: base.id, situacao: base.status, partida: `${base.visitante.nome_curto} x ${base.casa.nome_curto}` });
      continue;
    }
    const j = lerJogo(dia, base.id);
    if (!j) continue;
    const venc = j.casa.vencedor ? j.casa : j.visitante;
    const perd = j.casa.vencedor ? j.visitante : j.casa;
    const tops = [...j.casa.jogadores.map((x) => ({ ...x, time: j.casa.nome_curto })), ...j.visitante.jogadores.map((x) => ({ ...x, time: j.visitante.nome_curto }))]
      .sort((a, b) => b.pts - a.pts);
    candidatos.push(...tops.slice(0, 3));
    const texto = textoPublicado('jogo', j.id);
    jogos.push({
      id_jogo: j.id,
      resultado: `${venc.nome_curto} ${venc.placar} x ${perd.placar} ${perd.nome_curto}`,
      mandante: j.casa.nome_curto,
      diferenca: venc.placar - perd.placar,
      prorrogacoes: j.prorrogacoes,
      campanhas: { [j.casa.nome_curto]: j.casa.campanha, [j.visitante.nome_curto]: j.visitante.campanha },
      cestinha: { nome: tops[0].nome, time: tops[0].time, linha: linhaEstatistica(tops[0]) },
      outros_destaques: tops.slice(1, 3).map((x) => ({ nome: x.nome, time: x.time, linha: linhaEstatistica(x) })),
      brasileiros_no_jogo: brasileirosNoJogo(j),
      titulo_do_resumo_publicado: texto?.titulo || null,
      importancia_do_resumo: texto?.importancia ?? null,
    });
  }
  const melhores = candidatos
    .sort((a, b) => b.pts + b.reb + b.ast - (a.pts + a.reb + a.ast))
    .slice(0, 5)
    .map((x) => ({ nome: x.nome, time: x.time, linha: linhaEstatistica(x), ...(duploDuplo(x) >= 3 ? { triplo_duplo: true } : {}) }));
  return {
    tipo: 'resumo_rodada',
    dados: { data_rodada: dia, rodada: dataPorExtenso(dia), total_de_jogos: rodada.jogos.length, jogos, candidatos_a_destaque_da_noite: melhores, fonte: 'ESPN' },
    contexto: {},
  };
}

export function existe(arq) {
  return fs.existsSync(arq);
}
export { listarArquivos };

// ---------- Selos de "jogo épico" e líderes da noite (calculados só com números da fonte) ----------

export function selosDoJogo(j) {
  if (j.status !== 'final' || !j.casa?.jogadores) return [];
  const venc = j.casa.vencedor ? j.casa : j.visitante;
  const perd = j.casa.vencedor ? j.visitante : j.casa;
  const margem = venc.placar - perd.placar;
  const selos = [];
  if (j.prorrogacoes > 0) selos.push({ id: 'prorrogacao', rotulo: j.prorrogacoes > 1 ? `${j.prorrogacoes} PRORROGAÇÕES` : 'PRORROGAÇÃO', epico: true });
  const vantPerdedor = Number(perd.estatisticas?.maior_vantagem || 0);
  if (vantPerdedor >= 15) selos.push({ id: 'virada', rotulo: `VIRADA DE ${vantPerdedor}`, epico: true });
  if (margem <= 5 && j.prorrogacoes === 0) selos.push({ id: 'detalhe', rotulo: 'NO DETALHE', epico: true });
  const todos = [...j.casa.jogadores, ...j.visitante.jogadores];
  for (const p of todos) {
    if (p.pts >= 40) selos.push({ id: 'quarenta', rotulo: `${p.pts} DE ${sobrenome(p.nome)}`, epico: true });
    if ([p.pts, p.reb, p.ast, p.rb, p.toco].filter((x) => x >= 10).length >= 3) selos.push({ id: 'triplo', rotulo: `TRIPLO-DUPLO DE ${sobrenome(p.nome)}`, epico: true });
  }
  if (margem >= 25) selos.push({ id: 'atropelo', rotulo: 'ATROPELO', epico: false });
  return selos;
}

function sobrenome(nome) {
  const partes = String(nome).split(' ').filter((x) => !/^(Jr\.?|Sr\.?|II|III|IV)$/i.test(x));
  return (partes.at(-1) || nome).toUpperCase();
}

const feitas = (s) => Number(String(s || '0-0').split('-')[0]) || 0;

// Game Score (John Hollinger): resume a atuação de um jogador num número só.
export function gameScore(p) {
  const [fgm, fga] = String(p.fg || '0-0').split('-').map(Number);
  const [ftm, fta] = String(p.ll || '0-0').split('-').map(Number);
  const v = (x) => Number(x) || 0;
  return v(p.pts) + 0.4 * v(fgm) - 0.7 * v(fga) - 0.4 * (v(fta) - v(ftm)) + 0.7 * v(p.reb_of) + 0.3 * v(p.reb_def ?? p.reb)
    + v(p.rb) + 0.7 * v(p.ast) + 0.7 * v(p.toco) - 0.4 * v(p.faltas) - v(p.err);
}

export function lideresDaRodada(jogos) {
  const todos = [];
  for (const j of jogos) {
    for (const lado of ['casa', 'visitante']) {
      for (const p of j[lado].jogadores || []) todos.push({ ...p, time: j[lado], jogo: j.id, tres_feitas: feitas(p.tres) });
    }
  }
  if (!todos.length) return null;
  const top = (k) => [...todos].sort((a, b) => b[k] - a[k] || b.pts - a.pts)[0];
  const destaque = [...todos].sort((a, b) => b.pts + b.reb + b.ast + b.rb + b.toco - (a.pts + a.reb + a.ast + a.rb + a.toco))[0];
  const decisivos = [...todos]
    .map((p) => ({ ...p, gs: gameScore(p) }))
    .sort((a, b) => b.gs - a.gs)
    .slice(0, 6);
  return {
    destaque,
    decisivos,
    categorias: [
      { rotulo: 'Pontos', sigla: 'PTS', p: top('pts'), valor: (p) => p.pts },
      { rotulo: 'Rebotes', sigla: 'REB', p: top('reb'), valor: (p) => p.reb },
      { rotulo: 'Assistências', sigla: 'AST', p: top('ast'), valor: (p) => p.ast },
      { rotulo: 'Bolas de três', sigla: '3P', p: top('tres_feitas'), valor: (p) => p.tres },
      { rotulo: 'Tocos', sigla: 'TOC', p: top('toco'), valor: (p) => p.toco },
      { rotulo: 'Roubos', sigla: 'RB', p: top('rb'), valor: (p) => p.rb },
    ],
  };
}

// Entrada do power ranking semanal: classificação + últimos 5 resultados de cada time
export function entradaPower() {
  const idx = lerJson(path.join(RAIZ, 'data', 'times', 'index.json'));
  const pasta = path.join(RAIZ, 'content', 'power-ranking');
  const anteriores = fs.existsSync(pasta) ? fs.readdirSync(pasta).filter((f) => f.endsWith('.json')).sort() : [];
  const anterior = anteriores.length ? lerJson(path.join(pasta, anteriores.at(-1))) : null;
  const times = [];
  for (const conf of ['Leste', 'Oeste']) {
    for (const l of idx?.classificacao?.[conf] || []) {
      const t = lerJson(path.join(RAIZ, 'data', 'times', `${l.sigla}.json`));
      const ult = (t?.jogos || []).filter((j) => j.finalizado).slice(-5).map((j) => `${j.resultado} ${j.placar.time}-${j.placar.adversario} ${j.em_casa ? 'vs' : '@'} ${j.adversario?.sigla}`);
      times.push({ sigla: l.sigla, time: t?.nome_curto, conferencia: conf, posicao_conferencia: l.posicao, campanha: `${l.v}-${l.d}`, sequencia: l.sequencia, ultimos_10: l.ultimos10, saldo_por_jogo: l.saldo, ultimos_5_jogos: ult, posicao_no_ranking_anterior: anterior?.ranking?.find((r) => r.time === l.sigla)?.posicao ?? null });
    }
  }
  return { tipo: 'power_ranking', dados: { times, fonte: 'ESPN' }, contexto: { ranking_anterior_em: anterior?.escrito_em || null } };
}
