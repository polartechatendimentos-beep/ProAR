export function paginationOffset(value:string|null):number|null{
 if(value===null)return null;
 if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>10000)throw new Error("Offset de paginação inválido.");
 return Number(value);
}
