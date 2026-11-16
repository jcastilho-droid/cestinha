// Fonte: ESPN (endpoints públicos, sem chave).
// Este é o ÚNICO arquivo que conhece o formato da ESPN.
// Se a ESPN mudar ou quebrar, troque só este módulo: ele precisa continuar
// devolvendo jogos no "formato Cestinha" (veja normalizarJogo abaixo).

const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';

async function pegarJson(url, tentativas = 3) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36', Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status} em ${url}`);
      return await r.json();
    } catch (e) {
      ultimoErro = e;
      await new Promise((ok) => setTimeout(ok, 2000 * (i + 1)));
    }
  }
  throw ultimoErro;
}

// data no formato AAAA-MM-DD (data da rodada no fuso dos EUA, como a ESPN usa)
export async function buscarPlacar(data) {
  return pegarJson(`${BASE}/scoreboard?dates=${data.replaceAll('-', '')}`);
}

export async function buscarDetalhe(idJogo) {
  return pegarJson(`${BASE}/summary?event=${idJogo}`);
}

// ---------- Normalização (funções puras, sem rede) ----------

const STATUS = { pre: 'agendado', in: 'em_andamento', post: 'final' };

export function listarJogos(placar) {
  return (placar.events || []).map((ev) => {
    const comp = ev.competitions[0];
    const t = ev.status?.type || {};
    let status = STATUS[t.state] || 'desconhecido';
    if (/POSTPONED|CANCELED|SUSPENDED/.test(t.name || '')) status = 'adiado';
    const time = (c) => ({
      id: c.team.id,
      sigla: c.team.abbreviation,
      nome: c.team.displayName,
      nome_curto: c.team.shortDisplayName || c.team.name,
      logo: c.team.logo,
      cor: c.team.color ? `#${c.team.color}` : null,
      placar: c.score != null && c.score !== '' ? Number(c.score) : null,
      campanha: (c.records || []).find((r) => r.type === 'total')?.summary || null,
    });
    const casa = comp.competitors.find((c) => c.homeAway === 'home');
    const fora = comp.competitors.find((c) => c.homeAway === 'away');
    return {
      id: String(ev.id),
      inicio_utc: ev.date,
      status,
      periodo: ev.status?.period ?? null,
      casa: time(casa),
      visitante: time(fora),
    };
  });
}

const CAMPOS = {
  MIN: 'min', PTS: 'pts', FG: 'fg', '3PT': 'tres', FT: 'll', REB: 'reb', AST: 'ast',
  TO: 'err', STL: 'rb', BLK: 'toco', OREB: 'reb_of', DREB: 'reb_def', PF: 'faltas', '+/-': 'mais_menos',
};
const NUMERICOS = new Set(['min', 'pts', 'reb', 'ast', 'err', 'rb', 'toco', 'reb_of', 'reb_def', 'faltas', 'mais_menos']);

function lerJogadores(bloco) {
  const st = bloco.statistics?.[0];
  if (!st) return { jogadores: [], nao_jogaram: [] };
  const labels = st.labels || st.names || [];
  const jogadores = [];
  const nao_jogaram = [];
  for (const a of st.athletes || []) {
    const nome = a.athlete?.displayName;
    if (a.didNotPlay || !a.stats || a.stats.length === 0) {
      nao_jogaram.push({ nome, motivo: a.reason || null });
      continue;
    }
    const j = { nome, titular: !!a.starter };
    labels.forEach((lab, i) => {
      const campo = CAMPOS[lab];
      if (!campo) return;
      const v = a.stats[i];
      j[campo] = NUMERICOS.has(campo) ? (v === '' || v == null || isNaN(Number(v)) ? null : Number(v)) : v;
    });
    if (a.ejected) j.expulso = true;
    jogadores.push(j);
  }
  return { jogadores, nao_jogaram };
}

function lerEstatisticasTime(t) {
  const m = {};
  for (const s of t.statistics || []) m[s.name] = s.displayValue;
  return {
    fg: m['fieldGoalsMade-fieldGoalsAttempted'] ?? null,
    fg_pct: m.fieldGoalPct ?? null,
    tres: m['threePointFieldGoalsMade-threePointFieldGoalsAttempted'] ?? null,
    tres_pct: m.threePointFieldGoalPct ?? null,
    ll: m['freeThrowsMade-freeThrowsAttempted'] ?? null,
    reb: m.totalRebounds ?? null,
    ast: m.assists ?? null,
    err: m.totalTurnovers ?? m.turnovers ?? null,
    pontos_garrafao: m.pointsInPaint ?? null,
    pontos_contra_ataque: m.fastBreakPoints ?? null,
    maior_vantagem: m.largestLead ?? null,
  };
}

