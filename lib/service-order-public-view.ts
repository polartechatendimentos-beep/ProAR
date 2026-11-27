import { createHash } from "node:crypto";

type Row=Record<string,unknown>;
const text=(x:unknown,max=300)=>typeof x==="string"?x.trim().slice(0,max):"";
const object=(x:unknown):x is Row=>Boolean(x&&typeof x==="object"&&!Array.isArray(x));
export const safePublicOrderKey=(x:unknown)=>typeof x==="string"&&/^[a-zA-Z0-9_-]{1,120}$/.test(x)?x:"";
export const safePublicOrderId=(x:unknown)=>typeof x==="string"&&/^#?[a-zA-Z0-9_-]{1,120}$/.test(x)?x:"";
export function publicOrderSnapshotId(companyId:string,orderId:string){
 if(!safePublicOrderKey(companyId)||!safePublicOrderId(orderId))throw new Error("Identificador inválido.");
 return `osmap-${companyId}-${orderId.replace(/^#/,"")}`;
}
export function publicOrderProjection(order:Row,companyId:string){
 const orderId=safePublicOrderId(order.id);
 const token=typeof order.trackingToken==="string"&&/^[a-zA-Z0-9_-]{20,150}$/.test(order.trackingToken)?order.trackingToken:"";
 if(!orderId||!safePublicOrderKey(companyId)||!token)return null;
 const timeline=(Array.isArray(order.timeline)?order.timeline:[]).filter(object).filter(event=>event.customerVisible===true).slice(-120).map(event=>({
  id:text(event.id,120),createdAt:text(event.createdAt,45),status:text(event.status,160),customerNote:text(event.customerNote,1000),
  photos:(Array.isArray(event.photos)?event.photos:[]).filter((photo):photo is string=>typeof photo==="string"&&photo.length<=500000&&(/^(?:https:\/\/|data:image\/(?:png|jpeg|webp);base64,)/i.test(photo))).slice(0,5),
  customerVisible:true,
 }));
 const payload={companyId,orderId,token,client:text(order.client,200),service:text(order.service,500),date:text(order.date,10),time:text(order.time,5),status:text(order.status,160),timeline};
 const sourceHash=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
 return {...payload,sourceHash};
}
export type PublicOrderProjection=NonNullable<ReturnType<typeof publicOrderProjection>>;
export function publicOrderIsCurrent(existing:Row|null|undefined,expected:PublicOrderProjection){
 if(!existing||existing.companyId!==expected.companyId||existing.orderId!==expected.orderId||existing.token!==expected.token)return false;
 if(existing.sourceHash===expected.sourceHash)return true;
 // Existing public links predate sourceHash. Compare their allowed fields without
 // making the entire backlog look broken simply because the schema changed.
 return ["client","service","date","time","status"].every(key=>existing[key]===expected[key as keyof PublicOrderProjection])
  &&publicOrderProjection({...existing,id:existing.orderId,trackingToken:existing.token},expected.companyId)?.sourceHash===expected.sourceHash;
}
