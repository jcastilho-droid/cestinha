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

// ---------- Times (elenco, estatísticas, calendário, classificação) ----------
const BASE_WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';

export async function buscarListaTimes() {
  return pegarJson(`${BASE}/teams`);
}
export async function buscarTime(id) {
  return pegarJson(`${BASE}/teams/${id}`);
}
export async function buscarElenco(id) {
  return pegarJson(`${BASE}/teams/${id}/roster`);
}
export async function buscarCalendario(id) {
  return pegarJson(`${BASE}/teams/${id}/schedule`);
}
export async function buscarEstatisticasTime(id) {
  return pegarJson(`${BASE}/teams/${id}/statistics`);
}
export async function buscarClassificacao() {
  return pegarJson('https://site.api.espn.com/apis/v2/sports/basketball/nba/standings');
}
export async function buscarEstatisticasJogadores() {
  return pegarJson(`${BASE_WEB}/statistics/byathlete?region=us&lang=en&contentorigin=espn&isqualified=false&page=1&limit=1000&sort=offensive.avgPoints:desc`);
}

const DIVISOES = { Atlantic: 'Atlântico', Central: 'Central', Southeast: 'Sudeste', Northwest: 'Noroeste', Pacific: 'Pacífico', Southwest: 'Sudoeste' };
const POSICOES = { PG: 'Armador', SG: 'Ala-armador', G: 'Armador', SF: 'Ala', F: 'Ala', PF: 'Ala-pivô', C: 'Pivô', 'G-F': 'Armador/ala', 'F-G': 'Ala/armador', 'F-C': 'Ala/pivô', 'C-F': 'Pivô/ala' };

function mapaStats(lista) {
  const m = {};
  for (const s of lista || []) m[s.name] = s.displayValue ?? s.summary ?? s.value;
  return m;
}

export function normalizarListaTimes(bruto) {
  return (bruto.sports?.[0]?.leagues?.[0]?.teams || []).map(({ team: t }) => {
    const logos = t.logos || [];
    const achar = (tem, naoTem = []) => logos.find((l) => tem.every((r) => (l.rel || []).includes(r)) && !naoTem.some((r) => (l.rel || []).includes(r)))?.href || null;
    return {
      id: String(t.id), sigla: t.abbreviation, nome: t.displayName, nome_curto: t.shortDisplayName || t.name,
      cidade: t.location, slug: t.slug,
      cor: t.color ? `#${t.color}` : null, cor_alt: t.alternateColor ? `#${t.alternateColor}` : null,
      logo: achar(['scoreboard'], ['dark']) || achar(['default']),
      logo_escuro: achar(['scoreboard', 'dark']) || achar(['dark']) || achar(['default']),
    };
  });
}

export function normalizarClassificacao(bruto) {
  const conf = {};
  for (const c of bruto.children || []) {
    const nome = /East/i.test(c.name) ? 'Leste' : 'Oeste';
    conf[nome] = (c.standings?.entries || []).map((e) => {
      const m = mapaStats(e.stats);
      return {
        id: String(e.team.id), sigla: e.team.abbreviation,
        posicao: Number(m.playoffSeed) || null, v: Number(m.wins), d: Number(m.losses),
        pct: m.winPercent, atras: m.gamesBehind, sequencia: m.streak,
        casa: m.Home, fora: m.Road, ultimos10: m['Last Ten Games'],
        pontos_pro: m.avgPointsFor, pontos_contra: m.avgPointsAgainst, saldo: m.differential,
      };
    }).sort((a, b) => (a.posicao ?? 99) - (b.posicao ?? 99));
  }
  return conf;
}

export function normalizarEstatisticasJogadores(bruto) {
  const cats = bruto.categories || [];
  const mapa = {};
  for (const a of bruto.athletes || []) {
    const v = {};
    for (const c of a.categories || []) {
      const nomes = cats.find((x) => x.name === c.name)?.names || [];
      nomes.forEach((n, i) => { v[n] = c.totals?.[i]; });
    }
    mapa[String(a.athlete.id)] = {
      jogos: Number(v.gamesPlayed) || 0, min: v.avgMinutes, pts: v.avgPoints, reb: v.avgRebounds, ast: v.avgAssists,
      rb: v.avgSteals, toco: v.avgBlocks, fg_pct: v.fieldGoalPct, tres_pct: v.threePointFieldGoalPct, ll_pct: v.freeThrowPct,
      duplos_duplos: Number(v.doubleDouble) || 0, triplos_duplos: Number(v.tripleDouble) || 0,
    };
  }
  return mapa;
}

