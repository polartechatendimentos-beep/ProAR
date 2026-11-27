import test from "node:test";
import assert from "node:assert/strict";
import { assessBiddingEvidence } from "../lib/bidding-evidence.ts";
import { computeBidFloor, evaluateAssistedBid } from "../lib/bidding-assisted-floor.ts";

const date=new Date("2026-11-27T10:00:00Z");
const requirement={id:"r",category:"FGTS",description:"Certidão FGTS",threshold:"",unit:"",documentId:"cert",sourceQuote:"16.3.6 Prova de regularidade do FGTS.",dueDate:"2026-12-01",phase:"Habilitação",evidenceRevision:3};
const doc={id:"cert",_revision:3,category:"FGTS",tenderId:"",uploaded:true,sha256:"hash",review:"approved",validUntil:"2026-12-01",noExpiry:false};

test("matriz confere data de habilitação e não dá aprovação a evidência fora da categoria ou do edital",()=>{
 assert.equal(assessBiddingEvidence(requirement,doc,"fronteira",date).status,"comprovado");
 assert.equal(assessBiddingEvidence(requirement,{...doc,validUntil:"2026-11-30"},"fronteira",date).status,"não atende");
 assert.equal(assessBiddingEvidence(requirement,{...doc,category:"Trabalhista"},"fronteira",date).status,"não atende");
 assert.equal(assessBiddingEvidence(requirement,{...doc,tenderId:"outro"},"fronteira",date).status,"não atende");
 assert.equal(assessBiddingEvidence(requirement,{...doc,validUntil:"",noExpiry:false},"fronteira",date).status,"pendente");
 assert.equal(assessBiddingEvidence(requirement,{...doc,_revision:4},"fronteira",date).status,"pendente");
 assert.equal(assessBiddingEvidence({...requirement,sourceQuote:""},doc,"fronteira",date).status,"pendente");
});

test("atestado distingue unidade divergente, quantidade insuficiente e falta de prova",()=>{
 const tech={...requirement,category:"Atestado técnico",threshold:"250",unit:"unidades",technicalEvidence:{issuer:"Órgão",service:"Higienização",quantity:"200",unit:"unidades",startDate:"2025-01-01",endDate:"2025-12-31",professionalRecord:""}};
 const att={...doc,category:"Atestado técnico"};
 assert.match(assessBiddingEvidence(tech,att,"fronteira",date).detail,/menor/);
 assert.match(assessBiddingEvidence({...tech,unit:"BTUs"},att,"fronteira",date).detail,/unidade/);
 assert.equal(assessBiddingEvidence({...tech,threshold:"duzentos"},att,"fronteira",date).status,"pendente");
 assert.equal(assessBiddingEvidence({...tech,threshold:"200"},att,"fronteira",date).status,"comprovado");
});

const cost={scope:"lote",reference:"IV",materials:"100,00",labor:"150,00",travel:"40",other:"10",taxes:"8",margin:"12"};
test("piso arredonda para cima, separa equilíbrio da margem e só compara piso aprovado por escopo",()=>{
 const calc=computeBidFloor(cost);
 assert.equal(calc.key,"lote:iv");
 assert.equal(calc.directCents,30000);
 assert.equal(calc.breakEvenCents,32609);
 assert.equal(calc.floorCents,37500);
 assert.equal(evaluateAssistedBid({...cost,...calc,status:"pending"},"375,00").status,"pendente");
 assert.equal(evaluateAssistedBid({...cost,...calc,status:"approved"},"374,99").status,"abaixo");
 assert.equal(evaluateAssistedBid({...cost,...calc,status:"approved"},"375,00").status,"ok");
 assert.equal(computeBidFloor({...cost,scope:"item"}).key,"item:iv");
 assert.throws(()=>computeBidFloor({...cost,materials:""}),/todos os custos/);
 assert.throws(()=>computeBidFloor({...cost,labor:"-1"}),/todos os custos/);
 assert.throws(()=>computeBidFloor({...cost,margin:"92"}),/abaixo de 100/);
});
