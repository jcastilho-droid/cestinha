// Cria artes permanentes dos escudos e de um atleta por equipe a partir dos dados ja coletados.
// Usa apenas o CDN da ESPN (sem servicos pagos). Cada arquivo SVG embute sua imagem fonte
// e uma moldura artistica de colagem / serigrafia, sem datas, numeros ou legendas novas.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAIZ, lerJson } from './lib/util.js';
import { SIGLAS, escolherDestaque, caminhosDestaque } from './lib/acervo.js';

const AQUI=fileURLToPath(import.meta.url);
const PASTA_TIMES=path.join(RAIZ,'data','times');
const CDN='https://a.espncdn.com';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const cor=(s,fallback)=>/^#[0-9a-f]{6}$/i.test(s||'')?s:fallback;
async function imagem(url) {
  if(typeof url!=='string'||!url.startsWith(CDN+'/'))throw new Error('Origem da imagem nao permitida');
  let last;
  for(let tentativa=0;tentativa<2;tentativa++){
    try{
      const resp=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'Cestinha/1.0'}});
      if(!resp.ok)throw new Error('HTTP '+resp.status);
      const mime=(resp.headers.get('content-type')||'').split(';')[0];
      if(!['image/png','image/jpeg','image/webp'].includes(mime))throw new Error('Mime nao permitido: '+mime);
      const buf=Buffer.from(await resp.arrayBuffer());
      if(buf.length<2000||buf.length>3_000_000)throw new Error('Tamanho inesperado');
      return 'data:'+mime+';base64,'+buf.toString('base64');
    }catch(e){last=e;}
  }
  throw last;
}
const padrao='<pattern id="pontos" width="13" height="13" patternUnits="userSpaceOnUse">'+
  '<circle cx="3" cy="4" r="1.6" fill="#1b2431" opacity=".35"/></pattern>'+
  '<pattern id="hatch" width="21" height="21" patternUnits="userSpaceOnUse">'+
  '<path d="M0 21L21 0" stroke="#eee5d6" stroke-width="2" opacity=".25"/></pattern>';
