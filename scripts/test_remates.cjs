const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const ctx={window:{},document:{readyState:'loading',addEventListener(){}}};vm.runInNewContext(fs.readFileSync('remates.js','utf8'),ctx);
const agg=ctx.window.ApostasRemates.aggregate;
let a=agg([{venue:'C',for:0,against:4},{venue:'C',for:6,against:2},{venue:'C',for:null,against:1},{venue:'F',for:20,against:0}],'C');
assert.equal(a.n,2);assert.equal(a.total,3);assert.equal(a.avgFor,3);assert.equal(a.avgAgainst,3);assert.equal(agg([],'F').avgFor,null);
const html=fs.readFileSync('index.html','utf8'),data=JSON.parse(html.match(/<script id="data-json" type="application\/json">(.*?)<\/script>/s)[1]);const games=data.games,d=JSON.parse(fs.readFileSync('dados/remates-'+data.start+'.json'));
for(const g of games)for(const side of ['home','away'])for(const r of d.byGame[g.id][side].results){assert.ok(r.date<g.date);assert.ok(['C','F'].includes(r.venue));for(const k of ['for','against'])assert.ok(r[k]===null||(Number.isInteger(r[k])&&r[k]>=0));}
console.log('OK: médias casa/fora, zeros, dados ausentes e corte temporal de '+games.length+' jogos.');
