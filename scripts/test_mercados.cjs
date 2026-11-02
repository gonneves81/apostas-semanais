const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const D=JSON.parse(fs.readFileSync('index.html','utf8').match(/<script id="data-json" type="application\/json">(.*?)<\/script>/s)[1]);
const context={window:{ApostasGolosModel:JSON.parse(fs.readFileSync('dados/modelo-golos-'+D.start+'.json','utf8'))}};
vm.runInNewContext(fs.readFileSync('mercados.js','utf8'),context);
const M=context.window.ApostasMercados;
assert.deepEqual(Object.keys(M.labels),['W1','X','W2','BTTS','O25','AND']);
assert.equal(M.poisson(-1,2),null);assert.equal(M.poisson(NaN,2),null);
assert.equal(M.poisson(0,0).X,1);
assert.ok(Math.abs(M.poisson(1,1).W1-M.poisson(1,1).W2)<1e-12);
let n=0;for(const g of Object.values(context.window.ApostasGolosModel.games)){
 if(!g.prob){assert.equal(M.probability(g.id,'W1'),null);continue;}
 n++;const p=['W1','X','W2'].map(k=>M.probability(g.id,k));assert.ok(Math.abs(p.reduce((a,b)=>a+b)-1)<1e-12);
 for(const k of ['BTTS','AND','O25'])assert.equal(M.probability(g.id,k),g.prob[k]);
 assert.ok(g.prob.AND<=Math.min(g.prob.BTTS,g.prob.O25));
 assert.equal(M.probability(g.id,'OR'),null);
}
assert.equal(n,context.window.ApostasGolosModel.coverage.estimated);console.log('OK: '+n+' distribuições 1/X/2 normalizadas; mercados conjuntos preservados; dados ausentes não fabricados.');
