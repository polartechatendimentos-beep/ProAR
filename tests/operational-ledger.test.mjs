import test from "node:test";
import assert from "node:assert/strict";
import { prepareOperationalState, applyOperationalCommand, financialAccountBalance, independentOperationalRows } from "../lib/operational-ledger.ts";
const admin = { username:"audit.test", displayName:"Auditoria", can:()=>true };
const denied = { username:"viewer", can:()=>false };
const base = () => ({ customers:[],serviceOrders:[],moduleRecords:{Financeiro:[{id:"F1",name:"Serviço",value:100,transactionType:"Receber",status:"Em aberto",settledValue:0}],Produtos:[{id:"P1",name:"Tubo",stockCurrent:10,sku:"SKU-1"}],Compras:[{id:"C1",name:"Compra",status:"Aguardando entrega",purchaseItems:[{id:"I1",productId:"P1",description:"Tubo",quantity:5,unitValue:10,kind:"Produto"}]}]} });
const command = (action,data={},recordId="F1",key=crypto.randomUUID()) => ({action,data,recordId,idempotencyKey:key});
const run = (state,cmd,actor=admin) => applyOperationalCommand(state,cmd,actor,"2026-09-30T01:00:00Z").state;
const settlement = () => command("settle",{principal:100,interest:10,discount:5,accountId:"BANK",method:"Pix"});
test("principal quita título; juros e desconto alteram somente caixa",()=>{
  const next=run(base(),settlement());const title=next.moduleRecords.Financeiro[0];
  assert.equal(title.settledValue,100);assert.equal(title.status,"Recebida");assert.equal(financialAccountBalance("BANK",next.moduleRecords["Razão financeiro"]),105);
  assert.equal(title.settlementHistory[0].user,"audit.test");
});
test("baixa parcial respeita centavos",()=>{
  const next=run(base(),command("settle",{principal:33.33,interest:0,discount:0,accountId:"BANK"}));
  assert.equal(next.moduleRecords.Financeiro[0].settledValue,33.33);assert.equal(next.moduleRecords.Financeiro[0].status,"Recebida parcialmente");
});
test("estorno preserva baixa e cria compensação",()=>{
  const paid=run(base(),settlement());const entry=paid.moduleRecords.Financeiro[0].settlementHistory[0];
  const next=run(paid,command("reverse",{settlementId:entry.id,reason:"Conta incorreta"}));
  assert.deepEqual(next.moduleRecords.Financeiro[0].settlementHistory,paid.moduleRecords.Financeiro[0].settlementHistory);
  assert.equal(next.moduleRecords.Financeiro[0].settledValue,0);assert.equal(financialAccountBalance("BANK",next.moduleRecords["Razão financeiro"]),0);
});
test("duplo estorno é bloqueado",()=>{
  const paid=run(base(),settlement());const entry=paid.moduleRecords.Financeiro[0].settlementHistory[0];const next=run(paid,command("reverse",{settlementId:entry.id,reason:"Erro"}));
  assert.throws(()=>run(next,command("reverse",{settlementId:entry.id,reason:"Erro"})),/já foi estornada/);
});
test("idempotência impede repetir a mesma baixa",()=>{
  const cmd=settlement();const next=run(base(),cmd);const retry=applyOperationalCommand(next,cmd,admin);
  assert.equal(retry.replay,true);assert.equal(retry.state.moduleRecords.Financeiro[0].settlementHistory.length,1);
});
test("chave idempotente não pode representar outra operação",()=>{
  const cmd=settlement();const next=run(base(),cmd);assert.throws(()=>run(next,{...cmd,data:{...cmd.data,principal:50}}),/já usado/);
});
test("baixa acima do principal pendente é bloqueada",()=>assert.throws(()=>run(base(),command("settle",{principal:101,accountId:"BANK"})),/excede/));
test("desconto maior que o pagamento é bloqueado",()=>assert.throws(()=>run(base(),command("settle",{principal:100,discount:101,accountId:"BANK"})),/inconsistentes/));
test("conta inválida é bloqueada",()=>assert.throws(()=>run(base(),command("settle",{principal:100,accountId:"MISSING"})),/conta financeira/));
test("backend recusa baixa sem permissão",()=>assert.throws(()=>run(base(),settlement(),denied),error=>error.status===403));
test("permissão de editar não dá permissão de estornar",()=>{
  const paid=run(base(),settlement());assert.throws(()=>run(paid,command("reverse",{settlementId:paid.moduleRecords.Financeiro[0].settlementHistory[0].id,reason:"Erro"}),{username:"editor",can:p=>p==="financeiro.editar"}),error=>error.status===403);
});
test("histórico de baixa não pode ser sobrescrito via snapshot",()=>{
  const paid=run(base(),settlement());const edited=structuredClone(paid);edited.moduleRecords.Financeiro[0].settlementHistory[0].value=10;
  assert.throws(()=>prepareOperationalState(paid,edited,admin),/imutável/);
});
test("ledger não pode ser adulterado via snapshot",()=>{
  const paid=run(base(),settlement());const edited=structuredClone(paid);edited.moduleRecords["Razão financeiro"][0].signedValue=999;
  assert.throws(()=>prepareOperationalState(paid,edited,admin),/exclusivamente/);
});
test("título pago exige estorno antes de cancelar",()=>assert.throws(()=>run(run(base(),settlement()),command("cancel",{reason:"Erro"})),/Estorne/));
test("cancelamento sem motivo não é aceito",()=>assert.throws(()=>run(base(),command("cancel",{reason:""})),/motivo/));
test("título cancelado permanece na base",()=>{
  const next=run(base(),command("cancel",{reason:"Duplicado"}));assert.equal(next.moduleRecords.Financeiro.length,1);assert.equal(next.moduleRecords.Financeiro[0].status,"Cancelada");
});
test("exclusão física de título é bloqueada",()=>{
  const state=base(),next=structuredClone(state);next.moduleRecords.Financeiro=[];assert.throws(()=>prepareOperationalState(state,next,admin),/Não exclua/);
});
test("origem e parcela impedem duplicidade",()=>{
  const state=base();state.moduleRecords.Financeiro[0].purchaseId="C1";const next=structuredClone(state);next.moduleRecords.Financeiro.push({...next.moduleRecords.Financeiro[0],id:"F2"});assert.throws(()=>prepareOperationalState(state,next,admin),/Título já gerado/);
});
test("parcelas distintas da mesma origem são permitidas",()=>{
  const state=base();state.moduleRecords.Financeiro[0].purchaseId="C1";state.moduleRecords.Financeiro[0].installmentNumber=1;const next=structuredClone(state);next.moduleRecords.Financeiro.push({...next.moduleRecords.Financeiro[0],id:"F2",installmentNumber:2});assert.equal(prepareOperationalState(state,next,admin).moduleRecords.Financeiro.length,2);
});
test("recebimento parcial movimenta quantidade exata",()=>{
  const next=run(base(),command("receive",{items:[{itemId:"I1",productId:"P1",quantity:2}]},"C1"));assert.equal(next.moduleRecords.Produtos[0].stockCurrent,12);assert.equal(next.moduleRecords.Compras[0].status,"Recebida parcialmente");
  const final=run(next,command("receive",{items:[{itemId:"I1",productId:"P1",quantity:3}]},"C1"));assert.equal(final.moduleRecords.Produtos[0].stockCurrent,15);assert.equal(final.moduleRecords.Compras[0].status,"Recebida");
});
test("recebimento acima da quantidade pendente é bloqueado",()=>assert.throws(()=>run(base(),command("receive",{items:[{itemId:"I1",productId:"P1",quantity:6}]},"C1")),/Recebimento inválido/));
test("recebimento com produto incompatível é bloqueado",()=>assert.throws(()=>run(base(),command("receive",{items:[{itemId:"I1",productId:"OTHER",quantity:1}]},"C1")),/Recebimento inválido/));
test("recebimento idempotente não duplica estoque",()=>{
  const cmd=command("receive",{items:[{itemId:"I1",productId:"P1",quantity:2}]},"C1");const next=run(base(),cmd);assert.equal(run(next,cmd).moduleRecords.Produtos[0].stockCurrent,12);
});
test("saída reduz saldo pelo livro",()=>{
  const next=run(base(),command("stock",{productId:"P1",movementType:"Saída",quantity:3,reason:"Aplicação"},undefined));assert.equal(next.moduleRecords.Produtos[0].stockCurrent,7);
});
test("saída sem saldo é bloqueada",()=>assert.throws(()=>run(base(),command("stock",{productId:"P1",movementType:"Saída",quantity:11,reason:"Aplicação"},undefined)),/insuficiente/));
test("SKU duplicado é bloqueado sem apagar colisões históricas",()=>{
  const state=base(),next=structuredClone(state);next.moduleRecords.Produtos.push({id:"P2",name:"Outro",sku:"SKU-1"});assert.throws(()=>prepareOperationalState(state,next,admin),/sku já cadastrado/);
});
test("CPF/CNPJ duplicado é normalizado",()=>{
  const state=base();state.customers=[{id:"CLI1",doc:"12.345.678/0001-90"}];const next=structuredClone(state);next.customers.push({id:"CLI2",doc:"12345678000190"});assert.throws(()=>prepareOperationalState(state,next,admin),/doc já cadastrado/);
});
test("OS rejeita equipamento de outro cliente",()=>{
  const state=base();state.moduleRecords.Equipamentos=[{id:"E1",client:"Outra empresa"}];const next=structuredClone(state);next.serviceOrders=[{id:"OS1",client:"PolarTech",equipmentIds:["E1"]}];assert.throws(()=>prepareOperationalState(state,next,admin),/não pertence/);
});
test("registro alvo alterado retorna conflito",()=>{
  const state=base();const cmd={...settlement(),expectedRecord:{...state.moduleRecords.Financeiro[0],value:50}};assert.throws(()=>run(state,cmd),error=>error.status===409);
});
test("auditoria usa identidade do servidor e valores anteriores",()=>{
  const state=base(),next=structuredClone(state);next.moduleRecords.Produtos[0].value=30;const result=prepareOperationalState(state,next,admin);const entry=result.moduleRecords["Auditoria operacional"].find(item=>item.recordId==="P1");assert.equal(entry.user,"audit.test");assert.deepEqual(entry.changes.value,{before:null,after:30});
});
test("saldos antigos são preservados sem reentrada em compras já recebidas",()=>{
  const state=base();state.moduleRecords.Compras[0].status="Recebida";state.moduleRecords.Financeiro[0].settledValue=40;const next=prepareOperationalState(state,structuredClone(state),admin);assert.equal(next.moduleRecords.Produtos[0].stockCurrent,10);assert.equal(next.moduleRecords.Financeiro[0].settledValue,40);assert.equal(financialAccountBalance("LEGACY-legado-sem-conta-informada",next.moduleRecords["Razão financeiro"]),0);
  assert.equal(next.moduleRecords["Razão financeiro"].find(item=>item.kind==="Saldo legado").signedValue,40);
});
test("contas a pagar geram saída e estorno gera entrada",()=>{
  const state=base();state.moduleRecords.Financeiro[0].transactionType="Pagar";const paid=run(state,settlement());assert.equal(financialAccountBalance("BANK",paid.moduleRecords["Razão financeiro"]),-105);const next=run(paid,command("reverse",{settlementId:paid.moduleRecords.Financeiro[0].settlementHistory[0].id,reason:"Erro"}));assert.equal(financialAccountBalance("BANK",next.moduleRecords["Razão financeiro"]),0);
});
test("conciliação é separada da baixa e imutável",()=>{
  const paid=run(base(),settlement());const movement=paid.moduleRecords["Razão financeiro"].find(item=>item.kind==="Baixa");const next=run(paid,command("reconcile",{movementId:movement.id,accountId:"BANK",reference:"EXTRATO-1"},undefined));assert.equal(next.moduleRecords["Conciliações"].length,1);assert.deepEqual(next.moduleRecords["Razão financeiro"],paid.moduleRecords["Razão financeiro"]);assert.throws(()=>run(next,command("reconcile",{movementId:movement.id,accountId:"BANK",reference:"EXTRATO-2"},undefined)),/já conciliado/);
});
test("registros independentes mantêm tenant e origem",()=>{
  const next=run(base(),settlement());const rows=independentOperationalRows("tenant-A",next);assert.ok(rows.some(row=>row.id==="erp:tenant-A:Financeiro:F1"));assert.ok(rows.every(row=>row.payload.companyId==="tenant-A"));
});
test("compra recebida em partes gera título uma única vez",()=>{
  const state=base();state.moduleRecords.Compras[0].value=50;
  const first=run(state,command("receive",{items:[{itemId:"I1",productId:"P1",quantity:2}]},"C1"));
  const second=run(first,command("receive",{items:[{itemId:"I1",productId:"P1",quantity:3}]},"C1"));
  assert.equal(second.moduleRecords.Financeiro.filter(item=>item.purchaseId==="C1").length,1);
});
test("conclusão e reabertura de OS não duplicam receita nem consumo",()=>{
  const state=base();state.serviceOrders=[{id:"OS1",client:"PolarTech",status:"Agendada",total:150,catalogItems:[{id:"P1",kind:"Produto",quantity:2}]}];
  const draft=structuredClone(state);draft.serviceOrders[0].status="Concluída";
  const closed=prepareOperationalState(state,draft,admin);assert.equal(closed.moduleRecords.Produtos[0].stockCurrent,8);
  assert.equal(closed.moduleRecords.Financeiro.find(item=>item.serviceOrderId==="OS1").value,150);
  const reopened=structuredClone(closed);reopened.serviceOrders[0].status="Agendada";
  const middle=prepareOperationalState(closed,reopened,admin);const final=structuredClone(middle);final.serviceOrders[0].status="Concluída";
  const next=prepareOperationalState(middle,final,admin);assert.equal(next.moduleRecords.Produtos[0].stockCurrent,8);assert.equal(next.moduleRecords.Financeiro.filter(item=>item.serviceOrderId==="OS1").length,1);
});
test("baixa direta sem histórico é bloqueada",()=>{
  const state=base(),next=structuredClone(state);next.moduleRecords.Financeiro[0].settledValue=100;assert.throws(()=>prepareOperationalState(state,next,admin),/Não edite/);
});
test("saldo inicial da conta não pode ser reescrito",()=>{
  const state=run(base(),command("account",{name:"Banco A",openingBalance:100},undefined));const next=structuredClone(state);next.moduleRecords["Contas financeiras"].find(item=>item.name==="Banco A").openingBalance=1;assert.throws(()=>prepareOperationalState(state,next,admin),/imutável/);
});
test("serial duplicado é bloqueado",()=>{
  const state=base();state.moduleRecords.Equipamentos=[{id:"E1",serialNumber:"SER-1"}];const next=structuredClone(state);next.moduleRecords.Equipamentos.push({id:"E2",serialNumber:"SER-1"});assert.throws(()=>prepareOperationalState(state,next,admin),/serialNumber já cadastrado/);
});
test("ajuste direto de estoque exige motivo e gera movimento",()=>{
  const state=base(),next=structuredClone(state);next.moduleRecords.Produtos[0].stockCurrent=8;assert.throws(()=>prepareOperationalState(state,next,admin),/exige motivo/);next.moduleRecords.Produtos[0].stockAdjustmentReason="Contagem física";const result=prepareOperationalState(state,next,admin);assert.equal(result.moduleRecords.Produtos[0].stockCurrent,8);assert.equal(result.moduleRecords["Livro de estoque"].find(item=>item.kind==="Ajuste").quantity,-2);
});
test("saldo legado aceita estorno formal com compensação",()=>{
  const state=base();state.moduleRecords.Financeiro[0].settledValue=40;const next=run(state,command("reverse",{settlementId:"LEGACY-F1",reason:"Baixa legada incorreta"}));assert.equal(next.moduleRecords.Financeiro[0].settledValue,0);assert.equal(next.moduleRecords["Razão financeiro"].reduce((sum,item)=>sum+item.signedValue,0),0);
  assert.throws(()=>run(next,command("reverse",{settlementId:"LEGACY-F1",reason:"De novo"})),/já foi estornada/);
});
test("mudança só na situação não quita um título",()=>{
  const state=base(),next=structuredClone(state);next.moduleRecords.Financeiro[0].status="Recebida";assert.throws(()=>prepareOperationalState(state,next,admin),/baixa formal/);
});
test("segunda operação grava apenas entidades alteradas",()=>{
  const state=run(base(),command("settle",{principal:50,accountId:"BANK"}));const next=run(state,command("settle",{principal:50,accountId:"BANK"}));const rows=independentOperationalRows("tenant-A",next,state);assert.ok(rows.some(row=>row.payload.module==="Financeiro"));assert.ok(!rows.some(row=>row.payload.module==="Produtos"));
});
test("ordem das chaves JSON não gera falso conflito",()=>{
  const state=base();const target=state.moduleRecords.Financeiro[0];const expected=Object.fromEntries(Object.entries(target).reverse());const next=run(state,{...settlement(),expectedRecord:expected});assert.equal(next.moduleRecords.Financeiro[0].settledValue,100);
});

