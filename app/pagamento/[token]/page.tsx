"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { CheckCircle2, Copy, CreditCard, ExternalLink, LoaderCircle, QrCode, ReceiptText, ShieldCheck } from "lucide-react";
import { useParams } from "next/navigation";
import "./payment.css";

declare global {
  interface Window {
    MercadoPago?: new (publicKey:string)=>{
      cardForm:(config:Record<string,unknown>)=>{getCardFormData:()=>Record<string,string|number>;unmount?:()=>void};
    };
  }
}

type CheckoutData={
  receivable:{
    id:string;description:string;amountCents:number;dueDate:string;status:string;paymentMethod:"pix"|"boleto"|"card"|"manual";
    paymentUrl?:string;pixQrCode?:string;pixQrCodeBase64?:string;boletoDigitableLine?:string;providerStatus?:string;
  };
  company:{name:string;email:string;document:string};
  mercadoPago:{configured:boolean;publicKey:string};
};

const money=(cents:number)=>(cents/100).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(value:string)=>new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR");
const digits=(value:string)=>value.replace(/\D/g,"");

async function loadMercadoPago(){
  if(window.MercadoPago)return;
  await new Promise<void>((resolve,reject)=>{
    const existing=document.querySelector<HTMLScriptElement>('script[data-proar-mercadopago="1"]');
    if(existing){
      existing.addEventListener("load",()=>resolve(),{once:true});
      existing.addEventListener("error",()=>reject(new Error("Falha ao carregar Mercado Pago.")),{once:true});
      if(window.MercadoPago)resolve();
      return;
    }
    const script=document.createElement("script");
    script.src="https://sdk.mercadopago.com/js/v2";
    script.async=true;
    script.dataset.proarMercadopago="1";
    script.onload=()=>resolve();
    script.onerror=()=>reject(new Error("Falha ao carregar Mercado Pago."));
    document.head.appendChild(script);
  });
}

