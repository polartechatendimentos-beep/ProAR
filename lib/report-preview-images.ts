import {compressFieldPhoto} from "./field-media";
/** Normalize only local image data. Never request a remote photo URL from a stored field. */
export async function prepareReportImages(source:Record<string,unknown>){
 const order=structuredClone(source),cache=new Map<string,Promise<string>>();let omitted=0;
 const normalize=(value:unknown):Promise<string>=>{if(typeof value!=="string"||!value)return Promise.resolve("");if(cache.has(value))return cache.get(value)!;const task=(async()=>{try{if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value)||value.length>8000000||cache.size>=30){omitted++;return "";}if(value.length<=350000)return value;const [header,payload]=value.split(",");const binary=atob(payload),bytes=Uint8Array.from(binary,char=>char.charCodeAt(0));return await compressFieldPhoto(new File([bytes],"evidencia",{type:header.slice(5).split(";")[0]}));}catch{omitted++;return "";}})();cache.set(value,task);return task;};
 for(const key of ["photoBefore","photoAfter"])if(order[key])order[key]=await normalize(order[key]);
 if(order.photos&&typeof order.photos==="object"&&!Array.isArray(order.photos)){const photos:Record<string,string[]>={};for(const [category,items]of Object.entries(order.photos)){if(Array.isArray(items))photos[category]=(await Promise.all(items.map(normalize))).filter(Boolean);}order.photos=photos;}
 return{order,omitted};
}