export function normalizarTime(base, brutoTime, brutoElenco, brutoCalendario, brutoEstat, statsJogadores, classif) {
  const t = brutoTime.team || {};
  const m = /^(\d+)\w* in (\w+) Division/.exec(t.standingSummary || '');
  const elenco = (brutoElenco.athletes || []).map((a) => {
    const lesao = (a.injuries || [])[0];
    return {
      id: String(a.id), nome: a.displayName, numero: a.jersey ?? null,
      posicao: POSICOES[a.position?.abbreviation] || a.position?.displayName || null, posicao_sigla: a.position?.abbreviation || null,
      idade: a.age ?? null,
      altura_m: a.height ? (a.height * 0.0254).toFixed(2) : null,
      peso_kg: a.weight ? Math.round(a.weight * 0.4536) : null,
      experiencia: a.experience?.years ?? null,
      universidade: a.college?.name || null,
      pais: a.birthPlace?.country || null,
      lesao: lesao ? { status: lesao.status || null, tipo: lesao.details?.type || lesao.type?.description || null } : null,
      medias: statsJogadores[String(a.id)] || null,
    };
  }).sort((a, b) => (Number(b.medias?.pts) || 0) - (Number(a.medias?.pts) || 0));

  const jogos = (brutoCalendario.events || []).map((e) => {
    const c = e.competitions?.[0] || {};
    const eu = (c.competitors || []).find((x) => String(x.team?.id) === base.id);
    const adv = (c.competitors || []).find((x) => String(x.team?.id) !== base.id);
    const st = c.status?.type || {};
    const pl = (x) => (x?.score?.value ?? (x?.score != null && x.score !== '' ? Number(x.score) : null));
    return {
      id: String(e.id), data_utc: e.date,
      tipo: e.seasonType?.type ?? null,
      em_casa: eu?.homeAway === 'home',
      adversario: adv ? { id: String(adv.team.id), sigla: adv.team.abbreviation, nome_curto: adv.team.shortDisplayName || adv.team.name } : null,
      finalizado: !!st.completed,
      placar: st.completed ? { time: pl(eu), adversario: pl(adv) } : null,
      resultado: st.completed ? (eu?.winner ? 'V' : 'D') : null,
    };
  }).sort((a, b) => a.data_utc.localeCompare(b.data_utc));

  const est = {};
  for (const cat of brutoEstat.results?.stats?.categories || []) for (const s of cat.stats || []) est[s.name] = s.displayValue;
  const linha = [...(classif.Leste || []), ...(classif.Oeste || [])].find((x) => x.id === base.id) || null;
  const conferencia = (classif.Leste || []).some((x) => x.id === base.id) ? 'Leste' : 'Oeste';

  return {
    ...base,
    conferencia,
    classificacao: linha,
    divisao: m ? { nome: DIVISOES[m[2]] || m[2], posicao: Number(m[1]) } : null,
    tecnico: (brutoElenco.coach || [])[0] ? `${brutoElenco.coach[0].firstName} ${brutoElenco.coach[0].lastName}` : null,
    arena: t.franchise?.venue?.fullName || null,
    estatisticas: {
      pts: est.avgPoints ?? null, reb: est.avgRebounds ?? null, ast: est.avgAssists ?? null, rb: est.avgSteals ?? null,
      toco: est.avgBlocks ?? null, err: est.avgTurnovers ?? null,
      fg_pct: est.fieldGoalPct ?? null, tres_pct: est.threePointFieldGoalPct ?? null, ll_pct: est.freeThrowPct ?? null,
    },
    elenco,
    jogos,
    fonte: 'ESPN',
    link_fonte: `https://www.espn.com/nba/team/_/name/${String(base.sigla).toLowerCase()}`,
  };
}
