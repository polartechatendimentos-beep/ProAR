"use client";

import "./diagnostic-management-dashboard.css";

import { Activity, AlertTriangle, CheckCircle2, RefreshCcw, Stethoscope, Wrench } from "lucide-react";

type RecordItem=Record<string,unknown>;
type Props={serviceOrders:RecordItem[];equipment:RecordItem[]};

const text=(value:unknown)=>String(value??"").trim();

export function DiagnosticManagementDashboard({serviceOrders,equipment}:Props){
  const histories=serviceOrders.flatMap(order=>{
    const list=Array.isArray(order.diagnosticHistory)?order.diagnosticHistory as RecordItem[]:[];
    return list.map(item=>({...item,orderId:order.id,client:order.client,tech:order.tech}));
  });
  const equipmentHistories=equipment.flatMap(item=>{
    const list=Array.isArray(item.diagnosticHistory)?item.diagnosticHistory as RecordItem[]:[];
    return list.map(entry=>({...entry,equipmentId:item.id,equipmentName:item.name||item.model}));
  });
  const unique=new Map<string,RecordItem>();
  const combined:RecordItem[]=[...(histories as RecordItem[]),...(equipmentHistories as RecordItem[])];
  for(const item of combined)unique.set(text(item.id)||JSON.stringify(item),item);
  const rows=[...unique.values()].sort((a,b)=>new Date(text(b.createdAt)||0).getTime()-new Date(text(a.createdAt)||0).getTime());
  const last30=rows.filter(item=>Date.now()-new Date(text(item.createdAt)||0).getTime()<=30*86400000);
  const critical=rows.filter(item=>/cr[ií]tica|alta/i.test(text((item.result as RecordItem|undefined)?.severity)));
  const confirmed=rows.filter(item=>/confirmada|manual/i.test(text((item.result as RecordItem|undefined)?.referenceConfidence)));
  const recurrenceEquipment=equipment.filter(item=>{
    const list=Array.isArray(item.diagnosticHistory)?item.diagnosticHistory as RecordItem[]:[];
    return list.filter(entry=>Date.now()-new Date(text(entry.createdAt)||0).getTime()<=180*86400000).length>=3;
  });
  const byBrand=new Map<string,number>();
  for(const item of rows){const brand=text(item.brand)||"Não informada";byBrand.set(brand,(byBrand.get(brand)||0)+1);}
  const topBrands=[...byBrand.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);

  return <section className="module-page diagnostic-management">
    <div className="module-heading"><div><span className="section-kicker"><Stethoscope size={13}/> QUALIDADE TÉCNICA</span><h2>Painel de Diagnósticos</h2><p>Visão gerencial de diagnósticos, reincidências e rastreabilidade técnica.</p></div></div>
    <div className="diag-kpis">
      <article><Activity/><small>Diagnósticos</small><strong>{rows.length}</strong><span>{last30.length} nos últimos 30 dias</span></article>
      <article><CheckCircle2/><small>Referência confirmada</small><strong>{confirmed.length}</strong><span>com manual/referência validada</span></article>
      <article><AlertTriangle/><small>Alta criticidade</small><strong>{critical.length}</strong><span>exigem atenção técnica</span></article>
      <article><RefreshCcw/><small>Reincidências</small><strong>{recurrenceEquipment.length}</strong><span>equipamentos com 3+ ocorrências/180 dias</span></article>
    </div>
    <div className="diag-management-grid">
      <article className="module-card"><h3>Ocorrências recentes</h3><div className="diag-recent-list">{rows.slice(0,12).map((item,index)=>{const result=(item.result||{}) as RecordItem;return <div key={text(item.id)||index}><span><Wrench size={14}/></span><div><b>{text(result.summary)||text(item.symptoms)||"Diagnóstico técnico"}</b><small>{[text(item.brand),text(item.model),text(item.code),text(item.orderId)].filter(Boolean).join(" • ")}</small></div><time>{text(item.createdAt)?new Date(text(item.createdAt)).toLocaleDateString("pt-BR"):"—"}</time></div>})}{!rows.length&&<p>Nenhum diagnóstico registrado.</p>}</div></article>
      <article className="module-card"><h3>Diagnósticos por fabricante</h3><div className="diag-brand-list">{topBrands.map(([brand,count])=><div key={brand}><span>{brand}</span><b>{count}</b></div>)}</div></article>
    </div>
  </section>;
}
