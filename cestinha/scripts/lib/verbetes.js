// "Me explica essa NBA": verbetes fixos + exemplos reais tirados dos dados (sem IA).
// Para editar um verbete, mude o texto aqui. Os exemplos são recalculados a cada publicação.
// Campos: id (âncora), termo, cat (categoria), curta (dica ao passar o mouse), texto (Markdown),
// alias (formas que viram link nos textos do site), exemplo (nome da função abaixo), veja (ids relacionados).
import path from 'node:path';
import { P, RAIZ, lerJson, listarDiasRaw, dataCurta } from './util.js';
import { lerRodada, lerJogo, gameScore } from './dados.js';

export const CATEGORIAS = ['Estatísticas', 'Em quadra', 'Tabela e temporada', 'Mercado e contratos', 'Do Cestinha'];

export const VERBETES = [
  // ---------- Estatísticas ----------
  { id: 'pontos-rebotes-assistencias', termo: 'Pontos, rebotes e assistências', cat: 'Estatísticas',
    curta: 'As três estatísticas básicas de todo box score.',
    texto: '**Pontos** são as cestas que o jogador marcou. **Rebote** é pegar a bola depois de um arremesso errado: na defesa (rebote defensivo) ou no ataque, ganhando uma nova chance (rebote ofensivo). **Assistência** é o passe que leva direto a uma cesta.\n\nNo Cestinha, a linha aparece sempre assim: **32 pts, 11 reb, 8 ast**.',
    alias: [], exemplo: 'cestinhaDaRodada', veja: ['duplo-duplo', 'triplo-duplo', 'game-score'] },
  { id: 'duplo-duplo', termo: 'Duplo-duplo', cat: 'Estatísticas',
    curta: '10 ou mais em duas estatísticas no mesmo jogo.',
    texto: 'Quando o jogador chega a **10 ou mais em duas estatísticas** no mesmo jogo, normalmente pontos e rebotes ou pontos e assistências. Para pivôs, é quase rotina; para armadores, mostra que o cara pontuou e ainda fez o time jogar.',
    alias: ['duplo-duplo', 'duplos-duplos'], exemplo: 'duplosDuplos', veja: ['triplo-duplo', 'pontos-rebotes-assistencias'] },
  { id: 'triplo-duplo', termo: 'Triplo-duplo', cat: 'Estatísticas',
    curta: '10 ou mais em três estatísticas no mesmo jogo.',
    texto: 'O jogador chega a **10 ou mais em três estatísticas** no mesmo jogo, quase sempre pontos, rebotes e assistências. É raro e sinal de que ele fez de tudo em quadra.',
    alias: ['triplo-duplo', 'triplos-duplos'], exemplo: 'triploDuplo', veja: ['duplo-duplo', 'game-score'] },
  { id: 'game-score', termo: 'Game Score', cat: 'Estatísticas',
    curta: 'Nota de desempenho de John Hollinger: soma o que o jogador produziu e desconta erros.',
    texto: 'Índice criado pelo analista **John Hollinger** para resumir uma atuação em um número. Soma pontos, rebotes, assistências, roubos e tocos e **desconta** arremessos errados, lances livres perdidos, faltas e desperdícios de bola.\n\nA conta: pontos + 0,4 × cestas − 0,7 × arremessos tentados − 0,4 × lances livres errados + 0,7 × rebotes ofensivos + 0,3 × rebotes defensivos + roubos + 0,7 × assistências + 0,7 × tocos − 0,4 × faltas − desperdícios.\n\nComo régua aproximada: 10 é um jogo correto, 20 é muito bom e 30 ou mais é atuação de gala. É ele que escolhe **Os decisivos da noite** na página inicial.',
    alias: ['Game Score'], exemplo: 'gameScoreTop', veja: ['pontos-rebotes-assistencias', 'notas-do-cestinha'] },
  { id: 'aproveitamento', termo: 'Aproveitamento nos arremessos', cat: 'Estatísticas',
    curta: 'Quantos arremessos o jogador acertou do total que tentou.',
    texto: 'Quando você lê **12 de 18**, quer dizer 12 cestas em 18 tentativas, ou 67%. Vale para arremessos de quadra, bolas de três e lances livres. Pontuar muito com aproveitamento baixo é sinal de que o jogador precisou de muitas bolas para chegar lá.',
    alias: ['aproveitamento nos arremessos'], exemplo: 'melhorAproveitamentoTime', veja: ['bola-de-tres', 'lance-livre', 'eficiencia-ofensiva'] },
  { id: 'bola-de-tres', termo: 'Bola de três', cat: 'Estatísticas',
    curta: 'Arremesso de trás da linha dos 3 pontos (7,24 m da cesta).',
    texto: 'Arremesso feito de trás da linha dos 3 pontos, que fica a **7,24 m** da cesta (nos cantos, a **6,71 m**). Vale três pontos. A NBA de hoje arremessa de três como nunca: é a arma que mais muda placar rápido.',
    alias: ['bola de três', 'bolas de três'], exemplo: 'maisBolasDeTres', veja: ['aproveitamento', 'lance-livre'] },
  { id: 'lance-livre', termo: 'Lance livre', cat: 'Estatísticas',
    curta: 'Arremesso sem marcação, valendo 1 ponto, depois de uma falta.',
    texto: 'Arremesso cobrado da linha a **4,57 m** da cesta, sem ninguém marcando. Cada acerto vale **1 ponto**. Acontece depois de faltas: quem sofre falta arremessando ganha 2 ou 3 lances livres, conforme o arremesso tentado.',
    alias: ['lance livre', 'lances livres'], exemplo: 'maisLancesLivres', veja: ['aproveitamento', 'bola-de-tres'] },
  { id: 'toco', termo: 'Toco', cat: 'Estatísticas',
    curta: 'Quando o defensor bloqueia o arremesso do adversário.',
    texto: 'O defensor desvia ou bloqueia o arremesso do adversário. É a jogada que mais levanta a torcida na defesa, e um número alto de tocos costuma mostrar um protetor de aro dominante.',
    alias: ['toco', 'tocos'], exemplo: 'maisTocos', veja: ['roubo-de-bola', 'garrafao'] },
  { id: 'roubo-de-bola', termo: 'Roubo de bola', cat: 'Estatísticas',
    curta: 'Quando o defensor tira a bola do ataque adversário.',
    texto: 'O defensor intercepta um passe ou tira a bola da mão de quem está atacando. Muitos roubos viram **contra-ataque** e pontos fáceis. No Cestinha aparece como **rb**.',
    alias: ['roubo de bola', 'roubos de bola'], exemplo: 'maisRoubos', veja: ['contra-ataque', 'desperdicio'] },
  { id: 'desperdicio', termo: 'Desperdício de bola (turnover)', cat: 'Estatísticas',
    curta: 'Quando o ataque perde a posse sem arremessar.',
    texto: 'O time perde a bola sem conseguir arremessar: passe errado, bola pisada na linha, andada, falta de ataque. Em inglês, **turnover**. Cada desperdício é uma posse jogada fora, e o adversário costuma aproveitar.',
    alias: ['turnover', 'turnovers'], exemplo: null, veja: ['roubo-de-bola', 'eficiencia-ofensiva'] },
  { id: 'mais-menos', termo: 'Mais/menos (+/-)', cat: 'Estatísticas',
    curta: 'Saldo de pontos do time enquanto o jogador estava em quadra.',
    texto: 'Mostra o **saldo do placar enquanto o jogador estava em quadra**. Um +15 quer dizer que, com ele jogando, o time fez 15 pontos a mais que o adversário. É útil, mas depende muito de quem estava jogando junto.',
    alias: ['mais/menos'], exemplo: 'melhorMaisMenos', veja: ['saldo-de-pontos'] },
  { id: 'eficiencia-ofensiva', termo: 'Eficiência ofensiva', cat: 'Estatísticas',
    curta: 'Pontos que o time marca a cada 100 posses de bola.',
    texto: 'Mede **quantos pontos o time faz a cada 100 posses de bola**. Serve para comparar ataques de forma justa: um time que joga rápido tem mais posses e faz mais pontos, mas não necessariamente é melhor.\n\nAs posses podem ser estimadas pelo box score: arremessos tentados − rebotes ofensivos + desperdícios + 0,44 × lances livres tentados. A **eficiência defensiva** é a mesma conta, para os pontos sofridos.',
    alias: ['eficiência ofensiva', 'eficiência defensiva'], exemplo: 'eficienciaRodada', veja: ['aproveitamento', 'desperdicio'] },
  { id: 'saldo-de-pontos', termo: 'Saldo de pontos', cat: 'Estatísticas',
    curta: 'Pontos marcados menos pontos sofridos, em média por jogo.',
    texto: 'A diferença entre os pontos que o time marca e os que sofre, em média por jogo. Muitas vezes conta mais sobre a força real do time do que a campanha, porque mostra se as vitórias são folgadas ou no sufoco.',
    alias: ['saldo de pontos'], exemplo: 'melhorSaldo', veja: ['mais-menos', 'eficiencia-ofensiva'] },

  // ---------- Em quadra ----------
  { id: 'garrafao', termo: 'Garrafão', cat: 'Em quadra',
    curta: 'A área pintada embaixo da cesta.',
    texto: 'A área pintada embaixo da cesta. É onde ficam os pivôs, onde saem os rebotes e as bandejas. Um atacante não pode ficar mais de **3 segundos** parado ali, e a defesa também tem limite para ficar plantada no garrafão sem marcar ninguém.',
    alias: ['garrafão'], exemplo: 'pontosNoGarrafao', veja: ['toco', 'pick-and-roll'] },
  { id: 'pick-and-roll', termo: 'Pick-and-roll', cat: 'Em quadra',
    curta: 'Jogada em que um jogador faz o bloqueio e corre para a cesta.',
    texto: 'A jogada mais usada da NBA. Um companheiro para ao lado do marcador de quem está com a bola (o **bloqueio**, ou *pick*) e depois corre em direção à cesta (o *roll*). Quem tem a bola escolhe: arremessar, infiltrar ou passar para quem rolou.',
    alias: ['pick-and-roll'], exemplo: null, veja: ['garrafao', 'pontos-rebotes-assistencias'] },
  { id: 'contra-ataque', termo: 'Contra-ataque', cat: 'Em quadra',
    curta: 'Ataque rápido, antes de a defesa se arrumar.',
    texto: 'Quando o time recupera a bola e ataca rápido, antes de a defesa adversária voltar e se organizar. Costuma nascer de um roubo de bola ou de um rebote defensivo.',
    alias: ['contra-ataque', 'contra-ataques'], exemplo: 'maisContraAtaque', veja: ['roubo-de-bola', 'desperdicio'] },
  { id: 'prorrogacao', termo: 'Prorrogação', cat: 'Em quadra',
    curta: 'Tempo extra de 5 minutos quando o jogo termina empatado.',
    texto: 'O jogo da NBA tem quatro quartos de 12 minutos. Se terminar empatado, vem uma **prorrogação de 5 minutos**, e quantas mais forem necessárias até alguém vencer. Na NBA não existe empate.',
    alias: ['prorrogação', 'prorrogações'], exemplo: 'ultimaProrrogacao', veja: ['clutch'] },
  { id: 'back-to-back', termo: 'Back-to-back', cat: 'Em quadra',
    curta: 'Dois jogos em dias seguidos.',
    texto: 'Quando o time joga **dois dias seguidos**, muitas vezes em cidades diferentes. O cansaço pesa, e é comum o técnico poupar titulares no segundo jogo.',
    alias: ['back-to-back'], exemplo: 'backToBack', veja: ['temporada-regular'] },
  { id: 'clutch', termo: 'Clutch', cat: 'Em quadra',
    curta: 'Os minutos decisivos de um jogo apertado.',
    texto: 'Nas estatísticas da NBA, **clutch** são os **últimos 5 minutos** de um jogo com diferença de **5 pontos ou menos**. Jogador "clutch" é o que resolve nessa hora.',
    alias: ['clutch'], exemplo: null, veja: ['prorrogacao'] },

  // ---------- Tabela e temporada ----------
  { id: 'conferencias', termo: 'Conferências e divisões', cat: 'Tabela e temporada',
    curta: 'A NBA tem 30 times em 2 conferências (Leste e Oeste) e 6 divisões.',
    texto: 'Os **30 times** se dividem em duas conferências, **Leste** e **Oeste**, com 15 times cada. Cada conferência tem três divisões de cinco times. A classificação que vale para os playoffs é a da conferência.',
    alias: ['Conferência Leste', 'Conferência Oeste'], exemplo: 'lideresConferencias', veja: ['playoffs', 'play-in'] },
  { id: 'temporada-regular', termo: 'Temporada regular', cat: 'Tabela e temporada',
    curta: 'A fase de classificação: 82 jogos para cada time.',
    texto: 'Vai de outubro a abril, com **82 jogos** para cada time (41 em casa e 41 fora). Ela define quem vai direto aos playoffs, quem disputa o play-in e quem fica de fora.',
    alias: ['temporada regular'], exemplo: 'andamentoTemporada', veja: ['play-in', 'playoffs'] },
  { id: 'play-in', termo: 'Play-in', cat: 'Tabela e temporada',
    curta: 'Repescagem do 7º ao 10º de cada conferência pelas duas últimas vagas.',
    texto: 'Uma repescagem antes dos playoffs. Em cada conferência, o **7º enfrenta o 8º**: quem vence fica com a 7ª vaga. O **9º enfrenta o 10º**: quem perde está fora. Depois, o perdedor de 7º x 8º encara o vencedor de 9º x 10º pela **8ª vaga**.',
    alias: ['play-in'], exemplo: 'zonaPlayIn', veja: ['playoffs', 'conferencias'] },
  { id: 'playoffs', termo: 'Playoffs', cat: 'Tabela e temporada',
    curta: 'O mata-mata: 16 times, séries de melhor de 7 jogos.',
    texto: 'O mata-mata que define o campeão. **16 times**, oito de cada conferência: os seis primeiros vão direto e os outros dois saem do play-in. São quatro fases, todas em **séries de melhor de 7** (ganha quem vencer 4 jogos), até as Finais da NBA.',
    alias: ['playoffs', 'mata-mata'], exemplo: 'zonaPlayoffs', veja: ['play-in', 'conferencias'] },
  { id: 'sequencia', termo: 'Sequência', cat: 'Tabela e temporada',
    curta: 'Vitórias ou derrotas seguidas.',
    texto: 'Quantas vitórias ou derrotas o time tem em seguida. Na tabela aparece como **V3** (três vitórias seguidas) ou **D2** (duas derrotas seguidas).',
    alias: ['vitórias seguidas', 'derrotas seguidas'], exemplo: 'maiorSequencia', veja: ['saldo-de-pontos'] },
  { id: 'nba-cup', termo: 'NBA Cup', cat: 'Tabela e temporada',
    curta: 'Torneio disputado dentro da temporada, com final em dezembro.',
    texto: 'Torneio criado em 2023 e jogado no meio da temporada regular. A fase de grupos acontece em novembro, em noites específicas, e os jogos contam na tabela normal. Depois vem o mata-mata em dezembro. Só a **final não conta** para a classificação.',
    alias: ['NBA Cup', 'Copa da NBA'], exemplo: null, veja: ['temporada-regular'] },
  { id: 'tanking', termo: 'Tanking', cat: 'Tabela e temporada',
    curta: 'Quando um time fraco perde de propósito pensando no draft.',
    texto: 'Gíria para quando um time sem chance de playoffs prioriza jovens e poupa titulares, aceitando perder mais. O objetivo é terminar entre os piores e ter mais chances de uma escolha alta no **draft**. A liga já mudou regras para desestimular isso.',
    alias: ['tanking'], exemplo: null, veja: ['draft'] },

  // ---------- Mercado e contratos ----------
  { id: 'teto-salarial', termo: 'Teto salarial', cat: 'Mercado e contratos',
    curta: 'Limite de gastos com salários de cada time, que pode ser ultrapassado com exceções.',
    texto: 'Limite para a soma dos salários de cada time. Na NBA, é um teto **flexível**: dá para passar dele usando exceções, como renovar com os próprios jogadores (os chamados **direitos de Bird**). O valor muda a cada temporada, conforme a receita da liga.',
    alias: ['teto salarial', 'salary cap'], exemplo: null, veja: ['imposto-de-luxo', 'agente-livre'] },
  { id: 'imposto-de-luxo', termo: 'Imposto de luxo e "aprons"', cat: 'Mercado e contratos',
    curta: 'Multa para quem gasta muito acima do teto, com punições extras nos "aprons".',
    texto: 'Quem passa de uma linha bem acima do teto paga o **imposto de luxo** (*luxury tax*), uma multa proporcional ao excesso. Acima dele ficam o **primeiro** e o **segundo apron**, limites que o acordo coletivo de 2023 deixou bem mais rígidos: quem passa deles perde ferramentas de troca e contratação. É por isso que times muito caros acabam desmontando o elenco.',
    alias: ['imposto de luxo', 'luxury tax', 'apron'], exemplo: null, veja: ['teto-salarial'] },
  { id: 'two-way', termo: 'Contrato two-way', cat: 'Mercado e contratos',
    curta: 'Contrato que divide o jogador entre o time da NBA e o da G League.',
    texto: 'Contrato especial para jovens: o jogador fica entre o time da NBA e o time afiliado na **G League** (a liga de desenvolvimento), com limite de jogos pela NBA. Cada time pode ter até **três** jogadores assim.',
    alias: ['two-way'], exemplo: null, veja: ['draft'] },
  { id: 'agente-livre', termo: 'Agente livre', cat: 'Mercado e contratos',
    curta: 'Jogador sem contrato, livre para negociar.',
    texto: 'O jogador cujo contrato acabou (*free agent*). O **irrestrito** pode assinar com quem quiser. O **restrito** pode receber ofertas, mas o time atual tem o direito de igualar a proposta e mantê-lo.',
    alias: ['agente livre', 'free agent', 'free agency'], exemplo: null, veja: ['teto-salarial'] },
  { id: 'draft', termo: 'Draft e loteria', cat: 'Mercado e contratos',
    curta: 'O recrutamento anual de novos jogadores, em duas rodadas.',
    texto: 'O recrutamento anual de novos jogadores, em **duas rodadas**. Os 14 times que ficaram fora dos playoffs entram na **loteria**, que sorteia as quatro primeiras escolhas. Os três piores têm a maior chance (14% cada) de ficar com a escolha número 1.',
    alias: ['draft', 'loteria do draft'], exemplo: 'piores', veja: ['tanking', 'two-way'] },

  // ---------- Do Cestinha ----------
  { id: 'notas-do-cestinha', termo: 'Notas do Cestinha', cat: 'Do Cestinha',
    curta: 'Nota de 0 a 10 dada pelo Cestinha a quem decidiu o jogo.',
    texto: 'Em cada resenha, o Cestinha dá **notas de 0 a 10** para os jogadores que decidiram a partida. É opinião, mas sempre baseada nos números do jogo. Para uma medida sem opinião, olhe o Game Score.',
    alias: ['Notas do Cestinha'], exemplo: null, veja: ['game-score'] },
  { id: 'power-ranking', termo: 'Power ranking', cat: 'Do Cestinha',
    curta: 'O ranking semanal de opinião, do melhor ao pior time.',
    texto: 'Toda segunda-feira o Cestinha ordena os 30 times **do mais forte ao mais fraco naquele momento**. Diferente da tabela, leva em conta a fase, o saldo e os últimos resultados. A setinha mostra quem subiu e quem caiu.',
    alias: ['power ranking'], exemplo: null, veja: ['saldo-de-pontos', 'sequencia'] },
  { id: 'jogo-da-noite', termo: 'Jogo da noite', cat: 'Do Cestinha',
    curta: 'A recomendação diária: se você só puder assistir a um jogo, é esse.',
    texto: 'Todo dia, um programa dá pontos para cada jogo da noite: **briga na tabela**, **boa fase**, **duelo de estrelas**, **brasileiro em quadra** e **clássico**. O Cestinha recebe os três primeiros, escolhe um e explica por quê. Os selos mostram os motivos da escolha.',
    alias: ['jogo da noite'], exemplo: null, veja: ['sequencia', 'conferencias'] },
  { id: 'selos-de-status', termo: 'Confirmado, reportado e rumor', cat: 'Do Cestinha',
    curta: 'O selo que diz o quanto uma informação é certa.',
    texto: '**CONFIRMADO**: anunciado pelo time, pela liga ou por fonte oficial, como um resultado de jogo. **REPORTADO**: noticiado por jornalista reconhecido, mas ainda não oficial. **RUMOR**: especulação, publicada só quando relevante e sempre avisada.',
    alias: [], exemplo: null, veja: [] },
];

