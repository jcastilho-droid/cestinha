// Ícones próprios do Cestinha (SVG simples, traço na cor do texto).
const P = {
  bola: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5.6 5.6c3.3 3.3 3.3 9.5 0 12.8M18.4 5.6c-3.3 3.3-3.3 9.5 0 12.8"/>',
  fogo: '<path d="M12 21c-4 0-7-2.7-7-6.6 0-3.1 2-5.3 3.6-6.9.4 1.9 1.4 3 2.6 3.5C11 7.6 12.4 5 15 3c-.2 2.6.8 4.4 2.2 6 1.1 1.3 1.8 2.9 1.8 4.8C19 18.1 16 21 12 21z"/><path d="M12 21c-1.7 0-3-1.2-3-2.9 0-1.6 1.2-2.6 2.2-3.6.3 1 .9 1.5 1.6 1.7.2-1.1.8-2.1 1.7-2.8.2 1.4 1.5 2.4 1.5 4.2 0 1.9-1.6 3.4-4 3.4z"/>',
  coroa: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 10H5L3 8z"/><path d="M5 21h14"/>',
  trofeu: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4z"/><path d="M8 6H4v1a4 4 0 0 0 4 4M16 6h4v1a4 4 0 0 1-4 4M12 13v4M8 21h8M9 17h6"/>',
  relogio: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M5 3 2 6M19 3l3 3"/>',
  calendario: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8" cy="15" r="1"/><circle cx="12" cy="15" r="1"/><circle cx="16" cy="15" r="1"/>',
  grafico: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  lista: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1.2"/><circle cx="4" cy="12" r="1.2"/><circle cx="4" cy="18" r="1.2"/>',
  camisa: '<path d="M8 3h8l1 3 3 1v14H4V7l3-1 1-3z"/><path d="M8 3c0 2 1.8 3.5 4 3.5S16 5 16 3"/><path d="M10 13h4"/>',
  apito: '<circle cx="9" cy="14" r="5"/><path d="M13 11l8-4v4l-6 2"/><path d="M5 7 3 5"/>',
  arena: '<path d="M3 10c0-2.2 4-4 9-4s9 1.8 9 4v6c0 2.2-4 4-9 4s-9-1.8-9-4v-6z"/><path d="M3 10c0 2.2 4 4 9 4s9-1.8 9-4"/>',
  escudo: '<path d="M12 3 4 6v6c0 4.5 3.4 8.2 8 9 4.6-.8 8-4.5 8-9V6l-8-3z"/><path d="M9 12l2 2 4-4"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  raio: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
  alvo: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  seta: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  casa: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/>',
  aviao: '<path d="M2 16l20-8-6 12-3-5-5-1-6 2z"/>',
  sequencia: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  cesta: '<path d="M4 6h16"/><path d="M6 6l2 13h8l2-13"/><path d="M9 6l1.2 13M15 6l-1.2 13M7 11h10M7.7 15h8.6"/>',
};

export function icone(nome, classe = 'ic') {
  const corpo = P[nome] || P.bola;
  return `<svg class="${classe}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${corpo}</svg>`;
}

// Ícone automático para cada título de seção
const PARA_TITULO = [
  [/acordei/i, 'relogio'], [/épicos/i, 'fogo'], [/todos os jogos/i, 'bola'], [/líderes/i, 'coroa'],
  [/anteriores/i, 'calendario'], [/duelo|números/i, 'grafico'], [/box score/i, 'lista'], [/fonte/i, 'link'],
  [/conferência/i, 'escudo'], [/últimos/i, 'relogio'], [/próximos/i, 'calendario'], [/elenco/i, 'camisa'],
  [/escolha/i, 'escudo'], [/classificação/i, 'trofeu'], [/destaque/i, 'coroa'],
];
export function comIcones(html) {
  return html.replace(/<h2 class="titulo-secao"><span>([^<]+)<\/span>/g, (m, texto) => {
    const nome = (PARA_TITULO.find(([re]) => re.test(texto)) || [null, 'bola'])[1];
    return `<h2 class="titulo-secao">${icone(nome, 'ic ic-titulo')}<span>${texto}</span>`;
  });
}

// Bola de basquete desenhada (decoração)
export const BOLA_GRANDE = `<svg class="bola-deco" viewBox="0 0 200 200" aria-hidden="true">
  <defs>
    <radialGradient id="bg-bola" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#ffb071"/><stop offset=".55" stop-color="#f26a12"/><stop offset="1" stop-color="#8f3b06"/></radialGradient>
  </defs>
  <circle cx="100" cy="100" r="92" fill="url(#bg-bola)"/>
  <g fill="none" stroke="#2a1405" stroke-width="5" stroke-linecap="round" opacity=".85">
    <path d="M8 100h184M100 8v184"/>
    <path d="M38 30c26 20 40 44 40 70s-14 50-40 70"/>
    <path d="M162 30c-26 20-40 44-40 70s14 50 40 70"/>
  </g>
  <ellipse cx="70" cy="58" rx="26" ry="14" fill="#fff" opacity=".18" transform="rotate(-30 70 58)"/>
</svg>`;

// Logo do Cestinha: bola caindo no aro com rede
export const LOGO_ARO = `<svg class="logo-aro" viewBox="0 0 96 120" aria-hidden="true">
  <g class="logo-bola">
    <circle cx="58" cy="22" r="18" fill="#ff7a1a"/>
    <g fill="none" stroke="#3a1a05" stroke-width="2.4"><path d="M40 22h36M58 4v36M47 9c5 4 6 8 6 13s-1 9-6 13M69 9c-5 4-6 8-6 13s1 9 6 13"/></g>
  </g>
  <path class="logo-rastro" d="M30 18c-6 2-10 6-12 12M24 12c-6 2-10 6-12 12" stroke="#ff9a4a" stroke-width="3" fill="none" stroke-linecap="round" opacity=".5"/>
  <ellipse cx="48" cy="58" rx="40" ry="9" fill="none" stroke="#ff7a1a" stroke-width="6"/>
  <g class="logo-rede" stroke="#fff" stroke-width="2.4" fill="none"><path d="M10 60l12 50M30 66l6 44M48 67v43M66 66l-6 44M86 60l-12 50M16 80h64M20 96h56"/></g>
</svg>`;
