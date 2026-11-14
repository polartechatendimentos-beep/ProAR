import test from 'node:test';import assert from 'node:assert/strict';
import {chatdeskSummary} from '../lib/chatdesk-summary.ts';
const now=Date.parse('2026-11-14T02:00:00Z');
const row=(overrides={})=>({companyId:'a',phone:'5517000',name:'Cliente',sector:'Geral',stage:'Novo contato',assignee:'',revision:1,botPaused:false,optOut:false,messages:[{id:'1',direction:'in',text:'Olá',at:'2026-11-13T22:00:00Z'}],requests:[],updatedAt:'2026-11-14T01:00:00Z',...overrides});
test('queue summary counts authorized loaded rows and uses the civil day in Sao Paulo',()=>{const rows=[row(),row({assignee:'operador',updatedAt:'2026-11-14T03:10:00Z'}),row({stage:'Concluído',messages:[],updatedAt:'2026-11-12T12:00:00Z'})];const original=structuredClone(rows);const result=chatdeskSummary(rows,now);assert.equal(result.unassigned,1);assert.equal(result.today,1);assert.equal(result.waiting,2);assert.deepEqual(rows,original);});
test('empty queue has no invented operational totals',()=>assert.deepEqual(chatdeskSummary([],now),{waiting:0,unassigned:0,today:0}));