// Junta o item do placar (listarJogos) com o detalhe (summary) num jogo completo.
export function normalizarJogo(jogoBase, detalhe, dataRodada) {
  const jogo = structuredClone(jogoBase);
  jogo.fonte = 'ESPN';
  jogo.link_fonte = `https://www.espn.com/nba/game/_/gameId/${jogo.id}`;
  jogo.data_rodada = dataRodada;

  const box = detalhe.boxscore || {};
  for (const lado of ['casa', 'visitante']) {
    const t = jogo[lado];
    const bp = (box.players || []).find((p) => String(p.team?.id) === String(t.id));
    const bt = (box.teams || []).find((p) => String(p.team?.id) === String(t.id));
    const { jogadores, nao_jogaram } = bp ? lerJogadores(bp) : { jogadores: [], nao_jogaram: [] };
    t.jogadores = jogadores;
    t.nao_jogaram = nao_jogaram;
    t.estatisticas = bt ? lerEstatisticasTime(bt) : null;
  }

  // Parciais por quarto vêm do header do summary
  const comps = detalhe.header?.competitions?.[0]?.competitors || [];
  for (const c of comps) {
    const lado = c.homeAway === 'home' ? 'casa' : 'visitante';
    jogo[lado].parciais = (c.linescores || []).map((l) => Number(l.displayValue ?? l.value));
    if (c.record) {
      const tot = c.record.find?.((r) => r.type === 'total');
      if (tot?.summary) jogo[lado].campanha = tot.summary;
    }
    if (c.winner != null) jogo[lado].vencedor = !!c.winner;
  }
  const nPer = Math.max(jogo.casa.parciais?.length || 0, jogo.visitante.parciais?.length || 0);
  jogo.prorrogacoes = Math.max(0, nPer - 4);
  if (jogo.casa.vencedor == null && jogo.status === 'final') {
    jogo.casa.vencedor = jogo.casa.placar > jogo.visitante.placar;
    jogo.visitante.vencedor = !jogo.casa.vencedor;
  }

  // Local
  const v = detalhe.gameInfo?.venue;
  jogo.local = v ? [v.fullName, v.address?.city].filter(Boolean).join(', ') : null;

  // Série (temporada regular ou playoffs)
  const serie = (detalhe.seasonseries || [])[0];
  jogo.serie = serie ? { tipo: serie.type, resumo_en: serie.summary || null } : null;
  jogo.temporada = detalhe.header?.season ? { ano: detalhe.header.season.year, tipo: detalhe.header.season.type } : null;

  // Últimos lances que valeram ponto (para achar o "momento-chave")
  const plays = detalhe.plays || [];
  jogo.lances_finais = plays
    .filter((p) => p.scoringPlay)
    .slice(-10)
    .map((p) => ({
      periodo: p.period?.number ?? null,
      relogio: p.clock?.displayValue ?? null,
      lance_en: p.text,
      placar: `${p.awayScore}-${p.homeScore}`,
    }));
  jogo.trocas_de_lideranca = (box.teams || [])
    .map((t) => (t.statistics || []).find((s) => s.name === 'leadChanges')?.displayValue)
    .find((x) => x != null) ?? null;

  // Classificação das divisões dos dois times
  jogo.classificacao_divisao = (detalhe.standings?.groups || []).map((g) => ({
    grupo_en: g.header,
    times: (g.standings?.entries || []).map((e) => {
      const m = {};
      for (const s of e.stats || []) m[s.name] = s.displayValue ?? s.summary;
      return { time: e.team, v: m.wins, d: m.losses, atras: m.gamesBehind, sequencia: m.streak };
    }),
  }));

  // Manchete da matéria da ESPN (em inglês, só como referência de fonte)
  if (detalhe.article?.headline) {
    jogo.materia_fonte = {
      titulo_en: detalhe.article.headline,
      resumo_en: (detalhe.article.description || '').replace(/^[—\s-]+/, '').slice(0, 600) || null,
      link: detalhe.article.links?.web?.href || null,
    };
  }
  return jogo;
}
