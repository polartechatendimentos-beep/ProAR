'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {mobileLoginOutcome,mobileLoginTenant} from '@/lib/mobile-login';
import styles from './ProARFieldMobile.module.css';
export function MobileLogin({onAuthenticated}:{onAuthenticated:()=>Promise<void>}){
 const [username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirmation,setConfirmation]=useState(''),[show,setShow]=useState(false),[changePassword,setChangePassword]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const request=useRef<AbortController|null>(null),lock=useRef(false);
 useEffect(()=>()=>request.current?.abort(),[]);
 async function submit(event:FormEvent){event.preventDefault();if(lock.current)return;setError('');if(!navigator.onLine){setError('Conecte à internet para validar o acesso. Seus rascunhos permanecem no aparelho.');return;}if(changePassword&&(password!==confirmation)){setError('As senhas não conferem.');return;}
  lock.current=true;setBusy(true);const controller=new AbortController();request.current=controller;
  try{const response=await fetch(changePassword?'/api/auth/change-password':'/api/auth',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify(changePassword?{password}:{username:username.trim(),password,tenant:mobileLoginTenant(window.location.hostname)}),signal:controller.signal});
   const body=await response.json().catch(()=>null);if(controller.signal.aborted)return;
   if(changePassword){if(!response.ok||body?.saved!==true)throw new Error(typeof body?.error==='string'?body.error:'Não foi possível atualizar a senha.');setPassword('');setConfirmation('');await onAuthenticated();return;}
   const result=mobileLoginOutcome(response.status,body);if(!result.ok)throw new Error(result.message);setPassword('');if(result.changePassword){setChangePassword(true);setShow(false);return;}await onAuthenticated();
  }catch(error){if(!controller.signal.aborted)setError(error instanceof Error?error.message:'Não foi possível conectar ao ProAR.');}finally{if(!controller.signal.aborted){lock.current=false;setBusy(false);}}
 }
 return <section className={`${styles.detailCard} ${styles.mobileLogin}`} aria-label="Entrar no ProAR Mobile"><p className={styles.eyebrow}>ACESSO DIRETO AO MOBILE</p><h1 className={styles.title}>{changePassword?'Crie sua senha':'Entrar no ProAR Mobile'}</h1><p>{changePassword?'Use pelo menos 10 caracteres, com maiúscula, minúscula e número.':'Use seu usuário e senha habituais. Você permanece no Mobile após entrar.'}</p><form onSubmit={event=>void submit(event)}>
 {!changePassword&&<label className={styles.formLabel}>Usuário<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={e=>setUsername(e.target.value)} required maxLength={150} disabled={busy}/></label>}
 <label className={styles.formLabel}>{changePassword?'Nova senha':'Senha'}<input name="password" type={show?'text':'password'} autoComplete={changePassword?'new-password':'current-password'} minLength={changePassword?10:undefined} value={password} onChange={e=>setPassword(e.target.value)} required disabled={busy}/></label>
 {changePassword&&<label className={styles.formLabel}>Confirmar nova senha<input type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} required minLength={10} disabled={busy}/></label>}
 <label className={styles.checkLabel}><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} disabled={busy}/>Mostrar senha</label>
 {error&&<p className={styles.warning} role="alert">{error}</p>}<button className={styles.primaryAction} type="submit" disabled={busy}>{busy?'Validando acesso…':changePassword?'Salvar senha e abrir Mobile':'Entrar no Mobile'}</button></form><p className={styles.disclaimer}>O acesso respeita sua empresa, perfil e permissões. A senha não é guardada pelo aplicativo.</p></section>;
}
