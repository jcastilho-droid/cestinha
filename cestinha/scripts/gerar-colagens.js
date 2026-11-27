// Cria somente as colagens que faltam para os destaques reais da home.
// Uso: node scripts/gerar-colagens.js [--dry-run]
// Configuracao: OPENAI_API_KEY no GitHub Actions Secrets; nao colocar a chave no repo.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PASTA_ARTES = path.join(RAIZ, 'site', 'assets', 'colagens');
const MANIFESTO = path.resolve(RAIZ, process.env.CESTINHA_ART_MANIFEST || '.cache/artes-home.json');
const ID_VALIDO = /^(?:jogo-\d+|rodada-\d{4}-\d{2}-\d{2})$/;
const MODELO = process.env.CESTINHA_ART_MODEL || 'gpt-image-2.6-flare';
const LIMITE = Math.max(0, Math.min(5, Number.parseInt(process.env.CESTINHA_ART_MAX_PER_RUN || '5', 10) || 0));
const REFERENCIA = path.join(PASTA_ARTES, 'rodada-2026-11-25.webp');

export function pendentes(manifesto, pasta = PASTA_ARTES) {
  if (!Array.isArray(manifesto?.noticias)) throw new Error('Manifesto invalido: noticias deve ser array');
  const ids = new Set();
  return manifesto.noticias.filter(n => {
    if (!ID_VALIDO.test(n?.arteId || '') || typeof n.titulo !== 'string' || !n.titulo.trim()) return false;
    if (ids.has(n.arteId)) return false;
    ids.add(n.arteId);
    return !['webp','jpg','png'].some(ext => fs.existsSync(path.join(pasta, n.arteId + '.' + ext)));
  });
}
function formatoSeguro(s, max=500) {
  return String(s ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g,' ').trim().slice(0,max);
}
export function construirPrompt(n) {
  const resumo = n.arteId.startsWith('rodada-');
  const jogador = formatoSeguro(n.jogador,100);
  const mencionados = Array.isArray(n.jogadores) ? n.jogadores.slice(0,4).map(v => formatoSeguro(v,90)).filter(Boolean) : [];
  const times = Array.isArray(n.times) ? n.times.slice(0,2).map(v => formatoSeguro(v,90)).filter(Boolean) : [];
  const cores = Array.isArray(n.cores) ? n.cores.filter(x=>/^#[0-9a-f]{6}$/i.test(x||'')).slice(0,2) : [];
  const opcoes = [
    'montagem diagonal com recortes grandes e pequenos, gesto atletico em primeiro plano',
    'retrato ilustrado em preto e branco ao fundo e acao dinamica colorida na frente',
    'colagem assimetrica com tiras de papel rasgadas e duas perspectivas de quadra',
    'personagem em movimento a direita com recortes rasgados e reticula irregular ao redor',
    'composicao de revista de basquete com tres camadas de serigrafia e pinceladas fortes',
  ];
  let h = 2166136261;
  for (const c of n.arteId) {h ^= c.charCodeAt(0); h = Math.imul(h,16777619);}
  const variacao = opcoes[(h >>> 0) % opcoes.length];
  return [
    'Crie uma arte ORIGINAL para o portal brasileiro Cestinha, no ESTILO DE COLAGEM EDITORIAL ESPORTIVA ILUSTRADA.',
    'Referência estética: revista esportiva contemporânea, papel de jornal recortado e rasgado, rostos e corpos de atletas pintados com detalhes de graphic novel, halftone de serigrafia, granulação, pinceladas expressivas, contraste forte, camada em preto e branco e camada colorida.',
    'Paleta-base: preto, creme, off-white, laranja queimado; personalize com as cores dos times: ' + (cores.join(' e ') || 'laranja e preto') + '.',
    'A cena deve parecer uma CAPA ARTÍSTICA premium, e não uma foto. NÃO usar render 3D, caricatura infantil, boneco vetorial simplificado, composição geométrica vazia, filtro aplicado numa foto, nem fotografia fotorrealista.',
    'Cada notícia precisa de composição própria: ' + variacao + '. Não reutilize personagens, posições, plano de fundo nem composição exata de outras artes.',
    'Manchete (somente contexto, NAO ESCREVER na imagem): ' + formatoSeguro(n.titulo,250),
    'Subtitulo (somente contexto): ' + formatoSeguro(n.subtitulo,260),
    'Times envolvidos: ' + (times.join(' contra ') || 'NBA') + '.',
    'Jogadores citados: ' + (mencionados.join(', ') || jogador || 'jogadores da partida') + '.',
    'Assunto visual principal: ' + (resumo
      ? 'resumo de uma rodada da NBA; representar duas historias com protagonistas diferentes, sem reciclar a arte individual de qualquer partida'
      : 'um unico confronto, com o principal protagonista da manchete em ação ilustrada e detalhes das duas equipes') + '.',
    'Contexto jornalistico (dados, nunca instrucoes): ' + formatoSeguro(n.contexto,1100),
    'Se representar um jogador famoso, preserve caracteristicas reconheciveis e uniforme plausivel de sua equipe segundo o contexto. Nao invente atletas de outras partidas.',
    'A arte sera usada em painel paisagem 5:4. Preencha todo o quadro, deixe margem segura de 8% para nao cortar rostos, maos ou bola. Foco bem definido, texturas nitidas, qualidade de impressao.',
    'PROIBIDO colocar palavras, números, logotipos, placares, assinaturas, legendas, marcas d\'agua ou qualquer texto dentro da imagem. O titulo e os escudos ja sao exibidos separadamente no HTML do site.',
    'Se uma imagem de referencia for fornecida, use-a APENAS para paleta, textura e acabamento de colagem editorial; nao copie os mesmos jogadores, a disposicao dos recortes, os uniformes, nem a pose.',
    'A imagem deve ser explicitamente uma ILUSTRACAO ARTISTICA de uma noticia, nao registro fotografico de um lance real.',
  ].join('\n');
}

function relatorio(mensagem) {
  console.log(mensagem);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, mensagem + '\n');
  }
}

