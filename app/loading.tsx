export default function Loading() {
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f7fb",fontFamily:"Arial,sans-serif",color:"#17304f"}}>
    <section style={{textAlign:"center",padding:32}}>
      <div style={{width:48,height:48,borderRadius:14,background:"#0a1426",display:"grid",placeItems:"center",margin:"0 auto 14px",color:"#fff",fontWeight:900}}>P</div>
      <h2 style={{margin:"0 0 6px",fontSize:18}}>Carregando ProAR</h2>
      <p style={{margin:0,color:"#64748b",fontSize:13}}>Preparando somente os dados necessários desta tela.</p>
    </section>
  </main>;
}
