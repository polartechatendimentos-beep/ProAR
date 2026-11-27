import test from "node:test";
import assert from "node:assert/strict";
import { moduleFromSearch, resolveNavigationDestination, roleNavigationModules, visibleNavigationModules } from "../lib/module-navigation.ts";

const modules = ["Painel inicial", "Clientes", "Agenda", "Financeiro", "Fiscal", "Estoque", "Ordens de serviço", "Orçamentos"];
const finance = { role: "Financeiro", permissions: ["Painel inicial", "Financeiro", "fiscal.consultar"] };

test("a role orders only allowed modules and never grants missing access", () => {
  assert.deepEqual(roleNavigationModules(modules,finance,["Painel inicial","Financeiro","Fiscal"]),["Financeiro","Fiscal","Painel inicial"]);
  assert.deepEqual(roleNavigationModules(modules,finance,["Painel inicial","Clientes"]),["Painel inicial"]);
  assert.deepEqual(roleNavigationModules(modules,{role:"Técnico de Campo",permissions:[]},modules),[]);
  assert.deepEqual(visibleNavigationModules(["Clientes","Clientes"],{permissions:["Clientes"]}),["Clientes"]);
});

test("explicit authorized URL wins and blocked direct links fall back to permitted modules only", () => {
  assert.equal(resolveNavigationDestination("?tab=fiscal",modules,finance,["Financeiro","Fiscal"]),"Fiscal");
  assert.equal(resolveNavigationDestination("?tab=clientes",modules,finance,["Financeiro","Clientes"]),"Financeiro");
  assert.equal(resolveNavigationDestination("?tab=financeiro",modules,finance,["Fiscal"]),"Fiscal");
  assert.equal(resolveNavigationDestination("",modules,finance,[]),null);
  assert.equal(resolveNavigationDestination("?tab=fiscal",["Financeiro"],finance,["Financeiro","Fiscal"]),"Financeiro");
});

test("tab and role names are never resolved through inherited object properties", () => {
  assert.equal(moduleFromSearch("?tab=constructor"),"Painel inicial");
  assert.equal(moduleFromSearch("?tab=__proto__"),"Painel inicial");
  assert.equal(resolveNavigationDestination("?tab=toString",modules,{role:"constructor",permissions:["Clientes"]}),"Clientes");
});
