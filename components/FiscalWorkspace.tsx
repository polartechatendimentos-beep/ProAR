"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, FileClock, FileText, Landmark, ReceiptText, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/ui-feedback";

type FiscalRecord = Record<string, any>;
type FiscalConfig = {
  company?: Record<string, any>;
  nfe?: Record<string, any>;
  nfce?: Record<string, any>;
  nfse?: Record<string, any>;
  certificate?: { fileName?: string; status?: string; validTo?: string; daysToExpiry?: number } | null;
  updatedAt?: string;
  updatedBy?: string;
};

export function FiscalWorkspace({
  modules,
  serviceOrders,
  company,
  onNavigate,
}: {
  modules: Record<string, FiscalRecord[]>;
  serviceOrders: FiscalRecord[];
  company: { cnpj?: string; tradeName?: string };
  onNavigate: (name:string)=>void;
}) {
  const [tab,setTab]=useState<"Visão geral"|"NF-e"|"NFC-e"|"NFS-e"|"DF-e">("Visão geral");
  const [config,setConfig]=useState<FiscalConfig|null>(null);
  const [loading,setLoading]=useState(true);
  const [dfeLoading,setDfeLoading]=useState(false);
  const [dfe,setDfe]=useState<FiscalRecord[]>([]);

  const loadConfig=async()=>{
    setLoading(true);
    try{
      const response=await fetch("/api/fiscal-config",{cache:"no-store"});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Não foi possível consultar a configuração fiscal.");
      setConfig(result);
    }catch(error){
      setConfig(null);
      notifyError(error instanceof Error?error.message:"Não foi possível consultar a configuração fiscal.","Central Fiscal");
    }finally{setLoading(false);}
  };
  useEffect(()=>{void loadConfig();},[]);

  const sales=modules.Vendas??[];
  const finance=modules.Financeiro??[];
  const commitments=modules.Empenhos??[];
  const fiscalRecords=[
    ...(modules["Documentos Fiscais"]??[]),
    ...(modules["Notas Fiscais"]??[]),
  ];
  const authorized=fiscalRecords.filter(item=>/autorizad|emitid|faturad/i.test(String(item.status??""))||item.invoiceNumber).length;
  const rejected=fiscalRecords.filter(item=>/rejeitad|erro|cancelad/i.test(String(item.status??""))).length;
  const pending=finance.filter(item=>/pronto para faturar|aguardando emiss|pendente/i.test(`${item.status??""} ${item.description??""}`)).length
    + commitments.filter(item=>/pronto para faturar/i.test(String(item.status??""))).length;
  const completedServices=serviceOrders.filter(item=>/conclu[ií]da/i.test(String(item.status??"")));
  const certificateOk=config?.certificate?.status==="Válido";

  const nfseCandidates=useMemo(()=>completedServices.filter(item=>!item.invoiceNumber),[serviceOrders]);
  const nfceCandidates=useMemo(()=>sales.filter(item=>!item.invoiceNumber&&((item.purchaseItems??[]).some((x:FiscalRecord)=>x.kind==="Produto")||item.kind==="Produto")),[sales]);
  const nfeCandidates=useMemo(()=>sales.filter(item=>!item.invoiceNumber),[sales]);

  const consultDfe=async()=>{
    setDfeLoading(true);
    try{
      const response=await fetch("/api/nfe/distribution",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({cnpj:company.cnpj})});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error||"Não foi possível consultar DF-e.");
      const rows=Array.isArray(result)?result:Array.isArray(result.data)?result.data:Array.isArray(result.documents)?result.documents:[];
      setDfe(rows);
      notifySuccess(`Consulta concluída: ${rows.length} documento(s) retornado(s).`,"DF-e");
    }catch(error){notifyError(error instanceof Error?error.message:"Não foi possível consultar DF-e.","DF-e");}
    finally{setDfeLoading(false);}
  };

  const candidateRows = tab==="NFS-e" ? nfseCandidates : tab==="NFC-e" ? nfceCandidates : nfeCandidates;

  return <section className="fiscal-workspace">
    <div className="fiscal-hero">
      <div><span><ReceiptText size={14}/> CENTRAL FISCAL</span><h2>Fiscal e documentos eletrônicos</h2><p>Pré-validação, emissão, acompanhamento e documentos destinados em uma única área.</p></div>
      <button className="outline-btn" onClick={()=>onNavigate("Configurações")}><Settings size={15}/> Configurações fiscais</button>
    </div>

    <div className="fiscal-kpis">
      <article><FileClock size={19}/><div><small>PENDENTES</small><strong>{pending}</strong><span>aguardando fluxo fiscal</span></div></article>
      <article><FileCheck2 size={19}/><div><small>AUTORIZADAS</small><strong>{authorized}</strong><span>documentos confirmados</span></div></article>
      <article><AlertTriangle size={19}/><div><small>REJEIÇÕES / ERROS</small><strong>{rejected}</strong><span>requerem tratamento</span></div></article>
      <article className={certificateOk?"ok":"warning"}><ShieldCheck size={19}/><div><small>CERTIFICADO A1</small><strong>{loading?"...":certificateOk?"Válido":"Verificar"}</strong><span>{config?.certificate?.daysToExpiry!=null?`${config.certificate.daysToExpiry} dia(s) restantes`:"configuração fiscal"}</span></div></article>
    </div>

    <nav className="fiscal-tabs">{(["Visão geral","NF-e","NFC-e","NFS-e","DF-e"] as const).map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</nav>

    {tab==="Visão geral"&&<div className="fiscal-grid">
      <article><div className="fiscal-card-icon"><FileText size={20}/></div><div><small>MODELO 55</small><h3>NF-e</h3><p>Venda de mercadorias, devoluções, complementares e demais operações fiscais com produtos.</p><button onClick={()=>setTab("NF-e")}>Abrir NF-e</button></div></article>
      <article><div className="fiscal-card-icon"><ReceiptText size={20}/></div><div><small>MODELO 65</small><h3>NFC-e</h3><p>Venda ao consumidor final com CSC, série, ambiente e validação fiscal antes da transmissão.</p><button onClick={()=>setTab("NFC-e")}>Abrir NFC-e</button></div></article>
      <article><div className="fiscal-card-icon"><Landmark size={20}/></div><div><small>MIRASSOL / SP</small><h3>NFS-e</h3><p>Serviços originados de OS concluída, com código de serviço, ISS e dados municipais.</p><button onClick={()=>setTab("NFS-e")}>Abrir NFS-e</button></div></article>
      <article><div className="fiscal-card-icon"><RefreshCw size={20}/></div><div><small>DISTRIBUIÇÃO</small><h3>NF-e destinadas / DF-e</h3><p>Consulta de documentos destinados ao CNPJ da empresa usando certificado e provedor configurados.</p><button onClick={()=>setTab("DF-e")}>Consultar DF-e</button></div></article>
      <section className="fiscal-config-summary">
        <header><div><b>Saúde da configuração fiscal</b><small>Os dados sensíveis permanecem no cofre fiscal.</small></div><button onClick={()=>void loadConfig()}><RefreshCw size={14}/> Atualizar</button></header>
        <div><span className={certificateOk?"ok":"warn"}><i/>{certificateOk?"Certificado A1 válido":"Certificado A1 não confirmado"}</span><span><i/>Ambiente: {config?.company?.environment||"não informado"}</span><span><i/>Regime: {config?.company?.taxRegime||"não informado"}</span><span><i/>CSC NFC-e: {config?.nfce?.cscConfigured?"configurado":"não confirmado"}</span></div>
      </section>
    </div>}

    {(tab==="NF-e"||tab==="NFC-e"||tab==="NFS-e")&&<div className="fiscal-list-panel">
      <header><div><small>FILA DE EMISSÃO • {tab.toUpperCase()}</small><h3>{tab==="NFS-e"?"Ordens de serviço elegíveis":"Vendas elegíveis"}</h3><p>Os documentos passam obrigatoriamente pela pré-validação fiscal antes da transmissão.</p></div><span>{candidateRows.length} pendente(s)</span></header>
      {candidateRows.length?<div className="table-wrap"><table><thead><tr><th>ORIGEM</th><th>CLIENTE</th><th>DESCRIÇÃO</th><th>VALOR</th><th>SITUAÇÃO</th></tr></thead><tbody>{candidateRows.map(item=><tr key={item.id}><td><b>{item.id}</b></td><td>{item.client||"—"}</td><td>{item.service||item.name||item.description||"—"}</td><td>{Number(item.total??item.value??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td><span className="fiscal-state pending">Preparar emissão</span></td></tr>)}</tbody></table></div>:<div className="fiscal-empty"><CheckCircle2 size={24}/><b>Nenhum documento pendente nesta fila.</b><span>Novas operações elegíveis aparecerão automaticamente aqui.</span></div>}
      <div className="fiscal-flow-note"><ShieldCheck size={17}/><span><b>Fluxo protegido</b><small>Pré-validar → Transmitir → Processando/Autorizada/Rejeitada → armazenar XML, protocolo e representação fiscal.</small></span></div>
    </div>}

    {tab==="DF-e"&&<div className="fiscal-list-panel">
      <header><div><small>DOCUMENTOS DESTINADOS</small><h3>Distribuição NF-e / DF-e</h3><p>Consulta vinculada ao CNPJ {company.cnpj||"não cadastrado"}.</p></div><button className="primary-btn" disabled={dfeLoading} onClick={()=>void consultDfe()}><RefreshCw size={14}/>{dfeLoading?"Consultando...":"Consultar agora"}</button></header>
      {dfe.length?<div className="table-wrap"><table><thead><tr><th>CHAVE / NSU</th><th>EMITENTE</th><th>DATA</th><th>SITUAÇÃO</th></tr></thead><tbody>{dfe.map((item,index)=><tr key={item.chave||item.accessKey||item.nsu||index}><td>{item.chave||item.accessKey||item.nsu||"—"}</td><td>{item.emitente?.xNome||item.issuerName||item.emitente||"—"}</td><td>{item.dataEmissao||item.issueDate||item.data||"—"}</td><td><span className="fiscal-state">{item.status||item.situacao||"Recebido"}</span></td></tr>)}</tbody></table></div>:<div className="fiscal-empty"><RefreshCw size={24}/><b>Nenhuma consulta realizada nesta sessão.</b><span>Use “Consultar agora” para buscar documentos destinados na integração configurada.</span></div>}
    </div>}
  </section>;
}
