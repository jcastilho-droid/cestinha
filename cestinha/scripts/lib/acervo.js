// Biblioteca reutilizavel de identidades: 30 escudos e um destaque por equipe.
// Usada pela geracao de arquivos e pelo carrossel. Nenhuma API paga.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './util.js';

export const PASTA_ACERVO = path.join(RAIZ,'site','assets','identidade');
const ARQUIVO_CONFIG = path.join(RAIZ,'config','arte-times.json');
const config = JSON.parse(fs.readFileSync(ARQUIVO_CONFIG,'utf8'));
export const SIGLAS = Object.keys(config.times).sort();

export function normalizarNome(v) {
  return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
}
export function escolherDestaque(time) {
  if (!time || !Array.isArray(time.elenco) || !time.elenco.length) return null;
  const pref = config.times[time.sigla];
  const elenco = time.elenco.filter(p=>/^\d+$/.test(String(p.id)) && p.nome);
  const fixo = pref && elenco.find(p=>String(p.id)===String(pref.id) &&
    normalizarNome(p.nome)===normalizarNome(pref.jogador));
  if (fixo) return fixo;
  return elenco.sort((a,b)=>{
    const jogosA=Number(a.medias?.jogos||0), jogosB=Number(b.medias?.jogos||0);
    const ptsA=Number(a.medias?.pts||0), ptsB=Number(b.medias?.pts||0);
    const cargaA=(jogosA>=4?ptsA:ptsA*.5), cargaB=(jogosB>=4?ptsB:ptsB*.5);
    return cargaB-cargaA || jogosB-jogosA;
  })[0] || null;
}
export function caminhosDestaque(sigla,id) {
  if (!/^[A-Z]{2,5}$/.test(String(sigla)) || !/^\d+$/.test(String(id))) return null;
  return {
    escudo:path.join(PASTA_ACERVO,'escudos',sigla+'.svg'),
    jogador:path.join(PASTA_ACERVO,'jogadores',sigla+'-'+id+'.svg'),
    escudoUrl:'/assets/identidade/escudos/'+sigla+'.svg',
    jogadorUrl:'/assets/identidade/jogadores/'+sigla+'-'+id+'.svg'
  };
}
const esc = s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const corValida = (s,fallback)=>/^#[0-9a-f]{6}$/i.test(s||'') ? s : fallback;
const versao = arquivo => { try {return '?v='+fs.statSync(arquivo).size;}catch{return '';} };
const url = (raiz,pathAbs,pathUrl) => fs.existsSync(pathAbs) ? raiz+pathUrl+versao(pathAbs) : '';
const hash = s=>{let v=2166136261;for(const ch of String(s)){v^=ch.charCodeAt(0);v=Math.imul(v,16777619);}return v>>>0;};
function mencoesDoTime(time,titulo){
  const tx=' '+normalizarNome(titulo)+' ';
  if (!time?.elenco || !titulo) return [];
  return time.elenco.filter(p=>{
    const n=normalizarNome(p.nome);
    const partes=n.split(' ').filter(Boolean);
    const ultimo=partes.at(-1)||'';
    return n.length>4&&(tx.includes(' '+n+' ')||(ultimo.length>=6 && tx.includes(' '+ultimo+' ')));
  });
}
function informacaoEquipe(team,roster,titulo,raiz){
  if(!team?.sigla || !config.times[team.sigla])return null;
  const completo=roster||team;
  const jogador=escolherDestaque(completo);
  const m=caminhosDestaque(team.sigla,jogador?.id);
  const logoPath=path.join(PASTA_ACERVO,'escudos',team.sigla+'.svg');
  const logoLocal=url(raiz,logoPath,'/assets/identidade/escudos/'+team.sigla+'.svg');
  const logoOriginal=typeof team.logo==='string' && /^https:\/\/a\.espncdn\.com\//.test(team.logo) ? team.logo:'';
  const citados=mencoesDoTime(completo,titulo);
  const protagonistaDeOutro = citados.length>0 && !citados.some(p=>String(p.id)===String(jogador?.id));
  const jogadorLocal=(!protagonistaDeOutro&&m&&jogador)
    ? url(raiz,m.jogador,m.jogadorUrl) : '';
  return {sigla:team.sigla,cor:corValida(team.cor,'#ea7530'),
    logo:logoLocal||logoOriginal,
    jogador:jogadorLocal,
    nome:completo.nome||team.nome||team.sigla,
    nomeJogador:jogadorLocal?jogador.nome:''
  };
}
function imagem(arquivo,classe,alternativo,loading='lazy'){
  return arquivo ? '<img class="'+classe+'" src="'+esc(arquivo)+'" alt="'+esc(alternativo)+'" loading="'+loading+'" decoding="async" onerror="this.remove()">' : '';
}
export function montarAcervo({noticia,raiz='.',timesPorId}) {
  const resumo=String(noticia.tipo||'').includes('RODADA');
  const timeDe=base=>{
    if(!base)return null;
    return timesPorId?.get(String(base.id)) ||
      [...(timesPorId?.values()||[])].find(t=>t.sigla===base.sigla) || base;
  };
  const times = resumo
    ? (noticia.timesResumo||[]).slice(0,3).map(t=>informacaoEquipe(t,timeDe(t),'',raiz)).filter(Boolean)
    : [noticia.visitante,noticia.casa].map(t=>informacaoEquipe(t,timeDe(t),noticia.titulo,raiz)).filter(Boolean);
  if (!times.length) return '<div class="acervo-indisponivel"></div>';
  const seed=hash(noticia.arteId||noticia.href||noticia.titulo);
  const variacao=seed%4;
  const css='--collage-a:'+times[0].cor+';--collage-b:'+(times[1]?.cor||'#e47d32')+';';
  const distintivo=(t,side)=>{
    const classe='acervo-equipe acervo-equipe-'+side;
    return '<div class="'+classe+'">'+
      '<span class="acervo-papel"></span>'+
      imagem(t.logo,'acervo-escudo','Escudo do '+t.nome)+
      (t.jogador&&!resumo ? imagem(t.jogador,'acervo-atleta','Ilustracao editorial de '+t.nomeJogador) : '')+
    '</div>';
  };
  return '<div class="acervo-composicao acervo-var-'+variacao+(resumo?' acervo-resumo':' acervo-duelo')+
    '" data-acervo="1" style="'+css+'">'+
    '<span class="acervo-base"></span><span class="acervo-rasgo"></span>'+
    '<span class="acervo-manchas"></span><span class="acervo-reticula"></span>'+
    times.map((t,i)=>distintivo(t,i===0?'a':i===1?'b':'c')).join('')+
    '<span class="acervo-traco acervo-traco-1"></span><span class="acervo-traco acervo-traco-2"></span>'+
    '</div>';
}
