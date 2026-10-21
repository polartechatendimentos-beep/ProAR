"use client";
import {useEffect,useState} from 'react';
import {parseTenderPreferences,tenderPreferenceKey,type TenderPreferences} from '@/lib/tender-preferences';
export function TenderSavedFilters({current,onApply}:{current:TenderPreferences;onApply:(value:TenderPreferences)=>void}){
 const [key,setKey]=useState<string|null>(null),[message,setMessage]=useState('');
 useEffect(()=>{const controller=new AbortController();void fetch('/api/auth',{cache:'no-store',signal:controller.signal}).then(async response=>{if(!response.ok)return;const session=await response.json();if(!controller.signal.aborted&&session.authenticated)setKey(tenderPreferenceKey(session.companyId||session.companySlug,session.username));}).catch(()=>{});return()=>controller.abort();},[]);
 function act(action:'save'|'apply'|'remove'){
  if(!key)return;
  try{
   if(action==='save'){localStorage.setItem(key,JSON.stringify(parseTenderPreferences(JSON.stringify(current))));setMessage('Filtros e visualização salvos neste navegador para seu usuário e empresa.');}
   else if(action==='remove'){localStorage.removeItem(key);setMessage('Preferência salva removida. Os filtros atuais foram mantidos.');}
   else{const raw=localStorage.getItem(key);if(!raw){setMessage('Nenhum filtro salvo para seu usuário neste navegador.');return;}onApply(parseTenderPreferences(raw));setMessage('Filtros e visualização restaurados.');}
  }catch{setMessage('Não foi possível acessar a preferência. Verifique o armazenamento do navegador ou salve novamente.');}
 }
 return <div><button type="button" className="outline-btn" disabled={!key} onClick={()=>act('save')}>Salvar meus filtros</button>{' '}<button type="button" className="outline-btn" disabled={!key} onClick={()=>act('apply')}>Aplicar meus filtros</button>{' '}<button type="button" className="outline-btn" disabled={!key} onClick={()=>act('remove')}>Esquecer filtros salvos</button><p role="status">{message||'Preferência por usuário e empresa neste navegador. Não é sincronizada entre dispositivos.'}</p></div>;
}
