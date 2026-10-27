export type CatalogMediaRecord = Record<string, unknown>;
export type CatalogDefaultImageKey =
  | "higienizacao" | "instalacao" | "remocao" | "infraestrutura" | "eletrica" | "drenagem"
  | "pmoc" | "corretiva" | "equipamento" | "material-frigorigeno" | "componente-eletrico"
  | "acessorio" | "produto-generico" | "servico-generico";

const normalize=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR");

export function inferCatalogDefaultImageKey(record:CatalogMediaRecord):CatalogDefaultImageKey{
  const text=normalize([record.name,record.category,record.description,record.kind].filter(Boolean).join(" "));
  if(/higien|limpeza/.test(text)) return "higienizacao";
  if(/pmoc|conformidade|laudo/.test(text)) return "pmoc";
  if(/infra|frigorigen|tubulacao/.test(text)) return "infraestrutura";
  if(/instala/.test(text)) return "instalacao";
  if(/remoc|desinstala/.test(text)) return "remocao";
  if(/dreno|drenagem/.test(text)) return "drenagem";
  if(/eletric|contator|capacitor|placa|disjuntor|cabo/.test(text)) return record.kind==="Produto"?"componente-eletrico":"eletrica";
  if(/corretiv|reparo|diagnost/.test(text)) return "corretiva";
  if(/tubo|cobre|isolamento|fluido|gas refriger/.test(text)) return "material-frigorigeno";
  if(/suporte|acabamento|canaleta|acessor/.test(text)) return "acessorio";
  if(/split|cassete|piso teto|vrf|vrv|chiller|fan coil|ar condicionado|equipamento/.test(text)) return "equipamento";
  return record.kind==="Produto"?"produto-generico":"servico-generico";
}

export function catalogDefaultImageUrl(record:CatalogMediaRecord){
  const key=String(record.catalogImageKey||inferCatalogDefaultImageKey(record));
  return "/api/catalog-default-image?key="+encodeURIComponent(key);
}

export function catalogCoverImage(record:CatalogMediaRecord){
  return String(record.catalogImage||"").trim() || catalogDefaultImageUrl(record);
}
