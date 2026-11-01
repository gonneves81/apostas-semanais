/* Única definição dos mercados e extensão 1X2 do mesmo Poisson usado nos golos. */
(function(){
'use strict';
const labels={W1:'1 · Casa',X:'X · Empate',W2:'2 · Fora',BTTS:'Ambas Marcam',O25:'+2,5 golos',AND:'AM e +2,5'};
function poisson(h,a){
 if(!Number.isFinite(h)||!Number.isFinite(a)||h<0||a<0||h>15||a>15)return null;
 const H=[Math.exp(-h)],A=[Math.exp(-a)],p={W1:0,X:0,W2:0};let mass=0;
 for(let i=1;i<=80;i++){H[i]=H[i-1]*h/i;A[i]=A[i-1]*a/i;}
 for(let i=0;i<H.length;i++)for(let j=0;j<A.length;j++){const v=H[i]*A[j];mass+=v;p[i>j?'W1':i===j?'X':'W2']+=v;}
 for(const k of Object.keys(p))p[k]/=mass;return p;
}
const cache=new Map();
function probability(id,k){
 if(!Object.hasOwn(labels,k))return null;
 const row=window.ApostasGolosModel?.games?.[id];if(!row?.prob)return null;
 const ck=row.lambdaHome+'|'+row.lambdaAway;if(!cache.has(ck))cache.set(ck,poisson(row.lambdaHome,row.lambdaAway));
 const p=['W1','X','W2'].includes(k)?cache.get(ck)?.[k]:row.prob[k];
 return Number.isFinite(p)&&p>=0&&p<=1?p:null;
}
window.ApostasMercados={labels,probability,poisson};
})();
