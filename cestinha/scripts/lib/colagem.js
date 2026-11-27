// Cestinha: artes vetoriais editoriais originais, uma por noticia.
// Nao usa fotografias, imagens realistas, arquivos repetidos ou IA externa.
const e = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const hash = v => { let h = 2166136261; for (const c of String(v)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const paleta = (v, fallback) => /^#[a-f0-9]{6}$/i.test(v || '') ? v : fallback;
const escolher = (titulo, resumo) => {
  const t = String(titulo || '').toLowerCase();
  if (resumo) return {nome:'NOITE NBA', numero:'09', sub:'RODADA', esporte:'JOGOS', pose:3};
  if (t.includes('wembanyama')) return {nome:'WEMBY', numero:'44', sub:'PONTOS', esporte:'SAS / POR', pose:0};
  if (t.includes('lebron')) return {nome:'LEBRON', numero:'3X', sub:'TRIPLO-DUPLO', esporte:'PHI / MIA', pose:1};
  if (t.includes('knicks') || t.includes('alvarado')) return {nome:'NEW YORK', numero:'06', sub:'SEGUIDAS', esporte:'NYK / CLE', pose:2};
  if (t.includes('mcdaniels') || t.includes('timberwolves')) return {nome:'MINNESOTA', numero:'32', sub:'PONTOS', esporte:'MIN / OKC', pose:4};
  if (t.includes('sengun') || t.includes('rockets')) return {nome:'HOUSTON', numero:'23', sub:'DESTAQUE', esporte:'HOU / PHX', pose:1};
  const numero = t.match(/\b(\d{2,3})\b/);
  return {nome:'NA CESTINHA', numero:numero?.[1] || 'NBA', sub:'EM QUADRA', esporte:'BASQUETE', pose:hash(t)%5};
};
function atleta(x,y,scale,flip,camisa,pele,pose,selo,contorno) {
  const t = 'translate('+x+' '+y+') scale('+(flip ? -scale : scale)+' '+scale+')';
  const cabelo = pose === 1 ?
    "<path d='M91 63 Q89 20 121 16 Q157 5 182 39 L180 58 L160 35 L116 36 L102 68Z' fill='#15151b'/>" :
    pose === 2 ?
    "<path d='M88 66 Q76 30 105 18 Q158 -5 188 40 L182 61 L163 35 L112 39Z' fill='#161519'/><path d='M96 43 Q134 30 179 43' fill='none' stroke='#e6d6bf' stroke-width='8'/>" :
    pose === 4 ?
    "<path d='M89 68 Q83 23 121 11 Q161 2 183 43 L177 67Z' fill='#17161e'/><path d='M91 40 Q72 73 81 102 M106 29 Q97 77 106 99 M164 30 Q176 74 183 100' fill='none' stroke='#1a171c' stroke-width='13'/>" :
    "<path d='M89 70 Q80 34 97 21 Q111 -7 152 6 Q179 0 189 30 L177 57 L165 28 L137 23 L114 34 L100 66Z' fill='#16161b'/>"+
    "<circle cx='99' cy='18' r='13' fill='#1a1820'/><circle cx='123' cy='9' r='14' fill='#15151a'/><circle cx='144' cy='9' r='13' fill='#19181d'/><circle cx='167' cy='19' r='14' fill='#171519'/>";
  const barba = pose === 1 ?
    "<path d='M104 90 Q113 125 139 132 Q166 124 173 95 Q152 119 137 109 Q119 116 104 90Z' fill='#181619' opacity='.9'/>" :
    pose === 2 ? "<path d='M114 108 Q136 123 161 108' stroke='#17151c' stroke-width='8' fill='none'/>" : "";
  const mao = pose === 2 ? 'M190 153 Q260 175 286 232' :
    pose === 4 ? 'M190 153 Q260 140 297 80' :
    pose === 1 ? 'M190 153 Q258 140 279 115' : 'M190 153 Q244 98 258 16';
  const bx = pose === 2 ? 290 : pose === 4 ? 304 : pose === 1 ? 281 : 264;
  const by = pose === 2 ? 244 : pose === 4 ? 75 : pose === 1 ? 113 : 12;
  return "<g transform='"+t+"' stroke-linejoin='round' stroke-linecap='round'>"+
    "<path d='M74 161 Q24 162 8 252' fill='none' stroke='"+contorno+"' stroke-width='40'/>"+
    "<path d='M74 161 Q24 162 8 252' fill='none' stroke='"+pele+"' stroke-width='29'/>"+
    "<path d='"+mao+"' fill='none' stroke='"+contorno+"' stroke-width='39'/>"+
    "<path d='"+mao+"' fill='none' stroke='"+pele+"' stroke-width='27'/>"+
    "<path d='M78 289 L55 384 L97 401 L130 310 L172 405 L214 384 L191 281Z' fill='"+camisa+"' stroke='"+contorno+"' stroke-width='8'/>"+
    "<path d='M63 155 Q90 132 110 137 L146 139 Q166 127 192 154 L209 291 Q145 320 65 287 Z' fill='"+camisa+"' stroke='"+contorno+"' stroke-width='9'/>"+
    "<path d='M67 165 Q94 152 108 159' fill='none' stroke='#f1e8d7' stroke-width='7' opacity='.7'/>"+
    "<path d='M149 140 Q169 152 198 167' fill='none' stroke='#f1e8d7' stroke-width='7' opacity='.7'/>"+
    "<path d='M84 220 L186 208 M83 245 L197 232' fill='none' stroke='#000000' stroke-width='5' opacity='.25'/>"+
    "<path d='M113 136 L118 111 L154 109 L157 145' fill='"+pele+"' stroke='"+contorno+"' stroke-width='7'/>"+
    "<path d='M92 59 Q93 17 133 14 Q175 18 179 60 L171 103 Q149 133 120 117 Q95 101 92 59 Z' fill='"+pele+"' stroke='"+contorno+"' stroke-width='7'/>"+
    cabelo+barba+
    "<path d='M116 70 L127 65 M148 64 L162 68' stroke='#211a19' stroke-width='5' fill='none'/>"+
    "<path d='M139 70 L133 88 L143 91 M123 100 Q139 107 159 100' stroke='#38241e' stroke-width='4' fill='none'/>"+
    "<path d='M105 62 Q104 80 114 98' stroke='#f1d0a0' stroke-width='5' opacity='.42' fill='none'/>"+
    "<text x='137' y='219' text-anchor='middle' fill='#f2e9db' font-family='Impact,Arial Black,sans-serif' font-size='30' font-weight='900' letter-spacing='1'>"+e(selo)+"</text>"+
    "<path d='M126 230 L145 237 L129 252' fill='none' stroke='#fff' stroke-width='4' opacity='.7'/>"+
    "<circle cx='"+bx+"' cy='"+by+"' r='33' fill='#d97724' stroke='#1a1717' stroke-width='7'/>"+
    "<path d='M"+(bx-29)+" "+by+" Q"+bx+" "+(by-11)+" "+(bx+31)+" "+by+" M"+bx+" "+(by-32)+" Q"+(bx-17)+" "+by+" "+bx+" "+(by+32)+" M"+bx+" "+(by-32)+" Q"+(bx+17)+" "+by+" "+bx+" "+(by+32)+"' stroke='#262023' stroke-width='4' fill='none'/>"+
    "</g>";
}
export function colagemEditorial(item, indice=0) {
  const resumo = String(item.tipo).includes('RODADA');
  const info = escolher(item.titulo, resumo);
  const seed = hash((item.arteId || item.href || '')+'|'+item.titulo);
  const id = 'ce'+seed.toString(16);
  const c1 = paleta(item.cor1, '#ef7929');
  const c2 = paleta(item.cor2, '#33588f');
  const cor = [c1,c2,'#ea6e24','#ede4d6'][seed%4];
  const papel = ['#e8decd','#eee5d8','#dfd7ca'][seed%3];
  const pele = ['#a05c3b','#c27a51','#965334','#b66b42'][seed%4];
  const p = info.pose;
  const second = resumo ? atleta(490,150,.64,true,'#153b79','#76482c',1,'NBA','#f1e9d8') : '';
  const fgX = resumo ? 286 : [334,339,304,352,310][p];
  const fgY = resumo ? 118 : [109,134,119,117,129][p];
  const camisa = resumo ? '#202027' : ['#202026','#284c9a','#17418b','#302f39','#173e59'][p];
  const equipe = resumo ? 'NBA' : ['SA','PHI','NY','NBA','MIN'][p];
  const fig = atleta(fgX,fgY,resumo ? .88 : 1.02,p===2,camisa,pele,p,equipe,'#f3eadb');
  const esquinas = [30,57,18,62,39][p];
  const team = e(item.legenda || info.esporte);
  return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 780 520' preserveAspectRatio='xMidYMid slice' role='img' aria-label='Colagem editorial ilustrada de "+e(info.nome)+"'>"+
    "<defs><pattern id='"+id+"dots' width='13' height='13' patternUnits='userSpaceOnUse'><circle cx='3' cy='4' r='2.1' fill='#e9e0cd' opacity='.8'/></pattern>"+
    "<pattern id='"+id+"scr' width='11' height='9' patternUnits='userSpaceOnUse'><path d='M0 9 L11 0' stroke='#d4ccba' stroke-width='1.5' opacity='.28'/></pattern>"+
    "<linearGradient id='"+id+"dark' x1='0' x2='1' y1='0' y2='1'><stop stop-color='#15171c'/><stop offset='.57' stop-color='#111822'/><stop offset='1' stop-color='#24212b'/></linearGradient>"+
    "<filter id='"+id+"paper'><feTurbulence type='fractalNoise' baseFrequency='.035' numOctaves='2' seed='"+(seed%45+1)+"' result='n'/><feColorMatrix in='n' type='saturate' values='0'/><feComponentTransfer><feFuncA type='linear' slope='.12'/></feComponentTransfer></filter></defs>"+
    "<rect width='780' height='520' fill='url(#"+id+"dark)'/>"+
    "<path d='M275 -42 L779 5 L781 480 L355 542 L300 486 L336 435 L296 394 L333 346 L290 289 L325 244 L292 182 L317 120Z' fill='"+papel+"'/>"+
    "<path d='M325 -45 L790 -25 L790 528 L710 553 L358 525Z' fill='"+c2+"' opacity='.26'/>"+
    "<path d='M340 -20 L480 10 L429 103 L542 158 L445 267 L528 302 L443 413 L509 526 L304 520 L327 457 L275 397 L325 318 L283 252 L334 179 L298 109Z' fill='#171b23'/>"+
    "<path d='M486 -20 L535 32 L465 106 L532 165 L442 257 L534 315 L458 392 L523 476 L467 550' fill='none' stroke='"+cor+"' stroke-width='43' opacity='.75'/>"+
    "<path d='M8 427 L340 384 L379 451 L26 512Z' fill='"+c1+"' opacity='.84'/>"+
    "<path d='M0 465 L380 419 L348 453 L0 503Z' fill='#ecdfca' opacity='.78'/>"+
    "<path d='M"+esquinas+" 0 L295 28 L245 100 L12 93Z' fill='"+c1+"' opacity='.75'/>"+
    "<path d='M8 12 L268 70 L240 79 L20 38' fill='none' stroke='#181b21' stroke-width='9'/>"+
    "<rect x='0' y='0' width='780' height='520' fill='url(#"+id+"scr)' opacity='.6'/>"+
    "<path d='M0 0H780V520H0Z' filter='url(#"+id+"paper)' opacity='.52'/>"+
    "<circle cx='706' cy='108' r='90' fill='url(#"+id+"dots)' opacity='.75'/>"+
    "<circle cx='86' cy='404' r='108' fill='url(#"+id+"dots)' opacity='.72'/>"+
    "<g opacity='.35' transform='translate(510 44) rotate(15)'><text x='0' y='0' fill='#15171e' font-family='Impact,Arial Black,sans-serif' font-size='188' font-weight='900'>"+e(info.numero)+"</text></g>"+
    "<g opacity='.24'>"+atleta(555,131,.7,true,'#d9cbbc','#5a4e48',3,'CE','#f3e6d5')+"</g>"+
    second+fig+
    "<path d='M0 361 L780 230' stroke='"+c1+"' stroke-width='6' opacity='.7'/>"+
    "<path d='M0 378 L780 247' stroke='"+papel+"' stroke-width='3' opacity='.6'/>"+
    "<g transform='translate(37 158) rotate(-6)'><text x='0' y='0' fill='"+papel+"' font-family='Impact,Arial Black,sans-serif' font-size='55' font-weight='900' letter-spacing='1'>"+e(info.nome)+"</text>"+
    "<text x='1' y='120' fill='"+c1+"' font-family='Impact,Arial Black,sans-serif' font-size='145' font-weight='900'>"+e(info.numero)+"</text>"+
    "<text x='4' y='151' fill='"+papel+"' font-family='Arial,sans-serif' font-size='20' font-weight='900' letter-spacing='5'>"+e(info.sub)+"</text></g>"+
    "<path d='M28 28 L178 19 L178 49 L27 62Z' fill='#111620' stroke='"+papel+"' stroke-width='2'/>"+
    "<text x='41' y='46' fill='"+papel+"' font-family='Arial,sans-serif' font-size='19' font-weight='900' letter-spacing='3'>CESTINHA</text>"+
    "<path d='M530 457 L754 438 L749 477 L537 498Z' fill='#151820' stroke='"+papel+"' stroke-width='2'/>"+
    "<text x='640' y='474' text-anchor='middle' fill='"+papel+"' font-family='Arial,sans-serif' font-size='17' font-weight='900' letter-spacing='2'>"+team+"</text>"+
    "</svg>";
}
