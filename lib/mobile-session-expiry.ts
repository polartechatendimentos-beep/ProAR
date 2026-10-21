/** Caller must first validate the signature and company through sessionFromRequest. */
export function expiryOfValidatedSession(token:string,now=Date.now()){
  try{const parts=token.split(".");const payload=parts[0]==="v2"?JSON.parse(Buffer.from(parts[1],"base64url").toString("utf8")):null;const seconds=payload?Number(payload.exp):Number(parts[1]);const trial=payload?.trialExpiresAt?Date.parse(payload.trialExpiresAt):Infinity;const until=Math.min(seconds*1000,trial,now+8*3600000);return Number.isFinite(until)&&until>now?until:0;}catch{return 0;}
}
