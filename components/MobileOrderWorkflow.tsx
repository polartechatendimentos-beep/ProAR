'use client';
import {useEffect,useState} from 'react';
import type {MobileFieldOrder} from '@/lib/mobile-field';
import {elapsedAttendanceMinutes,workflowStages} from '@/lib/mobile-workflow-insights';
import styles from './ProARFieldMobile.module.css';
export function MobileOrderWorkflow({order,done,requirements,disabled,onNavigate}:{order:MobileFieldOrder;done:Record<string,boolean>;requirements:{key:string;label:string;required:boolean}[];disabled:boolean;onNavigate:(key:string)=>void}){
 const [now,setNow]=useState(()=>Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),30000);return()=>clearInterval(timer)},[]);
 const stages=workflowStages(done,requirements),next=stages.find(s=>!s.complete)?.next,time=elapsedAttendanceMinutes(order,now);
 return <section className={styles.workflowPanel} aria-label="Etapas do atendimento"><ol className={styles.workflowSteps}>{stages.map((stage,index)=><li key={stage.id} data-complete={stage.complete}><span>{stage.complete?'✓':index+1}</span><strong>{stage.label}</strong><small>{stage.done}/{stage.total}</small></li>)}</ol>
 {time&&<p className={styles.syncBanner}>Desde o check-in: {time.elapsed} min • trabalho: {time.active} min • pausa registrada: {time.paused} min{time.partial?' • estimativa parcial, confira o histórico':''}. Não representa espelho de ponto.</p>}
 {next?<button type="button" className={styles.primaryAction} disabled={disabled} onClick={()=>onNavigate(next.key)}>Próximo passo: {next.label}</button>:<p role="status">Requisitos preenchidos. Revise os dados antes de concluir.</p>}
 </section>;
}
