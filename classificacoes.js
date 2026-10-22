/* Apostas Semanais — classificações 2026/27 e forma dos últimos sete jogos.
   Classificações reconstruídas com resultados públicos, não tabelas oficiais. */
(function(){
'use strict';
function start(){
  const area=document.getElementById('table-list');
  const scroll=area?.querySelector('.table-scroll');
  const dataEl=document.getElementById('data-json');
  if(!area||!scroll||!dataEl)return;
  let D;
  try{D=JSON.parse(dataEl.textContent)}catch(e){return}
  const byGame=new Map((D.games||[]).map(g=>[Number(g.id),g]));
  const leagues=Array.isArray(D.leagues)?D.leagues:[];
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const canonical=s=>String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().replace(/[^a-z0-9]/g,'');
  const leagueLabel=code=>leagues.find(l=>l.code===code)?.name||code;
  let data=null,loadError='',leagueChoice='PT',focusedGame=null,chosenTeam=null;
  const outer=document.createElement('div');
  outer.className='as-table-with-standings';
  scroll.parentNode.insertBefore(outer,scroll);
  outer.append(scroll);
  const aside=document.createElement('aside');
  aside.className='as-league-standings';
  aside.id='as-league-standings';
  aside.setAttribute('aria-label','Classificação e forma da competição');
  aside.innerHTML=
    '<div class="as-standing-top"><span class="as-standing-eyebrow">Classificação 2026/27</span>'+
    '<h3>Classificação da liga</h3>'+
    '<label for="as-standings-league">Competição</label>'+
    '<select id="as-standings-league">'+leagues.map(l=>
      '<option value="'+esc(l.code)+'">'+esc(l.name)+'</option>').join('')+'</select>'+
    '<p id="as-standings-meta" class="as-standings-meta">A carregar resultados…</p></div>'+
    '<div id="as-standings-highlight" class="as-standings-highlight" hidden></div>'+
    '<div class="as-standings-scroll" tabindex="0" role="region" aria-label="Tabela classificativa com scroll">'+
    '<table class="as-standings-table"><thead><tr>'+
    '<th scope="col">#</th><th scope="col">Equipa</th><th scope="col" title="Jogos realizados">J</th>'+
    '<th scope="col" title="Pontos">Pts</th><th scope="col" title="Golos marcados">GM</th>'+
    '<th scope="col" title="Golos sofridos">GS</th>'+
    '<th scope="col" title="Últimos até 7 jogos da competição, do mais recente ao mais antigo">Últ. 7</th>'+
    '</tr></thead><tbody id="as-standings-body"></tbody></table></div>'+
    '<div class="as-standings-foot"><div class="as-standings-key">'+
    '<span><b class="as-form-v">V</b> Vitória</span>'+
    '<span><b class="as-form-e">E</b> Empate</span>'+
    '<span><b class="as-form-d">D</b> Derrota</span></div>'+
    '<p>Classificação calculada a partir dos resultados disponíveis, não oficial. Ordenação por pontos, diferença de golos e golos marcados; critérios oficiais de desempate podem ser diferentes.</p>'+
    '<a id="as-standings-source" target="_blank" rel="noopener noreferrer" href="https://github.com/oladeeayo/open-matchday">Consultar fonte dos resultados ↗</a></div>';
  outer.append(aside);
  function currentFilter(){
    const chip=document.querySelector('#view-games [data-chip].active');
    return chip?.dataset.chip||'all';
  }
  function formBoxes(recent,max=7){
    if(!Array.isArray(recent)||!recent.length)return '<span class="as-standings-na">—</span>';
    return recent.slice(0,max).map(r=>{
      const name=r.result==='V'?'Vitória':r.result==='E'?'Empate':'Derrota';
      return '<abbr class="as-form as-form-'+(r.result||'').toLowerCase()+
        '" title="'+esc(r.date+' · '+r.opp+' · '+r.score+' · '+name)+'">'+
        esc(r.result)+'</abbr>';
    }).join('');
  }
  function gameTeamRecord(g,side){
    if(!data||!g)return null;
    const lg=data.leagues[g.league];if(!lg)return null;
    const name=side==='home'?g.home:g.away;
    const id=lg.fixtureAliases[name]||canonical(name);
    return lg.standings.find(t=>t.key===id)||null;
  }
  function focusText(game){
    const panel=$('as-standings-highlight');
    if(!panel)return;
    if(!game||!data||game.league!==leagueChoice){panel.hidden=true;return;}
    const h=gameTeamRecord(game,'home'),a=gameTeamRecord(game,'away');
    if(!h||!a){panel.hidden=true;return;}
    panel.hidden=false;
    const small=t=>'<div class="as-standings-focus-team"><strong>'+esc(t.name)+'</strong>'+
      '<span>'+t.rank+'.º · '+t.pts+' pts · '+t.gf+' GM / '+t.ga+' GS</span>'+
      '<div class="as-standings-form">'+formBoxes(t.recent)+'</div></div>';
    panel.innerHTML='<b>Equipas do jogo</b>'+small(h)+small(a);
  }
  function updateFocusedRows(){
    const selected=byGame.get(Number(focusedGame));
    const codes=new Set();
    if(selected?.league===leagueChoice){
      const x=gameTeamRecord(selected,'home'),y=gameTeamRecord(selected,'away');
      if(x)codes.add(x.key);if(y)codes.add(y.key);
    }
    if(chosenTeam)codes.add(chosenTeam);
    $('as-standings-body')?.querySelectorAll('[data-standings-team]').forEach(row=>{
      row.classList.toggle('as-standings-team-selected',codes.has(row.dataset.standingsTeam));
    });
    const ids=new Set();
    if(chosenTeam && data?.leagues[leagueChoice]){
      for(const g of D.games||[]){
        if(g.league!==leagueChoice)continue;
        const team1=gameTeamRecord(g,'home'),team2=gameTeamRecord(g,'away');
        if(team1?.key===chosenTeam||team2?.key===chosenTeam)ids.add(g.id);
      }
    }
    $('game-rows')?.querySelectorAll('tr').forEach(row=>{
      const gameId=Number(row.querySelector('[data-open]')?.dataset.open);
      row.classList.toggle('as-standings-game-selected',ids.has(gameId));
    });
    focusText(selected);
  }
  function render(){
    const lg=data?.leagues?.[leagueChoice],root=$('as-standings-body');
    if(!root)return;
    $('as-standings-league').value=leagueChoice;
    const meta=$('as-standings-meta');
    if(!lg){
      meta.textContent=loadError||'A carregar classificação…';
      root.innerHTML='<tr><td colspan="7" class="as-standings-empty">'+
        esc(loadError||'A carregar dados…')+'</td></tr>';
      $('as-standings-highlight').hidden=true;return;
    }
    meta.textContent=lg.teams+' equipas · '+lg.fixturesUsed+
      ' jogos com resultado · até '+data.calculatedUntil.split('-').reverse().join('/')+
      ' · fonte agregada';
    $('as-standings-source').href=lg.source;
    root.innerHTML=lg.standings.map(team=>{
      const title=team.w+'V '+team.d+'E '+team.l+'D · DG '+(team.gd>0?'+':'')+team.gd+
        ' · '+team.recent.length+'/7 jogos disponíveis';
      return '<tr data-standings-team="'+esc(team.key)+'" title="'+esc(title)+'">'+
        '<td class="as-st-rank">'+team.rank+'</td>'+
        '<th scope="row"><button type="button" class="as-st-name" data-stand-team="'+
          esc(team.key)+'" title="Destacar jogos da equipa">'+esc(team.name)+'</button></th>'+
        '<td>'+team.p+'</td>'+
        '<td class="as-st-points">'+team.pts+'</td>'+
        '<td class="as-st-gf">'+team.gf+'</td>'+
        '<td class="as-st-ga">'+team.ga+'</td>'+
        '<td><span class="as-standings-form" aria-label="Forma recente: '+esc(team.recent.map(x=>x.result).join(''))+'">'+
          formBoxes(team.recent)+'</span>'+
        (team.recent.length<7?'<small class="as-st-small">'+team.recent.length+'/7</small>':'')+
        '</td></tr>';
    }).join('');
    updateFocusedRows();
  }
  function chooseLeague(code,updateMain=false){
    if(!data?.leagues?.[code]&&!leagues.some(l=>l.code===code))return;
    leagueChoice=code;
    chosenTeam=null;
    if(focusedGame && byGame.get(Number(focusedGame))?.league!==code)focusedGame=null;
    if(updateMain){
      const chip=Array.from(document.querySelectorAll('#view-games [data-chip]'))
        .find(b=>b.dataset.chip===code);
      if(chip)chip.click();
    }
    render();
  }
  function syncWithMain(){
    const active=currentFilter();
    if(data&&data.leagues[active]&&active!==leagueChoice)chooseLeague(active);
    else if(data&&!data.leagues[leagueChoice])chooseLeague(leagues[0]?.code||'PT');
  }
  $('as-standings-league')?.addEventListener('change',event=>{
    chooseLeague(event.target.value,true);
  });
  $('as-standings-body')?.addEventListener('click',event=>{
    const b=event.target.closest('[data-stand-team]');
    if(!b)return;
    chosenTeam=chosenTeam===b.dataset.standTeam?null:b.dataset.standTeam;
    updateFocusedRows();
  });
  const body=$('game-rows');
  body?.addEventListener('pointerover',e=>{
    const row=e.target.closest('tr');
    if(!row)return;
    const match=row.querySelector('[data-open]'),id=Number(match?.dataset.open);
    if(!Number.isInteger(id)||!byGame.has(id)||focusedGame===id)return;
    const game=byGame.get(id);
    focusedGame=id;
    if(game.league!==leagueChoice)chooseLeague(game.league,false);
    else updateFocusedRows();
  });
  body?.addEventListener('focusin',e=>{
    const id=Number(e.target.closest('tr')?.querySelector('[data-open]')?.dataset.open);
    if(!byGame.has(id))return;
    const game=byGame.get(id);
    focusedGame=id;
    if(game.league!==leagueChoice)chooseLeague(game.league,false);
    else updateFocusedRows();
  });
  if(body){
    // A tabela é redesenhada por filtros e boletins; observa só substituições
    // de linhas, não alterações às células para evitar loops.
    new MutationObserver(()=>{syncWithMain();updateFocusedRows();})
      .observe(body,{childList:true});
  }
  document.addEventListener('click',event=>{
    const league=event.target.closest('#view-games [data-chip]');
    if(league&&league.dataset.chip!=='all')queueMicrotask(()=>chooseLeague(league.dataset.chip,false));
  });
  render();
  const status=document.createElement('p');
  status.className='as-standings-intro';
  status.textContent='Classificação da competição selecionada, com golos marcados e sofridos, pontos e V/E/D nos últimos até 7 jogos. Seleciona uma equipa para destacar os jogos na tabela.';
  area.querySelector('.table-hint')?.after(status);
  fetch('./dados/classificacoes-2026-10-22.json',{cache:'no-store'}).then(response=>{
    if(!response.ok)throw Error('Fonte indisponível ('+response.status+')');
    return response.json();
  }).then(documentData=>{
    if(documentData.schema!==1||!documentData.leagues||documentData.season!=='2026/27')throw Error('Formato de classificação incompatível');
    data=documentData;
    syncWithMain();
    render();
  }).catch(e=>{
    loadError='Não foi possível carregar a classificação. Os prognósticos continuam disponíveis.';
    console.warn('Apostas Semanais — classificação:',e);
    render();
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();