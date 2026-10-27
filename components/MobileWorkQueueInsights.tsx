'use client';
import {useEffect,useMemo,useState} from 'react';
import type {MobileFieldOrder} from '@/lib/mobile-field';
import {isOpenMobileOrder} from '@/lib/mobile-field';
import {mobileAttention} from '@/lib/mobile-workflow-insights';
import {listOrderDrafts} from '@/lib/mobile-order-drafts';
import styles from './ProARFieldMobile.module.css';
import type {OrderFilter} from '@/lib/mobile-order-display';
export function MobileWorkQueueInsights({orders,scope,manager,today,onOpen,onFilter}:{orders:MobileFieldOrder[];scope:string;manager:boolean;today:string;onOpen:(id:string)=>void;onFilter:(filter:OrderFilter)=>void}){
 const stats=useMemo(()=>mobileAttention(orders,today),[orders,today]);
 const [resume,setResume]=useState<{scope:string;id:string;at:number}|null>(null);
 useEffect(()=>{let cancelled=false;void listOrderDrafts(scope).then(rows=>{const allowed=new Set(orders.filter(o=>isOpenMobileOrder(o.status)).map(o=>o.id));const row=rows.filter(r=>Boolean(r.orderSnapshot&&allowed.has(r.orderSnapshot.id))).sort((a,b)=>b.savedAt-a.savedAt)[0];if(!cancelled)setResume(row?{scope,id:row.orderSnapshot!.id,at:row.savedAt}:null);}).catch(()=>{});return()=>{cancelled=true};},[scope,orders]);
 const resumable=resume?.scope===scope?resume:null;
 return <section className={styles.detailCard} aria-label="Ações prioritárias"><h2>Continuar meu trabalho</h2>
 {resumable?<button className={styles.primaryAction} type="button" onClick={()=>onOpen(resumable.id)}>Retomar rascunho • {resumable.id}</button>:stats.open.find(o=>o.checkInAt)?<button className={styles.primaryAction} type="button" onClick={()=>onOpen(stats.open.find(o=>o.checkInAt)!.id)}>Continuar atendimento • {stats.open.find(o=>o.checkInAt)!.id}</button>:<p>Selecione uma OS em aberto para começar.</p>}
 <div className={styles.insightActions}><button type="button" onClick={()=>onFilter('overdue')}>{stats.overdue.length} atrasada(s)</button><button type="button" onClick={()=>onFilter('active')}>Em andamento</button>{manager&&<button type="button" onClick={()=>onFilter('unassigned')}>{stats.unassigned.length} sem técnico</button>}</div>
 <details className={styles.requirementsList}><summary>Central de atenção • {stats.requests.length+stats.stalled.length} ocorrência(s)</summary><p>OS sem evento novo há 90 minutos são sinais para conferência, não confirmação de inatividade.</p>{stats.stalled.map(o=><button key={o.id} type="button" className={styles.secondaryAction} onClick={()=>onOpen(o.id)}>{o.id} • revisar andamento</button>)}{stats.requests.slice(0,20).map(({order,request})=><button key={`${order.id}-${request.id}`} type="button" className={styles.secondaryAction} onClick={()=>onOpen(order.id)}>{order.id} • solicitação pendente</button>)}{!stats.stalled.length&&!stats.requests.length&&<p>Nenhuma ocorrência identificada na leitura atual.</p>}</details>
 {manager&&<details className={styles.requirementsList}><summary>Carga da equipe • {stats.open.length} OS abertas</summary><p>Somente OS autorizadas desta empresa. Duração é previsão cadastrada, sem estimar produtividade por quantidade.</p>{stats.teams.map(t=><p key={t.tech}><strong>{t.tech}</strong> • {t.open} aberta(s) • {t.active} com check-in ativo • {t.overdue} atrasada(s) • {t.minutes} min previstos nas OS que possuem duração.</p>)}</details>}
 </section>;
}
