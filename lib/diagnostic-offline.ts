const KEY_PREFIX="proar:diagnostic-offline:";

export function saveOfflineDiagnosticDraft(orderId:string,payload:Record<string,unknown>){
  if(typeof window==="undefined"||!orderId)return;
  try{window.localStorage.setItem(KEY_PREFIX+orderId,JSON.stringify({savedAt:new Date().toISOString(),payload}));}catch{}
}

export function loadOfflineDiagnosticDraft(orderId:string){
  if(typeof window==="undefined"||!orderId)return null;
  try{
    const raw=window.localStorage.getItem(KEY_PREFIX+orderId);
    if(!raw)return null;
    const parsed=JSON.parse(raw) as {savedAt?:string;payload?:Record<string,unknown>};
    return parsed?.payload?parsed:null;
  }catch{return null;}
}

export function clearOfflineDiagnosticDraft(orderId:string){
  if(typeof window==="undefined"||!orderId)return;
  try{window.localStorage.removeItem(KEY_PREFIX+orderId);}catch{}
}
