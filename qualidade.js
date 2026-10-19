
/* Apostas Semanais | Qualidade da amostra, Top 5 por mercado e evolução verificada.
   O índice é cobertura de dados (heurística explícita), NÃO confiança calibrada. */
(function(){
'use strict';
function start(){
  const root=document.getElementById('data-json');
  if(!root)return;
  let D;try{D=JSON.parse(root.textContent)}catch(e){return}
  const games=D.games||[],leagues=Object.fromEntries((D.leagues||[]).map(x=>[x.code,x]));
  const gameById=new Map(games.map(g=>[Number(g.id),g]));
  const $=id=>document.getElementById(id);
  const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmtPct=x=>Number.isFinite(x)?(x*100).toFixed(1).replace('.',',')+'%':'—';
  const fmtOdd=x=>Number.isFinite(x)&&x>0?(1/x).toFixed(2).replace('.',','):'—';
  // A escolha no Top 5 corresponde exatamente ao mercado ativo nos chips.
  const keys={
    BTTS:'Ambas marcam',BTTS_NO:'Ambas não marcam',AND:'Ambas E +2,5',
    OR:'Ambas OU +2,5',O25:'Mais de 2,5',O15:'Mais de 1,5',
    W1:'Vitória da casa',X:'Empate',W2:'Vitória fora',
    C85:'Mais de 8,5 cantos',C95:'Mais de 9,5 cantos',
    HT1:'Casa vence 1.ª parte',HTX:'Empate 1.ª parte',HT2:'Fora vence 1.ª parte',
    SH1:'Casa vence 2.ª parte',SHX:'Empate 2.ª parte',SH2:'Fora vence 2.ª parte'
  };
  const marketGroups=[
    {id:'BTTS',name:'Ambas marcam',keys:['BTTS']},
    {id:'BTTS_NO',name:'Ambas não marcam',keys:['BTTS_NO']},
    {id:'O25',name:'Mais de 2,5 golos',keys:['O25']},
    {id:'AND',name:'Ambas E +2,5',keys:['AND']},
    {id:'OR',name:'Ambas OU +2,5',keys:['OR']},
    {id:'O15',name:'Mais de 1,5 golos',keys:['O15']},
    {id:'W1',name:'Vitória da casa',keys:['W1']},
    {id:'X',name:'Empate',keys:['X']},
    {id:'W2',name:'Vitória fora',keys:['W2']},
    {id:'1X2',name:'1X2 · Casa, empate ou fora',keys:['W1','X','W2'],selectedOnly:true},
    {id:'C85',name:'Cantos +8,5',keys:['C85']},
    {id:'C95',name:'Cantos +9,5',keys:['C95']},
    {id:'HT1',name:'Casa vence 1.ª parte',keys:['HT1']},
    {id:'HTX',name:'Empate 1.ª parte',keys:['HTX']},
    {id:'HT2',name:'Fora vence 1.ª parte',keys:['HT2']},
    {id:'SH1',name:'Casa vence 2.ª parte',keys:['SH1']},
    {id:'SHX',name:'Empate 2.ª parte',keys:['SHX']},
    {id:'SH2',name:'Fora vence 2.ª parte',keys:['SH2']}
  ];
  const valid=v=>typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=1;
  function prop(g,k){
    if(!g||g.verified===false)return NaN;
    const p=g.p||{},a=g.first||{},b=g.second||{};
    const v=({BTTS:p.btts,BTTS_NO:p.no,AND:p.and,OR:p.or,O25:p.o25,O15:p.o15,W1:p.w1,X:p.draw,W2:p.w2,C85:g.c85,C95:g.c95,HT1:a.w1,HTX:a.draw,HT2:a.w2,SH1:b.w1,SHX:b.draw,SH2:b.w2})[k];
    return valid(v)?v:NaN;
  }
  function matchDay(g){
    if(typeof g.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(g.date))return g.date;
    const p=String(D.start||'').split('-');
    if(p.length!==3)return '';
    const day=Number(g.day),d=new Date(Date.UTC(Number(p[0]),Number(p[1])-1,day,12));
    return Number.isFinite(day)&&day>0?d.toISOString().slice(0,10):'';
  }
  const money=v=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v);
  const byId=id=>gameById.get(Number(id));
  function info(g){
    if(!g||g.verified===false)return {score:null,label:'Por avaliar',detail:'Sem previsão fundamentada'};
    const count=x=>Array.isArray(x)&&Number.isFinite(Number(x[0]))?Math.max(0,Number(x[0])):0;
    const recent=x=>Array.isArray(x)&&x.length>=3?[x[0],x[1],x[2]].reduce((a,b)=>a+(Number(b)||0),0):0;
    const h=count(g.fullH),a=count(g.fullA),home=count(g.venueH),away=count(g.venueA);
    let s=0;
    // Pesos documentados: amostra global 25, casa/fora 25, forma 10, mercados 15,
    // xG 10, contexto 10, confrontos verificados 5.
    s+=25*(Math.min(h,10)+Math.min(a,10))/20;
    s+=25*(Math.min(home,5)+Math.min(away,5))/10;
    s+=10*(Math.min(recent(g.formH),4)+Math.min(recent(g.formA),4))/8;
    const probs=[g.p?.w1,g.p?.draw,g.p?.w2,g.p?.o25,g.p?.btts,g.c85];
    s+=15*probs.filter(valid).length/probs.length;
    const xg=(Array.isArray(g.xg)?g.xg.length>=2&&g.xg.every(x=>Number.isFinite(x)):
      Number.isFinite(g.xgHome)&&Number.isFinite(g.xgAway));
    if(xg)s+=10;
    if(g.contextVerified===true&&Array.isArray(g.injuries)&&Array.isArray(g.suspensions))s+=10;
    if(g.h2h&&g.h2h.source&&Number.isFinite(g.h2h.homeWins)&&Number.isFinite(g.h2h.awayWins))s+=5;
    const score=Math.min(100,Math.max(0,Math.round(s)));
    const label=score>=80?'Boa cobertura':score>=65?'Cobertura parcial':score>=45?'Dados limitados':'Amostra curta';
    return {score,label,detail:h+' jogos equipa casa, '+a+' jogos equipa fora; recortes casa/fora '+home+'/'+away+'. O índice mede presença e quantidade de dados, não é probabilidade de acertar.'};
  }
  window.ApostasQualidade={info,probability:prop,matchDay}; // API informativa, sem prometer precisão.
  function qualityBadge(g){
    const r=info(g);
    return r.score===null?'<span class="qa-index qa-missing">Sem previsão</span>':
      '<span class="qa-index" title="'+escape(r.detail)+'"><strong>Dados '+r.score+'/100</strong> · '+escape(r.label)+'</span>';
  }
  function attachBadges(node,selector,find,locate){
    if(!node)return;
    const paint=()=>{
      node.querySelectorAll(selector).forEach(card=>{
        if(card.querySelector('.qa-index'))return;
        const g=find(card);
        if(!g)return;
        const slot=locate(card);
        if(slot)slot.insertAdjacentHTML('beforeend',qualityBadge(g));
      });
    };
    paint();
    new MutationObserver(paint).observe(node,{childList:true});
  }
  attachBadges($('game-list'),'.game-card',c=>byId(c.querySelector('[data-open]')?.dataset.open),
    c=>c.querySelector('.game-footer')||c);
  attachBadges($('opening-games'),'.game-card',c=>byId(c.querySelector('[data-open]')?.dataset.open),
    c=>c.querySelector('.game-footer')||c);
  attachBadges($('as-smart-ranks'),'.as-choice',c=>byId(c.querySelector('[data-add-slip]')?.dataset.game),
    c=>c.querySelector('.as-choice-nums')||c);
  attachBadges($('modal-content'),'.sheet-title',()=>null,()=>null);
  const modalBody=$('modal-content');
  if(modalBody){
    const paint=()=>{
      if(modalBody.querySelector('.qa-modal'))return;
      const title=$('modal-title')?.textContent||'';
      const g=games.find(g=>g.home+' vs '+g.away===title);
      if(!g)return;
      const r=info(g);
      const panel=document.createElement('div');panel.className='qa-modal';
      panel.innerHTML='<b>Qualidade da informação: '+(r.score===null?'por avaliar':r.score+'/100')+'</b><p>'+escape(r.detail)+
        '</p><small>Avaliação de cobertura de dados. Não é uma taxa de sucesso nem uma probabilidade calibrada.</small>';
      modalBody.prepend(panel);
    };
    new MutationObserver(paint).observe(modalBody,{childList:true});
    paint();
  }
  const method=$('view-method')?.querySelector('.method-layout');
  if(method&&!$('qa-method-card')){
    const m=document.createElement('div');
    m.id='qa-method-card';m.className='method-card';
    m.innerHTML='<h3>Índice de cobertura dos dados (0–100)</h3><p>Este índice <b>não mede a probabilidade de acertar</b>. É uma heurística de disponibilidade de dados: até 25 pontos pela amostra da época (até 10 jogos por equipa); 25 pelos jogos em casa/fora (até 5 em cada); 10 pela forma recente; 15 pelos principais mercados do modelo; 10 por xG documentado; 10 por lesões/suspensões verificadas; e 5 por confrontos diretos com fonte. Não ter esses dados reduz a cobertura. A calibração só será avaliada após resultados reais.</p><p><b>Odd justa</b> = 1/probabilidade do modelo, não a cotação de uma casa. A odd real mínima para registar um boletim é 1,20, inserida manualmente. Uma aposta só teria valor esperado estimado positivo se a probabilidade fosse validada e p × odd real &gt; 1.</p>';
    method.append(m);
  }
  let chosenGroup='ALL',topFiveSection=null;
  function mountTopFive(){
    if($('qa-top5'))return;
    const choices=$('view-rank'),bar=$('as-datebar-choices');
    if(!choices||!bar)return;
    const section=document.createElement('section');
    section.id='qa-top5';section.className='qa-top5';
    section.innerHTML='<div class="qa-top5-head"><div><span class="eyebrow">Seleção estatística por mercado</span><h2>Top 5 do dia</h2><p id="qa-top5-desc">Prognósticos ordenados por probabilidade, com índice de cobertura dos dados.</p></div><div class="qa-top5-select"><label for="qa-top5-group">Mostrar</label><select id="qa-top5-group"><option value="ALL">Todos os mercados</option>'+marketGroups.map(g=>'<option value="'+g.id+'">'+escape(g.name)+'</option>').join('')+'</select></div></div><div id="qa-top5-cards" class="qa-top5-groups"></div>';
    bar.after(section);
    $('qa-top5-group').addEventListener('change',e=>{
      const filter=$('as-market');
      // Alterar o menu Mostrar atualiza também o filtro e os botões rápidos.
      if(filter && Array.from(filter.options).some(opt=>opt.value===e.target.value)){
        filter.value=e.target.value;
        filter.dispatchEvent(new Event('change',{bubbles:true}));
      }else{
        chosenGroup=e.target.value;
        renderTopFive();
      }
    });
    topFiveSection=section;
    syncMarketAndRender();
  }
  function getDay(){
    const active=$('as-datebar-choices')?.querySelector('[data-as-day].active');
    return active?.dataset.asDay||'ALL';
  }
  function getFilters(){
    return {day:getDay(),min:Number($('as-min')?.value)||0,league:$('as-league')?.value||'ALL',fair:Number($('as-fair')?.value)||0};
  }
  function groupOptions(group,filters){
    const all=games.filter(g=>g.verified!==false&&(filters.day==='ALL'||matchDay(g)===filters.day)&&(filters.league==='ALL'||g.league===filters.league));
    const arr=all.flatMap(g=>group.keys.map(k=>{
      const p=prop(g,k);
      return Number.isFinite(p)&&p*100+1e-7>=filters.min&&(filters.fair<=0||(1/p)+1e-8>=filters.fair)?{g,k,p,quality:info(g)}:null;
    }).filter(Boolean));
    arr.sort((a,b)=>b.p-a.p||b.quality.score-a.quality.score);
    const seen=new Set();
    return arr.filter(row=>{if(seen.has(row.g.id))return false;seen.add(row.g.id);return true;}).slice(0,5);
  }
  function syncMarketAndRender(){
    const market=$('as-market')?.value || 'ALL';
    chosenGroup=(market==='ALL'||marketGroups.some(g=>g.id===market))?market:'ALL';
    const selector=$('qa-top5-group');
    if(selector && selector.value!==chosenGroup)selector.value=chosenGroup;
    renderTopFive();
  }
  function renderTopFive(){
    if(!topFiveSection)return;
    const filters=getFilters(),name=filters.day==='ALL'?'semana de '+(D.start||'')+' a '+(D.end||''):filters.day;
    const desc=$('qa-top5-desc');
    desc.textContent='Top 5 por mercado — '+name+' · previsão do modelo ≥'+filters.min+'%. Não são odds reais nem apostas garantidas.';
    const groups=marketGroups.filter(g=>chosenGroup===g.id||(chosenGroup==='ALL'&&!g.selectedOnly));
    $('qa-top5-cards').innerHTML=groups.map(group=>{
      const rows=groupOptions(group,filters);
      return '<div class="qa-group"><h3>'+escape(group.name)+' <small>'+rows.length+' resultado(s)</small></h3>'+
      (rows.length?'<div class="qa-five-cards">'+rows.map((x,i)=>
        '<article class="qa-five"><div class="qa-five-head"><span class="qa-five-rank">#'+(i+1)+'</span><span>'+escape(leagues[x.g.league]?.name||x.g.league)+' · '+escape(matchDay(x.g).slice(5))+'</span></div>'+
        '<strong>'+escape(x.g.home)+' – '+escape(x.g.away)+'</strong>'+
        '<div class="qa-five-numbers"><b>'+fmtPct(x.p)+'</b><span>Odd justa '+fmtOdd(x.p)+'</span></div>'+qualityBadge(x.g)+
        '<small>'+escape(keys[x.k])+' · Odd comercial por preencher no boletim</small>'+
        '<div class="as-add-actions">'+[1,2,3].map(n=>'<button type="button" data-add-slip="'+n+'" data-game="'+x.g.id+'" data-market="'+escape(x.k)+'">+ Aposta '+n+'</button>').join('')+'</div></article>'
      ).join('')+'</div>':'<div class="qa-empty">Sem prognósticos deste mercado que cumpram os filtros. Não foram criados valores artificiais.</div>')+'</div>';
    }).join('');
  }
  mountTopFive();
  document.addEventListener('click',event=>{
    if(event.target.closest('[data-as-market]')){
      // boletins.js atualiza o filtro no clique. Refletir essa seleção no Top 5.
      queueMicrotask(syncMarketAndRender);
    }else if(event.target.closest('[data-as-day]')||event.target.closest('[data-go="rank"]')){
      queueMicrotask(renderTopFive);
    }
  });
  document.addEventListener('change',event=>{
    if(event.target.id==='as-market')queueMicrotask(syncMarketAndRender);
    else if(['as-min','as-fair','as-league','rank-filter','day-filter'].includes(event.target.id))
      queueMicrotask(renderTopFive);
  });
  async function loadModelHistory(){
    const panel=$('qa-model-audit');
    if(!panel)return;
    try{
      const [a,b]=await Promise.all([
        fetch('./historico/modelo.json',{cache:'no-store'}),
        fetch('./historico/desempenho.json',{cache:'no-store'})
      ]);
      if(!a.ok||!b.ok)throw Error('Fontes de histórico indisponíveis');
      const model=await a.json(),perf=await b.json(),hist=Array.isArray(model.history)?model.history:[],
            weeks=Array.isArray(perf.weeks)?perf.weeks:[];
      const confirmed=weeks.filter(x=>Number.isFinite(Number(x.brier))&&Number.isFinite(Number(x.games_evaluated))&&Number(x.games_evaluated)>0);
      const changes=hist.filter(x=>x.validated===true);
      let chart='<p class="qa-pending">Ainda não há resultados semanais suficientes para desenhar uma evolução. A primeira medição será feita após os jogos terminarem.</p>';
      if(confirmed.length>=2){
        const pts=confirmed.map((w,i)=>({x:35+(i*430/(confirmed.length-1)),v:Number(w.brier),label:String(w.week||'').slice(5)}));
        const high=Math.max(.25,...pts.map(p=>p.v))*1.1,low=0;
        chart='<div class="qa-chart-wrap"><svg role="img" aria-label="Evolução do Brier Score por semana; menor é melhor" viewBox="0 0 510 180" preserveAspectRatio="xMidYMid meet"><line x1="35" y1="14" x2="35" y2="151" stroke="#aec1cc"/><line x1="35" y1="151" x2="490" y2="151" stroke="#aec1cc"/>'+
          '<polyline points="'+pts.map(p=>p.x+','+(151-128*(p.v-low)/(high-low))).join(' ')+'" fill="none" stroke="#148976" stroke-width="2.5"/>'+
          pts.map(p=>'<circle cx="'+p.x+'" cy="'+(151-128*(p.v-low)/(high-low))+'" r="4.5" fill="#148976"><title>'+escape(p.label)+': Brier '+p.v.toFixed(3)+'</title></circle>').join('')+
          '<text x="4" y="18" font-size="11" fill="#718696">'+high.toFixed(2)+'</text><text x="9" y="153" font-size="11" fill="#718696">0</text></svg></div>';
      }
      panel.innerHTML='<h2>Evolução probabilística verificada</h2><div class="qa-audit-row"><div><small>Versão em uso</small><b>'+escape(model.version||'não indicada')+'</b></div>'+
        '<div><small>Semanas com Brier avaliado</small><b>'+confirmed.length+'</b></div><div><small>Alterações com validação</small><b>'+changes.length+'</b></div></div>'+
        '<p>'+escape(model.summary||'Ainda sem comparação histórica validada.')+'</p>'+chart+
        '<small>O Brier Score mede o erro das probabilidades; quanto menor, melhor. Uma subida na taxa de acerto não demonstra, por si só, melhoria do modelo.</small>'+
        (changes.length?'<h3>Alterações aprovadas com teste fora da amostra</h3><ul>'+changes.slice(-5).map(x=>'<li>'+escape(x.date||'')+' · '+escape(x.version||'')+'</li>').join('')+'</ul>':'<p class="qa-pending">Ainda não foi aprovada nenhuma alteração ao modelo com evidência fora da amostra.</p>');
    }catch(e){panel.innerHTML='<h2>Evolução probabilística</h2><p>Não foi possível consultar o histórico publicado. Não serão apresentados números de desempenho por estimativa.</p>';}
  }
  const history=$('view-history');
  if(history&&!$('qa-model-audit')){
    const panel=document.createElement('section');panel.id='qa-model-audit';panel.className='qa-model-audit';
    panel.innerHTML='<h2>Evolução probabilística</h2><p>A carregar histórico verificado…</p>';
    history.append(panel);loadModelHistory();
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
