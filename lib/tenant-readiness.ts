export type TenantReadinessCheck={id:string;label:string;ok:boolean;blocking:boolean;detail:string};
export type TenantReadiness={ready:boolean;score:number;checks:TenantReadinessCheck[];blocking:string[]};

export function tenantReadiness(input:{
  company:Record<string,unknown>;
  instance?:Record<string,unknown>;
  now?:number;
}):TenantReadiness{
  const company=input.company||{};
  const instance=input.instance||{};
  const now=input.now??Date.now();
  const lastHealth=instance.last_health_at?new Date(String(instance.last_health_at)).getTime():0;
  const healthFresh=Boolean(lastHealth&&Number.isFinite(lastHealth)&&now-lastHealth<=24*60*60*1000);
  const hasDocument=Boolean(String(company.cnpj||company.cpf||"").replace(/\D/g,""));
  const hasContact=Boolean(String(company.email||company.billing_email||"").trim());
  const modules=Array.isArray(company.modules)?company.modules:[];
  const checks:TenantReadinessCheck[]=[
    {id:"identity",label:"Identificação fiscal",ok:hasDocument,blocking:true,detail:hasDocument?"Documento cadastrado.":"CNPJ/CPF ausente."},
    {id:"contact",label:"Contato administrativo",ok:hasContact,blocking:false,detail:hasContact?"Contato cadastrado.":"Cadastre e-mail administrativo/cobrança."},
    {id:"access",label:"Acesso",ok:company.status==="active",blocking:true,detail:company.status==="active"?"Empresa liberada.":"Empresa bloqueada."},
    {id:"plan",label:"Plano",ok:Boolean(company.plan_code),blocking:true,detail:company.plan_code?"Plano definido.":"Plano não definido."},
    {id:"modules",label:"Módulos",ok:modules.length>0,blocking:true,detail:modules.length?modules.length+" módulo(s) liberado(s).":"Nenhum módulo liberado."},
    {id:"database",label:"Banco",ok:instance.provisioning_status==="ready"&&!instance.provisioning_error,blocking:true,detail:instance.provisioning_error?String(instance.provisioning_error):instance.provisioning_status==="ready"?"Banco pronto.":"Banco ainda não está pronto."},
    {id:"health",label:"Health check",ok:healthFresh,blocking:true,detail:healthFresh?"Health check recente.":"Health check ausente ou vencido."},
  ];
  const score=Math.round(checks.filter(item=>item.ok).length/checks.length*100);
  const blocking=checks.filter(item=>item.blocking&&!item.ok).map(item=>item.label);
  return{ready:blocking.length===0,score,checks,blocking};
}
