"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f7fb",fontFamily:"Arial,sans-serif",padding:24}}>
    <section style={{maxWidth:560,width:"100%",background:"#fff",border:"1px solid #e2e8f0",borderRadius:20,padding:28,boxShadow:"0 18px 60px rgba(15,23,42,.08)"}}>
      <div style={{width:46,height:46,borderRadius:14,background:"#fff1f2",color:"#be123c",display:"grid",placeItems:"center"}}><AlertTriangle size={22}/></div>
      <h1 style={{fontSize:21,color:"#0f172a",margin:"16px 0 8px"}}>Não foi possível abrir esta tela</h1>
      <p style={{color:"#64748b",fontSize:14,lineHeight:1.6}}>Os dados não foram apagados. Tente carregar o módulo novamente. Se o problema continuar, use o código abaixo no suporte.</p>
      <small style={{display:"block",marginTop:10,color:"#94a3b8"}}>{error.digest ? `Código: ${error.digest}` : "Erro de interface sem código de diagnóstico."}</small>
      <div style={{display:"flex",gap:10,marginTop:20,flexWrap:"wrap"}}>
        <button onClick={reset} style={{border:0,borderRadius:11,padding:"11px 16px",background:"#1768df",color:"#fff",fontWeight:800,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:7}}><RefreshCw size={15}/> Tentar novamente</button>
        <button onClick={()=>location.assign("/")} style={{border:"1px solid #cbd5e1",borderRadius:11,padding:"11px 16px",background:"#fff",color:"#334155",fontWeight:800,cursor:"pointer"}}>Voltar ao início</button>
      </div>
    </section>
  </main>;
}
