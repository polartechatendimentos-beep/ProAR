export type BrandCodeValidation = {
  normalizedBrand:string;
  normalizedCode:string;
  status:"empty"|"candidate"|"needs-extraction"|"needs-model"|"invalid";
  canSearchAI:boolean;
  canUseAsConfirmedReference:boolean;
  title:string;
  message:string;
  instructions:string[];
};

const norm=(value:unknown)=>String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLocaleLowerCase("pt-BR");
const code=(value:unknown)=>String(value??"").trim().toUpperCase().replace(/\s+/g,"");

export function validateManufacturerCode(input:{brand?:unknown;model?:unknown;code?:unknown;blinkPattern?:unknown}):BrandCodeValidation{
  const brand=norm(input.brand);
  const model=String(input.model??"").trim();
  const value=code(input.code);

  if(!value) return {
    normalizedBrand:brand,normalizedCode:"",
    status:"empty",canSearchAI:true,canUseAsConfirmedReference:false,
    title:"Código não informado",
    message:"O diagnóstico pode continuar por sintomas e padrão de piscadas.",
    instructions:[],
  };

  if(/daikin/.test(brand)){
    if(/^\d+$/.test(value) && value!=="00"){
      return {
        normalizedBrand:brand,normalizedCode:value,
        status:"needs-extraction",canSearchAI:true,canUseAsConfirmedReference:false,
        title:"Daikin • leitura incompleta do código",
        message:`“${value}” foi informado como número isolado. O ProAR não tratará esse valor como código final de falha Daikin.`,
        instructions:[
          "Identifique o modelo da unidade e o modelo do controle/termostato.",
          "Entre no modo de diagnóstico previsto no manual correspondente ao controlador.",
          "Percorra os códigos até obter o código alfanumérico/identificador exibido pelo equipamento.",
          "Digite o código obtido e confirme contra o manual da família/modelo antes de trocar componentes.",
        ],
      };
    }
    if(!/^[A-Z][0-9A-Z]$|^00$/.test(value)){
      return {
        normalizedBrand:brand,normalizedCode:value,
        status:"invalid",canSearchAI:true,canUseAsConfirmedReference:false,
        title:"Daikin • formato não reconhecido",
        message:"O valor informado não corresponde ao padrão curto observado nos manuais Daikin suportados pelo ProAR. Ele será tratado apenas como pista de pesquisa.",
        instructions:["Confirme o código no controle/termostato da unidade e informe o modelo para localizar o manual correto."],
      };
    }
    return {
      normalizedBrand:brand,normalizedCode:value,
      status:model?"candidate":"needs-model",canSearchAI:true,canUseAsConfirmedReference:false,
      title:model?"Daikin • código candidato":"Daikin • modelo necessário",
      message:model
        ?`O código ${value} será cruzado com o modelo ${model} e documentação técnica antes de ser considerado confirmado.`
        :`O código ${value} é um candidato válido, mas o modelo/linha é necessário para confirmar o significado.`,
      instructions:model?["Cruzar código, modelo e manual oficial antes de concluir a causa."]:["Informe o modelo completo da etiqueta técnica."],
    };
  }

  if(/elgin/.test(brand)){
    if(!model){
      return {
        normalizedBrand:brand,normalizedCode:value,
        status:"needs-model",canSearchAI:true,canUseAsConfirmedReference:false,
        title:"Elgin • modelo/linha obrigatório",
        message:`O código ${value} pode ter significados diferentes entre linhas Elgin. O ProAR não confirmará a falha sem identificar o modelo/família.`,
        instructions:["Informe o modelo completo ou fotografe a etiqueta do equipamento.","Cruze código, modelo e, quando disponível, padrão de LEDs/piscadas."],
      };
    }
    return {
      normalizedBrand:brand,normalizedCode:value,
      status:"candidate",canSearchAI:true,canUseAsConfirmedReference:false,
      title:"Elgin • código candidato",
      message:`O código ${value} será validado especificamente para o modelo ${model} antes de gerar conclusão técnica.`,
      instructions:["Não reutilize o significado do mesmo código de outra família Elgin sem confirmação documental."],
    };
  }

  if(/^\d+$/.test(value)){
    return {
      normalizedBrand:brand,normalizedCode:value,
      status:"needs-model",canSearchAI:true,canUseAsConfirmedReference:false,
      title:"Código numérico • validar fabricante",
      message:"Códigos exclusivamente numéricos podem representar alarmes, endereços, estados do controlador ou subcódigos. O ProAR exigirá contexto do fabricante/modelo.",
      instructions:["Confirme marca, modelo e origem da leitura: display da unidade, controle, termostato ou aplicativo."],
    };
  }

  return {
    normalizedBrand:brand,normalizedCode:value,
    status:model?"candidate":"needs-model",canSearchAI:true,canUseAsConfirmedReference:false,
    title:"Código candidato",
    message:model?"O código será cruzado com a documentação da família/modelo.":"Informe o modelo para aumentar a precisão e evitar equivalência incorreta entre linhas.",
    instructions:model?[]:["Informe o modelo completo da etiqueta técnica."],
  };
}
