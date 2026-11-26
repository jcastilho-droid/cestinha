/* Central do Mercado: filtros locais. Sem alterar outras paginas. */
(() => {
 const grid=document.getElementById('mercado-grid');
 if(!grid)return;
 const buttons=[...document.querySelectorAll('[data-mercado-filtro]')];
 const cards=[...grid.querySelectorAll('[data-market-category]')];
 const input=document.getElementById('mercado-pesquisa');
 const count=document.getElementById('mercado-contagem');
 const empty=document.getElementById('mercado-vazio');
 let filter='todos';
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
 const render=()=>{
   const search=norm(input?.value);
   let visible=0;
   for(const card of cards){
     const on=(filter==='todos'||card.dataset.marketCategory===filter)&&(!search||norm(card.dataset.marketSearch).includes(search));
     card.hidden=!on;
     if(on)visible++;
   }
   buttons.forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.mercadoFiltro===filter)));
   if(count)count.textContent=visible+' movimentaç'+(visible===1?'ão':'ões')+' encontrada'+(visible===1?'':'s');
   if(empty)empty.hidden=visible!==0;
 };
 buttons.forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.mercadoFiltro;render()}));
 input?.addEventListener('input',render);
 render();
})();