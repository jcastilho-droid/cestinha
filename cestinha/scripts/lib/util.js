// Funções de apoio usadas por todos os scripts.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const P = {
  raw: path.join(RAIZ, 'data', 'raw'),
  processados: path.join(RAIZ, 'data', 'processed.json'),
  content: path.join(RAIZ, 'content'),
  jogos: path.join(RAIZ, 'content', 'jogos'),
  rodadas: path.join(RAIZ, 'content', 'rodadas'),
  revisao: path.join(RAIZ, 'content', 'revisao'),
  rascunhos: path.join(RAIZ, 'content', 'rascunhos'),
  site: path.join(RAIZ, '_site'),
};

export function lerJson(arq, padrao = null) {
  try {
    return JSON.parse(fs.readFileSync(arq, 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return padrao;
    throw new Error(`JSON inválido em ${path.relative(RAIZ, arq)}: ${e.message}`);
  }
}

export function gravarJson(arq, dados) {
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, JSON.stringify(dados, null, 2) + '\n', 'utf8');
}

export function listarArquivos(dir, ext = '.json') {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(ext)).sort();
}

export function listarDiasRaw() {
  if (!fs.existsSync(P.raw)) return [];
  return fs.readdirSync(P.raw).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
}

// A NBA organiza a rodada pela data dos EUA (horário de Nova York).
export function dataEUA(deslocDias = 0, agora = new Date()) {
  const d = new Date(agora.getTime() + deslocDias * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

const TZ = 'America/Sao_Paulo';
export function horaBrasilia(iso) {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
    .format(new Date(iso)).replace(':', 'h');
}
export function dataHoraBrasilia(iso) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}
// "domingo, 15 de novembro" a partir de AAAA-MM-DD (data da rodada)
export function dataPorExtenso(aaaammdd) {
  const d = new Date(`${aaaammdd}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
export function dataCurta(aaaammdd) {
  const [, m, d] = aaaammdd.split('-');
  return `${d}/${m}`;
}
export function agoraIso() {
  return new Date().toISOString();
}
