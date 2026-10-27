export type DiagnosticMeasurementKey =
  | "voltage" | "current" | "ambientTemperature" | "returnTemperature" | "supplyTemperature"
  | "suctionPressure" | "dischargePressure" | "superheat" | "subcooling"
  | "sensorResistance" | "insulationResistance" | "communicationVoltage";

export type DiagnosticMeasurements = Partial<Record<DiagnosticMeasurementKey, number>> & {
  refrigerant?: string;
  pressureUnit?: "psi" | "bar";
  temperatureUnit?: "C" | "F";
  notes?: string;
};

export type GuidedStep = {
  id:string;
  title:string;
  instruction:string;
  expected?:string;
  tools?:string[];
  safety?:string;
  status?:"pending"|"ok"|"abnormal"|"not-applicable";
  observation?:string;
};

export type DiagnosticConfidence = {
  level:"Confirmado por manual"|"Alta compatibilidade"|"Possível"|"Não confirmado"|"Informações insuficientes";
  score:number;
  reasons:string[];
};

export type RecurrenceSummary = {
  count:number;
  within180Days:number;
  sameCode:number;
  sameSymptom:number;
  warning?:string;
};

const norm=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR");

export function calculateDeltaT(measurements:DiagnosticMeasurements){
  const returnT=Number(measurements.returnTemperature);
  const supplyT=Number(measurements.supplyTemperature);
  if(!Number.isFinite(returnT)||!Number.isFinite(supplyT))return null;
  return returnT-supplyT;
}

export function buildGuidedSteps(input:{
  symptom?:string; code?:string; blinkPattern?:string; equipmentType?:string; refrigerant?:string;
  probableCauses?:{cause?:string}[]; verificationTests?:{test?:string;expected?:string;tools?:string[]}[];
}):GuidedStep[]{
  const steps:GuidedStep[]=[
    {id:"safety",title:"Segurança e identificação",instruction:"Confirmar tensão, modelo, fluido refrigerante e condições seguras antes de medições energizadas.",tools:["Multímetro","EPI"],safety:"Aplicar NR10 e procedimento de bloqueio quando houver intervenção elétrica."},
    {id:"power",title:"Alimentação elétrica",instruction:"Medir tensão de alimentação e verificar conexões, proteção e sinais de aquecimento.",expected:"Tensão dentro da faixa especificada pelo fabricante.",tools:["Multímetro"]},
  ];
  const symptom=norm(input.symptom);
  if(/nao gela|não gela|baixa eficiencia|baixa eficiência|congela/.test(symptom)){
    steps.push({id:"airflow",title:"Fluxo de ar",instruction:"Verificar filtros, serpentina, turbina/ventilador e obstruções.",expected:"Fluxo livre, ventilador operando e serpentinas sem bloqueio."});
    steps.push({id:"temperature",title:"Temperaturas",instruction:"Registrar retorno e insuflamento e calcular ΔT.",tools:["Termômetro"]});
  }
  if(/condensadora|nao parte|não parte|desarma|ventilador/.test(symptom)||input.blinkPattern){
    steps.push({id:"outdoor",title:"Unidade externa",instruction:"Verificar comando, comunicação, ventilador, compressor, sensores e proteções da condensadora conforme o diagrama do modelo.",tools:["Multímetro","Alicate amperímetro"],safety:"Não contornar pressostatos, sensores ou proteções para forçar funcionamento."});
  }
  if(input.code||input.blinkPattern){
    steps.push({id:"reference",title:"Confirmar referência",instruction:"Confirmar código/piscadas no manual específico da família e do controlador antes de concluir a falha.",expected:"Código e sequência compatíveis com marca, modelo, tipo e unidade."});
  }
  for(const [index,test] of (input.verificationTests||[]).entries()){
    if(!test.test)continue;
    steps.push({id:`ai-${index}`,title:`Teste recomendado ${index+1}`,instruction:test.test,expected:test.expected,tools:test.tools});
  }
  return steps.slice(0,12);
}