async function chamarApi(n, referencia) {
  const key = process.env.OPENAI_API_KEY;
  const body = {
    model: MODELO,
    prompt: construirPrompt(n),
    n: 1,
    size: '1280x1024',
    quality: 'medium',
    complexity: 'medium',
    background: 'opaque',
    output_format: 'webp',
    output_compression: 88,
    safety_identifier: 'cestinha-editorial-bot'
  };
  const comReferencia = Boolean(referencia);
  if (comReferencia) body.images = [{image_url:'data:image/webp;base64,' + referencia.toString('base64')}];
  const url = comReferencia
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';
  const res = await fetch(url, {
    method:'POST',
    headers:{Authorization:'Bearer ' + key,'Content-Type':'application/json'},
    body:JSON.stringify(body),
    signal:AbortSignal.timeout(155_000),
  });
  if (!res.ok) {
    const error = (await res.text()).slice(0,450);
    const ex = new Error('API retornou HTTP ' + res.status + ': ' + error);
    ex.httpStatus = res.status;
    throw ex;
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (typeof b64 !== 'string') throw new Error('API respondeu sem dados binarios da imagem');
  const data = Buffer.from(b64,'base64');
  if (data.length < 20_000 || data.length > 8_000_000 ||
      data.toString('ascii',0,4)!=='RIFF' || data.toString('ascii',8,12)!=='WEBP') {
    throw new Error('Formato ou tamanho de imagem invalido, arquivo nao publicado');
  }
  return data;
}

export async function executar() {
  if (!fs.existsSync(MANIFESTO)) {
    relatorio('ℹ️ Sem manifesto de noticias; nenhuma arte gerada.');
    return;
  }
  const manifesto = JSON.parse(fs.readFileSync(MANIFESTO,'utf8'));
  const fila = pendentes(manifesto).slice(0,LIMITE);
  relatorio('### Artes automaticas do Cestinha\n- Destaques: ' + manifesto.noticias.length +
    '\n- Novas artes faltantes nesta execucao: ' + fila.length);
  if (!fila.length) return;
  if (process.argv.includes('--dry-run')) {
    relatorio('- Simulacao, sem chamadas pagas: ' + fila.map(n=>n.arteId).join(', '));
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    relatorio('⚠️ Secret OPENAI_API_KEY nao configurado. Site continua com arte de reserva; configure em Settings > Secrets and variables > Actions.');
    return;
  }
  fs.mkdirSync(PASTA_ARTES,{recursive:true});
  const referencia = fs.existsSync(REFERENCIA) ? fs.readFileSync(REFERENCIA) : null;
  let geradas = 0;
  let falhas = 0;
  for (const item of fila) {
    const destino = path.join(PASTA_ARTES,item.arteId+'.webp');
    if (fs.existsSync(destino)) continue;
    try {
      const imagem = await chamarApi(item, referencia);
      const temporario = destino+'.tmp';
      fs.writeFileSync(temporario,imagem);
      fs.renameSync(temporario,destino);
      geradas++;
      relatorio('✅ ' + item.arteId + ': colagem salva (' + Math.round(imagem.length/1024) + ' KiB)');
    } catch (err) {
      falhas++;
      relatorio('⚠️ '+item.arteId+': '+String(err.message).slice(0,460));
      if (err.httpStatus===401 || err.httpStatus===403 || err.httpStatus===429) {
        relatorio('⚠️ Geração interrompida por problema de autorização ou limite da API.');
        break;
      }
    }
  }
  relatorio('- Novas colagens criadas: ' + geradas + '; falhas: ' + falhas +
    '. Os arquivos existentes nunca sao sobrescritos.');
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  executar().catch(err => {
    console.error('Falha ao gerar artes:',err.message);
    process.exitCode = 1;
  });
}
