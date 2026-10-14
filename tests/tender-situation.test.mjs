import test from "node:test";
import assert from "node:assert/strict";
import {tenderSituation,tenderDeadlineExtended} from "../lib/tender-situation.ts";
const now=new Date("2026-10-14T12:00:00Z");
test("passed proposal deadline is not homologation",()=>assert.equal(tenderSituation({dataEncerramentoProposta:"2026-10-13T12:00:00Z"},now),"prazo_encerrado"));
test("new deadline can reopen opportunity",()=>assert.equal(tenderSituation({dataEncerramentoProposta:"2026-10-15T12:00:00Z"},now),"aberta"));
test("suspension and cancellation override future deadline",()=>{assert.equal(tenderSituation({situacaoCompraNome:"Suspensa",dataEncerramentoProposta:"2026-10-15"},now),"suspensa");assert.equal(tenderSituation({situacaoCompraNome:"Revogada",dataEncerramentoProposta:"2026-10-15"},now),"cancelada");});
test("unknown deadline requires validation",()=>assert.equal(tenderSituation({dataEncerramentoProposta:"bad"},now),"validacao"));
test("detect extensions without confusing equal or missing dates",()=>{assert.equal(tenderDeadlineExtended({dataEncerramentoProposta:"2026-10-13"},{dataEncerramentoProposta:"2026-10-15"}),true);assert.equal(tenderDeadlineExtended({},{dataEncerramentoProposta:"2026-10-15"}),false);});
