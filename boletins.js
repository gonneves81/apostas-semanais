
/* Apostas Semanais — escolhas percentuais e construtor de três boletins.
   Os preços da casa são introduzidos pelo utilizador. A odd justa é apenas 1/p. */
(function () {
  'use strict';
  const start = () => {
    const dataNode = document.getElementById('data-json');
    if (!dataNode || document.getElementById('as-ticket-dock')) return;
    let D;
    try { D = JSON.parse(dataNode.textContent); } catch (e) { return; }
    if (!Array.isArray(D.games) || !Array.isArray(D.leagues)) return;
    const $ = id => document.getElementById(id);
    const ALL = D.games;
    const byId = new Map(ALL.map(g => [Number(g.id), g]));
    const byLeague = new Map(D.leagues.map(l => [l.code, l]));
    const MARKETS = [
      ['W1','Vitória casa'], ['X','Empate'], ['W2','Vitória fora'],
      ['BTTS','Ambas marcam · Sim'], ['BTTS_NO','Ambas marcam · Não'],
      ['O15','Mais de 1,5 golos'], ['O25','Mais de 2,5 golos'],
      ['AND','Ambas marcam E +2,5'], ['OR','Ambas marcam OU +2,5'],
      ['C85','Mais de 8,5 cantos'], ['C95','Mais de 9,5 cantos'],
      ['HT1','Casa vence 1.ª parte'], ['HTX','Empate 1.ª parte'], ['HT2','Fora vence 1.ª parte'],
      ['SH1','Casa vence 2.ª parte'], ['SHX','Empate 2.ª parte'], ['SH2','Fora vence 2.ª parte']
    ];
    const marketName = Object.fromEntries(MARKETS);
    const storageKey = 'apostas_semanal_slips_' + (D.start || 'semana') + '_' + (D.end || '');
    const settingsKey = 'apostas_semanal_filtro_v2';
    let minimum = 70, fairMinimum = 0, active = 1, expanded = false, pageLimit = 30;
    let persistAvailable = true, lastOpenGame = null, lastOpenMarketScope = 'overview', toastTimer = null;
    let slips = {1:{stake:'',items:[]},2:{stake:'',items:[]},3:{stake:'',items:[]}};

    // Calendar state shared between Escolhas and Todos os jogos.
    let choiceDay='ALL', choiceSort='prob';
    const dayNames=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];
    const baseStart=String(D.start||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const weekDays=baseStart?Array.from({length:7},(_,i)=>{
      const d=new Date(Date.UTC(Number(baseStart[1]),Number(baseStart[2])-1,Number(baseStart[3])+i,12));
      return {key:d.toISOString().slice(0,10),day:d.getUTCDate(),label:dayNames[i]+' '+String(d.getUTCDate()).padStart(2,'0')};
    }):[];
    function todayInPortugal(){
      try{
        const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Lisbon',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
        const val=k=>parts.find(x=>x.type===k)?.value||'';
        return val('year')+'-'+val('month')+'-'+val('day');
      }catch(e){return new Date().toISOString().slice(0,10);}
    }
    const ptToday=todayInPortugal();
    const marketChips=[
      ['ALL','Todos'],['BTTS','AM'],['O25','+2,5'],['AND','AM e +2,5'],['OR','AM ou +2,5'],
      ['O15','+1,5'],['W1','Casa'],['X','Empate'],['W2','Fora'],['1X2','1X2'],
      ['C85','Cantos +8,5'],['C95','Cantos +9,5'],
      ['HT1','Casa 1.ª p.'],['HT2','Fora 1.ª p.'],['SH1','Casa 2.ª p.'],['SH2','Fora 2.ª p.']
    ];
    function dateKey(g){
      if(typeof g.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(g.date))return g.date;
      return weekDays.find(d=>d.day===Number(g.day))?.key||'';
    }
    function byKickoff(a,b){
      return dateKey(a.g).localeCompare(dateKey(b.g))||
        String(a.g.time||'').localeCompare(String(b.g.time||''))||
        String(a.g.home||'').localeCompare(String(b.g.home||''),'pt');
    }
    function dateOptions(scope){
      const league=scope==='choices'?($('as-league')?.value||'ALL'):'ALL';
      const days=weekDays.map(d=>{
        const count=ALL.filter(g=>dateKey(g)===d.key&&(league==='ALL'||g.league===league)).length;
        return { ...d,count };
      });
      const selected=choiceDay;
      const today=days.find(d=>d.key===ptToday);
      const pill=(key,text,count)=>'<button type="button" data-as-day="'+key+'" aria-pressed="'+(selected===key?'true':'false')+'" class="'+(selected===key?'active':'')+'">'+text+(count!==undefined?'<span>'+count+'</span>':'')+'</button>';
      return '<div class="as-calendar-main"><div class="as-daybar-head"><b>Jogos por dia</b><div class="as-sort-toggle" aria-label="Ordenação">'+
        '<button type="button" data-as-sort="date" data-as-sort-scope="'+scope+'" class="'+((scope==='choices'?choiceSort:($('order-filter')?.value||'date'))==='date'?'active':'')+'">Por data</button>'+
        '<button type="button" data-as-sort="prob" data-as-sort-scope="'+scope+'" class="'+((scope==='choices'?choiceSort:($('order-filter')?.value||'date'))==='prob'?'active':'')+'">Por probabilidade</button>'+
        '</div></div>'+
        '<div class="as-day-pills" role="group" aria-label="Filtrar jogos por dia">'+
        pill('ALL','Toda a semana',ALL.filter(g=>league==='ALL'||g.league===league).length)+
        (today?pill(today.key,'Hoje · '+today.label,today.count):'')+
        days.map(d=>pill(d.key,d.label,d.count)).join('')+'</div></div>';
    }
    function drawDateBars(){
      for(const scope of ['choices','games']){
        const node=$('as-datebar-'+scope);
        if(!node)continue;
        node.innerHTML=dateOptions(scope);
        if(scope==='choices'){
          const current=$('as-market')?.value||'ALL';
          node.insertAdjacentHTML('beforeend','<div class="as-market-chips" role="group" aria-label="Filtrar por mercado">'+
            marketChips.map(([k,label])=>'<button type="button" data-as-market="'+k+'" aria-pressed="'+(current===k?'true':'false')+'" class="'+(current===k?'active':'')+'">'+label+'</button>').join('')+'</div>');
        } else {
          const selected=$('metric-filter')?.value;
          const possible=[['BTTS','AM'],['O25','+2,5'],['AND','AM e +2,5'],['OR','AM ou +2,5'],['O15','+1,5'],['W1','Casa'],['W2','Fora'],['C85','Cantos +8,5'],['C95','Cantos +9,5'],['HT1','Casa 1.ª p.'],['SH1','Casa 2.ª p.']];
          node.insertAdjacentHTML('beforeend','<div class="as-market-chips" role="group" aria-label="Mercado em foco">'+
            possible.map(([k,label])=>'<button type="button" data-as-focus="'+k+'" aria-pressed="'+(selected===k?'true':'false')+'" class="'+(selected===k?'active':'')+'">'+label+'</button>').join('')+'</div>');
        }
      }
    }
    function synchronizeDay(key){
      if(key!=='ALL' && !weekDays.some(d=>d.key===key))key='ALL';
      choiceDay=key;
      const dd=$('day-filter');
      if(dd){
        const val=key==='ALL'?'all':String(weekDays.find(d=>d.key===key)?.day||'all');
        if(dd.value!==val){dd.value=val;dd.dispatchEvent(new Event('change',{bubbles:true}));}
      }
      pageLimit=30;renderChoices();drawDateBars();
    }
    function mountDateBars(){
      const choices=$('as-choice-controls'),gamePanel=document.querySelector('#view-games .filter-panel');
      if(choices&&!$('as-datebar-choices')){
        const b=document.createElement('div');b.className='as-date-toolbar';b.id='as-datebar-choices';choices.after(b);
      }
      if(gamePanel&&!$('as-datebar-games')){
        const b=document.createElement('div');b.className='as-date-toolbar';b.id='as-datebar-games';
        const chips=gamePanel.querySelector('.filter-chips');
        if(chips)chips.after(b);else gamePanel.prepend(b);
      }
      drawDateBars();
    }
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const probability = (g, k) => {
      if (!g || g.verified === false) return NaN;
      const p = g.p || {}, a = g.first || {}, b = g.second || {};
      const values = {
        W1:p.w1, X:p.draw, W2:p.w2, BTTS:p.btts, BTTS_NO:p.no,
        O15:p.o15, O25:p.o25, AND:p.and, OR:p.or,
        C85:g.c85, C95:g.c95, HT1:a.w1, HTX:a.draw, HT2:a.w2,
        SH1:b.w1, SHX:b.draw, SH2:b.w2
      };
      if (values[k] === null || values[k] === undefined) return NaN;
      const v = Number(values[k]);
      return Number.isFinite(v) && v > 0 && v <= 1 ? v : NaN;
    };
    const fairOdd = p => Number.isFinite(p) && p > 0 ? Number((1/p).toFixed(2)) : NaN;
    const fairEligible = p => Number.isFinite(p) && p > 0 && (fairMinimum <= 0 || 1/p + 1e-10 >= fairMinimum);
    const fmtOdd = x => Number.isFinite(Number(x)) ? Number(x).toFixed(2).replace('.',',') : '—';
    const fmtPct = p => Number.isFinite(p) ? (p*100).toFixed(1).replace('.',',') + '%' : '—';
    const fmtEur = x => Number.isFinite(x) ? new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(x) : '—';
    const fmtDate = g => {
      if (g.date && /^\d{4}-\d\d-\d\d$/.test(g.date)) return g.date.slice(8,10)+'/'+g.date.slice(5,7);
      const mo = String(D.start || '').split('-')[1] || '10';
      return String(g.day).padStart(2,'0') + '/' + mo;
    };
    const parseOdd = v => {
      if (typeof v === 'number') return v;
      const n = Number(String(v ?? '').trim().replace(',','.'));
      return Number.isFinite(n) ? n : NaN;
    };
    const manualValid = odd => {
      const n = parseOdd(odd);
      return Number.isFinite(n) && n >= 1.20 && n <= 1000;
    };
    function restore() {
      try {
        const raw = JSON.parse(localStorage.getItem(storageKey) || 'null');
        if (raw && typeof raw === 'object') {
          for (const n of [1,2,3]) {
            const slot = raw[n];
            if (!slot || !Array.isArray(slot.items)) continue;
            slips[n] = {
              stake: /^[\d,.]{0,12}$/.test(String(slot.stake ?? '')) ? String(slot.stake ?? '') : '',
              items:slot.items.filter(v => Number.isInteger(Number(v.id)) && byId.has(Number(v.id)) &&
                Object.prototype.hasOwnProperty.call(marketName,v.market) &&
                Number.isFinite(probability(byId.get(Number(v.id)),v.market)))
                .slice(0,50).map(v => ({id:Number(v.id),market:v.market,odd: v.odd ?? ''}))
            };
          }
        }
        const prev = JSON.parse(localStorage.getItem(settingsKey) || 'null');
        if (prev && Number.isFinite(Number(prev.min))) minimum = Math.max(10,Math.min(95,Number(prev.min)));
        if (prev && Number.isFinite(Number(prev.fairMin))) fairMinimum = Math.max(0,Math.min(20,Number(prev.fairMin)));
      } catch (e) { persistAvailable = false; }
    }
    function save() {
      try { localStorage.setItem(storageKey,JSON.stringify(slips)); localStorage.setItem(settingsKey,JSON.stringify({min:minimum,fairMin:fairMinimum})); }
      catch (e) { persistAvailable = false; }
    }
    function rowFor(g,k) {
      const p = probability(g,k);
      return Number.isFinite(p) && fairEligible(p) ? {g,k,p} : null;
    }
    function allMarkets(g,cut=0) {
      return MARKETS.map(([k]) => {const p=probability(g,k);return Number.isFinite(p)?{g,k,p}:null;}).filter(r=>r && r.p*100+1e-8>=cut).sort((a,b)=>b.p-a.p);
    }
    function toast(msg) {
      let t = $('as-toast');
      if (!t) {t=document.createElement('div'); t.id='as-toast';t.className='as-toast';t.setAttribute('role','status');document.body.append(t);}
      t.textContent=msg; t.hidden=false;
      clearTimeout(toastTimer);
      toastTimer=setTimeout(()=>{t.hidden=true;},2800);
    }
    function add(n,id,k) {
      const g=byId.get(Number(id));
      const p=probability(g,k);
      if (![1,2,3].includes(n) || !g || !Object.hasOwn(marketName,k) || !Number.isFinite(p)) {
        toast('Prognóstico indisponível: faltam dados estatísticos deste jogo.');
        return;
      }
      const old=slips[n].items.find(v=>v.id===g.id);
      if (old && old.market===k) {
        toast('Esse prognóstico já está na Aposta '+n+'.');
      } else {
        slips[n].items=slips[n].items.filter(v=>v.id!==g.id);
        slips[n].items.push({id:g.id,market:k,odd:''});
        toast((old?'Prognóstico substituído':'Adicionado')+' à Aposta '+n+'.');
      }
      active=n;expanded=true;save();renderDock();paintButtons();
      if ($('match-modal') && !$('match-modal').hidden) $('modal-close')?.click();
    }
    function remove(n,id,k) {
      slips[n].items=slips[n].items.filter(v=>!(v.id===id&&v.market===k));
      save();renderDock();paintButtons();
    }
    function slipTotals(n) {
      const picks=slips[n].items;
      const filled=picks.filter(i=>manualValid(i.odd));
      const entered=filled.length,total=picks.length,valid=total>0&&entered===total;
      const partialMultiplier=entered?filled.reduce((x,i)=>x*parseOdd(i.odd),1):null;
      const multiplier=valid?partialMultiplier:null;
      const amount=Number(String(slips[n].stake||'').trim().replace(',','.'));
      const stakeValid=String(slips[n].stake||'').trim()!==''&&Number.isFinite(amount)&&amount>0;
      const partialReturn=partialMultiplier!==null&&stakeValid?partialMultiplier*amount:null;
      return {valid,multiplier,returnValue:valid?partialReturn:null,partialMultiplier,
              partialReturn,entered,total,amount,stakeValid,filled};
    }
    function fmtCombined(n) {
      return Number.isFinite(n)?new Intl.NumberFormat('pt-PT',
        {minimumFractionDigits:2,maximumFractionDigits:5}).format(n):'—';
    }
    function updateSlipNumbers() {
      const dock=$('as-ticket-dock');
      if(!dock||!expanded)return;
      const t=slipTotals(active),partial=t.entered>0&&!t.valid;
      const oddLabel=dock.querySelector('[data-slip-odd-label]');
      const oddTotal=dock.querySelector('[data-slip-total-odd]');
      const returnLabel=dock.querySelector('[data-slip-return-label]');
      const returnTotal=dock.querySelector('[data-slip-return-value]');
      const calculation=dock.querySelector('[data-slip-calculation]');
      if(oddLabel)oddLabel.textContent=partial?'Odd parcial ('+t.entered+'/'+t.total+')':'Odd combinada';
      if(oddTotal)oddTotal.textContent=t.partialMultiplier!==null?fmtCombined(t.partialMultiplier):'—';
      if(returnLabel)returnLabel.textContent=partial?'Retorno parcial (não final)':'Retorno potencial bruto';
      if(returnTotal)returnTotal.textContent=t.partialReturn!==null?fmtEur(t.partialReturn):'—';
      if(calculation) {
        let message='';
        if(t.entered&&t.stakeValid) {
          message=t.filled.map(i=>fmtOdd(parseOdd(i.odd))).join(' × ')+
            ' × '+fmtEur(t.amount)+' = '+fmtEur(t.partialReturn);
          if(!t.valid)message+=' · parcial: faltam '+(t.total-t.entered)+' odd(s)';
        } else if(t.entered) {
          message='Introduz o valor da aposta para veres o retorno automaticamente.';
        } else if(t.total) {
          message='Preenche as odds reais (mínimo 1,20) para calcular o retorno.';
        } else {
          message='Adiciona prognósticos para construir a aposta.';
        }
        calculation.textContent=message;
      }
      // Não reconstruir os inputs: mantém foco, cursor e teclado no telemóvel.
      dock.querySelectorAll('[data-slip-odd]').forEach(input=>{
        const ok=manualValid(input.value);
        const warning=input.closest('.as-slip-item')?.querySelector('[data-slip-warning]');
        input.setAttribute('aria-invalid',String(!!String(input.value).trim()&&!ok));
        if(warning) {
          warning.hidden=ok;
          if(!ok)warning.textContent=String(input.value).trim()?
            'Odd inferior a 1,20 ou inválida.':'Preenche a odd para completar o retorno.';
        }
      });
    }
    function persistSlipField(target) {
      const odd=target.closest('[data-slip-odd]');
      if(odd) {
        const n=Number(odd.dataset.slipOdd),id=Number(odd.dataset.game),k=odd.dataset.market;
        const item=slips[n]?.items.find(v=>v.id===id&&v.market===k);
        if(item){item.odd=String(odd.value||'').trim();save();updateSlipNumbers();}
        return true;
      }
      const stake=target.closest('[data-slip-stake]');
      if(stake) {
        const n=Number(stake.dataset.slipStake);
        if(slips[n]){slips[n].stake=stake.value;save();updateSlipNumbers();}
        return true;
      }
      return false;
    }
    function tabButtons() {
      return [1,2,3].map(n=>'<button type="button" data-slip-tab="'+n+'" class="'+(n===active?'active':'')+'" aria-pressed="'+(n===active?'true':'false')+'">Aposta '+n+' <b>'+slips[n].items.length+'</b></button>').join('');
    }
    function slipItem(v,n) {
      const g=byId.get(v.id);
      if (!g) return '';
      const p=probability(g,v.market),oddOk=manualValid(v.odd);
      return '<div class="as-slip-item"><div class="as-slip-item-head"><div>'+
        '<h4>'+esc(g.home)+' – '+esc(g.away)+'</h4><p><strong>'+esc(marketName[v.market])+'</strong> · '+fmtPct(p)+' · odd justa '+fmtOdd(fairOdd(p))+'</p></div>'+
        '<button type="button" class="as-slip-remove" data-slip-remove="'+n+'" data-game="'+g.id+'" data-market="'+esc(v.market)+'" aria-label="Remover seleção" title="Remover seleção">×</button></div>'+
        '<div class="as-slip-oddrow"><label for="as-odd-'+n+'-'+g.id+'">Odd que encontraste<br><small>(mín. 1,20)</small></label>'+
        '<input id="as-odd-'+n+'-'+g.id+'" type="text" inputmode="decimal" autocomplete="off" placeholder="ex.: 1,65" value="'+esc(v.odd)+'" data-slip-odd="'+n+'" data-game="'+g.id+'" data-market="'+esc(v.market)+'" /></div>'+
        '<div class="as-slip-missing" data-slip-warning'+(oddOk?' hidden':'')+'>'+ (String(v.odd).trim()?'Odd inferior a 1,20 ou inválida.':'Preenche a odd para completar o retorno.')+'</div>'+
        '</div>';
    }
    function renderDock() {
      let dock=$('as-ticket-dock');
      if (!dock) {
        dock=document.createElement('aside');
        dock.id='as-ticket-dock';dock.className='as-ticket-dock';dock.setAttribute('aria-label','Construtor de apostas da semana');document.body.append(dock);
      }
      const counts=[1,2,3].map(n=>slips[n].items.length);
      const total=counts.reduce((a,b)=>a+b,0);
      const current=slips[active];
      document.body.classList.toggle('as-ticket-open',expanded);
      dock.classList.toggle('is-open',expanded);
      const status=counts.map((x,i)=>(i+1)+': '+x).join(' · ');
      let content='<button class="as-dock-heading" type="button" data-slip-toggle="1" aria-expanded="'+(expanded?'true':'false')+'">'+
        '<span><b>⚽ Os meus boletins · '+total+' seleções</b><small>Aposta '+status+' · '+(persistAvailable?'guardado neste navegador':'sem gravação local')+'</small></span><span class="as-chevron" aria-hidden="true">'+(expanded?'⌄':'⌃')+'</span></button>';
      if (expanded) {
        content+='<div class="as-ticket-body"><div class="as-ticket-tabs">'+tabButtons()+'</div>'+
          '<div class="as-ticket-stats"><div class="as-ticket-stat"><span>Seleções</span><strong>'+current.items.length+'</strong></div><div class="as-ticket-stat"><span data-slip-odd-label>Odd combinada</span><strong data-slip-total-odd>—</strong></div></div>'+
          '<p class="as-ticket-notice">Odd justa = cálculo do modelo. Introduz as odds da tua casa de apostas, sem necessidade de validação externa; não serão inventadas. Cada boletim aceita um mercado por jogo.</p>'+
          '<div class="as-slip-items">'+(current.items.length?current.items.map(v=>slipItem(v,active)).join(''):'<div class="as-slip-empty">Ainda não adicionaste escolhas à Aposta '+active+'. Seleciona um prognóstico em “Escolhas” ou nos cartões dos jogos e toca em + Aposta '+active+'.</div>')+'</div>'+
          '<div class="as-slip-stake"><label for="as-stake-'+active+'">Valor da aposta (€)</label><input id="as-stake-'+active+'" type="number" min="0" step="0.5" inputmode="decimal" value="'+esc(current.stake)+'" data-slip-stake="'+active+'" placeholder="0,00" /></div>'+
          '<div class="as-slip-return"><span data-slip-return-label>Retorno potencial bruto</span><strong data-slip-return-value>—</strong></div>'+
          '<div class="as-slip-calculation" data-slip-calculation aria-live="polite"></div>'+
          '<div class="as-slip-footer"><button type="button" data-slip-copy="'+active+'">Copiar boletim</button><button type="button" class="as-danger" data-slip-clear="'+active+'">Limpar aposta</button></div></div>';
      }
      dock.innerHTML=content;
      updateSlipNumbers();
    }
    function paintButtons() {
      document.querySelectorAll('[data-add-slip]').forEach(btn=>{
        const n=Number(btn.dataset.addSlip),id=Number(btn.dataset.game),market=btn.dataset.market || btn.closest('.as-inline')?.querySelector('[data-pick-select]')?.value;
        if (!market) return;
        const exists=slips[n].items.some(v=>v.id===id && v.market===market);
        btn.classList.toggle('is-added',exists);
        btn.textContent=(exists?'✓ ':'+ ')+'Aposta '+n;
        btn.setAttribute('aria-label',(exists?'Já incluído na ':'Adicionar à ')+'Aposta '+n);
      });
    }
    function actionButtons(g,k,disabled=false) {
      return '<div class="as-add-actions">'+[1,2,3].map(n=>
        '<button type="button" '+(disabled?'disabled ':'')+'data-add-slip="'+n+'" data-game="'+g.id+'" data-market="'+esc(k)+'">+ Aposta '+n+'</button>'
      ).join('')+'</div>';
    }
    // O campo "Escolher prognóstico" deve seguir o mercado em foco
    // na vista atual, em vez de escolher automaticamente o evento
    // com maior probabilidade (frequentemente +1,5 golos).
    function focusedMarketFor(target,isModal=false) {
      if(isModal || target.closest('#modal-content')) {
        return lastOpenMarketScope==='games'?($('metric-filter')?.value||'BTTS'):
          lastOpenMarketScope==='rank'?($('as-market')?.value||'ALL'):'ALL';
      }
      if(target.closest('#view-games'))return $('metric-filter')?.value||'BTTS';
      if(target.closest('#view-rank'))return $('as-market')?.value||'ALL';
      return 'ALL';
    }
    function selectHtml(g,target,isModal=false) {
      const options=allMarkets(g);
      if(!options.length)return '<p class="as-inline-empty">Não existem previsões disponíveis para este encontro. Não é possível adicionar um mercado sem dados.</p>';
      const preferred=focusedMarketFor(target,isModal);
      // 1X2 contém três acontecimentos, não é um prognóstico único.
      // Nesse caso seleciona a hipótese 1X2 mais provável e identifica-a.
      const chosen=preferred==='ALL'?options[0]:
        preferred==='1X2'?options.find(x=>['W1','X','W2'].includes(x.k)):
        options.find(x=>x.k===preferred);
      const label=marketName[preferred]||(preferred==='1X2'?'1X2':'mercado selecionado');
      const description=chosen?
        'Probabilidade '+fmtPct(chosen.p)+' · odd justa '+fmtOdd(fairOdd(chosen.p)):
        'Sem previsão de '+esc(label)+' neste jogo. Podes escolher manualmente outro mercado.';
      return '<label class="as-inline-label">Escolher prognóstico para o boletim</label>'+
        '<select aria-label="Prognóstico para '+esc(g.home)+' e '+esc(g.away)+'" data-pick-select="'+g.id+'">'+
        (chosen?'':'<option value="" selected>Sem previsão: '+esc(label)+'</option>')+
        options.map(x=>'<option value="'+x.k+'"'+(chosen?.k===x.k?' selected':'')+'>'+
          esc(marketName[x.k])+' · '+fmtPct(x.p)+' · '+fmtOdd(fairOdd(x.p))+'</option>').join('')+
        '</select><div class="as-inline-metrics">'+description+'</div>'+
        actionButtons(g,chosen?.k||'',!chosen);
    }
    function insertInline(g,target,isModal) {
      if (!target || !g || g.verified===false || target.querySelector('.as-inline')) return;
      const wrapper=document.createElement('div');
      wrapper.className=isModal?'as-inline as-modal-choice':'as-inline';
      wrapper.dataset.betGame=g.id;
      wrapper.innerHTML=selectHtml(g,target,isModal);
      target.append(wrapper);
      paintButtons();
    }
    function enhanceCards(root) {
      if (!root) return;
      root.querySelectorAll('.game-card').forEach(card=>{
        if (card.querySelector('.as-inline')) return;
        const open=card.querySelector('[data-open]');
        if (!open) return;
        const g=byId.get(Number(open.dataset.open));
        if (g) insertInline(g,card,false);
      });
    }
    function enhanceTable() {
      const tbody=$('game-rows');
      if (!tbody) return;
      const th=document.querySelector('#table-list thead tr');
      if (th && !th.querySelector('.as-th')) {
        const h=document.createElement('th');h.className='as-th';h.textContent='Adicionar ao boletim';th.append(h);
      }
      tbody.querySelectorAll('tr').forEach(tr=>{
        if (tr.querySelector('.as-td')) return;
        const open=tr.querySelector('[data-open]');
        if (!open) return;
        const g=byId.get(Number(open.dataset.open));
        if (!g) return;
        const td=document.createElement('td');td.className='as-td';
        if (g.verified!==false) insertInline(g,td,false);
        else td.textContent='Previsão pendente';
        tr.append(td);
      });
    }
    function enhanceModal() {
      const container=$('modal-content');
      if (!container || container.querySelector('.as-modal-options')) return;
      const g=byId.get(Number(lastOpenGame));
      if (!g || g.verified===false) return;
      const d=document.createElement('div');
      d.className='as-modal-options';
      d.innerHTML='<h3>Adicionar um prognóstico às minhas apostas</h3>';
      insertInline(g,d,true);
      container.prepend(d);
    }
    function setupChoices() {
      const view=$('view-rank'), native=$('rank-list'),rank=$('rank-filter');
      if (!view || !native || !rank) return;
      native.hidden=true;
      const header=view.querySelector('.body-header');
      if (header) {
        const h=header.querySelector('h1'),p=header.querySelector('p');
        if (h) h.textContent='Escolhas e Top 20 da semana';
        if (p) p.textContent='Filtra probabilidade, odd justa estimada, mercado e dia separadamente. As odds reais devem ser preenchidas nos boletins e ser de pelo menos 1,20.';
      }
      const first=rank.querySelector('option[value="TOP"]'),all=rank.querySelector('option[value="PROB"]');
      if (first) first.textContent='Top 20 por probabilidade · análise do modelo';
      if (all) all.textContent='Todas as escolhas acima da percentagem';
      rank.value='TOP';
      const sectionNotice=view.querySelector('.notice');
      if (sectionNotice) sectionNotice.innerHTML='<span class="notice-icon">i</span><div><b>Dois tipos de odds:</b> a <strong>odd justa</strong> é 1 ÷ probabilidade prevista e serve para analisar o modelo. A <strong>odd real</strong> é a cotação que introduzes no boletim e tem de ser ≥1,20. Não exigimos confirmação externa, mas o modelo não inventa cotações. Uma probabilidade alta não prova que uma aposta tenha valor.</div>';
      const controls=document.createElement('div');
      controls.className='as-choice-controls';controls.id='as-choice-controls';
      const minOpts=[40,45,50,55,60,65,70,75,80,85,90,95].map(v=>'<option value="'+v+'"'+(v===minimum?' selected':'')+'>'+v+'% ou mais</option>').join('');
      controls.innerHTML=
        '<div class="as-field"><label for="as-min">Probabilidade mínima</label><select id="as-min">'+minOpts+'</select></div>'+ 
        '<div class="as-field"><label for="as-fair">Odd justa estimada</label><select id="as-fair"><option value="0">Todas</option>'+[1.2,1.4,1.6,2,3].map(x=>'<option value="'+x+'"'+(fairMinimum===x?' selected':'')+'>A partir de '+fmtOdd(x)+'</option>').join('')+'</select></div>'+
        '<div class="as-field"><label for="as-market">Tipo de prognóstico</label><select id="as-market"><option value="ALL">Todos os mercados</option><option value="1X2">1X2 · Casa/Empate/Fora</option>'+MARKETS.map(([k,n])=>'<option value="'+k+'">'+esc(n)+'</option>').join('')+'</select></div>'+
        '<div class="as-field"><label for="as-league">Competição</label><select id="as-league"><option value="ALL">Todas as 12 competições</option>'+D.leagues.map(l=>'<option value="'+esc(l.code)+'">'+esc(l.name)+'</option>').join('')+'</select></div>';
      native.before(controls);
      mountDateBars();
      const desc=document.createElement('p');desc.className='as-choice-description';desc.id='as-choice-description';native.after(desc);
      const list=document.createElement('div');list.className='as-list';list.id='as-smart-ranks';desc.after(list);
      const more=document.createElement('button');more.className='as-more';more.id='as-more';more.type='button';more.textContent='Mostrar mais opções';list.after(more);
      const nnav=document.querySelectorAll('[data-go="rank"]');nnav.forEach(v=>v.textContent=v.closest('.bottomnav')?'⚽ Escolhas':'Escolhas por %');
      const hero=$('view-overview')?.querySelector('.hero-alert span:last-child');
      if (hero) hero.innerHTML='<b>Odd mínima de aposta: 1,20 real.</b> As odds justas são apenas estimativas do modelo; vê todos os prognósticos, filtra por percentagem e preenche a cotação comercial no boletim.';
      const method=$('view-method');
      if (method) method.querySelectorAll('.method-card p').forEach(p=>{
        if (p.textContent.includes('Critério das apostas:')) p.textContent='A probabilidade e a odd justa são filtros independentes. A odd justa (1 ÷ probabilidade) não é a cotação de uma casa de apostas. Para registar apostas reais e calcular retornos, é preciso introduzir manualmente cotação ≥1,20 e valor apostado; dados sem validação externa.';
        else if (p.textContent.includes('Não foram verificadas odds atuais')) p.textContent='As odds comerciais não são recolhidas automaticamente. O cálculo do retorno só utiliza as odds introduzidas pelo utilizador. Não apresenta promessas de valor esperado ou rentabilidade garantida.';
      });
      $('as-min').addEventListener('change',e=>{
        minimum=Number(e.target.value)||70;pageLimit=30;save();renderChoices();refreshInline();
      });
      $('as-fair').addEventListener('change',e=>{
        fairMinimum=Math.max(0,Number(e.target.value)||0);pageLimit=30;save();renderChoices();
      });
      $('as-market').addEventListener('change',()=>{pageLimit=30;renderChoices();drawDateBars();refreshInline('rank');});
      $('as-league').addEventListener('change',()=>{pageLimit=30;renderChoices();drawDateBars();});
      rank.addEventListener('change',()=>{pageLimit=30;renderChoices();});
      more.addEventListener('click',()=>{pageLimit+=30;renderChoices();});
      renderChoices();
    }
    function refreshInline(scope='all') {
      document.querySelectorAll('.as-inline[data-bet-game]').forEach(x=>{
        if(scope==='games'&&!x.closest('#view-games')&&
          !(x.closest('#modal-content')&&lastOpenMarketScope==='games'))return;
        if(scope==='rank'&&!x.closest('#view-rank')&&
          !(x.closest('#modal-content')&&lastOpenMarketScope==='rank'))return;
        const g=byId.get(Number(x.dataset.betGame));
        if(g)x.innerHTML=selectHtml(g,x,x.classList.contains('as-modal-choice'));
      });
      paintButtons();
    }
    function renderChoices() {
      const list=$('as-smart-ranks'),rank=$('rank-filter');
      if (!list || !rank) return;
      const mode=rank.value;
      const marketSel=$('as-market')?.value || 'ALL';
      const leagueSel=$('as-league')?.value || 'ALL';
      const market=Object.hasOwn(marketName,mode)?mode:marketSel;
      let rows=ALL.filter(g=>g.verified!==false&&(leagueSel==='ALL'||g.league===leagueSel)&&(choiceDay==='ALL'||dateKey(g)===choiceDay)).flatMap(g=>
        MARKETS.map(([k])=>market==='ALL'||k===market||(market==='1X2'&&['W1','X','W2'].includes(k))?rowFor(g,k):null).filter(Boolean)
      ).filter(x=>x.p*100+1e-8>=minimum);
      rows.sort((a,b)=>b.p-a.p||String(a.g.home).localeCompare(String(b.g.home),'pt'));
      if (mode==='TOP') {
        const visited=new Set();
        rows=rows.filter(x=>{if(visited.has(x.g.id))return false;visited.add(x.g.id);return true;}).slice(0,20);
      } else if (mode!=='PROB') {
        rows=rows.slice(0,20);
      }
      if(choiceSort==='date')rows.sort(byKickoff);
      const showing=mode==='PROB'?rows.slice(0,pageLimit):rows;
      $('as-more').hidden=(mode!=='PROB'||rows.length<=pageLimit);
      const description=$('as-choice-description');
      description.textContent=rows.length+' prognósticos'+(choiceDay==='ALL'?' na semana':(' em '+(weekDays.find(d=>d.key===choiceDay)?.label||choiceDay)))+' com probabilidade ≥'+minimum+'%'+(fairMinimum>0?' e odd justa ≥'+fmtOdd(fairMinimum):' (todas as odds justas)')+'.'+
        (mode==='TOP'?' Máximo de um mercado por jogo.':'')+
        ' As odds são estimativas matemáticas, não preços da casa de apostas.';
      if (!showing.length) {
        list.innerHTML='<div class="as-placeholder"><strong>Sem escolhas para os filtros aplicados.</strong><p>Experimenta baixar a percentagem mínima, mostrar todas as odds justas ou selecionar outro mercado.</p></div>';
        return;
      }
      list.innerHTML=showing.map(({g,k,p})=>
        '<article class="as-choice"><div class="as-choice-top"><span class="as-market">'+esc(marketName[k])+'</span><span class="as-league">'+esc(byLeague.get(g.league)?.name||g.league)+' · '+fmtDate(g)+'</span></div>'+
        '<h3>'+esc(g.home)+' – '+esc(g.away)+'</h3>'+
        '<div class="as-choice-nums"><strong class="as-choice-prob">'+fmtPct(p)+'</strong><span class="as-choice-fair">Odd justa '+fmtOdd(fairOdd(p))+'</span></div>'+
        actionButtons(g,k)+'</article>'
      ).join('');
      paintButtons();
    }
    function copySlip(n) {
      const slip=slips[n],tot=slipTotals(n);
      if (!slip.items.length) {toast('A Aposta '+n+' está vazia.');return;}
      const lines=['APOSTAS SEMANAIS — Aposta '+n,'Semana: '+(D.start||'')+' a '+(D.end||''),''];
      for (const v of slip.items) {
        const g=byId.get(v.id),p=probability(g,v.market);
        lines.push(g.home+' – '+g.away+' | '+marketName[v.market]+' | '+fmtPct(p)+' | odd justa '+fmtOdd(fairOdd(p))+' | odd introduzida '+(manualValid(v.odd)?fmtOdd(parseOdd(v.odd)):'não preenchida'));
      }
      lines.push('', 'Odd total inserida: '+(tot.valid?fmtOdd(tot.multiplier):'não disponível'));
      if (tot.returnValue!==null) lines.push('Retorno bruto potencial: '+fmtEur(tot.returnValue));
      lines.push('Rascunho pessoal. Odds comerciais não verificadas automaticamente.');
      const text=lines.join('\n');
      const clipboard=navigator.clipboard?.writeText?.(text);
      if (clipboard) clipboard.then(()=>toast('Aposta '+n+' copiada.'),()=>legacyCopy(text));
      else legacyCopy(text);
    }
    function legacyCopy(text) {
      const t=document.createElement('textarea');t.value=text;t.style.position='fixed';t.style.left='-9999px';document.body.append(t);t.select();
      try {document.execCommand('copy');toast('Boletim copiado.');}catch(e){toast('Não foi possível copiar o boletim.');} t.remove();
    }
    function register() {
      document.addEventListener('click',e=>{
        const dayBtn=e.target.closest('[data-as-day]');
        if(dayBtn){synchronizeDay(dayBtn.dataset.asDay);return;}
        const sortBtn=e.target.closest('[data-as-sort]');
        if(sortBtn){
          const mode=sortBtn.dataset.asSort;
          if(sortBtn.dataset.asSortScope==='games'){
            const o=$('order-filter');if(o){o.value=mode;o.dispatchEvent(new Event('change',{bubbles:true}));}
          }else{choiceSort=mode;pageLimit=30;renderChoices();}
          drawDateBars();return;
        }
        const marketBtn=e.target.closest('[data-as-market]');
        if(marketBtn){
          const select=$('as-market');if(select){select.value=marketBtn.dataset.asMarket;select.dispatchEvent(new Event('change',{bubbles:true}));}
          const mode=$('rank-filter');if(mode&&mode.value!=='TOP'&&mode.value!=='PROB'){
            mode.value='PROB';mode.dispatchEvent(new Event('change',{bubbles:true}));
          }
          drawDateBars();return;
        }
        const focusBtn=e.target.closest('[data-as-focus]');
        if(focusBtn){const select=$('metric-filter');if(select){select.value=focusBtn.dataset.asFocus;select.dispatchEvent(new Event('change',{bubbles:true}));}drawDateBars();return;}
        const gameOpen=e.target.closest('[data-open]');
        if (gameOpen) {
          lastOpenGame=Number(gameOpen.dataset.open);
          lastOpenMarketScope=gameOpen.closest('#view-games')?'games':
            gameOpen.closest('#view-rank')?'rank':'overview';
        }
        const btn=e.target.closest('[data-add-slip]');
        if (btn) {
          e.preventDefault();
          let market=btn.dataset.market;
          const inline=btn.closest('.as-inline');
          if (inline) market=inline.querySelector('[data-pick-select]')?.value || market;
          add(Number(btn.dataset.addSlip), Number(btn.dataset.game),market);return;
        }
        const toggle=e.target.closest('[data-slip-toggle]');
        if (toggle){expanded=!expanded;renderDock();return;}
        const tab=e.target.closest('[data-slip-tab]');
        if (tab){active=Number(tab.dataset.slipTab);renderDock();return;}
        const removeBtn=e.target.closest('[data-slip-remove]');
        if (removeBtn){remove(Number(removeBtn.dataset.slipRemove),Number(removeBtn.dataset.game),removeBtn.dataset.market);return;}
        const clearBtn=e.target.closest('[data-slip-clear]');
        if (clearBtn){const n=Number(clearBtn.dataset.slipClear);if(window.confirm('Limpar todas as seleções da Aposta '+n+'?')){slips[n]={stake:'',items:[]};save();renderDock();paintButtons();}return;}
        const cp=e.target.closest('[data-slip-copy]');
        if (cp){copySlip(Number(cp.dataset.slipCopy));return;}
      });
      document.addEventListener('input',e=>{persistSlipField(e.target);});
      document.addEventListener('change',e=>{
        if(persistSlipField(e.target))return;
        if(e.target.id==='day-filter'){
          const v=e.target.value;
          const next=v==='all'?'ALL':(weekDays.find(d=>d.day===Number(v))?.key||'ALL');
          if(choiceDay!==next){choiceDay=next;pageLimit=30;renderChoices();}
          drawDateBars();return;
        }
        if(e.target.id==='metric-filter'){drawDateBars();refreshInline('games');return;}
        if(e.target.id==='order-filter'){drawDateBars();return;}
        const sel=e.target.closest('[data-pick-select]');
        if (sel){
          const wrap=sel.closest('.as-inline'),g=byId.get(Number(sel.dataset.pickSelect)),p=probability(g,sel.value);
          if (wrap) {
            const m=wrap.querySelector('.as-inline-metrics');
            if(m)m.textContent=Number.isFinite(p)?
              'Probabilidade '+fmtPct(p)+' · odd justa '+fmtOdd(fairOdd(p)):
              'Sem previsão para este mercado. Seleciona uma opção disponível.';
            wrap.querySelectorAll('[data-add-slip]').forEach(b=>{
              b.dataset.market=sel.value;
              b.disabled=!sel.value||!Number.isFinite(p);
            });
          }
          paintButtons();
          return;
        }
      });
      for(const root of [$('game-list'),$('opening-games')]){
        if(!root)continue;
        new MutationObserver(()=>enhanceCards(root)).observe(root,{childList:true});
        enhanceCards(root);
      }
      const tbody=$('game-rows');
      if (tbody){new MutationObserver(enhanceTable).observe(tbody,{childList:true});enhanceTable();}
      const body=$('modal-content');
      if (body){new MutationObserver(enhanceModal).observe(body,{childList:true});}
    }
    restore();
    setupChoices();
    renderDock();
    register();
    drawDateBars();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
