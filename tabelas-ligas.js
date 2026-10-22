/* Apostas Semanais · tabelas exaustivas por liga, percentagens e últimos 7 jogos.
   Liga-se ao calendário da semana e ao arquivo pré-jogo de resultados.
   As percentagens são estimativas; as formas são resultados encontrados em fontes públicas. */
(function(){
'use strict';
function start(){
  const panel=document.getElementById('view-tables');
  const jsonEl=document.getElementById('data-json');
  if(!panel||!jsonEl)return;
  let D;try{D=JSON.parse(jsonEl.textContent);}catch(e){return;}
  const byId=new Map((D.games||[]).map(g=>[Number(g.id),g]));
  const leagues=Array.isArray(D.leagues)?D.leagues:[];
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pct=p=>typeof p==='number'&&Number.isFinite(p)&&p>=0&&p<=1?(p*100).toFixed(1).replace('.',',')+'%':'—';
  const num=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('pt-PT'):'—';
  const cols=[
    {key:'W1',name:'1',title:'Vitória da equipa da casa',group:'1X2'},
    {key:'X',name:'X',title:'Empate',group:'1X2'},
    {key:'W2',name:'2',title:'Vitória da equipa visitante',group:'1X2'},
    {key:'BTTS',name:'AM',title:'Ambas Marcam — Sim',group:'Golos'},
    {key:'O25',name:'+2,5',title:'Mais de 2,5 golos',group:'Golos'},
    {key:'AND',name:'AM E +2,5',title:'Ambas Marcam E Mais de 2,5',group:'Golos'},
    {key:'OR',name:'AM OU +2,5',title:'Ambas Marcam OU Mais de 2,5',group:'Golos'},
    {key:'O15',name:'+1,5',title:'Mais de 1,5 golos',group:'Golos',extra:true},
    {key:'BTTS_NO',name:'AM Não',title:'Ambas Marcam — Não',group:'Golos',extra:true},
    {key:'C85',name:'Cantos +8,5',title:'Mais de 8,5 cantos',group:'Cantos',extra:true},
    {key:'C95',name:'Cantos +9,5',title:'Mais de 9,5 cantos',group:'Cantos',extra:true},
    {key:'HT1',name:'1.ª C',title:'Vitória da casa na 1.ª parte',group:'1.ª parte',extra:true},
    {key:'HTX',name:'1.ª X',title:'Empate na 1.ª parte',group:'1.ª parte',extra:true},
    {key:'HT2',name:'1.ª F',title:'Vitória da equipa visitante na 1.ª parte',group:'1.ª parte',extra:true},
    {key:'SH1',name:'2.ª C',title:'Vitória da casa na 2.ª parte',group:'2.ª parte',extra:true},
    {key:'SHX',name:'2.ª X',title:'Empate na 2.ª parte',group:'2.ª parte',extra:true},
    {key:'SH2',name:'2.ª F',title:'Vitória da equipa visitante na 2.ª parte',group:'2.ª parte',extra:true}
  ];
  const marketSelect=$('tlg-market');
  if(marketSelect)marketSelect.innerHTML='<option value="date">Data e hora</option>'+cols.map(c=>
    '<option value="'+c.key+'">Maior % · '+esc(c.title)+'</option>').join('');
  const base=new Date(String(D.start)+'T12:00:00Z');
  const weekdays=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(base.getTime()+i*86400000);
    return {date:d.toISOString().slice(0,10),label:weekdays[i]+' '+String(d.getUTCDate()).padStart(2,'0')};
  });
  const daySelect=$('tlg-day');
  if(daySelect)daySelect.innerHTML='<option value="all">Toda a semana</option>'+
     days.map(x=>'<option value="'+x.date+'">'+x.label+'</option>').join('');
  const leagueSelect=$('tlg-league');
  if(leagueSelect)leagueSelect.innerHTML='<option value="all">Todas as 12 competições</option>'+
    leagues.map(l=>'<option value="'+esc(l.code)+'">'+esc(l.flag||'')+' '+esc(l.name)+'</option>').join('');
  const leagueMap=new Map(leagues.map(l=>[l.code,l]));
  let history=null,loading=true,historyError=false,mode='summary',visible=[];
  let displayMode=(window.matchMedia&&window.matchMedia('(max-width:720px)').matches)?'cards':'table';
  const dateKey=g=>{
    if(typeof g.date==='string'&&/^\d{4}-\d\d-\d\d$/.test(g.date))return g.date;
    const n=Number(g.day),d=days.find(x=>Number(x.date.slice(-2))===n);
    return d?.date||D.start;
  };
  function probability(g,key){
    if(!g||g.verified===false)return null;
    const p=g.p||{},first=g.first||{},second=g.second||{};
    const value={
      W1:p.w1,X:p.draw,W2:p.w2,BTTS:p.btts,BTTS_NO:p.no,
      O15:p.o15,O25:p.o25,AND:p.and,OR:p.or,C85:g.c85,C95:g.c95,
      HT1:first.w1,HTX:first.draw,HT2:first.w2,
      SH1:second.w1,SHX:second.draw,SH2:second.w2
    }[key];
    return typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?value:null;
  }
  function latest(g,side){
    const input=history?.byGame?.[g.id]?.[side];
    const source=Array.isArray(input?.results)?input.results:[];
    // Não usar um jogo posterior ao encontro que está a ser analisado.
    const date=dateKey(g);
    const results=source.filter(r=>r&&/^\d{4}-\d\d-\d\d$/.test(r.date||'')&&r.date<date&&
      Number.isInteger(r.gf)&&Number.isInteger(r.ga)&&['V','E','D'].includes(r.outcome))
      .sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
    const gf=results.reduce((a,r)=>a+r.gf,0),ga=results.reduce((a,r)=>a+r.ga,0);
    return {results,gf,ga,n:results.length};
  }
  function formCell(info,name){
    if(!history)return '<td class="tlg-form-td" title="Histórico indisponível"><span class="tlg-na">—</span></td>';
    const tokens=info.results.map(r=>
      '<abbr class="tlg-result tlg-'+r.outcome.toLowerCase()+'" title="'+
      esc(r.date+' · '+(r.venue==='C'?'Casa':'Fora')+' contra '+r.opponent+
      ' · '+r.gf+'-'+r.ga)+'">'+r.outcome+'</abbr>').join('');
    const explain=info.n<7?'<small class="tlg-coverage" title="Resultados que foi possível confirmar no arquivo">'+info.n+'/7 disponíveis</small>':'';
    return '<td class="tlg-form-td"><div class="tlg-results" aria-label="Últimos '+info.n+
      ' resultados de '+esc(name)+'; do mais recente para o mais antigo">'+
      (tokens||'<span class="tlg-na">Sem dados</span>')+'</div>'+explain+'</td>';
  }
  function goalsCell(info){
    if(!history)return '<td class="tlg-goals"><span class="tlg-na">—</span></td>';
    if(!info.n)return '<td class="tlg-goals"><span class="tlg-na">S/dados</span></td>';
    return '<td class="tlg-goals"><div class="tlg-score-duo">'+
      '<b class="tlg-gf" title="Golos marcados">'+num(info.gf)+'</b>'+
      '<span class="tlg-sep">/</span>'+
      '<b class="tlg-ga" title="Golos sofridos">'+num(info.ga)+'</b></div>'+
      '<small>GM / GS · '+info.n+'/7</small></td>';
  }
  function probCell(g,c){
    const p=probability(g,c.key);
    const cls=p===null?'tlg-prob-none':p>=.75?'tlg-prob-strong':
      p>=.60?'tlg-prob-high':p>=.45?'tlg-prob-medium':'tlg-prob-low';
    const label=p===null?'Sem previsão':pct(p);
    return '<td class="tlg-prob'+(c.extra?' tlg-extra':'')+'" title="'+esc(c.title)+
      ' · '+esc(g.home)+' - '+esc(g.away)+' · '+esc(label)+'">'+
      '<span class="tlg-pct-pill '+cls+'">'+esc(label==='Sem previsão'?'—':label)+'</span></td>';
  }
  const tableHead=()=>'<thead><tr class="tlg-header-groups">'+
    '<th colspan="5" scope="colgroup">Jogo e forma recente</th>'+
    '<th colspan="3" scope="colgroup">Resultado 1X2</th>'+
    '<th colspan="6" scope="colgroup">Golos</th>'+
    '<th colspan="2" scope="colgroup">Cantos</th>'+
    '<th colspan="3" scope="colgroup">1.ª parte</th>'+
    '<th colspan="3" scope="colgroup">2.ª parte</th></tr><tr>'+
    '<th class="tlg-team-th" scope="col">Data e jogo</th>'+
    '<th scope="col" title="Golos marcados / sofridos nos últimos sete resultados disponíveis da equipa da casa">Casa<br>GM / GS</th>'+
    '<th scope="col">Últimos 7<br>Casa (V E D)</th>'+
    '<th scope="col" title="Golos marcados / sofridos nos últimos sete resultados disponíveis da equipa visitante">Fora<br>GM / GS</th>'+
    '<th scope="col">Últimos 7<br>Fora (V E D)</th>'+
    cols.map(c=>'<th scope="col"'+(c.extra?' class="tlg-extra"':'')+
      ' title="'+esc(c.title)+'">'+esc(c.name)+'</th>').join('')+'</tr></thead>';
  function gameRow(g){
    const h=latest(g,'home'),a=latest(g,'away'),dt=dateKey(g),time=g.time||'';
    const lg=leagueMap.get(g.league),exploratory=g.modelStatus==='exploratory_uefa';
    const caution=exploratory?'<span class="tlg-warning" title="Modelo exploratório UEFA com amostra pequena, não calibrado">UEFA experimental</span>':
        g.verified===false?'<span class="tlg-unavailable">Sem previsão</span>':'';
    return '<tr><th scope="row" class="tlg-fixture"><div class="tlg-date">'+esc(dt.slice(8,10)+'/'+dt.slice(5,7))+
      ' · '+esc(time)+' <span>PT</span></div>'+
      '<strong><span class="tlg-home">'+esc(g.home)+'</span>'+
      '<span class="tlg-vs" aria-hidden="true">×</span>'+
      '<span class="tlg-away">'+esc(g.away)+'</span></strong>'+
      '<div class="tlg-fixture-actions">'+caution+
      '<button type="button" data-open="'+Number(g.id)+'" class="tlg-detail">Analisar ↗</button></div></th>'+
      goalsCell(h)+formCell(h,g.home)+goalsCell(a)+formCell(a,g.away)+
      cols.map(c=>probCell(g,c)).join('')+
      '</tr>';
  }

  function colorFor(p){
    return p===null?'tlg-prob-none':p>=.75?'tlg-prob-strong':
      p>=.60?'tlg-prob-high':p>=.45?'tlg-prob-medium':'tlg-prob-low';
  }
  const primaryMarkets=cols.filter(c=>!c.extra);
  const moreMarkets=cols.filter(c=>c.extra);
  function pill(p){
    return '<span class="tlg-pct-pill '+colorFor(p)+'">'+pct(p)+'</span>';
  }
  function recentForms(x,name){
    if(!history)return '<span class="tlg-na">Histórico a carregar</span>';
    const results=x.results.map(r=>'<abbr class="tlg-result tlg-'+r.outcome.toLowerCase()+
      '" title="'+esc(r.date+' · '+r.opponent+' · '+r.gf+'–'+r.ga)+'">'+r.outcome+'</abbr>').join('');
    return '<div class="tlg-results" aria-label="Forma recente de '+esc(name)+'">'+
      (results||'<span class="tlg-na">Sem dados</span>')+'</div>'+
      (x.n<7?'<small class="tlg-coverage">Apenas '+x.n+'/7 no arquivo</small>':'');
  }
  function compactTeam(name,record,venue){
    return '<div class="tlg-compact-team"><div class="tlg-compact-team-title"><span class="tlg-venue">'+
      esc(venue)+'</span><strong>'+esc(name)+'</strong></div>'+
      recentForms(record,name)+
      '<div class="tlg-compact-goals"><span>GM <b class="tlg-gf">'+(record.n?num(record.gf):'—')+'</b></span>'+
      '<span>GS <b class="tlg-ga">'+(record.n?num(record.ga):'—')+'</b></span>'+
      '<small>'+(history?record.n+'/7 jogos':'A carregar')+'</small></div></div>';
  }
  function historicalLines(team){
    if(!history||!team.results.length)return '<span class="tlg-na">Resultados não disponíveis</span>';
    return '<ol class="tlg-recent-list">'+team.results.map(r=>
      '<li><span>'+esc(r.date.slice(8,10)+'/'+r.date.slice(5,7))+'</span>'+
      '<abbr class="tlg-result tlg-'+r.outcome.toLowerCase()+'" title="'+
      esc(r.outcome==='V'?'Vitória':r.outcome==='E'?'Empate':'Derrota')+'">'+r.outcome+'</abbr>'+
      '<span class="tlg-opponent">'+esc(r.opponent)+'</span>'+
      '<strong>'+r.gf+'–'+r.ga+'</strong></li>').join('')+'</ol>';
  }
  function cardMetric(g,c){
    return '<div class="tlg-compact-metric"><span title="'+esc(c.title)+'">'+esc(c.name)+'</span>'+
      pill(probability(g,c.key))+'</div>';
  }
  function mobileCard(g){
    const home=latest(g,'home'),away=latest(g,'away'),date=dateKey(g),
      experimental=g.modelStatus==='exploratory_uefa';
    const status=experimental?'<span class="tlg-warning">Modelo UEFA experimental</span>':
      g.verified===false?'<span class="tlg-unavailable">Sem previsão</span>':'';
    const count=moreMarkets.length;
    return '<article class="tlg-mobile-card" data-tlg-mobile-game="'+Number(g.id)+'">'+
      '<div class="tlg-mobile-heading"><span>'+esc(date.slice(8,10)+'/'+date.slice(5,7))+
      ' · '+esc(g.time||'')+' PT</span>'+status+'</div>'+
      '<div class="tlg-compact-teams">'+
      compactTeam(g.home,home,'CASA')+compactTeam(g.away,away,'FORA')+'</div>'+
      '<div class="tlg-compact-market-title">Previsões do jogo <small>Estimativas do modelo</small></div>'+
      '<div class="tlg-compact-markets">'+primaryMarkets.map(c=>cardMetric(g,c)).join('')+'</div>'+
      '<details class="tlg-more"'+(mode==='full'?' open':'')+'><summary>Outros '+count+
      ' mercados <span>Cantos, partes, +1,5 e AM Não</span></summary>'+
      '<div class="tlg-compact-markets tlg-compact-other">'+
      moreMarkets.map(c=>cardMetric(g,c)).join('')+'</div></details>'+
      '<details class="tlg-match-results"><summary>Ver resultados anteriores (até 7 por equipa)</summary>'+
      '<div class="tlg-recent-two"><section><h4>'+esc(g.home)+'</h4>'+historicalLines(home)+'</section>'+
      '<section><h4>'+esc(g.away)+'</h4>'+historicalLines(away)+'</section></div></details>'+
      '<button type="button" class="tlg-mobile-analysis" data-open="'+Number(g.id)+'">'+
      'Analisar jogo e adicionar ao boletim ↗</button></article>';
  }
  function leagueSummary(games){
    const samples=games.flatMap(g=>[latest(g,'home'),latest(g,'away')]).filter(x=>x.n>0);
    const all=games.flatMap(g=>[latest(g,'home'),latest(g,'away')]);
    const totalGames=samples.reduce((a,x)=>a+x.n,0),
      goalsFor=samples.reduce((a,x)=>a+x.gf,0),
      goalsAgainst=samples.reduce((a,x)=>a+x.ga,0);
    const btts=games.map(g=>probability(g,'BTTS')).filter(x=>x!==null);
    const avg=pct(btts.length?btts.reduce((a,b)=>a+b,0)/btts.length:null);
    const rate=(n,d)=>d>0?(n/d).toFixed(2).replace('.',','):'—';
    const cell=(label,value,desc)=>'<div class="tlg-league-stat"><span>'+label+'</span><b>'+value+
      '</b><small>'+desc+'</small></div>';
    return '<div class="tlg-league-stats">'+
      cell('Jogos',num(games.length),'Na seleção atual')+
      cell('Forma últimos 7',history?all.filter(x=>x.n>=7).length+'/'+all.length:'—','Equipas com 7/7 resultados')+
      cell('Golos por jogo',history&&totalGames?rate(goalsFor,totalGames)+' / '+rate(goalsAgainst,totalGames):'—','GM / GS · amostra disponível')+
      cell('AM médio previsto',avg,'Média das estimativas disponíveis')+
      '</div>';
  }
  function drawLeagueTabs(){
    const container=$('tlg-league-tabs');
    if(!container)return;
    const current=leagueSelect?.value||'all',selectedDay=daySelect?.value||'all';
    const filtered=(D.games||[]).filter(g=>selectedDay==='all'||dateKey(g)===selectedDay);
    const counts=new Map(leagues.map(l=>[l.code,filtered.filter(g=>g.league===l.code).length]));
    const button=(id,label,n)=>'<button type="button" data-tlg-league="'+esc(id)+
      '" class="'+(current===id?'active':'')+'" aria-pressed="'+(current===id)+'">'+
      '<span>'+esc(label)+'</span><b>'+n+'</b></button>';
    container.innerHTML=button('all','Todas as ligas',filtered.length)+
      leagues.map(l=>button(l.code,(l.flag||'⚽')+' '+l.name,counts.get(l.code)||0)).join('');
  }
  function drawDisplayButtons(){
    document.querySelectorAll('[data-tlg-display]').forEach(b=>{
      const selected=b.dataset.tlgDisplay===displayMode;
      b.classList.toggle('active',selected);
      b.setAttribute('aria-pressed',String(selected));
    });
  }

  function cmpDate(a,b){return dateKey(a).localeCompare(dateKey(b))||
    String(a.time||'').localeCompare(String(b.time||''))||Number(a.id)-Number(b.id);}
  function candidates(){
    const league=leagueSelect?.value||'all',day=daySelect?.value||'all';
    const search=String($('tlg-search')?.value||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const selected=(D.games||[]).filter(g=>
      (league==='all'||g.league===league)&&(day==='all'||dateKey(g)===day)&&
      (!search||(g.home+' '+g.away+' '+(leagueMap.get(g.league)?.name||'')).normalize('NFD')
      .replace(/[\u0300-\u036f]/g,'').toLowerCase().includes(search)));
    const market=marketSelect?.value||'date';
    if(market==='date')selected.sort(cmpDate);
    else selected.sort((a,b)=>(probability(b,market)??-1)-(probability(a,market)??-1)||cmpDate(a,b));
    return selected;
  }
  function render(){
    const all=candidates();
    visible=all;
    const extra=mode==='full'?'':' tlg-summary';
    const out=$('tlg-tables');
    if(!out)return;
    out.className='tlg-tables'+extra+(displayMode==='cards'?' tlg-show-cards':' tlg-show-table');
    drawLeagueTabs();
    drawDisplayButtons();
    const coverage=all.flatMap(g=>[latest(g,'home').n,latest(g,'away').n]);
    const full=history?coverage.filter(x=>x>=7).length:0;
    const status=loading?'A carregar os resultados anteriores…':
      historyError?'O arquivo de resultados não está disponível. As probabilidades continuam visíveis; GM/GS e forma ficam por preencher.':
      full+' de '+coverage.length+' equipas/jogos com 7 resultados no arquivo';
    $('tlg-count').textContent=all.length+' de '+(D.games||[]).length+' jogos · '+status;
    $('tlg-data-status').textContent=history?
      'GM/GS e sequência V/E/D referem-se exclusivamente aos últimos 7 resultados encontrados ANTES do encontro, incluindo outras competições quando disponíveis. Menos de 7 não significa que a equipa não jogou.':
      'Resultados anteriores: '+(loading?'a carregar…':'indisponíveis neste momento.');
    if(!all.length){
      out.innerHTML='<div class="tlg-empty">Não foram encontrados jogos com estes filtros. Altera a competição, o dia ou a pesquisa.</div>';
      return;
    }
    const chunks=[];
    for(const league of leagues){
      const games=all.filter(g=>g.league===league.code);
      if(!games.length)continue;
      const measured=games.filter(g=>g.verified!==false).length;
      const experimental=games.filter(g=>g.modelStatus==='exploratory_uefa').length;
      const statement=measured+' com probabilidades'+(experimental?' · '+experimental+' estimativas UEFA exploratórias':'');
      chunks.push('<details open class="tlg-league" data-tlg-code="'+esc(league.code)+'">'+
        '<summary><span class="tlg-league-name">'+esc(league.flag||'⚽')+' '+esc(league.name)+'</span>'+
        '<span class="tlg-league-count">'+games.length+' jogos · '+statement+'</span><span class="tlg-chevron" aria-hidden="true">⌄</span></summary>'+
        leagueSummary(games)+
        '<div class="tlg-scroll" role="region" tabindex="0" aria-label="Tabela dos jogos da '+esc(league.name)+'; desliza na horizontal">'+
        '<table class="tlg-table">'+tableHead()+'<tbody>'+games.map(gameRow).join('')+'</tbody></table></div>'+
        '<div class="tlg-mobile-list">'+games.map(mobileCard).join('')+'</div>'+
        '</details>');
    }
    out.innerHTML=chunks.join('');
  }
  function exportCsv(){
    if(!visible.length)return;
    const head=['Data','Hora PT','Liga','Casa','Fora','Casa GM 7','Casa GS 7','Casa jogos','Casa forma VED (recente primeiro)','Fora GM 7','Fora GS 7','Fora jogos','Fora forma VED (recente primeiro)',...cols.map(c=>c.title),'Modelo'];
    const rows=visible.map(g=>{
      const h=latest(g,'home'),a=latest(g,'away'),league=leagueMap.get(g.league)?.name||g.league;
      return [dateKey(g),g.time,league,g.home,g.away,
        history&&h.n?h.gf:'',history&&h.n?h.ga:'',history?h.n:'',
        h.results.map(x=>x.outcome).join(''),history&&a.n?a.gf:'',history&&a.n?a.ga:'',history?a.n:'',
        a.results.map(x=>x.outcome).join(''),
        ...cols.map(c=>{const p=probability(g,c.key);return p===null?'':(p*100).toFixed(1).replace('.',',')+'%';}),
        g.modelStatus|| (g.verified===false?'Sem previsão':'Modelo reportado')];
    });
    const escapeCsv=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
    const output='\ufeff'+[head,...rows].map(row=>row.map(escapeCsv).join(';')).join('\r\n');
    const blob=new Blob([output],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;
    a.download='Apostas_Semanais_Tabelas_'+String(D.start||'semana')+'.csv';
    document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  for(const id of ['tlg-search','tlg-day','tlg-league','tlg-market']){
    const el=$(id);
    if(el)el.addEventListener(id==='tlg-search'?'input':'change',render);
  }
  document.querySelectorAll('[data-tlg-mode]').forEach(button=>button.addEventListener('click',()=>{
    mode=button.dataset.tlgMode==='summary'?'summary':'full';
    document.querySelectorAll('[data-tlg-mode]').forEach(b=>{
      const active=b.dataset.tlgMode===mode;b.classList.toggle('active',active);
      b.setAttribute('aria-pressed',String(active));
    });
    render();
  }));
  $('tlg-league-tabs')?.addEventListener('click',e=>{
    const button=e.target.closest('[data-tlg-league]');
    if(!button||!leagueSelect)return;
    leagueSelect.value=button.dataset.tlgLeague;
    render();
    // Não deslocar automaticamente para o topo durante a seleção.
  });
  document.querySelectorAll('[data-tlg-display]').forEach(button=>button.addEventListener('click',()=>{
    displayMode=button.dataset.tlgDisplay==='cards'?'cards':'table';
    render();
  }));
  $('tlg-export')?.addEventListener('click',exportCsv);
  render();
  // O ficheiro mantém a mesma convenção de nomes utilizada na ficha dos jogos.
  fetch('./dados/ultimos10-'+D.start+'.json',{cache:'no-store'}).then(async response=>{
    if(!response.ok)throw Error('Resultados indisponíveis (HTTP '+response.status+')');
    return response.json();
  }).then(input=>{
    if(input?.period?.start!==D.start||!input.byGame)throw Error('O histórico não corresponde à semana');
    history=input;loading=false;render();
  }).catch(error=>{
    historyError=true;loading=false;render();
    console.warn('Tabelas por liga: histórico indisponível',error);
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();