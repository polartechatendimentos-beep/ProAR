import type { DiagnosticCodeRecord } from "./diagnostic-engine";

export const HVAC_REFERENCE_PORTAL = {
  name:"WebArCondicionado • Códigos de erro",
  url:"https://www.webarcondicionado.com.br/codigos-de-erro",
  brands:["Admiral","Agratto","Comfee","Consul","Daikin","DeLonghi","Electrolux","Elgin","Fujitsu","Gree","Hitachi","Komeco","LG","Midea","Panasonic","Philco","Rheem","Rinetto","Samsung","Trane","Tivah","Ventisol","Vulcano","York"],
};

export const BUILTIN_HVAC_ERROR_CODES: DiagnosticCodeRecord[] = [
  {
    id:"SRC-ELGIN-SPLIT-E1",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],unit:"Evaporadora",code:"E1",blinkPattern:"1 piscada por segundo",
    title:"Falha de memória da unidade interna",causes:["Falha relacionada à memória/placa da unidade interna."],
    checks:["Confirmar modelo e manual da linha antes de condenar a placa.","Verificar alimentação e conexões da placa da unidade interna."],
    source:"WebArCondicionado • tabela Elgin Split",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-SPLIT-E3",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],unit:"Evaporadora",code:"E3",blinkPattern:"4 piscadas por segundo",
    title:"Falha do ventilador da unidade interna",causes:["Falha de funcionamento do motor ventilador da evaporadora."],
    checks:["Confirmar livre movimentação da turbina.","Verificar alimentação, conectores e comando do motor conforme o modelo."],
    source:"WebArCondicionado • tabela Elgin Split",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-SPLIT-E5",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],unit:"Evaporadora",code:"E5",blinkPattern:"5 piscadas por segundo",
    title:"Falha do sensor de temperatura ambiente interno",causes:["Sensor ambiente da unidade interna desconectado, fora de faixa ou com falha."],
    checks:["Confirmar modelo e tabela específica.","Inspecionar conector, chicote e sensor de temperatura ambiente."],
    source:"WebArCondicionado • tabela Elgin Split",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-SPLIT-E6",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],unit:"Evaporadora",code:"E6",blinkPattern:"6 piscadas por segundo",
    title:"Falha do sensor da serpentina da evaporadora",causes:["Sensor da serpentina interna desconectado, fora de faixa ou com falha."],
    checks:["Inspecionar sensor e chicote.","Comparar resistência/temperatura com a especificação do modelo."],
    source:"WebArCondicionado • tabela Elgin Split",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-SPLIT-E7",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],unit:"Evaporadora",code:"E7",blinkPattern:"7 piscadas por segundo",
    title:"Falha de sensor externo",causes:["Falha relacionada ao sensor de temperatura do condensador ou ambiente externo."],
    checks:["Confirmar o sensor aplicável ao modelo.","Verificar conectores, chicote e leitura do sensor externo."],
    source:"WebArCondicionado • tabela Elgin Split",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-SPLIT-E9",brand:"Elgin",equipmentTypes:["Split Hi-Wall"],unit:"Evaporadora",code:"E9",blinkPattern:"9 piscadas por segundo",
    title:"Falha de comunicação entre unidades",causes:["Comunicação entre evaporadora e condensadora interrompida ou inválida."],
    checks:["Conferir interligação elétrica conforme diagrama.","Verificar alimentação e comunicação nas duas unidades."],
    source:"WebArCondicionado • tabela Elgin Split",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-split-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-KEPE-E1",brand:"Elgin",models:["KE","PE","Eco Cassete","Eco Piso-Teto"],equipmentTypes:["Cassete","Piso Teto"],unit:"Evaporadora",code:"E1",
    title:"Sensor de temperatura ambiente",causes:["Sensor ambiente desconectado ou com defeito."],
    checks:["Verificar conexão do sensor.","Confirmar resistência do sensor conforme o manual do modelo."],
    solutions:["Corrigir conexão ou substituir sensor após confirmação da falha."],
    source:"WebArCondicionado • Elgin Eco Cassete/Piso-Teto",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-KEPE-E2",brand:"Elgin",models:["KE","PE","Eco Cassete","Eco Piso-Teto"],equipmentTypes:["Cassete","Piso Teto"],unit:"Evaporadora",code:"E2",
    title:"Sensor da serpentina",causes:["Sensor de temperatura da serpentina desconectado ou com defeito."],
    checks:["Verificar conexão e sensor da serpentina."],
    source:"WebArCondicionado • Elgin Eco Cassete/Piso-Teto",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-KEPE-E3",brand:"Elgin",models:["KE","PE","Eco Cassete","Eco Piso-Teto"],equipmentTypes:["Cassete","Piso Teto"],unit:"Evaporadora",code:"E3",
    title:"Sensor da unidade externa",causes:["Sensor externo desconectado ou com defeito."],
    checks:["Verificar conexão e sensor externo antes de substituir componentes."],
    source:"WebArCondicionado • Elgin Eco Cassete/Piso-Teto",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-KEPE-E4",brand:"Elgin",models:["KE","PE","Eco Cassete","Eco Piso-Teto"],equipmentTypes:["Cassete","Piso Teto"],unit:"Evaporadora",code:"E4",
    title:"Proteção da unidade externa",causes:["Proteção da unidade externa foi acionada."],
    checks:["Verificar ligação elétrica pelo diagrama do equipamento e identificar qual proteção atuou."],
    source:"WebArCondicionado • Elgin Eco Cassete/Piso-Teto",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-PT-E0",brand:"Elgin",models:["PT","Eco Atualle Piso-Teto"],equipmentTypes:["Piso Teto"],unit:"Evaporadora",code:"E0",
    title:"Sensor de temperatura ambiente",causes:["Sensor de temperatura ambiente desconectado ou com defeito."],
    checks:["Verificar conexão do sensor e confirmar a família PT/Eco Atualle antes de aplicar esta referência."],
    solutions:["Corrigir a conexão ou substituir o sensor quando a falha for confirmada."],
    source:"WebArCondicionado • Elgin Piso-Teto PT",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",verified:true,
  },
  {
    id:"SRC-ELGIN-PT-E7",brand:"Elgin",models:["PT","Eco Atualle Piso-Teto"],equipmentTypes:["Piso Teto"],unit:"Evaporadora",code:"E7",
    title:"Proteção de alta/baixa pressão",causes:["Atuação da proteção de pressão."],
    checks:["Verificar continuidade do pressostato.","Conferir carga de refrigerante conforme especificação.","Investigar obstruções e conferir ligação elétrica."],
    source:"WebArCondicionado • Elgin Piso-Teto PT",sourceUrl:"https://static.webarcondicionado.com.br/blog/uploads/2022/09/codigo-erro-ar-condicionado-piso-teto-elgin.pdf",verified:true,
  },
];

export function mergeDiagnosticCatalog(custom:DiagnosticCodeRecord[]){
  const map=new Map<string,DiagnosticCodeRecord>();
  for(const record of [...BUILTIN_HVAC_ERROR_CODES,...custom]) map.set(record.id,record);
  return [...map.values()];
}
