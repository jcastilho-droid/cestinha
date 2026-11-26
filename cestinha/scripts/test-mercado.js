import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const base='_site',file=name=>fs.readFileSync(path.join(base,name),'utf8');
const page=file('mercado.html'),home=file('index.html'),styles=file('assets/mercado.css'),js=file('assets/mercado.js');
const data=JSON.parse(fs.readFileSync('data/mercado.json','utf8'));
assert.ok(page.includes('CENTRAL DO <span>MERCADO</span>'),'Pagina de mercado nao foi montada');
assert.ok(page.includes('class="marca logo"'),'Identidade e logo nao preservadas');
assert.ok(page.includes('id="mercado-grid"'),'Cards nao criados');
assert.ok(page.includes('data-mercado-filtro="trocas"'),'Filtros ausentes');
assert.ok(page.includes('data-mercado-filtro="draft"'),'Draft ausente');
assert.ok(page.includes('data-mercado-filtro="rumores"'),'Rumores ausentes');
assert.ok(page.includes('href="./mercado.html"'),'Mercado nao esta no menu');
assert.ok(!home.includes('assets/mercado.css'),'CSS do mercado nao deve afetar a home');
assert.ok(!home.includes('assets/mercado.js'),'JS do mercado nao deve afetar a home');
assert.ok(home.includes('class="marca logo"'),'Logo da home alterada');
assert.ok(home.includes('data-cestinha-carrossel'),'Carrossel da home alterado');
assert.ok(styles.includes('.mercado-pagina')&&js.includes('[data-mercado-filtro]'),'Assets do mercado incompletos');
assert.ok(!/https?:\/\/(?!www\.nba\.com)/.test(data.items.map(x=>x.url).join(' ')),'Fonte nao-oficial no dataset');
assert.ok(data.items.length>=5);
for(const item of data.items){
 assert.ok(['trocas','draft','agencia','contratos','rumores'].includes(item.categoria));
 assert.ok(item.url.startsWith('https://www.nba.com/'));
 assert.match(item.data,/^\d{4}-\d{2}-\d{2}$/);
 assert.ok(page.includes(item.titulo.replace(/&/g,'&amp;')),'Materia nao gerada: '+item.titulo);
}
const nav=page.match(/<nav class="barra-inferior"[\s\S]*?<\/nav>/)?.[0]||'';
assert.equal((nav.match(/<a /g)||[]).length,7,'Barra inferior deve ter 7 itens em 1 linha');
console.log('Mercado validado: '+data.items.length+' itens, fontes, filtros, home e logotipo preservados.');