test("movimento de estoque preserva destino operacional",()=>{
  const next=run(base(),command("stock",{productId:"P1",movementType:"Saída",quantity:2,reason:"Aplicação em campo",destinationType:"OS",destinationId:"OS-123",destinationName:"OS-123"},undefined));
  const movement=next.moduleRecords["Livro de estoque"].find(item=>item.kind==="Saída" || item.movementType==="Saída");
  assert.equal(movement.destinationType,"OS");assert.equal(movement.destinationId,"OS-123");assert.equal(next.moduleRecords.Produtos[0].stockCurrent,8);
});


test("transferência interna preserva saldo global e registra origem e destino",()=>{
  const initial=base();
  const before=initial.moduleRecords.Produtos[0].stockCurrent;
  const next=run(initial,command("stock-transfer",{productId:"P1",quantity:3,sourceType:"Estoque central",sourceId:"CENTRAL",sourceName:"Central",destinationType:"Veículo",destinationId:"VAN-01",destinationName:"VAN-01",reason:"Abastecimento da equipe"},undefined));
  const movement=next.moduleRecords["Livro de estoque"].find(item=>item.kind==="Transferência");
  assert.ok(movement);
  assert.equal(movement.transferQuantity,3);
  assert.equal(movement.sourceType,"Estoque central");
  assert.equal(movement.destinationType,"Veículo");
  assert.equal(next.moduleRecords.Produtos[0].stockCurrent,before);
});


