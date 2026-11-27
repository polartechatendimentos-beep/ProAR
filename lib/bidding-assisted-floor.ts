export const FLOOR_COSTS=["materials","labor","travel","other"] as const;
export type FloorInput={scope:"item"|"lote"; reference:string; materials:string; labor:string; travel:string; other:string; taxes:string; margin:string};
export type ApprovedFloor=FloorInput & { key:string; floorCents:number; breakEvenCents:number; submittedBy:string; submittedAt:string; status:"pending"|"approved"|"rejected"; decidedBy?:string; decidedAt?:string; decisionNote?:string };

const decode=(value:string):number|null=>{
 const text=value.trim();
 if(!/^(?:\d{1,10}(?:[.,]\d{1,2})?|\d{1,3}(?:\.\d{3}){1,3},\d{1,2})$/.test(text))return null;
 const [whole,decimal=""]= (text.includes(",")?text.replaceAll(".","").replace(",","."):text).split(".");
 return Number(whole)*100+Number(decimal.padEnd(2,"0"));
};
export const bidAmountCents=decode;
export function computeBidFloor(input:FloorInput) {
 if(!input||typeof input!=="object"||!["item","lote"].includes(input.scope)||typeof input.reference!=="string"||!/^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,49}$/u.test(input.reference.trim()))throw new Error("Informe o identificador do item ou lote.");
 const costs=FLOOR_COSTS.map(k=>typeof input[k]==="string"?decode(input[k]):null);
 const taxes=typeof input.taxes==="string"?decode(input.taxes):null, margin=typeof input.margin==="string"?decode(input.margin):null;
 if(costs.some(v=>v===null)||taxes===null||margin===null)throw new Error("Informe todos os custos, tributos e margem. Use zero onde não se aplica.");
 const directCents=costs.reduce<number>((sum,v)=>sum+(v??0),0);
 if(directCents<=0||directCents>1e11||taxes+margin>=10000)throw new Error("O total deve ser positivo e tributos mais margem devem ficar abaixo de 100%.");
 const ceiling=(denominator:number)=>Number((BigInt(directCents)*BigInt(10000)+BigInt(denominator)-BigInt(1))/BigInt(denominator));
 const floorCents=ceiling(10000-taxes-margin),breakEvenCents=ceiling(10000-taxes);
 if(floorCents>1e12)throw new Error("Piso calculado excede o limite.");
 const reference=input.reference.trim();
 return { key:input.scope+":"+reference.normalize("NFKC").toLocaleLowerCase("pt-BR"), reference, directCents, floorCents, breakEvenCents };
}

export function evaluateAssistedBid(floor:ApprovedFloor|undefined,candidate:string) {
 if(floor?.status!=="approved")return {status:"pendente",detail:"Selecione um piso aprovado pela gestão para o mesmo item ou lote."} as const;
 const cents=decode(candidate);
 if(cents===null||cents<=0)return {status:"pendente",detail:"Informe um valor válido na mesma base do piso aprovado."} as const;
 if(cents<floor.floorCents)return {status:"abaixo",detail:"Abaixo do piso aprovado. Não use este valor como lance."} as const;
 return {status:"ok",detail:"Dentro do piso interno. Confira as regras e o intervalo mínimo do portal antes de decidir."} as const;
}
