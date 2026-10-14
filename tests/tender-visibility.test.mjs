import test from "node:test";
import assert from "node:assert/strict";
import {isTenderClosed} from "../lib/tender-visibility.ts";
const now=new Date("2026-10-14T12:00:00Z");
test("expired proposals are history even if source status is active",()=>assert.equal(isTenderClosed({validationStatus:"active_confirmed",dataEncerramentoProposta:"2026-10-13T12:00:00Z"},now),true));
test("future deadlines remain visible",()=>assert.equal(isTenderClosed({dataEncerramentoProposta:"2026-10-15T12:00:00Z"},now),false));
test("history status is excluded regardless of deadline",()=>assert.equal(isTenderClosed({validationStatus:"history",dataEncerramentoProposta:"2026-10-15T12:00:00Z"},now),true));
test("missing or invalid dates require validation rather than automatic closure",()=>{assert.equal(isTenderClosed({},now),false);assert.equal(isTenderClosed({dataEncerramentoProposta:"invalid"},now),false);});
