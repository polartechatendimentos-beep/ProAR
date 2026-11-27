import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {runInNewContext} from 'node:vm';
import * as calendar from '../lib/agenda-calendar.ts';
import * as insights from '../lib/agenda-insights.ts';
import * as workspace from '../lib/order-workspace-state.ts';
import * as usability from '../lib/daily-usability.ts';
import * as suggestions from '../lib/agenda-scheduling-suggestions.ts';

const require=createRequire(import.meta.url);
const ts=require('typescript');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const src=readFileSync(new URL('../components/OperationalAgenda.tsx',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
const today='2026-11-27';
const modules={
 '../lib/agenda-calendar':{...calendar,agendaToday:()=>today},
 '../lib/agenda-insights':insights,
 '../lib/order-workspace-state':workspace,
 '../lib/daily-usability':usability,
 '../lib/agenda-scheduling-suggestions':suggestions,
 './OperationalAgenda.module.css':{__esModule:true,default:new Proxy({},{get:(_,key)=>String(key)})},
 './QuickScheduleAssistant':{QuickScheduleAssistant:()=>null},
};
const mod={exports:{}};
runInNewContext(js,{exports:mod.exports,module:mod,require:name=>modules[name]??require(name)});
const row=(id,changes={})=>({id,client:'Cliente teste',unit:'Unidade teste',service:'Instalação',address:'Rua teste',status:'Agendada',tone:'blue',date:today,time:'08:30',tech:'Técnico A',...changes});
const markup=(orders,editable=true)=>renderToStaticMarkup(React.createElement(mod.exports.OperationalAgenda,{companyId:'synthetic',orders,onCreate(){},onSelect(){},onScheduleUpdate:editable?async()=>true:undefined}));
const block=html=>html.match(/<section class="todayIssues"[\s\S]*?<\/section>/)?.[0]||'';

test('Agenda real destaca hoje, distingue as duas pendências e mantém os demais casos fora do bloco',()=>{
 const html=block(markup([
  row('OS-SEM-TECNICO',{tech:' Sem técnico '}),
  row('OS-SEM-HORARIO',{time:'25:00'}),
  row('OS-AMBAS',{tech:'Não informada',time:''}),
  row('OS-MAIS',{tech:'',time:''}),
  row('OS-OK'),
  row('OS-OK-ID',{tech:'',employeeId:'assigned'}),
  row('OS-ENCERRADA',{tech:'',status:'Finalizada'}),
  row('OS-AMANHA',{date:'2026-11-28',tech:''}),
  row('OS-SEM-DATA',{date:'',tech:''}),
 ]));
 assert.match(html,/Corrigir programação de hoje <b>4<\/b>/);
 assert.match(html,/08:30 • Sem técnico/);
 assert.match(html,/>Sem horário<\/span>/);
 assert.match(html,/>Sem técnico e sem horário<\/span>/);
 assert.match(html,/Corrigir programação de OS-SEM-TECNICO/);
 assert.match(html,/<details><summary>Ver mais 1 pendência de hoje<\/summary>/);
 assert.doesNotMatch(html,/OS-OK|OS-ENCERRADA|OS-AMANHA|OS-SEM-DATA/);
});
test('Agenda não mostra ação de edição sem callback e não cria bloco vazio ou de outra empresa',()=>{
 const html=block(markup([row('OS-ABRIR',{time:''})],false));
 assert.match(html,/aria-label="Abrir OS-ABRIR">Abrir OS/);
 assert.doesNotMatch(html,/Corrigir programação de OS-ABRIR/);
 assert.equal(block(markup([row('OS-OK')])), '');
 assert.equal(block(markup([row('OS-OUTRA',{companyId:'other',time:''})])), '');
});