function svgEscudo(time,uri){
  const a=cor(time.cor,'#ed842b'),b=cor(time.cor_alt,'#131b25');
  const rasgo='M60 68L140 48 211 62 279 40 370 58 448 45 520 61 585 50 597 117 576 175 594 255 577 325 592 405 571 490 590 546 537 589 453 568 378 595 300 578 230 602 151 579 72 593 51 527 66 457 50 385 66 312 51 231 65 151Z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" role="img" aria-label="Escudo em colagem editorial do '+esc(time.nome)+'">'+
    '<defs>'+padrao+'<clipPath id="c"><path d="'+rasgo+'"/></clipPath></defs>'+
    '<path d="'+rasgo+'" fill="#e7dfce"/>'+
    '<g clip-path="url(#c)"><rect width="640" height="640" fill="'+b+'"/>'+
    '<path d="M-90 590 530 -50 730 100 120 730Z" fill="'+a+'" opacity=".8"/>'+
    '<path d="M-60 130 690 400 660 575 -80 293Z" fill="#eee3d2" opacity=".27"/>'+
    '<rect width="640" height="640" fill="url(#hatch)"/>'+
    '<circle cx="320" cy="310" r="222" fill="#101822" opacity=".91"/>'+
    '<circle cx="320" cy="310" r="208" fill="none" stroke="#f5ead7" stroke-width="9" opacity=".55"/>'+
    '<circle cx="320" cy="310" r="192" fill="url(#pontos)"/>'+
    '<image href="'+uri+'" x="110" y="116" width="420" height="402" preserveAspectRatio="xMidYMid meet"/>'+
    '<path d="M30 534 624 402" stroke="#efe7d8" stroke-width="13" opacity=".26"/></g></svg>';
}
function svgJogador(time,atleta,uri){
  const a=cor(time.cor,'#ed842b'),b=cor(time.cor_alt,'#1b2433');
  const rasgo='M75 113 135 93 202 111 283 88 354 109 429 97 512 119 548 176 530 237 551 313 529 384 551 457 534 516 561 606 525 694 447 685 376 709 311 687 238 712 157 684 86 689 60 629 75 545 51 474 76 401 50 325 69 248 53 174Z';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 760" role="img" aria-label="Colagem editorial do jogador '+esc(atleta.nome)+'">'+
    '<defs>'+padrao+'<clipPath id="c"><path d="'+rasgo+'"/></clipPath>'+
    '<filter id="poster" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values=".25"/>'+
    '<feComponentTransfer>'+
    '<feFuncR type="discrete" tableValues=".09 .23 .40 .55 .75 .93"/>'+
    '<feFuncG type="discrete" tableValues=".10 .24 .41 .58 .76 .92"/>'+
    '<feFuncB type="discrete" tableValues=".12 .26 .43 .61 .77 .92"/>'+
    '</feComponentTransfer></filter></defs>'+
    '<path d="'+rasgo+'" fill="#e7dcc9"/>'+
    '<g clip-path="url(#c)"><rect width="640" height="760" fill="'+b+'"/>'+
    '<path d="M-70 555 620 -20 730 170 20 790Z" fill="'+a+'" opacity=".84"/>'+
    '<path d="M-70 230 675 395 650 562 -50 427Z" fill="#e8dbca" opacity=".36"/>'+
    '<rect width="640" height="760" fill="url(#pontos)"/>'+
    '<path d="M35 105 609 608 M42 340 619 264" stroke="#f0e5d3" stroke-width="19" opacity=".24"/>'+
    '<image href="'+uri+'" x="21" y="34" width="598" height="715" preserveAspectRatio="xMidYMax meet" filter="url(#poster)"/>'+
    '<path d="M20 671 625 612" stroke="#e77c29" stroke-width="13" opacity=".8"/>'+
    '<rect width="640" height="760" fill="url(#hatch)" opacity=".36"/></g></svg>';
}
export async function gerarAcervo({dryRun=process.argv.includes('--dry-run')}={}){
  let escudos=0,jogadores=0,falhas=0;
  for(const sigla of SIGLAS){
    const time=lerJson(path.join(PASTA_TIMES,sigla+'.json'));
    if(!time){console.warn('[acervo] falta time '+sigla);continue;}
    const destaque=escolherDestaque(time);
    if(!destaque){console.warn('[acervo] '+sigla+' sem jogador validado');continue;}
    const caminho=caminhosDestaque(sigla,destaque.id);
    if(!caminho)continue;
    const faltaEscudo=!fs.existsSync(caminho.escudo);
    const faltaJogador=!fs.existsSync(caminho.jogador);
    if(!faltaEscudo&&!faltaJogador)continue;
    if(dryRun){console.log('[simulacao] '+sigla+': escudo='+faltaEscudo+', jogador='+destaque.nome+' ('+destaque.id+')='+faltaJogador);continue;}
    if(faltaEscudo){
      try{
        const img=await imagem(time.logo);
        fs.mkdirSync(path.dirname(caminho.escudo),{recursive:true});
        fs.writeFileSync(caminho.escudo,svgEscudo(time,img));
        escudos++;
      }catch(e){falhas++;console.warn('[acervo] escudo '+sigla+': '+e.message);}
    }
    if(faltaJogador){
      try{
        const img=await imagem(CDN+'/i/headshots/nba/players/full/'+destaque.id+'.png');
        fs.mkdirSync(path.dirname(caminho.jogador),{recursive:true});
        fs.writeFileSync(caminho.jogador,svgJogador(time,destaque,img));
        jogadores++;
      }catch(e){falhas++;console.warn('[acervo] jogador '+sigla+': '+e.message);}
    }
  }
  console.log('[acervo] '+escudos+' escudos e '+jogadores+' jogadores novos; '+falhas+' falhas de download.');
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    '\nAcervo Cestinha: '+escudos+' novos escudos, '+jogadores+' jogadores; '+falhas+' falhas de origem.\n');
}
if(process.argv[1] && path.resolve(process.argv[1])===AQUI) await gerarAcervo();
