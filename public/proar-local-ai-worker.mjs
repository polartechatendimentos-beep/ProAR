// Public runtime only; no credentials, session cookies or server inference.
let engine;
let running=false;
self.onmessage=async({data})=>{
  if(running){self.postMessage({kind:"error",message:"Já há uma operação em andamento."});return;}
  running=true;
  try{
    if(data.action==="load"){
      const {CreateMLCEngine,prebuiltAppConfig}=await import("https://esm.run/@mlc-ai/web-llm@0.2.85");
      const model="Qwen3-0.6B-q4f16_1-MLC";
      if(!prebuiltAppConfig.model_list.some(item=>item.model_id===model))throw new Error("Modelo local indisponível nesta versão.");
      engine=await CreateMLCEngine(model,{initProgressCallback:progress=>self.postMessage({kind:"progress",progress:progress.progress})});
      self.postMessage({kind:"ready"});
    }else if(data.action==="generate"){
      if(!engine)throw new Error("Carregue o modelo primeiro.");
      if(!Array.isArray(data.messages)||data.messages.length!==2||data.messages.some(item=>typeof item.content!=="string"||item.content.length>20000))throw new Error("Relato inválido.");
      const result=await engine.chat.completions.create({messages:data.messages,temperature:0.1,max_tokens:700,stream:false});
      const text=String(result.choices?.[0]?.message?.content||"").replace(/<think>[\s\S]*?<\/think>/g,"").trim().slice(0,8000);
      if(!text)throw new Error("O modelo não produziu uma sugestão. Use a formatação sem IA.");
      self.postMessage({kind:"result",text});
    }else throw new Error("Ação inválida.");
  }catch{self.postMessage({kind:"error",message:"Não foi possível executar a IA local. Verifique conexão, memória e suporte do aparelho. A formatação sem IA continua disponível."});}
  finally{running=false;}
};
