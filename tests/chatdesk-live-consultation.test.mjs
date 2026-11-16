import test from "node:test";
import assert from "node:assert/strict";
import {catalogForChat,scheduledSlotsForChat} from "../lib/chatdesk-live-consultation.ts";
test("não inventa preço nem usa custo como venda",()=>{
 const x=catalogForChat({"Serviços":[{id:"1",name:"Instalação 12000",cost:450},{id:"2",name:"Higienização",salePrice:220},{id:"3",name:"Inativo",price:40,status:"Inativo"}]});
 assert.equal(x.total,2);assert.equal(x.items[0].price,null);assert.equal(x.items[1].price,220);
});
test("não inventa vagas e só projeta agendamentos ativos",()=>{
 const x=scheduledSlotsForChat([{date:"2026-11-20",time:"16:00",tech:"Lucas"},{date:"2026-11-20",time:"14:00",status:"Cancelado"}],"2026-11-20");
 assert.deepEqual(x,[{time:"16:00",technician:"Lucas",durationMinutes:60}]);
});
