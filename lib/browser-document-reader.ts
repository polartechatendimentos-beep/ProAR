"use client";
import type {ExtractionEvidence} from "./bidding-document-audit";
const base="/vendor/document-audit/v1";
type OcrWorker=Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>;
export function createDocumentReader(){
 let worker:OcrWorker|null=null;
 const ocr=async(image:HTMLCanvasElement|File,onProgress:(message:string)=>void)=>{
  if(!worker){onProgress("Preparando OCR em português…");const {createWorker}=await import("tesseract.js");worker=await createWorker("por",1,{workerPath:base+"/worker.min.js",corePath:base+"/",langPath:base,workerBlobURL:false});}
  const active=worker;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const result=await Promise.race([active.recognize(image),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void active.terminate();worker=null;reject(new Error("OCR excedeu 90 segundos. Revise este arquivo ou tente novamente."));},90000);})]);
   return {text:result.data.text,confidence:result.data.confidence};
  }finally{if(timer)clearTimeout(timer);}
 };
 return {
  async read(file:File,onProgress:(message:string)=>void):Promise<{text:string;extraction:ExtractionEvidence;sha256:string}>{
   const bytes=new Uint8Array(await file.arrayBuffer()),hash=await crypto.subtle.digest("SHA-256",bytes);
   const sha256=Array.from(new Uint8Array(hash),byte=>byte.toString(16).padStart(2,"0")).join("");
   if(file.type!=="application/pdf"){
    onProgress("Lendo imagem com OCR…");const result=await ocr(file,onProgress);
    return {text:result.text.slice(0,250000),sha256,extraction:{source:"ocr",pagesRead:1,totalPages:1,partial:result.text.length>250000,confidence:result.confidence,warnings:[]}};
   }
   onProgress("Abrindo PDF…");
   const pdfjs=await import(/* webpackIgnore: true */base+"/pdf.min.mjs") as typeof import("pdfjs-dist");
   pdfjs.GlobalWorkerOptions.workerSrc=base+"/pdf.worker.min.mjs";
   const task=pdfjs.getDocument({data:bytes,enableXfa:false,cMapUrl:base+"/cmaps/",cMapPacked:true,standardFontDataUrl:base+"/standard_fonts/"});
   let pdf:Awaited<typeof task.promise>|null=null;
   try{
    pdf=await task.promise;const limit=Math.min(pdf.numPages,40);let text="",read=0,ocrPages=0,textPages=0;const warnings:string[]=[],confidence:number[]=[];
    for(let pageNumber=1;pageNumber<=limit;pageNumber++){
     onProgress("Lendo página "+pageNumber+"/"+pdf.numPages+"…");
     const page=await pdf.getPage(pageNumber),content=await page.getTextContent();
     let pageText=content.items.map(item=>"str" in item?item.str:"").join(" ");
     if(pageText.trim().length<40){
      if(ocrPages>=8){warnings.push("Limite de 8 páginas com OCR atingido; páginas digitalizadas restantes exigem revisão.");page.cleanup();continue;}
      onProgress("OCR da página "+pageNumber+"/"+pdf.numPages+"…");
      const original=page.getViewport({scale:1}),scale=Math.min(2,1600/Math.max(original.width,original.height)),viewport=page.getViewport({scale});
      const canvas=document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      await page.render({canvas,viewport}).promise;
      try{const result=await ocr(canvas,onProgress);pageText=result.text;confidence.push(result.confidence);ocrPages++;}catch(error){warnings.push(error instanceof Error?error.message:"OCR indisponível para uma página.");page.cleanup();canvas.width=0;canvas.height=0;continue;}
      canvas.width=0;canvas.height=0;
     }else textPages++;
     text+="\n[Página "+pageNumber+"]\n"+pageText;read++;page.cleanup();
     if(text.length>250000){warnings.push("Limite de texto atingido; leitura parcial.");text=text.slice(0,250000);break;}
    }
    return {text,sha256,extraction:{source:ocrPages?textPages?"mixed":"ocr":textPages?"pdf_text":"unreadable",pagesRead:read,totalPages:pdf.numPages,partial:read<pdf.numPages||warnings.length>0,confidence:confidence.length?confidence.reduce((sum,value)=>sum+value,0)/confidence.length:undefined,warnings}};
   }finally{await task.destroy();}
  },
  async dispose(){if(worker){await worker.terminate();worker=null;}}
 };
}
