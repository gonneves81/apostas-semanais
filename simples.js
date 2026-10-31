/* Navegação simples, inspirada na organização de apps de resultados.
   Não usa marcas, API não autorizada ou dados "ao vivo" inventados. */
(function(){
'use strict';
function init(){
const input=document.getElementById('data-json'),host=document.getElementById('flash-simple');if(!input||!host)return;
let D;try{D=JSON.parse(input.textContent)}catch(e){return}
const leagues=D.leagues||[],games=D.games||[],gamesById=new Map(games.map(g=>[Number(g.id),g]));
const $=id=>document.getElementById(id),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pct=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1?(x*100).toFixed(1).replace('.',',')+'%':'—';
const refs={PT:'Portugal',EN:'Inglaterra',ES:'Espanha',IT:'Itália',FR:'França',DE:'Alemanha',DE2:'Alemanha',NL:'Países Baixos',SC:'Escócia',UCL:'Europa',UEL:'Europa',UECL:'Europa'};
const cols=[['W1','1'],['X','X'],['W2','2'],['BTTS','AM'],['O25','+2,5'],['AND','AM E +2,5'],['OR','AM OU +2,5'],['O15','+1,5'],['C85','Cantos +8,5'],['C95','Cantos +9,5'],['HT1','1.ª Casa'],['HT2','1.ª Fora'],['SH1','2.ª Casa'],['SH2','2.ª Fora']];
const markets=(g,k)=>{
if(!g||g.verified===false)return null;
const p=g.p||{},a=g.first||{},b=g.second||{};
const x={W1:p.w1,X:p.draw,W2:p.w2,BTTS:p.btts,O25:p.o25,AND:p.and,OR:p.or,O15:p.o15,C85:g.c85,C95:g.c95,HT1:a.w1,HT2:a.w2,SH1:b.w1,SH2:b.w2}[k];
return typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1?x:null;};
const date=g=>typeof g.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(g.date)?g.date:D.start.slice(0,8)+String(g.day).padStart(2,'0');
const fmtDate=g=>date(g).slice(8,10)+'/'+date(g).slice(5,7)+' '+(g.time||'');
let standings=null,standingsError=false;
let hist=null,hasFailed=false,selectedLeague='ALL',selectedDay='ALL',selectedMarket='BTTS',sort='date',selectedGame=null,tab='preview',formScope='all',formLength=10;
const loadStamp=new Date().toISOString();
function lg(g){return leagues.find(l=>l.code===g.league)||{name:g.league,flag:'⚽'}}
function results(g,side){
const r=hist?.byGame?.[g.id]?.[side]?.results||[];
return Array.isArray(r)?r.filter(x=>x.date<date(g)&&Number.isInteger(x.gf)&&Number.isInteger(x.ga)).slice(0,10):[];
}
function aggregate(arr){
const gf=arr.reduce((a,r)=>a+r.gf,0),ga=arr.reduce((a,r)=>a+r.ga,0),n=arr.length;
return {n,gf,ga,v:arr.filter(r=>r.outcome==='V').length,e:arr.filter(r=>r.outcome==='E').length,d:arr.filter(r=>r.outcome==='D').length,
 avgF:n?(gf/n).toFixed(2).replace('.',','):'—',avgA:n?(ga/n).toFixed(2).replace('.',','):'—'};
}
function subset(rows,scope){return rows.filter(r=>scope==='all'||(scope==='home'&&r.venue==='C')||(scope==='away'&&r.venue==='F')).slice(0,formLength)}
function line(x){return '<div class="fs-result"><span>'+esc(x.date.slice(8,10)+'/'+x.date.slice(5,7))+'</span><span class="fs-form fs-'+esc(x.outcome.toLowerCase())+'">'+esc(x.outcome)+'</span><span>'+esc(x.venue==='C'?'C':'F')+'</span><span class="fs-opp">'+esc(x.opponent)+'</span><b>'+x.gf+'–'+x.ga+'</b></div>'}
function statPanel(rows,name,sc){
const picks=subset(rows,sc),a=aggregate(picks);
return '<section class="fs-team-stat"><h3>'+esc(name)+'</h3><div class="fs-numbers">'+
[['Jogos',a.n],['V / E / D',a.v+' / '+a.e+' / '+a.d],['GM',a.gf],['GS',a.ga],['GM/jogo',a.avgF],['GS/jogo',a.avgA]].map(([k,v])=>'<div><small>'+k+'</small><b>'+v+'</b></div>').join('')+'</div>'+
'<div class="fs-result-head">Data · Forma · C/F · Adversário · Golos</div>'+
(picks.length?picks.map(line).join(''):'<p class="fs-no">Sem resultados suficientes no arquivo.</p>')+
'<small>Resultados disponíveis anteriores a este jogo: '+picks.length+' (máximo '+formLength+').</small></section>';}
function h2h(g){
const home=results(g,'home'),away=results(g,'away');const homeName=g.home,awayName=g.away;
const merged=[...home.map(r=>({...r,forTeam:'home'})),...away.map(r=>({...r,forTeam:'away'}))];
const seen=new Set(),out=[];
for(const r of merged.sort((a,b)=>b.date.localeCompare(a.date))){
if(r.forTeam==='home'&&r.opponent!==awayName)continue;
if(r.forTeam==='away'&&r.opponent!==homeName)continue;
const k=r.date+'|'+r.gf+'|'+r.ga;if(seen.has(k))continue;seen.add(k);out.push(r);
}
return out.slice(0,10);
}
function tableForm(g,side){const r=results(g,side).slice(0,7);return r.length?r.map(x=>'<span class="fs-form fs-'+esc(x.outcome.toLowerCase())+'" title="'+esc(x.date+' · '+x.opponent+' · '+x.gf+'-'+x.ga)+'">'+x.outcome+'</span>').join(''):'<span class="fs-none">—</span>';}
function rankRows(){
return games.filter(g=>(selectedLeague==='ALL'||selectedLeague===g.league)&&(selectedDay==='ALL'||date(g)===selectedDay))
.sort((a,b)=>sort==='prob'?(markets(b,selectedMarket)??-1)-(markets(a,selectedMarket)??-1)||date(a).localeCompare(date(b)):date(a).localeCompare(date(b))||String(a.time).localeCompare(String(b.time)));
}
function menu(){
return '<header class="fs-top"><div><span>⚽ APOSTAS SEMANAIS</span><h1>Futebol · Análise</h1><small>Dados concretos, previsões separadas e fontes identificadas</small></div>'+
'<button type="button" id="fs-refresh" title="Recarregar os dados publicados"><span>↻</span> Atualizar</button></header>'+
'<div class="fs-stamp"><span>Semana arquivada: '+esc(D.start)+' a '+esc(D.end)+'</span><b>Não é um placar em direto</b></div>'+
'<nav class="fs-top-tabs" aria-label="Navegação simples"><button type="button" class="active" data-fs-nav="fixtures">Jogos e previsões</button>'+
'<button type="button" data-fs-nav="legacy">Outras ferramentas</button></nav>'+
'<div class="fs-layout"><aside class="fs-leagues"><h2>COMPETIÇÕES</h2>'+
'<button type="button" data-fs-league="ALL" class="active">Todas as ligas <b>'+games.length+'</b></button>'+
leagues.map(l=>'<button type="button" data-fs-league="'+esc(l.code)+'">'+esc(l.flag||'⚽')+' '+esc(l.name)+' <b>'+games.filter(g=>g.league===l.code).length+'</b></button>').join('')+
'</aside><main class="fs-main"><div class="fs-filters"><label>Liga<select id="fs-league"><option value="ALL">Todas as ligas</option>'+
leagues.map(l=>'<option value="'+esc(l.code)+'">'+esc(l.name)+'</option>').join('')+'</select></label>'+
'<label>Dia<select id="fs-day"><option value="ALL">Toda a semana</option>'+
Array.from({length:7},(_,i)=>{const dt=new Date(D.start+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()+i);const d=dt.toISOString().slice(0,10);return '<option value="'+d+'">'+d.slice(8,10)+'/'+d.slice(5,7)+'</option>';}).join('')+'</select></label>'+
'<label>Mercado<select id="fs-market">'+cols.map(([k,n])=>'<option value="'+k+'"'+(k===selectedMarket?' selected':'')+'>'+n+'</option>').join('')+'</select></label>'+
'<label>Ordenar<select id="fs-order"><option value="date">Por data</option><option value="prob">Maior probabilidade</option></select></label></div>'+
'<div class="fs-warning">As percentagens são <b>estimativas do modelo</b>, não taxas de sucesso nem odds comerciais. As previsões UEFA exploratórias têm amostras muito reduzidas. Mercados sem dados ficam vazios.</div>'+
'<div id="fs-fixtures"></div></main></div><div id="fs-modal" hidden class="fs-modal" role="dialog" aria-modal="true" aria-label="Análise do encontro">'+
'<div class="fs-dialog"><div class="fs-dialog-bar"><button type="button" data-fs-close>← Voltar</button><span>Análise por encontro</span></div><div id="fs-detail"></div></div></div>';
}
function renderList(){
const rows=rankRows(),root=$('fs-fixtures');if(!root)return;
const groupByLeague=selectedLeague==='ALL'&&sort==='date';
const groups=groupByLeague?leagues.map(l=>({l,rows:rows.filter(g=>g.league===l.code)})).filter(x=>x.rows.length):
[{l:null,rows}];
root.innerHTML='<div class="fs-list-title"><b>'+rows.length+' encontros</b><span>Clica numa percentagem para ordenar pelo mercado</span></div>'+
groups.map(group=>'<section class="fs-competition">'+
'<h2>'+(group.l?esc(group.l.flag||'⚽')+' '+esc(group.l.name):'Jogos e percentagens')+'</h2>'+
'<div class="fs-scroll"><table class="fs-table"><thead><tr><th>Dia / jogo</th><th>Forma casa / fora</th>'+
cols.map(([k,n])=>'<th><button class="fs-sort'+(sort==='prob'&&selectedMarket===k?' active':'')+'" data-fs-sort="'+k+'" title="Ordenar por '+esc(n)+'">'+esc(n)+(sort==='prob'&&selectedMarket===k?' ↓':'')+'</button></th>').join('')+
'<th>Ações</th></tr></thead><tbody>'+
group.rows.map(g=>'<tr><th><button type="button" class="fs-match" data-fs-open="'+g.id+'"><small>'+fmtDate(g)+' · '+esc(lg(g).name)+'</small><strong>'+esc(g.home)+' – '+esc(g.away)+'</strong>'+
(g.modelStatus==='exploratory_uefa'?'<em>UEFA · previsão exploratória</em>':'')+'</button></th>'+
'<td><div class="fs-form-row">'+tableForm(g,'home')+'</div><div class="fs-form-row">'+tableForm(g,'away')+'</div></td>'+
cols.map(([k,n])=>{const p=markets(g,k);return '<td><button type="button" class="fs-percentage'+(sort==='prob'&&selectedMarket===k?' selected':'')+'" data-fs-sort="'+k+'" title="Ordenar todos os jogos por '+esc(n)+'">'+pct(p)+'</button></td>';}).join('')+
'<td><button type="button" class="fs-open" data-fs-open="'+g.id+'">Analisar</button></td></tr>').join('')+
'</tbody></table></div></section>').join('')+
'<p class="fs-source-note">Fonte de resultados anteriores: <a href="https://github.com/oladeeayo/open-matchday" target="_blank" rel="noopener">open-matchday</a> e <a href="https://github.com/openfootball/football.json" target="_blank" rel="noopener">openfootball</a>. Não verificados individualmente. As apostas mais efetuadas pelo público não são apresentadas porque não foi encontrada uma amostra comprovável e comparável por jogo.</p>';
}
function drawDetail(){
const g=gamesById.get(selectedGame);if(!g)return;const home=results(g,'home'),away=results(g,'away');
const tabs=[['preview','Previsões'],['form','Forma e golos'],['venue','Casa / Fora'],['h2h','H2H'],['standings','Classificação'],['popular','Apostas populares']];
let body='';
if(tab==='preview')body='<div class="fs-metrics">'+cols.map(([k,n])=>'<div><small>'+esc(n)+'</small><strong>'+pct(markets(g,k))+'</strong></div>').join('')+'</div>'+
'<p class="fs-note">Estes valores pertencem à previsão arquivada. Não são recalculados automaticamente ao carregar no botão Atualizar.</p>'+
'<button type="button" class="fs-action" data-fs-original="'+g.id+'">Ver análise original e acrescentar ao boletim</button>';
if(tab==='form')body='<div class="fs-subtabs"><button data-fs-form="5" class="'+(formLength===5?'active':'')+'">Últimos 5</button><button data-fs-form="10" class="'+(formLength===10?'active':'')+'">Últimos 10</button></div>'+
'<div class="fs-two">'+statPanel(home,g.home,'all')+statPanel(away,g.away,'all')+'</div>';
if(tab==='venue')body='<div class="fs-two">'+statPanel(home,g.home,'home')+statPanel(away,g.away,'away')+'</div>'+
'<p class="fs-note">Casa: apenas resultados em casa da equipa anfitriã. Fora: apenas resultados fora da equipa visitante, dentro dos 10 jogos anteriores arquivados. Esta amostra pode ser menor do que 10.</p>';
if(tab==='h2h'){const h=h2h(g);body='<h3>Confrontos diretos disponíveis</h3>'+
(h.length?h.map(line).join(''):'<p class="fs-no">O arquivo recente não contém confrontos suficientes entre as duas equipas. Não são inventados resultados H2H.</p>')+
'<p class="fs-note">Só são identificados confrontos presentes nos históricos recentes das duas equipas; não representa necessariamente todos os H2H históricos.</p>';}
if(tab==='standings'){
 const lg=standings?.leagues?.[g.league];
 body=lg?.standings?.length?'<p class="fs-note">Classificação reconstruída dos resultados presentes no arquivo até '+esc(standings.calculatedUntil)+'. Não é uma tabela oficial ou em direto.</p>'+
 '<div class="fs-scroll"><table class="fs-table fs-standing-table"><thead><tr><th>#</th><th>Equipa</th><th>J</th><th>V/E/D</th><th>GM</th><th>GS</th><th>Pts</th><th>Últimos 7</th></tr></thead><tbody>'+
 lg.standings.map(x=>'<tr><td>'+x.rank+'</td><th>'+esc(x.name)+'</th><td>'+x.p+'</td><td>'+x.w+'/'+x.d+'/'+x.l+'</td><td>'+x.gf+'</td><td>'+x.ga+'</td><td>'+x.pts+'</td><td><div class="fs-form-row">'+(x.recent||[]).slice(0,7).map(a=>'<span class="fs-form fs-'+esc(a.result.toLowerCase())+'">'+esc(a.result)+'</span>').join('')+'</div></td></tr>').join('')+'</tbody></table></div>':
 '<p class="fs-no">Não há classificação reconstruída verificável para esta competição neste arquivo.</p>';
}
if(tab==='popular')body='<p class="fs-no">Apostas mais efetuadas: sem percentagens públicas verificáveis para este encontro. Para mostrar escolhas populares é necessária uma fonte que divulgue o número ou percentagem de apostas, o mercado, a casa e a data de recolha.</p><p class="fs-note">Não confundir prognósticos populares publicados online com a distribuição real das apostas feitas pelos utilizadores.</p>';
$('fs-detail').innerHTML='<div class="fs-match-header"><span>'+esc(lg(g).flag||'⚽')+' '+esc(lg(g).name)+' · '+fmtDate(g)+' (Portugal)</span><h2>'+esc(g.home)+' <span>×</span> '+esc(g.away)+'</h2><small>'+(g.modelStatus==='exploratory_uefa'?'⚠️ Estimativa exploratória UEFA, sem calibração':g.verified===false?'Prognóstico pendente':'Previsão arquivada')+'</small></div>'+
'<nav class="fs-detail-tabs">'+tabs.map(([id,label])=>'<button type="button" data-fs-tab="'+id+'" class="'+(tab===id?'active':'')+'">'+label+'</button>').join('')+'</nav>'+
'<div class="fs-tab-content">'+body+'</div>';
}
async function loadHistory(){
try{const response=await fetch('./dados/ultimos10-'+D.start+'.json',{cache:'no-store'});if(!response.ok)throw Error('HTTP '+response.status);
const data=await response.json();if(!data.byGame||data.period?.start!==D.start)throw Error('Edição diferente');hist=data;hasFailed=false;}catch(e){hist=null;hasFailed=true;}
renderList();if(selectedGame)drawDetail();
}
async function loadStandings(){try{
 const res=await fetch('./dados/classificacoes-2026-10-22.json',{cache:'no-store'});
 if(!res.ok)throw Error('Classificação indisponível');
 const d=await res.json();
 if(d.season!=='2026/27'||!d.leagues)throw Error('Formato de classificação inesperado');
 standings=d;standingsError=false;
 }catch(e){standings=null;standingsError=true}
 if(selectedGame&&tab==='standings')drawDetail();
}
host.innerHTML=menu();renderList();loadHistory();loadStandings();
host.addEventListener('click',e=>{
const group=e.target.closest('[data-fs-league]');if(group){selectedLeague=group.dataset.fsLeague;$('fs-league').value=selectedLeague;host.querySelectorAll('[data-fs-league]').forEach(b=>b.classList.toggle('active',b===group));renderList();return;}
const sorting=e.target.closest('[data-fs-sort]');if(sorting){const k=sorting.dataset.fsSort;sort=sort==='prob'&&selectedMarket===k?'date':'prob';selectedMarket=k;$('fs-market').value=k;$('fs-order').value=sort;renderList();return;}
const open=e.target.closest('[data-fs-open]');if(open){selectedGame=Number(open.dataset.fsOpen);tab='preview';formScope='all';formLength=10;drawDetail();$('fs-modal').hidden=false;document.body.classList.add('fs-modal-open');return;}
const close=e.target.closest('[data-fs-close]');if(close){$('fs-modal').hidden=true;document.body.classList.remove('fs-modal-open');selectedGame=null;return;}
const select=e.target.closest('[data-fs-tab]');if(select){tab=select.dataset.fsTab;drawDetail();return;}
const length=e.target.closest('[data-fs-form]');if(length){formLength=Number(length.dataset.fsForm);drawDetail();return;}
const orig=e.target.closest('[data-fs-original]');if(orig){$('fs-modal').hidden=true;document.body.classList.remove('fs-modal-open');const id=Number(orig.dataset.fsOriginal);const lgButton=document.querySelector('[data-go="games"]');lgButton?.click();setTimeout(()=>document.querySelector('#game-list [data-open="'+id+'"]')?.click(),150);return;}
const nav=e.target.closest('[data-fs-nav]');if(nav){if(nav.dataset.fsNav==='legacy'){document.querySelector('[data-go="tables"]')?.click();}else{host.scrollIntoView({behavior:'smooth'});}return;}
if(e.target.closest('#fs-refresh')){const b=$('fs-refresh');b.disabled=true;b.textContent='A consultar…';loadHistory().finally(()=>{b.disabled=false;b.innerHTML='<span>↻</span> Atualizar';const t=$('fs-refresh-result');if(t)t.textContent='Verificados os dados publicados agora. '+(hasFailed?'Histórico indisponível.':'Sem ligação a resultados em direto.');});return;}
});
for(const [id,key] of [['fs-league','league'],['fs-day','day'],['fs-market','market'],['fs-order','order']]){
$(id).addEventListener('change',e=>{if(key==='league'){selectedLeague=e.target.value;host.querySelectorAll('[data-fs-league]').forEach(b=>b.classList.toggle('active',b.dataset.fsLeague===selectedLeague));}
if(key==='day')selectedDay=e.target.value;
if(key==='market')selectedMarket=e.target.value;
if(key==='order')sort=e.target.value;
renderList();});
}
const info=document.createElement('p');info.id='fs-refresh-result';info.className='fs-refresh-note';info.textContent='O botão Atualizar consulta o último arquivo publicado; não obtém resultados ao vivo.';
host.querySelector('.fs-stamp')?.after(info);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selectedGame){$('fs-modal').hidden=true;document.body.classList.remove('fs-modal-open');selectedGame=null;}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();