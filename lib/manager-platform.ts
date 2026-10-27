import { CURRENT_PROAR_RELEASE } from "./release-notes";

export type ManagerMigration = {
  id:string;
  title:string;
  status:"prepared"|"active";
  destructive:boolean;
  description:string;
};

export const PROAR_SCHEMA_VERSION = "2026.10.06";

export const MANAGER_MIGRATIONS:ManagerMigration[] = [
  {
    id:"20261006_proar_observability",
    title:"Observabilidade e saúde operacional",
    status:"prepared",
    destructive:false,
    description:"Adiciona incidentes estruturados e snapshots de saúde para Central de Erros, contingência e operação dos tenants.",
  },
  {
    id:"20261005_manager_billing_mercado_pago",
    title:"Cobrança recorrente do ProAR Manager",
    status:"prepared",
    destructive:false,
    description:"Adiciona mensalidades, contas a receber, Pix/boleto via Mercado Pago, origem de bloqueio e liberação automática após pagamento confirmado.",
  },
  {
    id:"20261002_proar_tenant_database_identity",
    title:"Identidade de banco por tenant",
    status:"prepared",
    destructive:false,
    description:"Adiciona metadados de banco lógico, papel do tenant, ambiente e modo de isolamento. Ainda não aplicada automaticamente em produção.",
  },
];

export function managerPlatformInfo(){
  return {
    appVersion:CURRENT_PROAR_RELEASE.version,
    releaseDate:CURRENT_PROAR_RELEASE.date,
    releaseTitle:CURRENT_PROAR_RELEASE.title,
    schemaVersion:PROAR_SCHEMA_VERSION,
    channel:"pilot",
    migrations:MANAGER_MIGRATIONS,
  };
}
