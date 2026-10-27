import test from "node:test";import assert from "node:assert/strict";import {guardOperationalCommand,inferRuleContext} from "../lib/command-guard.ts";
test("command guard maps critical operations to central rule kinds",()=>{assert.equal(inferRuleContext({type:"stock.consume"}).kind,"stock");assert.equal(inferRuleContext({type:"payment.pix"}).kind,"payment");assert.equal(inferRuleContext({type:"service_order.finish"}).kind,"service_order");assert.equal(inferRuleContext({type:"service_order.finish"}).action,"finish")});
test("command guard blocks incomplete service close",()=>{assert.throws(()=>guardOperationalCommand({kind:"service_order",action:"finish",checklistReady:false}),/checklist/i)});

test("inferred service close is blocked when checklist is pending",()=>{const ctx=inferRuleContext({type:"service_order.finish",checklistReady:false});assert.throws(()=>guardOperationalCommand(ctx),error=>error.code==="CHECKLIST_PENDING"&&error.status===409)});
