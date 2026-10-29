import {createHash,createCipheriv,createDecipheriv,randomBytes} from "node:crypto";
export function cloudDraftOwner(employeeId:unknown,username:string){return employeeId?"employee:"+String(employeeId):"login:"+username.trim().toLowerCase();}
export const CLOUD_DRAFT_TTL=30*86400000;
export function cloudDraftPrefix(company:string,username:string){return "cloud-draft-v1:"+createHash("sha256").update(company).digest("hex")+":"+createHash("sha256").update(username.trim().toLowerCase()).digest("hex")+":";}
export function cloudDraftKey(company:string,username:string,orderId:string){return cloudDraftPrefix(company,username)+createHash("sha256").update(orderId).digest("hex");}
function key(secret:string){return createHash("sha256").update("proar-cloud-draft-v1:").update(secret).digest();}
export function sealCloudDraft(value:string,context:string,secret:string){const iv=randomBytes(12),cipher=createCipheriv("aes-256-gcm",key(secret),iv);cipher.setAAD(Buffer.from(context));const data=Buffer.concat([cipher.update(value,"utf8"),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]).toString("base64url");}
export function openCloudDraft(value:string,context:string,secret:string){const raw=Buffer.from(value,"base64url");if(raw.length<28)throw new Error("Cópia inválida.");const cipher=createDecipheriv("aes-256-gcm",key(secret),raw.subarray(0,12));cipher.setAAD(Buffer.from(context));cipher.setAuthTag(raw.subarray(12,28));return Buffer.concat([cipher.update(raw.subarray(28)),cipher.final()]).toString("utf8");}
export function cloudDraftText(value:unknown,now=Date.now()){
 if(!value||typeof value!=="object"||Array.isArray(value))throw new Error("Rascunho inválido.");
 const draft=value as Record<string,unknown>;
 if(draft.pendingSubmission)throw new Error("Confirme ou revise o envio pendente antes de guardar uma cópia.");
 if(!Number.isSafeInteger(draft.version)||Number(draft.version)<0)throw new Error("Versão de rascunho inválida.");
 const text=(key:string,max:number)=>{const item=draft[key];if(item===undefined)return "";if(typeof item!=="string"||item.length>max)throw new Error("Campo de rascunho inválido: "+key);return item;};
 const pairs=(value:unknown,boolean=false)=>{if(value===undefined)return {};if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).length>100)throw new Error("Detalhes do rascunho inválidos.");return Object.fromEntries(Object.entries(value).map(([k,v])=>{if(k.length>100||(boolean?typeof v!=="boolean":typeof v!=="string"||v.length>100))throw new Error("Detalhes do rascunho inválidos.");return [k,v];}));};
 const savedAt=Number(draft.savedAt);if(!Number.isSafeInteger(savedAt)||savedAt<now-CLOUD_DRAFT_TTL||savedAt>now+300000)throw new Error("Data do rascunho inválida ou expirada.");
 return {version:Number(draft.version),editToken:typeof draft.editToken==="string"&&/^[a-f0-9]{64}$/.test(draft.editToken)?draft.editToken:undefined,report:text("report",8000),diagnosis:text("diagnosis",4000),observations:text("observations",8000),measurements:pairs(draft.measurements),checklist:pairs(draft.checklist,true),equipmentIds:Array.isArray(draft.equipmentIds)?draft.equipmentIds.filter((id):id is string=>typeof id==="string"&&id.length<=120).slice(0,20):[],savedAt};
}