test("compra acima da alçada gera aprovação e bloqueia recebimento",()=>{
  const state=base();
  const draft=structuredClone(state);
  draft.moduleRecords.Compras[0].value=6000;
  const prepared=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  const approval=prepared.moduleRecords["Aprovações"].find(item=>item.sourceId==="C1");
  assert.ok(approval);
  assert.equal(prepared.moduleRecords.Compras[0].approvalStatus,"Pendente");
  assert.throws(()=>run(prepared,command("receive",{items:[{itemId:"I1",productId:"P1",quantity:1}]},"C1")),/depende de aprovação/);
});

test("aprovação por alçada libera recebimento da compra",()=>{
  const state=base();
  const draft=structuredClone(state);
  draft.moduleRecords.Compras[0].value=6000;
  const prepared=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  const approval=prepared.moduleRecords["Aprovações"][0];
  const approved=run(prepared,command("approval-decide",{decision:"Aprovado",reason:"Compra necessária para obra"},approval.id));
  assert.equal(approved.moduleRecords.Compras[0].approvalStatus,"Aprovado");
  const received=run(approved,command("receive",{items:[{itemId:"I1",productId:"P1",quantity:1}]},"C1"));
  assert.equal(received.moduleRecords.Produtos[0].stockCurrent,11);
});

