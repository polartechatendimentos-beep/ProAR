import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function encryptWorkSelfie(image:string,secret:string,companyId:string) {
  if(!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>240000)throw new Error("Selfie inválida ou maior que 180 KB.");
  if(!secret)throw new Error("Proteção de imagem não configurada.");
  const key=createHash("sha256").update(`work-selfie-v1:${companyId}:${secret}`).digest(),iv=randomBytes(12);
  const cipher=createCipheriv("aes-256-gcm",key,iv),content=Buffer.concat([cipher.update(image,"utf8"),cipher.final()]);
  return {hash:createHash("sha256").update(image).digest("hex"),cipher:`v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${content.toString("base64url")}`};
}
export function decryptWorkSelfie(encrypted:string,secret:string,companyId:string) {
  const [version,iv,tag,content]=encrypted.split(".");if(version!=="v1"||!iv||!tag||!content)throw new Error("Selfie inválida.");
  const key=createHash("sha256").update(`work-selfie-v1:${companyId}:${secret}`).digest(),decipher=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64url"));
  decipher.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([decipher.update(Buffer.from(content,"base64url")),decipher.final()]).toString("utf8");
}
