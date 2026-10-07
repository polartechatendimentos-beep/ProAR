type Row=Record<string,unknown>;

export type DuplicateCandidate={
  module:string;
  id:string;
  label:string;
  reason:string;
};

const text=(value:unknown)=>String(value??"").trim();
const normalized=(value:unknown)=>text(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR").replace(/\s+/g," ");
const digits=(value:unknown)=>text(value).replace(/\D/g,"");

function same(left:unknown,right:unknown){const a=normalized(left),b=normalized(right);return Boolean(a&&b&&a===b);}
function sameDigits(left:unknown,right:unknown){const a=digits(left),b=digits(right);return Boolean(a&&b&&a===b);}

export function findPotentialDuplicate(input:{
  module:string;
  candidate:Row;
  customers?:Row[];
  modules?:Record<string,Row[]>;
  serviceOrders?:Row[];
}):DuplicateCandidate|null{
  const module=input.module;
  const candidate=input.candidate;
  const modules=input.modules||{};
  const rows=module==="Clientes"?(input.customers||[]):module==="Ordens de serviço"?(input.serviceOrders||[]):(modules[module]||[]);
  const currentId=text(candidate.id);

  for(const row of rows){
    if(currentId&&text(row.id)===currentId)continue;
    const result=(reason:string):DuplicateCandidate=>({
      module,
      id:text(row.id),
      label:text(row.name||row.tradeName||row.legalName||row.serialNumber||row.numeroControlePNCP||row.id)||"Registro existente",
      reason,
    });

    if(module==="Clientes"||module==="Fornecedores"){
      if(sameDigits(candidate.doc||candidate.cnpj||candidate.cpf,row.doc||row.cnpj||row.cpf))return result("CNPJ/CPF já cadastrado");
    }
    if(module==="Equipamentos"){
      if(same(candidate.serialNumber,row.serialNumber))return result("Número de série já cadastrado");
      if(same(candidate.patrimony||candidate.assetTag,row.patrimony||row.assetTag))return result("Patrimônio já cadastrado");
      if(same(candidate.externalCode||candidate.manufacturerCode,row.externalCode||row.manufacturerCode))return result("Código do equipamento já cadastrado");
    }
    if(module==="Ordens de serviço"&&same(candidate.id,row.id))return result("Número de OS já cadastrado");
    if(module==="Licitações"||module==="Certames"){
      if(same(candidate.numeroControlePNCP,row.numeroControlePNCP))return result("Número de controle PNCP já cadastrado");
      if(same(candidate.processNumber||candidate.process,candidate.processNumber?row.processNumber:row.process))return result("Processo de licitação já cadastrado");
    }
    if(module==="Obras"){
      const sameName=same(candidate.name,row.name);
      const sameLocation=same(candidate.address||candidate.blockLot,row.address||row.blockLot);
      if(sameName&&sameLocation)return result("Obra com mesmo nome e local já cadastrada");
    }
  }
  return null;
}