test("alteração do valor após aprovação exige nova alçada",()=>{
  const state=base();
  const draft=structuredClone(state);
  draft.moduleRecords.Compras[0].value=6000;
  const prepared=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  const approval=prepared.moduleRecords["Aprovações"][0];
  const approved=run(prepared,command("approval-decide",{decision:"Aprovado",reason:"Aprovada"},approval.id));
  const changed=structuredClone(approved);
  changed.moduleRecords.Compras[0].value=7000;
  const next=prepareOperationalState(approved,changed,admin,"2026-10-02T11:00:00Z");
  assert.equal(next.moduleRecords.Compras[0].approvalStatus,"Pendente");
  assert.ok(next.moduleRecords["Aprovações"].filter(item=>item.sourceId==="C1").length>=2);
});

test("conclusão de OS prepara fiscal e lembrete sem emitir automaticamente",()=>{
  const state=base();
  state.serviceOrders=[{id:"OS-AUTO",client:"Cliente",status:"Aberta",total:500,reminderDate:"2027-01-10",reminderMessage:"Revisar equipamento"}];
  const draft=structuredClone(state);
  draft.serviceOrders[0].status="Concluída";
  const next=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  assert.ok(next.moduleRecords["Central Fiscal"].some(item=>item.serviceOrderId==="OS-AUTO"&&item.status==="Pendente"));
  assert.ok(next.moduleRecords.Lembretes.some(item=>item.serviceOrderId==="OS-AUTO"&&item.date==="2027-01-10"));
});

