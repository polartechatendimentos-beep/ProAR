import test from "node:test";
import assert from "node:assert/strict";
import {readDesktopAccessCache,writeDesktopAccessCache} from "../lib/desktop-access-cache.ts";
const staff={username:"técnico",companyId:"polartech",role:"Técnico",permissions:["os.visualizar","clientes.visualizar"],entitledModules:["Ordens de serviço"]};
const view={customers:[{id:"cliente-teste"}],serviceOrders:[],moduleRecords:{}};
const stamp="2026-11-28T02:00:00.000Z";
const store=()=>{const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)}};
test("a cópia offline está isolada por usuário, empresa e permissões",()=>{
 const s=store();
 assert.equal(writeDesktopAccessCache(s,"polartech",staff,view,stamp),stamp);
 assert.deepEqual(readDesktopAccessCache(s,"polartech",{...staff,permissions:[...staff.permissions].reverse()}),{view,stamp});
 assert.equal(readDesktopAccessCache(s,"polartech",{...staff,username:"outro"}),null);
 assert.equal(readDesktopAccessCache(s,"outra",staff),null);
 assert.equal(readDesktopAccessCache(s,"polartech",{...staff,permissions:[]}),null);
 assert.equal(readDesktopAccessCache(s,"polartech",{...staff,entitledModules:[]}),null);
 assert.equal(readDesktopAccessCache(s,"polartech",null),null);
});
test("não promete preparo se o armazenamento falhar ou se o cache não for válido",()=>{
 assert.equal(writeDesktopAccessCache({setItem(){throw Error("cheio");}},"polartech",staff,view,stamp),"");
 assert.equal(readDesktopAccessCache({getItem:()=>"{inválido"},"polartech",staff),null);
});
