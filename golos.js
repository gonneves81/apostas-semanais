/* Apostas Semanais — módulo específico de golos, três mercados e amostras identificadas. */
(function(){
'use strict';
function start(){
 const mount=document.getElementById('view-golos'),embedded=document.getElementById('data-json');
 if(!mount||!embedded)return;
 let D;try{D=JSON.parse(embedded.textContent)}catch(e){return;}
 const $=id=>document.getElementById(id);
 const label={BTTS:'Ambas Marcam',O25:'Mais de 2,5',AND:'Ambas E +2,5'};
 const leagues=new Map(D.leagues.map(x=>[x.code,x]));
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const fmt=x=>typeof x==='number'&&Number.isFinite(x)?(x*100).toFixed(1).replace('.',',')+'%':'—';
 const goal=x=>typeof x==='number'&&Number.isFinite(x)?String(x):'—';
 const day=g=>g.date||String(D.start).slice(0,8)+String(g.day).padStart(2,'0');
 const vars={lg:'ALL',date:'ALL',market:'BTTS',order:'desc',min:0};
 let model=null;
 const days=Array.from({length:7},(_,i)=>{
  const d=new Date(D.start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);
  return {date:d.toISOString().slice(0,10),label:['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i]+' '+d.getUTCDate()};
 });
 const form=rs=>rs?.length?rs.map(r=>'<abbr title="'+esc(r.date+' · '+r.opp+' · '+r.gf+'-'+r.ga)+'" class="gm-form gm-'+esc(r.form)+'">'+esc(r.form)+'</abbr>').join(''):'<small>Sem resultados suficientes</small>';
 function lineup(team,rs,homeAway){
  const totals={gf:rs.reduce((a,b)=>a+b.gf,0),ga:rs.reduce((a,b)=>a+b.ga,0)};
  const venue=rs.filter(r=>r.venue===homeAway);
  const vgf=venue.reduce((a,b)=>a+b.gf,0),vga=venue.reduce((a,b)=>a+b.ga,0);
  const avg=n=>n.toFixed(2).replace('.',',');
  return '<div class="gm-team"><strong>'+esc(team)+'</strong><div class="gm-form-row">'+form(rs)+'</div>'+
    '<div class="gm-stats"><span>Últimos '+rs.length+': <b>'+totals.gf+' GM / '+totals.ga+' GS</b></span>'+
    '<span>'+(homeAway==='C'?'Em casa':'Fora')+' ('+venue.length+'): <b>'+vgf+' GM / '+vga+' GS</b></span>'+
    '<span>Médias 7 jogos: <b>'+(rs.length?avg(totals.gf/rs.length)+' / '+avg(totals.ga/rs.length):'—')+'</b></span></div></div>';
 }
 function picksCard(g,m){
  const probs=m?.prob||{},ok=!!m?.prob,metrics=m?.metrics||{},n=m?.counts||{};
  const pills=Object.keys(label).map(k=>'<button type="button" data-gm-market="'+k+'" class="gm-prob'+(vars.market===k?' active':'')+'" data-gm-prob="'+g.id+'">'+
    '<span>'+label[k]+'</span><strong>'+fmt(probs[k])+'</strong></button>').join('');
  const buttons=ok?[1,2,3].map(n=>'<button type="button" data-add-slip="'+n+'" data-game="'+g.id+'" data-market="'+vars.market+'">+ Aposta '+n+'</button>').join(''):
    '<span class="gm-unavailable">Sem previsão: amostra insuficiente</span>';
  return '<article class="gm-card" data-gm-id="'+g.id+'"><div class="gm-card-head"><span>'+esc(leagues.get(g.league)?.name||g.league)+' · '+esc(day(g).slice(8,10)+'/'+day(g).slice(5,7))+' '+esc(g.time)+' PT</span>'+
    '<span class="gm-label">'+(ok?'Estimativa não calibrada':'Dados insuficientes')+'</span></div>'+
    '<h3>'+esc(g.home)+' <span>–</span> '+esc(g.away)+'</h3>'+
    '<div class="gm-pick-compare">'+lineup(g.home,m?.latest?.home||[],'C')+lineup(g.away,m?.latest?.away||[],'F')+'</div>'+
    '<div class="gm-prob-grid">'+pills+'</div>'+
    '<div class="gm-actions">'+buttons+'</div>'+
    (ok?'<p class="gm-explainer">Ponderação de golos casa/fora (65%) e dos últimos 7 (35%), com regularização estatística. Amostras: '+n.home+' / '+n.away+' jogos; '+n.homeAtHome+' casa e '+n.awayAtAway+' fora.</p>':
     '<p class="gm-explainer">Para esta equipa faltam pelo menos 5 resultados por lado ou 2 em casa/fora. Sem preenchimento artificial.</p>')+
    '</article>';
 }
 function render(){
  if(!model)return;
  const available=D.games.filter(g=>vars.lg==='ALL'||g.league===vars.lg).filter(g=>vars.date==='ALL'||day(g)===vars.date);
  const ranked=available.map(g=>({g,m:model.games[g.id]}));
  ranked.sort((a,b)=>{
    const pa=a.m?.prob?.[vars.market],pb=b.m?.prob?.[vars.market];
    if(typeof pa!=='number'&&typeof pb!=='number')return day(a.g).localeCompare(day(b.g));
    if(typeof pa!=='number')return 1;if(typeof pb!=='number')return -1;
    return (vars.order==='desc'?pb-pa:pa-pb)||day(a.g).localeCompare(day(b.g));
  });
  const filtered=ranked.filter(x=>!x.m?.prob||100*x.m.prob[vars.market]+1e-6>=vars.min);
  const covered=filtered.filter(x=>x.m?.prob).length;
  $('gm-summary').textContent=filtered.length+' jogos · '+covered+' com estimativas de golos · '+(filtered.length-covered)+' sem amostra suficiente. Ordenação: '+label[vars.market]+' '+(vars.order==='desc'?'(maior para menor)':'(menor para maior)')+'.';
  $('gm-games').innerHTML=filtered.length?filtered.map(({g,m})=>picksCard(g,m)).join(''):
   '<p class="gm-empty">Não há jogos com estes critérios.</p>';
  document.querySelectorAll('[data-gm-head]').forEach(b=>{
   b.classList.toggle('active',b.dataset.gmHead===vars.market);
   b.setAttribute('aria-pressed',String(b.dataset.gmHead===vars.market));
  });
 }
 mount.innerHTML='<div class="body-header"><span class="eyebrow">Análise de golos</span><h1>Apostas Semanais · 3 mercados</h1>'+
  '<p>Previsões calculadas apenas a partir de golos marcados e sofridos, desempenho em casa/fora e últimos sete jogos. '+
  'Estas percentagens são <strong>estimativas não calibradas</strong> e não representam odds comerciais.</p></div>'+
  '<div class="gm-controls"><label>Competição<select id="gm-lg"><option value="ALL">Todas as 12 competições</option>'+
  D.leagues.map(x=>'<option value="'+esc(x.code)+'">'+esc(x.name)+'</option>').join('')+'</select></label>'+
  '<label>Dia<select id="gm-date"><option value="ALL">Toda a semana</option>'+days.map(x=>'<option value="'+x.date+'">'+x.label+'</option>').join('')+'</select></label>'+
  '<label>Probabilidade mínima<select id="gm-min">'+[0,50,55,60,65,70,75,80].map(x=>'<option value="'+x+'">'+(x===0?'Todas':x+'% ou mais')+'</option>').join('')+'</select></label></div>'+
  '<div class="gm-header"><strong>Ordenar jogos por previsão:</strong><div class="gm-sort-buttons">'+
  Object.entries(label).map(([k,v])=>'<button type="button" data-gm-head="'+k+'" aria-pressed="false">'+v+' <span aria-hidden="true">↕</span></button>').join('')+'</div>'+
  '<button type="button" id="gm-order">↓ Maior primeiro</button></div><p class="gm-summary" id="gm-summary">A carregar resultados anteriores…</p>'+
  '<div id="gm-games" class="gm-grid"><p>A carregar modelo de golos…</p></div>'+
  '<p class="gm-footnote"><b>Fontes e limitações:</b> resultados anteriores recolhidos de agregadores públicos, não verificados jogo a jogo. A média de golos foi regularizada para reduzir oscilações da amostra. O modelo usa Poisson independente sem correção por força do adversário, ausências ou correlação entre golos. '+
  'Os cálculos desta edição são reestimativas e alguns jogos já ocorreram: <strong>não são previsões arquivadas antes desses jogos</strong>. Não utilizar como histórico de acertos pré-jogo.</p>';
 $('gm-lg').addEventListener('change',e=>{vars.lg=e.target.value;render();});
 $('gm-date').addEventListener('change',e=>{vars.date=e.target.value;render();});
 $('gm-min').addEventListener('change',e=>{vars.min=Number(e.target.value);render();});
 $('gm-order').addEventListener('click',()=>{vars.order=vars.order==='desc'?'asc':'desc';$('gm-order').textContent=vars.order==='desc'?'↓ Maior primeiro':'↑ Menor primeiro';render();});
 mount.addEventListener('click',e=>{
  const b=e.target.closest('[data-gm-head],[data-gm-market]');
  if(b){const next=b.dataset.gmHead||b.dataset.gmMarket;if(vars.market===next)vars.order=vars.order==='desc'?'asc':'desc';else {vars.market=next;vars.order='desc';}
   $('gm-order').textContent=vars.order==='desc'?'↓ Maior primeiro':'↑ Menor primeiro';render();}
 });
 const file='./dados/modelo-golos-'+D.start+'.json';
 fetch(file,{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(d=>{
  if(d.edition?.start!==D.start)throw Error('Dados de outra semana');
  model=d;window.ApostasGolosModel=d;
  window.dispatchEvent(new CustomEvent('apostas-golos-ready'));
  render();
 }).catch(e=>{
  $('gm-summary').textContent='Não foi possível carregar o modelo de golos.';
  $('gm-games').innerHTML='<p class="gm-empty">Previsões indisponíveis: '+esc(e.message)+'. Não são apresentadas probabilidades antigas como alternativa.</p>';
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();