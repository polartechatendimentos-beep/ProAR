import test from "node:test";
import assert from "node:assert/strict";
import {visibleHierarchyNodes,filterHierarchy} from "../lib/customer-hierarchy.ts";
const node=(id,path,name=id)=>({id,name,path,parentId:path.length>1?path.at(-2):"",depth:path.length-1,level:"Setor",kind:"sector",record:{id,name},issue:false});
const nodes=[node("s1",["s1"],"Saúde"),node("a1",["s1","a1"],"Consultório"),node("s2",["s2"],"Educação")];
test("collapse all closes root including top-level sectors without child branches",()=>{
 assert.deepEqual(visibleHierarchyNodes(nodes,new Set(),true),[]);
 assert.deepEqual(visibleHierarchyNodes(nodes,new Set(["s1"]),true),[]);
});
test("branch collapse remains effective when a search selected descendants",()=>{
 const filtered=filterHierarchy(nodes,"Consultório");
 assert.deepEqual(visibleHierarchyNodes(filtered,new Set(["s1"])).map(n=>n.id),["s1"]);
});
test("expand all restores nodes without modifying data or the selection path",()=>{
 const before=JSON.stringify(nodes);
 assert.deepEqual(visibleHierarchyNodes(nodes,new Set()).map(n=>n.id),["s1","a1","s2"]);
 assert.equal(JSON.stringify(nodes),before);
 assert.deepEqual(nodes[1].path,["s1","a1"]);
 assert.deepEqual(visibleHierarchyNodes(nodes,new Set(["s1"])).map(n=>n.id),["s1","s2"]);
});