test("transferência não permite retirar mais que o saldo da localização",()=>{
  const initial=base();
  const moved=run(initial,command("stock-transfer",{productId:"P1",quantity:3,sourceType:"Estoque central",destinationType:"Veículo",destinationId:"V1",destinationName:"V1"},undefined));
  assert.throws(()=>run(moved,command("stock-transfer",{productId:"P1",quantity:4,sourceType:"Veículo",sourceId:"V1",sourceName:"V1",destinationType:"OS",destinationId:"OS-1",destinationName:"OS-1"},undefined)),/Saldo insuficiente na origem/);
});


test("mudança do desconto do orçamento renova aprovação mesmo com total igual",()=>{
  const state=base();
  state.moduleRecords.Orçamentos=[{id:"O1",name:"Orçamento",client:"Cliente",value:900,discountPercent:15,status:"Enviado"}];
  const draft=structuredClone(state);
  draft.moduleRecords.Orçamentos[0].description="Solicitação de aprovação";
  const prepared=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  const approval=prepared.moduleRecords["Aprovações"].find(item=>item.sourceId==="O1");
  const approved=run(prepared,command("approval-decide",{decision:"Aprovado",reason:"Desconto autorizado"},approval.id));
  const changed=structuredClone(approved);
  changed.moduleRecords.Orçamentos[0].discountPercent=20;
  const next=prepareOperationalState(approved,changed,admin,"2026-10-02T11:00:00Z");
  assert.equal(next.moduleRecords.Orçamentos[0].approvalStatus,"Pendente");
  assert.ok(next.moduleRecords["Aprovações"].filter(item=>item.sourceId==="O1").length>=2);
});


