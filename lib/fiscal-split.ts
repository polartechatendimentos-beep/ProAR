export type MixedFiscalItem = { id: string; kind: "Produto"|"Serviço"; description: string; quantity: number; unitValue: number; [key:string]: unknown };

export function splitMixedFiscalOperation(items: MixedFiscalItem[]) {
  const products = items.filter(item=>item.kind==="Produto");
  const services = items.filter(item=>item.kind==="Serviço");
  return {
    mixed: products.length > 0 && services.length > 0,
    merchandise: products,
    services,
    merchandiseTotal: products.reduce((sum,item)=>sum + Number(item.quantity||0)*Number(item.unitValue||0),0),
    serviceTotal: services.reduce((sum,item)=>sum + Number(item.quantity||0)*Number(item.unitValue||0),0),
    recommendation: products.length && services.length
      ? "Operação mista detectada. O ProAR separou mercadorias e serviços para revisão fiscal antes da emissão."
      : "Operação de um único tipo.",
  };
}
