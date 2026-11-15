"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileCheck2, FileClock, FileText, Landmark, ReceiptText, RefreshCw, Settings, ShieldCheck } from "lucide-react";
import { notifyError, notifySuccess } from "@/lib/ui-feedback";

type FiscalRecord = Record<string, any>;
type NfeLine = { id:string; productId:string; description:string; quantity:number; unitValue:number; ncm:string; cest:string; cfop:string; cst:string; csosn:string; taxOrigin:string; unit:string; icmsRate:string; ipiRate:string; pisRate:string; cofinsRate:string; };
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
  onSaveRecord,
}: {
  modules: Record<string, FiscalRecord[]>;
  serviceOrders: FiscalRecord[];
  company: { cnpj?: string; tradeName?: string };
  onNavigate: (name:string)=>void;
  onSaveRecord?: (module:string,record:FiscalRecord)=>void;
}) {
  const [tab,setTab]=useState<"Visão geral"|"NF-e"|"NFC-e"|"NFS-e"|"DF-e">("Visão geral");
  const [config,setConfig]=useState<FiscalConfig|null>(null);
  const [loading,setLoading]=useState(true);
  const [dfeLoading,setDfeLoading]=useState(false);
  const [dfe,setDfe]=useState<FiscalRecord[]>([]);
  const [nfeOrigin,setNfeOrigin]=useState<FiscalRecord|null>(null);
  const [nfeKind,setNfeKind]=useState<"NF-e"|"NFC-e">("NF-e");
  const [nfeCustomer,setNfeCustomer]=useState({name:"",document:"",address:"",stateRegistration:""});
  const [nfeNature,setNfeNature]=useState("");
  const [nfeSeries,setNfeSeries]=useState("");
  const [nfePayment,setNfePayment]=useState("");
  const [nfeFreight,setNfeFreight]=useState("9");
  const [nfeLines,setNfeLines]=useState<NfeLine[]>([]);
  const [nfeBusy,setNfeBusy]=useState(false);
  const [nfeNotice,setNfeNotice]=useState("");

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
  const productCatalog=modules.Produtos??[];
  const customers=modules.Clientes??[];
  const startNfe=(sale:FiscalRecord)=>{
    const customer=customers.find(row=>row.id===sale.customerId||row.name===sale.client||row.tradeName===sale.client);
    const lines=(sale.purchaseItems??[]).filter((row:FiscalRecord)=>row.kind!=="Serviço"&&row.kind!=="Custo adicional").map((row:FiscalRecord,index:number)=>{
      const product=productCatalog.find(item=>item.id===row.productId);
      return {id:String(row.id||sale.id+"-"+index),productId:String(row.productId||""),description:String(row.description||product?.name||""),quantity:Number(row.quantity||1),unitValue:Number(row.unitValue||product?.value||0),ncm:String(product?.ncm||row.ncm||""),cest:String(product?.cest||row.cest||""),cfop:String(product?.cfop||row.cfop||""),cst:String(product?.cst||row.cst||""),csosn:String(product?.csosn||row.csosn||""),taxOrigin:String(product?.taxOrigin||row.taxOrigin||""),unit:String(product?.unitOfMeasure||row.unitOfMeasure||"UN"),icmsRate:String(row.icmsRate??""),ipiRate:String(row.ipiRate??""),pisRate:String(row.pisRate??""),cofinsRate:String(row.cofinsRate??"")} as NfeLine;
    });
    setNfeOrigin(sale);setNfeKind("NF-e");
    setNfeCustomer({name:String(customer?.name||sale.client||""),document:String(customer?.doc||sale.doc||""),address:String(customer?.address||sale.address||""),stateRegistration:String(customer?.stateRegistration||"")});
    setNfeNature(String(sale.operationNature||""));setNfeSeries(String(config?.nfe?.series||"1"));setNfePayment(String(sale.paymentMethod||sale.paymentType||""));setNfeFreight("9");setNfeLines(lines);setNfeNotice("");
  };
  const startNfce=(sale:FiscalRecord)=>{startNfe(sale);setNfeKind("NFC-e");setNfeSeries(String(config?.nfce?.series||"1"));};
  const updateNfeLine=(id:string,patch:Partial<NfeLine>)=>setNfeLines(current=>current.map(line=>line.id===id?{...line,...patch}:line));
  const addNfeProduct=(productId:string)=>{const product=productCatalog.find(row=>row.id===productId);if(!product)return;setNfeLines(current=>[...current,{id:product.id+"-"+Date.now(),productId:product.id,description:String(product.name||""),quantity:1,unitValue:Number(product.value||0),ncm:String(product.ncm||""),cest:String(product.cest||""),cfop:String(product.cfop||""),cst:String(product.cst||""),csosn:String(product.csosn||""),taxOrigin:String(product.taxOrigin||""),unit:String(product.unitOfMeasure||"UN"),icmsRate:"",ipiRate:"",pisRate:"",cofinsRate:""}]);};
  const nfeTotal=nfeLines.reduce((sum,line)=>sum+Math.max(0,line.quantity)*Math.max(0,line.unitValue),0);
  const submitNfe=async()=>{
    if(!nfeOrigin)return;
    setNfeBusy(true);setNfeNotice("");
    const payload={saleId:nfeOrigin.id,model:nfeKind==="NF-e"?55:65,series:nfeSeries,operationNature:nfeNature,freightModality:nfeFreight,paymentMethod:nfePayment,total:nfeTotal,company:{document:company.cnpj||"",stateRegistration:config?.company?.stateRegistration||"",municipalRegistration:config?.company?.municipalRegistration||"",taxRegime:config?.company?.taxRegime||""},customer:nfeCustomer,items:nfeLines,config:{cscId:config?.nfce?.cscId||"",environment:config?.company?.environment||"Homologação"}};
    try{
      const response=await fetch(nfeKind==="NF-e"?"/api/nfe/issue":"/api/nfce/issue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...payload,idempotencyKey:crypto.randomUUID()})});
      const result=await response.json().catch(()=>({}));
      const provider=result.result??result.provider??{};
      const accessKey=String(provider.accessKey||provider.chave||provider.chNFe||provider.key||"");
      const protocol=String(provider.protocol||provider.protocolo||provider.nProt||"");
      const authorized=Boolean(response.ok&&result.issued&&result.status==="Autorizada"&&accessKey&&protocol);
      const status=authorized?"Autorizada":result.status==="Processando"?"Processando":"Rejeitada";
      const number=String(provider.number||provider.numero||accessKey.slice(-9));
      onSaveRecord?.("Documentos Fiscais",{id:(nfeKind==="NF-e"?"NFE-":"NFCE-")+nfeOrigin.id,name:nfeKind+" • "+nfeOrigin.id,client:nfeCustomer.name,doc:nfeCustomer.document,originId:nfeOrigin.id,kind:nfeKind,model:nfeKind==="NF-e"?"55":"65",status,invoiceNumber:authorized?number:"",accessKey,protocol,amount:nfeTotal,series:nfeSeries,environment:config?.company?.environment||"Homologação",error:authorized?"":String(result.error||"A autorização não foi confirmada."),createdAt:new Date().toISOString(),provider:result});
      if(authorized){onSaveRecord?.("Vendas",{...nfeOrigin,invoiceNumber:number,invoiceAccessKey:accessKey,invoiceProtocol:protocol,invoiceStatus:status});setNfeNotice(nfeKind+" autorizada. Chave: "+accessKey);setNfeOrigin(null);}
      else setNfeNotice(String(result.error||"NF-e não autorizada. Revise os dados e a resposta do emissor."));
    }catch(error){setNfeNotice(error instanceof Error?error.message:"Falha ao transmitir NF-e.");}
    finally{setNfeBusy(false);}
  };

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
      {candidateRows.length?<div className="table-wrap"><table><thead><tr><th>ORIGEM</th><th>CLIENTE</th><th>DESCRIÇÃO</th><th>VALOR</th><th>SITUAÇÃO</th>{(tab==="NF-e"||tab==="NFC-e")&&<th>AÇÃO</th>}</tr></thead><tbody>{candidateRows.map(item=><tr key={item.id}><td><b>{item.id}</b></td><td>{item.client||"—"}</td><td>{item.service||item.name||item.description||"—"}</td><td>{Number(item.total??item.value??0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</td><td><span className="fiscal-state pending">Preparar emissão</span></td>{(tab==="NF-e"||tab==="NFC-e")&&<td><button className="primary-btn" onClick={()=>tab==="NFC-e"?startNfce(item):startNfe(item)}>Preparar {tab}</button></td>}</tr>)}</tbody></table></div>:<div className="fiscal-empty"><CheckCircle2 size={24}/><b>Nenhum documento pendente nesta fila.</b><span>Novas operações elegíveis aparecerão automaticamente aqui.</span></div>}
      {(tab==="NF-e"||tab==="NFC-e")&&nfeOrigin&&<section className="panel fiscal-emit-form">
        <header><div><small>{nfeKind} MODELO {nfeKind==="NF-e"?"55":"65"} • ORIGEM {nfeOrigin.id}</small><h3>Revisar dados fiscais</h3><p>Confira destinatário, operação, produto e tributação. O ProAR não preenche códigos fiscais ou alíquotas por suposição.</p></div><button className="outline-btn" onClick={()=>setNfeOrigin(null)}>Fechar</button></header>
        {nfeNotice&&<div className="pdv-notice" role="status">{nfeNotice}</div>}
        <div className="settings-form">
          <label>Natureza da operação<input value={nfeNature} onChange={e=>setNfeNature(e.target.value)} placeholder="Ex.: venda de mercadoria"/></label>
          <label>Série NF-e<input inputMode="numeric" value={nfeSeries} onChange={e=>setNfeSeries(e.target.value.replace(/\D/g,"").slice(0,3))}/></label>
          <label>Forma de pagamento<input value={nfePayment} onChange={e=>setNfePayment(e.target.value)} placeholder="PIX, cartão, boleto..."/></label>
          <label>Frete<select value={nfeFreight} onChange={e=>setNfeFreight(e.target.value)}><option value="0">Emitente por conta</option><option value="1">Destinatário por conta</option><option value="2">Terceiros</option><option value="3">Próprio do remetente</option><option value="4">Próprio do destinatário</option><option value="9">Sem transporte</option></select></label>
          <label>Destinatário<input value={nfeCustomer.name} onChange={e=>setNfeCustomer({...nfeCustomer,name:e.target.value})}/></label>
          <label>CPF / CNPJ<input inputMode="numeric" value={nfeCustomer.document} onChange={e=>setNfeCustomer({...nfeCustomer,document:e.target.value})}/></label>
          <label className="wide">Endereço completo<input value={nfeCustomer.address} onChange={e=>setNfeCustomer({...nfeCustomer,address:e.target.value})}/></label>
          <label>Inscrição Estadual do destinatário<input value={nfeCustomer.stateRegistration} onChange={e=>setNfeCustomer({...nfeCustomer,stateRegistration:e.target.value})}/></label>
          <div className="fiscal-config-summary"><span>Emitente: {company.tradeName||"Empresa"} • {company.cnpj||"CNPJ pendente"}</span><span>Regime: {config?.company?.taxRegime||"não informado"} • Ambiente: {config?.company?.environment||"Homologação"}</span></div>
        </div>
        <div className="table-wrap"><table><thead><tr><th>ITEM</th><th>QTD.</th><th>V. UNIT.</th><th>UN</th><th>NCM</th><th>CEST</th><th>CFOP</th><th>CST</th><th>CSOSN</th><th>ORIGEM</th><th>ICMS %</th><th>IPI %</th><th>PIS %</th><th>COFINS %</th><th></th></tr></thead><tbody>{nfeLines.map(line=><tr key={line.id}>
          <td><input aria-label="Descrição do produto" value={line.description} onChange={e=>updateNfeLine(line.id,{description:e.target.value})}/></td>
          <td><input aria-label="Quantidade" type="number" min="0.001" step="0.001" value={line.quantity} onChange={e=>updateNfeLine(line.id,{quantity:Number(e.target.value)})}/></td>
          <td><input aria-label="Valor unitário" type="number" min="0" step="0.01" value={line.unitValue} onChange={e=>updateNfeLine(line.id,{unitValue:Number(e.target.value)})}/></td>
          <td>{line.unit}</td>
          <td><input aria-label="NCM" inputMode="numeric" maxLength={8} value={line.ncm} onChange={e=>updateNfeLine(line.id,{ncm:e.target.value.replace(/\D/g,"").slice(0,8)})}/></td>
          <td><input aria-label="CEST" inputMode="numeric" maxLength={7} value={line.cest} onChange={e=>updateNfeLine(line.id,{cest:e.target.value.replace(/\D/g,"").slice(0,7)})}/></td>
          <td><input aria-label="CFOP" inputMode="numeric" maxLength={4} value={line.cfop} onChange={e=>updateNfeLine(line.id,{cfop:e.target.value.replace(/\D/g,"").slice(0,4)})}/></td>
          <td><input aria-label="CST" value={line.cst} onChange={e=>updateNfeLine(line.id,{cst:e.target.value})}/></td>
          <td><input aria-label="CSOSN" value={line.csosn} onChange={e=>updateNfeLine(line.id,{csosn:e.target.value})}/></td>
          <td><input aria-label="Origem tributária" inputMode="numeric" maxLength={1} value={line.taxOrigin} onChange={e=>updateNfeLine(line.id,{taxOrigin:e.target.value.replace(/\D/g,"").slice(0,1)})}/></td>
          <td><input aria-label="Alíquota ICMS" type="number" min="0" step="0.01" value={line.icmsRate} onChange={e=>updateNfeLine(line.id,{icmsRate:e.target.value})}/></td>
          <td><input aria-label="Alíquota IPI" type="number" min="0" step="0.01" value={line.ipiRate} onChange={e=>updateNfeLine(line.id,{ipiRate:e.target.value})}/></td>
          <td><input aria-label="Alíquota PIS" type="number" min="0" step="0.01" value={line.pisRate} onChange={e=>updateNfeLine(line.id,{pisRate:e.target.value})}/></td>
          <td><input aria-label="Alíquota COFINS" type="number" min="0" step="0.01" value={line.cofinsRate} onChange={e=>updateNfeLine(line.id,{cofinsRate:e.target.value})}/></td>
          <td><button className="danger" onClick={()=>setNfeLines(rows=>rows.filter(row=>row.id!==line.id))}>Remover</button></td></tr>)}</tbody></table></div>
        <div className="settings-footer-actions"><select aria-label="Adicionar produto cadastrado" defaultValue="" onChange={e=>{addNfeProduct(e.target.value);e.target.value="";}}><option value="">Adicionar produto cadastrado…</option>{productCatalog.map(product=><option key={product.id} value={product.id}>{product.name} • NCM {product.ncm||"pendente"}</option>)}</select><strong>Total dos itens: {nfeTotal.toLocaleString("pt-BR",{style:"currency",currency:"BRL"})}</strong><button className="primary-btn" disabled={nfeBusy||!nfeNature.trim()||!nfeLines.length} onClick={()=>void submitNfe()}>{nfeBusy?"Transmitindo...":"Transmitir "+nfeKind}</button></div>
      </section>}
      <div className="fiscal-flow-note"><ShieldCheck size={17}/><span><b>Fluxo protegido</b><small>Pré-validar → Transmitir → Processando/Autorizada/Rejeitada → armazenar XML, protocolo e representação fiscal.</small></span></div>
    </div>}

    {tab==="DF-e"&&<div className="fiscal-list-panel">
      <header><div><small>DOCUMENTOS DESTINADOS</small><h3>Distribuição NF-e / DF-e</h3><p>Consulta vinculada ao CNPJ {company.cnpj||"não cadastrado"}.</p></div><button className="primary-btn" disabled={dfeLoading} onClick={()=>void consultDfe()}><RefreshCw size={14}/>{dfeLoading?"Consultando...":"Consultar agora"}</button></header>
      {dfe.length?<div className="table-wrap"><table><thead><tr><th>CHAVE / NSU</th><th>EMITENTE</th><th>DATA</th><th>SITUAÇÃO</th></tr></thead><tbody>{dfe.map((item,index)=><tr key={item.chave||item.accessKey||item.nsu||index}><td>{item.chave||item.accessKey||item.nsu||"—"}</td><td>{item.emitente?.xNome||item.issuerName||item.emitente||"—"}</td><td>{item.dataEmissao||item.issueDate||item.data||"—"}</td><td><span className="fiscal-state">{item.status||item.situacao||"Recebido"}</span></td></tr>)}</tbody></table></div>:<div className="fiscal-empty"><RefreshCw size={24}/><b>Nenhuma consulta realizada nesta sessão.</b><span>Use “Consultar agora” para buscar documentos destinados na integração configurada.</span></div>}
    </div>}
  </section>;
}
