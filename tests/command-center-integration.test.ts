import {describe,it,expect} from "vitest";
import {buildCommandCenter} from "../lib/command-center";
describe("integrated ProAR command center",()=>{
 it("combines actions, stock forecast and day close",()=>{
  const c=buildCommandCenter([{id:"OS1",status:"Concluída",nfseStatus:"Pendente"}],{Produtos:[{id:"P1",name:"Cobre",stockCurrent:2,stockReserved:1,stockMin:5,scheduledDemand:3}],Financeiro:[]});
  expect(c.dayClose.canClose).toBe(false);
  expect(c.dayClose.checks.find(x=>x.key==="fiscal")?.count).toBe(1);
  expect(c.stockForecast[0].status).toBe("critical");
 });
});