export default function PaymentPage(){
  const params=useParams<{token:string}>();
  const token=String(params?.token||"");
  const[data,setData]=useState<CheckoutData|null>(null);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState("");
  const[success,setSuccess]=useState("");
  const[processing,setProcessing]=useState(false);
  const cardFormRef=useRef<{getCardFormData:()=>Record<string,string|number>;unmount?:()=>void}|null>(null);

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const response=await fetch(`/api/billing/public/${encodeURIComponent(token)}`,{cache:"no-store"});
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||"Cobrança não encontrada.");
      setData(json);
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível carregar a cobrança.")}
    finally{setLoading(false)}
  };

  async function submitCard(form:Record<string,string|number>){
    setProcessing(true);setError("");
    try{
      const response=await fetch(`/api/billing/public/${encodeURIComponent(token)}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          cardToken:String(form.token||""),
          paymentMethodId:String(form.paymentMethodId||""),
          installments:Number(form.installments||1),
          payerEmail:String(form.cardholderEmail||data?.company.email||""),
          identificationType:String(form.identificationType||"CPF"),
          identificationNumber:String(form.identificationNumber||""),
        }),
      });
      const json=await response.json();
      if(!response.ok)throw new Error(json.error||"Pagamento não aprovado.");
      setSuccess("Pagamento processado. A liberação do ProAR será atualizada automaticamente.");
      await load();
    }catch(e){setError(e instanceof Error?e.message:"Não foi possível processar o cartão.")}
    finally{setProcessing(false)}
  }

  useEffect(()=>{if(token)void load()},[token]);

  useEffect(()=>{
    if(!data||data.receivable.paymentMethod!=="card"||data.receivable.status==="paid"||!data.mercadoPago.publicKey)return;
    let cancelled=false;
    void loadMercadoPago().then(()=>{
      if(cancelled||!window.MercadoPago)return;
      const mp=new window.MercadoPago(data.mercadoPago.publicKey);
      const cardForm=mp.cardForm({
        amount:(data.receivable.amountCents/100).toFixed(2),
        iframe:true,
        form:{
          id:"form-checkout",
          cardNumber:{id:"form-checkout__cardNumber",placeholder:"Número do cartão"},
          expirationDate:{id:"form-checkout__expirationDate",placeholder:"MM/AA"},
          securityCode:{id:"form-checkout__securityCode",placeholder:"CVV"},
          cardholderName:{id:"form-checkout__cardholderName",placeholder:"Nome do titular"},
          issuer:{id:"form-checkout__issuer",placeholder:"Banco emissor"},
          installments:{id:"form-checkout__installments",placeholder:"Parcelas"},
          identificationType:{id:"form-checkout__identificationType",placeholder:"Documento"},
          identificationNumber:{id:"form-checkout__identificationNumber",placeholder:"CPF/CNPJ"},
          cardholderEmail:{id:"form-checkout__cardholderEmail",placeholder:"E-mail"},
        },
        callbacks:{
          onFormMounted:(mountError:unknown)=>{if(mountError)setError("Não foi possível preparar o formulário do cartão.");},
          onSubmit:(event:Event)=>{
            event.preventDefault();
            const form=cardForm.getCardFormData();
            void submitCard(form);
          },
        },
      }) as {getCardFormData:()=>Record<string,string|number>;unmount?:()=>void};
      cardFormRef.current=cardForm;
    }).catch(e=>setError(e instanceof Error?e.message:"Falha ao carregar o cartão."));
    return()=>{cancelled=true;cardFormRef.current?.unmount?.();cardFormRef.current=null};
  },[data?.receivable.id,data?.receivable.status,data?.receivable.paymentMethod,data?.mercadoPago.publicKey]);



  const copy=async(value?:string)=>{
    if(!value)return;
    try{await navigator.clipboard.writeText(value);setSuccess("Código copiado.");}
    catch{setError("Não foi possível copiar automaticamente.")}
  };

  if(loading)return <main className="payment-page"><section className="payment-card payment-loading"><LoaderCircle className="spin"/><h1>Carregando cobrança</h1></section></main>;
  if(error&&!data)return <main className="payment-page"><section className="payment-card"><ShieldCheck size={34}/><h1>Pagamento ProAR</h1><div className="payment-error">{error}</div></section></main>;
  if(!data)return null;

  const paid=data.receivable.status==="paid";
  return <main className="payment-page"><section className="payment-card">
    <header className="payment-head"><div className="payment-brand"><ShieldCheck size={24}/></div><div><span>PROAR • PAGAMENTO SEGURO</span><h1>{data.company.name}</h1><p>{data.receivable.description}</p></div></header>

    <div className="payment-summary"><div><small>VALOR</small><strong>{money(data.receivable.amountCents)}</strong></div><div><small>VENCIMENTO</small><b>{date(data.receivable.dueDate)}</b></div><div><small>SITUAÇÃO</small><b>{paid?"PAGO":"EM ABERTO"}</b></div></div>

    {success&&<div className="payment-success"><CheckCircle2 size={17}/>{success}</div>}
    {error&&<div className="payment-error">{error}</div>}

    {paid?<div className="payment-complete"><CheckCircle2 size={42}/><h2>Pagamento confirmado</h2><p>Se o acesso estava bloqueado somente por inadimplência, a liberação é automática.</p></div>:<>
      {data.receivable.paymentMethod==="pix"&&<div className="payment-method">
        <div className="payment-method-title"><QrCode size={20}/><div><h2>Pix</h2><p>Pague usando o QR Code ou Pix Copia e Cola.</p></div></div>
        {data.receivable.pixQrCodeBase64&&<img className="payment-qr" src={`data:image/png;base64,${data.receivable.pixQrCodeBase64}`} alt="QR Code Pix"/>}
        {data.receivable.pixQrCode&&<button className="payment-copy" onClick={()=>void copy(data.receivable.pixQrCode)}><Copy size={16}/> Copiar código Pix</button>}
        {data.receivable.paymentUrl&&<a className="payment-primary" href={data.receivable.paymentUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Abrir pagamento no Mercado Pago</a>}
      </div>}

      {data.receivable.paymentMethod==="boleto"&&<div className="payment-method">
        <div className="payment-method-title"><ReceiptText size={20}/><div><h2>Boleto</h2><p>Use a linha digitável ou abra o boleto.</p></div></div>
        {data.receivable.boletoDigitableLine&&<button className="payment-copy" onClick={()=>void copy(data.receivable.boletoDigitableLine)}><Copy size={16}/> Copiar linha digitável</button>}
        {data.receivable.paymentUrl&&<a className="payment-primary" href={data.receivable.paymentUrl} target="_blank" rel="noreferrer"><ExternalLink size={16}/> Abrir boleto</a>}
      </div>}

      {data.receivable.paymentMethod==="card"&&<div className="payment-method">
        <div className="payment-method-title"><CreditCard size={20}/><div><h2>Cartão de crédito</h2><p>Os dados do cartão são enviados diretamente ao Mercado Pago.</p></div></div>
        {!data.mercadoPago.configured||!data.mercadoPago.publicKey?<div className="payment-error">Pagamento por cartão ainda não está configurado neste ambiente.</div>:
        <form id="form-checkout" className="payment-card-form" onSubmit={(e:FormEvent)=>e.preventDefault()}>
          <label>Número do cartão<div id="form-checkout__cardNumber" className="mp-field"/></label>
          <div className="payment-card-grid"><label>Validade<div id="form-checkout__expirationDate" className="mp-field"/></label><label>CVV<div id="form-checkout__securityCode" className="mp-field"/></label></div>
          <label>Nome do titular<input id="form-checkout__cardholderName" defaultValue=""/></label>
          <div className="payment-card-grid"><label>Banco<select id="form-checkout__issuer"/></label><label>Parcelas<select id="form-checkout__installments"/></label></div>
          <div className="payment-card-grid"><label>Documento<select id="form-checkout__identificationType"/></label><label>Número<input id="form-checkout__identificationNumber" defaultValue={digits(data.company.document)}/></label></div>
          <label>E-mail<input id="form-checkout__cardholderEmail" type="email" defaultValue={data.company.email}/></label>
          <button id="form-checkout__submit" className="payment-primary" disabled={processing}>{processing?<><LoaderCircle size={16} className="spin"/> Processando...</>:<><CreditCard size={16}/> Pagar {money(data.receivable.amountCents)}</>}</button>
        </form>}
      </div>}
    </>}

    <footer><ShieldCheck size={15}/><span>Ambiente seguro • O ProAR não armazena número do cartão nem CVV.</span></footer>
  </section></main>;
}