// ---------- exemplos reais ----------
const num = (x, casas = 1) => Number(x).toFixed(casas).replace('.', ',');
const pa = (s) => String(s || '0-0').split('-').map(Number);

function ultimaRodadaCompleta() {
  for (const dia of listarDiasRaw().reverse()) {
    const r = lerRodada(dia);
    if (!r) continue;
    const jogos = r.jogos.filter((b) => b.status === 'final').map((b) => lerJogo(dia, b.id)).filter((j) => j?.casa?.jogadores);
    if (jogos.length) return { dia, jogos };
  }
  return null;
}
function jogadoresDe(jogos) {
  return jogos.flatMap((j) => [[j.casa, j.visitante], [j.visitante, j.casa]].flatMap(([t, adv]) => t.jogadores.map((p) => ({ ...p, time: t.nome_curto, adv: adv.nome_curto }))));
}
const melhor = (lista, f) => lista.filter((p) => f(p) > 0).sort((a, b) => f(b) - f(a))[0];

function indice() { return lerJson(path.join(RAIZ, 'data', 'times', 'index.json')); }
function nomeTime(sigla) { return (indice()?.times || []).find((t) => t.sigla === sigla)?.nome_curto || sigla; }
function tabela() {
  const idx = indice();
  return idx?.classificacao || null;
}

