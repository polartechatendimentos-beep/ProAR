import { CURRENT_PROAR_RELEASE } from "./release-notes";

export type ManagerMigration = {
  id:string;
  title:string;
  status:"prepared"|"active";
  destructive:boolean;
  description:string;
};

export const PROAR_SCHEMA_VERSION = "2026.10.02";

export const MANAGER_MIGRATIONS:ManagerMigration[] = [
  {
    id:"20261007_manager_lifecycle_jobs",
    title:"Lifecycle, rollout e jobs administrativos",
    status:"prepared",
    destructive:false,
    description:"Adiciona canal de rollout por tenant e fila auditável para backup, restauração, homologação, exportação, encerramento e arquivamento.",
  },
  {
    id:"20261005_manager_control_center",
    title:"Centro Operacional SaaS",
    status:"prepared",
    destructive:false,
    description:"Adiciona modo manutenção, feature flags, domínio, suporte, limites, metadados de backup e central de incidentes por tenant.",
  },
  {
    id:"20261002_manager_receivables",
    title:"Contas a receber e bloqueio financeiro",
    status:"prepared",
    destructive:false,
    description:"Adiciona contas a receber do SaaS, tolerância de vencimento e bloqueio financeiro automático. A migration permanece preparada até ativação controlada no banco mestre.",
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
