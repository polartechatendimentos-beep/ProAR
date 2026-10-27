import {tenantSlugFromHost} from './tenant-host.ts';
export function mobileLoginTenant(host:string){return tenantSlugFromHost(host.replace(/^mobile\./i,''));}
export function mobileLoginOutcome(status:number,body:unknown){
 const data=body&&typeof body==='object'&&!Array.isArray(body)?body as Record<string,unknown>:{};
 if(data.blocked===true||data.code==='SYSTEM_BLOCKED')return {ok:false,changePassword:false,message:'Sistema bloqueado. Entre em contato com a equipe da ProAR.'};
 if(status<200||status>=300||data.authenticated!==true)return {ok:false,changePassword:false,message:typeof data.error==='string'?data.error.slice(0,350):'Não foi possível entrar. Confira usuário, senha e conexão.'};
 return {ok:true,changePassword:data.mustChangePassword===true,message:''};
}
