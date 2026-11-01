const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('profissional.js','utf8');const payout=src.slice(src.indexOf('function payout('),src.indexOf('function metrics('));const metric=src.slice(src.indexOf('function metrics('),src.indexOf('function performance('));
const ctx={number:x=>typeof x==='number'&&Number.isFinite(x),eur:x=>x,pct:x=>x};vm.createContext(ctx);vm.runInContext(payout+metric,ctx);
const rows=[{recorded_at:'2026-01-01',stake:10,combined_odd:2,status:'won'},{recorded_at:'2026-01-02',stake:10,combined_odd:2,status:'lost'},{recorded_at:'2026-01-03',stake:10,status:'pending'},{recorded_at:'2026-01-04',stake:5,status:'void'}];
const m=ctx.metrics(rows);assert.equal(m[0],3);assert.equal(m[1],1);assert.equal(m[2],25);assert.equal(m[3],0);assert.equal(m[4],0);assert.equal(m[5],10);
assert.equal(ctx.payout({status:'cashout',stake:10,return_override:7}),7);
console.log('OK: pendentes excluídas do rendimento; anulações e cash out tratados; queda acumulada sem duplicar apostas.');
