// Ilustracoes editoriais vetoriais de fallback. Sem fotos, avatares ou texto cortado.
// A arte fotografica-colagem, quando publicada, tem prioridade no gerador da home.
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'
}[c]));
const hash = s => {
  let h=2166136261;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h=Math.imul(h,16777619); }
  return h>>>0;
};
const validColor = (s,fallback) => /^#[a-f\d]{6}$/i.test(s || '') ? s : fallback;
function historia(titulo,resumo) {
  const t=String(titulo || '').toLowerCase();
  if(resumo) return ['NOITE NBA','09','JOGOS'];
  if(t.includes('wembanyama')) return ['WEMBY','44','PONTOS'];
  if(t.includes('lebron')) return ['LEBRON','3X','TRIPLO DUPLO'];
  if(t.includes('knicks') || t.includes('alvarado')) return ['NEW YORK','06','SEGUIDAS'];
  if(t.includes('mcdaniels') || t.includes('timberwolves')) return ['WOLVES','32','PONTOS'];
  if(t.includes('sengun') || t.includes('rockets')) return ['HOUSTON','23','DESTAQUE'];
  return ['DESTAQUE','NBA','BASQUETE'];
}
export function colagemEditorial(item) {
  const id='ce'+hash(item.arteId || item.titulo).toString(16);
  const [nome,numero,sub]=historia(item.titulo,String(item.tipo).includes('RODADA'));
  const c1=validColor(item.cor1,'#ff842d');
  const c2=validColor(item.cor2,'#3a536e');
  const seed=hash(item.arteId || item.titulo);
  const inset=(seed%3)*15;
  const siglas=esc(item.legenda || 'NBA');
  // 780x650 tem proporcao proxima ao banner real, com margem de seguranca.
  // "meet" impede cortes de marcas, numeros e grafismos no desktop e no celular.
  return "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 780 650' preserveAspectRatio='xMidYMid meet' role='img' aria-label='Colagem editorial de "+esc(nome)+"'>"+
    "<defs><pattern id='"+id+"halftone' width='14' height='14' patternUnits='userSpaceOnUse'><circle cx='4' cy='4' r='2.4' fill='#efe3d1' opacity='.64'/></pattern>"+
    "<pattern id='"+id+"grain' width='26' height='24' patternUnits='userSpaceOnUse'><path d='M0 24L26 0 M3 0L26 23' stroke='#ded4c0' stroke-width='1' opacity='.12'/></pattern>"+
    "<clipPath id='"+id+"rip'><path d='M95 30 L721 25 L748 63 L744 160 L762 204 L740 295 L759 340 L750 438 L766 574 L737 615 L150 605 L128 585 L111 537 L95 491 L119 423 L96 354 L124 292 L105 236 L127 171 Z'/></clipPath></defs>"+
    "<rect width='780' height='650' fill='#101720'/>"+
    "<path d='M30 92 L348 38 L392 130 L53 210Z' fill='"+c1+"'/>"+
    "<path d='M548 22 L755 42 L750 235 L706 219 L676 143Z' fill='"+c2+"'/>"+
    "<path d='M45 433 L350 350 L420 493 L61 564Z' fill='"+c2+"' opacity='.75'/>"+
    "<path d='M95 30 L721 25 L748 63 L744 160 L762 204 L740 295 L759 340 L750 438 L766 574 L737 615 L150 605 L128 585 L111 537 L95 491 L119 423 L96 354 L124 292 L105 236 L127 171Z' fill='#ede0ce' opacity='.94'/>"+
    "<g clip-path='url(#"+id+"rip)'>"+
      "<path d='M250 -25 L800 -40 L800 670 L165 665 L255 557 L205 442 L313 302 L231 177Z' fill='#181d25'/>"+
      "<path d='M"+(360+inset)+" -40 L720 -40 L322 625 L140 650Z' fill='"+c1+"' opacity='.82'/>"+
      "<path d='M585 -20 L780 -30 L580 620 L455 670Z' fill='"+c2+"'/>"+
      "<path d='M60 405 L740 198 L757 245 L62 456Z' fill='#0a101a'/>"+
      "<path d='M18 463 L742 255 L755 289 L38 509Z' fill='#ece3d3' opacity='.68'/>"+
      "<path d='M132 52 L730 52 L730 608 L132 608Z' fill='url(#"+id+"grain)'/>"+
      "<circle cx='584' cy='340' r='186' fill='#151a22' stroke='#efe1cc' stroke-width='7'/>"+
      "<circle cx='584' cy='340' r='167' fill='"+c2+"' opacity='.72'/>"+
      "<path d='M419 340 H750 M584 176 V502 M466 214 Q636 340 466 466 M702 214 Q532 340 702 466' fill='none' stroke='#e6d7c0' stroke-width='8' opacity='.74'/>"+
      "<circle cx='584' cy='340' r='100' fill='url(#"+id+"halftone)' opacity='.65'/>"+
      "<path d='M176 164 L525 148 L525 354 L178 370Z' fill='#0b1018' opacity='.94'/>"+
      "<path d='M177 390 L475 378 L470 480 L178 493Z' fill='#f0e3cd'/>"+
      "<text x='193' y='248' font-family='Impact,Arial Black,sans-serif' font-weight='900' font-size='"+(nome.length>9?38:49)+"' fill='#f0e4d5'>"+esc(nome)+"</text>"+
      "<text x='190' y='347' font-family='Impact,Arial Black,sans-serif' font-weight='900' font-size='122' fill='"+c1+"'>"+esc(numero)+"</text>"+
      "<text x='195' y='453' font-family='Arial,sans-serif' font-weight='900' font-size='30' fill='#17212a' letter-spacing='3'>"+esc(sub)+"</text>"+
      "<path d='M130 560 L650 520 L672 580 L140 618Z' fill='#111821'/>"+
      "<text x='164' y='581' font-family='Arial,sans-serif' font-size='22' font-weight='900' fill='#f3e8d6' letter-spacing='4'>"+siglas+"</text>"+
    "</g>"+
    "<rect x='44' y='41' width='232' height='54' rx='2' fill='#101720' stroke='#efe4d7' stroke-width='3'/>"+
    "<text x='60' y='79' font-family='Arial,sans-serif' font-size='31' font-weight='900' fill='#f8e7d0' letter-spacing='3'>CESTINHA</text>"+
    "<rect x='44' y='592' width='180' height='32' fill='"+c1+"' transform='rotate(-8 44 592)'/>"+
    "</svg>";
}
