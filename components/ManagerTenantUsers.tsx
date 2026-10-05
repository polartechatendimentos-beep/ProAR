"use client";
import { FormEvent, useEffect, useState } from "react";
import { KeyRound, UserCog } from "lucide-react";

type Company={id:string;trade_name?:string;legal_name?:string};
type TenantUser={id:string;company_id:string;username:string;display_name:string;role:string;active:boolean;must_change_password:boolean;created_at?:string};

export function ManagerTenantUsers({companies}:{companies:Company[]}){
 const[companyId,setCompanyId]=useState("");const[users,setUsers]=useState<TenantUser[]>([]);const[error,setError]=useState("");
 useEffect(()=>{if(!companyId&&companies[0]?.id)setCompanyId(companies[0].id)},[companies,companyId]);
 useEffect(()=>{if(!companyId){setUsers([]);return}fetch("/api/manager/users?companyId="+encodeURIComponent(companyId),{cache:"no-store"}).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||"Falha ao carregar usuários.");setUsers(j.users||[])}).catch(e=>setError(e instanceof Error?e.message:"Falha ao carregar usuários."))},[companyId]);
 const reload=()=>{if(!companyId)return;fetch("/api/manager/users?companyId="+encodeURIComponent(companyId),{cache:"no-store"}).then(async r=>r.ok?r.json():{users:[]}).then(j=>setUsers(j.users||[])).catch(()=>{})};
 const create=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();const form=new FormData(e.currentTarget);const r=await fetch("/api/manager/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({companyId,username:String(form.get("username")||""),displayName:String(form.get("displayName")||"")})});const j=await r.json();if(!r.ok){setError(j.error||"Falha ao criar administrador.");return}window.alert("Usuário criado. Senha temporária: "+j.temporaryPassword+"\nO usuário deverá trocar a senha no próximo login.");e.currentTarget.reset();reload()};
 const patch=async(user:TenantUser,body:Record<string,unknown>)=>{const r=await fetch("/api/manager/users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:user.id,companyId,...body})});const j=await r.json();if(!r.ok){setError(j.error||"Falha ao atualizar usuário.");return}if(j.temporaryPassword)window.alert("Nova senha temporária: "+j.temporaryPassword+"\nA troca será exigida no próximo login.");reload()};
 return <section className="manager-panel manager-tenant-users"><div className="panel-head"><div><h2>Administradores dos tenants</h2><p>Criação, bloqueio e reset de senha sem visualizar a senha atual do cliente.</p></div></div>{error&&<div className="manager-alert">{error}</div>}
 <div className="manager-user-toolbar"><label>Empresa<select value={companyId} onChange={e=>setCompanyId(e.target.value)}><option value="">Selecione</option>{companies.map(c=><option key={c.id} value={c.id}>{c.trade_name||c.legal_name}</option>)}</select></label></div>
 <form className="manager-user-create" onSubmit={create}><label>Nome<input name="displayName" required placeholder="Administrador"/></label><label>Usuário<input name="username" required placeholder="admin.empresa"/></label><button><UserCog size={15}/> Criar administrador</button></form>
 <div className="manager-user-list">{users.map(user=><article key={user.id}><div><b>{user.display_name}</b><small>{user.username} • {user.role} • {user.must_change_password?"troca de senha pendente":"senha definida"}</small></div><span className={user.active?"active":"blocked"}>{user.active?"ATIVO":"BLOQUEADO"}</span><button onClick={()=>void patch(user,{active:!user.active})}>{user.active?"Bloquear":"Ativar"}</button><button onClick={()=>void patch(user,{resetPassword:true})}><KeyRound size={13}/> Resetar senha</button></article>)}{!users.length&&<div className="manager-empty">Nenhum usuário administrativo encontrado para esta empresa.</div>}</div>
 </section>;
}