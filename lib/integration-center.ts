export type IntegrationState={id:string;name:string;enabled:boolean;lastSuccessAt?:string;lastFailureAt?:string;consecutiveFailures?:number;webhookBacklog?:number};
export function integrationHealth(x:IntegrationState){const failures=x.consecutiveFailures||0, backlog=x.webhookBacklog||0; const status=!x.enabled?"disabled":failures>=3||backlog>=20?"critical":failures>0||backlog>0?"attention":"operational";return {...x,status};}
export function integrationCenter(rows:IntegrationState[]){return rows.map(integrationHealth).sort((a,b)=>String(a.status).localeCompare(String(b.status)));}
