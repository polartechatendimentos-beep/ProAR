export type ProARErrorCode =
  | "PROAR-AUTH-001"
  | "PROAR-AUTH-002"
  | "PROAR-DB-001"
  | "PROAR-DB-002"
  | "PROAR-DB-003"
  | "PROAR-DB-004"
  | "PROAR-DB-005"
  | "PROAR-DATA-001"
  | "PROAR-INTEGRATION-003"
  | "PROAR-INTEGRATION-004"
  | "PROAR-FISCAL-001"
  | "PROAR-INTEGRATION-001"
  | "PROAR-INTEGRATION-002"
  | "PROAR-DEPLOY-001"
  | "PROAR-PERM-001"
  | "PROAR-CONFLICT-001"
  | "PROAR-VALIDATION-001"
  | "PROAR-UNKNOWN-001";

export type ProARErrorDescriptor = {
  code: ProARErrorCode;
  title: string;
  userMessage: string;
  severity: "info"|"warning"|"error"|"critical";
};

const descriptors:Record<ProARErrorCode,ProARErrorDescriptor>={
  "PROAR-AUTH-001":{code:"PROAR-AUTH-001",title:"Sessão expirada",userMessage:"Sua sessão expirou. Entre novamente no sistema.",severity:"warning"},
  "PROAR-AUTH-002":{code:"PROAR-AUTH-002",title:"Sistema bloqueado",userMessage:"Sistema bloqueado. Entre em contato com a equipe da ProAR.",severity:"critical"},
  "PROAR-DB-001":{code:"PROAR-DB-001",title:"Banco indisponível",userMessage:"Não foi possível acessar os dados do sistema neste momento.",severity:"critical"},
  "PROAR-DB-002":{code:"PROAR-DB-002",title:"Banco lento",userMessage:"O banco está demorando mais que o esperado para responder.",severity:"warning"},
  "PROAR-DB-003":{code:"PROAR-DB-003",title:"Modo de contingência",userMessage:"O banco está temporariamente indisponível. A última cópia sincronizada foi preservada.",severity:"critical"},
  "PROAR-DB-004":{code:"PROAR-DB-004",title:"Limite do banco excedido",userMessage:"O banco está temporariamente bloqueado por limite de uso do provedor. A última cópia sincronizada foi preservada.",severity:"critical"},
  "PROAR-DB-005":{code:"PROAR-DB-005",title:"Configuração do banco inválida",userMessage:"A configuração do banco precisa de correção antes de continuar.",severity:"critical"},
  "PROAR-DATA-001":{code:"PROAR-DATA-001",title:"Resposta vazia",userMessage:"O serviço respondeu, mas não retornou os dados esperados.",severity:"warning"},
  "PROAR-INTEGRATION-003":{code:"PROAR-INTEGRATION-003",title:"Timeout de integração",userMessage:"Uma integração externa excedeu o tempo de resposta. Tente novamente.",severity:"warning"},
  "PROAR-INTEGRATION-004":{code:"PROAR-INTEGRATION-004",title:"Resposta vazia da integração",userMessage:"A integração respondeu sem conteúdo válido. O último resultado confirmado foi preservado.",severity:"warning"},
  "PROAR-FISCAL-001":{code:"PROAR-FISCAL-001",title:"Integração fiscal",userMessage:"A integração fiscal precisa de atenção antes da emissão.",severity:"warning"},
  "PROAR-INTEGRATION-001":{code:"PROAR-INTEGRATION-001",title:"Integração indisponível",userMessage:"Uma integração externa está indisponível no momento.",severity:"warning"},
  "PROAR-INTEGRATION-002":{code:"PROAR-INTEGRATION-002",title:"Integração não configurada",userMessage:"Esta integração ainda não está configurada para o ambiente atual.",severity:"info"},
  "PROAR-DEPLOY-001":{code:"PROAR-DEPLOY-001",title:"Publicação insegura",userMessage:"A publicação foi bloqueada porque uma verificação crítica não foi aprovada.",severity:"critical"},
  "PROAR-PERM-001":{code:"PROAR-PERM-001",title:"Acesso não permitido",userMessage:"Você não possui permissão para realizar esta operação.",severity:"warning"},
  "PROAR-CONFLICT-001":{code:"PROAR-CONFLICT-001",title:"Conflito de atualização",userMessage:"Este registro foi alterado por outro usuário. Atualize e tente novamente.",severity:"warning"},
  "PROAR-VALIDATION-001":{code:"PROAR-VALIDATION-001",title:"Dados inválidos",userMessage:"Revise os campos destacados antes de continuar.",severity:"info"},
  "PROAR-UNKNOWN-001":{code:"PROAR-UNKNOWN-001",title:"Falha inesperada",userMessage:"Não foi possível concluir a operação. Tente novamente.",severity:"error"},
};

export function proarError(code:ProARErrorCode){return descriptors[code];}

export function classifyProarError(input:unknown,status?:number):ProARErrorDescriptor{
  if(typeof input==="string" && input in descriptors) return descriptors[input as ProARErrorCode];
  const message=input instanceof Error?input.message:String((input as any)?.message||(input as any)?.error||input||"");
  const value=message.toLowerCase();
  if(/sistema bloqueado|system_blocked/.test(value)) return proarError("PROAR-AUTH-002");
  if(status===401||/sess[aã]o.*expir|unauthorized|jwt/.test(value)) return proarError("PROAR-AUTH-001");
  if(status===403||/forbidden|sem permiss[aã]o|permission denied/.test(value)) return proarError("PROAR-PERM-001");
  if(status===409||/conflito|conflict|revision/.test(value)) return proarError("PROAR-CONFLICT-001");
  if(status===402||/quota|exceeded the quota|usage limit|resource limit|payment required/.test(value)) return proarError("PROAR-DB-004");
  if(/database.*not configured|banco.*n[aã]o configurado|missing.*database|connection string.*missing|invalid.*database url|credencial.*banco/.test(value)) return proarError("PROAR-DB-005");
  if((status===408||status===504||/timeout|timed out|abort/.test(value)) && /pncp|cnpj|brasilapi|receita|integration|api externa/.test(value)) return proarError("PROAR-INTEGRATION-003");
  if(status===408||status===504||/timeout|timed out|abort/.test(value)) return proarError("PROAR-DB-002");
  if(/coming_up|inactive|database.*paused|project.*paused|connection terminated/.test(value)) return proarError("PROAR-DB-003");
  if(status && status>=500 || /database|postgres|supabase|neon|fetch failed|econn/.test(value)) return proarError("PROAR-DB-001");
  if(/empty response|resposta vazia|sem conte[uú]do|payload vazio/.test(value) && /pncp|cnpj|brasilapi|receita|integration|api externa/.test(value)) return proarError("PROAR-INTEGRATION-004");
  if(/empty response|resposta vazia|sem conte[uú]do|payload vazio/.test(value)) return proarError("PROAR-DATA-001");
  if(/fiscal|sefaz|nf-e|nfce|nfse|dfe/.test(value)) return proarError("PROAR-FISCAL-001");
  if(/vercel|deployment|deploy|rollback|promotion/.test(value)) return proarError("PROAR-DEPLOY-001");
  return proarError("PROAR-UNKNOWN-001");
}
