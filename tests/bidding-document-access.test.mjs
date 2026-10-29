import test from "node:test";import assert from "node:assert/strict";import {readFile} from "node:fs/promises";import {stripTypeScriptTypes} from "node:module";import {runInNewContext} from "node:vm";import {createHash} from "node:crypto";
const source=async path=>stripTypeScriptTypes(await readFile(new URL(path,import.meta.url),"utf8")).replace(/^import .*;$/gm,"").replace(/^export /gm,"");
test("private document routes deny anonymous access and writes before storage or database",async()=>{
 let calls=0;const code=await source("../app/api/bidding-documents/route.ts");
 const base={NextResponse:{json:(body,init={})=>({body,status:init.status??200})},procurementAccess:()=>({ok:false,error:"Sessão inválida",status:401}),routeContext:async()=>{calls++;throw Error("must not query");},hasPermission:()=>false,process:{env:{}}};
 const handlers=runInNewContext(code+"\n({GET,POST})",base);
 assert.equal((await handlers.GET({})).status,401);assert.equal((await handlers.POST({})).status,401);assert.equal(calls,0);
 const permitted=runInNewContext(code+"\nPOST", {...base,procurementAccess:()=>({ok:true,session:{username:"u"}})});
 assert.equal((await permitted({})).status,403);assert.equal(calls,0);
 const wrongOrigin=runInNewContext(code+"\nPOST",{...base,procurementAccess:()=>({ok:true,session:{username:"u"}}),hasPermission:()=>true});
 assert.equal((await wrongOrigin({headers:new Headers({origin:"https://evil.example"}),nextUrl:new URL("https://proar.example")})).status,403);assert.equal(calls,0);
});
test("document store uses company-scoped keys and rejects foreign metadata even if DB returns it",async()=>{
 const code=await source("../lib/bidding-document-store.ts");let path="";
 const store=runInNewContext(code+"\n({biddingDocumentKey,biddingDocumentPath,loadBiddingDocument})",{createHash,routeRest:async(db,p)=>{path=p;return {ok:true,json:async()=>[{payload:{companyId:"OTHER",id:"00000000-0000-0000-0000-000000000001"}}]};}});
 const id="00000000-0000-0000-0000-000000000001";
 assert.notEqual(store.biddingDocumentKey("A",id),store.biddingDocumentKey("B",id));
 assert.notEqual(store.biddingDocumentPath("A",id,"pdf"),store.biddingDocumentPath("B",id,"pdf"));
 await assert.rejects(()=>store.loadBiddingDocument({},"A",id),/outra empresa/);
 assert.ok(path.includes(encodeURIComponent(store.biddingDocumentKey("A",id))));
});
test("upload token handler requires authorized session before looking up any upload intent",async()=>{
 let reads=0;const code=await source("../app/api/bidding-documents/upload/route.ts");
 const handler=runInNewContext(code+"\nPOST",{NextResponse:{json:(body,init={})=>({body,status:init.status??200})},handleUpload:async options=>options.onBeforeGenerateToken("foreign/path","{}"),procurementAccess:()=>({ok:false}),routeContext:async()=>{reads++;throw Error("must not query");},hasPermission:()=>false});
 const result=await handler({text:async()=>JSON.stringify({type:"blob.generate-client-token",payload:{}})});
 assert.equal(result.status,400);assert.equal(reads,0);
});
