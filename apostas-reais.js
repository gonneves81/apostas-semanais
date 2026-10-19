
/* Apostas Semanais | Registo local de boletins REALMENTE realizados.
   Sem ligação a casas de apostas. Resultados e montantes liquidados são declarados pelo utilizador. */
(function(){
'use strict';
function start(){
 const node=document.getElementById('data-json'),dock=document.getElementById('as-ticket-dock');
 if(!node||!dock)return;
 let D;try{D=JSON.parse(node.textContent)}catch(e){return}
 const $=id=>document.getElementById(id);
 const storeKey='as_apostas_reais_historico_v1';
 const draftKey='apostas_semanal_slips_'+(D.start||'semana')+'_'+(D.end||'');
 const byId=new Map((D.games||[]).map(g=>[Number(g.id),g]));
 const names=Object.fromEntries((D.leagues||[]).map(l=>[l.code,l.name]));
 const markets={
  W1:'Vitória casa',X:'Empate',W2:'Vitória fora',BTTS:'Ambas marcam',BTTS_NO:'Ambas não marcam',
  O15:'Mais de 1,5',O25:'Mais de 2,5',AND:'Ambas E +2,5',OR:'Ambas OU +2,5',
  C85:'Cantos +8,5',C95:'Cantos +9,5',HT1:'Casa 1.ª parte',HTX:'Empate 1.ª parte',
  HT2:'Fora 1.ª parte',SH1:'Casa 2.ª parte',SHX:'Empate 2.ª parte',SH2:'Fora 2.ª parte'
 };
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const odd=v=>Number(String(v??'').trim().replace(',','.'));
 const fmt=v=>Number.isFinite(v)?v.toFixed(2).replace('.',','):'—';
 const euro=v=>Number.isFinite(v)?new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v):'—';
 const isValidOdd=v=>Number.isFinite(odd(v))&&odd(v)>=1.2&&odd(v)<=1000;
 const isValidStake=v=>Number.isFinite(odd(v))&&odd(v)>0&&odd(v)<=10000000;
 const states={pending:'Por liquidar',won:'Ganha',lost:'Perdida',void:'Anulada / devolvida',cashout:'Cash out / parcial'};
 let records=[];
 function read(){
   try{
     const raw=JSON.parse(localStorage.getItem(storeKey)||'{}');
     records=Array.isArray(raw.bets)?raw.bets.filter(b=>b&&typeof b.id==='string'&&Array.isArray(b.selections)&&b.selections.length).slice(-500):[];
   }catch(e){records=[];}
 }
 function write(){
   try{localStorage.setItem(storeKey,JSON.stringify({schema:1,updated_at:new Date().toISOString(),bets:records}));return true;}
   catch(e){message('Não foi possível guardar. Verifica se o navegador permite armazenamento local.');return false;}
 }
 function message(t){
   let el=$('qa-register-notice');
   if(!el){el=document.createElement('div');el.id='qa-register-notice';el.className='qa-register-notice';el.setAttribute('role','status');document.body.append(el);}
   el.textContent=t;el.hidden=false;clearTimeout(message.timer);message.timer=setTimeout(()=>{el.hidden=true;},4000);
 }
 function getDraft(n){
   try{
     const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
     return draft&&draft[n]&&Array.isArray(draft[n].items)?draft[n]:null;
   }catch(e){return null}
 }
 function capture(n){
   if(![1,2,3].includes(n))return;
   const s=getDraft(n);
   if(!s||!s.items.length){message('Aposta '+n+' vazia; adiciona primeiro os prognósticos.');return;}
   if(!isValidStake(s.stake)){message('Introduz um valor apostado maior que zero para registar a aposta real.');return;}
   if(!s.items.every(i=>isValidOdd(i.odd))){message('Preenche todas as odds reais com valores de pelo menos 1,20.');return;}
   const seen=new Set();
   const picks=[];
   for(const i of s.items){
     const g=byId.get(Number(i.id));
     if(!g||seen.has(g.id)||!Object.prototype.hasOwnProperty.call(markets,i.market)){
       message('Existe um prognóstico inválido ou repetido no boletim.');return;
     }
     seen.add(g.id);
     const pct=window.ApostasQualidade?.probability(g,i.market);
     picks.push({game_id:g.id,league:g.league,home:g.home,away:g.away,market:i.market,
      odd:Number(odd(i.odd).toFixed(3)),probability:Number.isFinite(pct)?pct:null,
      scheduled:typeof g.date==='string'?g.date:String(D.start||'')+':dia '+g.day,
      kickoff:g.time||null});
   }
   const price=picks.reduce((total,p)=>total*p.odd,1);
   if(!Number.isFinite(price)||price>10000000000){message('Odd total demasiado elevada para apresentar com segurança.');return;}
   const stake=odd(s.stake);
   const confirmMsg='Confirma que colocaste REALMENTE a Aposta '+n+' com '+picks.length+
     ' seleção(ões), valor '+euro(stake)+' e odd combinada '+fmt(price)+
     '? Este registo será guardado localmente, sem comprovação automática.';
   if(!window.confirm(confirmMsg))return;
   const record={id:'real-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),type:'real_declared',
     recorded_at:new Date().toISOString(),week_start:D.start||null,week_end:D.end||null,
     slip_number:n,stake:Number(stake.toFixed(2)),combined_odd:Number(price.toFixed(5)),
     selections:picks,status:'pending',return_override:null,
     audit:[{at:new Date().toISOString(),action:'recorded_as_real'}]};
   records.unshift(record);
   if(write()){render();message('Aposta '+n+' registada como realizada. Confirma depois o resultado no Histórico e acertos.');}
 }
 function payout(b){
   if(b.status==='pending')return null;
   if(b.status==='cashout'){
     const x=Number(b.return_override);
     return b.return_override!==null&&Number.isFinite(x)&&x>=0?x:null;
   }
   if(b.return_override!==null&&Number.isFinite(Number(b.return_override))&&Number(b.return_override)>=0)return Number(b.return_override);
   if(b.status==='won')return Number(b.stake)*Number(b.combined_odd);
   if(b.status==='lost')return 0;
   if(b.status==='void')return Number(b.stake);
   return null;
 }
 function totals(){
   const settled=records.filter(b=>Number.isFinite(payout(b))),open=records.filter(b=>payout(b)===null);
   const staked=settled.reduce((a,b)=>a+Number(b.stake),0),returned=settled.reduce((a,b)=>a+payout(b),0);
   return {settled: settled.length,open:open.length,staked,returned,profit:returned-staked,roi:staked>0?(returned-staked)/staked*100:null};
 }
 function enhanceDock(){
   const foot=dock.querySelector('.as-slip-footer');
   if(!foot||foot.querySelector('[data-qa-register]'))return;
   const current=dock.querySelector('[data-slip-tab].active');
   const match=current?.dataset.slipTab;
   const n=Number(match)||1;
   const button=document.createElement('button');
   button.type='button';button.className='qa-register-button';button.dataset.qaRegister=String(n);
   button.textContent='Registar como aposta REAL';
   button.title='Guardar uma cópia deste boletim como aposta efetivamente colocada, sem verificar a casa.';
   foot.after(button);
   const note=document.createElement('p');
   note.className='qa-register-caption';note.textContent='Só regista como real se a aposta foi feita. Fica guardada neste navegador; consulta o resultado em Histórico e acertos.';
   button.after(note);
 }
 new MutationObserver(enhanceDock).observe(dock,{childList:true});
 enhanceDock();
 function eventStatus(id,status){
   const record=records.find(x=>x.id===id);
   if(!record||!Object.prototype.hasOwnProperty.call(states,status))return;
   if(status===record.status)return;
   record.audit=Array.isArray(record.audit)?record.audit:[];
   record.audit.push({at:new Date().toISOString(),action:'status_changed',previous:record.status,new_status:status});
   record.status=status;
   if(status==='pending')record.return_override=null;
   if(write())render();
 }
 function eventReturn(id,raw){
   const record=records.find(x=>x.id===id);
   if(!record)return;
   const txt=String(raw||'').trim(),value=txt===''?null:odd(txt);
   if(value!==null&&(!Number.isFinite(value)||value<0||value>1000000000)){
     message('O retorno efetivo deve ser um número válido igual ou superior a zero.');render();return;
   }
   const old=record.return_override;
   record.return_override=value===null?null:Number(value.toFixed(2));
   record.audit=Array.isArray(record.audit)?record.audit:[];
   record.audit.push({at:new Date().toISOString(),action:'return_adjusted',previous:old,new_return:record.return_override});
   if(write())render();
 }
 function download(){
   const blob=new Blob([JSON.stringify({schema:1,exported_at:new Date().toISOString(),bets:records},null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob),a=document.createElement('a');
   a.href=url;a.download='Apostas_Semanais_Historico_Real.json';document.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),2500);
 }
 function render(){
   const panel=$('qa-real-history');
   if(!panel)return;
   const t=totals();
   const rows=records.map((b,i)=>{
     const ps=b.selections.map(s=>'<li>'+esc(s.home)+' – '+esc(s.away)+' · '+esc(markets[s.market]||s.market)+
       ' <strong>'+fmt(Number(s.odd))+'</strong>'+(s.probability!==null&&Number.isFinite(Number(s.probability))?' · modelo '+(s.probability*100).toFixed(1).replace('.',',')+'%':'')+'</li>').join('');
     const returned=payout(b);
     return '<article class="qa-real-record"><div class="qa-real-heading"><h3>Aposta '+b.slip_number+' · '+esc(b.week_start||'semana')+'</h3>'+
       '<span class="qa-real-status">'+esc(states[b.status]||'Indefinido')+'</span></div>'+
       '<div class="qa-real-numbers"><span>Registada '+escapeDate(b.recorded_at)+'</span><strong>'+euro(Number(b.stake))+'</strong><span>Odd combinada '+fmt(Number(b.combined_odd))+'</span></div>'+
       '<ul class="qa-real-picks">'+ps+'</ul>'+
       '<div class="qa-real-settle"><label>Resultado comunicado pelo utilizador<select data-real-status="'+esc(b.id)+'">'+
       Object.entries(states).map(([k,v])=>'<option value="'+k+'"'+(b.status===k?' selected':'')+'>'+esc(v)+'</option>').join('')+
       '</select></label><label>Retorno efetivo (€)<input data-real-return="'+esc(b.id)+'" type="text" inputmode="decimal" placeholder="Automático" value="'+(b.return_override===null?'':esc(b.return_override))+'"></label></div>'+
       '<div class="qa-real-result"><span>Retorno: <b>'+(returned===null?'Por liquidar':euro(returned))+'</b></span>'+
       '<span>Saldo: <b>'+(returned===null?'—':euro(returned-Number(b.stake)))+'</b></span>'+
       '<button data-real-delete="'+esc(b.id)+'" type="button">Apagar registo</button></div></article>';
   }).join('');
   panel.innerHTML='<div class="qa-real-intro"><span class="eyebrow">Registo pessoal dos boletins</span><h2>As minhas apostas realizadas</h2><p>Guarda separadamente as apostas que fizeste de verdade. Resultados e retornos são introduzidos por ti, <strong>sem verificação externa</strong>. O histórico fica só neste navegador.</p></div>'+
     '<div class="qa-real-stats"><div><small>Realizadas</small><strong>'+records.length+'</strong></div>'+
     '<div><small>Liquidadas</small><strong>'+t.settled+'</strong></div>'+
     '<div><small>Por liquidar</small><strong>'+t.open+'</strong></div>'+
     '<div><small>Saldo liquidado</small><strong>'+(t.settled?euro(t.profit):'—')+'</strong></div>'+
     '<div><small>ROI liquidado</small><strong>'+(t.roi!==null?t.roi.toFixed(1).replace('.',',')+'%':'—')+'</strong></div></div>'+
     '<div class="qa-real-toolbar"><small>O ROI inclui apenas boletins liquidados com retorno definido. Boletins por liquidar são excluídos do cálculo.</small>'+
     '<button data-real-export="1" type="button">Exportar cópia JSON</button></div>'+
     (records.length?'<div class="qa-real-list">'+rows+'</div>':'<div class="qa-empty">Ainda não registaste apostas reais. Abre um dos três boletins, indica odds comerciais ≥1,20 e montante, e seleciona “Registar como aposta REAL”.</div>');
 }
 function escapeDate(t){
   const date=new Date(t);return !Number.isNaN(date.getTime())?new Intl.DateTimeFormat('pt-PT',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Lisbon'}).format(date):'data não disponível';
 }
 const history=$('view-history');
 if(history){
   const section=document.createElement('section');section.id='qa-real-history';section.className='qa-real-history';
   const first=history.querySelector('.body-header');
   if(first)first.after(section);else history.prepend(section);
 }
 document.addEventListener('click',e=>{
   const reg=e.target.closest('[data-qa-register]');
   if(reg){capture(Number(reg.dataset.qaRegister));return;}
   const del=e.target.closest('[data-real-delete]');
   if(del){
     const item=records.find(b=>b.id===del.dataset.realDelete);
     if(item&&window.confirm('Apagar definitivamente o registo da Aposta '+item.slip_number+'? Esta ação não remove a aposta de uma casa.')){
       records=records.filter(b=>b.id!==item.id);
       if(write()){render();message('Registo apagado do histórico local.');}
     }
     return;
   }
   if(e.target.closest('[data-real-export]'))download();
 });
 document.addEventListener('change',e=>{
   const status=e.target.closest('[data-real-status]');
   if(status){eventStatus(status.dataset.realStatus,status.value);return;}
   const returned=e.target.closest('[data-real-return]');
   if(returned)eventReturn(returned.dataset.realReturn,returned.value);
 });
 read();render();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
