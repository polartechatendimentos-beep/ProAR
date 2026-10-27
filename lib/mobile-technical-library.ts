import {additionalErrorSources,additionalErrorCodes} from "./mobile-error-catalog.ts";
export const technicalSources={
 ...additionalErrorSources,
 pt:{title:'Arkema Forane — Quick Reference Guide, tabela P–T',url:'https://forane.arkema.com/files/live/sites/fluorogases_forane_arkema/files/downloads/literature/forane-quick-reference-guide.pdf',checkedAt:'2026-10-27'},
 daikin:{title:'Daikin ABQ-A — OM-NET3C-0411(0)-SIESTA / ARCWA, páginas impressas 53–54',url:'https://www.daikin.eu/content/dam/document-library/operation-manuals/ac/sky-air/abq-a/ABQ-A_OM_PT_Operation%20manuals_Portuguese.pdf',checkedAt:'2026-10-27'},
 safety:{title:'Chemours — A Closer Look at A2L Refrigerants',url:'https://www.chemours.com/en/-/media/files/opteon/2023-ahr-expo-present-a2ls.pdf?rev=dced81be9faa49bcb4a79237e30bb49b',checkedAt:'2026-10-27'}
} as const;
export const refrigerants=[{id:'R-22',classification:'A1',phase:'saturation'},{id:'R-32',classification:'A2L',phase:'saturation'},{id:'R-134a',classification:'Consultar FDS',phase:'saturation'},{id:'R-410A',classification:'A1',phase:'liquid'},{id:'R-407C',classification:'Consultar FDS',phase:'dew/bubble'}] as const;
// Small reference excerpt in psig, transcribed from the linked primary source.
// °C is calculated from the original °F to avoid rounding the interpolation axis.
export const ptReference=[
 {f:30,r22:55.0,r32:99.1,r134a:26.1,r410a:97.4,r407cLiquid:64.7,r407cVapor:49.6},
 {f:40,r22:68.6,r32:121.0,r134a:35.0,r410a:118.8,r407cLiquid:80.2,r407cVapor:63.2},
 {f:50,r22:84.1,r32:145.9,r134a:45.4,r410a:143.2,r407cLiquid:97.9,r407cVapor:78.8},
 {f:60,r22:101.6,r32:174.1,r134a:57.4,r410a:170.7,r407cLiquid:118.0,r407cVapor:96.8},
 {f:70,r22:121.4,r32:205.8,r134a:71.1,r410a:201.8,r407cLiquid:140.5,r407cVapor:117.3},
 {f:80,r22:143.6,r32:241.5,r134a:86.7,r410a:236.5,r407cLiquid:165.8,r407cVapor:140.5},
 {f:90,r22:168.4,r32:281.3,r134a:104.3,r410a:275.4,r407cLiquid:194.1,r407cVapor:166.7},
 {f:100,r22:195.9,r32:325.7,r134a:124.2,r410a:318.6,r407cLiquid:225.5,r407cVapor:196.1}
];
export type RefrigerantKey='r22'|'r32'|'r134a'|'r410a'|'r407cLiquid'|'r407cVapor';
export const refrigerantKeys:Record<string,RefrigerantKey[]>={'R-22':['r22'],'R-32':['r32'],'R-134a':['r134a'],'R-410A':['r410a'],'R-407C':['r407cLiquid','r407cVapor']};
export function referenceTemperature(pressure:number,key:RefrigerantKey){
 if(!Object.hasOwn(ptReference[0],key)||!Number.isFinite(pressure))return null;
 for(let i=0;i<ptReference.length;i++){const b=ptReference[i];if(pressure===b[key])return (b.f-32)*5/9;if(!i)continue;const a=ptReference[i-1];if(pressure>a[key]&&pressure<b[key])return (a.f+(pressure-a[key])/(b[key]-a[key])*(b.f-a.f)-32)*5/9;}
 return null;
}
const daikinCodes=[
 {code:'A1',meaning:'Indicação relacionada à placa eletrônica da unidade interna.'},
 {code:'A3',meaning:'Indicação de funcionamento irregular da bomba de drenagem.'},
 {code:'A6',meaning:'Indicação relacionada ao motor de ventilação da unidade interna.'},
 {code:'C9',meaning:'Indicação de circuito aberto ou curto no sensor do ambiente interno.'},
 {code:'E1',meaning:'Indicação relacionada à placa eletrônica da unidade externa.'},
 {code:'E3',meaning:'Atuação da proteção associada à pressão elevada.'},
 {code:'E4',meaning:'Atuação da proteção associada à pressão baixa.'},
 {code:'U0',meaning:'O manual associa a indicação à quantidade insuficiente de refrigerante; exige investigação.'},
 {code:'U2',meaning:'Indicação de tensão do circuito de corrente contínua fora da faixa.'},
 {code:'U4',meaning:'Indicação de falha na troca de informações entre componentes do sistema.'}
].map(row=>({...row,id:`daikin-abqa-${row.code}`,brand:'Daikin',family:'ABQ-A / controlador ARCWA',source:'daikin' as const}));
export const technicalCodes=[...daikinCodes,...additionalErrorCodes];
export function searchTechnicalCodes(brand:string,family:string,code:string){return technicalCodes.filter(r=>r.brand===brand&&r.family===family&&(!code.trim()||r.code.toUpperCase().replace(/\s/g,'')===code.trim().toUpperCase().replace(/\s/g,'')));}
export function technicalDifference(kind:'superheat'|'subcool',line:number,saturation:number){if(!Number.isFinite(line)||!Number.isFinite(saturation)||Math.abs(line)>300||Math.abs(saturation)>300)throw new Error('Informe temperaturas válidas em °C.');return kind==='superheat'?line-saturation:saturation-line;}
export function convertTechnicalUnit(value:number,kind:'psi-bar'|'bar-psi'|'f-c'|'c-f'|'btu-kw'|'kw-btu'){
 if(!Number.isFinite(value)||Math.abs(value)>1e9)throw new Error('Valor inválido.');
 switch(kind){case 'psi-bar':return value*0.0689475729;case 'bar-psi':return value/0.0689475729;case 'f-c':return (value-32)*5/9;case 'c-f':return value*9/5+32;case 'btu-kw':return value*0.00029307107;case 'kw-btu':return value/0.00029307107;default:throw new Error('Conversão inválida.');}
}
