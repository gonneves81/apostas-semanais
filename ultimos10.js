/* Apostas Semanais · últimos jogos reais das equipas.
   Mostra apenas resultados encontrados nas fontes, sem completar amostras por estimativa. */
(function(){
'use strict';
const start=()=>{
 const dataNode=document.getElementById('data-json');
 if(!dataNode)return;
 let d;try{d=JSON.parse(dataNode.textContent);}catch(e){return;}
 const games=new Map((d.games||[]).map(g=>[Number(g.id),g]));
 const panel=document.getElementById('modal-content'),modal=document.getElementById('match-modal');
 const byGame={};
 let sourceInfo=null, selectedId=null, loaded=false, loadError=false;
 const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const num=n=>Number.isFinite(n)?new Intl.NumberFormat('pt-PT',{maximumFractionDigits:2}).format(n):'—';
 const day=s=>/^\d{4}-\d\d-\d\d$/.test(s||'')?s.slice(8,10)+'/'+s.slice(5,7)+'/'+s.slice(2,4):esc(s);
 const formNames={V:'Vitória',E:'Empate',D:'Derrota'};
 const competitionNames={
  "ENG_1_premier-league":"Premier League","ESP_1_la-liga":"La Liga",
  "FRA_1_ligue-1":"Ligue 1","GER_1_bundesliga":"Bundesliga",
  "GER_2_2-bundesliga":"2. Bundesliga","ITA_1_serie-a":"Serie A",
  "SCO_1_premiership":"Liga Escocesa","POR_1_primeira-liga":"Liga Portugal",
  "NED_1_eredivisie":"Eredivisie","UEFA_1_champions-league":"Champions League",
  "UEFA_1_europa-league":"Liga Europa","UEFA_1_conference-league":"Liga Conferência",
  "ENG_CUP_efl-cup":"Taça da Liga Inglesa","ENG_CUP_fa-cup":"Taça de Inglaterra",
  "ESP_CUP_copa-del-rey":"Taça do Rei","GER_CUP_dfb-pokal":"Taça da Alemanha",
  "ITA_CUP_coppa-italia":"Taça de Itália","POR_CUP_taca-de-portugal":"Taça de Portugal",
  "SCO_CUP_scottish-cup":"Taça da Escócia","SCO_CUP_league-cup":"Taça da Liga Escocesa",
  "NED_CUP_knvb-beker":"Taça dos Países Baixos"
 };
 const comp=x=>competitionNames[x]||x.replace(/^[A-Z]+(?:_CUP)?_\d?_?/,'').replace(/[_-]/g,' ');
 const emptyTeam=name=>({name,available:0,complete:false,results:[],stats:{games:0,wins:0,draws:0,losses:0,gf:0,ga:0,home:{games:0,gf:0,ga:0},away:{games:0,gf:0,ga:0}}});
 const statsTable=t=>{
  const s=t.stats||emptyTeam(t.name).stats,n=s.games||0,avg=n?(s.gf/n):null,avgAgainst=n?(s.ga/n):null;
  return '<div class="lt10-summary"><div class="lt10-form"><span class="lt10-v">'+(s.wins||0)+'V</span><span class="lt10-e">'+(s.draws||0)+'E</span><span class="lt10-d">'+(s.losses||0)+'D</span></div>'+
   '<div class="lt10-metric"><small>Golos marcados</small><strong>'+s.gf+'</strong><small>'+num(avg)+' / jogo</small></div>'+
   '<div class="lt10-metric"><small>Golos sofridos</small><strong>'+s.ga+'</strong><small>'+num(avgAgainst)+' / jogo</small></div></div>'+
   '<div class="lt10-venues"><span><strong>Em casa ('+(s.home?.games||0)+'):</strong> '+(s.home?.gf||0)+' GM / '+(s.home?.ga||0)+' GS</span>'+
   '<span><strong>Fora ('+(s.away?.games||0)+'):</strong> '+(s.away?.gf||0)+' GM / '+(s.away?.ga||0)+' GS</span></div>';
 };
 function teamMarkup(t){
  t=t||emptyTeam('Equipa');
  const rows=(t.results||[]).map(x=>'<div class="lt10-match" role="row">'+
    '<time role="cell">'+day(x.date)+'</time>'+
    '<span role="cell" class="lt10-venue" title="'+(x.venue==='C'?'Em casa':'Fora')+'">'+x.venue+'</span>'+
    '<span role="cell" class="lt10-opponent">'+esc(x.opponent)+'<small>'+esc(comp(x.competition))+'</small></span>'+
    '<strong role="cell" class="lt10-score">'+x.gf+' – '+x.ga+'</strong>'+
    '<span role="cell" class="lt10-result lt10-'+x.outcome.toLowerCase()+'" title="'+(formNames[x.outcome]||'')+'">'+x.outcome+'</span>'+
    '<a role="cell" class="lt10-source-link" href="'+esc(x.sourceUrl)+'" title="Consultar a fonte do resultado" target="_blank" rel="noopener noreferrer" aria-label="Fonte do jogo contra '+esc(x.opponent)+'">↗</a>'+
    '</div>').join('');
  return '<article class="lt10-team">'+
   '<header><h4>'+esc(t.name)+'</h4><span class="lt10-count">'+t.available+'/10 resultados</span></header>'+
   statsTable(t)+
   (t.available===10?'':'<p class="lt10-incomplete">Fonte incompleta: foram encontrados '+t.available+' dos 10 resultados pretendidos. Não se assume que os restantes jogos não existiram.</p>')+
   '<div class="lt10-table" role="table" aria-label="Últimos resultados de '+esc(t.name)+'">'+
   '<div class="lt10-table-head" role="row"><span>Data</span><span>C/F</span><span>Adversário</span><span>GM–GS</span><span>V/E/D</span><span>Fonte</span></div>'+
   (rows||'<p class="lt10-empty">Não foram encontrados resultados anteriores nas fontes disponíveis.</p>')+'</div>'+
   '</article>';
 }
 function modalGame(){
  if(selectedId&&games.has(selectedId))return games.get(selectedId);
  const name=document.getElementById('modal-title')?.textContent?.trim()||'';
  return [...games.values()].find(g=>name===g.home+' vs '+g.away)||null;
 }
 function renderModal(){
  if(!loaded||!panel||!modal||modal.hidden||panel.querySelector('.lt10-section'))return;
  const game=modalGame();if(!game)return;
  const history=byGame[game.id];if(!history)return;
  const div=document.createElement('section');
  div.className='lt10-section';
  div.innerHTML='<div class="lt10-title"><div><small>FORMA RECENTE · RESULTADOS HISTÓRICOS</small><h3>Últimos 10 jogos de cada equipa</h3></div><span>Antes de '+day(history.date)+'</span></div>'+
    '<p class="lt10-explain">Resultados apresentados da perspetiva de cada equipa: <b>GM</b> = golos marcados, <b>GS</b> = golos sofridos, <b>C</b> = casa e <b>F</b> = fora. Inclui liga, taças e provas europeias quando as fontes disponibilizam esses encontros.</p>'+
    '<div class="lt10-grid">'+teamMarkup(history.home)+teamMarkup(history.away)+'</div>'+
    '<p class="lt10-attribution">Fontes: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noopener noreferrer">open-matchday (2026/27)</a> e <a href="https://github.com/openfootball/football.json" target="_blank" rel="noopener noreferrer">openfootball (2025/26)</a>. Os resultados não foram confirmados individualmente em páginas oficiais; não são previsões nem garantias de resultados futuros. Só foram incluídos encontros anteriores à data do jogo.</p>';
  panel.append(div);
 }
 function oneLine(t){
  if(!t)return '';
  const s=t.stats||{},n=s.games||0;
  return '<span class="lt10-mini-team"><span class="lt10-mini-name">'+esc(t.name)+'</span><b>'+n+'/10</b><span>'+(s.wins||0)+'V '+(s.draws||0)+'E '+(s.losses||0)+'D</span><strong>GM '+(s.gf||0)+' · GS '+(s.ga||0)+'</strong></span>';
 }
 function cardBlock(game){
  const data=byGame[game.id];if(!data)return null;
  const block=document.createElement('div');block.className='lt10-card-mini';
  block.innerHTML='<div class="lt10-mini-head">Últimos jogos antes deste encontro · ver resultados completos em <b>Ver análise</b></div>'+
   '<div class="lt10-mini-row">'+oneLine(data.home)+oneLine(data.away)+'</div>';
  return block;
 }
 function renderCards(){
  if(!loaded)return;
  for(const root of [document.getElementById('game-list'),document.getElementById('opening-games')]){
   if(!root)continue;
   for(const card of root.querySelectorAll('.game-card')){
    if(card.querySelector('.lt10-card-mini'))continue;
    const open=card.querySelector('[data-open]'),game=games.get(Number(open?.dataset.open));
    if(!game)continue;
    const b=cardBlock(game);if(!b)continue;
    const footer=card.querySelector('.game-footer');if(footer)footer.before(b);else card.append(b);
   }
  }
 }
 document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-open]');if(btn){selectedId=Number(btn.dataset.open);queueMicrotask(renderModal);}
 },true);
 if(panel)new MutationObserver(renderModal).observe(panel,{childList:true});
 for(const root of [document.getElementById('game-list'),document.getElementById('opening-games')]){
  if(root)new MutationObserver(renderCards).observe(root,{childList:true,subtree:false});
 }
 const filename='./dados/ultimos10-'+d.start+'.json';
 fetch(filename,{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Dados dos últimos dez não publicados');return r.json();})
  .then(json=>{
   if(json?.period?.start!==d.start || !json.byGame)throw Error('Período do histórico não coincide com o calendário');
   Object.assign(byGame,json.byGame);sourceInfo=json;loaded=true;
   renderCards();renderModal();
  })
  .catch(err=>{loadError=true;
   // Sem dados não criamos resultados nem estatísticas artificiais.
   if(modal&&!modal.hidden&&panel&&!panel.querySelector('.lt10-section')){
     const p=document.createElement('p');p.className='lt10-empty';p.textContent='Histórico dos últimos 10 indisponível para esta semana. Não foram apresentados resultados estimados.';panel.append(p);
   }
   console.warn('Apostas Semanais: histórico de resultados indisponível',err);
  });
};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
