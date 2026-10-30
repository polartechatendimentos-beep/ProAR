import {mkdir,copyFile,readdir,cp,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import path from "node:path";
const out=path.join(process.cwd(),"public/vendor/document-audit/v1");
await mkdir(out,{recursive:true});
for(const [source,target] of [
 ["node_modules/pdfjs-dist/build/pdf.min.mjs","pdf.min.mjs"],
 ["node_modules/pdfjs-dist/build/pdf.worker.min.mjs","pdf.worker.min.mjs"],
 ["node_modules/tesseract.js/dist/worker.min.js","worker.min.js"],
 ["node_modules/tesseract.js/dist/tesseract.min.js","tesseract.min.js"]
])await copyFile(source,path.join(out,target));
for(const dir of ["cmaps","standard_fonts"])await cp("node_modules/pdfjs-dist/"+dir,path.join(out,dir),{recursive:true});
for(const file of await readdir("node_modules/tesseract.js-core"))if(/^tesseract-core.*\.wasm(?:\.js)?$/.test(file))await copyFile("node_modules/tesseract.js-core/"+file,path.join(out,file));
const response=await fetch("https://tessdata.projectnaptha.com/4.0.0/por.traineddata.gz",{signal:AbortSignal.timeout(60000)});
if(!response.ok)throw new Error("Portuguese OCR language data unavailable: "+response.status);
const bytes=new Uint8Array(await response.arrayBuffer());
if(bytes.length>12*1024*1024||bytes[0]!==31||bytes[1]!==139)throw new Error("Invalid OCR language archive");
console.log("DOCUMENT_OCR_POR_SHA256="+createHash("sha256").update(bytes).digest("hex"));
await writeFile(path.join(out,"por.traineddata.gz"),bytes);
console.log("Document reading assets prepared: PDF.js 6.4.299, Tesseract 7.0.0, Portuguese language.");
