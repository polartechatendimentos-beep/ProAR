import { FieldSupportError } from "./field-support.ts";
export const fieldMeasurements=[{key:"pressure",label:"Pressão",unit:"psi",min:0,max:10000},{key:"temperature",label:"Temperatura",unit:"°C",min:-100,max:300},{key:"voltage",label:"Tensão",unit:"V",min:0,max:1000},{key:"current",label:"Corrente",unit:"A",min:0,max:1000}] as const;
export type FieldMeasurements=Partial<Record<typeof fieldMeasurements[number]["key"],string>>;
export function validateFieldMeasurements(value:unknown):FieldMeasurements{
  if(!value||typeof value!=="object"||Array.isArray(value))throw new FieldSupportError("Medições inválidas.");
  const input=value as Record<string,unknown>,result:FieldMeasurements={};
  for(const item of fieldMeasurements){const raw=input[item.key];if(raw===undefined||raw==="")continue;if(typeof raw!=="string"&&typeof raw!=="number")throw new FieldSupportError(`Valor inválido para ${item.label}.`);const text=String(raw).trim().replace(",","."),number=Number(text);if(!text||!Number.isFinite(number)||number<item.min||number>item.max)throw new FieldSupportError(`${item.label}: informe valor entre ${item.min} e ${item.max} ${item.unit}.`);result[item.key]=String(number);}
  return result;
}
export const reportTemplates=[
  {id:"installation",label:"Instalação",text:"Equipamento/local:\nEtapas executadas:\nVerificações realizadas e resultados:\nPendências e orientações:"},
  {id:"cleaning",label:"Higienização",text:"Equipamento/local:\nComponentes higienizados:\nProcedimentos e produtos utilizados:\nVerificações e resultado:\nPendências e orientações:"},
  {id:"preventive",label:"Manutenção preventiva",text:"Equipamento/local:\nInspeções realizadas:\nMedições registradas:\nAções executadas:\nPendências e orientações:"},
  {id:"corrective",label:"Manutenção corretiva",text:"Defeito relatado:\nVerificações e diagnóstico:\nIntervenções e materiais utilizados:\nTestes e resultado:\nPendências e orientações:"},
] as const;
