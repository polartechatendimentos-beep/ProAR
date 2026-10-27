export type CatalogValidationSeverity = "error" | "warning";
export type CatalogValidationIssue = { field:string; label:string; message:string; severity:CatalogValidationSeverity };
export type CatalogRecord = Record<string, unknown>;

const text=(value:unknown)=>String(value??"").trim();
const digits=(value:unknown)=>text(value).replace(/\D/g,"");
const number=(value:unknown)=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:0;};

export function validateCatalogRecord(moduleName:string,record:CatalogRecord):CatalogValidationIssue[]{
  const issues:CatalogValidationIssue[]=[];
  const add=(field:string,label:string,message:string,severity:CatalogValidationSeverity)=>issues.push({field,label,message,severity});
  const kind=moduleName==="Produtos"||record.kind==="Produto"?"Produto":moduleName==="Serviços"||record.kind==="Serviço"?"Serviço":"";
  if(!text(record.name)) add("name","Nome","Informe o nome do item.","error");
  if(record.value!==undefined&&number(record.value)<0) add("value","Preço","O valor de venda não pode ser negativo.","error");
  if(!kind) return issues;

  if(!text(record.unitOfMeasure)) add("unitOfMeasure","Unidade de medida","Defina a unidade de medida usada em orçamento, venda e documento fiscal.","warning");

  if(kind==="Produto"){
    const ncm=digits(record.ncm);
    const cest=digits(record.cest);
    const cfop=digits(record.cfop);
    if(!ncm) add("ncm","NCM","Produto sem NCM. A NF-e/NFC-e deve ser bloqueada até a classificação ser informada.","warning");
    else if(ncm.length!==8) add("ncm","NCM","O NCM deve possuir exatamente 8 dígitos.","error");
    if(cest&&cest.length!==7) add("cest","CEST","Quando informado, o CEST deve possuir 7 dígitos.","error");
    if(!cfop) add("cfop","CFOP padrão","Defina o CFOP padrão do produto; a operação poderá sobrescrevê-lo quando necessário.","warning");
    else if(cfop.length!==4) add("cfop","CFOP padrão","O CFOP deve possuir exatamente 4 dígitos.","error");
    if(!text(record.cst)&&!text(record.csosn)) add("cst","CST / CSOSN","Informe a tributação compatível com o regime da empresa.","warning");
    if(!text(record.taxOrigin)) add("taxOrigin","Origem","Informe a origem fiscal da mercadoria.","warning");
  }

  if(kind==="Serviço"){
    if(!text(record.serviceCode)) add("serviceCode","Código do serviço","Informe o código municipal/serviço usado na NFS-e.","warning");
    const rate=Number(record.issRate);
    if(record.issRate!==undefined&&record.issRate!==""&&(!Number.isFinite(rate)||rate<0||rate>100)) add("issRate","ISS","A alíquota de ISS deve ficar entre 0 e 100.","error");
    if(record.issRate===undefined||record.issRate==="") add("issRate","ISS","Defina a alíquota padrão de ISS ou confirme a tributação na emissão.","warning");
  }
  return issues;
}

export function summarizeCatalogValidation(moduleName:string,record:CatalogRecord){
  const issues=validateCatalogRecord(moduleName,record);
  return {issues,errors:issues.filter(item=>item.severity==="error"),warnings:issues.filter(item=>item.severity==="warning")};
}

export function fiscalCatalogBlockers(items:CatalogRecord[],kind:"Produto"|"Serviço"){
  return items.flatMap(item=>validateCatalogRecord(kind==="Produto"?"Produtos":"Serviços",item)
    .filter(issue=>issue.severity==="error"||["ncm","cfop","serviceCode"].includes(issue.field))
    .map(issue=>({recordId:text(item.id)||"(sem ID)",recordName:text(item.name)||"Item sem nome",...issue})));
}
