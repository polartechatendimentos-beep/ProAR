import test from "node:test";
import assert from "node:assert/strict";
import {deriveServiceOrderTrace} from "../lib/service-order-trace.ts";

const scope={inventory:true,finance:true,fiscal:true};
const order={id:"OS-1",client:"Cliente",status:"Concluída",nfseStatus:"Autorizada",nfseNumber:"123",nfseVerificationCode:"KEY",catalogItems:[{id:"P1",kind:"Produto"}]};
const build=()=>{
 const title={id:"T1",serviceOrderId:order.id,originKey:"R:os:OS-1:1",transactionType:"Receber",invoiceNumber:"123",fiscalDocumentKey:"KEY",value:100,settledValue:100,settlementHistory:[{id:"E1",principal:100,value:102,interest:2}],status:"Recebida"};
 return {"Livro de estoque":[{id:"SAI",serviceOrderId:order.id,kind:"Saída",productId:"P1",quantity:-1}],
 "Central Fiscal":[{id:"QUEUE",serviceOrderId:order.id,status:"Pendente"}],
 "Documentos Fiscais":[{id:"F1",serviceOrderId:order.id,status:"Autorizada",number:"123",verificationCode:"KEY"}],
 Financeiro:[title],"Razão financeiro":[{id:"MOV1",titleId:"T1",settlementId:"E1",kind:"Baixa",signedValue:102}]};
};
const byLabel=(steps,label)=>steps.find(step=>step.label===label);
test("trilha confirma apenas os movimentos e a baixa conciliáveis, sem modificar entradas",()=>{
 const data=build(),copy=structuredClone(data);
 const steps=deriveServiceOrderTrace(order,data,scope);
 assert.deepEqual(steps.map(row=>row.status),["registrado","registrado","registrado","registrado","registrado"]);
 assert.match(steps.at(-1).detail,/102,00/);
 assert.doesNotMatch(steps[2].references.join(","),/QUEUE/);
 assert.deepEqual(data,copy);
});
test("não deduz associação por nome, número da nota ou valor, nem informa etapa sem visibilidade",()=>{
 const missing=deriveServiceOrderTrace({...order,nfseStatus:"",nfseNumber:"",nfseVerificationCode:""},{Financeiro:[{id:"T1",client:"Cliente",invoiceNumber:"123",value:100}]},scope);
 assert.deepEqual(missing.map(row=>row.status),["registrado","vínculo ausente","vínculo ausente","vínculo ausente","pendente"]);
 const hidden=deriveServiceOrderTrace(order,build(),{});
 assert.deepEqual(hidden.slice(1).map(row=>[row.status,row.references]),Array.from({length:4},()=>["sem visibilidade",[]]));
});
test("números fiscais divergentes, parcela duplicada e movimentos legados não são somados",()=>{
 const data=build();data.Financeiro.push({...data.Financeiro[0],id:"T2"});
 data["Documentos Fiscais"].push({...data["Documentos Fiscais"][0],id:"F2",number:"999"});
 data.Estoque=[{id:"LEGADO",serviceOrderId:order.id,kind:"Saída",quantity:1}];
 const steps=deriveServiceOrderTrace(order,data,scope);
 assert.deepEqual(steps.slice(1).map(row=>row.status),["incerto","vínculo ambíguo","vínculo ambíguo","incerto"]);
 assert.match(steps[3].detail,/Não liquide/);
});
test("processamento do provedor, cadastro divergente e baixa sem razão não permitem repetir",()=>{
 const data=build();data["Razão financeiro"]=[];
 const current=deriveServiceOrderTrace(order,data,scope,{status:"Conferência pendente"});
 assert.match(byLabel(current,"Nota fiscal").detail,/não reemita/);
 assert.equal(current.at(-1).status,"incerto");
 assert.equal(deriveServiceOrderTrace({...order,nfseStatus:"Cancelada"},build(),scope,{status:"Autorizada",number:"123"})[2].status,"incerto");
});
test("títulos parcelados únicos e estorno se refletem sem simular recebimento",()=>{
 const data=build();
 data.Financeiro[0]={...data.Financeiro[0],settledValue:0,status:"Em aberto",reversalHistory:[{id:"REV1",settlementId:"E1"}]};
 data.Financeiro.push({id:"T2",serviceOrderId:order.id,installmentNumber:2,transactionType:"Receber",invoiceNumber:"123",value:100,status:"Em aberto"});
 data["Razão financeiro"].push({id:"REV-MOV1",titleId:"T1",settlementId:"E1",reversesMovementId:"MOV1",kind:"Estorno",signedValue:-102});
 const receipt=deriveServiceOrderTrace(order,data,scope).at(-1);
 assert.equal(receipt.status,"registrado"); assert.match(receipt.detail,/não há recebimento líquido/);
 data["Razão financeiro"][1].signedValue=-100;
 assert.equal(deriveServiceOrderTrace(order,data,scope).at(-1).status,"incerto");
});
