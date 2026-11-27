import test from "node:test";
import assert from "node:assert/strict";
import {biddingFinancialApprovalIssue,calculateBiddingFinancialRatios} from "../lib/bidding-financial-audit.ts";

const base={currentAssets:10,currentLiabilities:10,realizableLongTerm:2,longTermLiabilities:2,totalAssets:12,minimumCurrent:"1,0",minimumGeneral:"1.0",minimumSolvency:"1.0",sourceNote:"Cláusula 16.4.3",documentIds:["real-document"]};
const frontier=[{category:"Índices econômico-financeiros",sourceQuote:"Índices LG, LC e SG maiores que 1,0"}];
const statuses=input=>calculateBiddingFinancialRatios(input).map(r=>r.status);
test("Fronteira: 1,0 reprova com estrito, mas passa com regra inclusiva",()=>{
 const strict={...base,operatorCurrent:"gt",operatorGeneral:"gt",operatorSolvency:"gt"};
 const inclusive={...base,operatorCurrent:"gte",operatorGeneral:"gte",operatorSolvency:"gte"};
 assert.deepEqual(statuses(strict),["below","below","below"]);
 assert.match(biddingFinancialApprovalIssue(strict,frontier),/não atende/);
 assert.deepEqual(statuses(inclusive),["ok","ok","ok"]);
 assert.match(biddingFinancialApprovalIssue(inclusive,frontier),/difere da referência/);
 assert.equal(biddingFinancialApprovalIssue(inclusive,[{category:"Índices econômico-financeiros",sourceQuote:"LC, LG e SG maiores ou iguais a 1,0"}]),null);
 assert.deepEqual(statuses({...strict,currentAssets:12,totalAssets:13}),["ok","ok","ok"]);
});
test("mantém operador individual e compara somas decimais sem aprovar igualdade por arredondamento",()=>{
 const mixed={...base,currentAssets:0.1,currentLiabilities:0.3,realizableLongTerm:0.2,longTermLiabilities:0,totalAssets:0.3,operatorCurrent:"gte",minimumCurrent:"0.3",operatorGeneral:"gt",operatorSolvency:"gte"};
 const results=calculateBiddingFinancialRatios(mixed);
 assert.deepEqual(results.map(r=>[r.operator,r.status]),[["gte","ok"],["gt","below"],["gte","ok"]]);
});
test("auditoria legada, mínimo obrigatório vazio e denominador inválido não aprovam",()=>{
 assert.deepEqual(statuses(base),["missing","missing","missing"]);
 assert.match(biddingFinancialApprovalIssue(base,frontier),/informe o operador/);
 const valid={...base,operatorCurrent:"gte",operatorGeneral:"gte",operatorSolvency:"gte"};
 assert.match(biddingFinancialApprovalIssue({...valid,minimumCurrent:""},frontier),/limite/);
 assert.match(biddingFinancialApprovalIssue({...valid,currentLiabilities:0},frontier),/não pode ser calculado/);
 assert.equal(biddingFinancialApprovalIssue(undefined,[{category:"CNPJ"}]),null);
 assert.match(biddingFinancialApprovalIssue(undefined,[{category:"Balanço Patrimonial"}]),/Complete a auditoria/);
});
test("permite não exigido com referência, sem esconder índice obrigatório da matriz",()=>{
 const audit={...base,operatorCurrent:"gte",operatorGeneral:"not_required",operatorSolvency:"not_required"};
 assert.deepEqual(statuses(audit),["ok","not_required","not_required"]);
 assert.equal(biddingFinancialApprovalIssue(audit,[{category:"Índices econômico-financeiros",description:"Liquidez Corrente"}]),null);
 assert.match(biddingFinancialApprovalIssue(audit,frontier),/marcado como não exigido/);
 assert.match(biddingFinancialApprovalIssue({...audit,sourceNote:""},frontier),/registre a referência/);
});
