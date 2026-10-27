import { jsPDF } from "jspdf";
import type {FieldOrderReceipt} from "./mobile-order-records";
import {safeSignatureImage} from "./service-order-signatures.ts";
const navy:[number,number,number]=[17,43,70],blue:[number,number,number]=[22,116,189],muted:[number,number,number]=[76,96,116];
export function buildServiceOrderReceiptPdf(receipt:FieldOrderReceipt,selectedPhotos:string[]=[]) {
  const pdf=new jsPDF({unit:"mm",format:"a4",compress:true}),margin=16,width=178,bottom=275;
  let y=16;
  const clean=(value:unknown)=>String(value??"").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"");
  const date=(value:string)=>{const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):value||"Não informado";};
  function header(continued=false){
    pdf.setFillColor(...navy);pdf.rect(0,0,210,continued?20:37,"F");
    const logo=!continued&&safeSignatureImage(receipt.company?.logo),available=logo?132:width;
    pdf.setTextColor(255,255,255);pdf.setFont("helvetica","bold");pdf.setFontSize(continued?12:logo?14:17);
    let title=continued?`OS ${clean(receipt.id)} - continuação`:receipt.completedAt?"COMPROVANTE DE ATENDIMENTO":"RELATÓRIO DA ORDEM DE SERVIÇO";
    while(pdf.getTextWidth(title)>available&&title.length>8)title=title.slice(0,-2);
    pdf.text(title,margin,continued?13:16);
    if(!continued){pdf.setFontSize(11);let name=clean(receipt.company?.name||"ProAR - Ordem de serviço");while(pdf.getTextWidth(name)>available&&name.length>8)name=name.slice(0,-2);pdf.text(name,margin,25);pdf.setFontSize(9);pdf.text(clean(receipt.company?.document?`CNPJ/CPF: ${receipt.company.document}`:"Registro do serviço executado"),margin,31);if(logo){pdf.setFillColor(255,255,255);pdf.roundedRect(157,4,37,28,2,2,"F");image(logo,159,6,33,24);}}
    y=continued?29:45;
  }
  function room(height:number){if(y+height>bottom){pdf.addPage();header(true);}}
  function paragraph(value:string,size=10){pdf.setFont("helvetica","normal");pdf.setFontSize(size);pdf.setTextColor(...navy);const lines=pdf.splitTextToSize(clean(value||"Não informado"),width) as string[];for(const line of lines){room(5);pdf.setFont("helvetica","normal");pdf.setFontSize(size);pdf.setTextColor(...navy);pdf.text(line,margin,y);y+=5;}y+=3;}
  function section(title:string){room(19);pdf.setFillColor(234,243,251);pdf.roundedRect(margin,y-4,width,9,2,2,"F");pdf.setTextColor(...blue);pdf.setFont("helvetica","bold");pdf.setFontSize(10);pdf.text(title,margin+3,y+2);y+=12;}
  function image(source:string,x:number,top:number,maxWidth:number,maxHeight:number):boolean {if(!safeSignatureImage(source))return false;try{const properties=pdf.getImageProperties(source),scale=Math.min(maxWidth/properties.width,maxHeight/properties.height);pdf.addImage(source,properties.fileType,x+(maxWidth-properties.width*scale)/2,top+(maxHeight-properties.height*scale)/2,properties.width*scale,properties.height*scale,undefined,"FAST");return true;}catch{return false;}}
  header();
  pdf.setFont("helvetica","bold");pdf.setFontSize(14);pdf.setTextColor(...blue);const titleLines=pdf.splitTextToSize(`ORDEM DE SERVIÇO ${clean(receipt.id)}`,width) as string[];pdf.text(titleLines,margin,y);y+=titleLines.length*6+3;
  paragraph(`Cliente: ${receipt.client}\nUnidade / local: ${receipt.unit||"Não informado"}\nEndereço: ${receipt.address||"Não informado"}\nTécnico responsável: ${receipt.technician||"Não informado"}`);
  paragraph(`Situação: ${receipt.status}\n${receipt.completedAt?`Conclusão: ${date(receipt.completedAt)}`:`Agendamento: ${receipt.scheduledDate||"Não informado"}`}`,9);
  if(receipt.company?.phone||receipt.company?.email)paragraph([receipt.company.phone,receipt.company.email].filter(Boolean).join(" | "),8);
  section("SERVIÇO SOLICITADO");paragraph(receipt.service);
  section("DIAGNÓSTICO TÉCNICO");paragraph(receipt.diagnosis);
  section("SERVIÇO EXECUTADO");paragraph(receipt.report);
  room(110);section("ASSINATURAS DO ATENDIMENTO");
  const top=y,boxWidth=85,boxHeight=60;
  for(const [index,entry] of [receipt.signatures.client,receipt.signatures.technician].entries()){
    const x=margin+index*93;pdf.setDrawColor(191,207,222);pdf.roundedRect(x,top,boxWidth,boxHeight,2,2);
    const valid=image(entry.image,x+3,top+3,boxWidth-6,25);
    if(!valid){pdf.setTextColor(...muted);pdf.setFontSize(8);pdf.setFont("helvetica","normal");pdf.text("Assinatura não registrada",x+5,top+17);}
    pdf.setDrawColor(150,170,190);pdf.line(x+5,top+30,x+boxWidth-5,top+30);pdf.setTextColor(...navy);pdf.setFont("helvetica","bold");pdf.setFontSize(8);pdf.text(index===0?"CLIENTE / RESPONSÁVEL":"TÉCNICO RESPONSÁVEL",x+5,top+35);
    pdf.setFont("helvetica","normal");const names=pdf.splitTextToSize(clean(entry.name||"Nome não informado"),boxWidth-10) as string[];pdf.text(names.slice(0,3),x+5,top+40);pdf.setFontSize(7);pdf.setTextColor(...muted);if(entry.at)pdf.text(date(entry.at),x+5,top+55);
  }
  y=top+67;
  if(receipt.signatures.technician.source==="employee-default")paragraph("Técnico: assinatura padrão cadastrada, aplicada automaticamente no fechamento da OS.",8);
  paragraph("As assinaturas e os nomes correspondem aos registros deste atendimento.",8);
  const photos=receipt.photos.filter(photo=>selectedPhotos.includes(photo.id));
  if(photos.length){room(125);section("EVIDÊNCIAS FOTOGRÁFICAS SELECIONADAS");for(const photo of photos){room(106);pdf.setFontSize(9);pdf.setTextColor(...blue);pdf.text(clean(photo.label),margin,y);y+=4;if(!image(photo.src,margin,y,width,92)){pdf.setFontSize(9);pdf.text("Imagem indisponível no registro.",margin,y+8);}y+=100;}}
  const pages=pdf.getNumberOfPages();for(let page=1;page<=pages;page++){pdf.setPage(page);pdf.setDrawColor(191,207,222);pdf.line(margin,282,194,282);pdf.setFont("helvetica","normal");pdf.setFontSize(7);pdf.setTextColor(...muted);pdf.text("ProAR | Comprovante de atendimento - não substitui documento fiscal.",margin,288);pdf.text(`Página ${page} de ${pages}`,194,288,{align:"right"});}
  pdf.setProperties({title:`Comprovante OS ${receipt.id}`,subject:"Comprovante de atendimento com assinaturas",author:receipt.company?.name||"ProAR",creator:"ProAR"});return pdf;
}
