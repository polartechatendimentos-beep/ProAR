import assert from "node:assert/strict";
import {chromium} from "@playwright/test";
import {jsPDF} from "jspdf";
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage();
 const violations=[];
 page.on("console",message=>{if(/Content Security Policy|Refused to|unsafe-eval/i.test(message.text()))violations.push(message.text());});
 await page.goto("http://127.0.0.1:3000/api/health");
 const pdf=new jsPDF();pdf.text("Certidao de tributos federais CNPJ 45.823.828/0001-88 Valida ate 30/11/2026",10,20);
 const bytes=Array.from(new Uint8Array(pdf.output("arraybuffer")));
 const text=await page.evaluate(async bytes=>{
  const base="/vendor/document-audit/v1";
  const engine=await import(base+"/pdf.min.mjs");
  engine.GlobalWorkerOptions.workerSrc=base+"/pdf.worker.min.mjs";
  const task=engine.getDocument({data:new Uint8Array(bytes),standardFontDataUrl:base+"/standard_fonts/"});
  try{const doc=await task.promise;const page=await doc.getPage(1);const content=await page.getTextContent();return content.items.map(item=>"str" in item?item.str:"").join(" ");}finally{await task.destroy();}
 },bytes);
 assert.match(text,/45\.823\.828\/0001-88/);assert.match(text,/30\/11\/2026/);
 console.log("DOCUMENT_PDF_BROWSER=synthetic_text_extracted");
 await page.addScriptTag({url:"/vendor/document-audit/v1/tesseract.min.js"});
 const result=await page.evaluate(async()=>{
  const base=location.origin+"/vendor/document-audit/v1";
  const worker=await window.Tesseract.createWorker("por",1,{workerPath:base+"/worker.min.js",corePath:base+"/",langPath:base,workerBlobURL:false});
  try{
   const canvas=document.createElement("canvas");canvas.width=1600;canvas.height=420;
   const ctx=canvas.getContext("2d");ctx.fillStyle="white";ctx.fillRect(0,0,1600,420);ctx.fillStyle="black";ctx.font="48px Arial";
   ctx.fillText("CERTIDAO DE TRIBUTOS FEDERAIS",40,100);
   ctx.fillText("CNPJ 45.823.828/0001-88",40,190);
   ctx.fillText("VALIDADE: 30/11/2026",40,280);
   const {data}=await worker.recognize(canvas);return {text:data.text,confidence:data.confidence};
  }finally{await worker.terminate();}
 });
 assert.match(result.text,/FEDERAIS/);assert.match(result.text,/30\/11\/2026/);
 assert.ok(result.confidence>60);
 assert.equal(violations.length,0,violations.join("\n"));
 console.log("DOCUMENT_OCR_BROWSER=synthetic_portuguese_image_read confidence="+result.confidence);
}finally{await browser.close();}
