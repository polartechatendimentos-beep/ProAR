export type ConfirmedState={customers:Record<string,unknown>[];serviceOrders:Record<string,unknown>[];moduleRecords:Record<string,Record<string,unknown>[]>;_revision:number;[key:string]:unknown};
export function stateSaveOutcome(status:number,body:unknown,baseRevision:number):{confirmed:true;state:ConfirmedState}|{confirmed:false;error:string;conflict:boolean}{
 const value=body&&typeof body==="object"&&!Array.isArray(body)?body as Record<string,unknown>:{};
 const state=value.state&&typeof value.state==="object"&&!Array.isArray(value.state)?value.state as Record<string,unknown>:null;
 if(status>=200&&status<300&&value.saved===true&&state&&Array.isArray(state.customers)&&Array.isArray(state.serviceOrders)&&state.moduleRecords&&typeof state.moduleRecords==="object"&&!Array.isArray(state.moduleRecords)&&typeof state._revision==="number"&&Number.isSafeInteger(state._revision)&&state._revision>baseRevision){
  return {confirmed:true,state:state as ConfirmedState};
 }
 return {confirmed:false,error:typeof value.error==="string"?value.error.slice(0,500):status===409?"Outro usuário alterou os dados. Atualize e tente novamente.":"O banco não confirmou o salvamento. Os campos permanecem em edição.",conflict:status===409};
}
