export type PressureTemperaturePoint={temperatureC:number;pressureBar:number;pressurePsi:number;dewPressureBar?:number;bubblePressureBar?:number};
export type RefrigerantPtDataset={
  refrigerant:string;
  source:string;
  sourceUrl:string;
  verified:boolean;
  points:PressureTemperaturePoint[];
};

export const psiToBar=(psi:number)=>psi*0.0689475729;
export const barToPsi=(bar:number)=>bar*14.5037738;
export const cToF=(c:number)=>c*9/5+32;
export const fToC=(f:number)=>(f-32)*5/9;
export const kwToBtuh=(kw:number)=>kw*3412.141633;
export const btuhToKw=(btu:number)=>btu/3412.141633;

export function calculateSuperheat(lineTemperatureC:number,saturationTemperatureC:number){
  return lineTemperatureC-saturationTemperatureC;
}
export function calculateSubcooling(saturationTemperatureC:number,liquidLineTemperatureC:number){
  return saturationTemperatureC-liquidLineTemperatureC;
}

export function validatePtDataset(dataset:RefrigerantPtDataset){
  const reasons:string[]=[];
  if(!dataset.refrigerant.trim())reasons.push("Refrigerante não informado");
  if(!dataset.source.trim()||!dataset.sourceUrl.trim())reasons.push("Fonte rastreável ausente");
  if(!dataset.verified)reasons.push("Dataset não verificado");
  if(dataset.points.length<2)reasons.push("Tabela insuficiente");
  const ordered=[...dataset.points].sort((a,b)=>a.temperatureC-b.temperatureC);
  for(let i=1;i<ordered.length;i++)if(ordered[i].temperatureC===ordered[i-1].temperatureC)reasons.push("Temperatura duplicada");
  return {ok:reasons.length===0,reasons};
}

export function interpolatePt(dataset:RefrigerantPtDataset,temperatureC:number){
  const validation=validatePtDataset(dataset);
  if(!validation.ok) return {ok:false,error:validation.reasons.join("; ")};
  const points=[...dataset.points].sort((a,b)=>a.temperatureC-b.temperatureC);
  if(temperatureC<points[0].temperatureC||temperatureC>points[points.length-1].temperatureC)return {ok:false,error:"Temperatura fora da faixa verificada da tabela."};
  const exact=points.find(point=>point.temperatureC===temperatureC);
  if(exact)return {ok:true,point:exact};
  const upperIndex=points.findIndex(point=>point.temperatureC>temperatureC);
  const lower=points[upperIndex-1],upper=points[upperIndex];
  const ratio=(temperatureC-lower.temperatureC)/(upper.temperatureC-lower.temperatureC);
  const point:PressureTemperaturePoint={
    temperatureC,
    pressureBar:lower.pressureBar+(upper.pressureBar-lower.pressureBar)*ratio,
    pressurePsi:lower.pressurePsi+(upper.pressurePsi-lower.pressurePsi)*ratio,
  };
  if(lower.dewPressureBar!==undefined&&upper.dewPressureBar!==undefined)point.dewPressureBar=lower.dewPressureBar+(upper.dewPressureBar-lower.dewPressureBar)*ratio;
  if(lower.bubblePressureBar!==undefined&&upper.bubblePressureBar!==undefined)point.bubblePressureBar=lower.bubblePressureBar+(upper.bubblePressureBar-lower.bubblePressureBar)*ratio;
  return {ok:true,point};
}
