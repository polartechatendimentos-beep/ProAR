import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { get, put, del } from "@vercel/blob";
import { requiredSecret } from "./security-env";

export type GoogleCalendarCredential = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope?: string;
  tokenType?: string;
  calendarId?: string;
  connectedAt: string;
  email?: string;
};

const keyFor = (companyId:string, username:string) =>
  `proar/integrations/google-calendar/${createHash("sha256").update(`${companyId}:${username}`).digest("hex").slice(0,32)}.enc`;

function encryptionKey() {
  return createHash("sha256").update(requiredSecret("GOOGLE_CALENDAR_ENCRYPTION_KEY")).digest();
}
function encrypt(value: GoogleCalendarCredential) {
  const iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const data=Buffer.concat([cipher.update(JSON.stringify(value),"utf8"),cipher.final()]);
  return JSON.stringify({v:1,iv:iv.toString("base64"),tag:cipher.getAuthTag().toString("base64"),data:data.toString("base64")});
}
function decrypt(value:string):GoogleCalendarCredential {
  const parsed=JSON.parse(value) as {iv:string;tag:string;data:string};
  const decipher=createDecipheriv("aes-256-gcm",encryptionKey(),Buffer.from(parsed.iv,"base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag,"base64"));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(parsed.data,"base64")),decipher.final()]).toString("utf8"));
}

export async function loadGoogleCalendarCredential(companyId:string,username:string) {
  if(!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("STORAGE_NOT_CONFIGURED");
  const result=await get(keyFor(companyId,username),{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN});
  if(!result)return null;
  if(result.statusCode!==200||!result.stream)throw new Error("STORAGE_READ_FAILED");
  return decrypt(await new Response(result.stream).text());
}
export async function saveGoogleCalendarCredential(companyId:string,username:string,credential:GoogleCalendarCredential) {
  if(!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("STORAGE_NOT_CONFIGURED");
  await put(keyFor(companyId,username),encrypt(credential),{access:"private",token:process.env.BLOB_READ_WRITE_TOKEN,addRandomSuffix:false,allowOverwrite:true,contentType:"application/octet-stream",cacheControlMaxAge:60});
}
export async function deleteGoogleCalendarCredential(companyId:string,username:string) {
  if(!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("STORAGE_NOT_CONFIGURED");
  await del(keyFor(companyId,username),{token:process.env.BLOB_READ_WRITE_TOKEN});
}

function stateSecret(){return requiredSecret("GOOGLE_CALENDAR_STATE_SECRET");}
export function createGoogleState(companyId:string,username:string) {
  const payload=Buffer.from(JSON.stringify({companyId,username,exp:Date.now()+10*60_000,nonce:randomBytes(12).toString("hex")}),"utf8").toString("base64url");
  const sig=createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}
export function verifyGoogleState(state:string) {
  const [payload,sig]=state.split(".");
  if(!payload||!sig)return null;
  const expected=createHmac("sha256",stateSecret()).update(payload).digest("base64url");
  const a=Buffer.from(sig),b=Buffer.from(expected);
  if(a.length!==b.length||!timingSafeEqual(a,b))return null;
  try{const parsed=JSON.parse(Buffer.from(payload,"base64url").toString("utf8")) as {companyId:string;username:string;exp:number};return parsed.exp>Date.now()?parsed:null;}catch{return null;}
}

export function googleOAuthConfig(origin:string) {
  const clientId=process.env.GOOGLE_CALENDAR_CLIENT_ID?.trim()||"";
  const clientSecret=process.env.GOOGLE_CALENDAR_CLIENT_SECRET?.trim()||"";
  const redirectUri=process.env.GOOGLE_CALENDAR_REDIRECT_URI?.trim()||`${origin}/api/integrations/google-calendar/callback`;
  if(!clientId||!clientSecret)throw new Error("GOOGLE_OAUTH_NOT_CONFIGURED");
  return {clientId,clientSecret,redirectUri};
}

export async function exchangeGoogleCode(code:string,origin:string) {
  const cfg=googleOAuthConfig(origin);
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({code,client_id:cfg.clientId,client_secret:cfg.clientSecret,redirect_uri:cfg.redirectUri,grant_type:"authorization_code"}),cache:"no-store"});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok||!data.access_token)throw new Error(String(data.error_description||data.error||"GOOGLE_TOKEN_EXCHANGE_FAILED"));
  return {accessToken:String(data.access_token),refreshToken:data.refresh_token?String(data.refresh_token):undefined,expiresAt:Date.now()+Number(data.expires_in||3600)*1000,scope:String(data.scope||""),tokenType:String(data.token_type||"Bearer")};
}

export async function refreshGoogleCredential(companyId:string,username:string,credential:GoogleCalendarCredential,origin:string) {
  if(credential.expiresAt>Date.now()+60_000)return credential;
  if(!credential.refreshToken)throw new Error("GOOGLE_RECONNECT_REQUIRED");
  const cfg=googleOAuthConfig(origin);
  const response=await fetch("https://oauth2.googleapis.com/token",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams({refresh_token:credential.refreshToken,client_id:cfg.clientId,client_secret:cfg.clientSecret,grant_type:"refresh_token"}),cache:"no-store"});
  const data=await response.json() as Record<string,unknown>;
  if(!response.ok||!data.access_token)throw new Error("GOOGLE_RECONNECT_REQUIRED");
  const next={...credential,accessToken:String(data.access_token),expiresAt:Date.now()+Number(data.expires_in||3600)*1000,scope:String(data.scope||credential.scope||"")};
  await saveGoogleCalendarCredential(companyId,username,next);
  return next;
}

export async function googleCalendarFetch(credential:GoogleCalendarCredential,path:string,init:RequestInit={}) {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`,{...init,headers:{Authorization:`Bearer ${credential.accessToken}`,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store",signal:AbortSignal.timeout(20_000)});
}