export function diagnosticConfidence(input:{
  referenceConfidence?:string; sourceUrls?:string[]; model?:string; code?:string; blinkPattern?:string;
  manualMatched?:boolean; measurements?:DiagnosticMeasurements; guidedSteps?:GuidedStep[];
}):DiagnosticConfidence{
  let score=0; const reasons:string[]=[];
  if(input.model){score+=15;reasons.push("Modelo identificado");}
  if(input.code||input.blinkPattern){score+=15;reasons.push("Código/piscadas registrados");}
  if(input.manualMatched||input.referenceConfidence==="confirmada"){score+=35;reasons.push("Referência técnica confirmada");}
  if((input.sourceUrls||[]).length){score+=10;reasons.push("Fonte rastreável disponível");}
  const measurementCount=Object.entries(input.measurements||{}).filter(([,v])=>typeof v==="number"&&Number.isFinite(v)).length;
  if(measurementCount>=3){score+=15;reasons.push("Medições objetivas registradas");}
  const steps=input.guidedSteps||[];
  if(steps.length&&steps.filter(step=>step.status==="ok"||step.status==="abnormal").length>=Math.min(3,steps.length)){score+=10;reasons.push("Testes guiados executados");}
  score=Math.min(100,score);
  const level:DiagnosticConfidence["level"]=score>=85?"Confirmado por manual":score>=65?"Alta compatibilidade":score>=40?"Possível":score>=20?"Não confirmado":"Informações insuficientes";
  return {level,score,reasons};
}

export function summarizeRecurrence(history:unknown[],current:{code?:string;symptom?:string},now=new Date()):RecurrenceSummary{
  const rows=(Array.isArray(history)?history:[]).filter((item):item is Record<string,unknown>=>Boolean(item)&&typeof item==="object");
  let within180Days=0,sameCode=0,sameSymptom=0;
  for(const row of rows){
    const created=new Date(String(row.createdAt||row.date||""));
    if(!Number.isNaN(created.getTime())&&now.getTime()-created.getTime()<=180*86400000)within180Days++;
    if(current.code&&norm(row.code)===norm(current.code))sameCode++;
    const priorSymptom=norm(row.symptoms||row.symptom||row.request);
    const currentSymptom=norm(current.symptom);
    if(currentSymptom&&priorSymptom&&currentSymptom.split(/\s+/).filter(x=>x.length>4).some(term=>priorSymptom.includes(term)))sameSymptom++;
  }
  const warning=within180Days>=3?"Equipamento com 3 ou mais ocorrências registradas nos últimos 180 dias. Investigue causa raiz e não apenas o sintoma recorrente.":undefined;
  return {count:rows.length,within180Days,sameCode,sameSymptom,warning};
}

export function buildQuoteHandoff(input:{orderId?:string;equipmentId?:string;diagnosis?:string;solutions?:{action?:string;condition?:string}[];parts?:string[]}){
  return {
    kind:"diagnostic-to-quote",
    createdAt:new Date().toISOString(),
    orderId:input.orderId||"",
    equipmentId:input.equipmentId||"",
    diagnosis:input.diagnosis||"",
    suggestedServices:(input.solutions||[]).map(item=>item.action).filter(Boolean),
    suggestedParts:(input.parts||[]).filter(Boolean),
    status:"Pendente de revisão",
  };
}

export function buildPurchaseHandoff(input:{orderId?:string;equipmentId?:string;parts?:string[]}){
  return {
    kind:"diagnostic-to-purchase",
    createdAt:new Date().toISOString(),
    orderId:input.orderId||"",
    equipmentId:input.equipmentId||"",
    items:(input.parts||[]).filter(Boolean).map(name=>({name,quantity:1,status:"A confirmar"})),
    status:"Rascunho",
  };
}

export function confirmFieldSolution(input:{orderId?:string;equipmentId?:string;brand?:string;model?:string;code?:string;symptom?:string;solution:string;technician?:string}){
  return {
    id:`SOL-${Date.now()}`,
    source:"Experiência PolarTech",
    createdAt:new Date().toISOString(),
    orderId:input.orderId||"",
    equipmentId:input.equipmentId||"",
    brand:input.brand||"",
    model:input.model||"",
    code:input.code||"",
    symptom:input.symptom||"",
    solution:input.solution.trim(),
    technician:input.technician||"",
    verifiedInField:true,
  };
}