const EXEMPLOS = {
  cestinhaDaRodada(ctx) {
    const p = melhor(ctx.jog, (x) => x.pts); if (!p) return null;
    return `Na rodada de ${ctx.data}, o cestinha foi **${p.nome}** (${p.time}), com ${p.pts} pts, ${p.reb} reb, ${p.ast} ast contra o ${p.adv}.`;
  },
  duplosDuplos(ctx) {
    const dd = ctx.jog.filter((p) => [p.pts, p.reb, p.ast, p.rb, p.toco].filter((v) => v >= 10).length >= 2);
    if (!dd.length) return `Ninguém fez duplo-duplo na rodada de ${ctx.data}.`;
    const top = dd.sort((a, b) => (b.pts + b.reb + b.ast) - (a.pts + a.reb + a.ast))[0];
    return `Na rodada de ${ctx.data}, foram **${dd.length} duplos-duplos**. Um deles: ${top.nome} (${top.time}), com ${top.pts} pts, ${top.reb} reb, ${top.ast} ast.`;
  },
  triploDuplo() {
    for (const dia of listarDiasRaw().reverse()) {
      const r = lerRodada(dia); if (!r) continue;
      const jogos = r.jogos.map((b) => lerJogo(dia, b.id)).filter((j) => j?.casa?.jogadores);
      const td = jogadoresDe(jogos).find((p) => [p.pts, p.reb, p.ast, p.rb, p.toco].filter((v) => v >= 10).length >= 3);
      if (td) return `O triplo-duplo mais recente que registramos: **${td.nome}** (${td.time}), com ${td.pts} pts, ${td.reb} reb, ${td.ast} ast contra o ${td.adv}, em ${dataCurta(dia)}.`;
    }
    return null;
  },
  gameScoreTop(ctx) {
    const p = melhor(ctx.jog, gameScore); if (!p) return null;
    return `Maior Game Score da rodada de ${ctx.data}: **${p.nome}** (${p.time}), com **${num(gameScore(p))}** (${p.pts} pts, ${p.reb} reb, ${p.ast} ast, ${p.fg} nos arremessos).`;
  },
  melhorAproveitamentoTime() {
    const ts = (indice()?.times || []).map((b) => lerJson(path.join(RAIZ, 'data', 'times', `${b.sigla}.json`))).filter((t) => t?.estatisticas?.fg_pct);
    const t = ts.sort((a, b) => Number(b.estatisticas.fg_pct) - Number(a.estatisticas.fg_pct))[0];
    return t ? `Melhor aproveitamento nos arremessos da temporada até agora: **${t.nome_curto}**, com ${num(t.estatisticas.fg_pct)}% (${num(t.estatisticas.tres_pct)}% nas bolas de três).` : null;
  },
  maisBolasDeTres(ctx) {
    const p = melhor(ctx.jog, (x) => pa(x.tres)[0]); if (!p) return null;
    return `Na rodada de ${ctx.data}, quem mais acertou de três foi **${p.nome}** (${p.time}): ${pa(p.tres)[0]} em ${pa(p.tres)[1]} tentativas.`;
  },
  maisLancesLivres(ctx) {
    const p = melhor(ctx.jog, (x) => pa(x.ll)[0]); if (!p) return null;
    return `Na rodada de ${ctx.data}, quem mais converteu lances livres foi **${p.nome}** (${p.time}): ${pa(p.ll)[0]} de ${pa(p.ll)[1]}.`;
  },
  maisTocos(ctx) {
    const p = melhor(ctx.jog, (x) => x.toco); if (!p) return null;
    return `Na rodada de ${ctx.data}, o rei dos tocos foi **${p.nome}** (${p.time}), com ${p.toco} contra o ${p.adv}.`;
  },
  maisRoubos(ctx) {
    const p = melhor(ctx.jog, (x) => x.rb); if (!p) return null;
    return `Na rodada de ${ctx.data}, quem mais roubou bolas foi **${p.nome}** (${p.time}), com ${p.rb}.`;
  },
  melhorMaisMenos(ctx) {
    const p = melhor(ctx.jog, (x) => x.mais_menos); if (!p) return null;
    return `Na rodada de ${ctx.data}, o melhor +/- foi de **${p.nome}** (${p.time}): **+${p.mais_menos}** em ${p.min} minutos contra o ${p.adv}.`;
  },
  eficienciaRodada(ctx) {
    const lista = ctx.jogos.flatMap((j) => [j.casa, j.visitante].map((t) => {
      const fga = t.jogadores.reduce((s, p) => s + pa(p.fg)[1], 0);
      const fta = t.jogadores.reduce((s, p) => s + pa(p.ll)[1], 0);
      const oreb = t.jogadores.reduce((s, p) => s + (p.reb_of || 0), 0);
      const tov = t.jogadores.reduce((s, p) => s + (p.err || 0), 0);
      const posses = fga - oreb + tov + 0.44 * fta;
      return { time: t.nome_curto, pts: t.placar, posses, ef: posses ? (100 * t.placar) / posses : 0 };
    })).filter((x) => x.posses > 0);
    const t = lista.sort((a, b) => b.ef - a.ef)[0];
    return t ? `Melhor ataque da rodada de ${ctx.data}: **${t.time}**, com ${t.pts} pontos em cerca de ${Math.round(t.posses)} posses, ou **${num(t.ef)} pontos por 100 posses** (estimativa pelo box score).` : null;
  },
  melhorSaldo() {
    const c = tabela(); if (!c) return null;
    const t = [...(c.Leste || []), ...(c.Oeste || [])].sort((a, b) => Number(b.saldo) - Number(a.saldo))[0];
    return t ? `Melhor saldo da liga hoje: **${nomeTime(t.sigla)}**, com ${t.saldo.replace('.', ',')} por jogo (${t.pontos_pro.replace('.', ',')} marcados e ${t.pontos_contra.replace('.', ',')} sofridos).` : null;
  },
  pontosNoGarrafao(ctx) {
    const t = ctx.jogos.flatMap((j) => [j.casa, j.visitante]).filter((x) => x.estatisticas?.pontos_garrafao).sort((a, b) => Number(b.estatisticas.pontos_garrafao) - Number(a.estatisticas.pontos_garrafao))[0];
    return t ? `Na rodada de ${ctx.data}, quem mais pontuou no garrafão foi o **${t.nome_curto}**: ${t.estatisticas.pontos_garrafao} pontos lá dentro.` : null;
  },
  maisContraAtaque(ctx) {
    const t = ctx.jogos.flatMap((j) => [j.casa, j.visitante]).filter((x) => x.estatisticas?.pontos_contra_ataque).sort((a, b) => Number(b.estatisticas.pontos_contra_ataque) - Number(a.estatisticas.pontos_contra_ataque))[0];
    return t ? `Na rodada de ${ctx.data}, o time que mais castigou no contra-ataque foi o **${t.nome_curto}**: ${t.estatisticas.pontos_contra_ataque} pontos.` : null;
  },
  ultimaProrrogacao() {
    for (const dia of listarDiasRaw().reverse()) {
      const r = lerRodada(dia); if (!r) continue;
      for (const b of r.jogos) {
        const j = lerJogo(dia, b.id);
        if (j?.prorrogacoes > 0 && j.status === 'final') return `O jogo mais recente com prorrogação que registramos: **${j.visitante.nome_curto} ${j.visitante.placar} x ${j.casa.placar} ${j.casa.nome_curto}**, em ${dataCurta(dia)}${j.prorrogacoes > 1 ? `, com ${j.prorrogacoes} prorrogações` : ''}.`;
      }
    }
    return 'Nenhum dos jogos que registramos nos últimos dias foi para a prorrogação.';
  },
  backToBack() {
    const ag = lerJson(path.join(RAIZ, 'data', 'agenda.json'));
    const dias = new Map();
    for (const j of ag?.jogos || []) for (const t of [j.casa, j.visitante]) {
      if (!dias.has(t.sigla)) dias.set(t.sigla, { nome: t.nome_curto, d: new Set() });
      dias.get(t.sigla).d.add(j.data_rodada);
    }
    const casos = [];
    for (const { nome, d } of dias.values()) {
      const lista = [...d].sort();
      for (let i = 1; i < lista.length; i++) if ((Date.parse(lista[i]) - Date.parse(lista[i - 1])) === 864e5) { casos.push(`${nome} (${dataCurta(lista[i - 1])} e ${dataCurta(lista[i])})`); break; }
    }
    return casos.length ? `Na agenda dos próximos dias, têm back-to-back: ${casos.slice(0, 4).join(', ')}.` : null;
  },
  lideresConferencias() {
    const c = tabela(); if (!c) return null;
    const l = c.Leste?.[0]; const o = c.Oeste?.[0];
    return l && o ? `Hoje, quem lidera o Leste é o **${nomeTime(l.sigla)}** (${l.v}-${l.d}) e quem lidera o Oeste é o **${nomeTime(o.sigla)}** (${o.v}-${o.d}).` : null;
  },
  andamentoTemporada() {
    const c = tabela(); if (!c) return null;
    const jogos = [...(c.Leste || []), ...(c.Oeste || [])].map((t) => t.v + t.d);
    const media = jogos.reduce((s, x) => s + x, 0) / Math.max(1, jogos.length);
    return `Até agora, cada time jogou em média **${Math.round(media)} dos 82 jogos**. Ainda tem muita temporada pela frente.`;
  },
  zonaPlayIn() {
    const c = tabela(); if (!c) return null;
    const f = (conf) => (c[conf] || []).slice(6, 10).map((t) => `${t.posicao}º ${nomeTime(t.sigla)}`).join(', ');
    return `Se a temporada acabasse hoje, iriam ao play-in no Leste: ${f('Leste')}. No Oeste: ${f('Oeste')}.`;
  },
  zonaPlayoffs() {
    const c = tabela(); if (!c) return null;
    const f = (conf) => (c[conf] || []).slice(0, 6).map((t) => nomeTime(t.sigla)).join(', ');
    return `Se a temporada acabasse hoje, iriam direto aos playoffs no Leste: ${f('Leste')}. No Oeste: ${f('Oeste')}.`;
  },
  maiorSequencia() {
    const c = tabela(); if (!c) return null;
    const v = [...(c.Leste || []), ...(c.Oeste || [])].filter((t) => /^W\d+$/.test(t.sequencia)).sort((a, b) => Number(b.sequencia.slice(1)) - Number(a.sequencia.slice(1)))[0];
    return v ? `A maior sequência de vitórias em andamento é do **${nomeTime(v.sigla)}**: ${v.sequencia.slice(1)} seguidas.` : null;
  },
  piores() {
    const c = tabela(); if (!c) return null;
    const p = [...(c.Leste || []), ...(c.Oeste || [])].sort((a, b) => (a.v / Math.max(1, a.v + a.d)) - (b.v / Math.max(1, b.v + b.d))).slice(0, 3);
    return `Hoje, as três piores campanhas da liga são de ${p.map((t) => `${nomeTime(t.sigla)} (${t.v}-${t.d})`).join(', ')}. Se terminarem assim, terão as maiores chances na loteria.`;
  },
};

export function exemplosReais() {
  const r = ultimaRodadaCompleta();
  const ctx = r ? { data: dataCurta(r.dia), jogos: r.jogos, jog: jadoresSeguro(r.jogos) } : null;
  const out = {};
  for (const v of VERBETES) {
    if (!v.exemplo || !EXEMPLOS[v.exemplo]) continue;
    try {
      const precisaRodada = EXEMPLOS[v.exemplo].length > 0;
      if (precisaRodada && !ctx) continue;
      const txt = EXEMPLOS[v.exemplo](ctx);
      if (txt) out[v.id] = txt;
    } catch { /* exemplo é bônus: se falhar, o verbete sai sem ele */ }
  }
  return out;
}
function jadoresSeguro(jogos) { return jogadoresDe(jogos); }