test("redução da compra abaixo da alçada dispensa aprovação pendente",()=>{
  const state=base();
  const draft=structuredClone(state);
  draft.moduleRecords.Compras[0].value=6000;
  const prepared=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  const changed=structuredClone(prepared);
  changed.moduleRecords.Compras[0].value=4000;
  const next=prepareOperationalState(prepared,changed,admin,"2026-10-02T11:00:00Z");
  assert.equal(next.moduleRecords.Compras[0].approvalRequired,false);
  assert.equal(next.moduleRecords.Compras[0].approvalStatus,"Dispensado");
  assert.equal(next.moduleRecords["Aprovações"].find(item=>item.sourceId==="C1").status,"Cancelado");
  const received=run(next,command("receive",{items:[{itemId:"I1",productId:"P1",quantity:1}]},"C1"));
  assert.equal(received.moduleRecords.Produtos[0].stockCurrent,11);
});

test("redução do desconto para a alçada dispensa aprovação pendente",()=>{
  const state=base();
  state.moduleRecords.Orçamentos=[{id:"O1",name:"Orçamento",client:"Cliente",value:900,discountPercent:15,status:"Enviado"}];
  const draft=structuredClone(state);
  draft.moduleRecords.Orçamentos[0].description="Solicitação de aprovação";
  const prepared=prepareOperationalState(state,draft,admin,"2026-10-02T10:00:00Z");
  const changed=structuredClone(prepared);
  changed.moduleRecords.Orçamentos[0].discountPercent=10;
  const next=prepareOperationalState(prepared,changed,admin,"2026-10-02T11:00:00Z");
  assert.equal(next.moduleRecords.Orçamentos[0].approvalRequired,false);
  assert.equal(next.moduleRecords.Orçamentos[0].approvalStatus,"Dispensado");
  assert.equal(next.moduleRecords["Aprovações"].find(item=>item.sourceId==="O1").status,"Cancelado");
});
