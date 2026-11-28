/** Explicit acknowledgement avoids claiming a cached shell when an old worker ignores the request. */
async function prepareAppShell(type:"PREPARE_MOBILE_SHELL"|"PREPARE_SYSTEM_SHELL"):Promise<boolean>{
  if(typeof navigator==="undefined"||!("serviceWorker" in navigator))return false;
  try{const registration=await navigator.serviceWorker.getRegistration()||await navigator.serviceWorker.register("/sw.js",{updateViaCache:"none"});
    const pending=registration.installing||registration.waiting;
    const worker=pending?await new Promise<ServiceWorker|null>(resolve=>{const finish=(value:ServiceWorker|null)=>{clearTimeout(timer);pending.removeEventListener("statechange",changed);resolve(value);};const changed=()=>{if(pending.state==="activated")finish(pending);if(pending.state==="redundant")finish(null);};const timer=setTimeout(()=>finish(null),12000);pending.addEventListener("statechange",changed);changed();}):registration.active;
    if(!worker)return false;
    return await new Promise<boolean>(resolve=>{const channel=new MessageChannel();const timer=setTimeout(()=>{channel.port1.close();resolve(false);},12000);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.ok===true);};worker.postMessage({type},[channel.port2]);});
  }catch{return false;}
}

export const prepareMobileShell = () => prepareAppShell("PREPARE_MOBILE_SHELL");
export const prepareSystemShell = () => prepareAppShell("PREPARE_SYSTEM_SHELL");
